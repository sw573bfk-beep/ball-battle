/** Purely cosmetic effects: particles, floating numbers, screen shake. */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  /** Sparks draw as streaks along their velocity; dots as circles. */
  kind: 'dot' | 'spark' | 'ring';
  drag: number;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number;
}

export class Fx {
  particles: Particle[] = [];
  texts: FloatText[] = [];
  shake = 0;

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 30);
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      const f = Math.exp(-p.drag * dt);
      p.vx *= f;
      p.vy *= f;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return p.life > 0;
    });
    this.texts = this.texts.filter((t) => {
      t.life -= dt;
      t.y -= 40 * dt;
      return t.life > 0;
    });
  }

  burst(x: number, y: number, color: string, count: number, speed: number, kind: Particle['kind'] = 'dot', size = 3, life = 0.5): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      const l = life * (0.6 + Math.random() * 0.6);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, max: l, size: size * (0.6 + Math.random() * 0.8), color, kind, drag: 4 });
    }
    if (this.particles.length > 1500) this.particles.splice(0, this.particles.length - 1500);
  }

  ring(x: number, y: number, color: string, size: number, life = 0.4): void {
    this.particles.push({ x, y, vx: 0, vy: 0, life, max: life, size, color, kind: 'ring', drag: 0 });
  }

  text(x: number, y: number, text: string, color: string, size = 18, life = 0.8): void {
    this.texts.push({ x, y, text, color, life, max: life, size });
  }

  kick(amount: number): void {
    this.shake = Math.min(14, Math.max(this.shake, amount));
  }
}
