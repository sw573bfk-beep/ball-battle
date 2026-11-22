import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const URL = 'http://127.0.0.1:8787/?debug&norender';
const API = (path, body) => fetch('http://127.0.0.1:8787' + path, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const page = async () => { const p = await (await b.newContext({ viewport: { width: 1100, height: 700 } })).newPage(); p.on('pageerror', (e) => errs.push(String(e))); await p.goto(URL); return p; };
const until = async (p, fn, a, ms = 30000) => { try { await p.waitForFunction(fn, a, { timeout: ms }); return true; } catch { return false; } };

// 1. Coco signs up through the UI
const coco = await page();
await coco.fill('#login input', 'Coco_22');
await coco.click('#login .btn');
await coco.waitForSelector('text=Make a password for your new account');
const pw = coco.locator('#login input[type=password]');
await pw.nth(0).fill('coco1234'); await pw.nth(1).fill('coco1234');
await coco.click('#login .btn');
ok(await until(coco, () => document.body.innerText.includes('Waiting for approval')), 'new player sees "Waiting for approval"');
const bad = await API('/api/check', { name: 'no spaces allowed' });
ok(!!bad.invalid, `bad usernames refused ("${bad.invalid}")`);

// 2. Beau (admin) sees the notification and approves
const rb = await API('/api/login', { name: 'Beau', password: 'beau12' });
const beau = await page();
await beau.evaluate((t) => localStorage.setItem('maggakes.token', t), rb.token);
await beau.goto(URL);
await until(beau, () => window.__game && window.__game(), null, 90000);
ok(await until(beau, () => document.querySelector('#b-accounts .badge')?.textContent === '1'), 'Beau sees a "1" badge on the Admin button');
await beau.click('#b-accounts');
ok(await until(beau, () => document.body.innerText.toLowerCase().includes('waiting for approval (1)')), 'Accounts page lists Coco_22 as waiting');
await beau.click('.acct.pend button:has-text("Approve")');
ok(await until(beau, () => !document.querySelector('.acct.pend')), 'Beau approved Coco_22');

// 3. Coco checks again and moves in to Residence 1
await coco.click('text=Check again');
ok(await until(coco, () => window.__game && window.__game() && window.__game().zoneId === 'r1', null, 90000), 'Coco_22 enters the game on her new floor, Residence 1');
ok(await coco.evaluate(() => window.__game().zone.rooms.find((r) => r.id === 'a').name === "Coco_22's Bedroom"), 'her bedroom is labelled "Coco_22\'s Bedroom"');
await coco.evaluate(() => { const g = window.__game(); const b = g.zone.rooms.find((r) => r.id === 'a').box; g.pos.set((b.x0 + b.x1) / 2, b.z1 - 2); });
await coco.waitForTimeout(500);
ok((await coco.textContent('#actions')).includes('Decorate my room'), 'she can decorate her own bedroom');
ok(!(await coco.isVisible('#b-accounts')), 'regular players do not see the Admin button');

// 4. Second newcomer shares Residence 1
const zed = await API('/api/login', { name: 'Zed', password: 'zedzed' });
ok(zed.pending, 'second sign-up (Zed) is pending');
await beau.evaluate(() => window.__game().net.send({ t: 'admin', action: 'approve', target: 'Zed' }));
ok(await until(coco, () => window.__game() && (window.__game().zone.layout.props.length > 0) && JSON.stringify(window.__dbg ? 1 : 1) && true), 'ok');
await coco.evaluate(() => window.__game().travel('r1'));
await coco.waitForTimeout(2500);
ok(await coco.evaluate(() => window.__game().zone.rooms.find((r) => r.id === 'b').name === "Zed's Bedroom"), 'Zed moves into the other bedroom on Residence 1');
await coco.click('#b-map');
ok(await until(coco, () => document.body.innerText.includes('Bedrooms: Coco_22 & Zed')), 'map shows Residence 1 with both names');
await coco.keyboard.press('Escape');

// 5. VIP can see all accounts but not change them
await beau.evaluate(() => window.__game().net.send({ t: 'admin', action: 'vip', target: 'Coco_22' }));
ok(await until(coco, () => getComputedStyle(document.querySelector('#b-accounts')).display !== 'none'), 'after VIP, Coco sees the accounts button');
await coco.click('#b-accounts');
ok(await until(coco, () => document.body.innerText.toLowerCase().includes('all accounts')), 'VIP can see all accounts');
ok((await coco.locator('.acct-actions button').count()) === 0, 'VIP has no admin buttons');
await coco.keyboard.press('Escape');

// 6. Make admin / ban
await beau.evaluate(() => window.__game().net.send({ t: 'admin', action: 'admin', target: 'Coco_22' }));
ok(await until(coco, () => window.__game().admin === true), 'Beau made Coco_22 an admin');
await coco.evaluate(() => window.__game().net.send({ t: 'admin', action: 'ban', target: 'Beau' }));
await coco.waitForTimeout(800);
ok(await beau.evaluate(() => !!window.__game()), 'other admins cannot ban Beau (main admin)');
await beau.evaluate(() => window.__game().net.send({ t: 'admin', action: 'ban', target: 'Zed' }));
await beau.waitForTimeout(800);
const zed2 = await API('/api/login', { name: 'Zed', password: 'zedzed' });
ok(zed2.banned, 'banned player cannot sign in');
const kick = await API('/api/check', { name: 'Bob' });
ok(kick.isNew, 'any free name can sign up now (no more "kicked")');
console.log('page errors:', errs.slice(0, 5));
await b.close();
