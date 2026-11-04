export interface Env {
  DB: D1Database;
  GAME_ROOM: DurableObjectNamespace;
  AI?: Ai;
  ASSETS: Fetcher;
  AI_MODEL?: string;
  MOCK_AI?: string;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export async function readJson<T = any>(req: Request, maxBytes = 512 * 1024): Promise<T> {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > maxBytes) throw new HttpError(413, 'Request too large');
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request too large');
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

export function randomToken(bytes = 24): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Cryptographically random float in [0, 1). */
export function rand(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

export function randomPin(): string {
  return String(100000 + Math.floor(rand() * 900000));
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
