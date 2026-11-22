const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const { snap, k, m } = JSON.parse((await import('node:fs')).readFileSync('/tmp/snap2.json', 'utf8'));
const get = (t) => new Promise((r) => { const ws = new WebSocket(`ws://127.0.0.1:8787/ws?token=${t}`); ws.onmessage = (e) => { const x = JSON.parse(e.data); if (x.t === 'welcome') { ws.close(); r(x.save); } }; });
const ks = await get(k), ms = await get(m);
ok(ks.aura === snap.k[0] && ks.totalAura === snap.k[1] && ms.aura === snap.m[0] && ms.totalAura === snap.m[1], 'party, tag, villa and Love Island Aura all survive a server restart');
process.exit(process.exitCode ?? 0);
