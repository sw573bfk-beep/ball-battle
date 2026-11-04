// End-to-end test: real browsers against `npm run dev` (wrangler dev on :8787).
// Covers sign up, paste-import, AI generate (mocked locally), all 3 game modes, coins, shop, locker.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8787';
const SHOTS = 'test-shots';
fs.mkdirSync(SHOTS, { recursive: true });

const ANSWERS = { 'Capital of France?': 'Paris', 'What is 2 + 2?': '4', 'Largest planet?': 'Jupiter', 'Water freezes at?': '0°C' };
const PASTE = `Here you go!

1. Capital of France?
A) London
B) Paris
C) Rome
D) Berlin
Answer: B

2. What is 2 + 2?
A) 3
B) 5
C) 4
Answer: C

3. Largest planet?
a) Earth
b) Jupiter
c) Mars
d) Venus
Correct answer: b

4. Water freezes at?
- 100°C
- 0°C ✓
- 50°C`;

const uid = Date.now().toString(36).slice(-5);
const errors = [];
const browser = await chromium.launch();
const step = (s) => console.log('·', s);

async function newPage(name, viewport = { width: 420, height: 820 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|WebSocket/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
  return page;
}
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });

async function signupUi(page, username) {
  await page.goto(`${BASE}/#/signup`);
  await page.fill('input[name=username]', username);
  await page.fill('input[name=password]', 'password1');
  await page.click('form#auth button');
  await page.waitForURL(/#\/sets/);
}

async function joinGame(page, pin, name) {
  await page.goto(`${BASE}/#/play/${pin}`);
  await page.waitForSelector('#nick');
  await page.fill('#nick', name);
  await page.click('#nameform button');
  await page.waitForSelector('.p-wait');
}

async function answerRight(page) {
  await page.waitForSelector('.pq-text');
  const q = (await page.textContent('.pq-text')).trim();
  const right = ANSWERS[q];
  assert.ok(right, `unknown question ${q}`);
  await clickAnswer(page, (t) => t === right);
}
async function answerWrong(page) {
  await page.waitForSelector('.pq-text');
  const q = (await page.textContent('.pq-text')).trim();
  await clickAnswer(page, (t) => t !== ANSWERS[q]);
}
async function clickAnswer(page, test) {
  const btns = page.locator('.answer-grid .ans');
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    const t = (await btns.nth(i).evaluate((el) => el.lastChild.textContent)).trim();
    if (test(t)) return btns.nth(i).click();
  }
  throw new Error('no matching answer');
}

try {
  // ------------------------------------------------------------- host account + set
  const host = await newPage('host', { width: 1280, height: 800 });
  step('home page');
  await host.goto(BASE);
  await host.waitForSelector('.join-card');
  await shot(host, '01-home');

  step('sign up host');
  await signupUi(host, `host_${uid}`);
  assert.match(await host.textContent('.nav'), /100/);

  step('create set by pasting AI output');
  await host.click('a[href="#/new"]');
  await host.waitForSelector('#paste');
  await host.fill('#title', 'E2E Test Set');
  await host.fill('#p-topic', 'general knowledge');
  await host.fill('#paste', PASTE);
  await host.waitForFunction(() => document.querySelector('#paste-status').textContent.includes('Found 4'));
  await shot(host, '02-editor-paste');
  await host.click('#add-paste');
  await host.waitForSelector('.qcard');
  assert.equal(await host.locator('.qcard').count(), 4);
  assert.equal(await host.locator('.qcard.invalid').count(), 0);

  step('built-in AI generate (mock)');
  await host.click('.tab[data-tab=gen]');
  await host.fill('#g-topic', 'space');
  await host.selectOption('#g-count', '5');
  await host.click('#gen');
  await host.waitForFunction(() => document.querySelectorAll('.qcard').length === 9);
  // remove the 5 mock questions again so games only use known answers
  for (let i = 0; i < 5; i++) await host.locator('.qcard').last().locator('[data-act=del]').click();
  assert.equal(await host.locator('.qcard').count(), 4);

  step('flashcards');
  await host.click('.tab[data-tab=cards]');
  await host.fill('#cards', 'Perro - Dog\nGato - Cat\nPez - Fish');
  await host.click('#add-cards');
  assert.equal(await host.locator('.qcard').count(), 7);
  for (let i = 0; i < 3; i++) await host.locator('.qcard').last().locator('[data-act=del]').click();

  step('save set');
  await host.click('#save');
  await host.waitForFunction(() => document.querySelector('#save-status').textContent.includes('Saved'));
  await shot(host, '03-editor-saved');
  const setId = (await host.url()).match(/edit\/(\d+)/)[1];

  // ------------------------------------------------------------- players
  const p1 = await newPage('p1');
  await signupUi(p1, `alice_${uid}`);
  const p2 = await newPage('p2'); // guest
  const p3 = await newPage('p3');
  await signupUi(p3, `bob_${uid}`);

  async function hostGame(mode, opts = {}) {
    await host.goto(`${BASE}/#/host-setup/${setId}`);
    await host.waitForSelector('.mode-grid');
    await host.click(`.mode-card.mode-${mode}`);
    if (opts.minutes) await host.selectOption('#o-minutes', String(opts.minutes));
    if (opts.goal !== undefined) await host.selectOption('#o-goal', String(opts.goal));
    if (mode === 'classic') await shot(host, '04-host-setup');
    await host.click('#go');
    await host.waitForSelector('.big-pin');
    return (await host.textContent('.big-pin')).replace(/\s/g, '');
  }

  // ------------------------------------------------------------- Live Quiz
  step('classic: create + join');
  let pin = await hostGame('classic');
  await joinGame(p1, pin, 'Alice');
  await joinGame(p2, pin, 'Guesty');
  await joinGame(p3, pin, 'Bob');
  await host.waitForFunction(() => document.querySelectorAll('.lobby-p').length === 3);
  await shot(host, '05-host-lobby');
  await shot(p1, '06-player-lobby');
  await host.click('#start');
  for (let q = 0; q < 4; q++) {
    step(`classic: question ${q + 1}`);
    await host.waitForSelector('.hq-text', { timeout: 10000 });
    await answerRight(p1);
    if (q === 0) await shot(p2, '07-player-question');
    await answerWrong(p2);
    if (q === 0) await shot(host, '08-host-question');
    await answerRight(p3);
    await host.waitForSelector('.bars', { timeout: 10000 });
    await p1.waitForSelector('.p-result');
    if (q === 0) { await shot(host, '09-host-reveal'); await shot(p1, '10-player-correct'); await shot(p2, '11-player-wrong'); }
    await host.click('#next');
    if (q < 3) {
      await host.waitForSelector('.hboard');
      if (q === 0) await shot(host, '12-host-leaderboard');
      await host.click('#next');
    }
  }
  await host.waitForSelector('.podium-screen');
  await p1.waitForSelector('.p-end');
  await p2.waitForSelector('.p-end');
  await host.waitForTimeout(1500);
  await shot(host, '13-host-podium');
  await shot(p1, '14-player-end');
  assert.match(await p2.textContent('.p-end'), /free account/);
  const p1Coins = Number((await p1.textContent('.coins-earned')).match(/\d+/)[0]);
  assert.ok(p1Coins > 5, 'p1 earned coins');

  // ------------------------------------------------------------- Cash Race
  step('race: play + upgrade');
  pin = await hostGame('race', { minutes: 3, goal: 0 });
  await joinGame(p1, pin, 'Alice');
  await joinGame(p3, pin, 'Bob');
  await host.waitForFunction(() => document.querySelectorAll('.lobby-p').length === 2);
  await host.click('#start');
  await host.waitForSelector('.live-board');
  for (let i = 0; i < 12; i++) {
    await answerRight(p1);
    await p1.waitForSelector('.p-result');
  }
  await answerWrong(p3);
  await p3.waitForSelector('.p-result.bad');
  await p1.waitForSelector('#shopbtn');
  await p1.click('#shopbtn');
  await p1.waitForSelector('.upgrade');
  await shot(p1, '15-player-race-shop');
  await p1.click('[data-buy=income]');
  await p1.waitForFunction(() => document.querySelector('.upgrade .lvl').textContent.includes('Lv 2'));
  await p1.click('[data-close]');
  await host.waitForFunction(() => document.querySelectorAll('.live-board li').length === 2);
  await shot(host, '16-host-race-live');
  await host.click('#endb');
  await host.click('.modal [data-yes]');
  await host.waitForSelector('.podium-screen');
  await p1.waitForSelector('.p-end');

  // ------------------------------------------------------------- Treasure Steal
  step('gold: chests + steal');
  pin = await hostGame('gold', { minutes: 3, goal: 0 });
  await joinGame(p1, pin, 'Alice');
  await joinGame(p3, pin, 'Bob');
  await host.waitForFunction(() => document.querySelectorAll('.lobby-p').length === 2);
  await host.click('#start');
  let stole = false;
  for (let i = 0; i < 25 && !stole; i++) {
    const p = i % 2 ? p3 : p1;
    await answerRight(p);
    await p.waitForSelector('.chests button.chest');
    if (i === 0) await shot(p, '17-player-chests');
    await p.locator('.chests button.chest').first().click();
    await p.waitForSelector('.chests.revealed');
    if (await p.locator('.targets').count()) {
      await shot(p, '18-player-steal');
      await p.locator('.target').first().click();
      await p.waitForSelector('.p-result.good');
      stole = true;
    }
    await p.click('#nextq');
  }
  await shot(host, '19-host-gold-live');
  await host.click('#endb');
  await host.click('.modal [data-yes]');
  await host.waitForSelector('.podium-screen');

  // ------------------------------------------------------------- shop + locker
  step('shop + locker');
  await p1.goto(`${BASE}/#/shop`);
  await p1.waitForSelector('.box-card');
  await shot(p1, '20-shop');
  await p1.click('[data-open=snack]');
  await p1.waitForSelector('.open-result:not(.hidden)', { timeout: 5000 });
  await shot(p1, '21-box-open');
  await p1.click('.modal [data-close]');
  await p1.goto(`${BASE}/#/locker`);
  await p1.waitForSelector('.skin-card');
  const owned = await p1.locator('.skin-card:not(.locked):not(.equipped)').first();
  await owned.click();
  await p1.waitForTimeout(500);
  await shot(p1, '22-locker');

  step('discover + dashboard');
  await host.goto(`${BASE}/#/sets`);
  await host.waitForSelector('.set-card');
  await shot(host, '23-dashboard');

  if (errors.length) throw new Error('Browser errors:\n' + errors.join('\n'));
  console.log('e2e: all flows passed');
} finally {
  await browser.close();
}
