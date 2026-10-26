/** Simulation tests. Run with `npm test`. No framework: a failed check throws. */

import { MATCH, PLAYER, SWORD, TICK_DT, TIERS } from '../src/sim/config.js';
import { COLOSSEUM } from '../src/sim/maps.js';
import { circleVsRect } from '../src/sim/math.js';
import { buildNav, createBrain, findPath, thinkBot } from '../src/sim/bots.js';
import { addPlayer, bladeOf, createWorld, damage, rankPlayers, stepWorld, throwSword } from '../src/sim/world.js';
import { emptyInput, type InputCmd, type MapDef, type World } from '../src/sim/types.js';

let passed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`  FAIL ${name}\n       ${(e as Error).message}`);
    process.exitCode = 1;
  }
}
function check(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

/** An empty walled box, so tests aren't at the mercy of the real layout. */
const BOX: MapDef = {
  name: 'Box', width: 1200, height: 800,
  walls: [
    { x: 0, y: 0, w: 1200, h: 40 }, { x: 0, y: 760, w: 1200, h: 40 },
    { x: 0, y: 0, w: 40, h: 800 }, { x: 1160, y: 0, w: 40, h: 800 },
  ],
  crates: [], healthPads: [], spawns: [{ x: 200, y: 400 }, { x: 1000, y: 400 }],
};

function box(): World {
  const w = createWorld({ map: BOX, seed: 7, skipCountdown: true });
  w.floor = [];
  w.spawnTimer = 1e9; // no surprise loot
  return w;
}

function run(w: World, ticks: number, inputs: Map<string, InputCmd> = new Map()): void {
  for (let i = 0; i < ticks; i++) stepWorld(w, inputs);
}

console.log('sword arena sim');

test('map: spawns, crates and pads are clear of walls and reachable', () => {
  const nav = buildNav(COLOSSEUM);
  const pts = [...COLOSSEUM.spawns, ...COLOSSEUM.healthPads];
  for (const p of pts) {
    for (const r of COLOSSEUM.walls) check(!circleVsRect(p.x, p.y, PLAYER.RADIUS, r), `(${p.x},${p.y}) overlaps a wall`);
  }
  for (const c of COLOSSEUM.crates) {
    for (const r of COLOSSEUM.walls) check(!circleVsRect(c.x, c.y, 23, r), `crate (${c.x},${c.y}) overlaps a wall`);
  }
  const empty = new Uint8Array(nav.cols * nav.rows);
  const from = COLOSSEUM.spawns[0];
  for (const p of [...pts, ...COLOSSEUM.crates]) {
    check(findPath(nav, empty, from.x, from.y, p.x, p.y).length > 0, `(${p.x},${p.y}) unreachable`);
  }
});

test('walking over a floor sword picks it up', () => {
  const w = box();
  const p = addPlayer(w, 'a', 'A', '#fff', false);
  w.floor.push({ id: 99, tier: 2, x: p.x + 120, y: p.y, vx: 0, vy: 0, angle: 0, ttl: 30, lock: 0 });
  const before = p.swords.length;
  run(w, 40, new Map([['a', { ...emptyInput(), moveX: 1 }]]));
  check(p.swords.length === before + 1, `expected ${before + 1} swords, got ${p.swords.length}`);
  check(p.swords.includes(2), 'gold sword should be in orbit');
  check(w.floor.length === 0, 'floor sword should be gone');
});

test('more swords make you slower', () => {
  const w = box();
  const light = addPlayer(w, 'a', 'A', '#fff', false);
  const heavy = addPlayer(w, 'b', 'B', '#fff', false);
  heavy.swords = [0, 0, 0, 0, 0, 0];
  light.protect = heavy.protect = 0;
  light.x = heavy.x = 200;
  light.y = 200; heavy.y = 500;
  const right = { ...emptyInput(), moveX: 1 };
  const ax = light.x, bx = heavy.x;
  run(w, 30, new Map([['a', right], ['b', right]]));
  check(light.x - ax > heavy.x - bx, 'the heavy player should cover less ground');
});

test('a thrown sword flies, sticks in a wall, and lands on the floor', () => {
  const w = box();
  const p = addPlayer(w, 'a', 'A', '#fff', false);
  p.swords = [1];
  p.aim = 0;
  check(throwSword(w, p), 'throw should succeed');
  check(p.swords.length === 0 && w.thrown.length === 1, 'sword should leave the orbit');
  run(w, 120);
  check(w.thrown.length === 0, 'sword should have landed');
  check(w.floor.length === 1 && w.floor[0].tier === 1, 'a ruby sword should be on the floor');
  check(w.floor[0].x < 1160 - 10, 'it should rest outside the wall');
});

test('throwing needs a sword and respects the cooldown', () => {
  const w = box();
  const p = addPlayer(w, 'a', 'A', '#fff', false);
  p.swords = [];
  check(!throwSword(w, p), 'no sword, no throw');
  p.swords = [0, 0];
  check(throwSword(w, p), 'first throw');
  check(!throwSword(w, p), 'second throw is on cooldown');
});

test('you throw your best sword first', () => {
  const w = box();
  const p = addPlayer(w, 'a', 'A', '#fff', false);
  p.swords = [0, 2, 1];
  throwSword(w, p);
  check(w.thrown[0].tier === 2, 'gold goes first');
  check(p.swords.join() === '0,1', `left with ${p.swords.join()}`);
});

test('a thrown sword hits an enemy for its tier damage, and both swords break', () => {
  const w = box();
  const a = addPlayer(w, 'a', 'A', '#fff', false);
  const b = addPlayer(w, 'b', 'B', '#fff', false);
  a.protect = b.protect = 0;
  // b's two blades point straight up and down, so the throw reaches the body.
  b.swords = [0, 1];
  b.spin = Math.PI / 2;
  a.x = 200; a.y = 400;
  b.x = 500; b.y = 400;
  a.swords = [2];
  a.aim = 0;
  throwSword(w, a);
  run(w, 40);
  check(b.health === PLAYER.HEALTH - TIERS[2].throwDamage, `health ${b.health}`);
  check(b.swords.length === 1, `b should lose one sword, has ${b.swords.length}`);
  check(w.floor.length === 0 && w.thrown.length === 0, 'the thrown sword is destroyed, not dropped');
});

test('a full orbit blocks some throws, but not all of them', () => {
  let blocked = 0;
  const tries = 24;
  for (let k = 0; k < tries; k++) {
    const w = box();
    const a = addPlayer(w, 'a', 'A', '#fff', false);
    const b = addPlayer(w, 'b', 'B', '#fff', false);
    a.protect = b.protect = 0;
    a.x = 200; a.y = 400;
    b.x = 550; b.y = 400;
    b.swords = [0, 0, 0, 0, 0, 0, 0, 0];
    b.spin = (k / tries) * (Math.PI * 2 / 8);
    a.swords = [0];
    a.aim = 0;
    throwSword(w, a);
    run(w, 40);
    if (b.health === PLAYER.HEALTH) blocked++;
    // Blocked or not, the throw costs b exactly one sword and is gone itself.
    check(b.swords.length === 7, `b should have 7 swords left, has ${b.swords.length}`);
    check(w.floor.length === 0 && w.thrown.length === 0, 'the thrown sword should be destroyed');
  }
  check(blocked > 0 && blocked < tries, `blocked ${blocked}/${tries}`);
});

test('orbiting swords damage players they touch, with a per-blade cooldown', () => {
  const w = box();
  const a = addPlayer(w, 'a', 'A', '#fff', false);
  const b = addPlayer(w, 'b', 'B', '#fff', false);
  a.protect = b.protect = 0;
  a.swords = [0];
  b.swords = [];
  // Park b right in the orbit's path and hold everyone still.
  b.x = a.x + PLAYER.RADIUS * 2 + 12; b.y = a.y;
  let hits = 0;
  for (let i = 0; i < 60; i++) {
    b.x = a.x + PLAYER.RADIUS * 2 + 12; b.y = a.y; b.vx = b.vy = a.vx = a.vy = 0;
    stepWorld(w, new Map());
    hits += w.events.filter((e) => e.t === 'hit').length;
  }
  check(hits >= 1, 'should have been hit at least once');
  check(hits <= Math.ceil(1 / SWORD.HIT_COOLDOWN), `too many hits for one blade: ${hits}`);
});

test('a blade hit knocks one of your swords about 7 ball-widths away', () => {
  const w = box();
  const a = addPlayer(w, 'a', 'A', '#fff', false);
  const b = addPlayer(w, 'b', 'B', '#fff', false);
  a.protect = b.protect = 0;
  a.x = 400; a.y = 400;
  a.swords = [0];
  b.swords = [1, 1];
  let knocked = false;
  for (let i = 0; i < 60 && !knocked; i++) {
    b.x = a.x + PLAYER.RADIUS * 2 + 12; b.y = a.y; b.vx = b.vy = a.vx = a.vy = 0;
    stepWorld(w, new Map());
    knocked = w.events.some((e) => e.t === 'knockoff');
  }
  check(knocked, 'a blade hit should knock a sword off');
  check(b.swords.length === 1, `b should have 1 sword left, has ${b.swords.length}`);
  const start = { x: w.floor[0].x, y: w.floor[0].y };
  run(w, 120);
  const f = w.floor[0];
  check(f && f.tier === 1, 'the knocked-off sword should be on the floor');
  const travelled = Math.hypot(f.x - start.x, f.y - start.y);
  const want = SWORD.KNOCKOFF_DISTANCE;
  check(Math.abs(travelled - want) < want * 0.2, `slid ${travelled | 0}px, expected about ${want}`);
  check(f.x > a.x, 'it flies away from the attacker');
});

test('spawn protection blocks damage', () => {
  const w = box();
  const a = addPlayer(w, 'a', 'A', '#fff', false);
  const b = addPlayer(w, 'b', 'B', '#fff', false);
  b.protect = 1;
  damage(w, b, 50, a.id, 0, 0, false, b.x, b.y);
  check(b.health === PLAYER.HEALTH, 'protected players take no damage');
});

test('dying scatters your swords, credits the killer, then you respawn', () => {
  const w = box();
  const a = addPlayer(w, 'a', 'A', '#fff', false);
  const b = addPlayer(w, 'b', 'B', '#fff', false);
  a.protect = b.protect = 0;
  a.health = 60;
  b.swords = [0, 1, 2];
  damage(w, b, 999, a.id, 0, 0, false, b.x, b.y);
  check(!b.alive && b.deaths === 1, 'b should be dead');
  check(a.kills === 1 && a.health === 60 + PLAYER.KILL_HEAL, 'killer gets the kill and some health');
  check(w.floor.length === 3, `3 swords should scatter, got ${w.floor.length}`);
  run(w, Math.ceil(PLAYER.RESPAWN_TIME / TICK_DT) + 2);
  check(b.alive && b.health === PLAYER.HEALTH && b.swords.length === PLAYER.START_SWORDS, 'b should respawn fresh');
  check(b.protect > 0, 'with spawn protection');
});

test('the match ends at the kill target', () => {
  const w = box();
  const a = addPlayer(w, 'a', 'A', '#fff', false);
  const b = addPlayer(w, 'b', 'B', '#fff', false);
  for (let i = 0; i < MATCH.KILL_TARGET; i++) {
    b.alive = true; b.protect = 0; b.health = 1;
    damage(w, b, 10, a.id, 0, 0, false, b.x, b.y);
  }
  check(w.phase === 'over' && w.winner === 'a', `phase ${w.phase}, winner ${w.winner}`);
  check(rankPlayers(w)[0] === a, 'a ranks first');
});

test('the match ends when the clock runs out', () => {
  const w = box();
  addPlayer(w, 'a', 'A', '#fff', false);
  run(w, Math.ceil(MATCH.DURATION / TICK_DT) + 2);
  check(w.phase === 'over', 'time should be up');
});

test('countdown freezes movement', () => {
  const w = createWorld({ map: BOX, seed: 1 });
  const p = addPlayer(w, 'a', 'A', '#fff', false);
  const x = p.x;
  run(w, 30, new Map([['a', { ...emptyInput(), moveX: 1 }]]));
  check(p.x === x && w.phase === 'countdown', 'nobody moves before GO');
});

test('blade geometry sits outside the ball', () => {
  const w = box();
  const p = addPlayer(w, 'a', 'A', '#fff', false);
  p.swords = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const b = bladeOf(p, i);
    check(Math.hypot(b.ax - p.x, b.ay - p.y) > PLAYER.RADIUS, 'hilt outside the ball');
  }
});

// ---------------------------------------------------------- bots, end to end

function botMatch(seed: number, count: number, seconds: number) {
  const w = createWorld({ map: COLOSSEUM, seed, skipCountdown: true });
  const nav = buildNav(COLOSSEUM);
  const brains = [];
  for (let i = 0; i < count; i++) {
    addPlayer(w, `b${i}`, `Bot ${i}`, '#fff', true);
    brains.push(createBrain(`b${i}`, (['easy', 'normal', 'hard'] as const)[i % 3], seed * 100 + i));
  }
  const travelled = new Map<string, number>();
  const inputs = new Map<string, InputCmd>();
  for (let t = 0; t < seconds / TICK_DT && w.phase !== 'over'; t++) {
    for (const b of brains) inputs.set(b.id, thinkBot(w, nav, b, TICK_DT));
    const before = w.players.map((p) => [p.x, p.y]);
    stepWorld(w, inputs);
    w.players.forEach((p, i) => {
      check(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.health), `${p.id} went NaN`);
      if (p.alive) {
        for (const r of COLOSSEUM.walls) check(!circleVsRect(p.x, p.y, PLAYER.RADIUS - 3, r), `${p.id} is inside a wall at ${p.x | 0},${p.y | 0}`);
        travelled.set(p.id, (travelled.get(p.id) ?? 0) + Math.hypot(p.x - before[i][0], p.y - before[i][1]));
      }
    });
  }
  return { w, travelled };
}

test('bots play a full match: they fight, kill, and finish it', () => {
  const { w, travelled } = botMatch(3, 7, MATCH.DURATION + 1);
  const kills = w.players.reduce((s, p) => s + p.kills, 0);
  check(w.phase === 'over', 'match should finish');
  check(kills >= 15, `bots should actually fight (only ${kills} kills)`);
  for (const [id, d] of travelled) check(d > 3000, `${id} barely moved (${d | 0}px) — stuck?`);
  const top = rankPlayers(w)[0];
  console.log(`       ${kills} kills, winner ${top.name} with ${top.kills}, ${(w.time | 0)}s`);
});

test('same seed, same inputs, same match (determinism)', () => {
  const a = botMatch(11, 5, 20).w;
  const b = botMatch(11, 5, 20).w;
  const sig = (w: World) => w.players.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.health},${p.swords.join('')}`).join('|');
  check(sig(a) === sig(b), 'two runs diverged');
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
