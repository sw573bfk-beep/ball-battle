import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const render = process.argv[2] === 'render';
const URL = 'http://127.0.0.1:8787/?debug' + (render ? '' : '&norender');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(URL);
await p.evaluate(() => localStorage.setItem('quality', 'medium'));
const r = await (await fetch('http://127.0.0.1:8787/api/login', { method: 'POST', body: JSON.stringify({ name: 'Milla', password: 'milla1' }) })).json();
await p.evaluate((t) => localStorage.setItem('maggakes.token', t), r.token);
await p.goto(URL);
await p.waitForFunction(() => window.__game && window.__game(), null, { timeout: 90000 });
const G = (fn, a) => p.evaluate(fn, a);
const until = async (fn, a, ms = 30000) => { try { await p.waitForFunction(fn, a, { timeout: ms }); return true; } catch { return false; } };
if (!(await G(() => window.__game().save.totalAura >= 7000))) {
  await G(() => window.__game().net.send({ t: 'room', items: [{ uid: 'a', item: 'd_plant', x: 0, z: 0, rot: 0 }, { uid: 'b', item: 'd_lights', x: 1, z: 0, rot: 0 }] }));
  await p.waitForTimeout(500);
  await G(() => window.__game().net.send({ t: 'buy', item: 'd_plant' }));
  const all = { f1: ['checkin', 'sushi', 'cleanguest', 'spa', 'drink'], f2: ['breakfast', 'feed', 'wash', 'snack', 'cleankitchen'], f3: ['setupgym', 'swim', 'organisegym', 'hottub', 'stretch'], f4: ['bed', 'wardrobe', 'dining', 'outfit', 'decorate'], f5: ['record', 'dj', 'organisemusic', 'photo', 'musicchallenge'] };
  for (const [z, ts] of Object.entries(all)) for (const t of ts) { await G(([z, t]) => window.__game().net.send({ t: 'task', zone: z, task: t }), [z, t]); await p.waitForTimeout(60); }
  await until(() => window.__game().save.aura >= 150);
  await G(() => window.__game().net.send({ t: 'buy', item: 'd_plant' }));
  await p.waitForTimeout(400);
  await G(() => { const g = window.__game(); g.net.send({ t: 'room', items: [{ uid: 'a', item: 'd_plant', x: 0, z: 0, rot: 0 }, { uid: 'b', item: 'd_lights', x: 1, z: 0, rot: 0 }, { uid: 'c', item: 'd_plant', x: 2, z: 0, rot: 0 }] }); });
  await p.waitForTimeout(400);
  for (const [z, ts] of Object.entries({ f6: ['bed', 'wardrobe', 'outfit', 'cleanensuite', 'decorate'], f7: ['yoga', 'getready', 'outfit', 'cleanlounge', 'wardrobe'] })) for (const t of ts) { await G(([z, t]) => window.__game().net.send({ t: 'task', zone: z, task: t }), [z, t]); await p.waitForTimeout(60); }
}
ok(await until(() => window.__game().save.totalAura >= 7000), 'Milla reached the rooftop');
await G(() => window.__game().travel('villa'));
ok(await until(() => window.__game().zoneId === 'villa'), 'entered the villa');
await p.waitForTimeout(1800);
ok(await p.isVisible('text=Choose my villa look'), 'asked to pick a villa look first');
await p.click('text=Choose my villa look');
await p.click('.chip:has-text("Sequin Party Dress")');
await p.click('.chip:has-text("Beach waves")');
await p.click('text=Save villa look');
ok(await until(() => window.__game().save.villa.look?.outfit === 'fit_sequin'), 'villa look saved (sequin dress, beach waves)');
ok(await until(() => document.body.innerText.includes('Start my season')), 'host offers to start a season');
ok(await G(() => window.__game().wanderers.some((w) => w.kind === 'host')), 'Jazz the host is standing at the firepit');
await p.click('text=Start my season');
ok(await until(() => !!document.querySelector('.scene-modal')), 'host intro scene opens');
await p.click('.scene');   // skip typing
await until(() => !!document.querySelector('.scene-choices .btn'));
ok((await p.locator('.scene .isl').count()) === 6, 'six islanders introduced with portraits');
if (render) await p.screenshot({ path: 'shots/villa-intro.png' });
await p.locator('.scene-choices .btn').first().click();
ok(await until(() => !!window.__game().save.villa.season?.partner), 'first coupling done');
await until(() => !!document.querySelector('.scene-modal'));
await p.click('.scene'); await p.click('.scene-choices .btn');
ok(await until(() => window.__game().wanderers.filter((w) => w.kind === 'islander').length === 6), '6 islanders walking around the villa');
// Chat with an islander in 3D
await G(() => { const g = window.__game(); const w = g.wanderers.find((x) => x.kind === 'islander'); w.wait = 99; g.pos.set(w.x + 0.8, w.z); });
await p.waitForTimeout(500);
ok((await p.textContent('#actions')).includes('Chat with'), 'walking up to an islander shows "Chat with…"');
await p.keyboard.press('e');
ok(await until(() => !!document.querySelector('.scene-modal .btn.choice')), 'conversation with 3 answer choices');
if (render) await p.screenshot({ path: 'shots/villa-chat.png' });
await p.locator('.btn.choice').first().click();
ok(await until(() => !!document.querySelector('.bondchip')), 'answer changes your bond (shown)');
await p.click('.scene-choices .btn');
// Play through the season via the season engine messages until it ends
let guard = 0;
while (guard++ < 120) {
  const st = await G(() => { const s = window.__game().save.villa.season; return s ? { phase: s.phase, pending: s.pending, actions: s.actions, cast: s.cast } : null; });
  if (!st || st.phase === 'over') break;
  if (st.pending) {
    const opts = st.pending.type === 'chat' || st.pending.type === 'hut' ? st.pending.tones : st.pending.type === 'game' ? ['win'] : st.pending.options;
    await G((c) => window.__game().seasonAct({ a: 'answer', choice: c }), opts[0]);
  } else if (st.phase === 'morning' && st.actions > 0) await G((w) => window.__game().seasonAct({ a: 'chat', who: w }), st.cast[0]);
  else await G(() => window.__game().seasonAct({ a: 'firepit' }));
  await p.waitForTimeout(150);
}
const end = await G(() => window.__game().save.villa.season);
ok(end.phase === 'over', `season finished: ${end.result} on day ${end.day}`);
console.log('   log:', end.log.join(' | '));
console.log('page errors:', errs.slice(0, 5));
await b.close();
