/**
 * Soccer at the Maggakes Stadium. The server runs this simulation (so nobody can
 * cheat the ball) and sends the state to everyone in the stadium ~10 times a second.
 * Coordinates are world metres with the centre spot at (0, 0). Pink (team 0) attacks
 * towards +x, Blue (team 1) towards −x.
 */

export const PITCH = { hw: 25, hd: 15, goalHalf: 3.2 };
export const MATCH_SECONDS = 180;
export const PER_TEAM = 3;
export const TEAM_NAMES = ['Pink', 'Blue'] as const;
export const TEAM_COLORS = ['#ff3d7f', '#2b6cff'] as const;
/** Matches that pay Aura each day. */
export const PAID_MATCHES_PER_DAY = 10;

export type Team = 0 | 1;
export type Phase = 'waiting' | 'kickoff' | 'play' | 'goal' | 'over';

export interface SoccerPlayer { id: string; team: Team; x: number; z: number; ry: number; bot: boolean; keeper?: boolean; cd: number }
export interface SoccerState {
  phase: Phase;
  /** Seconds left in the current pause (kickoff / goal / over). */
  wait: number;
  /** Match clock, seconds left. */
  clock: number;
  score: [number, number];
  ball: { x: number; z: number; vx: number; vz: number };
  lastTouch?: string;
  lastTeam?: Team;
  /** Goals per player id this match. */
  goals: Record<string, number>;
  players: SoccerPlayer[];
  /** Who scored last (for the "GOAL!" banner). */
  lastGoal?: { by: string; team: Team };
}

export type SoccerEvent =
  | { e: 'goal'; team: Team; by?: string }
  | { e: 'kickoff' }
  | { e: 'start' }
  | { e: 'over'; score: [number, number] };

export function newMatch(): SoccerState {
  return { phase: 'waiting', wait: 0, clock: MATCH_SECONDS, score: [0, 0], ball: { x: 0, z: 0, vx: 0, vz: 0 }, goals: {}, players: [] };
}

const attackDir = (team: Team) => (team === 0 ? 1 : -1);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Humans in the stadium: add new ones to the smaller team, drop leavers, then top teams up with bots. */
export function syncPlayers(s: SoccerState, humans: { id: string; x: number; z: number; ry: number }[]): void {
  const ids = new Set(humans.map((h) => h.id));
  s.players = s.players.filter((p) => p.bot || ids.has(p.id));
  for (const h of humans) {
    let p = s.players.find((x) => x.id === h.id);
    if (!p) {
      const count = (t: Team) => s.players.filter((x) => !x.bot && x.team === t).length;
      const team: Team = count(0) <= count(1) ? 0 : 1;
      p = { id: h.id, team, x: h.x, z: h.z, ry: h.ry, bot: false, cd: 0 };
      s.players.push(p);
    }
    p.x = h.x; p.z = h.z; p.ry = h.ry;
  }
  for (const team of [0, 1] as Team[]) {
    const humansOn = s.players.filter((p) => !p.bot && p.team === team).length;
    const want = Math.max(0, PER_TEAM - humansOn);
    let bots = s.players.filter((p) => p.bot && p.team === team);
    while (bots.length > want) { const drop = bots.find((b) => !b.keeper) ?? bots[0]; s.players.splice(s.players.indexOf(drop), 1); bots = bots.filter((b) => b !== drop); }
    let n = 0;
    while (bots.length < want) {
      const keeper = !bots.some((b) => b.keeper);
      const id = `bot${team}${keeper ? 'k' : n++}${Math.random().toString(36).slice(2, 5)}`;
      const b: SoccerPlayer = { id, team, bot: true, keeper, cd: 0, ry: 0, ...homeSpot(team, keeper, bots.length) };
      s.players.push(b); bots.push(b);
    }
  }
}

function homeSpot(team: Team, keeper: boolean, i: number): { x: number; z: number } {
  const d = attackDir(team);
  if (keeper) return { x: -d * (PITCH.hw - 1.5), z: 0 };
  return { x: -d * (8 + (i % 2) * 6), z: (i % 2 ? -6 : 6) };
}

function resetPositions(s: SoccerState): void {
  s.ball = { x: 0, z: 0, vx: 0, vz: 0 };
  let i = 0;
  for (const p of s.players) if (p.bot) { const h = homeSpot(p.team, !!p.keeper, i++); p.x = h.x; p.z = h.z; }
}

/** A kick from player `id` at angle `ang` (radians, 0 = +z) — only if they're next to the ball. */
export function kick(s: SoccerState, id: string, ang: number, power: number): boolean {
  if (s.phase !== 'play') return false;
  const p = s.players.find((x) => x.id === id);
  if (!p || p.cd > 0) return false;
  if (Math.hypot(p.x - s.ball.x, p.z - s.ball.z) > 1.8) return false; // a little slack for lag
  const pw = clamp(power, 6, 17);
  s.ball.vx = Math.sin(ang) * pw;
  s.ball.vz = Math.cos(ang) * pw;
  p.cd = 0.35;
  s.lastTouch = p.id; s.lastTeam = p.team;
  return true;
}

/** Advance the match by `dt` seconds. `rnd` is a random number source (0..1). */
export function step(s: SoccerState, dt: number, rnd: () => number): SoccerEvent[] {
  const ev: SoccerEvent[] = [];
  const humans = s.players.filter((p) => !p.bot).length;
  if (humans === 0) { if (s.phase !== 'waiting') { s.phase = 'waiting'; } return ev; }
  if (s.phase === 'waiting') { Object.assign(s, { ...newMatch(), players: s.players }); s.phase = 'kickoff'; s.wait = 3; resetPositions(s); ev.push({ e: 'kickoff' }); }
  for (const p of s.players) p.cd = Math.max(0, p.cd - dt);

  if (s.phase === 'kickoff' || s.phase === 'goal') {
    s.wait -= dt;
    if (s.wait <= 0) {
      if (s.phase === 'goal') { s.phase = 'kickoff'; s.wait = 2; resetPositions(s); ev.push({ e: 'kickoff' }); }
      else { s.phase = 'play'; ev.push({ e: 'start' }); }
    }
    return ev;
  }
  if (s.phase === 'over') {
    s.wait -= dt;
    if (s.wait <= 0) { Object.assign(s, { ...newMatch(), players: s.players }); s.phase = 'kickoff'; s.wait = 4; resetPositions(s); ev.push({ e: 'kickoff' }); }
    return ev;
  }

  // ---- play
  s.clock -= dt;
  if (s.clock <= 0) { s.clock = 0; s.phase = 'over'; s.wait = 10; ev.push({ e: 'over', score: [...s.score] as [number, number] }); return ev; }

  botsThink(s, dt, rnd);

  // Dribbling: walking into the ball nudges it along.
  const b = s.ball;
  for (const p of s.players) {
    const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.6 && d > 1e-4) {
      const nx = dx / d, nz = dz / d;
      b.x = p.x + nx * 0.6; b.z = p.z + nz * 0.6;
      const along = b.vx * nx + b.vz * nz;
      if (along < 3.5) { b.vx += nx * (3.5 - along); b.vz += nz * (3.5 - along); }
      s.lastTouch = p.id; s.lastTeam = p.team;
    }
  }

  // Ball physics: roll, slow down, bounce off the sidelines and goal lines.
  b.x += b.vx * dt; b.z += b.vz * dt;
  const f = Math.exp(-0.85 * dt);
  b.vx *= f; b.vz *= f;
  if (Math.hypot(b.vx, b.vz) < 0.05) { b.vx = 0; b.vz = 0; }
  if (Math.abs(b.z) > PITCH.hd - 0.2) { b.z = Math.sign(b.z) * (PITCH.hd - 0.2); b.vz = -b.vz * 0.7; }
  if (Math.abs(b.x) > PITCH.hw - 0.2) {
    if (Math.abs(b.z) < PITCH.goalHalf) {
      const team: Team = b.x > 0 ? 0 : 1;
      s.score[team]++;
      const by = s.lastTeam === team ? s.lastTouch : undefined;
      if (by) s.goals[by] = (s.goals[by] ?? 0) + 1;
      s.lastGoal = { by: by ?? '', team };
      s.phase = 'goal'; s.wait = 3;
      ev.push({ e: 'goal', team, by });
      return ev;
    }
    b.x = Math.sign(b.x) * (PITCH.hw - 0.2); b.vx = -b.vx * 0.7;
  }
  return ev;
}

function botsThink(s: SoccerState, dt: number, rnd: () => number): void {
  const b = s.ball;
  for (const team of [0, 1] as Team[]) {
    const d = attackDir(team);
    const mates = s.players.filter((p) => p.team === team);
    // The closest field bot chases the ball — unless a human teammate is right on it already
    // (then it supports). Idle humans standing nearby don't stop the bots from playing.
    const dist = (p: SoccerPlayer) => Math.hypot(p.x - b.x, p.z - b.z);
    const fieldBots = mates.filter((p) => p.bot && !p.keeper);
    const humanOnBall = mates.some((p) => !p.bot && dist(p) < 1.5);
    const chaser = humanOnBall ? null : fieldBots.reduce<SoccerPlayer | null>((best, p) => (!best || dist(p) < dist(best) ? p : best), null);
    for (const p of mates) {
      if (!p.bot) continue;
      let tx: number, tz: number, speed = 4.2;
      if (p.keeper) {
        // Keepers are good but beatable: they only half-follow the ball across the goal.
        tx = -d * (PITCH.hw - 1.2);
        tz = clamp(b.z * 0.45, -PITCH.goalHalf + 0.8, PITCH.goalHalf - 0.8);
        speed = 2.4;
        if (Math.hypot(b.x - p.x, b.z - p.z) < 1.3 && Math.sign(b.x) === -d) { tx = b.x; tz = b.z; speed = 3; }
      } else if (p === chaser) {
        // Get behind the ball (relative to the goal we're attacking), then run through it.
        const gx = d * PITCH.hw, gz = 0;
        const ax = b.x - gx, az = b.z - gz, al = Math.hypot(ax, az) || 1;
        const behind = { x: b.x + (ax / al) * 0.7, z: b.z + (az / al) * 0.7 };
        const onSide = (b.x - p.x) * d > -0.2;
        tx = onSide ? b.x : behind.x; tz = onSide ? b.z : behind.z;
      } else {
        tx = clamp(b.x - d * 7, -PITCH.hw + 3, PITCH.hw - 3);
        tz = clamp(b.z + (p.id.charCodeAt(p.id.length - 1) % 2 ? 7 : -7), -PITCH.hd + 2, PITCH.hd - 2);
        speed = 3.4;
      }
      const dx = tx - p.x, dz = tz - p.z, dist = Math.hypot(dx, dz);
      if (dist > 0.05) {
        const st = Math.min(dist, speed * dt);
        p.x += (dx / dist) * st; p.z += (dz / dist) * st;
        p.ry = Math.atan2(dx, dz);
      }
      // Kick at the goal when close enough (keepers clear it away).
      if (p.cd <= 0 && Math.hypot(b.x - p.x, b.z - p.z) < 1.1 && (p.keeper || rnd() < 0.6)) {
        const gz = (rnd() < 0.5 ? -1 : 1) * PITCH.goalHalf * (0.45 + rnd() * 0.4); // aim for the corners
        const ang = Math.atan2(d * PITCH.hw - b.x, gz - b.z) + (rnd() - 0.5) * 0.35;
        const far = Math.abs(d * PITCH.hw - b.x);
        s.phase === 'play' && kick(s, p.id, ang, p.keeper ? 15 : far > 18 ? 12 : 10 + rnd() * 5);
      }
    }
  }
}

/** Aura for a finished match: win 150, draw 75, loss 40, plus 25 a goal. */
export function matchReward(s: SoccerState, team: Team, goals: number): { aura: number; result: 'win' | 'draw' | 'loss' } {
  const [a, b] = team === 0 ? s.score : [s.score[1], s.score[0]];
  const result = a > b ? 'win' : a === b ? 'draw' : 'loss';
  return { aura: { win: 150, draw: 75, loss: 40 }[result] + goals * 25, result };
}

/** Compact state for the network: [phase, wait, clock, score0, score1, bx, bz, bvx, bvz, players…]. */
export interface SoccerWire { ph: Phase; w: number; c: number; sc: [number, number]; b: [number, number, number, number]; p: [string, Team, number, number, number, 0 | 1, 0 | 1][]; g?: { by: string; team: Team } }
export function toWire(s: SoccerState): SoccerWire {
  const r = (n: number) => Math.round(n * 100) / 100;
  return { ph: s.phase, w: r(s.wait), c: Math.ceil(s.clock), sc: s.score, b: [r(s.ball.x), r(s.ball.z), r(s.ball.vx), r(s.ball.vz)], p: s.players.map((p) => [p.id, p.team, r(p.x), r(p.z), r(p.ry), p.bot ? 1 : 0, p.keeper ? 1 : 0]), g: s.lastGoal };
}
