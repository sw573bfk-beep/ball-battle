/**
 * Love Island Mode: a full "season" played against computer islanders.
 * Pure game logic, run on the server so rewards can't be faked.
 * Kept teen-friendly: dates are picnics, stargazing and beach walks.
 */
import type { Look } from './look';

export type Tone = 'sweet' | 'funny' | 'bold' | 'deep' | 'sporty' | 'chill';
export type Persona = 'romantic' | 'joker' | 'sporty' | 'chill' | 'loyal' | 'charmer' | 'drama' | 'ambitious';

export const PERSONAS: Record<Persona, { label: string; emoji: string; likes: Tone[]; hates: Tone[] }> = {
  romantic: { label: 'Hopeless romantic', emoji: '🌹', likes: ['sweet', 'deep'], hates: ['bold'] },
  joker: { label: 'Villa joker', emoji: '😂', likes: ['funny', 'chill'], hates: ['deep'] },
  sporty: { label: 'Gym junkie', emoji: '💪', likes: ['sporty', 'bold'], hates: ['chill'] },
  chill: { label: 'Laid-back', emoji: '🌊', likes: ['chill', 'funny'], hates: ['bold'] },
  loyal: { label: 'Loyal to the core', emoji: '🤞', likes: ['deep', 'sweet'], hates: ['bold'] },
  charmer: { label: 'Smooth talker', emoji: '😎', likes: ['bold', 'funny'], hates: ['deep'] },
  drama: { label: 'Brings the drama', emoji: '🔥', likes: ['bold', 'deep'], hates: ['chill'] },
  ambitious: { label: 'Big dreamer', emoji: '🚀', likes: ['deep', 'sporty'], hates: ['funny'] },
};

export const TONE_LABEL: Record<Tone, string> = {
  sweet: '💕 Sweet', funny: '😂 Funny', bold: '😏 Bold', deep: '💭 Deep', sporty: '💪 Sporty', chill: '🌊 Chill',
};

export interface Islander {
  name: string;
  gender: 'boy' | 'girl';
  age: number;
  from: string;
  job: string;
  persona: Persona;
  bio: string;
  line: string;
  look: Look;
}

const L = (body: 'boy' | 'girl', skin: string, hair: string, hairColor: string, outfit: string, extra: Partial<Look> = {}): Look =>
  ({ body, skin, hair, hairColor, outfit, build: body === 'boy' ? 'athletic' : 'average', height: 'medium', eyes: '#4a2e1a', lips: body === 'boy' ? '#b07a6e' : '#c9867a', beard: 'none', ...extra });

export const CAST: Islander[] = [
  { name: 'Kai', gender: 'boy', age: 25, from: 'Gold Coast, QLD', job: 'Lifeguard', persona: 'sporty', bio: 'Saves lives by day, smashes beach volleyball by night.', line: "Honestly, I'm just here to find someone who can keep up with me.", look: L('boy', '#b07650', 'curlytop', '#1c1410', 'fit_openshirt', { beard: 'stubble', build: 'strong', height: 'tall', eyes: '#2b1a10' }) },
  { name: 'Lachie', gender: 'boy', age: 23, from: 'Bondi, NSW', job: 'Barista', persona: 'joker', bio: 'Makes a mean flat white and an even meaner dad joke.', line: "If you can't laugh with me, can you at least laugh at me?", look: L('boy', '#f7d0b2', 'surfer', '#b98552', 'fit_linen', { eyes: '#3c6e8f' }) },
  { name: 'Jordan', gender: 'boy', age: 26, from: 'Perth, WA', job: 'Personal trainer', persona: 'charmer', bio: 'Confident, cheeky and never misses leg day.', line: "I'm not saying I'm the full package… but I'm the full package.", look: L('boy', '#d39a72', 'quiff', '#3b2518', 'fit_polo', { beard: 'stubble', height: 'tall', eyes: '#6b4423' }) },
  { name: 'Mateo', gender: 'boy', age: 27, from: 'Melbourne, VIC', job: 'Chef', persona: 'romantic', bio: 'Will cook you breakfast and write you a poem about it.', line: "I believe in love at first bite.", look: L('boy', '#eab48f', 'slick', '#1c1410', 'fit_blazer', { beard: 'short', eyes: '#4a2e1a' }) },
  { name: 'Ethan', gender: 'boy', age: 24, from: 'Brisbane, QLD', job: 'Carpenter', persona: 'loyal', bio: 'Builds furniture and, hopefully, a strong connection.', line: "When I'm in, I'm all in.", look: L('boy', '#f7d0b2', 'crop', '#5e3b24', 'fit_linen', { beard: 'stubble', build: 'strong', eyes: '#4f7a4a' }) },
  { name: 'Rory', gender: 'boy', age: 22, from: 'Adelaide, SA', job: 'Surf instructor', persona: 'chill', bio: 'Goes with the flow — literally, he surfs.', line: "Good vibes, good waves, good people. That's it.", look: L('boy', '#eab48f', 'manbun', '#8a5a34', 'fit_openshirt', { eyes: '#3c6e8f' }) },
  { name: 'Sienna', gender: 'girl', age: 24, from: 'Sydney, NSW', job: 'Nurse', persona: 'loyal', bio: 'Caring, honest and fiercely loyal to her girls.', line: "I'm a loyal girl, so don't mess me around.", look: L('girl', '#f7d0b2', 'waves', '#d9b277', 'fit_sundress', { eyes: '#3c6e8f', lips: '#d98c8c' }) },
  { name: 'Isla', gender: 'girl', age: 23, from: 'Byron Bay, NSW', job: 'Yoga teacher', persona: 'chill', bio: 'Sunrise yoga, sunset swims, zero stress.', line: "Breathe in… good energy only, babe.", look: L('girl', '#8a5636', 'curls', '#1c1410', 'fit_coord', { eyes: '#2b1a10', lips: '#a8524f', build: 'curvy' }) },
  { name: 'Mia', gender: 'girl', age: 25, from: 'Gold Coast, QLD', job: 'Makeup artist', persona: 'drama', bio: 'Glam on point and always says what everyone is thinking.', line: "I don't start drama… I just finish it.", look: L('girl', '#eab48f', 'sleekpony', '#3b2518', 'fit_sequin', { eyes: '#6b4423', lips: '#b85c6b' }) },
  { name: 'Zara', gender: 'girl', age: 26, from: 'Melbourne, VIC', job: 'Law student', persona: 'ambitious', bio: 'Future lawyer who wants a partner with big goals.', line: "I know what I want, and I go get it.", look: L('girl', '#b07650', 'topbun', '#1c1410', 'fit_slip', { eyes: '#4a2e1a', lips: '#a8524f', height: 'tall' }) },
  { name: 'Ruby', gender: 'girl', age: 22, from: 'Cairns, QLD', job: 'Marine biologist', persona: 'romantic', bio: 'Loves turtles, sunsets and a proper love story.', line: "I want the fairytale. Is that too much to ask?", look: L('girl', '#ffe3d3', 'long', '#a8432f', 'fit_sundress', { eyes: '#4f7a4a', lips: '#e07a8a', build: 'slim' }) },
  { name: 'Tayla', gender: 'girl', age: 24, from: 'Newcastle, NSW', job: 'Netball player', persona: 'sporty', bio: 'Competitive, loud and the life of every challenge.', line: "I'm here to win — the challenges AND the guy.", look: L('girl', '#d39a72', 'braids', '#3b2518', 'fit_coord', { eyes: '#6b4423', lips: '#c9867a', build: 'athletic' }) },
];

export const HOST = {
  name: 'Jazz',
  look: L('girl', '#d39a72', 'long', '#3b2518', 'fit_gown', { eyes: '#6b4423', lips: '#b85c6b', height: 'tall' }),
  greetings: ['Islaaanders! 🎤', 'Hello my beautiful islanders!', 'Evening, villa! 💅', 'Brace yourselves, babes…'],
};

export const islander = (name: string) => CAST.find((c) => c.name === name);

// --------------------------------------------------------------- conversations

interface Topic { prompt: string; opts: Record<Tone, string> }

const TOPICS: Topic[] = [
  { prompt: "So… what's your type on paper?", opts: { sweet: 'Someone kind who makes me feel at home.', funny: 'Anyone who laughs at my terrible jokes.', bold: "Honestly? You're kind of ticking boxes right now.", deep: "Someone I can really trust. That matters most.", sporty: 'Someone who can beat me in a race.', chill: "I don't really have a type. I just go with vibes." } },
  { prompt: 'What would your perfect date be?', opts: { sweet: 'A sunset picnic with strawberries.', funny: 'Mini golf where I lose on purpose. Maybe.', bold: "This. Right here. With you.", deep: 'Stargazing and talking about everything.', sporty: 'Paddleboarding then smoothies.', chill: 'Beach, music, no plans.' } },
  { prompt: 'How are you finding the villa so far?', opts: { sweet: "It's better now that I'm chatting to you.", funny: "Great, except someone keeps stealing my sunbed.", bold: "I'm here to make moves, and I'm making them.", deep: "It's a lot, but I'm learning heaps about myself.", sporty: "I've done 200 push-ups by the pool. So, good.", chill: 'Loving it. The vibes are immaculate.' } },
  { prompt: "What's something people get wrong about you?", opts: { sweet: "People think I'm shy, but I'm a big softie.", funny: 'They think I\'m serious. I am not.', bold: "They think I'm trouble. Maybe they're right.", deep: 'That I have it all together. I\'m still figuring it out.', sporty: "They think I only care about the gym. Okay, mostly.", chill: "Honestly, I don't stress what people think." } },
  { prompt: 'Who in here are you closest with?', opts: { sweet: "Can I say you? Is that cheesy?", funny: 'The pool flamingo. We have a bond.', bold: "You, and I'm not hiding it.", deep: "Still working that out, but I trust a few people.", sporty: 'Whoever spots me at the gym.', chill: "Everyone's great, I just float around." } },
  { prompt: "What's your biggest dream outside the villa?", opts: { sweet: 'Having a big happy family dinner every Sunday.', funny: 'Becoming a professional nap taker.', bold: "Being famous. Starting with this show.", deep: 'Doing something that actually helps people.', sporty: 'Running a marathon. Or two.', chill: 'Living by the beach with a dog.' } },
  { prompt: "Be honest — is your head turned by anyone?", opts: { sweet: "My heart's only pointing one way right now.", funny: 'Only by the smell of the barbecue.', bold: "Maybe. Want to guess who?", deep: "I want to be sure before I say anything.", sporty: "Let's say I'm in it to win it.", chill: "I'm keeping it open and easy for now." } },
  { prompt: 'What would you cook me for breakfast?', opts: { sweet: 'Pancakes shaped like hearts.', funny: 'Toast. Slightly burnt. With love.', bold: "Whatever you want. I'll even bring it to you.", deep: "My nan's recipe — it means a lot to me.", sporty: 'Protein smoothie. You\'ll thank me later.', chill: 'Smashed avo, obviously. We\'re Aussie.' } },
  { prompt: 'What makes you laugh the most?', opts: { sweet: 'Seeing the people I love happy.', funny: 'My own jokes. Every single time.', bold: "You trying to keep a straight face right now.", deep: 'Old memories with my best mates.', sporty: 'People falling over in challenges.', chill: 'Funny animal videos, no shame.' } },
  { prompt: "What's your love language?", opts: { sweet: 'Little notes and surprises.', funny: 'Memes. Lots of memes.', bold: 'Quality time — with me.', deep: 'Really listening to each other.', sporty: 'Training together.', chill: 'Just hanging out, no pressure.' } },
  { prompt: 'Rate the villa food out of 10.', opts: { sweet: "A 10, because you're here.", funny: 'A 4. The toast fears me.', bold: "An 8. Would be a 10 if you cooked.", deep: "Honestly, I'm grateful for it.", sporty: 'Needs more protein. 6.', chill: "It's food, it's sunny — 9." } },
  { prompt: 'Where do you see us in a week?', opts: { sweet: 'Still chatting at the firepit every night.', funny: 'Arguing over who gets the hammock.', bold: "Coupled up. Obviously.", deep: "Knowing each other properly. That's the goal.", sporty: 'Winning challenges as a team.', chill: "Let's just enjoy today, yeah?" } },
];

const BEACH_HUT: Topic[] = [
  { prompt: '🎥 Beach Hut: How\'s your day been?', opts: { sweet: "Honestly so lovely, I'm smiling heaps.", funny: "Someone ate my snack. I'm investigating.", bold: "Big moves today. Watch this space.", deep: "Bit of an emotional one, but I'm okay.", sporty: 'Won the push-up contest. Again.', chill: "Chill day. Pool, sun, repeat." } },
  { prompt: '🎥 Beach Hut: Who\'s the biggest gossip in the villa?', opts: { sweet: "I won't say! I love everyone.", funny: 'The pool flamingo. It hears everything.', bold: "Me. I know everything, darling.", deep: "Gossip hurts people, I stay out of it.", sporty: 'Whoever loses the challenges, ha.', chill: 'No clue, I was asleep.' } },
  { prompt: '🎥 Beach Hut: Any secrets you want to share?', opts: { sweet: "I might be catching feelings…", funny: "I've never actually surfed. Shh.", bold: "I'm about to shake things up.", deep: "I miss my family a lot.", sporty: 'I do sit-ups at 3am.', chill: "Nope. Open book, babe." } },
  { prompt: '🎥 Beach Hut: Describe your partner in three words.', opts: { sweet: 'Kind. Gorgeous. Special.', funny: 'Snores. So. Loud.', bold: "Lucky to have me.", deep: 'Honest, thoughtful, real.', sporty: 'Fast, strong, competitive.', chill: 'Easy-going, fun, sunny.' } },
];

const REACT = {
  liked: [
    '{n} lights up. "Okay, I love that answer!"', '{n} grins. "You actually get me, you know?"', '"Stop it, that\'s so me!" says {n}.',
    '{n} laughs and leans in. "Tell me more."', '"Right, you\'ve got my attention," says {n}.',
  ],
  neutral: ['{n} nods. "Fair enough!"', '"Ha, cute," says {n}.', '{n} smiles. "Good to know."', '"Okay, okay, I see you," says {n}.'],
  hated: ['{n} raises an eyebrow. "Hmm… not sure about that."', '"Oh. Okay then," says {n}, looking away.', '{n} goes a bit quiet.', '"That\'s a bit much," says {n}.'],
};

// --------------------------------------------------------------- season state

export type Phase = 'intro' | 'morning' | 'evening' | 'firepit' | 'over';

export type Pending =
  | { type: 'firstcouple'; options: string[] }
  | { type: 'chat'; who: string; topic: number; tones: Tone[] }
  | { type: 'hut'; topic: number; tones: Tone[] }
  | { type: 'event'; ev: string; who?: string; other?: string; options: string[] }
  | { type: 'recouple'; options: string[] }
  | { type: 'game'; ev: string; game: 'timing' | 'simon' | 'choice' };

export interface Season {
  seed: number;
  day: number;
  phase: Phase;
  actions: number;
  cast: string[];
  pool: string[];
  dumped: string[];
  bonds: Record<string, number>;
  couples: [string, string][];
  partner: string | null;
  popularity: number;
  flirts: number;
  seen: string[];
  pending: Pending | null;
  log: string[];
  result?: 'won' | 'runnerup' | 'dumped';
}

export interface Scene {
  kind: 'host' | 'chat' | 'event' | 'result' | 'cast' | 'final' | 'game';
  speaker?: string;
  title: string;
  lines: string[];
  choices?: { id: string; label: string }[];
  cards?: string[];
  bonds?: { who: string; delta: number }[];
  game?: 'timing' | 'simon' | 'choice';
  mood?: 'drama' | 'love' | 'happy' | 'sad' | 'news';
}

export type SeasonAction =
  | { a: 'start' }
  | { a: 'chat'; who: string }
  | { a: 'hut' }
  | { a: 'evening' }
  | { a: 'firepit' }
  | { a: 'answer'; choice: string }
  | { a: 'status' };

export const FINAL_DAY = 10;
export const ACTIONS_PER_DAY = 3;
export const DAY_AURA = 25;
export const WIN_AURA = 1000;
export const RUNNERUP_AURA = 300;

export interface Rewards { aura: number; total: number; win: boolean }
export interface ActResult { ok: boolean; msg?: string; scene?: Scene; reward?: Rewards }

function rng(s: Season): () => number {
  return () => {
    s.seed = (s.seed + 0x6d2b79f5) >>> 0;
    let t = s.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pickOne = <T,>(r: () => number, a: T[]): T => a[Math.floor(r() * a.length)];
function shuffle<T>(r: () => number, a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const host = (s: Season, r: () => number) => pickOne(r, HOST.greetings);
const fill = (t: string, n: string) => t.replace(/\{n\}/g, n);
const them = (name: string) => (islander(name)?.gender === 'boy' ? 'him' : 'her');
const they = (name: string) => (islander(name)?.gender === 'boy' ? 'he' : 'she');

function npcPartner(s: Season, name: string): string | null {
  for (const [a, b] of s.couples) { if (a === name) return b; if (b === name) return a; }
  return null;
}

function unpairNpc(s: Season, name: string): void {
  s.couples = s.couples.filter(([a, b]) => a !== name && b !== name);
}

/** Pairs up single NPCs (boy + girl), leaving the player's partner alone. */
function pairNpcs(s: Season, r: () => number): void {
  s.couples = [];
  const free = shuffle(r, s.cast.filter((n) => n !== s.partner));
  const boys = free.filter((n) => islander(n)!.gender === 'boy');
  const girls = free.filter((n) => islander(n)!.gender === 'girl');
  while (boys.length && girls.length) s.couples.push([boys.pop()!, girls.pop()!]);
}

export function newSeason(seed: number): Season {
  const s: Season = {
    seed: seed >>> 0 || 1, day: 1, phase: 'intro', actions: ACTIONS_PER_DAY, cast: [], pool: [], dumped: [], bonds: {},
    couples: [], partner: null, popularity: 50, flirts: 0, seen: [], pending: null, log: [],
  };
  const r = rng(s);
  const boys = shuffle(r, CAST.filter((c) => c.gender === 'boy').map((c) => c.name));
  const girls = shuffle(r, CAST.filter((c) => c.gender === 'girl').map((c) => c.name));
  s.cast = [...boys.slice(0, 3), ...girls.slice(0, 3)];
  s.pool = shuffle(r, [...boys.slice(3), ...girls.slice(3)]);
  for (const n of s.cast) s.bonds[n] = 15 + Math.floor(r() * 15);
  return s;
}

function introScene(s: Season): Scene {
  s.pending = { type: 'firstcouple', options: [...s.cast] };
  return {
    kind: 'cast', speaker: HOST.name, title: 'Day 1 · Welcome to the Villa!', mood: 'news',
    lines: [
      "Islaaanders! I'm Jazz, your host, and WELCOME to the villa! 🌴",
      "Over the next ten days you'll chat, flirt, go on dates and face some very big twists.",
      'Keep the public on your side and build a real connection — only one couple will be crowned winners!',
      "Let's meet your fellow islanders…",
      'Now, the first coupling. Who do you want to couple up with?',
    ],
    cards: [...s.cast],
    choices: s.cast.map((n) => ({ id: n, label: `💘 ${n}` })),
  };
}

function morningScene(s: Season, extra: string[] = []): Scene {
  return {
    kind: 'host', speaker: HOST.name, title: `Day ${s.day} · Morning`, mood: 'happy',
    lines: [...extra, `Good morning, islanders! ☀️ You've got ${s.actions} chats today. Walk up to an islander to chat, visit the Beach Hut, or play challenges. Head to the firepit when you're ready for tonight.`],
  };
}

// --------------------------------------------------------------- main entry

export function seasonAct(s: Season | undefined, act: SeasonAction): { season: Season | undefined } & ActResult {
  if (act.a === 'start') {
    const ns = newSeason(Math.floor(Math.random() * 2 ** 31));
    return { season: ns, ok: true, scene: introScene(ns) };
  }
  if (!s) return { season: s, ok: false, msg: 'Start a season first! Talk to Jazz at the firepit.' };
  const r = rng(s);
  switch (act.a) {
    case 'status': return { season: s, ok: true, scene: statusScene(s) };
    case 'chat': return { season: s, ...chat(s, r, act.who) };
    case 'hut': return { season: s, ...hut(s, r) };
    case 'evening': return { season: s, ...evening(s, r) };
    case 'firepit': return { season: s, ...firepit(s, r) };
    case 'answer': return { season: s, ...answer(s, r, String(act.choice)) };
  }
  return { season: s, ok: false, msg: 'Unknown action.' };
}

function statusScene(s: Season): Scene {
  if (s.pending) return { kind: 'host', speaker: HOST.name, title: `Day ${s.day}`, lines: ["You've got something waiting for you — finish it first, babe!"] };
  const next = s.phase === 'morning' ? (s.actions > 0 ? `You've got ${s.actions} chats left today. Head to the firepit when you're ready for tonight.` : "That's all your chats for today — come to the firepit for tonight's twist!")
    : s.phase === 'evening' ? 'Something is happening tonight… meet me at the firepit!'
      : s.phase === 'firepit' ? 'Everyone to the firepit — it\'s time.'
        : s.phase === 'over' ? 'This season is over! Talk to me to start a brand new season.' : 'Come to the firepit to begin!';
  return {
    kind: 'host', speaker: HOST.name, title: `Day ${Math.min(s.day, FINAL_DAY)} · ${s.phase === 'over' ? 'Season over' : s.phase[0].toUpperCase() + s.phase.slice(1)}`,
    lines: [next, `Public popularity: ${s.popularity}/100. ${s.partner ? `You're coupled up with ${s.partner.replace(/^player:/, '')}.` : "You're currently single."}`],
  };
}

function chat(s: Season, r: () => number, who: string): ActResult {
  if (s.pending) return { ok: false, msg: 'Finish what you were doing first!' };
  if (s.phase !== 'morning') return { ok: false, msg: "It's nearly time for the firepit — chats are done for today." };
  if (s.actions <= 0) return { ok: false, msg: "You're out of chats today. Head to the firepit!" };
  const isl = islander(who);
  if (!isl || !s.cast.includes(who)) return { ok: false, msg: `${who} isn't in the villa right now.` };
  const topic = Math.floor(r() * TOPICS.length);
  const tones = shuffle(r, Object.keys(TONE_LABEL) as Tone[]).slice(0, 3);
  // Always offer at least one tone they like, so a good answer is possible.
  if (!tones.some((t) => PERSONAS[isl.persona].likes.includes(t))) tones[Math.floor(r() * 3)] = pickOne(r, PERSONAS[isl.persona].likes);
  s.pending = { type: 'chat', who, topic, tones };
  return {
    ok: true,
    scene: { kind: 'chat', speaker: who, title: `Chatting with ${who}`, lines: [`"${TOPICS[topic].prompt}"`], choices: tones.map((t) => ({ id: t, label: `${TONE_LABEL[t]} — "${TOPICS[topic].opts[t]}"` })) },
  };
}

function hut(s: Season, r: () => number): ActResult {
  if (s.pending) return { ok: false, msg: 'Finish what you were doing first!' };
  if (s.phase !== 'morning' || s.actions <= 0) return { ok: false, msg: 'The Beach Hut is closed until tomorrow morning.' };
  const topic = Math.floor(r() * BEACH_HUT.length);
  const tones = shuffle(r, Object.keys(TONE_LABEL) as Tone[]).slice(0, 3);
  s.pending = { type: 'hut', topic, tones };
  return {
    ok: true,
    scene: { kind: 'chat', speaker: 'Beach Hut', title: '🎥 The Beach Hut', lines: [BEACH_HUT[topic].prompt.replace('🎥 Beach Hut: ', '')], choices: tones.map((t) => ({ id: t, label: `${TONE_LABEL[t]} — "${BEACH_HUT[topic].opts[t]}"` })) },
  };
}

function useAction(s: Season, lines: string[]): void {
  s.actions = Math.max(0, s.actions - 1);
  if (s.actions === 0) lines.push("🎤 Jazz: That's all your chats for today! Meet me at the firepit for tonight's twist…");
}

function partnerName(s: Season): string | null {
  return s.partner && !s.partner.startsWith('player:') ? s.partner : null;
}

// --------------------------------------------------------------- evening events

const EVENTS = ['bombshell', 'date', 'challenge', 'movie', 'fallout', 'heart', 'talent'] as const;

function evening(s: Season, r: () => number): ActResult {
  if (s.pending) return { ok: false, msg: 'Finish what you were doing first!' };
  if (s.phase === 'evening' || s.phase === 'firepit') return firepit(s, r);
  if (s.phase !== 'morning') return { ok: false, msg: 'Not right now!' };
  s.phase = 'evening';
  const p = partnerName(s);
  let pool = EVENTS.filter((e) => !s.seen.slice(-2).includes(e));
  if (!s.pool.length) pool = pool.filter((e) => e !== 'bombshell');
  if (!p) pool = pool.filter((e) => e !== 'heart');
  if (s.day <= 1) pool = pool.filter((e) => e !== 'movie');
  // Bombshells are more likely early on; movie night more likely when you've been flirting.
  const weighted: string[] = [];
  for (const e of pool) {
    const w = e === 'bombshell' ? (s.day <= 6 ? 3 : 1) : e === 'movie' ? (s.flirts > 0 ? 4 : 1) : e === 'challenge' ? 2 : 1;
    for (let i = 0; i < w; i++) weighted.push(e);
  }
  const ev = pickOne(r, weighted);
  s.seen.push(ev);
  const greet = host(s, r);

  switch (ev) {
    case 'bombshell': {
      const who = s.pool.shift()!;
      s.cast.push(who);
      s.bonds[who] = 20;
      const isl = islander(who)!;
      const target = r() < 0.55 ? 'YOU' : p && r() < 0.6 ? p : pickOne(r, s.cast.filter((n) => n !== who));
      if (target === 'YOU') {
        s.pending = { type: 'event', ev, who, options: p ? ['date', 'loyal'] : ['date', 'friends'] };
        return { ok: true, scene: { kind: 'event', speaker: HOST.name, title: '💣 BOMBSHELL!', mood: 'drama', cards: [who], lines: [greet, `There's a new bombshell in the villa… say hello to ${who}, ${isl.age}, a ${isl.job.toLowerCase()} from ${isl.from}!`, `And ${they(who)} wants to take… YOU on a date! 😱`],
          choices: p ? [{ id: 'date', label: `🌅 Go on the date with ${who}` }, { id: 'loyal', label: `🤞 Politely say no — I'm loyal to ${p}` }] : [{ id: 'date', label: `🌅 Go on the date with ${who}` }, { id: 'friends', label: '🤝 Keep it friendly for now' }] } };
      }
      const wasPartner = target === p;
      s.pending = { type: 'event', ev, who, other: target, options: wasPartner ? ['calm', 'confront'] : ['ok'] };
      return { ok: true, scene: { kind: 'event', speaker: HOST.name, title: '💣 BOMBSHELL!', mood: 'drama', cards: [who], lines: [greet, `A bombshell has entered the villa: ${who}, ${isl.age}, from ${isl.from}!`, wasPartner ? `…and ${they(who)} has picked YOUR partner ${target} for a date. 😬` : `${who} has picked ${target} for a date. The villa is shook!`],
        choices: wasPartner ? [{ id: 'calm', label: "😌 Stay calm — I trust them" }, { id: 'confront', label: '😤 Pull them for a chat later' }] : [{ id: 'ok', label: '👀 Interesting…' }] } };
    }
    case 'date': {
      const options = s.cast.filter((n) => n !== p);
      const who = options.sort((a, b) => (s.bonds[b] ?? 0) - (s.bonds[a] ?? 0))[Math.floor(r() * Math.min(2, options.length))] ?? s.cast[0];
      s.pending = { type: 'event', ev, who, options: ['go', 'no'] };
      const where = pickOne(r, ['a sunset picnic on the beach', 'stargazing on the rooftop deck', 'a smoothie bar date', 'a paddleboarding date', 'a cooking class']);
      return { ok: true, scene: { kind: 'event', speaker: '📱 Text', title: '📱 I GOT A TEXT!', mood: 'love', cards: [who], lines: [`"${s.cast.includes(who) ? who : 'Someone'} wants to take you on a secret date: ${where}. #SecretDate #WhatWillYouDo"`, p ? `(${p} doesn't know about this text…)` : ''].filter(Boolean),
        choices: [{ id: 'go', label: `💌 Go on the secret date with ${who}` }, { id: 'no', label: p ? `🙅 Say no — I'm happy with ${p}` : '🙅 Say no thanks' }] } };
    }
    case 'challenge': {
      const game = pickOne(r, ['timing', 'simon', 'choice'] as const);
      const name = game === 'timing' ? 'Beach Volleyball Showdown' : game === 'simon' ? 'Heart Rate Dance-off' : 'Mr & Mrs Quiz';
      s.pending = { type: 'game', ev, game };
      return { ok: true, scene: { kind: 'game', speaker: HOST.name, title: `🏆 Challenge: ${name}`, mood: 'news', game, lines: [greet, `It's challenge time! Tonight's challenge is the ${name}. Win it and the public will LOVE you.`], choices: [{ id: 'play', label: "🔥 Let's go!" }] } };
    }
    case 'movie': {
      s.pending = { type: 'event', ev, options: ['sorry', 'own'] };
      if (p && s.flirts > 0) {
        return { ok: true, scene: { kind: 'event', speaker: HOST.name, title: '🎬 Movie Night', mood: 'drama', lines: [greet, "It's MOVIE NIGHT! 🍿 Let's see what the islanders have been up to…", `Uh oh. A clip shows you on a secret date while coupled up with ${p}! 😱`, `${p} is NOT happy.`],
          choices: [{ id: 'sorry', label: `🥺 Apologise to ${p}` }, { id: 'own', label: '😏 Own it — I was exploring' }] } };
      }
      s.pending = { type: 'event', ev, options: ['ok'] };
      return { ok: true, scene: { kind: 'event', speaker: HOST.name, title: '🎬 Movie Night', mood: 'happy', lines: [greet, "It's MOVIE NIGHT! 🍿", p ? `The clips show you being super loyal to ${p}. The villa goes "awww"! 🥰` : 'The clips show you being the funniest person in the villa. The public loves it! 😂'], choices: [{ id: 'ok', label: '🥰 Love that' }] } };
    }
    case 'fallout': {
      const [a, b] = shuffle(r, s.cast).slice(0, 2);
      const why = pickOne(r, ['who finished the last of the pancakes', 'who left wet towels on the daybeds', 'who said what at the firepit', 'who stole the hammock', 'who was talking behind whose back']);
      s.pending = { type: 'event', ev, who: a, other: b, options: [a, b, 'out'] };
      return { ok: true, scene: { kind: 'event', speaker: HOST.name, title: '😤 Villa Drama', mood: 'drama', cards: [a, b], lines: [greet, `${a} and ${b} have fallen out over ${why}!`, 'Everyone is picking sides…'],
        choices: [{ id: a, label: `Back ${a}` }, { id: b, label: `Back ${b}` }, { id: 'out', label: '🙊 Stay out of it' }] } };
    }
    case 'heart': {
      s.pending = { type: 'event', ev, who: p!, options: ['only', 'open', 'joke'] };
      return { ok: true, scene: { kind: 'event', speaker: p!, title: `💬 ${p} pulls you for a chat`, mood: 'love', cards: [p!], lines: [`"Can I grab you for a sec? I just want to know… where's your head at?"`],
        choices: [{ id: 'only', label: "💘 \"It's only you. I'm not looking anywhere else.\"" }, { id: 'open', label: '🤔 "I like you, but I\'m keeping my options open."' }, { id: 'joke', label: '😂 "My head? It\'s right here, silly."' }] } };
    }
    default: {
      s.pending = { type: 'event', ev: 'talent', options: ['sing', 'dance', 'joke'] };
      return { ok: true, scene: { kind: 'event', speaker: HOST.name, title: '🎤 Villa Talent Show', mood: 'happy', lines: [greet, "Tonight it's the VILLA TALENT SHOW! What's your act?"],
        choices: [{ id: 'sing', label: '🎶 Sing a ballad' }, { id: 'dance', label: '💃 Dance routine' }, { id: 'joke', label: '😂 Stand-up comedy' }] } };
    }
  }
}

// --------------------------------------------------------------- firepit

function firepit(s: Season, r: () => number): ActResult {
  if (s.pending) return { ok: false, msg: 'Finish what you were doing first!' };
  if (s.phase === 'morning') return evening(s, r);
  if (s.phase === 'over') return { ok: true, scene: statusScene(s) };
  s.phase = 'firepit';
  const p = partnerName(s);
  const greet = host(s, r);
  if (s.day >= FINAL_DAY) return final(s, r);

  if (s.day % 3 === 0) {
    const options = s.cast.filter(Boolean);
    s.pending = { type: 'recouple', options };
    return { ok: true, scene: { kind: 'event', speaker: HOST.name, title: '🔥 Recoupling', mood: 'drama', lines: [greet, "Tonight there's a RECOUPLING! 🔥", "Each islander will choose who they want to couple up with. If nobody picks you… you could be at risk.", 'Who do you want to couple up with?'],
      choices: options.map((n) => ({ id: n, label: `${n === p ? '💖' : '💘'} ${n}${n === p ? ' (your current partner)' : ''} — bond ${s.bonds[n] ?? 0}` })) } };
  }
  if (s.day % 3 === 2 && s.day >= 4) return dumping(s, r, greet);
  // A calm night: recap + gossip.
  const lines = [greet, pickOne(r, [
    "Tonight's a quiet one… or IS it? Rest up, tomorrow could change everything. 😏",
    'The islanders are toasting marshmallows at the firepit. 🍡 Enjoy it while it lasts!',
    "Word is the public are watching VERY closely. Make tomorrow count!",
  ])];
  return nextDay(s, r, lines);
}

function dumping(s: Season, r: () => number, greet: string): ActResult {
  const p = partnerName(s);
  const bond = p ? s.bonds[p] ?? 0 : 0;
  const lines = [greet, 'Islanders… the public have been voting for their FAVOURITE islanders. 📱', "The islanders with the fewest votes are at risk of being DUMPED from the island."];
  const safety = s.popularity * 0.5 + (p ? bond * 0.35 : 0) + r() * 30;
  if (safety < 48) {
    s.phase = 'over';
    s.result = 'dumped';
    s.log.push(`Dumped on day ${s.day}`);
    const aura = s.day * 20;
    return {
      ok: true, reward: { aura, total: 0, win: false },
      scene: { kind: 'final', speaker: HOST.name, title: '💔 Dumped from the Island', mood: 'sad', lines: [...lines, `I'm sorry… you received the fewest votes. You have been DUMPED from the island. 💔`, `You lasted ${s.day} days! +${aura} Aura for your time in the villa.`, 'Talk to me at the firepit to start a brand new season.'] },
    };
  }
  const singles = s.cast.filter((n) => n !== p && !npcPartner(s, n));
  const atRisk = singles.length ? singles : s.cast.filter((n) => n !== p);
  const out = atRisk.length > 2 ? pickOne(r, atRisk) : null;
  if (out) {
    s.cast = s.cast.filter((n) => n !== out);
    unpairNpc(s, out);
    s.dumped.push(out);
    lines.push(`The islander leaving the villa tonight is… ${out}. 😢`, `${out} hugs everyone goodbye.`);
  } else lines.push('…and the public have decided NOBODY goes home tonight! 🎉');
  lines.push(`You're safe! 🙌 Popularity ${s.popularity}/100.`);
  return nextDay(s, r, lines, out ? [out] : undefined);
}

function final(s: Season, r: () => number): ActResult {
  s.phase = 'over';
  const p = partnerName(s) ?? (s.partner ? s.partner.replace(/^player:/, '') : null);
  const bond = partnerName(s) ? s.bonds[partnerName(s)!] ?? 0 : 70;
  const mine = p ? s.popularity * 0.5 + bond * 0.5 + r() * 20 : 0;
  const rivals = s.couples.map(() => 55 + r() * 40);
  const won = !!p && mine >= Math.max(0, ...rivals);
  s.result = won ? 'won' : 'runnerup';
  const lines = ['Islaaanders… it\'s the FINAL! 🏆', `The public have voted, and this season's winners are…`];
  if (won) {
    lines.push(`YOU and ${p}! 🏆💘 Congratulations!`, `+${WIN_AURA} Aura and a trophy for your mansion. You're Love Island royalty!`);
    s.log.push(`Won the season with ${p}`);
    return { ok: true, reward: { aura: WIN_AURA, total: WIN_AURA, win: true }, scene: { kind: 'final', speaker: HOST.name, title: '🏆 THE FINAL', mood: 'love', lines } };
  }
  const winners = s.couples[0] ? `${s.couples[0][0]} & ${s.couples[0][1]}` : 'the other couple';
  lines.push(`${winners}! 🎉`, p ? `You and ${p} came so close — you made the final! +${RUNNERUP_AURA} Aura.` : `You made it to the final day single — legend! +${RUNNERUP_AURA} Aura.`);
  s.log.push('Made the final');
  return { ok: true, reward: { aura: RUNNERUP_AURA, total: 0, win: false }, scene: { kind: 'final', speaker: HOST.name, title: '🏆 THE FINAL', mood: 'happy', lines } };
}

function nextDay(s: Season, r: () => number, lines: string[], gone?: string[]): ActResult {
  s.day += 1;
  s.phase = 'morning';
  s.actions = ACTIONS_PER_DAY;
  s.pending = null;
  // The public get bored if nothing happens.
  s.popularity = clamp(s.popularity - 4);
  // NPC couples shuffle a little overnight.
  if (r() < 0.3) pairNpcs(s, r);
  lines.push(`🌙 Goodnight, villa! See you on Day ${s.day}. (+${DAY_AURA} Aura)`);
  if (gone?.length) s.log.push(`Day ${s.day - 1}: ${gone.join(', ')} dumped`);
  return { ok: true, reward: { aura: DAY_AURA, total: 0, win: false }, scene: { kind: 'result', speaker: HOST.name, title: `Day ${s.day - 1} · Night`, mood: 'news', lines } };
}

// --------------------------------------------------------------- answers

function bond(s: Season, who: string, delta: number, out: { who: string; delta: number }[]): void {
  if (!who || !(who in s.bonds)) return;
  s.bonds[who] = clamp(s.bonds[who] + delta);
  out.push({ who, delta });
}

function answer(s: Season, r: () => number, choice: string): ActResult {
  const pend = s.pending;
  if (!pend) return { ok: false, msg: 'Nothing to answer right now.' };
  const p = partnerName(s);
  const bonds: { who: string; delta: number }[] = [];
  const lines: string[] = [];
  const done = (title: string, mood: Scene['mood'] = 'happy', then?: () => ActResult): ActResult => {
    s.pending = null;
    if (then) {
      const nxt = then();
      if (nxt.scene) nxt.scene.lines = [...lines, '', ...nxt.scene.lines];
      if (nxt.scene) nxt.scene.bonds = [...bonds, ...(nxt.scene.bonds ?? [])];
      return nxt;
    }
    return { ok: true, scene: { kind: 'result', speaker: HOST.name, title, mood, lines, bonds } };
  };

  switch (pend.type) {
    case 'firstcouple': {
      if (!pend.options.includes(choice)) return { ok: false, msg: 'Pick one of the islanders.' };
      s.partner = choice;
      bond(s, choice, 20, bonds);
      s.phase = 'morning';
      pairNpcs(s, r);
      lines.push(`💘 You've coupled up with ${choice}!`, `"${islander(choice)!.line}"`, ...s.couples.map(([a, b]) => `${a} & ${b} have coupled up too.`));
      const single = s.cast.filter((n) => n !== s.partner && !npcPartner(s, n));
      if (single.length) lines.push(`${single.join(' and ')} ${single.length > 1 ? 'are' : 'is'} single… for now. 😬`);
      lines.push('', morningScene(s).lines[0]);
      return done('💘 The First Coupling', 'love');
    }
    case 'chat': {
      const tone = choice as Tone;
      if (!pend.tones.includes(tone)) return { ok: false, msg: 'Pick an answer.' };
      const isl = islander(pend.who)!;
      const per = PERSONAS[isl.persona];
      const liked = per.likes.includes(tone), hated = per.hates.includes(tone);
      const delta = liked ? 10 + Math.floor(r() * 5) : hated ? -6 : 3 + Math.floor(r() * 3);
      bond(s, pend.who, delta, bonds);
      lines.push(fill(pickOne(r, REACT[liked ? 'liked' : hated ? 'hated' : 'neutral']), pend.who));
      if (p && pend.who !== p && (tone === 'sweet' || tone === 'bold') && liked) {
        s.flirts += 1;
        lines.push(`👀 Careful… ${p} might not love you flirting with ${pend.who}.`);
      }
      if (pend.who === p && liked) lines.push(`💖 You and ${p} are getting closer.`);
      useAction(s, lines);
      return done(`💬 ${pend.who}`, liked ? 'love' : hated ? 'sad' : 'happy');
    }
    case 'hut': {
      const tone = choice as Tone;
      if (!pend.tones.includes(tone)) return { ok: false, msg: 'Pick an answer.' };
      const gain = { funny: 6, bold: 6, deep: 4, sweet: 3, sporty: 3, chill: 2 }[tone] + Math.floor(r() * 3);
      s.popularity = clamp(s.popularity + gain);
      lines.push(pickOne(r, ['The public LOVED that! 📈', 'Iconic Beach Hut moment. 🎥', 'That clip is going viral! 📱', 'The producers are thrilled. 🎬']), `Popularity +${gain} (now ${s.popularity}/100)`);
      useAction(s, lines);
      return done('🎥 The Beach Hut');
    }
    case 'game': {
      const win = choice === 'win';
      if (win) {
        s.popularity = clamp(s.popularity + 10);
        if (p) bond(s, p, 6, bonds);
        lines.push('🏆 You WON the challenge! The public are obsessed. (+10 popularity)');
      } else {
        s.popularity = clamp(s.popularity + 3);
        lines.push("You didn't win this time, but you were a good sport. (+3 popularity)");
      }
      s.phase = 'firepit';
      lines.push('', '🔥 Tonight… meet me at the firepit.');
      return done(win ? '🏆 Challenge Won!' : 'Challenge Over', win ? 'happy' : 'news');
    }
    case 'recouple': {
      if (!pend.options.includes(choice)) return { ok: false, msg: 'Pick an islander.' };
      const old = p;
      const b = s.bonds[choice] ?? 0;
      // Twist: even a happy couple can be split when someone else picks your partner first.
      const stolen = choice === old && s.day >= 6 && r() < 0.15;
      const accepts = !stolen && (choice === old ? b >= 25 || r() < 0.7 : b + r() * 35 >= 45);
      if (stolen) {
        const thief = pickOne(r, s.cast.filter((n) => n !== choice)) ?? 'Someone';
        lines.push(`😱 TWIST! ${thief} chose ${choice} before you could!`);
      }
      // Your old partner might choose someone else, too.
      if (accepts) {
        s.partner = choice;
        unpairNpc(s, choice);
        lines.push(`You chose ${choice}…`, `…and ${choice} chose YOU! 💘`);
        bond(s, choice, 8, bonds);
        if (old && old !== choice) { bond(s, old, -12, bonds); lines.push(`${old} looks gutted. 💔`); }
      } else {
        s.partner = null;
        lines.push(`You chose ${choice}…`, `…but ${choice} chose someone else! 😱`, "You're single now — and at risk at the next dumping.");
        if (old) bond(s, old, -8, bonds);
      }
      pairNpcs(s, r);
      lines.push(...s.couples.slice(0, 3).map(([a, c]) => `${a} & ${c} are coupled up.`));
      s.phase = 'firepit';
      return done('🔥 Recoupling', accepts ? 'love' : 'drama', () => nextDay(s, r, []));
    }
    case 'event': {
      if (!pend.options.includes(choice)) return { ok: false, msg: 'Pick an option.' };
      const who = pend.who ?? '';
      switch (pend.ev) {
        case 'bombshell':
          if (choice === 'date') {
            bond(s, who, 18, bonds);
            lines.push(`🌅 You and ${who} watched the sunset and chatted for hours.`);
            if (p) { s.flirts += 1; bond(s, p, -10, bonds); lines.push(`${p} saw you leave… 😬`); }
          } else if (choice === 'loyal') {
            bond(s, p!, 12, bonds); bond(s, who, -4, bonds);
            lines.push(`${p} heard you stayed loyal. 🥹 Major points!`);
          } else if (choice === 'friends') {
            bond(s, who, 8, bonds); lines.push(`You and ${who} hit it off as mates. Who knows what's next?`);
          } else if (choice === 'calm') {
            bond(s, pend.other!, 6, bonds); s.popularity = clamp(s.popularity + 3);
            lines.push(`${pend.other} came back from the date and went straight to you. 💖`);
          } else if (choice === 'confront') {
            s.popularity = clamp(s.popularity + 7);
            const d = r() < 0.5 ? 6 : -8;
            bond(s, pend.other!, d, bonds);
            lines.push(d > 0 ? `${pend.other} reassures you it was nothing. Phew.` : `It turned into a full-on argument by the pool! 🍿 Great TV though.`);
          } else lines.push(`The villa can't stop talking about ${who}. 👀`);
          break;
        case 'date':
          if (choice === 'go') {
            bond(s, who, 16, bonds);
            lines.push(`💌 You had the best secret date with ${who}. Total sparks! ✨`);
            if (p) { s.flirts += 1; lines.push(`${p} doesn't know… yet. 🤫`); }
          } else {
            if (p) bond(s, p, 6, bonds);
            bond(s, who, -3, bonds);
            lines.push(p ? `You stayed loyal to ${p}. 🤞` : 'You politely said no. Mysterious!');
          }
          break;
        case 'movie':
          if (choice === 'sorry') { bond(s, p!, 6 - s.flirts * 6, bonds); lines.push(`${p} accepts your apology… slowly. 🥺`); }
          else if (choice === 'own') { bond(s, p!, -10 * s.flirts, bonds); s.popularity = clamp(s.popularity + 8); lines.push('The villa gasps! The public are LOVING the drama. 🍿'); }
          else { if (p) bond(s, p, 10, bonds); s.popularity = clamp(s.popularity + 4); lines.push('What a night! 🍿'); }
          s.flirts = 0;
          break;
        case 'fallout':
          if (choice === 'out') { s.popularity = clamp(s.popularity - 2); lines.push('You kept your head down. Safe, but a bit boring for the cameras.'); }
          else {
            const other = choice === who ? pend.other! : who;
            bond(s, choice, 10, bonds); bond(s, other, -10, bonds);
            s.popularity = clamp(s.popularity + 3);
            lines.push(`You backed ${choice}. ${other} is giving you the side-eye now. 👀`);
          }
          break;
        case 'heart': {
          const per = PERSONAS[islander(who)!.persona];
          if (choice === 'only') { bond(s, who, 14, bonds); lines.push(`${who} pulls you into a big hug. 🥰`); }
          else if (choice === 'open') { bond(s, who, -12, bonds); s.popularity = clamp(s.popularity + 4); lines.push(`${who} walks off to the daybeds… 💔`); }
          else { const d = per.likes.includes('funny') ? 8 : -4; bond(s, who, d, bonds); lines.push(d > 0 ? `${who} can't stop laughing. 😂` : `${who}: "I was being serious…" 😐`); }
          break;
        }
        case 'talent': {
          const gain = choice === 'joke' ? 9 : choice === 'dance' ? 7 : 6;
          s.popularity = clamp(s.popularity + gain + Math.floor(r() * 4));
          lines.push(choice === 'sing' ? 'You sang your heart out. Tears at the firepit! 🎶' : choice === 'dance' ? 'Your dance routine went OFF. 💃' : "Your stand-up had everyone crying laughing! 😂", `Popularity now ${s.popularity}/100.`);
          if (p) bond(s, p, 4, bonds);
          break;
        }
        default: lines.push('What a night!');
      }
      s.phase = 'firepit';
      lines.push('', "🔥 Head to the firepit — there's more to come tonight…");
      return done(`🌙 Day ${s.day} · Evening`, 'news');
    }
  }
}

/** Where the player's season currently wants them to go. */
export function nextStep(s: Season | undefined): string {
  if (!s) return 'Talk to Jazz at the firepit to start your season';
  if (s.phase === 'over') return 'Season over — talk to Jazz to start a new one';
  if (s.pending) return 'Answer your pending moment (Season ▸)';
  if (s.phase === 'morning') return s.actions > 0 ? `Chat to islanders (${s.actions} left) or go to the firepit` : 'Go to the firepit for tonight';
  return 'Go to the firepit';
}

export { them, PERSONAS as PERSONA_INFO };
