import assert from 'node:assert/strict';
import { SKINS, BOXES, RARITIES, boxOdds, rollBox, skinSvg, STARTER_SKINS } from '../public/js/skins.js';
import { raceEarn, racePenalty, rollChest, classicPoints, coinReward, cleanOptions, UPGRADES } from '../public/js/rules.js';

assert.equal(new Set(SKINS.map((s) => s.id)).size, SKINS.length, 'skin ids unique');
for (const s of SKINS) {
  assert.ok(RARITIES[s.rarity], s.id);
  const svg = skinSvg(s.id);
  assert.match(svg, /^<svg/);
  assert.ok(!svg.includes('undefined'), `${s.id} renders cleanly`);
}
assert.equal(STARTER_SKINS.length, 4);
for (const b of BOXES) {
  assert.ok(b.skins.length >= 5, b.id);
  const total = boxOdds(b).reduce((t, o) => t + o.pct, 0);
  assert.ok(Math.abs(total - 100) < 1e-9, `${b.id} odds sum to 100`);
  const counts = {};
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 20000; i++) { const id = rollBox(b, rand); counts[id] = (counts[id] || 0) + 1; }
  assert.ok(Object.keys(counts).every((id) => b.skins.includes(id)));
}

const lv = { income: 0, multiplier: 0, streak: 0, shield: 0 };
assert.equal(raceEarn(lv, 1), 10);
assert.equal(raceEarn({ ...lv, multiplier: 2, streak: 1 }, 3), Math.round((10 + 5 * 2) * 2));
assert.equal(racePenalty(lv), 2);
assert.equal(racePenalty({ ...lv, shield: 3 }), 0);
for (const u of Object.values(UPGRADES)) for (let i = 1; i < u.levels.length; i++) assert.ok(u.levels[i].cost > u.levels[i - 1].cost);
for (let i = 0; i < 1000; i++) assert.ok(rollChest(Math.random).kind);
assert.equal(classicPoints(0, 20000, 1), 1000);
assert.equal(classicPoints(20000, 20000, 1), 500);
assert.equal(classicPoints(0, 20000, 3), 1200);
assert.equal(coinReward({ place: 1, players: 5, correct: 10 }), 50);
assert.ok(coinReward({ place: 1, players: 1, correct: 200 }) <= 100);
assert.deepEqual(cleanOptions('race', { minutes: 999, goal: -5, junk: 1 }), { goal: 0, minutes: 30 });
console.log('skins/rules: ok');
