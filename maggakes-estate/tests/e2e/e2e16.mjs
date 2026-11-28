// Floors 25–100 and the new penthouses (Grace; miac + ArielleCooper).
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const URL = 'http://127.0.0.1:8787/?debug&norender';
const API = (path, body) => fetch('http://127.0.0.1:8787' + path, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
const b = await chromium.launch();
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const until = (p, fn, a, ms = 20000) => p.waitForFunction(fn, a, { timeout: ms }).then(() => true, () => false);
const open = async (token) => {
  const p = await (await b.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
  p.on('dialog', (d) => d.accept());
  await p.goto(URL); await p.evaluate((t) => localStorage.setItem('maggakes.token', t), token); await p.goto(URL);
  await p.waitForFunction(() => window.__game && window.__game() && window.__game().zone, null, { timeout: 90000 });
  await p.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
  return p;
};
const join = async (name, pw) => open((await API('/api/login', { name, password: pw })).token);
const idle = (p) => until(p, () => !window.__game().transitioning);
const go = async (p, z) => { await idle(p); await p.evaluate((z) => window.__game().travel(z), z); return until(p, (z) => window.__game().zoneId === z && !window.__game().transitioning, z); };

const beau = await join('Beau', 'beau12');
const ava = await join('Ava', 'ava123');

// The map lists all 100 floors
await beau.click('#b-map');
ok(await until(beau, () => document.querySelectorAll('.map .flr').length >= 110), 'map lists every floor (1–100, penthouses, outside)');
ok(await beau.evaluate(() => document.querySelector('.map')?.textContent.includes('100th Floor – Cloud Palace')), '…up to the 100th Floor – Cloud Palace');
await beau.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
for (const z of ['f25', 'f50', 'f75', 'f100']) ok(await go(beau, z), `${z} loads`);
ok(await beau.evaluate(() => window.__game().zone.stations.filter((s) => s.kind === 'task').length === 5), 'with 5 task stations');

// Climbing: each floor's 5 tasks unlock the next one
await beau.evaluate(() => window.__game().net.send({ t: 'owner', action: 'give', target: 'Ava', n: 24000 }));
ok(await until(ava, () => window.__game().save.totalAura >= 24000), 'Ava has 24,000 Total Aura');
ok(await go(ava, 'f25'), 'Ava can go to the 25th floor (Ice Cream Parlour)');
ok(!(await ava.evaluate(() => (window.__game().travel('f26'), window.__game().zoneId === 'f26'))), 'the 26th is still locked');
const tasks = await ava.evaluate(() => window.__game().zone.stations.filter((s) => s.kind === 'task').map((s) => s.id));
for (const t of tasks) await ava.evaluate((t) => window.__game().net.send({ t: 'task', zone: 'f25', task: t }), t);
ok(await until(ava, () => window.__game().save.totalAura >= 25000), 'doing the 5 tasks gives +1,000 Total Aura');
ok(await go(ava, 'f26'), '…which unlocks the 26th floor (Dinosaur Museum)');
await ava.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
await ava.evaluate(() => { const g = window.__game(); const s = g.zone.stations.find((x) => x.kind === 'task'); g.pos.set(s.wx, s.wz); });
await ava.waitForTimeout(500);
await ava.keyboard.press('e');
ok(await until(ava, () => !!document.querySelector('.mg') || !!document.querySelector('#modals .modal')), 'a 26th-floor mini-game opens');

// Grace's penthouse
const grace = await join('Grace', 'grace1');
ok(await grace.evaluate(() => window.__game().save.home.zone === 'gp' && window.__game().zoneId === 'gp'), 'Grace lives in her own penthouse');
await grace.evaluate(() => { const g = window.__game(); const b = g.zone.rooms.find((r) => r.id === 'grace').box; g.pos.set((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2 + 3); });
ok(await until(grace, () => document.querySelector('#actions')?.textContent.includes('Decorate my room')), 'Grace can decorate her suite');
ok(await grace.evaluate(() => window.__game().zone.layout.props.some((p) => p.t === 'goldsign' && String(p.o.text).includes("GRACE'S SUITE"))), '"GRACE\'S SUITE 🌙" gold sign');

// Mia & Arielle: new sign-ups go straight to their shared penthouse when approved
for (const n of ['miac', 'ArielleCooper']) ok((await API('/api/login', { name: n, password: 'secret1' })).pending, `${n} signs up`);
for (const n of ['miac', 'ArielleCooper']) await beau.evaluate((n) => window.__game().net.send({ t: 'admin', action: 'approve', target: n }), n);
await beau.waitForTimeout(800);
const mia = await join('miac', 'secret1');
const ari = await join('ArielleCooper', 'secret1');
ok(await mia.evaluate(() => window.__game().save.home.zone === 'mp' && window.__game().save.home.room === 'mia'), "miac's bedroom is Mia's Room in the shared penthouse");
ok(await ari.evaluate(() => window.__game().save.home.zone === 'mp' && window.__game().save.home.room === 'arielle'), "ArielleCooper's bedroom is Arielle's Room");
ok(await mia.evaluate(() => window.__game().zoneId === 'mp') && await ari.evaluate(() => window.__game().zoneId === 'mp'), 'they both start there');
await mia.evaluate(() => { const g = window.__game(); const b = g.zone.rooms.find((r) => r.id === 'mia').box; g.pos.set((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2 + 2); });
ok(await until(mia, () => document.querySelector('#actions')?.textContent.includes('Decorate my room')), 'Mia can decorate her room');
await mia.evaluate(() => { const g = window.__game(); const b = g.zone.rooms.find((r) => r.id === 'arielle').box; g.pos.set((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2 - 2); });
await mia.waitForTimeout(600);
ok(!(await mia.evaluate(() => document.querySelector('#actions')?.textContent.includes('Decorate my room'))), "…but not Arielle's");
await b.close();
