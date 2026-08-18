/**
 * Headless browser smoke test.
 * Builds nothing itself — run `npm run build` first (npm run verify does both).
 *
 * Checks the things a unit test can't: the page boots, there are zero console
 * errors, real key events move the ball, and a long random input burn-in never
 * throws or wedges the player inside geometry.
 */

import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../dist', import.meta.url));
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.map': 'application/json', '.svg': 'image/svg+xml', '.json': 'application/json',
};

function serve(port) {
  const server = createServer(async (req, res) => {
    try {
      const url = (req.url ?? '/').split('?')[0];
      let file = join(ROOT, normalize(url === '/' ? '/index.html' : url));
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      const s = await stat(file).catch(() => null);
      if (!s || s.isDirectory()) file = join(ROOT, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

const problems = [];
let checks = 0;
function check(name, cond, detail = '') {
  checks++;
  if (!cond) problems.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

const PORT = 4319;
const server = await serve(PORT);
// The sandbox ships a pinned Chromium; use it instead of downloading one.
const PINNED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(
  existsSync(PINNED) ? { executablePath: PINNED, args: ['--no-sandbox'] } : {},
);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => consoleErrors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });

  // The menu is the first thing a player sees; go through it like they would.
  await page.waitForSelector('#bc-practice', { timeout: 5000 });
  check('menu renders', await page.isVisible('#bc-practice'));
  check('menu offers a room code field', await page.isVisible('#bc-code'));
  await page.click('#bc-practice');

  await page.waitForFunction(() => !!window.__game, null, { timeout: 5000 });
  check('menu closes on practice', !(await page.isVisible('#bc-practice')));

  check('game boots', await page.evaluate(() => !!window.__game));
  check('canvas sized', await page.evaluate(() => {
    const c = document.getElementById('game');
    return c.width > 100 && c.height > 100;
  }));

  // --- movement responds to real key events -------------------------------
  const startX = await page.evaluate(() => window.__game.localPlayer.x);
  await page.keyboard.down('d');
  await page.waitForTimeout(500);
  await page.keyboard.up('d');
  const afterX = await page.evaluate(() => window.__game.localPlayer.x);
  check('holding D moves right', afterX > startX + 40, `${startX.toFixed(1)} -> ${afterX.toFixed(1)}`);

  await page.waitForTimeout(900);
  const restSpeed = await page.evaluate(() => Math.hypot(window.__game.localPlayer.vx, window.__game.localPlayer.vy));
  check('player comes to rest', restSpeed === 0, `speed ${restSpeed}`);

  // --- dash ---------------------------------------------------------------
  await page.keyboard.down('w');
  await page.keyboard.press('Space');
  await page.waitForTimeout(60);
  const dashState = await page.evaluate(() => {
    const p = window.__game.localPlayer;
    return { speed: Math.hypot(p.vx, p.vy), cd: p.dashCd };
  });
  await page.keyboard.up('w');
  check('space dashes', dashState.speed > 700, `speed ${dashState.speed.toFixed(0)}`);
  check('dash goes on cooldown', dashState.cd > 0.5, `cd ${dashState.cd.toFixed(2)}`);

  // --- gun ----------------------------------------------------------------
  // Put both on a known-clear lane so the check tests the gun, not the map.
  await page.evaluate(() => {
    const g = window.__game;
    const p = g.localPlayer;
    const d = g.world.players.get('dummy0');
    d.x = 750; d.y = 200; d.health = 100; d.alive = true; d.invuln = 0;
    p.x = 450; p.y = 200; p.vx = 0; p.vy = 0; p.invuln = 0;
  });
  const dummyScreen = await page.evaluate(() => {
    const g = window.__game;
    const d = g.world.players.get('dummy0');
    return { x: g.viewport.offsetX + d.x * g.viewport.scale, y: g.viewport.offsetY + d.y * g.viewport.scale };
  });
  await page.mouse.move(dummyScreen.x, dummyScreen.y);
  await page.waitForTimeout(60);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const midShot = await page.evaluate(() => window.__game.world.projectiles.length);
  await page.waitForTimeout(500);
  await page.mouse.up();
  const gun = await page.evaluate(() => {
    const g = window.__game;
    return { hp: g.world.players.get('dummy0').health, ammo: g.localPlayer.ammo };
  });
  check('clicking spawns projectiles', midShot > 0, `projectiles ${midShot}`);
  check('bullets damage the dummy', gun.hp < 100, `dummy hp ${gun.hp}`);
  check('ammo is consumed', gun.ammo < 12, `ammo ${gun.ammo}`);

  // --- sword --------------------------------------------------------------
  await page.evaluate(() => {
    const g = window.__game;
    const p = g.localPlayer;
    const d = g.world.players.get('dummy1');
    d.x = 450; d.y = 650; d.alive = true; d.health = 100; d.invuln = 0;
    p.x = d.x - 30; p.y = d.y; p.vx = 0; p.vy = 0; p.invuln = 0; p.swordCd = 0;
  });
  const dummy1Screen = await page.evaluate(() => {
    const g = window.__game;
    const d = g.world.players.get('dummy1');
    return { x: g.viewport.offsetX + d.x * g.viewport.scale, y: g.viewport.offsetY + d.y * g.viewport.scale };
  });
  await page.mouse.move(dummy1Screen.x, dummy1Screen.y);
  await page.waitForTimeout(60);
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  const swordKilled = await page.evaluate(() => !window.__game.world.players.get('dummy1').alive);
  check('sword one-shots at close range', swordKilled);

  // --- burn-in: random inputs for ~8 seconds of game time -----------------
  await page.evaluate(async () => {
    const codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyR'];
    const fire = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
    const held = new Set();
    const end = performance.now() + 8000;
    while (performance.now() < end) {
      const code = codes[(Math.random() * codes.length) | 0];
      if (held.has(code)) { fire('keyup', code); held.delete(code); }
      else { fire('keydown', code); held.add(code); }
      // Also hammer the mouse buttons and aim.
      const canvas = document.getElementById('game');
      const mk = (type, button) => canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, button, clientX: Math.random() * 1280, clientY: Math.random() * 720,
      }));
      mk('pointermove', 0);
      if (Math.random() < 0.5) mk('pointerdown', Math.random() < 0.5 ? 0 : 2);
      else window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }));
      await new Promise((r) => setTimeout(r, 40));
    }
    for (const c of held) fire('keyup', c);
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 2 }));
  });

  const final = await page.evaluate(() => {
    const g = window.__game;
    const p = g.localPlayer;
    const R = 16;
    let embedded = null;
    for (const w of g.world.map.walls) {
      const cx = Math.min(Math.max(p.x, w.x), w.x + w.w);
      const cy = Math.min(Math.max(p.y, w.y), w.y + w.h);
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < R - 0.5) embedded = { d, w };
    }
    return {
      x: p.x, y: p.y, vx: p.vx, vy: p.vy, tick: g.world.tick,
      embedded, w: g.world.map.width, h: g.world.map.height, fps: g.fps ?? null,
      projectiles: g.world.projectiles.length,
      events: g.world.events.length,
      health: p.health,
    };
  });

  check('sim kept ticking', final.tick > 500, `tick ${final.tick}`);
  check('position finite', Number.isFinite(final.x) && Number.isFinite(final.y));
  check('velocity finite', Number.isFinite(final.vx) && Number.isFinite(final.vy));
  check('inside arena', final.x > 0 && final.x < final.w && final.y > 0 && final.y < final.h,
    `(${final.x.toFixed(1)}, ${final.y.toFixed(1)})`);
  check('not embedded in a wall', final.embedded === null, JSON.stringify(final.embedded));
  check('projectiles are cleaned up', final.projectiles < 200, `${final.projectiles} live projectiles`);
  check('event queue is drained', final.events < 200, `${final.events} queued events`);
  check('health stays in range', final.health >= 0 && final.health <= 100, `hp ${final.health}`);
  check('frame rate holds up', final.fps === null || final.fps > 40, `fps ${final.fps}`);

  await page.screenshot({ path: fileURLToPath(new URL('../screenshot.png', import.meta.url)) });

  check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
} finally {
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error(`\n  ${checks - problems.length}/${checks} browser checks passed, ${problems.length} FAILED\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('');
  process.exit(1);
}
console.log(`\n  ✓ all ${checks} browser checks passed\n`);
