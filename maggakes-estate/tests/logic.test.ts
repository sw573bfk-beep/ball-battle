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
  setLook(s, { ...s.look, outfit: 'fit_gown', glasses: 'gl_heart', hair: 'curls' });
  assert.notEqual(s.look.outfit, 'fit_gown');
  assert.equal(s.look.glasses, undefined);
  assert.equal(s.look.hair, 'curls');
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



import { seasonAct, FINAL_DAY, type Season } from '../src/shared/season';
import { normalizeLook } from '../src/shared/look';

test('old hairstyles are upgraded and get no fringe styles', () => {
  assert.equal(normalizeLook({ body: 'boy', skin: '#ffe0cc', hair: 'short', hairColor: '#111111', outfit: 'fit_blue' }).hair, 'crop');
  assert.equal(normalizeLook({ body: 'girl', skin: '#ffe0cc', hair: 'ponytail', hairColor: '#111111', outfit: 'fit_blue' }).hair, 'sleekpony');
});

test('500 random Love Island seasons all finish cleanly', () => {
  const results: Record<string, number> = {};
  let maxSteps = 0;
  for (let n = 0; n < 500; n++) {
    let s: Season | undefined;
    let r = seasonAct(s, { a: 'start' });
    s = r.season;
    let steps = 0;
    let aura = 0;
    while (s!.phase !== 'over') {
      assert.ok(++steps < 200, 'season got stuck');
      const pend = s!.pending;
      if (pend) {
        const opts = pend.type === 'chat' || pend.type === 'hut' ? pend.tones : pend.type === 'game' ? ['win', 'lose'] : pend.options;
        r = seasonAct(s, { a: 'answer', choice: opts[Math.floor(Math.random() * opts.length)] });
      } else if (s!.phase === 'morning' && s!.actions > 0 && Math.random() < 0.8) {
        r = Math.random() < 0.8 ? seasonAct(s, { a: 'chat', who: s!.cast[Math.floor(Math.random() * s!.cast.length)] }) : seasonAct(s, { a: 'hut' });
      } else {
        r = seasonAct(s, { a: 'firepit' });
      }
      assert.ok(r.ok, `action failed: ${r.msg} (phase ${s!.phase})`);
      assert.ok(r.scene && r.scene.lines.length > 0, 'every action shows a scene');
      aura += r.reward?.aura ?? 0;
      s = r.season;
      assert.ok(s!.day <= FINAL_DAY + 1);
      for (const v of Object.values(s!.bonds)) assert.ok(v >= 0 && v <= 100);
    }
    maxSteps = Math.max(maxSteps, steps);
    results[s!.result!] = (results[s!.result!] ?? 0) + 1;
    assert.ok(aura > 0);
  }
  console.log('   results:', results, 'max steps', maxSteps);
  assert.ok(results.won && results.runnerup && results.dumped, 'all endings are reachable');
});


import { checkUsername, residenceHome, isResidence } from '../src/shared/people';
import { zoneName, zoneNeed } from '../src/shared/floors';

test('usernames: 3-16 letters/numbers/_, no rude or reserved names', () => {
  assert.ok(checkUsername('Coco_22').ok);
  assert.equal(checkUsername('ab').ok, false);
  assert.equal(checkUsername('has space').ok, false);
  assert.equal(checkUsername('admin').ok, false);
  assert.equal(checkUsername('xxshitxx').ok, false);
  assert.equal(checkUsername('a'.repeat(17)).ok, false);
});

test('new players get 2 per residence floor, always open', () => {
  assert.deepEqual(residenceHome(0), { zone: 'r1', room: 'a' });
  assert.deepEqual(residenceHome(1), { zone: 'r1', room: 'b' });
  assert.deepEqual(residenceHome(2), { zone: 'r2', room: 'a' });
  assert.ok(isResidence('r12') && !isResidence('f1'));
  assert.equal(zoneName('r3'), 'Residence 3');
  assert.equal(zoneNeed('r3'), 0);
  const s = newSave('Coco', residenceHome(4));
  assert.ok(canEnter(s, 'r3'));
  assert.equal(s.lastZone, 'r3');
});


import { spin, SPIN_PRIZES, collectShell, SHELL_TOTAL, recordLap, adoptPet } from '../src/shared/save';

test('daily spin: once a day, every prize reachable', () => {
  const seen = new Set<number>();
  for (let i = 0; i < 400; i++) {
    const s = newSave('Ava');
    const r = spin(s, i / 400);
    assert.ok(r.ok);
    seen.add(r.index!);
    assert.equal(spin(s, 0.5).ok, false, 'second spin same day is refused');
  }
  assert.equal(seen.size, SPIN_PRIZES.length);
});

test('golden shells: 30 total, no duplicates or fakes, bonus at the end', () => {
  assert.equal(SHELL_TOTAL, 30);
  const s = newSave('Ava');
  assert.equal(collectShell(s, 'f9:0').ok, false);
  assert.equal(collectShell(s, 'b:7').ok, false);
  assert.ok(collectShell(s, 'b:0').ok);
  assert.equal(collectShell(s, 'b:0').ok, false);
  const ids = Object.entries({ b: 2, f1: 3, f2: 3, f3: 3, f4: 3, f5: 3, f6: 3, f7: 3, f8: 3, park: 2, villa: 2 }).flatMap(([z, n]) => Array.from({ length: n }, (_, i) => `${z}:${i}`));
  for (const id of ids) collectShell(s, id);
  assert.equal(s.shells!.length, 30);
  assert.ok(s.aura >= 30 * 25 + 1000);
});

test('kart laps: impossible times refused, personal best kept', () => {
  const s = newSave('Ava');
  assert.equal(recordLap(s, 2000).ok, false);
  assert.ok(recordLap(s, 31000).ok);
  assert.ok(recordLap(s, 40000).ok);
  assert.equal(s.bestLap, 31000);
});

test('pets: puppy/kitten/bunny with a clean name; fireworks stack in the shop', () => {
  const s = newSave('Ava');
  assert.equal(adoptPet(s, 'dragon', 'x').ok, false);
  assert.ok(adoptPet(s, 'bunny', '<b>Fluffy</b>!!').ok);
  assert.deepEqual(s.pet, { kind: 'bunny', name: 'bFluffyb' });
  s.aura = 1000;
  assert.ok(buy(s, 'fx_fireworks').ok && buy(s, 'fx_fireworks').ok);
  assert.equal(s.inventory.fx_fireworks, 2);
  assert.equal(s.inventory.car_kart, 1, 'everyone owns a mini kart');
});
console.log(`\n${n} tests passed`);
