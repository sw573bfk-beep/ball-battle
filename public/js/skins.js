// Original "blob" characters, drawn as SVG from a few parameters. Shared by browser + Worker.

export const RARITIES = {
  starter:   { name: 'Starter',   color: '#9aa4b2', weight: 0,    refund: 0 },
  common:    { name: 'Common',    color: '#b8c2cc', weight: 55,   refund: 5 },
  uncommon:  { name: 'Uncommon',  color: '#4ade80', weight: 26,   refund: 10 },
  rare:      { name: 'Rare',      color: '#38bdf8', weight: 12,   refund: 25 },
  epic:      { name: 'Epic',      color: '#c084fc', weight: 5.4,  refund: 60 },
  legendary: { name: 'Legendary', color: '#fbbf24', weight: 1.4,  refund: 150 },
  mythic:    { name: 'Mythic',    color: '#f472b6', weight: 0.2,  refund: 400 },
};
export const RARITY_ORDER = ['starter', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

const S = (id, name, rarity, color, o = {}) => ({ id, name, rarity, color, belly: o.belly ?? null, eyes: o.eyes ?? 'dot', mouth: o.mouth ?? 'smile', acc: o.acc ?? 'none', pattern: o.pattern ?? 'none', shape: o.shape ?? 'blob', cheeks: o.cheeks ?? false, accColor: o.accColor ?? null });

export const SKINS = [
  // Free for everyone
  S('blob-mint', 'Minty', 'starter', '#34d399'),
  S('blob-sky', 'Skyler', 'starter', '#60a5fa'),
  S('blob-sun', 'Sunny', 'starter', '#facc15', { mouth: 'open' }),
  S('blob-rose', 'Rosie', 'starter', '#fb7185', { cheeks: true }),

  // Snack Box
  S('snack-toast', 'Toasty', 'common', '#e9b872', { belly: '#f6dfb0', mouth: 'open' }),
  S('snack-pickle', 'Pickles', 'common', '#84cc16', { pattern: 'spots', eyes: 'sleepy' }),
  S('snack-berry', 'Blueberry', 'common', '#6366f1', { acc: 'leaf', accColor: '#22c55e' }),
  S('snack-cookie', 'Cookie', 'uncommon', '#b7794a', { pattern: 'spots', cheeks: true }),
  S('snack-donut', 'Sprinkles', 'uncommon', '#f9a8d4', { pattern: 'sprinkles', belly: '#f3d1a6' }),
  S('snack-taco', 'Taco Tim', 'rare', '#fcd34d', { belly: '#f87171', mouth: 'tongue' }),
  S('snack-sushi', 'Maki', 'rare', '#f8fafc', { belly: '#fb923c', acc: 'band', accColor: '#111827' }),
  S('snack-cake', 'Birthday Cake', 'epic', '#fde2e4', { acc: 'candle', pattern: 'stripes', cheeks: true }),
  S('snack-golden-apple', 'Golden Apple', 'legendary', '#fbbf24', { acc: 'leaf', accColor: '#16a34a', eyes: 'star' }),

  // Space Box
  S('space-moon', 'Moonpie', 'common', '#cbd5e1', { pattern: 'spots', eyes: 'sleepy' }),
  S('space-comet', 'Comet', 'common', '#7dd3fc', { mouth: 'open' }),
  S('space-martian', 'Zorp', 'uncommon', '#a3e635', { eyes: 'cyclops', acc: 'antenna' }),
  S('space-astro', 'Astro', 'uncommon', '#f1f5f9', { acc: 'helmet', belly: '#e2e8f0' }),
  S('space-nebula', 'Nebula', 'rare', '#7c3aed', { pattern: 'stars', eyes: 'happy' }),
  S('space-ufo', 'Saucer', 'rare', '#94a3b8', { acc: 'ufo', eyes: 'cyclops' }),
  S('space-star', 'Superstar', 'epic', '#fde047', { eyes: 'star', acc: 'halo', mouth: 'open' }),
  S('space-blackhole', 'Void', 'legendary', '#0f172a', { eyes: 'glow', pattern: 'stars', mouth: 'flat' }),
  S('space-galaxy', 'Galaxy Brain', 'mythic', '#312e81', { pattern: 'stars', eyes: 'star', acc: 'crown', shape: 'blob' }),

  // Monster Box
  S('mon-slime', 'Gloop', 'common', '#4ade80', { shape: 'drop', mouth: 'o' }),
  S('mon-ghost', 'Boo', 'common', '#f8fafc', { shape: 'ghost', mouth: 'o' }),
  S('mon-imp', 'Impy', 'uncommon', '#ef4444', { acc: 'horns', mouth: 'fang' }),
  S('mon-yeti', 'Fluff', 'uncommon', '#e0f2fe', { mouth: 'fang', eyes: 'angry' }),
  S('mon-cyclops', 'Peeper', 'rare', '#a855f7', { eyes: 'cyclops', mouth: 'fang' }),
  S('mon-pumpkin', 'Jack', 'rare', '#f97316', { acc: 'stem', mouth: 'fang', eyes: 'angry', pattern: 'stripes' }),
  S('mon-vamp', 'Count Blob', 'epic', '#64748b', { acc: 'tophat', mouth: 'fang', cheeks: false }),
  S('mon-dragon', 'Ember', 'legendary', '#dc2626', { acc: 'horns', eyes: 'angry', mouth: 'fang', pattern: 'spots', belly: '#fde68a' }),
  S('mon-shadow', 'Phantom King', 'mythic', '#1e1b4b', { shape: 'ghost', eyes: 'glow', acc: 'crown', mouth: 'fang' }),

  // Party Box
  S('party-cat', 'Whiskers', 'common', '#fdba74', { acc: 'cat-ears', mouth: 'cat' }),
  S('party-frog', 'Ribbit', 'common', '#22c55e', { eyes: 'happy', mouth: 'open', cheeks: true }),
  S('party-bun', 'Bunbun', 'uncommon', '#fbcfe8', { acc: 'bunny-ears', cheeks: true }),
  S('party-dj', 'DJ Wub', 'uncommon', '#2dd4bf', { acc: 'headphones', eyes: 'cool' }),
  S('party-wizard', 'Merlo', 'rare', '#818cf8', { acc: 'wizard', eyes: 'happy' }),
  S('party-cool', 'Shades', 'rare', '#06b6d4', { eyes: 'cool', mouth: 'smirk', acc: 'cap' }),
  S('party-king', 'King Blob', 'epic', '#3b82f6', { acc: 'crown', mouth: 'smirk' }),
  S('party-rainbow', 'Prism', 'legendary', '#ec4899', { pattern: 'rainbow', eyes: 'happy', mouth: 'open' }),
  S('party-unicorn', 'Sparkle Horn', 'mythic', '#fdf4ff', { acc: 'horn', pattern: 'rainbow', eyes: 'star', cheeks: true }),
];

export const SKIN_MAP = Object.fromEntries(SKINS.map((s) => [s.id, s]));
export const STARTER_SKINS = SKINS.filter((s) => s.rarity === 'starter').map((s) => s.id);

export const BOXES = [
  { id: 'snack', name: 'Snack Box', price: 25, color: '#f59e0b', prefix: 'snack-' },
  { id: 'space', name: 'Space Box', price: 40, color: '#6366f1', prefix: 'space-' },
  { id: 'monster', name: 'Monster Box', price: 40, color: '#ef4444', prefix: 'mon-' },
  { id: 'party', name: 'Party Box', price: 50, color: '#ec4899', prefix: 'party-' },
].map((b) => ({ ...b, skins: SKINS.filter((s) => s.id.startsWith(b.prefix)).map((s) => s.id) }));
export const BOX_MAP = Object.fromEntries(BOXES.map((b) => [b.id, b]));

/** Odds (percent) for each rarity in a box. */
export function boxOdds(box) {
  const present = [...new Set(box.skins.map((id) => SKIN_MAP[id].rarity))];
  const total = present.reduce((t, r) => t + RARITIES[r].weight, 0);
  return present
    .sort((a, b) => RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b))
    .map((r) => ({ rarity: r, pct: (RARITIES[r].weight / total) * 100, skins: box.skins.filter((id) => SKIN_MAP[id].rarity === r) }));
}

/** rand: () => [0,1). Returns a skin id. */
export function rollBox(box, rand) {
  const odds = boxOdds(box);
  let x = rand() * 100;
  for (const o of odds) {
    if (x < o.pct) return o.skins[Math.floor(rand() * o.skins.length)];
    x -= o.pct;
  }
  const last = odds[odds.length - 1];
  return last.skins[Math.floor(rand() * last.skins.length)];
}

// ---------------------------------------------------------------- drawing

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = c((n >> 16) & 255), g = c((n >> 8) & 255), b = c(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
function isDark(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) < 70;
}

const BODY = {
  blob: 'M50 12 C78 12 90 34 90 58 C90 80 74 92 50 92 C26 92 10 80 10 58 C10 34 22 12 50 12 Z',
  ghost: 'M50 10 C76 10 88 30 88 54 L88 90 L78 82 L68 90 L58 82 L50 90 L42 82 L32 90 L22 82 L12 90 L12 54 C12 30 24 10 50 10 Z',
  drop: 'M50 6 C62 26 90 44 90 64 C90 82 72 94 50 94 C28 94 10 82 10 64 C10 44 38 26 50 6 Z',
};

function eyes(type, dark) {
  const ink = dark ? '#f8fafc' : '#1f2937';
  switch (type) {
    case 'happy': return `<path d="M30 50 Q36 42 42 50 M58 50 Q64 42 70 50" stroke="${ink}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    case 'sleepy': return `<path d="M30 50 Q36 55 42 50 M58 50 Q64 55 70 50" stroke="${ink}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    case 'angry': return `<path d="M28 40 L42 45 M72 40 L58 45" stroke="${ink}" stroke-width="4" stroke-linecap="round"/><circle cx="36" cy="51" r="5" fill="${ink}"/><circle cx="64" cy="51" r="5" fill="${ink}"/>`;
    case 'cyclops': return `<circle cx="50" cy="48" r="13" fill="#fff"/><circle cx="52" cy="49" r="7" fill="#1f2937"/><circle cx="54" cy="46" r="2.5" fill="#fff"/>`;
    case 'cool': return `<path d="M24 44 H76 L72 56 Q64 60 56 55 L50 48 L44 55 Q36 60 28 56 Z" fill="#111827"/><path d="M30 47 L38 47" stroke="#fff" stroke-width="2" opacity=".6"/>`;
    case 'star': return [36, 64].map((x) => `<path transform="translate(${x} 50)" d="M0 -8 L2.4 -2.4 L8 -2.4 L3.6 1.2 L5.2 7 L0 3.6 L-5.2 7 L-3.6 1.2 L-8 -2.4 L-2.4 -2.4 Z" fill="#fde047" stroke="#a16207" stroke-width="1"/>`).join('');
    case 'glow': return `<ellipse cx="36" cy="50" rx="7" ry="5" fill="#f0abfc"/><ellipse cx="64" cy="50" rx="7" ry="5" fill="#f0abfc"/><ellipse cx="36" cy="50" rx="10" ry="8" fill="#f0abfc" opacity=".3"/><ellipse cx="64" cy="50" rx="10" ry="8" fill="#f0abfc" opacity=".3"/>`;
    default: return `<circle cx="36" cy="50" r="6" fill="${ink}"/><circle cx="64" cy="50" r="6" fill="${ink}"/><circle cx="38" cy="48" r="2" fill="#fff"/><circle cx="66" cy="48" r="2" fill="#fff"/>`;
  }
}

function mouth(type, dark) {
  const ink = dark ? '#f8fafc' : '#1f2937';
  switch (type) {
    case 'open': return `<path d="M40 63 Q50 76 60 63 Z" fill="#7f1d1d"/><path d="M44 68 Q50 73 56 68" fill="#f87171"/>`;
    case 'fang': return `<path d="M38 64 Q50 72 62 64" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M42 65 L44.5 71 L47 66.5 Z M58 65 L55.5 71 L53 66.5 Z" fill="#fff"/>`;
    case 'flat': return `<path d="M42 66 H58" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`;
    case 'o': return `<ellipse cx="50" cy="66" rx="5" ry="6" fill="#7f1d1d"/>`;
    case 'tongue': return `<path d="M40 63 Q50 74 60 63" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M50 68 Q50 76 56 74 Q58 70 55 67 Z" fill="#f472b6"/>`;
    case 'smirk': return `<path d="M42 66 Q52 70 60 61" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    case 'cat': return `<path d="M42 64 Q46 69 50 64 Q54 69 58 64" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    default: return `<path d="M40 63 Q50 72 60 63" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  }
}

function pattern(type, color, id) {
  switch (type) {
    case 'spots': return `<g fill="${shade(color, -0.12)}" clip-path="url(#c${id})"><circle cx="24" cy="70" r="6"/><circle cx="76" cy="34" r="5"/><circle cx="72" cy="76" r="4"/><circle cx="28" cy="30" r="3.5"/></g>`;
    case 'stripes': return `<g stroke="${shade(color, -0.1)}" stroke-width="5" clip-path="url(#c${id})"><path d="M10 30 H90 M10 78 H90"/></g>`;
    case 'stars': return `<g fill="#fff" clip-path="url(#c${id})" opacity=".85"><circle cx="22" cy="34" r="1.6"/><circle cx="78" cy="30" r="1.2"/><circle cx="74" cy="72" r="1.8"/><circle cx="26" cy="76" r="1.2"/><circle cx="50" cy="22" r="1.4"/><circle cx="84" cy="54" r="1"/><circle cx="16" cy="56" r="1"/></g>`;
    case 'sprinkles': return `<g stroke-width="3" stroke-linecap="round" clip-path="url(#c${id})"><path d="M24 30 l5 -2" stroke="#60a5fa"/><path d="M70 26 l4 4" stroke="#facc15"/><path d="M78 44 l-2 5" stroke="#34d399"/><path d="M20 46 l4 3" stroke="#fff"/><path d="M58 20 l-5 2" stroke="#a78bfa"/></g>`;
    case 'rainbow': return `<g clip-path="url(#c${id})" opacity=".55"><rect x="0" y="0" width="100" height="18" fill="#ef4444"/><rect x="0" y="18" width="100" height="14" fill="#f97316"/><rect x="0" y="32" width="100" height="14" fill="#facc15"/><rect x="0" y="46" width="100" height="14" fill="#22c55e"/><rect x="0" y="60" width="100" height="14" fill="#3b82f6"/><rect x="0" y="74" width="100" height="26" fill="#a855f7"/></g>`;
    default: return '';
  }
}

function accessory(type, accColor) {
  switch (type) {
    case 'crown': return `<path d="M30 18 L34 2 L42 12 L50 0 L58 12 L66 2 L70 18 Z" fill="#fbbf24" stroke="#b45309" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="12" r="2.5" fill="#ef4444"/>`;
    case 'tophat': return `<rect x="34" y="-2" width="32" height="18" rx="2" fill="#111827"/><rect x="26" y="14" width="48" height="5" rx="2" fill="#111827"/><rect x="34" y="10" width="32" height="4" fill="#dc2626"/>`;
    case 'horns': return `<path d="M28 22 Q18 8 24 0 Q30 12 38 16 Z M72 22 Q82 8 76 0 Q70 12 62 16 Z" fill="#fef3c7" stroke="#92400e" stroke-width="1.5"/>`;
    case 'halo': return `<ellipse cx="50" cy="4" rx="18" ry="5" fill="none" stroke="#fde047" stroke-width="4"/>`;
    case 'antenna': return `<path d="M42 16 Q38 6 34 2 M58 16 Q62 6 66 2" stroke="#365314" stroke-width="2.5" fill="none"/><circle cx="34" cy="2" r="4" fill="#fde047"/><circle cx="66" cy="2" r="4" fill="#fde047"/>`;
    case 'leaf': return `<path d="M50 14 Q50 6 54 2" stroke="#78350f" stroke-width="3" fill="none"/><path d="M54 6 Q66 -2 72 6 Q62 14 54 6 Z" fill="${accColor || '#22c55e'}"/>`;
    case 'stem': return `<rect x="46" y="2" width="8" height="14" rx="3" fill="#166534"/>`;
    case 'cat-ears': return `<path d="M20 30 L24 4 L42 18 Z M80 30 L76 4 L58 18 Z" fill="inherit" class="ear"/><path d="M25 22 L27 10 L35 17 Z M75 22 L73 10 L65 17 Z" fill="#fda4af"/>`;
    case 'bunny-ears': return `<ellipse cx="36" cy="2" rx="7" ry="18" fill="#fbcfe8" stroke="#f9a8d4" stroke-width="2"/><ellipse cx="64" cy="2" rx="7" ry="18" fill="#fbcfe8" stroke="#f9a8d4" stroke-width="2"/><ellipse cx="36" cy="4" rx="3" ry="11" fill="#f472b6"/><ellipse cx="64" cy="4" rx="3" ry="11" fill="#f472b6"/>`;
    case 'headphones': return `<path d="M14 54 Q14 10 50 10 Q86 10 86 54" stroke="#111827" stroke-width="5" fill="none"/><rect x="6" y="46" width="14" height="22" rx="6" fill="#ec4899"/><rect x="80" y="46" width="14" height="22" rx="6" fill="#ec4899"/>`;
    case 'wizard': return `<path d="M24 20 L54 -14 L76 20 Z" fill="#4338ca" stroke="#312e81" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="6" r="2.5" fill="#fde047"/><circle cx="60" cy="12" r="1.8" fill="#fde047"/><rect x="18" y="17" width="64" height="6" rx="3" fill="#312e81"/>`;
    case 'cap': return `<path d="M24 26 Q26 6 50 6 Q74 6 76 26 Z" fill="#ef4444"/><path d="M70 24 Q90 22 94 28 Q84 30 70 28 Z" fill="#b91c1c"/>`;
    case 'band': return `<rect x="10" y="44" width="80" height="12" fill="${accColor || '#111827'}" opacity=".9"/>`;
    case 'candle': return `<rect x="46" y="-2" width="8" height="16" rx="2" fill="#93c5fd"/><path d="M50 -12 Q56 -6 50 -2 Q44 -6 50 -12 Z" fill="#f97316"/>`;
    case 'helmet': return `<circle cx="50" cy="52" r="46" fill="#bae6fd" opacity=".25" stroke="#e2e8f0" stroke-width="3"/>`;
    case 'ufo': return `<ellipse cx="50" cy="16" rx="30" ry="7" fill="#64748b"/><ellipse cx="50" cy="10" rx="14" ry="9" fill="#a5f3fc" opacity=".8"/><circle cx="32" cy="17" r="2" fill="#fde047"/><circle cx="50" cy="20" r="2" fill="#fde047"/><circle cx="68" cy="17" r="2" fill="#fde047"/>`;
    case 'horn': return `<path d="M44 16 L50 -12 L56 16 Z" fill="#fde68a" stroke="#f59e0b" stroke-width="1.5"/><path d="M46 8 L54 5 M47 1 L53 -2" stroke="#f59e0b" stroke-width="1.5"/>`;
    default: return '';
  }
}

let uid = 0;
/** Returns an SVG string for a skin id. */
export function skinSvg(skinId, size = 64) {
  const s = SKIN_MAP[skinId] || SKIN_MAP['blob-mint'];
  const id = `${s.id.replace(/[^a-z0-9]/gi, '')}${uid++}`;
  const dark = isDark(s.color);
  const body = BODY[s.shape] || BODY.blob;
  const legendary = s.rarity === 'legendary' || s.rarity === 'mythic';
  const acc = accessory(s.acc, s.accColor).replace('fill="inherit"', `fill="${s.color}"`);
  const behind = s.acc === 'bunny-ears' || s.acc === 'cat-ears' || s.acc === 'horns';
  return `<svg class="skin${s.rarity === 'mythic' ? ' mythic' : ''}" viewBox="0 -16 100 112" width="${size}" height="${size}" role="img" aria-label="${s.name}">
<defs><radialGradient id="g${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${shade(s.color, 0.16)}"/><stop offset="1" stop-color="${shade(s.color, -0.1)}"/></radialGradient><clipPath id="c${id}"><path d="${body}"/></clipPath></defs>
${legendary ? `<ellipse cx="50" cy="56" rx="48" ry="44" fill="${RARITIES[s.rarity].color}" opacity=".22"/>` : ''}
<ellipse cx="50" cy="94" rx="30" ry="4" fill="#000" opacity=".15"/>
${behind ? acc : ''}
<path d="${body}" fill="url(#g${id})" stroke="${shade(s.color, -0.25)}" stroke-width="2.5"/>
${s.belly ? `<ellipse cx="50" cy="74" rx="24" ry="14" fill="${s.belly}" clip-path="url(#c${id})" opacity=".9"/>` : ''}
${pattern(s.pattern, s.color, id)}
${s.cheeks ? '<circle cx="27" cy="62" r="5" fill="#f472b6" opacity=".5"/><circle cx="73" cy="62" r="5" fill="#f472b6" opacity=".5"/>' : ''}
${eyes(s.eyes, dark)}${mouth(s.mouth, dark)}
${behind ? '' : acc}
</svg>`;
}
