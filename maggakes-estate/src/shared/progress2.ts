/**
 * The long game: collection book, pet levels & tricks, login streaks, tiered
 * achievements and mansion upgrades. Rewards are always *claimed* (never automatic).
 */
import { SHOP } from './shop';
import type { Save } from './save';
import { ACHIEVEMENTS, levelOf, type Achievement } from './progress';

type Earn = (save: Save, d: number, t: number, why: string) => void;
type Result = { ok: true; msg: string } | { ok: false; msg: string };
const life = (s: Save, k: string) => s.life?.[k] ?? 0;

// ------------------------------------------------------------------ collection book

/** Everything you can collect: shop outfits, accessories, furniture and cars (not freebies or week-only items). */
export const COLLECTION = SHOP.filter((i) => !i.free && !i.event && ['outfit', 'accessory', 'furniture', 'car'].includes(i.cat) && i.id !== 'fit_villa');
export const collected = (s: Save) => COLLECTION.filter((i) => (s.inventory[i.id] ?? 0) > 0).length;
export const collectionPct = (s: Save) => Math.floor((collected(s) / COLLECTION.length) * 100);
export const COLLECTION_MILESTONES: { pct: number; aura: number; badge: string }[] = [
  { pct: 10, aura: 1000, badge: '📗' }, { pct: 25, aura: 3000, badge: '📘' }, { pct: 50, aura: 8000, badge: '📙' }, { pct: 75, aura: 20000, badge: '📕' }, { pct: 100, aura: 50000, badge: '🏅' },
];

export function claimCollection(s: Save, pct: number, earn: Earn): Result {
  const m = COLLECTION_MILESTONES.find((x) => x.pct === pct);
  if (!m) return { ok: false, msg: 'Unknown reward.' };
  s.collect ??= [];
  if (s.collect.includes(pct)) return { ok: false, msg: 'Already claimed!' };
  if (collectionPct(s) < pct) return { ok: false, msg: `Collect ${pct}% of items first.` };
  s.collect.push(pct);
  earn(s, m.aura, 0, `Collection ${pct}%`);
  return { ok: true, msg: `📖 Collection ${pct}%! +${m.aura.toLocaleString()} Aura and the ${m.badge} badge!` };
}

// ------------------------------------------------------------------ pets

export const PET_MAX = 50;
/** Pet XP needed to reach level L. */
export const petLevelStart = (L: number) => 40 * (L - 1) * L;
export const petLevel = (xp: number) => { let L = 1; while (L < PET_MAX && petLevelStart(L + 1) <= xp) L++; return L; };
/** How much pet XP each thing you do gives (your pet is always with you). */
export const PET_XP: Record<string, number> = { tasks: 20, pats: 15, matches: 40, goals: 15, laps: 15, slide: 10, dance: 5, emote: 1, chat: 1, swim: 0.2, drive: 0.2, spin: 20, daily: 30 };
export const PET_TRICKS: { level: number; id: string; label: string; emoji: string }[] = [
  { level: 1, id: 'sit', label: 'Sit', emoji: '🪑' }, { level: 5, id: 'spin', label: 'Spin', emoji: '🌀' }, { level: 10, id: 'jump', label: 'Jump', emoji: '⤴️' },
  { level: 15, id: 'roll', label: 'Roll over', emoji: '🔄' }, { level: 25, id: 'dance', label: 'Dance', emoji: '💃' }, { level: 35, id: 'flip', label: 'Backflip', emoji: '🤸' }, { level: 50, id: 'sparkle', label: 'Sparkle aura', emoji: '✨' },
];
export function addPetXp(s: Save, stat: string, by: number): void {
  if (!s.pet) return;
  const per = PET_XP[stat];
  if (!per || !Number.isFinite(by)) return;
  s.pet.xp = Math.min(petLevelStart(PET_MAX) + 1, (s.pet.xp ?? 0) + per * by);
}
export const petTricks = (s: Save) => PET_TRICKS.filter((t) => petLevel(s.pet?.xp ?? 0) >= t.level);

// ------------------------------------------------------------------ login streak

const day = (t: number) => new Date(t + 10 * 3600_000).toISOString().slice(0, 10); // Australian day
export const STREAK_MILESTONES: Record<number, { aura: number; badge?: string }> = {
  7: { aura: 1000, badge: '🔥' }, 14: { aura: 2000 }, 30: { aura: 5000, badge: '🌟' }, 50: { aura: 8000 }, 75: { aura: 12000 }, 100: { aura: 25000, badge: '💯' }, 200: { aura: 40000 }, 365: { aura: 100000, badge: '👑' },
};
/** Call when the player connects: keeps the streak going (or starts again after a missed day). */
export function rollStreak(s: Save, now = Date.now()): void {
  const today = day(now), yesterday = day(now - 86400_000);
  const st = s.streak ?? { last: '', days: 0, best: 0, claimed: '' };
  if (st.last === today) { s.streak = st; return; }
  st.days = st.last === yesterday ? st.days + 1 : 1;
  st.last = today;
  st.best = Math.max(st.best, st.days);
  s.streak = st;
}
export const streakReward = (days: number) => 50 + Math.min(days, 100) * 10 + (STREAK_MILESTONES[days]?.aura ?? 0);
export function claimStreak(s: Save, earn: Earn, now = Date.now()): Result {
  rollStreak(s, now);
  const st = s.streak!;
  if (st.claimed === st.last) return { ok: false, msg: 'Already claimed today — come back tomorrow! 🔥' };
  st.claimed = st.last;
  const aura = streakReward(st.days);
  earn(s, aura, 0, `Streak day ${st.days}`);
  s.life ??= {}; s.life.logins = (s.life.logins ?? 0) + 1;
  const ms = STREAK_MILESTONES[st.days];
  return { ok: true, msg: `🔥 Day ${st.days} streak! +${aura.toLocaleString()} Aura${ms?.badge ? ` and the ${ms.badge} badge` : ''}` };
}

// ------------------------------------------------------------------ mansion upgrades

export interface Upgrade { id: string; name: string; emoji: string; price: number; title: string; blurb: string }
/** Each upgrade adds +3% to the Aura you earn from playing, forever. */
export const UPGRADE_BONUS = 0.03;
export const UPGRADES: Upgrade[] = [
  { id: 'up_lights', name: 'Golden Lift Lights', emoji: '💡', price: 10000, title: 'Bright Spark', blurb: 'The lifts glow gold when you ride them.' },
  { id: 'up_fountain', name: 'Diamond Fountain', emoji: '⛲', price: 25000, title: 'Fountain Owner', blurb: 'A sparkling diamond fountain in the lobby.' },
  { id: 'up_garden', name: 'Royal Rose Garden', emoji: '🌹', price: 50000, title: 'Rose Royalty', blurb: 'Ten thousand roses, all yours.' },
  { id: 'up_cinema', name: 'IMAX Home Cinema', emoji: '🎬', price: 80000, title: 'Movie Mogul', blurb: 'The biggest screen in the southern hemisphere.' },
  { id: 'up_pool', name: 'Gold-Tiled Pool', emoji: '🏊', price: 120000, title: 'Golden Swimmer', blurb: 'Real gold tiles. Very slippery.' },
  { id: 'up_yacht', name: 'Private Yacht', emoji: '🛥️', price: 180000, title: 'Captain', blurb: 'Moored at Maggakes Beach.' },
  { id: 'up_jet', name: 'Private Jet', emoji: '🛩️', price: 260000, title: 'Jet Setter', blurb: 'Lands on the penthouse helipad.' },
  { id: 'up_island', name: 'Private Island', emoji: '🏝️', price: 380000, title: 'Island Owner', blurb: 'Your own tropical island.' },
  { id: 'up_statue', name: 'Giant Statue of You', emoji: '🗽', price: 520000, title: 'Living Legend', blurb: 'Visible from space (almost).' },
  { id: 'up_castle', name: 'Sky Castle', emoji: '🏰', price: 750000, title: 'Sky Royalty', blurb: 'A castle floating above the tower.' },
];
export const upgradeBonus = (s: Save) => (s.upgrades?.length ?? 0) * UPGRADE_BONUS;
export function buyUpgrade(s: Save, id: string, earn: Earn): Result {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return { ok: false, msg: 'Unknown upgrade.' };
  s.upgrades ??= [];
  if (s.upgrades.includes(id)) return { ok: false, msg: 'You already own this!' };
  const i = UPGRADES.indexOf(u);
  if (i > 0 && !s.upgrades.includes(UPGRADES[i - 1].id)) return { ok: false, msg: `Buy the ${UPGRADES[i - 1].name} first.` };
  if (s.aura < u.price) return { ok: false, msg: `You need ${(u.price - s.aura).toLocaleString()} more Aura.` };
  earn(s, -u.price, 0, `Upgrade: ${u.name}`);
  s.upgrades.push(id);
  return { ok: true, msg: `${u.emoji} ${u.name} built! You're now "${u.title}" and earn +${Math.round(upgradeBonus(s) * 100)}% Aura.` };
}
export const estateTitle = (s: Save) => { const last = s.upgrades?.[s.upgrades.length - 1]; return last ? UPGRADES.find((u) => u.id === last)?.title : undefined; };

// ------------------------------------------------------------------ tiered achievements (I–V)

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const TIER_EMOJI = ['🥉', '🥈', '🥇', '💎', '👑'];
interface Track { key: string; label: (n: number) => string; name: string; goals: number[]; reward: number[]; value: (s: Save) => number }
const T = (key: string, name: string, label: (n: number) => string, goals: number[], value: (s: Save) => number, base = 200): Track =>
  ({ key, name, label, goals, value, reward: goals.map((_, i) => base * [1, 2.5, 6, 15, 40][i]) });
const fmt = (n: number) => n.toLocaleString('en-AU');
export const TRACKS: Track[] = [
  T('tasks', 'Hard Worker', (n) => `Do ${fmt(n)} tasks`, [25, 150, 600, 2500, 10000], (s) => life(s, 'tasks')),
  T('chat', 'Social Butterfly', (n) => `Send ${fmt(n)} chat messages`, [25, 150, 600, 2500, 10000], (s) => life(s, 'chat')),
  T('emote', 'Show-off', (n) => `Do ${fmt(n)} emotes`, [50, 250, 1000, 4000, 15000], (s) => life(s, 'emote')),
  T('swim', 'Mermaid', (n) => `Swim for ${fmt(Math.round(n / 60))} minutes`, [600, 3600, 14400, 54000, 180000], (s) => life(s, 'swim')),
  T('drive', 'Road Warrior', (n) => `Drive for ${fmt(Math.round(n / 60))} minutes`, [600, 3600, 14400, 54000, 180000], (s) => life(s, 'drive')),
  T('pats', 'Pet Lover', (n) => `Pat pets ${fmt(n)} times`, [25, 150, 600, 2500, 10000], (s) => life(s, 'pats')),
  T('laps', 'Speedster', (n) => `Finish ${fmt(n)} kart laps`, [10, 50, 200, 800, 3000], (s) => life(s, 'laps')),
  T('dance', 'Dancing Queen', (n) => `Dance at parties ${fmt(n)} times`, [25, 150, 600, 2500, 8000], (s) => life(s, 'dance')),
  T('matches', 'Soccer Star', (n) => `Play ${fmt(n)} soccer matches`, [3, 25, 100, 400, 1500], (s) => life(s, 'matches'), 300),
  T('wins', 'Champion', (n) => `Win ${fmt(n)} soccer matches`, [1, 15, 60, 250, 1000], (s) => life(s, 'wins'), 300),
  T('goals', 'Goal Machine', (n) => `Score ${fmt(n)} goals`, [1, 25, 150, 600, 2500], (s) => life(s, 'goals'), 300),
  T('spin', 'Lucky Wheel', (n) => `Spin the wheel ${fmt(n)} times`, [7, 30, 100, 250, 500], (s) => life(s, 'spin')),
  T('daily', 'Daily Hero', (n) => `Claim ${fmt(n)} daily challenges`, [10, 50, 200, 600, 1500], (s) => life(s, 'daily')),
  T('villaday', 'Islander', (n) => `Play ${fmt(n)} Love Island days`, [10, 60, 250, 1000, 4000], (s) => life(s, 'villaday')),
  T('tagwin', 'Too Fast to Catch', (n) => `Win ${fmt(n)} games of tag`, [3, 20, 100, 400, 1500], (s) => life(s, 'tagwin')),
  T('slide', 'Splash!', (n) => `Go down the water slide ${fmt(n)} times`, [10, 50, 200, 800, 3000], (s) => life(s, 'slide')),
  T('outfit', 'Wardrobe Queen', (n) => `Save ${fmt(n)} outfits`, [5, 25, 100, 300, 1000], (s) => life(s, 'outfit')),
  T('buys', 'Big Spender', (n) => `Buy ${fmt(n)} things`, [10, 40, 120, 300, 800], (s) => life(s, 'buys')),
  T('logins', 'Always Here', (n) => `Claim ${fmt(n)} streak rewards`, [7, 30, 100, 250, 500], (s) => life(s, 'logins')),
  T('streak', 'On Fire', (n) => `Reach a ${fmt(n)}-day streak`, [7, 30, 60, 100, 365], (s) => s.streak?.best ?? 0, 400),
  T('level', 'Level Up', (n) => `Reach level ${n}`, [15, 30, 50, 75, 100], (s) => levelOf(s.xp ?? 0), 400),
  T('xp', 'Aura Machine', (n) => `Earn ${fmt(n)} XP`, [25000, 100000, 300000, 800000, 2000000], (s) => s.xp ?? 0, 400),
  T('collect', 'Collector', (n) => `Collect ${n}% of all items`, [10, 25, 50, 75, 100], (s) => collectionPct(s), 400),
  T('petlv', 'Best Friends', (n) => `Get your pet to level ${n}`, [5, 15, 25, 40, 50], (s) => petLevel(s.pet?.xp ?? 0), 400),
  T('upgrades', 'Estate Tycoon', (n) => `Build ${n} mansion upgrade${n > 1 ? 's' : ''}`, [1, 3, 5, 8, 10], (s) => s.upgrades?.length ?? 0, 500),
];

/** Every tier of every track as an Achievement (ids like "t_tasks_2"). */
export const TIERED: Achievement[] = TRACKS.flatMap((tr) => tr.goals.map((g, i) => ({
  id: `t_${tr.key}_${i + 1}`, emoji: TIER_EMOJI[i], label: `${tr.name} ${ROMAN[i]}`, desc: tr.label(g), reward: Math.round(tr.reward[i]),
  progress: (s: Save): [number, number] => [Math.min(tr.value(s), g), g],
})));

/** Badges won from the collection book and login streak milestones. */
export function earnedBadges(s: Save): string[] {
  const out: string[] = [];
  for (const m of COLLECTION_MILESTONES) if (s.collect?.includes(m.pct)) out.push(m.badge);
  for (const [d, m] of Object.entries(STREAK_MILESTONES)) if (m.badge && (s.streak?.best ?? 0) >= Number(d)) out.push(m.badge);
  return out;
}

// Add the tiers to the main achievement list (claiming and "unlocked!" toasts use it).
for (const a of TIERED) if (!ACHIEVEMENTS.some((x) => x.id === a.id)) ACHIEVEMENTS.push(a);
