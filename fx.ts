/**
 * Lightweight particle + trail layer. Purely cosmetic — never affects the sim.
 * Fixed-size pools so long matches can't allocate their way into a GC stall.
 */

const MAX_PARTICLES = 400;

interface Particle {
  active: boolean;
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  drag: number;
  r: number; g: number; b: number;
}

export interface TrailPoint { x: number; y: number; age: number; }

interface FloatText {
  x: number; y: number; vy: number;
  text: string; age: number; life: number;
  color: string; size: number;
}

export class Fx {
  private pool: Particle[] = [];
  private next = 0;
  trail: TrailPoint[] = [];
  texts: FloatText[] = [];
  shake = 0;

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, drag: 2, r: 255, g: 255, b: 255 });
    }
  }

  burst(x: number, y: number, count: number, opts: {
    speed?: number; spread?: number; dirX?: number; dirY?: number;
    life?: number; size?: number; drag?: number; color?: [number, number, number];
  } = {}): void {
    const speed = opts.speed ?? 240;
    const spread = opts.spread ?? Math.PI * 2;
    const baseAngle = opts.dirX !== undefined ? Math.atan2(opts.dirY ?? 0, opts.dirX) : 0;
    const life = opts.life ?? 0.35;
    const size = opts.size ?? 3;
    const drag = opts.drag ?? 4;
    const [r, g, b] = opts.color ?? [255, 255, 255];

    for (let i = 0; i < count; i++) {
      const p = this.pool[this.next];
      this.next = (this.next + 1) % MAX_PARTICLES;
      const a = baseAngle + (Math.random() - 0.5) * spread;
      const s = speed * (0.45 + Math.random() * 0.75);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.maxLife = life * (0.7 + Math.random() * 0.6);
      p.life = p.maxLife;
      p.size = size * (0.6 + Math.random() * 0.8);
      p.drag = drag;
      p.r = r; p.g = g; p.b = b;
    }
  }

  floatText(x: number, y: number, text: string, color = '#ffffff', size = 15): void {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ x, y, vy: -46, text, age: 0, life: 0.75, color, size });
  }

  addShake(amount: number): void {
    this.shake = Math.min(18, this.shake + amount);
  }

  pushTrail(x: number, y: number): void {
    this.trail.push({ x, y, age: 0 });
    if (this.trail.length > 40) this.trail.shift();
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      const f = Math.exp(-p.drag * dt);
      p.vx *= f; p.vy *= f;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].age += dt;
      if (this.trail[i].age > 0.28) this.trail.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.age += dt;
      t.y += t.vy * dt;
      t.vy *= Math.exp(-2.4 * dt);
      if (t.age >= t.life) this.texts.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - this.shake * 9 * dt - 6 * dt);
  }

  drawTexts(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const t of this.texts) {
      const k = 1 - t.age / t.life;
      ctx.globalAlpha = Math.min(1, k * 2.2);
      ctx.font = `800 ${t.size}px ui-sans-serif, system-ui, sans-serif`;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.pool) {
      if (!p.active) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = t * 0.9;
      ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.3 + t * 0.7), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
