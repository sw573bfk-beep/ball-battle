/**
 * Match-flow tests: lobby -> countdown -> live -> results -> rematch.
 */

import { MATCH, MODE_RULES, PLAYER, TICK_DT } from '../shared/config.js';
import { addPlayer, createWorld, stepWorld } from '../shared/sim.js';
import { requestRematch } from '../shared/match.js';
import { kill } from '../shared/combat.js';
import type { InputCmd, WorldState } from '../shared/types.js';

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void): void {
  try { fn(); passed++; }
  catch (err) { failures.push(`${name}\n    ${(err as Error).message}`); }
}
function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }

const NO_INPUT = new Map<string, InputCmd>();
function advance(world: WorldState, seconds: number): void {
  const ticks = Math.ceil(seconds / TICK_DT);
  for (let i = 0; i < ticks; i++) stepWorld(world, NO_INPUT);
}

function room(players: number, mode: 'tdm' | 'duel' | 'ffa' = 'tdm'): WorldState {
  const world = createWorld('training', mode);
  for (let i = 0; i < players; i++) {
    addPlayer(world, `p${i}`, `P${i}`, mode === 'ffa' ? 2 : ((i % 2) as 0 | 1));
  }
  return world;
}

test('an empty room sits in the lobby', () => {
  const world = room(0);
  advance(world, 2);
  assert(world.match.phase === 'lobby', `phase is ${world.match.phase}`);
});

test('one player is not enough to start', () => {
  const world = room(1);
  advance(world, 5);
  assert(world.match.phase === 'lobby', `phase is ${world.match.phase}`);
});

test('two players trigger a countdown, then the match', () => {
  const world = room(2);
  advance(world, 0.1);
  assert(world.match.phase === 'countdown', `expected countdown, got ${world.match.phase}`);
  advance(world, MATCH.COUNTDOWN + 0.2);
  assert(world.match.phase === 'live', `expected live, got ${world.match.phase}`);
  assert(world.match.round === 1, `round should be 1, got ${world.match.round}`);
});

test('someone leaving during the countdown cancels it', () => {
  const world = room(2);
  advance(world, 0.5);
  assert(world.match.phase === 'countdown', 'countdown started');
  world.players.delete('p1');
  advance(world, 0.2);
  assert(world.match.phase === 'lobby', `expected lobby, got ${world.match.phase}`);
});

test('the match start wipes scores and revives everyone', () => {
  const world = room(2);
  const p0 = world.players.get('p0')!;
  world.scores = [7, 3, 0];
  p0.kills = 5; p0.deaths = 4; p0.health = 12; p0.alive = false;
  advance(world, MATCH.COUNTDOWN + 0.3);
  assert(world.match.phase === 'live', 'match is live');
  assert(world.scores[0] === 0 && world.scores[1] === 0, `scores not reset: ${world.scores}`);
  assert(p0.kills === 0 && p0.deaths === 0, `k/d not reset: ${p0.kills}/${p0.deaths}`);
  assert(p0.alive && p0.health === PLAYER.HEALTH, 'players revived at full health');
});

test('warmup kills do not count toward the score', () => {
  const world = room(1);                      // stays in the lobby
  const a = addPlayerAndFreeze(world);
  advance(world, 0.2);
  assert(world.match.phase === 'lobby', 'still warming up');
  const victim = world.players.get('p0')!;
  kill(world, victim, a, 'gun');
  assert(world.scores[0] === 0, `warmup kill scored: ${world.scores}`);
  assert(a.kills === 0, `warmup kill credited: ${a.kills}`);
});
function addPlayerAndFreeze(world: WorldState) {
  const a = addPlayer(world, 'shooter', 'Shooter', 1);
  world.players.delete('shooter');            // keep the room under MIN_PLAYERS
  return a;
}

test('reaching the kill target ends the match immediately', () => {
  const world = room(2);
  advance(world, MATCH.COUNTDOWN + 0.3);
  world.scores[1] = MODE_RULES.tdm.scoreTarget;
  advance(world, 0.1);
  assert(world.match.phase === 'results', `expected results, got ${world.match.phase}`);
  assert(world.match.winnerTeam === 1, `blue should win, got ${world.match.winnerTeam}`);
});

test('running out of time gives it to the higher score', () => {
  const world = room(2);
  advance(world, MATCH.COUNTDOWN + 0.3);
  world.scores = [4, 2, 0];
  world.match.timer = 0.05;
  advance(world, 0.2);
  assert(world.match.phase === 'results', `expected results, got ${world.match.phase}`);
  assert(world.match.winnerTeam === 0, `red should win, got ${world.match.winnerTeam}`);
});

test('a tied match on time is a draw', () => {
  const world = room(2);
  advance(world, MATCH.COUNTDOWN + 0.3);
  world.scores = [3, 3, 0];
  world.match.timer = 0.05;
  advance(world, 0.2);
  assert(world.match.phase === 'results', 'match ended');
  assert(world.match.winnerTeam === null, `expected a draw, got ${world.match.winnerTeam}`);
});

test('results roll straight into another match', () => {
  const world = room(2);
  advance(world, MATCH.COUNTDOWN + 0.3);
  world.match.timer = 0.05;
  advance(world, 0.2);
  assert(world.match.phase === 'results', 'results screen');
  advance(world, MATCH.RESULTS + 0.2);
  assert(world.match.phase === 'countdown', `expected countdown, got ${world.match.phase}`);
  advance(world, MATCH.COUNTDOWN + 0.2);
  assert(world.match.phase === 'live', 'second match started');
  assert(world.match.round === 2, `round should be 2, got ${world.match.round}`);
});

test('rematch skips the rest of the results screen', () => {
  const world = room(2);
  advance(world, MATCH.COUNTDOWN + 0.3);
  world.match.timer = 0.05;
  advance(world, 0.2);
  assert(world.match.phase === 'results', 'results screen');
  requestRematch(world);
  advance(world, 0.1);
  assert(world.match.phase === 'countdown', `expected countdown, got ${world.match.phase}`);
});

test('an emptied room falls back to the lobby after results', () => {
  const world = room(2);
  advance(world, MATCH.COUNTDOWN + 0.3);
  world.match.timer = 0.05;
  advance(world, 0.2);
  world.players.delete('p1');
  advance(world, MATCH.RESULTS + 0.3);
  assert(world.match.phase === 'lobby', `expected lobby, got ${world.match.phase}`);
});

test('free-for-all is decided by individual kills', () => {
  const world = room(3, 'ffa');
  advance(world, MATCH.COUNTDOWN + 0.3);
  assert(world.match.phase === 'live', 'match live');
  assert(world.match.scoreTarget === MODE_RULES.ffa.scoreTarget, 'ffa target loaded');
  world.players.get('p2')!.kills = MODE_RULES.ffa.scoreTarget;
  advance(world, 0.1);
  assert(world.match.phase === 'results', `expected results, got ${world.match.phase}`);
  assert(world.match.winnerId === 'p2', `p2 should win, got ${world.match.winnerId}`);
});

test('duel uses its own shorter kill target', () => {
  const world = room(2, 'duel');
  advance(world, MATCH.COUNTDOWN + 0.3);
  assert(world.match.scoreTarget === MODE_RULES.duel.scoreTarget,
    `duel target should be ${MODE_RULES.duel.scoreTarget}, got ${world.match.scoreTarget}`);
  world.players.get('p0')!.kills = MODE_RULES.duel.scoreTarget;
  advance(world, 0.1);
  assert(world.match.winnerId === 'p0', `p0 should win, got ${world.match.winnerId}`);
});

test('the match clock counts down in real time', () => {
  const world = room(2);
  advance(world, MATCH.COUNTDOWN + 0.1);
  const start = world.match.timer;
  advance(world, 2);
  const delta = start - world.match.timer;
  assert(Math.abs(delta - 2) < 0.1, `clock drifted: ${delta.toFixed(3)}s elapsed for 2s of ticks`);
});

test('phase changes emit exactly one event each', () => {
  const world = room(2);
  const seen: string[] = [];
  for (let i = 0; i < Math.ceil((MATCH.COUNTDOWN + 0.5) / TICK_DT); i++) {
    stepWorld(world, NO_INPUT);
    for (const e of world.events) if (e.t === 'phase') seen.push(e.phase);
  }
  assert(seen.join(',') === 'countdown,live', `unexpected phase events: ${seen.join(',')}`);
});

if (failures.length) {
  console.error(`\n  ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
} else {
  console.log(`\n  ✓ all ${passed} match tests passed\n`);
}
