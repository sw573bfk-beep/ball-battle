/**
 * SWORD ARENA — every balance number lives here.
 * Units: pixels and seconds. The sim runs on a fixed timestep.
 */

export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;
export const MAX_CATCHUP_TICKS = 5;

export const PLAYER = {
  RADIUS: 22,
  HEALTH: 100,
  ACCEL: 1700,
  MAX_SPEED: 165,
  FRICTION: 8,
  /** Each held sword slows you by this fraction, so hoarding has a cost. */
  SLOW_PER_SWORD: 0.035,
  /** Players bump off each other with this restitution. */
  BOUNCE: 0.5,
  RESPAWN_TIME: 2.5,
  SPAWN_PROTECT: 1.5,
  /** Swords you respawn with. */
  START_SWORDS: 1,
  /** Healing granted to the killer. */
  KILL_HEAL: 20,
} as const;

export const DASH = {
  SPEED: 820,
  DURATION: 0.14,
  COOLDOWN: 1.8,
} as const;

export const SWORD = {
  MAX_HELD: 8,
  /** Gap between ball edge and the hilt (px). */
  HILT_GAP: 4,
  /** Blade length, hilt to tip (px). */
  LENGTH: 42,
  /** Collision half-thickness of a blade (px). */
  THICKNESS: 4,
  /** Orbit speed (rad/s). */
  SPIN: 4.2,
  /** One sword can only hit the same target this often (s). */
  HIT_COOLDOWN: 0.45,
  ORBIT_KNOCKBACK: 380,
  /**
   * A spinning blade that hits you knocks one of your swords off. It slides
   * about 7 ball-widths away before stopping (px).
   */
  KNOCKOFF_DISTANCE: 7 * 44,
  /** Two enemy orbits touching shove both owners apart. */
  CLASH_PUSH: 260,
  CLASH_COOLDOWN: 0.25,

  THROW_SPEED: 980,
  THROW_RANGE: 900,
  THROW_COOLDOWN: 0.3,
  THROW_KNOCKBACK: 520,
  /** Visual spin of a sword in flight (rad/s). */
  THROW_SPIN: 22,
  /** Collision radius of a flying sword. */
  THROWN_RADIUS: 12,
  /** The thrower can't be hit by their own sword for this long (s). */
  SELF_SAFE: 0.25,

  PICKUP_RADIUS: 18,
  /** Spawned floor swords vanish after this long if nobody wants them (s). */
  FLOOR_LIFETIME: 40,
  /** Floor swords slide (e.g. when scattered by a death) and slow down. */
  FLOOR_FRICTION: 5,
  /** A knocked-off sword can't be grabbed until it has flown clear (s). */
  KNOCKOFF_LOCK: 0.35,
  /** Past this many floor swords, the oldest start fading out. */
  FLOOR_CAP: 36,
  /** Fade time for swords over the cap (s). */
  FLOOR_FADE: 2.5,
  /**
   * How much of a flying sword can be caught by an orbiting blade (both
   * swords break). Smaller than its hit radius so a big orbit is a partial
   * shield, not a perfect one.
   */
  DEFLECT_RADIUS: 5,
} as const;

/** Sword tiers. Rarer swords hit harder. */
export const TIERS = [
  { name: 'Iron', orbitDamage: 12, throwDamage: 30, weight: 70 },
  { name: 'Ruby', orbitDamage: 16, throwDamage: 40, weight: 22 },
  { name: 'Gold', orbitDamage: 22, throwDamage: 55, weight: 8 },
] as const;
export type Tier = 0 | 1 | 2;

export const SPAWNER = {
  /**
   * How often the arena tries to add a floor sword (s). Fast, because hits
   * break and knock off swords all the time.
   */
  INTERVAL: 0.5,
  /** Floor sword target = BASE + PER_PLAYER * players. */
  BASE: 6,
  PER_PLAYER: 2,
  /** Don't spawn a sword this close to a player (px). */
  MIN_PLAYER_DIST: 160,
} as const;

export const CRATE = {
  SIZE: 46,
  HEALTH: 3,
  RESPAWN: 22,
  /** Chance a broken crate drops a sword; otherwise it drops health. */
  SWORD_CHANCE: 0.6,
  /** Chance a crate's sword is upgraded one tier above a normal roll. */
  UPGRADE_CHANCE: 0.35,
} as const;

export const HEALTH_PACK = {
  AMOUNT: 35,
  RADIUS: 16,
  RESPAWN: 14,
  /** Health dropped from crates disappears after this long (s). */
  LOOSE_LIFETIME: 20,
} as const;

export const MATCH = {
  KILL_TARGET: 15,
  DURATION: 180,
  /** Short pause before everyone can move. */
  COUNTDOWN: 3,
} as const;

export const BOT = {
  /** Seconds between path recomputes. */
  REPATH: 0.45,
  /** Grid cell size used for bot pathfinding (px). */
  NAV_CELL: 40,
  DIFFICULTY: {
    easy: { aimError: 0.32, reaction: 0.55, throwChance: 0.35, dashChance: 0.1, lead: 0.2, skill: 0.6 },
    normal: { aimError: 0.16, reaction: 0.3, throwChance: 0.6, dashChance: 0.35, lead: 0.6, skill: 0.85 },
    hard: { aimError: 0.06, reaction: 0.14, throwChance: 0.85, dashChance: 0.6, lead: 1.0, skill: 1.0 },
  },
} as const;
export type Difficulty = keyof typeof BOT.DIFFICULTY;

export const COLORS = [
  '#ff5470', '#3fa7ff', '#ffd23f', '#5ce18b', '#c77dff',
  '#ff8c42', '#2ee6d6', '#ff6ec7', '#a3e635', '#f4f4f5',
] as const;
