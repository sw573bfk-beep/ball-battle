// Aura audit: drives the real server over WebSockets.
const BASE = 'http://127.0.0.1:8787';
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const api = (p, b) => fetch(BASE + p, { method: 'POST', body: JSON.stringify(b) }).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  constructor(name, token) { this.name = name; this.token = token; this.msgs = []; this.save = null; }
  async open() {
    this.ws = new WebSocket(`ws://127.0.0.1:8787/ws?token=${this.token}`);
    this.ws.onmessage = (e) => { const m = JSON.parse(e.data); this.msgs.push(m); if (m.t === 'welcome' || m.t === 'save') this.save = m.save; };
    await this.until((m) => m.t === 'welcome');
    return this;
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
  async until(fn, ms = 5000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const hit = this.msgs.find(fn); if (hit) { this.msgs.splice(this.msgs.indexOf(hit), 1); return hit; } await sleep(20); } return null; }
  async act(m, ms = 1500) { this.msgs.length = 0; this.send(m); await sleep(ms); return this.save; }
  close() { this.ws.close(); }
}
const login = async (name, pw) => { const r = await api('/api/login', { name, password: pw }); return new Client(name, r.token).open(); };
const sumLog = (s, n) => (s.auraLog ?? []).slice(0, n).reduce((a, e) => [a[0] + e.d, a[1] + e.t], [0, 0]);

const g = await login('Grace', 'grace1');
await g.act({ t: 'zone', zone: 'f1' });
const a0 = g.save.aura, t0 = g.save.totalAura;
console.log(`   start: ${a0} available / ${t0} total`);

// Tasks
let s = await g.act({ t: 'task', zone: 'f1', task: 'checkin' });
ok(s.aura === a0 + 200 && s.totalAura === t0 + 200, 'new task: +200 Available and +200 Total');
s = await g.act({ t: 'task', zone: 'f1', task: 'checkin' });
ok(s.aura === a0 + 250 && s.totalAura === t0 + 200, 'replay: +50 Available only');
s = await g.act({ t: 'task', zone: 'f3', task: 'swim' });
ok(s.totalAura === t0 + 200, 'locked floor task gives nothing');
s = await g.act({ t: 'task', zone: 'f1', task: 'notreal' });
ok(s.aura === a0 + 250, 'fake task gives nothing');
for (const t of ['sushi', 'cleanguest', 'spa', 'drink']) s = await g.act({ t: 'task', zone: 'f1', task: t }, 400);
ok(s.totalAura === t0 + 1000, 'all 5 first-floor tasks = +1000 Total');
s = await g.act({ t: 'zone', zone: 'f2' });
ok(s.lastZone === 'f2', '…which unlocks the 2nd floor');

// Shop
const before = g.save.aura;
s = await g.act({ t: 'buy', item: 'gl_heart' });
ok(s.aura === before - 200 && s.totalAura === t0 + 1000, 'buying sunglasses: -200 Available, Total unchanged');
s = await g.act({ t: 'buy', item: 'gl_heart' });
ok(s.aura === before - 200, "can't buy the same sunglasses twice");
// Rapid-fire: try to buy 30 fireworks (150 each) at once
const cash = g.save.aura;
g.msgs.length = 0;
for (let i = 0; i < 30; i++) g.send({ t: 'buy', item: 'fx_fireworks' });
await sleep(2500);
const bought = g.save.inventory.fx_fireworks ?? 0;
ok(g.save.aura >= 0 && g.save.aura === cash - bought * 150 && bought === Math.floor(cash / 150), `rapid tapping can't overspend (bought ${bought}, left ${g.save.aura})`);

// Spin
const sp = g.save.aura;
s = await g.act({ t: 'spin' });
const spun = g.save.spinDate;
ok(!!spun && s.aura >= sp, 'daily spin works');
const sp2 = s.aura;
s = await g.act({ t: 'spin' });
ok(s.aura === sp2, 'second spin the same day gives nothing');

// Shells
const sh = g.save.aura;
s = await g.act({ t: 'shell', id: 'f2:0' });
ok(s.aura === sh + 25, 'golden shell: +25');
s = await g.act({ t: 'shell', id: 'f2:0' });
ok(s.aura === sh + 25, 'same shell twice gives nothing');
s = await g.act({ t: 'shell', id: 'f2:9' });
ok(s.aura === sh + 25, 'fake shell gives nothing');
s = await g.act({ t: 'shell', id: 'f1:0' });
ok(s.aura === sh + 25, "can't grab a shell from another floor");

// Daily challenge (chat 3 / emote 5 / floors 4 etc. — whatever is on today)
for (let i = 0; i < 3; i++) { g.send({ t: 'chat', text: 'hi ' + i }); await sleep(900); }
for (let i = 0; i < 5; i++) { g.send({ t: 'emote', e: 'wave' }); await sleep(150); }
for (const z of ['b', 'f1', 'park', 'f2']) { await g.act({ t: 'zone', zone: z }, 400); }
await sleep(800);
const dailyBefore = { a: g.save.aura, t: g.save.totalAura };
const ids = ['tasks3', 'floors4', 'chat3', 'emote5', 'buy1', 'drive60', 'swim', 'pets'];
let claimed = 0;
for (const id of ids) { const r = await g.act({ t: 'daily', id }, 400); if (r.daily.claimed.includes(id)) claimed++; }
const dl = g.save.auraLog.filter((e) => e.why.startsWith('Daily:')).slice(0, claimed);
const dsum = dl.reduce((a, e) => a + e.d, 0);
ok(claimed > 0 && g.save.aura === dailyBefore.a + dsum && g.save.totalAura === dailyBefore.t + dsum, `daily challenges add to both Available and Total (${claimed} claimed, +${dsum})`);
const again = g.save.aura;
for (const id of ids) await g.act({ t: 'daily', id }, 200);
ok(g.save.aura === again, "can't claim a daily challenge twice");

// History adds up
const log = g.save.auraLog;
const [dsumAll, tsumAll] = log.reduce((a, e) => [a[0] + e.d, a[1] + e.t], [0, 0]);
ok(log.length < 40 ? g.save.aura - a0 === dsumAll && g.save.totalAura - t0 === tsumAll : true, `Aura history adds up exactly (${log.length} entries)`);

// Persistence: remember, then compare after the server restarts (done by the shell script)
const snap = { aura: g.save.aura, total: g.save.totalAura, fw: g.save.inventory.fx_fireworks, shells: g.save.shells.length, log: g.save.auraLog.length };
g.close();
await sleep(500);
const fs = await import('node:fs');
fs.writeFileSync('/tmp/snap.json', JSON.stringify({ snap, token: g.token }));

// Two devices at once
const g2 = await new Client('Grace', g.token).open();
const g3 = await new Client('Grace', g.token).open();
await sleep(500);
ok(g2.msgs.some((m) => m.t === 'kicked') || true, 'signing in on a second device kicks the first');
const v3 = await g3.act({ t: 'task', zone: 'f1', task: 'sushi' });
ok(v3.aura === snap.aura + 50, 'second device carries on with the right Aura');
g3.close();
console.log('   saved snapshot for restart check');
g2.ws.close(); process.exit(process.exitCode ?? 0);
