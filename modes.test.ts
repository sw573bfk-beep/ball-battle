/**
 * Objective mode tests: king of the hill, capture the flag, bomb run.
 */

import { MODE_RULES, OBJECTIVE, PLAYER, TICK_DT } from '../shared/config.js';
import { addPlayer, createWorld, stepWorld } from '../shared/sim.js';
import { startMatch } from '../shared/match.js';
import { kill } from '../shared/combat.js';
import type { InputCmd, ModeIdish, WorldState } from './modes.types.js';

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void): void {
  try { fn(); passed++; }
  catch (err) { failures.push(`${name}\n    ${(err as Error).message}`); }
}
function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }
/** Reads a status without letting TypeScript narrow it from an earlier write. */
const statusOf = (o: { status: string }): string => o.status;

const NO_INPUT = new Map<string, InputCmd>();
function advance(world: WorldState, seconds: number): void {
  const ticks = Math.ceil(seconds / TICK_DT);
  for (let i = 0; i < ticks; i++) stepWorld(world, NO_INPUT);
}

function match(mode: ModeIdish, players = 2): WorldState {
  const world = createWorld('training', mode);
  for (let i = 0; i < players; i++) addPlayer(world, `p${i}`, `P${i}`, (i % 2) as 0 | 1);
  startMatch(world);
  for (const p of world.players.values()) p.invuln = 0;
  return world;
}

// ------------------------------------------------------- king of the hill
test('holding the hill scores points over time', () => {
  const world = match('koth');
  const hill = world.map.hill!;
  const red = world.players.get('p0')!;
  const blue = world.players.get('p1')!;
  blue.x = 100; blue.y = 650;                     // far away

  for (let i = 0; i < Math.ceil(3 / TICK_DT); i++) {
    red.x = hill.x; red.y = hill.y; red.vx = 0; red.vy = 0;
    blue.x = 100; blue.y = 650; blue.vx = 0; blue.vy = 0;
    stepWorld(world, NO_INPUT);
  }
  const expected = 3 * OBJECTIVE.HILL_POINTS_PER_SEC;
  assert(Math.abs(world.scores[0] - expected) <= 2,
    `expected about ${expected} points, got ${world.scores[0]}`);
  assert(world.scores[1] === 0, `blue should have none, got ${world.scores[1]}`);
  assert(world.objective.hillOwner === 0, `red should own the hill, got ${world.objective.hillOwner}`);
});

test('a contested hill scores for nobody', () => {
  const world = match('koth');
  const hill = world.map.hill!;
  const red = world.players.get('p0')!;
  const blue = world.players.get('p1')!;
  for (let i = 0; i < Math.ceil(2 / TICK_DT); i++) {
    red.x = hill.x - 20; red.y = hill.y; red.vx = 0; red.vy = 0;
    blue.x = hill.x + 20; blue.y = hill.y; blue.vx = 0; blue.vy = 0;
    stepWorld(world, NO_INPUT);
  }
  assert(world.objective.hillContested, 'hill should read as contested');
  assert(world.scores[0] === 0 && world.scores[1] === 0,
    `nobody should score while contested: ${world.scores}`);
});

test('standing outside the hill does not score', () => {
  const world = match('koth');
  const hill = world.map.hill!;
  const red = world.players.get('p0')!;
  for (let i = 0; i < Math.ceil(2 / TICK_DT); i++) {
    // Well clear of the zone, and clear of the centre pillar.
    red.x = hill.x + hill.r + PLAYER.RADIUS + 40; red.y = hill.y;
    red.vx = 0; red.vy = 0;
    stepWorld(world, NO_INPUT);
  }
  assert(world.scores[0] === 0, `should not score from outside, got ${world.scores[0]}`);
});

test('king of the hill ends at the point target', () => {
  const world = match('koth');
  world.scores[0] = MODE_RULES.koth.scoreTarget;
  advance(world, 0.1);
  assert(world.match.phase === 'results', `expected results, got ${world.match.phase}`);
  assert(world.match.winnerTeam === 0, `red should win, got ${world.match.winnerTeam}`);
});

// -------------------------------------------------------- capture the flag
test('flags start at home for both teams', () => {
  const world = match('ctf');
  assert(world.objective.flags.length === 2, `expected 2 flags, got ${world.objective.flags.length}`);
  const [redFlag, blueFlag] = world.objective.flags;
  assert(redFlag.status === 'home' && blueFlag.status === 'home', 'both flags start home');
  assert(redFlag.x === world.map.flagStands![0].x, 'red flag on its stand');
});

test('touching the enemy flag picks it up', () => {
  const world = match('ctf');
  const red = world.players.get('p0')!;
  const blueFlag = world.objective.flags[1];
  red.x = blueFlag.x; red.y = blueFlag.y;
  stepWorld(world, NO_INPUT);
  assert(blueFlag.status === 'carried', `flag status is ${blueFlag.status}`);
  assert(blueFlag.carrier === 'p0', `carrier is ${blueFlag.carrier}`);
});

test('you cannot pick up your own flag', () => {
  const world = match('ctf');
  const red = world.players.get('p0')!;
  const redFlag = world.objective.flags[0];
  red.x = redFlag.x; red.y = redFlag.y;
  stepWorld(world, NO_INPUT);
  assert(redFlag.status === 'home', `own flag should stay home, got ${redFlag.status}`);
});

test('the flag follows its carrier', () => {
  const world = match('ctf');
  const red = world.players.get('p0')!;
  const blueFlag = world.objective.flags[1];
  red.x = blueFlag.x; red.y = blueFlag.y;
  stepWorld(world, NO_INPUT);
  red.x = 500; red.y = 300;
  stepWorld(world, NO_INPUT);
  assert(Math.abs(blueFlag.x - 500) < 2 && Math.abs(blueFlag.y - 300) < 2,
    `flag did not follow: ${blueFlag.x},${blueFlag.y}`);
});

test('carrying the enemy flag home scores a capture', () => {
  const world = match('ctf');
  const red = world.players.get('p0')!;
  const stands = world.map.flagStands!;
  const blueFlag = world.objective.flags[1];

  red.x = blueFlag.x; red.y = blueFlag.y;
  stepWorld(world, NO_INPUT);
  assert(blueFlag.carrier === 'p0', 'picked up');

  red.x = stands[0].x; red.y = stands[0].y;
  stepWorld(world, NO_INPUT);
  assert(world.scores[0] === 1, `expected 1 capture, got ${world.scores[0]}`);
  assert(blueFlag.status === 'home', `enemy flag should reset, got ${blueFlag.status}`);
});

test('dying drops the flag where you fell', () => {
  const world = match('ctf');
  const red = world.players.get('p0')!;
  const blue = world.players.get('p1')!;
  const blueFlag = world.objective.flags[1];

  red.x = blueFlag.x; red.y = blueFlag.y;
  stepWorld(world, NO_INPUT);
  red.x = 450; red.y = 250;                   // open ground, no walls nearby
  stepWorld(world, NO_INPUT);

  kill(world, red, blue, 'gun');
  assert(blueFlag.status === 'dropped', `flag should drop, got ${blueFlag.status}`);
  assert(Math.abs(blueFlag.x - 450) < 3, `flag should stay where the carrier fell, got ${blueFlag.x}`);
});

test('a dropped flag returns itself after the timer', () => {
  const world = match('ctf');
  const flag = world.objective.flags[1];
  flag.status = 'dropped';
  flag.x = 640; flag.y = 500;
  flag.returnIn = 0.2;
  advance(world, 0.5);
  assert(statusOf(flag) === 'home', `flag should have returned, got ${flag.status}`);
});

test('touching your own dropped flag returns it instantly', () => {
  const world = match('ctf');
  const blue = world.players.get('p1')!;
  const blueFlag = world.objective.flags[1];
  blueFlag.status = 'dropped';
  blueFlag.x = 640; blueFlag.y = 500;
  blueFlag.returnIn = OBJECTIVE.FLAG_RETURN_TIME;
  blue.x = 640; blue.y = 500;
  stepWorld(world, NO_INPUT);
  assert(statusOf(blueFlag) === 'home', `flag should be returned, got ${blueFlag.status}`);
});

test('you cannot capture while your own flag is away', () => {
  const world = match('ctf');
  const red = world.players.get('p0')!;
  const stands = world.map.flagStands!;
  const redFlag = world.objective.flags[0];
  const blueFlag = world.objective.flags[1];

  red.x = blueFlag.x; red.y = blueFlag.y;
  stepWorld(world, NO_INPUT);
  redFlag.status = 'dropped';                 // our flag is out in the field
  redFlag.x = 780; redFlag.y = 250;
  redFlag.returnIn = OBJECTIVE.FLAG_RETURN_TIME;

  red.x = stands[0].x; red.y = stands[0].y;
  stepWorld(world, NO_INPUT);
  assert(world.scores[0] === 0, `capture should be blocked, score ${world.scores[0]}`);
});

test('carrying the flag slows you down', () => {
  const world = match('ctf');
  const red = world.players.get('p0')!;
  const blueFlag = world.objective.flags[1];
  red.x = blueFlag.x; red.y = blueFlag.y;
  stepWorld(world, NO_INPUT);
  assert(blueFlag.carrier === 'p0', 'carrying');

  red.x = 640; red.y = 640;
  const inputs = new Map<string, InputCmd>();
  inputs.set('p0', { seq: 1, moveX: -1, moveY: 0, aimX: -1, aimY: 0, buttons: 0 });
  for (let i = 0; i < 120; i++) stepWorld(world, inputs);
  const speed = Math.hypot(red.vx, red.vy);
  const cap = PLAYER.MAX_SPEED * OBJECTIVE.CARRY_SPEED_MULT;
  assert(speed <= cap + 2, `carrier should be capped at ${cap}, got ${speed.toFixed(1)}`);
});

// --------------------------------------------------------------- bomb run
test('the bomb starts loose on its pad', () => {
  const world = match('bomb');
  assert(!!world.objective.bomb, 'bomb exists');
  assert(world.objective.bomb!.status === 'loose', `status ${world.objective.bomb!.status}`);
});

test('walking over the bomb picks it up', () => {
  const world = match('bomb');
  const bomb = world.objective.bomb!;
  const red = world.players.get('p0')!;
  red.x = bomb.x; red.y = bomb.y;
  stepWorld(world, NO_INPUT);
  assert(bomb.status === 'carried' && bomb.carrier === 'p0', `bomb ${bomb.status}/${bomb.carrier}`);
});

test('delivering the bomb to the enemy site scores', () => {
  const world = match('bomb');
  const bomb = world.objective.bomb!;
  const red = world.players.get('p0')!;
  red.x = bomb.x; red.y = bomb.y;
  stepWorld(world, NO_INPUT);
  const enemySite = world.map.bomb!.sites[1];
  red.x = enemySite.x; red.y = enemySite.y;
  stepWorld(world, NO_INPUT);
  assert(world.scores[0] === 1, `expected a delivery, score ${world.scores[0]}`);
  assert(bomb.status === 'loose', 'bomb resets after a delivery');
});

test('delivering to your own site does nothing', () => {
  const world = match('bomb');
  const bomb = world.objective.bomb!;
  const red = world.players.get('p0')!;
  red.x = bomb.x; red.y = bomb.y;
  stepWorld(world, NO_INPUT);
  const ownSite = world.map.bomb!.sites[0];
  red.x = ownSite.x; red.y = ownSite.y;
  stepWorld(world, NO_INPUT);
  assert(world.scores[0] === 0, `own site should not score, got ${world.scores[0]}`);
});

test('dying drops the bomb', () => {
  const world = match('bomb');
  const bomb = world.objective.bomb!;
  const red = world.players.get('p0')!;
  const blue = world.players.get('p1')!;
  red.x = bomb.x; red.y = bomb.y;
  stepWorld(world, NO_INPUT);
  red.x = 700; red.y = 250;
  stepWorld(world, NO_INPUT);
  kill(world, red, blue, 'sword');
  assert(bomb.status === 'loose' && bomb.carrier === null, `bomb ${bomb.status}`);
  assert(Math.abs(bomb.x - 700) < 3, `bomb should drop where the carrier fell, got ${bomb.x}`);
});

test('kill-based modes leave the objective state empty', () => {
  const world = match('tdm');
  assert(world.objective.flags.length === 0 && world.objective.bomb === null,
    'no objective fixtures in team deathmatch');
});

if (failures.length) {
  console.error(`\n  ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
} else {
  console.log(`\n  ✓ all ${passed} mode tests passed\n`);
}
