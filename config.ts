/**
 * BALL COMBAT — central balance & tuning.
 * Every gameplay number lives here. Nothing gameplay-related should be
 * hard-coded anywhere else in the codebase.
 *
 * Units: pixels, seconds. The simulation runs at a fixed timestep so that the
 * client prediction and the server authority produce identical results.
 */

// ---------------------------------------------------------------- simulation
export const TICK_RATE = 60;                 // simulation ticks per second
export const TICK_DT = 1 / TICK_RATE;        // fixed timestep (s)
export const MAX_CATCHUP_TICKS = 5;          // anti spiral-of-death clamp

// -------------------------------------------------------------------- player
export const PLAYER = {
  RADIUS: 16,
  HEALTH: 100,

  /** Ground acceleration while a direction is held (px/s^2). */
  ACCEL: 5200,
  /** Hard cap on normal (non-dash) movement speed (px/s). */
  MAX_SPEED: 400,
  /** Exponential velocity decay per second when no input is held. */
  FRICTION: 9.0,
  /** Below this speed with no input, snap to a true stop (px/s). */
  REST_SPEED: 3,
  /** Extra decay applied when moving faster than MAX_SPEED (post-dash bleed). */
  OVERSPEED_DRAG: 3.4,
  /** How sharply the player can reverse direction. 1 = normal, >1 = snappier. */
  TURN_ASSIST: 2.1,
  /**
   * Fraction of normal acceleration available while above MAX_SPEED. This is
   * steering authority only — input can never *increase* your speed above the
   * cap, it can only redirect momentum you already earned from a dash/bounce.
   */
  OVERSPEED_CONTROL: 0.55,
} as const;

// ---------------------------------------------------------------------- dash
export const DASH = {
  /** Launch speed of a dash (px/s). */
  SPEED: 1150,
  /** How long the dash "locks in" its burst (s). */
  DURATION: 0.13,
  /** Cooldown from dash start until the next dash is available (s). */
  COOLDOWN: 1.1,
  /** Input buffer: a dash press is remembered this long (s). */
  BUFFER: 0.12,
} as const;

// ------------------------------------------------------------- wall movement
export const WALL = {
  /** Restitution when bouncing off a wall mid-dash. 0 = dead stop, 1 = perfect. */
  DASH_BOUNCE: 0.86,
  /** Restitution for a normal (non-dash) wall hit. Low so walls feel solid. */
  BOUNCE: 0.08,
  /** Tangential velocity kept when sliding along a wall (per second decay). */
  SLIDE_FRICTION: 1.6,
  /** Distance from a wall that still counts as "touching" (px). */
  TOUCH_EPS: 3.0,
  /** Grace period after leaving a wall where a wall-dash still works (s). */
  COYOTE: 0.12,
  /**
   * Touching a wall caps your remaining dash cooldown to this (s), so skilled
   * players can chain wall-dashes quickly — but not infinitely.
   */
  DASH_REFUND_TO: 0.22,
  /** Speed of a wall dash — slightly hotter than a normal dash. */
  DASH_SPEED: 1300,
  /** How much the wall normal is mixed into the wall-dash direction (0..1). */
  DASH_NORMAL_MIX: 0.55,
} as const;

// ----------------------------------------------------------------------- gun
export const GUN = {
  DAMAGE: 22,                  // 5 shots to drop a full-health player
  PROJECTILE_SPEED: 1000,
  PROJECTILE_RADIUS: 4.5,
  /** How far a bullet travels before it fizzles out (px). */
  RANGE: 760,
  /** Seconds between shots while holding fire. */
  FIRE_INTERVAL: 0.15,
  MAG_SIZE: 12,
  RELOAD_TIME: 1.35,
  /**
   * Random cone, in radians. Deliberately 0: aim should be a pure skill test,
   * and zero spread also keeps the sim perfectly deterministic for the server.
   */
  SPREAD: 0,
  /** Pushback applied to the shooter per shot (px/s). Adds a little weight. */
  RECOIL: 60,
  /** How far from the player centre a bullet spawns (px). */
  MUZZLE_OFFSET: 20,
} as const;

// --------------------------------------------------------------------- sword
export const SWORD = {
  /** Reach measured from the player's centre. Player radius is 16. */
  RANGE: 54,
  /** Total width of the swing arc (radians). */
  ARC: Math.PI * 0.62,
  /** Telegraph before the hitbox goes live (s) — this is the counterplay window. */
  WINDUP: 0.07,
  /** How long the hitbox stays live (s). */
  ACTIVE: 0.09,
  /** Time from swing start until you can swing again (s). */
  COOLDOWN: 0.62,
  /** Forward impulse on swing (px/s) so committing to a swing means something. */
  LUNGE: 340,
} as const;

// -------------------------------------------------------------------- combat
export const COMBAT = {
  /** Hit-flash duration (s). Cosmetic, but derived from the sim so it syncs. */
  HIT_FLASH: 0.14,
  /** Seconds a corpse waits before respawning. */
  RESPAWN_TIME: 2.0,
  /** Invulnerable + unable to attack for this long after respawning (s). */
  SPAWN_PROTECT: 1.25,
  /** Teammates cannot damage each other when false. */
  FRIENDLY_FIRE: false,
  /** How bouncy player-vs-player collisions are. */
  PLAYER_BOUNCE: 0.35,
  /**
   * Grace period inside a hazard before you fall (s). Short enough to be
   * lethal, long enough that dashing across a gap is a real option.
   */
  HAZARD_GRACE: 0.22,
  /** Kill credit for an environmental death expires after this long (s). */
  ASSIST_WINDOW: 5,
} as const;

// --------------------------------------------------------------------- match
export const MATCH = {
  /** A match will not start until this many players are in the room. */
  MIN_PLAYERS: 2,
  /** 3 - 2 - 1 - GO. */
  COUNTDOWN: 3,
  /** How long the results screen stays up before the next match starts. */
  RESULTS: 9,
  /** How long "GO!" stays on screen once the match starts. */
  GO_FLASH: 0.9,
  /** Players can move and shoot in the lobby, but nothing is scored. */
  WARMUP_SCORING: false,
} as const;

/**
 * Per-mode rules. Adding a mode is adding an entry here plus a win condition
 * in shared/match.ts — nothing else in the codebase needs to change.
 */
export const MODE_RULES = {
  duel: {
    name: 'Duel', teamBased: false, objective: 'kills',
    scoreTarget: 10, duration: 180, minPlayers: 2, unit: 'KILLS',
  },
  tdm: {
    name: 'Team Deathmatch', teamBased: true, objective: 'kills',
    scoreTarget: 20, duration: 300, minPlayers: 2, unit: 'KILLS',
  },
  ffa: {
    name: 'Free For All', teamBased: false, objective: 'kills',
    scoreTarget: 15, duration: 240, minPlayers: 2, unit: 'KILLS',
  },
  koth: {
    name: 'King of the Hill', teamBased: true, objective: 'hill',
    scoreTarget: 100, duration: 300, minPlayers: 2, unit: 'POINTS',
  },
  ctf: {
    name: 'Capture the Flag', teamBased: true, objective: 'flags',
    scoreTarget: 3, duration: 360, minPlayers: 2, unit: 'CAPTURES',
  },
  bomb: {
    name: 'Bomb Run', teamBased: true, objective: 'bomb',
    scoreTarget: 3, duration: 300, minPlayers: 2, unit: 'DELIVERIES',
  },
} as const;

export type ModeId = keyof typeof MODE_RULES;
export const DEFAULT_MODE: ModeId = 'tdm';

/** Objective tuning. Same rule as everything else: numbers live here only. */
export const OBJECTIVE = {
  /** King of the hill: points per second for the team holding the zone. */
  HILL_POINTS_PER_SEC: 4,
  /** Contested (both teams inside) freezes scoring instead of splitting it. */
  HILL_RADIUS: 96,
  /** Capture the flag: how long a dropped flag waits before returning home. */
  FLAG_RETURN_TIME: 12,
  /** Radius within which you pick up a flag or the bomb. */
  PICKUP_RADIUS: 30,
  /** Carriers move at this fraction of normal speed — carrying costs you. */
  CARRY_SPEED_MULT: 0.88,
  /** Bomb: radius of a delivery site. */
  SITE_RADIUS: 70,
  /** Seconds a dropped bomb waits before resetting to the middle. */
  BOMB_RESET_TIME: 15,
} as const;

// ------------------------------------------------------------------ powerups
/**
 * Deliberately mild. A powerup should win you an even fight, never an uneven
 * one — skill stays the deciding factor, per the design brief.
 */
export const POWERUP = {
  /** Seconds before a taken pad refills. */
  RESPAWN: 18,
  /** Pickup radius, measured from the pad centre. */
  RADIUS: 18,
  /** How long the timed buffs last. */
  DURATION: 8,

  HEALTH_AMOUNT: 40,
  SPEED_MULT: 1.18,
  RAPID_MULT: 0.62,
  DAMAGE_MULT: 1.35,
  DASH_MULT: 0.55,
  SHIELD_AMOUNT: 45,
} as const;

export const POWERUP_KINDS = ['health', 'speed', 'shield', 'rapid', 'damage', 'dash'] as const;
export type PowerupKind = (typeof POWERUP_KINDS)[number];

// -------------------------------------------------------------------- arena
export const ARENA = {
  /** Logical arena size. Rendering letterboxes this to fit any screen. */
  WIDTH: 1280,
  HEIGHT: 720,
  WALL_THICKNESS: 32,
} as const;

// ------------------------------------------------------------------ controls
/** Default key bindings. Overridable from the settings menu (Milestone 13). */
export const DEFAULT_BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  dash: ['Space'],
  sword: ['KeyE', 'ShiftLeft'],   // used from Milestone 2
  reload: ['KeyR'],               // used from Milestone 2
  scoreboard: ['Tab'],
} as const;

export type BindingAction = keyof typeof DEFAULT_BINDINGS;

// ------------------------------------------------------------------ networking
export const NET = {
  SNAPSHOT_RATE: 20,              // server -> client snapshots per second
  INPUT_RATE: 60,                 // client -> server input packets per second
  INTERP_DELAY_MS: 100,           // remote entity interpolation buffer
} as const;
