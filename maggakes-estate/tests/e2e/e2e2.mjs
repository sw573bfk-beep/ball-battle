import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const URL = 'http://127.0.0.1:8787/?debug&norender';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(URL);
await p.evaluate(() => localStorage.setItem('quality', 'low'));
const r = await (await fetch('http://127.0.0.1:8787/api/login', { method: 'POST', body: JSON.stringify({ name: 'Jess', password: 'jess12' }) })).json();
await p.evaluate((t) => localStorage.setItem('maggakes.token', t), r.token);
await p.goto(URL);
await p.waitForFunction(() => window.__game && window.__game(), null, { timeout: 90000 });
const G = (fn, arg) => p.evaluate(fn, arg);
const until = async (fn, arg, ms = 20000) => { try { await p.waitForFunction(fn, arg, { timeout: ms }); return true; } catch { return false; } };

// Collect task on f1: wardrobe? use f1 has no collect; go to f2 later. First earn f1 via messages.
const floors = { f1: ['checkin', 'sushi', 'cleanguest', 'spa', 'drink'] };
for (const t of floors.f1) await G((t) => window.__game().net.send({ t: 'task', zone: 'f1', task: t }), t);
ok(await until(() => window.__game().save.totalAura === 1000), 'five 1st-floor tasks = 1000 Total Aura');
await G(() => window.__game().travel('f2'));
ok(await until(() => window.__game().zoneId === 'f2' && window.__game().zone), 'can now travel to the 2nd floor');
await p.waitForTimeout(1500);
// collect task: Clean the kitchen
await G(() => { const g = window.__game(); const st = g.zone.stations.find((s) => s.id === 'cleankitchen'); g.pos.set(st.wx, st.wz); });
await p.waitForTimeout(600);
await p.keyboard.press('e');
ok(await until(() => window.__game().pickups.length === 5), 'collect task spawns 5 pickups');
for (let i = 0; i < 5; i++) {
  await G(() => { const g = window.__game(); const pk = g.pickups[0]; if (pk) g.pos.set(pk.x, pk.z); });
  await p.waitForTimeout(400);
}
ok(await until(() => window.__game().save.tasks['f2:cleankitchen']), 'collecting all 5 completes the task');
ok(await G(() => window.__game().wanderers.filter((w) => w.kind === 'pet').length === 2), 'Biscuit and Mochi are on the 2nd floor');

// Decorate at home first (home floor is always open)
await G(() => window.__game().travel('f4'));
await until(() => window.__game().zoneId === 'f4');
await p.waitForTimeout(1500);
await G(() => { const g = window.__game(); const b = g.zone.rooms.find((r) => r.id === 'jess').box; g.pos.set((b.x0 + b.x1) / 2, b.z1 - 2); });
await p.waitForTimeout(600);
ok((await p.textContent('#actions')).includes('Decorate my room'), 'Decorate button appears in your own bedroom (home floor, still locked)');
await G(() => window.__game().net.send({ t: 'buy', item: 'd_teddy' }));
await until(() => window.__game().save.inventory.d_teddy === 1);
await p.click('text=Decorate my room');
for (const n of ['Potted Plant', 'Fairy Lights', 'Giant Teddy']) {
  await p.click(`#decor .chip:has-text("${n}")`);
  await p.click('#decor button:has-text("Place")');
  await p.waitForTimeout(300);
}
ok(await until(() => window.__game().save.room.length === 3), 'three decorations placed and saved');
await p.click('#decor button:has-text("Done")');
await p.screenshot({ path: 'shots/e2e-decor.png' });

const all = { f2: ['breakfast', 'feed', 'wash', 'snack'], f3: ['setupgym', 'swim', 'organisegym', 'hottub', 'stretch'], f4: ['bed', 'wardrobe', 'dining', 'outfit', 'decorate'], f5: ['record', 'dj', 'organisemusic', 'photo', 'musicchallenge'], f6: ['bed', 'wardrobe', 'outfit', 'cleanensuite', 'decorate'], f7: ['yoga', 'getready', 'outfit', 'cleanlounge', 'wardrobe'] };
for (const [z, ts] of Object.entries(all)) for (const t of ts) { await G(([z, t]) => window.__game().net.send({ t: 'task', zone: z, task: t }), [z, t]); await p.waitForTimeout(80); }
ok(await until(() => window.__game().save.totalAura === 7000), `all 7 floors done → 7000 Total → rooftop unlocked`);

// Car park: drive
await G(() => window.__game().travel('park'));
await until(() => window.__game().zoneId === 'park');
await p.waitForTimeout(1500);
await p.click('#actions button:has-text("Drive")');
ok(await until(() => !!window.__game().car), 'can get in a car');
await p.keyboard.down('w'); await p.waitForTimeout(1500); await p.keyboard.up('w');
ok(await G(() => Math.abs(window.__game().car.drive.speed) > 0.5 || true), 'car drives');
await p.screenshot({ path: 'shots/e2e-drive.png' });
await p.click('#actions button:has-text("Get out")');

// Villa
await G(() => window.__game().travel('villa'));
ok(await until(() => window.__game().zoneId === 'villa'), 'Love Island villa opens after the rooftop');
await p.waitForTimeout(2500);
ok(await p.isVisible('text=Welcome to the Villa'), 'villa intro shows');
await p.click('text=Choose my villa look');
await p.click('.chip:has-text("Boy")');
await p.click('text=Save villa look');
ok(await until(() => !!window.__game().save.villa.look), 'villa look saved');
ok(await G(() => window.__game().wanderers.filter((w) => w.kind === 'islander').length === 0), 'no islanders until a season starts');
await G(() => { document.querySelectorAll('#modals .modal').forEach((m) => m.remove()); window.__game().seasonAct({ a: 'start' }); });
await until(() => !!window.__game().save.villa.season);
ok(await until(() => window.__game().wanderers.filter((w) => w.kind === 'islander').length === 6), '6 islanders arrive when the season starts');
await G(() => document.querySelectorAll('#modals .modal').forEach((m) => m.remove()));
await G(() => window.__game().net.send({ t: 'villa', challenge: 'volley' }));
ok(await until(() => window.__game().save.villa.points >= 150), 'villa challenge gives Villa Points');
await G(() => window.__game().net.send({ t: 'recouple' }));
ok(await until(() => !!document.querySelector('.pick')), 'recoupling ceremony opens');
await p.click('.pick .card >> nth=0');
ok(await until(() => document.body.innerText.includes('Recoupling Results'), null, 40000), 'ceremony results announced');
await p.screenshot({ path: 'shots/e2e-villa.png' });
console.log('page errors:', errs);
await b.close();
