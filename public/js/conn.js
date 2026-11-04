// WebSocket connection to a game, with auto-reconnect and server clock sync.
import { wsUrl } from './api.js';

export class GameConn {
  constructor(params, onMessage, onStatus) {
    this.params = params;
    this.onMessage = onMessage;
    this.onStatus = onStatus || (() => {});
    this.offset = 0; // serverNow - localNow
    this.closed = false;
    this.tries = 0;
    this.open();
  }
  now() { return Date.now() + this.offset; }
  open() {
    if (this.closed) return;
    const ws = new WebSocket(wsUrl(this.params()));
    this.ws = ws;
    ws.onopen = () => { this.tries = 0; this.onStatus('open'); this.pingTimer = setInterval(() => this.send({ t: 'ping' }), 20000); };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (typeof msg.now === 'number') this.offset = msg.now - Date.now();
      if (msg.t === 'error' || msg.t === 'kicked') this.closed = true;
      this.onMessage(msg);
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      if (this.closed) return;
      this.onStatus('reconnecting');
      const delay = Math.min(8000, 500 * 2 ** this.tries++);
      setTimeout(() => this.open(), delay);
    };
  }
  send(msg) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));
  }
  close() {
    this.closed = true;
    clearInterval(this.pingTimer);
    try { this.ws?.close(); } catch {}
  }
}
