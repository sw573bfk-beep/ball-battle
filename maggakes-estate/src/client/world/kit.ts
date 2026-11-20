import type { Opts } from '../engine/props';
import type { PosterKind } from '../engine/tex';

/** [x, z, width, depth] in floor-plan metres, top-left origin. */
export type Rect = [number, number, number, number];
export type Side = 'n' | 's' | 'e' | 'w';

export interface PropDef { t: string; x: number; z: number; r: number; o: Opts }

export const P = (t: string, x: number, z: number, r = 0, o: Opts = {}): PropDef => ({ t, x, z, r, o });

const ROT: Record<Side, number> = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 };

export function wallLength(r: Rect, side: Side): number {
  return side === 'n' || side === 's' ? r[2] : r[3];
}

/**
 * Converts wall-relative coordinates to the floor plan.
 * `u` = metres along the wall (from its left/top end), `v` = metres into the room.
 * Returns [x, z, rotation] where rotation makes a prop's back face the wall.
 */
export function wl(r: Rect, side: Side, u: number, v: number): [number, number, number] {
  const [x, z, w, d] = r;
  switch (side) {
    case 'n': return [x + u, z + v, ROT.n];
    case 's': return [x + u, z + d - v, ROT.s];
    case 'w': return [x + v, z + u, ROT.w];
    case 'e': return [x + w - v, z + u, ROT.e];
  }
}

/** A prop placed flat against a wall. `along` is 0..1 along the wall. */
export function on(r: Rect, side: Side, along: number, depth: number, t: string, o: Opts = {}, gap = 0.06): PropDef {
  const [x, z, rot] = wl(r, side, along * wallLength(r, side), depth / 2 + gap);
  return P(t, x, z, rot, o);
}

export const centre = (r: Rect): [number, number] => [r[0] + r[2] / 2, r[1] + r[3] / 2];

export function label(r: Rect, text: string, dz = 0.3): PropDef {
  return P('label', r[0] + r[2] / 2, r[1] + r[3] * (0.5 + dz), 0, { text });
}

export interface BedroomTheme {
  bed: string;
  accent: string;
  pillow?: string;
  frame?: string;
  rug: string;
  posters: PosterKind[];
  canopy?: boolean;
  along?: number;
}

export function bedroomKit(r: Rect, side: Side, th: BedroomTheme): PropDef[] {
  const L = wallLength(r, side);
  const u = (th.along ?? 0.5) * L;
  const bw = th.canopy ? 2 : 1.8, bl = th.canopy ? 2.3 : 2.2;
  const out: PropDef[] = [];
  const put = (t: string, uu: number, vv: number, o: Opts = {}, extraRot = 0) => {
    const [x, z, rot] = wl(r, side, uu, vv);
    out.push(P(t, x, z, rot + extraRot, o));
  };
  put(th.canopy ? 'canopybed' : 'bed', u, bl / 2 + 0.12, { color: th.bed, accent: th.accent, pillow: th.pillow, frame: th.frame });
  put('nightstand', u - bw / 2 - 0.42, 0.3, { color: th.frame });
  put('nightstand', u + bw / 2 + 0.42, 0.3, { color: th.frame });
  put('rug', u, bl + 0.5, { color: th.rug, w: 3, d: 2 });
  th.posters.forEach((k, i) => {
    const side2 = i % 2 === 0 ? -1 : 1;
    const off = bw / 2 + 1.25 + Math.floor(i / 2) * 1.0;
    const uu = u + side2 * off;
    if (uu > 0.5 && uu < L - 0.5) put('poster', uu, 0.03, { kind: k });
  });
  return out;
}

export function ensuiteKit(r: Rect, side: Side, opts: { tub?: boolean } = {}): PropDef[] {
  const L = wallLength(r, side);
  const depth = side === 'n' || side === 's' ? r[3] : r[2];
  const out: PropDef[] = [];
  const put = (t: string, uu: number, vv: number, o: Opts = {}, extra = 0) => {
    const [x, z, rot] = wl(r, side, uu, vv);
    out.push(P(t, x, z, rot + extra, o));
  };
  // Back wall: shower (left corner), sink, toilet (right). Tub along the
  // left side wall near the front, clear of a door in the middle of the front wall.
  put('toilet', L - 0.55, 0.42);
  put('sink', L - 1.85, 0.3, { w: 1.2 });
  if (L >= 3.9) put('shower', 0.62, 0.62, { w: 1.1 }, -Math.PI / 2);
  if ((opts.tub ?? true) && depth >= 4.5) put('bathtub', 0.55, depth - 1.15, {}, Math.PI / 2);
  return out;
}

export function wardrobeKit(r: Rect, side: Side, colors?: string[]): PropDef[] {
  const L = wallLength(r, side);
  const w = Math.min(4, L - 1.2);
  const out: PropDef[] = [on(r, side, 0.5, 0.65, 'rack', { w, colors })];
  return out;
}
