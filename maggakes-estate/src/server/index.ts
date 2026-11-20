/**
 * Cloudflare Worker entry. Serves the built game and forwards sign-in and
 * multiplayer traffic to the single Estate Durable Object.
 */
export { Estate } from './estate';

interface Env {
  ESTATE: DurableObjectNamespace;
  ASSETS: Fetcher;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/') || url.pathname === '/ws') {
      const stub = env.ESTATE.get(env.ESTATE.idFromName('estate'));
      return stub.fetch(req);
    }
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
