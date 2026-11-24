import { P, label, on, type PropDef, type Rect } from './kit';
import type { Layout, StationDef } from './layouts';

/**
 * Floors 13–24 ("the tower"). Indoor floors share one frame: a big main hall on the
 * left, two side rooms on the right (the lift is in the middle one) and bathrooms.
 * The theme park, festival and sky garden are open-air rooftops.
 */

const T = (id: string, x: number, z: number): StationDef => ({ kind: 'task', id, x, z });
const R = { main: [0, 0, 24, 22] as Rect, s1: [24, 0, 10, 8] as Rect, s2: [24, 8, 10, 8] as Rect, baths: [24, 16, 10, 6] as Rect };
const DOORS: [number, number][] = [[24, 4], [24, 12], [29, 8], [29, 16]];
const baths = (): PropDef[] => [
  on(R.baths, 's', 0.2, 0.7, 'toilet'), on(R.baths, 's', 0.4, 0.7, 'toilet'), on(R.baths, 's', 0.72, 0.52, 'sink', { w: 2 }), label(R.baths, 'Bathrooms', -0.25),
];
const frame = { lift: [33.75, 12, -Math.PI / 2] as [number, number, number], spawn: [31, 12] as [number, number] };

// ------------------------------------------------------------------- 13 Aquarium
export const floor13: Layout = {
  id: 'f13', w: 34, d: 22, mood: 'moody', exterior: 'glass', wall: '#0f2a40', backdrop: 'city', storey: 14,
  rooms: [
    { id: 'main', name: 'Aquarium', r: R.main, floor: 'carpet', tint: '#1f4a6e', wall: '#0f2a40' },
    { id: 's1', name: 'Gift Shop', r: R.s1, floor: 'pinkcarpet', wall: '#d8f1ff' },
    { id: 's2', name: 'Ocean Café', r: R.s2, floor: 'wood', tint: '#cfe4ee', wall: '#e8f6ff' },
    { id: 'baths', name: 'Bathrooms', r: R.baths, floor: 'tile' },
  ],
  doors: DOORS,
  props: [
    P('bigtank', 8, 0.8, 0, { w: 12 }), P('bigtank', 0.8, 12, Math.PI / 2, { w: 10 }),
    P('jellytube', 18, 3, 0), P('jellytube', 21, 3, 0, { color: '#7fd8ff' }), P('jellytube', 18, 19, 0, { color: '#b388ff' }), P('jellytube', 21, 19, 0),
    P('touchpool', 12, 12.4, 0, { w: 3.4, d: 1.8 }), P('beanbag', 6, 19, 0.3, { color: '#33a8ff' }), P('beanbag', 8, 20, -0.2, { color: '#4fd1c5' }),
    on(R.main, 's', 0.55, 0.05, 'neon', { text: 'AQUARIUM', color: '#33e1ff', w: 3.6 }), label(R.main, 'Aquarium', -0.05),
    P('prizes', 29, 1.6, 0, { w: 3.6, color: '#33a8ff' }), label(R.s1, 'Gift Shop', 0.2),
    P('cafetable', 26.5, 10.6, 0, { color: '#7fd8ff' }), P('cafetable', 26.5, 14.2, 0, { color: '#7fd8ff' }), P('plant', 33.3, 15.4, 0, { seed: 2 }), label(R.s2, 'Ocean Café', 0.3),
    ...baths(),
  ],
  stations: [T('feedfish', 8, 2.9), T('seamemory', 12, 10.2), T('cleantank', 2.8, 12), T('turtle', 19.5, 11), T('oceanquiz', 29, 4.6)],
  ...frame,
};

// ------------------------------------------------------------------- 14 Fashion Studio
export const floor14: Layout = {
  id: 'f14', w: 34, d: 22, mood: 'day', exterior: 'glass', wall: '#fff0f6', backdrop: 'city', storey: 15,
  rooms: [
    { id: 'main', name: 'Fashion Studio', r: R.main, floor: 'wood', tint: '#f3e6da', wall: '#fff0f6' },
    { id: 's1', name: 'Photo Set', r: R.s1, floor: 'pinkcarpet', wall: '#ffffff' },
    { id: 's2', name: 'Closet', r: R.s2, floor: 'carpet', tint: '#f6e9ef', wall: '#fff6fb' },
    { id: 'baths', name: 'Bathrooms', r: R.baths, floor: 'tile' },
  ],
  doors: DOORS,
  props: [
    P('runway', 12, 10, 0, { l: 12, text: 'MAGGAKES FASHION WEEK' }),
    ...[7, 9, 11, 13, 15].flatMap((z) => [P('chair', 9.6, z, Math.PI / 2, { color: '#ffffff' }), P('chair', 14.4, z, -Math.PI / 2, { color: '#ffffff' })]),
    P('spotlight', 8, 18.5, Math.PI * 0.85), P('spotlight', 16, 18.5, -Math.PI * 0.85),
    P('mannequin', 1, 3, Math.PI / 2, { color: '#ff6fb5' }), P('mannequin', 1, 5.5, Math.PI / 2, { color: '#33a8ff' }), P('mannequin', 1, 8, Math.PI / 2, { color: '#ffd23f' }),
    P('sewing', 4, 18.6, 0), P('rack', 4, 0.6, 0, { w: 4 }), P('mirror', 20, 0.3, 0),
    on(R.main, 's', 0.8, 0.05, 'neon', { text: 'SLAY', color: '#ff3df0', w: 2 }), label(R.main, 'Fashion Studio', 0.42),
    P('spotlight', 26, 2, Math.PI * 0.25), P('camera', 29, 6, Math.PI), on(R.s1, 'n', 0.5, 0.05, 'neon', { text: 'VOGUE', color: '#ff3df0', w: 2.4 }), label(R.s1, 'Photo Set', 0.25),
    on(R.s2, 'n', 0.3, 0.6, 'rack', { w: 3 }), on(R.s2, 's', 0.3, 0.6, 'rack', { w: 3 }), label(R.s2, 'Closet', 0),
    ...baths(),
  ],
  stations: [T('design', 4, 16.9), T('strut', 12, 17.6), T('fashionshoot', 29, 3.6), T('spotfake', 27.5, 12), T('hem', 4, 10.5)],
  ...frame,
};

// ------------------------------------------------------------------- 15 Bakery Café
export const floor15: Layout = {
  id: 'f15', w: 34, d: 22, mood: 'golden', exterior: 'glass', wall: '#fff6e8', backdrop: 'city', storey: 16,
  rooms: [
    { id: 'main', name: 'Bakery Café', r: R.main, floor: 'wood', tint: '#e8c9a0', wall: '#fff6e8' },
    { id: 's1', name: 'Bakery Kitchen', r: R.s1, floor: 'tile', wall: '#ffffff' },
    { id: 's2', name: 'Cake Counter', r: R.s2, floor: 'terrazzo', tint: '#fff0f6' },
    { id: 'baths', name: 'Bathrooms', r: R.baths, floor: 'tile' },
  ],
  doors: DOORS,
  props: [
    ...[[4, 5], [9, 5], [14, 5], [4, 11], [9, 11], [14, 11], [4, 17], [9, 17]].map(([x, z], i) => P('cafetable', x, z, 0, { color: ['#ff9fc4', '#ffd23f', '#7fd8ff'][i % 3] })),
    P('espresso', 20, 0.6, 0), P('displaycase', 20, 21.4, Math.PI, { w: 3 }), P('cakestand', 18.5, 15, 0), P('cakestand', 21, 15, 0, { color: '#bfe3f2' }),
    P('plant', 0.7, 0.7, 0, { kind: 'tall', seed: 3 }), P('plant', 0.7, 21.3, 0, { seed: 5 }),
    on(R.main, 'n', 0.3, 0.05, 'neon', { text: '☕ CAFÉ', color: '#ffb347', w: 2.6 }), label(R.main, 'Bakery Café', -0.12),
    P('oven', 26.2, 0.6, 0), P('oven', 28, 0.6, 0, { color: '#ffd6e7' }), P('counter', 32.8, 4, -Math.PI / 2, { w: 3 }), label(R.s1, 'Bakery Kitchen', 0.3),
    P('displaycase', 27, 15.3, Math.PI, { w: 3.6, color: '#bfe3f2' }), P('cakestand', 25, 9, 0, { color: '#ffd23f' }), label(R.s2, 'Cake Counter', -0.1),
    ...baths(),
  ],
  stations: [T('bakecake', 27, 2.6), T('catchcookies', 30.5, 4.5), T('latteart', 20, 2.6), T('bakerywords', 11.5, 8), T('servecafe', 11.5, 14)],
  ...frame,
};

// ------------------------------------------------------------------- 16 Spa & Salon
export const floor16: Layout = {
  id: 'f16', w: 34, d: 22, mood: 'day', exterior: 'glass', wall: '#f3fbf8', backdrop: 'city', storey: 17,
  rooms: [
    { id: 'main', name: 'Salon', r: R.main, floor: 'marble', wall: '#f3fbf8' },
    { id: 's1', name: 'Sauna', r: R.s1, floor: 'wood', tint: '#e0c090', wall: '#f7efe6' },
    { id: 's2', name: 'Spa Lounge', r: R.s2, floor: 'stone', tint: '#e6efe9' },
    { id: 'baths', name: 'Bathrooms', r: R.baths, floor: 'tile' },
  ],
  doors: DOORS,
  props: [
    ...[3, 6, 9, 12].map((x, i) => P('salonchair', x, 1.5, 0, { color: ['#ff6fb5', '#33a8ff', '#b388ff', '#4fd1c5'][i] })),
    P('nailbar', 18, 1, 0, { w: 4 }), P('spabed', 5, 15, 0), P('spabed', 10, 15, 0), P('candles', 7.5, 18.5, 0),
    P('plant', 0.7, 21.3, 0, { kind: 'tall', seed: 4 }), P('plant', 23.3, 21.3, 0, { seed: 1 }), P('rug', 12, 9, 0, { w: 8, d: 3, color: '#e3f4e1' }),
    on(R.main, 's', 0.75, 0.05, 'neon', { text: 'GLOW', color: '#4fd1c5', w: 2 }), label(R.main, 'Spa & Salon', 0.1),
    P('sauna', 29, 2.6, 0, { w: 3, d: 2.4 }), label(R.s1, 'Sauna', 0.3),
    P('daybed', 26, 13, Math.PI / 2), P('candles', 25, 9.2, 0), label(R.s2, 'Spa Lounge', -0.3),
    ...baths(),
  ],
  stations: [T('nails', 18, 2.9), T('facemask', 7.5, 12.4), T('sauna', 29, 5.6), T('blowdry', 7.5, 4), T('towels', 15, 9)],
  ...frame,
};

// ------------------------------------------------------------------- 17 Art Studio
export const floor17: Layout = {
  id: 'f17', w: 34, d: 22, mood: 'golden', exterior: 'glass', wall: '#fbf7f0', backdrop: 'city', storey: 18,
  rooms: [
    { id: 'main', name: 'Art Studio', r: R.main, floor: 'concrete', tint: '#d8d2c8', wall: '#fbf7f0' },
    { id: 's1', name: 'Pottery', r: R.s1, floor: 'wood' },
    { id: 's2', name: 'Gallery', r: R.s2, floor: 'marble', wall: '#ffffff' },
    { id: 'baths', name: 'Bathrooms', r: R.baths, floor: 'tile' },
  ],
  doors: DOORS,
  props: [
    ...[[4, 4], [8, 4], [12, 4], [4, 9], [8, 9], [12, 9]].map(([x, z], i) => P('easel', x, z, 0, { seed: i + 1 })),
    P('sculpture', 19, 3, 0), P('sculpture', 19, 18, 0, { color: '#ff6fb5' }), P('desk', 4, 20.8, Math.PI, { w: 2.4 }), P('shelf', 10, 21.5, Math.PI),
    P('rug', 8, 15, 0, { w: 6, d: 3, color: '#ffd23f' }), P('beanbag', 7, 15, 0.4, { color: '#ff6fb5' }), P('beanbag', 9, 15.5, -0.3, { color: '#33a8ff' }),
    on(R.main, 'n', 0.83, 0.05, 'neon', { text: 'CREATE', color: '#ffd23f', w: 2.6 }), label(R.main, 'Art Studio', 0.15),
    P('pottery', 27, 2.5, 0), P('pottery', 30, 2.5, 0, { color: '#e8b870' }), label(R.s1, 'Pottery', 0.35),
    on(R.s2, 'n', 0.3, 0.05, 'poster', { kind: 'abstract', w: 1.1 }), on(R.s2, 'n', 0.6, 0.05, 'poster', { kind: 'sunset', w: 1.1 }), on(R.s2, 's', 0.3, 0.05, 'poster', { kind: 'music', w: 1.1 }), P('sculpture', 27, 12, 0, { color: '#33e1ff' }), label(R.s2, 'Gallery', 0.2),
    ...baths(),
  ],
  stations: [T('paint', 8, 6.5), T('pottery', 28.5, 4.8), T('gallery', 30, 10.5), T('colourquiz', 16, 12), T('brushes', 15.5, 18)],
  ...frame,
};

// ------------------------------------------------------------------- 18 Theme Park (rooftop)
const TP = { park: [0, 0, 34, 15] as Rect, plaza: [0, 15, 24, 7] as Rect, baths: [24, 15, 10, 7] as Rect };
export const floor18: Layout = {
  id: 'f18', w: 34, d: 22, mood: 'golden', exterior: 'rail', wall: '#f5efe6', backdrop: 'city', storey: 19,
  rooms: [
    { id: 'park', name: 'Theme Park', r: TP.park, floor: 'deck', tint: '#f0d8c0' },
    { id: 'plaza', name: 'Food Plaza', r: TP.plaza, floor: 'terrazzo', tint: '#fff0f6' },
    { id: 'baths', name: 'Bathrooms', r: TP.baths, floor: 'tile' },
  ],
  open: [['park', 'plaza']],
  doors: [[29, 15]],
  props: [
    P('carousel', 7, 6.5, 0, { r: 2.6 }), P('ferris', 19, 2.2, 0, { r: 3.6 }),
    P('stall', 27, 1.2, 0, { text: 'RING TOSS', color: '#ff3d5a' }), P('stall', 31.5, 1.2, 0, { text: 'PRIZES', color: '#33a8ff' }),
    P('balloons', 13, 11, 0, { seed: 1 }), P('balloons', 26, 9, 0, { seed: 3 }), P('balloons', 2, 13, 0, { seed: 5 }),
    P('bunting', 7, 13.8, 0, { w: 8 }),
    P('foodtruck', 5, 19.8, Math.PI, { text: 'FAIRY FLOSS', color: '#ff6fb5' }), P('foodtruck', 12, 19.8, Math.PI, { text: 'HOT DOGS', color: '#ffd23f' }),
    P('cafetable', 18, 18.5, 0), P('cafetable', 21, 18.5, 0, { color: '#33e1ff' }), label(TP.park, 'Theme Park', 0.4), label(TP.plaza, 'Food Plaza', -0.3),
    on(TP.baths, 's', 0.25, 0.7, 'toilet'), on(TP.baths, 's', 0.5, 0.7, 'toilet'), on(TP.baths, 'e', 0.5, 0.52, 'sink', { w: 1.6 }), label(TP.baths, 'Bathrooms', -0.1),
  ],
  stations: [T('ringtoss', 27, 3.2), T('balloonpop', 31.5, 3.2), T('fairyfloss', 5, 17.4), T('carouselride', 7, 10.3), T('lostkid', 14, 13.6)],
  lift: [33.75, 11, -Math.PI / 2], spawn: [31, 11],
};

// ------------------------------------------------------------------- 19 Space Observatory
export const floor19: Layout = {
  id: 'f19', w: 34, d: 22, mood: 'moody', exterior: 'glass', wall: '#1b1c2e', backdrop: 'city', storey: 20,
  rooms: [
    { id: 'main', name: 'Observatory', r: R.main, floor: 'concrete', tint: '#3a3d55', wall: '#1b1c2e' },
    { id: 's1', name: 'Mission Control', r: R.s1, floor: 'rubber', wall: '#2a2d44' },
    { id: 's2', name: 'Space Shop', r: R.s2, floor: 'carpet', tint: '#2a2a5a' },
    { id: 'baths', name: 'Bathrooms', r: R.baths, floor: 'tile' },
  ],
  doors: DOORS,
  props: [
    P('bigscope', 11, 9, Math.PI), P('orrery', 4, 4, 0), P('rocket', 20, 18, 0, { s: 1 }), P('rocket', 3, 18, 0, { s: 0.7, color: '#33a8ff' }),
    P('beanbag', 9, 16, 0, { color: '#b388ff' }), P('beanbag', 12, 16.5, 0, { color: '#33e1ff' }), P('rug', 11, 15.5, 0, { w: 6, d: 3, color: '#2a2a5a' }),
    on(R.main, 'n', 0.7, 0.05, 'neon', { text: '★ SPACE ★', color: '#b388ff', w: 3 }), label(R.main, 'Observatory', -0.05),
    P('controldesk', 29, 1.2, 0, { w: 4 }), label(R.s1, 'Mission Control', 0.3),
    P('prizes', 29, 9.6, 0, { w: 3.6, color: '#2a2a5a' }), label(R.s2, 'Space Shop', 0.35),
    ...baths(),
  ],
  stations: [T('planets', 4, 7), T('launch', 29, 3.6), T('orbit', 16.5, 9), T('stardust', 11, 12.5), T('spacequiz', 26.5, 13.5)],
  ...frame,
};

// ------------------------------------------------------------------- 20 Jungle Conservatory
export const floor20: Layout = {
  id: 'f20', w: 34, d: 22, mood: 'day', exterior: 'glass', wall: '#e6f2e2', backdrop: 'city', storey: 21,
  rooms: [
    { id: 'main', name: 'Rainforest', r: R.main, floor: 'grass', tint: '#3f8f4a' },
    { id: 's1', name: 'Butterfly House', r: R.s1, floor: 'deck' },
    { id: 's2', name: 'Tree Café', r: R.s2, floor: 'wood' },
    { id: 'baths', name: 'Bathrooms', r: R.baths, floor: 'tile' },
  ],
  doors: DOORS,
  props: [
    P('waterfall', 6, 1.2, 0, { w: 4 }), P('bigtree', 16, 5, 0, { h: 5 }), P('bigtree', 4, 15, 0, { h: 4.5 }), P('bigtree', 19, 17, 0, { h: 5.5 }),
    P('palm', 22.5, 1.5, 0, { h: 4 }), P('palm', 1, 9, 0, { h: 3.6, lean: 0.1 }), P('plant', 10, 19, 0, { kind: 'tall', s: 1.4, seed: 3 }), P('plant', 12, 9, 0, { s: 1.3, seed: 6 }),
    P('perch', 9, 4, 0), P('perch', 22, 10, 0, { bird: '🦜' }), P('butterflies', 11, 13, 0, { r: 3 }),
    label(R.main, 'Rainforest', 0.05),
    P('butterflies', 29, 4, 0, { r: 2.5 }), P('plant', 25, 1, 0, { kind: 'tall', seed: 2 }), P('plant', 33, 1, 0, { seed: 4 }), label(R.s1, 'Butterfly House', 0.3),
    P('cafetable', 26.5, 11, 0, { color: '#9bd36a' }), P('cafetable', 26.5, 14.4, 0, { color: '#ffd23f' }), label(R.s2, 'Tree Café', 0.3),
    ...baths(),
  ],
  stations: [T('butterflies', 29, 6), T('mist', 6, 4.4), T('parrot', 9, 6.6), T('spotfrog', 13, 15.5), T('animalquiz', 30, 14.5)],
  ...frame,
};

// ------------------------------------------------------------------- 21 Candy Land
export const floor21: Layout = {
  id: 'f21', w: 34, d: 22, mood: 'day', exterior: 'glass', wall: '#fff0f8', backdrop: 'city', storey: 22,
  rooms: [
    { id: 'main', name: 'Candy Land', r: R.main, floor: 'pinkcarpet', wall: '#fff0f8' },
    { id: 's1', name: 'Chocolate Room', r: R.s1, floor: 'darkwood', tint: '#a0705a' },
    { id: 's2', name: 'Lolly Shop', r: R.s2, floor: 'terrazzo', tint: '#ffe6f3' },
    { id: 'baths', name: 'Bathrooms', r: R.baths, floor: 'tile' },
  ],
  doors: DOORS,
  props: [
    P('lollipop', 3, 3, 0), P('lollipop', 20, 3, 0, { color: '#33e1ff' }), P('lollipop', 3, 19, 0, { color: '#ffd23f' }), P('lollipop', 20.5, 19, 0, { color: '#7cff6b' }),
    P('candycane', 8, 2, 0), P('candycane', 15, 2, 0, { h: 2.6 }), P('gummytree', 7, 11, 0), P('gummytree', 17, 11, 0),
    P('cupcake', 12, 17, 0), P('cupcake', 12, 6, 0, { color: '#33e1ff' }),
    on(R.main, 's', 0.3, 0.05, 'neon', { text: '🍭 CANDY LAND', color: '#ff3df0', w: 4 }), label(R.main, 'Candy Land', 0.08),
    P('chocfountain', 29, 3.5, 0), label(R.s1, 'Chocolate Room', 0.38),
    P('displaycase', 27, 15.3, Math.PI, { w: 3.6, color: '#ff9fc4' }), label(R.s2, 'Lolly Shop', -0.1),
    ...baths(),
  ],
  stations: [T('catchcandy', 12, 13.8), T('candymemory', 4.5, 7.5), T('chocdip', 29, 6.3), T('candywords', 27, 13), T('cupcake', 12, 8.7)],
  ...frame,
};

// ------------------------------------------------------------------- 22 Haunted Floor
export const floor22: Layout = {
  id: 'f22', w: 34, d: 22, mood: 'moody', exterior: 'glass', wall: '#2a2333', backdrop: 'city', storey: 23,
  rooms: [
    { id: 'main', name: 'Haunted Hall', r: R.main, floor: 'darkwood', tint: '#4a3a4a', wall: '#2a2333' },
    { id: 's1', name: 'Potion Room', r: R.s1, floor: 'stone', tint: '#6a6070' },
    { id: 's2', name: 'Pumpkin Patch', r: R.s2, floor: 'grass', tint: '#4a5a3a' },
    { id: 'baths', name: 'Bathrooms', r: R.baths, floor: 'tile', tint: '#c8c0d0' },
  ],
  doors: DOORS,
  props: [
    P('ghost', 6, 6, 0, { seed: 0 }), P('ghost', 15, 14, 0, { seed: 2 }), P('ghost', 18, 5, 0, { seed: 4 }),
    P('candelabra', 1, 1, 0), P('candelabra', 23, 1, 0), P('candelabra', 1, 21, 0), P('candelabra', 23, 21, 0),
    ...[[4, 16], [7, 18], [10, 16], [13, 18]].map(([x, z], i) => P('gravestone', x, z, 0, { text: ['BOO', 'R.I.P.', 'EEK!', 'OOO'][i] })),
    P('pumpkin', 9, 3, 0, { lit: 1 }), P('pumpkin', 16, 10, 0, { lit: 1, s: 1.3 }), P('chandelier', 12, 10, 0, { r: 1.2 }),
    on(R.main, 'n', 0.5, 0.05, 'neon', { text: '👻 BOO!', color: '#7cff6b', w: 2.6 }), label(R.main, 'Haunted Hall', 0.32),
    P('cauldron', 29, 3, 0), P('bookshelf', 25, 0.4, 0), label(R.s1, 'Potion Room', 0.38),
    P('pumpkin', 26, 10, 0, { s: 1.4 }), P('pumpkin', 27.5, 14, 0, { lit: 1 }), P('pumpkin', 25.5, 14.6, 0, { s: 0.8 }), label(R.s2, 'Pumpkin Patch', 0.1),
    ...baths(),
  ],
  stations: [T('ghosthunt', 12, 13), T('potion', 29, 5.4), T('escape', 4, 9), T('spooky', 9, 14), T('carve', 28, 11.5)],
  ...frame,
};

// ------------------------------------------------------------------- 23 Music Festival (rooftop)
const MF = { field: [0, 0, 34, 15] as Rect, food: [0, 15, 24, 7] as Rect, baths: [24, 15, 10, 7] as Rect };
export const floor23: Layout = {
  id: 'f23', w: 34, d: 22, mood: 'golden', exterior: 'rail', wall: '#f5efe6', backdrop: 'city', storey: 24,
  rooms: [
    { id: 'field', name: 'Festival Field', r: MF.field, floor: 'grass' },
    { id: 'food', name: 'Food Trucks', r: MF.food, floor: 'concrete', tint: '#b8b0a8' },
    { id: 'baths', name: 'Bathrooms', r: MF.baths, floor: 'tile' },
  ],
  open: [['field', 'food']],
  doors: [[29, 15]],
  props: [
    P('fstage', 12, 2.2, 0, { w: 10 }), P('speaker', 5.5, 1.2, 0), P('speaker', 18.5, 1.2, 0),
    P('tent', 26, 4, 0, { color: '#ff6fb5' }), P('tent', 30.5, 4, 0, { color: '#33e1ff' }), P('bunting', 12, 9, 0, { w: 12 }),
    P('balloons', 2, 12, 0, { seed: 2 }), P('balloons', 22, 12, 0, { seed: 4 }),
    P('foodtruck', 5, 19.8, Math.PI, { text: 'TACOS 🌮', color: '#33a8ff' }), P('foodtruck', 12, 19.8, Math.PI, { text: 'ICE CREAM 🍦', color: '#ff6fb5' }), P('foodtruck', 19, 19.8, Math.PI, { text: 'PIZZA 🍕', color: '#ffd23f' }),
    label(MF.field, 'Sky Fest', 0.3), label(MF.food, 'Food Trucks', -0.38),
    on(MF.baths, 's', 0.25, 0.7, 'toilet'), on(MF.baths, 's', 0.5, 0.7, 'toilet'), on(MF.baths, 'e', 0.5, 0.52, 'sink', { w: 1.6 }), label(MF.baths, 'Bathrooms', -0.1),
  ],
  stations: [T('soundcheck', 12, 6), T('setlist', 5.5, 3.5), T('glitter', 28.2, 7.2), T('crowdsurf', 12, 12), T('merch', 8, 15.5)],
  lift: [33.75, 11, -Math.PI / 2], spawn: [31, 11],
};

// ------------------------------------------------------------------- 24 Sky Garden (rooftop)
const SG = { garden: [0, 0, 34, 15] as Rect, zen: [0, 15, 24, 7] as Rect, baths: [24, 15, 10, 7] as Rect };
export const floor24: Layout = {
  id: 'f24', w: 34, d: 22, mood: 'golden', exterior: 'rail', wall: '#f5efe6', backdrop: 'city', storey: 25,
  rooms: [
    { id: 'garden', name: 'Sky Garden', r: SG.garden, floor: 'grass' },
    { id: 'zen', name: 'Zen Garden', r: SG.zen, floor: 'sand', tint: '#efe4cf' },
    { id: 'baths', name: 'Bathrooms', r: SG.baths, floor: 'tile' },
  ],
  open: [['garden', 'zen']],
  doors: [[29, 15]],
  props: [
    P('cherry', 3, 3, 0), P('cherry', 3, 11, 0, { h: 3.6 }), P('cherry', 26, 2, 0), P('cherry', 31, 2.5, 0, { h: 2.8 }),
    P('koipond', 9, 7, 0, { r: 2 }), P('gazebo', 18, 4, 0, { r: 2 }), P('hedgemaze', 24.5, 9.5, 0, { w: 5, d: 5 }),
    P('lantern', 13, 2, 0), P('lantern', 13, 12, 0), P('bench', 18, 10.5, 0), label(SG.garden, 'Sky Garden', 0.42),
    P('bonsai', 3, 21, Math.PI), P('bonsai', 6, 21, Math.PI), P('rug', 14, 18.5, 0, { w: 8, d: 3, color: '#e8dcc0' }), P('lantern', 20, 20.5, 0), label(SG.zen, 'Zen Garden', -0.38),
    on(SG.baths, 's', 0.25, 0.7, 'toilet'), on(SG.baths, 's', 0.5, 0.7, 'toilet'), on(SG.baths, 'e', 0.5, 0.52, 'sink', { w: 1.6 }), label(SG.baths, 'Bathrooms', -0.1),
  ],
  stations: [T('koi', 9, 10), T('blossom', 15, 7.5), T('rosemaze', 24.5, 13.3), T('zen', 14, 16.2), T('gardenwords', 18, 7.6)],
  lift: [33.75, 11, -Math.PI / 2], spawn: [31, 11],
};

export const TOWER_LAYOUTS = { f13: floor13, f14: floor14, f15: floor15, f16: floor16, f17: floor17, f18: floor18, f19: floor19, f20: floor20, f21: floor21, f22: floor22, f23: floor23, f24: floor24 };
