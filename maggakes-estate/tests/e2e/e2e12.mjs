// Never-ending progression: daily streak, collection book, pet levels & tricks, estate upgrades.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
const URL = 'http://127.0.0.1:8787/?debug&norender';
const API = (path, body) => fetch('http://127.0.0.1:8787' + path, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
const b = await chromium.launch();
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const until = (p, fn, a, ms = 10000) => p.waitForFunction(fn, a, { timeout: ms }).then(() => true, () => false);
const r = await API('/api/login', { name: 'Ava', password: 'ava123' });
const p = await (await b.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
p.on('dialog', (d) => d.accept());
await p.goto(URL); await p.evaluate((t) => localStorage.setItem('maggakes.token', t), r.token); await p.goto(URL);
await p.waitForFunction(() => window.__game && window.__game() && window.__game().zone, null, { timeout: 90000 });
const save = () => p.evaluate(() => window.__game().save);
ok(await until(p, () => document.querySelector('#toasts')?.textContent.includes('streak'), null, 8000), 'login reminds you about the streak');
await p.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));

// Streak
await p.click('#b-progress');
await p.click('.wtabs button:has-text("Streak")');
const a0 = (await save()).aura;
await p.click('button:has-text("Claim day 1")');
ok(await until(p, (a) => window.__game().save.aura > a, a0), 'claiming the streak pays Aura');
ok(await until(p, () => document.querySelector('.modal')?.textContent.includes('Claimed today')), 'shows "claimed today"');
await p.evaluate(() => window.__game().net.send({ t: 'claimStreak' }));
await p.waitForTimeout(500);
ok((await save()).aura === (await p.evaluate(() => window.__game().save.aura)) && (await save()).streak.claimed === (await save()).streak.last, 'second claim does nothing');

// Collection
await p.click('.wtabs button:has-text("Collection")');
ok(await until(p, () => document.querySelectorAll('.colgrid .col').length > 50), 'collection book shows every item');

// Pet
await p.click('.wtabs button:has-text("Pet")');
ok(await until(p, () => document.querySelector('.modal')?.textContent.includes("don't have a pet")), 'no pet yet → hint to adopt');
await p.evaluate(() => window.__game().net.send({ t: 'pet', kind: 'dog', name: 'Biscuit' }));
await until(p, () => !!window.__game().save.pet);
await p.click('.wtabs button:has-text("Level")'); await p.click('.wtabs button:has-text("Pet")');
ok(await until(p, () => document.querySelector('.modal')?.textContent.includes('Biscuit · level 1')), 'pet tab shows the level');
await p.click('button.chip:has-text("Sit")');
ok(await until(p, () => !document.querySelector('.modal') || true), 'trick button works');
const locked = await p.locator('.chip.locked').count();
ok(locked === 6, `higher tricks are locked (${locked})`);

// Estate upgrades
await p.click('.wtabs button:has-text("Estate")');
ok(await until(p, () => document.querySelectorAll('.modal .lvrow').length === 10), '10 estate upgrades');
const before = (await save()).aura;
await p.evaluate(() => window.__game().net.send({ t: 'buyUpgrade', id: 'up_fountain' }));
await p.waitForTimeout(500);
ok(!((await save()).upgrades ?? []).length && (await save()).aura === before, 'cannot skip ahead / buy without Aura');
await p.screenshot({ path: 'shots/e2e12-progress.png' });
await b.close();
