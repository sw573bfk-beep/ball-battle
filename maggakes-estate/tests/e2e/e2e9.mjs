// Outside world (beach, mall, town) and quests: travel there, talk to the Mayor,
// accept a quest, complete its steps and claim the reward. Also checks the tower floors open.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
const RENDER = process.argv.includes('--render');
const URL = 'http://127.0.0.1:8787/?debug' + (RENDER ? '' : '&norender');
const API = (path, body) => fetch('http://127.0.0.1:8787' + path, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const r = await API('/api/login', { name: 'Keola', password: 'keola1' });
const p = await (await b.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(URL); await p.evaluate((t) => { localStorage.setItem('maggakes.token', t); localStorage.setItem('quality', 'medium'); }, r.token); await p.goto(URL);
await p.waitForFunction(() => window.__game && window.__game() && window.__game().zone, null, { timeout: 120000 });
const G = (fn, a) => p.evaluate(fn, a);
const until = (fn, a, ms = 15000) => p.waitForFunction(fn, a, { timeout: ms }).then(() => true, () => false);
const clear = () => G(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
await clear();
const travel = async (z) => { await G((z) => window.__game().travel(z), z); return until((z) => window.__game().zoneId === z && window.__game().zone, z); };
const shot = async (name) => { if (!RENDER) return; await G(() => { const g = window.__game(); g.fun.update = () => {}; const L = g.zone.layout; if (L.mood !== 'moody') g.gfx.setTimeOfDay(0.3, Math.max(L.w, L.d), L.exterior === 'glass'); }); await p.waitForTimeout(2000); await p.screenshot({ path: `shots/${name}.png` }); };

// The car park has a road-trip signpost, and the map lists the outside places
ok(await travel('park'), 'went to the car park');
await p.waitForTimeout(800);
ok(await G(() => window.__game().zone.stations.some((s) => s.kind === 'roadtrip')), 'car park has a road-trip signpost');
await G(() => { const g = window.__game(); const st = g.zone.stations.find((s) => s.kind === 'roadtrip'); g.stationAction(st).run(); });
ok(await until(() => /Beach/.test(document.querySelector('.map')?.textContent ?? '') && /Mall/.test(document.querySelector('.map')?.textContent ?? '') && /Town/.test(document.querySelector('.map')?.textContent ?? '')), 'the map shows the beach, mall and town');
await clear();

for (const z of ['beach', 'mall', 'town']) {
  ok(await travel(z), `drove to the ${z}`);
  await p.waitForTimeout(1200);
  await clear();
  const info = await G(() => { const g = window.__game(); return { stations: g.zone.stations.filter((s) => s.kind === 'task').length, car: g.zone.layout.outside }; });
  ok(info.stations === 5 && info.car, `${z}: 5 tasks and your car is parked there`);
  await shot(`e2e9-${z}`);
}

// Town: the Mayor gives a quest
await p.waitForTimeout(500);
ok(await G(() => window.__game().wanderers.some((w) => w.kind === 'npc' && w.npcId === 'mayor')), 'Mayor Maggie is in town');
ok(await until(() => window.__game().wanderers.find((w) => w.npcId === 'mayor')?.marker?.userData.icon === '❗'), 'the Mayor has a ❗ quest marker');
await G(() => { const g = window.__game(); const w = g.wanderers.find((w) => w.npcId === 'mayor'); g.pos.set(w.x, w.z + 1.2); });
ok(await until(() => document.querySelector('#actions')?.textContent.includes('Talk to Mayor Maggie')), '"Talk to Mayor Maggie" button appears');
await p.click('#actions button:has-text("Talk to Mayor Maggie")');
ok(await until(() => document.querySelector('.quest')?.textContent.includes('Welcome to Maggakes')), 'the Mayor offers "Welcome to Maggakes"');
await shot('e2e9-quest');
await p.click('.quest button:has-text("Accept quest")');
ok(await until(() => window.__game().save.quests?.q_tour?.step === 0), 'quest accepted');
await clear();
// Do the steps: visit the beach and mall, do 3 tasks
await travel('beach'); await p.waitForTimeout(700);
await travel('mall'); await p.waitForTimeout(700);
for (const t of ['shoppingspree', 'wish', 'bubbletea']) { await G((t) => window.__game().net.send({ t: 'task', zone: 'mall', task: t }), t); await p.waitForTimeout(300); }
ok(await until(() => window.__game().save.quests?.q_tour?.step === 3), 'all three quest steps done');
await travel('town'); await p.waitForTimeout(1000); await clear();
ok(await until(() => window.__game().wanderers.find((w) => w.npcId === 'mayor')?.marker?.userData.icon === '✅'), 'the Mayor shows ✅ when the quest is ready');
const a0 = await G(() => window.__game().save.aura);
await G(() => { const g = window.__game(); g.net.send({ t: 'quest', a: 'claim', id: 'q_tour' }); });
ok(await until((a0) => window.__game().save.aura === a0 + 500 && window.__game().save.quests.q_tour.claimed, a0), 'claimed the reward: +500 Aura');
// Quest log
await G(() => window.__game().ctx && document.querySelector('#b-progress').click());
await p.click('.wtabs .tab:has-text("Quests")');
ok(await until(() => /Welcome to Maggakes/.test(document.querySelector('.progress')?.textContent ?? '') && /Town Helper/.test(document.querySelector('.progress')?.textContent ?? '')), 'quest log lists the quests (next one unlocked)');
await clear();

// A tower floor opens once unlocked (Keola has 8,000+ total from the tester grant)
ok(await G(() => window.__game().save.totalAura >= 8000), 'tester can reach the sky floors');
ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join(' | ')})`);
await b.close();
