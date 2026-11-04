import { normalizeQuestion, questionProblems } from '../public/js/parse.js';
import { BOX_MAP, RARITIES, SKIN_MAP, STARTER_SKINS, rollBox } from '../public/js/skins.js';
import { DAILY_BONUS, MODES, cleanOptions } from '../public/js/rules.js';
import { getUser, login, logout, requireUser, signup, tokenFrom, userFromToken, UserRow } from './auth';
import { generateQuestions } from './ai';
import { Env, HttpError, json, rand, randomPin, randomToken, readJson, today } from './util';

export { GameRoom } from './room';

const MAX_QUESTIONS = 200;

function cleanSet(body: any) {
  const title = String(body.title ?? '').trim().slice(0, 100);
  if (!title) throw new HttpError(400, 'Give your set a title');
  const description = String(body.description ?? '').trim().slice(0, 500);
  if (!Array.isArray(body.questions) || body.questions.length === 0) throw new HttpError(400, 'Add at least one question');
  if (body.questions.length > MAX_QUESTIONS) throw new HttpError(400, `Max ${MAX_QUESTIONS} questions per set`);
  const questions = body.questions.map((q: any) => normalizeQuestion(q));
  questions.forEach((q: any, i: number) => {
    const p = questionProblems(q);
    if (p.length) throw new HttpError(400, `Question ${i + 1}: ${p.join(', ')}`);
  });
  return { title, description, questions, isPublic: body.isPublic ? 1 : 0 };
}

async function publicUser(env: Env, user: UserRow) {
  const inv = await env.DB.prepare('SELECT skin_id, count FROM inventory WHERE user_id = ?').bind(user.id).all<{ skin_id: string; count: number }>();
  const owned: Record<string, number> = {};
  for (const id of STARTER_SKINS) owned[id] = 1;
  for (const r of inv.results) owned[r.skin_id] = r.count;
  return {
    id: user.id,
    username: user.username,
    coins: user.coins,
    skin: user.equipped_skin,
    stats: { games: user.games_played, wins: user.wins, correct: user.correct_answers },
    dailyReady: user.last_daily !== today(),
    owned,
  };
}

async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '');
  const method = req.method;
  const seg = path.split('/').filter(Boolean); // ['api', ...]

  // ---- accounts
  if (path === '/api/signup' && method === 'POST') {
    const r = await signup(env, await readJson(req));
    return json({ token: r.token, user: await publicUser(env, r.user) });
  }
  if (path === '/api/login' && method === 'POST') {
    const r = await login(env, await readJson(req));
    return json({ token: r.token, user: await publicUser(env, r.user) });
  }
  if (path === '/api/logout' && method === 'POST') {
    await logout(env, tokenFrom(req));
    return json({ ok: true });
  }
  if (path === '/api/me' && method === 'GET') {
    const user = await userFromToken(env, tokenFrom(req));
    return json({ user: user ? await publicUser(env, user) : null });
  }
  if (path === '/api/daily' && method === 'POST') {
    const user = await requireUser(env, req);
    const day = today();
    const res = await env.DB.prepare('UPDATE users SET coins = coins + ?, last_daily = ? WHERE id = ? AND (last_daily IS NULL OR last_daily != ?)')
      .bind(DAILY_BONUS, day, user.id, day).run();
    if (!res.meta.changes) throw new HttpError(409, 'Already claimed today — come back tomorrow!');
    return json({ user: await publicUser(env, await getUser(env, user.id)), bonus: DAILY_BONUS });
  }

  // ---- skins
  if (path === '/api/equip' && method === 'POST') {
    const user = await requireUser(env, req);
    const { skin } = await readJson(req);
    if (!SKIN_MAP[skin]) throw new HttpError(400, 'Unknown skin');
    if (!STARTER_SKINS.includes(skin)) {
      const own = await env.DB.prepare('SELECT 1 FROM inventory WHERE user_id = ? AND skin_id = ?').bind(user.id, skin).first();
      if (!own) throw new HttpError(403, "You don't own that skin yet");
    }
    await env.DB.prepare('UPDATE users SET equipped_skin = ? WHERE id = ?').bind(skin, user.id).run();
    return json({ user: await publicUser(env, await getUser(env, user.id)) });
  }
  if (path === '/api/shop/open' && method === 'POST') {
    const user = await requireUser(env, req);
    const { box: boxId } = await readJson(req);
    const box = BOX_MAP[boxId];
    if (!box) throw new HttpError(400, 'Unknown box');
    const paid = await env.DB.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?').bind(box.price, user.id, box.price).run();
    if (!paid.meta.changes) throw new HttpError(402, 'Not enough coins');
    const skin = rollBox(box, rand);
    const had = await env.DB.prepare('SELECT count FROM inventory WHERE user_id = ? AND skin_id = ?').bind(user.id, skin).first<{ count: number }>();
    let refund = 0;
    if (had) {
      refund = RARITIES[SKIN_MAP[skin].rarity as keyof typeof RARITIES].refund;
      await env.DB.batch([
        env.DB.prepare('UPDATE inventory SET count = count + 1 WHERE user_id = ? AND skin_id = ?').bind(user.id, skin),
        env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(refund, user.id),
      ]);
    } else {
      await env.DB.prepare('INSERT INTO inventory (user_id, skin_id, count) VALUES (?, ?, 1)').bind(user.id, skin).run();
    }
    return json({ skin, duplicate: !!had, refund, user: await publicUser(env, await getUser(env, user.id)) });
  }

  // ---- question sets
  if (path === '/api/sets' && method === 'GET') {
    const user = await requireUser(env, req);
    const rows = await env.DB.prepare('SELECT id, title, description, question_count, is_public, plays, updated_at FROM sets WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 200')
      .bind(user.id).all();
    return json({ sets: rows.results });
  }
  if (path === '/api/sets/public' && method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
    const stmt = q
      ? env.DB.prepare(`SELECT s.id, s.title, s.description, s.question_count, s.plays, u.username AS author FROM sets s JOIN users u ON u.id = s.owner_id
          WHERE s.is_public = 1 AND (s.title LIKE ?1 OR s.description LIKE ?1) ORDER BY s.plays DESC LIMIT 60`).bind(`%${q.replace(/[%_]/g, '')}%`)
      : env.DB.prepare(`SELECT s.id, s.title, s.description, s.question_count, s.plays, u.username AS author FROM sets s JOIN users u ON u.id = s.owner_id
          WHERE s.is_public = 1 ORDER BY s.plays DESC, s.updated_at DESC LIMIT 60`);
    return json({ sets: (await stmt.all()).results });
  }
  if (path === '/api/sets' && method === 'POST') {
    const user = await requireUser(env, req);
    const s = cleanSet(await readJson(req));
    const now = Date.now();
    const row = await env.DB.prepare('INSERT INTO sets (owner_id, title, description, questions, question_count, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id')
      .bind(user.id, s.title, s.description, JSON.stringify(s.questions), s.questions.length, s.isPublic, now, now).first<{ id: number }>();
    return json({ id: row!.id });
  }
  if (seg[1] === 'sets' && seg[2] && /^\d+$/.test(seg[2])) {
    const id = Number(seg[2]);
    if (method === 'GET' && seg.length === 3) {
      const user = await userFromToken(env, tokenFrom(req));
      const row = await env.DB.prepare('SELECT s.*, u.username AS author FROM sets s JOIN users u ON u.id = s.owner_id WHERE s.id = ?').bind(id).first<any>();
      if (!row || (!row.is_public && row.owner_id !== user?.id)) throw new HttpError(404, 'Set not found');
      return json({ set: { id: row.id, title: row.title, description: row.description, questions: JSON.parse(row.questions), isPublic: !!row.is_public, plays: row.plays, author: row.author, mine: row.owner_id === user?.id } });
    }
    const user = await requireUser(env, req);
    if (method === 'PUT' && seg.length === 3) {
      const s = cleanSet(await readJson(req));
      const res = await env.DB.prepare('UPDATE sets SET title = ?, description = ?, questions = ?, question_count = ?, is_public = ?, updated_at = ? WHERE id = ? AND owner_id = ?')
        .bind(s.title, s.description, JSON.stringify(s.questions), s.questions.length, s.isPublic, Date.now(), id, user.id).run();
      if (!res.meta.changes) throw new HttpError(404, 'Set not found');
      return json({ id });
    }
    if (method === 'DELETE' && seg.length === 3) {
      await env.DB.prepare('DELETE FROM sets WHERE id = ? AND owner_id = ?').bind(id, user.id).run();
      return json({ ok: true });
    }
    if (method === 'POST' && seg[3] === 'copy') {
      const row = await env.DB.prepare('SELECT * FROM sets WHERE id = ? AND (is_public = 1 OR owner_id = ?)').bind(id, user.id).first<any>();
      if (!row) throw new HttpError(404, 'Set not found');
      const now = Date.now();
      const out = await env.DB.prepare('INSERT INTO sets (owner_id, title, description, questions, question_count, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?) RETURNING id')
        .bind(user.id, (row.title + ' (copy)').slice(0, 100), row.description, row.questions, row.question_count, now, now).first<{ id: number }>();
      return json({ id: out!.id });
    }
  }

  // ---- AI
  if (path === '/api/generate' && method === 'POST') {
    const user = await requireUser(env, req);
    return json(await generateQuestions(env, user, await readJson(req)));
  }

  // ---- games
  if (path === '/api/games' && method === 'POST') {
    const user = await requireUser(env, req);
    const body = await readJson(req);
    const mode = String(body.mode);
    if (!(mode in MODES)) throw new HttpError(400, 'Unknown game mode');
    const row = await env.DB.prepare('SELECT id, title, questions, owner_id, is_public FROM sets WHERE id = ?').bind(Number(body.setId)).first<any>();
    if (!row || (!row.is_public && row.owner_id !== user.id)) throw new HttpError(404, 'Set not found');
    const hostKey = randomToken(24);
    const init = { mode, options: cleanOptions(mode as any, body.options), title: row.title, setId: row.id, questions: JSON.parse(row.questions), hostKey, hostUserId: user.id };
    for (let attempt = 0; attempt < 8; attempt++) {
      const pin = randomPin();
      const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(pin));
      const res = await stub.fetch('https://room/init', { method: 'POST', body: JSON.stringify({ ...init, pin }) });
      if (res.ok) return json({ pin, hostKey });
      if (res.status !== 409) throw new HttpError(500, 'Could not start the game');
    }
    throw new HttpError(503, 'Could not find a free game PIN, try again');
  }
  if (seg[1] === 'games' && seg[2] && method === 'GET') {
    const pin = seg[2];
    if (!/^\d{6}$/.test(pin)) return json({ exists: false });
    const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(pin));
    const res = await stub.fetch('https://room/info');
    return json(await res.json());
  }

  throw new HttpError(404, 'Not found');
}

async function handleSocket(req: Request, env: Env, url: URL): Promise<Response> {
  if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('Expected websocket', { status: 426 });
  const pin = url.searchParams.get('pin') || '';
  if (!/^\d{6}$/.test(pin)) return new Response('Bad PIN', { status: 400 });
  const user = await userFromToken(env, url.searchParams.get('token'));
  const headers = new Headers(req.headers);
  headers.delete('x-qc-user');
  if (user) headers.set('x-qc-user', JSON.stringify({ id: user.id, username: user.username, skin: user.equipped_skin }));
  const forward = new URL(req.url);
  forward.searchParams.delete('token');
  const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(pin));
  return stub.fetch(new Request(forward.toString(), { method: 'GET', headers }));
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname === '/ws') return await handleSocket(req, env, url);
      if (url.pathname.startsWith('/api/')) return await handleApi(req, env, url);
      return env.ASSETS.fetch(req);
    } catch (e: any) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Server error' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
