// The six newer task mini-games can each be won (played automatically).
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
const SP = 'shots';
const API = (path, body) => fetch('http://127.0.0.1:8787' + path, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
const b = await chromium.launch();
const r = await API('/api/login', { name: 'Keola', password: 'keola1' });
const p = await (await b.newContext({ viewport: { width: 900, height: 760 } })).newPage();
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://127.0.0.1:8787/?debug&norender'); await p.evaluate((t) => localStorage.setItem('maggakes.token', t), r.token); await p.goto('http://127.0.0.1:8787/?debug&norender');
await p.waitForFunction(() => window.__game && window.__game() && window.__game().zone && window.__mg, null, { timeout: 90000 });
await p.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const run = (name, args) => p.evaluate(([name, args]) => new Promise((res) => { window.__res = null; window.__mg[name](...args, (v) => { window.__res = v; }); res(); }), [name, args]);
const result = () => p.waitForFunction(() => window.__res !== null, null, { timeout: 20000 }).then(() => p.evaluate(() => window.__res), () => 'timeout');
const close = () => p.evaluate(() => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
// unscramble: click letters in order of the answer word
await run('unscrambleGame', ['Spell it', 'hint', ['CAT', 'DOG', 'SUN']]);
await p.screenshot({ path: `${SP}/mg-unscramble.png` });
for (let round = 0; round < 3; round++) {
  await p.waitForTimeout(450);
  const len = await p.evaluate(() => document.querySelector('.mg-answer').textContent.split(' ').length);
  for (let k = 0; k < len; k++) {
    await p.evaluate(() => {
      const btns = [...document.querySelectorAll('.mg-letter:not(.used)')];
      for (const b of btns) { const before = document.querySelector('.mg-answer').textContent; b.click(); if (document.querySelector('.mg-answer').textContent !== before) return; }
    });
  }
}
ok(await result() === true, 'unscramble can be won');
// spot: click the cell whose text differs
await run('spotGame', ['Spot', 'hint', [['🌸', '🌼'], ['🍓', '🍒'], ['⭐', '🌟']]]);
await p.screenshot({ path: `${SP}/mg-spot.png` });
for (let i = 0; i < 3; i++) { await p.evaluate(() => { const c = [...document.querySelectorAll('.mg-spotcell')]; const t = c.map((x) => x.textContent); const odd = c.find((x) => t.filter((y) => y === x.textContent).length === 1); odd.click(); }); await p.waitForTimeout(100); }
ok(await result() === true, 'spot the odd one can be won');
// maze: BFS over the grid
await run('mazeGame', ['Maze', 'hint', '🐠', '🏁']);
await p.screenshot({ path: `${SP}/mg-maze.png` });
const path = await p.evaluate(() => {
  const cells = [...document.querySelectorAll('.mg-maze .mz')]; const N = Math.round(Math.sqrt(cells.length));
  const wall = (x, y) => cells[y * N + x].classList.contains('w');
  let s, g; cells.forEach((c, i) => { if (c.textContent === '🐠') s = [i % N, Math.floor(i / N)]; if (c.textContent === '🏁') g = [i % N, Math.floor(i / N)]; });
  const prev = new Map(); const q = [s]; prev.set(s.join(), null);
  while (q.length) { const [x, y] = q.shift(); if (x === g[0] && y === g[1]) break; for (const [dx, dy, k] of [[1, 0, 'ArrowRight'], [-1, 0, 'ArrowLeft'], [0, 1, 'ArrowDown'], [0, -1, 'ArrowUp']]) { const n = [x + dx, y + dy]; if (!prev.has(n.join()) && !wall(n[0], n[1])) { prev.set(n.join(), [x, y, k]); q.push(n); } } }
  const keys = []; let cur = g.join(); while (prev.get(cur)) { const [x, y, k] = prev.get(cur); keys.unshift(k); cur = [x, y].join(); } return keys;
});
for (const k of path) await p.keyboard.press(k);
ok(await result() === true, `maze can be solved (${path.length} moves)`);
// memory: brute force with patience
await run('memoryGame', ['Memory', 'hint', ['🐠', '🐙', '🦀']]);
await p.screenshot({ path: `${SP}/mg-memory.png` });
for (let tries = 0; tries < 40; tries++) {
  const done = await p.evaluate(() => window.__res !== null); if (done) break;
  await p.evaluate(() => { const c = [...document.querySelectorAll('.mg-card:not(.done)')]; if (c.length >= 2) { c[0].click(); c[1 + Math.floor(Math.random() * (c.length - 1))].click(); } });
  await p.waitForTimeout(850);
}
ok(await result() === true, 'memory can be won');
// catch: steer under good drops
await run('catchGame', ['Catch', 'hint', '🍓', '💣', 5]);
for (let i = 0; i < 400; i++) {
  const d = await p.evaluate(() => window.__res);
  if (d !== null) break;
  await p.evaluate(() => {
    const f = document.querySelector('.mg-field'); if (!f) return; const r = f.getBoundingClientRect();
    const drops = [...document.querySelectorAll('.mg-drop')].filter((d) => d.textContent === '🍓').map((d) => { const m = /translate\(([-\d.]+)px, ([-\d.]+)px/.exec(d.style.transform); return m ? [Number(m[1]) + 15, Number(m[2])] : null; }).filter(Boolean).sort((a, b) => b[1] - a[1]);
    if (drops[0]) f.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + drops[0][0], clientY: r.top + 10 }));
  });
  if (i === 30) await p.screenshot({ path: `${SP}/mg-catch.png` });
  await p.waitForTimeout(50);
}
ok(await result() === true, 'catch can be won');
// rhythm: press the right key when a note is near the line
await p.waitForTimeout(1200); await close();
await run('rhythmGame', ['Rhythm', 'hint']);
console.log('rhythm open', await p.waitForSelector('.mg-line', { timeout: 5000 }).then(() => true, () => false));
for (let i = 0; i < 800; i++) {
  if (await p.evaluate(() => window.__res !== null)) break;
  const lane = await p.evaluate(() => { const le = document.querySelector('.mg-line'); if (!le) return -1; const line = parseFloat(le.style.top); const lanes = [...document.querySelectorAll('.mg-lane')]; for (let l = 0; l < 3; l++) for (const n of lanes[l].children) { const y = parseFloat(/translateY\(([-\d.]+)px/.exec(n.style.transform)?.[1] ?? '-99'); if (Math.abs(y - line) < 20) return l; } return -1; });
  if (lane >= 0) await p.keyboard.press(['a', 's', 'd'][lane]);
  if (i === 40) await p.screenshot({ path: `${SP}/mg-rhythm.png` });
  await p.waitForTimeout(20);
}
ok(await result() === true, 'rhythm can be won');
await b.close();
