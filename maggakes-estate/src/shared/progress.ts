/**
 * Long-term progress: player levels (1–100), achievements and weekly events.
 * Pure logic shared by server and client. Rewards are *claimed* (never given
 * automatically), so Aura only changes when a player presses Claim.
 */
import { ALL_ZONES, FLOORS } from './floors';
import type { Save } from './save';

type Earn = (save: Save, d: number, t: number, why: string) => void;
type Result = { ok: true; msg: string } | { ok: false; msg: string };

// ------------------------------------------------------------------ levels

export const MAX_LEVEL = 100;
/** XP needed to *reach* level L (level 1 = 0 XP). */
export const levelStart = (L: number) => 50 * (L - 1) * L;
export function levelOf(xp: number): number {
  let L = 1;
  while (L < MAX_LEVEL && levelStart(L + 1) <= xp) L++;
  return L;
}

/** Profile badges unlocked by levels. */
export const LEVEL_BADGES: Record<number, string> = { 5: '🥉', 10: '🥈', 15: '🥇', 20: '💎', 25: '🔥', 30: '🦄', 40: '🌈', 50: '🌟', 60: '🚀', 75: '👑', 90: '🐉', 100: '🏆' };
/** Free items unlocked by levels (shop ids). */
export const LEVEL_ITEMS: Record<number, string> = { 8: 'd_lava', 12: 'd_arcade', 16: 'fit_neon', 18: 'd_snowman', 24: 'd_popcorn', 28: 'fit_snow', 35: 'd_piano', 45: 'fit_starlight', 55: 'd_fireplace', 70: 'd_champagne', 85: 'fit_penthouse', 100: 'd_claw' };

export interface LevelReward { level: number; aura: number; badge?: string; item?: string }
export function levelReward(L: number): LevelReward {
  return { level: L, aura: Math.min(1000, 100 + L * 15) + (L % 10 === 0 ? 1000 : 0), badge: LEVEL_BADGES[L], item: LEVEL_ITEMS[L] };
}

export function levelBadgesFor(level: number): string[] {
  return Object.entries(LEVEL_BADGES).filter(([l]) => Number(l) <= level).map(([, b]) => b);
}

/** Claims every level reward up to your current level. */
export function claimLevels(save: Save, earn: Earn): Result {
  const L = levelOf(save.xp ?? 0);
  const from = (save.levelClaimed ?? 1) + 1;
  if (from > L) return { ok: false, msg: 'No new level rewards yet — keep earning Aura!' };
  let aura = 0;
  const items: string[] = [];
  for (let l = from; l <= L; l++) {
    const r = levelReward(l);
    aura += r.aura;
    if (r.item) { save.inventory[r.item] = (save.inventory[r.item] ?? 0) + 1; items.push(r.item); }
  }
  save.levelClaimed = L;
  earn(save, aura, 0, `Level rewards (Lv ${from}${L > from ? `–${L}` : ''})`);
  return { ok: true, msg: `⭐ Claimed Lv ${from}${L > from ? `–${L}` : ''} rewards: +${aura} Aura${items.length ? ` and ${items.length} free item${items.length > 1 ? 's' : ''}` : ''}!` };
}

// ------------------------------------------------------------------ achievements

export interface Achievement { id: string; emoji: string; label: string; desc: string; reward: number; progress: (s: Save) => [number, number] }

const life = (s: Save, k: string) => s.life?.[k] ?? 0;
const floorsDone = (s: Save) => FLOORS.filter((f) => f.tasks.length && f.tasks.every((t) => s.tasks[`${f.id}:${t.id}`])).length;
const furnitureOwned = (s: Save) => Object.entries(s.inventory).filter(([k, n]) => k.startsWith('d_') && n > 0).length;
const carsOwned = (s: Save) => Object.entries(s.inventory).filter(([k, n]) => k.startsWith('car_') && n > 0).length;
const visited = (s: Save) => ALL_ZONES.filter((z) => life(s, `v_${z}`) > 0).length;
const A = (id: string, emoji: string, label: string, desc: string, reward: number, progress: (s: Save) => [number, number]): Achievement => ({ id, emoji, label, desc, reward, progress });
const n = (v: number, goal: number): [number, number] => [Math.min(v, goal), goal];

export const ACHIEVEMENTS: Achievement[] = [
  A('first_task', '✅', 'First Steps', 'Complete your first task', 100, (s) => n(Object.keys(s.tasks).length, 1)),
  A('floor1', '🏨', 'Floor Finisher', 'Finish every task on a floor', 200, (s) => n(floorsDone(s), 1)),
  A('floor4', '🏢', 'Halfway Up', 'Finish 4 floors', 400, (s) => n(floorsDone(s), 4)),
  A('floor8', '🌇', 'Rooftop Royalty', 'Finish all 8 original floors', 800, (s) => n(floorsDone(s), 8)),
  A('floor12', '🚁', 'Penthouse Pro', 'Finish every floor up to the Penthouse', 2000, (s) => n(floorsDone(s), 12)),
  A('floor18', '🎡', 'Tower Climber', 'Finish 18 floors', 2500, (s) => n(floorsDone(s), 18)),
  A('floor24', '🌸', 'Top of the Tower', 'Finish all 24 floors', 5000, (s) => n(floorsDone(s), 24)),
  A('aura20k', '🌠', 'Aura Icon', 'Earn 20,000 Total Aura', 1500, (s) => n(s.totalAura, 20000)),
  A('aura1k', '✨', 'Glowing', 'Earn 1,000 Total Aura', 100, (s) => n(s.totalAura, 1000)),
  A('aura5k', '💫', 'Shining', 'Earn 5,000 Total Aura', 300, (s) => n(s.totalAura, 5000)),
  A('aura10k', '🌟', 'Superstar', 'Earn 10,000 Total Aura', 600, (s) => n(s.totalAura, 10000)),
  A('aura13k', '👑', 'Aura Legend', 'Earn 13,000 Total Aura', 1000, (s) => n(s.totalAura, 13000)),
  A('lv5', '🥉', 'Level 5', 'Reach level 5', 150, (s) => n(levelOf(s.xp ?? 0), 5)),
  A('lv10', '🥈', 'Level 10', 'Reach level 10', 300, (s) => n(levelOf(s.xp ?? 0), 10)),
  A('lv20', '🥇', 'Level 20', 'Reach level 20', 600, (s) => n(levelOf(s.xp ?? 0), 20)),
  A('lv30', '💎', 'Level 30', 'Reach level 30', 1000, (s) => n(levelOf(s.xp ?? 0), 30)),
  A('lv50', '🦄', 'Level 50', 'Reach level 50', 2500, (s) => n(levelOf(s.xp ?? 0), 50)),
  A('tasks50', '🧹', 'Busy Bee', 'Do 50 tasks (replays count)', 300, (s) => n(life(s, 'tasks'), 50)),
  A('tasks250', '🐝', 'Workaholic', 'Do 250 tasks (replays count)', 1000, (s) => n(life(s, 'tasks'), 250)),
  A('shell1', '🐚', 'Beachcomber', 'Find a golden shell', 50, (s) => n(s.shells?.length ?? 0, 1)),
  A('shell15', '🐚', 'Shell Seeker', 'Find 15 golden shells', 300, (s) => n(s.shells?.length ?? 0, 15)),
  A('shell30', '🏝️', 'Shell Master', 'Find all 30 golden shells', 800, (s) => n(s.shells?.length ?? 0, 30)),
  A('visit', '🗺️', 'Explorer', 'Visit every floor of the estate', 400, (s) => n(visited(s), ALL_ZONES.length)),
  A('villa1', '💘', 'Islander', 'Win a Love Island season', 400, (s) => n(s.villa.wins ?? 0, 1)),
  A('villa3', '💞', 'Fan Favourite', 'Win 3 Love Island seasons', 800, (s) => n(s.villa.wins ?? 0, 3)),
  A('villa10', '🏆', 'Villa Legend', 'Win 10 Love Island seasons', 2000, (s) => n(s.villa.wins ?? 0, 10)),
  A('pet', '🐾', 'Best Friend', 'Adopt a pet', 100, (s) => n(s.pet ? 1 : 0, 1)),
  A('pats', '🐶', 'Pet Whisperer', 'Pat pets 30 times', 200, (s) => n(life(s, 'pats'), 30)),
  A('outfits', '👗', 'Fashionista', 'Save 3 outfits', 150, (s) => n(s.outfits?.filter(Boolean).length ?? 0, 3)),
  A('profile', '🏷️', 'All About Me', 'Write a bio on your profile', 100, (s) => n(s.profile?.bio ? 1 : 0, 1)),
  A('decor5', '🖼️', 'Interior Designer', 'Place 5 things in your room', 150, (s) => n(s.room.length, 5)),
  A('decor20', '🏡', 'Dream Room', 'Place 20 things in your room', 500, (s) => n(s.room.length, 20)),
  A('style', '🎨', 'Makeover', 'Restyle your bedroom walls or floor', 100, (s) => n(s.roomStyle && (s.roomStyle.wall || s.roomStyle.floor || s.roomStyle.empty) ? 1 : 0, 1)),
  A('furn10', '🛋️', 'Collector', 'Own 10 different pieces of furniture', 300, (s) => n(furnitureOwned(s), 10)),
  A('cars3', '🚗', 'Car Lover', 'Own 3 cars', 300, (s) => n(carsOwned(s), 3)),
  A('cars8', '🏎️', 'Garage Goals', 'Own 8 cars', 1000, (s) => n(carsOwned(s), 8)),
  A('lap', '🏁', 'Racer', 'Set a kart lap time', 100, (s) => n(s.bestLap ? 1 : 0, 1)),
  A('lap40', '⚡', 'Speed Demon', 'Do a kart lap in under 40 seconds', 500, (s) => n(s.bestLap && s.bestLap < 40000 ? 1 : 0, 1)),
  A('chat', '💬', 'Chatterbox', 'Send 100 chat messages', 200, (s) => n(life(s, 'chat'), 100)),
  A('emote', '💃', 'Expressive', 'Do 100 emotes', 200, (s) => n(life(s, 'emote'), 100)),
  A('swim', '🏊', 'Water Baby', 'Swim for 10 minutes in total', 200, (s) => n(life(s, 'swim'), 600)),
  A('drive', '🚙', 'Road Trip', 'Drive for 15 minutes in total', 200, (s) => n(life(s, 'drive'), 900)),
  A('dailies', '📅', 'Daily Grinder', 'Claim 20 daily challenges', 500, (s) => n(life(s, 'daily'), 20)),
  A('spins', '🎡', 'Lucky Spinner', 'Spin the wheel 10 times', 200, (s) => n(life(s, 'spin'), 10)),
  A('tag', '🏃', 'Tag Champ', 'Win 5 games of tag', 300, (s) => n(life(s, 'tagwin'), 5)),
  A('party', '🪩', 'Party Animal', 'Dance at parties 20 times', 200, (s) => n(life(s, 'dance'), 20)),
  A('event', '🎉', 'Event Hero', 'Finish a weekly event goal', 200, (s) => n(life(s, 'eventgoal'), 1)),
  A('event10', '🎊', 'Event Legend', 'Finish 10 weekly event goals', 1000, (s) => n(life(s, 'eventgoal'), 10)),
  A('vip', '⭐', 'VIP', 'Become a VIP', 200, (s) => n(s.vip ? 1 : 0, 1)),
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);
export const achieved = (s: Save, a: Achievement) => { const [c, g] = a.progress(s); return c >= g; };

export function claimAchievement(save: Save, id: string, earn: Earn): Result {
  const a = achievementById(id);
  if (!a) return { ok: false, msg: 'Unknown achievement.' };
  save.ach ??= {};
  if (save.ach[id]) return { ok: false, msg: 'Already claimed!' };
  if (!achieved(save, a)) return { ok: false, msg: 'Not finished yet.' };
  save.ach[id] = Date.now();
  earn(save, a.reward, 0, `Achievement: ${a.label}`);
  return { ok: true, msg: `🏆 ${a.emoji} ${a.label}! +${a.reward} Aura` };
}

/** Achievements that just became ready (for a one-time "unlocked!" toast). */
export function newlyReady(save: Save): Achievement[] {
  save.achSeen ??= [];
  const out = ACHIEVEMENTS.filter((a) => !save.ach?.[a.id] && !save.achSeen!.includes(a.id) && achieved(save, a));
  for (const a of out) save.achSeen.push(a.id);
  return out;
}

// ------------------------------------------------------------------ weekly events

export interface EventGoal { stat: string; goal: number; label: string; reward: number }
export interface WeeklyEvent { id: string; emoji: string; name: string; blurb: string; color: string; goals: EventGoal[]; items: string[] }

const G = (stat: string, goal: number, label: string, reward: number): EventGoal => ({ stat, goal, label, reward });

export const EVENTS: WeeklyEvent[] = [
  { id: 'spooky', emoji: '🎃', name: 'Spooky Week', blurb: 'The mansion is haunted! Spooky outfits and decorations this week only.', color: '#ff7a1a',
    goals: [G('tasks', 20, 'Do 20 tasks', 400), G('emote', 30, 'Do 30 emotes', 250), G('v_f10', 3, 'Visit the cinema 3 times', 250)], items: ['ev_witch', 'ev_boo'] },
  { id: 'fashion', emoji: '👠', name: 'Fashion Week', blurb: 'Strike a pose! Runway looks and a catwalk sign this week only.', color: '#ff3df0',
    goals: [G('outfit', 3, 'Save 3 looks', 300), G('emote', 25, 'Strike 25 poses or emotes', 250), G('buys', 3, 'Buy 3 things', 300)], items: ['ev_runway', 'ev_vogue'] },
  { id: 'summer', emoji: '🏖️', name: 'Summer Splash', blurb: 'Pool party season! Swim, slide and soak up the sun.', color: '#33a8ff',
    goals: [G('swim', 300, 'Swim for 5 minutes', 300), G('slide', 3, 'Go down the water slide 3 times', 250), G('tasks', 15, 'Do 15 tasks', 300)], items: ['ev_tropic', 'ev_flamingo'] },
  { id: 'winter', emoji: '❄️', name: 'Winter Wonderland', blurb: 'Snow is falling all over the estate. Get cosy!', color: '#9fdcff',
    goals: [G('v_f11', 3, 'Visit the ice rink 3 times', 250), G('tasks', 20, 'Do 20 tasks', 400), G('chat', 20, 'Send 20 chat messages', 200)], items: ['ev_puffer', 'ev_snowglobe'] },
  { id: 'racing', emoji: '🏁', name: 'Grand Prix Week', blurb: 'Start your engines! Race karts and drive around the estate.', color: '#ffd23f',
    goals: [G('drive', 300, 'Drive for 5 minutes', 300), G('laps', 5, 'Finish 5 kart laps', 400), G('v_park', 3, 'Visit the car park 3 times', 200)], items: ['ev_racer', 'ev_flag'] },
  { id: 'love', emoji: '💘', name: 'Villa Love Week', blurb: 'Love is in the air! Big week for Love Island.', color: '#ff6fb5',
    goals: [G('villaday', 5, 'Play 5 Love Island days', 400), G('emote', 20, 'Send 20 hearts or emotes', 200), G('v_villa', 3, 'Visit the villa 3 times', 200)], items: ['ev_heartdress', 'ev_lovesign'] },
  { id: 'arcade', emoji: '🕹️', name: 'Arcade Fever', blurb: 'High scores only! The Sky Arcade is buzzing.', color: '#7cff6b',
    goals: [G('v_f9', 3, 'Visit the arcade 3 times', 200), G('tasks', 20, 'Do 20 tasks', 400), G('spin', 3, 'Spin the wheel 3 times', 250)], items: ['ev_gamer', 'ev_gameover'] },
  { id: 'pets', emoji: '🐾', name: 'Pet Party Week', blurb: 'Celebrate the fluffiest residents of the estate.', color: '#c8925a',
    goals: [G('pats', 15, 'Pat pets 15 times', 250), G('v_f2', 3, 'Visit the pet room floor 3 times', 200), G('tasks', 15, 'Do 15 tasks', 300)], items: ['ev_pawprint', 'ev_petbed'] },
];

const WEEK_MS = 7 * 86400_000;
/** Weeks start on Monday (UTC). */
export function weekIndex(now = Date.now()): number {
  return Math.floor((now - Date.UTC(2024, 0, 1)) / WEEK_MS); // 1 Jan 2024 was a Monday
}
export function currentEvent(now = Date.now()): WeeklyEvent {
  return EVENTS[weekIndex(now) % EVENTS.length];
}
export function weekEndsAt(now = Date.now()): number {
  return Date.UTC(2024, 0, 1) + (weekIndex(now) + 1) * WEEK_MS;
}

export function rollWeek(save: Save, now = Date.now()): void {
  const id = `${weekIndex(now)}`;
  if (save.week?.id !== id) save.week = { id, stats: {}, claimed: [] };
}

export function claimEventGoal(save: Save, i: number, earn: Earn, now = Date.now()): Result {
  rollWeek(save, now);
  const ev = currentEvent(now);
  const g = ev.goals[i];
  if (!g) return { ok: false, msg: 'Unknown goal.' };
  if (save.week!.claimed.includes(i)) return { ok: false, msg: 'Already claimed!' };
  if ((save.week!.stats[g.stat] ?? 0) < g.goal) return { ok: false, msg: 'Not finished yet.' };
  save.week!.claimed.push(i);
  save.life ??= {};
  save.life.eventgoal = (save.life.eventgoal ?? 0) + 1;
  earn(save, g.reward, 0, `${ev.name}: ${g.label}`);
  return { ok: true, msg: `${ev.emoji} ${g.label} — +${g.reward} Aura!` };
}
