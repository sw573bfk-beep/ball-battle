import { Env, HttpError, randomToken } from './util';

const ITERATIONS = 100_000; // max PBKDF2 iterations the Workers runtime allows
const SESSION_DAYS = 30;

export interface UserRow {
  id: number;
  username: string;
  coins: number;
  equipped_skin: string;
  games_played: number;
  wins: number;
  correct_answers: number;
  last_daily: string | null;
  created_at: number;
}

const USER_COLS = 'id, username, coins, equipped_skin, games_played, wins, correct_answers, last_daily, created_at';

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

async function hashPassword(password: string, saltB64: string): Promise<string> {
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return b64(bits);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function validateCredentials(username: unknown, password: unknown): { username: string; password: string } {
  const u = String(username ?? '').trim();
  const p = String(password ?? '');
  if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) throw new HttpError(400, 'Username must be 3–20 letters, numbers or _');
  if (p.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (p.length > 200) throw new HttpError(400, 'Password is too long');
  return { username: u, password: p };
}

async function createSession(env: Env, userId: number): Promise<string> {
  const token = randomToken(32);
  const expires = Date.now() + SESSION_DAYS * 86400_000;
  await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, userId, expires).run();
  return token;
}

export async function signup(env: Env, body: any) {
  const { username, password } = validateCredentials(body.username, body.password);
  const exists = await env.DB.prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first();
  if (exists) throw new HttpError(409, 'That username is taken');
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashPassword(password, salt);
  const res = await env.DB.prepare('INSERT INTO users (username, pass_hash, salt, created_at) VALUES (?, ?, ?, ?) RETURNING ' + USER_COLS)
    .bind(username, hash, salt, Date.now())
    .first<UserRow>();
  if (!res) throw new HttpError(500, 'Could not create account');
  const token = await createSession(env, res.id);
  return { token, user: res };
}

export async function login(env: Env, body: any) {
  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  const row = await env.DB.prepare('SELECT id, pass_hash, salt FROM users WHERE username = ?').bind(username).first<{ id: number; pass_hash: string; salt: string }>();
  if (!row) throw new HttpError(401, 'Wrong username or password');
  const hash = await hashPassword(password, row.salt);
  if (!safeEqual(hash, row.pass_hash)) throw new HttpError(401, 'Wrong username or password');
  const token = await createSession(env, row.id);
  // Opportunistic cleanup of this user's expired sessions.
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(row.id, Date.now()).run();
  const user = await getUser(env, row.id);
  return { token, user };
}

export async function logout(env: Env, token: string | null) {
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
}

export function tokenFrom(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (h?.startsWith('Bearer ')) return h.slice(7).trim() || null;
  return new URL(req.url).searchParams.get('token');
}

export async function userFromToken(env: Env, token: string | null): Promise<UserRow | null> {
  if (!token || token.length > 100) return null;
  const row = await env.DB.prepare(
    `SELECT ${USER_COLS.split(', ').map((c) => 'u.' + c).join(', ')}, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
  ).bind(token).first<UserRow & { expires_at: number }>();
  if (!row || row.expires_at < Date.now()) return null;
  const { expires_at, ...user } = row;
  return user;
}

export async function requireUser(env: Env, req: Request): Promise<UserRow> {
  const user = await userFromToken(env, tokenFrom(req));
  if (!user) throw new HttpError(401, 'Please log in first');
  return user;
}

export async function getUser(env: Env, id: number): Promise<UserRow> {
  const u = await env.DB.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`).bind(id).first<UserRow>();
  if (!u) throw new HttpError(404, 'User not found');
  return u;
}
