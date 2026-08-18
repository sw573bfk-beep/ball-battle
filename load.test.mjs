/**
 * 12-player load test (6v6) against a real Durable Object.
 * Measures whether the room keeps a steady 60Hz sim and 20Hz snapshots when
 * every player is moving and shooting at once.
 *
 * Requires `wrangler dev` on 127.0.0.1:8787.
 */

const BASE = process.env.BC_SERVER ?? 'http://127.0.0.1:8787';
const WS_BASE = BASE.replace(/^http/, 'ws');
const PLAYERS = 12;
const RUN_SECONDS = 12;

let checks = 0;
const problems = [];
function check(name, cond, detail = '') {
  checks++;
  if (!cond) problems.push(`${name}${detail ? ` — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { code } = await (await fetch(`${BASE}/api/room`, { method: 'POST' })).json();

class Bot {
  constructor(i) {
    this.i = i;
    this.seq = 0;
    this.snaps = 0;
    this.bytes = 0;
    this.firstTick = null;
    this.lastTick = null;
    this.firstSnapAt = 0;
    this.lastSnapAt = 0;
    this.closed = false;
    this.roster = [];
    this.me = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE}/play/${code}?name=Bot${this.i}`);
      this.ws = ws;
      const timer = setTimeout(() => reject(new Error(`bot${this.i} connect timeout`)), 10000);
      ws.addEventListener('message', (ev) => {
        this.bytes += ev.data.length;
        const m = JSON.parse(ev.data);
        if (m.t === 'welcome') { this.id = m.id; clearTimeout(timer); resolve(this); }
        if (m.t === 'roster') this.roster = m.players;
        if (m.t === 'snap') {
          this.snaps++;
          this.me = m.me;
          if (this.firstTick === null) { this.firstTick = m.k; this.firstSnapAt = Date.now(); }
          this.lastTick = m.k;
          this.lastSnapAt = Date.now();
        }
      });
      ws.addEventListener('close', () => { this.closed = true; });
      ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error(`bot${this.i} error`)); });
    });
  }

  act(t) {
    if (this.ws.readyState !== 1) return;
    // Everyone moves in a different circle and fires most of the time.
    const angle = t * (0.7 + this.i * 0.11) + this.i;
    const batch = [];
    for (let k = 0; k < 2; k++) {
      batch.push([
        ++this.seq,
        Math.cos(angle), Math.sin(angle),
        Math.round(Math.sin(angle * 1.7) * 1000) / 1000,
        (this.i % 4 === 0 ? 1 : 0) | 2,        // some dash, everyone shoots
      ]);
    }
    this.ws.send(JSON.stringify({ t: 'in', c: batch }));
  }

  close() { try { this.ws.close(); } catch { /* gone */ } }
}

const bots = [];
for (let i = 0; i < PLAYERS; i++) {
  bots.push(await new Bot(i).connect());
  await sleep(60);
}
await sleep(1200);

check('all 12 players connected', bots.every((b) => b.id && !b.closed),
  `${bots.filter((b) => b.id && !b.closed).length}/12`);

const roster = bots[0].roster;
check('roster holds 12', roster.length === 12, String(roster.length));
const red = roster.filter((r) => r.team === 0).length;
const blue = roster.filter((r) => r.team === 1).length;
check('teams are balanced 6v6', red === 6 && blue === 6, `${red}v${blue}`);

// --- hammer it
const started = Date.now();
for (const b of bots) { b.snaps = 0; b.firstTick = null; b.bytes = 0; }
let t = 0;
while (Date.now() - started < RUN_SECONDS * 1000) {
  t += 1 / 30;
  for (const b of bots) b.act(t);
  await sleep(33);
}
await sleep(500);

const elapsed = (bots[0].lastSnapAt - bots[0].firstSnapAt) / 1000;
const ticksAdvanced = bots[0].lastTick - bots[0].firstTick;
const tickRate = ticksAdvanced / elapsed;
const snapRate = bots[0].snaps / elapsed;
const kbPerSec = (bots[0].bytes / 1024) / elapsed;

check('server holds ~60 ticks per second', tickRate > 52 && tickRate < 68, `${tickRate.toFixed(1)} Hz`);
check('snapshots hold ~20 per second', snapRate > 16 && snapRate < 24, `${snapRate.toFixed(1)} Hz`);
check('bandwidth stays reasonable', kbPerSec < 120, `${kbPerSec.toFixed(1)} KB/s down per client`);
check('nobody was dropped under load', bots.every((b) => !b.closed),
  `${bots.filter((b) => b.closed).length} dropped`);
check('everyone still has authoritative state', bots.every((b) => b.me && typeof b.me.health === 'number'));

const kills = bots.reduce((n, b) => n + (b.me?.kills ?? 0), 0);
const deaths = bots.reduce((n, b) => n + (b.me?.deaths ?? 0), 0);
check('a real fight happened', kills + deaths > 0, `${kills} kills / ${deaths} deaths`);

console.log(`  12-player room: ${tickRate.toFixed(1)} tick/s, ${snapRate.toFixed(1)} snap/s, ` +
  `${kbPerSec.toFixed(1)} KB/s per client, ${kills} kills`);

for (const b of bots) b.close();
await sleep(300);

if (problems.length) {
  console.error(`\n  ${checks - problems.length}/${checks} load checks passed, ${problems.length} FAILED\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('');
  process.exit(1);
}
console.log(`\n  ✓ all ${checks} load checks passed\n`);
process.exit(0);
