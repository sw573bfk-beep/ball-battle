/**
 * Combat tests — gun, sword, damage, death, respawn.
 * Same harness style as sim.test.ts. Run with `npm test`.
 */

import { ARENA, COMBAT, GUN, PLAYER, SWORD, TICK_DT } from '../shared/config.js';
import { addPlayer, createWorld, stepWorld } from '../shared/sim.js';
import { startMatch } from '../shared/match.js';
import { BTN, emptyInput, type InputCmd, type MapDef, type PlayerState, type WorldState } from '../shared/types.js';

let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try { fn(); passed++; }
  catch (err) { failures.push(`${name}\n    ${(err as Error).message}`); }
}
function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }
function approx(a: number, b: number, tol: number, msg: string): void {
  assert(Math.abs(a - b) <= tol, `${msg} (got ${a}, expected ~${b} +-${tol})`);
}

// ------------------------------------------------------------------ helpers
const T = ARENA.WALL_THICKNESS;

function openArena(extraWalls: MapDef['walls'] = []): MapDef {
  return {
    id: 'test', name: 'Test', width: ARENA.WIDTH, height: ARENA.HEIGHT,
    walls: [
      { x: 0, y: 0, w: ARENA.WIDTH, h: T },
      { x: 0, y: ARENA.HEIGHT - T, w: ARENA.WIDTH, h: T },
      { x: 0, y: 0, w: T, h: ARENA.HEIGHT },
      { x: ARENA.WIDTH - T, y: 0, w: T, h: ARENA.HEIGHT },
      ...extraWalls,
    ],
    spawns: [[{ x: 200, y: 360 }], [{ x: 1000, y: 360 }], [{ x: 640, y: 360 }]],
  };
}

/** Two players facing each other, spawn protection already expired. */
function duel(extraWalls: MapDef['walls'] = []): {
  world: WorldState; a: PlayerState; b: PlayerState;
} {
  const world = createWorld('training');
  world.map = openArena(extraWalls);
  const a = addPlayer(world, 'a', 'A', 0);
  const b = addPlayer(world, 'b', 'B', 1);
  startMatch(world);                         // tests care about live-match rules
  a.x = 400; a.y = 360; a.invuln = 0;
  b.x = 700; b.y = 360; b.invuln = 0;
  a.aim = 0;  // facing right, toward b
  b.aim = Math.PI;
  return { world, a, b };
}

function cmd(o: Partial<InputCmd> = {}): InputCmd {
  return { ...emptyInput(1), ...o };
}

/** Steps the world, feeding `input` to player `id` (aim is held steady). */
function step(world: WorldState, id: string, input: InputCmd, ticks = 1): void {
  const map = new Map<string, InputCmd>();
  map.set(id, input);
  for (let i = 0; i < ticks; i++) stepWorld(world, map);
}

/** Steps and returns how many events of the given type fired. */
function stepCounting(world: WorldState, id: string, input: InputCmd, ticks: number, type: string): number {
  const map = new Map<string, InputCmd>();
  map.set(id, input);
  let n = 0;
  for (let i = 0; i < ticks; i++) {
    stepWorld(world, map);
    for (const e of world.events) if (e.t === type) n++;
  }
  return n;
}

const AIM_RIGHT = { aimX: 1, aimY: 0 };

// ---------------------------------------------------------------------- gun
test('gun needs five hits to kill a full-health player', () => {
  assert(Math.ceil(PLAYER.HEALTH / GUN.DAMAGE) === 5,
    `expected 5 shots to kill, config gives ${PLAYER.HEALTH / GUN.DAMAGE}`);
  const { world, b } = duel();
  const inputs = new Map<string, InputCmd>();
  inputs.set('a', cmd({ ...AIM_RIGHT, buttons: BTN.SHOOT }));
  let hits = 0;
  for (let i = 0; i < 400 && b.alive; i++) {
    stepWorld(world, inputs);
    for (const e of world.events) if (e.t === 'hit') hits++;
    b.x = 700; b.y = 360; b.vx = 0; b.vy = 0;   // pin the target
  }
  assert(!b.alive, 'target should die');
  assert(hits === 5, `expected exactly 5 hits to kill, took ${hits}`);
});

test('fire rate is enforced', () => {
  const { world } = duel();
  const fired = stepCounting(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SHOOT }), 60, 'shoot');
  // One second of held fire at a 0.15s interval => 6-7 shots.
  assert(fired >= 6 && fired <= 8, `expected ~7 shots in one second, got ${fired}`);
});

test('magazine empties, auto-reloads, and refills', () => {
  const { world, a } = duel();
  for (let i = 0; i < 200 && a.ammo > 0; i++) {
    step(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SHOOT }));
  }
  assert(a.ammo === 0, `magazine should empty, ammo=${a.ammo}`);
  assert(a.reloadTime > 0, 'should auto-reload when the magazine runs dry');

  const ticks = Math.ceil(GUN.RELOAD_TIME / TICK_DT) + 2;
  step(world, 'a', cmd({ ...AIM_RIGHT }), ticks);
  assert(a.ammo === GUN.MAG_SIZE, `should refill to ${GUN.MAG_SIZE}, got ${a.ammo}`);
  assert(a.reloadTime === 0, 'reload should be finished');
});

test('cannot fire while reloading', () => {
  const { world, a } = duel();
  a.ammo = 4;
  step(world, 'a', cmd({ buttons: BTN.RELOAD }));
  assert(a.reloadTime > 0, 'reload started');
  const before = world.nextProjectileId;
  step(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SHOOT }), 20);
  assert(world.nextProjectileId === before, 'no bullets should spawn mid-reload');
});

test('bullets stop at walls instead of passing through', () => {
  const { world, b } = duel([{ x: 550, y: 260, w: 24, h: 200 }]);
  b.x = 700; b.y = 360;
  const hpBefore = b.health;
  step(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SHOOT }), 90);
  assert(b.health === hpBefore, `wall should block the shot, target lost ${hpBefore - b.health} hp`);
});

test('bullets expire at max range', () => {
  const world = createWorld('training');
  world.map = openArena();
  const a = addPlayer(world, 'a', 'A', 0);
  startMatch(world);
  a.x = 100; a.y = 360; a.invuln = 0; a.aim = 0;
  step(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SHOOT }));
  assert(world.projectiles.length === 1, 'one bullet in flight');
  const travelTicks = Math.ceil((GUN.RANGE / GUN.PROJECTILE_SPEED) / TICK_DT) + 2;
  step(world, 'a', cmd({ ...AIM_RIGHT }), travelTicks);
  assert(world.projectiles.length === 0, 'bullet should have expired at max range');
});

test('friendly fire is off by default', () => {
  const world = createWorld('training');
  world.map = openArena();
  const a = addPlayer(world, 'a', 'A', 0);
  const mate = addPlayer(world, 'm', 'M', 0);
  startMatch(world);
  a.x = 400; a.y = 360; a.invuln = 0; a.aim = 0;
  mate.x = 600; mate.y = 360; mate.invuln = 0;
  const hp = mate.health;
  step(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SHOOT }), 60);
  assert(mate.health === hp, `teammate took ${hp - mate.health} damage`);
  assert(COMBAT.FRIENDLY_FIRE === false, 'friendly fire config default');
});

// -------------------------------------------------------------------- sword
test('sword kills in one hit at close range', () => {
  const { world, a, b } = duel();
  b.x = a.x + PLAYER.RADIUS + 20;
  b.y = a.y;
  step(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SWORD }));
  const activeTicks = Math.ceil((SWORD.WINDUP + SWORD.ACTIVE) / TICK_DT) + 1;
  for (let i = 0; i < activeTicks; i++) {
    step(world, 'a', cmd({ ...AIM_RIGHT }));
    b.x = a.x + PLAYER.RADIUS + 20; b.y = a.y;   // hold the target in place
  }
  assert(!b.alive, 'sword must one-shot');
  assert(a.kills === 1, `killer should be credited, kills=${a.kills}`);
  assert(b.deaths === 1, `victim death should be counted, deaths=${b.deaths}`);
});

test('sword does not reach past its range', () => {
  const { world, a, b } = duel();
  const reach = SWORD.RANGE + PLAYER.RADIUS;
  b.y = a.y;
  const hp = b.health;
  const activeTicks = Math.ceil((SWORD.WINDUP + SWORD.ACTIVE) / TICK_DT) + 1;
  step(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SWORD }));
  for (let i = 0; i < activeTicks; i++) {
    step(world, 'a', cmd({ ...AIM_RIGHT }));
    a.x = 400; a.vx = 0;                         // cancel the lunge
    b.x = a.x + reach + 8; b.y = a.y;            // just outside reach
  }
  assert(b.health === hp, 'sword hit from outside its range');
});

test('sword misses targets outside the swing arc', () => {
  const { world, a, b } = duel();
  const hp = b.health;
  const activeTicks = Math.ceil((SWORD.WINDUP + SWORD.ACTIVE) / TICK_DT) + 1;
  step(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SWORD }));
  for (let i = 0; i < activeTicks; i++) {
    step(world, 'a', cmd({ ...AIM_RIGHT }));
    a.x = 400; a.y = 360; a.vx = 0; a.vy = 0;
    b.x = a.x - 30; b.y = a.y;                   // directly behind
  }
  assert(b.health === hp, 'sword hit someone behind the swing');
});

test('sword cannot cut through a wall', () => {
  const { world, a, b } = duel([{ x: 425, y: 300, w: 10, h: 120 }]);
  const hp = b.health;
  const activeTicks = Math.ceil((SWORD.WINDUP + SWORD.ACTIVE) / TICK_DT) + 1;
  step(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SWORD }));
  for (let i = 0; i < activeTicks; i++) {
    step(world, 'a', cmd({ ...AIM_RIGHT }));
    a.x = 400; a.y = 360; a.vx = 0; a.vy = 0;
    b.x = 450; b.y = 360;                        // other side of the wall
  }
  assert(b.health === hp, 'sword reached through a wall');
});

test('sword respects its cooldown', () => {
  const { world, a } = duel();
  step(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SWORD }));
  approx(a.swordCd, SWORD.COOLDOWN - TICK_DT, TICK_DT * 2, 'cooldown set');
  let swings = 0;
  for (let i = 0; i < Math.floor(SWORD.COOLDOWN / TICK_DT) - 3; i++) {
    const wasIdle = a.swordTime === 0;
    step(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SWORD }));
    if (wasIdle && a.swordTime > 0) swings++;
  }
  assert(swings === 0, `sword re-swung ${swings} times during cooldown`);
});

test('sword one swing kills at most one target', () => {
  const { world, a } = duel();
  const c = addPlayer(world, 'c', 'C', 1);
  const d = addPlayer(world, 'd', 'D', 1);
  c.invuln = 0; d.invuln = 0;
  const activeTicks = Math.ceil((SWORD.WINDUP + SWORD.ACTIVE) / TICK_DT) + 1;
  step(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SWORD }));
  for (let i = 0; i < activeTicks; i++) {
    step(world, 'a', cmd({ ...AIM_RIGHT }));
    a.x = 400; a.y = 360; a.vx = 0; a.vy = 0;
    c.x = 430; c.y = 355; d.x = 435; d.y = 365;
  }
  const dead = [c, d].filter((p) => !p.alive).length;
  assert(dead === 1, `one swing should kill exactly one target, killed ${dead}`);
});

// --------------------------------------------------- death, respawn, safety
test('dead players cannot shoot or swing', () => {
  const { world, a } = duel();
  a.alive = false;
  a.health = 0;
  const before = world.nextProjectileId;
  step(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SHOOT | BTN.SWORD }), 30);
  assert(world.nextProjectileId === before, 'a dead player fired a weapon');
  assert(a.swordTime === 0, 'a dead player swung a sword');
});

test('spawn protection blocks damage and attacking', () => {
  const { world, a, b } = duel();
  b.invuln = COMBAT.SPAWN_PROTECT;
  const hp = b.health;
  step(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SHOOT }), 40);
  assert(b.health === hp, 'protected player took damage');

  a.invuln = COMBAT.SPAWN_PROTECT;
  const before = world.nextProjectileId;
  step(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SHOOT }), 10);
  assert(world.nextProjectileId === before, 'protected player was able to shoot');
});

test('players respawn with full health and protection', () => {
  const { world, b } = duel();
  b.health = 1;
  b.alive = false;
  b.respawnIn = COMBAT.RESPAWN_TIME;
  step(world, 'a', cmd(), Math.ceil(COMBAT.RESPAWN_TIME / TICK_DT) + 2);
  assert(b.alive, 'should be back');
  assert(b.health === PLAYER.HEALTH, `full health on respawn, got ${b.health}`);
  assert(b.invuln > 0, 'spawn protection granted');
  assert(b.ammo === GUN.MAG_SIZE, 'magazine refilled on respawn');
});

test('players do not overlap each other', () => {
  const { world, a, b } = duel();
  b.x = a.x + 10;                          // deliberately overlapping
  b.y = a.y;
  step(world, 'a', cmd(), 30);
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  assert(d >= PLAYER.RADIUS * 2 - 0.5, `players still overlapping, distance ${d.toFixed(2)}`);
});

test('combat simulation is deterministic', () => {
  function run(): string {
    const { world, a } = duel();
    let seed = 777;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 600; i++) {
      let buttons = 0;
      if (rand() < 0.3) buttons |= BTN.SHOOT;
      if (rand() < 0.05) buttons |= BTN.SWORD;
      if (rand() < 0.05) buttons |= BTN.DASH;
      step(world, 'a', cmd({
        moveX: Math.round(rand() * 2) - 1,
        moveY: Math.round(rand() * 2) - 1,
        aimX: Math.cos(i * 0.1), aimY: Math.sin(i * 0.1),
        buttons,
      }));
    }
    const b = world.players.get('b')!;
    return [a.x, a.y, a.health, a.kills, b.x, b.y, b.health, b.deaths, world.projectiles.length]
      .map((n) => n.toFixed(6)).join('|');
  }
  const r1 = run();
  const r2 = run();
  assert(r1 === r2, `combat diverged:\n    ${r1}\n    ${r2}`);
});

test('dummies never move and never shoot', () => {
  const world = createWorld('training');
  world.map = openArena();
  const dummy = addPlayer(world, 'd', 'Dummy', 1, true);
  startMatch(world);
  dummy.x = 800; dummy.y = 360; dummy.invuln = 0;
  const before = world.nextProjectileId;
  step(world, 'd', cmd({ moveX: 1, buttons: BTN.SHOOT | BTN.DASH | BTN.SWORD }), 60);
  assert(dummy.x === 800 && dummy.y === 360, `dummy moved to ${dummy.x},${dummy.y}`);
  assert(world.nextProjectileId === before, 'dummy fired a weapon');
});


// ------------------------------------------------------- simultaneous kills
test('simultaneous lethal hits kill both players (a real trade)', () => {
  const { world, a, b } = duel();
  a.x = 400; b.x = 700;
  a.health = GUN.DAMAGE;                    // both one shot from death
  b.health = GUN.DAMAGE;
  a.aim = 0; b.aim = Math.PI;

  const inputs = new Map<string, InputCmd>();
  inputs.set('a', cmd({ aimX: 1, aimY: 0, buttons: BTN.SHOOT }));
  inputs.set('b', cmd({ aimX: -1, aimY: 0, buttons: BTN.SHOOT }));

  for (let i = 0; i < 60 && (a.alive || b.alive); i++) {
    stepWorld(world, inputs);
    // Hold both in place so the bullets meet in the middle and land together.
    a.x = 400; a.y = 360; a.vx = 0; a.vy = 0;
    b.x = 700; b.y = 360; b.vx = 0; b.vy = 0;
  }

  assert(!a.alive && !b.alive, `both should die: a.alive=${a.alive} b.alive=${b.alive}`);
  assert(a.kills === 1 && b.kills === 1, `both should be credited: ${a.kills}/${b.kills}`);
  assert(world.scores[0] === 1 && world.scores[1] === 1,
    `both teams should score: ${world.scores[0]}-${world.scores[1]}`);
});

test('simultaneous sword swings kill both players', () => {
  const { world, a, b } = duel();
  a.x = 400; a.y = 360; a.aim = 0;
  b.x = 440; b.y = 360; b.aim = Math.PI;

  const inputs = new Map<string, InputCmd>();
  inputs.set('a', cmd({ aimX: 1, aimY: 0, buttons: BTN.SWORD }));
  inputs.set('b', cmd({ aimX: -1, aimY: 0, buttons: BTN.SWORD }));

  const ticks = Math.ceil((SWORD.WINDUP + SWORD.ACTIVE) / TICK_DT) + 2;
  for (let i = 0; i < ticks; i++) {
    stepWorld(world, inputs);
    a.x = 400; a.y = 360; a.vx = 0; a.vy = 0;
    b.x = 440; b.y = 360; b.vx = 0; b.vy = 0;
  }
  assert(!a.alive && !b.alive, `sword trade should kill both: a=${a.alive} b=${b.alive}`);
});

test('team score increments on each kill', () => {
  const { world, a, b } = duel();
  assert(world.scores[0] === 0 && world.scores[1] === 0, 'scores start at zero');
  b.health = 1;
  const ticks = Math.ceil((SWORD.WINDUP + SWORD.ACTIVE) / TICK_DT) + 1;
  b.x = a.x + PLAYER.RADIUS + 18; b.y = a.y;
  step(world, 'a', cmd({ ...AIM_RIGHT, buttons: BTN.SWORD }));
  for (let i = 0; i < ticks; i++) {
    step(world, 'a', cmd({ ...AIM_RIGHT }));
    b.x = a.x + PLAYER.RADIUS + 18; b.y = a.y;
  }
  assert(world.scores[0] === 1, `red should have 1 point, has ${world.scores[0]}`);
  assert(world.scores[1] === 0, `blue should have 0, has ${world.scores[1]}`);
});

test('killing yourself does not award a point', () => {
  const { world, a } = duel();
  a.health = 5;
  // Simulate self-damage by queueing a hit with the victim as attacker.
  a.health = 0;
  a.alive = true;
  step(world, 'a', cmd(), 1);
  assert(world.scores[0] === 0, 'no self-kill points');
});

// -------------------------------------------------------------------- report
if (failures.length) {
  console.error(`\n  ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
} else {
  console.log(`\n  ✓ all ${passed} combat tests passed\n`);
}
