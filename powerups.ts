/**
 * Map powerups.
 *
 * Kinds cycle deterministically per pad rather than randomly, so the server and
 * any replaying client always agree, and so players can learn the map: "the
 * shield is up next on the left pad" is a skill, "it might be anything" is not.
 */

import { DASH, GUN, PLAYER, POWERUP, POWERUP_KINDS, type PowerupKind } from './config.js';
import { len } from './math.js';
import type { PlayerState, WorldState } from './types.js';

/** Rebuilds the pad set for the current map. Called at every match start. */
export function resetPowerups(world: WorldState): void {
  const pads = world.map.powerupPads ?? [];
  world.powerups = pads.map((pad, i) => ({
    id: i,
    // Offset the starting kind per pad so the map opens with variety.
    kind: POWERUP_KINDS[i % POWERUP_KINDS.length],
    x: pad.x,
    y: pad.y,
    respawnIn: 0,
  }));
}

export function stepPowerups(world: WorldState, dt: number): void {
  if (world.match.phase !== 'live' && world.match.phase !== 'practice') return;

  for (const pu of world.powerups) {
    if (pu.respawnIn > 0) {
      pu.respawnIn -= dt;
      if (pu.respawnIn > 0) continue;
      pu.respawnIn = 0;
      // Advance to the next kind so pads rotate through the whole set.
      const idx = POWERUP_KINDS.indexOf(pu.kind);
      pu.kind = POWERUP_KINDS[(idx + 1) % POWERUP_KINDS.length];
    }

    for (const p of world.players.values()) {
      if (!p.alive || p.isDummy) continue;
      if (len(p.x - pu.x, p.y - pu.y) > POWERUP.RADIUS + PLAYER.RADIUS) continue;
      if (!applyPowerup(p, pu.kind)) continue;

      pu.respawnIn = POWERUP.RESPAWN;
      world.events.push({ t: 'pickup', x: pu.x, y: pu.y, kind: pu.kind, who: p.id });
      break;
    }
  }
}

/** Returns false when the pickup would do nothing (e.g. health at full). */
function applyPowerup(p: PlayerState, kind: PowerupKind): boolean {
  switch (kind) {
    case 'health':
      if (p.health >= PLAYER.HEALTH) return false;
      p.health = Math.min(PLAYER.HEALTH, p.health + POWERUP.HEALTH_AMOUNT);
      return true;
    case 'shield':
      p.shield = POWERUP.SHIELD_AMOUNT;
      return true;
    case 'speed':
      p.buffSpeed = POWERUP.DURATION;
      return true;
    case 'rapid':
      p.buffRapid = POWERUP.DURATION;
      return true;
    case 'damage':
      p.buffDamage = POWERUP.DURATION;
      return true;
    case 'dash':
      p.buffDash = POWERUP.DURATION;
      // Also refund the current cooldown, so it feels immediate.
      p.dashCd = 0;
      return true;
    default:
      return false;
  }
}

export function tickBuffs(p: PlayerState, dt: number): void {
  if (p.buffSpeed > 0) p.buffSpeed = Math.max(0, p.buffSpeed - dt);
  if (p.buffRapid > 0) p.buffRapid = Math.max(0, p.buffRapid - dt);
  if (p.buffDamage > 0) p.buffDamage = Math.max(0, p.buffDamage - dt);
  if (p.buffDash > 0) p.buffDash = Math.max(0, p.buffDash - dt);
}

export function clearBuffs(p: PlayerState): void {
  p.shield = 0;
  p.buffSpeed = 0;
  p.buffRapid = 0;
  p.buffDamage = 0;
  p.buffDash = 0;
}

// --- derived stats, so nothing else has to know how buffs are stored --------

export function maxSpeedOf(p: PlayerState): number {
  return PLAYER.MAX_SPEED * (p.buffSpeed > 0 ? POWERUP.SPEED_MULT : 1);
}

export function fireIntervalOf(p: PlayerState): number {
  return GUN.FIRE_INTERVAL * (p.buffRapid > 0 ? POWERUP.RAPID_MULT : 1);
}

export function gunDamageOf(p: PlayerState): number {
  return Math.round(GUN.DAMAGE * (p.buffDamage > 0 ? POWERUP.DAMAGE_MULT : 1));
}

export function dashCooldownOf(p: PlayerState): number {
  return DASH.COOLDOWN * (p.buffDash > 0 ? POWERUP.DASH_MULT : 1);
}

/** Applies damage through the shield pool first. Returns leftover damage. */
export function absorb(p: PlayerState, amount: number): number {
  if (p.shield <= 0) return amount;
  const taken = Math.min(p.shield, amount);
  p.shield -= taken;
  return amount - taken;
}
