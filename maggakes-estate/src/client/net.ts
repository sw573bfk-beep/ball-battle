import type { ClientMsg, ServerMsg } from '../shared/protocol';

type Handler = (m: ServerMsg) => void;

/** WebSocket link to the estate server, with automatic reconnect. */
export class Net {
  private ws: WebSocket | null = null;
  private queue: ClientMsg[] = [];
  private handlers: Handler[] = [];
  private closedByUs = false;
  private retry = 0;
  onStatus: (online: boolean) => void = () => {};

  constructor(private token: string) {}

  connect(): void {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(this.token)}`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.onStatus(true);
      for (const m of this.queue.splice(0)) ws.send(JSON.stringify(m));
    };
    ws.onmessage = (ev) => {
      let m: ServerMsg;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'kicked' || m.t === 'paused') this.closedByUs = true;
      for (const h of this.handlers) h(m);
    };
    ws.onclose = () => {
      this.onStatus(false);
      if (this.closedByUs) return;
      const wait = Math.min(8000, 500 * 2 ** this.retry++);
      setTimeout(() => this.connect(), wait);
    };
  }

  on(h: Handler): void { this.handlers.push(h); }

  send(m: ClientMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else if (m.t !== 'pos') this.queue.push(m);
  }

  close(): void {
    this.closedByUs = true;
    this.ws?.close();
  }
}

export async function api<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r.json() as Promise<T>;
}
