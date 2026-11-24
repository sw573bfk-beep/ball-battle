/**
 * Quests & story. Characters around the estate give quest chains. Each step is
 * "do something N more times" measured with lifetime counters (save.life), so
 * progress is tracked by the server and can't be faked. Steps go in order;
 * finished quests are claimed by talking to the character again.
 */
import type { Look } from './look';
import type { ZoneId } from './people';
import type { Save } from './save';

type Earn = (save: Save, d: number, t: number, why: string) => void;
type Result = { ok: true; msg: string } | { ok: false; msg: string };

const L = (body: 'boy' | 'girl', skin: string, hair: string, hairColor: string, outfit: string, extra: Partial<Look> = {}): Look =>
  ({ body, skin, hair, hairColor, outfit, build: 'average', height: 'medium', eyes: '#4a2e1a', lips: body === 'boy' ? '#b07a6e' : '#c9867a', beard: 'none', ...extra });

export interface Npc { id: string; name: string; emoji: string; role: string; zone: ZoneId; x: number; z: number; ry: number; look: Look }

/** x/z are floor-plan metres (same as layouts). */
export const NPCS: Npc[] = [
  { id: 'mayor', name: 'Mayor Maggie', emoji: '🎩', role: 'Mayor of Maggakes Town', zone: 'town', x: 22, z: 6, ry: Math.PI, look: L('girl', '#d39a72', 'topbun', '#3b2518', 'fit_suit', { height: 'tall' }) },
  { id: 'chef', name: 'Chef Marco', emoji: '👨‍🍳', role: 'Head chef', zone: 'f15', x: 22.5, z: 4, ry: -Math.PI / 2, look: L('boy', '#eab48f', 'slick', '#1c1410', 'fit_white', { beard: 'short' }) },
  { id: 'coral', name: 'Captain Coral', emoji: '🛟', role: 'Lifeguard', zone: 'beach', x: 36, z: 19.5, ry: Math.PI, look: L('girl', '#b07650', 'sleekpony', '#1c1410', 'fit_beach', { build: 'athletic' }) },
  { id: 'glitz', name: 'Madame Glitz', emoji: '💃', role: 'Fashion designer', zone: 'f14', x: 20.5, z: 8, ry: -Math.PI / 2, look: L('girl', '#f7d0b2', 'waves', '#d9b277', 'fit_sequin', { height: 'tall' }) },
  { id: 'rosie', name: 'Ranger Rosie', emoji: '🦜', role: 'Jungle ranger', zone: 'f20', x: 13, z: 3, ry: 0, look: L('girl', '#8a5636', 'braids', '#1c1410', 'fit_gym', { build: 'athletic' }) },
  { id: 'nova', name: 'Professor Nova', emoji: '🔭', role: 'Space scientist', zone: 'f19', x: 7, z: 9, ry: Math.PI / 2, look: L('boy', '#f7d0b2', 'quiff', '#d8d8d8', 'fit_blazer', { beard: 'short', eyes: '#3c6e8f' }) },
  { id: 'jazz', name: 'Jazz', emoji: '🎤', role: 'Love Island host', zone: 'villa', x: 0, z: 0, ry: 0, look: L('girl', '#d39a72', 'long', '#3b2518', 'fit_gown') },
];
export const npcById = (id: string) => NPCS.find((n) => n.id === id);

export interface QuestStep { label: string; stat: string; n: number }
export interface Quest {
  id: string; npc: string; title: string; chapter: number;
  /** What the character says when offering the quest. */
  intro: string[];
  /** What they say when you hand it in. */
  outro: string;
  steps: QuestStep[];
  reward: { aura: number; item?: string };
  /** Quest that must be claimed first. */
  after?: string;
  /** Zone you must have unlocked to start it. */
  needs?: ZoneId;
}

const S = (label: string, stat: string, n: number): QuestStep => ({ label, stat, n });

export const QUESTS: Quest[] = [
  // Chapter 1 — Welcome to Maggakes (the Mayor)
  { id: 'q_tour', npc: 'mayor', chapter: 1, title: 'Welcome to Maggakes', needs: 'town',
    intro: ['Welcome, welcome! I\'m Mayor Maggie. 🎩', 'Before I give you the key to the town, have a look around. Visit the beach and the mall, then come back to me!'],
    outro: 'You\'ve seen it all! Here — every resident deserves a welcome present. 🎁',
    steps: [S('Drive to the beach', 'go_beach', 1), S('Drive to the shopping mall', 'go_mall', 1), S('Do 3 tasks anywhere', 'tasks', 3)], reward: { aura: 500 } },
  { id: 'q_helper', npc: 'mayor', chapter: 1, title: 'Town Helper', after: 'q_tour',
    intro: ['The town is a bit busy today. 😅', 'Could you help out? Do some jobs around town and say hi to people in the chat!'],
    outro: 'The whole town is talking about you! Thank you, superstar. ⭐',
    steps: [S('Do 3 tasks in Maggakes Town', 'tz_town', 3), S('Say hi in chat 5 times', 'chat', 5), S('Wave or dance 5 times', 'emote', 5)], reward: { aura: 700, item: 'd_balloons' } },
  { id: 'q_key', npc: 'mayor', chapter: 1, title: 'The Key to the Town', after: 'q_helper',
    intro: ['One last thing before you get the key…', 'A real Maggakes local knows the mansion inside out. Find 5 golden shells and win a game of tag!'],
    outro: 'Here it is — the Golden Key to Maggakes Town! 🔑 You\'re officially one of us.', steps: [S('Find 5 golden shells', 'shell', 5), S('Win a game of tag', 'tagwin', 1)], reward: { aura: 1200 } },

  // Chapter 2 — The beach (Captain Coral)
  { id: 'q_patrol', npc: 'coral', chapter: 2, title: 'Beach Patrol', needs: 'beach',
    intro: ['Ahoy! Captain Coral, head lifeguard. 🛟', 'I need a new junior lifeguard. Show me you can swim and help keep the beach clean!'],
    outro: 'Natural lifeguard! Welcome to the team. 🌊',
    steps: [S('Swim for 1 minute (pool or sea)', 'swim', 60), S('Do 3 beach tasks', 'tz_beach', 3)], reward: { aura: 600 } },
  { id: 'q_turtles', npc: 'coral', chapter: 2, title: 'Save the Turtles', after: 'q_patrol', needs: 'f13',
    intro: ['Baby turtles are hatching! 🐢', 'The aquarium on the 13th floor is looking after them. Go and help out there, then report back.'],
    outro: 'The turtles made it to the sea safe and sound. You\'re a hero! 🐢💙',
    steps: [S('Visit the Aquarium', 'go_f13', 1), S('Do 3 Aquarium tasks', 'tz_f13', 3)], reward: { aura: 900, item: 'd_jelly' } },

  // Chapter 3 — The café (Chef Marco)
  { id: 'q_ingredients', npc: 'chef', chapter: 3, title: 'Ingredient Run', needs: 'f15',
    intro: ['Bonjour! I am Chef Marco. 👨‍🍳', 'The café opens soon but I have no ingredients! Pop to the mall for me, and help in the kitchen.'],
    outro: 'Magnifique! Now we can bake. 🥐',
    steps: [S('Visit the shopping mall', 'go_mall', 1), S('Do 2 tasks at the mall', 'tz_mall', 2), S('Do 2 Bakery Café tasks', 'tz_f15', 2)], reward: { aura: 700 } },
  { id: 'q_opening', npc: 'chef', chapter: 3, title: 'Grand Opening', after: 'q_ingredients',
    intro: ['It is the grand opening! 🎉', 'Buy something nice for the café, finish the bakery jobs, and get everyone dancing at a party!'],
    outro: 'The café is a hit! Here is your very own cake stand. 🎂',
    steps: [S('Buy something in the shop', 'buys', 1), S('Do 3 Bakery Café tasks', 'tz_f15', 3), S('Dance at a party 3 times', 'dance', 3)], reward: { aura: 1000, item: 'd_cakestand' } },

  // Chapter 4 — Fashion (Madame Glitz)
  { id: 'q_muse', npc: 'glitz', chapter: 4, title: 'My New Muse', needs: 'f14',
    intro: ['Darling! You have STYLE. 💃', 'Save me three fabulous looks and walk my runway.'],
    outro: 'Iconic. Simply iconic. ✨', steps: [S('Save 3 outfits', 'outfit', 3), S('Do 2 Fashion Studio tasks', 'tz_f14', 2)], reward: { aura: 800 } },
  { id: 'q_fashionweek', npc: 'glitz', chapter: 4, title: 'Fashion Week', after: 'q_muse',
    intro: ['Fashion Week is here! 📸', 'Shop till you drop, then finish every job in the studio.'],
    outro: 'The critics are calling you the face of the season. Take this, darling. 👗',
    steps: [S('Buy 3 things in the shop', 'buys', 3), S('Do 3 Fashion Studio tasks', 'tz_f14', 3), S('Strike 10 poses or emotes', 'emote', 10)], reward: { aura: 1200, item: 'd_mannequin' } },

  // Chapter 5 — The jungle (Ranger Rosie)
  { id: 'q_explorer', npc: 'rosie', chapter: 5, title: 'Jungle Explorer', needs: 'f20',
    intro: ['G\'day! Ranger Rosie here. 🦜', 'The animals need a friend. Pat some pets and explore the rainforest.'],
    outro: 'The animals love you! 🐾', steps: [S('Pat pets 10 times', 'pats', 10), S('Do 3 Rainforest tasks', 'tz_f20', 3)], reward: { aura: 900 } },
  { id: 'q_rescue', npc: 'rosie', chapter: 5, title: 'Animal Rescue', after: 'q_explorer',
    intro: ['A parrot flew off to the Sky Garden! 😱', 'Go up to the very top of the tower and help out there.'],
    outro: 'Polly is home safe! Here, she wants you to have this. 🦜', steps: [S('Visit the Sky Garden', 'go_f24', 1), S('Do 2 Sky Garden tasks', 'tz_f24', 2)], reward: { aura: 1300, item: 'd_perch' } },

  // Chapter 6 — Space (Professor Nova)
  { id: 'q_stars', npc: 'nova', chapter: 6, title: 'Reach for the Stars', needs: 'f19',
    intro: ['Ah, a new astronaut! 🔭', 'Mission one: master the observatory.'],
    outro: 'Mission complete! 🚀', steps: [S('Do 3 Observatory tasks', 'tz_f19', 3), S('Spin the daily wheel', 'spin', 1)], reward: { aura: 1000 } },
  { id: 'q_launch', npc: 'nova', chapter: 6, title: 'Launch Day', after: 'q_stars',
    intro: ['Launch day! 🚀', 'Every astronaut needs speed — race a kart lap, drive around, and slide down the rooftop water slide for zero-gravity training!'],
    outro: 'You are officially a Maggakes astronaut! 🪐', steps: [S('Finish a kart lap', 'laps', 1), S('Drive for 2 minutes', 'drive', 120), S('Go down the water slide', 'slide', 1)], reward: { aura: 1500, item: 'd_orrery' } },

  // Chapter 7 — Love Island (Jazz)
  { id: 'q_villa', npc: 'jazz', chapter: 7, title: 'Villa Superstar', needs: 'villa',
    intro: ['Islander! 🎤', 'The public want to see more of you. Play some days in the villa and get everyone talking!'],
    outro: 'The public are OBSESSED with you! 💘', steps: [S('Play 5 Love Island days', 'villaday', 5), S('Send 10 chat messages', 'chat', 10)], reward: { aura: 1000 } },

  // Finale — needs every other quest
  { id: 'q_finale', npc: 'mayor', chapter: 8, title: 'The Maggakes Legend', after: 'q_key',
    intro: ['You\'ve helped EVERYONE in Maggakes! 🌟', 'There\'s one last thing: finish every other quest, then come back for a very special ceremony.'],
    outro: '🏆 By the power of the Mayor, I name you a MAGGAKES LEGEND! Fireworks, everyone! 🎆',
    steps: [S('Finish all the other quests', 'questsdone', 0)], reward: { aura: 5000, item: 'fx_fireworks' } },
];
// The finale needs every other quest claimed.
QUESTS[QUESTS.length - 1].steps[0].n = QUESTS.length - 1;
export const questById = (id: string) => QUESTS.find((q) => q.id === id);

export interface QuestState { step: number; snap: Record<string, number>; claimed?: boolean }
export type QuestStatus = 'locked' | 'available' | 'active' | 'ready' | 'done';

const life = (s: Save, k: string) => s.life?.[k] ?? 0;
const unlocked = (s: Save, z?: ZoneId, need?: (z: ZoneId) => number) => !z || s.totalAura >= (need?.(z) ?? 0);

/** How far along a step is: [done, needed]. */
export function stepProgress(s: Save, q: Quest, st: QuestState, i: number): [number, number] {
  const step = q.steps[i];
  if (step.stat === 'questsdone') return [Math.min(step.n, Object.values(s.quests ?? {}).filter((x) => x.claimed).length), step.n];
  const base = st.snap[step.stat] ?? 0;
  return [Math.min(step.n, Math.max(0, life(s, step.stat) - base)), step.n];
}

export function questStatus(s: Save, q: Quest, zoneNeed?: (z: ZoneId) => number): QuestStatus {
  const st = s.quests?.[q.id];
  if (st?.claimed) return 'done';
  if (st) return st.step >= q.steps.length ? 'ready' : 'active';
  if (q.after && !s.quests?.[q.after]?.claimed) return 'locked';
  if (!unlocked(s, q.needs, zoneNeed)) return 'locked';
  return 'available';
}

export function acceptQuest(s: Save, id: string, zoneNeed: (z: ZoneId) => number): Result {
  const q = questById(id);
  if (!q) return { ok: false, msg: 'Unknown quest.' };
  if (questStatus(s, q, zoneNeed) !== 'available') return { ok: false, msg: 'You can\'t start that quest right now.' };
  s.quests ??= {};
  // Only the current step's counter is snapshotted when it starts (see advanceQuests).
  s.quests[id] = { step: 0, snap: { [q.steps[0].stat]: life(s, q.steps[0].stat) } };
  advanceQuests(s);
  return { ok: true, msg: `📜 New quest: ${q.title}!` };
}

/** Moves active quests on to their next step when a step is finished. Returns messages to show. */
export function advanceQuests(s: Save): string[] {
  const out: string[] = [];
  for (const [id, st] of Object.entries(s.quests ?? {})) {
    const q = questById(id);
    if (!q || st.claimed) continue;
    while (st.step < q.steps.length) {
      const [d, n] = stepProgress(s, q, st, st.step);
      if (d < n) break;
      out.push(`✅ ${q.title}: ${q.steps[st.step].label}`);
      st.step++;
      if (st.step < q.steps.length) { const nx = q.steps[st.step].stat; st.snap[nx] = life(s, nx); }
      else out.push(`📜 Quest complete! Go back to ${npcById(q.npc)?.name ?? 'them'} for your reward.`);
    }
  }
  return out;
}

export function claimQuest(s: Save, id: string, earn: Earn): Result {
  const q = questById(id);
  const st = s.quests?.[id];
  if (!q || !st) return { ok: false, msg: 'You haven\'t started that quest.' };
  if (st.claimed) return { ok: false, msg: 'Already done!' };
  if (st.step < q.steps.length) return { ok: false, msg: 'Not finished yet!' };
  st.claimed = true;
  if (q.reward.item) s.inventory[q.reward.item] = (s.inventory[q.reward.item] ?? 0) + (q.reward.item.startsWith('fx_') ? 10 : 1);
  earn(s, q.reward.aura, 0, `Quest: ${q.title}`);
  advanceQuests(s); // the finale counts claimed quests
  return { ok: true, msg: `🏆 ${q.title} done! +${q.reward.aura} Aura${q.reward.item ? ' and a gift' : ''}!` };
}

/** The quest a character currently wants to talk about (claim > active > available). */
export function npcQuest(s: Save, npcId: string, zoneNeed?: (z: ZoneId) => number): Quest | undefined {
  const qs = QUESTS.filter((q) => q.npc === npcId);
  return qs.find((q) => questStatus(s, q, zoneNeed) === 'ready') ?? qs.find((q) => questStatus(s, q, zoneNeed) === 'active') ?? qs.find((q) => questStatus(s, q, zoneNeed) === 'available');
}
