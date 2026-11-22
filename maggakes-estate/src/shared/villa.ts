import type { Result, Save } from './save';
import type { Look } from './look';
import { earn, zoneUnlocked } from './save';

import { CAST } from './season';

/** Computer-controlled islanders (the season cast). */
export interface Islander { name: string; look: Look; line: string }
export const ISLANDERS: Islander[] = CAST.map((c) => ({ name: c.name, look: c.look, line: c.line }));

export interface VillaChallenge {
  id: string;
  label: string;
  kind: 'timing' | 'collect' | 'choice' | 'simon';
  hint: string;
  points: number;
  question?: { q: string; options: string[]; answer: number }[];
  count?: number;
  item?: string;
}

export const VILLA_CHALLENGES: VillaChallenge[] = [
  { id: 'dance', label: 'Heart Rate Dance-off', kind: 'simon', hint: 'Copy the dance moves to raise the heart rate meter!', points: 150 },
  { id: 'coconut', label: 'Coconut Catch', kind: 'collect', hint: 'Grab the 6 coconuts around the villa before the others.', points: 150, count: 6, item: '🥥' },
  {
    id: 'quiz', label: 'Villa Quiz', kind: 'choice', hint: 'How well do you know the estate?', points: 150,
    question: [
      { q: 'Which floor has the sushi room?', options: ['1st', '4th', 'Basement'], answer: 0 },
      { q: "Whose floor is the 7th floor?", options: ['Grace', 'Milla', 'Jess'], answer: 1 },
      { q: 'How many Aura Points does one task give?', options: ['100', '200', '500'], answer: 1 },
      { q: 'Where is the DJ booth?', options: ['5th floor', 'Rooftop', 'Car park'], answer: 0 },
    ],
  },
  { id: 'volley', label: 'Beach Volleyball', kind: 'timing', hint: 'Spike it when the marker hits the sweet spot.', points: 150 },
];

export const CHALLENGE_COOLDOWN_MS = 60_000;
export const FINAL_POINTS = 1500;
export const FINAL_REWARD = 1000;

export function villaChallenge(save: Save, id: string, now = Date.now()): Result {
  if (!zoneUnlocked(save, 'villa')) return { ok: false, msg: 'Reach the rooftop to unlock Love Island.' };
  const c = VILLA_CHALLENGES.find((v) => v.id === id);
  if (!c) return { ok: false, msg: 'Unknown challenge.' };
  const last = save.villa.cooldowns[id] ?? 0;
  if (now - last < CHALLENGE_COOLDOWN_MS) {
    return { ok: false, msg: `Rest up! Try again in ${Math.ceil((CHALLENGE_COOLDOWN_MS - (now - last)) / 1000)}s.` };
  }
  save.villa.cooldowns[id] = now;
  const bonus = save.villa.partner ? 50 : 0;
  save.villa.points += c.points + bonus;
  earn(save, 50, 0, `Villa: ${c.label}`);
  return { ok: true, msg: `+${c.points + bonus} Villa Points${bonus ? ' (couple bonus!)' : ''} and +50 Aura` };
}

/** Whether an NPC islander says yes when you pick them at the firepit. */
export function npcAccepts(save: Save, npc: string, roll: number): boolean {
  if (save.villa.partner === `npc:${npc}`) return true;
  // More villa points = more confident = more likely to be picked back.
  const chance = Math.min(0.9, 0.45 + save.villa.points / 2000);
  return roll < chance;
}

export function winFinal(save: Save): Result {
  if (!save.villa.partner) return { ok: false, msg: 'You need to be coupled up to enter the final.' };
  if (save.villa.points < FINAL_POINTS) return { ok: false, msg: `You need ${FINAL_POINTS} Villa Points for the final.` };
  save.villa.wins += 1;
  save.villa.points = 0;
  earn(save, FINAL_REWARD, FINAL_REWARD, 'Won the Love Island final');
  return { ok: true, msg: `🏆 You won Love Island! +${FINAL_REWARD} Aura` };
}
