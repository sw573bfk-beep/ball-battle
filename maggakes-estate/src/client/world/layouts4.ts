import { P, ensuiteKit, label, on, wardrobeKit, type Rect } from './kit';
import type { Layout, StationDef } from './layouts';

/**
 * Jess's Penthouse: her own floor, with the biggest bedroom in the estate (28×18 m, five
 * times a normal bedroom): a giant canopy bed, a hot tub, a concert stage with a DJ booth,
 * plus a lounge, a pool terrace, an ensuite and a walk-in wardrobe.
 */

const T = (id: string, x: number, z: number): StationDef => ({ kind: 'task', id, x, z });
const JP = {
  suite: [0, 0, 28, 18] as Rect,
  ens: [0, 18, 12, 12] as Rect,
  ward: [12, 18, 16, 12] as Rect,
  lounge: [28, 0, 20, 13] as Rect,
  terrace: [28, 13, 20, 17] as Rect,
};
const PINK = '#ff3df0', BLACK = '#141414';

export const penthouse: Layout = {
  id: 'jp', w: 48, d: 30, mood: 'golden', exterior: 'glass', wall: '#f7f1ea', backdrop: 'city', storey: 26,
  rooms: [
    { id: 'jess', name: "Jess's Suite 👑", r: JP.suite, floor: 'carpet', tint: '#e3d3ee', wall: '#2a2236' },
    { id: 'jens', name: 'Marble Ensuite', r: JP.ens, floor: 'marble' },
    { id: 'jward', name: 'Walk-in Wardrobe', r: JP.ward, floor: 'pinkcarpet' },
    { id: 'jlounge', name: 'Penthouse Lounge', r: JP.lounge, floor: 'marble', wall: '#f3e9f7' },
    { id: 'jterrace', name: 'Pool Terrace', r: JP.terrace, floor: 'deck' },
  ],
  open: [['jlounge', 'jterrace']],
  doors: [[28, 9], [6, 18], [20, 18]],
  props: [
    // ---- the suite: giant canopy bed
    on(JP.suite, 'n', 0.25, 3.75, 'giantbed', { color: '#ff9ee6', frame: BLACK }),
    on(JP.suite, 'n', 0.25 - 2.6 / 28, 0.5, 'nightstand'), on(JP.suite, 'n', 0.25 + 2.6 / 28, 0.5, 'nightstand'),
    on(JP.suite, 'n', 0.25, 0.05, 'fairylights'), P('teddy', 10.6, 1, 0.3, { color: '#ffb3f0' }), P('teddy', 3.4, 1, -0.3),
    on(JP.suite, 'w', 0.3, 0.05, 'neon', { text: 'LAROI', color: PINK, w: 2.6 }),
    // ---- concert stage + DJ booth
    P('stage', 19, 1.6, 0, { text: 'JESS LIVE ✨', w: 8 }),
    P('djbooth', 19, 4.4, 0), P('speaker', 14, 1.6, 0.3), P('speaker', 24, 1.6, -0.3),
    P('spotlight', 14, 4.6, 0.6, { color: '#ffb3f0' }), P('spotlight', 24, 4.6, -0.6, { color: '#b3e9ff' }),
    P('mic', 16.2, 4.6, 0), P('guitar', 25.8, 4, -0.5), P('discoball', 19, 7.4, 0),
    // ---- hot tub corner
    P('hottub', 4, 13.5, 0, { r: 1.6 }), P('candles', 1.2, 16.6, 0), P('plant', 1, 10.4, 0, { kind: 'tall', seed: 5 }), P('plant', 7.2, 16.9, 0, { seed: 8 }),
    // ---- glam corner + middle of the room (left open for Jess's own furniture)
    on(JP.suite, 'w', 0.62, 0.5, 'vanity', { color: '#ff9ee6' }),
    P('chandelier', 14, 10, 0, { r: 1.4, y: 2.75 }), P('rug', 14, 11, 0, { w: 9, d: 6, color: '#5c1a5e' }),
    on(JP.suite, 'e', 0.75, 0.6, 'closet', { color: BLACK }),
    P('label', 14, 15.6, 0, { text: "Jess's Suite 👑", color: '#ffd6f7' }),
    // ---- gold signs at the suite door (lounge side)
    on(JP.lounge, 'w', 6.4 / 13, 0.05, 'goldsign', { text: "JESS'S SUITE 👑", w: 2.8, y: 2.35 }),
    on(JP.lounge, 'w', 6.4 / 13, 0.05, 'goldsign', { text: 'The biggest room in the estate', w: 2.8, y: 1.45 }),
    P('viprope', 29.6, 7.7, 0), P('viprope', 29.6, 10.3, 0),
    // ---- lounge
    on(JP.lounge, 'n', 0.4, 0.4, 'cinemascreen', { w: 6 }), P('sectional', 36, 8, Math.PI), P('coffeetable', 36, 5.6, 0, { w: 1.6 }),
    on(JP.lounge, 'n', 0.88, 0.8, 'bar', { w: 3 }), P('grandpiano', 31.5, 3, 0.4), P('champagne', 42, 11.4, 0),
    P('plant', 47, 1, 0, { kind: 'tall', seed: 3 }), label(JP.lounge, 'Penthouse Lounge', 0.36),
    // ---- pool terrace
    ...[32, 35, 38, 41, 44].map((x, i) => P('sunbed', x, 26.4, Math.PI, { color: '#ffffff', towel: [PINK, '#ffb3f0', BLACK][i % 3] })),
    P('umbrella', 33.5, 27.6, 0, { color: '#ffb3f0' }), P('umbrella', 39.5, 27.6, 0, { color: '#2a2236' }),
    P('palm', 29, 14.5, 0, { h: 4 }), P('palm', 47, 14.5, 0, { h: 4.4, lean: -0.1 }), P('palm', 29, 29, 0, { h: 3.6, lean: 0.1 }), P('palm', 47, 29, 0, { h: 4 }),
    P('outdoorsofa', 46.6, 19.5, -Math.PI / 2, { w: 3 }),
    P('label', 38, 15.6, 0, { text: 'Pool Terrace', color: '#5a3b1e' }),
    // ---- ensuite + wardrobe
    ...ensuiteKit(JP.ens, 's', { tub: true }), label(JP.ens, 'Marble Ensuite', -0.1),
    ...wardrobeKit(JP.ward, 's', [BLACK, PINK, '#ffffff', '#5c1a5e', '#ffb3f0', '#ffd23f']), on(JP.ward, 'e', 0.5, 0.35, 'mirror'),
    P('rug', 20, 23, 0, { w: 5, d: 3, color: '#ffb3f0' }), label(JP.ward, 'Walk-in Wardrobe', -0.1),
  ],
  stations: [T('jbed', 7, 5.4), T('jdj', 19, 6), T('jconcert', 23.4, 6), T('jhottub', 6.6, 13.5), T('jglam', 2, 11.2)],
  lift: [47.75, 6.5, -Math.PI / 2],
  spawn: [45, 6.5],
  pools: [[31, 17, 14, 7]],
  tubs: [[4, 13.5, 1.6]],
};

// ===================================================================== Grace's Penthouse
// Moonlight Garden: lilac, silver and mint, with stargazing, blossom trees and a koi pond.
const GP = {
  suite: [0, 0, 28, 18] as Rect,
  ens: [0, 18, 12, 12] as Rect,
  ward: [12, 18, 16, 12] as Rect,
  lounge: [28, 0, 20, 13] as Rect,
  garden: [28, 13, 20, 17] as Rect,
};
const LILAC = '#b9a3e8', MINT = '#9fe3c8';
export const gracePenthouse: Layout = {
  id: 'gp', w: 48, d: 30, mood: 'moody', exterior: 'glass', wall: '#f4f0fa', backdrop: 'city', storey: 27,
  rooms: [
    { id: 'grace', name: "Grace's Suite 🌙", r: GP.suite, floor: 'carpet', tint: '#e6defa', wall: '#3a3358' },
    { id: 'gens', name: 'Moonstone Ensuite', r: GP.ens, floor: 'marble' },
    { id: 'gward', name: 'Walk-in Wardrobe', r: GP.ward, floor: 'pinkcarpet', tint: '#efe6ff' },
    { id: 'glounge', name: 'Starlight Lounge', r: GP.lounge, floor: 'marble', wall: '#ece6f8' },
    { id: 'ggarden', name: 'Moonlight Garden', r: GP.garden, floor: 'grass' },
  ],
  open: [['glounge', 'ggarden']],
  doors: [[28, 9], [6, 18], [20, 18]],
  props: [
    on(GP.suite, 'n', 0.25, 3.75, 'giantbed', { color: LILAC, frame: '#e8e8f0' }),
    on(GP.suite, 'n', 0.25 - 2.6 / 28, 0.5, 'nightstand'), on(GP.suite, 'n', 0.25 + 2.6 / 28, 0.5, 'nightstand'),
    on(GP.suite, 'n', 0.25, 0.05, 'fairylights'), P('teddy', 10.6, 1, 0.3, { color: LILAC }),
    on(GP.suite, 'w', 0.3, 0.05, 'neon', { text: 'GOODNIGHT MOON', color: '#c9b8ff', w: 3.4 }),
    // stargazing corner
    P('telescope', 19, 2.2, 0.4), P('orrery', 23.5, 2.6, 0), P('bigscope', 25.8, 6, -0.8), P('beanbag', 20, 6, 0.3, { color: LILAC }), P('beanbag', 22.6, 6.6, -0.2, { color: MINT }),
    // hot tub + blossom
    P('hottub', 4, 13.5, 0, { r: 1.6 }), P('cherry', 1.4, 9.6, 0, { h: 2.8 }), P('candles', 1.2, 16.6, 0), P('butterflies', 8, 15.5, 0),
    on(GP.suite, 'w', 0.62, 0.5, 'vanity', { color: LILAC }),
    P('chandelier', 14, 10, 0, { r: 1.4, y: 2.75 }), P('rug', 14, 11, 0, { w: 9, d: 6, color: '#7f6bb8' }),
    on(GP.suite, 'e', 0.75, 0.6, 'closet', { color: '#e8e8f0' }), P('grandpiano', 24.5, 14.5, -0.6),
    P('label', 14, 15.6, 0, { text: "Grace's Suite 🌙", color: '#e6defa' }),
    on(GP.lounge, 'w', 6.4 / 13, 0.05, 'goldsign', { text: "GRACE'S SUITE 🌙", w: 2.8, y: 2.35 }),
    on(GP.lounge, 'w', 6.4 / 13, 0.05, 'goldsign', { text: 'Moonlight Garden Penthouse', w: 2.8, y: 1.45 }),
    P('viprope', 29.6, 7.7, 0), P('viprope', 29.6, 10.3, 0),
    on(GP.lounge, 'n', 0.4, 0.4, 'cinemascreen', { w: 6 }), P('sectional', 36, 8, Math.PI), P('coffeetable', 36, 5.6, 0, { w: 1.6 }),
    on(GP.lounge, 'n', 0.88, 0.8, 'bar', { w: 3 }), P('lavalamp', 31, 2, 0), P('plant', 47, 1, 0, { kind: 'tall', seed: 7 }), label(GP.lounge, 'Starlight Lounge', 0.36),
    // garden
    P('koipond', 38, 21.5, 0, { r: 2.4 }), P('gazebo', 44, 25.5, 0, { r: 1.8 }), P('cherry', 30, 15, 0), P('cherry', 46.5, 15, 0, { h: 3.4 }), P('cherry', 30, 28.6, 0, { h: 3 }),
    P('lantern', 33, 16, 0), P('lantern', 43, 16, 0), P('bench', 33, 27.8, Math.PI), P('butterflies', 40, 26, 0),
    P('label', 38, 18, 0, { text: 'Moonlight Garden', color: '#3a5a4a' }),
    ...ensuiteKit(GP.ens, 's', { tub: true }), label(GP.ens, 'Moonstone Ensuite', -0.1),
    ...wardrobeKit(GP.ward, 's', [LILAC, MINT, '#ffffff', '#3a3358', '#ffd6f0', '#c9d4ff']), on(GP.ward, 'e', 0.5, 0.35, 'mirror'),
    P('rug', 20, 23, 0, { w: 5, d: 3, color: LILAC }), label(GP.ward, 'Walk-in Wardrobe', -0.1),
  ],
  stations: [T('gbed', 7, 5.4), T('gstars', 21.4, 8.6), T('gpiano', 22, 14.6), T('ghottub', 6.6, 13.5), T('gkoi', 38, 18.4)],
  lift: [47.75, 6.5, -Math.PI / 2],
  spawn: [45, 6.5],
  tubs: [[4, 13.5, 1.6]],
};

// ===================================================================== Mia & Arielle's Penthouse
// Two big bedrooms off a hallway, a shared lounge, games room, bathrooms and a pool terrace.
const MP = {
  mia: [0, 0, 16, 13] as Rect,
  hall: [0, 13, 36, 4] as Rect,
  arielle: [0, 17, 16, 13] as Rect,
  lounge: [16, 0, 20, 13] as Rect,
  games: [16, 17, 14, 13] as Rect,
  baths: [30, 17, 6, 13] as Rect,
  terrace: [36, 0, 16, 30] as Rect,
};
const AQUA = '#4fd1e0', PEACH = '#ffb38a';
export const miaPenthouse: Layout = {
  id: 'mp', w: 52, d: 30, mood: 'golden', exterior: 'glass', wall: '#f7f3ee', backdrop: 'city', storey: 28,
  rooms: [
    { id: 'mia', name: "Mia's Room 💙", r: MP.mia, floor: 'carpet', tint: '#d8f3f6', wall: '#e3f7fa' },
    { id: 'hall', name: 'Hallway', r: MP.hall, floor: 'marble' },
    { id: 'arielle', name: "Arielle's Room 🧡", r: MP.arielle, floor: 'carpet', tint: '#ffe6d6', wall: '#fff1e8' },
    { id: 'mlounge', name: 'Shared Lounge', r: MP.lounge, floor: 'marble', wall: '#f5efe6' },
    { id: 'games', name: 'Games Room', r: MP.games, floor: 'rubber', tint: '#3a3358', wall: '#2a2340' },
    { id: 'mbaths', name: 'Bathrooms', r: MP.baths, floor: 'tile' },
    { id: 'mterrace', name: 'Pool Terrace', r: MP.terrace, floor: 'deck' },
  ],
  open: [['mlounge', 'mterrace'], ['hall', 'mterrace']],
  doors: [[8, 13], [8, 17], [26, 13], [22, 17], [33, 17]],
  props: [
    // Mia's room (aqua)
    on(MP.mia, 'n', 0.3, 3.75, 'giantbed', { color: AQUA, frame: '#ffffff' }), on(MP.mia, 'n', 0.3 - 2.6 / 16, 0.5, 'nightstand'), on(MP.mia, 'n', 0.3 + 2.6 / 16, 0.5, 'nightstand'),
    on(MP.mia, 'n', 0.3, 0.05, 'fairylights'), on(MP.mia, 'e', 0.35, 0.05, 'neon', { text: 'MIA', color: AQUA, w: 1.6 }),
    on(MP.mia, 'e', 0.75, 0.5, 'vanity', { color: AQUA }), P('beanbag', 11, 9, 0.3, { color: AQUA }), P('rug', 8, 8.5, 0, { w: 5, d: 3.4, color: '#bfeef5' }), P('teddy', 1.2, 11.8, 0.6),
    P('label', 8, 11.6, 0, { text: "Mia's Room 💙", color: '#2a6a7a' }),
    // Arielle's room (peach)
    on(MP.arielle, 's', 0.3, 3.75, 'giantbed', { color: PEACH, frame: '#ffffff' }), on(MP.arielle, 's', 0.3 - 2.6 / 16, 0.5, 'nightstand'), on(MP.arielle, 's', 0.3 + 2.6 / 16, 0.5, 'nightstand'),
    on(MP.arielle, 's', 0.3, 0.05, 'fairylights'), on(MP.arielle, 'e', 0.65, 0.05, 'neon', { text: 'ARIELLE', color: '#ff8a5c', w: 2.6 }),
    on(MP.arielle, 'e', 0.25, 0.5, 'vanity', { color: PEACH }), P('beanbag', 11, 21, 0.3, { color: PEACH }), P('rug', 8, 21.5, 0, { w: 5, d: 3.4, color: '#ffd9c2' }), P('teddy', 1.2, 18.2, 0.6, { color: PEACH }),
    P('label', 8, 18.6, 0, { text: "Arielle's Room 🧡", color: '#8a4a2a' }),
    // hallway signs
    on(MP.hall, 'n', 4 / 36, 0.05, 'goldsign', { text: "MIA'S ROOM 💙", w: 2.4, y: 2 }),
    on(MP.hall, 's', 32 / 36, 0.05, 'goldsign', { text: "ARIELLE'S ROOM 🧡", w: 2.4, y: 2 }),
    // lounge
    on(MP.lounge, 'n', 0.45, 0.4, 'cinemascreen', { w: 6 }), P('sectional', 25, 8, Math.PI), P('coffeetable', 25, 5.6, 0, { w: 1.6 }),
    P('popcorn', 18, 2, 0.4), on(MP.lounge, 'e', 0.2, 0.8, 'bar', { w: 3 }), P('plant', 35.2, 12.2, 0, { kind: 'tall', seed: 4 }), label(MP.lounge, 'Shared Lounge', 0.38),
    // games room
    P('arcade', 17.2, 20, Math.PI / 2), P('arcade', 17.2, 22.4, Math.PI / 2), P('claw', 17.4, 27.8, Math.PI / 2), P('airhockey', 23, 26, 0), P('dancepad', 27, 21.5, 0),
    P('beanbag', 24, 21, 0, { color: AQUA }), P('beanbag', 25.6, 22.4, 0, { color: PEACH }), label(MP.games, 'Games Room', 0.38),
    on(MP.baths, 'e', 0.35, 0.7, 'toilet'), on(MP.baths, 'e', 0.6, 0.7, 'toilet'), on(MP.baths, 's', 0.5, 0.52, 'sink', { w: 2 }), label(MP.baths, 'Bathrooms', -0.1),
    // terrace
    on(MP.terrace, 'n', 0.45, 0.05, 'goldsign', { text: "MIA & ARIELLE'S PENTHOUSE ✨", w: 4.2, y: 2.3 }),
    P('hottub', 40, 4.5, 0, { r: 1.5 }), ...[39, 42, 45, 48].map((x, i) => P('sunbed', x, 27, Math.PI, { color: '#ffffff', towel: [AQUA, PEACH][i % 2] })),
    P('umbrella', 40.5, 28.2, 0, { color: AQUA }), P('umbrella', 46.5, 28.2, 0, { color: PEACH }),
    P('palm', 37, 1, 0, { h: 4 }), P('palm', 51, 1, 0, { h: 4.2, lean: -0.1 }), P('palm', 51, 29, 0, { h: 3.8 }),
    P('label', 44, 13.2, 0, { text: 'Pool Terrace', color: '#5a3b1e' }),
  ],
  stations: [T('mmovie', 25, 3.4), T('mgames', 21, 24.4), T('mdance', 27, 24), T('mpool', 44, 15.4), T('mhottub', 42.4, 4.5)],
  lift: [51.75, 8, -Math.PI / 2],
  spawn: [49, 8],
  pools: [[39, 17, 10, 7]],
  tubs: [[40, 4.5, 1.5]],
};
