/**
 * The authoritative simulation.
 *
 * This module is completely DOM-free and deterministic: given the same world
 * state and the same inputs it always produces the same result. The client runs
 * it for prediction, the Cloudflare Durable Object runs it for authority.
 *
 * Never read wall-clock time or Math.random() in here.
 */

import { COMBAT, DASH, OBJECTIVE, PLAYER, TICK_DT, WALL } from './config.js';
import { circleVsRect, clamp, dot, len, norm, type Rect } from './math.js';
import { createPlayer, type InputCmd, type MapDef, type PlayerState, type SimEvent, type TeamId, type WorldState } from './types.js';
import { BTN } from './types.js';
import { getMap } from './maps.js';
import { createMatch, stepMatch } from './match.js';
import { createObjective, isCarrying, stepObjective } from './objectives.js';
import { dashCooldownOf, maxSpeedOf, resetPowerups, stepPowerups, tickBuffs } from './powerups.js';
import { DEFAULT_MODE, type ModeId } from './config.js';
import {
  applyDamageQueue, pickSpawn, stepProjectiles, tickCombatTimers, tickGun, tickHazards,
  tickRespawn, tickSword, type PendingDamage,
} from './combat.js';

export function createWorld(mapId: string, mode: ModeId = DEFAULT_MODE): WorldState {
  const world: WorldState = {
    tick: 0,
    map: getMap(mapId),
    players: new Map(),
    projectiles: [],
    events: [],
    nextProjectileId: 1,
    scores: [0, 0, 0],
    match: createMatch(mode),
    objective: createObjective(),
    powerups: [],
  };
  // Pads exist from the moment the world does, so practice mode has them too.
  resetPowerups(world);
  return world;
}

/** Adds a player at a fair spawn point for their team. */
export function addPlayer(
  world: WorldState, id: string, name: string, team: TeamId, isDummy = false,
): PlayerState {
  const spot = pickSpawn(world, team);
  const p = createPlayer(id, name, team, spot.x, spot.y, isDummy);
  p.invuln = COMBAT.SPAWN_PROTECT;
  world.players.set(id, p);
  return p;
}

/**
 * Advance the whole world by exactly one tick.
 * Order matters and is fixed so client and server agree:
 *   players -> separation -> projectiles -> damage -> respawns.
 * Damage is collected during the tick and applied in one batch at the end so
 * that simultaneous kills trade instead of being decided by iteration order.
 */

export function stepWorld(world: WorldState, inputs: Map<string, InputCmd>): void {
  const damageQueue: PendingDamage[] = [];

  // Events describe exactly one tick. Clearing here means the array can never
  // grow without bound if a consumer forgets to drain it.
  world.events.length = 0;

  for (const p of world.players.values()) {
    const input = p.isDummy ? undefined : inputs.get(p.id);
    stepPlayer(p, input, world.map, TICK_DT, world.events, isCarrying(world, p.id));
    tickCombatTimers(p, TICK_DT);
    tickBuffs(p, TICK_DT);
    tickGun(world, p, input);
    tickSword(world, p, input, damageQueue);
  }

  separatePlayers(world);
  stepProjectiles(world, TICK_DT, damageQueue);
  applyDamageQueue(world, damageQueue);
  tickHazards(world, TICK_DT);
  stepObjective(world, TICK_DT);
  stepPowerups(world, TICK_DT);

  for (const p of world.players.values()) tickRespawn(world, p, TICK_DT);

  stepMatch(world, TICK_DT);

  world.tick++;
}

/** Balls are solid: they push each other apart and trade a little momentum. */
function separatePlayers(world: WorldState): void {
  const list: PlayerState[] = [];
  for (const p of world.players.values()) if (p.alive) list.push(p);

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minDist = PLAYER.RADIUS * 2;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minDist * minDist || d2 < 1e-9) continue;

      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const overlap = minDist - d;

      // Dummies are immovable posts; live players share the push equally.
      const aFixed = a.isDummy, bFixed = b.isDummy;
      const aShare = aFixed ? 0 : bFixed ? 1 : 0.5;
      const bShare = bFixed ? 0 : aFixed ? 1 : 0.5;

      a.x -= nx * overlap * aShare;
      a.y -= ny * overlap * aShare;
      b.x += nx * overlap * bShare;
      b.y += ny * overlap * bShare;

      const rel = dot(b.vx - a.vx, b.vy - a.vy, nx, ny);
      if (rel < 0) {
        const impulse = -rel * (1 + COMBAT.PLAYER_BOUNCE) * 0.5;
        if (!aFixed) { a.vx -= nx * impulse; a.vy -= ny * impulse; }
        if (!bFixed) { b.vx += nx * impulse; b.vy += ny * impulse; }
      }
    }
  }
}

/**
 * Advance a single player by one fixed timestep.
 * Exported separately so the client can re-run it during reconciliation.
 */
export function stepPlayer(
  p: PlayerState,
  input: InputCmd | undefined,
  map: MapDef,
  dt: number,
  events: SimEvent[] = [],
  /** Carrying a flag or the bomb costs you a little top speed. */
  carrying = false,
): void {
  if (!p.alive || p.isDummy) {
    p.vx = 0; p.vy = 0;
    tickTimers(p, dt);
    return;
  }

  const mx = input ? clamp(input.moveX, -1, 1) : 0;
  const my = input ? clamp(input.moveY, -1, 1) : 0;
  const [dirX, dirY] = norm(mx, my);
  const hasInput = dirX !== 0 || dirY !== 0;

  if (input && (input.aimX !== 0 || input.aimY !== 0)) {
    p.aim = Math.atan2(input.aimY, input.aimX);
  }

  tickTimers(p, dt);

  // ------------------------------------------------------------------ dash
  if (input && (input.buttons & BTN.DASH) !== 0) {
    p.dashBuffer = DASH.BUFFER;
  }
  if (p.dashBuffer > 0 && p.dashCd <= 0) {
    startDash(p, dirX, dirY, hasInput, events);
  }

  // -------------------------------------------------------------- movement
  if (p.dashTime > 0) {
    // Dash burst: pure momentum, no drag, no steering. Snappy and readable.
  } else {
    applyOverspeedDrag(p, dt);
    if (hasInput) {
      const speedBefore = len(p.vx, p.vy);
      const overspeed = speedBefore > maxSpeedOf(p);
      const opposing = dot(dirX, dirY, p.vx, p.vy) < 0;
      let accel = PLAYER.ACCEL * (opposing ? PLAYER.TURN_ASSIST : 1);
      if (overspeed) accel *= PLAYER.OVERSPEED_CONTROL;

      p.vx += dirX * accel * dt;
      p.vy += dirY * accel * dt;

      // Cap at whichever is higher: the normal max, or the speed we already had.
      // Above the cap this turns input into pure steering — you keep dash
      // momentum and can curve it, but you can never accelerate past the cap.
      const base = maxSpeedOf(p);
      const cap = carrying ? base * OBJECTIVE.CARRY_SPEED_MULT : base;
      clampSpeed(p, Math.max(cap, speedBefore));
    } else {
      const f = Math.exp(-PLAYER.FRICTION * dt);
      p.vx *= f;
      p.vy *= f;
      if (len(p.vx, p.vy) < PLAYER.REST_SPEED) { p.vx = 0; p.vy = 0; }
    }
  }

  // ------------------------------------------------- integrate + collide
  integrateAndCollide(p, map.walls, dt, events);
  detectWallContact(p, map.walls);

  // Wall contact tops up your dash so wall play stays fast — but not free.
  if (p.onWall && p.dashCd > WALL.DASH_REFUND_TO) {
    p.dashCd = WALL.DASH_REFUND_TO;
  }
}

// --------------------------------------------------------------- internals

function tickTimers(p: PlayerState, dt: number): void {
  if (p.dashCd > 0) p.dashCd = Math.max(0, p.dashCd - dt);
  if (p.dashTime > 0) p.dashTime = Math.max(0, p.dashTime - dt);
  if (p.dashBuffer > 0) p.dashBuffer = Math.max(0, p.dashBuffer - dt);
  p.wallCoyote += dt;
}

function startDash(p: PlayerState, dirX: number, dirY: number, hasInput: boolean, events: SimEvent[]): void {
  let dx = dirX, dy = dirY;

  if (!hasInput) {
    // No stick input: dash the way you're already moving, else where you aim.
    const [vx, vy] = norm(p.vx, p.vy);
    if (vx !== 0 || vy !== 0) { dx = vx; dy = vy; }
    else { dx = Math.cos(p.aim); dy = Math.sin(p.aim); }
  }

  const nearWall = p.onWall || p.wallCoyote < WALL.COYOTE;

  if (nearWall) {
    // WALL DASH — blend the wall normal in so you always kick away from it.
    const bx = dx + p.wallNx * WALL.DASH_NORMAL_MIX;
    const by = dy + p.wallNy * WALL.DASH_NORMAL_MIX;
    let [ux, uy] = norm(bx, by);
    if (ux === 0 && uy === 0) { ux = p.wallNx; uy = p.wallNy; }
    p.vx = ux * WALL.DASH_SPEED;
    p.vy = uy * WALL.DASH_SPEED;
    p.dashDirX = ux; p.dashDirY = uy;
    p.wallCoyote = 999;          // consume the wall, no double-dipping
    p.onWall = false;
    events.push({ t: 'walldash', who: p.id, x: p.x, y: p.y, dx: ux, dy: uy });
  } else {
    p.vx = dx * DASH.SPEED;
    p.vy = dy * DASH.SPEED;
    p.dashDirX = dx; p.dashDirY = dy;
    events.push({ t: 'dash', who: p.id, x: p.x, y: p.y, dx, dy });
  }

  p.dashTime = DASH.DURATION;
  p.dashCd = dashCooldownOf(p);
  p.dashBuffer = 0;
}

function applyOverspeedDrag(p: PlayerState, dt: number): void {
  const s = len(p.vx, p.vy);
  const cap = maxSpeedOf(p);
  if (s <= cap) return;
  // Bleed only the excess, so you decay *to* max speed rather than to zero.
  const excess = (s - cap) * Math.exp(-PLAYER.OVERSPEED_DRAG * dt);
  const target = cap + excess;
  const k = target / s;
  p.vx *= k;
  p.vy *= k;
}

function clampSpeed(p: PlayerState, max: number): void {
  const s = len(p.vx, p.vy);
  if (s > max && s > 1e-9) {
    const k = max / s;
    p.vx *= k;
    p.vy *= k;
  }
}

/**
 * Move and resolve against walls. Substeps whenever a single tick would move
 * the player more than half its radius, so nothing can ever tunnel through a
 * thin wall no matter how fast a future mechanic makes us go.
 */
function integrateAndCollide(p: PlayerState, walls: Rect[], dt: number, events: SimEvent[]): void {
  const speed = len(p.vx, p.vy);
  const steps = Math.max(1, Math.ceil((speed * dt) / (PLAYER.RADIUS * 0.5)));
  const sdt = dt / steps;

  for (let s = 0; s < steps; s++) {
    p.x += p.vx * sdt;
    p.y += p.vy * sdt;
    resolveWalls(p, walls, events);
  }
}

function resolveWalls(p: PlayerState, walls: Rect[], events: SimEvent[]): void {
  // Two passes so corners (two walls at once) settle cleanly.
  for (let pass = 0; pass < 2; pass++) {
    let touched = false;
    for (let i = 0; i < walls.length; i++) {
      const hit = circleVsRect(p.x, p.y, PLAYER.RADIUS, walls[i]);
      if (!hit.hit) continue;
      touched = true;

      p.x += hit.nx * hit.depth;
      p.y += hit.ny * hit.depth;

      const vn = dot(p.vx, p.vy, hit.nx, hit.ny);
      if (vn < 0) {
        const impact = -vn;
        const restitution = p.dashTime > 0 ? WALL.DASH_BOUNCE : WALL.BOUNCE;
        p.vx -= hit.nx * vn * (1 + restitution);
        p.vy -= hit.ny * vn * (1 + restitution);
        if (impact > 220) {
          events.push({ t: 'wallhit', who: p.id, x: p.x, y: p.y, nx: hit.nx, ny: hit.ny, speed: impact });
        }
      }
    }
    if (!touched) break;
  }
}

/** Re-checks walls with a small skin so "hugging" a wall registers as contact. */
function detectWallContact(p: PlayerState, walls: Rect[]): void {
  let bestDepth = -1;
  let nx = 0, ny = 0;

  for (let i = 0; i < walls.length; i++) {
    const hit = circleVsRect(p.x, p.y, PLAYER.RADIUS, walls[i], WALL.TOUCH_EPS);
    if (hit.hit && hit.depth > bestDepth) {
      bestDepth = hit.depth;
      nx = hit.nx; ny = hit.ny;
    }
  }

  if (bestDepth >= 0) {
    p.onWall = true;
    p.wallNx = nx;
    p.wallNy = ny;
    p.wallCoyote = 0;
  } else {
    p.onWall = false;
  }
}
