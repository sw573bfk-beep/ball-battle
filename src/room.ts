import { DurableObject } from 'cloudflare:workers';
import { CLASSIC, UPGRADES, chestLabel, classicPoints, coinReward, racePenalty, raceEarn, rollChest } from '../public/js/rules.js';
import { SKIN_MAP, STARTER_SKINS } from '../public/js/skins.js';
import { Env, rand, randomToken } from './util';

type Mode = 'classic' | 'race' | 'gold';
type Phase = 'lobby' | 'getready' | 'question' | 'reveal' | 'leaderboard' | 'playing' | 'ended';

interface Question { q: string; answers: string[]; correct: number; time: number }

interface Player {
  id: string;
  secret: string;
  name: string;
  skin: string;
  userId: number | null;
  ws: WebSocket | null;
  score: number;
  streak: number;
  correct: number;
  answeredCount: number;
  // classic
  answer: { i: number; at: number } | null;
  lastPoints: number;
  lastCorrect: boolean;
  // self-paced
  deck: number[];
  deckPos: number;
  current: number | null;
  lockedUntil: number;
  levels: { income: number; multiplier: number; streak: number; shield: number };
  chest: { outcomes: { kind: string; amount?: number }[] } | null;
  steal: { kind: 'steal' | 'swap'; amount?: number } | null;
  result: any;
  reward: number | null;
  place: number | null;
}

interface Game {
  pin: string;
  mode: Mode;
  title: string;
  setId: number;
  questions: Question[];
  order: number[];
  options: any;
  hostKey: string;
  hostUserId: number;
  phase: Phase;
  qIndex: number;
  qStartedAt: number;
  qEndsAt: number;
  endsAt: number;
  startedAt: number;
  createdAt: number;
  feed: { at: number; text: string }[];
  counts: number[];
  podium: any[] | null;
}

const MAX_PLAYERS = 120;
const WRONG_LOCK_MS = 1200;
const GAME_TTL_MS = 4 * 3600_000;
const BAD_WORDS = /\b(fuck|shit|bitch|cunt|nigg|fag|dick|cock|pussy|whore|slut|rape|nazi)/i;

function shuffleIdx(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function send(ws: WebSocket | null, msg: any) {
  if (!ws) return;
  try { ws.send(JSON.stringify(msg)); } catch { /* closed */ }
}

export class GameRoom extends DurableObject<Env> {
  game: Game | null = null;
  players = new Map<string, Player>();
  hosts = new Set<WebSocket>();
  kicked = new Set<string>();
  timer: ReturnType<typeof setTimeout> | null = null;
  endTimer: ReturnType<typeof setTimeout> | null = null;
  boardTimer: ReturnType<typeof setTimeout> | null = null;

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/init' && req.method === 'POST') return this.init(await req.json());
    if (url.pathname === '/info') {
      const g = this.game;
      if (!g || g.phase === 'ended' || Date.now() - g.createdAt > GAME_TTL_MS) return Response.json({ exists: false });
      return Response.json({ exists: true, mode: g.mode, title: g.title, phase: g.phase, players: this.players.size });
    }
    if (url.pathname === '/ws') return this.connectSocket(req, url);
    return new Response('Not found', { status: 404 });
  }

  init(body: any): Response {
    const g = this.game;
    if (g && g.phase !== 'ended' && Date.now() - g.createdAt < GAME_TTL_MS) return new Response('PIN in use', { status: 409 });
    this.reset();
    const questions: Question[] = body.questions;
    this.game = {
      pin: body.pin,
      mode: body.mode,
      title: body.title,
      setId: body.setId,
      questions,
      order: body.mode === 'classic' && body.options.shuffle ? shuffleIdx(questions.length) : questions.map((_, i) => i),
      options: body.options,
      hostKey: body.hostKey,
      hostUserId: body.hostUserId,
      phase: 'lobby',
      qIndex: -1,
      qStartedAt: 0,
      qEndsAt: 0,
      endsAt: 0,
      startedAt: 0,
      createdAt: Date.now(),
      feed: [],
      counts: [],
      podium: null,
    };
    return new Response('ok');
  }

  reset() {
    for (const p of this.players.values()) try { p.ws?.close(1000, 'reset'); } catch {}
    for (const h of this.hosts) try { h.close(1000, 'reset'); } catch {}
    this.players.clear();
    this.hosts.clear();
    this.kicked.clear();
    this.clearTimers();
  }

  clearTimers() {
    if (this.timer) clearTimeout(this.timer);
    if (this.endTimer) clearTimeout(this.endTimer);
    if (this.boardTimer) clearTimeout(this.boardTimer);
    this.timer = this.endTimer = this.boardTimer = null;
  }

  // ------------------------------------------------------------------ connections

  connectSocket(req: Request, url: URL): Response {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    const g = this.game;
    const fail = (msg: string) => {
      send(server, { t: 'error', message: msg });
      server.close(1000, msg.slice(0, 100));
      return new Response(null, { status: 101, webSocket: client });
    };
    if (!g || Date.now() - g.createdAt > GAME_TTL_MS) return fail("Couldn't find a game with that PIN.");

    const role = url.searchParams.get('role');
    if (role === 'host') {
      if (url.searchParams.get('key') !== g.hostKey) return fail('Not the host of this game.');
      this.hosts.add(server);
      server.addEventListener('message', (ev) => this.onHost(server, ev.data));
      server.addEventListener('close', () => this.hosts.delete(server));
      server.addEventListener('error', () => this.hosts.delete(server));
      this.syncHost(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    // Player: reconnect, or join fresh.
    const pid = url.searchParams.get('pid');
    const secret = url.searchParams.get('secret');
    let p = pid ? this.players.get(pid) : undefined;
    if (p && p.secret !== secret) p = undefined;
    if (!p) {
      if (secret && this.kicked.has(secret)) return fail('You were removed from this game.');
      if (g.phase === 'ended') return fail('This game has already ended.');
      if (this.players.size >= MAX_PLAYERS) return fail('This game is full.');
      let userInfo: { id: number; username: string; skin: string } | null = null;
      try { userInfo = JSON.parse(req.headers.get('x-qc-user') || 'null'); } catch {}
      let name = (url.searchParams.get('name') || userInfo?.username || '').replace(/[^\p{L}\p{N} _.\-!?]/gu, '').trim().slice(0, 18);
      if (!name) return fail('Pick a nickname first.');
      if (BAD_WORDS.test(name)) return fail('Please pick a different nickname.');
      const taken = new Set([...this.players.values()].map((x) => x.name.toLowerCase()));
      if (taken.has(name.toLowerCase())) {
        let n = 2;
        while (taken.has(`${name} ${n}`.toLowerCase())) n++;
        name = `${name.slice(0, 15)} ${n}`;
      }
      const skin = userInfo && SKIN_MAP[userInfo.skin] ? userInfo.skin : STARTER_SKINS[Math.floor(rand() * STARTER_SKINS.length)];
      p = {
        id: randomToken(6), secret: randomToken(18), name, skin, userId: userInfo?.id ?? null, ws: null,
        score: 0, streak: 0, correct: 0, answeredCount: 0,
        answer: null, lastPoints: 0, lastCorrect: false,
        deck: shuffleIdx(g.questions.length), deckPos: 0, current: null, lockedUntil: 0,
        levels: { income: 0, multiplier: 0, streak: 0, shield: 0 },
        chest: null, steal: null, result: null, reward: null, place: null,
      };
      this.players.set(p.id, p);
      this.feed(`${p.name} joined`);
    } else if (p.ws && p.ws !== server) {
      try { p.ws.close(1000, 'replaced'); } catch {}
    }
    const player = p;
    player.ws = server;
    server.addEventListener('message', (ev) => this.onPlayer(player, server, ev.data));
    const gone = () => {
      if (player.ws === server) {
        player.ws = null;
        this.lobbyChanged();
      }
    };
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    send(server, { t: 'welcome', you: { id: player.id, secret: player.secret, name: player.name, skin: player.skin, guest: player.userId == null }, game: this.publicGame() });
    this.syncPlayer(player);
    this.lobbyChanged();
    return new Response(null, { status: 101, webSocket: client });
  }

  publicGame() {
    const g = this.game!;
    return { pin: g.pin, mode: g.mode, title: g.title, options: g.options, total: g.questions.length };
  }

  playerList() {
    return [...this.players.values()].map((p) => ({ id: p.id, name: p.name, skin: p.skin, online: !!p.ws, score: p.score }));
  }

  ranking(): Player[] {
    return [...this.players.values()].sort((a, b) => b.score - a.score || b.correct - a.correct || a.name.localeCompare(b.name));
  }

  board(limit = 10) {
    return this.ranking().slice(0, limit).map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, skin: p.skin, score: p.score, streak: p.streak }));
  }

  toHosts(msg: any) {
    for (const h of this.hosts) send(h, msg);
  }
  toPlayers(fn: (p: Player) => any) {
    for (const p of this.players.values()) if (p.ws) send(p.ws, fn(p));
  }

  feed(text: string) {
    const g = this.game!;
    g.feed.push({ at: Date.now(), text });
    if (g.feed.length > 30) g.feed.shift();
    this.toHosts({ t: 'feed', item: { at: Date.now(), text } });
  }

  lobbyChanged() {
    const g = this.game!;
    if (g.phase === 'lobby') {
      const players = this.playerList();
      this.toHosts({ t: 'lobby', players });
      this.toPlayers(() => ({ t: 'lobby', count: players.length }));
    } else {
      this.scheduleBoard();
    }
  }

  // Throttled leaderboard pushes during self-paced games.
  scheduleBoard() {
    if (this.boardTimer) return;
    this.boardTimer = setTimeout(() => {
      this.boardTimer = null;
      const g = this.game;
      if (!g || g.phase === 'ended') return;
      const board = this.board(g.mode === 'classic' ? 10 : 50);
      this.toHosts({ t: 'board', board, players: this.players.size, now: Date.now() });
      if (g.mode !== 'classic') {
        const ranked = this.ranking();
        this.toPlayers((p) => ({ t: 'rank', rank: ranked.indexOf(p) + 1, of: ranked.length, top: board.slice(0, 5) }));
      }
    }, 400);
  }

  syncHost(ws: WebSocket) {
    const g = this.game!;
    send(ws, { t: 'hostWelcome', game: this.publicGame(), phase: g.phase, players: this.playerList(), feed: g.feed, now: Date.now() });
    if (g.phase === 'lobby') return;
    if (g.phase === 'ended') return send(ws, { t: 'end', podium: g.podium });
    if (g.mode === 'classic') {
      if (g.phase === 'getready') send(ws, this.hostQuestionMsg('getready'));
      if (g.phase === 'question') send(ws, this.hostQuestionMsg('question'));
      if (g.phase === 'reveal') send(ws, this.revealHostMsg());
      if (g.phase === 'leaderboard') send(ws, { t: 'leaderboard', board: this.board(), n: g.qIndex + 1, total: g.order.length });
    } else {
      send(ws, { t: 'playing', endsAt: g.endsAt, now: Date.now(), goal: g.options.goal });
      send(ws, { t: 'board', board: this.board(50), players: this.players.size, now: Date.now() });
    }
  }

  syncPlayer(p: Player) {
    const g = this.game!;
    if (g.phase === 'lobby') return send(p.ws, { t: 'lobby', count: this.players.size });
    if (g.phase === 'ended') return send(p.ws, this.endPlayerMsg(p));
    if (g.mode === 'classic') {
      if (g.phase === 'getready') send(p.ws, { t: 'getready', n: g.qIndex + 1, total: g.order.length, now: Date.now(), at: g.qStartedAt });
      if (g.phase === 'question') {
        if (p.answer) send(p.ws, { t: 'answered' });
        else send(p.ws, this.playerQuestionMsg());
      }
      if (g.phase === 'reveal' || g.phase === 'leaderboard') send(p.ws, this.revealPlayerMsg(p));
    } else {
      send(p.ws, { t: 'playing', endsAt: g.endsAt, now: Date.now(), goal: g.options.goal, me: this.me(p) });
      if (p.chest) send(p.ws, { t: 'chests' });
      else if (p.steal) send(p.ws, { t: 'pickTarget', kind: p.steal.kind, amount: p.steal.amount, targets: this.targets(p) });
      else if (p.result) send(p.ws, p.result);
      else this.nextSelfPaced(p);
    }
  }

  // ------------------------------------------------------------------ host actions

  onHost(ws: WebSocket, raw: any) {
    let msg: any;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    const g = this.game;
    if (!g) return;
    switch (msg.t) {
      case 'start':
        if (g.phase !== 'lobby') return;
        if (this.players.size === 0) return send(ws, { t: 'toast', message: 'Wait for at least one player to join.' });
        g.startedAt = Date.now();
        if (g.mode === 'classic') this.classicNext();
        else this.startSelfPaced();
        break;
      case 'next':
        if (g.mode !== 'classic') return;
        if (g.phase === 'question') this.classicReveal();
        else if (g.phase === 'reveal') {
          g.phase = 'leaderboard';
          const board = this.board();
          this.toHosts({ t: 'leaderboard', board, n: g.qIndex + 1, total: g.order.length });
          this.toPlayers((p) => this.revealPlayerMsg(p));
        } else if (g.phase === 'leaderboard') this.classicNext();
        break;
      case 'kick': {
        const p = this.players.get(String(msg.id));
        if (!p) return;
        this.kicked.add(p.secret);
        send(p.ws, { t: 'kicked' });
        try { p.ws?.close(1000, 'kicked'); } catch {}
        this.players.delete(p.id);
        this.lobbyChanged();
        this.maybeAllAnswered();
        break;
      }
      case 'end':
        if (g.phase !== 'ended') this.endGame();
        break;
    }
  }

  // ------------------------------------------------------------------ Live Quiz (classic)

  currentQuestion(): Question {
    const g = this.game!;
    return g.questions[g.order[g.qIndex]];
  }

  hostQuestionMsg(kind: 'getready' | 'question') {
    const g = this.game!;
    const q = this.currentQuestion();
    const answered = [...this.players.values()].filter((p) => p.answer).length;
    return { t: kind, n: g.qIndex + 1, total: g.order.length, q: q.q, answers: q.answers, time: Math.round(q.time * g.options.timeScale), at: g.qStartedAt, endsAt: g.qEndsAt, now: Date.now(), answered, players: this.players.size };
  }

  playerQuestionMsg() {
    const g = this.game!;
    const q = this.currentQuestion();
    return { t: 'question', n: g.qIndex + 1, total: g.order.length, q: q.q, answers: q.answers, endsAt: g.qEndsAt, now: Date.now() };
  }

  classicNext() {
    const g = this.game!;
    if (g.qIndex + 1 >= g.order.length) return this.endGame();
    g.qIndex++;
    g.phase = 'getready';
    const q = this.currentQuestion();
    const limit = Math.round(q.time * g.options.timeScale) * 1000;
    g.qStartedAt = Date.now() + CLASSIC.getReadyMs;
    g.qEndsAt = g.qStartedAt + limit;
    g.counts = q.answers.map(() => 0);
    for (const p of this.players.values()) p.answer = null;
    this.toHosts(this.hostQuestionMsg('getready'));
    this.toPlayers(() => ({ t: 'getready', n: g.qIndex + 1, total: g.order.length, now: Date.now(), at: g.qStartedAt }));
    this.setTimer(() => {
      g.phase = 'question';
      this.toHosts(this.hostQuestionMsg('question'));
      this.toPlayers(() => this.playerQuestionMsg());
      this.setTimer(() => this.classicReveal(), limit + 300);
    }, CLASSIC.getReadyMs);
  }

  setTimer(fn: () => void, ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; fn(); }, ms);
  }

  classicAnswer(p: Player, i: number) {
    const g = this.game!;
    if (g.phase !== 'question' || p.answer) return;
    const q = this.currentQuestion();
    if (!Number.isInteger(i) || i < 0 || i >= q.answers.length) return;
    const now = Date.now();
    p.answer = { i, at: Math.min(now, g.qEndsAt) };
    g.counts[i]++;
    send(p.ws, { t: 'answered' });
    const answered = [...this.players.values()].filter((x) => x.answer).length;
    this.toHosts({ t: 'answerCount', answered, players: this.players.size });
    this.maybeAllAnswered();
  }

  maybeAllAnswered() {
    const g = this.game!;
    if (g.mode !== 'classic' || g.phase !== 'question') return;
    const active = [...this.players.values()].filter((p) => p.ws);
    if (active.length > 0 && active.every((p) => p.answer)) this.setTimer(() => this.classicReveal(), 600);
  }

  classicReveal() {
    const g = this.game!;
    if (g.phase !== 'question') return;
    g.phase = 'reveal';
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const q = this.currentQuestion();
    const limit = g.qEndsAt - g.qStartedAt;
    for (const p of this.players.values()) {
      const right = !!p.answer && p.answer.i === q.correct;
      p.lastCorrect = right;
      if (p.answer) p.answeredCount++;
      if (right) {
        p.streak++;
        p.correct++;
        p.lastPoints = classicPoints(p.answer!.at - g.qStartedAt, limit, p.streak);
        p.score += p.lastPoints;
      } else {
        p.streak = 0;
        p.lastPoints = 0;
      }
    }
    this.toHosts(this.revealHostMsg());
    this.toPlayers((p) => this.revealPlayerMsg(p));
  }

  revealHostMsg() {
    const g = this.game!;
    const q = this.currentQuestion();
    return { t: 'reveal', n: g.qIndex + 1, total: g.order.length, q: q.q, answers: q.answers, correct: q.correct, counts: g.counts, last: g.qIndex + 1 >= g.order.length };
  }

  revealPlayerMsg(p: Player) {
    const g = this.game!;
    const ranked = this.ranking();
    const rank = ranked.indexOf(p) + 1;
    const ahead = rank > 1 ? ranked[rank - 2] : null;
    const q = this.currentQuestion();
    return {
      t: 'reveal', correct: p.lastCorrect, answered: !!p.answer, points: p.lastPoints, score: p.score, streak: p.streak, rank, of: ranked.length,
      behind: ahead ? { name: ahead.name, by: ahead.score - p.score } : null, correctAnswer: q.answers[q.correct], n: g.qIndex + 1, total: g.order.length,
    };
  }

  // ------------------------------------------------------------------ self-paced (race / gold)

  startSelfPaced() {
    const g = this.game!;
    g.phase = 'playing';
    g.endsAt = Date.now() + g.options.minutes * 60_000;
    this.endTimer = setTimeout(() => this.endGame(), g.options.minutes * 60_000);
    this.toHosts({ t: 'playing', endsAt: g.endsAt, now: Date.now(), goal: g.options.goal });
    for (const p of this.players.values()) {
      send(p.ws, { t: 'playing', endsAt: g.endsAt, now: Date.now(), goal: g.options.goal, me: this.me(p) });
      this.nextSelfPaced(p);
    }
    this.scheduleBoard();
  }

  me(p: Player) {
    return { score: p.score, streak: p.streak, correct: p.correct, levels: p.levels };
  }

  nextSelfPaced(p: Player) {
    const g = this.game!;
    if (g.phase !== 'playing' || p.chest || p.steal) return;
    if (p.deckPos >= p.deck.length) {
      // Reshuffle, avoiding an immediate repeat.
      const last = p.deck[p.deck.length - 1];
      p.deck = shuffleIdx(g.questions.length);
      if (p.deck.length > 1 && p.deck[0] === last) [p.deck[0], p.deck[1]] = [p.deck[1], p.deck[0]];
      p.deckPos = 0;
    }
    p.current = p.deck[p.deckPos++];
    p.result = null;
    const q = g.questions[p.current];
    send(p.ws, { t: 'question', q: q.q, answers: q.answers });
  }

  selfAnswer(p: Player, i: number) {
    const g = this.game!;
    if (g.phase !== 'playing' || p.current == null || p.chest || p.steal) return;
    const now = Date.now();
    if (now < p.lockedUntil) return;
    const q = g.questions[p.current];
    if (!Number.isInteger(i) || i < 0 || i >= q.answers.length) return;
    const right = i === q.correct;
    p.current = null;
    p.answeredCount++;
    let delta = 0;
    if (right) {
      p.streak++;
      p.correct++;
    } else {
      p.streak = 0;
      p.lockedUntil = now + WRONG_LOCK_MS;
    }
    if (g.mode === 'race') {
      delta = right ? raceEarn(p.levels, p.streak) : -Math.min(p.score, racePenalty(p.levels));
      p.score += delta;
    }
    p.result = { t: 'result', correct: right, picked: i, correctIndex: q.correct, correctAnswer: q.answers[q.correct], delta, me: this.me(p) };
    if (g.mode === 'gold' && right) {
      p.chest = { outcomes: [rollChest(rand), rollChest(rand), rollChest(rand)] };
      p.result.chests = true;
    }
    send(p.ws, p.result);
    if (g.mode === 'gold' && right) p.result = null; // chest flow takes over on reconnect
    this.scheduleBoard();
    this.checkGoal(p);
  }

  targets(p: Player) {
    return this.ranking().filter((x) => x !== p).map((x) => ({ id: x.id, name: x.name, skin: x.skin, score: x.score }));
  }

  openChest(p: Player, i: number) {
    const g = this.game!;
    if (g.mode !== 'gold' || !p.chest || g.phase !== 'playing') return;
    if (!Number.isInteger(i) || i < 0 || i > 2) return;
    const outcomes = p.chest.outcomes;
    let pick = outcomes[i];
    p.chest = null;
    const others = this.targets(p);
    // Steal/swap with nobody to target becomes a small gain instead.
    if ((pick.kind === 'steal' || pick.kind === 'swap') && others.length === 0) pick = outcomes[i] = { kind: 'gain', amount: 25 };
    // Swap only makes sense if someone has more gold than you.
    if (pick.kind === 'swap' && !others.some((o) => o.score > p.score)) pick = outcomes[i] = { kind: 'gainPct', amount: 25 };
    const before = p.score;
    let needTarget = false;
    switch (pick.kind) {
      case 'gain': p.score += pick.amount!; break;
      case 'gainPct': p.score += Math.max(5, Math.round(p.score * pick.amount! / 100)); break;
      case 'double': p.score = Math.max(p.score * 2, p.score + 10); break;
      case 'triple': p.score = Math.max(p.score * 3, p.score + 20); break;
      case 'losePct': p.score -= Math.round(p.score * pick.amount! / 100); break;
      case 'steal': case 'swap': needTarget = true; p.steal = { kind: pick.kind as any, amount: pick.amount }; break;
    }
    const delta = p.score - before;
    if (pick.kind === 'double' || pick.kind === 'triple') this.feed(`${p.name} got ${chestLabel(pick)}`);
    if (pick.kind === 'losePct' && delta < 0) this.feed(`${p.name} lost ${-delta} gold`);
    send(p.ws, {
      t: 'chestResult', picked: i, outcomes: outcomes.map((o) => ({ kind: o.kind, label: chestLabel(o) })), delta, me: this.me(p),
      needTarget, targets: needTarget ? this.targets(p) : undefined, kind: pick.kind, amount: pick.amount,
    });
    this.scheduleBoard();
    this.checkGoal(p);
  }

  pickTarget(p: Player, targetId: string) {
    const g = this.game!;
    if (g.mode !== 'gold' || !p.steal || g.phase !== 'playing') return;
    const t = this.players.get(targetId);
    if (!t || t === p) return;
    const { kind, amount } = p.steal;
    p.steal = null;
    let delta = 0;
    if (kind === 'steal') {
      const take = Math.round(t.score * (amount || 10) / 100);
      t.score -= take;
      p.score += take;
      delta = take;
      this.feed(`${p.name} stole ${take} gold from ${t.name}!`);
      send(t.ws, { t: 'robbed', by: p.name, amount: take, me: this.me(t) });
    } else {
      const mine = p.score;
      p.score = t.score;
      t.score = mine;
      delta = p.score - mine;
      this.feed(`${p.name} swapped gold with ${t.name}!`);
      send(t.ws, { t: 'swapped', by: p.name, me: this.me(t) });
    }
    send(p.ws, { t: 'targetResult', kind, target: t.name, delta, me: this.me(p) });
    this.scheduleBoard();
    this.checkGoal(p);
  }

  buy(p: Player, up: string) {
    const g = this.game!;
    if (g.mode !== 'race' || g.phase !== 'playing') return;
    const def = (UPGRADES as any)[up];
    if (!def) return;
    const lvl = (p.levels as any)[up] as number;
    const next = def.levels[lvl + 1];
    if (!next) return send(p.ws, { t: 'toast', message: 'Already maxed out!' });
    if (p.score < next.cost) return send(p.ws, { t: 'toast', message: 'Not enough cash yet.' });
    p.score -= next.cost;
    (p.levels as any)[up] = lvl + 1;
    send(p.ws, { t: 'me', me: this.me(p) });
    this.scheduleBoard();
  }

  checkGoal(p: Player) {
    const g = this.game!;
    if (g.options.goal > 0 && p.score >= g.options.goal) {
      this.feed(`${p.name} reached the goal!`);
      this.endGame();
    }
  }

  // ------------------------------------------------------------------ player messages

  onPlayer(p: Player, ws: WebSocket, raw: any) {
    if (p.ws !== ws || !this.players.has(p.id)) return;
    let msg: any;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    const g = this.game;
    if (!g) return;
    switch (msg.t) {
      case 'answer':
        if (g.mode === 'classic') this.classicAnswer(p, Number(msg.i));
        else this.selfAnswer(p, Number(msg.i));
        break;
      case 'next':
        if (g.mode !== 'classic' && p.current == null && !p.chest && !p.steal) {
          const wait = p.lockedUntil - Date.now();
          if (wait > 0) setTimeout(() => this.nextSelfPaced(p), wait);
          else this.nextSelfPaced(p);
        }
        break;
      case 'chest': this.openChest(p, Number(msg.i)); break;
      case 'target': this.pickTarget(p, String(msg.id)); break;
      case 'buy': this.buy(p, String(msg.up)); break;
      case 'ping': send(ws, { t: 'pong', now: Date.now() }); break;
    }
  }

  // ------------------------------------------------------------------ end

  endPlayerMsg(p: Player) {
    const g = this.game!;
    return { t: 'end', podium: g.podium, place: p.place, of: this.players.size, score: p.score, correct: p.correct, coins: p.reward, guest: p.userId == null };
  }

  async endGame() {
    const g = this.game!;
    if (g.phase === 'ended') return;
    g.phase = 'ended';
    this.clearTimers();
    const ranked = this.ranking();
    ranked.forEach((p, i) => (p.place = i + 1));
    g.podium = ranked.slice(0, 5).map((p) => ({ place: p.place, name: p.name, skin: p.skin, score: p.score, correct: p.correct }));

    // Coins: once per account per game (best placement wins if someone joined twice).
    const best = new Map<number, Player>();
    for (const p of ranked) if (p.userId != null && !best.has(p.userId) && p.answeredCount > 0) best.set(p.userId, p);
    const stmts: D1PreparedStatement[] = [];
    for (const [userId, p] of best) {
      p.reward = coinReward({ place: p.place!, players: ranked.length, correct: p.correct });
      const win = p.place === 1 && ranked.length >= 2 ? 1 : 0;
      stmts.push(this.env.DB.prepare('UPDATE users SET coins = coins + ?, games_played = games_played + 1, wins = wins + ?, correct_answers = correct_answers + ? WHERE id = ?')
        .bind(p.reward, win, p.correct, userId));
    }
    if (ranked.some((p) => p.answeredCount > 0)) stmts.push(this.env.DB.prepare('UPDATE sets SET plays = plays + 1 WHERE id = ?').bind(g.setId));
    if (stmts.length) {
      try { await this.env.DB.batch(stmts); } catch (e) { console.error('reward write failed', e); }
    }
    this.toHosts({ t: 'end', podium: g.podium });
    for (const p of this.players.values()) send(p.ws, this.endPlayerMsg(p));
  }
}
