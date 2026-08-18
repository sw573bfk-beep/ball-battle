/**
 * WebSocket client for the Durable Object room server.
 *
 * Responsibilities are deliberately narrow: connect, ship inputs, surface
 * snapshots. All prediction and interpolation lives in OnlineGame so the
 * transport stays easy to reason about (and easy to swap).
 */

import { packInput, PROTOCOL_VERSION, type ClientMsg, type RosterEntry, type ServerMsg, type WireInput } from '@shared/protocol.js';
import type { InputCmd, PlayerState, SimEvent, WireBulletLike } from './nettypes.js';
import type { MatchState } from '@shared/match.js';
import type { ObjectiveState } from '@shared/objectives.js';
import type { Powerup } from '@shared/types.js';
import type { ModeId } from '@shared/config.js';

export interface Snapshot {
  tick: number;
  ack: number;
  players: [string, number, number, number, number, number, number, number, number, number, number, number][];
  bullets: WireBulletLike[];
  scores: [number, number, number];
  events: SimEvent[];
  me: PlayerState | null;
  match: MatchState;
  objective: ObjectiveState;
  powerups: Powerup[];
  /** performance.now() when this snapshot arrived. */
  receivedAt: number;
}

export type NetStatus = 'idle' | 'connecting' | 'connected' | 'closed' | 'error' | 'full';

export interface NetHandlers {
  onWelcome?(id: string, room: string, mapId: string): void;
  onRoster?(players: RosterEntry[]): void;
  onSnapshot?(snap: Snapshot): void;
  onSettings?(mode: ModeId, mapId: string): void;
  onStatus?(status: NetStatus, detail?: string): void;
}

/** How many recent inputs to resend each packet, to survive dropped UDP-ish loss. */
const INPUT_REDUNDANCY = 3;

export class NetClient {
  private ws: WebSocket | null = null;
  private outbox: WireInput[] = [];
  private pingTimer: number | null = null;
  private lastPingSent = 0;

  id: string | null = null;
  room = '';
  status: NetStatus = 'idle';
  /** Smoothed round-trip time in milliseconds. */
  rtt = 0;

  constructor(private handlers: NetHandlers = {}) {}

  connect(httpBase: string, room: string, name: string, mode?: ModeId, mapId?: string): void {
    this.close();
    const wsBase = httpBase.replace(/^http/, 'ws').replace(/\/+$/, '');
    const modeParam = mode ? `&mode=${encodeURIComponent(mode)}` : '';
    const mapParam = mapId ? `&map=${encodeURIComponent(mapId)}` : '';
    const url = `${wsBase}/play/${encodeURIComponent(room)}?name=${encodeURIComponent(name)}${modeParam}${mapParam}`;

    this.setStatus('connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      this.setStatus('error', String(err));
      return;
    }
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.send({ t: 'hello', v: PROTOCOL_VERSION, name });
      this.pingTimer = window.setInterval(() => this.ping(), 2000);
    });

    ws.addEventListener('message', (ev) => {
      let msg: ServerMsg;
      try { msg = JSON.parse(ev.data as string) as ServerMsg; }
      catch { return; }
      this.handle(msg);
    });

    ws.addEventListener('close', () => {
      this.clearPing();
      if (this.status !== 'full') this.setStatus('closed');
    });

    ws.addEventListener('error', () => {
      this.clearPing();
      this.setStatus('error', 'connection failed');
    });
  }

  private handle(msg: ServerMsg): void {
    switch (msg.t) {
      case 'welcome':
        this.id = msg.id;
        this.room = msg.room;
        this.setStatus('connected');
        this.handlers.onWelcome?.(msg.id, msg.room, msg.mapId);
        break;
      case 'roster':
        this.handlers.onRoster?.(msg.players);
        break;
      case 'settings':
        this.handlers.onSettings?.(msg.mode, msg.mapId);
        break;
      case 'snap':
        this.handlers.onSnapshot?.({
          tick: msg.k,
          ack: msg.a,
          players: msg.p,
          bullets: msg.b,
          scores: msg.s,
          events: msg.e,
          me: msg.me,
          match: msg.m,
          objective: msg.o,
          powerups: msg.u ?? [],
          receivedAt: performance.now(),
        });
        break;
      case 'pong': {
        const sample = performance.now() - this.lastPingSent;
        this.rtt = this.rtt === 0 ? sample : this.rtt + (sample - this.rtt) * 0.2;
        break;
      }
      case 'full':
        this.setStatus('full', 'room is full');
        break;
      case 'error':
        this.setStatus('error', msg.msg);
        break;
    }
  }

  /** Queues one tick of intent; flush() actually puts it on the wire. */
  queueInput(cmd: InputCmd): void {
    this.outbox.push(packInput(cmd));
    if (this.outbox.length > 30) this.outbox.shift();
  }

  /**
   * Sends the queued inputs plus a few already-sent ones. Re-sending is far
   * cheaper than a stalled player, and the server drops anything it has
   * already acknowledged.
   */
  flush(recent: WireInput[] = []): void {
    if (!this.isOpen() || this.outbox.length === 0) return;
    const batch = recent.slice(-INPUT_REDUNDANCY).concat(this.outbox);
    this.send({ t: 'in', c: batch });
    this.outbox = [];
  }

  private ping(): void {
    if (!this.isOpen()) return;
    this.lastPingSent = performance.now();
    this.send({ t: 'ping', id: 1 });
  }

  isOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  requestRematch(): void {
    this.send({ t: 'rematch' });
  }

  setMode(mode: ModeId): void { this.send({ t: 'setMode', mode }); }
  setMap(mapId: string): void { this.send({ t: 'setMap', mapId }); }

  private send(msg: ClientMsg): void {
    if (!this.isOpen()) return;
    try { this.ws!.send(JSON.stringify(msg)); } catch { /* dropped */ }
  }

  private setStatus(status: NetStatus, detail?: string): void {
    this.status = status;
    this.handlers.onStatus?.(status, detail);
  }

  private clearPing(): void {
    if (this.pingTimer !== null) { clearInterval(this.pingTimer); this.pingTimer = null; }
  }

  close(): void {
    this.clearPing();
    if (this.ws) {
      try { this.ws.close(); } catch { /* already closed */ }
      this.ws = null;
    }
  }
}
