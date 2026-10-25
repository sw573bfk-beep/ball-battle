/** Canvas 2D renderer: world, effects, HUD and touch controls. */

import { CRATE, DASH, HEALTH_PACK, MATCH, PLAYER, SWORD, type Tier } from '../sim/config.js';
import type { Player, World } from '../sim/types.js';
import { bladeOf, crateRect, rankPlayers } from '../sim/world.js';
import type { Fx } from './fx.js';
import { Input } from './input.js';

export interface KillFeedEntry {
  killer: string;
  killerColor: string;
  victim: string;
  victimColor: string;
  thrown: boolean;
  age: number;
}

export interface Announcement {
  text: string;
  sub: string;
  color: string;
  age: number;
}

export interface View {
  world: World;
  localId: string;
  fx: Fx;
  input: Input;
  feed: KillFeedEntry[];
  announce: Announcement | null;
  /** Interpolated draw positions keyed by player id. */
  pos: Map<string, { x: number; y: number }>;
  killedBy: string;
  muted: boolean;
  paused: boolean;
}

const TIER_COLORS = [
  { blade: '#dfe6ee', edge: '#8b97a8', glow: '' },
  { blade: '#ff5d7a', edge: '#a3122f', glow: 'rgba(255,60,100,0.35)' },
  { blade: '#ffd84a', edge: '#a87a00', glow: 'rgba(255,210,60,0.45)' },
];

const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  w = 0;
  h = 0;
  private dpr = 1;
  cam = { x: 0, y: 0, scale: 1 };
  private floorPattern: CanvasPattern | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    // Show ~1350 world px across the long side, but at least 620 on the short side.
    const long = Math.max(this.w, this.h);
    const short = Math.min(this.w, this.h);
    this.cam.scale = Math.min(long / 1350, short / 620);
  }

  /** World -> CSS-pixel screen coordinates. */
  toScreen(x: number, y: number): { sx: number; sy: number } {
    return { sx: (x - this.cam.x) * this.cam.scale + this.w / 2, sy: (y - this.cam.y) * this.cam.scale + this.h / 2 };
  }

  follow(x: number, y: number, dt: number, bounds: { width: number; height: number }, snap = false): void {
    // Keep the view inside the arena (plus a sliver of border) when it fits.
    const margin = 60;
    const hw = this.w / this.cam.scale / 2;
    const hh = this.h / this.cam.scale / 2;
    const clampAxis = (v: number, half: number, size: number) =>
      half * 2 >= size + margin * 2 ? size / 2 : Math.max(half - margin, Math.min(size - half + margin, v));
    const tx = clampAxis(x, hw, bounds.width);
    const ty = clampAxis(y, hh, bounds.height);
    const k = snap ? 1 : 1 - Math.exp(-8 * dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
  }

  draw(v: View): void {
    const { ctx } = this;
    const { world } = v;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#07080d';
    ctx.fillRect(0, 0, this.w, this.h);

    // ---- world space
    const s = this.cam.scale;
    const shake = v.fx.shake;
    const sx = shake ? (Math.random() - 0.5) * shake : 0;
    const sy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.save();
    ctx.translate(this.w / 2 + sx, this.h / 2 + sy);
    ctx.scale(s, s);
    ctx.translate(-this.cam.x, -this.cam.y);

    this.drawFloor(world);
    this.drawPads(world);
    this.drawFloorSwords(world);
    this.drawCrates(world);
    this.drawShadows(v);
    this.drawWalls(world);
    for (const p of world.players) if (p.alive) this.drawPlayer(v, p);
    this.drawThrown(world);
    this.drawParticles(v.fx);
    for (const p of world.players) if (p.alive) this.drawTag(v, p);
    ctx.restore();

    // ---- screen space
    this.drawHud(v);
    if (v.input.touchMode) {
      this.drawTouch(v.input);
      this.drawDashCooldown(v.input, world.players.find((p) => p.id === v.localId));
    }
  }

  // ------------------------------------------------------------- arena

  private drawFloor(world: World): void {
    const { ctx } = this;
    const { width, height } = world.map;
    if (!this.floorPattern) {
      const c = document.createElement('canvas');
      c.width = c.height = 80;
      const g = c.getContext('2d')!;
      g.fillStyle = '#161a26';
      g.fillRect(0, 0, 80, 80);
      g.fillStyle = '#1a1f2d';
      g.fillRect(0, 0, 40, 40);
      g.fillRect(40, 40, 40, 40);
      g.strokeStyle = 'rgba(255,255,255,0.035)';
      g.lineWidth = 2;
      g.strokeRect(0, 0, 80, 80);
      this.floorPattern = ctx.createPattern(c, 'repeat');
    }
    ctx.fillStyle = this.floorPattern ?? '#161a26';
    ctx.fillRect(0, 0, width, height);
    // A faint arena ring in the middle for orientation.
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 330, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawWalls(world: World): void {
    const { ctx } = this;
    for (const r of world.map.walls) {
      ctx.fillStyle = '#2a3045';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#3a4260';
      ctx.fillRect(r.x, r.y, r.w, Math.min(6, r.h));
      ctx.strokeStyle = '#4c5677';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    }
  }

  private drawShadows(v: View): void {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (const r of v.world.map.walls) ctx.fillRect(r.x + 8, r.y + 10, r.w, r.h);
    for (const p of v.world.players) {
      if (!p.alive) continue;
      const pos = v.pos.get(p.id) ?? p;
      ctx.beginPath();
      ctx.ellipse(pos.x + 5, pos.y + 9, PLAYER.RADIUS, PLAYER.RADIUS * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawCrates(world: World): void {
    const { ctx } = this;
    for (const c of world.crates) {
      if (c.respawnIn > 0) continue;
      const r = crateRect(c);
      const jig = c.hitCd > 0 ? (Math.random() - 0.5) * 4 : 0;
      ctx.save();
      ctx.translate(jig, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(r.x + 6, r.y + 8, r.w, r.h);
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = '#5b3816';
      ctx.lineWidth = 4;
      ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      ctx.beginPath();
      ctx.moveTo(r.x + 4, r.y + 4); ctx.lineTo(r.x + r.w - 4, r.y + r.h - 4);
      ctx.moveTo(r.x + r.w - 4, r.y + 4); ctx.lineTo(r.x + 4, r.y + r.h - 4);
      ctx.stroke();
      if (c.health < CRATE.HEALTH) {
        ctx.strokeStyle = 'rgba(20,10,0,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r.x + 10, r.y); ctx.lineTo(r.x + 18, r.y + 14); ctx.lineTo(r.x + 12, r.y + 24);
        if (c.health < CRATE.HEALTH - 1) { ctx.moveTo(r.x + r.w, r.y + 30); ctx.lineTo(r.x + r.w - 14, r.y + 26); ctx.lineTo(r.x + r.w - 20, r.y + 38); }
        ctx.stroke();
      }
      // "?" so new players know there's loot inside.
      ctx.fillStyle = 'rgba(255,230,180,0.85)';
      ctx.font = `bold 18px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', c.x, c.y + 1);
      ctx.restore();
    }
  }

  private drawPads(world: World): void {
    const { ctx } = this;
    const t = world.time;
    for (const h of world.health) {
      const up = h.respawnIn <= 0;
      if (h.fixed) {
        ctx.strokeStyle = up ? 'rgba(92,225,139,0.5)' : 'rgba(92,225,139,0.15)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(h.x, h.y, HEALTH_PACK.RADIUS + 10, 0, Math.PI * 2);
        ctx.stroke();
        if (!up) {
          ctx.strokeStyle = 'rgba(92,225,139,0.6)';
          ctx.beginPath();
          ctx.arc(h.x, h.y, HEALTH_PACK.RADIUS + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - h.respawnIn / HEALTH_PACK.RESPAWN));
          ctx.stroke();
          continue;
        }
      } else if (h.ttl < 4 && Math.floor(h.ttl * 6) % 2 === 0) {
        continue; // blink before vanishing
      }
      const bob = Math.sin(t * 4 + h.id) * 2;
      ctx.fillStyle = '#e8fff0';
      ctx.beginPath();
      ctx.arc(h.x, h.y + bob, HEALTH_PACK.RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#28c46a';
      ctx.fillRect(h.x - 4, h.y + bob - 11, 8, 22);
      ctx.fillRect(h.x - 11, h.y + bob - 4, 22, 8);
    }
  }

  // ------------------------------------------------------------ swords

  /** A sword whose hilt is at (x, y), pointing along `angle`. */
  drawSword(x: number, y: number, angle: number, tier: Tier, alpha = 1, scale = 1): void {
    const { ctx } = this;
    const c = TIER_COLORS[tier];
    const L = SWORD.LENGTH * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (c.glow) {
      ctx.strokeStyle = c.glow;
      ctx.lineWidth = 12 * scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(8 * scale, 0);
      ctx.lineTo(L, 0);
      ctx.stroke();
    }
    // grip + pommel
    ctx.fillStyle = '#5a3a1c';
    ctx.fillRect(-2 * scale, -2.2 * scale, 9 * scale, 4.4 * scale);
    ctx.fillStyle = c.edge;
    ctx.beginPath();
    ctx.arc(-3 * scale, 0, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
    // crossguard
    ctx.fillRect(7 * scale, -8 * scale, 4 * scale, 16 * scale);
    // blade
    ctx.fillStyle = c.blade;
    ctx.beginPath();
    ctx.moveTo(11 * scale, -4 * scale);
    ctx.lineTo(L - 8 * scale, -4 * scale);
    ctx.lineTo(L, 0);
    ctx.lineTo(L - 8 * scale, 4 * scale);
    ctx.lineTo(11 * scale, 4 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c.edge;
    ctx.lineWidth = 1.2 * scale;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(13 * scale, -1 * scale);
    ctx.lineTo(L - 9 * scale, -1 * scale);
    ctx.stroke();
    ctx.restore();
  }

  private drawFloorSwords(world: World): void {
    const t = world.time;
    for (const f of world.floor) {
      if (f.ttl < 3 && Math.floor(f.ttl * 8) % 2 === 0) continue;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + f.id);
      const { ctx } = this;
      ctx.fillStyle = f.tier === 2 ? `rgba(255,214,70,${0.12 + pulse * 0.12})` : f.tier === 1 ? `rgba(255,80,110,${0.1 + pulse * 0.1})` : `rgba(220,230,255,${0.05 + pulse * 0.06})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 26, 0, Math.PI * 2);
      ctx.fill();
      // The sprite is drawn centred on the sword, not on the hilt.
      const c = Math.cos(f.angle);
      const s = Math.sin(f.angle);
      const half = SWORD.LENGTH / 2;
      this.drawSword(f.x - c * half, f.y - s * half, f.angle, f.tier);
    }
  }

  private drawThrown(world: World): void {
    const { ctx } = this;
    for (const t of world.thrown) {
      const sp = Math.hypot(t.vx, t.vy) || 1;
      ctx.strokeStyle = t.tier === 2 ? 'rgba(255,214,70,0.35)' : t.tier === 1 ? 'rgba(255,80,110,0.35)' : 'rgba(220,230,255,0.25)';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.x - (t.vx / sp) * 60, t.y - (t.vy / sp) * 60);
      ctx.stroke();
      const c = Math.cos(t.angle);
      const s = Math.sin(t.angle);
      const half = SWORD.LENGTH / 2;
      this.drawSword(t.x - c * half, t.y - s * half, t.angle, t.tier);
    }
  }

  // ------------------------------------------------------------ players

  private drawPlayer(v: View, p: Player): void {
    const { ctx } = this;
    const pos = v.pos.get(p.id) ?? p;
    const R = PLAYER.RADIUS;

    // Orbiting swords, drawn from interpolated position.
    const n = p.swords.length;
    for (let i = 0; i < n; i++) {
      const bl = bladeOf(p, i);
      const r0 = R + SWORD.HILT_GAP;
      this.drawSword(pos.x + Math.cos(bl.angle) * r0, pos.y + Math.sin(bl.angle) * r0, bl.angle, p.swords[i], p.protect > 0 ? 0.45 : 1);
    }

    // Dash streak.
    if (p.dashTime > 0) {
      ctx.fillStyle = hexA(p.color, 0.25);
      ctx.beginPath();
      ctx.arc(pos.x - p.vx * 0.04, pos.y - p.vy * 0.04, R * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body.
    const g = ctx.createRadialGradient(pos.x - R * 0.35, pos.y - R * 0.4, R * 0.15, pos.x, pos.y, R);
    g.addColorStop(0, lighten(p.color, 0.45));
    g.addColorStop(1, p.color);
    ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : g;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = p.id === v.localId ? 3.5 : 2;
    ctx.strokeStyle = p.id === v.localId ? '#ffffff' : 'rgba(0,0,0,0.45)';
    ctx.stroke();

    // Eyes look where you aim.
    const ex = Math.cos(p.aim);
    const ey = Math.sin(p.aim);
    for (const side of [-1, 1]) {
      const bx = pos.x + ex * 7 + -ey * side * 7;
      const by = pos.y + ey * 7 + ex * side * 7;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(bx, by, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(bx + ex * 2, by + ey * 2, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Spawn bubble.
    if (p.protect > 0) {
      ctx.strokeStyle = `rgba(160,220,255,${0.4 + 0.3 * Math.sin(v.world.time * 20)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, R + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Your aim line.
    if (p.id === v.localId && p.swords.length > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(pos.x + ex * (R + 50), pos.y + ey * (R + 50));
      ctx.lineTo(pos.x + ex * 300, pos.y + ey * 300);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawTag(v: View, p: Player): void {
    const { ctx } = this;
    const pos = v.pos.get(p.id) ?? p;
    const y = pos.y - PLAYER.RADIUS - SWORD.LENGTH - 18;
    const w = 54;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(pos.x - w / 2 - 1, y - 1, w + 2, 7);
    const hp = Math.max(0, p.health / PLAYER.HEALTH);
    ctx.fillStyle = hp > 0.5 ? '#5ce18b' : hp > 0.25 ? '#ffd23f' : '#ff5470';
    ctx.fillRect(pos.x - w / 2, y, w * hp, 5);
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    const label = p.swords.length > 0 ? `${p.name}  ⚔${p.swords.length}` : p.name;
    ctx.strokeText(label, pos.x, y - 3);
    ctx.fillStyle = p.id === v.localId ? '#ffffff' : '#d7dbe6';
    ctx.fillText(label, pos.x, y - 3);
  }

  private drawParticles(fx: Fx): void {
    const { ctx } = this;
    for (const p of fx.particles) {
      const a = Math.max(0, p.life / p.max);
      if (p.kind === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a;
        ctx.lineWidth = 4 * a + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.4 - a), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of fx.texts) {
      ctx.globalAlpha = Math.min(1, (t.life / t.max) * 2);
      ctx.font = `900 ${t.size}px ${FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- HUD

  private drawHud(v: View): void {
    const { ctx, w, h } = this;
    const { world } = v;
    const me = world.players.find((p) => p.id === v.localId);
    const small = Math.min(w, h) < 520;
    const ui = small ? 0.8 : 1;

    // Timer.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const secs = Math.max(0, Math.ceil(world.phase === 'countdown' ? MATCH.DURATION : world.clock));
    const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    this.pill(w / 2, 10, clock, `first to ${MATCH.KILL_TARGET}`, ui, secs <= 10 && world.phase === 'playing' ? '#ff5470' : '#ffffff');

    // Leaderboard.
    const ranked = rankPlayers(world);
    const rows = ranked.slice(0, small ? 3 : 5);
    if (me && !rows.includes(me)) rows.push(me);
    const lw = 170 * ui;
    const lx = w - lw - 10;
    let ly = 10;
    ctx.fillStyle = 'rgba(8,10,18,0.6)';
    roundRect(ctx, lx, ly, lw, (rows.length * 22 + 10) * ui, 8);
    ctx.fill();
    ly += 6 * ui;
    ctx.font = `bold ${14 * ui}px ${FONT}`;
    ctx.textBaseline = 'top';
    for (const p of rows) {
      const rank = ranked.indexOf(p) + 1;
      const mine = p.id === v.localId;
      if (mine) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(lx + 2, ly - 2 * ui, lw - 4, 21 * ui);
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(lx + 30 * ui, ly + 8 * ui, 6 * ui, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8a93a8';
      ctx.fillText(`${rank}`, lx + 8 * ui, ly);
      ctx.fillStyle = mine ? '#fff' : '#d7dbe6';
      ctx.fillText(p.name.slice(0, 11), lx + 42 * ui, ly);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(`${p.kills}`, lx + lw - 10 * ui, ly);
      ly += 22 * ui;
    }

    // Kill feed.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${13 * ui}px ${FONT}`;
    let fy = v.input.touchMode ? this.minimapSize(v, small, ui).mh + 24 : 12;
    for (const k of v.feed) {
      ctx.globalAlpha = Math.min(1, (5 - k.age) * 2);
      let x = 12;
      const parts: [string, string][] = [[k.killer, k.killerColor], [k.thrown ? '  ➶⚔  ' : '  ⚔  ', '#bbb'], [k.victim, k.victimColor]];
      const total = parts.reduce((s, [t]) => s + ctx.measureText(t).width, 0);
      ctx.fillStyle = 'rgba(8,10,18,0.55)';
      ctx.fillRect(8, fy - 3, total + 10, 20 * ui);
      for (const [t, c] of parts) {
        ctx.fillStyle = c;
        ctx.fillText(t, x, fy);
        x += ctx.measureText(t).width;
      }
      fy += 23 * ui;
    }
    ctx.globalAlpha = 1;

    // Your status: health, swords, dash.
    if (me) this.drawStatus(me, ui, v.input.touchMode);

    this.drawMinimap(v, ui, small);

    // Centre messages.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (world.phase === 'countdown') {
      const n = Math.ceil(world.clock);
      this.bigText(n > 0 ? String(n) : 'GO!', h * 0.36, 90 * ui, '#ffffff');
      this.bigText('Grab swords · knock everyone out', h * 0.36 + 70 * ui, 20 * ui, '#cfd5e6');
    } else if (me && !me.alive && world.phase === 'playing') {
      this.bigText('KNOCKED OUT', h * 0.36, 52 * ui, '#ff5470');
      this.bigText(`${v.killedBy ? `by ${v.killedBy} · ` : ''}back in ${Math.max(0, me.respawnIn).toFixed(1)}s`, h * 0.36 + 46 * ui, 20 * ui, '#e6e9f2');
    }
    if (v.announce && v.announce.age < 1.8) {
      const a = v.announce;
      const pop = Math.min(1, a.age * 8);
      ctx.globalAlpha = Math.min(1, (1.8 - a.age) * 3);
      this.bigText(a.text, h * 0.22, (40 + 10 * (1 - pop)) * ui, a.color);
      if (a.sub) this.bigText(a.sub, h * 0.22 + 36 * ui, 18 * ui, '#ffffff');
      ctx.globalAlpha = 1;
    }
    if (v.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, w, h);
    }
  }

  private drawStatus(me: Player, ui: number, touch: boolean): void {
    const { ctx, w, h } = this;
    const bw = Math.min(320, w * 0.5) * ui;
    const bx = w / 2 - bw / 2;
    const by = h - (touch ? 34 : 46) * ui;

    // Swords held.
    const icon = 20 * ui;
    const total = SWORD.MAX_HELD;
    const startX = w / 2 - (total * icon) / 2;
    for (let i = 0; i < total; i++) {
      const x = startX + i * icon + icon / 2;
      const y = by - 22 * ui;
      if (i < me.swords.length) {
        this.ctx.save();
        this.ctx.translate(x, y + 9 * ui);
        this.drawSword(0, 0, -Math.PI / 2, me.swords[i], 1, 0.42 * ui);
        this.ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x - 1.5, y - 9 * ui, 3, 18 * ui);
      }
    }

    // Health bar.
    ctx.fillStyle = 'rgba(8,10,18,0.7)';
    roundRect(ctx, bx - 3, by - 3, bw + 6, 20 * ui + 6, 8);
    ctx.fill();
    const hp = Math.max(0, me.health / PLAYER.HEALTH);
    ctx.fillStyle = hp > 0.5 ? '#5ce18b' : hp > 0.25 ? '#ffd23f' : '#ff5470';
    roundRect(ctx, bx, by, bw * hp, 20 * ui, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${13 * ui}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(Math.max(0, me.health))}`, w / 2, by + 10 * ui);

    // Dash cooldown (desktop; the touch button shows its own).
    if (!touch) {
      const cx = bx + bw + 30 * ui;
      const cy = by + 10 * ui;
      const ready = me.dashCd <= 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, 14 * ui, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = ready ? '#2ee6d6' : '#5a6b80';
      ctx.beginPath();
      ctx.arc(cx, cy, 14 * ui, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - me.dashCd / DASH.COOLDOWN));
      ctx.stroke();
      ctx.fillStyle = ready ? '#2ee6d6' : '#5a6b80';
      ctx.font = `bold ${9 * ui}px ${FONT}`;
      ctx.fillText('DASH', cx, cy);
      ctx.fillStyle = 'rgba(220,225,240,0.55)';
      ctx.font = `${12 * ui}px ${FONT}`;
      ctx.fillText('WASD move · mouse aim · SPACE/click throw · SHIFT/right-click dash', w / 2, h - 12 * ui);
    }
  }

  private minimapSize(v: View, small: boolean, ui: number): { mw: number; mh: number } {
    const mw = (small ? 110 : 170) * ui;
    return { mw, mh: (v.world.map.height * mw) / v.world.map.width };
  }

  private drawMinimap(v: View, ui: number, small: boolean): void {
    const { ctx, h } = this;
    const { world } = v;
    const { mw, mh } = this.minimapSize(v, small, ui);
    const sc = mw / world.map.width;
    // Bottom-left on desktop; top-left on touch, away from the thumbs.
    const mx = 10;
    const my = v.input.touchMode ? 10 : h - mh - 10;
    ctx.fillStyle = 'rgba(8,10,18,0.65)';
    ctx.fillRect(mx - 3, my - 3, mw + 6, mh + 6);
    ctx.fillStyle = '#3a4260';
    for (const r of world.map.walls) ctx.fillRect(mx + r.x * sc, my + r.y * sc, Math.max(1, r.w * sc), Math.max(1, r.h * sc));
    for (const f of world.floor) {
      if (f.tier === 0) continue;
      ctx.fillStyle = f.tier === 2 ? '#ffd84a' : '#ff5d7a';
      ctx.fillRect(mx + f.x * sc - 1, my + f.y * sc - 1, 2.5, 2.5);
    }
    for (const p of world.players) {
      if (!p.alive) continue;
      const mine = p.id === v.localId;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(mx + p.x * sc, my + p.y * sc, mine ? 4 : 2.6, 0, Math.PI * 2);
      ctx.fill();
      if (mine) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    // Camera frame.
    const vw = this.w / this.cam.scale;
    const vh = this.h / this.cam.scale;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + (this.cam.x - vw / 2) * sc, my + (this.cam.y - vh / 2) * sc, vw * sc, vh * sc);
  }

  private drawTouch(input: Input): void {
    const { ctx } = this;
    const R = Input.STICK_RADIUS;
    const stick = (s: { ox: number; oy: number; x: number; y: number } | null, color: string) => {
      if (!s) return;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.ox, s.oy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 26, 0, Math.PI * 2);
      ctx.fill();
    };
    stick(input.moveStick, 'rgba(255,255,255,0.45)');
    stick(input.aimStick, 'rgba(255,90,120,0.6)');

    // Hints where the sticks appear.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    if (!input.moveStick) ctx.fillText('drag to move', this.w * 0.22, this.h - 90);
    if (!input.aimStick) {
      ctx.fillText('drag to aim, release to throw', this.w * 0.74, this.h - 98);
      ctx.fillText('tap = auto-aim throw', this.w * 0.74, this.h - 82);
    }

    const d = input.dashButton;
    ctx.fillStyle = 'rgba(46,230,214,0.25)';
    ctx.strokeStyle = 'rgba(46,230,214,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d9fffb';
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillText('DASH', d.x, d.y);
  }

  /** Dash cooldown overlay for the touch dash button. */
  private drawDashCooldown(input: Input, me: Player | undefined): void {
    if (!me || !input.touchMode || me.dashCd <= 0) return;
    const { ctx } = this;
    const d = input.dashButton;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.arc(d.x, d.y, d.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (me.dashCd / DASH.COOLDOWN));
    ctx.closePath();
    ctx.fill();
  }

  private pill(x: number, y: number, big: string, small: string, ui: number, color: string): void {
    const { ctx } = this;
    const w = 110 * ui;
    ctx.fillStyle = 'rgba(8,10,18,0.6)';
    roundRect(ctx, x - w / 2, y, w, 46 * ui, 10);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.font = `900 ${24 * ui}px ${FONT}`;
    ctx.fillText(big, x, y + 4 * ui);
    ctx.fillStyle = '#8a93a8';
    ctx.font = `bold ${11 * ui}px ${FONT}`;
    ctx.fillText(small, x, y + 31 * ui);
  }

  private bigText(text: string, y: number, size: number, color: string): void {
    const { ctx } = this;
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.lineWidth = Math.max(3, size / 9);
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(text, this.w / 2, y);
    ctx.fillStyle = color;
    ctx.fillText(text, this.w / 2, y);
  }
}

// ------------------------------------------------------------- helpers

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexA(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function lighten(hex: string, k: number): string {
  const [r, g, b] = parseHex(hex);
  const f = (c: number) => Math.round(c + (255 - c) * k);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
