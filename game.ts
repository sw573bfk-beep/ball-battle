/**
 * Local game loop.
 *
 * It already runs the *shared* simulation on a fixed timestep, so when the
 * server arrives in Milestone 4 this same class becomes the prediction layer
 * rather than being thrown away.
 */

import { MAX_CATCHUP_TICKS, TICK_DT } from '@shared/config.js';
import { addPlayer, createWorld, stepWorld } from '@shared/sim.js';
import type { InputCmd, PlayerState, SimEvent, WorldState } from '@shared/types.js';
import { TRAINING_MAP } from '@shared/maps.js';
import { Fx } from './fx.js';
import { InputManager } from './input.js';
import { Renderer } from './renderer.js';
import { Viewport } from './viewport.js';
import type { KillFeedEntry } from './renderer.js';

export class LocalGame {
  readonly world: WorldState;
  readonly localId = 'local';
  private accumulator = 0;
  private lastTime = 0;
  private inputs = new Map<string, InputCmd>();
  fps = 60;
  private rafId = 0;
  private running = false;

  readonly fx = new Fx();
  readonly viewport: Viewport;
  readonly input: InputManager;
  private renderer: Renderer;

  debug = false;
  readonly killFeed: KillFeedEntry[] = [];

  constructor(canvas: HTMLCanvasElement, mapId = TRAINING_MAP) {
    this.world = createWorld(mapId);
    this.world.match.phase = 'practice';
    addPlayer(this.world, this.localId, 'You', 0);

    // Training dummies: blue team, stationary, respawn on their own.
    // They stand on the map's own blue pads, so they are always on valid ground
    // whichever arena you load.
    const pads = this.world.map.spawns[1];
    for (let i = 0; i < 3; i++) {
      const d = addPlayer(this.world, `dummy${i}`, `Dummy ${i + 1}`, 1, true);
      const pad = pads[i % pads.length];
      d.x = pad.x;
      d.y = pad.y;
      d.invuln = 0;
    }

    this.viewport = new Viewport(canvas, this.world.map.width, this.world.map.height);
    this.input = new InputManager(canvas, this.viewport);
    this.renderer = new Renderer(canvas, this.viewport);

    window.addEventListener('resize', this.onResize);
  }

  get localPlayer(): PlayerState {
    return this.world.players.get(this.localId)!;
  }

  private onResize = (): void => this.viewport.resize();

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  destroy(): void {
    this.stop();
    this.input.destroy();
    window.removeEventListener('resize', this.onResize);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.25);
    this.fps += ((rawDt > 0 ? 1 / rawDt : 60) - this.fps) * 0.08;

    this.advance(dt);
    this.render();

    this.rafId = requestAnimationFrame(this.frame);
  };

  /** Runs whole simulation ticks; leftover time carries into the next frame. */
  advance(dt: number): void {
    this.accumulator += dt;
    let ticks = 0;
    while (this.accumulator >= TICK_DT && ticks < MAX_CATCHUP_TICKS) {
      this.tick();
      this.accumulator -= TICK_DT;
      ticks++;
    }
    if (ticks === MAX_CATCHUP_TICKS) this.accumulator = 0; // drop the backlog
    this.fx.update(dt);
    this.ageKillFeed(dt);
  }

  private tick(): void {
    const p = this.localPlayer;
    this.inputs.set(this.localId, this.input.consume(p.x, p.y));
    stepWorld(this.world, this.inputs);
    this.drainEvents();

    if (p.alive && (p.dashTime > 0 || Math.hypot(p.vx, p.vy) > 460)) {
      this.fx.pushTrail(p.x, p.y);
    }
  }

  /** Turns simulation events into cosmetics, then clears them. */
  private drainEvents(): void {
    for (const e of this.world.events) this.playEvent(e);
    this.world.events.length = 0;
  }

  private playEvent(e: SimEvent): void {
    switch (e.t) {
      case 'dash':
        this.fx.burst(e.x - e.dx * 12, e.y - e.dy * 12, 14, {
          dirX: -e.dx, dirY: -e.dy, spread: 1.5, speed: 380, life: 0.3, size: 3.2, color: [255, 120, 150],
        });
        break;
      case 'walldash':
        this.fx.burst(e.x - e.dx * 14, e.y - e.dy * 14, 22, {
          dirX: -e.dx, dirY: -e.dy, spread: 2.0, speed: 480, life: 0.36, size: 3.6, color: [255, 220, 140],
        });
        this.fx.addShake(3.5);
        break;
      case 'wallhit': {
        const n = Math.min(18, 4 + e.speed / 70);
        this.fx.burst(e.x - e.nx * 14, e.y - e.ny * 14, n, {
          dirX: e.nx, dirY: e.ny, spread: 1.9, speed: 150 + e.speed * 0.35,
          life: 0.28, size: 2.6, color: [200, 220, 255],
        });
        this.fx.addShake(Math.min(7, e.speed / 130));
        break;
      }
      case 'shoot':
        this.fx.burst(e.x, e.y, 6, {
          dirX: e.dx, dirY: e.dy, spread: 0.7, speed: 300, life: 0.12, size: 2.6, drag: 9,
          color: [255, 235, 170],
        });
        this.fx.addShake(0.7);
        break;
      case 'bulletwall':
        this.fx.burst(e.x, e.y, 7, {
          dirX: e.nx, dirY: e.ny, spread: 1.7, speed: 220, life: 0.2, size: 2.2, color: [200, 215, 255],
        });
        break;
      case 'hit':
        this.fx.burst(e.x, e.y, 10, {
          dirX: e.dx, dirY: e.dy, spread: 1.5, speed: 300, life: 0.26, size: 2.8, color: [255, 190, 120],
        });
        this.fx.floatText(e.x, e.y - 22, String(e.damage), '#ffd166', 15);
        this.fx.addShake(1.4);
        break;
      case 'swing':
        this.fx.burst(e.x + Math.cos(e.aim) * 26, e.y + Math.sin(e.aim) * 26, 8, {
          dirX: Math.cos(e.aim), dirY: Math.sin(e.aim), spread: 1.4, speed: 300,
          life: 0.16, size: 2.6, color: [200, 235, 255],
        });
        break;
      case 'swordhit':
        this.fx.burst(e.x, e.y, 26, {
          dirX: Math.cos(e.aim), dirY: Math.sin(e.aim), spread: 2.2, speed: 520,
          life: 0.4, size: 4, color: [255, 255, 255],
        });
        this.fx.floatText(e.x, e.y - 26, 'SLICED', '#ffffff', 17);
        this.fx.addShake(9);
        break;
      case 'death': {
        const col: [number, number, number] = e.team === 0 ? [255, 84, 112] : e.team === 1 ? [76, 201, 255] : [255, 209, 102];
        this.fx.burst(e.x, e.y, 34, { speed: 460, life: 0.55, size: 4.2, color: col });
        this.fx.addShake(e.victim === this.localId ? 14 : 6);
        this.pushKill(e.killer, e.victim, e.weapon);
        break;
      }
      case 'respawn':
        this.fx.burst(e.x, e.y, 18, { speed: 240, life: 0.4, size: 3, color: [255, 255, 255] });
        break;
      case 'fall':
        this.fx.burst(e.x, e.y, 26, { speed: 180, life: 0.7, size: 3.4, drag: 1.2, color: [255, 84, 112] });
        this.fx.floatText(e.x, e.y - 10, 'DOWN THE HOLE', '#8ea0c8', 13);
        this.fx.addShake(8);
        break;
      case 'pickup':
        this.fx.burst(e.x, e.y, 20, { speed: 300, life: 0.45, size: 3.2, color: [140, 230, 200] });
        this.fx.floatText(e.x, e.y - 26, e.kind.toUpperCase(), '#8ee7c0', 14);
        break;
      case 'reload':
      case 'phase':
      case 'objective':
        break;
    }
  }

  private pushKill(killerId: string, victimId: string, weapon: 'gun' | 'sword' | 'fall'): void {
    const killer = this.world.players.get(killerId);
    const victim = this.world.players.get(victimId);
    if (!victim) return;
    this.killFeed.push({
      killer: killer ? killer.name : '',
      killerTeam: killer ? killer.team : 2,
      victim: victim.name,
      victimTeam: victim.team,
      weapon,
      age: 0,
      involvesLocal: killerId === this.localId || victimId === this.localId,
    });
    if (this.killFeed.length > 5) this.killFeed.shift();
  }

  private ageKillFeed(dt: number): void {
    for (let i = this.killFeed.length - 1; i >= 0; i--) {
      this.killFeed[i].age += dt;
      if (this.killFeed[i].age > 5) this.killFeed.splice(i, 1);
    }
  }

  render(): void {
    this.renderer.draw(this.world, this.fx, this.localId, {
      fps: this.fps,
      debug: this.debug,
      killFeed: this.killFeed,
      showScoreboard: this.input.isDown('scoreboard'),
    });
  }
}
