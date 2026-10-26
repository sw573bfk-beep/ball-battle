/**
 * Offline match: you plus bots, all running the shared sim on a fixed
 * timestep. For online play, a server would run the same stepWorld() and this
 * class would send InputCmds instead of stepping locally.
 */

import { COLORS, MAX_CATCHUP_TICKS, PLAYER, TICK_DT, type Difficulty } from '../sim/config.js';
import { buildNav, createBrain, thinkBot, type BotBrain, type NavGrid } from '../sim/bots.js';
import { DEFAULT_MAP, MAPS } from '../sim/maps.js';
import type { InputCmd, Player, SimEvent, World } from '../sim/types.js';
import { addPlayer, createWorld, rankPlayers, stepWorld } from '../sim/world.js';
import { Audio, type Sfx } from './audio.js';
import type { Bindings } from './bindings.js';
import { Fx } from './fx.js';
import { Input } from './input.js';
import { hexA, Renderer, type Announcement, type KillFeedEntry } from './render.js';

export interface GameOptions {
  name: string;
  bots: number;
  difficulty: Difficulty | 'mixed';
  seed?: number;
}

const BOT_NAMES = [
  'Spinny', 'Bladey', 'Sir Roll', 'Whirl', 'Pointy', 'Clank', 'Slicer', 'Orbit',
  'Edge', 'Dicey', 'Stabby', 'Rusty', 'Goldie', 'Tornado', 'Pebble', 'Zing',
];

const STREAKS: Record<number, string> = { 2: 'DOUBLE KILL', 3: 'TRIPLE KILL', 4: 'RAMPAGE', 5: 'UNSTOPPABLE', 7: 'GODLIKE' };

export class Game {
  readonly world: World;
  readonly localId = 'you';
  readonly fx = new Fx();
  readonly input: Input;
  readonly renderer: Renderer;
  readonly audio: Audio;
  private nav: NavGrid;
  private brains: BotBrain[] = [];
  private inputs = new Map<string, InputCmd>();
  private feed: KillFeedEntry[] = [];
  private announce: Announcement | null = null;
  private killedBy = '';
  private prev = new Map<string, { x: number; y: number }>();
  private pos = new Map<string, { x: number; y: number }>();
  private acc = 0;
  private last = 0;
  private raf = 0;
  private lastCount = -1;
  /** Whether each player's latest hit was a throw, for the kill feed icon. */
  private lastHitWasThrown = new Map<string, boolean>();
  paused = false;
  onOver: ((world: World) => void) | null = null;
  onPauseToggle: ((paused: boolean) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, opts: GameOptions, audio: Audio, private bindings: Bindings) {
    const seed = opts.seed ?? (Math.random() * 2 ** 31) | 0;
    const map = MAPS[DEFAULT_MAP];
    this.world = createWorld({ map, seed });
    this.nav = buildNav(map);
    this.audio = audio;

    addPlayer(this.world, this.localId, opts.name || 'You', COLORS[0], false);
    const names = shuffle(BOT_NAMES.slice(), seed);
    const diffs: Difficulty[] = ['easy', 'normal', 'hard'];
    for (let i = 0; i < opts.bots; i++) {
      const id = `bot${i}`;
      addPlayer(this.world, id, names[i % names.length], COLORS[(i + 1) % COLORS.length], true);
      const diff = opts.difficulty === 'mixed' ? diffs[i % 3] : opts.difficulty;
      this.brains.push(createBrain(id, diff, seed + i * 7919));
    }

    this.input = new Input(canvas, bindings);
    this.input.onAction = (action) => {
      if (action === 'pause') this.togglePause();
      if (action === 'mute') this.audio.muted = !this.audio.muted;
    };
    this.renderer = new Renderer(canvas);
    this.input.layout(this.renderer.w, this.renderer.h);
    const me = this.me();
    if (me) this.renderer.follow(me.x, me.y, 0, map, true);
    window.addEventListener('resize', this.onResize);
  }

  me(): Player | undefined {
    return this.world.players.find((p) => p.id === this.localId);
  }

  start(): void {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    window.removeEventListener('resize', this.onResize);
  }

  togglePause(force?: boolean): void {
    if (this.world.phase === 'over') return;
    this.paused = force ?? !this.paused;
    this.input.reset();
    this.onPauseToggle?.(this.paused);
  }

  private onResize = (): void => {
    this.renderer.resize();
    this.input.layout(this.renderer.w, this.renderer.h);
  };

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;

    if (!this.paused) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= TICK_DT && steps < MAX_CATCHUP_TICKS) {
        this.tick();
        this.acc -= TICK_DT;
        steps++;
      }
      if (steps === MAX_CATCHUP_TICKS) this.acc = 0;
      this.fx.update(dt);
      for (const k of this.feed) k.age += dt;
      this.feed = this.feed.filter((k) => k.age < 5).slice(-5);
      if (this.announce) this.announce.age += dt;
    }

    // Interpolate between the last two ticks for smooth motion on fast screens.
    const alpha = this.paused ? 1 : this.acc / TICK_DT;
    for (const p of this.world.players) {
      const a = this.prev.get(p.id) ?? p;
      this.pos.set(p.id, { x: a.x + (p.x - a.x) * alpha, y: a.y + (p.y - a.y) * alpha });
    }

    const me = this.me();
    if (me) {
      const at = this.pos.get(me.id)!;
      this.renderer.follow(at.x, at.y, dt, this.world.map);
    }
    this.renderer.draw({
      world: this.world, localId: this.localId, fx: this.fx, input: this.input,
      feed: this.feed, announce: this.announce, pos: this.pos, killedBy: this.killedBy,
      muted: this.audio.muted, paused: this.paused, bindings: this.bindings,
    });
  };

  private tick(): void {
    const w = this.world;
    for (const p of w.players) this.prev.set(p.id, { x: p.x, y: p.y });

    const me = this.me();
    if (me) {
      const at = this.renderer.toScreen(me.x, me.y);
      const cmd = this.input.sample(at);
      if (this.input.autoAim) {
        this.input.autoAim = false;
        const target = nearestEnemy(w, me);
        if (target) { cmd.aimX = target.x - me.x; cmd.aimY = target.y - me.y; }
      }
      this.inputs.set(this.localId, cmd);
    }
    for (const b of this.brains) this.inputs.set(b.id, thinkBot(w, this.nav, b, TICK_DT));

    const phase = w.phase;
    stepWorld(w, this.inputs);
    this.handleEvents(w.events);

    // Countdown beeps.
    if (w.phase === 'countdown') {
      const n = Math.ceil(w.clock);
      if (n !== this.lastCount) { this.lastCount = n; this.audio.play('beep'); }
    } else if (phase === 'countdown') {
      this.audio.play('go');
    }
    if (phase !== 'over' && w.phase === 'over') this.onOver?.(w);
  }

  /** Volume falls off with distance from the camera. */
  private sfx(name: Sfx, x: number, y: number, vol = 1): void {
    const d = Math.hypot(x - this.renderer.cam.x, y - this.renderer.cam.y);
    this.audio.play(name, vol * Math.max(0, 1 - d / 1100));
  }

  private handleEvents(events: SimEvent[]): void {
    const fx = this.fx;
    const byId = (id: string) => this.world.players.find((p) => p.id === id);
    for (const e of events) {
      switch (e.t) {
        case 'throw':
          this.sfx('throw', e.x, e.y);
          break;
        case 'dash':
          fx.burst(e.x, e.y, 'rgba(200,230,255,0.6)', 8, 160, 'dot', 4, 0.35);
          this.sfx('dash', e.x, e.y, 0.8);
          break;
        case 'clash':
          fx.burst(e.x, e.y, '#fff3b0', 10, 420, 'spark', 2, 0.25);
          this.sfx('clash', e.x, e.y);
          break;
        case 'deflect':
          fx.burst(e.x, e.y, '#ffe27a', 12, 480, 'spark', 2, 0.3);
          fx.text(e.x, e.y - 20, 'BLOCKED', '#ffe27a', 14, 0.6);
          this.sfx('clash', e.x, e.y);
          break;
        case 'shatter':
          // Shards in the broken sword's colour.
          fx.burst(e.x, e.y, ['#dfe6ee', '#ff5d7a', '#ffd84a'][e.tier], 14, 360, 'spark', 2.5, 0.45);
          this.sfx('shatter', e.x, e.y);
          break;
        case 'knockoff':
          fx.burst(e.x, e.y, '#fff3b0', 8, 300, 'spark', 2, 0.3);
          if (e.who === this.localId) fx.text(e.x, e.y - 18, 'SWORD LOST', '#ff8c42', 15, 0.7);
          this.sfx('clash', e.x, e.y, 0.7);
          break;
        case 'stick':
          fx.burst(e.x, e.y, '#cfd8e3', 6, 220, 'spark', 1.5, 0.2);
          this.sfx('stick', e.x, e.y);
          break;
        case 'hit': {
          const victim = byId(e.target);
          fx.burst(e.x, e.y, victim?.color ?? '#fff', e.thrown ? 16 : 9, e.thrown ? 380 : 260, 'dot', 3.5, 0.45);
          fx.text(e.x, e.y - 14, `-${e.damage}`, e.thrown ? '#ffd23f' : '#ffffff', e.thrown ? 22 : 16);
          this.sfx(e.thrown ? 'bighit' : 'hit', e.x, e.y);
          if (e.target === this.localId) fx.kick(e.thrown ? 10 : 6);
          else if (e.by === this.localId) fx.kick(3);
          break;
        }
        case 'pickup':
          fx.burst(e.x, e.y, ['#dfe6ee', '#ff5d7a', '#ffd84a'][e.tier], 8, 140, 'spark', 2, 0.3);
          if (e.who === this.localId) {
            this.audio.play('pickup');
            if (e.tier > 0) fx.text(e.x, e.y - 20, e.tier === 2 ? 'GOLD SWORD!' : 'RUBY SWORD', e.tier === 2 ? '#ffd84a' : '#ff5d7a', 16);
          }
          break;
        case 'heal':
          fx.burst(e.x, e.y, '#5ce18b', 14, 160, 'dot', 3, 0.5);
          if (e.who === this.localId) { this.audio.play('heal'); fx.text(e.x, e.y - 20, '+HP', '#5ce18b', 18); }
          break;
        case 'crate':
          fx.burst(e.x, e.y, '#b07a3f', e.broken ? 22 : 6, e.broken ? 300 : 150, 'dot', e.broken ? 4 : 2.5, 0.5);
          this.sfx('crate', e.x, e.y, e.broken ? 1 : 0.6);
          break;
        case 'respawn':
          fx.ring(e.x, e.y, '#a0dcff', 50, 0.5);
          break;
        case 'death': {
          fx.burst(e.x, e.y, e.color, 36, 520, 'dot', 5, 0.8);
          fx.burst(e.x, e.y, '#ffffff', 14, 600, 'spark', 2, 0.4);
          fx.ring(e.x, e.y, e.color, 70, 0.5);
          this.sfx('death', e.x, e.y);
          const killer = byId(e.killer);
          const victim = byId(e.victim);
          const lastHit = this.lastHitWasThrown.get(e.victim) ?? false;
          this.feed.push({
            killer: killer?.name ?? '???', killerColor: killer?.color ?? '#fff',
            victim: victim?.name ?? '???', victimColor: victim?.color ?? '#fff',
            thrown: lastHit, age: 0,
          });
          if (e.victim === this.localId) {
            this.killedBy = killer && killer.id !== this.localId ? killer.name : '';
            fx.kick(14);
          }
          if (e.killer === this.localId && killer) {
            this.audio.play('kill');
            fx.kick(6);
            const streak = STREAKS[killer.streak];
            this.announce = {
              text: streak ?? 'KNOCKOUT!',
              sub: `${victim?.name ?? ''} · +${PLAYER.KILL_HEAL} HP`,
              color: streak ? '#ffd23f' : hexA(killer.color, 1),
              age: 0,
            };
          }
          break;
        }
        case 'over':
          break;
      }
      if (e.t === 'hit') this.lastHitWasThrown.set(e.target, e.thrown);
    }
  }

  /** Final standings for the results screen. */
  standings(): Player[] {
    return rankPlayers(this.world);
  }
}

function nearestEnemy(w: World, me: Player): Player | null {
  let best: Player | null = null;
  let bd = 900;
  for (const p of w.players) {
    if (p === me || !p.alive) continue;
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function shuffle<T>(arr: T[], seed: number): T[] {
  let s = seed | 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) | 0;
    const j = (s >>> 0) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
