/**
 * Cloudflare Worker entry. Serves the built game and forwards sign-in and
 * multiplayer traffic to the single Estate Durable Object.
 */
import { SITE } from './site.gen';
export { Estate } from './estate';

interface Env {
  ESTATE: DurableObjectNamespace;
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
} satisfies ExportedHandler<Env>;
