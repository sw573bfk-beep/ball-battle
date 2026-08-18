/**
 * Networked game: server-authoritative, with client-side prediction for your
 * own movement and interpolation for everyone else.
 *
 * What is predicted: your position, velocity, dash and wall state. That is what
 * has to feel instant.
 * What is not predicted: health, ammo, weapons, projectiles, scores. Those come
 * from the server and only from the server, so no amount of client tampering
 * can invent a kill.
 */

import { MAX_CATCHUP_TICKS, NET, TICK_DT, type ModeId } from '@shared/config.js';
import { createWorld, stepPlayer } from '@shared/sim.js';
import { BTN, createPlayer, type InputCmd, type PlayerState, type Projectile, type SimEvent, type TeamId, type WorldState } from '@shared/types.js';
import type { RosterEntry, WireInput } from '@shared/protocol.js';
import { PF } from '@shared/protocol.js';
import { packInput } from '@shared/protocol.js';
import { getMap } from '@shared/maps.js';
import { Fx } from './fx.js';
import { InputManager } from './input.js';
import { NetClient, type NetStatus, type Snapshot } from './net.js';
import { Renderer, type KillFeedEntry } from './renderer.js';
import { Viewport } from './viewport.js';

/** How fast a prediction error is smoothed away, per second. */
const ERROR_DECAY = 9;
/** Above this error we snap instead of smoothing (teleport, respawn, big desync). */
const SNAP_THRESHOLD = 90;

export interface OnlineHooks {
  onStatus?(status: NetStatus, detail?: string): void;
  onRoster?(players: RosterEntry[]): void;
  onSettings?(mode: ModeId, mapId: string): void;
}

export class OnlineGame {
  readonly world: WorldState;
  readonly fx = new Fx();
  readonly viewport: Viewport;
  readonly input: InputManager;
  readonly net: NetClient;
  readonly killFeed: KillFeedEntry[] = [];

  localId: string | null = null;
  roomCode = '';
  debug = false;
  fps = 60;

  private renderer: Renderer;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;
  private seq = 0;

  /** Inputs sent but not yet acknowledged; replayed after every correction. */
  private pending: InputCmd[] = [];
  private recentWire: WireInput[] = [];
  private snapshots: Snapshot[] = [];
  private roster = new Map<string, RosterEntry>();
  private errorX = 0;
  private errorY = 0;
  private rematchCooldown = 0;
  private scratch: SimEvent[] = [];

  constructor(canvas: HTMLCanvasElement, private hooks: OnlineHooks = {}) {
    this.world = createWorld('training');
    this.viewport = new Viewport(canvas, this.world.map.width, this.world.map.height);
    this.input = new InputManager(canvas, this.viewport);
    this.renderer = new Renderer(canvas, this.viewport);

    this.net = new NetClient({
      onWelcome: (id, room, mapId) => {
        this.localId = id;
        this.roomCode = room;
        this.world.map = getMap(mapId);
        this.viewport.setWorldSize(this.world.map.width, this.world.map.height);
      },
      onRoster: (players) => this.applyRoster(players),
      onSettings: (mode, mapId) => {
        this.world.match.mode = mode;
        if (this.world.map.id !== mapId) {
          this.world.map = getMap(mapId);
          this.viewport.setWorldSize(this.world.map.width, this.world.map.height);
        }
        this.hooks.onSettings?.(mode, mapId);
      },
      onSnapshot: (snap) => this.applySnapshot(snap),
      onStatus: (s, d) => this.hooks.onStatus?.(s, d),
    });

    window.addEventListener('resize', this.onResize);
  }

  connect(serverUrl: string, room: string, name: string, mode?: ModeId, mapId?: string): void {
    this.net.connect(serverUrl, room, name, mode, mapId);
  }

  /** "Run it back" — any player can skip the rest of the results screen. */
  requestRematch(): void {
    this.net.requestRematch();
  }

  setMode(mode: ModeId): void { this.net.setMode(mode); }
  setMap(mapId: string): void { this.net.setMap(mapId); }

  get localPlayer(): PlayerState | null {
    return this.localId ? this.world.players.get(this.localId) ?? null : null;
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
    this.net.close();
    this.input.destroy();
    window.removeEventListener('resize', this.onResize);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.25);
    this.fps += ((rawDt > 0 ? 1 / rawDt : 60) - this.fps) * 0.08;

    this.accumulator += dt;
    let ticks = 0;
    while (this.accumulator >= TICK_DT && ticks < MAX_CATCHUP_TICKS) {
      this.tick();
      this.accumulator -= TICK_DT;
      ticks++;
    }
    if (ticks === MAX_CATCHUP_TICKS) this.accumulator = 0;

    this.fx.update(dt);
    this.ageKillFeed(dt);
    this.decayError(dt);
    this.interpolateRemotes(now);
    this.extrapolateBullets(now);
    this.render();

    this.rafId = requestAnimationFrame(this.frame);
  };

  // ----------------------------------------------------------- local tick

  private tick(): void {
    const local = this.localPlayer;
    if (!local) return;

    const cmd = this.input.consume(local.x, local.y);
    cmd.seq = ++this.seq;

    // SPACE doubles as "run it back" on the results screen.
    if (this.rematchCooldown > 0) this.rematchCooldown -= TICK_DT;
    if (this.world.match.phase === 'results' && (cmd.buttons & BTN.DASH) !== 0 && this.rematchCooldown <= 0) {
      this.requestRematch();
      this.rematchCooldown = 1;
    }

    this.net.queueInput(cmd);
    this.pending.push(cmd);
    if (this.pending.length > 240) this.pending.shift();   // ~4s of desync guard

    // Predict movement only. Weapons and damage stay with the server.
    this.scratch.length = 0;
    stepPlayer(local, cmd, this.world.map, TICK_DT, this.scratch);
    for (const e of this.scratch) this.playEvent(e, true);

    if (local.alive && (local.dashTime > 0 || Math.hypot(local.vx, local.vy) > 460)) {
      this.fx.pushTrail(local.x + this.errorX, local.y + this.errorY);
    }

    this.recentWire.push(packInput(cmd));
    if (this.recentWire.length > 6) this.recentWire.shift();
    this.net.flush(this.recentWire.slice(0, -1));
  }

  // ------------------------------------------------------- server updates

  private applyRoster(players: RosterEntry[]): void {
    this.roster.clear();
    for (const entry of players) this.roster.set(entry.id, entry);

    for (const entry of players) {
      let p = this.world.players.get(entry.id);
      if (!p) {
        p = createPlayer(entry.id, entry.name, entry.team, -1000, -1000);
        this.world.players.set(entry.id, p);
      }
      p.name = entry.name;
      p.team = entry.team;
    }
    for (const id of [...this.world.players.keys()]) {
      if (!this.roster.has(id)) this.world.players.delete(id);
    }
    this.hooks.onRoster?.(players);
  }

  private applySnapshot(snap: Snapshot): void {
    this.snapshots.push(snap);
    if (this.snapshots.length > 24) this.snapshots.shift();

    this.world.scores = snap.scores;
    this.world.tick = snap.tick;
    if (snap.match) this.world.match = snap.match;
    if (snap.objective) this.world.objective = snap.objective;
    if (snap.powerups) this.world.powerups = snap.powerups;

    // --- reconcile the local player
    const local = this.localPlayer;
    if (local && snap.me) {
      const beforeX = local.x;
      const beforeY = local.y;

      Object.assign(local, snap.me);
      this.pending = this.pending.filter((c) => c.seq > snap.ack);
      for (const cmd of this.pending) {
        this.scratch.length = 0;
        stepPlayer(local, cmd, this.world.map, TICK_DT, this.scratch);
      }

      // Absorb small corrections visually instead of teleporting.
      const dx = beforeX - local.x;
      const dy = beforeY - local.y;
      if (Math.hypot(dx, dy) < SNAP_THRESHOLD) {
        this.errorX = dx;
        this.errorY = dy;
      } else {
        this.errorX = 0;
        this.errorY = 0;
      }
    }

    // --- events (skip the ones we already played locally)
    for (const e of snap.events) this.playEvent(e, false);
  }

  private decayError(dt: number): void {
    const k = Math.exp(-ERROR_DECAY * dt);
    this.errorX *= k;
    this.errorY *= k;
    if (Math.abs(this.errorX) < 0.05) this.errorX = 0;
    if (Math.abs(this.errorY) < 0.05) this.errorY = 0;
  }

  /** Renders remote players ~100ms in the past, between two real snapshots. */
  private interpolateRemotes(now: number): void {
    if (this.snapshots.length === 0) return;
    const renderTime = now - NET.INTERP_DELAY_MS;

    let older: Snapshot | null = null;
    let newer: Snapshot | null = null;
    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      if (this.snapshots[i].receivedAt <= renderTime) {
        older = this.snapshots[i];
        newer = this.snapshots[i + 1] ?? null;
        break;
      }
    }
    if (!older) older = this.snapshots[0];
    if (!newer) newer = this.snapshots[this.snapshots.length - 1];

    const span = newer.receivedAt - older.receivedAt;
    const t = span > 1 ? Math.min(1, Math.max(0, (renderTime - older.receivedAt) / span)) : 1;

    const oldRows = new Map(older.players.map((r) => [r[0], r]));

    for (const row of newer.players) {
      const id = row[0];
      if (id === this.localId) continue;
      const p = this.world.players.get(id);
      if (!p) continue;

      const prev = oldRows.get(id);
      if (prev) {
        p.x = prev[1] + (row[1] - prev[1]) * t;
        p.y = prev[2] + (row[2] - prev[2]) * t;
        p.aim = lerpAngle(prev[5], row[5], t);
      } else {
        p.x = row[1];
        p.y = row[2];
        p.aim = row[5];
      }
      p.vx = row[3];
      p.vy = row[4];
      p.health = row[6];
      const flags = row[7];
      p.alive = (flags & PF.ALIVE) !== 0;
      p.onWall = (flags & PF.ON_WALL) !== 0;
      p.dashTime = (flags & PF.DASHING) !== 0 ? 0.1 : 0;
      p.reloadTime = (flags & PF.RELOADING) !== 0 ? 0.5 : 0;
      p.invuln = (flags & PF.INVULN) !== 0 ? 0.5 : 0;
      p.swordAim = row[8];
      p.swordTime = row[9];
      p.kills = row[10];
      p.deaths = row[11];
    }
  }

  /** Bullets move fast and predictably: extrapolate rather than interpolate. */
  private extrapolateBullets(now: number): void {
    const snap = this.snapshots[this.snapshots.length - 1];
    this.world.projectiles.length = 0;
    if (!snap) return;

    const ahead = Math.min(0.25, Math.max(0, (now - snap.receivedAt) / 1000));
    for (const b of snap.bullets) {
      const proj: Projectile = {
        id: b[0],
        owner: '',
        team: b[5] as TeamId,
        x: b[1] + b[3] * ahead,
        y: b[2] + b[4] * ahead,
        vx: b[3],
        vy: b[4],
        travelled: 0,
        damage: 0,
      };
      this.world.projectiles.push(proj);
    }
  }

  // ------------------------------------------------------------- cosmetics

  private playEvent(e: SimEvent, predicted: boolean): void {
    // Movement effects are predicted locally; ignore the server's echo of ours.
    if (!predicted && 'who' in e && e.who === this.localId) return;

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
        if (e.target === this.localId) this.fx.addShake(4);
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
      case 'reload':
        break;
      case 'pickup': {
        const tint = PICKUP_TINT[e.kind] ?? [255, 255, 255];
        this.fx.burst(e.x, e.y, 20, { speed: 300, life: 0.45, size: 3.2, color: tint });
        if (e.who === this.localId) {
          this.fx.floatText(e.x, e.y - 26, e.kind.toUpperCase(), rgbCss(tint), 14);
        }
        break;
      }
      case 'fall':
        this.fx.burst(e.x, e.y, 26, {
          speed: 180, life: 0.7, size: 3.4, drag: 1.2,
          color: e.team === 0 ? [255, 84, 112] : [76, 201, 255],
        });
        this.fx.floatText(e.x, e.y - 10, 'DOWN THE HOLE', '#8ea0c8', 13);
        this.fx.addShake(e.victim === this.localId ? 12 : 4);
        break;
      case 'objective':
        this.fx.burst(e.x, e.y, e.kind.includes('Capture') || e.kind.includes('Deliver') ? 40 : 16, {
          speed: 420, life: 0.5, size: 3.6,
          color: e.team === 0 ? [255, 84, 112] : e.team === 1 ? [76, 201, 255] : [255, 209, 102],
        });
        if (e.kind === 'flagCapture' || e.kind === 'bombDeliver') this.fx.addShake(10);
        break;
      case 'phase':
        if (e.phase === 'live') this.fx.addShake(5);
        if (e.phase === 'results') { this.killFeed.length = 0; this.fx.addShake(8); }
        break;
    }
  }

  private pushKill(killerId: string, victimId: string, weapon: 'gun' | 'sword' | 'fall'): void {
    const killer = this.roster.get(killerId);
    const victim = this.roster.get(victimId);
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
    const local = this.localPlayer;
    // Apply the smoothed correction offset only for drawing.
    let restoreX = 0, restoreY = 0;
    if (local && (this.errorX !== 0 || this.errorY !== 0)) {
      restoreX = local.x; restoreY = local.y;
      local.x += this.errorX;
      local.y += this.errorY;
    }

    this.renderer.draw(this.world, this.fx, this.localId, {
      fps: this.fps,
      debug: this.debug,
      killFeed: this.killFeed,
      showScoreboard: this.input.isDown('scoreboard'),
      ping: this.net.rtt,
      room: this.roomCode,
    });

    if (local && restoreX !== 0) { local.x = restoreX; local.y = restoreY; }
  }
}

const PICKUP_TINT: Record<string, [number, number, number]> = {
  health: [110, 231, 160],
  speed: [130, 220, 255],
  shield: [180, 190, 255],
  rapid: [255, 210, 120],
  damage: [255, 120, 120],
  dash: [255, 160, 240],
};

const rgbCss = ([r, g, b]: [number, number, number]): string => `rgb(${r},${g},${b})`;

function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
