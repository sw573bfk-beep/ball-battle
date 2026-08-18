/**
 * Powerup tests. The design constraint from the brief is that a powerup should
 * swing an even fight, never decide an uneven one — so these tests pin the
 * magnitudes as much as the mechanics.
 */

import { DASH, GUN, PLAYER, POWERUP, POWERUP_KINDS, TICK_DT } from '../shared/config.js';
import { addPlayer, createWorld, stepWorld } from '../shared/sim.js';
import { startMatch } from '../shared/match.js';
import { damage } from '../shared/combat.js';
import {
  dashCooldownOf, fireIntervalOf, gunDamageOf, maxSpeedOf,
} from '../shared/powerups.js';
import { BTN, emptyInput, type InputCmd, type WorldState } from '../shared/types.js';

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void): void {
  try { fn(); passed++; }
  catch (err) { failures.push(`${name}\n    ${(err as Error).message}`); }
}
function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }

const NO_INPUT = new Map<string, InputCmd>();
function advance(world: WorldState, seconds: number): void {
  for (let i = 0; i < Math.ceil(seconds / TICK_DT); i++) stepWorld(world, NO_INPUT);
}

function match(): WorldState {
  const world = createWorld('yard', 'tdm');
  addPlayer(world, 'a', 'A', 0);
  addPlayer(world, 'b', 'B', 1);
  startMatch(world);
  for (const p of world.players.values()) p.invuln = 0;
  return world;
}

/** Stands a player on a pad and runs one tick so the pickup resolves. */
function grab(world: WorldState, kind: string): WorldState {
  const pu = world.powerups[0];
  pu.kind = kind as typeof POWERUP_KINDS[number];
  pu.respawnIn = 0;
  const a = world.players.get('a')!;
  a.x = pu.x; a.y = pu.y; a.vx = 0; a.vy = 0;
  stepWorld(world, NO_INPUT);
  return world;
}

test('every arena spawns its pads with a powerup ready', () => {
  const world = match();
  assert(world.powerups.length >= 4, `expected pads, got ${world.powerups.length}`);
  assert(world.powerups.every((p) => p.respawnIn === 0), 'pads should start full');
});

test('walking over a pad takes the powerup and starts its respawn', () => {
  const world = grab(match(), 'speed');
  const a = world.players.get('a')!;
  assert(a.buffSpeed > 0, 'speed buff applied');
  assert(world.powerups[0].respawnIn > 0, 'pad should go on cooldown');
});

test('health does not vanish when you are already full', () => {
  const world = match();
  world.players.get('a')!.health = PLAYER.HEALTH;
  grab(world, 'health');
  assert(world.powerups[0].respawnIn === 0, 'pad should still be there');
});

test('health heals but never overheals', () => {
  const world = match();
  world.players.get('a')!.health = 30;
  grab(world, 'health');
  const a = world.players.get('a')!;
  assert(a.health === 30 + POWERUP.HEALTH_AMOUNT, `expected ${30 + POWERUP.HEALTH_AMOUNT}, got ${a.health}`);

  world.powerups[0].respawnIn = 0;
  world.powerups[0].kind = 'health';
  a.health = PLAYER.HEALTH - 5;
  a.x = world.powerups[0].x; a.y = world.powerups[0].y;
  stepWorld(world, NO_INPUT);
  assert(a.health === PLAYER.HEALTH, `should cap at ${PLAYER.HEALTH}, got ${a.health}`);
});

test('shield soaks gun damage before health does', () => {
  const world = grab(match(), 'shield');
  const a = world.players.get('a')!;
  const b = world.players.get('b')!;
  assert(a.shield === POWERUP.SHIELD_AMOUNT, `shield ${a.shield}`);

  const beforeHp = a.health;
  damage(world, a, GUN.DAMAGE, b, 1, 0, 'gun');
  assert(a.health === beforeHp, `health should be untouched, got ${a.health}`);
  assert(a.shield === POWERUP.SHIELD_AMOUNT - GUN.DAMAGE, `shield should absorb, got ${a.shield}`);
});

test('a sword hit still kills through a shield', () => {
  const world = grab(match(), 'shield');
  const a = world.players.get('a')!;
  const b = world.players.get('b')!;
  damage(world, a, PLAYER.HEALTH, b, 1, 0, 'sword');
  assert(!a.alive, 'the sword must stay a one-hit kill — shields are not an answer to it');
});

test('speed raises the cap by the configured amount and no more', () => {
  const world = grab(match(), 'speed');
  const a = world.players.get('a')!;
  const expected = PLAYER.MAX_SPEED * POWERUP.SPEED_MULT;
  assert(Math.abs(maxSpeedOf(a) - expected) < 0.01, `cap ${maxSpeedOf(a)} vs ${expected}`);
  assert(POWERUP.SPEED_MULT < 1.25, `speed boost of ${POWERUP.SPEED_MULT}x is too strong to be fair`);
});

test('rapid fire shortens the interval, damage boost raises the hit', () => {
  const rapid = grab(match(), 'rapid');
  const ra = rapid.players.get('a')!;
  assert(fireIntervalOf(ra) < GUN.FIRE_INTERVAL, 'rapid should shorten the interval');

  const dmg = grab(match(), 'damage');
  const da = dmg.players.get('a')!;
  assert(gunDamageOf(da) > GUN.DAMAGE, 'damage boost should raise per-shot damage');
  // Still not a one-shot: skill has to do the rest.
  assert(gunDamageOf(da) * 2 < PLAYER.HEALTH, 'damage boost must not make the gun a two-shot kill');
});

test('dash recharge shortens the cooldown and refunds it immediately', () => {
  const world = match();
  const a = world.players.get('a')!;
  a.dashCd = DASH.COOLDOWN;
  grab(world, 'dash');
  assert(a.dashCd === 0, `dash should be refunded, got ${a.dashCd}`);
  assert(dashCooldownOf(a) < DASH.COOLDOWN, 'cooldown should be shortened while buffed');
});

test('buffs expire on their own', () => {
  const world = grab(match(), 'speed');
  const a = world.players.get('a')!;
  advance(world, POWERUP.DURATION + 0.5);
  assert(a.buffSpeed === 0, `buff should have expired, ${a.buffSpeed} left`);
  assert(maxSpeedOf(a) === PLAYER.MAX_SPEED, 'cap should be back to normal');
});

test('dying strips every buff', () => {
  const world = grab(match(), 'speed');
  const a = world.players.get('a')!;
  const b = world.players.get('b')!;
  a.buffRapid = 5; a.buffDamage = 5; a.buffDash = 5; a.shield = 30;
  damage(world, a, PLAYER.HEALTH, b, 1, 0, 'sword');
  advance(world, 3);
  assert(a.alive, 'respawned');
  assert(a.buffSpeed === 0 && a.buffRapid === 0 && a.buffDamage === 0 && a.buffDash === 0 && a.shield === 0,
    'all buffs should be cleared on death');
});

test('a pad rotates to the next kind when it comes back', () => {
  const world = grab(match(), 'speed');
  const pad = world.powerups[0];
  const before = pad.kind;
  // Step off the pad, or it gets taken again the instant it refills.
  const a = world.players.get('a')!;
  a.x = 640; a.y = 620;
  advance(world, POWERUP.RESPAWN + 0.3);
  assert(pad.respawnIn === 0, 'pad should be back');
  assert(pad.kind !== before, `kind should rotate, still ${pad.kind}`);
  assert(POWERUP_KINDS.includes(pad.kind), `rotated to an unknown kind: ${pad.kind}`);
});

test('powerups are inert outside a live match', () => {
  const world = createWorld('yard', 'tdm');
  addPlayer(world, 'a', 'A', 0);
  const a = world.players.get('a')!;
  a.invuln = 0;
  const pu = world.powerups[0];
  pu.kind = 'speed';
  a.x = pu.x; a.y = pu.y;
  stepWorld(world, NO_INPUT);
  assert(world.match.phase === 'lobby', 'still in the lobby');
  assert(a.buffSpeed === 0, 'no powerups before the match starts');
});

test('buffed fire rate actually produces more shots', () => {
  function shotsIn(seconds: number, rapid: boolean): number {
    const world = match();
    const a = world.players.get('a')!;
    if (rapid) a.buffRapid = 60;
    const inputs = new Map<string, InputCmd>();
    inputs.set('a', { ...emptyInput(1), aimX: 1, aimY: 0, buttons: BTN.SHOOT });
    let n = 0;
    for (let i = 0; i < Math.ceil(seconds / TICK_DT); i++) {
      stepWorld(world, inputs);
      for (const e of world.events) if (e.t === 'shoot') n++;
      a.ammo = GUN.MAG_SIZE;             // isolate fire rate from reloading
      a.reloadTime = 0;
    }
    return n;
  }
  const normal = shotsIn(1, false);
  const fast = shotsIn(1, true);
  assert(fast > normal, `rapid fire should shoot more: ${fast} vs ${normal}`);
});

if (failures.length) {
  console.error(`\n  ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
} else {
  console.log(`\n  ✓ all ${passed} powerup tests passed\n`);
}
