/**
 * Worker entry point. Its only jobs are routing and CORS — all game logic
 * lives inside the GameRoom Durable Object.
 *
 *   GET  /api/health          -> liveness
 *   POST /api/room            -> { code } for a fresh room
 *   GET  /api/room/:code      -> room info (player count)
 *   GET  /play/:code          -> WebSocket upgrade into that room
 */

export { GameRoom } from './room.js';

interface Env {
  GAME_ROOM: DurableObjectNamespace;
}

/** Unambiguous alphabet: no O/0, I/1, or similar look-alikes. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;

function makeCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function normaliseCode(raw: string): string | null {
  const code = raw.toUpperCase().trim();
  if (code.length < 1 || code.length > 8) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (path === '/api/health') return json({ ok: true });

    if (path === '/api/room' && request.method === 'POST') {
      return json({ code: makeCode() });
    }

    const infoMatch = path.match(/^\/api\/room\/([^/]+)$/);
    if (infoMatch) {
      const code = normaliseCode(decodeURIComponent(infoMatch[1]));
      if (!code) return json({ error: 'bad room code' }, 400);
      const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));
      return stub.fetch(new Request(`https://room/info?room=${code}`));
    }

    const playMatch = path.match(/^\/play\/([^/]+)$/);
    if (playMatch) {
      const code = normaliseCode(decodeURIComponent(playMatch[1]));
      if (!code) return json({ error: 'bad room code' }, 400);
      const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));
      // Forward the room settings the client asked for; the Durable Object
      // decides whether to honour them (only a fresh room may be configured).
      const params = new URLSearchParams({ room: code });
      params.set('name', url.searchParams.get('name') ?? 'Player');
      const mode = url.searchParams.get('mode');
      if (mode) params.set('mode', mode);
      const mapId = url.searchParams.get('map');
      if (mapId) params.set('map', mapId);

      return stub.fetch(new Request(`https://room/ws?${params.toString()}`, request));
    }

    return json({ error: 'not found', path }, 404);
  },
};
