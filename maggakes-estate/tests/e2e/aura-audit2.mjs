const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const api = (p, b) => fetch('http://127.0.0.1:8787' + p, { method: 'POST', body: JSON.stringify(b) }).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class Client {
  constructor(token) { this.token = token; this.msgs = []; }
  async open() { this.ws = new WebSocket(`ws://127.0.0.1:8787/ws?token=${this.token}`); this.ws.onmessage = (e) => { const m = JSON.parse(e.data); this.msgs.push(m); if (m.t === 'welcome' || m.t === 'save') this.save = m.save; }; while (!this.save) await sleep(20); return this; }
  send(m) { this.ws.send(JSON.stringify(m)); }
  async act(m, ms = 1200) { this.send(m); await sleep(ms); return this.save; }
}
const join = async (n, p) => new Client((await api('/api/login', { name: n, password: p })).token).open();
const k = await join('Keola', 'keola1'), m = await join('Milla', 'milla1');
for (const c of [k, m]) await c.act({ t: 'zone', zone: 'villa' }, 600);

// Villa challenge
let a = k.save.aura;
let s = await k.act({ t: 'villa', challenge: 'quiz' });
ok(s.aura === a + 50, 'villa challenge: +50 Aura');
s = await k.act({ t: 'villa', challenge: 'quiz' });
ok(s.aura === a + 50, 'villa challenge cooldown stops repeats');

// Party: dancing pays 10, capped at 50
await m.act({ t: 'party' });
a = k.save.aura;
for (let i = 0; i < 8; i++) { k.send({ t: 'emote', e: 'dance' }); await sleep(250); }
await sleep(800);
ok(k.save.aura === a + 50, `party dancing pays +10, max +50 (got +${k.save.aura - a})`);

// Tag: the winner(s) get +30 when it ends (we end it by leaving so it finishes early)
await k.act({ t: 'tag' });
const tagMsg = k.msgs.filter((x) => x.t === 'tag').pop();
const it = tagMsg?.it;
const winner = it === 'Keola' ? m : k;
a = winner.save.aura;
(it === 'Keola' ? k : m).send({ t: 'zone', zone: 'f1' });   // "it" leaves → game ends (only 1 left)
await sleep(1500);
ok(winner.save.aura === a + 30, `tag winner gets +30 (${winner === k ? 'Keola' : 'Milla'})`);

// Love Island season: nights pay +25
let se = await k.act({ t: 'season', act: { a: 'start' } });
const cast0 = k.save.villa.season.cast[0];
await k.act({ t: 'season', act: { a: 'answer', choice: cast0 } });
a = k.save.aura;
for (let i = 0; i < 12 && k.save.villa.season.day === 1; i++) {
  const p = k.save.villa.season.pending;
  if (p) await k.act({ t: 'season', act: { a: 'answer', choice: p.type === 'game' ? 'win' : (p.tones ?? p.options)[0] } }, 500);
  else await k.act({ t: 'season', act: { a: 'firepit' } }, 500);
}
ok(k.save.villa.season.day === 2 && k.save.aura === a + 25, `surviving a Love Island night: +25 Aura (day ${k.save.villa.season.day})`);
const hist = k.save.auraLog.slice(0, 5).map((e) => e.why).join(' | ');
ok(hist.includes('Love Island day') && hist.includes('Danced'), `history explains it: ${hist}`);
const snap = { k: [k.save.aura, k.save.totalAura], m: [m.save.aura, m.save.totalAura] };
(await import('node:fs')).writeFileSync('/tmp/snap2.json', JSON.stringify({ snap, k: k.token, m: m.token }));
k.ws.close(); m.ws.close();
process.exit(process.exitCode ?? 0);
