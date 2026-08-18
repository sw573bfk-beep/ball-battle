/**
 * Simulation tests. No DOM, no browser — this is the code the server will run,
 * so it gets the strictest testing in the project.
 *
 *   npm test
 */

import { DASH, PLAYER, TICK_DT, WALL, ARENA } from '../shared/config.js';
import { circleVsRect } from '../shared/math.js';
import { createWorld, stepPlayer } from '../shared/sim.js';
import { BTN, createPlayer, emptyInput, type InputCmd, type MapDef, type PlayerState } from '../shared/types.js';
import { DEFAULT_MAP, getMap } from '../shared/maps.js';

// --------------------------------------------------------------- test harness
let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
  } catch (err) {
    failures.push(`${name}\n    ${(err as Error).message}`);
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function approx(a: number, b: number, tol: number, msg: string): void {
  assert(Math.abs(a - b) <= tol, `${msg} (got ${a}, expected ~${b} +-${tol})`);
}

// ------------------------------------------------------------------- helpers
const map = getMap('training');

const T = ARENA.WALL_THICKNESS;
/** Borders only — used for movement/dash tests so nothing else can interfere. */
const openMap: MapDef = {
  id: 'open',
  name: 'Open',
  width: ARENA.WIDTH,
  height: ARENA.HEIGHT,
  walls: [
    { x: 0, y: 0, w: ARENA.WIDTH, h: T },
    { x: 0, y: ARENA.HEIGHT - T, w: ARENA.WIDTH, h: T },
    { x: 0, y: 0, w: T, h: ARENA.HEIGHT },
    { x: ARENA.WIDTH - T, y: 0, w: T, h: ARENA.HEIGHT },
  ],
  spawns: [[], [], [{ x: 640, y: 360 }]],
};

function spawnPlayer(x = 640, y = 360): PlayerState {
  return createPlayer('t', 'Test', 0, x, y);
}

/** Rides left until the player is pinned against the left border wall. */
function rideIntoLeftWall(p: PlayerState, m: MapDef = openMap, maxTicks = 400): void {
  for (let i = 0; i < maxTicks; i++) {
    stepPlayer(p, input({ moveX: -1 }), m, TICK_DT);
    if (p.onWall && Math.abs(p.vx) < 30) return;
  }
  throw new Error('never reached the left wall');
}

function input(opts: Partial<InputCmd> = {}): InputCmd {
  return { ...emptyInput(1), ...opts };
}

function run(p: PlayerState, cmd: InputCmd | undefined, ticks: number, m: MapDef = openMap): void {
  for (let i = 0; i < ticks; i++) stepPlayer(p, cmd, m, TICK_DT);
}

function overlapsAnyWall(p: PlayerState, tolerance = 0.01, m: MapDef = map): boolean {
  for (const w of m.walls) {
    const hit = circleVsRect(p.x, p.y, PLAYER.RADIUS, w);
    if (hit.hit && hit.depth > tolerance) return true;
  }
  return false;
}

function snapshot(p: PlayerState): string {
  return [p.x, p.y, p.vx, p.vy, p.dashCd, p.dashTime, p.onWall ? 1 : 0]
    .map((n) => (typeof n === 'number' ? n.toFixed(6) : n)).join('|');
}

// ------------------------------------------------------------------- movement
test('accelerates from rest and respects max speed', () => {
  const p = spawnPlayer(200, 360);
  run(p, input({ moveX: 1 }), 120);
  approx(Math.hypot(p.vx, p.vy), PLAYER.MAX_SPEED, 1.0, 'top speed');
  assert(p.vx > 0, 'moving right');
});

test('comes to a complete stop when input is released', () => {
  const p = spawnPlayer(200, 360);
  run(p, input({ moveX: 1 }), 60);
  run(p, input(), 120);
  assert(p.vx === 0 && p.vy === 0, `expected full stop, got ${p.vx},${p.vy}`);
});

test('diagonal input is normalised (no faster diagonals)', () => {
  const a = spawnPlayer(200, 200);
  const b = spawnPlayer(200, 200);
  run(a, input({ moveX: 1 }), 90);
  run(b, input({ moveX: 1, moveY: 1 }), 90);
  approx(Math.hypot(b.vx, b.vy), Math.hypot(a.vx, a.vy), 1.0, 'diagonal speed');
});

test('rapid direction reversal never produces NaN or runaway values', () => {
  const p = spawnPlayer();
  for (let i = 0; i < 900; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    stepPlayer(p, input({ moveX: dir, moveY: -dir }), openMap, TICK_DT);
    assert(Number.isFinite(p.x) && Number.isFinite(p.y), `non-finite position at tick ${i}`);
    assert(Number.isFinite(p.vx) && Number.isFinite(p.vy), `non-finite velocity at tick ${i}`);
  }
  assert(Math.hypot(p.vx, p.vy) <= PLAYER.MAX_SPEED + 1, 'speed stayed bounded');
});

// ----------------------------------------------------------------------- dash
test('dash launches at dash speed', () => {
  const p = spawnPlayer();
  stepPlayer(p, input({ moveX: 1, buttons: BTN.DASH }), openMap, TICK_DT);
  assert(p.dashTime > 0, 'dash started');
  approx(Math.hypot(p.vx, p.vy), DASH.SPEED, 1.0, 'dash speed');
});

test('dash respects its cooldown', () => {
  const p = spawnPlayer(200, 360);
  stepPlayer(p, input({ moveX: 1, buttons: BTN.DASH }), openMap, TICK_DT);
  const firstCd = p.dashCd;
  approx(firstCd, DASH.COOLDOWN - TICK_DT, TICK_DT + 1e-6, 'cooldown set');
  // Hold dash for 30 ticks (0.5s) — must not re-trigger.
  for (let i = 0; i < 30; i++) {
    stepPlayer(p, input({ moveX: 1, buttons: BTN.DASH }), openMap, TICK_DT);
    assert(p.dashCd < firstCd, 'cooldown must keep counting down, not reset');
  }
});

test('dash momentum bleeds back to normal speed, not to zero', () => {
  const p = spawnPlayer(200, 360);
  stepPlayer(p, input({ moveX: 1, buttons: BTN.DASH }), openMap, TICK_DT);
  run(p, input({ moveX: 1 }), 90);
  const s = Math.hypot(p.vx, p.vy);
  assert(s <= PLAYER.MAX_SPEED + 12, `should settle near max speed, got ${s}`);
  assert(s > PLAYER.MAX_SPEED * 0.9, `should not stall out, got ${s}`);
});

test('holding the dash direction cannot accelerate past the speed cap', () => {
  // Regression: input used to keep adding acceleration while overspeed, which
  // let a held direction ramp the player up indefinitely after a dash.
  const p = spawnPlayer(200, 360);
  stepPlayer(p, input({ moveX: 1, buttons: BTN.DASH }), openMap, TICK_DT);
  let peak = 0;
  let prev = Math.hypot(p.vx, p.vy);
  let settled = false;
  for (let i = 0; i < 120 && !p.onWall; i++) {
    stepPlayer(p, input({ moveX: 1 }), openMap, TICK_DT);
    const s = Math.hypot(p.vx, p.vy);
    peak = Math.max(peak, s);
    assert(s <= prev + 1e-6, `speed increased while overspeed at tick ${i}: ${prev} -> ${s}`);
    prev = s;
    if (s <= PLAYER.MAX_SPEED + 12) { settled = true; break; }
  }
  assert(peak <= DASH.SPEED + 1, `never exceeds dash speed, peaked at ${peak}`);
  assert(settled, `should decay back toward the speed cap, ended at ${prev}`);
});

test('momentum can be steered while overspeed but not amplified', () => {
  const p = spawnPlayer(640, 200);
  stepPlayer(p, input({ moveX: 1, buttons: BTN.DASH }), openMap, TICK_DT);
  const startSpeed = Math.hypot(p.vx, p.vy);
  for (let i = 0; i < 12; i++) stepPlayer(p, input({ moveY: 1 }), openMap, TICK_DT);
  assert(p.vy > 60, `should be able to curve the dash, vy=${p.vy}`);
  assert(Math.hypot(p.vx, p.vy) < startSpeed, 'steering must not add speed');
});

test('dash press is buffered rather than dropped', () => {
  const p = spawnPlayer(200, 360);
  stepPlayer(p, input({ moveX: 1, buttons: BTN.DASH }), openMap, TICK_DT);
  // Press again while on cooldown, just before it expires.
  const ticksUntilNearReady = Math.floor((DASH.COOLDOWN - DASH.BUFFER * 0.5) / TICK_DT);
  run(p, input({ moveX: 0 }), ticksUntilNearReady - 1);
  stepPlayer(p, input({ moveX: 0, buttons: BTN.DASH }), openMap, TICK_DT); // buffered press
  run(p, input({ moveX: 0 }), 6);
  assert(p.dashTime > 0, 'buffered dash should fire as soon as the cooldown ends');
});

// ----------------------------------------------------------------------- walls
test('player never ends a tick embedded in a wall (fuzz, 20k ticks)', () => {
  const p = spawnPlayer(200, 200);
  let seed = 12345;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

  for (let i = 0; i < 20000; i++) {
    const cmd = input({
      moveX: Math.round(rand() * 2) - 1,
      moveY: Math.round(rand() * 2) - 1,
      buttons: rand() < 0.06 ? BTN.DASH : 0,
    });
    stepPlayer(p, cmd, map, TICK_DT);
    assert(!overlapsAnyWall(p, 0.01, map), `embedded in wall at tick ${i} (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
    assert(
      p.x > 0 && p.x < ARENA.WIDTH && p.y > 0 && p.y < ARENA.HEIGHT,
      `escaped the arena at tick ${i} (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`,
    );
  }
});

test('extreme injected velocity cannot tunnel through a thin wall', () => {
  for (const speed of [2000, 6000, 20000, 60000]) {
    const p = spawnPlayer(300, 220);   // just left of the wall-dash lane at x=340
    p.vx = speed;
    stepPlayer(p, input(), map, TICK_DT);
    assert(!overlapsAnyWall(p, 0.01, map), `tunnelled/embedded at ${speed} px/s`);
    assert(p.x < 340 + 24 + PLAYER.RADIUS, `passed through the wall at ${speed} px/s (x=${p.x})`);
  }
});

test('wall slide preserves motion along the wall', () => {
  // Push down-left into the left border wall.
  const p = spawnPlayer(ARENA.WALL_THICKNESS + PLAYER.RADIUS + 1, 120);
  run(p, input({ moveX: -1, moveY: 1 }), 40);
  assert(p.onWall, 'should be touching the wall');
  assert(p.vy > 150, `should still be sliding down the wall, vy=${p.vy}`);
  assert(Math.abs(p.vx) < 60, `should not be pushing through the wall, vx=${p.vx}`);
});

test('touching a wall refreshes the dash cooldown to the wall value', () => {
  const p = spawnPlayer(640, 360);
  stepPlayer(p, input({ moveX: -1, buttons: BTN.DASH }), openMap, TICK_DT);
  assert(p.dashCd > WALL.DASH_REFUND_TO, 'starts on full cooldown');
  rideIntoLeftWall(p);
  assert(p.onWall, 'should have reached the wall');
  assert(p.dashCd <= WALL.DASH_REFUND_TO + 1e-6, `dash should be refunded, got ${p.dashCd}`);
});

test('wall dash kicks away from the wall', () => {
  const p = spawnPlayer(640, 360);
  rideIntoLeftWall(p);
  run(p, input({ moveX: -1 }), 20);            // let the refunded cooldown expire
  stepPlayer(p, input({ moveX: -1, moveY: 1, buttons: BTN.DASH }), openMap, TICK_DT);
  assert(p.vx > 200, `wall dash must push away from the wall, vx=${p.vx}`);
  assert(p.vy > 200, `wall dash should honour the held direction, vy=${p.vy}`);
  approx(Math.hypot(p.vx, p.vy), WALL.DASH_SPEED, WALL.DASH_SPEED * 0.05, 'wall dash speed');
});

test('dashing into a wall bounces instead of dead-stopping', () => {
  // Start close enough that the dash burst is still active on impact.
  const p = spawnPlayer(ARENA.WALL_THICKNESS + PLAYER.RADIUS + 60, 360);
  stepPlayer(p, input({ moveX: -1, buttons: BTN.DASH }), openMap, TICK_DT);
  let bounced = false;
  for (let i = 0; i < 40; i++) {
    stepPlayer(p, input(), openMap, TICK_DT);
    if (p.vx > 400) { bounced = true; break; }
  }
  assert(bounced, 'expected a strong rebound off the wall while dashing');
});

test('player cannot get stuck in the tight corridor', () => {
  // Corridor between y = H-200+24 and y = H-120 at x in [520, 760].
  const p = spawnPlayer(560, ARENA.HEIGHT - 160);
  let seed = 999;
  const rand = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
  let moved = 0;
  const startX = p.x;
  for (let i = 0; i < 4000; i++) {
    stepPlayer(p, input({
      moveX: Math.round(rand() * 2) - 1,
      moveY: Math.round(rand() * 2) - 1,
      buttons: rand() < 0.08 ? BTN.DASH : 0,
    }), map, TICK_DT);
    assert(!overlapsAnyWall(p, 0.01, map), `stuck inside corridor wall at tick ${i}`);
    moved = Math.max(moved, Math.abs(p.x - startX));
  }
  assert(moved > 100, `player should be able to travel the corridor, moved ${moved}`);
});

// -------------------------------------------------------------- determinism
test('simulation is deterministic for identical inputs', () => {
  const cmds: InputCmd[] = [];
  let seed = 4242;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 1200; i++) {
    cmds.push(input({
      moveX: Math.round(rand() * 2) - 1,
      moveY: Math.round(rand() * 2) - 1,
      buttons: rand() < 0.07 ? BTN.DASH : 0,
    }));
  }
  const a = spawnPlayer(250, 250);
  const b = spawnPlayer(250, 250);
  for (const c of cmds) stepPlayer(a, c, map, TICK_DT);
  for (const c of cmds) stepPlayer(b, c, map, TICK_DT);
  assert(snapshot(a) === snapshot(b), `divergence:\n    ${snapshot(a)}\n    ${snapshot(b)}`);
});

test('world creation wires up the map and player registry', () => {
  const w = createWorld('training');
  assert(w.map.id === 'training', 'map loaded');
  assert(w.players.size === 0, 'starts empty');
  assert(w.map.spawns.length === 3, 'three spawn groups');
  assert(getMap('does-not-exist').id === DEFAULT_MAP, 'unknown map falls back to the default');
});

test('dead players do not move', () => {
  const p = spawnPlayer();
  p.alive = false;
  run(p, input({ moveX: 1, buttons: BTN.DASH }), 60, openMap);
  assert(p.vx === 0 && p.vy === 0, 'dead player is stationary');
  assert(p.x === 640 && p.y === 360, 'dead player did not drift');
});

// -------------------------------------------------------------------- report
if (failures.length) {
  console.error(`\n  ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
} else {
  console.log(`\n  ✓ all ${passed} simulation tests passed\n`);
}
