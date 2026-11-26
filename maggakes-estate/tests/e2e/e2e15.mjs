// Owner powers: Beau can go on every floor, has everything, and can do anything to anyone.
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
const S = (p) => p.evaluate(() => window.__game().save);
const owner = (p, action, target, extra = {}) => p.evaluate(([action, target, extra]) => window.__game().net.send({ t: 'owner', action, target, ...extra }), [action, target, extra]);
const idle = (p) => until(p, () => !window.__game().transitioning);

const beau = await join('Beau', 'beau12');
const jess = await join('Jess', 'jess12');
const ava = await join('Ava', 'ava123');
const keola = await join('Keola', 'keola1');

// Maxed out
const bs = await S(beau);
ok(bs.aura >= 1_000_000 && bs.totalAura >= 30_000 && bs.vip, `Beau has ${bs.aura.toLocaleString()} Aura, ${bs.totalAura.toLocaleString()} total, VIP`);
ok(Object.keys(bs.inventory).length >= 100 && (bs.upgrades ?? []).length === 10, `owns every item (${Object.keys(bs.inventory).length}) and all 10 estate upgrades`);
const board = await (async () => { await beau.evaluate(() => { window.__rows = null; window.__game().boardListeners.add((r) => { window.__rows = r; }); window.__game().net.send({ t: 'board' }); }); await until(beau, () => !!window.__rows); return beau.evaluate(() => window.__rows.map((r) => r.name)); })();
ok(board.length > 3 && !board.includes('Beau'), 'Beau is left off the leaderboard');

// Every floor
for (const z of ['f24', 'villa', 'jp', 'stadium']) {
  await idle(beau);
  await beau.evaluate((z) => window.__game().travel(z), z);
  ok(await until(beau, (z) => window.__game().zoneId === z, z), `Beau can go to ${z}`);
}
await idle(beau);
await beau.evaluate(() => window.__game().travel('f1'));
await until(beau, () => window.__game().zoneId === 'f1');

// Aura + items
const j0 = (await S(jess)).aura;
await owner(beau, 'give', 'Jess', { n: 5000 });
ok(await until(jess, (a) => window.__game().save.aura === a + 5000 && window.__game().save.totalAura >= 5000, j0), 'give 5,000 Aura → Jess gets it');
ok(await until(jess, () => document.querySelector('#toasts')?.textContent.includes('Beau gave you 5,000 Aura')), 'Jess is told');
await owner(beau, 'take', 'Jess', { n: 1000 });
ok(await until(jess, (a) => window.__game().save.aura === a + 4000, j0), 'take 1,000 back');
await owner(beau, 'item', 'Jess', { item: 'fit_blossom' });
ok(await until(jess, () => window.__game().save.inventory.fit_blossom === 1), 'give any item (Cherry Blossom Gown)');
await owner(keola, 'give', 'Keola', { n: 99999 });
await keola.waitForTimeout(600);
ok((await S(keola)).aura < 99999 + 50000, 'other admins cannot use owner powers');

// Mute
await owner(beau, 'mute', 'Jess', { n: 10 });
await jess.waitForTimeout(400);
await jess.evaluate(() => window.__game().net.send({ t: 'chat', text: 'can anyone hear me' }));
ok(await until(jess, () => document.querySelector('#toasts')?.textContent.includes('muted')), 'muted Jess cannot chat');
await owner(beau, 'unmute', 'Jess');
ok(await until(jess, () => document.querySelector('#toasts')?.textContent.includes('unmuted')), 'unmute');

// Pull Jess to Beau (from her penthouse to the 1st floor)
ok((await jess.evaluate(() => window.__game().zoneId)) === 'jp', 'Jess starts in her penthouse');
await owner(beau, 'summon', 'Jess');
ok(await until(jess, () => window.__game().zoneId === 'f1' && !window.__game().transitioning), 'pull to me → Jess arrives on the 1st floor');
const [bp, jp] = [await beau.evaluate(() => [window.__game().pos.x, window.__game().pos.y]), await jess.evaluate(() => [window.__game().pos.x, window.__game().pos.y])];
ok(Math.hypot(bp[0] - jp[0], bp[1] - jp[1]) < 4, 'right next to Beau');
// Pull Ava (0 Aura) to a locked floor
await idle(beau);
await beau.evaluate(() => window.__game().travel('f24'));
await until(beau, () => window.__game().zoneId === 'f24' && !window.__game().transitioning);
await beau.waitForTimeout(500);
await owner(beau, 'summon', 'Ava');
ok(await until(ava, () => window.__game().zoneId === 'f24'), 'Beau can even pull Ava onto a floor she has not unlocked');
// Go to someone
await owner(beau, 'goto', 'Jess');
ok(await until(beau, () => window.__game().zoneId === 'f1' && !window.__game().transitioning), 'go to them → Beau jumps to Jess');

// Decorate Jess's room
await idle(beau);
await beau.evaluate(() => window.__game().visitRoom({ zone: 'jp', room: 'jess' }));
ok(await until(beau, () => window.__game().zoneId === 'jp' && !window.__game().transitioning), 'go to her room');
ok(await until(beau, () => document.querySelector('#actions')?.textContent.includes("Decorate Jess's room")), '"👑 Decorate Jess\'s room" button in her room');
await beau.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
await beau.click('#actions button:has-text("Decorate Jess")');
await beau.click('#decor .chip:has-text("Giant Teddy")');
await beau.click('#decor .decor-btns button:has-text("✓ Place")');
ok(await until(jess, () => window.__game().save.room.some((i) => i.item === 'd_teddy') && window.__game().save.inventory.d_teddy >= 1), "teddy placed in Jess's room (and given to her)");
await beau.evaluate(() => window.__game().net.send({ t: 'roomStyle', owner: 'Jess', style: { wall: '#ff00aa', floor: 'marble' } }));
ok(await until(jess, () => window.__game().save.roomStyle?.wall === '#ff00aa'), "change Jess's walls & floor");
await owner(beau, 'clearroom', 'Jess');
ok(await until(jess, () => window.__game().save.room.length === 0), 'clear her decorations');
await owner(beau, 'resetstyle', 'Jess');
ok(await until(jess, () => !window.__game().save.roomStyle), 'reset her walls & floor');
await jess.evaluate(() => window.__game().net.send({ t: 'room', owner: 'Ava', items: [] }));
await jess.evaluate(() => window.__game().net.send({ t: 'roomStyle', owner: 'Ava', style: { wall: '#000000' } }));
await jess.waitForTimeout(500);
ok(!(await S(ava)).roomStyle, "others can't edit someone else's room");

// New bedroom + kick
await owner(beau, 'newhome', 'Ava');
ok(await until(ava, () => /^r\d+$/.test(window.__game().save.home?.zone ?? '')), 'give Ava a new bedroom on a Residence floor');
await owner(beau, 'kick', 'Ava');
ok(await until(ava, () => document.querySelector('#login .panel')?.textContent.includes('Beau kicked you')), 'kick Ava out');
ok((await API('/api/check', { name: 'Ava' })).name === 'Ava', 'she can sign in again');

// UI
await beau.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
await beau.click('#b-accounts');
ok(await until(beau, () => document.querySelectorAll('.acct-actions .mini.owner').length > 3), '👑 Powers buttons on the Admin page');
await beau.click('.acct:has-text("Jess") .mini.owner');
ok(await until(beau, () => !!document.querySelector('.owner-tools select.owner-item option[value="fit_blossom"]')), 'Powers panel with every item');
await beau.screenshot({ path: 'shots/e2e15-powers.png' });
await keola.click('#b-accounts');
await keola.waitForTimeout(800);
ok(!(await keola.$('.mini.owner')), 'Keola does not get the Powers buttons');
await b.close();
