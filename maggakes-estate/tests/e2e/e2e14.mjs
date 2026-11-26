// Jess's Penthouse: her own floor with the biggest bedroom in the estate.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const URL = 'http://127.0.0.1:8787/?debug&norender';
const API = (path, body) => fetch('http://127.0.0.1:8787' + path, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
const b = await chromium.launch();
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const until = (p, fn, a, ms = 15000) => p.waitForFunction(fn, a, { timeout: ms }).then(() => true, () => false);
const join = async (name, pw) => {
  const r = await API('/api/login', { name, password: pw });
  const p = await (await b.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
  p.on('dialog', (d) => d.accept());
  await p.goto(URL); await p.evaluate((t) => localStorage.setItem('maggakes.token', t), r.token); await p.goto(URL);
  await p.waitForFunction(() => window.__game && window.__game() && window.__game().zone, null, { timeout: 90000 });
  await p.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
  return p;
};
const jess = await join('Jess', 'jess12');
ok(await jess.evaluate(() => window.__game().zoneId === 'jp' && window.__game().save.home.zone === 'jp'), 'Jess lives on her own penthouse floor');
const rooms = await jess.evaluate(() => window.__game().zone.rooms.map((r) => ({ id: r.id, a: (r.box.x1 - r.box.x0) * (r.box.z1 - r.box.z0) })));
const suite = rooms.find((r) => r.id === 'jess');
ok(suite && suite.a >= 500, `her suite is huge (${suite?.a} m²)`);
ok(await jess.evaluate(() => ['giantbed', 'hottub', 'stage', 'djbooth', 'goldsign'].every((t) => window.__game().zone.layout.props.some((p) => p.t === t))), 'giant canopy bed, hot tub, stage, DJ booth and gold sign');
ok(await jess.evaluate(() => window.__game().zone.layout.props.some((p) => p.t === 'goldsign' && String(p.o.text).includes("JESS'S SUITE"))), '"JESS\'S SUITE 👑" sign');
ok(await jess.evaluate(() => window.__game().zone.tubs.length === 1 && window.__game().zone.layout.pools?.length === 1), 'hot tub you can get in, and a pool');
await jess.evaluate(() => { const g = window.__game(); const b = g.zone.rooms.find((r) => r.id === 'jess').box; g.pos.set((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2 + 3); });
ok(await until(jess, () => document.querySelector('#actions')?.textContent.includes('Decorate my room')), 'Decorate my room works in the suite');
// tasks
for (const t of ['jhottub', 'jdj', 'jconcert', 'jbed', 'jglam']) await jess.evaluate((t) => window.__game().net.send({ t: 'task', zone: 'jp', task: t }), t);
await jess.waitForTimeout(800);
ok(await jess.evaluate(() => Object.keys(window.__game().save.tasks).filter((k) => k.startsWith('jp:')).length === 0), "penthouse tasks wait until it's unlocked (2,000 Total Aura)");
// someone else
const ava = await join('Ava', 'ava123');
await ava.evaluate(() => window.__game().travel('jp'));
await ava.waitForTimeout(1500);
ok(await ava.evaluate(() => window.__game().zoneId !== 'jp'), 'others need 2,000 Total Aura to visit');
const keola = await join('Keola', 'keola1');
ok(await until(keola, () => window.__game().zoneId === 'f4' && !window.__game().transitioning), 'Keola is on the 4th floor');
ok(await keola.evaluate(() => window.__game().zone.rooms.some((r) => r.id === 'guest4' && r.name === 'Guest Suite') && !window.__game().zone.rooms.some((r) => r.id === 'jess')), "Jess's old 4th-floor room is now a Guest Suite");
await until(keola, () => !window.__game().transitioning);
await keola.evaluate(() => window.__game().travel('jp'));
ok(await until(keola, () => window.__game().zoneId === 'jp'), 'Keola (8,000 Aura) can visit the penthouse');
await keola.evaluate(() => window.__game().net.send({ t: 'task', zone: 'jp', task: 'jdj' }));
ok(await until(keola, () => window.__game().save.tasks['jp:jdj']), 'visitors can do the penthouse tasks');
await b.close();
