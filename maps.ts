/**
 * Arenas.
 *
 * Rules every map here follows:
 *  - small enough that a fight is always a dash or two away
 *  - left/right mirror symmetry, so neither team gets the better half
 *  - at least one stretch of parallel walls for wall-dash chaining
 *  - spawn pads in open ground, never pressed against geometry
 *  - objective fixtures placed for every mode the map supports
 *
 * tests/maps.test.ts checks all of that automatically, including reachability.
 */

import { ARENA } from './config.js';
import type { MapDef } from './types.js';
import type { Rect } from './math.js';

const T = ARENA.WALL_THICKNESS;
const W = ARENA.WIDTH;
const H = ARENA.HEIGHT;
const CX = W / 2;
const CY = H / 2;

function border(): Rect[] {
  return [
    { x: 0, y: 0, w: W, h: T },
    { x: 0, y: H - T, w: W, h: T },
    { x: 0, y: 0, w: T, h: H },
    { x: W - T, y: 0, w: T, h: H },
  ];
}

const box = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

/** Mirrors a rect across the vertical centre line. */
const mirror = (r: Rect): Rect => ({ x: W - r.x - r.w, y: r.y, w: r.w, h: r.h });

/** Returns [rect, mirroredRect] so maps stay symmetric by construction. */
const pair = (x: number, y: number, w: number, h: number): Rect[] => {
  const r = box(x, y, w, h);
  return [r, mirror(r)];
};

/** Mirrors a point across the vertical centre line. */
const mp = (p: { x: number; y: number }) => ({ x: W - p.x, y: p.y });

const redPads = (pads: { x: number; y: number }[]) => pads;
const bluePads = (pads: { x: number; y: number }[]) => pads.map(mp);

/** A neutral pool for free-for-all: both bases plus the corners. */
function ffaPads(red: { x: number; y: number }[]): { x: number; y: number }[] {
  return [...red, ...red.map(mp)];
}

// ---------------------------------------------------------------------------
// 1. YARD — open arena. Pure aim and movement, nowhere to hide for long.
// ---------------------------------------------------------------------------
const YARD_RED = [
  { x: 100, y: 180 }, { x: 100, y: 300 }, { x: 100, y: 420 },
  { x: 100, y: 540 }, { x: 175, y: 240 }, { x: 175, y: 480 },
];

const yard: MapDef = {
  id: 'yard',
  name: 'Yard',
  width: W, height: H,
  walls: [
    ...border(),
    ...pair(280, 160, 80, 80),
    ...pair(280, 480, 80, 80),
    ...pair(430, 330, 24, 130),
    ...pair(610, 110, 60, 24),
    ...pair(610, 586, 60, 24),
  ],
  spawns: [redPads(YARD_RED), bluePads(YARD_RED), ffaPads(YARD_RED)],
  hill: { x: CX, y: CY, r: 100 },
  flagStands: [{ x: 110, y: CY }, { x: W - 110, y: CY }],
  bomb: { spawn: { x: CX, y: CY }, sites: [{ x: 160, y: CY }, { x: W - 160, y: CY }] },
  powerupPads: [{ x: CX, y: 220 }, { x: CX, y: 500 }, { x: 330, y: CY }, { x: W - 330, y: CY }],
};

// ---------------------------------------------------------------------------
// 2. BUNKER — cover everywhere. Peeking, flanking, short sightlines.
// ---------------------------------------------------------------------------
const BUNKER_RED = [
  { x: 95, y: 150 }, { x: 95, y: 290 }, { x: 95, y: 430 },
  { x: 95, y: 570 }, { x: 170, y: 220 }, { x: 170, y: 500 },
];

const bunker: MapDef = {
  id: 'bunker',
  name: 'Bunker',
  width: W, height: H,
  walls: [
    ...border(),
    ...pair(240, 110, 24, 180),
    ...pair(240, 430, 24, 180),
    ...pair(430, 250, 110, 28),
    ...pair(430, 442, 110, 28),
    ...pair(600, 140, 80, 60),
    ...pair(600, 520, 80, 60),
  ],
  spawns: [redPads(BUNKER_RED), bluePads(BUNKER_RED), ffaPads(BUNKER_RED)],
  hill: { x: CX, y: CY, r: 92 },
  flagStands: [{ x: 110, y: CY }, { x: W - 110, y: CY }],
  bomb: { spawn: { x: CX, y: CY }, sites: [{ x: 160, y: CY }, { x: W - 160, y: CY }] },
  powerupPads: [{ x: CX, y: 260 }, { x: CX, y: 460 }, { x: 350, y: CY }, { x: W - 350, y: CY }],
};

// ---------------------------------------------------------------------------
// 3. KEEP — a walled structure in the middle with four ways in.
// ---------------------------------------------------------------------------
const KEEP_RED = [
  { x: 100, y: 140 }, { x: 100, y: 280 }, { x: 100, y: 440 },
  { x: 100, y: 580 }, { x: 180, y: 210 }, { x: 180, y: 510 },
];

const keep: MapDef = {
  id: 'keep',
  name: 'The Keep',
  width: W, height: H,
  walls: [
    ...border(),
    // Ring walls with a gap on each side.
    box(540, 260, 76, 22), box(664, 260, 76, 22),
    box(540, 438, 76, 22), box(664, 438, 76, 22),
    box(540, 260, 22, 76), box(540, 384, 22, 76),
    box(718, 260, 22, 76), box(718, 384, 22, 76),
    // Outer cover.
    ...pair(290, 150, 70, 70),
    ...pair(290, 500, 70, 70),
    ...pair(420, 330, 22, 120),
  ],
  spawns: [redPads(KEEP_RED), bluePads(KEEP_RED), ffaPads(KEEP_RED)],
  hill: { x: CX, y: CY, r: 86 },
  flagStands: [{ x: 110, y: CY }, { x: W - 110, y: CY }],
  bomb: { spawn: { x: CX, y: CY }, sites: [{ x: 165, y: CY }, { x: W - 165, y: CY }] },
  powerupPads: [{ x: CX, y: 160 }, { x: CX, y: 560 }, { x: 350, y: CY }, { x: W - 350, y: CY }],
};

// ---------------------------------------------------------------------------
// 4. RUNGS — built entirely around wall movement. Chain the bars to cross it.
// ---------------------------------------------------------------------------
const RUNGS_RED = [
  { x: 90, y: 130 }, { x: 90, y: 260 }, { x: 90, y: 400 },
  { x: 90, y: 570 }, { x: 160, y: 200 }, { x: 160, y: 500 },
];

const rungs: MapDef = {
  id: 'rungs',
  name: 'Rungs',
  width: W, height: H,
  walls: [
    ...border(),
    ...pair(250, 120, 20, 190),
    ...pair(250, 410, 20, 190),
    ...pair(370, 120, 20, 190),
    ...pair(370, 410, 20, 190),
    ...pair(490, 200, 20, 130),
    ...pair(490, 390, 20, 130),
    ...pair(600, 100, 80, 20),
    ...pair(600, 600, 80, 20),
  ],
  spawns: [redPads(RUNGS_RED), bluePads(RUNGS_RED), ffaPads(RUNGS_RED)],
  hill: { x: CX, y: CY, r: 88 },
  flagStands: [{ x: 100, y: CY }, { x: W - 100, y: CY }],
  bomb: { spawn: { x: CX, y: CY }, sites: [{ x: 150, y: CY }, { x: W - 150, y: CY }] },
  powerupPads: [{ x: CX, y: 250 }, { x: CX, y: 470 }, { x: 200, y: CY }, { x: W - 200, y: CY }],
};

// ---------------------------------------------------------------------------
// 5. BRINK — open, but the floor is missing in places. Knockback kills here.
// ---------------------------------------------------------------------------
const BRINK_RED = [
  { x: 95, y: 150 }, { x: 95, y: 290 }, { x: 95, y: 430 },
  { x: 95, y: 570 }, { x: 165, y: 220 }, { x: 165, y: 500 },
];

const brink: MapDef = {
  id: 'brink',
  name: 'Brink',
  width: W, height: H,
  walls: [
    ...border(),
    ...pair(360, 150, 22, 110),
    ...pair(360, 460, 22, 110),
    ...pair(560, 300, 22, 120),
  ],
  hazards: [
    ...pair(220, 250, 110, 220),
    box(600, 90, 80, 130),
    box(600, 500, 80, 130),
  ],
  spawns: [redPads(BRINK_RED), bluePads(BRINK_RED), ffaPads(BRINK_RED)],
  hill: { x: CX, y: CY, r: 84 },
  flagStands: [{ x: 110, y: CY }, { x: W - 110, y: CY }],
  bomb: { spawn: { x: CX, y: 360 }, sites: [{ x: 165, y: CY }, { x: W - 165, y: CY }] },
  powerupPads: [{ x: CX, y: 240 }, { x: CX, y: 480 }, { x: 450, y: CY }, { x: W - 450, y: CY }],
};

// ---------------------------------------------------------------------------
// TRAINING — the offline range. Not in rotation.
// ---------------------------------------------------------------------------
const TRAINING_RED = [
  { x: 100, y: 140 }, { x: 100, y: 270 }, { x: 100, y: 400 },
  { x: 100, y: 530 }, { x: 160, y: 200 }, { x: 160, y: 470 },
];

const training: MapDef = {
  id: 'training',
  name: 'Training Yard',
  width: W, height: H,
  walls: [
    ...border(),
    box(CX - 60, CY - 60, 120, 120),
    box(250, 120, 24, 200),
    box(390, 120, 24, 200),
    ...pair(250, 400, 24, 200).slice(1),
    box(890, 400, 24, 200),
    box(520, H - 200, 240, 24),
    box(520, H - 120, 240, 24),
    box(200, H - 220, 90, 90),
    box(W - 290, 130, 90, 90),
  ],
  spawns: [redPads(TRAINING_RED), bluePads(TRAINING_RED), ffaPads(TRAINING_RED)],
  hill: { x: 420, y: 420, r: 90 },
  flagStands: [{ x: 110, y: CY }, { x: W - 110, y: CY }],
  bomb: { spawn: { x: 420, y: H - 100 }, sites: [{ x: 160, y: CY }, { x: W - 160, y: CY }] },
  powerupPads: [{ x: CX, y: 150 }, { x: CX, y: 660 }, { x: 300, y: CY }, { x: 980, y: CY }],
};

export const MAPS: Record<string, MapDef> = {
  yard, bunker, keep, rungs, brink, training,
};

/** Maps offered in multiplayer, in menu order. Training is offline only. */
export const MAP_ROTATION = ['yard', 'bunker', 'keep', 'rungs', 'brink'] as const;

export const DEFAULT_MAP = 'yard';
export const TRAINING_MAP = 'training';

export function getMap(id: string): MapDef {
  return MAPS[id] ?? MAPS[DEFAULT_MAP];
}
