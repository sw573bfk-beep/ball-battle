const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const { snap, token } = JSON.parse((await import('node:fs')).readFileSync('/tmp/snap.json', 'utf8'));
const ws = new WebSocket(`ws://127.0.0.1:8787/ws?token=${token}`);
const save = await new Promise((r) => { ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'welcome') r(m.save); }; });
ok(save.aura === snap.aura + 50 && save.totalAura === snap.total && save.inventory.fx_fireworks === snap.fw && save.shells.length === snap.shells, `after a server restart everything is still there (${save.aura} available / ${save.totalAura} total)`);
ws.close(); process.exit(process.exitCode ?? 0);
