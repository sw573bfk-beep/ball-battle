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
const pausedScreen = (p, want = 'Back soon', ms = 15000) => until(p, (w) => (document.querySelector('#login .paused-box')?.textContent ?? '').includes(w), want, ms);
const MSG = 'Back soon! Fixing the pool 🏊';

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

// Beau writes a message and pauses
ok(await beau.$eval('.pausemsg', (t) => t.value.includes('$15')), 'the message box starts with the $15 message');
await beau.fill('.pausemsg', MSG);
await beau.click('.pausebox button:has-text("Pause the game")');
ok(await pausedScreen(jess, MSG), "Jess is sent to the paused screen showing Beau's message");
ok(!(await jess.$('.paused-box .pay')), 'no $15 badge on a custom message');
ok(await pausedScreen(keola), 'Keola too');
await jess.screenshot({ path: 'shots/e2e13-paused.png' });
ok(await until(beau, () => document.querySelector('.pausebox')?.textContent.includes('PAUSED')), 'Beau sees "The game is PAUSED"');
await beau.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
ok(await beau.evaluate(() => !!window.__game().zone && document.querySelector('#login').classList.contains('gone')), 'Beau keeps playing');
const st = await (await fetch(BASE + '/api/status')).json();
ok(st.paused && st.text === MSG, '/api/status says paused with the message');
ok((await API('/api/check', { name: 'Jess' })).paused && (await API('/api/login', { name: 'Jess', password: 'jess12' })).paused, 'Jess cannot sign in');
const nk = await API('/api/check', { name: 'NewKid' });
ok(!nk.paused && nk.isNew, 'new people can still sign up while paused');
ok((await API('/api/login', { name: 'NewKid', password: 'newkid1' })).pending, '...and wait for approval');
ok((await API('/api/login', { name: 'NewKid', password: 'newkid1' })).pending, 'still waiting (not the paused screen)');
await beau.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
await beau.click('#b-accounts');
ok(await until(beau, () => document.querySelector('.pending')?.textContent.includes('NewKid')), 'NewKid shows in "Waiting for approval"');
await beau.click('.acct.pend:has-text("NewKid") button:has-text("Approve & let play")');
ok(await until(beau, () => [...document.querySelectorAll('.allow-chip')].some((c) => c.textContent.includes('NewKid')), null, 15000), '"✅ Approve & let play" → approved and on the play list');
ok(!!(await API('/api/login', { name: 'NewKid', password: 'newkid1' })).token, 'NewKid can sign in and play while paused');
await beau.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
ok(!(await API('/api/check', { name: 'beau' })).paused, 'Beau can still sign in');
const fresh = await (await b.newContext()).newPage();
await fresh.goto(URL);
ok(await pausedScreen(fresh), 'a new visitor sees the paused screen straight away');
await fresh.click('button.link:has-text("Beau? Sign in")');
ok(await until(fresh, () => !!document.querySelector('#login input')), '"Beau? Sign in" shows the sign-in box');
await jess.reload();
ok(await pausedScreen(jess), 'reloading does not get around it');

// Beau changes the message while paused → everyone's screen updates
await beau.click('#b-accounts');
await until(beau, () => !!document.querySelector('.pausemsg'));
await beau.click('.pausebox button:has-text("Use the $15 message")');
await beau.click('.pausebox button:has-text("Update message")');
ok(await pausedScreen(jess, 'Keola and Milla', 30000), 'Jess sees the new message without reloading');
ok(await until(jess, () => !!document.querySelector('.paused-box .pay')), 'the $15 message shows the 💵 $15 badge');
await jess.screenshot({ path: 'shots/e2e13-paused15.png' });
await beau.evaluate(() => window.__game().net.send({ t: 'pause', on: true, text: '<b>hi</b>' + 'x'.repeat(600) }));
await beau.waitForTimeout(500);
const st2 = await (await fetch(BASE + '/api/status')).json();
ok(!st2.text.includes('<') && st2.text.length <= 400, 'messages are cleaned and kept short');

// The "Who can play while paused" list at the top of the Admin page
await beau.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
await beau.click('#b-accounts');
ok(await until(beau, () => document.querySelector('.allowbox')?.textContent.includes('Who can play while paused')), '"🔓 Who can play while paused" section on the Admin page');
await beau.selectOption('.allowbox select.allow-pick', 'Milla');
ok(await until(beau, () => [...document.querySelectorAll('.allow-chip')].some((c) => c.textContent.includes('Milla'))), 'pick Milla → she is on the list');
ok(!(await API('/api/check', { name: 'Milla' })).paused, 'Milla can sign in while paused');
ok(await until(beau, () => /and \d+ unlocked/.test(document.querySelector('.pausebox b')?.textContent ?? '')), 'headline counts unlocked people');
await beau.click('.allow-chip:has-text("Milla") button');
ok(await until(beau, () => ![...document.querySelectorAll('.allow-chip')].some((c) => c.textContent.includes('Milla'))), '✖ removes her');
ok((await API('/api/check', { name: 'Milla' })).paused, 'and she is locked out again');
await beau.screenshot({ path: 'shots/e2e13-allow.png' });
await beau.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));

// Beau unlocks Keola while paused → she can play; locking her again kicks her back out
await beau.evaluate(() => window.__game().net.send({ t: 'pauseAllow', target: 'Keola', on: true }));
await beau.click('#b-accounts');
ok(await until(beau, () => document.querySelector('.acct-list')?.textContent.includes('Plays while paused') && [...document.querySelectorAll('.allow-chip')].some((c) => c.textContent.includes('Keola'))), 'Admin page shows Keola as "🔓 Plays while paused"');
await beau.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
ok(!(await API('/api/check', { name: 'Keola' })).paused && (await API('/api/check', { name: 'Jess' })).paused, 'Keola can sign in, Jess still cannot');
await keola.reload();
ok(await until(keola, () => window.__game && window.__game() && window.__game().zone, null, 40000), 'Keola plays while the game is paused');
await jess.evaluate(() => window.__game?.()?.net.send({ t: 'pauseAllow', target: 'Jess', on: true }));
ok((await API('/api/check', { name: 'Jess' })).paused, 'nobody but Beau can unlock people');
await beau.evaluate(() => window.__game().net.send({ t: 'pauseAllow', target: 'Keola', on: false }));
ok(await pausedScreen(keola, 'Game paused', 30000), 'locking Keola again sends her to the paused screen');
await beau.evaluate(() => window.__game().net.send({ t: 'pauseAllow', target: 'Keola', on: true }));

// Beau unpauses → games come back by themselves
await beau.evaluate(() => window.__game().net.send({ t: 'pause', on: false }));
ok(await until(jess, () => window.__game && window.__game() && window.__game().zone, null, 40000), 'Jess is back in the game automatically after unpausing');
ok((await (await fetch(BASE + '/api/status')).json()).paused === false, 'status says running');
ok(!(await API('/api/check', { name: 'Keola' })).paused, 'unlocked people still fine after unpausing');
await b.close();
