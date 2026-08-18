/**
 * Wire protocol between the browser and the Durable Object room server.
 *
 * Design rules:
 *  - JSON. It is debuggable, it is fast enough at these sizes, and "simple and
 *    reliable" beats "clever" for a game people play with friends.
 *  - Everyone else's state is sent in compact arrays (rendering only).
 *  - Your OWN state is sent in full, because the client re-simulates from it.
 *  - The client never sends state, only intent. The server owns the truth.
 */

import type { InputCmd, PlayerState, Powerup, SimEvent, TeamId } from './types.js';
import type { MatchState } from './match.js';
import type { ObjectiveState } from './objectives.js';
import type { ModeId } from './config.js';

export const PROTOCOL_VERSION = 1;

/** Bit flags packed into compact player rows. */
export const PF = {
  ALIVE: 1 << 0,
  ON_WALL: 1 << 1,
  DASHING: 1 << 2,
  RELOADING: 1 << 3,
  INVULN: 1 << 4,
  SWINGING: 1 << 5,
  SWORD_LIVE: 1 << 6,
} as const;

// ------------------------------------------------------------ client -> server
export type ClientMsg =
  | { t: 'hello'; v: number; name: string }
  | { t: 'in'; c: WireInput[] }
  | { t: 'ping'; id: number }
  | { t: 'rematch' }
  | { t: 'setMode'; mode: ModeId }
  | { t: 'setMap'; mapId: string };

/** [seq, moveX, moveY, aimAngle, buttons] — aim is an angle, not a vector. */
export type WireInput = [number, number, number, number, number];

export function packInput(c: InputCmd): WireInput {
  return [
    c.seq,
    c.moveX,
    c.moveY,
    Math.round(Math.atan2(c.aimY, c.aimX) * 1000) / 1000,
    c.buttons,
  ];
}

export function unpackInput(w: WireInput): InputCmd {
  const aim = w[3];
  return {
    seq: w[0],
    moveX: clamp1(w[1]),
    moveY: clamp1(w[2]),
    aimX: Math.cos(aim),
    aimY: Math.sin(aim),
    buttons: w[4] | 0,
  };
}

function clamp1(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

// ------------------------------------------------------------ server -> client
export interface RosterEntry {
  id: string;
  name: string;
  team: TeamId;
}

export type ServerMsg =
  | { t: 'welcome'; v: number; id: string; room: string; mapId: string; tick: number }
  | { t: 'settings'; mode: ModeId; mapId: string }
  | { t: 'roster'; players: RosterEntry[] }
  | { t: 'snap'; k: number; a: number; p: WirePlayer[]; b: WireBullet[]; s: [number, number, number]; e: SimEvent[]; me: PlayerState | null; m: MatchState; o: ObjectiveState; u: Powerup[] }
  | { t: 'pong'; id: number }
  | { t: 'full' }
  | { t: 'error'; msg: string };

/** [id, x, y, vx, vy, aim, hp, flags, swordAim, swordT, kills, deaths] */
export type WirePlayer = [string, number, number, number, number, number, number, number, number, number, number, number];

/** [id, x, y, vx, vy, team] */
export type WireBullet = [number, number, number, number, number, number];

const r1 = (n: number): number => Math.round(n * 10) / 10;
const r3 = (n: number): number => Math.round(n * 1000) / 1000;

export function packPlayer(p: PlayerState): WirePlayer {
  let flags = 0;
  if (p.alive) flags |= PF.ALIVE;
  if (p.onWall) flags |= PF.ON_WALL;
  if (p.dashTime > 0) flags |= PF.DASHING;
  if (p.reloadTime > 0) flags |= PF.RELOADING;
  if (p.invuln > 0) flags |= PF.INVULN;
  if (p.swordTime > 0) flags |= PF.SWINGING;
  return [
    p.id, r1(p.x), r1(p.y), Math.round(p.vx), Math.round(p.vy),
    r3(p.aim), Math.round(p.health), flags, r3(p.swordAim), r3(p.swordTime),
    p.kills, p.deaths,
  ];
}
