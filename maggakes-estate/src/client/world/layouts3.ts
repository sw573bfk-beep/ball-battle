import { P, label, type Rect } from './kit';
import type { Layout, StationDef } from './layouts';

/** The outside world, reached by car: the beach, the shopping mall and the town. */

const T = (id: string, x: number, z: number): StationDef => ({ kind: 'task', id, x, z });

// ------------------------------------------------------------------- Beach & Boardwalk
const BE = { board: [0, 0, 46, 5] as Rect, sand: [0, 5, 46, 21] as Rect, shore: [0, 26, 46, 8] as Rect };
export const beach: Layout = {
  id: 'beach', w: 46, d: 34, mood: 'day', exterior: 'none', wall: '#f5efe6', backdrop: 'ocean', storey: 0, outside: true,
  rooms: [
    { id: 'board', name: 'Boardwalk', r: BE.board, floor: 'deck' },
    { id: 'sand', name: 'Beach', r: BE.sand, floor: 'sand' },
    { id: 'shore', name: 'Shoreline', r: BE.shore, floor: 'sand', tint: '#d8c088' },
  ],
  open: [['board', 'sand'], ['sand', 'shore']],
  doors: [],
  props: [
    P('kiosk', 8, 2.4, 0, { text: 'ICE CREAM', color: '#ff6fb5', emoji: '🍦' }), P('kiosk', 16, 2.4, 0, { text: 'SURF HIRE', color: '#33a8ff', emoji: '🏄' }), P('kiosk', 24, 2.4, 0, { text: 'COLD DRINKS', color: '#ffd23f', emoji: '🥤' }),
    P('planttree', 3, 1.2, 0), P('planttree', 31, 1.2, 0), P('streetlamp', 12, 4.6, 0), P('streetlamp', 28, 4.6, 0), label(BE.board, 'Boardwalk', 0.3),
    ...[6, 14, 22].flatMap((x, i) => [P('umbrella', x, 11, 0, { color: ['#ff6fb5', '#33a8ff', '#ffd23f'][i] }), P('sunbed', x - 1.2, 12.6, Math.PI, { color: '#ffffff', towel: '#ff9fc4' }), P('sunbed', x + 1.2, 12.6, Math.PI, { color: '#ffffff', towel: '#7fd8ff' })]),
    P('lifeguard', 38, 17, Math.PI), P('volleynet', 30, 10, 0), P('sandcastle', 12, 20, 0.3), P('sandcastle', 26, 22, -0.4, { flag: '🏳️‍🌈' }),
    P('palm', 1.5, 7, 0, { h: 4.4 }), P('palm', 44.5, 8, 0, { h: 4, lean: -0.1 }), P('palm', 1.5, 19, 0, { h: 3.8, lean: 0.12 }), P('palm', 44.5, 20, 0, { h: 4.6 }),
    P('surfboard', 4, 23, 0.4, { color: '#ff6fb5' }), P('surfboard', 5.2, 23.4, 0.2, { color: '#33a8ff' }), P('flamingo', 20, 30, 0), label(BE.sand, 'Maggakes Beach', 0.2),
  ],
  stations: [T('sandcastle', 12, 22), T('surf', 30, 25.4), T('shellhunt', 20, 16), T('beachclean', 34, 7), T('icecream', 8, 4.4)],
  lift: [45, 2.5, -Math.PI / 2],
  spawn: [41.5, 2.5],
  pools: [[0, 28, 46, 6]],
};

// ------------------------------------------------------------------- Shopping Mall
const MA = { north: [0, 0, 46, 8] as Rect, hall: [0, 8, 46, 14] as Rect, south: [0, 22, 46, 8] as Rect };
const shops = (z: number, rot: number, list: [string, string, string][]) => list.map(([text, color, goods], i) => P('shopfront', 4 + i * 6.4, z, rot, { text, color, goods, w: 5.8 }));
export const mall: Layout = {
  id: 'mall', w: 46, d: 30, mood: 'day', exterior: 'glass', wall: '#f7f3ee', backdrop: 'city', storey: 0, outside: true,
  rooms: [
    { id: 'north', name: 'Shops', r: MA.north, floor: 'terrazzo' },
    { id: 'hall', name: 'Mall', r: MA.hall, floor: 'marble' },
    { id: 'south', name: 'Shops', r: MA.south, floor: 'terrazzo' },
  ],
  open: [['north', 'hall'], ['hall', 'south']],
  doors: [],
  props: [
    ...shops(0.45, 0, [['BOUTIQUE', '#ff6fb5', '👗👜👠'], ['SHOE CITY', '#33a8ff', '👟👢👡'], ['BEAUTY', '#b388ff', '💄💅🧴'], ['TOY WORLD', '#ffd23f', '🧸🪀🎲'], ['TECH', '#2a2d34', '📱🎧💻']]),
    ...shops(29.55, Math.PI, [['BOOKS', '#7a4a2e', '📚📖✏️'], ['SPORTS', '#33c47a', '⚽🏀🎾'], ['JEWELS', '#d4af37', '💍💎📿'], ['PET SHOP', '#ff7a1a', '🐶🐱🐹']]),
    P('fountain', 23, 15, 0, { r: 2 }), P('escalator', 9, 15, Math.PI / 2, { l: 5 }), P('planttree', 16, 11, 0), P('planttree', 30, 11, 0), P('planttree', 16, 19, 0), P('planttree', 30, 19, 0),
    P('kiosk', 40, 9.5, 0, { text: 'BUBBLE TEA', color: '#b388ff', emoji: '🧋' }), P('kiosk', 36, 9.5, 0, { text: 'SUSHI', color: '#e63946', emoji: '🍣' }),
    ...[[36, 20], [40, 20], [44, 20], [38, 24.5], [42, 24.5]].map(([x, z], i) => P('cafetable', x, z, 0, { color: ['#ff9fc4', '#33e1ff', '#ffd23f'][i % 3] })),
    label(MA.hall, 'Maggakes Mall', -0.25), P('label', 40, 17.5, 0, { text: 'Food Court' }),
  ],
  stations: [T('shoppingspree', 16, 15), T('mallfit', 4, 3), T('wish', 23, 18.6), T('bubbletea', 40, 11.4), T('lostmall', 30, 15)],
  lift: [45.75, 15, -Math.PI / 2],
  spawn: [42, 15],
};

// ------------------------------------------------------------------- Town
const TO = { path: [0, 0, 46, 8] as Rect, street: [0, 8, 46, 8] as Rect, park: [0, 16, 46, 18] as Rect };
export const town: Layout = {
  id: 'town', w: 46, d: 34, mood: 'day', exterior: 'none', wall: '#f5efe6', backdrop: 'city', storey: 0, outside: true,
  rooms: [
    { id: 'path', name: 'Main Street', r: TO.path, floor: 'stone' },
    { id: 'street', name: 'Road', r: TO.street, floor: 'concrete' },
    { id: 'park', name: 'Town Park', r: TO.park, floor: 'grass' },
  ],
  open: [['path', 'street'], ['street', 'park']],
  doors: [],
  props: [
    ...[['BAKERY', '#ffb347', '🥐🍞🧁'], ['POST OFFICE', '#e63946', '📮✉️📦'], ['LIBRARY', '#7a4a2e', '📚📖🔖'], ['FLOWERS', '#ff6fb5', '💐🌷🌻'], ['MARKET', '#33c47a', '🍎🍌🍇'], ['CAFÉ', '#b388ff', '☕🍰🥤']]
      .map(([text, color, goods], i) => P('shopfront', 4 + i * 6.2, 0.45, 0, { text, color, goods, w: 5.6 })),
    P('road', 23, 12, 0, { w: 46, d: 6 }), P('crosswalk', 20, 12, 0, { w: 6 }), P('parkedcar', 8, 9.8, Math.PI / 2, { color: '#33a8ff' }), P('parkedcar', 30, 14.2, -Math.PI / 2, { color: '#ffd23f' }),
    ...[6, 18, 30].map((x) => P('streetlamp', x, 7.4, 0)), ...[10, 26, 40].map((x) => P('streetlamp', x, 16.6, Math.PI)),
    P('busstop', 40, 6, 0),
    P('fountain', 14, 24, 0, { r: 1.6 }), P('swings', 30, 22, 0), P('kidslide', 36, 27, 0), P('bigtree', 4, 30, 0, { h: 4.5 }), P('bigtree', 43, 31, 0, { h: 5 }), P('bigtree', 24, 31.5, 0, { h: 4 }),
    P('kiosk', 20, 21, 0, { text: 'ICE CREAM', color: '#ff6fb5', emoji: '🍦' }), P('planttree', 2, 18, 0), P('outdoorsofa', 8, 21, 0, { w: 2.4 }),
    label(TO.park, 'Town Park', 0.1), label(TO.path, 'Main Street', 0.4),
  ],
  stations: [T('market', 28.8, 3), T('walkdog', 10, 26), T('bus', 40, 7.6), T('swings', 30, 24.4), T('townquiz', 14, 27.4)],
  lift: [45.5, 4, -Math.PI / 2],
  spawn: [42, 4],
};

export const OUTSIDE_LAYOUTS = { beach, mall, town };
