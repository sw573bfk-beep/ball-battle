/**
 * The simulation. DOM-free and deterministic: the same seed and the same
 * inputs always produce the same match. Bots and humans both drive it purely
 * through InputCmd, so a server could run this file unchanged for online play.
 *
 * Never call Math.random() or read the clock in here — use rand(world).
 */

import {
  CRATE, DASH, HEALTH_PACK, MATCH, PLAYER, SPAWNER, SWORD, TICK_DT, TIERS, type Tier,
} from './config.js';
import {
  circleVsRect, clamp, distSqPointSegment, distSqSegments, len, nextRandom, pointInRect, type Rect,
} from './math.js';
import type { Crate, FloorSword, InputCmd, MapDef, Player, ThrownSword, World } from './types.js';
import { emptyInput } from './types.js';

// ------------------------------------------------------------------ setup

export interface WorldOptions {
  map: MapDef;
  seed?: number;
  /** Skip the countdown (tests, sandbox). */
  skipCountdown?: boolean;
}

export function createWorld(opts: WorldOptions): World {
  const world: World = {
    tick: 0,
    time: 0,
    rng: { seed: opts.seed ?? 1 },
    map: opts.map,
    players: [],
    thrown: [],
    floor: [],
    crates: [],
    health: [],
    nextId: 1,
    spawnTimer: 0,
    phase: opts.skipCountdown ? 'playing' : 'countdown',
    clock: opts.skipCountdown ? MATCH.DURATION : MATCH.COUNTDOWN,
    winner: '',
    events: [],
  };
  for (const c of opts.map.crates) {
    world.crates.push({ id: world.nextId++, x: c.x, y: c.y, health: CRATE.HEALTH, respawnIn: 0, hitCd: 0 });
  }
  for (const p of opts.map.healthPads) {
    world.health.push({ id: world.nextId++, x: p.x, y: p.y, fixed: true, respawnIn: 0, ttl: Infinity });
  }
  // Seed the floor so there's something to fight over from the first second.
  for (let i = 0; i < SPAWNER.BASE + 4; i++) spawnFloorSword(world);
  return world;
}

export function addPlayer(world: World, id: string, name: string, color: string, isBot: boolean): Player {
  const p: Player = {
    id, name, color, isBot,
    x: 0, y: 0, vx: 0, vy: 0, aim: 0,
    health: PLAYER.HEALTH, alive: true, respawnIn: 0, protect: 0,
    kills: 0, deaths: 0, streak: 0, lastHitBy: '',
    swords: [], spin: 0, throwCd: 0,
    dashCd: 0, dashTime: 0, dashX: 0, dashY: 0, clashCd: 0,
    hitCds: {}, hitFlash: 0,
  };
  world.players.push(p);
  respawn(world, p);
  return p;
}

export const rand = (world: World): number => nextRandom(world.rng);

// ------------------------------------------------------------------- step

export function stepWorld(world: World, inputs: Map<string, InputCmd>): void {
  world.events = [];
  world.tick++;
  world.time += TICK_DT;
  const dt = TICK_DT;

  if (world.phase === 'over') return;
  if (world.phase === 'countdown') {
    world.clock -= dt;
    for (const p of world.players) {
      const inp = inputs.get(p.id);
      if (inp) setAim(p, inp);
      p.spin += SWORD.SPIN * dt;
    }
    if (world.clock <= 0) {
      world.phase = 'playing';
      world.clock = MATCH.DURATION;
    }
    return;
  }

  for (const p of world.players) {
    const inp = inputs.get(p.id) ?? emptyInput();
    if (!p.alive) {
      p.respawnIn -= dt;
      if (p.respawnIn <= 0) respawn(world, p);
      continue;
    }
    tickTimers(p, dt);
    setAim(p, inp);
    movePlayer(world, p, inp, dt);
    if (inp.throw) throwSword(world, p);
  }

  collidePlayers(world);
  // Shoving can push someone into a wall, so settle walls again afterwards.
  for (const p of world.players) if (p.alive) collideSolids(world, p);
  orbitCombat(world, dt);
  stepThrown(world, dt);
  stepFloor(world, dt);
  stepPickups(world, dt);
  stepCrates(world, dt);
  stepSpawner(world, dt);

  world.clock -= dt;
  if (world.clock <= 0) endMatch(world);
}

function tickTimers(p: Player, dt: number): void {
  p.protect = Math.max(0, p.protect - dt);
  p.throwCd = Math.max(0, p.throwCd - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.dashTime = Math.max(0, p.dashTime - dt);
  p.clashCd = Math.max(0, p.clashCd - dt);
  p.hitFlash = Math.max(0, p.hitFlash - dt);
  p.spin += SWORD.SPIN * dt;
  if (p.spin > Math.PI * 2) p.spin -= Math.PI * 2;
  for (const k in p.hitCds) {
    p.hitCds[k] -= dt;
    if (p.hitCds[k] <= 0) delete p.hitCds[k];
  }
}

function setAim(p: Player, inp: InputCmd): void {
  if (inp.aimX !== 0 || inp.aimY !== 0) p.aim = Math.atan2(inp.aimY, inp.aimX);
}

// --------------------------------------------------------------- movement

export function maxSpeedOf(p: Player): number {
  return PLAYER.MAX_SPEED * (1 - PLAYER.SLOW_PER_SWORD * p.swords.length);
}

function movePlayer(world: World, p: Player, inp: InputCmd, dt: number): void {
  let mx = clamp(inp.moveX, -1, 1);
  let my = clamp(inp.moveY, -1, 1);
  const ml = len(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }

  if (inp.dash && p.dashCd <= 0) {
    let dx = mx, dy = my;
    if (ml < 0.1) { dx = Math.cos(p.aim); dy = Math.sin(p.aim); }
    const dl = len(dx, dy) || 1;
    p.dashX = dx / dl;
    p.dashY = dy / dl;
    p.dashTime = DASH.DURATION;
    p.dashCd = DASH.COOLDOWN;
    world.events.push({ t: 'dash', x: p.x, y: p.y, who: p.id });
  }

  const max = maxSpeedOf(p);
  if (p.dashTime > 0) {
    p.vx = p.dashX * DASH.SPEED;
    p.vy = p.dashY * DASH.SPEED;
  } else {
    if (ml > 0.01) {
      p.vx += mx * PLAYER.ACCEL * dt;
      p.vy += my * PLAYER.ACCEL * dt;
      // Bleed sideways drift so turning feels snappy.
      const along = (p.vx * mx + p.vy * my) / Math.max(ml, 1e-6);
      if (along < 0) {
        p.vx -= mx * along * 6 * dt;
        p.vy -= my * along * 6 * dt;
      }
    } else {
      const f = Math.exp(-PLAYER.FRICTION * dt);
      p.vx *= f;
      p.vy *= f;
    }
    const sp = len(p.vx, p.vy);
    if (sp > max) {
      // Above the cap (knockback, end of a dash) decays smoothly back to it.
      const k = Math.max(max / sp, Math.exp(-5 * dt));
      p.vx *= k;
      p.vy *= k;
    }
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  collideSolids(world, p);
}

/** Every rect a ball can't pass: walls plus crates that are standing. */
export function solids(world: World): Rect[] {
  const out = world.map.walls.slice();
  for (const c of world.crates) if (c.respawnIn <= 0) out.push(crateRect(c));
  return out;
}

export function crateRect(c: Crate): Rect {
  const h = CRATE.SIZE / 2;
  return { x: c.x - h, y: c.y - h, w: CRATE.SIZE, h: CRATE.SIZE };
}

function collideSolids(world: World, p: Player): void {
  for (let pass = 0; pass < 2; pass++) {
    for (const r of solids(world)) {
      const hit = circleVsRect(p.x, p.y, PLAYER.RADIUS, r);
      if (!hit) continue;
      p.x += hit.nx * hit.depth;
      p.y += hit.ny * hit.depth;
      const vn = p.vx * hit.nx + p.vy * hit.ny;
      if (vn < 0) {
        p.vx -= vn * hit.nx * 1.3;
        p.vy -= vn * hit.ny * 1.3;
        if (p.dashTime > 0) p.dashTime = 0;
      }
    }
  }
}

function collidePlayers(world: World): void {
  const ps = world.players;
  const r2 = PLAYER.RADIUS * 2;
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < ps.length; j++) {
      const b = ps[j];
      if (!b.alive) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = len(dx, dy);
      if (d >= r2 || d < 1e-6) continue;
      const nx = dx / d;
      const ny = dy / d;
      const push = (r2 - d) / 2;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const imp = -(1 + PLAYER.BOUNCE) * rel / 2;
        a.vx -= imp * nx; a.vy -= imp * ny;
        b.vx += imp * nx; b.vy += imp * ny;
      }
    }
  }
}

// ----------------------------------------------------------------- swords

/** Blade segment (hilt -> tip) of the i-th orbiting sword. */
export function bladeOf(p: Player, i: number): { ax: number; ay: number; bx: number; by: number; angle: number } {
  const n = p.swords.length;
  const angle = p.spin + (i * Math.PI * 2) / n;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const r0 = PLAYER.RADIUS + SWORD.HILT_GAP;
  const r1 = r0 + SWORD.LENGTH;
  return { ax: p.x + c * r0, ay: p.y + s * r0, bx: p.x + c * r1, by: p.y + s * r1, angle };
}

/** Swords only deal damage once the owner is out of spawn protection. */
const armed = (p: Player): boolean => p.alive && p.protect <= 0;

function orbitCombat(world: World, _dt: number): void {
  const ps = world.players;
  const hitR = PLAYER.RADIUS + SWORD.THICKNESS;
  for (const a of ps) {
    if (!armed(a) || a.swords.length === 0) continue;

    // Orbit vs players.
    for (const b of ps) {
      if (b === a || !b.alive || b.protect > 0) continue;
      const reach = PLAYER.RADIUS * 2 + SWORD.HILT_GAP + SWORD.LENGTH + 4;
      if (Math.abs(b.x - a.x) > reach || Math.abs(b.y - a.y) > reach) continue;
      for (let i = 0; i < a.swords.length; i++) {
        const key = `${b.id}:${i}`;
        if (a.hitCds[key]) continue;
        const bl = bladeOf(a, i);
        if (distSqPointSegment(b.x, b.y, bl.ax, bl.ay, bl.bx, bl.by) > hitR * hitR) continue;
        a.hitCds[key] = SWORD.HIT_COOLDOWN;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = len(dx, dy) || 1;
        damage(world, b, TIERS[a.swords[i]].orbitDamage, a.id, (dx / d) * SWORD.ORBIT_KNOCKBACK, (dy / d) * SWORD.ORBIT_KNOCKBACK, false, bl.bx, bl.by);
        if (!a.alive || a.swords.length === 0) break;
      }
    }

    // Orbit vs crates.
    for (const c of world.crates) {
      if (c.respawnIn > 0 || c.hitCd > 0) continue;
      const r = crateRect(c);
      for (let i = 0; i < a.swords.length; i++) {
        const bl = bladeOf(a, i);
        if (pointInRect(bl.bx, bl.by, r, SWORD.THICKNESS) || pointInRect((bl.ax + bl.bx) / 2, (bl.ay + bl.by) / 2, r)) {
          hitCrate(world, c, bl.bx, bl.by);
          break;
        }
      }
    }
  }

  // Orbit vs orbit: blades clang and shove both owners apart.
  const clashR = SWORD.THICKNESS * 2;
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i];
    if (!armed(a) || a.swords.length === 0) continue;
    for (let j = i + 1; j < ps.length; j++) {
      const b = ps[j];
      if (!armed(b) || b.swords.length === 0) continue;
      if (a.clashCd > 0 && b.clashCd > 0) continue;
      const reach = (PLAYER.RADIUS + SWORD.HILT_GAP + SWORD.LENGTH) * 2;
      if (Math.abs(b.x - a.x) > reach || Math.abs(b.y - a.y) > reach) continue;
      const hit = findClash(a, b, clashR);
      if (!hit) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = len(dx, dy) || 1;
      a.vx -= (dx / d) * SWORD.CLASH_PUSH; a.vy -= (dy / d) * SWORD.CLASH_PUSH;
      b.vx += (dx / d) * SWORD.CLASH_PUSH; b.vy += (dy / d) * SWORD.CLASH_PUSH;
      a.clashCd = b.clashCd = SWORD.CLASH_COOLDOWN;
      world.events.push({ t: 'clash', x: hit.x, y: hit.y });
    }
  }
}

function findClash(a: Player, b: Player, r: number): { x: number; y: number } | null {
  for (let i = 0; i < a.swords.length; i++) {
    const s = bladeOf(a, i);
    for (let j = 0; j < b.swords.length; j++) {
      const t = bladeOf(b, j);
      if (distSqSegments(s.ax, s.ay, s.bx, s.by, t.ax, t.ay, t.bx, t.by) <= r * r) {
        return { x: (s.bx + t.bx) / 2, y: (s.by + t.by) / 2 };
      }
    }
  }
  return null;
}

/** Throw the best sword you're holding toward your aim. */
export function throwSword(world: World, p: Player): boolean {
  if (!p.alive || p.swords.length === 0 || p.throwCd > 0) return false;
  let best = 0;
  for (let i = 1; i < p.swords.length; i++) if (p.swords[i] > p.swords[best]) best = i;
  const tier = p.swords.splice(best, 1)[0];
  p.throwCd = SWORD.THROW_COOLDOWN;
  p.protect = 0; // attacking ends spawn protection
  const c = Math.cos(p.aim);
  const s = Math.sin(p.aim);
  const start = PLAYER.RADIUS + 8;
  const sword: ThrownSword = {
    id: world.nextId++, owner: p.id, tier,
    x: p.x + c * start, y: p.y + s * start,
    vx: c * SWORD.THROW_SPEED + p.vx * 0.25,
    vy: s * SWORD.THROW_SPEED + p.vy * 0.25,
    angle: p.aim, travelled: 0, age: 0,
  };
  world.thrown.push(sword);
  world.events.push({ t: 'throw', x: sword.x, y: sword.y, who: p.id });
  return true;
}

function stepThrown(world: World, dt: number): void {
  const SUB = 3;
  const sdt = dt / SUB;
  const keep: ThrownSword[] = [];
  outer: for (const t of world.thrown) {
    t.age += dt;
    t.angle += SWORD.THROW_SPIN * dt;
    for (let k = 0; k < SUB; k++) {
      const px = t.x, py = t.y;
      t.x += t.vx * sdt;
      t.y += t.vy * sdt;
      t.travelled += len(t.vx, t.vy) * sdt;

      // Walls and crates: the sword sticks where it hit.
      const sr = SWORD.THROWN_RADIUS * 0.5;
      const wall = world.map.walls.some((r) => circleVsRect(t.x, t.y, sr, r));
      const crate = wall ? undefined : world.crates.find((c) => c.respawnIn <= 0 && circleVsRect(t.x, t.y, sr, crateRect(c)));
      if (wall || crate) {
        if (crate) hitCrate(world, crate, t.x, t.y, true);
        else world.events.push({ t: 'stick', x: t.x, y: t.y });
        dropAt(world, t.tier, px, py, 0, 0, '', t.angle);
        continue outer;
      }

      // Players.
      for (const p of world.players) {
        if (!p.alive || p.protect > 0) continue;
        if (p.id === t.owner && t.age < SWORD.SELF_SAFE) continue;
        const rr = PLAYER.RADIUS + SWORD.THROWN_RADIUS;
        if ((p.x - t.x) ** 2 + (p.y - t.y) ** 2 > rr * rr) continue;
        if (p.id === t.owner) {
          // Catching your own sword on the rebound just puts it back in orbit.
          if (p.swords.length < SWORD.MAX_HELD) {
            p.swords.push(t.tier);
            world.events.push({ t: 'pickup', x: p.x, y: p.y, who: p.id, tier: t.tier });
            continue outer;
          }
          continue;
        }
        const sp = len(t.vx, t.vy) || 1;
        damage(world, p, TIERS[t.tier].throwDamage, t.owner, (t.vx / sp) * SWORD.THROW_KNOCKBACK, (t.vy / sp) * SWORD.THROW_KNOCKBACK, true, t.x, t.y);
        // Bounce back toward the thrower; the victim can't just pocket it.
        dropAt(world, t.tier, t.x, t.y, -t.vx * 0.35, -t.vy * 0.35, p.id, t.angle);
        continue outer;
      }

      // Enemy orbiting blades swat it out of the air.
      for (const p of world.players) {
        if (p.id === t.owner || !armed(p)) continue;
        for (let i = 0; i < p.swords.length; i++) {
          const bl = bladeOf(p, i);
          const rr = SWORD.DEFLECT_RADIUS + SWORD.THICKNESS;
          if (distSqPointSegment(t.x, t.y, bl.ax, bl.ay, bl.bx, bl.by) > rr * rr) continue;
          world.events.push({ t: 'deflect', x: t.x, y: t.y });
          dropAt(world, t.tier, t.x, t.y, -t.vx * 0.3, -t.vy * 0.3, '', t.angle);
          continue outer;
        }
      }

      if (t.travelled >= SWORD.THROW_RANGE) {
        dropAt(world, t.tier, t.x, t.y, t.vx * 0.2, t.vy * 0.2, '', t.angle);
        continue outer;
      }
    }
    keep.push(t);
  }
  world.thrown = keep;
}

function dropAt(world: World, tier: Tier, x: number, y: number, vx: number, vy: number, by: string, angle?: number): FloorSword {
  const f: FloorSword = {
    id: world.nextId++, tier, x, y, vx, vy,
    angle: angle ?? rand(world) * Math.PI * 2,
    ttl: SWORD.FLOOR_LIFETIME, droppedBy: by, noPickup: by ? SWORD.DROP_PICKUP_DELAY : 0,
  };
  unstick(world, f);
  world.floor.push(f);
  return f;
}

/** Nudge a floor sword out of any wall so it can always be picked up. */
function unstick(world: World, f: FloorSword): void {
  for (let pass = 0; pass < 3; pass++) {
    for (const r of world.map.walls) {
      const hit = circleVsRect(f.x, f.y, 14, r);
      if (!hit) continue;
      f.x += hit.nx * hit.depth;
      f.y += hit.ny * hit.depth;
      const vn = f.vx * hit.nx + f.vy * hit.ny;
      if (vn < 0) { f.vx -= vn * hit.nx * 1.4; f.vy -= vn * hit.ny * 1.4; }
    }
  }
}

function stepFloor(world: World, dt: number): void {
  const f0 = Math.exp(-SWORD.FLOOR_FRICTION * dt);
  if (world.floor.length > SWORD.FLOOR_CAP) {
    // Too much clutter: the oldest swords start fading out.
    const byAge = world.floor.slice().sort((a, b) => a.ttl - b.ttl || a.id - b.id);
    for (let i = 0; i < world.floor.length - SWORD.FLOOR_CAP; i++) byAge[i].ttl = Math.min(byAge[i].ttl, SWORD.FLOOR_FADE);
  }
  world.floor = world.floor.filter((f) => {
    f.ttl -= dt;
    f.noPickup = Math.max(0, f.noPickup - dt);
    if (f.vx !== 0 || f.vy !== 0) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vx *= f0;
      f.vy *= f0;
      if (Math.abs(f.vx) + Math.abs(f.vy) < 4) f.vx = f.vy = 0;
      unstick(world, f);
    }
    return f.ttl > 0;
  });
}

function stepPickups(world: World, dt: number): void {
  for (const p of world.players) {
    if (!p.alive) continue;
    if (p.swords.length < SWORD.MAX_HELD) {
      const rr = PLAYER.RADIUS + SWORD.PICKUP_RADIUS;
      for (let i = 0; i < world.floor.length; i++) {
        const f = world.floor[i];
        if (f.droppedBy === p.id && f.noPickup > 0) continue;
        if ((f.x - p.x) ** 2 + (f.y - p.y) ** 2 > rr * rr) continue;
        p.swords.push(f.tier);
        world.floor.splice(i--, 1);
        world.events.push({ t: 'pickup', x: f.x, y: f.y, who: p.id, tier: f.tier });
        if (p.swords.length >= SWORD.MAX_HELD) break;
      }
    }
    if (p.health < PLAYER.HEALTH) {
      const rr = PLAYER.RADIUS + HEALTH_PACK.RADIUS;
      for (const h of world.health) {
        if (h.respawnIn > 0) continue;
        if ((h.x - p.x) ** 2 + (h.y - p.y) ** 2 > rr * rr) continue;
        p.health = Math.min(PLAYER.HEALTH, p.health + HEALTH_PACK.AMOUNT);
        h.respawnIn = h.fixed ? HEALTH_PACK.RESPAWN : 0;
        h.ttl = h.fixed ? h.ttl : 0;
        world.events.push({ t: 'heal', x: h.x, y: h.y, who: p.id });
        break;
      }
    }
  }
  world.health = world.health.filter((h) => {
    if (h.fixed) { h.respawnIn = Math.max(0, h.respawnIn - dt); return true; }
    h.ttl -= dt;
    return h.ttl > 0;
  });
}

// ----------------------------------------------------------------- crates

function hitCrate(world: World, c: Crate, x: number, y: number, heavy = false): void {
  if (c.respawnIn > 0) return;
  c.health -= heavy ? 2 : 1;
  c.hitCd = 0.3;
  const broken = c.health <= 0;
  world.events.push({ t: 'crate', x, y, broken });
  if (!broken) return;
  c.respawnIn = CRATE.RESPAWN;
  if (rand(world) < CRATE.SWORD_CHANCE) {
    let tier = rollTier(world);
    if (tier < 2 && rand(world) < CRATE.UPGRADE_CHANCE) tier = (tier + 1) as Tier;
    const a = rand(world) * Math.PI * 2;
    dropAt(world, tier, c.x, c.y, Math.cos(a) * 120, Math.sin(a) * 120, '');
  } else {
    world.health.push({ id: world.nextId++, x: c.x, y: c.y, fixed: false, respawnIn: 0, ttl: HEALTH_PACK.LOOSE_LIFETIME });
  }
}

function stepCrates(world: World, dt: number): void {
  for (const c of world.crates) {
    c.hitCd = Math.max(0, c.hitCd - dt);
    if (c.respawnIn <= 0) continue;
    c.respawnIn -= dt;
    if (c.respawnIn > 0) continue;
    // Don't pop a crate back into existence on top of someone.
    const r = crateRect(c);
    const blocked = world.players.some((p) => p.alive && circleVsRect(p.x, p.y, PLAYER.RADIUS, r));
    if (blocked) { c.respawnIn = 1; continue; }
    c.health = CRATE.HEALTH;
    c.respawnIn = 0;
  }
}

// ---------------------------------------------------------------- spawner

export function rollTier(world: World): Tier {
  const total = TIERS.reduce((s, t) => s + t.weight, 0);
  let r = rand(world) * total;
  for (let i = 0; i < TIERS.length; i++) {
    r -= TIERS[i].weight;
    if (r < 0) return i as Tier;
  }
  return 0;
}

function stepSpawner(world: World, dt: number): void {
  world.spawnTimer -= dt;
  if (world.spawnTimer > 0) return;
  world.spawnTimer = SPAWNER.INTERVAL;
  const target = Math.round(SPAWNER.BASE + SPAWNER.PER_PLAYER * world.players.length);
  const inFlight = world.thrown.length + world.players.reduce((s, p) => s + p.swords.length, 0);
  // Count every sword in play so the arena never floods with them.
  if (world.floor.length < target && world.floor.length + inFlight < target * 2.5) spawnFloorSword(world);
}

export function spawnFloorSword(world: World): FloorSword | null {
  const pt = openPoint(world, 26, SPAWNER.MIN_PLAYER_DIST);
  if (!pt) return null;
  return dropAt(world, rollTier(world), pt.x, pt.y, 0, 0, '');
}

/** A random spot clear of walls and crates (and players, if minPlayerDist > 0). */
export function openPoint(world: World, pad: number, minPlayerDist: number): { x: number; y: number } | null {
  const { width, height } = world.map;
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = 60 + rand(world) * (width - 120);
    const y = 60 + rand(world) * (height - 120);
    if (world.map.walls.some((r) => pointInRect(x, y, r, pad))) continue;
    if (world.crates.some((c) => pointInRect(x, y, crateRect(c), pad))) continue;
    const md2 = minPlayerDist * minPlayerDist;
    if (world.players.some((p) => p.alive && (p.x - x) ** 2 + (p.y - y) ** 2 < md2)) continue;
    return { x, y };
  }
  return null;
}

// ------------------------------------------------------------ life/death

export function damage(
  world: World, victim: Player, amount: number, byId: string,
  kx: number, ky: number, thrown: boolean, hx: number, hy: number,
): void {
  if (!victim.alive || victim.protect > 0 || world.phase !== 'playing') return;
  victim.health -= amount;
  victim.vx += kx;
  victim.vy += ky;
  victim.dashTime = 0;
  victim.hitFlash = 0.15;
  victim.lastHitBy = byId;
  world.events.push({ t: 'hit', x: hx, y: hy, target: victim.id, by: byId, damage: amount, thrown });
  if (victim.health <= 0) kill(world, victim, byId);
}

export function kill(world: World, victim: Player, killerId: string): void {
  victim.alive = false;
  victim.health = 0;
  victim.respawnIn = PLAYER.RESPAWN_TIME;
  victim.deaths++;
  victim.streak = 0;
  // Scatter everything they were holding — the best loot in the game.
  const n = victim.swords.length;
  for (let i = 0; i < n; i++) {
    const a = victim.spin + (i * Math.PI * 2) / n;
    const sp = 200 + rand(world) * 120;
    dropAt(world, victim.swords[i], victim.x + Math.cos(a) * 20, victim.y + Math.sin(a) * 20, Math.cos(a) * sp, Math.sin(a) * sp, '', a);
  }
  victim.swords = [];
  world.events.push({ t: 'death', x: victim.x, y: victim.y, victim: victim.id, killer: killerId, color: victim.color });

  const killer = world.players.find((p) => p.id === killerId);
  if (killer && killer !== victim) {
    killer.kills++;
    killer.streak++;
    if (killer.alive) killer.health = Math.min(PLAYER.HEALTH, killer.health + PLAYER.KILL_HEAL);
    if (killer.kills >= MATCH.KILL_TARGET) endMatch(world);
  }
}

function respawn(world: World, p: Player): void {
  const pt = pickSpawn(world, p);
  p.x = pt.x;
  p.y = pt.y;
  p.vx = p.vy = 0;
  p.health = PLAYER.HEALTH;
  p.alive = true;
  p.respawnIn = 0;
  p.protect = PLAYER.SPAWN_PROTECT;
  p.swords = Array.from({ length: PLAYER.START_SWORDS }, () => 0 as Tier);
  p.throwCd = 0;
  p.dashCd = 0;
  p.dashTime = 0;
  p.hitCds = {};
  p.lastHitBy = '';
  if (world.tick > 0) world.events.push({ t: 'respawn', x: p.x, y: p.y, who: p.id });
}

/** The spawn point farthest from every living enemy, with a little randomness. */
function pickSpawn(world: World, self: Player): { x: number; y: number } {
  let best = world.map.spawns[0];
  let bestScore = -Infinity;
  for (const s of world.map.spawns) {
    let nearest = 1e9;
    for (const p of world.players) {
      if (p === self || !p.alive) continue;
      nearest = Math.min(nearest, Math.hypot(p.x - s.x, p.y - s.y));
    }
    const score = Math.min(nearest, 1200) + rand(world) * 300;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

function endMatch(world: World): void {
  if (world.phase === 'over') return;
  world.phase = 'over';
  world.clock = Math.max(0, world.clock);
  const ranked = rankPlayers(world);
  world.winner = ranked[0]?.id ?? '';
  world.events.push({ t: 'over', winner: world.winner });
}

/** Most kills first; fewer deaths breaks ties. */
export function rankPlayers(world: World): Player[] {
  return world.players.slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.name.localeCompare(b.name));
}
