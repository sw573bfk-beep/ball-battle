/**
 * Weapons, damage, death and respawn. DOM-free and deterministic, same as the
 * rest of `shared/` — the server runs this exact code as the authority.
 */

import { COMBAT, GUN, PLAYER, SWORD } from './config.js';
import { angleDelta, circleVsRect, len, norm, segmentBlocked } from './math.js';
import { BTN, type InputCmd, type PlayerState, type Projectile, type TeamId, type WorldState } from './types.js';
import { isScoring } from './match.js';
import { dropCarried } from './objectives.js';
import { absorb, clearBuffs, fireIntervalOf, gunDamageOf } from './powerups.js';

/**
 * Damage detected during a tick, applied all at once at the end of it.
 *
 * Two-phase application is what makes simultaneous kills work: if two players
 * land lethal hits on the same tick, both hits are detected against the state
 * at the *start* of the tick, so both land and both players die. Applying
 * damage immediately would let whoever happened to be iterated first survive.
 */
export interface PendingDamage {
  victim: string;
  attacker: string;
  amount: number;
  nx: number;
  ny: number;
  weapon: 'gun' | 'sword';
}

// --------------------------------------------------------------- targeting

/** Can `attacker` legally damage `victim`? */
export function canDamage(attacker: PlayerState, victim: PlayerState): boolean {
  if (attacker.id === victim.id) return false;
  if (!victim.alive || victim.invuln > 0) return false;
  if (COMBAT.FRIENDLY_FIRE) return true;
  // Team 2 is the free-for-all bucket: everyone in it fights everyone.
  if (attacker.team === 2 || victim.team === 2) return true;
  return attacker.team !== victim.team;
}

/** A player who is dead, reloading into existence, or spawn-protected can't attack. */
function canAct(p: PlayerState): boolean {
  return p.alive && !p.isDummy && p.invuln <= 0;
}

// -------------------------------------------------------------------- timers

export function tickCombatTimers(p: PlayerState, dt: number): void {
  if (p.fireCd > 0) p.fireCd = Math.max(0, p.fireCd - dt);
  if (p.swordCd > 0) p.swordCd = Math.max(0, p.swordCd - dt);
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
  if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);

  p.lastHitAgo += dt;

  if (p.reloadTime > 0) {
    p.reloadTime = Math.max(0, p.reloadTime - dt);
    if (p.reloadTime === 0) p.ammo = GUN.MAG_SIZE;
  }

  if (p.swordTime > 0) {
    p.swordTime += dt;
    if (p.swordTime > SWORD.WINDUP + SWORD.ACTIVE) {
      p.swordTime = 0;
      p.swordConsumed = false;
    }
  }
}

// ----------------------------------------------------------------------- gun

export function tickGun(world: WorldState, p: PlayerState, input: InputCmd | undefined): void {
  if (!input || !canAct(p)) return;

  const wantsReload = (input.buttons & BTN.RELOAD) !== 0;
  if (wantsReload && p.reloadTime === 0 && p.ammo < GUN.MAG_SIZE) {
    startReload(world, p);
    return;
  }

  const wantsFire = (input.buttons & BTN.SHOOT) !== 0;
  if (!wantsFire) return;
  if (p.swordTime > 0) return;              // swinging: no shooting mid-swing
  if (p.reloadTime > 0) return;

  if (p.ammo <= 0) {
    startReload(world, p);
    return;
  }
  if (p.fireCd > 0) return;

  fire(world, p);
}

function startReload(world: WorldState, p: PlayerState): void {
  p.reloadTime = GUN.RELOAD_TIME;
  world.events.push({ t: 'reload', x: p.x, y: p.y });
}

function fire(world: WorldState, p: PlayerState): void {
  const dirX = Math.cos(p.aim);
  const dirY = Math.sin(p.aim);

  const proj: Projectile = {
    id: world.nextProjectileId++,
    owner: p.id,
    team: p.team,
    x: p.x + dirX * GUN.MUZZLE_OFFSET,
    y: p.y + dirY * GUN.MUZZLE_OFFSET,
    vx: dirX * GUN.PROJECTILE_SPEED,
    vy: dirY * GUN.PROJECTILE_SPEED,
    travelled: 0,
    damage: gunDamageOf(p),
  };
  world.projectiles.push(proj);

  p.ammo--;
  p.fireCd = fireIntervalOf(p);
  p.vx -= dirX * GUN.RECOIL;
  p.vy -= dirY * GUN.RECOIL;

  world.events.push({ t: 'shoot', x: proj.x, y: proj.y, dx: dirX, dy: dirY });
  if (p.ammo === 0) startReload(world, p);
}

// --------------------------------------------------------------------- sword

export function tickSword(world: WorldState, p: PlayerState, input: InputCmd | undefined, queue: PendingDamage[]): void {
  if (!canAct(p)) return;

  const wantsSwing = input ? (input.buttons & BTN.SWORD) !== 0 : false;
  if (wantsSwing && p.swordTime === 0 && p.swordCd === 0) {
    p.swordTime = 1e-6;                     // non-zero marks "swinging"
    p.swordCd = SWORD.COOLDOWN;
    p.swordAim = p.aim;
    p.swordConsumed = false;
    p.reloadTime = 0;                       // cancel a reload to swing
    p.vx += Math.cos(p.aim) * SWORD.LUNGE;
    p.vy += Math.sin(p.aim) * SWORD.LUNGE;
    world.events.push({ t: 'swing', x: p.x, y: p.y, aim: p.aim });
  }

  if (isSwordActive(p) && !p.swordConsumed) {
    resolveSwordHits(world, p, queue);
  }
}

export function isSwordActive(p: PlayerState): boolean {
  return p.swordTime > SWORD.WINDUP && p.swordTime <= SWORD.WINDUP + SWORD.ACTIVE;
}

function resolveSwordHits(world: WorldState, p: PlayerState, queue: PendingDamage[]): void {
  const reach = SWORD.RANGE + PLAYER.RADIUS;
  const halfArc = SWORD.ARC / 2;

  for (const target of world.players.values()) {
    if (!canDamage(p, target)) continue;

    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const dist = len(dx, dy);
    if (dist > reach) continue;

    // Angle check uses the aim captured at swing start, so you commit to a direction.
    if (dist > 1e-6 && Math.abs(angleDelta(Math.atan2(dy, dx), p.swordAim)) > halfArc) continue;

    // No slashing through walls.
    if (segmentBlocked(p.x, p.y, target.x, target.y, world.map.walls)) continue;

    world.events.push({ t: 'swordhit', x: target.x, y: target.y, aim: p.swordAim, target: target.id });
    const [nx, ny] = norm(dx, dy);
    queue.push({ victim: target.id, attacker: p.id, amount: PLAYER.HEALTH, nx, ny, weapon: 'sword' });
    p.swordConsumed = true;                 // one kill per swing
    return;
  }
}

// --------------------------------------------------------------- projectiles

export function stepProjectiles(world: WorldState, dt: number, queue: PendingDamage[]): void {
  const walls = world.map.walls;
  const r = GUN.PROJECTILE_RADIUS;

  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const b = world.projectiles[i];
    const speed = len(b.vx, b.vy);
    // Substep so a fast bullet cannot skip over a thin wall or a player.
    const steps = Math.max(1, Math.ceil((speed * dt) / (PLAYER.RADIUS * 0.6)));
    const sdt = dt / steps;
    let dead = false;

    for (let s = 0; s < steps && !dead; s++) {
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;
      b.travelled += speed * sdt;

      if (b.travelled >= GUN.RANGE) {
        world.events.push({ t: 'bulletwall', x: b.x, y: b.y, nx: 0, ny: 0 });
        dead = true;
        break;
      }

      for (let w = 0; w < walls.length; w++) {
        const hit = circleVsRect(b.x, b.y, r, walls[w]);
        if (hit.hit) {
          world.events.push({ t: 'bulletwall', x: b.x + hit.nx * hit.depth, y: b.y + hit.ny * hit.depth, nx: hit.nx, ny: hit.ny });
          dead = true;
          break;
        }
      }
      if (dead) break;

      const shooter = world.players.get(b.owner);
      for (const target of world.players.values()) {
        if (target.id === b.owner) continue;
        if (shooter && !canDamage(shooter, target)) continue;
        if (!shooter && (!target.alive || target.invuln > 0)) continue;

        const dx = target.x - b.x;
        const dy = target.y - b.y;
        if (dx * dx + dy * dy > (PLAYER.RADIUS + r) * (PLAYER.RADIUS + r)) continue;

        const [nx, ny] = norm(b.vx, b.vy);
        world.events.push({ t: 'hit', x: b.x, y: b.y, dx: nx, dy: ny, damage: b.damage, target: target.id });
        queue.push({ victim: target.id, attacker: b.owner, amount: b.damage, nx, ny, weapon: 'gun' });
        dead = true;
        break;
      }
    }

    if (dead) world.projectiles.splice(i, 1);
  }
}

// ------------------------------------------------------------ damage & death

/**
 * Applies every hit detected this tick, then resolves deaths. Damage is fully
 * applied before any death is processed, so lethal trades kill both players.
 */
export function applyDamageQueue(world: WorldState, queue: PendingDamage[]): void {
  if (queue.length === 0) return;

  for (const d of queue) {
    const victim = world.players.get(d.victim);
    if (!victim || !victim.alive || victim.invuln > 0) continue;
    // Shield soaks damage before health does.
    const through = d.weapon === 'sword' ? d.amount : absorb(victim, d.amount);
    victim.health -= through;
    victim.hitFlash = COMBAT.HIT_FLASH;
    if (d.attacker && d.attacker !== victim.id) {
      victim.lastHitBy = d.attacker;
      victim.lastHitAgo = 0;
    }
    victim.vx += d.nx * (d.weapon === 'sword' ? 320 : 90);
    victim.vy += d.ny * (d.weapon === 'sword' ? 320 : 90);
  }

  for (const d of queue) {
    const victim = world.players.get(d.victim);
    if (!victim || !victim.alive || victim.health > 0) continue;
    victim.health = 0;
    kill(world, victim, world.players.get(d.attacker) ?? null, d.weapon);
  }

  queue.length = 0;
}

/** Direct damage helper (used by hazards and tests). Bypasses the queue. */
export function damage(
  world: WorldState,
  victim: PlayerState,
  amount: number,
  attacker: PlayerState | null,
  nx: number,
  ny: number,
  weapon: 'gun' | 'sword',
): void {
  if (!victim.alive || victim.invuln > 0) return;

  // Same absorption rule as the batched path: shields stop bullets, not swords.
  victim.health -= weapon === 'sword' ? amount : absorb(victim, amount);
  victim.hitFlash = COMBAT.HIT_FLASH;
  if (attacker && attacker.id !== victim.id) {
    victim.lastHitBy = attacker.id;
    victim.lastHitAgo = 0;
  }
  // A little knockback so trades feel physical and reads as feedback.
  victim.vx += nx * (weapon === 'sword' ? 320 : 90);
  victim.vy += ny * (weapon === 'sword' ? 320 : 90);

  if (victim.health <= 0) {
    victim.health = 0;
    kill(world, victim, attacker, weapon);
  }
}

export function kill(
  world: WorldState,
  victim: PlayerState,
  killer: PlayerState | null,
  weapon: 'gun' | 'sword' | 'fall',
): void {
  victim.alive = false;
  victim.respawnIn = COMBAT.RESPAWN_TIME;
  dropCarried(world, victim);
  victim.swordTime = 0;
  victim.swordConsumed = false;
  victim.reloadTime = 0;

  // Warmup kills are for fun only — the scoreboard belongs to the live match.
  if (killer && killer.id !== victim.id && isScoring(world)) {
    killer.kills++;
    world.scores[killer.team] = (world.scores[killer.team] ?? 0) + 1;
  }
  if (isScoring(world)) victim.deaths++;

  world.events.push({
    t: 'death',
    x: victim.x, y: victim.y, team: victim.team,
    victim: victim.id,
    killer: killer ? killer.id : '',
    weapon,
  });
}

/**
 * Falling. Standing in a hazard for longer than the grace period kills you,
 * and the credit goes to whoever last hit you — so shoving someone into a pit
 * with a sword swing counts as your kill.
 */
export function tickHazards(world: WorldState, dt: number): void {
  const hazards = world.map.hazards;
  if (!hazards || hazards.length === 0) return;

  for (const p of world.players.values()) {
    if (!p.alive || p.isDummy) {
      p.hazardTime = 0;
      continue;
    }

    let inside = false;
    for (const h of hazards) {
      // Centre-in-rect: you fall when most of you is over the hole, not when
      // your edge clips it. That keeps ledge play readable.
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) {
        inside = true;
        break;
      }
    }

    if (!inside) {
      p.hazardTime = 0;
      continue;
    }

    p.hazardTime += dt;
    if (p.hazardTime < COMBAT.HAZARD_GRACE) continue;

    const credit = p.lastHitAgo <= COMBAT.ASSIST_WINDOW ? world.players.get(p.lastHitBy) ?? null : null;
    p.health = 0;
    p.hazardTime = 0;
    world.events.push({ t: 'fall', x: p.x, y: p.y, team: p.team, victim: p.id });
    kill(world, p, credit, 'fall');
  }
}

export function tickRespawn(world: WorldState, p: PlayerState, dt: number): void {
  if (p.alive) return;
  p.respawnIn -= dt;
  if (p.respawnIn > 0) return;
  respawn(world, p);
}

export function respawn(world: WorldState, p: PlayerState): void {
  // Training dummies pop back up on the spot they were standing on.
  if (!p.isDummy) {
    const spot = pickSpawn(world, p.team);
    p.x = spot.x;
    p.y = spot.y;
  }
  p.vx = 0; p.vy = 0;
  p.health = PLAYER.HEALTH;
  p.alive = true;
  p.respawnIn = 0;
  p.invuln = COMBAT.SPAWN_PROTECT;
  p.ammo = GUN.MAG_SIZE;
  p.fireCd = 0;
  p.reloadTime = 0;
  p.swordCd = 0;
  p.swordTime = 0;
  p.dashCd = 0;
  p.dashTime = 0;
  p.dashBuffer = 0;
  p.hitFlash = 0;
  p.hazardTime = 0;
  p.lastHitBy = '';
  p.lastHitAgo = 999;
  clearBuffs(p);
  world.events.push({ t: 'respawn', x: p.x, y: p.y, team: p.team, id: p.id });
}

/**
 * Picks the spawn point furthest from the nearest living enemy, so you never
 * pop into existence next to someone's sword. Deterministic — no RNG.
 */
export function pickSpawn(world: WorldState, team: TeamId): { x: number; y: number } {
  const group = world.map.spawns[team] ?? world.map.spawns[2] ?? [];
  const pool = group.length ? group : world.map.spawns[2];
  if (!pool || pool.length === 0) return { x: world.map.width / 2, y: world.map.height / 2 };

  let best = pool[0];
  let bestScore = -Infinity;

  for (const spot of pool) {
    let nearestEnemy = Infinity;
    let crowding = 0;
    for (const other of world.players.values()) {
      if (!other.alive) continue;
      const d = len(other.x - spot.x, other.y - spot.y);
      const sameTeam = other.team === team && team !== 2;
      if (sameTeam) {
        // Don't stack a whole team on one pad — spread them across the pool.
        if (d < PLAYER.RADIUS * 4) crowding += (PLAYER.RADIUS * 4 - d);
      } else {
        nearestEnemy = Math.min(nearestEnemy, d);
      }
    }
    const score = Math.min(nearestEnemy, 900) - crowding * 3;
    if (score > bestScore) { bestScore = score; best = spot; }
  }
  return best;
}
