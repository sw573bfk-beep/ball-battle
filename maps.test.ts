/**
 * Map validation. Runs over every arena and checks the things that are easy to
 * get wrong by hand and painful to discover in a match:
 *
 *   - nothing sits outside the arena
 *   - no spawn pad or objective is inside a wall, a hazard, or too tight to fit
 *   - every spawn and objective is actually reachable from every other one
 *   - teams never spawn near each other
 *   - the rotation maps are left/right mirror symmetric
 *
 * A real bug this catches: spawn pads placed flush against a wall, which made
 * "hold right" pin the player in place.
 */

import { ARENA, MODE_RULES, PLAYER } from '../shared/config.js';
import { circleVsRect, type Rect } from '../shared/math.js';
import { MAPS, MAP_ROTATION } from '../shared/maps.js';
import type { MapDef } from '../shared/types.js';

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void): void {
  try { fn(); passed++; }
  catch (err) { failures.push(`${name}\n    ${(err as Error).message}`); }
}
function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }

const R = PLAYER.RADIUS;
/** A spawn pad needs room to stand and take a first step. */
const SPAWN_CLEARANCE = R + 10;
const GRID = 8;

function blocked(map: MapDef, x: number, y: number, radius: number = R): boolean {
  for (const w of map.walls) if (circleVsRect(x, y, radius, w).hit) return true;
  return false;
}

function inHazard(map: MapDef, x: number, y: number): boolean {
  for (const h of map.hazards ?? []) {
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return true;
  }
  return false;
}

function inside(map: MapDef, r: Rect): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= map.width && r.y + r.h <= map.height;
}

/** Flood fill of standable cells, so we can prove the arena is one space. */
function reachableFrom(map: MapDef, sx: number, sy: number): Set<number> {
  const cols = Math.ceil(map.width / GRID);
  const rows = Math.ceil(map.height / GRID);
  const key = (cx: number, cy: number): number => cy * cols + cx;
  const open = (cx: number, cy: number): boolean =>
    cx >= 0 && cy >= 0 && cx < cols && cy < rows &&
    !blocked(map, cx * GRID + GRID / 2, cy * GRID + GRID / 2);

  const startX = Math.floor(sx / GRID);
  const startY = Math.floor(sy / GRID);
  const seen = new Set<number>();
  if (!open(startX, startY)) return seen;

  const stack: [number, number][] = [[startX, startY]];
  seen.add(key(startX, startY));
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    const around: [number, number][] = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
    for (const [nx, ny] of around) {
      const k = key(nx, ny);
      if (seen.has(k) || !open(nx, ny)) continue;
      seen.add(k);
      stack.push([nx, ny]);
    }
  }
  return seen;
}

function cellOf(map: MapDef, x: number, y: number): number {
  const cols = Math.ceil(map.width / GRID);
  return Math.floor(y / GRID) * cols + Math.floor(x / GRID);
}

/** Every point a player must be able to stand on or walk to. */
function keyPoints(map: MapDef): { label: string; x: number; y: number }[] {
  const pts: { label: string; x: number; y: number }[] = [];
  map.spawns.forEach((group, team) => {
    group.forEach((s, i) => pts.push({ label: `spawn team${team}#${i}`, x: s.x, y: s.y }));
  });
  if (map.hill) pts.push({ label: 'hill', x: map.hill.x, y: map.hill.y });
  map.flagStands?.forEach((f, i) => pts.push({ label: `flagStand#${i}`, x: f.x, y: f.y }));
  if (map.bomb) {
    pts.push({ label: 'bombSpawn', x: map.bomb.spawn.x, y: map.bomb.spawn.y });
    map.bomb.sites.forEach((s, i) => pts.push({ label: `bombSite#${i}`, x: s.x, y: s.y }));
  }
  map.powerupPads?.forEach((p, i) => pts.push({ label: `powerupPad#${i}`, x: p.x, y: p.y }));
  return pts;
}

const allMaps = Object.values(MAPS);

// ------------------------------------------------------------------- per map
for (const map of allMaps) {
  test(`[${map.id}] geometry stays inside the arena`, () => {
    assert(map.width === ARENA.WIDTH && map.height === ARENA.HEIGHT,
      `size ${map.width}x${map.height} does not match the arena`);
    for (const w of map.walls) assert(inside(map, w), `wall out of bounds: ${JSON.stringify(w)}`);
    for (const h of map.hazards ?? []) assert(inside(map, h), `hazard out of bounds: ${JSON.stringify(h)}`);
  });

  test(`[${map.id}] the arena is fully enclosed`, () => {
    // Sample the perimeter just inside the edge; every point must be solid.
    for (let x = 4; x < map.width; x += 16) {
      assert(blocked(map, x, 4, 2), `gap in the top wall at x=${x}`);
      assert(blocked(map, x, map.height - 4, 2), `gap in the bottom wall at x=${x}`);
    }
    for (let y = 4; y < map.height; y += 16) {
      assert(blocked(map, 4, y, 2), `gap in the left wall at y=${y}`);
      assert(blocked(map, map.width - 4, y, 2), `gap in the right wall at y=${y}`);
    }
  });

  test(`[${map.id}] every team has enough spawn pads`, () => {
    assert(map.spawns.length === 3, `expected 3 spawn groups, got ${map.spawns.length}`);
    assert(map.spawns[0].length >= 6, `red has only ${map.spawns[0].length} pads (need 6 for 6v6)`);
    assert(map.spawns[1].length >= 6, `blue has only ${map.spawns[1].length} pads (need 6 for 6v6)`);
    assert(map.spawns[2].length >= 8, `free-for-all pool has only ${map.spawns[2].length} pads`);
  });

  test(`[${map.id}] no spawn pad is jammed against geometry`, () => {
    for (const { label, x, y } of keyPoints(map)) {
      assert(!blocked(map, x, y, SPAWN_CLEARANCE),
        `${label} at (${x},${y}) has less than ${SPAWN_CLEARANCE}px of clearance`);
      assert(!inHazard(map, x, y), `${label} at (${x},${y}) is inside a hazard`);
    }
  });

  test(`[${map.id}] every spawn and objective is reachable from every other`, () => {
    const pts = keyPoints(map);
    const region = reachableFrom(map, pts[0].x, pts[0].y);
    assert(region.size > 0, `could not stand on ${pts[0].label}`);
    for (const pt of pts) {
      assert(region.has(cellOf(map, pt.x, pt.y)),
        `${pt.label} at (${pt.x},${pt.y}) is walled off from ${pts[0].label}`);
    }
  });

  test(`[${map.id}] teams do not spawn next to each other`, () => {
    let closest = Infinity;
    for (const r of map.spawns[0]) {
      for (const b of map.spawns[1]) {
        closest = Math.min(closest, Math.hypot(r.x - b.x, r.y - b.y));
      }
    }
    assert(closest > 500, `closest enemy spawns are only ${closest.toFixed(0)}px apart`);
  });

  test(`[${map.id}] supports every objective mode`, () => {
    const needs = new Set(Object.values(MODE_RULES).map((r) => r.objective));
    if (needs.has('hill')) assert(!!map.hill, 'missing a hill for king of the hill');
    if (needs.has('flags')) assert(map.flagStands?.length === 2, 'needs exactly two flag stands');
    if (needs.has('bomb')) assert(map.bomb?.sites.length === 2, 'needs exactly two bomb sites');
  });

  test(`[${map.id}] has powerup pads`, () => {
    assert((map.powerupPads?.length ?? 0) >= 4,
      `only ${map.powerupPads?.length ?? 0} powerup pads (want at least 4)`);
  });

  test(`[${map.id}] the hill is open ground, not a wall`, () => {
    if (!map.hill) return;
    // Sample the zone: most of it must be standable, or holding it is silly.
    let open = 0, total = 0;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      for (let rr = 0; rr <= map.hill.r; rr += 16) {
        const x = map.hill.x + Math.cos(a) * rr;
        const y = map.hill.y + Math.sin(a) * rr;
        total++;
        if (!blocked(map, x, y) && !inHazard(map, x, y)) open++;
      }
    }
    assert(open / total > 0.6, `only ${((open / total) * 100).toFixed(0)}% of the hill is standable`);
  });
}

// --------------------------------------------------------------- rotation
test('the rotation has five arenas and they all exist', () => {
  assert(MAP_ROTATION.length === 5, `expected 5 maps in rotation, got ${MAP_ROTATION.length}`);
  for (const id of MAP_ROTATION) assert(!!MAPS[id], `rotation references a missing map: ${id}`);
});

test('rotation maps are left/right mirror symmetric', () => {
  for (const id of MAP_ROTATION) {
    const map = MAPS[id];
    const sig = (r: Rect): string => `${r.x},${r.y},${r.w},${r.h}`;
    const set = new Set(map.walls.map(sig));
    for (const w of map.walls) {
      const mirrored = { x: map.width - w.x - w.w, y: w.y, w: w.w, h: w.h };
      assert(set.has(sig(mirrored)),
        `[${id}] wall ${sig(w)} has no mirror (expected ${sig(mirrored)})`);
    }
    // Powerup pads mirror, so neither team gets a closer route to a pickup.
    const padSig = (p: { x: number; y: number }): string => `${p.x},${p.y}`;
    const pads = new Set((map.powerupPads ?? []).map(padSig));
    for (const pad of map.powerupPads ?? []) {
      assert(pads.has(padSig({ x: map.width - pad.x, y: pad.y })),
        `[${id}] powerup pad ${padSig(pad)} has no mirror`);
    }

    // Spawns mirror too.
    const spawnSig = (p: { x: number; y: number }): string => `${p.x},${p.y}`;
    const blue = new Set(map.spawns[1].map(spawnSig));
    for (const r of map.spawns[0]) {
      assert(blue.has(spawnSig({ x: map.width - r.x, y: r.y })),
        `[${id}] red pad ${spawnSig(r)} has no matching blue pad`);
    }
  }
});

test('every rotation map offers wall-dash geometry', () => {
  for (const id of MAP_ROTATION) {
    const map = MAPS[id];
    // Interior walls only — the border does not count as skill expression.
    const interior = map.walls.filter(
      (w) => w.x > 0 && w.y > 0 && w.x + w.w < map.width && w.y + w.h < map.height,
    );
    assert(interior.length >= 4, `[${id}] only ${interior.length} interior walls to play off`);
  }
});

if (failures.length) {
  console.error(`\n  ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
} else {
  console.log(`\n  ✓ all ${passed} map checks passed\n`);
}
