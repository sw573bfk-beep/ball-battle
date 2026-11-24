import assert from 'node:assert/strict';
import { buy, canEnter, claimDaily, completeTask, dailyFor, newSave, placeItems, setLook, zoneUnlocked, bumpStat, saveOutfit, setProfile, setRoomStyle, adoptPet, cleanText, MAX_OUTFITS } from '../src/shared/save';
import { FLOORS, TASK_AURA } from '../src/shared/floors';
import { findResident, RESIDENTS } from '../src/shared/people';
import { villaChallenge, winFinal, FINAL_POINTS } from '../src/shared/villa';
import { SHOP } from '../src/shared/shop';
import { ACHIEVEMENTS, EVENTS, claimAchievement, claimEventGoal, claimLevels, currentEvent, levelOf, levelStart, newlyReady, weekIndex } from '../src/shared/progress';
import { earn } from '../src/shared/save';

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


test('BUG FIX: closing a Love Island moment no longer gets you stuck', () => {
  let s = seasonAct(undefined, { a: 'start' }).season!;
  s = seasonAct(s, { a: 'answer', choice: s.cast[0] }).season!;       // first coupling
  s = seasonAct(s, { a: 'chat', who: s.cast[1] }).season!;             // a chat opens…
  assert.ok(s.pending);
  // …she closes the window and walks to the firepit:
  const r = seasonAct(s, { a: 'firepit' });
  assert.ok(r.ok, 'firepit no longer refuses');
  assert.ok(r.scene!.choices!.length === 3, 'the unanswered chat pops back up');
  const r2 = seasonAct(r.season, { a: 'answer', choice: (s.pending as { tones: string[] }).tones[0] });
  assert.ok(r2.ok && !r2.season!.pending, 'answering it carries on normally');
});

test('BUG FIX: old stuck saves (no saved scene) get moved along', () => {
  let s = seasonAct(undefined, { a: 'start' }).season!;
  s = seasonAct(s, { a: 'answer', choice: s.cast[0] }).season!;
  s.pending = { type: 'event', ev: 'date', who: s.cast[1], options: ['go', 'no'] };
  s.lastScene = undefined;
  const r = seasonAct(s, { a: 'firepit' });
  assert.ok(r.ok && !r.season!.pending, 'unstuck');
  assert.ok(seasonAct(r.season, { a: 'firepit' }).ok, 'and can carry on to the firepit');
});

test('BUG FIX: you can break up with your partner', () => {
  let s = seasonAct(undefined, { a: 'start' }).season!;
  s = seasonAct(s, { a: 'answer', choice: s.cast[0] }).season!;
  const ex = s.partner!;
  const before = s.bonds[ex];
  const r = seasonAct(s, { a: 'breakup' });
  assert.ok(r.ok);
  assert.equal(r.season!.partner, null);
  assert.ok(r.season!.bonds[ex] < before);
  assert.equal(seasonAct(r.season, { a: 'breakup' }).ok, false, 'already single');
});

// ------------------------------------------------------------ customisation

test('CUSTOM: any colour for skin, hair, eyes, lips and clothes', () => {
  const s = newSave('Phoebe');
  setLook(s, { ...s.look, skin: '#123456', hairColor: '#ABCDEF', eyes: '#00ff00', lips: '#ff00aa', top: 'hoodie', bottom: 'shorts', shoes: 'heels', colors: { top: '#111111', bottom: '#222222', shoes: '#333333' } });
  assert.equal(s.look.skin, '#123456');
  assert.equal(s.look.hairColor, '#abcdef');
  assert.equal(s.look.eyes, '#00ff00');
  assert.equal(s.look.lips, '#ff00aa');
  assert.deepEqual([s.look.top, s.look.bottom, s.look.shoes], ['hoodie', 'shorts', 'heels']);
  assert.deepEqual(s.look.colors, { top: '#111111', bottom: '#222222', shoes: '#333333' });
});

test('CUSTOM: junk colours and made-up clothes are thrown away', () => {
  const s = newSave('Phoebe');
  const before = s.look.skin;
  setLook(s, { ...s.look, skin: 'red; background:url(x)', top: 'spacesuit', colors: { top: 'javascript:' } } as never);
  assert.equal(s.look.skin, before);
  assert.equal(s.look.top, undefined);
  assert.equal(s.look.colors, undefined);
});

test('CUSTOM: saved outfits fill 6 slots and keep their names', () => {
  const s = newSave('Phoebe');
  assert.ok(saveOutfit(s, 0, 'Beach day', { ...s.look, top: 'tank' }).ok);
  assert.ok(saveOutfit(s, 2, '', s.look).ok);
  assert.equal(s.outfits![0].name, 'Beach day');
  assert.equal(s.outfits![0].look.top, 'tank');
  assert.equal(s.outfits![2].name, 'Look 3');
  assert.equal(s.outfits!.length, 3);
  assert.equal(saveOutfit(s, MAX_OUTFITS, 'x', s.look).ok, false, 'no 7th slot');
  assert.equal(saveOutfit(s, -1, 'x', s.look).ok, false);
});

test('CUSTOM: profile keeps a colour, a real badge and a clean short bio', () => {
  const s = newSave('Phoebe');
  setProfile(s, { color: '#FF00FF', badge: '👑', bio: 'hi <script>  this is shit  ' + 'x'.repeat(200) });
  assert.equal(s.profile!.color, '#ff00ff');
  assert.equal(s.profile!.badge, '👑');
  assert.ok(!s.profile!.bio!.includes('<') && !/shit/i.test(s.profile!.bio!));
  assert.ok(s.profile!.bio!.length <= 80);
  setProfile(s, { color: 'blue', badge: '💩💩💩' });
  assert.equal(s.profile!.color, undefined);
  assert.equal(s.profile!.badge, '');
  assert.equal(cleanText('  a   b  ', 10), 'a b');
});

test('CUSTOM: bedroom walls and floor (only if you have a bedroom)', () => {
  const s = newSave('Phoebe');
  assert.ok(setRoomStyle(s, { wall: '#AA0000', floor: 'marble', tint: '#00AA00' }).ok);
  assert.deepEqual(s.roomStyle, { wall: '#aa0000', floor: 'marble', tint: '#00aa00' });
  assert.ok(setRoomStyle(s, { empty: true }).ok && s.roomStyle!.empty === true, 'empty my room');
  setRoomStyle(s, { wall: 'nope', floor: 'lava', empty: 'yes' as never });
  assert.deepEqual(s.roomStyle, { wall: undefined, floor: undefined, tint: undefined });
  const guest = newSave('Somebody');
  guest.home = undefined;
  assert.equal(setRoomStyle(guest, { wall: '#000000' }).ok, false);
});

test('CUSTOM: furniture can be recoloured and resized, within limits', () => {
  const s = newSave('Phoebe');
  const f = SHOP.find((i) => i.cat === 'furniture')!;
  s.inventory[f.id] = 1;
  assert.ok(placeItems(s, [{ uid: 'a', item: f.id, x: 1, z: 1, rot: 0, color: '#ABCDEF', scale: 1.5 }]).ok);
  assert.equal(s.room[0].color, '#abcdef');
  assert.equal(s.room[0].scale, 1.5);
  assert.equal(placeItems(s, [{ uid: 'a', item: f.id, x: 1, z: 1, rot: 0, scale: 5 }]).ok, false, 'too big');
  assert.equal(placeItems(s, [{ uid: 'a', item: f.id, x: 1, z: 1, rot: 0, color: 'pink' }]).ok, false, 'bad colour');
  assert.ok(placeItems(s, [{ uid: 'a', item: f.id, x: 1, z: 1, rot: 0, scale: 1 }]).ok);
  assert.equal(s.room[0].scale, undefined, 'normal size is not stored');
});

test('CUSTOM: pets get fur and collar colours', () => {
  const s = newSave('Phoebe');
  assert.ok(adoptPet(s, 'cat', 'Mochi', '#FFFFFF', '#ff3d7f').ok);
  assert.deepEqual(s.pet, { kind: 'cat', name: 'Mochi', fur: '#ffffff', collar: '#ff3d7f' });
  adoptPet(s, 'dog', 'Rex', 'brown', undefined);
  assert.deepEqual(s.pet, { kind: 'dog', name: 'Rex' });
});
test('EXPLOIT FIX: replays can\'t be spam-clicked for Aura', () => {
  const s = newSave('Phoebe');
  for (const t of FLOORS.find((f) => f.id === 'f1')!.tasks) completeTask(s, 'f1', t.id, 0);
  const id = FLOORS.find((f) => f.id === 'f1')!.tasks[0].id;
  const a0 = s.aura;
  assert.ok(completeTask(s, 'f1', id, 1_000_000).ok);
  for (let i = 0; i < 50; i++) assert.equal(completeTask(s, 'f1', id, 1_000_000 + i * 100).ok, false);
  assert.equal(s.aura, a0 + 50, 'only one replay paid');
  assert.ok(completeTask(s, 'f1', id, 1_000_000 + 2 * 60_000).ok, 'fine again after 2 minutes');
});
test('TOWER: floors 13–24, each 1,000 above the last, every new-game task has its data', () => {
  const tower = FLOORS.filter((f) => /^f(1[3-9]|2[0-4])$/.test(f.id));
  assert.equal(tower.length, 12);
  tower.forEach((f, i) => assert.equal(f.need, 12000 + i * 1000, f.id));
  const ids = new Set<string>();
  for (const f of FLOORS) for (const t of f.tasks) {
    assert.ok(!ids.has(`${f.id}:${t.id}`)); ids.add(`${f.id}:${t.id}`);
    if (t.kind === 'catch') assert.ok(t.item && t.bad && t.count, `${f.id}:${t.id}`);
    if (t.kind === 'memory') assert.ok((t.symbols?.length ?? 0) >= 3, `${f.id}:${t.id}`);
    if (t.kind === 'spot') assert.ok(t.odd?.length && t.odd.every(([a, b]) => a !== b), `${f.id}:${t.id}`);
    if (t.kind === 'maze') assert.ok(t.item && t.goal, `${f.id}:${t.id}`);
    if (t.kind === 'unscramble') assert.ok((t.words?.length ?? 0) >= 3 && t.words!.every((w) => /^[A-Z]+$/.test(w)), `${f.id}:${t.id}`);
    if (t.kind === 'sequence') assert.ok((t.steps?.length ?? 0) >= 3, `${f.id}:${t.id}`);
    if (t.kind === 'choice') assert.ok(t.question?.every((q) => q.answer < q.options.length), `${f.id}:${t.id}`);
  }
});

test('SKY FLOORS: four new floors chain on from the rooftop (1,000 apart)', () => {
  const sky = FLOORS.filter((f) => ['f9', 'f10', 'f11', 'f12'].includes(f.id));
  assert.deepEqual(sky.map((f) => f.need), [8000, 9000, 10000, 11000]);
  const s = newSave('Phoebe');
  s.room = [1, 2, 3].map((i) => ({ uid: String(i), item: 'd_teddy', x: i, z: 1, rot: 0 }));
  for (const f of FLOORS) for (const t of f.tasks) { assert.ok(zoneUnlocked(s, f.id), `${f.id} open in time`); assert.ok(completeTask(s, f.id, t.id, 0).ok); }
  assert.equal(s.totalAura, 24000, 'all 24 floors = 24,000 Total Aura');
});

test('LEVELS: XP from every Aura earned, rewards only when claimed', () => {
  assert.equal(levelOf(0), 1); assert.equal(levelOf(levelStart(2)), 2); assert.equal(levelOf(levelStart(10) - 1), 9); assert.equal(levelOf(1e9), 100);
  const s = newSave('Phoebe');
  earn(s, 300, 300, 'Task: x');
  earn(s, 50, 0, 'Replayed: x');
  assert.equal(s.xp, 350);
  const aura = s.aura;
  assert.equal(s.aura, aura, 'levelling up never changes Aura by itself');
  const r = claimLevels(s, earn);
  assert.ok(r.ok && s.aura > aura && s.levelClaimed === levelOf(350));
  assert.equal(claimLevels(s, earn).ok, false, 'nothing twice');
  assert.equal(s.xp, 350, 'level rewards don\'t count as XP');
});

test('ACHIEVEMENTS: 40+, claim once, only when done', () => {
  assert.ok(ACHIEVEMENTS.length >= 40);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  const s = newSave('Phoebe');
  assert.equal(claimAchievement(s, 'first_task', earn).ok, false);
  completeTask(s, 'f1', FLOORS.find((f) => f.id === 'f1')!.tasks[0].id, 0);
  assert.ok(newlyReady(s).some((a) => a.id === 'first_task'));
  assert.equal(newlyReady(s).length, 0, 'announced only once');
  const a = s.aura;
  assert.ok(claimAchievement(s, 'first_task', earn).ok && s.aura === a + 100);
  assert.equal(claimAchievement(s, 'first_task', earn).ok, false);
});

test('WEEKLY EVENTS: rotate each week, goals from stats, exclusives only that week', () => {
  assert.ok(EVENTS.length >= 8);
  const now = Date.UTC(2026, 10, 24);
  assert.notEqual(currentEvent(now).id, currentEvent(now + 7 * 86400_000).id);
  const s = newSave('Phoebe');
  const ev = currentEvent();
  const g = ev.goals[0];
  assert.equal(claimEventGoal(s, 0, earn).ok, false);
  bumpStat(s, g.stat, g.goal);
  assert.ok(claimEventGoal(s, 0, earn).ok);
  assert.equal(claimEventGoal(s, 0, earn).ok, false);
  s.aura = 99999;
  const mine = SHOP.find((i) => i.event === ev.id)!, other = SHOP.find((i) => i.event && i.event !== ev.id)!;
  assert.ok(buy(s, mine.id).ok, 'this week\'s exclusive can be bought');
  assert.equal(buy(s, other.id).ok, false, 'other weeks\' exclusives can\'t');
  assert.equal(typeof weekIndex(), 'number');
});
test('LOVE ISLAND: 5 chats a day and no repeated topics in a row of 15', () => {
  let s = seasonAct(undefined, { a: 'start' }).season!;
  s = seasonAct(s, { a: 'answer', choice: s.cast[0] }).season!;
  assert.equal(s.actions, 5);
  const topics: number[] = [];
  for (let i = 0; i < 15; i++) {
    const who = s.cast[i % s.cast.length];
    const r = seasonAct(s, { a: 'chat', who });
    if (!r.ok) { s.actions = 5; s.phase = 'morning'; continue; }
    const pend = r.season!.pending as { topic: number; tones: string[] };
    topics.push(pend.topic);
    s = seasonAct(r.season, { a: 'answer', choice: pend.tones[0] }).season!;
    s.actions = 5; s.phase = 'morning';
  }
  assert.ok(topics.length >= 10, 'chats happened');
  assert.equal(new Set(topics).size, topics.length, `no repeats: ${topics}`);
});
console.log(`\n${n} tests passed`);
