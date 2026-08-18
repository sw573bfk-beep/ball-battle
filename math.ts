/** Small, allocation-light 2D math helpers shared by client and server. */

export interface Vec2 { x: number; y: number; }

export const vec = (x = 0, y = 0): Vec2 => ({ x, y });

export function len(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate independent exponential decay toward 0. */
export function damp(value: number, rate: number, dt: number): number {
  return value * Math.exp(-rate * dt);
}

/** Normalises (x,y); returns [0,0] for a zero-length vector. */
export function norm(x: number, y: number): [number, number] {
  const l = len(x, y);
  if (l < 1e-9) return [0, 0];
  return [x / l, y / l];
}

export function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

/** Deterministic 32-bit PRNG (mulberry32) so sim randomness stays reproducible. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------- shapes
export interface Rect { x: number; y: number; w: number; h: number; }

export interface CircleHit {
  hit: boolean;
  /** Unit normal pointing from the rect surface toward the circle centre. */
  nx: number;
  ny: number;
  /** Penetration depth along the normal (>= 0). */
  depth: number;
}

const NO_HIT: CircleHit = { hit: false, nx: 0, ny: 0, depth: 0 };

/**
 * Circle vs axis-aligned rectangle.
 * `skin` inflates the rect so "touching" can be detected slightly early.
 * Handles the deep-overlap case (centre inside the rect) by pushing out along
 * the shallowest axis, which is what stops players tunnelling/sticking.
 */
export function circleVsRect(
  cx: number, cy: number, r: number, rect: Rect, skin = 0,
): CircleHit {
  const rx = rect.x - skin;
  const ry = rect.y - skin;
  const rw = rect.w + skin * 2;
  const rh = rect.h + skin * 2;

  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  const d2 = dx * dx + dy * dy;

  if (d2 > r * r) return NO_HIT;

  if (d2 > 1e-9) {
    // Centre is outside the rect: normal points from surface to centre.
    const d = Math.sqrt(d2);
    return { hit: true, nx: dx / d, ny: dy / d, depth: r - d };
  }

  // Centre is inside the rect — pick the closest face to escape through.
  const left = cx - rx;
  const right = rx + rw - cx;
  const top = cy - ry;
  const bottom = ry + rh - cy;
  const min = Math.min(left, right, top, bottom);

  if (min === left)  return { hit: true, nx: -1, ny: 0, depth: left + r };
  if (min === right) return { hit: true, nx: 1, ny: 0, depth: right + r };
  if (min === top)   return { hit: true, nx: 0, ny: -1, depth: top + r };
  return { hit: true, nx: 0, ny: 1, depth: bottom + r };
}

/**
 * Does the segment (x1,y1)->(x2,y2) intersect this rect? Slab method.
 * Used for sword line-of-sight so you can't slash people through a wall.
 */
export function segmentHitsRect(
  x1: number, y1: number, x2: number, y2: number, rect: Rect,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;

  // X slab
  if (Math.abs(dx) < 1e-9) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  // Y slab
  if (Math.abs(dy) < 1e-9) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  return true;
}

export function segmentBlocked(
  x1: number, y1: number, x2: number, y2: number, walls: Rect[],
): boolean {
  for (let i = 0; i < walls.length; i++) {
    if (segmentHitsRect(x1, y1, x2, y2, walls[i])) return true;
  }
  return false;
}

/** Shortest signed difference between two angles, wrapped to [-PI, PI]. */
export function angleDelta(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
