// Customisation: any colours, mix & match, saved outfits, profiles, room style,
// furniture recolour/resize/move, car + kart + wheel paint, pet colours.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
const URL = 'http://127.0.0.1:8787/?debug&norender';
const API = (path, body) => fetch('http://127.0.0.1:8787' + path, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
mkdirSync('shots', { recursive: true });
const join = async (name, pw) => {
  const r = await API('/api/login', { name, password: pw });
  const p = await (await b.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
  p.on('dialog', (d) => d.accept());
  await p.goto(URL);
  await p.evaluate((t) => localStorage.setItem('maggakes.token', t), r.token);
  await p.goto(URL);
  await p.waitForFunction(() => window.__game && window.__game() && window.__game().zone, null, { timeout: 90000 });
  await p.waitForTimeout(1000);
  await p.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
  return p;
};
const until = async (p, fn, a, ms = 15000) => { try { await p.waitForFunction(fn, a, { timeout: ms }); return true; } catch { return false; } };
const G = (p, fn, a) => p.evaluate(fn, a);
/** Picks a colour in the n-th "any colour" picker of the open sheet. */
const pickAny = (p, n, hex) => G(p, ([n, hex]) => {
  const el = document.querySelectorAll('.sheet input.anycolor')[n];
  el.value = hex; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change'));
}, [n, hex]);

const k = await join('Keola', 'keola1');
const m = await join('Milla', 'milla1');
// Both on Keola's home floor
for (const p of [k, m]) { await G(p, () => window.__game().travel('f4')); await until(p, () => window.__game().zoneId === 'f4'); }
await k.waitForTimeout(1500);

// ---------- Wardrobe: any colour skin + hair, mix & match, clothes colours
await k.click('#b-wardrobe');
await pickAny(k, 0, '#7a3cff');          // skin (first picker on the Look tab)
await pickAny(k, 1, '#00c2a8');          // hair
await k.click('.wtabs .tab:has-text("Clothes")');
await k.click('.chip:has-text("Mix")');
await k.click('.chip:has-text("Hoodie")');
await k.click('.chip:has-text("Shorts")');
await pickAny(k, 0, '#ff2200');          // top colour
await k.screenshot({ path: 'shots/e2e7-wardrobe.png' });
await k.click('text=Save look');
ok(await until(k, () => { const l = window.__game().save.look; return l.skin === '#7a3cff' && l.hairColor === '#00c2a8' && l.top === 'hoodie' && l.bottom === 'shorts' && l.colors?.top === '#ff2200'; }), 'any-colour skin/hair + mix & match hoodie and shorts saved');
ok(await until(m, () => window.__game().peers.get('Keola')?.info.look.top === 'hoodie'), 'Milla sees Keola’s new hoodie');

// ---------- Saved outfits
await k.click('#b-wardrobe');
await k.click('.wtabs .tab:has-text("Saved")');
await k.locator('.slots input').first().fill('Purple Vibes');
await k.locator('.slots button:has-text("Save here")').first().click();
ok(await until(k, () => window.__game().save.outfits?.[0]?.name === 'Purple Vibes' && window.__game().save.outfits[0].look.top === 'hoodie'), 'outfit saved to slot 1 with its name');

// ---------- Profile & name tag
await k.click('.wtabs .tab:has-text("Profile")');
await k.click('.badges button:has-text("👑")');
await k.locator('.sheet textarea').fill('Tester extraordinaire 🌴');
await pickAny(k, 0, '#ff1493');
await k.locator('.sheet button:has-text("Save profile")').click();
ok(await until(k, () => { const p = window.__game().save.profile; return p?.badge === '👑' && p.color === '#ff1493' && p.bio?.startsWith('Tester'); }), 'profile badge, tag colour and bio saved');
ok(await until(m, () => window.__game().peers.get('Keola')?.info.profile?.badge === '👑'), 'Milla sees Keola’s badge');
await G(k, () => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));

// Milla walks up to Keola and opens the profile
await G(m, () => { const g = window.__game(); const pk = g.peers.get('Keola'); g.pos.set(pk.x + 1, pk.z); });
ok(await until(m, () => document.querySelector('#actions')?.textContent.includes("Keola's profile")), 'a “Keola’s profile” button appears next to Keola');
await m.click('#actions button:has-text("Keola\'s profile")');
ok(await until(m, () => document.querySelector('.profile-card .bio')?.textContent.includes('Tester extraordinaire')), 'Milla can read Keola’s bio');
await G(m, () => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));

// ---------- Bedroom: walls & floor
await G(k, () => { const g = window.__game(); const r = g.zone.rooms.find((r) => r.id === 'keola').box; g.pos.set((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); });
ok(await until(k, () => document.querySelector('#actions')?.textContent.includes('Walls & floor')), 'Walls & floor button in your own bedroom');
await k.click('#actions button:has-text("Walls & floor")');
await pickAny(k, 0, '#2a2d34');
await k.click('.sheet .chip:has-text("Marble")');
ok(await until(k, () => window.__game().save.roomStyle?.wall === '#2a2d34' && window.__game().save.roomStyle?.floor === 'marble'), 'wall colour + marble floor saved');
await G(k, () => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
await k.waitForTimeout(800);

// ---------- Furniture: place with colour + size, then edit
await G(k, () => { const g = window.__game(); const r = g.zone.rooms.find((r) => r.id === 'keola').box; g.pos.set((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); });
await G(k, () => window.__game().net.send({ t: 'buy', item: 'd_teddy' }));
await until(k, () => (window.__game().save.inventory.d_teddy ?? 0) >= 1);
await k.waitForTimeout(400);
await k.click('#actions button:has-text("Decorate my room")');
const before = await G(k, () => window.__game().save.room.length);
await k.click('#decor .chip:has-text("Giant Teddy")');
await G(k, () => { const el = document.querySelector('#decor input.anycolor'); el.value = '#00ff88'; el.dispatchEvent(new Event('change')); });
await G(k, () => { const el = document.querySelector('#decor input[type=range]'); el.value = '1.4'; el.dispatchEvent(new Event('input')); });
await k.click('#decor .decor-btns button:has-text("✓ Place")');
ok(await until(k, (n) => { const r = window.__game().save.room; return r.length === n + 1 && r[r.length - 1].color === '#00ff88' && r[r.length - 1].scale === 1.4; }, before), 'teddy placed in green at 140% size');
await k.click('#decor button:has-text("Edit nearest")');
ok(await until(k, () => !!document.querySelector('#decor .decor-edit b')), 'edit panel opens for the nearest item');
const uid = await G(k, () => window.__game().decor.sel);
const rot0 = await G(k, (u) => window.__game().save.room.find((i) => i.uid === u).rot, uid);
await k.click('#decor button:has-text("⟳")');
ok(await until(k, ([u, r]) => window.__game().save.room.find((i) => i.uid === u).rot !== r, [uid, rot0]), 'rotating saves');
await G(k, () => { const el = document.querySelector('#decor input[type=range]'); el.value = '0.7'; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); });
ok(await until(k, (u) => window.__game().save.room.find((i) => i.uid === u).scale === 0.7, uid), 'resizing saves');
await G(k, () => { const el = document.querySelector('#decor input.anycolor'); el.value = '#3355ff'; el.dispatchEvent(new Event('change')); });
ok(await until(k, (u) => window.__game().save.room.find((i) => i.uid === u).color === '#3355ff', uid), 'recolouring saves');
const xz0 = await G(k, (u) => { const i = window.__game().save.room.find((i) => i.uid === u); return [i.x, i.z]; }, uid);
await k.click('#decor button:has-text("Move")');
await G(k, () => { const g = window.__game(); const r = g.zone.rooms.find((r) => r.id === 'keola').box; g.pos.set(r.x0 + 1.5, r.z0 + 1.5); g.ry = 0; });
await k.waitForTimeout(300);
await k.click('#decor button:has-text("Drop here")');
ok(await until(k, ([u, a]) => { const i = window.__game().save.room.find((i) => i.uid === u); return Math.hypot(i.x - a[0], i.z - a[1]) > 0.5; }, [uid, xz0]), 'moving saves the new spot');
await k.screenshot({ path: 'shots/e2e7-decor.png' });
await k.click('#decor button:has-text("Done editing")');
await k.click('#decor button:has-text("Done")');
ok(await until(m, (u) => window.__game().decorGroups.get('Keola')?.children.some((o) => o.userData.uid === u), uid), 'Milla sees the edited teddy in Keola’s room');

// ---------- Cars: any paint + wheel colour, kart too
await G(k, () => { const n = window.__game().net; n.send({ t: 'car', car: 'car_kart', paint: '#123abc', wheels: '#ffd700' }); n.send({ t: 'car', car: null }); });
ok(await until(k, () => window.__game().save.carPaint.car_kart === '#123abc' && window.__game().save.carWheels?.car_kart === '#ffd700'), 'mini kart: any paint + gold wheels');
ok(await G(k, () => window.__game().save.car !== 'car_kart'), 'painting the kart doesn’t replace your main car');
await G(k, () => window.__game().travel('park'));
await until(k, () => window.__game().zoneId === 'park');
await k.waitForTimeout(1200);
await G(k, () => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
await G(k, () => { const g = window.__game(); const st = g.zone.stations.find((s) => s.kind === 'garage' || s.def?.kind === 'garage' || s.id === 'garage'); g.stationAction(st).run(); });
const garageOpen = await until(k, () => !!document.querySelector('.garage'), null, 3000);
if (garageOpen) {
  await pickAny(k, 0, '#aa00ff');
  await pickAny(k, 1, '#00ffaa');
  const car = await G(k, () => window.__game().save.car);
  ok(await until(k, (c) => window.__game().save.carPaint[c] === '#aa00ff' && window.__game().save.carWheels?.[c] === '#00ffaa', car), 'garage: any paint + any wheel colour');
  await k.screenshot({ path: 'shots/e2e7-garage.png' });
  await G(k, () => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
} else ok(false, 'garage opens');

// ---------- Pet colours
await G(k, () => window.__game().net.send({ t: 'pet', kind: 'bunny', name: 'Pixel', fur: '#ff99cc', collar: '#00ccff' }));
ok(await until(k, () => { const p = window.__game().save.pet; return p?.name === 'Pixel' && p.fur === '#ff99cc' && p.collar === '#00ccff'; }), 'pet bunny with pink fur and blue collar');

await b.close();
