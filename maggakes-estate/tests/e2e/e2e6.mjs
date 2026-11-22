import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const URL = 'http://127.0.0.1:8787/?debug&norender';
const API = (path, body) => fetch('http://127.0.0.1:8787' + path, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ok = (c, m) => { console.log(c ? '✓' : '✗', m); if (!c) process.exitCode = 1; };
const join = async (name, pw) => {
  const r = await API('/api/login', { name, password: pw });
  const p = await (await b.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
  p.on('dialog', (d) => d.accept());
  await p.goto(URL);
  await p.evaluate((t) => localStorage.setItem('maggakes.token', t), r.token);
  await p.goto(URL);
  await p.waitForFunction(() => window.__game && window.__game() && window.__game().zone, null, { timeout: 90000 });
  await p.waitForTimeout(1000);
  return p;
};
const until = async (p, fn, a, ms = 20000) => { try { await p.waitForFunction(fn, a, { timeout: ms }); return true; } catch { return false; } };
const G = (p, fn, a) => p.evaluate(fn, a);

const k = await join('Keola', 'keola1');
const m = await join('Milla', 'milla1');
const jess = await join('Jess', 'jess12');

// Recreate the bug: start a season, couple up, open a chat, close it, go to the firepit
await G(k, () => { const g = window.__game(); g.net.send({ t: 'villaLook', look: g.save.look }); });
await G(k, () => window.__game().travel('villa'));
await until(k, () => window.__game().zoneId === 'villa');
await k.waitForTimeout(1500);
await G(k, () => { document.querySelectorAll('#modals .modal').forEach((x) => x.remove()); window.__game().seasonAct({ a: 'start' }); });
await until(k, () => !!document.querySelector('.scene-modal .scene-choices .btn'));
await k.click('.scene'); await k.locator('.scene-choices .btn').first().click();
await until(k, () => !!window.__game().save.villa.season?.partner);
await G(k, () => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
const who = await G(k, () => window.__game().save.villa.season.cast.find((n) => n !== window.__game().save.villa.season.partner));
await G(k, (w) => window.__game().seasonAct({ a: 'chat', who: w }), who);
await until(k, () => !!document.querySelector('.btn.choice'));
await k.click('.sheet-head .x');   // she closes it
await k.waitForTimeout(500);
ok(await G(k, () => !!window.__game().save.villa.season.pending), 'reproduced: a moment is left unanswered');
await G(k, () => window.__game().firepit());
ok(await until(k, () => document.body.innerText.includes('You still need to answer this one')), 'FIXED: firepit brings the moment back instead of "Finish what you were doing"');
await k.locator('.btn.choice').first().click();
ok(await until(k, () => !window.__game().save.villa.season.pending), 'answering it unsticks the season');
await G(k, () => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
// Break up
const ex = await G(k, () => window.__game().save.villa.season.partner);
await G(k, () => window.__game().firepit());
await until(k, () => document.body.innerText.includes('Break up with'));
await k.click(`text=💔 Break up with ${ex}`);
ok(await until(k, () => window.__game().save.villa.season.partner === null), `FIXED: broke up with ${ex}`);

// Report a problem
await G(k, () => document.querySelectorAll('#modals .modal').forEach((x) => x.remove()));
await k.click('#b-settings');
await k.click('text=Report a problem');
await k.fill('.report-text', 'Testing: the firepit said I was doing something');
await k.click('text=Send report');
ok(await until(k, () => document.body.innerText.includes('message Beau on Teams')), 'player is told to message Beau on Teams');
ok(await until(m, () => document.body.innerText.includes('New problem report from Keola')), 'VIP/admin (Milla) gets a pop-up');
ok(await until(m, () => Number(document.querySelector('#b-accounts .badge')?.textContent) >= 1), 'Milla sees a badge on the Admin button');
await m.click('#b-accounts');
await m.click('text=Problem reports');
ok(await until(m, () => document.body.innerText.includes('the firepit said I was doing something')), 'report shows in the Problem reports list with details');
await m.click('.report button:has-text("Mark fixed")');
ok(await until(m, () => !document.querySelector('.report:not(.done)') || document.body.innerText.includes('Nothing to fix')), 'VIP can mark it fixed');

// Automatic error report
await G(k, () => setTimeout(() => { throw new Error('test crash please ignore'); }, 0));
ok(await until(m, () => document.body.innerText.includes('automatic error')), 'game errors are reported automatically to VIPs');
ok(await until(k, () => document.body.innerText.includes("it's been reported")), 'the player sees "it\'s been reported" + Teams message');

// Non-VIP can't read reports
await G(jess, () => window.__game().net.send({ t: 'reports' }));
ok(await until(jess, () => document.body.innerText.includes('Only VIPs and admins')), 'regular players cannot read reports');
await b.close();
