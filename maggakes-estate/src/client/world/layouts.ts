import { RESIDENTS, isResidence, residenceNumber, type FixedZone, type ZoneId } from '../../shared/people';
import type { RoomStyle } from '../../shared/save';
import type { Residence } from '../../shared/protocol';
import type { FloorMat } from '../engine/tex';
import { P, bedroomKit, ensuiteKit, label, on, wardrobeKit, type PropDef, type Rect } from './kit';
import { TOWER_LAYOUTS } from './layouts2';
import { OUTSIDE_LAYOUTS } from './layouts3';
import { penthouse } from './layouts4';

export interface RoomDef { id: string; name: string; r: Rect; floor: FloorMat; tint?: string; wall?: string }

export type StationKind = 'task' | 'garage' | 'carwash' | 'cabana' | 'villa' | 'firepit' | 'dress' | 'portal' | 'beachhut' | 'hideaway' | 'adopt' | 'race' | 'slide' | 'roadtrip';

export interface StationDef { kind: StationKind; id?: string; x: number; z: number }

export interface Layout {
  id: ZoneId;
  w: number;
  d: number;
  mood: string;
  /** What surrounds the floor: glass curtain wall, solid wall, glass railing, or nothing. */
  exterior: 'glass' | 'solid' | 'rail' | 'none';
  wall: string;
  rooms: RoomDef[];
  doors: [number, number][];
  open?: [string, string][];
  props: PropDef[];
  stations: StationDef[];
  /** x, z, rotation */
  lift: [number, number, number];
  spawn: [number, number];
  pools?: Rect[];
  tubs?: [number, number, number][];
  pets?: boolean;
  /** Race track: start line (x, z, heading) and checkpoints in order, in floor-plan metres. */
  race?: { start: [number, number, number]; checkpoints: [number, number][] };
  backdrop: 'city' | 'ocean' | 'none' | 'tower';
  /** Height of the floor above street level, for the view out the windows. */
  storey: number;
  /** Slippery ice areas (x, z, w, d in floor-plan metres). */
  ice?: Rect[];
  /** Gentle snowfall over the whole floor. */
  snow?: boolean;
  /** Outside the mansion (reached by car): a parked car stands where the lift would be. */
  outside?: boolean;
}

const T = (id: string, x: number, z: number): { kind: 'task'; id: string; x: number; z: number } => ({ kind: 'task', id, x, z });

// ===================================================================== Basement
const B = {
  phoebe: [0, 0, 12, 11] as Rect,
  bath: [12, 0, 4, 8] as Rect,
  serena: [16, 0, 12, 11] as Rect,
  pEns: [0, 11, 5, 7] as Rect,
  pWard: [5, 11, 7, 7] as Rect,
  hall: [12, 8, 4, 10] as Rect,
  sWard: [16, 11, 6, 7] as Rect,
  sEns: [22, 11, 6, 7] as Rect,
};

const basement: Layout = {
  id: 'b', w: 28, d: 18, mood: 'moody', exterior: 'solid', wall: '#f3e7e9', backdrop: 'none', storey: -1,
  rooms: [
    { id: 'phoebe', name: "Phoebe's Bedroom", r: B.phoebe, floor: 'pinkcarpet', wall: '#ffd9e6' },
    { id: 'sharedbath', name: 'Shared Bathroom', r: B.bath, floor: 'tile' },
    { id: 'serena', name: "Serena's Bedroom", r: B.serena, floor: 'wood', tint: '#e2c9a6', wall: '#e8f6fb' },
    { id: 'pens', name: 'Ensuite', r: B.pEns, floor: 'tile' },
    { id: 'pward', name: 'Walk-in Wardrobe', r: B.pWard, floor: 'wood' },
    { id: 'hall', name: 'Hall', r: B.hall, floor: 'marble' },
    { id: 'sward', name: 'Walk-in Wardrobe', r: B.sWard, floor: 'wood' },
    { id: 'sens', name: 'Ensuite', r: B.sEns, floor: 'tile' },
  ],
  doors: [[12, 4], [16, 4], [12, 9.5], [16, 9.5], [2.5, 11], [8.5, 11], [19, 11], [25, 11]],
  props: [
    ...bedroomKit(B.phoebe, 'n', { bed: '#d7263d', accent: '#ffd23f', pillow: '#ffc2d4', frame: '#ffe3ec', rug: '#ff8fb8', posters: ['brainrot', 'flower', 'brainrot'] }),
    P('shark', 2.2, 7.5, 0.6), P('teddy', 1.0, 9.8, 0.5, { color: '#f4a6c6' }),
    P('beanbag', 9.8, 8.4, -0.7, { color: '#ff6f91' }), P('lavalamp', 11.3, 10.3, 0, { color: '#7cff6b' }),
    on(B.phoebe, 'e', 0.25, 0.65, 'desk', { color: '#ffffff', screen: '#ff8fd1' }), P('gamingchair', 10.5, 2.75, Math.PI / 2, { color: '#ff3d7f' }),
    on(B.phoebe, 's', 0.45, 0.05, 'neon', { text: 'BRAINROT', color: '#ff3d7f', w: 2.4 }),
    P('plant', 0.6, 0.6, 0, { seed: 2 }), label(B.phoebe, "Phoebe's Bedroom", 0.38),
    on(B.bath, 'n', 0.75, 0.7, 'toilet'), on(B.bath, 'e', 0.2, 0.52, 'sink', { w: 1.2 }), P('bathtub', 13.8, 6.8, 0), label(B.bath, 'Shared Bath', 0.0),
    ...bedroomKit(B.serena, 'n', { bed: '#bfe3f2', accent: '#4fd1c5', frame: '#f2e6cf', rug: '#f2e6cf', posters: ['beach', 'sunset', 'beach'] }),
    on(B.serena, 'e', 0.35, 0.3, 'surfboard', { color: '#ff9f1c' }), on(B.serena, 'e', 0.6, 0.3, 'surfboard', { color: '#4fd1c5' }),
    P('palm', 27.2, 10.2, 0, { h: 2.6, lean: 0.05 }), P('armchair', 18, 8, 0.6, { color: '#ffffff' }),
    on(B.serena, 'w', 0.3, 0.4, 'shelf', { w: 1.2, h: 1.6 }), P('fairylights', 21.5, 10.6, Math.PI), label(B.serena, "Serena's Bedroom", 0.38),
    ...ensuiteKit(B.pEns, 's'), ...ensuiteKit(B.sEns, 's'),
    ...wardrobeKit(B.pWard, 's', ['#ff6f91', '#d7263d', '#ffd23f', '#ffffff', '#f6a6c8']), on(B.pWard, 'e', 0.55, 0.35, 'mirror'), P('rug', 8.5, 14, 0, { color: '#ffc2d4', round: true, w: 2 }),
    ...wardrobeKit(B.sWard, 's', ['#bfe3f2', '#4fd1c5', '#ffffff', '#ffd36e', '#e4d6bf']), on(B.sWard, 'w', 0.5, 0.35, 'mirror'),
    P('plant', 12.6, 8.6, 0, { kind: 'tall', seed: 4 }), P('plant', 15.4, 8.6, 0, { kind: 'tall', seed: 5 }),
    P('label', 14, 12, 0, { text: 'Basement' }),
  ],
  stations: [],
  lift: [14, 17.75, Math.PI],
  spawn: [14, 15],
};

// ===================================================================== 1st floor
const F1 = {
  guest1: [0, 0, 8, 7] as Rect,
  g1ens: [8, 0, 4, 4] as Rect,
  hall: [8, 4, 4, 6] as Rect,
  guest2: [0, 7, 8, 7] as Rect,
  g2ens: [8, 10, 4, 4] as Rect,
  gbath: [0, 14, 6, 4] as Rect,
  pantry: [0, 18, 6, 4] as Rect,
  hall2: [6, 14, 6, 8] as Rect,
  reception: [12, 0, 12, 22] as Rect,
  lounge: [24, 0, 10, 7] as Rect,
  sushi: [24, 7, 10, 6] as Rect,
  spa: [24, 13, 10, 9] as Rect,
};

const floor1: Layout = {
  id: 'f1', w: 34, d: 22, mood: 'day', exterior: 'glass', wall: '#f5efe8', backdrop: 'city', storey: 1,
  rooms: [
    { id: 'guest1', name: 'Guest Bedroom 1', r: F1.guest1, floor: 'carpet' },
    { id: 'g1ens', name: 'Ensuite', r: F1.g1ens, floor: 'tile' },
    { id: 'hall', name: 'Hall', r: F1.hall, floor: 'marble' },
    { id: 'guest2', name: 'Guest Bedroom 2', r: F1.guest2, floor: 'carpet' },
    { id: 'g2ens', name: 'Ensuite', r: F1.g2ens, floor: 'tile' },
    { id: 'gbath', name: 'Guest Bathroom', r: F1.gbath, floor: 'tile' },
    { id: 'pantry', name: "Butler's Pantry", r: F1.pantry, floor: 'wood' },
    { id: 'hall2', name: 'Hall', r: F1.hall2, floor: 'marble' },
    { id: 'reception', name: 'Reception', r: F1.reception, floor: 'marble' },
    { id: 'lounge', name: 'Guest Lounge', r: F1.lounge, floor: 'carpet' },
    { id: 'sushi', name: 'Sushi Room', r: F1.sushi, floor: 'darkwood' },
    { id: 'spa', name: 'Luxury Spa', r: F1.spa, floor: 'stone', wall: '#eef3ee' },
  ],
  doors: [[8, 5.5], [8, 2], [8, 8.5], [8, 12], [12, 7], [6, 16], [6, 20], [12, 18], [24, 3.5], [24, 10], [24, 17.5]],
  props: [
    ...bedroomKit(F1.guest1, 'n', { bed: '#e9dccf', accent: '#3d405b', rug: '#efe4d6', posters: ['abstract', 'star'], along: 0.45 }),
    P('armchair', 1.3, 5.6, 0.8), P('plant', 7.3, 0.6, 0, { seed: 7 }), label(F1.guest1, 'Guest Bedroom 1', 0.4),
    ...bedroomKit(F1.guest2, 'w', { bed: '#bfe3f2', accent: '#ffffff', rug: '#efe4d6', posters: ['sunset'] }),
    P('plant', 7.3, 13.3, 0, { seed: 8 }), label(F1.guest2, 'Guest Bedroom 2', 0.38),
    ...ensuiteKit(F1.g1ens, 'e', { tub: false }), ...ensuiteKit(F1.g2ens, 'e', { tub: false }),
    on(F1.gbath, 'w', 0.5, 0.7, 'toilet'), on(F1.gbath, 'n', 0.5, 0.52, 'sink', { w: 1.6 }), label(F1.gbath, 'Guest Bath', 0.2),
    on(F1.pantry, 's', 0.5, 0.66, 'counter', { w: 4.4, stove: false }), on(F1.pantry, 'w', 0.5, 0.7, 'fridge'), label(F1.pantry, "Butler's Pantry", -0.2),
    P('plant', 9.3, 4.7, 0, { kind: 'tall', seed: 1 }), P('plant', 6.6, 21.3, 0, { kind: 'tall', seed: 2 }),
    // Reception
    P('reception', 18, 6.6, 0, { w: 4 }), P('chandelier', 18, 11.5, 0, { r: 1.3, y: 2.7 }),
    P('rug', 18, 12, 0, { round: true, w: 5, color: '#d8b45a' }), P('rug', 18, 12, 0, { round: true, w: 4.6, color: '#f6ecdc' }),
    P('stairs', 18, 18.2, 0), P('plant', 13, 21, 0, { kind: 'tall', seed: 3, s: 1.3 }), P('plant', 23, 21, 0, { kind: 'tall', seed: 4, s: 1.3 }),
    P('plant', 13, 1.0, 0, { s: 1.2 }), P('armchair', 14.2, 13.4, Math.PI / 2, { color: '#d8b45a' }), P('armchair', 21.8, 13.4, -Math.PI / 2, { color: '#d8b45a' }),
    P('label', 18, 14.3, 0, { text: 'Reception' }),
    // Guest lounge
    P('sofa', 29, 4.9, Math.PI, { w: 3, color: '#efe7dd', accent: '#d8b45a' }), P('armchair', 25.7, 2.9, Math.PI / 2), P('coffeetable', 29, 3, 0, { w: 1.6 }),
    on(F1.lounge, 'n', 0.5, 0.45, 'tv', { w: 2.2 }), P('rug', 29, 3.2, 0, { w: 4.4, d: 3.4, color: '#e6d8c6' }), P('plant', 33.3, 6.4, 0, { seed: 11 }),
    label(F1.lounge, 'Guest Lounge', 0.35),
    // Sushi room
    P('sushibar', 29.5, 9.6, Math.PI, { w: 5.4 }), on(F1.sushi, 'e', 0.5, 0.05, 'neon', { text: '寿司', color: '#ff4a4a', w: 1.6 }), label(F1.sushi, 'Sushi Room', 0.36),
    // Spa
    P('spabed', 27, 18.5, 0), P('spabed', 30, 18.5, 0, { color: '#f7e6ee' }), P('candles', 28.5, 21.2, 0), P('plant', 33.3, 13.6, 0, { kind: 'tall', seed: 9 }),
    P('hottub', 31.6, 15.8, 0, { r: 1.0 }), P('plant', 24.7, 21.3, 0, { seed: 12 }), label(F1.spa, 'Luxury Spa', -0.38),
  ],
  stations: [T('checkin', 18, 8.6), T('sushi', 29.5, 11.6), T('cleanguest', 4, 11), T('spa', 28.5, 16), T('drink', 27, 6.2)],
  lift: [17, 0.25, 0],
  spawn: [17, 3],
  tubs: [[31.6, 15.8, 1.0]],
};

// ===================================================================== 2nd floor
const F2 = {
  kitchen: [0, 0, 16, 12] as Rect,
  lounge: [16, 0, 16, 12] as Rect,
  play: [0, 12, 8, 8] as Rect,
  petroom: [8, 12, 8, 8] as Rect,
  feed: [16, 12, 7, 8] as Rect,
  wash: [23, 12, 5, 8] as Rect,
  powder: [28, 12, 4, 8] as Rect,
};

const floor2: Layout = {
  id: 'f2', w: 32, d: 20, mood: 'day', exterior: 'glass', wall: '#f6f1ea', backdrop: 'city', storey: 2, pets: true,
  rooms: [
    { id: 'kitchen', name: 'Kitchen', r: F2.kitchen, floor: 'wood' },
    { id: 'lounge', name: 'Lounge Room', r: F2.lounge, floor: 'wood' },
    { id: 'play', name: 'Pet Play Area', r: F2.play, floor: 'rubber', tint: '#8fd3c8' },
    { id: 'petroom', name: 'Pet Room', r: F2.petroom, floor: 'carpet' },
    { id: 'feed', name: 'Pet Feeding', r: F2.feed, floor: 'tile' },
    { id: 'wash', name: 'Pet Washing', r: F2.wash, floor: 'tile' },
    { id: 'powder', name: 'Powder Room', r: F2.powder, floor: 'marble' },
  ],
  open: [['kitchen', 'lounge']],
  doors: [[4, 12], [12, 12], [19.5, 12], [25.5, 12], [30, 12], [8, 16], [16, 16], [23, 16]],
  props: [
    on(F2.kitchen, 'n', 0.42, 0.66, 'counter', { w: 9 }), on(F2.kitchen, 'n', 0.86, 0.7, 'fridge'), on(F2.kitchen, 'w', 0.4, 0.7, 'fridge'),
    P('island', 7, 5.6, 0, { w: 4.2 }), P('chandelier', 7, 5.6, 0, { r: 0.7, y: 2.9 }),
    P('plant', 0.6, 11.3, 0, { kind: 'tall', seed: 3 }), P('plant', 15.3, 11.3, 0, { seed: 4 }), label(F2.kitchen, 'Kitchen', 0.3),
    P('sofa', 24, 7.6, Math.PI, { w: 3.2, color: '#efe7dd', accent: '#f3a6c8' }), P('armchair', 20.6, 4.6, Math.PI / 2, { color: '#f3a6c8' }), P('armchair', 27.4, 4.6, -Math.PI / 2, { color: '#f3a6c8' }),
    P('coffeetable', 24, 4.6, 0, { w: 1.2, round: true }), on(F2.lounge, 'n', 0.5, 0.45, 'tv', { w: 2.8 }), P('rug', 24, 5, 0, { w: 6, d: 4.4, color: '#efe4d6' }),
    P('floorlamp', 29.5, 8, 0), P('plant', 31.4, 0.6, 0, { kind: 'tall', seed: 6 }), P('plant', 16.6, 0.6, 0, { seed: 7 }), label(F2.lounge, 'Lounge Room', 0.32),
    P('cattree', 1, 13, 0), P('toys', 4, 16.5, 0), P('petbed', 6.5, 18.8, 0, { color: '#ffd23f' }), label(F2.play, 'Pet Play Area', 0.1),
    P('petbed', 10, 18.8, 0, { color: '#f6c6d6' }), P('petbed', 13.5, 18.8, 0, { color: '#bfe3f2' }), on(F2.petroom, 'e', 0.2, 0.4, 'shelf', { w: 1.6, h: 1.2 }), label(F2.petroom, 'Pet Room', 0.05),
    on(F2.feed, 's', 0.3, 0.4, 'petbowls'), on(F2.feed, 's', 0.75, 0.4, 'petbowls'), label(F2.feed, 'Pet Feeding', 0.0),
    on(F2.wash, 's', 0.5, 0.7, 'petbath'), label(F2.wash, 'Pet Washing', -0.1),
    on(F2.powder, 's', 0.7, 0.7, 'toilet'), on(F2.powder, 'e', 0.3, 0.52, 'sink', { w: 1.2 }), label(F2.powder, 'Powder', -0.25),
  ],
  stations: [T('breakfast', 4, 1.9), T('feed', 19.5, 17.4), T('wash', 25.5, 17.2), T('cleankitchen', 10.5, 8.8), T('snack', 3.5, 8.8), { kind: 'adopt', x: 12, z: 15.5 }],
  lift: [31.75, 6, -Math.PI / 2],
  spawn: [29, 6],
};

// ===================================================================== 3rd floor
const F3 = {
  gym: [0, 0, 22, 8] as Rect,
  pilates: [22, 0, 12, 8] as Rect,
  pool: [0, 8, 34, 9] as Rect,
  change: [0, 17, 20, 5] as Rect,
  baths: [20, 17, 14, 5] as Rect,
};

const floor3: Layout = {
  id: 'f3', w: 34, d: 22, mood: 'day', exterior: 'glass', wall: '#eef0f2', backdrop: 'city', storey: 3,
  rooms: [
    { id: 'gym', name: 'Gym', r: F3.gym, floor: 'rubber' },
    { id: 'pilates', name: 'Pilates / Stretching', r: F3.pilates, floor: 'wood' },
    { id: 'pool', name: 'Indoor Pool', r: F3.pool, floor: 'tile', tint: '#f2f6f7' },
    { id: 'change', name: 'Change Rooms + Showers', r: F3.change, floor: 'tile' },
    { id: 'baths', name: 'Bathrooms', r: F3.baths, floor: 'tile' },
  ],
  doors: [[6, 8], [16, 8], [28, 8], [5, 17], [15, 17], [24, 17], [30, 17]],
  props: [
    ...[2, 3.2, 4.4, 5.6].map((x) => P('treadmill', x, 1.1, 0)), ...[8.5, 9.6, 10.7].map((x) => P('bike', x, 0.75, 0)),
    P('bench', 14, 2.5, 0), P('bench', 18, 2.5, 0), on(F3.gym, 's', 0.5, 0.45, 'dumbbells'), on(F3.gym, 'w', 0.6, 0.45, 'dumbbells'),
    on(F3.gym, 'e', 0.5, 0.05, 'neon', { text: 'HOT', color: '#ff3df0', w: 2.2 }), P('rug', 14, 5.5, 0, { w: 6, d: 2.2, color: '#2a2d33' }), label(F3.gym, 'Gym', 0.36),
    ...[24.5, 27.5, 30.5].map((x) => P('reformer', x, 2.4, 0)), ...[24.5, 27, 29.5, 32].map((x, i) => P('yogamat', x, 6.2, Math.PI / 2, { color: ['#b9a2e8', '#f6a6c8', '#bfe3f2', '#ffd36e'][i] })),
    on(F3.pilates, 'e', 0.5, 0.06, 'mirror'), label(F3.pilates, 'Pilates / Stretching', -0.4),
    ...[4, 8, 12, 16, 20].map((x) => P('sunbed', x, 9.4, Math.PI / 2, { color: '#ffffff', towel: '#bfe3f2' })),
    P('hottub', 27, 12.6, 0, { r: 1.6 }),
    P('plant', 0.7, 16.3, 0, { kind: 'tall', seed: 2 }), P('plant', 23.5, 16.3, 0, { kind: 'tall', seed: 3 }), P('plant', 33.3, 16.3, 0, { seed: 5 }),
    P('label', 12, 16.3, 0, { text: 'Indoor Pool' }),
    ...[1.5, 3, 4.5].map((x) => on(F3.change, 's', x / 20, 0.6, 'closet', { w: 1.4, color: '#bfe3f2' })), on(F3.change, 's', 0.55, 0.6, 'bench'),
    P('shower', 17.4, 21.4, -Math.PI / 2, { w: 1.1 }), P('shower', 18.6, 21.4, -Math.PI / 2, { w: 1.1 }), P('shower', 12, 21.4, -Math.PI / 2, { w: 1.1 }),
    label(F3.change, 'Change Rooms + Showers', -0.1),
    on(F3.baths, 's', 0.15, 0.7, 'toilet'), on(F3.baths, 's', 0.3, 0.7, 'toilet'), on(F3.baths, 's', 0.6, 0.52, 'sink', { w: 2.4 }), on(F3.baths, 's', 0.9, 0.7, 'toilet'),
    label(F3.baths, 'Bathrooms', -0.2),
  ],
  stations: [T('setupgym', 7.5, 4.5), T('swim', 12, 16.2), T('organisegym', 16.5, 5.4), T('hottub', 27, 15.6), T('stretch', 27, 4.7)],
  lift: [33.75, 10.5, -Math.PI / 2],
  spawn: [31, 10.5],
  pools: [[3, 10.6, 19, 5]],
  tubs: [[27, 12.6, 1.6]],
};

// ===================================================================== 4th floor
const F4 = {
  keola: [0, 0, 11, 9] as Rect,
  study: [11, 0, 10, 6] as Rect,
  jess: [21, 0, 11, 9] as Rect,
  landing: [11, 6, 10, 3] as Rect,
  kEns: [0, 9, 5, 5] as Rect,
  kWard: [0, 14, 5, 6] as Rect,
  dining: [5, 9, 22, 11] as Rect,
  jEns: [27, 9, 5, 5] as Rect,
  jWard: [27, 14, 5, 6] as Rect,
};

const floor4: Layout = {
  id: 'f4', w: 32, d: 20, mood: 'day', exterior: 'glass', wall: '#f4efe9', backdrop: 'city', storey: 4,
  rooms: [
    { id: 'keola', name: "Keola's Bedroom", r: F4.keola, floor: 'carpet', tint: '#c9d9ec', wall: '#e3eefa' },
    { id: 'study', name: 'Study Nook', r: F4.study, floor: 'darkwood' },
    { id: 'guest4', name: 'Guest Suite', r: F4.jess, floor: 'carpet', tint: '#d9cfe6', wall: '#2a2236' }, // Jess moved up to her penthouse
    { id: 'landing', name: 'Landing', r: F4.landing, floor: 'marble' },
    { id: 'kens', name: 'Ensuite', r: F4.kEns, floor: 'tile' },
    { id: 'kward', name: 'Walk-in Wardrobe', r: F4.kWard, floor: 'wood' },
    { id: 'dining', name: 'Dining Room', r: F4.dining, floor: 'wood' },
    { id: 'jens', name: 'Ensuite', r: F4.jEns, floor: 'tile' },
    { id: 'jward', name: 'Walk-in Wardrobe', r: F4.jWard, floor: 'wood' },
  ],
  open: [['landing', 'dining']],
  doors: [[11, 7.5], [21, 7.5], [16, 6], [2.5, 9], [5, 17], [8, 9], [29.5, 9], [27, 17], [24, 9]],
  props: [
    ...bedroomKit(F4.keola, 'n', { bed: '#2b6cff', accent: '#33e1ff', pillow: '#e6f3ff', frame: '#1b3a5c', rug: '#9fd3ff', posters: ['sixseven', 'ocean', 'trident'] }),
    on(F4.keola, 'w', 0.62, 0.05, 'neon', { text: '67', color: '#33e1ff', w: 1.4 }), P('trident', 10.2, 1.0, 0), P('aquarium', 9.5, 8.4, Math.PI),
    on(F4.keola, 'w', 0.3, 0.65, 'desk', { color: '#1b3a5c', screen: '#33e1ff' }), P('books', 0.5, 4.6, 0), P('label', 5.5, 7.4, 0, { text: "Keola's Bedroom" }),
    on(F4.study, 'n', 0.3, 0.4, 'shelf', { w: 2.4, h: 2 }), on(F4.study, 'n', 0.78, 0.65, 'desk'), P('armchair', 13, 4, 0.5), P('plant', 20.4, 0.6, 0, { seed: 4 }),
    label(F4.study, 'Study Nook', 0.32),
    ...bedroomKit(F4.jess, 'n', { bed: '#141414', accent: '#ff3df0', pillow: '#ffb3f0', frame: '#2a2236', rug: '#5c1a5e', posters: ['concert', 'star', 'concert', 'music'] }),
    on(F4.jess, 'e', 0.62, 0.05, 'neon', { text: 'LAROI', color: '#ff3df0', w: 2.2 }), P('speaker', 21.6, 8.3, 0.5), P('speaker', 31.4, 8.3, -0.5),
    P('guitar', 22, 5.2, 0.5), P('mic', 30.8, 5.4, 0), P('discoball', 26.5, 6.8, 0), P('label', 26.5, 7.4, 0, { text: 'Guest Suite', color: '#ffd6f7' }),
    ...ensuiteKit(F4.kEns, 's'), ...ensuiteKit(F4.jEns, 's'),
    ...wardrobeKit(F4.kWard, 'w', ['#2b6cff', '#ff9f1c', '#111', '#ffffff', '#33e1ff']), on(F4.kWard, 's', 0.5, 0.35, 'mirror'),
    ...wardrobeKit(F4.jWard, 'e', ['#141414', '#ff3df0', '#ffffff', '#5c1a5e', '#ffb3f0']), on(F4.jWard, 's', 0.5, 0.35, 'mirror'),
    P('diningtable', 16, 14, 0, { l: 6, set: true, chair: '#e9dccf' }), P('chandelier', 16, 14, 0, { r: 1.1, y: 2.75 }),
    on(F4.dining, 's', 0.2, 0.62, 'counter', { w: 3, stove: false, sink: false }), P('plant', 5.7, 19.3, 0, { kind: 'tall', seed: 9 }), P('plant', 26.3, 10, 0, { kind: 'tall', seed: 1 }),
    P('label', 16, 17.6, 0, { text: 'Dining Room' }),
  ],
  stations: [T('bed', 5.5, 5.2), T('wardrobe', 2.5, 16.5), T('dining', 16, 11.3), T('outfit', 29.5, 16.5), T('decorate', 16, 3.6)],
  lift: [21, 19.75, Math.PI],
  spawn: [21, 17],
};

// ===================================================================== 5th floor
const F5 = {
  ava: [0, 0, 11, 8] as Rect,
  vinyl: [11, 0, 7, 5] as Rect,
  grace: [18, 0, 10, 8] as Rect,
  landing: [11, 5, 7, 3] as Rect,
  aEns: [0, 8, 5, 6] as Rect,
  music: [5, 8, 18, 6] as Rect,
  gEns: [23, 8, 5, 6] as Rect,
  studio: [0, 14, 11, 6] as Rect,
  dj: [11, 14, 11, 6] as Rect,
  bath: [22, 14, 6, 6] as Rect,
};

const floor5: Layout = {
  id: 'f5', w: 28, d: 20, mood: 'day', exterior: 'glass', wall: '#f3eee8', backdrop: 'city', storey: 5,
  rooms: [
    { id: 'ava', name: "Ava's Bedroom", r: F5.ava, floor: 'wood', tint: '#e6d2b5', wall: '#e9f6fb' },
    { id: 'vinyl', name: 'Vinyl Room', r: F5.vinyl, floor: 'darkwood', wall: '#3a2a3e' },
    { id: 'grace', name: "Grace's Bedroom", r: F5.grace, floor: 'carpet', tint: '#d6cbe8', wall: '#efe6ff' },
    { id: 'landing', name: 'Landing', r: F5.landing, floor: 'marble' },
    { id: 'aens', name: 'Ensuite', r: F5.aEns, floor: 'tile' },
    { id: 'music', name: 'Music Room', r: F5.music, floor: 'darkwood' },
    { id: 'gens', name: 'Ensuite', r: F5.gEns, floor: 'tile' },
    { id: 'studio', name: 'Recording Studio', r: F5.studio, floor: 'carpet', tint: '#4a4550', wall: '#2c2a33' },
    { id: 'dj', name: 'DJ Booth', r: F5.dj, floor: 'terrazzo', tint: '#2a2833', wall: '#1d1b26' },
    { id: 'bath', name: 'Bathroom', r: F5.bath, floor: 'tile' },
  ],
  open: [['landing', 'music']],
  doors: [[11, 6.5], [18, 6.5], [16.5, 5], [2.5, 8], [8, 8], [25.5, 8], [20.5, 8], [8, 14], [14, 14], [19, 14], [22, 17]],
  props: [
    ...bedroomKit(F5.ava, 'n', { bed: '#bfe3f2', accent: '#ffd36e', frame: '#f2e6cf', rug: '#f2e6cf', posters: ['beach', 'vinyl', 'sunset'] }),
    on(F5.ava, 'w', 0.55, 0.05, 'vinylwall'), P('recordplayer', 9.8, 7.3, Math.PI), P('surfboard', 10.6, 3.8, -Math.PI / 2, { color: '#bfe3f2' }),
    P('label', 5.5, 6.9, 0, { text: "Ava's Bedroom" }),
    on(F5.vinyl, 'n', 0.35, 0.4, 'shelf', { w: 2.6, h: 2, items: 'vinyl' }), on(F5.vinyl, 'w', 0.5, 0.4, 'shelf', { w: 1.6, h: 2, items: 'vinyl' }), label(F5.vinyl, 'Vinyl Room', 0.2),
    ...bedroomKit(F5.grace, 'n', { bed: '#9b7ede', accent: '#ffd23f', frame: '#efe6ff', rug: '#c9a4ff', posters: ['music', 'concert'] }),
    on(F5.grace, 'e', 0.5, 0.05, 'neon', { text: '♪♫', color: '#c77dff', w: 1.4 }), P('guitar', 19, 6.6, 0.6, { color: '#9b7ede' }), P('mic', 26.8, 6.4, 0),
    P('label', 23, 6.9, 0, { text: "Grace's Bedroom" }),
    ...ensuiteKit(F5.aEns, 'w', { tub: false }), ...ensuiteKit(F5.gEns, 'e', { tub: false }),
    P('piano', 13.5, 11.2, 0.3), on(F5.music, 'w', 0.5, 0.95, 'sofa', { w: 2.6, color: '#2a2833', accent: '#ff3df0', accent2: '#33e1ff' }), P('drums', 20.6, 10.4, -0.5),
    P('speaker', 5.6, 8.7, 0.6), P('speaker', 22.4, 13.3, -2.2), P('guitar', 17.5, 9.0, 0.2), P('rug', 13.5, 11.2, 0, { w: 6, d: 4, color: '#5c1a5e' }),
    P('label', 13.5, 13.5, 0, { text: 'Music Room' }),
    P('mixer', 5.5, 17.6, Math.PI), P('mic', 2, 15.6, 0), P('speaker', 0.6, 19.4, 0.8), P('armchair', 9.5, 15.5, -2.3, { color: '#2a2833' }), label(F5.studio, 'Recording Studio', -0.38),
    P('djbooth', 16.5, 19.2, Math.PI), P('speaker', 13.2, 19.3, Math.PI), P('speaker', 19.8, 19.3, Math.PI), P('discoball', 16.5, 16, 0),
    P('label', 16.5, 15, 0, { text: 'DJ Booth', color: '#ffd6f7' }),
    on(F5.bath, 's', 0.75, 0.7, 'toilet'), on(F5.bath, 'e', 0.3, 0.52, 'sink', { w: 1.2 }), label(F5.bath, 'Bathroom', -0.2),
  ],
  stations: [T('record', 3.6, 17), T('dj', 16.5, 17.6), T('organisemusic', 10, 10.5), T('photo', 20.6, 12.6), T('musicchallenge', 14.6, 9.0)],
  lift: [14.5, 5.25, 0],
  spawn: [14.5, 7.3],
};

// ===================================================================== 6th floor
const F6 = {
  charis: [0, 0, 11, 10] as Rect,
  ward: [11, 0, 8, 14] as Rect,
  gabby: [19, 0, 11, 10] as Rect,
  cEns: [0, 10, 6, 8] as Rect,
  hall: [6, 10, 5, 8] as Rect,
  strip: [11, 14, 8, 4] as Rect,
  gEns: [19, 10, 6, 8] as Rect,
  sBath: [25, 10, 5, 8] as Rect,
};

const floor6: Layout = {
  id: 'f6', w: 30, d: 18, mood: 'day', exterior: 'glass', wall: '#fbeef2', backdrop: 'city', storey: 6,
  rooms: [
    { id: 'charis', name: "Charis's Bedroom", r: F6.charis, floor: 'pinkcarpet', wall: '#ffe6ee' },
    { id: 'ward', name: 'Walk-in Wardrobe', r: F6.ward, floor: 'wood', tint: '#e7d3c0' },
    { id: 'gabby', name: "Gabby's Bedroom", r: F6.gabby, floor: 'pinkcarpet', tint: '#f1d7e8', wall: '#fff0f6' },
    { id: 'cens', name: 'Ensuite', r: F6.cEns, floor: 'tile' },
    { id: 'hall', name: 'Hall', r: F6.hall, floor: 'marble' },
    { id: 'strip', name: 'Landing', r: F6.strip, floor: 'marble' },
    { id: 'gens', name: 'Ensuite', r: F6.gEns, floor: 'tile' },
    { id: 'sbath', name: 'Shared Bathroom', r: F6.sBath, floor: 'tile' },
  ],
  open: [['hall', 'strip']],
  doors: [[8.5, 10], [3, 10], [11, 2.5], [19, 2.5], [22, 10], [27.5, 10], [15, 14], [25, 14]],
  props: [
    ...bedroomKit(F6.charis, 'n', { bed: '#f7c6d9', accent: '#ffffff', frame: '#fff5f8', rug: '#ffd6e7', posters: ['flower', 'star', 'abstract'] }),
    on(F6.charis, 'w', 0.6, 0.5, 'vanity'), P('beanbag', 9, 8.3, -0.6, { color: '#ffffff' }), P('plant', 10.4, 9.4, 0, { seed: 3 }),
    P('label', 5.5, 8.2, 0, { text: "Charis's Bedroom" }),
    ...wardrobeKit(F6.ward, 'w', ['#f6a6c8', '#ffffff', '#ffd36e', '#c9a4ff', '#ff6f91', '#e4d6bf']),
    ...wardrobeKit(F6.ward, 'e', ['#111', '#bfe3f2', '#ff6f91', '#ffffff', '#d7263d']), on(F6.ward, 'n', 0.5, 0.35, 'mirror'),
    P('stand', 15, 6, 0, { color: '#ffffff' }), P('stand', 15, 9, 0, { color: '#ffffff' }), P('chandelier', 15, 7.5, 0, { r: 0.8, y: 2.75 }),
    P('rug', 15, 7.5, 0, { round: true, w: 3, color: '#ffd6e7' }), P('label', 15, 12.4, 0, { text: 'Walk-in Wardrobe' }),
    ...bedroomKit(F6.gabby, 'n', { bed: '#ffd6e7', accent: '#ff6f91', frame: '#fff5f8', rug: '#ffc2d4', posters: ['flower', 'sunset', 'beach'], canopy: true }),
    on(F6.gabby, 'e', 0.6, 0.35, 'mirror'), P('teddy', 20.2, 8.8, 0.6, { color: '#ffffff' }), P('fairylights', 25, 9.5, Math.PI),
    P('label', 24.5, 8.2, 0, { text: "Gabby's Bedroom" }),
    ...ensuiteKit(F6.cEns, 's'), ...ensuiteKit(F6.gEns, 's'), ...ensuiteKit(F6.sBath, 's', { tub: false }),
    P('plant', 6.6, 17.3, 0, { kind: 'tall', seed: 5 }), P('plant', 18.4, 17.3, 0, { kind: 'tall', seed: 6 }),
  ],
  stations: [T('bed', 5.5, 5.4), T('wardrobe', 13.2, 3), T('outfit', 15, 10.8), T('cleanensuite', 3, 13.5), T('decorate', 9, 15.5)],
  lift: [15, 17.75, Math.PI],
  spawn: [15, 15.6],
};

// ===================================================================== 7th floor
const F7 = {
  bed: [0, 0, 12, 9] as Rect,
  ward: [12, 0, 8, 6] as Rect,
  ens: [20, 0, 8, 6] as Rect,
  ready: [12, 6, 8, 7] as Rect,
  lounge: [0, 9, 12, 11] as Rect,
  lounge2: [20, 6, 8, 7] as Rect,
  yoga: [12, 13, 10, 7] as Rect,
  balcony: [22, 13, 6, 7] as Rect,
};

const floor7: Layout = {
  id: 'f7', w: 28, d: 20, mood: 'golden', exterior: 'glass', wall: '#f7f1ea', backdrop: 'city', storey: 7,
  rooms: [
    { id: 'milla', name: "Milla's Bedroom", r: F7.bed, floor: 'carpet', tint: '#efe3dc' },
    { id: 'ward', name: 'Walk-in Wardrobe', r: F7.ward, floor: 'wood', tint: '#e7d3c0' },
    { id: 'ens', name: 'Ensuite', r: F7.ens, floor: 'marble' },
    { id: 'ready', name: 'Getting Ready Room', r: F7.ready, floor: 'pinkcarpet' },
    { id: 'lounge', name: 'Lounge', r: F7.lounge, floor: 'carpet' },
    { id: 'lounge2', name: 'Private Lounge', r: F7.lounge2, floor: 'carpet' },
    { id: 'yoga', name: 'Yoga Room', r: F7.yoga, floor: 'wood' },
    { id: 'balcony', name: 'Balcony', r: F7.balcony, floor: 'deck' },
  ],
  doors: [[6, 9], [12, 3], [20, 3], [16, 6], [12, 11], [20, 9.5], [16, 13], [12, 16.5], [22, 16.5], [25, 13], [24, 6]],
  props: [
    ...bedroomKit(F7.bed, 'n', { bed: '#f6e9ef', accent: '#d8b45a', frame: '#efe3dc', rug: '#efe4d6', posters: ['flower', 'abstract'], canopy: true }),
    P('chandelier', 6, 5, 0, { r: 1.0, y: 2.8 }), P('armchair', 1.4, 7.6, 0.7, { color: '#f6e9ef' }), P('floorlamp', 10.8, 7.8, 0), P('plant', 11.3, 0.6, 0, { kind: 'tall', seed: 2 }),
    P('label', 6, 7.9, 0, { text: "Milla's Bedroom" }),
    ...wardrobeKit(F7.ward, 'n', ['#d7263d', '#ffffff', '#f6e9ef', '#d8b45a', '#111', '#c9a4ff']), on(F7.ward, 's', 0.3, 0.35, 'mirror'),
    P('bathtub', 24, 3.4, 0), on(F7.ens, 'n', 0.25, 0.52, 'sink', { w: 1.8 }), on(F7.ens, 'e', 0.25, 0.7, 'toilet'), P('candles', 26.8, 5.2, 0),
    on(F7.ready, 'w', 0.4, 0.5, 'vanity'), on(F7.ready, 'e', 0.4, 0.5, 'vanity', { color: '#f6e9ef' }), P('mirror', 16, 12.5, Math.PI), P('rug', 16, 9.5, 0, { round: true, w: 3, color: '#ffd6e7' }),
    label(F7.ready, 'Getting Ready Room', 0.28),
    P('sectional', 5.5, 15.6, Math.PI, { w: 3.2, color: '#f6e9ef', accent: '#d8b45a' }), on(F7.lounge, 'w', 0.55, 0.45, 'tv', { w: 2.2 }), P('coffeetable', 4, 15, 0, { w: 1.3, round: true }),
    P('rug', 4.5, 15, 0, { w: 5, d: 4, color: '#efe4d6' }), P('plant', 11.3, 19.3, 0, { kind: 'tall', seed: 3 }), P('floorlamp', 0.6, 19.4, 0), label(F7.lounge, 'Lounge', -0.38),
    P('sofa', 24, 12.3, Math.PI, { w: 2.6, color: '#efe7dd', accent: '#d8b45a' }), P('coffeetable', 24, 10.4, 0, { w: 1, round: true }), label(F7.lounge2, 'Private Lounge', -0.32),
    ...[13.5, 15.5, 17.5, 19.5].map((x, i) => P('yogamat', x, 17, 0, { color: ['#b9a2e8', '#f6a6c8', '#bfe3f2', '#ffd36e'][i] })), on(F7.yoga, 'n', 0.5, 0.06, 'mirror'),
    P('plant', 12.6, 19.4, 0, { seed: 6 }), P('plant', 21.4, 19.4, 0, { seed: 7 }), label(F7.yoga, 'Yoga Room', 0.42),
    P('sunbed', 26.6, 17, 0, { color: '#ffffff', towel: '#d8b45a' }), P('planter', 25, 19.5, Math.PI, { w: 2.4 }), label(F7.balcony, 'Balcony', -0.1),
  ],
  stations: [T('yoga', 16.5, 15.2), T('getready', 16, 7.4), T('outfit', 18.6, 3.6), T('cleanlounge', 8, 12), T('wardrobe', 13.4, 3.6)],
  lift: [27.75, 9.5, -Math.PI / 2],
  spawn: [25.4, 9.5],
};

// ===================================================================== Rooftop
const F8 = {
  deck: [0, 0, 34, 22] as Rect,
  change: [28, 0, 6, 6] as Rect,
  garden: [24, 15, 10, 7] as Rect,
};

const floor8: Layout = {
  id: 'f8', w: 34, d: 22, mood: 'golden', exterior: 'rail', wall: '#f5efe6', backdrop: 'city', storey: 8,
  rooms: [
    { id: 'deck', name: 'Rooftop', r: [0, 0, 28, 22], floor: 'deck' },
    { id: 'deck2', name: 'Rooftop', r: [28, 6, 6, 9], floor: 'deck' },
    { id: 'change', name: 'Bathroom & Changing', r: F8.change, floor: 'tile' },
    { id: 'garden', name: 'Rooftop Garden', r: F8.garden, floor: 'grass' },
  ],
  open: [['deck', 'deck2'], ['deck', 'garden'], ['deck2', 'garden']],
  doors: [[31, 6]],
  props: [
    P('cabana', 2.2, 2.2, 0, { color: '#ffffff', vip: true }), P('cabana', 6, 2.2, 0, { color: '#ffd6e7' }), P('cabana', 9.8, 2.2, 0, { color: '#bfe3f2' }),
    ...[14, 16, 18, 20, 22, 24].map((x, i) => P('sunbed', x, 2, 0, { color: '#ffffff', towel: ['#ff9fc4', '#7fd8ff', '#ffd36e'][i % 3] })),
    P('umbrella', 15, 4.2, 0), P('umbrella', 19, 4.2, 0, { color: '#ffd6e7' }), P('umbrella', 23, 4.2, 0, { color: '#bfe3f2' }),
    P('planter', 26.5, 1, 0, { w: 2.4 }),
    P('outdoorsofa', 4.5, 19.6, Math.PI, { w: 3 }), P('outdoorsofa', 1.2, 16.5, Math.PI / 2, { w: 2.4 }), P('coffeetable', 4.5, 17, 0, { w: 1.4 }),
    P('rug', 4.5, 17.2, 0, { w: 5.5, d: 4.2, color: '#efe4d6' }), P('bar', 11, 20.6, Math.PI, { w: 4 }),
    P('label', 4.5, 14.8, 0, { text: 'Rooftop Lounge', color: '#5a3b1e' }),
    P('hottub', 19, 17, 0, { r: 1.5 }), P('label', 14, 13.6, 0, { text: 'Infinity Pool', color: '#5a3b1e' }),
    on(F8.change, 'n', 0.3, 0.52, 'sink', { w: 1.4 }), on(F8.change, 'e', 0.6, 0.7, 'toilet'), on(F8.change, 'n', 0.8, 0.6, 'closet', { w: 1.2 }),
    ...[25, 27.5, 30, 32.5].map((x) => P('planter', x, 21.4, Math.PI, { w: 2 })), P('palm', 33, 16, 0, { h: 4 }), P('palm', 25, 15.8, 0, { h: 3.6, lean: -0.1 }),
    P('plant', 29, 18, 0, { kind: 'tall', s: 1.2, seed: 2 }), P('plant', 31.5, 18.5, 0, { s: 1.1, seed: 3 }), P('hedge', 28.5, 15.5, 0, { w: 3 }),
    P('label', 29, 20, 0, { text: 'Rooftop Garden', color: '#2f5a2a' }),
    P('palm', 0.8, 9, 0, { h: 4.2 }), P('palm', 0.8, 13, 0, { h: 3.6, lean: 0.12 }), P('palm', 27, 8, 0, { h: 4.4, lean: -0.08 }),
    P('waterslide', 26.6, 13.6, 0),
  ],
  stations: [
    T('infinity', 14, 13.3), T('tropical', 11, 19.2), T('sunbeds', 19, 5.6), T('garden', 27.5, 18.4), T('sunset', 3.5, 12),
    { kind: 'cabana', x: 2.2, z: 4.6 }, { kind: 'portal', x: 31, z: 12.5 }, { kind: 'slide', x: 26.6, z: 15.3 },
  ],
  lift: [33.75, 9, -Math.PI / 2],
  spawn: [31, 9],
  pools: [[3, 6, 22, 6]],
  tubs: [[19, 17, 1.5]],
};

// ===================================================================== 9th floor – Sky Arcade
const F9 = {
  hall: [0, 0, 24, 22] as Rect,
  prizes: [24, 0, 10, 7] as Rect,
  snack: [24, 7, 10, 9] as Rect,
  baths: [24, 16, 10, 6] as Rect,
};
const ARCADE_NAMES = ['STAR BLAST', 'KART RUSH', 'PAC DASH', 'ZOMBIE PARTY', 'PINBALL', 'SPACE GIRL', 'DRIFT KING', 'NEON RUN', 'BEAT BOX', 'GALAXY', 'SKY RACER', 'PONG', 'CANDY POP', 'ROBO BRAWL'];
const floor9: Layout = {
  id: 'f9', w: 34, d: 22, mood: 'moody', exterior: 'glass', wall: '#2a2340', backdrop: 'city', storey: 9,
  rooms: [
    { id: 'hall', name: 'Sky Arcade', r: F9.hall, floor: 'carpet', tint: '#3a2c6e', wall: '#2a2340' },
    { id: 'prizes', name: 'Prize Corner', r: F9.prizes, floor: 'pinkcarpet', wall: '#ffd9ef' },
    { id: 'snack', name: 'Slushie Bar', r: F9.snack, floor: 'tile', tint: '#fff0f7', wall: '#ffe6f3' },
    { id: 'baths', name: 'Bathrooms', r: F9.baths, floor: 'tile' },
  ],
  doors: [[24, 3.5], [24, 11.5], [29, 7], [31.5, 16]],
  props: [
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => P('arcade', 1.2 + i * 1.05, 0.55, 0, { seed: i, text: ARCADE_NAMES[i] })),
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => P('arcade', 0.55, 3.6 + i * 1.05, Math.PI / 2, { seed: i + 9, text: ARCADE_NAMES[(i + 9) % ARCADE_NAMES.length] })),
    P('claw', 12.8, 0.8, 0, { color: '#ff6fb5' }), P('claw', 14.4, 0.8, 0, { color: '#33e1ff' }), P('claw', 16, 0.8, 0, { color: '#ffd23f' }),
    P('airhockey', 7, 14, 0), P('airhockey', 11, 14, 0, { color: '#5a1f5c' }),
    P('dancepad', 19, 20.9, Math.PI), P('dancepad', 21.6, 20.9, Math.PI),
    P('rug', 4, 18.5, 0, { w: 4.5, d: 3, color: '#ff3df0' }), P('beanbag', 2.6, 18.2, 0.4, { color: '#33e1ff' }), P('beanbag', 4.2, 19.6, -0.2, { color: '#ffd23f' }), P('beanbag', 5.6, 18, 0.3, { color: '#ff6fb5' }),
    P('discoball', 12, 9), P('discoball', 18, 6),
    on(F9.hall, 's', 0.32, 0.05, 'neon', { text: 'SKY ARCADE', color: '#33e1ff', w: 4.5 }), on(F9.hall, 'n', 0.83, 0.05, 'neon', { text: 'WIN!', color: '#ff3df0', w: 2 }),
    label(F9.hall, 'Sky Arcade', 0.05),
    P('prizes', 29, 1.6, 0, { w: 3.6 }), label(F9.prizes, 'Prize Corner', 0.2),
    P('bar', 28.5, 13.8, Math.PI, { w: 3, color: '#ff6fb5' }), P('minifridge', 25, 15.4, Math.PI), P('plant', 33.3, 15.4, 0, { seed: 4 }), label(F9.snack, 'Slushie Bar', -0.35),
    on(F9.baths, 's', 0.2, 0.7, 'toilet'), on(F9.baths, 's', 0.4, 0.7, 'toilet'), on(F9.baths, 's', 0.72, 0.52, 'sink', { w: 2 }), label(F9.baths, 'Bathrooms', -0.25),
  ],
  stations: [T('clawgame', 14.4, 2.6), T('dancebattle', 20.3, 19.3), T('airhockey', 9, 14), T('tickets', 12, 6.5), T('slushie', 28.5, 12.1)],
  lift: [33.75, 11.5, -Math.PI / 2],
  spawn: [31, 11.5],
};

// ===================================================================== 10th floor – Cinema & Bowling
const F10 = {
  cinema: [0, 0, 16, 22] as Rect,
  bowl: [16, 0, 18, 13] as Rect,
  baths: [16, 13, 5, 9] as Rect,
  lobby: [21, 13, 13, 9] as Rect,
};
const floor10: Layout = {
  id: 'f10', w: 34, d: 22, mood: 'moody', exterior: 'glass', wall: '#30202a', backdrop: 'city', storey: 10,
  rooms: [
    { id: 'cinema', name: 'Private Cinema', r: F10.cinema, floor: 'carpet', tint: '#6a1a2c', wall: '#2a1a22' },
    { id: 'bowl', name: 'Glow Bowling', r: F10.bowl, floor: 'darkwood', wall: '#1f1b2e' },
    { id: 'baths', name: 'Bathrooms', r: F10.baths, floor: 'tile' },
    { id: 'lobby', name: 'Lobby', r: F10.lobby, floor: 'terrazzo', tint: '#f3e6da' },
  ],
  doors: [[16, 10.5], [26, 13], [31, 13], [21, 17.5]],
  props: [
    P('cinemascreen', 0.35, 10.5, Math.PI / 2, { w: 9, text: '✨ MAGGAKES MOVIES ✨' }),
    ...[5, 7, 9, 11].map((x, i) => P('cinemaseats', x, 10.5, -Math.PI / 2, { n: 7, color: i === 3 ? '#d4af37' : '#b5122b' })),
    P('popcorn', 14.9, 2, -Math.PI / 2), P('plant', 15.2, 21.2, 0, { kind: 'tall', seed: 6 }), P('plant', 15.2, 0.8, 0, { seed: 2 }),
    on(F10.cinema, 's', 0.5, 0.05, 'neon', { text: 'NOW SHOWING', color: '#ffd23f', w: 4 }), label(F10.cinema, 'Private Cinema', 0.4),
    ...[17.6, 19.6, 21.6, 23.6, 25.6].map((x, i) => P('bowlinglane', x, 4.6, 0, { l: 8.5, seed: i, color: ['#33e1ff', '#ff3df0', '#7cff6b', '#ffd23f', '#b388ff'][i], ball: ['#ff3df0', '#33e1ff', '#ffd23f', '#7cff6b', '#ff7a1a'][i] })),
    P('ballreturn', 18.6, 10.3, 0, { seed: 1 }), P('ballreturn', 24.6, 10.3, 0, { seed: 3 }),
    P('counter', 32.9, 5, -Math.PI / 2, { w: 3, color: '#2a2b33' }), P('stand', 30, 1, 0),
    P('sofa', 30, 11.9, Math.PI, { w: 2.6, color: '#33e1ff', accent: '#ff3df0' }),
    on(F10.bowl, 'n', 0.88, 0.05, 'neon', { text: 'STRIKE!', color: '#ff3df0', w: 3 }), label(F10.bowl, 'Glow Bowling', 0.35),
    P('popcorn', 24, 21.3, Math.PI), P('sofa', 29.5, 21.3, Math.PI, { w: 2.4, color: '#b5122b' }), P('plant', 33.3, 21.3, 0, { kind: 'tall', seed: 1 }), label(F10.lobby, 'Lobby', -0.1),
    on(F10.baths, 's', 0.3, 0.7, 'toilet'), on(F10.baths, 'n', 0.45, 0.52, 'sink', { w: 1.4 }), label(F10.baths, 'Bathrooms', 0.1),
  ],
  stations: [T('strike', 21.6, 11), T('popcorn', 24, 19.8), T('tidycinema', 8, 18.5), T('movietrivia', 13.5, 4.5), T('shoes', 31, 5)],
  lift: [33.75, 17.5, -Math.PI / 2],
  spawn: [31, 17.5],
};

// ===================================================================== 11th floor – Ice Rink & Snow Lounge
const F11 = {
  rink: [0, 0, 22, 22] as Rect,
  lounge: [22, 0, 12, 15] as Rect,
  baths: [22, 15, 12, 7] as Rect,
};
const floor11: Layout = {
  id: 'f11', w: 34, d: 22, mood: 'day', exterior: 'glass', wall: '#eef6fb', backdrop: 'city', storey: 11, snow: true,
  rooms: [
    { id: 'rink', name: 'Ice Rink', r: F11.rink, floor: 'marble', tint: '#c4e6fb', wall: '#e8f6ff' },
    { id: 'lounge', name: 'Snow Lounge', r: F11.lounge, floor: 'carpet', tint: '#f1e2d3', wall: '#f7efe6' },
    { id: 'baths', name: 'Bathrooms', r: F11.baths, floor: 'tile' },
  ],
  doors: [[22, 8.5], [22, 18.5], [32, 15]],
  props: [
    P('rinkboard', 11, 2, 0, { w: 18 }), P('rinkboard', 11, 20, 0, { w: 18 }), P('rinkboard', 2, 11, Math.PI / 2, { w: 18 }),
    P('rinkboard', 20, 4.25, Math.PI / 2, { w: 4.5 }), P('rinkboard', 20, 15.75, Math.PI / 2, { w: 8.5 }),
    P('igloo', 16, 16, -Math.PI / 4, { r: 1.5 }), P('snowman', 4.2, 4.2, 0.6), P('snowman', 1, 1, 0.7, { s: 0.8, scarf: '#33a8ff' }),
    P('pine', 1, 21, 0, { h: 3, lights: true }), P('pine', 21, 21, 0, { h: 3.2, lights: true, star: true }), P('pine', 21, 1, 0, { h: 2.8 }),
    on(F11.rink, 'n', 0.5, 0.05, 'neon', { text: 'ICE RINK', color: '#33a8ff', w: 3 }), label(F11.rink, 'Ice Rink', 0.1),
    on(F11.lounge, 'n', 0.45, 0.7, 'fireplace', { w: 2.2 }), P('rug', 27.4, 4.2, 0, { w: 4, d: 3, color: '#ffffff' }),
    P('sofa', 27.4, 5.6, Math.PI, { w: 2.6, color: '#f2e6da', accent: '#ff3d5a', accent2: '#ffffff' }), P('armchair', 24.4, 3.8, Math.PI / 2, { color: '#ff3d5a' }),
    P('pine', 23.2, 1.2, 0, { h: 2.6, lights: true, star: true }), P('hotchoc', 28, 14.2, Math.PI, { w: 2.4 }), P('plant', 33.3, 13.8, 0, { seed: 3 }),
    label(F11.lounge, 'Snow Lounge', 0.25),
    on(F11.baths, 's', 0.15, 0.7, 'toilet'), on(F11.baths, 's', 0.3, 0.7, 'toilet'), on(F11.baths, 's', 0.6, 0.52, 'sink', { w: 2 }), label(F11.baths, 'Bathrooms', -0.2),
  ],
  stations: [T('skate', 11, 11), T('buildsnowman', 5.6, 6), T('hotchoc', 28, 12.6), T('snowflakes', 14, 6), T('icedance', 7.5, 14.5)],
  lift: [33.75, 8, -Math.PI / 2],
  spawn: [31, 8],
  ice: [[2.2, 2.2, 17.6, 17.6]],
};

// ===================================================================== 12th floor – Penthouse Sky Club
const F12 = {
  club: [0, 0, 20, 15] as Rect,
  lounge: [0, 15, 20, 7] as Rect,
  deck: [20, 0, 14, 22] as Rect,
};
const floor12: Layout = {
  id: 'f12', w: 34, d: 22, mood: 'golden', exterior: 'rail', wall: '#f5efe6', backdrop: 'city', storey: 13,
  rooms: [
    { id: 'club', name: 'Sky Club', r: F12.club, floor: 'marble', wall: '#f8f1e8' },
    { id: 'lounge', name: 'Star Lounge', r: F12.lounge, floor: 'carpet', tint: '#3a3160', wall: '#2a2340' },
    { id: 'deck', name: 'Helipad Deck', r: F12.deck, floor: 'concrete', tint: '#9aa0a8' },
  ],
  doors: [[20, 7.5], [10, 15], [20, 18.5]],
  props: [
    P('grandpiano', 4, 4, Math.PI / 4), P('chandelier', 10, 7.5, 0, { r: 1.2, y: 2.4 }), P('chandelier', 4.5, 10, 0), P('chandelier', 15.5, 4, 0),
    P('champagne', 14.5, 7.5, 0), P('djbooth', 10, 0.75, 0, { color: '#d4af37' }),
    P('sectional', 15, 12.6, Math.PI, { w: 3.2, color: '#ffffff', accent: '#d4af37' }), P('coffeetable', 14.6, 11, 0, { w: 1.4 }),
    P('bar', 1.1, 10, Math.PI / 2, { w: 4, color: '#1b1c1f' }),
    P('viprope', 18.6, 5.5, Math.PI / 2, { w: 1.6 }), P('viprope', 18.6, 9.5, Math.PI / 2, { w: 1.6 }),
    P('statue', 19.2, 0.8, 0), P('plant', 0.8, 0.8, 0, { kind: 'tall', seed: 7 }),
    on(F12.club, 'n', 0.25, 0.05, 'neon', { text: 'SKY CLUB', color: '#ffd23f', w: 3.2 }), label(F12.club, 'Penthouse Sky Club', 0.05),
    P('telescope', 10, 21.2, Math.PI), P('beanbag', 5, 18.5, 0, { color: '#b388ff' }), P('beanbag', 15, 18.5, 0, { color: '#33e1ff' }),
    P('sofa', 2, 18.5, Math.PI / 2, { w: 2.4, color: '#2a2340', accent: '#ffd23f' }), label(F12.lounge, 'Star Lounge', 0.05),
    P('helipad', 27, 8, 0, { r: 3.4 }), P('helicopter', 27, 8, 0.6, { color: '#ffffff', accent: '#ff3df0' }),
    ...[23.5, 25.5].map((x) => P('sunbed', x, 20.6, Math.PI, { color: '#ffffff', towel: '#ffd23f' })), P('umbrella', 24.5, 18.6, 0, { color: '#d4af37' }),
    P('planter', 21.3, 0.7, 0, { w: 2 }), label(F12.deck, 'Helipad', 0.25),
  ],
  stations: [T('grandpiano', 6, 6.4), T('stargaze', 10, 19.4), T('vipparty', 9, 11), T('landheli', 27, 13.4), T('skyphoto', 30, 2)],
  lift: [33.75, 18, -Math.PI / 2],
  spawn: [31, 18],
};

// ===================================================================== Car park
const park: Layout = {
  id: 'park', w: 46, d: 40, mood: 'garage', exterior: 'none', wall: '#c9cbcf', backdrop: 'tower', storey: 0,
  rooms: [
    { id: 'garage', name: 'Underground Car Park', r: [0, 0, 32, 14], floor: 'concrete' },
    { id: 'wash', name: 'Car Wash / Detailing', r: [32, 0, 14, 8], floor: 'concrete', tint: '#9aa3ad' },
    { id: 'storage', name: 'Storage Room', r: [38, 8, 8, 6], floor: 'concrete' },
    { id: 'ramp', name: 'Ramp', r: [32, 8, 6, 6], floor: 'concrete' },
    { id: 'drive', name: 'Estate Drive', r: [0, 14, 46, 26], floor: 'grass' },
  ],
  open: [['garage', 'wash'], ['garage', 'ramp'], ['ramp', 'wash'], ['garage', 'drive'], ['ramp', 'drive']],
  doors: [[42, 8]],
  props: [
    ...[6, 12, 18, 24].map((x) => P('pillar', x, 7.2, 0)),
    P('carwash', 39, 4, 0), P('storage', 42, 13.3, Math.PI), P('storage', 39.5, 9.6, 0),
    P('label', 16, 12.4, 0, { text: 'Underground Car Park', color: '#30343a' }), P('label', 39, 7, 0, { text: 'Car Wash / Detailing', color: '#30343a' }),
    ...[2, 8, 14, 20, 26, 32, 38, 44].map((x, i) => P('palm', x, 38.8, 0, { h: 4 + (i % 3) * 0.6, lean: (i % 2 ? 1 : -1) * 0.08 })),
    ...[1, 45].flatMap((x) => [18, 24, 30, 36].map((z) => P('palm', x, z, 0, { h: 4.2, lean: x < 20 ? 0.1 : -0.1 }))),
    P('hedge', 23, 27, 0, { w: 8, h: 0.8 }), P('plant', 23, 27, 0, { kind: 'tall', s: 1.6, seed: 4 }),
    P('gantry', 23, 17.75, Math.PI / 2, { w: 5.4 }),
    ...[[38.3, 20.7], [38.3, 31.8], [7.7, 31.8], [7.7, 20.7], [30, 20.6], [16, 20.6], [30, 31.9], [16, 31.9]].map(([x, z]) => P('cone', x, z, 0)),
  ],
  stations: [{ kind: 'garage', x: 16, z: 9.5 }, { kind: 'carwash', x: 39, z: 6 }, { kind: 'race', x: 19.5, z: 15.4 }, { kind: 'roadtrip', x: 30, z: 15.4 }],
  race: { start: [21, 17.75, Math.PI / 2], checkpoints: [[41.25, 17.75], [41.25, 34.75], [4.75, 34.75], [4.75, 17.75], [23, 17.75]] },
  lift: [2, 0.25, 0],
  spawn: [2, 3],
};

// ===================================================================== Love Island villa
const V = {
  bedroom: [14, 0, 18, 11] as Rect,
  dressing: [32, 0, 8, 11] as Rect,
  kitchen: [40, 0, 10, 11] as Rect,
  hut: [2, 2, 7, 7] as Rect,
  hideaway: [46, 15, 9, 9] as Rect,
};
const ring = (cx: number, cz: number, r: number, n: number, t: string, o: Record<string, unknown> = {}, face = true) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return P(t, cx + Math.cos(a) * r, cz + Math.sin(a) * r, face ? -a - Math.PI / 2 : 0, o);
  });

const villa: Layout = {
  id: 'villa', w: 56, d: 44, mood: 'golden', exterior: 'none', wall: '#fbf3ee', backdrop: 'ocean', storey: 0,
  rooms: [
    { id: 'lawn', name: 'Villa Lawn', r: [0, 0, 56, 36], floor: 'grass' },
    { id: 'beach', name: 'Beach', r: [0, 36, 56, 8], floor: 'sand' },
    { id: 'terrace', name: 'Terrace', r: [14, 11, 36, 4], floor: 'stone', tint: '#e8dccb' },
    { id: 'deck', name: 'Pool Deck', r: [14, 15, 30, 15], floor: 'stone' },
    { id: 'firepit', name: 'Firepit', r: [1, 16, 12, 13], floor: 'terrazzo', tint: '#e6d6c4' },
    { id: 'arena', name: 'Challenge Arena', r: [44, 26, 11, 10], floor: 'terrazzo', tint: '#3a3446' },
    { id: 'gym', name: 'Outdoor Gym', r: [50, 1, 6, 10], floor: 'rubber' },
    { id: 'bedroom', name: 'The Bedroom', r: V.bedroom, floor: 'wood', tint: '#d9bf9e', wall: '#ffe3ec' },
    { id: 'dressing', name: 'Dressing Room', r: V.dressing, floor: 'pinkcarpet', wall: '#fff0f5' },
    { id: 'kitchen', name: 'Kitchen & Lounge', r: V.kitchen, floor: 'terrazzo', wall: '#f4fbf8' },
    { id: 'hut', name: 'The Beach Hut', r: V.hut, floor: 'wood', tint: '#b98a5c', wall: '#ffd9e8' },
    { id: 'hideaway', name: 'The Hideaway', r: V.hideaway, floor: 'darkwood', wall: '#2d2238' },
  ],
  open: [['lawn', 'beach'], ['lawn', 'terrace'], ['lawn', 'deck'], ['terrace', 'deck'], ['lawn', 'firepit'], ['lawn', 'arena'], ['lawn', 'gym'], ['deck', 'firepit']],
  doors: [[19, 11], [27, 11], [32, 5.5], [36, 11], [40, 5.5], [45, 11], [5.5, 9], [46, 19.5]],
  props: [
    // The famous bedroom
    ...[15.6, 18.4, 21.2, 24.8, 27.6, 30.4].map((x, i) => P('bed', x, 1.35, 0, { w: 1.6, color: ['#ffffff', '#ffd6e7', '#fff3d6'][i % 3], accent: '#ff3d7f', pillow: '#ffffff', frame: '#f6e9ef' })),
    P('neon', 23, 0.08, 0, { text: '♥', color: '#ff2d75', w: 1.4, y: 2.1 }),
    P('neon', 23, 10.9, Math.PI, { text: 'Good Vibes Only', color: '#ff7ab8', w: 3.4, y: 2.1 }),
    P('rug', 23, 6.5, 0, { w: 9, d: 3, color: '#ffd6e7' }), P('beanbag', 16.2, 9.6, 0.5, { color: '#ff6f91' }), P('beanbag', 29.8, 9.6, -0.5, { color: '#ffffff' }),
    P('fairylights', 14.5, 6, Math.PI / 2), P('plant', 31.4, 6, 0, { kind: 'tall', seed: 3 }), P('label', 23, 8.5, 0, { text: 'The Bedroom', color: '#8a3a5a' }),
    // Dressing room
    on(V.dressing, 'e', 0.3, 0.5, 'vanity'), on(V.dressing, 'e', 0.72, 0.5, 'vanity', { color: '#ffd6e7' }),
    on(V.dressing, 'n', 0.5, 0.65, 'rack', { w: 5, colors: ['#ff7aa8', '#e8b7c8', '#d9c7ff', '#fff1c9', '#ffffff', '#111'] }),
    on(V.dressing, 'w', 0.75, 0.35, 'mirror'), P('rug', 36, 7, 0, { round: true, w: 2.6, color: '#ffc2d4' }), P('label', 36, 9.8, 0, { text: 'Dressing Room', color: '#8a3a5a' }),
    // Kitchen & lounge
    on(V.kitchen, 'n', 0.5, 0.66, 'counter', { w: 7 }), P('island', 45, 4.6, 0, { w: 3.2, stool: '#ff6f91' }),
    P('sofa', 45, 9.4, Math.PI, { w: 3, color: '#ffffff', accent: '#ff6f91', accent2: '#4fd1c5' }), P('plant', 49.3, 10.3, 0, { seed: 4 }),
    P('label', 45, 7.3, 0, { text: 'Kitchen & Lounge', color: '#2f5a4a' }),
    // Terrace
    ...[16, 18.5, 41.5, 44].map((x, i) => P('eggchair', x, 12.9, 0, { color: '#ffffff', accent: ['#ff6f91', '#4fd1c5', '#ffd23f', '#ff6f91'][i] })),
    P('neon', 32, 11.1, 0, { text: '♥ THE VILLA ♥', color: '#ff4fa3', w: 4.6, y: 2.4 }),
    P('daybed', 24, 13.1, 0, { w: 2.4, accent: '#ff6f91' }), P('daybed', 36, 13.1, 0, { w: 2.4, accent: '#4fd1c5' }),
    // Pool deck
    P('flamingo', 22, 21, 0, { y: -0.12 }), P('flamingo', 33, 23.5, 1.4, { color: '#fff3b0', y: -0.12 }),
    ...[17, 20, 23, 33, 36, 39].map((x, i) => P('sunbed', x, 28.2, Math.PI, { color: '#ffffff', towel: ['#ff6f91', '#4fd1c5', '#ffd23f'][i % 3] })),
    P('umbrella', 28, 28.3, 0, { color: '#ff9fc4' }), P('umbrella', 41.5, 28, 0, { color: '#ffffff' }),
    P('hottub', 41, 18.5, 0, { r: 1.3 }),
    P('festoon', 28, 16.2, 0, { len: 26 }), P('festoon', 28, 29.4, 0, { len: 26 }),
    P('label', 28, 27.1, 0, { text: 'Pool Deck', color: '#5a3b1e' }),
    // Firepit
    P('firepit', 7, 22.5, 0), ...ring(7, 22.5, 3.4, 5, 'outdoorsofa', { w: 1.8, accent: '#ff6f91' }).filter((_, i) => i !== 0),
    ...ring(7, 22.5, 5.4, 8, 'tikitorch', {}, false), P('podium', 7, 17.6, 0),
    P('label', 7, 28, 0, { text: 'Firepit', color: '#5a3b1e' }),
    // Beach Hut (diary room)
    on(V.hut, 'n', 0.5, 0.8, 'hutchair', { color: '#ff3d7f' }), P('camera', 5.5, 6.4, Math.PI),
    on(V.hut, 'w', 0.4, 0.05, 'neon', { text: 'BEACH HUT', color: '#ff7ab8', w: 2.4, y: 2.1 }), P('plant', 8.3, 2.7, 0, { seed: 6 }),
    // Hideaway (stargazing date spot)
    on(V.hideaway, 'e', 0.5, 1.8, 'daybed', { w: 2.4, accent: '#c77dff' }), P('cushions', 49.5, 21.5, 0), P('telescope', 47.6, 16.5, 0.6),
    P('fairylights', 54.4, 16.2, -Math.PI / 2), P('lantern', 47, 23, 0), P('lantern', 54, 23.2, 0),
    on(V.hideaway, 'n', 0.5, 0.05, 'neon', { text: '♥', color: '#c77dff', w: 1.1, y: 2.0 }), P('label', 50.5, 18.2, 0, { text: 'The Hideaway', color: '#e9d7ff' }),
    // Challenge arena
    P('stage', 49.5, 34.3, Math.PI, { w: 9 }), P('speaker', 44.8, 34.6, Math.PI), P('speaker', 54.2, 34.6, Math.PI), P('discoball', 49.5, 30, 0),
    P('label', 49.5, 27.2, 0, { text: 'Challenge Arena', color: '#ffd6f7' }),
    // Outdoor gym
    P('bench', 53, 3, 0), P('dumbbells', 53, 9.6, Math.PI), P('bike', 51, 6, Math.PI / 2),
    // Beach
    P('volleynet', 38, 40, 0), P('arch', 28, 35.6, 0),
    ...[30.5, 25.5].flatMap((x) => [31, 33, 35].map((z) => P('lantern', x, z, 0, { h: 0.8 }))),
    ...[8, 11, 14, 17].map((x, i) => P('sunbed', x, 41.5, Math.PI, { color: '#fff3d6', towel: ['#ff9fc4', '#7fd8ff'][i % 2] })),
    P('umbrella', 12.5, 39.5, 0, { color: '#ff6f91' }), P('hammock', 50, 41, 0), P('surfboard', 21, 42.8, Math.PI, { color: '#ff9fc4' }),
    // Greenery
    ...[3, 9, 15, 33, 39, 45, 51].map((x, i) => P('palm', x, 35, 0, { h: 4.2 + (i % 3) * 0.7, lean: (i % 2 ? 1 : -1) * 0.1 })),
    ...[1, 55].flatMap((x) => [3, 13, 31].map((z, i) => P('palm', x, z, 0, { h: 4.5 + (i % 2), lean: x < 20 ? 0.12 : -0.12 }))),
    P('hedge', 11.5, 0.6, 0, { w: 4 }), P('hedge', 52.5, 13.5, 0, { w: 5 }), P('planter', 12, 13, Math.PI / 2, { w: 2.4 }),
    P('plant', 12.8, 29.4, 0, { kind: 'tall', s: 1.4, seed: 8 }), P('plant', 43.3, 29.4, 0, { kind: 'tall', s: 1.4, seed: 9 }),
  ],
  stations: [
    { kind: 'villa', id: 'dance', x: 49.5, z: 31.5 }, { kind: 'villa', id: 'coconut', x: 14, z: 38.5 },
    { kind: 'villa', id: 'quiz', x: 45, z: 7.3 }, { kind: 'villa', id: 'volley', x: 38, z: 38.2 },
    { kind: 'firepit', x: 11.6, z: 22.5 }, { kind: 'dress', x: 36, z: 5 }, { kind: 'beachhut', x: 5.5, z: 5.2 },
    { kind: 'hideaway', x: 50.5, z: 20 }, { kind: 'portal', x: 3, z: 40.5 },
  ],
  lift: [28, 33.2, Math.PI],
  spawn: [28, 31.5],
  pools: [[18, 18, 20, 8]],
  tubs: [[41, 18.5, 1.3]],
};

export const LAYOUTS: Record<FixedZone, Layout> = {
  b: basement, f1: floor1, f2: floor2, f3: floor3, f4: floor4, f5: floor5, f6: floor6, f7: floor7, f8: floor8,
  f9: floor9, f10: floor10, f11: floor11, f12: floor12, ...TOWER_LAYOUTS, ...OUTSIDE_LAYOUTS, park, villa, jp: penthouse,
};

// ===================================================================== Residence floors
// A new two-bedroom floor for every two approved newcomers.

let residences: Residence[] = [];
export function setResidences(r: Residence[]): void { residences = r; }
export function getResidences(): Residence[] { return residences; }

const THEMES = [
  { bed: '#bfe3f2', accent: '#4fd1c5', rug: '#e6f6fb', wall: '#eaf7fb', posters: ['beach', 'sunset'] },
  { bed: '#f7c6d9', accent: '#ff6f91', rug: '#ffe3ec', wall: '#fff0f5', posters: ['flower', 'star'] },
  { bed: '#c9b7ff', accent: '#ffd23f', rug: '#ece4ff', wall: '#f3eeff', posters: ['music', 'vinyl'] },
  { bed: '#2b6cff', accent: '#33e1ff', rug: '#d6e8ff', wall: '#e6efff', posters: ['ocean', 'sixseven'] },
  { bed: '#ffd36e', accent: '#ff9f1c', rug: '#fff3d6', wall: '#fff8e8', posters: ['sunset', 'abstract'] },
  { bed: '#141414', accent: '#ff3df0', rug: '#5c1a5e', wall: '#2a2236', posters: ['concert', 'star'] },
] as const;

// ---- Bedroom styles (wall colour, floor) chosen by each owner
let roomStyles: Record<string, RoomStyle> = {};
export function setRoomStyles(r: Record<string, RoomStyle>): void { roomStyles = { ...r }; }
export function setRoomStyle(owner: string, style: RoomStyle): void { roomStyles[owner] = style; }

/** Which floor + room someone's bedroom is. */
function ownerRoom(owner: string): { zone: ZoneId; room: string } | undefined {
  // A founder who moved to a residence floor lives there now.
  for (const res of residences) { const o = res.owners.find((x) => x.name === owner); if (o) return { zone: res.zone, room: o.room }; }
  const f = RESIDENTS.find((r) => r.name === owner);
  if (f) return { zone: f.home, room: f.room };
  return undefined;
}
export function roomOwnerZone(owner: string): ZoneId | undefined { return ownerRoom(owner)?.zone; }

export function getLayout(id: ZoneId): Layout {
  const base = baseLayout(id);
  const styled = Object.entries(roomStyles).map(([owner, st]) => ({ at: ownerRoom(owner), st })).filter((x) => x.at?.zone === id);
  if (!styled.length) return base;
  // "Empty my room": drop the built-in furniture inside those bedrooms (keep the name label).
  const emptied = styled.filter((x) => x.st.empty).map((x) => base.rooms.find((r) => r.id === x.at!.room)?.r).filter(Boolean) as Rect[];
  const inside = (x: number, z: number, r: Rect) => x > r[0] - 0.01 && x < r[0] + r[2] + 0.01 && z > r[1] - 0.01 && z < r[1] + r[3] + 0.01; // wall posters sit right on the edge
  return {
    ...base,
    props: emptied.length ? base.props.filter((p) => p.t === 'label' || !emptied.some((r) => inside(p.x, p.z, r))) : base.props,
    rooms: base.rooms.map((r) => {
      const hit = styled.find((x) => x.at!.room === r.id);
      if (!hit) return r;
      return { ...r, floor: (hit.st.floor as RoomDef['floor']) ?? r.floor, tint: hit.st.tint ?? (hit.st.floor ? undefined : r.tint), wall: hit.st.wall ?? r.wall };
    }),
  };
}

function baseLayout(id: ZoneId): Layout {
  if (!isResidence(id)) return LAYOUTS[id as FixedZone];
  const n = residenceNumber(id);
  const owners = residences.find((r) => r.zone === id)?.owners ?? [];
  const who = (room: string) => owners.find((o) => o.room === room)?.name;
  const ta = THEMES[(n * 2) % THEMES.length], tb = THEMES[(n * 2 + 1) % THEMES.length];
  const R = {
    a: [0, 0, 11, 10] as Rect, ward: [11, 0, 8, 14] as Rect, b: [19, 0, 11, 10] as Rect,
    aEns: [0, 10, 6, 8] as Rect, hall: [6, 10, 5, 8] as Rect, strip: [11, 14, 8, 4] as Rect, bEns: [19, 10, 6, 8] as Rect, lounge: [25, 10, 5, 8] as Rect,
  };
  const name = (room: string) => (who(room) ? `${who(room)}'s Bedroom` : 'Empty Bedroom');
  return {
    id, w: 30, d: 18, mood: n % 2 ? 'golden' : 'day', exterior: 'glass', wall: '#f7f1ec', backdrop: 'city', storey: 25 + n,
    rooms: [
      { id: 'a', name: name('a'), r: R.a, floor: 'carpet', tint: ta.rug, wall: ta.wall },
      { id: 'ward', name: 'Walk-in Wardrobe', r: R.ward, floor: 'wood' },
      { id: 'b', name: name('b'), r: R.b, floor: 'carpet', tint: tb.rug, wall: tb.wall },
      { id: 'aens', name: 'Ensuite', r: R.aEns, floor: 'tile' },
      { id: 'hall', name: 'Hall', r: R.hall, floor: 'marble' },
      { id: 'strip', name: 'Landing', r: R.strip, floor: 'marble' },
      { id: 'bens', name: 'Ensuite', r: R.bEns, floor: 'tile' },
      { id: 'lounge', name: 'Lounge', r: R.lounge, floor: 'wood' },
    ],
    open: [['hall', 'strip']],
    doors: [[8.5, 10], [3, 10], [11, 2.5], [19, 2.5], [22, 10], [27.5, 10], [15, 14], [25, 14]],
    props: [
      ...bedroomKit(R.a, 'n', { bed: ta.bed, accent: ta.accent, frame: '#f6efe8', rug: ta.rug, posters: [...ta.posters] }),
      P('label', 5.5, 8.2, 0, { text: name('a') }), P('plant', 10.4, 9.4, 0, { seed: n }),
      ...bedroomKit(R.b, 'n', { bed: tb.bed, accent: tb.accent, frame: '#f6efe8', rug: tb.rug, posters: [...tb.posters] }),
      P('label', 24.5, 8.2, 0, { text: name('b') }), P('plant', 19.6, 9.4, 0, { seed: n + 3 }),
      ...wardrobeKit(R.ward, 'w'), ...wardrobeKit(R.ward, 'e'), on(R.ward, 'n', 0.5, 0.35, 'mirror'),
      P('rug', 15, 7.5, 0, { round: true, w: 3, color: '#f3e6ee' }), P('label', 15, 12.4, 0, { text: `Residence ${n}` }),
      ...ensuiteKit(R.aEns, 's'), ...ensuiteKit(R.bEns, 's'),
      P('sofa', 27.5, 16.9, Math.PI, { w: 2.2, color: '#efe7dd', accent: tb.accent }), P('plant', 29.3, 10.7, 0, { seed: n + 5 }),
      P('plant', 6.6, 17.3, 0, { kind: 'tall', seed: 5 }), P('plant', 18.4, 17.3, 0, { kind: 'tall', seed: 6 }),
    ],
    stations: [],
    lift: [15, 17.75, Math.PI],
    spawn: [15, 15.6],
  };
}
