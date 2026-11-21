import { DurableObject } from 'cloudflare:workers';
import { RESIDENTS, findResident, type ZoneId } from '../shared/people';
import { ALL_ZONES } from '../shared/floors';
import { CAR_PAINTS, SHOP, shopItem } from '../shared/shop';
import {
  buy, bumpStat, canEnter, claimDaily, completeTask, migrate, newSave, placeItems, rollDaily, setLook,
  topFloor, zoneUnlocked, type Save,
} from '../shared/save';
import { ISLANDERS, npcAccepts, villaChallenge, winFinal } from '../shared/villa';
import { seasonAct, type SeasonAction } from '../shared/season';
import type { BoardRow, ClientMsg, PeerInfo, PeerPos, ServerMsg } from '../shared/protocol';

interface Account { salt: string; hash: string; ver: number }
interface Token { name: string; ver: number; exp: number }

interface Conn {
  ws: WebSocket;
  name: string;
  save: Save;
  zone: ZoneId | null;
  pos: PeerPos;
  car: { id: string; paint: string } | null;
  lastChat: number;
}

const TOKEN_DAYS = 60;
const STAT_KEYS = new Set(['drive', 'swim', 'pats', 'cabana']);

export class Estate extends DurableObject {
  private conns = new Map<string, Conn>();
  private fails = new Map<string, { n: number; until: number }>();
  private ceremony: { endsAt: number; picks: Map<string, string> } | null = null;
  private lastCeremony = 0;

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never);
    // One-time grants. Each runs once ever (a flag is stored), so admins can still remove VIP later.
    ctx.blockConcurrencyWhile(async () => {
      if (await ctx.storage.get('grant:vip-keola-milla')) return;
      for (const name of ['Keola', 'Milla']) {
        const save = await this.load(name);
        save.vip = true;
        await this.store(save);
      }
      await ctx.storage.put('grant:vip-keola-milla', true);
    });
    // Testers: unlock every floor + Love Island, own every item, lots of Aura to spend.
    ctx.blockConcurrencyWhile(async () => {
      if (await ctx.storage.get('grant:testers-all')) return;
      for (const name of ['Keola', 'Milla']) {
        const save = await this.load(name);
        save.vip = true;
        save.totalAura = Math.max(save.totalAura, 8000);
        save.aura += 50_000;
        for (const item of SHOP) save.inventory[item.id] = Math.max(save.inventory[item.id] ?? 0, item.cat === 'furniture' ? 3 : 1);
        await this.store(save);
      }
      await ctx.storage.put('grant:testers-all', true);
    });
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname === '/api/check' && req.method === 'POST') return json(await this.check(await req.json()));
      if (url.pathname === '/api/login' && req.method === 'POST') return json(await this.login(await req.json()));
      if (url.pathname === '/ws') return await this.openSocket(req, url.searchParams.get('token') ?? '');
    } catch (e) {
      return json({ error: 'Something went wrong. Try again.' }, 500);
    }
    return new Response('Not found', { status: 404 });
  }

  // ------------------------------------------------------------- sign in

  private async check(body: { name?: string }) {
    const r = findResident(String(body.name ?? ''));
    if (!r) return { kicked: true };
    const acct = await this.ctx.storage.get<Account>(`acct:${r.name}`);
    return { name: r.name, hasPassword: !!acct };
  }

  private async login(body: { name?: string; password?: string }) {
    const r = findResident(String(body.name ?? ''));
    if (!r) return { kicked: true };
    const password = String(body.password ?? '');
    const f = this.fails.get(r.name);
    if (f && f.until > Date.now()) {
      return { error: `Too many wrong passwords. Wait ${Math.ceil((f.until - Date.now()) / 1000)} seconds.` };
    }
    let acct = await this.ctx.storage.get<Account>(`acct:${r.name}`);
    let firstTime = false;
    if (!acct) {
      if (password.length < 4) return { error: 'Make a password with at least 4 characters.' };
      if (password.length > 64) return { error: 'That password is too long.' };
      const salt = randomHex(16);
      const prev = await this.ctx.storage.get<number>(`ver:${r.name}`) ?? 0;
      acct = { salt, hash: await hashPassword(password, salt), ver: prev + 1 };
      await this.ctx.storage.put(`acct:${r.name}`, acct);
      await this.ctx.storage.put(`ver:${r.name}`, acct.ver);
      firstTime = true;
    } else if (!timingSafeEqual(await hashPassword(password, acct.salt), acct.hash)) {
      const n = (f?.n ?? 0) + 1;
      this.fails.set(r.name, { n, until: n >= 5 ? Date.now() + 60_000 : 0 });
      return { error: 'Wrong password.' };
    }
    this.fails.delete(r.name);
    const token = randomHex(24);
    await this.ctx.storage.put<Token>(`tok:${token}`, { name: r.name, ver: acct.ver, exp: Date.now() + TOKEN_DAYS * 86400_000 });
    return { token, name: r.name, firstTime };
  }

  private async tokenName(token: string): Promise<string | null> {
    if (!/^[0-9a-f]{48}$/.test(token)) return null;
    const t = await this.ctx.storage.get<Token>(`tok:${token}`);
    if (!t || t.exp < Date.now()) return null;
    const acct = await this.ctx.storage.get<Account>(`acct:${t.name}`);
    if (!acct || acct.ver !== t.ver) return null;
    return t.name;
  }

  // ------------------------------------------------------------- saves

  private async load(name: string): Promise<Save> {
    const live = this.conns.get(name);
    if (live) return live.save;
    const raw = await this.ctx.storage.get<Save>(`save:${name}`);
    return raw ? migrate(raw) : newSave(name);
  }

  private async store(save: Save): Promise<void> {
    await this.ctx.storage.put(`save:${save.name}`, save);
  }

  // ------------------------------------------------------------- sockets

  private async openSocket(req: Request, token: string): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 });
    const name = await this.tokenName(token);
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    if (!name) {
      server.send(JSON.stringify({ t: 'kicked', reason: 'Please sign in again.' } satisfies ServerMsg));
      server.close(4001, 'auth');
      return new Response(null, { status: 101, webSocket: client });
    }
    const old = this.conns.get(name);
    if (old) {
      this.send(old, { t: 'kicked', reason: 'You signed in somewhere else.' });
      this.drop(old);
      try { old.ws.close(4002, 'replaced'); } catch { /* already closed */ }
    }
    const save = await this.load(name);
    rollDaily(save);
    const conn: Conn = { ws: server, name, save, zone: null, pos: { name, x: 0, z: 0, ry: 0, a: 0 }, car: null, lastChat: 0 };
    this.conns.set(name, conn);
    this.send(conn, { t: 'welcome', save, admin: !!findResident(name)?.admin });

    server.addEventListener('message', (ev) => {
      let msg: ClientMsg;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      this.handle(conn, msg).catch(() => this.send(conn, { t: 'toast', text: 'Something went wrong.' }));
    });
    const bye = () => { if (this.conns.get(name) === conn) this.drop(conn); };
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }

  private drop(conn: Conn): void {
    this.conns.delete(conn.name);
    if (conn.zone) this.toZone(conn.zone, { t: 'gone', name: conn.name }, conn.name);
    this.store(conn.save).catch(() => {});
  }

  private send(conn: Conn, msg: ServerMsg): void {
    try { conn.ws.send(JSON.stringify(msg)); } catch { /* closed */ }
  }

  private toZone(zone: ZoneId, msg: ServerMsg, except?: string): void {
    const s = JSON.stringify(msg);
    for (const c of this.conns.values()) {
      if (c.zone === zone && c.name !== except) { try { c.ws.send(s); } catch { /* closed */ } }
    }
  }

  private info(c: Conn): PeerInfo {
    const look = c.zone === 'villa' && c.save.villa.look ? c.save.villa.look : c.save.look;
    return { name: c.name, zone: c.zone ?? 'b', look, vip: c.save.vip, car: c.car, partner: c.save.villa.partner };
  }

  private async saved(conn: Conn, toast?: { ok: boolean; msg: string }): Promise<void> {
    await this.store(conn.save);
    this.send(conn, { t: 'save', save: conn.save });
    if (toast) this.send(conn, { t: 'toast', text: toast.msg, good: toast.ok });
  }

  private async handle(c: Conn, m: ClientMsg): Promise<void> {
    switch (m.t) {
      case 'zone': {
        if (!ALL_ZONES.includes(m.zone)) return;
        if (!canEnter(c.save, m.zone)) { this.send(c, { t: 'toast', text: 'That floor is still locked.' }); return; }
        if (c.zone) this.toZone(c.zone, { t: 'gone', name: c.name }, c.name);
        c.zone = m.zone;
        c.car = null;
        c.save.lastZone = m.zone;
        if (!c.save.daily.stats[`v_${m.zone}`]) { bumpStat(c.save, `v_${m.zone}`, 1); bumpStat(c.save, 'floors', 1); }
        const list = [...this.conns.values()].filter((o) => o.zone === m.zone && o !== c);
        this.send(c, { t: 'peers', zone: m.zone, list: list.map((o) => this.info(o)) });
        for (const o of list) this.send(c, { t: 'pos', p: o.pos });
        this.toZone(m.zone, { t: 'peer', info: this.info(c) }, c.name);
        for (const r of RESIDENTS.filter((r) => r.home === m.zone)) {
          const s = await this.load(r.name);
          this.send(c, { t: 'room', owner: r.name, items: s.room });
        }
        await this.saved(c);
        return;
      }
      case 'pos': {
        if (!c.zone) return;
        const { x, z, ry, a } = m;
        if (![x, z, ry, a].every(Number.isFinite)) return;
        c.pos = { name: c.name, x: r2(x), z: r2(z), ry: r2(ry), a: a | 0 };
        this.toZone(c.zone, { t: 'pos', p: c.pos }, c.name);
        return;
      }
      case 'chat': {
        const text = String(m.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 140);
        if (!text || !c.zone || Date.now() - c.lastChat < 800) return;
        c.lastChat = Date.now();
        bumpStat(c.save, 'chat', 1);
        this.toZone(c.zone, { t: 'chat', from: c.name, text });
        this.send(c, { t: 'save', save: c.save });
        return;
      }
      case 'emote': {
        if (!c.zone || !['wave', 'dance', 'heart', 'sit', 'pose'].includes(m.e)) return;
        bumpStat(c.save, 'emote', 1);
        this.toZone(c.zone, { t: 'emote', from: c.name, e: m.e });
        this.send(c, { t: 'save', save: c.save });
        return;
      }
      case 'task': {
        const r = completeTask(c.save, m.zone, String(m.task));
        await this.saved(c, r);
        return;
      }
      case 'buy': await this.saved(c, buy(c.save, String(m.item))); return;
      case 'look': {
        await this.saved(c, setLook(c.save, m.look));
        if (c.zone && c.zone !== 'villa') this.toZone(c.zone, { t: 'peer', info: this.info(c) }, c.name);
        return;
      }
      case 'villaLook': {
        const prev = c.save.look;
        setLook(c.save, m.look);
        c.save.villa.look = c.save.look;
        c.save.look = prev;
        await this.saved(c, { ok: true, msg: 'Villa look saved!' });
        if (c.zone === 'villa') this.toZone('villa', { t: 'peer', info: this.info(c) }, c.name);
        return;
      }
      case 'room': {
        const r = placeItems(c.save, Array.isArray(m.items) ? m.items : []);
        await this.saved(c, r.ok ? undefined : r);
        const home = findResident(c.name)?.home;
        if (r.ok && home) this.toZone(home, { t: 'room', owner: c.name, items: c.save.room });
        return;
      }
      case 'room?': {
        const r = findResident(String(m.owner));
        if (r) this.send(c, { t: 'room', owner: r.name, items: (await this.load(r.name)).room });
        return;
      }
      case 'stat': {
        if (!STAT_KEYS.has(m.stat)) return;
        bumpStat(c.save, m.stat, Math.max(0, Math.min(30, Number(m.by) || 0)));
        this.send(c, { t: 'save', save: c.save });
        return;
      }
      case 'daily': await this.saved(c, claimDaily(c.save, String(m.id))); return;
      case 'car': {
        if (m.car === null) { c.car = null; }
        else {
          const item = shopItem(m.car);
          if (!item || item.cat !== 'car' || !c.save.inventory[m.car]) return;
          if (m.paint && CAR_PAINTS.includes(m.paint)) c.save.carPaint[m.car] = m.paint;
          c.save.car = m.car;
          c.car = { id: m.car, paint: c.save.carPaint[m.car] ?? String(item.r.color) };
        }
        if (c.zone) this.toZone(c.zone, { t: 'peer', info: this.info(c) }, c.name);
        await this.saved(c);
        return;
      }
      case 'villa': await this.saved(c, villaChallenge(c.save, String(m.challenge))); return;
      case 'couple': await this.couple(c, String(m.to)); return;
      case 'coupleReply': await this.coupleReply(c, String(m.from), !!m.yes); return;
      case 'recouple': this.startCeremony(c); return;
      case 'pick': {
        if (this.ceremony && c.zone === 'villa') this.ceremony.picks.set(c.name, String(m.who));
        return;
      }
      case 'final': await this.final(c); return;
      case 'season': await this.season(c, m.act); return;
      case 'board': this.send(c, { t: 'board', rows: await this.board() }); return;
      case 'admin': await this.admin(c, m.action, String(m.target)); return;
    }
  }

  // ------------------------------------------------------------- villa

  private async setPartner(a: string, b: string | undefined): Promise<void> {
    const sa = await this.load(a);
    const old = sa.villa.partner;
    if (old && !old.startsWith('npc:') && old !== b) {
      const so = await this.load(old);
      if (so.villa.partner === a) { so.villa.partner = undefined; await this.store(so); this.pushSave(old); }
    }
    sa.villa.partner = b;
    await this.store(sa);
    this.pushSave(a);
  }

  private pushSave(name: string): void {
    const c = this.conns.get(name);
    if (c) {
      this.send(c, { t: 'save', save: c.save });
      if (c.zone) this.toZone(c.zone, { t: 'peer', info: this.info(c) }, c.name);
    }
  }

  private async couple(c: Conn, to: string): Promise<void> {
    if (c.zone !== 'villa') return;
    const npc = ISLANDERS.find((i) => i.name === to);
    if (npc) {
      if (npcAccepts(c.save, npc.name, Math.random())) {
        await this.setPartner(c.name, `npc:${npc.name}`);
        this.send(c, { t: 'toast', text: `💘 ${npc.name} said yes! You're coupled up.`, good: true });
      } else {
        this.send(c, { t: 'toast', text: `${npc.name} wants to get to know you more first. Win some challenges!` });
      }
      return;
    }
    const other = this.conns.get(to);
    if (!other || other.zone !== 'villa') { this.send(c, { t: 'toast', text: `${to} isn't in the villa right now.` }); return; }
    this.send(other, { t: 'coupleAsk', from: c.name });
    this.send(c, { t: 'toast', text: `You asked ${to} to couple up 💌` });
  }

  private async coupleReply(c: Conn, from: string, yes: boolean): Promise<void> {
    const other = this.conns.get(from);
    if (!other) return;
    if (!yes) { this.send(other, { t: 'toast', text: `${c.name} said not right now.` }); return; }
    await this.setPartner(c.name, from);
    await this.setPartner(from, c.name);
    this.toZone('villa', { t: 'toast', text: `💘 ${c.name} & ${from} are now a couple!`, good: true });
  }

  private startCeremony(c: Conn): void {
    if (c.zone !== 'villa') return;
    if (this.ceremony) { this.send(c, { t: 'toast', text: 'A recoupling is already happening!' }); return; }
    if (Date.now() - this.lastCeremony < 120_000) { this.send(c, { t: 'toast', text: 'The firepit needs a break. Try again in a couple of minutes.' }); return; }
    const endsAt = Date.now() + 25_000;
    this.ceremony = { endsAt, picks: new Map() };
    const people = [...this.conns.values()].filter((o) => o.zone === 'villa').map((o) => o.name);
    const options = [...people, ...ISLANDERS.map((i) => i.name)];
    this.toZone('villa', { t: 'ceremony', endsAt, options });
    setTimeout(() => { this.endCeremony().catch(() => {}); }, 25_500);
  }

  private async endCeremony(): Promise<void> {
    const cer = this.ceremony;
    if (!cer) return;
    this.ceremony = null;
    this.lastCeremony = Date.now();
    const lines: string[] = [];
    const done = new Set<string>();
    for (const [who, pick] of cer.picks) {
      if (done.has(who)) continue;
      const save = await this.load(who);
      if (pick.startsWith('npc:') || ISLANDERS.some((i) => i.name === pick)) {
        const npc = pick.replace(/^npc:/, '');
        if (npcAccepts(save, npc, Math.random())) {
          await this.setPartner(who, `npc:${npc}`);
          lines.push(`💘 ${who} chose ${npc} — and ${npc} chose them back!`);
        } else {
          await this.setPartner(who, undefined);
          lines.push(`💔 ${who} chose ${npc}, but ${npc} picked someone else. ${who} is single!`);
        }
        done.add(who);
      } else if (cer.picks.get(pick) === who) {
        await this.setPartner(who, pick);
        await this.setPartner(pick, who);
        lines.push(`💘 ${who} and ${pick} picked each other! New couple!`);
        done.add(who); done.add(pick);
      } else {
        await this.setPartner(who, undefined);
        lines.push(`💔 ${who} chose ${pick}, but it wasn't mutual. ${who} is single!`);
        done.add(who);
      }
    }
    if (!lines.length) lines.push('Nobody chose anyone… the couples stay the same!');
    this.toZone('villa', { t: 'ceremonyResult', lines });
  }

  private async season(c: Conn, act: SeasonAction): Promise<void> {
    if (!zoneUnlocked(c.save, 'villa')) { this.send(c, { t: 'toast', text: 'Reach the rooftop to unlock Love Island.' }); return; }
    if (!act || !['start', 'chat', 'hut', 'evening', 'firepit', 'answer', 'status'].includes(act.a)) return;
    const clean = { ...act } as SeasonAction & { who?: unknown; choice?: unknown };
    if ('who' in clean) clean.who = String(clean.who).slice(0, 20);
    if ('choice' in clean) clean.choice = String(clean.choice).slice(0, 20);
    const res = seasonAct(c.save.villa.season, clean as SeasonAction);
    c.save.villa.season = res.season;
    if (res.reward) {
      c.save.aura += res.reward.aura;
      c.save.totalAura += res.reward.total;
      if (res.reward.win) c.save.villa.wins += 1;
    }
    await this.saved(c, res.ok ? undefined : { ok: false, msg: res.msg ?? 'Not right now.' });
    if (res.scene) this.send(c, { t: 'scene', scene: res.scene });
  }

  private async final(c: Conn): Promise<void> {
    const partner = c.save.villa.partner;
    const r = winFinal(c.save);
    if (!r.ok) { this.send(c, { t: 'toast', text: r.msg }); return; }
    if (partner && !partner.startsWith('npc:')) {
      const ps = await this.load(partner);
      ps.villa.wins += 1;
      ps.villa.points = 0;
      ps.aura += 1000; ps.totalAura += 1000;
      await this.store(ps);
      this.pushSave(partner);
    }
    await this.saved(c, r);
    this.toZone('villa', { t: 'final', winner: c.name, partner: (partner ?? '').replace(/^npc:/, '') });
  }

  // ------------------------------------------------------------- board + admin

  private async board(): Promise<BoardRow[]> {
    const rows: BoardRow[] = [];
    const accts = await this.ctx.storage.get<Account>(RESIDENTS.map((r) => `acct:${r.name}`));
    for (const r of RESIDENTS) {
      const s = await this.load(r.name);
      rows.push({
        name: r.name, totalAura: s.totalAura, top: zoneUnlocked(s, 'f8') ? 'f8' : topFloor(s), vip: s.vip,
        online: this.conns.has(r.name), villaWins: s.villa.wins, villaPoints: s.villa.points,
        partner: s.villa.partner?.replace(/^npc:/, ''), hasPassword: accts.has(`acct:${r.name}`),
      });
    }
    return rows.sort((a, b) => b.totalAura - a.totalAura);
  }

  private async admin(c: Conn, action: string, target: string): Promise<void> {
    if (!findResident(c.name)?.admin) { this.send(c, { t: 'toast', text: 'Only Beau, Milla and Keola can do that.' }); return; }
    const r = findResident(target);
    if (!r) return;
    if (action === 'vip' || action === 'unvip') {
      const s = await this.load(r.name);
      s.vip = action === 'vip';
      await this.store(s);
      this.pushSave(r.name);
      this.send(c, { t: 'toast', text: `${r.name} ${s.vip ? 'is now VIP ⭐' : 'is no longer VIP'}`, good: true });
      const t = this.conns.get(r.name);
      if (t && s.vip) this.send(t, { t: 'toast', text: `⭐ ${c.name} gave you VIP access!`, good: true });
    } else if (action === 'reset') {
      await this.ctx.storage.delete(`acct:${r.name}`);
      this.send(c, { t: 'toast', text: `${r.name}'s password was reset. They can pick a new one next sign in.`, good: true });
      const t = this.conns.get(r.name);
      if (t && t !== c) { this.send(t, { t: 'kicked', reason: 'Your password was reset. Sign in to pick a new one.' }); t.ws.close(4003, 'reset'); }
    }
    this.send(c, { t: 'board', rows: await this.board() });
  }
}

// ------------------------------------------------------------- helpers

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100_000 }, key, 256,
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
