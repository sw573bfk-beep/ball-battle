/**
 * Server integration test — drives the real Durable Object over real
 * WebSockets. Requires `wrangler dev` running on 127.0.0.1:8787.
 */

const BASE = process.env.BC_SERVER ?? 'http://127.0.0.1:8787';
const WS_BASE = BASE.replace(/^http/, 'ws');

let checks = 0;
const problems = [];
function check(name, cond, detail = '') {
  checks++;
  if (!cond) problems.push(`${name}${detail ? ` — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  constructor(name) {
    this.name = name;
    this.snaps = [];
    this.roster = [];
    this.id = null;
    this.seq = 0;
    this.closed = false;
    this.sawBullets = false;
  }

  connect(code, mode) {
    return new Promise((resolve, reject) => {
      const q = `name=${encodeURIComponent(this.name)}${mode ? `&mode=${mode}` : ''}`;
      const ws = new WebSocket(`${WS_BASE}/play/${code}?${q}`);
      this.ws = ws;
      const timer = setTimeout(() => reject(new Error(`${this.name}: connect timeout`)), 8000);
      ws.addEventListener('message', (ev) => {
        const m = JSON.parse(ev.data);
        if (m.t === 'welcome') { this.id = m.id; clearTimeout(timer); resolve(this); }
        if (m.t === 'snap') {
          this.snaps.push(m);
          if (m.b.length > 0) this.sawBullets = true;
          if (this.snaps.length > 40) this.snaps.shift();
        }
        if (m.t === 'roster') this.roster = m.players;
        if (m.t === 'settings') this.settings = m;
      });
      ws.addEventListener('close', () => { this.closed = true; });
      ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error(`${this.name}: socket error`)); });
    });
  }

  input({ moveX = 0, moveY = 0, aim = 0, buttons = 0 } = {}, ticks = 1) {
    const batch = [];
    for (let i = 0; i < ticks; i++) batch.push([++this.seq, moveX, moveY, aim, buttons]);
    this.ws.send(JSON.stringify({ t: 'in', c: batch }));
  }

  get me() {
    const last = this.snaps[this.snaps.length - 1];
    return last ? last.me : null;
  }

  other(id) {
    const last = this.snaps[this.snaps.length - 1];
    if (!last) return null;
    return last.p.find((row) => row[0] === id) ?? null;
  }

  close() { try { this.ws.close(); } catch { /* already gone */ } }
}

const codeRes = await fetch(`${BASE}/api/room`, { method: 'POST' });
const { code } = await codeRes.json();
check('server issues a room code', /^[A-Z0-9]{4}$/.test(code ?? ''), String(code));

const a = await new Client('Alpha').connect(code);
const b = await new Client('Bravo').connect(code);
await sleep(500);

check('both clients got an id', !!a.id && !!b.id, `${a.id} / ${b.id}`);
check('ids are distinct', a.id !== b.id);
check('roster shows both players', a.roster.length === 2, JSON.stringify(a.roster));
const teams = a.roster.map((r) => r.team).sort();
check('teams are balanced 1v1', teams[0] === 0 && teams[1] === 1, JSON.stringify(teams));

const info = await (await fetch(`${BASE}/api/room/${code}`)).json();
check('room info reports 2 players', info.players === 2, JSON.stringify(info));

await sleep(600);
check('snapshots are arriving', a.snaps.length >= 6, `${a.snaps.length} in ~1s`);
check('snapshot has own full state', !!a.me && typeof a.me.health === 'number');
check('snapshot lists both players', (a.snaps.at(-1)?.p.length ?? 0) === 2);

const startX = a.me.x;
for (let i = 0; i < 20; i++) { a.input({ moveX: 1 }, 3); await sleep(50); }
await sleep(300);
const movedX = a.me.x;
check('server moves the player on input', movedX > startX + 40, `${startX.toFixed(1)} -> ${movedX.toFixed(1)}`);
check('server acknowledges inputs', (a.snaps.at(-1)?.a ?? 0) > 0, `ack ${a.snaps.at(-1)?.a}`);

const aSeenByB = b.other(a.id);
check('other players are visible', !!aSeenByB, JSON.stringify(b.snaps.at(-1)?.p));
check('remote position matches authority', !!aSeenByB && Math.abs(aSeenByB[1] - movedX) < 60,
  `${aSeenByB?.[1]} vs ${movedX.toFixed(1)}`);

// Close the distance the way a real player would, then open fire. Doing it
// this way keeps the test honest about map geometry instead of assuming a
// clear lane exists between the two spawns.
const bStartHp = b.me.health;
a.sawBullets = false;
for (let i = 0; i < 120; i++) {
  const target = a.other(b.id);
  const me = a.me;
  if (target && me) {
    const dx = target[1] - me.x;
    const dy = target[2] - me.y;
    const dist = Math.hypot(dx, dy);
    const aim = Math.atan2(dy, dx);
    if (dist > 170) {
      a.input({ moveX: dx / dist, moveY: dy / dist, aim, buttons: 0 }, 3);
    } else {
      a.input({ moveX: 0, moveY: 0, aim, buttons: 2 }, 3);
    }
  }
  if (b.me && (b.me.health < bStartHp || b.me.deaths > 0)) break;
  await sleep(50);
}
await sleep(400);
const bHp = b.me.health;
check('bullets are replicated to clients', a.sawBullets, 'no projectiles seen in any snapshot');
check('bullets damage the target', bHp < bStartHp || b.me.deaths > 0,
  `A at (${a.me.x.toFixed(0)},${a.me.y.toFixed(0)}) B at (${b.me.x.toFixed(0)},${b.me.y.toFixed(0)}), hp ${bStartHp} -> ${bHp}, deaths ${b.me.deaths}`);

check('normal traffic keeps the socket open', !a.closed && !b.closed);

b.close();
await sleep(700);
check('roster shrinks after a disconnect', a.roster.length === 1, JSON.stringify(a.roster));
check('remaining client still gets snapshots', a.snaps.at(-1)?.p.length === 1);

const c = await new Client('Charlie').connect(code);
await sleep(600);
check('a new player can join the running room', c.roster.length === 2, JSON.stringify(c.roster));
check('rejoining player gets a full state', !!c.me);

a.ws.send('this is not json');
a.ws.send(JSON.stringify({ t: 'in', c: 'nope' }));
a.ws.send(JSON.stringify({ t: 'unknown' }));
await sleep(400);
check('garbage messages do not kill the room', !a.closed && a.snaps.length > 0);

const beforeX = a.me.x, beforeY = a.me.y;
for (let i = 0; i < 12; i++) {
  a.ws.send(JSON.stringify({ t: 'in', c: [[++a.seq, 9999, 9999, 0, 0]] }));
  await sleep(50);
}
await sleep(300);
const cheatDelta = Math.hypot(a.me.x - beforeX, a.me.y - beforeY);
check('impossible input magnitudes are clamped', cheatDelta < 700, `moved ${cheatDelta.toFixed(1)}px in ~0.9s`);

a.close();
c.close();
await sleep(300);

// --------------------------------------------------- objective modes over the wire
const ctfRoom = (await (await fetch(`${BASE}/api/room`, { method: 'POST' })).json()).code;
const x = await new Client('Xavier').connect(ctfRoom, 'ctf');
const y = await new Client('Yuki').connect(ctfRoom);
await sleep(900);

check('room adopts the requested mode', x.settings?.mode === 'ctf', JSON.stringify(x.settings));
const ctfSnap = x.snaps.at(-1);
check('match state is replicated', ctfSnap?.m?.mode === 'ctf', JSON.stringify(ctfSnap?.m?.mode));
check('objective state is replicated', Array.isArray(ctfSnap?.o?.flags), JSON.stringify(ctfSnap?.o));

// Wait for the match to actually start, then flags should be placed.
await sleep(3600);
const liveSnap = x.snaps.at(-1);
check('flags are placed once the match starts',
  liveSnap?.o?.flags?.length === 2 && liveSnap.o.flags.every((f) => f.status === 'home'),
  JSON.stringify(liveSnap?.o?.flags));

// Switching mode mid-match must be refused.
x.ws.send(JSON.stringify({ t: 'setMode', mode: 'koth' }));
await sleep(500);
check('mode cannot be changed mid-match', x.snaps.at(-1)?.m?.mode === 'ctf',
  String(x.snaps.at(-1)?.m?.mode));

// Rubbish mode names are ignored rather than crashing the room.
x.ws.send(JSON.stringify({ t: 'setMode', mode: 'not-a-mode' }));
await sleep(400);
check('unknown modes are ignored', !x.closed && x.snaps.at(-1)?.m?.mode === 'ctf');

x.close();
y.close();
await sleep(200);

if (problems.length) {
  console.error(`\n  ${checks - problems.length}/${checks} server checks passed, ${problems.length} FAILED\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('');
  process.exit(1);
}
console.log(`\n  ✓ all ${checks} server checks passed\n`);
process.exit(0);   // open sockets would otherwise keep the process alive
