/** Core shared types for the simulation. Kept DOM-free so the server can use them. */

import type { Rect } from './math.js';
import type { MatchState } from './match.js';
import type { ObjectiveState } from './objectives.js';
import { GUN, PLAYER, type PowerupKind } from './config.js';

// ------------------------------------------------------------------- input
export const BTN = {
  DASH: 1 << 0,
  SHOOT: 1 << 1,
  SWORD: 1 << 2,
  RELOAD: 1 << 3,
} as const;

/** One tick of player intent. This is the only thing a client is allowed to send. */
export interface InputCmd {
  /** Monotonic sequence number, used for prediction reconciliation. */
  seq: number;
  /** Desired move direction, each component clamped to [-1, 1]. */
  moveX: number;
  moveY: number;
  /** Aim direction (unit vector). */
  aimX: number;
  aimY: number;
  /** Bitmask of BTN.* held/pressed this tick. */
  buttons: number;
}

export function emptyInput(seq = 0): InputCmd {
  return { seq, moveX: 0, moveY: 0, aimX: 1, aimY: 0, buttons: 0 };
}

// ------------------------------------------------------------------ player
export type TeamId = 0 | 1 | 2; // 0 = red, 1 = blue, 2 = neutral/FFA

export interface PlayerState {
  id: string;
  name: string;
  team: TeamId;
  /** Stationary training target: never moves, never shoots back. */
  isDummy: boolean;

  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Aim angle in radians. */
  aim: number;

  health: number;
  alive: boolean;
  /** Seconds of remaining spawn protection (also blocks attacking). */
  invuln: number;
  /** Seconds until respawn while dead. */
  respawnIn: number;
  /** Seconds spent standing in a hazard; past the grace period you fall. */
  hazardTime: number;
  /** Who last damaged you, for crediting environmental kills. */
  lastHitBy: string;
  /** Seconds since that hit, so old credit expires. */
  lastHitAgo: number;
  kills: number;
  deaths: number;

  // --- gun
  ammo: number;
  /** Seconds until the next shot is allowed. */
  fireCd: number;
  /** Seconds remaining in a reload (0 = not reloading). */
  reloadTime: number;

  // --- sword
  /** Seconds until the sword can be swung again. */
  swordCd: number;
  /** Seconds elapsed into the current swing (0 = idle). */
  swordTime: number;
  /** Aim angle captured at the moment the swing started. */
  swordAim: number;
  /** Whether the current swing has already connected (one target per swing). */
  swordConsumed: boolean;

  // --- dash
  dashCd: number;
  dashTime: number;
  dashDirX: number;
  dashDirY: number;
  dashBuffer: number;

  // --- wall state
  wallCoyote: number;
  wallNx: number;
  wallNy: number;
  onWall: boolean;

  // --- powerup buffs. Timers in seconds; shield is a damage pool.
  shield: number;
  buffSpeed: number;
  buffRapid: number;
  buffDamage: number;
  buffDash: number;

  // --- cosmetic, derived from the sim so it stays in sync over the network
  hitFlash: number;
}

export interface Powerup {
  id: number;
  kind: PowerupKind;
  x: number;
  y: number;
  /** Seconds until it comes back; 0 means it is on the pad right now. */
  respawnIn: number;
}

export function createPlayer(
  id: string, name: string, team: TeamId, x: number, y: number, isDummy = false,
): PlayerState {
  return {
    id, name, team, isDummy,
    x, y, vx: 0, vy: 0, aim: 0,
    health: PLAYER.HEALTH, alive: true, invuln: 0, respawnIn: 0,
    hazardTime: 0, lastHitBy: '', lastHitAgo: 999, kills: 0, deaths: 0,
    ammo: GUN.MAG_SIZE, fireCd: 0, reloadTime: 0,
    swordCd: 0, swordTime: 0, swordAim: 0, swordConsumed: false,
    dashCd: 0, dashTime: 0, dashDirX: 0, dashDirY: 0, dashBuffer: 0,
    shield: 0, buffSpeed: 0, buffRapid: 0, buffDamage: 0, buffDash: 0,
    wallCoyote: 999, wallNx: 0, wallNy: 0, onWall: false,
    hitFlash: 0,
  };
}

// -------------------------------------------------------------- projectiles
export interface Projectile {
  id: number;
  owner: string;
  team: TeamId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Distance travelled so far; the bullet dies past GUN.RANGE. */
  travelled: number;
  damage: number;
}

// ------------------------------------------------------------------ events
/** Transient things the renderer/audio layer reacts to. Never gameplay state. */
export type SimEvent =
  /* `who` marks events the client also predicts locally, so it can ignore the
     server's copy instead of playing the effect twice. */
  | { t: 'dash'; who: string; x: number; y: number; dx: number; dy: number }
  | { t: 'walldash'; who: string; x: number; y: number; dx: number; dy: number }
  | { t: 'wallhit'; who: string; x: number; y: number; nx: number; ny: number; speed: number }
  | { t: 'shoot'; x: number; y: number; dx: number; dy: number }
  | { t: 'reload'; x: number; y: number }
  | { t: 'bulletwall'; x: number; y: number; nx: number; ny: number }
  | { t: 'hit'; x: number; y: number; dx: number; dy: number; damage: number; target: string }
  | { t: 'swing'; x: number; y: number; aim: number }
  | { t: 'swordhit'; x: number; y: number; aim: number; target: string }
  | { t: 'death'; x: number; y: number; team: TeamId; victim: string; killer: string; weapon: 'gun' | 'sword' | 'fall' }
  | { t: 'fall'; x: number; y: number; team: TeamId; victim: string }
  | { t: 'pickup'; x: number; y: number; kind: string; who: string }
  | { t: 'respawn'; x: number; y: number; team: TeamId; id: string }
  | { t: 'phase'; phase: string; winnerTeam?: TeamId | null; winnerId?: string | null }
  | { t: 'objective'; kind: string; x: number; y: number; team: TeamId };

// -------------------------------------------------------------------- world
export interface MapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Solid, non-moving blockers (arena border included). */
  walls: Rect[];
  /**
   * Holes in the floor. You can move over them, but standing in one kills you
   * shortly after — which makes sword knockback and dash bounces lethal here.
   */
  hazards?: Rect[];
  /** Spawn points per team index; index 2 = FFA pool. */
  spawns: { x: number; y: number }[][];

  // --- objective mode fixtures. A map only needs these for modes it supports.
  /** King of the hill control zone. */
  hill?: { x: number; y: number; r: number };
  /** Flag stands, indexed by defending team. */
  flagStands?: { x: number; y: number }[];
  /** Bomb spawn plus the two delivery sites, indexed by team. */
  bomb?: { spawn: { x: number; y: number }; sites: { x: number; y: number }[] };
  /** Powerup pads. Kinds cycle deterministically so nothing depends on RNG. */
  powerupPads?: { x: number; y: number }[];
}

export interface WorldState {
  tick: number;
  map: MapDef;
  players: Map<string, PlayerState>;
  projectiles: Projectile[];
  /** Holds exactly one tick of events; cleared at the top of every step. */
  events: SimEvent[];
  nextProjectileId: number;
  /** Kills per team, indexed by TeamId. Index 2 is unused in team modes. */
  scores: [number, number, number];
  /** Lobby / countdown / live / results, owned by the server. */
  match: MatchState;
  /** Hill / flags / bomb state for objective modes. */
  objective: ObjectiveState;
  /** Map powerups, one per pad. */
  powerups: Powerup[];
}
