// Beau can pause the whole game ($15 deadline). Everyone else gets the paused screen, Beau keeps
// playing, and when Beau unpauses everyone's game comes back by itself.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
const BASE = 'http://127.0.0.1:8787';
const URL = BASE + '/?debug&norender';
const API = (path, body) => fetch(BASE + path, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
const b = await chromium.launch();
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const until = (p, fn, a, ms = 10000) => p.waitForFunction(fn, a, { timeout: ms }).then(() => true, () => false);
const join = async (name, pw) => {
  const r = await API('/api/login', { name, password: pw });
  const p = await (await b.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
  p.on('dialog', (d) => d.accept());
  await p.goto(URL); await p.evaluate((t) => localStorage.setItem('maggakes.token', t), r.token); await p.goto(URL);
  await p.waitForFunction(() => window.__game && window.__game() && window.__game().zone, null, { timeout: 90000 });
  await p.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
  return p;
};
const pausedScreen = (p) => until(p, () => { const t = document.querySelector('#login .paused-box')?.textContent ?? ''; return t.includes('$15') && t.includes('Keola and Milla') && t.includes('Anyone can pay'); }, null, 15000);

ok((await (await fetch(BASE + '/api/status')).json()).paused === false, 'a brand-new estate is not paused');
const beau = await join('Beau', 'beau12');
const jess = await join('Jess', 'jess12');
const keola = await join('Keola', 'keola1');

// Only Beau has the pause button, and only Beau can pause
await beau.click('#b-accounts');
ok(await until(beau, () => !!document.querySelector('.pausebox button')), 'Beau sees the ⏸️ Pause button on the Admin page');
await keola.click('#b-accounts');
await keola.waitForTimeout(800);
ok(!(await keola.$('.pausebox')), 'Keola (admin) does not');
await keola.evaluate(() => window.__game().net.send({ t: 'pause', on: true }));
await keola.waitForTimeout(600);
ok((await (await fetch(BASE + '/api/status')).json()).paused === false, 'Keola cannot pause the game');

// Beau pauses
await beau.click('.pausebox button');
ok(await pausedScreen(jess), 'Jess is sent to the paused screen ($15 to Beau, talk to Keola and Milla, anyone can pay)');
ok(await pausedScreen(keola), 'Keola too');
await jess.screenshot({ path: 'shots/e2e13-paused.png' });
ok(await until(beau, () => document.querySelector('.pausebox')?.textContent.includes('PAUSED')), 'Beau sees "The game is PAUSED"');
await beau.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
ok(await beau.evaluate(() => !!window.__game().zone && document.querySelector('#login').classList.contains('gone')), 'Beau keeps playing');
const st = await (await fetch(BASE + '/api/status')).json();
ok(st.paused && st.text.includes('$15'), '/api/status says paused');
ok((await API('/api/check', { name: 'Jess' })).paused && (await API('/api/login', { name: 'Jess', password: 'jess12' })).paused, 'Jess cannot sign in');
ok((await API('/api/check', { name: 'NewKid' })).paused, 'nobody new can sign up');
ok(!(await API('/api/check', { name: 'beau' })).paused, 'Beau can still sign in');
const fresh = await (await b.newContext()).newPage();
await fresh.goto(URL);
ok(await pausedScreen(fresh), 'a new visitor sees the paused screen straight away');
await fresh.click('button.link:has-text("Beau? Sign in")');
ok(await until(fresh, () => !!document.querySelector('#login input')), '"Beau? Sign in" shows the sign-in box');
await jess.reload();
ok(await pausedScreen(jess), 'reloading does not get around it');

// Beau unpauses → games come back by themselves
await beau.evaluate(() => window.__game().net.send({ t: 'pause', on: false }));
ok(await until(jess, () => window.__game && window.__game() && window.__game().zone, null, 40000), 'Jess is back in the game automatically after unpausing');
ok((await (await fetch(BASE + '/api/status')).json()).paused === false, 'status says running');
await b.close();
