/**
 * Bot brains. A bot reads the world and produces an InputCmd, exactly like a
 * human's keyboard would — the sim can't tell them apart.
 *
 * Pathfinding is a breadth-first search over a coarse grid, recomputed a few
 * times per second; between recomputes bots steer straight at the furthest
 * waypoint they can see.
 */

import { BOT, PLAYER, SWORD, TIERS, type Difficulty } from './config.js';
import { circleVsRect, len, lineBlocked, nextRandom, type Rect } from './math.js';
import type { InputCmd, MapDef, Player, World } from './types.js';
import { emptyInput } from './types.js';
import { crateRect } from './world.js';

// -------------------------------------------------------------- nav grid

export interface NavGrid {
  cols: number;
  rows: number;
  cell: number;
  /** 1 = a ball centred in this cell would touch a wall. */
  blocked: Uint8Array;
}

export function buildNav(map: MapDef): NavGrid {
  const cell = BOT.NAV_CELL;
  const cols = Math.ceil(map.width / cell);
  const rows = Math.ceil(map.height / cell);
  const blocked = new Uint8Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const x = (cx + 0.5) * cell;
      const y = (cy + 0.5) * cell;
      if (map.walls.some((r) => circleVsRect(x, y, PLAYER.RADIUS + 2, r))) blocked[cy * cols + cx] = 1;
    }
  }
  return { cols, rows, cell, blocked };
}

export function findPath(nav: NavGrid, extra: Uint8Array, sx: number, sy: number, gx: number, gy: number): { x: number; y: number }[] {
  const { cols, rows, cell } = nav;
  const toCell = (x: number, y: number) => {
    const cx = Math.max(0, Math.min(cols - 1, Math.floor(x / cell)));
    const cy = Math.max(0, Math.min(rows - 1, Math.floor(y / cell)));
    return cy * cols + cx;
  };
  const start = toCell(sx, sy);
  const goal = toCell(gx, gy);
  const isBlocked = (i: number) => nav.blocked[i] === 1 || extra[i] === 1;
  const prev = new Int32Array(cols * rows).fill(-1);
  prev[start] = start;
  const queue = [start];
  let found = -1;
  const gcx = goal % cols;
  const gcy = (goal / cols) | 0;
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    const cx = cur % cols;
    const cy = (cur / cols) | 0;
    // Arriving next to a blocked goal (a crate, a sword by a wall) is good enough.
    if (cur === goal || (Math.abs(cx - gcx) <= 1 && Math.abs(cy - gcy) <= 1 && isBlocked(goal))) { found = cur; break; }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (prev[ni] !== -1 || isBlocked(ni)) continue;
        // No cutting corners past walls.
        if (dx && dy && (isBlocked(cy * cols + nx) || isBlocked(ny * cols + cx))) continue;
        prev[ni] = cur;
        queue.push(ni);
      }
    }
  }
  if (found < 0) return [];
  const out: { x: number; y: number }[] = [];
  for (let i = found; i !== start; i = prev[i]) {
    out.push({ x: ((i % cols) + 0.5) * cell, y: (((i / cols) | 0) + 0.5) * cell });
  }
  out.reverse();
  out.push({ x: gx, y: gy });
  return out;
}

// ------------------------------------------------------------------ brain

type Goal = 'fight' | 'loot' | 'heal' | 'flee' | 'wander' | 'crate';

export interface BotBrain {
  id: string;
  difficulty: Difficulty;
  rng: { seed: number };
  path: { x: number; y: number }[];
  pathTarget: { x: number; y: number } | null;
  repathIn: number;
  goal: Goal;
  /** Seconds before the bot reacts to a new throw opportunity. */
  reactIn: number;
  strafe: 1 | -1;
  strafeIn: number;
  wander: { x: number; y: number } | null;
  stuckCheck: { x: number; y: number; t: number };
  /** Per-bot personality: how close it likes to fight and how greedy it is. */
  aggression: number;
}

export function createBrain(id: string, difficulty: Difficulty, seed: number): BotBrain {
  const rng = { seed };
  return {
    id, difficulty, rng,
    path: [], pathTarget: null, repathIn: 0, goal: 'wander',
    reactIn: 0, strafe: nextRandom(rng) < 0.5 ? 1 : -1, strafeIn: 1,
    wander: null, stuckCheck: { x: 0, y: 0, t: 0 },
    aggression: 0.7 + nextRandom(rng) * 0.6,
  };
}

const rnd = (b: BotBrain) => nextRandom(b.rng);

export function thinkBot(world: World, nav: NavGrid, brain: BotBrain, dt: number): InputCmd {
  const me = world.players.find((p) => p.id === brain.id);
  const inp = emptyInput();
  if (!me || !me.alive || world.phase === 'over') return inp;
  const skill = BOT.DIFFICULTY[brain.difficulty];

  brain.repathIn -= dt;
  brain.reactIn -= dt;
  brain.strafeIn -= dt;
  if (brain.strafeIn <= 0) {
    brain.strafe = rnd(brain) < 0.5 ? 1 : -1;
    brain.strafeIn = 0.8 + rnd(brain) * 1.6;
  }

  const walls = world.map.walls;
  const sees = (x: number, y: number) => !lineBlocked(me.x, me.y, x, y, walls);

  // --- sense
  let enemy: Player | null = null;
  let enemyD = Infinity;
  for (const p of world.players) {
    if (p === me || !p.alive) continue;
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    // Visible enemies count as closer: bots fight what they can see.
    const score = d * (sees(p.x, p.y) ? 1 : 1.6);
    if (score < enemyD) { enemyD = score; enemy = p; }
  }
  if (enemy) enemyD = Math.hypot(enemy.x - me.x, enemy.y - me.y);

  let loot: { x: number; y: number; d: number; tier: number } | null = null;
  for (const f of world.floor) {
    const d = Math.hypot(f.x - me.x, f.y - me.y) - f.tier * 120;
    if (!loot || d < loot.d) loot = { x: f.x, y: f.y, d, tier: f.tier };
  }
  let pack: { x: number; y: number; d: number } | null = null;
  for (const h of world.health) {
    if (h.respawnIn > 0) continue;
    const d = Math.hypot(h.x - me.x, h.y - me.y);
    if (!pack || d < pack.d) pack = { x: h.x, y: h.y, d };
  }
  let crate: { x: number; y: number; d: number } | null = null;
  for (const c of world.crates) {
    if (c.respawnIn > 0) continue;
    const d = Math.hypot(c.x - me.x, c.y - me.y);
    if (!crate || d < crate.d) crate = { x: c.x, y: c.y, d };
  }

  const mine = me.swords.length;
  const power = (p: Player) => p.swords.reduce((s: number, t) => s + TIERS[t].orbitDamage, 0) * (0.5 + p.health / PLAYER.HEALTH);
  const stronger = enemy ? power(me) * brain.aggression >= power(enemy) * 0.9 : true;
  const close = enemy !== null && enemyD < 650;

  // --- decide
  let goal: Goal;
  let target: { x: number; y: number } | null = null;
  if (me.health < 45 && pack && pack.d < 1000 && !(close && stronger && enemy!.health < 35)) {
    goal = 'heal'; target = pack;
  } else if (mine === 0) {
    if (close && enemyD < 260) { goal = 'flee'; }
    else if (loot) { goal = 'loot'; target = loot; }
    else if (crate) { goal = 'crate'; target = crate; }
    else { goal = 'wander'; }
  } else if (loot && mine < SWORD.MAX_HELD && (loot.d < 260 || (!close && loot.d < 900) || (close && !stronger && loot.d < enemyD))) {
    goal = 'loot'; target = loot;
  } else if (close) {
    goal = 'fight'; target = enemy;
  } else if (enemy && mine >= 3) {
    goal = 'fight'; target = enemy; // go hunting
  } else if (loot) {
    goal = 'loot'; target = loot;
  } else if (crate && mine < 4) {
    goal = 'crate'; target = crate;
  } else if (enemy) {
    goal = 'fight'; target = enemy;
  } else {
    goal = 'wander';
  }
  brain.goal = goal;

  // --- move
  let mx = 0;
  let my = 0;
  const steerTo = (tx: number, ty: number) => {
    const p = route(world, nav, brain, me, tx, ty);
    const dx = p.x - me.x;
    const dy = p.y - me.y;
    const d = len(dx, dy) || 1;
    mx = dx / d;
    my = dy / d;
  };

  if (goal === 'fight' && enemy) {
    const dx = enemy.x - me.x;
    const dy = enemy.y - me.y;
    const d = len(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    if (!sees(enemy.x, enemy.y)) {
      steerTo(enemy.x, enemy.y);
    } else if (stronger && mine > 0) {
      // Close to blade range and circle them so the orbit keeps grinding.
      const want = PLAYER.RADIUS * 2 + SWORD.LENGTH * 0.7;
      const radial = Math.max(-1, Math.min(1, (d - want) / 60));
      mx = ux * radial + -uy * brain.strafe * 0.9;
      my = uy * radial + ux * brain.strafe * 0.9;
      if (d > 140 && d < 260 && me.dashCd <= 0 && rnd(brain) < skill.dashChance * dt * 3) {
        inp.dash = true;
        mx = ux; my = uy;
      }
    } else {
      // Outgunned: keep throwing range and strafe.
      const want = 380;
      const radial = Math.max(-1, Math.min(1, (d - want) / 120));
      mx = ux * radial + -uy * brain.strafe * 0.8;
      my = uy * radial + ux * brain.strafe * 0.8;
    }
  } else if (goal === 'flee' && enemy) {
    const away = { x: me.x - (enemy.x - me.x) * 3, y: me.y - (enemy.y - me.y) * 3 };
    const tgt = loot ?? pack ?? away;
    steerTo(tgt.x, tgt.y);
    if (enemyD < 140 && me.dashCd <= 0 && rnd(brain) < skill.dashChance) inp.dash = true;
  } else if (target) {
    steerTo(target.x, target.y);
  } else {
    if (!brain.wander || Math.hypot(brain.wander.x - me.x, brain.wander.y - me.y) < 60) {
      brain.wander = randomOpen(world, nav, brain);
    }
    steerTo(brain.wander.x, brain.wander.y);
  }

  // --- dodge incoming swords
  for (const t of world.thrown) {
    if (t.owner === me.id) continue;
    const rx = me.x - t.x;
    const ry = me.y - t.y;
    const sp = len(t.vx, t.vy) || 1;
    const along = (rx * t.vx + ry * t.vy) / sp;
    if (along < 0 || along > 320) continue;
    const perp = (rx * -t.vy + ry * t.vx) / sp;
    if (Math.abs(perp) > PLAYER.RADIUS + 26) continue;
    if (rnd(brain) > skill.skill) continue;
    const side = perp >= 0 ? 1 : -1;
    mx = (-t.vy / sp) * side;
    my = (t.vx / sp) * side;
    if (me.dashCd <= 0 && rnd(brain) < skill.dashChance) inp.dash = true;
    break;
  }

  // --- unstick: if we've barely moved for a while, pick somewhere new
  const sc = brain.stuckCheck;
  sc.t += dt;
  if (sc.t > 1.2) {
    if (Math.hypot(me.x - sc.x, me.y - sc.y) < 25 && (mx || my) && goal !== 'fight') {
      brain.wander = randomOpen(world, nav, brain);
      brain.repathIn = 0;
      brain.path = [];
    }
    sc.x = me.x; sc.y = me.y; sc.t = 0;
  }

  inp.moveX = mx;
  inp.moveY = my;

  // --- aim & throw
  if (enemy) {
    const travel = enemyD / SWORD.THROW_SPEED;
    const lx = enemy.x + enemy.vx * travel * skill.lead;
    const ly = enemy.y + enemy.vy * travel * skill.lead;
    const a = Math.atan2(ly - me.y, lx - me.x) + (rnd(brain) - 0.5) * 2 * skill.aimError;
    inp.aimX = Math.cos(a);
    inp.aimY = Math.sin(a);

    // Throwing gives up orbit power, so only do it with swords to spare
    // (or to finish someone off).
    const keep = stronger ? 3 : 2;
    const lethal = enemy.health <= TIERS[Math.max(...me.swords, 0) as 0 | 1 | 2].throwDamage;
    const inRange = enemyD > 120 && enemyD < 150 + 500 * skill.skill;
    const clear = !lineBlocked(me.x, me.y, lx, ly, solidsCheap(world));
    if (brain.reactIn <= 0 && inRange && clear && me.throwCd <= 0 && (mine > keep || (lethal && mine > 0))) {
      brain.reactIn = skill.reaction * (0.6 + rnd(brain) * 0.8);
      if (rnd(brain) < skill.throwChance) inp.throw = true;
    }
  } else if (mx || my) {
    inp.aimX = mx;
    inp.aimY = my;
  }

  return inp;
}

/** Walls plus standing crates, used for throw line-of-sight. */
function solidsCheap(world: World): Rect[] {
  const out = world.map.walls.slice();
  for (const c of world.crates) if (c.respawnIn <= 0) out.push(crateRect(c));
  return out;
}

/** The next point to steer toward on the way to (tx, ty). */
function route(world: World, nav: NavGrid, brain: BotBrain, me: Player, tx: number, ty: number): { x: number; y: number } {
  if (clearCorridor(me.x, me.y, tx, ty, world)) {
    brain.path = [];
    return { x: tx, y: ty };
  }
  const moved = !brain.pathTarget || Math.hypot(brain.pathTarget.x - tx, brain.pathTarget.y - ty) > 80;
  if (brain.repathIn <= 0 || moved || brain.path.length === 0) {
    brain.repathIn = BOT.REPATH * (0.8 + rnd(brain) * 0.4);
    brain.pathTarget = { x: tx, y: ty };
    brain.path = findPath(nav, crateMask(world, nav), me.x, me.y, tx, ty);
  }
  // Drop waypoints we've reached, then aim at the furthest one in view.
  while (brain.path.length > 1 && Math.hypot(brain.path[0].x - me.x, brain.path[0].y - me.y) < nav.cell * 0.6) brain.path.shift();
  for (let i = Math.min(brain.path.length - 1, 6); i > 0; i--) {
    if (clearCorridor(me.x, me.y, brain.path[i].x, brain.path[i].y, world)) return brain.path[i];
  }
  return brain.path[0] ?? { x: tx, y: ty };
}

/** A ball-wide corridor from A to B touches no wall or crate. */
function clearCorridor(ax: number, ay: number, bx: number, by: number, world: World): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const d = len(dx, dy) || 1;
  const ox = (-dy / d) * PLAYER.RADIUS;
  const oy = (dx / d) * PLAYER.RADIUS;
  const rects = solidsCheap(world);
  return !lineBlocked(ax, ay, bx, by, rects)
    && !lineBlocked(ax + ox, ay + oy, bx + ox, by + oy, rects)
    && !lineBlocked(ax - ox, ay - oy, bx - ox, by - oy, rects);
}

function crateMask(world: World, nav: NavGrid): Uint8Array {
  const mask = new Uint8Array(nav.cols * nav.rows);
  for (const c of world.crates) {
    if (c.respawnIn > 0) continue;
    const r = crateRect(c);
    const pad = PLAYER.RADIUS;
    const x0 = Math.max(0, Math.floor((r.x - pad) / nav.cell));
    const x1 = Math.min(nav.cols - 1, Math.floor((r.x + r.w + pad) / nav.cell));
    const y0 = Math.max(0, Math.floor((r.y - pad) / nav.cell));
    const y1 = Math.min(nav.rows - 1, Math.floor((r.y + r.h + pad) / nav.cell));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) mask[y * nav.cols + x] = 1;
  }
  return mask;
}

function randomOpen(world: World, nav: NavGrid, brain: BotBrain): { x: number; y: number } {
  for (let i = 0; i < 30; i++) {
    const cx = Math.floor(rnd(brain) * nav.cols);
    const cy = Math.floor(rnd(brain) * nav.rows);
    if (!nav.blocked[cy * nav.cols + cx]) return { x: (cx + 0.5) * nav.cell, y: (cy + 0.5) * nav.cell };
  }
  return { x: world.map.width / 2, y: world.map.height / 2 };
}
