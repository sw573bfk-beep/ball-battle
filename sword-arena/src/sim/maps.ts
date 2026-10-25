/** Arena layouts. Coordinates are world pixels; every wall is an axis-aligned rect. */

import type { Rect } from './math.js';
import type { MapDef } from './types.js';

const W = 2400;
const H = 1600;
const T = 40; // border thickness

function border(w: number, h: number): Rect[] {
  return [
    { x: 0, y: 0, w, h: T },
    { x: 0, y: h - T, w, h: T },
    { x: 0, y: 0, w: T, h },
    { x: w - T, y: 0, w: T, h },
  ];
}

/** Mirror a rect left-right and top-bottom, giving four symmetric copies. */
function quad(r: Rect): Rect[] {
  const mx = W - r.x - r.w;
  const my = H - r.y - r.h;
  return [r, { ...r, x: mx }, { ...r, y: my }, { ...r, x: mx, y: my }];
}

export const COLOSSEUM: MapDef = {
  name: 'Colosseum',
  width: W,
  height: H,
  walls: [
    ...border(W, H),
    // Centre pillar inside a broken ring of L-walls.
    { x: 1150, y: 750, w: 100, h: 100 },
    ...quad({ x: 900, y: 560, w: 180, h: 30 }),
    ...quad({ x: 900, y: 560, w: 30, h: 180 }),
    // T-shapes hanging off the top and bottom walls.
    { x: 1180, y: T, w: 40, h: 160 },
    { x: 1080, y: 200, w: 240, h: 36 },
    { x: 1180, y: H - T - 160, w: 40, h: 160 },
    { x: 1080, y: H - 236, w: 240, h: 36 },
    // Quadrant cover.
    ...quad({ x: 400, y: 300, w: 260, h: 40 }),
    { x: 300, y: 600, w: 40, h: 400 },
    { x: W - 340, y: 600, w: 40, h: 400 },
    { x: 620, y: 760, w: 80, h: 80 },
    { x: W - 700, y: 760, w: 80, h: 80 },
  ],
  crates: [
    { x: 560, y: 470 }, { x: 1840, y: 470 }, { x: 560, y: 1130 }, { x: 1840, y: 1130 },
    { x: 1200, y: 420 }, { x: 1200, y: 1180 },
    { x: 130, y: 130 }, { x: 2270, y: 130 }, { x: 130, y: 1470 }, { x: 2270, y: 1470 },
    { x: 860, y: 800 }, { x: 1540, y: 800 },
  ],
  healthPads: [
    { x: 1200, y: 660 }, { x: 1200, y: 940 }, { x: 170, y: 800 }, { x: 2230, y: 800 },
  ],
  spawns: [
    { x: 220, y: 220 }, { x: 2180, y: 220 }, { x: 220, y: 1380 }, { x: 2180, y: 1380 },
    { x: 800, y: 140 }, { x: 1600, y: 140 }, { x: 800, y: 1460 }, { x: 1600, y: 1460 },
    { x: 480, y: 800 }, { x: 1920, y: 800 }, { x: 1200, y: 520 }, { x: 1200, y: 1080 },
  ],
};

export const MAPS: Record<string, MapDef> = { colosseum: COLOSSEUM };
export const DEFAULT_MAP = 'colosseum';
