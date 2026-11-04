// Game-mode rules shared by the server (authoritative) and the browser (for display).

export const MODES = {
  classic: {
    name: 'Live Quiz',
    tagline: 'Host shows each question on the big screen. Fast answers score more.',
    paced: 'host',
  },
  race: {
    name: 'Cash Race',
    tagline: 'Everyone answers at their own pace, earns cash and buys upgrades. First to the goal wins.',
    paced: 'self',
  },
  gold: {
    name: 'Treasure Steal',
    tagline: 'Every right answer opens a chest: gold, double, triple... or steal from a friend.',
    paced: 'self',
  },
};

export const DEFAULT_OPTIONS = {
  classic: { shuffle: false, timeScale: 1 },
  race: { goal: 25000, minutes: 7 },
  gold: { minutes: 7, goal: 0 },
};

export const OPTION_LIMITS = {
  goal: [0, 10_000_000],
  minutes: [1, 30],
  timeScale: [0.5, 3],
};

export function cleanOptions(mode, input = {}) {
  const base = { ...DEFAULT_OPTIONS[mode] };
  for (const k of Object.keys(base)) {
    if (input[k] === undefined) continue;
    if (typeof base[k] === 'boolean') base[k] = !!input[k];
    else {
      const n = Number(input[k]);
      if (Number.isFinite(n)) {
        const [lo, hi] = OPTION_LIMITS[k] || [-Infinity, Infinity];
        base[k] = Math.max(lo, Math.min(hi, n));
      }
    }
  }
  return base;
}

// ---------------------------------------------------------------- Live Quiz scoring

export const CLASSIC = {
  maxPoints: 1000,
  streakBonus: 100,
  maxStreakBonus: 500,
  getReadyMs: 3000,
};

export function classicPoints(elapsedMs, limitMs, streak) {
  const frac = Math.min(1, Math.max(0, elapsedMs / limitMs));
  const base = Math.round(CLASSIC.maxPoints * (1 - frac / 2));
  const bonus = Math.min(CLASSIC.maxStreakBonus, Math.max(0, streak - 1) * CLASSIC.streakBonus);
  return base + bonus;
}

// ---------------------------------------------------------------- Cash Race upgrades
// Each upgrade has a list of levels: value at that level and the cost to reach it.

export const UPGRADES = {
  income: {
    name: 'Cash per answer',
    desc: 'Base money for each correct answer',
    levels: [
      { value: 10, cost: 0 }, { value: 25, cost: 100 }, { value: 60, cost: 400 }, { value: 150, cost: 1200 },
      { value: 400, cost: 4000 }, { value: 1000, cost: 12000 }, { value: 2500, cost: 35000 },
      { value: 6000, cost: 100000 }, { value: 15000, cost: 300000 }, { value: 40000, cost: 900000 },
    ],
    fmt: (v) => `$${v.toLocaleString()}`,
  },
  multiplier: {
    name: 'Multiplier',
    desc: 'Multiplies all cash you earn',
    levels: [
      { value: 1, cost: 0 }, { value: 1.5, cost: 250 }, { value: 2, cost: 1000 }, { value: 3, cost: 5000 },
      { value: 5, cost: 25000 }, { value: 8, cost: 120000 }, { value: 12, cost: 500000 },
    ],
    fmt: (v) => `×${v}`,
  },
  streak: {
    name: 'Streak bonus',
    desc: 'Extra cash for every answer in your current streak',
    levels: [
      { value: 0, cost: 0 }, { value: 5, cost: 150 }, { value: 20, cost: 800 }, { value: 75, cost: 4000 },
      { value: 250, cost: 20000 }, { value: 800, cost: 90000 }, { value: 2500, cost: 400000 },
    ],
    fmt: (v) => `+$${v.toLocaleString()}/streak`,
  },
  shield: {
    name: 'Mistake shield',
    desc: 'Wrong answers cost less (base penalty is 20% of what a right answer earns)',
    levels: [
      { value: 0.2, cost: 0 }, { value: 0.1, cost: 300 }, { value: 0.05, cost: 2000 }, { value: 0, cost: 10000 },
    ],
    fmt: (v) => (v === 0 ? 'No penalty' : `-${Math.round(v * 100)}%`),
  },
};

export function raceEarn(levels, streak) {
  const income = UPGRADES.income.levels[levels.income].value;
  const mult = UPGRADES.multiplier.levels[levels.multiplier].value;
  const per = UPGRADES.streak.levels[levels.streak].value;
  return Math.round((income + per * Math.max(0, streak - 1)) * mult);
}
export function racePenalty(levels) {
  const income = UPGRADES.income.levels[levels.income].value;
  const mult = UPGRADES.multiplier.levels[levels.multiplier].value;
  return Math.round(income * mult * UPGRADES.shield.levels[levels.shield].value);
}

// ---------------------------------------------------------------- Treasure Steal chests

export const CHESTS = [
  { kind: 'gain', amount: 10, weight: 14 },
  { kind: 'gain', amount: 20, weight: 14 },
  { kind: 'gain', amount: 30, weight: 12 },
  { kind: 'gain', amount: 40, weight: 10 },
  { kind: 'gain', amount: 50, weight: 9 },
  { kind: 'gain', amount: 75, weight: 6 },
  { kind: 'gain', amount: 100, weight: 4 },
  { kind: 'gainPct', amount: 10, weight: 6 },
  { kind: 'gainPct', amount: 25, weight: 4 },
  { kind: 'double', weight: 5 },
  { kind: 'triple', weight: 2 },
  { kind: 'steal', amount: 10, weight: 4 },
  { kind: 'steal', amount: 25, weight: 3 },
  { kind: 'swap', weight: 1.5 },
  { kind: 'losePct', amount: 10, weight: 3 },
  { kind: 'losePct', amount: 25, weight: 2 },
  { kind: 'nothing', weight: 3 },
];

export function rollChest(rand) {
  const total = CHESTS.reduce((t, c) => t + c.weight, 0);
  let x = rand() * total;
  for (const c of CHESTS) {
    if (x < c.weight) return { kind: c.kind, amount: c.amount };
    x -= c.weight;
  }
  return { kind: 'nothing' };
}

export function chestLabel(c) {
  switch (c.kind) {
    case 'gain': return `+${c.amount} Gold`;
    case 'gainPct': return `+${c.amount}%`;
    case 'double': return 'Double Gold!';
    case 'triple': return 'TRIPLE Gold!';
    case 'steal': return `Steal ${c.amount}%`;
    case 'swap': return 'Swap!';
    case 'losePct': return `Lose ${c.amount}%`;
    default: return 'Nothing...';
  }
}

// ---------------------------------------------------------------- coins earned at the end of a game

export function coinReward({ place, players, correct }) {
  let coins = 5 + Math.min(40, correct * 2);
  if (players >= 3) coins += [25, 15, 10][place - 1] ?? 0;
  else if (players === 2 && place === 1) coins += 10;
  return Math.min(100, coins);
}

export const DAILY_BONUS = 50;
export const AI_DAILY_LIMIT = 25;

export const ANSWER_COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c', '#9333ea', '#0891b2'];
export const ANSWER_SHAPES = ['▲', '◆', '●', '■', '★', '⬟'];
