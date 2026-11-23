import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const URL = 'http://127.0.0.1:8787/?debug&norender';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
const mk = async () => {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(URL);
  await p.evaluate(() => localStorage.setItem('quality', 'low'));
  return p;
};
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };

// 1. Kicked + sign up through the UI
const a = await mk();
a.on('websocket', (ws) => { ws.on('framesent', (f) => { if (f.payload.includes('"task"')) console.log('   >>', f.payload); }); ws.on('framereceived', (f) => { const s = String(f.payload); if (s.includes('toast') || s.includes('kicked')) console.log('   <<', s.slice(0, 140)); }); });
await a.fill('#login input', 'Bob');
await a.click('#login .btn');
ok(await a.waitForSelector('text=Make a password for your new account').then(() => true, () => false), 'unknown name can make a new account');
await a.click('text=‹ Back');
await a.fill('#login input', 'serena');
await a.click('#login .btn');
await a.waitForSelector('text=Make a password so nobody else');
const pw = a.locator('#login input[type=password]');
await pw.nth(0).fill('beach123');
await pw.nth(1).fill('beach124');
await a.click('#login .btn');
ok(await a.isVisible("text=Those passwords don't match."), 'mismatched passwords rejected');
await pw.nth(1).fill('beach123');
await a.click('#login .btn');
await a.waitForFunction(() => document.body.classList.contains('playing'), null, { timeout: 30000 });
ok(true, 'Serena created a password and entered the estate');
await a.waitForTimeout(1500);
ok((await a.textContent('#zonename')).includes('Basement'), 'Serena spawns on her home floor (Basement)');

// 2. Second player (Gabby) via API token
const r = await (await fetch('http://127.0.0.1:8787/api/login', { method: 'POST', body: JSON.stringify({ name: 'Gabby', password: 'gabby1' }) })).json();
const g = await mk();
await g.evaluate((t) => localStorage.setItem('maggakes.token', t), r.token);
await g.goto(URL);
await g.waitForFunction(() => window.__game && window.__game(), null, { timeout: 30000 });
await g.waitForTimeout(1500);
ok((await g.textContent('#zonename')).includes('6th'), 'Gabby can visit her locked home floor (6th)');

// Both go to the 1st floor
for (const p of [a, g]) await p.evaluate(() => window.__game().travel('f1'));
await a.waitForFunction(() => window.__game().peers.has('Gabby'), null, { timeout: 15000 }).catch(() => {});
const seen = await a.evaluate(() => [...window.__game().peers.keys()]);
ok(seen.includes('Gabby'), 'Serena can see Gabby on the 1st floor');
await g.fill('#chatin', 'hiii serena');
await g.press('#chatin', 'Enter');
await a.waitForTimeout(800);
ok((await a.textContent('#chatlog')).includes('hiii serena'), 'chat message arrives');

// 3. Do the check-in task: walk to the desk, press E, answer quiz
await a.evaluate(() => { const gm = window.__game(); gm.pos.set(1, -2.4); });
await a.waitForTimeout(500);
const act = await a.textContent('#actions');
ok(act.includes('Check in a guest'), 'standing at reception shows the task button');
await a.keyboard.press('e');
await a.waitForSelector('.mg-quiz');
for (let i = 0; i < 3; i++) {
  const q = await a.textContent('.mg-q p');
  const ans = q.includes('ensuite') ? 'Guest Bedroom 1' : q.includes('massage') ? 'Luxury Spa' : '3rd';
  await a.click(`.mg-opt:has-text("${ans}")`);
  await a.waitForTimeout(700);
}
console.log('   modal left:', await a.locator('#modals .modal').count());
await a.waitForTimeout(1500);
const s1 = await a.evaluate(() => { const s = window.__game().save; return [s.totalAura, s.aura]; });
ok(s1[0] === 200 && s1[1] === 200, `task gives 200 Total + 200 Available (got ${s1})`);

// 4. Buy sunglasses in the shop, then wear them
await a.click('#b-shop');
await a.click('.tab:has-text("Accessories")');
await a.click('.card:has-text("Aviator Sunglasses") .btn');
await a.waitForTimeout(800);
const s2 = await a.evaluate(() => { const s = window.__game().save; return [s.totalAura, s.aura, s.inventory.gl_aviator]; });
ok(s2[0] === 200 && s2[1] === 0 && s2[2] === 1, `buying spends Available only (got ${s2})`);
await a.keyboard.press('Escape');
await a.click('#b-wardrobe');
await a.click('.wtabs .tab:has-text("Extras")');
await a.click('.chip:has-text("Aviator Sunglasses")');
await a.click('text=Save look');
await a.waitForTimeout(800);
ok(await a.evaluate(() => window.__game().save.look.glasses === 'gl_aviator'), 'wearing the sunglasses saved');
await g.waitForTimeout(300);
ok(await g.evaluate(() => window.__game().peers.get('Serena')?.info.look.glasses === 'gl_aviator'), 'Gabby sees Serena’s new sunglasses');

// 5. Map shows lock state
await a.click('#b-map');
ok(await a.isVisible('text=Needs 1,000 Total Aura'), 'map shows locked floors with Aura needed');
await a.keyboard.press('Escape');

// 7. Non-admin cannot use admin
await g.evaluate(() => window.__game().net.send({ t: 'admin', action: 'vip', target: 'Gabby' }));
await g.waitForTimeout(600);
ok(!(await g.evaluate(() => window.__game().save.vip)), 'non-admins cannot give VIP');

// 6. Beau (admin) gives Serena VIP from the leaderboard
const rb = await (await fetch('http://127.0.0.1:8787/api/login', { method: 'POST', body: JSON.stringify({ name: 'Beau', password: 'beau12' }) })).json();
await g.context().close();
const be = await mk();
await be.evaluate((t) => localStorage.setItem('maggakes.token', t), rb.token);
await be.goto(URL);
await be.waitForFunction(() => window.__game && window.__game(), null, { timeout: 90000 });
await be.click('#b-board');
await be.waitForSelector('.board tbody tr');
await be.click('.board tr:has-text("Serena") button:has-text("Give VIP")');
await a.waitForTimeout(1000);
ok(await a.evaluate(() => window.__game().save.vip), 'Beau gave Serena VIP');
await a.screenshot({ path: 'shots/e2e-serena.png' });

await be.context().close();
// 8. Wrong password via UI on a new device
const c = await mk();
await c.fill('#login input', 'Serena');
await c.click('#login .btn');
await c.waitForSelector('text=Welcome back');
await c.fill('#login input[type=password]', 'nope');
await c.click('#login .btn');
await c.waitForTimeout(600);
ok(await c.isVisible('text=Wrong password.'), 'wrong password refused');

console.log('page errors:', errs);
await b.close();
