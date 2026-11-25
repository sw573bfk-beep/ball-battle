// Soccer at the stadium: live match state, bots fill the teams, friends join opposite
// teams, kicking moves the ball, the scoreboard shows the score.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
const RENDER = process.argv.includes('--render');
const URL = 'http://127.0.0.1:8787/?debug' + (RENDER ? '' : '&norender');
const API = (path, body) => fetch('http://127.0.0.1:8787' + path, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const join = async (name, pw) => {
  const r = await API('/api/login', { name, password: pw });
  const p = await (await b.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
  p.on('pageerror', (e) => console.log('PAGEERR', name, e.message));
  await p.goto(URL); await p.evaluate((t) => { localStorage.setItem('maggakes.token', t); localStorage.setItem('quality', 'medium'); }, r.token); await p.goto(URL);
  await p.waitForFunction(() => window.__game && window.__game() && window.__game().zone, null, { timeout: 120000 });
  await p.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
  return p;
};
const until = (p, fn, a, ms = 15000) => p.waitForFunction(fn, a, { timeout: ms }).then(() => true, () => false);
const keola = await join('Keola', 'keola1');
await keola.evaluate(() => window.__game().travel('stadium'));
ok(await until(keola, () => window.__game().zoneId === 'stadium'), 'drove to the stadium');
ok(await until(keola, () => window.__game().soccer.state?.p.length === 6), 'a 3v3 match starts (bots fill the teams)');
ok(await until(keola, () => document.querySelector('#soccerhud.on')?.textContent.includes('PINK')), 'scoreboard HUD shows');
ok(await keola.evaluate(() => window.__game().soccer.myTeam === 0), 'Keola is on Pink');
ok(await until(keola, () => window.__game().soccer.state?.ph === 'play', null, 12000), 'kick-off → playing');
const milla = await join('Milla', 'milla1');
await milla.evaluate(() => window.__game().travel('stadium'));
ok(await until(milla, () => window.__game().soccer.myTeam === 1), 'Milla joins Blue (teams balance)');
ok(await until(keola, () => window.__game().soccer.state?.p.filter((p) => !p[5]).length === 2 && window.__game().soccer.state.p.length === 6), 'a bot steps aside for her (still 3v3)');
// Walk Keola onto the ball and kick it
let moved = false;
for (let i = 0; i < 8 && !moved; i++) {
  const before = await keola.evaluate(() => { const g = window.__game(); const [bx, bz] = g.soccer.state.b; g.pos.set(bx, bz - 1.0); g.ry = 0; g.net.send({ t: 'pos', x: bx, z: bz - 1.0, ry: 0, a: 1 }); return [bx, bz]; });
  if (i === 0) ok(await until(keola, () => window.__game().actions.some((a) => a.key === 'kick'), null, 3000), '"⚽ Kick!" button next to the ball');
  await keola.evaluate(() => window.__game().kickBall());
  moved = await until(keola, (b0) => { const s = window.__game().soccer.state; return Math.hypot(s.b[0] - b0[0], s.b[1] - b0[1]) > 2 || Math.hypot(s.b[2], s.b[3]) > 5; }, before, 1500);
}
ok(moved, 'kicking sends the ball flying');
if (RENDER) {
  await keola.evaluate(() => { const g = window.__game(); g.fun.update = () => {}; g.gfx.setTimeOfDay(0.3, 64, false); const [bx, bz] = g.soccer.state.b; g.pos.set(bx - 1.5, bz - 1.5); g.camTarget.set(bx, 1.2, bz); g.camDist = 12; g.camPitch = 0.8; g.camYaw = 0.4; g.soccer.update = ((u) => function (dt, t) { u.call(this, dt, t); })(g.soccer.update); });
  await keola.waitForTimeout(2500);
  await keola.screenshot({ path: 'shots/e2e11-soccer.png' });
}
await b.close();
