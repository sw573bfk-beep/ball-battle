/**
 * End-to-end multiplayer test: two real browsers, one real Durable Object.
 * Requires `wrangler dev` on 127.0.0.1:8787 and a fresh `npm run build`.
 */

import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../dist', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const PORT = 4320;

function serve() {
  const server = createServer(async (req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    let file = join(ROOT, normalize(url === '/' ? '/index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    const s = await stat(file).catch(() => null);
    if (!s || s.isDirectory()) file = join(ROOT, 'index.html');
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  });
  return new Promise((r) => server.listen(PORT, () => r(server)));
}

let checks = 0;
const problems = [];
function check(name, cond, detail = '') {
  checks++;
  if (!cond) problems.push(`${name}${detail ? ` — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await serve();
const PINNED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(existsSync(PINNED) ? { executablePath: PINNED, args: ['--no-sandbox'] } : {});

const errors = { A: [], B: [] };
async function openPage(label) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
  page.on('console', (m) => { if (m.type() === 'error') errors[label].push(m.text()); });
  page.on('pageerror', (e) => errors[label].push(`pageerror: ${e.message}`));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#bc-practice');
  return page;
}

try {
  const A = await openPage('A');
  const B = await openPage('B');

  // --- host creates a room
  await A.fill('#bc-name', 'Beau');
  await A.click('#bc-create');
  await A.waitForFunction(() => !!window.__game && !!window.__game.localId, null, { timeout: 15000 });
  const code = await A.evaluate(() => window.__game.roomCode);
  check('host gets a room code', /^[A-Z0-9]{4}$/.test(code ?? ''), String(code));
  check('host menu closed on connect', !(await A.isVisible('#bc-practice')));

  // --- friend joins with the code
  await B.fill('#bc-name', 'Mate');
  await B.fill('#bc-code', code);
  await B.click('#bc-join');
  await B.waitForFunction(() => !!window.__game && !!window.__game.localId, null, { timeout: 15000 });
  await sleep(900);

  const rosterA = await A.evaluate(() => [...window.__game.world.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team })));
  const rosterB = await B.evaluate(() => [...window.__game.world.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team })));
  check('host sees two players', rosterA.length === 2, JSON.stringify(rosterA));
  check('joiner sees two players', rosterB.length === 2, JSON.stringify(rosterB));
  check('names replicate', rosterA.some((p) => p.name === 'Mate') && rosterB.some((p) => p.name === 'Beau'), JSON.stringify(rosterA));
  check('players are on opposite teams', new Set(rosterA.map((p) => p.team)).size === 2, JSON.stringify(rosterA.map((p) => p.team)));

  // --- match flow reaches both clients
  await sleep(1200);
  const phaseA = await A.evaluate(() => window.__game.world.match.phase);
  check('two players kick off a countdown', ['countdown', 'live'].includes(phaseA), `phase ${phaseA}`);
  await sleep(3200);
  const matchA = await A.evaluate(() => ({ ...window.__game.world.match }));
  const matchB = await B.evaluate(() => ({ ...window.__game.world.match }));
  check('match goes live for the host', matchA.phase === 'live', `phase ${matchA.phase}`);
  check('match goes live for the joiner', matchB.phase === 'live', `phase ${matchB.phase}`);
  check('both clients agree on the clock', Math.abs(matchA.timer - matchB.timer) < 1.5,
    `${matchA.timer?.toFixed(1)} vs ${matchB.timer?.toFixed(1)}`);
  check('score target is set', matchA.scoreTarget > 0, String(matchA.scoreTarget));
  const t0 = matchA.timer;
  await sleep(1000);
  const t1 = await A.evaluate(() => window.__game.world.match.timer);
  check('match clock counts down', t0 - t1 > 0.5 && t0 - t1 < 2, `${(t0 - t1).toFixed(2)}s in 1s`);

  // --- movement replicates
  const ids = await A.evaluate(() => ({ me: window.__game.localId }));
  const beforeOnB = await B.evaluate((id) => {
    const p = window.__game.world.players.get(id);
    return p ? { x: p.x, y: p.y } : null;
  }, ids.me);

  // Steer toward the middle of the arena rather than blindly holding one key,
  // so the check tests replication and not the map's wall layout.
  for (let i = 0; i < 22; i++) {
    await A.evaluate(() => {
      const p = window.__game.localPlayer;
      const keys = [];
      if (p.x < 600) keys.push('KeyD'); else if (p.x > 700) keys.push('KeyA');
      if (p.y < 320) keys.push('KeyS'); else if (p.y > 400) keys.push('KeyW');
      for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
        window.dispatchEvent(new KeyboardEvent(keys.includes(c) ? 'keydown' : 'keyup', { code: c, bubbles: true }));
      }
    });
    await sleep(60);
  }
  await A.evaluate(() => {
    for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
    }
  });
  await sleep(500);

  const afterOnA = await A.evaluate(() => { const p = window.__game.localPlayer; return { x: p.x, y: p.y }; });
  const afterOnB = await B.evaluate((id) => {
    const p = window.__game.world.players.get(id);
    return p ? { x: p.x, y: p.y } : null;
  }, ids.me);

  check('host actually moved', afterOnA.x > beforeOnB.x + 60, `${beforeOnB.x.toFixed(0)} -> ${afterOnA.x.toFixed(0)}`);
  check('movement is visible to the other player', afterOnB && afterOnB.x > beforeOnB.x + 40,
    `remote saw ${beforeOnB?.x.toFixed(0)} -> ${afterOnB?.x.toFixed(0)}`);
  check('remote position tracks authority closely', Math.abs(afterOnB.x - afterOnA.x) < 90,
    `A=${afterOnA.x.toFixed(0)} B-sees=${afterOnB.x.toFixed(0)}`);

  // --- prediction: local player responds without waiting for the server
  const predict = await A.evaluate(async () => {
    const g = window.__game;
    const before = g.localPlayer.x;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    const after = g.localPlayer.x;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', bubbles: true }));
    return after - before;
  });
  check('local movement is predicted, not round-tripped', predict > 1, `moved ${predict.toFixed(2)}px in 60ms`);

  // --- combat replicates: chase and shoot
  const enemyId = rosterA.find((p) => p.id !== ids.me).id;
  const hpBefore = await B.evaluate(() => window.__game.localPlayer.health);

  for (let i = 0; i < 80; i++) {
    await A.evaluate((eid) => {
      const g = window.__game;
      const me = g.localPlayer;
      const foe = g.world.players.get(eid);
      if (!me || !foe) return;
      const dx = foe.x - me.x, dy = foe.y - me.y;
      const dist = Math.hypot(dx, dy) || 1;
      const canvas = document.getElementById('game');
      const sx = g.viewport.offsetX + foe.x * g.viewport.scale;
      const sy = g.viewport.offsetY + foe.y * g.viewport.scale;
      canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: sx, clientY: sy }));
      const keys = [];
      if (dist > 150) {
        if (dx > 20) keys.push('KeyD'); else if (dx < -20) keys.push('KeyA');
        if (dy > 20) keys.push('KeyS'); else if (dy < -20) keys.push('KeyW');
      }
      for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
        window.dispatchEvent(new KeyboardEvent(keys.includes(c) ? 'keydown' : 'keyup', { code: c, bubbles: true }));
      }
      if (dist <= 150) canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: sx, clientY: sy }));
    }, enemyId);
    await sleep(60);
    const hp = await B.evaluate(() => window.__game.localPlayer.health);
    if (hp < hpBefore) break;
  }
  await sleep(400);
  const hpAfter = await B.evaluate(() => window.__game.localPlayer.health);
  const deaths = await B.evaluate(() => window.__game.localPlayer.deaths);
  check('shooting damages the other player over the network', hpAfter < hpBefore || deaths > 0,
    `hp ${hpBefore} -> ${hpAfter}, deaths ${deaths}`);

  const seenByA = await A.evaluate((id) => window.__game.world.players.get(id)?.health, enemyId);
  check('health replicates to the shooter', typeof seenByA === 'number' && seenByA <= 100, `saw ${seenByA}`);

  // --- disconnect
  await B.close();
  await sleep(1200);
  const rosterAfter = await A.evaluate(() => window.__game.world.players.size);
  check('leaving player is removed for everyone', rosterAfter === 1, `${rosterAfter} players remain`);
  const stillTicking = await A.evaluate(async () => {
    const t0 = window.__game.world.tick;
    await new Promise((r) => setTimeout(r, 500));
    return window.__game.world.tick - t0;
  });
  check('room keeps running after a player leaves', stillTicking > 5, `advanced ${stillTicking} ticks`);

  check('no console errors on host', errors.A.length === 0, errors.A.join(' | '));
  check('no console errors on joiner', errors.B.length === 0, errors.B.join(' | '));

  await A.screenshot({ path: fileURLToPath(new URL('../multiplayer.png', import.meta.url)) });
} finally {
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error(`\n  ${checks - problems.length}/${checks} multiplayer checks passed, ${problems.length} FAILED\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('');
  process.exit(1);
}
console.log(`\n  ✓ all ${checks} multiplayer checks passed\n`);
process.exit(0);
