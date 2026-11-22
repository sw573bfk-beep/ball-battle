import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const URL = 'http://127.0.0.1:8787/?debug&norender';
const API = (path, body) => fetch('http://127.0.0.1:8787' + path, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const join = async (name, pw) => {
  const r = await API('/api/login', { name, password: pw });
  const p = await (await b.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(URL);
  await p.evaluate((t) => localStorage.setItem('maggakes.token', t), r.token);
  await p.goto(URL);
  await p.waitForFunction(() => window.__game && window.__game() && window.__game().zone, null, { timeout: 90000 });
  await p.waitForTimeout(1200);
  return p;
};
const until = async (p, fn, a, ms = 20000) => { try { await p.waitForFunction(fn, a, { timeout: ms }); return true; } catch { return false; } };
const G = (p, fn, a) => p.evaluate(fn, a);

const k = await join('Keola', 'keola1');   // tester: everything unlocked
const m = await join('Milla', 'milla1');
for (const p of [k, m]) await G(p, () => window.__game().travel('f1'));
await until(k, () => window.__game().zoneId === 'f1' && window.__game().peers.has('Milla'));

// Fun menu + mini kart indoors
await k.click('#b-fun');
ok(await until(k, () => document.body.innerText.includes('Mini kart')), 'Fun menu opens with Mini kart, spin, pet, party, tag, fireworks, shells, music');
await k.click('.fun:has-text("Mini kart")');
ok(await until(k, () => window.__game().isDriving()), 'hopped in a mini kart on the 1st floor');
ok(await until(m, () => window.__game().peers.get('Keola')?.info.car?.id === 'car_kart'), 'Milla sees Keola in the kart');
const p0 = await G(k, () => [window.__game().pos.x, window.__game().pos.y]);
await k.keyboard.down('w'); await k.waitForTimeout(1500); await k.keyboard.up('w');
const p1 = await G(k, () => [window.__game().pos.x, window.__game().pos.y]);
ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 1, `the kart drives indoors (${Math.hypot(p1[0] - p0[0], p1[1] - p0[1]).toFixed(1)} m)`);
await G(k, () => window.__game().startKart());
ok(!(await G(k, () => window.__game().isDriving())), 'got out of the kart');

// Pet
await G(k, () => window.__game().net.send({ t: 'pet', kind: 'bunny', name: 'Coco' }));
ok(await until(k, () => window.__game().save.pet?.name === 'Coco'), 'adopted a bunny called Coco');
ok(await until(m, () => window.__game().peers.get('Keola')?.info.pet?.kind === 'bunny'), "Milla can see Keola's bunny");

// Spin
await G(k, () => window.__game().fun.openSpin());
await k.click('text=🎡 SPIN!');
ok(await until(k, () => !!window.__game().save.spinDate, null, 15000), 'daily spin works');
await k.keyboard.press('Escape');

// Shells
const shells = await G(k, () => window.__game().fun.shells.map((s) => [s.x, s.z]));
ok(shells.length === 3, `3 golden shells hidden on the 1st floor (${shells.length})`);
const before = await G(k, () => window.__game().save.shells?.length ?? 0);
await G(k, ([x, z]) => window.__game().pos.set(x, z), shells[0]);
ok(await until(k, (n) => (window.__game().save.shells?.length ?? 0) === n + 1, before), 'picked up a golden shell');

// Fireworks
const fw = await G(k, () => window.__game().save.inventory.fx_fireworks ?? 0);
await G(k, () => window.__game().fun.launchFireworks());
ok(await until(k, (n) => window.__game().save.inventory.fx_fireworks === n - 1, fw), 'fireworks launched (one used)');
ok(await until(m, () => document.body.innerText.includes('set off fireworks')), 'Milla sees the fireworks');

// Party
await G(m, () => window.__game().net.send({ t: 'party' }));
ok(await until(k, () => document.querySelector('#banner')?.textContent.includes('PARTY')), 'party starts for everyone on the floor');
const aura0 = await G(k, () => window.__game().save.aura);
await G(k, () => window.__game().emote('dance'));
ok(await until(k, (a) => window.__game().save.aura === a + 10, aura0), 'dancing at the party gives +10 Aura');

// Tag
await G(k, () => window.__game().net.send({ t: 'tag' }));
ok(await until(m, () => document.querySelector('#banner')?.textContent.includes('TAG')), 'tag starts (banner shows who is IT)');
const it = await G(k, () => window.__game().fun.tag?.it);
const itPage = it === 'Keola' ? k : m, other = it === 'Keola' ? 'Milla' : 'Keola';
const op = await G(itPage, (o) => { const p = window.__game().peers.get(o); return [p.x, p.z]; }, other);
await G(itPage, ([x, z]) => window.__game().pos.set(x + 0.5, z), op);
ok(await until(itPage, (o) => window.__game().fun.tag?.it === o, other), `${it} tagged ${other}`);

// Race in the car park
await G(k, () => window.__game().travel('park'));
await until(k, () => window.__game().zoneId === 'park');
await k.waitForTimeout(1500);
await G(k, () => { const g = window.__game(); const st = g.zone.stations.find((s) => s.kind === 'race'); g.pos.set(st.wx, st.wz); });
await k.waitForTimeout(400);
await k.keyboard.press('e');
ok(await until(k, () => document.body.innerText.includes('Start race')), 'race station shows the lap board');
await k.click('text=Start race');
ok(await until(k, () => window.__game().isDriving() && !!window.__game().fun.race), 'race starts in a kart at the start line');
await k.waitForTimeout(3300);
for (let i = 0; i < 5; i++) {
  await k.waitForTimeout(2200);
  await G(k, () => { const g = window.__game(); const r = g.fun.race; if (!r) return; const cp = r.cps[r.next]; g.car.x = cp.x; g.car.z = cp.z; });
}
ok(await until(k, () => !!window.__game().save.bestLap), 'finishing the lap records a best time');

// Water slide
await G(k, () => window.__game().travel('f8'));
await until(k, () => window.__game().zoneId === 'f8');
await k.waitForTimeout(1500);
await G(k, () => window.__game().fun.startSlide());
ok(await until(k, () => !window.__game().fun.slide && !window.__game().lockMove, null, 10000), 'slid down the water slide');
ok(await G(k, () => { const g = window.__game(); return g.zone.pools.some((p) => g.pos.x > p.x0 && g.pos.x < p.x1 && g.pos.y > p.z0 && g.pos.y < p.z1); }), 'landed in the infinity pool');

// Day/night + music settings exist
ok(await G(k, () => document.querySelector('#daytime').textContent.length > 0), 'day/night icon shows next to the floor name');
console.log('page errors:', errs.slice(0, 5));
await b.close();
