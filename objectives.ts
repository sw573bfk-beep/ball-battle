/**
 * Objective modes: king of the hill, capture the flag, bomb run.
 *
 * Each mode is a small set of pure functions over WorldState, driven from the
 * simulation tick. Adding a mode means adding a case here and an entry in
 * MODE_RULES — nothing else in the codebase needs to know about it.
 */

import { MODE_RULES, OBJECTIVE, PLAYER } from './config.js';
import { len } from './math.js';
import type { PlayerState, TeamId, WorldState } from './types.js';

export type FlagStatus = 'home' | 'carried' | 'dropped';

export interface FlagState {
  /** The team this flag belongs to (the team that defends it). */
  team: TeamId;
  x: number;
  y: number;
  /** Player id carrying it, or null. */
  carrier: string | null;
  status: FlagStatus;
  /** Seconds until a dropped flag returns itself home. */
  returnIn: number;
}

export interface BombState {
  x: number;
  y: number;
  carrier: string | null;
  status: 'loose' | 'carried';
  resetIn: number;
}

export interface ObjectiveState {
  /** King of the hill. */
  hillOwner: TeamId | null;
  hillContested: boolean;
  /** Fractional points, floored into world.scores. */
  hillProgress: [number, number];
  /** Capture the flag, indexed by defending team. */
  flags: FlagState[];
  /** Bomb run. */
  bomb: BombState | null;
}

export function createObjective(): ObjectiveState {
  return {
    hillOwner: null,
    hillContested: false,
    hillProgress: [0, 0],
    flags: [],
    bomb: null,
  };
}

/** Called at the start of every match. */
export function resetObjective(world: WorldState): void {
  const o = world.objective;
  const map = world.map;

  o.hillOwner = null;
  o.hillContested = false;
  o.hillProgress = [0, 0];
  o.flags = [];
  o.bomb = null;

  const kind = MODE_RULES[world.match.mode].objective;

  if (kind === 'flags' && map.flagStands) {
    o.flags = map.flagStands.map((stand, i) => ({
      team: i as TeamId,
      x: stand.x,
      y: stand.y,
      carrier: null,
      status: 'home' as FlagStatus,
      returnIn: 0,
    }));
  }

  if (kind === 'bomb' && map.bomb) {
    o.bomb = {
      x: map.bomb.spawn.x,
      y: map.bomb.spawn.y,
      carrier: null,
      status: 'loose',
      resetIn: OBJECTIVE.BOMB_RESET_TIME,
    };
  }
}

/** One tick of objective logic. No-op for the kill-based modes. */
export function stepObjective(world: WorldState, dt: number): void {
  if (world.match.phase !== 'live') return;
  switch (MODE_RULES[world.match.mode].objective) {
    case 'hill': stepHill(world, dt); break;
    case 'flags': stepFlags(world, dt); break;
    case 'bomb': stepBomb(world, dt); break;
    default: break;
  }
}

/** True while this player is slowed by carrying something. */
export function isCarrying(world: WorldState, id: string): boolean {
  const o = world.objective;
  if (o.bomb && o.bomb.carrier === id) return true;
  for (const f of o.flags) if (f.carrier === id) return true;
  return false;
}

/** Drops whatever a player was carrying — called on death and on disconnect. */
export function dropCarried(world: WorldState, player: PlayerState): void {
  const o = world.objective;

  if (o.bomb && o.bomb.carrier === player.id) {
    o.bomb.carrier = null;
    o.bomb.status = 'loose';
    o.bomb.x = player.x;
    o.bomb.y = player.y;
    o.bomb.resetIn = OBJECTIVE.BOMB_RESET_TIME;
    world.events.push({ t: 'objective', kind: 'bombDrop', x: player.x, y: player.y, team: player.team });
  }

  for (const f of o.flags) {
    if (f.carrier !== player.id) continue;
    f.carrier = null;
    f.status = 'dropped';
    f.x = player.x;
    f.y = player.y;
    f.returnIn = OBJECTIVE.FLAG_RETURN_TIME;
    world.events.push({ t: 'objective', kind: 'flagDrop', x: f.x, y: f.y, team: f.team });
  }
}

// ------------------------------------------------------- king of the hill

function stepHill(world: WorldState, dt: number): void {
  const o = world.objective;
  const hill = world.map.hill;
  if (!hill) return;

  let red = 0, blue = 0;
  for (const p of world.players.values()) {
    if (!p.alive || p.isDummy) continue;
    if (len(p.x - hill.x, p.y - hill.y) > hill.r + PLAYER.RADIUS) continue;
    if (p.team === 0) red++;
    else if (p.team === 1) blue++;
  }

  o.hillContested = red > 0 && blue > 0;
  o.hillOwner = o.hillContested ? null : red > 0 ? 0 : blue > 0 ? 1 : null;

  if (o.hillOwner === null) return;

  const idx = o.hillOwner;
  o.hillProgress[idx] += OBJECTIVE.HILL_POINTS_PER_SEC * dt;
  const whole = Math.floor(o.hillProgress[idx]);
  if (whole > 0) {
    o.hillProgress[idx] -= whole;
    world.scores[idx] += whole;
  }
}

// -------------------------------------------------------- capture the flag

function stepFlags(world: WorldState, dt: number): void {
  const o = world.objective;
  const stands = world.map.flagStands;
  if (!stands || o.flags.length < 2) return;

  for (const flag of o.flags) {
    // Carried flags ride along with their carrier.
    if (flag.status === 'carried') {
      const carrier = flag.carrier ? world.players.get(flag.carrier) : null;
      if (!carrier || !carrier.alive) {
        // Carrier vanished (disconnect) — leave it where it was.
        flag.carrier = null;
        flag.status = 'dropped';
        flag.returnIn = OBJECTIVE.FLAG_RETURN_TIME;
      } else {
        flag.x = carrier.x;
        flag.y = carrier.y;
      }
      continue;
    }

    if (flag.status === 'dropped') {
      flag.returnIn -= dt;
      if (flag.returnIn <= 0) returnFlag(world, flag);
    }
  }

  for (const p of world.players.values()) {
    if (!p.alive || p.isDummy) continue;

    for (const flag of o.flags) {
      if (flag.status === 'carried') continue;
      const dist = len(p.x - flag.x, p.y - flag.y);
      if (dist > OBJECTIVE.PICKUP_RADIUS + PLAYER.RADIUS) continue;

      if (flag.team === p.team) {
        // Touching your own flag returns it if it was dropped.
        if (flag.status === 'dropped') returnFlag(world, flag);
        continue;
      }

      flag.carrier = p.id;
      flag.status = 'carried';
      world.events.push({ t: 'objective', kind: 'flagTake', x: flag.x, y: flag.y, team: p.team });
    }

    // Scoring: bring the enemy flag to your own stand, which must be home.
    const ownFlag = o.flags[p.team];
    const enemyFlag = o.flags[p.team === 0 ? 1 : 0];
    if (!ownFlag || !enemyFlag) continue;
    if (enemyFlag.carrier !== p.id) continue;
    if (ownFlag.status !== 'home') continue;

    const stand = stands[p.team];
    if (len(p.x - stand.x, p.y - stand.y) > OBJECTIVE.PICKUP_RADIUS + PLAYER.RADIUS) continue;

    world.scores[p.team] += 1;
    world.events.push({ t: 'objective', kind: 'flagCapture', x: p.x, y: p.y, team: p.team });
    returnFlag(world, enemyFlag);
  }
}

function returnFlag(world: WorldState, flag: FlagState): void {
  const stand = world.map.flagStands?.[flag.team];
  flag.carrier = null;
  flag.status = 'home';
  flag.returnIn = 0;
  if (stand) { flag.x = stand.x; flag.y = stand.y; }
  world.events.push({ t: 'objective', kind: 'flagReturn', x: flag.x, y: flag.y, team: flag.team });
}

// -------------------------------------------------------------- bomb run

function stepBomb(world: WorldState, dt: number): void {
  const o = world.objective;
  const cfg = world.map.bomb;
  if (!o.bomb || !cfg) return;
  const bomb = o.bomb;

  if (bomb.status === 'carried') {
    const carrier = bomb.carrier ? world.players.get(bomb.carrier) : null;
    if (!carrier || !carrier.alive) {
      bomb.carrier = null;
      bomb.status = 'loose';
      bomb.resetIn = OBJECTIVE.BOMB_RESET_TIME;
    } else {
      bomb.x = carrier.x;
      bomb.y = carrier.y;

      // Deliver it into the ENEMY site.
      const site = cfg.sites[carrier.team === 0 ? 1 : 0];
      if (len(carrier.x - site.x, carrier.y - site.y) <= OBJECTIVE.SITE_RADIUS) {
        world.scores[carrier.team] += 1;
        world.events.push({ t: 'objective', kind: 'bombDeliver', x: carrier.x, y: carrier.y, team: carrier.team });
        bomb.carrier = null;
        bomb.status = 'loose';
        bomb.x = cfg.spawn.x;
        bomb.y = cfg.spawn.y;
        bomb.resetIn = OBJECTIVE.BOMB_RESET_TIME;
      }
    }
    return;
  }

  bomb.resetIn -= dt;
  if (bomb.resetIn <= 0) {
    bomb.x = cfg.spawn.x;
    bomb.y = cfg.spawn.y;
    bomb.resetIn = OBJECTIVE.BOMB_RESET_TIME;
  }

  for (const p of world.players.values()) {
    if (!p.alive || p.isDummy) continue;
    if (len(p.x - bomb.x, p.y - bomb.y) > OBJECTIVE.PICKUP_RADIUS + PLAYER.RADIUS) continue;
    bomb.carrier = p.id;
    bomb.status = 'carried';
    world.events.push({ t: 'objective', kind: 'bombTake', x: bomb.x, y: bomb.y, team: p.team });
    break;
  }
}
