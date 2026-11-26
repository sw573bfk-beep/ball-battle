import type { ZoneId } from './people';
import { RESIDENTS, findResident, type Home } from './people';
import { ALL_ZONES, FLOORS, REPLAY_AURA, TASK_AURA, floorById, zoneNeed } from './floors';
import { FREE_ITEMS, SHOP, shopItem, stackable, type WearSlot } from './shop';

import { BADGES, BEARDS, BOTTOMS, BUILDS, HAIR_COLORS, HAIR_STYLES, HEIGHTS, SHOES, SKINS, TOPS, isHex, normalizeLook, type Look, type Profile } from './look';
export type { Look } from './look';
export { HAIR_COLORS, HAIR_STYLES, SKINS } from './look';
import type { Season } from './season';
import { currentEvent, levelBadgesFor, levelOf, rollWeek } from './progress';
import type { QuestState } from './quests';
import { addPetXp, earnedBadges, upgradeBonus } from './progress2';

export type PetKind = 'dog' | 'cat' | 'bunny';

/** One line of a player's Aura history. d = Available change, t = Total change. */
export interface AuraEntry { at: number; d: number; t: number; why: string }

/** The one place Aura changes — also writes the player's Aura history. */
export function earn(save: Save, d: number, t: number, why: string): void {
  // Mansion upgrades: +3% each on Aura earned by playing (not on rewards you claim).
  if (d > 0 && save.upgrades?.length && /^(Task:|Replayed:|Soccer|Kart lap|Love Island|Golden shell|Danced|Won a game of tag|Villa:)/.test(why)) d = Math.round(d * (1 + upgradeBonus(save)));
  // XP (for levels) counts every Aura you earn — but not rewards from levels/achievements themselves.
  if ((d > 0 || t > 0) && !/^(Level rewards|Achievement|Adjusted)/.test(why)) save.xp = (save.xp ?? save.totalAura) + Math.max(d, t);
  save.aura = Math.max(0, save.aura + d);
  save.totalAura = Math.max(0, save.totalAura + t);
  save.auraLog ??= [];
  save.auraLog.unshift({ at: Date.now(), d, t, why: why.slice(0, 60) });
  if (save.auraLog.length > 40) save.auraLog.length = 40;
}

export interface PlacedItem {
  uid: string;
  item: string;
  x: number;
  z: number;
  rot: number;
  /** Any colour for the item's main colour. */
  color?: string;
  /** Size, 0.5–1.8. */
  scale?: number;
}

/** Your bedroom's look. */
export interface RoomStyle { wall?: string; floor?: string; tint?: string; /** Hide the bedroom's built-in furniture. */ empty?: boolean }
export const ROOM_FLOORS = ['wood', 'darkwood', 'marble', 'tile', 'carpet', 'pinkcarpet', 'terrazzo', 'stone', 'deck', 'grass', 'sand'] as const;

export interface DailyState {
  date: string;
  stats: Record<string, number>;
  claimed: string[];
}

export interface VillaState {
  points: number;
  partner?: string;   // resident name or 'npc:<Name>'
  look?: Look;        // villa avatar
  wins: number;
  cooldowns: Record<string, number>;
  season?: Season;
}

export interface Save {
  name: string;
  totalAura: number;
  aura: number;
  tasks: Record<string, true>;
  inventory: Record<string, number>;
  look: Look;
  room: PlacedItem[];
  vip: boolean;
  carPaint: Record<string, string>;
  car: string;
  daily: DailyState;
  villa: VillaState;
  lastZone: ZoneId;
  /** Your own bedroom (founders have fixed ones; newcomers get one when approved). */
  home?: Home;
  pet?: { kind: PetKind; name: string; fur?: string; collar?: string; xp?: number };
  /** Collection-book milestones claimed (percent). */
  collect?: number[];
  /** Daily login streak. */
  streak?: { last: string; days: number; best: number; claimed: string };
  /** Mansion upgrades bought, in order. */
  upgrades?: string[];
  /** Saved looks (up to 6). */
  outfits?: { name: string; look: Look }[];
  profile?: Profile;
  roomStyle?: RoomStyle;
  carWheels?: Record<string, string>;
  spinDate?: string;
  shells?: string[];
  bestLap?: number;
  auraLog?: AuraEntry[];
  /** Level XP (every Aura earned) and the highest level whose reward was claimed. */
  xp?: number;
  levelClaimed?: number;
  /** Claimed achievements (id → when), and ones already announced as ready. */
  ach?: Record<string, number>;
  achSeen?: string[];
  /** Lifetime counters (tasks, chat, swim seconds, …). */
  life?: Record<string, number>;
  /** Quest progress by quest id. */
  quests?: Record<string, QuestState>;
  /** This week's event progress. */
  week?: { id: string; stats: Record<string, number>; claimed: number[] };
  /** When each task's replay bonus was last paid (stops spam-clicking for Aura). */
  replayAt?: Record<string, number>;
}


export function defaultLook(name: string): Look {
  // A little variety so people don't all start identical.
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const boy = name === 'Beau' || name === 'Keola';
  return normalizeLook({
    body: boy ? 'boy' : 'girl',
    skin: SKINS[1 + (h % 4)],
    hair: boy ? ['crop', 'quiff', 'surfer'][h % 3] : ['long', 'waves', 'sleekpony', 'lob'][h % 4],
    hairColor: HAIR_COLORS[1 + (h % 5)],
    outfit: ['fit_pink', 'fit_blue', 'fit_white'][h % 3],
  });
}

export function today(now = Date.now()): string {
  // Days roll over at midnight Australian Eastern time (UTC+10).
  return new Date(now + 10 * 3600_000).toISOString().slice(0, 10);
}

export function newSave(name: string, home?: Home): Save {
  const founder = findResident(name);
  home ??= founder ? { zone: founder.home, room: founder.room } : undefined;
  const inventory: Record<string, number> = {};
  for (const id of FREE_ITEMS) inventory[id] = 1;
  return {
    name,
    totalAura: 0,
    aura: 0,
    tasks: {},
    inventory,
    look: defaultLook(name),
    room: [],
    vip: false,
    carPaint: {},
    car: 'car_hatch',
    daily: { date: today(), stats: {}, claimed: [] },
    villa: { points: 0, wins: 0, cooldowns: {} },
    lastZone: home?.zone ?? 'f1',
    home,
  };
}

// ---------------------------------------------------------------- progress

export function zoneUnlocked(save: Save, zone: ZoneId): boolean {
  return save.totalAura >= zoneNeed(zone);
}

/** Your home floor is always open so you can get to your own bedroom. */
export function canEnter(save: Save, zone: ZoneId): boolean {
  if (zoneUnlocked(save, zone)) return true;
  return save.home?.zone === zone;
}

/** The highest floor the player has unlocked (for the leaderboard). */
export function topFloor(save: Save): ZoneId {
  let top: ZoneId = 'f1';
  for (const f of FLOORS) if (!f.outside && !f.suite && zoneUnlocked(save, f.id)) top = f.id;
  return top;
}

export function floorDone(save: Save, zone: ZoneId): number {
  const f = floorById(zone);
  if (!f) return 0;
  return f.tasks.filter((t) => save.tasks[`${zone}:${t.id}`]).length;
}

export type Result = { ok: true; msg: string } | { ok: false; msg: string };

/** A finished task can pay its replay bonus once every 2 minutes. */
export const REPLAY_COOLDOWN = 2 * 60_000;

export function completeTask(save: Save, zone: ZoneId, taskId: string, now = Date.now()): Result {
  const f = floorById(zone);
  const task = f?.tasks.find((t) => t.id === taskId);
  if (!f || !task) return { ok: false, msg: 'That task does not exist.' };
  if (!zoneUnlocked(save, zone)) return { ok: false, msg: `${f.name} is still locked.` };
  if (task.kind === 'decorate' && save.room.length < (task.count ?? 1)) {
    return { ok: false, msg: `Place ${task.count} decoration${task.count === 1 ? '' : 's'} in your bedroom first.` };
  }
  const key = `${zone}:${taskId}`;
  if (save.tasks[key]) {
    const last = save.replayAt?.[key] ?? 0;
    const wait = Math.ceil((last + REPLAY_COOLDOWN - now) / 1000);
    if (wait > 0) return { ok: false, msg: `You just did this one! Replay it again in ${wait >= 60 ? Math.ceil(wait / 60) + ' min' : wait + 's'}.` };
    save.replayAt ??= {};
    save.replayAt[key] = now;
    bumpStat(save, 'tasks', 1);
    bumpStat(save, `tz_${zone}`, 1);
    earn(save, REPLAY_AURA, 0, `Replayed: ${task.label}`);
    return { ok: true, msg: `+${REPLAY_AURA} Aura (replay bonus)` };
  }
  bumpStat(save, 'tasks', 1);
  bumpStat(save, `tz_${zone}`, 1);
  const before = ALL_ZONES.filter((z) => zoneUnlocked(save, z));
  save.tasks[key] = true;
  earn(save, TASK_AURA, TASK_AURA, `Task: ${task.label}`);
  const after = ALL_ZONES.filter((z) => zoneUnlocked(save, z) && !before.includes(z));
  const unlocked = after.length ? ` — unlocked ${after.map(label).join(' & ')}!` : '';
  return { ok: true, msg: `+${TASK_AURA} Aura: ${task.label}${unlocked}` };
}

function label(z: ZoneId): string {
  if (z === 'villa') return 'Love Island Mode';
  const f = floorById(z);
  return f ? f.name.split(' – ')[0] : z;
}

export function buy(save: Save, itemId: string): Result {
  const item = shopItem(itemId);
  if (!item) return { ok: false, msg: 'Unknown item.' };
  if (item.vip && !save.vip) return { ok: false, msg: 'That item is VIP only.' };
  if (item.floor && !zoneUnlocked(save, item.floor)) return { ok: false, msg: `Unlock ${label(item.floor)} to buy this.` };
  if (item.event && currentEvent().id !== item.event) return { ok: false, msg: 'That was a limited event item — look out for it next time!' };
  const owned = save.inventory[itemId] ?? 0;
  if (!stackable(item) && owned > 0) return { ok: false, msg: 'You already own this.' };
  if (save.aura < item.price) return { ok: false, msg: `You need ${item.price - save.aura} more Aura.` };
  earn(save, -item.price, 0, `Bought ${item.name}`);
  save.inventory[itemId] = owned + 1;
  bumpStat(save, 'buys', 1);
  return { ok: true, msg: `Bought ${item.name}!` };
}

/** Cleans a look so it only uses valid values and things the player owns. */
export function cleanLook(save: Save, look: Look): Look {
  const cur = normalizeLook(save.look);
  const pick = <T,>(v: T | undefined, ok: readonly T[], fallback: T | undefined): T | undefined => (v !== undefined && ok.includes(v) ? v : fallback);
  const hex = (v: unknown, fallback: string | undefined) => (isHex(v) ? v.toLowerCase() : fallback);
  const clean: Look = {
    body: look.body === 'boy' ? 'boy' : 'girl',
    skin: hex(look.skin, cur.skin)!,
    hair: pick(look.hair, HAIR_STYLES, cur.hair)!,
    hairColor: hex(look.hairColor, cur.hairColor)!,
    outfit: save.inventory[look.outfit] ? look.outfit : cur.outfit,
    build: pick(look.build, BUILDS.map((b) => b.id), cur.build),
    height: pick(look.height, HEIGHTS.map((b) => b.id), cur.height),
    eyes: hex(look.eyes, cur.eyes),
    lips: hex(look.lips, cur.lips),
    beard: pick(look.beard, BEARDS.map((b) => b.id), cur.beard),
  };
  // Mix & match pieces (free) and any colours.
  const top = pick(look.top, TOPS.map((t) => t.id), undefined);
  const bottom = pick(look.bottom, BOTTOMS.map((t) => t.id), undefined);
  const shoes = pick(look.shoes, SHOES.map((t) => t.id), undefined);
  if (top) clean.top = top;
  if (bottom) clean.bottom = bottom;
  if (shoes) clean.shoes = shoes;
  const colors: NonNullable<Look['colors']> = {};
  for (const k of ['top', 'bottom', 'shoes'] as const) { const c = look.colors?.[k]; if (isHex(c)) colors[k] = c.toLowerCase(); }
  if (Object.keys(colors).length) clean.colors = colors;
  const slots: WearSlot[] = ['glasses', 'bag', 'jewel', 'hat', 'perfume'];
  for (const s of slots) {
    const v = (look as unknown as Record<string, string | undefined>)[s];
    if (v && save.inventory[v] && shopItem(v)?.slot === s) (clean as unknown as Record<string, string>)[s] = v;
  }
  return clean;
}

/** Equips a look, but only with things the player owns. */
export function setLook(save: Save, look: Look): Result {
  save.look = cleanLook(save, look);
  return { ok: true, msg: 'Look saved!' };
}

export const MAX_OUTFITS = 6;

export function saveOutfit(save: Save, slot: number, name: string, look: Look): Result {
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_OUTFITS) return { ok: false, msg: 'Pick a slot.' };
  save.outfits ??= [];
  const clean = cleanText(name, 16) || `Look ${slot + 1}`;
  while (save.outfits.length < slot) save.outfits.push({ name: `Look ${save.outfits.length + 1}`, look: save.look });
  save.outfits[slot] = { name: clean, look: cleanLook(save, look) };
  bumpStat(save, 'outfit', 1);
  return { ok: true, msg: `💾 Saved "${clean}"!` };
}

const RUDE = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'sex', 'porn', 'nazi', 'slut', 'whore', 'nigg', 'fag', 'rape', 'kill yourself', 'kys'];
/** Trims text and blanks out rude words. */
export function cleanText(raw: unknown, max: number): string {
  let t = String(raw ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  for (const w of RUDE) t = t.replace(new RegExp(w, 'gi'), '♥'.repeat(Math.min(4, w.length)));
  return t;
}

export function setProfile(save: Save, p: Profile): Result {
  save.profile = {
    color: isHex(p.color) ? p.color.toLowerCase() : undefined,
    badge: [...BADGES, ...levelBadgesFor(levelOf(save.xp ?? 0)), ...earnedBadges(save)].includes(String(p.badge ?? '')) ? String(p.badge ?? '') : '',
    bio: cleanText(p.bio, 80),
  };
  return { ok: true, msg: '✨ Profile saved!' };
}

export function setRoomStyle(save: Save, r: RoomStyle): Result {
  if (!save.home) return { ok: false, msg: "You don't have a bedroom yet." };
  save.roomStyle = {
    wall: isHex(r.wall) ? r.wall.toLowerCase() : undefined,
    floor: (ROOM_FLOORS as readonly string[]).includes(String(r.floor)) ? String(r.floor) : undefined,
    tint: isHex(r.tint) ? r.tint.toLowerCase() : undefined,
    ...(r.empty === true ? { empty: true } : {}),
  };
  return { ok: true, msg: '🎨 Bedroom updated!' };
}

export const ROOM_LIMIT = 30;

export function placeItems(save: Save, items: PlacedItem[]): Result {
  if (items.length > ROOM_LIMIT) return { ok: false, msg: `Max ${ROOM_LIMIT} items in a room.` };
  const counts: Record<string, number> = {};
  for (const it of items) {
    counts[it.item] = (counts[it.item] ?? 0) + 1;
    const item = shopItem(it.item);
    if (!item || item.cat !== 'furniture') return { ok: false, msg: 'You can only place furniture.' };
    if (counts[it.item] > (save.inventory[it.item] ?? 0)) return { ok: false, msg: `You don't have another ${item.name}.` };
    if (![it.x, it.z, it.rot].every(Number.isFinite)) return { ok: false, msg: 'Bad position.' };
    if (it.color !== undefined && !isHex(it.color)) return { ok: false, msg: 'Bad colour.' };
    if (it.scale !== undefined && !(Number.isFinite(it.scale) && it.scale >= 0.5 && it.scale <= 1.8)) return { ok: false, msg: 'Bad size.' };
  }
  save.room = items.map((it) => ({ uid: String(it.uid).slice(0, 16), item: it.item, x: round(it.x), z: round(it.z), rot: round(it.rot), ...(isHex(it.color) ? { color: it.color.toLowerCase() } : {}), ...(it.scale && it.scale !== 1 ? { scale: round(it.scale) } : {}) }));
  return { ok: true, msg: 'Room saved!' };
}

const round = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- daily

export interface DailyDef {
  id: string;
  label: string;
  stat: string;
  goal: number;
  reward: number;
  vip?: boolean;
}

const DAILY_POOL: DailyDef[] = [
  { id: 'tasks3', label: 'Complete 3 tasks (replays count)', stat: 'tasks', goal: 3, reward: 150 },
  { id: 'floors4', label: 'Visit 4 different floors', stat: 'floors', goal: 4, reward: 100 },
  { id: 'chat3', label: 'Send 3 chat messages', stat: 'chat', goal: 3, reward: 100 },
  { id: 'drive60', label: 'Drive for 60 seconds', stat: 'drive', goal: 60, reward: 150 },
  { id: 'emote5', label: 'Do 5 emotes', stat: 'emote', goal: 5, reward: 100 },
  { id: 'buy1', label: 'Buy something from the shop', stat: 'buys', goal: 1, reward: 100 },
  { id: 'swim', label: 'Spend 30 seconds in a pool', stat: 'swim', goal: 30, reward: 120 },
  { id: 'pets', label: 'Pat the pets 5 times', stat: 'pats', goal: 5, reward: 100 },
];

export const VIP_DAILY: DailyDef = { id: 'vip', label: 'VIP: Visit the rooftop cabana', stat: 'cabana', goal: 1, reward: 300, vip: true };

export function dailyFor(date: string): DailyDef[] {
  let h = 0;
  for (const c of date) h = (h * 131 + c.charCodeAt(0)) >>> 0;
  const pool = [...DAILY_POOL];
  const out: DailyDef[] = [];
  for (let i = 0; i < 3; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    out.push(pool.splice(h % pool.length, 1)[0]);
  }
  return out;
}

export function rollDaily(save: Save, now = Date.now()): void {
  const d = today(now);
  if (save.daily.date !== d) save.daily = { date: d, stats: {}, claimed: [] };
}

export function bumpStat(save: Save, stat: string, by: number): void {
  rollDaily(save);
  save.daily.stats[stat] = Math.min(9999, (save.daily.stats[stat] ?? 0) + by);
  save.life ??= {};
  save.life[stat] = Math.min(1e7, (save.life[stat] ?? 0) + by);
  addPetXp(save, stat, by);
  rollWeek(save);
  save.week!.stats[stat] = Math.min(99999, (save.week!.stats[stat] ?? 0) + by);
}

export function claimDaily(save: Save, id: string): Result {
  rollDaily(save);
  const def = [...dailyFor(save.daily.date), VIP_DAILY].find((d) => d.id === id);
  if (!def) return { ok: false, msg: 'That challenge is not on today.' };
  if (def.vip && !save.vip) return { ok: false, msg: 'VIP only.' };
  if (save.daily.claimed.includes(id)) return { ok: false, msg: 'Already claimed today.' };
  if ((save.daily.stats[def.stat] ?? 0) < def.goal) return { ok: false, msg: 'Not finished yet.' };
  save.daily.claimed.push(id);
  earn(save, def.reward, def.reward, `Daily: ${def.label}`);
  save.life ??= {};
  save.life.daily = (save.life.daily ?? 0) + 1;
  return { ok: true, msg: `+${def.reward} Aura: daily challenge done!` };
}

/** Upgrades older saves so new fields always exist. */
export function migrate(raw: Partial<Save> & { name: string }): Save {
  const founder = findResident(raw.name);
  const base = newSave(raw.name, founder ? { zone: founder.home, room: founder.room } : raw.home);
  const s = { ...base, ...raw } as Save;
  s.villa = { ...base.villa, ...(raw.villa ?? {}) };
  s.daily = raw.daily ?? base.daily;
  if (founder) s.home = { zone: founder.home, room: founder.room };
  s.look = normalizeLook(s.look);
  if (s.villa.look) s.villa.look = normalizeLook(s.villa.look);
  for (const id of FREE_ITEMS) if (!s.inventory[id]) s.inventory[id] = 1;
  s.xp = Math.max(s.xp ?? 0, s.totalAura); // XP always covers at least your Total Aura
  s.levelClaimed ??= 1;
  return s;
}

export const RESIDENT_NAMES = RESIDENTS.map((r) => r.name);


// ---------------------------------------------------------------- fun stuff

export const SPIN_PRIZES: { label: string; emoji: string; w: number; aura?: number; item?: string; n?: number; surprise?: boolean }[] = [
  { label: '50 Aura', emoji: '💎', w: 30, aura: 50 },
  { label: '100 Aura', emoji: '💎', w: 24, aura: 100 },
  { label: '150 Aura', emoji: '💎', w: 14, aura: 150 },
  { label: '3 Fireworks', emoji: '🎆', w: 12, item: 'fx_fireworks', n: 3 },
  { label: '250 Aura', emoji: '💰', w: 9, aura: 250 },
  { label: 'Surprise item', emoji: '🎁', w: 7, surprise: true },
  { label: '500 Aura', emoji: '🤑', w: 4, aura: 500 },
];

/** Daily spin. `roll` is 0..1 (random on the server). */
export function spin(save: Save, roll: number, pickRoll = Math.random()): Result & { index?: number } {
  const d = today();
  if (save.spinDate === d) return { ok: false, msg: 'You already spun today — come back tomorrow! 🎡' };
  bumpStat(save, 'spin', 1);
  const total = SPIN_PRIZES.reduce((a, p) => a + p.w, 0);
  let r = roll * total, index = 0;
  while (index < SPIN_PRIZES.length - 1 && r >= SPIN_PRIZES[index].w) { r -= SPIN_PRIZES[index].w; index++; }
  const prize = SPIN_PRIZES[index];
  save.spinDate = d;
  if (prize.aura) { earn(save, prize.aura, 0, 'Daily spin'); return { ok: true, msg: `🎡 You won ${prize.label}!`, index }; }
  if (prize.item) { save.inventory[prize.item] = (save.inventory[prize.item] ?? 0) + (prize.n ?? 1); return { ok: true, msg: `🎡 You won ${prize.label}!`, index }; }
  const pool = SHOP.filter((i) => (i.cat === 'accessory' || i.cat === 'furniture') && !i.vip && !i.free && i.price <= 600 && !save.inventory[i.id]);
  if (!pool.length) { earn(save, 300, 0, 'Daily spin'); return { ok: true, msg: '🎡 Surprise! You already own everything, so here\'s 300 Aura.', index }; }
  const it = pool[Math.floor(pickRoll * pool.length)];
  save.inventory[it.id] = (save.inventory[it.id] ?? 0) + 1;
  return { ok: true, msg: `🎡 Surprise! You won ${it.emoji} ${it.name}!`, index };
}

/** Golden shells hidden per zone (30 in total). */
export const SHELLS: Partial<Record<ZoneId, number>> = { b: 2, f1: 3, f2: 3, f3: 3, f4: 3, f5: 3, f6: 3, f7: 3, f8: 3, park: 2, villa: 2 };
export const SHELL_TOTAL: number = Object.values(SHELLS).reduce((a: number, b) => a + (b ?? 0), 0);
export const SHELL_AURA = 25;
export const SHELL_BONUS = 1000;

export function collectShell(save: Save, id: string): Result {
  const m = /^([a-z0-9]+):(\d)$/.exec(id);
  const count = m ? SHELLS[m[1] as ZoneId] : undefined;
  if (!m || count === undefined || Number(m[2]) >= count) return { ok: false, msg: 'Hmm, that shell looks fake. 🤔' };
  save.shells ??= [];
  if (save.shells.includes(id)) return { ok: false, msg: 'You already found this one!' };
  save.shells.push(id);
  bumpStat(save, 'shell', 1);
  earn(save, SHELL_AURA, 0, 'Golden shell');
  if (save.shells.length >= SHELL_TOTAL) {
    earn(save, SHELL_BONUS, 0, 'Found all golden shells!');
    return { ok: true, msg: `🐚 ALL ${SHELL_TOTAL} GOLDEN SHELLS FOUND! +${SHELL_BONUS} Aura bonus! 🏆` };
  }
  return { ok: true, msg: `🐚 Golden shell ${save.shells.length}/${SHELL_TOTAL}! +${SHELL_AURA} Aura` };
}

/**
 * The race is ~100 m and the fastest car with boost does ~22 m/s, so a real lap takes
 * at least ~5 s. Anything under 4.5 s can't happen without cheating.
 */
export const MIN_LAP_MS = 4500;
/** Laps that pay Aura each day (best times always count). */
export const PAID_LAPS_PER_DAY = 10;

export function recordLap(save: Save, ms: number): Result {
  if (!Number.isFinite(ms) || ms < MIN_LAP_MS || ms > 600_000) return { ok: false, msg: 'That lap time looks too fast to be real — try again!' };
  const t = Math.round(ms);
  const best = !save.bestLap || t < save.bestLap;
  if (best) save.bestLap = t;
  rollDaily(save);
  const paid = (save.daily.stats.laps ?? 0) < PAID_LAPS_PER_DAY;
  bumpStat(save, 'laps', 1);
  if (paid) earn(save, 20, 0, 'Kart lap');
  return { ok: true, msg: `🏁 Lap ${(t / 1000).toFixed(2)}s${best ? ' — new personal best! 🏆' : ''}${paid ? ' (+20 Aura)' : ''}` };
}

export function adoptPet(save: Save, kind: string, name: string, fur?: string, collar?: string): Result {
  if (!['dog', 'cat', 'bunny'].includes(kind)) return { ok: false, msg: 'Pick a puppy, kitten or bunny.' };
  const clean = cleanText(String(name).replace(/[^A-Za-z0-9 ]/g, ''), 12) || (kind === 'dog' ? 'Buddy' : kind === 'cat' ? 'Whiskers' : 'Bun Bun');
  const xp = save.pet?.xp; // renaming / recolouring keeps your pet's level
  save.pet = { kind: kind as PetKind, name: clean, ...(isHex(fur) ? { fur: fur.toLowerCase() } : {}), ...(isHex(collar) ? { collar: collar.toLowerCase() } : {}), ...(xp ? { xp } : {}) };
  return { ok: true, msg: `🐾 Say hi to ${clean}! They'll follow you everywhere.` };
}
