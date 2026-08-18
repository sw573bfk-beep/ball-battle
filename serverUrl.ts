/**
 * Where the room server lives.
 *
 * Set VITE_SERVER_URL at build time to point the deployed client at the
 * deployed Cloudflare Worker. Locally it defaults to `wrangler dev`.
 */
const configured = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim();

const isLocal = typeof location !== 'undefined'
  && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

export const SERVER_URL = configured || (isLocal ? 'http://127.0.0.1:8787' : '');

export const MULTIPLAYER_AVAILABLE = SERVER_URL.length > 0;
