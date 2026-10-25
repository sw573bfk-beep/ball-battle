/**
 * Headless smoke test: serve the production build, play a few seconds on a
 * desktop and an emulated phone, and fail on any page error.
 *
 * Run `npm run build` first. Screenshots go to $SHOTS_DIR (default: tests/shots).
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const shots = process.env.SHOTS_DIR ?? fileURLToPath(new URL('./shots/', import.meta.url));
await mkdir(shots, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  if (!path || path === '.' || path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const errors = [];
const browser = await chromium.launch();
const fail = (msg) => { errors.push(msg); };

const state = (page) => page.evaluate(() => {
  const g = window.game;
  const me = g.world.players.find((p) => p.id === g.localId);
  return { phase: g.world.phase, x: me.x, y: me.y, throwCd: me.throwCd, players: g.world.players.length, tick: g.world.tick };
});

try {
  // ---------------------------------------------------------------- desktop
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => fail(`desktop pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && fail(`desktop console: ${m.text()}`));
    await page.goto(url);
    await page.screenshot({ path: join(shots, 'menu.png') });
    await page.click('#play');
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(shots, 'countdown.png') });
    await page.waitForFunction(() => window.game.world.phase === 'playing', null, { timeout: 6000 });
    const a = await state(page);
    await page.mouse.move(1000, 360);
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(700);
    await page.keyboard.up('KeyD');
    await page.keyboard.press('Space');
    await page.waitForTimeout(50);
    const b = await state(page);
    if (!(b.x > a.x + 50)) fail(`desktop: holding D should move right (${a.x} -> ${b.x})`);
    if (!(b.throwCd > 0)) fail('desktop: Space should throw a sword');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: join(shots, 'desktop.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    if (await page.isHidden('#pause')) fail('desktop: Esc should pause');
    const t1 = (await state(page)).tick;
    await page.waitForTimeout(300);
    if ((await state(page)).tick !== t1) fail('desktop: sim should stop while paused');
    await page.click('#resume');
    // Fast-forward to the end to check the results screen.
    await page.evaluate(() => { window.game.world.clock = 0.05; });
    await page.waitForSelector('#results:not([hidden])', { timeout: 5000 });
    await page.screenshot({ path: join(shots, 'results.png') });
    await page.close();
  }

  // ------------------------------------------------------------------ phone
  {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => fail(`phone pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && fail(`phone console: ${m.text()}`));
    await page.goto(url);
    await page.screenshot({ path: join(shots, 'phone-menu.png') });
    await page.tap('#play');
    await page.waitForFunction(() => window.game.world.phase === 'playing', null, { timeout: 6000 });
    const a = await state(page);

    const cdp = await ctx.newCDPSession(page);
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    // Left stick: press and drag right, hold.
    await touch('touchStart', [{ x: 150, y: 300, id: 1 }]);
    for (let i = 1; i <= 5; i++) await touch('touchMove', [{ x: 150 + i * 14, y: 300, id: 1 }]);
    await page.waitForTimeout(700);
    // Right stick: drag to aim, screenshot mid-aim, release to throw.
    await touch('touchStart', [{ x: 220, y: 300, id: 1 }, { x: 650, y: 280, id: 2 }]);
    for (let i = 1; i <= 4; i++) await touch('touchMove', [{ x: 220, y: 300, id: 1 }, { x: 650 + i * 12, y: 280 - i * 6, id: 2 }]);
    await page.screenshot({ path: join(shots, 'phone.png') });
    await touch('touchEnd', []);
    await page.waitForTimeout(50);
    const b = await state(page);
    if (!(b.x > a.x + 40)) fail(`phone: left stick should move right (${a.x} -> ${b.x})`);
    if (!(b.throwCd > 0)) fail('phone: releasing the aim stick should throw');
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (errors.length) {
  console.error(errors.map((e) => `  FAIL ${e}`).join('\n'));
  process.exit(1);
}
console.log(`browser smoke test ok — screenshots in ${shots}`);
