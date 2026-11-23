/**
 * Cloudflare Worker entry. Serves the built game and forwards sign-in and
 * multiplayer traffic to the single Estate Durable Object.
 */
import { SITE } from './site.gen';
export { Estate } from './estate';

interface Env {
  ESTATE: DurableObjectNamespace;
  REPORTS?: KVNamespace;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/') || url.pathname === '/ws') {
      const stub = env.ESTATE.get(env.ESTATE.idFromName('estate'));
      return stub.fetch(req);
    }
    const file = SITE[url.pathname] ?? SITE['/index.html'];
    if (!file) return new Response('Not built yet', { status: 404 });
    const hashed = url.pathname.startsWith('/assets/');
    return new Response(file.body, {
      headers: {
        'content-type': file.type,
        'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
        'x-content-type-options': 'nosniff',
      },
    });
  },
  /** Every 10 minutes: copy problem reports into KV so they can be read from the Cloudflare dashboard/API. */
  async scheduled(_ev: ScheduledController, env: Env): Promise<void> {
    const stub = env.ESTATE.get(env.ESTATE.idFromName('estate'));
    await stub.fetch('https://estate.internal/__export');
  },
} satisfies ExportedHandler<Env>;
