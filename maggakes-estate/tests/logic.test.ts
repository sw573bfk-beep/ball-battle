import assert from 'node:assert/strict';
import { buy, canEnter, claimDaily, completeTask, dailyFor, newSave, placeItems, setLook, zoneUnlocked, bumpStat } from '../src/shared/save';
import { FLOORS, TASK_AURA } from '../src/shared/floors';
import { findResident, RESIDENTS } from '../src/shared/people';
import { villaChallenge, winFinal, FINAL_POINTS } from '../src/shared/villa';
import { SHOP } from '../src/shared/shop';

let n = 0;
const test = (name: string, fn: () => void) => { fn(); n++; console.log('✓', name); };

test('only the 10 residents are allowed, any capitalisation', () => {
  assert.equal(RESIDENTS.length, 10);
  assert.equal(findResident('  pHoEbE ')?.name, 'Phoebe');
  assert.equal(findResident('Bob'), undefined);
  assert.equal(findResident(''), undefined);
});

test('every floor except the basement has exactly five tasks', () => {
  for (const f of FLOORS) assert.equal(f.tasks.length, f.id === 'b' ? 0 : 5, f.id);
});

test('basement, 1st floor and car park open at the start; 2nd floor locked', () => {
  const s = newSave('Ava');
  assert.ok(zoneUnlocked(s, 'b') && zoneUnlocked(s, 'f1') && zoneUnlocked(s, 'park'));
  assert.ok(!zoneUnlocked(s, 'f2'));
  assert.ok(!zoneUnlocked(s, 'villa'));
});

test('your home floor is always visitable even when locked', () => {
  const s = newSave('Milla');
  assert.ok(!zoneUnlocked(s, 'f7'));
  assert.ok(canEnter(s, 'f7'));
  assert.ok(!canEnter(s, 'f6'));
});

test('five tasks = 1000 Aura = next floor unlocked', () => {
  const s = newSave('Ava');
  for (const t of FLOORS[1].tasks) assert.ok(completeTask(s, 'f1', t.id).ok);
  assert.equal(s.totalAura, 5 * TASK_AURA);
  assert.equal(s.aura, 1000);
  assert.ok(zoneUnlocked(s, 'f2'));
  assert.ok(!zoneUnlocked(s, 'f3'));
});

test('tasks on a locked floor are refused', () => {
  const s = newSave('Ava');
  assert.equal(completeTask(s, 'f3', 'swim').ok, false);
  assert.equal(s.totalAura, 0);
});

test('replaying a task gives a small bonus to Available only, never Total', () => {
  const s = newSave('Ava');
  completeTask(s, 'f1', 'sushi');
  const r = completeTask(s, 'f1', 'sushi');
  assert.ok(r.ok);
  assert.equal(s.totalAura, 200);
  assert.equal(s.aura, 250);
});

test('spending Aura never lowers Total Aura or locks floors', () => {
  const s = newSave('Ava');
  for (const t of FLOORS[1].tasks) completeTask(s, 'f1', t.id);
  assert.ok(buy(s, 'gl_aviator').ok);
  assert.equal(s.aura, 800);
  assert.equal(s.totalAura, 1000);
  assert.ok(zoneUnlocked(s, 'f2'));
});

test('shop refuses: too expensive, VIP-only, floor-locked, already owned', () => {
  const s = newSave('Ava');
  s.aura = 5000;
  assert.equal(buy(s, 'jw_crown').ok, false); // VIP
  assert.equal(buy(s, 'd_canopy').ok, false); // needs 6th floor
  assert.ok(buy(s, 'bag_tote').ok);
  assert.equal(buy(s, 'bag_tote').ok, false); // owned
  s.aura = 10;
  assert.equal(buy(s, 'gl_heart').ok, false);
  s.vip = true; s.aura = 2000;
  assert.ok(buy(s, 'jw_crown').ok);
});

test('furniture can be bought more than once and placed up to how many you own', () => {
  const s = newSave('Ava');
  s.aura = 1000;
  assert.ok(buy(s, 'd_teddy').ok && buy(s, 'd_teddy').ok);
  assert.equal(s.inventory.d_teddy, 2);
  const it = (uid: string) => ({ uid, item: 'd_teddy', x: 0, z: 0, rot: 0 });
  assert.ok(placeItems(s, [it('a'), it('b')]).ok);
  assert.equal(placeItems(s, [it('a'), it('b'), it('c')]).ok, false);
  assert.equal(placeItems(s, [{ uid: 'x', item: 'gl_heart', x: 0, z: 0, rot: 0 }]).ok, false);
});

test('decorate task needs decorations placed first', () => {
  const s = newSave('Keola');
  s.totalAura = 3000;
  assert.equal(completeTask(s, 'f4', 'decorate').ok, false);
  placeItems(s, [{ uid: 'a', item: 'd_plant', x: 0, z: 0, rot: 0 }]);
  assert.ok(completeTask(s, 'f4', 'decorate').ok);
});

test('you can only wear things you own', () => {
  const s = newSave('Ava');
  setLook(s, { ...s.look, outfit: 'fit_gown', glasses: 'gl_heart', hair: 'curly' });
  assert.notEqual(s.look.outfit, 'fit_gown');
  assert.equal(s.look.glasses, undefined);
  assert.equal(s.look.hair, 'curly');
});

test('daily challenges: 3 a day, claim once when finished', () => {
  const s = newSave('Ava');
  const list = dailyFor(s.daily.date);
  assert.equal(list.length, 3);
  assert.equal(new Set(list.map((d) => d.id)).size, 3);
  const d = list[0];
  assert.equal(claimDaily(s, d.id).ok, false);
  bumpStat(s, d.stat, d.goal);
  assert.ok(claimDaily(s, d.id).ok);
  assert.equal(s.totalAura, d.reward);
  assert.equal(claimDaily(s, d.id).ok, false);
});

test('Love Island: locked until rooftop, challenges have cooldown, final needs partner + points', () => {
  const s = newSave('Ava');
  assert.equal(villaChallenge(s, 'dance', 0).ok, false);
  s.totalAura = 7000;
  assert.ok(villaChallenge(s, 'dance', 1_000_000).ok);
  assert.equal(villaChallenge(s, 'dance', 1_000_500).ok, false);
  assert.equal(winFinal(s).ok, false);
  s.villa.partner = 'npc:Kai';
  s.villa.points = FINAL_POINTS;
  assert.ok(winFinal(s).ok);
  assert.equal(s.villa.wins, 1);
  assert.equal(s.villa.points, 0);
});

test('every shop item has a unique id', () => {
  assert.equal(new Set(SHOP.map((i) => i.id)).size, SHOP.length);
});

console.log(`\n${n} tests passed`);
