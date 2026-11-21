/** How a character looks. Shared by players, islanders and the host. */
export interface Look {
  body: 'girl' | 'boy';
  skin: string;
  hair: string;       // style key (see HAIR)
  hairColor: string;
  outfit: string;     // shop item id
  build?: Build;
  height?: Height;
  eyes?: string;
  lips?: string;
  beard?: Beard;
  glasses?: string;
  bag?: string;
  jewel?: string;
  hat?: string;
  perfume?: string;
}

export type Build = 'slim' | 'average' | 'athletic' | 'curvy' | 'strong';
export type Height = 'short' | 'medium' | 'tall';
export type Beard = 'none' | 'stubble' | 'short';

export const SKINS = ['#ffe3d3', '#f7d0b2', '#eab48f', '#d39a72', '#b07650', '#8a5636', '#5f3a24'];
export const HAIR_COLORS = ['#1c1410', '#3b2518', '#5e3b24', '#8a5a34', '#b98552', '#d9b277', '#efd7a6', '#a8432f', '#2a2a30', '#e9a7c0'];
export const EYE_COLORS = ['#4a2e1a', '#6b4423', '#3c6e8f', '#4f7a4a', '#7a8a92', '#2b1a10'];
export const LIP_COLORS = ['#c9867a', '#d98c8c', '#b85c6b', '#e07a8a', '#a8524f', '#9c6b5e'];
export const BUILDS: { id: Build; label: string }[] = [
  { id: 'slim', label: 'Slim' }, { id: 'average', label: 'Average' }, { id: 'athletic', label: 'Athletic' },
  { id: 'curvy', label: 'Curvy' }, { id: 'strong', label: 'Strong' },
];
export const HEIGHTS: { id: Height; label: string }[] = [{ id: 'short', label: 'Petite' }, { id: 'medium', label: 'Average' }, { id: 'tall', label: 'Tall' }];
export const BEARDS: { id: Beard; label: string }[] = [{ id: 'none', label: 'Clean shaven' }, { id: 'stubble', label: 'Stubble' }, { id: 'short', label: 'Short beard' }];

/** Hairstyles. None of them have a fringe. */
export const HAIR: { id: string; label: string; for: 'girl' | 'boy' | 'any' }[] = [
  { id: 'long', label: 'Long & sleek', for: 'girl' },
  { id: 'waves', label: 'Beach waves', for: 'girl' },
  { id: 'sleekpony', label: 'Sleek ponytail', for: 'girl' },
  { id: 'topbun', label: 'Top bun', for: 'girl' },
  { id: 'lob', label: 'Long bob', for: 'girl' },
  { id: 'braids', label: 'Two braids', for: 'girl' },
  { id: 'curls', label: 'Big curls', for: 'any' },
  { id: 'crop', label: 'Textured crop', for: 'boy' },
  { id: 'quiff', label: 'Swept-up quiff', for: 'boy' },
  { id: 'slick', label: 'Slicked back', for: 'boy' },
  { id: 'curlytop', label: 'Curly top fade', for: 'boy' },
  { id: 'surfer', label: 'Surfer waves', for: 'any' },
  { id: 'manbun', label: 'Man bun', for: 'boy' },
  { id: 'buzz', label: 'Buzz cut', for: 'any' },
];
export const HAIR_STYLES = HAIR.map((h) => h.id);

/** Older saves used different hairstyle names. */
const OLD_HAIR: Record<string, [string, string]> = {
  long: ['long', 'surfer'], bun: ['topbun', 'manbun'], ponytail: ['sleekpony', 'manbun'], bob: ['lob', 'crop'],
  short: ['lob', 'crop'], curly: ['curls', 'curlytop'], buzz: ['buzz', 'buzz'],
};

/** Fills in missing fields and upgrades old values. */
export function normalizeLook(l: Look): Look {
  const out: Look = { ...l };
  if (!HAIR_STYLES.includes(out.hair) || (out.hair === 'long' && out.body === 'boy')) {
    const m = OLD_HAIR[out.hair];
    out.hair = m ? (out.body === 'boy' ? m[1] : m[0]) : out.body === 'boy' ? 'crop' : 'long';
  }
  if (!SKINS.includes(out.skin)) out.skin = nearest(out.skin, SKINS);
  if (!HAIR_COLORS.includes(out.hairColor)) out.hairColor = nearest(out.hairColor, HAIR_COLORS);
  out.build ??= out.body === 'boy' ? 'athletic' : 'average';
  out.height ??= 'medium';
  out.eyes ??= EYE_COLORS[0];
  out.lips ??= out.body === 'boy' ? '#b07a6e' : LIP_COLORS[0];
  out.beard ??= 'none';
  return out;
}

function nearest(hex: string, list: string[]): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
  const a = p(hex);
  let best = list[0], bd = Infinity;
  for (const c of list) {
    const b = p(c);
    const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
