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
