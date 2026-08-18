/**
 * Match flow: lobby -> countdown -> live -> results -> (rematch).
 *
 * Runs inside the simulation so the server is the single source of truth for
 * when a match starts, when it ends and who won. The client only draws it.
 */

import { MATCH, MODE_RULES, type ModeId } from './config.js';
import { respawn } from './combat.js';
import { resetObjective } from './objectives.js';
import { resetPowerups } from './powerups.js';
import { PLAYER } from './config.js';
import type { PlayerState, TeamId, WorldState } from './types.js';

/**
 * 'practice' is the offline training range: no clock, no win condition, no
 * lobby banner — just you and the dummies.
 */
export type MatchPhase = 'practice' | 'lobby' | 'countdown' | 'live' | 'results';

export interface MatchState {
  phase: MatchPhase;
  mode: ModeId;
  /** Seconds left in the current phase. For 'live' this is the match clock. */
  timer: number;
  scoreTarget: number;
  duration: number;
  /** Winning team for team modes; null for a draw or a non-team mode. */
  winnerTeam: TeamId | null;
  /** Winning player for duel / free-for-all; null otherwise. */
  winnerId: string | null;
  /** Counts up so clients can tell a fresh match from a resumed one. */
  round: number;
}

export function createMatch(mode: ModeId): MatchState {
  const rules = MODE_RULES[mode];
  return {
    phase: 'lobby',
    mode,
    timer: 0,
    scoreTarget: rules.scoreTarget,
    duration: rules.duration,
    winnerTeam: null,
    winnerId: null,
    round: 0,
  };
}

export function isScoring(world: WorldState): boolean {
  const phase = world.match.phase;
  return phase === 'live' || phase === 'practice' || MATCH.WARMUP_SCORING;
}

/** Advances the match clock and handles every phase transition. */
export function stepMatch(world: WorldState, dt: number): void {
  const m = world.match;
  const rules = MODE_RULES[m.mode];
  const humans = countPlayers(world);

  switch (m.phase) {
    case 'practice':
      return;                                  // the training range never ends

    case 'lobby':
      if (humans >= Math.max(MATCH.MIN_PLAYERS, rules.minPlayers)) {
        m.phase = 'countdown';
        m.timer = MATCH.COUNTDOWN;
        world.events.push({ t: 'phase', phase: 'countdown' });
      }
      break;

    case 'countdown':
      if (humans < Math.max(MATCH.MIN_PLAYERS, rules.minPlayers)) {
        m.phase = 'lobby';
        world.events.push({ t: 'phase', phase: 'lobby' });
        break;
      }
      m.timer -= dt;
      if (m.timer <= 0) startMatch(world);
      break;

    case 'live': {
      m.timer -= dt;
      const decided = checkWin(world);
      if (decided || m.timer <= 0) endMatch(world);
      break;
    }

    case 'results':
      m.timer -= dt;
      if (m.timer <= 0) {
        if (humans >= Math.max(MATCH.MIN_PLAYERS, rules.minPlayers)) {
          m.phase = 'countdown';
          m.timer = MATCH.COUNTDOWN;
          world.events.push({ t: 'phase', phase: 'countdown' });
        } else {
          m.phase = 'lobby';
          world.events.push({ t: 'phase', phase: 'lobby' });
        }
      }
      break;
  }
}

export function startMatch(world: WorldState): void {
  const m = world.match;
  const rules = MODE_RULES[m.mode];

  m.phase = 'live';
  m.timer = rules.duration;
  m.duration = rules.duration;
  m.scoreTarget = rules.scoreTarget;
  m.winnerTeam = null;
  m.winnerId = null;
  m.round++;

  world.scores = [0, 0, 0];
  world.projectiles.length = 0;
  resetObjective(world);
  resetPowerups(world);

  for (const p of world.players.values()) {
    p.kills = 0;
    p.deaths = 0;
    p.health = PLAYER.HEALTH;
    p.alive = true;
    respawn(world, p);
  }

  world.events.push({ t: 'phase', phase: 'live' });
}

export function endMatch(world: WorldState): void {
  const m = world.match;
  m.phase = 'results';
  m.timer = MATCH.RESULTS;
  resolveWinner(world);
  world.projectiles.length = 0;
  world.events.push({
    t: 'phase',
    phase: 'results',
    winnerTeam: m.winnerTeam,
    winnerId: m.winnerId,
  });
}

/** True when someone has hit the target for this mode. */
function checkWin(world: WorldState): boolean {
  const m = world.match;
  if (MODE_RULES[m.mode].teamBased) {
    return world.scores[0] >= m.scoreTarget || world.scores[1] >= m.scoreTarget;
  }
  for (const p of world.players.values()) {
    if (p.kills >= m.scoreTarget) return true;
  }
  return false;
}

function resolveWinner(world: WorldState): void {
  const m = world.match;
  m.winnerTeam = null;
  m.winnerId = null;

  if (MODE_RULES[m.mode].teamBased) {
    if (world.scores[0] > world.scores[1]) m.winnerTeam = 0;
    else if (world.scores[1] > world.scores[0]) m.winnerTeam = 1;
    return;
  }

  let best: PlayerState | null = null;
  let tied = false;
  for (const p of world.players.values()) {
    if (!best || p.kills > best.kills) { best = p; tied = false; }
    else if (p.kills === best.kills && p.id !== best.id) { tied = true; }
  }
  if (best && !tied) {
    m.winnerId = best.id;
    m.winnerTeam = best.team;
  }
}

function countPlayers(world: WorldState): number {
  let n = 0;
  for (const p of world.players.values()) if (!p.isDummy) n++;
  return n;
}

/** Host-triggered "run it back" — skips the rest of the results screen. */
export function requestRematch(world: WorldState): void {
  if (world.match.phase !== 'results') return;
  world.match.timer = 0.001;
}
