/** Small, allocation-light vector and collision helpers. */

export interface Vec { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const len = (x: number, y: number): number => Math.hypot(x, y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Wrap an angle into [-PI, PI). */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

/**
 * Push a circle out of a rectangle.
 * Returns the push normal and depth, or null when they don't overlap.
 */
export function circleVsRect(
  cx: number, cy: number, r: number, rect: Rect,
): { nx: number; ny: number; depth: number } | null {
  const px = clamp(cx, rect.x, rect.x + rect.w);
  const py = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - px;
  const dy = cy - py;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }
  // Centre is inside the rect: push out along the shallowest axis.
  const left = cx - rect.x;
  const right = rect.x + rect.w - cx;
  const top = cy - rect.y;
  const bottom = rect.y + rect.h - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { nx: -1, ny: 0, depth: left + r };
  if (m === right) return { nx: 1, ny: 0, depth: right + r };
  if (m === top) return { nx: 0, ny: -1, depth: top + r };
  return { nx: 0, ny: 1, depth: bottom + r };
}

export function pointInRect(x: number, y: number, r: Rect, pad = 0): boolean {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}

/** Squared distance from point P to segment AB. */
export function distSqPointSegment(
  px: number, py: number, ax: number, ay: number, bx: number, by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const l2 = abx * abx + aby * aby;
  let t = l2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / l2 : 0;
  t = clamp(t, 0, 1);
  const qx = ax + abx * t - px;
  const qy = ay + aby * t - py;
  return qx * qx + qy * qy;
}

/** Squared distance between segments AB and CD. */
export function distSqSegments(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): number {
  if (segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  return Math.min(
    distSqPointSegment(ax, ay, cx, cy, dx, dy),
    distSqPointSegment(bx, by, cx, cy, dx, dy),
    distSqPointSegment(cx, cy, ax, ay, bx, by),
    distSqPointSegment(dx, dy, ax, ay, bx, by),
  );
}

function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d1 = cross(dx - cx, dy - cy, ax - cx, ay - cy);
  const d2 = cross(dx - cx, dy - cy, bx - cx, by - cy);
  const d3 = cross(bx - ax, by - ay, cx - ax, cy - ay);
  const d4 = cross(bx - ax, by - ay, dx - ax, dy - ay);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

const cross = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;

/** True when the straight line from A to B passes through any rect. */
export function lineBlocked(ax: number, ay: number, bx: number, by: number, rects: Rect[]): boolean {
  for (const r of rects) if (segmentHitsRect(ax, ay, bx, by, r)) return true;
  return false;
}

/** Liang–Barsky segment vs axis-aligned rect. */
export function segmentHitsRect(ax: number, ay: number, bx: number, by: number, r: Rect): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - r.x, r.x + r.w - ax, ay - r.y, r.y + r.h - ay];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return true;
}

/**
 * Seeded PRNG (mulberry32). The sim only uses this — never Math.random() — so
 * the same seed + inputs replay identically, which an online server will need.
 */
export function nextRandom(state: { seed: number }): number {
  let t = (state.seed = (state.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
