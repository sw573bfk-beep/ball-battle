/** Shared, DOM-free game state types. */

import type { Rect } from './math.js';
import type { Tier } from './config.js';

/** One tick of player intent — the only thing a player (or a bot) controls. */
export interface InputCmd {
  /** Desired move direction, each axis in [-1, 1]. */
  moveX: number;
  moveY: number;
  /** Aim direction (does not need to be normalised). */
  aimX: number;
  aimY: number;
  /** Pressed this tick (edge, not held). */
  throw: boolean;
  dash: boolean;
}

export const emptyInput = (): InputCmd => ({ moveX: 0, moveY: 0, aimX: 1, aimY: 0, throw: false, dash: false });

export interface Player {
  id: string;
  name: string;
  color: string;
  isBot: boolean;

  x: number;
  y: number;
  vx: number;
  vy: number;
  aim: number;

  health: number;
  alive: boolean;
  respawnIn: number;
  /** Spawn protection: can't be hurt and can't hurt (s). */
  protect: number;
  kills: number;
  deaths: number;
  streak: number;
  /** Who hit you last — gets the kill if you die. */
  lastHitBy: string;

  /** Tiers of the swords orbiting you, in orbit order. */
  swords: Tier[];
  /** Current orbit angle of sword 0 (rad). */
  spin: number;
  throwCd: number;
  dashCd: number;
  dashTime: number;
  dashX: number;
  dashY: number;
  clashCd: number;
  /** Per "target:swordIndex" cooldowns so one blade can't shred someone every tick. */
  hitCds: Record<string, number>;

  /** Cosmetic, but sim-driven so it would sync over a network. */
  hitFlash: number;
}

export interface ThrownSword {
  id: number;
  owner: string;
  tier: Tier;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  travelled: number;
  age: number;
}

export interface FloorSword {
  id: number;
  tier: Tier;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  /** Seconds left before it disappears. */
  ttl: number;
  /** Who dropped it and how long until they may re-grab it. */
  droppedBy: string;
  noPickup: number;
}

export interface Crate {
  id: number;
  x: number;
  y: number;
  health: number;
  /** 0 while standing; counts down while broken. */
  respawnIn: number;
  /** Brief immunity after a hit so one swing = one hit. */
  hitCd: number;
}

export interface HealthPack {
  id: number;
  x: number;
  y: number;
  /** Fixed pads respawn; loose packs from crates expire instead. */
  fixed: boolean;
  respawnIn: number;
  ttl: number;
}

export interface MapDef {
  name: string;
  width: number;
  height: number;
  walls: Rect[];
  crates: { x: number; y: number }[];
  healthPads: { x: number; y: number }[];
  spawns: { x: number; y: number }[];
}

export type Phase = 'countdown' | 'playing' | 'over';

export type SimEvent =
  | { t: 'throw'; x: number; y: number; who: string }
  | { t: 'hit'; x: number; y: number; target: string; by: string; damage: number; thrown: boolean }
  | { t: 'clash'; x: number; y: number }
  | { t: 'deflect'; x: number; y: number }
  | { t: 'stick'; x: number; y: number }
  | { t: 'pickup'; x: number; y: number; who: string; tier: Tier }
  | { t: 'heal'; x: number; y: number; who: string }
  | { t: 'crate'; x: number; y: number; broken: boolean }
  | { t: 'dash'; x: number; y: number; who: string }
  | { t: 'death'; x: number; y: number; victim: string; killer: string; color: string }
  | { t: 'respawn'; x: number; y: number; who: string }
  | { t: 'over'; winner: string };

export interface World {
  tick: number;
  time: number;
  rng: { seed: number };
  map: MapDef;
  players: Player[];
  thrown: ThrownSword[];
  floor: FloorSword[];
  crates: Crate[];
  health: HealthPack[];
  nextId: number;
  spawnTimer: number;
  phase: Phase;
  /** Seconds left in the countdown, or in the match while playing. */
  clock: number;
  winner: string;
  /** Exactly one tick of events; cleared at the top of each step. */
  events: SimEvent[];
}
