/**
 * GameRoom — one Durable Object per room code.
 *
 * The object *is* the game server: it owns the world, runs the shared
 * simulation at a fixed 60Hz, and is the only thing allowed to decide what
 * happened. Clients send intent; everything else is computed here.
 */

import { MAX_CATCHUP_TICKS, NET, TICK_DT, TICK_RATE } from '../../shared/config.js';
import { DEFAULT_MAP } from '../../shared/maps.js';
import { addPlayer, createWorld, stepWorld } from '../../shared/sim.js';
import { emptyInput, type InputCmd, type SimEvent, type TeamId, type WorldState } from '../../shared/types.js';
import { requestRematch } from '../../shared/match.js';
import { MODE_RULES, type ModeId } from '../../shared/config.js';
import { MAPS } from '../../shared/maps.js';
import { resetObjective } from '../../shared/objectives.js';
import {
  PROTOCOL_VERSION, packPlayer, unpackInput,
  type ClientMsg, type RosterEntry, type ServerMsg, type WireBullet, type WirePlayer,
} from '../../shared/protocol.js';

const MAX_PLAYERS = 12;
/** Ticks between snapshots. 60 / 3 = 20 snapshots per second. */
const SNAPSHOT_EVERY = Math.max(1, Math.round(TICK_RATE / NET.SNAPSHOT_RATE));
/** Drop a client that floods us — a simple, blunt anti-abuse measure. */
const MAX_MSGS_PER_SECOND = 200;
/** Never buffer more than this many unprocessed inputs per player. */
const MAX_QUEUED_INPUTS = 20;
/** Shut the room's loop down after this long with nobody in it. */
const IDLE_SHUTDOWN_MS = 30_000;

interface Session {
  id: string;
  name: string;
  socket: WebSocket;
  /** Inputs received but not yet simulated, ordered by seq. */
  queue: InputCmd[];
  /** Last input actually applied — repeated if the queue runs dry (packet loss). */
  last: InputCmd;
  /** Highest seq we have simulated; echoed back so the client can reconcile. */
  ack: number;
  msgCount: number;
  msgWindowStart: number;
  joinedTick: number;
}

export class GameRoom implements DurableObject {
  private world: WorldState;
  private sessions = new Map<WebSocket, Session>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastStep = 0;
  private accumulator = 0;
  private pendingEvents: SimEvent[] = [];
  private nextPlayerNum = 1;
  private roomCode = '';
  private emptySince = 0;

  constructor(_state: DurableObjectState, _env: unknown) {
    this.world = createWorld(DEFAULT_MAP);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    this.roomCode = url.searchParams.get('room') ?? this.roomCode;

    if (url.pathname.endsWith('/info')) {
      return json({
        room: this.roomCode,
        players: this.sessions.size,
        max: MAX_PLAYERS,
        mapId: this.world.map.id,
      });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    if (this.sessions.size >= MAX_PLAYERS) {
      const pair = new WebSocketPair();
      pair[1].accept();
      send(pair[1], { t: 'full' });
      pair[1].close(4001, 'room full');
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    // The first player through the door picks the room's mode and map.
    if (this.sessions.size === 0) {
      const mode = url.searchParams.get('mode');
      if (mode && mode in MODE_RULES) this.setMode(mode as ModeId);
      const mapId = url.searchParams.get('map');
      if (mapId && mapId in MAPS) this.setMap(mapId);
    }

    const name = (url.searchParams.get('name') ?? 'Player').slice(0, 16);
    const pair = new WebSocketPair();
    this.accept(pair[1], name);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  // ------------------------------------------------------------- connections

  private accept(socket: WebSocket, name: string): void {
    socket.accept();

    const id = `p${this.nextPlayerNum++}`;
    const team = this.pickTeam();
    const player = addPlayer(this.world, id, name, team);

    const session: Session = {
      id, name, socket,
      queue: [],
      last: emptyInput(0),
      ack: 0,
      msgCount: 0,
      msgWindowStart: Date.now(),
      joinedTick: this.world.tick,
    };
    this.sessions.set(socket, session);

    socket.addEventListener('message', (event) => this.onMessage(session, event));
    socket.addEventListener('close', () => this.onClose(socket));
    socket.addEventListener('error', () => this.onClose(socket));

    send(socket, {
      t: 'welcome',
      v: PROTOCOL_VERSION,
      id,
      room: this.roomCode,
      mapId: this.world.map.id,
      tick: this.world.tick,
    });
    this.broadcastRoster();
    this.broadcastSettings();
    this.ensureRunning();
    void player;
  }

  private onClose(socket: WebSocket): void {
    const session = this.sessions.get(socket);
    if (!session) return;
    this.sessions.delete(socket);
    this.world.players.delete(session.id);
    // Bullets outlive their owner harmlessly, but drop them to avoid orphan kills.
    this.world.projectiles = this.world.projectiles.filter((b) => b.owner !== session.id);
    this.broadcastRoster();
    if (this.sessions.size === 0) this.emptySince = Date.now();
  }

  private onMessage(session: Session, event: MessageEvent): void {
    // --- flood protection
    const now = Date.now();
    if (now - session.msgWindowStart > 1000) {
      session.msgWindowStart = now;
      session.msgCount = 0;
    }
    if (++session.msgCount > MAX_MSGS_PER_SECOND) {
      session.socket.close(4002, 'too many messages');
      return;
    }

    let msg: ClientMsg;
    try {
      const raw = typeof event.data === 'string' ? event.data : '';
      if (!raw || raw.length > 8192) return;
      msg = JSON.parse(raw) as ClientMsg;
    } catch {
      return;                                        // malformed input is simply ignored
    }
    if (!msg || typeof msg !== 'object') return;

    switch (msg.t) {
      case 'in': {
        if (!Array.isArray(msg.c)) return;
        for (const wire of msg.c.slice(0, MAX_QUEUED_INPUTS)) {
          if (!Array.isArray(wire) || wire.length !== 5) continue;
          const cmd = unpackInput(wire);
          if (!Number.isFinite(cmd.seq) || cmd.seq <= session.ack) continue;
          if (session.queue.length >= MAX_QUEUED_INPUTS) session.queue.shift();
          // Keep the queue ordered and free of duplicates.
          if (session.queue.some((q) => q.seq === cmd.seq)) continue;
          session.queue.push(cmd);
        }
        session.queue.sort((a, b) => a.seq - b.seq);
        break;
      }
      case 'ping':
        send(session.socket, { t: 'pong', id: typeof msg.id === 'number' ? msg.id : 0 });
        break;
      case 'setMode':
        if (typeof msg.mode === 'string' && msg.mode in MODE_RULES) this.setMode(msg.mode as ModeId);
        break;
      case 'setMap':
        if (typeof msg.mapId === 'string' && msg.mapId in MAPS) this.setMap(msg.mapId);
        break;
      case 'rematch':
        // Any player can shortcut the results screen — "run it back" should
        // never be gated behind waiting for a host.
        requestRematch(this.world);
        break;
      case 'hello':
        if (typeof msg.name === 'string') {
          session.name = msg.name.slice(0, 16) || session.name;
          const p = this.world.players.get(session.id);
          if (p) p.name = session.name;
          this.broadcastRoster();
        }
        break;
      default:
        break;
    }
  }

  /** Mode changes only take effect between matches, never mid-fight. */
  private setMode(mode: ModeId): void {
    if (this.world.match.phase === 'live' || this.world.match.phase === 'countdown') return;
    if (this.world.match.mode === mode) return;
    this.world.match.mode = mode;
    this.world.match.scoreTarget = MODE_RULES[mode].scoreTarget;
    this.world.match.duration = MODE_RULES[mode].duration;
    resetObjective(this.world);
    this.broadcastSettings();
  }

  private setMap(mapId: string): void {
    if (this.world.match.phase === 'live' || this.world.match.phase === 'countdown') return;
    if (this.world.map.id === mapId) return;
    this.world.map = MAPS[mapId];
    resetObjective(this.world);
    this.broadcastSettings();
  }

  private broadcastSettings(): void {
    this.broadcast({ t: 'settings', mode: this.world.match.mode, mapId: this.world.map.id });
  }

  /** Balances teams by headcount; ties go to red. */
  private pickTeam(): TeamId {
    let red = 0, blue = 0;
    for (const p of this.world.players.values()) {
      if (p.team === 0) red++;
      else if (p.team === 1) blue++;
    }
    return red <= blue ? 0 : 1;
  }

  // -------------------------------------------------------------- simulation

  private ensureRunning(): void {
    if (this.timer !== null) return;
    this.lastStep = Date.now();
    this.accumulator = 0;
    this.timer = setInterval(() => this.loop(), 1000 / TICK_RATE);
  }

  private stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private loop(): void {
    const now = Date.now();
    const dt = Math.min((now - this.lastStep) / 1000, 0.25);
    this.lastStep = now;

    if (this.sessions.size === 0) {
      if (this.emptySince && now - this.emptySince > IDLE_SHUTDOWN_MS) this.stop();
      return;
    }
    this.emptySince = 0;

    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= TICK_DT && steps < MAX_CATCHUP_TICKS) {
      this.simulateTick();
      this.accumulator -= TICK_DT;
      steps++;
    }
    if (steps === MAX_CATCHUP_TICKS) this.accumulator = 0;

    if (steps > 0 && this.world.tick % SNAPSHOT_EVERY === 0) this.broadcastSnapshot();
  }

  private simulateTick(): void {
    const inputs = new Map<string, InputCmd>();
    for (const session of this.sessions.values()) {
      const next = session.queue.shift();
      if (next) {
        session.last = next;
        session.ack = next.seq;
      }
      // Repeating the last input on a dropped packet beats freezing the player.
      inputs.set(session.id, session.last);
    }

    stepWorld(this.world, inputs);
    for (const e of this.world.events) this.pendingEvents.push(e);
    if (this.pendingEvents.length > 120) {
      this.pendingEvents.splice(0, this.pendingEvents.length - 120);
    }
  }

  // ----------------------------------------------------------- broadcasting

  private broadcastRoster(): void {
    const players: RosterEntry[] = [];
    for (const p of this.world.players.values()) {
      players.push({ id: p.id, name: p.name, team: p.team });
    }
    this.broadcast({ t: 'roster', players });
  }

  private broadcastSnapshot(): void {
    const p: WirePlayer[] = [];
    for (const player of this.world.players.values()) p.push(packPlayer(player));

    const b: WireBullet[] = [];
    for (const bullet of this.world.projectiles) {
      b.push([
        bullet.id,
        Math.round(bullet.x * 10) / 10,
        Math.round(bullet.y * 10) / 10,
        Math.round(bullet.vx),
        Math.round(bullet.vy),
        bullet.team,
      ]);
    }

    const events = this.pendingEvents;
    this.pendingEvents = [];

    for (const session of this.sessions.values()) {
      const me = this.world.players.get(session.id) ?? null;
      const msg: ServerMsg = {
        t: 'snap',
        k: this.world.tick,
        a: session.ack,
        p, b, e: events,
        s: this.world.scores,
        m: this.world.match,
        o: this.world.objective,
        u: this.world.powerups,
        me,
      };
      send(session.socket, msg);
    }
  }

  private broadcast(msg: ServerMsg): void {
    for (const session of this.sessions.values()) send(session.socket, msg);
  }
}

function send(socket: WebSocket, msg: ServerMsg): void {
  try {
    socket.send(JSON.stringify(msg));
  } catch {
    // Socket is gone; the close handler will clean it up.
  }
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
}
