// Staff Chat: admins + VIPs only. People are added when they become VIP/admin
// and kicked out when they lose it.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
const URL = 'http://127.0.0.1:8787/?debug&norender';
const API = (path, body) => fetch('http://127.0.0.1:8787' + path, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
const b = await chromium.launch();
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const join = async (name, pw) => {
  const r = await API('/api/login', { name, password: pw });
  const p = await (await b.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
  p.on('dialog', (d) => d.accept());
  await p.goto(URL); await p.evaluate((t) => localStorage.setItem('maggakes.token', t), r.token); await p.goto(URL);
  await p.waitForFunction(() => window.__game && window.__game() && window.__game().zone, null, { timeout: 90000 });
  await p.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
  return p;
};
const until = (p, fn, a, ms = 10000) => p.waitForFunction(fn, a, { timeout: ms }).then(() => true, () => false);
const visible = (p) => p.evaluate(() => document.querySelector('#b-staff').style.display !== 'none');

const keola = await join('Keola', 'keola1');   // admin
const milla = await join('Milla', 'milla1');   // admin
const jess = await join('Jess', 'jess12');     // normal player
await keola.waitForTimeout(800);
ok(await visible(keola) && await visible(milla), 'admins have the 💬 Staff button');
ok(!(await visible(jess)), 'a normal player does not');

// Admins chat live
await keola.click('#b-staff');
await keola.fill('.staff-in', 'Hello staff! 👋');
await keola.press('.staff-in', 'Enter');
ok(await until(keola, () => document.querySelector('.staff-list')?.textContent.includes('Hello staff!')), 'Keola sees her own message');
ok(await until(milla, () => window.__game().staffChat.rows.some((m) => m.text.includes('Hello staff!'))), 'Milla receives it live');
ok(await until(milla, () => document.querySelector('#b-staff .badge')?.textContent === '1'), 'Milla gets an unread badge');

// A normal player can't sneak in
await jess.evaluate(() => window.__game().net.send({ t: 'staff', text: 'can I see?' }));
await jess.evaluate(() => window.__game().net.send({ t: 'staff?' }));
await keola.waitForTimeout(600);
ok(!(await keola.evaluate(() => window.__game().staffChat.rows.some((m) => m.text.includes('can I see')))), "a normal player's message is refused");
ok(!(await jess.evaluate(() => window.__game().staffChat.rows.length)), 'and they get no history');

// Becoming VIP adds you
await keola.evaluate(() => window.__game().net.send({ t: 'admin', action: 'vip', target: 'Jess' }));
ok(await until(jess, () => document.querySelector('#b-staff').style.display !== 'none'), 'given VIP → Jess gets the Staff button');
ok(await until(keola, () => document.querySelector('.staff-list')?.textContent.includes('Jess joined the Staff Chat')), '"Jess joined the Staff Chat" appears');
await jess.click('#b-staff');
ok(await until(jess, () => document.querySelector('.staff-list')?.textContent.includes('Hello staff!')), 'Jess can read the earlier messages');
await jess.fill('.staff-in', 'Thanks for VIP!');
await jess.press('.staff-in', 'Enter');
ok(await until(keola, () => document.querySelector('.staff-list')?.textContent.includes('Thanks for VIP!')), 'Jess can post');
await jess.screenshot({ path: 'shots/e2e10-staff.png' });

// Losing VIP kicks you
await keola.evaluate(() => window.__game().net.send({ t: 'admin', action: 'unvip', target: 'Jess' }));
ok(await until(jess, () => document.querySelector('#b-staff').style.display === 'none' && !document.querySelector('.staff-list')), 'VIP removed → Jess is kicked (button gone, chat closed)');
ok(await until(keola, () => document.querySelector('.staff-list')?.textContent.includes('Jess was removed from the Staff Chat')), '"Jess was removed" appears');
await keola.fill('.staff-in', 'secret staff stuff');
await keola.press('.staff-in', 'Enter');
await jess.waitForTimeout(800);
ok(!(await jess.evaluate(() => window.__game().staffChat.rows.some((m) => m.text.includes('secret')))), 'Jess no longer gets new messages');

// Becoming an admin adds you too; losing admin kicks you
await keola.evaluate(() => window.__game().net.send({ t: 'admin', action: 'admin', target: 'Jess' }));
ok(await until(jess, () => document.querySelector('#b-staff').style.display !== 'none'), 'made admin → added');
await keola.evaluate(() => window.__game().net.send({ t: 'admin', action: 'unadmin', target: 'Jess' }));
ok(await until(jess, () => document.querySelector('#b-staff').style.display === 'none'), 'admin taken away → kicked');

await b.close();
