/**
 * Canvas 2D renderer. Deliberately flat and high-contrast: readability beats
 * fidelity in a fast arena game, and it runs at 60fps on a school laptop.
 */

import { COMBAT, DASH, GUN, MATCH, MODE_RULES, OBJECTIVE, PLAYER, POWERUP, SWORD } from '@shared/config.js';
import { isSwordActive } from '@shared/combat.js';
import type { MapDef, PlayerState, Projectile, WorldState } from '@shared/types.js';
import type { Fx, TrailPoint } from './fx.js';
import type { Viewport } from './viewport.js';

const TEAM_COLORS = ['#ff5470', '#4cc9ff', '#ffd166'];
const TEAM_GLOW = ['rgba(255,84,112,', 'rgba(76,201,255,', 'rgba(255,209,102,'];

export interface KillFeedEntry {
  killer: string;
  killerTeam: number;
  victim: string;
  victimTeam: number;
  weapon: 'gun' | 'sword' | 'fall';
  age: number;
  involvesLocal: boolean;
}

export interface HudInfo {
  fps: number;
  debug: boolean;
  killFeed: KillFeedEntry[];
  /** Round-trip time in ms; omitted in single-player. */
  ping?: number;
  /** Room code, shown top-left so it is easy to read out to friends. */
  room?: string;
  /** TAB held: show the full team scoreboard. */
  showScoreboard?: boolean;
}

/**
 * Team markers are shape-based as well as colour-based, so the game is still
 * readable if you can't tell red from blue.
 */
const TEAM_GLYPH = ['\u25CF', '\u25C6', '\u25B2'];   // filled circle / diamond / triangle

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement, private viewport: Viewport) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
  }

  draw(world: WorldState, fx: Fx, localId: string | null, hud: HudInfo): void {
    const { ctx, viewport } = this;
    const map = world.map;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    viewport.apply(ctx);
    if (fx.shake > 0.01) {
      ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
    }

    this.drawFloor(map);
    this.drawHazards(map);
    this.drawObjectiveGround(world);
    this.drawWalls(map);

    const local = localId ? world.players.get(localId) ?? null : null;
    this.drawTrail(fx.trail, local ? local.team : 0);
    fx.draw(ctx);

    this.drawPowerups(world);
    this.drawObjectiveProps(world);
    for (const p of world.players.values()) this.drawSword(p);
    for (const b of world.projectiles) this.drawProjectile(b);
    for (const p of world.players.values()) this.drawPlayer(p, p.id === localId);
    const localTeam = local ? local.team : null;
    for (const p of world.players.values()) this.drawNameplate(p, p.id === localId, localTeam);

    fx.drawTexts(ctx);

    this.drawHud(hud, local, world);
  }

  // ------------------------------------------------------------------ world

  private drawFloor(map: MapDef): void {
    const { ctx } = this;
    ctx.fillStyle = '#11141f';
    ctx.fillRect(0, 0, map.width, map.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.028)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= map.width; x += 64) { ctx.moveTo(x, 0); ctx.lineTo(x, map.height); }
    for (let y = 0; y <= map.height; y += 64) { ctx.moveTo(0, y); ctx.lineTo(map.width, y); }
    ctx.stroke();

    const g = ctx.createRadialGradient(
      map.width / 2, map.height / 2, Math.min(map.width, map.height) * 0.25,
      map.width / 2, map.height / 2, Math.max(map.width, map.height) * 0.72,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, map.width, map.height);
  }

  /** Holes in the floor. Read as depth, edged in warning stripes. */
  private drawHazards(map: MapDef): void {
    if (!map.hazards || map.hazards.length === 0) return;
    const { ctx } = this;
    ctx.save();
    for (const h of map.hazards) {
      const g = ctx.createLinearGradient(h.x, h.y, h.x, h.y + h.h);
      g.addColorStop(0, '#05060a');
      g.addColorStop(0.5, '#01020400');
      g.addColorStop(1, '#05060a');
      ctx.fillStyle = '#04050a';
      ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = g;
      ctx.fillRect(h.x, h.y, h.w, h.h);

      ctx.strokeStyle = 'rgba(255,209,102,0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([9, 7]);
      ctx.strokeRect(h.x + 1, h.y + 1, h.w - 2, h.h - 2);
      ctx.setLineDash([]);

      // Inner rim highlight so the edge is obvious at speed.
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineWidth = 6;
      ctx.strokeRect(h.x + 4, h.y + 4, h.w - 8, h.h - 8);
    }
    ctx.restore();
  }

  private drawWalls(map: MapDef): void {
    const { ctx } = this;
    ctx.save();
    for (const w of map.walls) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(w.x + 3, w.y + 4, w.w, w.h);
    }
    for (const w of map.walls) {
      ctx.fillStyle = '#232838';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.fillRect(w.x, w.y, w.w, 3);
      ctx.strokeStyle = 'rgba(140,160,220,0.22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
    }
    ctx.restore();
  }

  private drawTrail(trail: TrailPoint[], team: number): void {
    if (trail.length < 2) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      const t = 1 - b.age / 0.28;
      if (t <= 0) continue;
      ctx.globalAlpha = t * t * 0.42;
      ctx.strokeStyle = TEAM_COLORS[team] ?? TEAM_COLORS[0];
      ctx.lineWidth = PLAYER.RADIUS * 1.25 * t;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ objectives

  /** Zones painted on the floor: the hill and the bomb delivery sites. */
  private drawObjectiveGround(world: WorldState): void {
    const { ctx } = this;
    const objective = MODE_RULES[world.match.mode]?.objective;
    const o = world.objective;

    if (objective === 'hill' && world.map.hill) {
      const h = world.map.hill;
      const owner = o.hillOwner;
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
      const base = owner === null ? 'rgba(255,255,255,' : owner === 0 ? 'rgba(255,84,112,' : 'rgba(76,201,255,';

      ctx.save();
      const grad = ctx.createRadialGradient(h.x, h.y, h.r * 0.15, h.x, h.y, h.r);
      grad.addColorStop(0, base + (o.hillContested ? 0.05 + pulse * 0.14 : 0.16) + ')');
      grad.addColorStop(1, base + '0.02)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.setLineDash(o.hillContested ? [8, 6] : []);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = base + (0.5 + (o.hillContested ? pulse * 0.4 : 0)) + ')';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (objective === 'bomb' && world.map.bomb) {
      world.map.bomb.sites.forEach((site, team) => {
        ctx.save();
        ctx.setLineDash([10, 8]);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = team === 0 ? 'rgba(255,84,112,0.55)' : 'rgba(76,201,255,0.55)';
        ctx.beginPath();
        ctx.arc(site.x, site.y, OBJECTIVE.SITE_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      });
    }

    if (objective === 'flags' && world.map.flagStands) {
      world.map.flagStands.forEach((stand, team) => {
        ctx.save();
        ctx.strokeStyle = team === 0 ? 'rgba(255,84,112,0.4)' : 'rgba(76,201,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(stand.x, stand.y, OBJECTIVE.PICKUP_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
    }
  }

  /** Things that sit above the floor: flags and the bomb. */
  private drawObjectiveProps(world: WorldState): void {
    const { ctx } = this;
    const objective = MODE_RULES[world.match.mode]?.objective;
    const o = world.objective;

    if (objective === 'flags') {
      for (const flag of o.flags) {
        const carried = flag.status === 'carried';
        const y = carried ? flag.y - PLAYER.RADIUS - 20 : flag.y - 6;
        const colour = TEAM_COLORS[flag.team] ?? TEAM_COLORS[2];

        ctx.save();
        ctx.strokeStyle = 'rgba(235,240,255,0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(flag.x, y + 20);
        ctx.lineTo(flag.x, y - 16);
        ctx.stroke();

        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.moveTo(flag.x + 1, y - 16);
        ctx.lineTo(flag.x + 22, y - 8);
        ctx.lineTo(flag.x + 1, y);
        ctx.closePath();
        ctx.fill();

        if (flag.status === 'dropped') {
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 2;
          const frac = Math.max(0, flag.returnIn / OBJECTIVE.FLAG_RETURN_TIME);
          ctx.beginPath();
          ctx.arc(flag.x, flag.y, 20, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    if (objective === 'bomb' && o.bomb) {
      const b = o.bomb;
      const y = b.status === 'carried' ? b.y - PLAYER.RADIUS - 18 : b.y;
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 180);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(b.x, y, 2, b.x, y, 26);
      g.addColorStop(0, `rgba(255,209,102,${0.55 * pulse})`);
      g.addColorStop(1, 'rgba(255,209,102,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(b.x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  // ----------------------------------------------------------------- pickups

  private drawPowerups(world: WorldState): void {
    if (world.powerups.length === 0) return;
    const { ctx } = this;
    const t = performance.now() / 1000;

    for (const pu of world.powerups) {
      if (pu.respawnIn > 0) {
        // Ghost the pad while it recharges so players can time the next one.
        const frac = 1 - pu.respawnIn / POWERUP.RESPAWN;
        ctx.save();
        ctx.strokeStyle = 'rgba(140,160,220,0.22)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pu.x, pu.y, POWERUP.RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(200,215,255,0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pu.x, pu.y, POWERUP.RADIUS, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      const spec = PICKUP_STYLE[pu.kind] ?? PICKUP_STYLE.health;
      const bob = Math.sin(t * 2.4 + pu.id) * 3;
      const y = pu.y + bob;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(pu.x, y, 2, pu.x, y, POWERUP.RADIUS * 1.9);
      g.addColorStop(0, `${spec.glow}0.45)`);
      g.addColorStop(1, `${spec.glow}0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pu.x, y, POWERUP.RADIUS * 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(pu.x, y);
      ctx.rotate(Math.sin(t * 1.3 + pu.id) * 0.18);
      ctx.fillStyle = 'rgba(12,15,24,0.9)';
      ctx.strokeStyle = spec.colour;
      ctx.lineWidth = 2.5;
      roundedDiamond(ctx, POWERUP.RADIUS);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Glyph, so pickups are not distinguished by colour alone.
      ctx.save();
      ctx.fillStyle = spec.colour;
      ctx.font = '800 14px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(spec.glyph, pu.x, y + 0.5);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- combat

  private drawProjectile(b: Projectile): void {
    const { ctx } = this;
    // Colour by the shooter's team so you can read incoming fire at a glance.
    const color = TEAM_COLORS[b.team] ?? TEAM_COLORS[2];
    const speed = Math.hypot(b.vx, b.vy) || 1;
    const tailLen = 22;
    const tx = b.x - (b.vx / speed) * tailLen;
    const ty = b.y - (b.vy / speed) * tailLen;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.45;
    ctx.lineCap = 'round';
    ctx.lineWidth = GUN.PROJECTILE_RADIUS * 1.8;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#fff8e6';
    ctx.beginPath();
    ctx.arc(b.x, b.y, GUN.PROJECTILE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Wedge sweeping through the swing arc — telegraphed on windup, hot when live. */
  private drawSword(p: PlayerState): void {
    if (p.swordTime <= 0 || !p.alive) return;
    const { ctx } = this;
    const total = SWORD.WINDUP + SWORD.ACTIVE;
    const t = Math.min(1, p.swordTime / total);
    const live = isSwordActive(p);

    const half = SWORD.ARC / 2;
    const sweep = -half + SWORD.ARC * t;
    const reach = SWORD.RANGE + PLAYER.RADIUS;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.swordAim);

    // Full arc footprint: shows exactly where the sword can reach. No surprises.
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, reach, -half, half);
    ctx.closePath();
    ctx.fillStyle = live ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)';
    ctx.fill();

    // The blade itself.
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = live ? 'rgba(255,255,255,0.95)' : 'rgba(180,215,255,0.5)';
    ctx.lineWidth = live ? 5 : 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(Math.cos(sweep) * (PLAYER.RADIUS + 2), Math.sin(sweep) * (PLAYER.RADIUS + 2));
    ctx.lineTo(Math.cos(sweep) * reach, Math.sin(sweep) * reach);
    ctx.stroke();

    if (live) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, reach - 4, sweep - 0.5, sweep);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- players

  private drawPlayer(p: PlayerState, isLocal: boolean): void {
    if (!p.alive) return;
    const { ctx } = this;
    const color = TEAM_COLORS[p.team] ?? TEAM_COLORS[0];
    const glow = TEAM_GLOW[p.team] ?? TEAM_GLOW[0];
    const r = PLAYER.RADIUS;

    ctx.save();

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 5, r * 0.95, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    const glowStrength = p.dashTime > 0 ? 0.5 : 0.22;
    const gr = ctx.createRadialGradient(p.x, p.y, r * 0.4, p.x, p.y, r * 2.6);
    gr.addColorStop(0, glow + glowStrength + ')');
    gr.addColorStop(1, glow + '0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.6, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.15, p.x, p.y, r);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.35, color);
    body.addColorStop(1, shade(color, -0.35));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    if (p.hitFlash > 0) {
      ctx.globalAlpha = Math.min(1, p.hitFlash / COMBAT.HIT_FLASH);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Non-colour team marker: red is a solid ring, blue a dashed one.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash(p.team === 1 ? [4, 3] : []);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const ax = Math.cos(p.aim), ay = Math.sin(p.aim);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(p.x + ax * (r + 6), p.y + ay * (r + 6), 3.2, 0, Math.PI * 2);
    ctx.fill();

    if (p.invuln > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.35 * Math.abs(Math.sin(p.invuln * 12))})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (p.onWall) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 3;
      const a = Math.atan2(p.wallNy, p.wallNx);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 4, a - 0.55, a + 0.55);
      ctx.stroke();
    }

    if (isLocal) {
      if (p.dashCd > 0) {
        const frac = 1 - p.dashCd / DASH.COOLDOWN;
        ctx.strokeStyle = 'rgba(255,255,255,0.30)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 10, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Name + health above every other player, and a chevron over teammates.
   * The chevron is the non-colour teammate cue: never rely on red vs blue alone.
   */
  private drawNameplate(p: PlayerState, isLocal: boolean, localTeam: number | null): void {
    if (!p.alive || isLocal) return;
    const { ctx } = this;
    const w = 38;
    const h = 4;
    const x = p.x - w / 2;
    // Flip the plate below the player when they are hugging the top wall,
    // so names never get clipped off the top of the arena.
    const above = p.y - PLAYER.RADIUS - 16;
    const flipped = above < 44;
    const y = flipped ? p.y + PLAYER.RADIUS + 26 : above;
    const frac = Math.max(0, p.health / PLAYER.HEALTH);
    const isMate = localTeam !== null && p.team === localTeam && p.team !== 2;

    ctx.save();

    if (isMate) {
      // Chevron floating on the outside of the nameplate.
      const cyTop = flipped ? y + 12 : y - 20;
      ctx.strokeStyle = 'rgba(110,231,160,0.95)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const dir = flipped ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(p.x - 6, cyTop);
      ctx.lineTo(p.x, cyTop + 7 * dir);
      ctx.lineTo(p.x + 6, cyTop);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = frac > 0.5 ? '#6ee7a0' : frac > 0.25 ? '#ffd166' : '#ff5470';
    ctx.fillRect(x, y, w * frac, h);

    ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    const label = `${TEAM_GLYPH[p.team] ?? ''} ${p.name}`;
    const labelY = flipped ? y + 18 : y - 4;
    ctx.strokeText(label, p.x, labelY);
    ctx.fillStyle = isMate ? 'rgba(160,235,190,0.95)' : 'rgba(230,236,250,0.9)';
    ctx.fillText(label, p.x, labelY);

    ctx.restore();
  }

  // -------------------------------------------------------------------- hud

  private drawScoreboard(world: WorldState, W: number): void {
    const { ctx } = this;
    const cx = W / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    ctx.fillStyle = 'rgba(10,12,20,0.55)';
    ctx.fillRect(cx - 92, 10, 184, 34);

    ctx.font = '800 20px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = TEAM_COLORS[0];
    ctx.fillText(`${TEAM_GLYPH[0]} ${world.scores[0]}`, cx - 14, 16);

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(180,190,215,0.5)';
    ctx.font = '700 14px ui-monospace, monospace';
    ctx.fillText('-', cx, 20);

    ctx.textAlign = 'left';
    ctx.font = '800 20px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = TEAM_COLORS[1];
    ctx.fillText(`${world.scores[1]} ${TEAM_GLYPH[1]}`, cx + 14, 16);

    ctx.restore();
  }

  /** Phase banner, match clock, countdown and the results screen. */
  private drawMatch(world: WorldState, W: number, H: number): void {
    const { ctx } = this;
    const m = world.match;
    const rules = MODE_RULES[m.mode] ?? MODE_RULES.tdm;
    const cx = W / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // --- mode + clock, tucked under the score
    if (m.phase === 'live') {
      const secs = Math.max(0, Math.ceil(m.timer));
      const mm = Math.floor(secs / 60);
      const ss = String(secs % 60).padStart(2, '0');
      ctx.font = '700 15px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = secs <= 15 ? '#ff5470' : 'rgba(200,210,235,0.85)';
      ctx.fillText(`${mm}:${ss}`, cx, 56);
      ctx.font = '600 10px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(160,175,215,0.6)';
      const unit = (rules as { unit?: string }).unit ?? 'KILLS';
      ctx.fillText(`${rules.name.toUpperCase()} · ${m.scoreTarget} ${unit}`, cx, 74);

      const status = objectiveStatus(world);
      if (status) {
        ctx.font = '800 12px ui-monospace, monospace';
        ctx.fillStyle = status.colour;
        ctx.fillText(status.text, cx, 92);
      }
    }

    // --- lobby
    if (m.phase === 'lobby') {
      ctx.font = '800 22px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('WAITING FOR PLAYERS', cx, H / 2 - 24);
      ctx.font = '600 13px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(160,175,215,0.75)';
      ctx.fillText('share your room code · warm up while you wait', cx, H / 2 + 4);
    }

    // --- countdown
    if (m.phase === 'countdown') {
      const n = Math.max(1, Math.ceil(m.timer));
      const frac = m.timer - Math.floor(m.timer);
      const pop = 1 + (1 - frac) * 0.22;
      ctx.save();
      ctx.translate(cx, H / 2 - 10);
      ctx.scale(pop, pop);
      ctx.font = '900 88px ui-sans-serif, system-ui, sans-serif';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(String(n), 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(n), 0, 0);
      ctx.restore();
      ctx.font = '700 13px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(200,210,235,0.7)';
      ctx.fillText(rules.name.toUpperCase(), cx, H / 2 + 52);
    }

    // --- GO! flash
    if (m.phase === 'live' && m.timer > m.duration - MATCH.GO_FLASH) {
      const k = (m.timer - (m.duration - MATCH.GO_FLASH)) / MATCH.GO_FLASH;
      ctx.globalAlpha = Math.min(1, k * 1.4);
      ctx.font = '900 76px ui-sans-serif, system-ui, sans-serif';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText('GO!', cx, H / 2 - 10);
      ctx.fillStyle = '#6ee7a0';
      ctx.fillText('GO!', cx, H / 2 - 10);
      ctx.globalAlpha = 1;
    }

    // --- results
    if (m.phase === 'results') this.drawResults(world, W, H);

    ctx.restore();
  }

  private drawResults(world: WorldState, W: number, H: number): void {
    const { ctx } = this;
    const m = world.match;
    const rules = MODE_RULES[m.mode] ?? MODE_RULES.tdm;
    const cx = W / 2;

    ctx.fillStyle = 'rgba(8,10,17,0.82)';
    ctx.fillRect(0, 0, W, H);

    let headline = 'DRAW';
    let colour = 'rgba(230,236,250,0.95)';
    if (rules.teamBased && m.winnerTeam !== null) {
      headline = `${m.winnerTeam === 0 ? 'RED' : 'BLUE'} WINS`;
      colour = TEAM_COLORS[m.winnerTeam];
    } else if (!rules.teamBased && m.winnerId) {
      const winner = world.players.get(m.winnerId);
      headline = `${winner ? winner.name.toUpperCase() : 'PLAYER'} WINS`;
      colour = TEAM_COLORS[winner ? winner.team : 2];
    }

    const top = Math.max(56, H / 2 - 150);
    ctx.font = '900 42px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = colour;
    ctx.fillText(headline, cx, top);

    if (rules.teamBased) {
      ctx.font = '800 26px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = 'rgba(230,236,250,0.9)';
      ctx.fillText(`${world.scores[0]}  -  ${world.scores[1]}`, cx, top + 40);
    }

    // --- per-player table
    const rows = [...world.players.values()].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const tableTop = top + 76;
    const rowH = 24;
    const colName = cx - 140;
    const colK = cx + 60;
    const colD = cx + 120;

    ctx.font = '700 11px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(160,175,215,0.7)';
    ctx.textAlign = 'left';
    ctx.fillText('PLAYER', colName, tableTop);
    ctx.textAlign = 'right';
    ctx.fillText('K', colK, tableTop);
    ctx.fillText('D', colD, tableTop);

    ctx.font = '700 15px ui-sans-serif, system-ui, sans-serif';
    rows.forEach((p, i) => {
      const y = tableTop + 22 + i * rowH;
      ctx.textAlign = 'left';
      ctx.fillStyle = TEAM_COLORS[p.team] ?? TEAM_COLORS[2];
      ctx.fillText(`${TEAM_GLYPH[p.team] ?? ''} ${p.name}`, colName, y);
      ctx.fillStyle = 'rgba(230,236,250,0.9)';
      ctx.textAlign = 'right';
      ctx.fillText(String(p.kills), colK, y);
      ctx.fillStyle = 'rgba(160,175,215,0.75)';
      ctx.fillText(String(p.deaths), colD, y);
    });

    ctx.textAlign = 'center';
    ctx.font = '800 14px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = '#6ee7a0';
    ctx.fillText('PRESS SPACE TO RUN IT BACK', cx, tableTop + 34 + rows.length * rowH + 18);
    ctx.font = '600 12px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(160,175,215,0.65)';
    ctx.fillText(`next match in ${Math.max(0, Math.ceil(m.timer))}s`, cx, tableTop + 34 + rows.length * rowH + 40);
  }

  /** Full team listing, shown while TAB is held. */
  private drawTeamScoreboard(world: WorldState, W: number, H: number): void {
    const { ctx } = this;
    const teams: PlayerState[][] = [[], [], []];
    for (const p of world.players.values()) teams[p.team]?.push(p);
    for (const list of teams) list.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);

    const hasFfa = teams[2].length > 0;
    const columns = hasFfa ? [teams[2]] : [teams[0], teams[1]];
    const colW = 260;
    const totalW = colW * columns.length + 24 * (columns.length - 1);
    const left = (W - totalW) / 2;
    const top = Math.max(70, H / 2 - 170);

    ctx.save();
    ctx.fillStyle = 'rgba(8,10,17,0.86)';
    ctx.fillRect(left - 20, top - 34, totalW + 40, 74 + Math.max(...columns.map((c) => c.length)) * 24);

    columns.forEach((list, ci) => {
      const x = left + ci * (colW + 24);
      const teamIdx = hasFfa ? 2 : ci;

      ctx.textAlign = 'left';
      ctx.font = '800 15px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = TEAM_COLORS[teamIdx];
      const title = hasFfa ? 'FREE FOR ALL' : teamIdx === 0 ? 'RED' : 'BLUE';
      ctx.fillText(`${TEAM_GLYPH[teamIdx]} ${title}`, x, top - 12);

      if (!hasFfa) {
        ctx.textAlign = 'right';
        ctx.fillText(String(world.scores[teamIdx] ?? 0), x + colW, top - 12);
      }

      ctx.font = '700 10px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(160,175,215,0.6)';
      ctx.textAlign = 'left';
      ctx.fillText('PLAYER', x, top + 8);
      ctx.textAlign = 'right';
      ctx.fillText('K', x + colW - 44, top + 8);
      ctx.fillText('D', x + colW, top + 8);

      ctx.font = '600 14px ui-sans-serif, system-ui, sans-serif';
      list.forEach((p, i) => {
        const y = top + 30 + i * 24;
        ctx.textAlign = 'left';
        ctx.fillStyle = p.alive ? 'rgba(230,236,250,0.95)' : 'rgba(140,152,182,0.7)';
        ctx.fillText(p.name, x, y);
        ctx.textAlign = 'right';
        ctx.fillText(String(p.kills), x + colW - 44, y);
        ctx.fillStyle = 'rgba(160,175,215,0.7)';
        ctx.fillText(String(p.deaths), x + colW, y);
      });
    });
    ctx.restore();
  }

  private drawKillFeed(feed: KillFeedEntry[], W: number): void {
    if (feed.length === 0) return;
    const { ctx } = this;
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';

    let y = 52;
    for (const k of feed) {
      const fade = k.age > 4 ? 1 - (k.age - 4) : 1;
      ctx.globalAlpha = Math.max(0, Math.min(1, fade));

      const weapon = k.weapon === 'sword' ? 'sliced' : k.weapon === 'fall' ? 'dunked' : 'shot';
      const killerLabel = k.killer ? `${TEAM_GLYPH[k.killerTeam]} ${k.killer}` : 'the pit';
      const verb = k.killer ? weapon : 'took';
      const victimLabel = `${TEAM_GLYPH[k.victimTeam]} ${k.victim}`;
      const text = `${killerLabel}  ${verb}  ${victimLabel}`;
      const w = ctx.measureText(text).width;

      ctx.fillStyle = k.involvesLocal ? 'rgba(255,255,255,0.12)' : 'rgba(10,12,20,0.5)';
      ctx.fillRect(W - 16 - w - 8, y - 3, w + 12, 20);
      ctx.fillStyle = k.involvesLocal ? '#ffffff' : 'rgba(215,222,240,0.9)';
      ctx.fillText(text, W - 20, y);
      y += 24;
    }
    ctx.restore();
  }

  private drawHud(hud: HudInfo, local: PlayerState | null, world: WorldState): void {
    const { ctx, viewport } = this;
    ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
    const W = viewport.cssWidth;
    const H = viewport.cssHeight;

    ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(160,175,215,0.7)';
    const lines = [`${hud.fps.toFixed(0)} fps`];
    if (hud.ping !== undefined && hud.ping > 0) lines.push(`${hud.ping.toFixed(0)} ms`);
    if (hud.room) lines.push(`room ${hud.room}`);
    if (hud.debug && local) {
      lines.push(`speed ${Math.hypot(local.vx, local.vy).toFixed(0)}`);
      lines.push(`dash  ${local.dashCd > 0 ? local.dashCd.toFixed(2) : 'READY'}`);
      lines.push(`wall  ${local.onWall ? 'YES' : 'no'}`);
      lines.push(`hp    ${local.health.toFixed(0)}`);
      lines.push(`k/d   ${local.kills}/${local.deaths}`);
    }
    lines.forEach((line, i) => ctx.fillText(line, 12, 12 + i * 16));

    this.drawScoreboard(world, W);
    this.drawKillFeed(hud.killFeed, W);
    this.drawMatch(world, W, H);
    if (hud.showScoreboard && world.match.phase !== 'results') this.drawTeamScoreboard(world, W, H);

    if (!local) return;

    // --- health bar (bottom-left)
    const barW = 210, barH = 14;
    const bx = 20, by = H - 66;
    const frac = Math.max(0, local.health / PLAYER.HEALTH);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = frac > 0.5 ? '#6ee7a0' : frac > 0.25 ? '#ffd166' : '#ff5470';
    ctx.fillRect(bx, by, barW * frac, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(`${Math.ceil(local.health)}`, bx + barW + 8, by + 1);

    // --- shield overlay on top of the health bar
    if (local.shield > 0) {
      const sw = barW * Math.min(1, local.shield / 45);
      ctx.fillStyle = 'rgba(180,190,255,0.85)';
      ctx.fillRect(bx, by - 6, sw, 4);
    }

    // --- active buffs
    const buffs: [string, number, string][] = [
      ['SPEED', local.buffSpeed, '#82dcff'],
      ['RAPID', local.buffRapid, '#ffd278'],
      ['DAMAGE', local.buffDamage, '#ff7878'],
      ['DASH', local.buffDash, '#ffa0f0'],
    ];
    let bufX = bx;
    ctx.font = '800 10px ui-monospace, monospace';
    for (const [label, time, colour] of buffs) {
      if (time <= 0) continue;
      const w = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(10,12,20,0.6)';
      ctx.fillRect(bufX, by - 26, w, 14);
      ctx.fillStyle = colour;
      ctx.globalAlpha = time < 1.5 ? 0.4 + 0.6 * Math.abs(Math.sin(time * 10)) : 1;
      ctx.fillText(label, bufX + 6, by - 23);
      ctx.globalAlpha = 1;
      bufX += w + 5;
    }

    // --- ammo pips
    const pipW = 6, pipGap = 4;
    const ay = by + barH + 10;
    for (let i = 0; i < GUN.MAG_SIZE; i++) {
      ctx.fillStyle = i < local.ammo ? 'rgba(255,235,170,0.95)' : 'rgba(255,255,255,0.14)';
      ctx.fillRect(bx + i * (pipW + pipGap), ay, pipW, 12);
    }
    if (local.reloadTime > 0) {
      const rf = 1 - local.reloadTime / 1.35;
      ctx.fillStyle = 'rgba(255,235,170,0.35)';
      ctx.fillRect(bx, ay, (GUN.MAG_SIZE * (pipW + pipGap) - pipGap) * rf, 12);
      ctx.fillStyle = 'rgba(255,235,170,0.9)';
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.fillText('RELOADING', bx + GUN.MAG_SIZE * (pipW + pipGap) + 6, ay);
    }

    // --- death overlay
    if (!local.alive) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '800 34px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('DOWN', W / 2, H / 2 - 40);
      ctx.font = '600 16px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(200,210,235,0.8)';
      ctx.fillText(`respawn in ${local.respawnIn.toFixed(1)}s`, W / 2, H / 2 + 4);
      ctx.textAlign = 'left';
    }
  }
}

/** One-line objective readout shown under the match clock. */
function objectiveStatus(world: WorldState): { text: string; colour: string } | null {
  const kind = MODE_RULES[world.match.mode]?.objective;
  const o = world.objective;

  if (kind === 'hill') {
    if (o.hillContested) return { text: 'HILL CONTESTED', colour: '#ffd166' };
    if (o.hillOwner === null) return { text: 'HILL NEUTRAL', colour: 'rgba(200,210,235,0.75)' };
    return {
      text: o.hillOwner === 0 ? 'RED HOLDS THE HILL' : 'BLUE HOLDS THE HILL',
      colour: TEAM_COLORS[o.hillOwner],
    };
  }

  if (kind === 'flags') {
    const taken = o.flags.filter((f) => f.status !== 'home');
    if (taken.length === 0) return null;
    const carried = taken.filter((f) => f.status === 'carried').length;
    return {
      text: carried > 0 ? 'FLAG ON THE MOVE' : 'FLAG DROPPED',
      colour: carried > 0 ? '#ffd166' : 'rgba(200,210,235,0.8)',
    };
  }

  if (kind === 'bomb' && o.bomb) {
    return o.bomb.status === 'carried'
      ? { text: 'BOMB IS BEING CARRIED', colour: '#ffd166' }
      : { text: 'BOMB IS LOOSE', colour: 'rgba(200,210,235,0.8)' };
  }

  return null;
}

/** Each pickup has its own colour AND its own glyph. */
const PICKUP_STYLE: Record<string, { colour: string; glow: string; glyph: string }> = {
  health: { colour: '#6ee7a0', glow: 'rgba(110,231,160,', glyph: '+' },
  speed: { colour: '#82dcff', glow: 'rgba(130,220,255,', glyph: '»' },
  shield: { colour: '#b4beff', glow: 'rgba(180,190,255,', glyph: '\u25C7' },
  rapid: { colour: '#ffd278', glow: 'rgba(255,210,120,', glyph: '\u00BB' },
  damage: { colour: '#ff7878', glow: 'rgba(255,120,120,', glyph: '\u2716' },
  dash: { colour: '#ffa0f0', glow: 'rgba(255,160,240,', glyph: '\u21AF' },
};

function roundedDiamond(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r, 0);
  ctx.closePath();
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(Math.min(255, Math.max(0, ((n >> 16) & 255) * (1 + amt))));
  const g = Math.round(Math.min(255, Math.max(0, ((n >> 8) & 255) * (1 + amt))));
  const b = Math.round(Math.min(255, Math.max(0, (n & 255) * (1 + amt))));
  return `rgb(${r},${g},${b})`;
}
