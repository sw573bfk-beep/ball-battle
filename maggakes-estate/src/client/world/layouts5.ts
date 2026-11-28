import { P, label, on, type PropDef, type Rect } from './kit';
import type { Layout, StationDef } from './layouts';
import { TOWER3, towerTasks, type TowerTheme } from '../../shared/tower3';
import type { ZoneId } from '../../shared/people';

/**
 * Floors 25–100, built from the themes in shared/tower3.ts. They share the tower frame
 * (a big main hall, two side rooms with the lift in the second, and bathrooms); each theme
 * sets the colours, the centrepiece, the corner props and the side rooms.
 */

const R = { main: [0, 0, 24, 22] as Rect, s1: [24, 0, 10, 8] as Rect, s2: [24, 8, 10, 8] as Rect, baths: [24, 16, 10, 6] as Rect };
const DOORS: [number, number][] = [[24, 4], [24, 12], [29, 8], [29, 16]];
/** Props that hang on a wall rather than stand on the floor. */
const WALL = new Set(['cinemascreen', 'bigtank', 'vinylwall', 'poster', 'goldsign', 'neon']);

const spec = (s: string, x: number, z: number, r: number, o: Record<string, unknown> = {}): PropDef => {
  const [t, color] = s.split('#');
  return P(t, x, z, r, color ? { ...o, color: '#' + color } : o);
};
const face = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);

function towerLayout(th: TowerTheme): Layout {
  const id = `f${th.n}` as ZoneId;
  const tasks = towerTasks(th);
  const cx = 12, cz = 11.5;
  const props: PropDef[] = [];
  // Centrepiece (wall pieces go on the north wall, with a rug in the middle instead).
  const [centre] = th.centre.split('#');
  if (WALL.has(centre)) {
    props.push(spec(th.centre, cx, 0.4, 0, centre === 'cinemascreen' || centre === 'bigtank' ? { w: 10 } : {}));
    props.push(P('rug', cx, cz, 0, { w: 8, d: 6, color: th.accent }));
  } else {
    props.push(spec(th.centre, cx, cz, 0));
  }
  // A coloured rug under the centrepiece (indoors, and not under water features).
  if (!th.open && !['koipond', 'fountain', 'waterfall', 'touchpool', 'igloo'].includes(centre) && !WALL.has(centre)) props.push(P('rug', cx, cz, 0, { w: 9, d: 7, color: th.accent }));
  // More of the theme along the north and south walls and the west wall, so the hall feels full.
  const more: [string, number, number, number][] = [
    [th.corners[2], 8.2, 2.4, 0], [th.corners[3], 15.8, 2.4, 0], [th.corners[0], 8.2, 19.6, Math.PI], [th.corners[1], 15.8, 19.6, Math.PI],
  ];
  for (const [p, x, z, r] of more) if (!WALL.has(p.split('#')[0])) props.push(spec(p, x, z, r));
  if (th.extra[1] && !WALL.has(th.extra[1].split('#')[0])) props.push(spec(th.extra[1], 1.8, 11.5, Math.PI / 2));
  // Corners, facing the middle.
  const corners: [number, number][] = [[3, 3], [21, 3], [3, 19], [21, 19]];
  th.corners.forEach((c, i) => { const [x, z] = corners[i]; props.push(spec(c, x, z, face(x, z, cx, cz))); });
  // Two extras: north and south.
  th.extra.forEach((e, i) => {
    const wall = WALL.has(e.split('#')[0]);
    props.push(spec(e, cx + (i === 0 ? 0 : 0), i === 0 ? (wall ? 0.1 : 2.6) : (wall ? 21.9 : 19.6), i === 0 ? 0 : Math.PI, wall ? { w: 2.6, text: `${th.name} ${th.emoji}` } : {}));
  });
  props.push(
    on(R.main, 'w', 0.5, 0.05, 'neon', { text: th.name.toUpperCase().slice(0, 18), color: th.accent, w: Math.min(5, 0.36 * th.name.length + 1) }),
    P('plant', 0.8, 0.8, 0, { seed: th.n }), P('plant', 23.2, 21.2, 0, { kind: 'tall', seed: th.n + 1 }),
    label(R.main, `${th.emoji} ${th.name}`, 0.36),
  );
  // Side rooms.
  th.s1.props.forEach((p, i) => props.push(spec(p, i === 0 ? 26.2 : 31.6, 1.6, 0)));
  props.push(label(R.s1, th.s1.name, 0.25));
  th.s2.props.forEach((p) => props.push(spec(p, 26.2, 10.4, Math.PI / 2)));
  props.push(label(R.s2, th.s2.name, 0.3));
  // Bathrooms.
  props.push(on(R.baths, 's', 0.2, 0.7, 'toilet'), on(R.baths, 's', 0.4, 0.7, 'toilet'), on(R.baths, 's', 0.72, 0.52, 'sink', { w: 2 }), label(R.baths, 'Bathrooms', -0.25));
  const slots: [number, number][] = [[6.5, 7], [17.5, 7], [6.5, 16], [17.5, 16], [29, 5.4]];
  const stations: StationDef[] = tasks.map((t, i) => ({ kind: 'task', id: t.id, x: slots[i][0], z: slots[i][1] }));
  const light = th.mood === 'moody' ? '#ece6f2' : '#f7f2ea';
  return {
    id, w: 34, d: 22, mood: th.mood, exterior: th.open ? 'rail' : 'glass', wall: '#f5efe6', backdrop: 'city', storey: th.n + 1,
    rooms: [
      { id: 'main', name: th.name, r: R.main, floor: th.floor, tint: th.tint, wall: th.wall },
      { id: 's1', name: th.s1.name, r: R.s1, floor: th.floor === 'grass' || th.floor === 'sand' ? 'deck' : 'wood', wall: light },
      { id: 's2', name: th.s2.name, r: R.s2, floor: 'terrazzo', wall: light },
      { id: 'baths', name: 'Bathrooms', r: R.baths, floor: 'tile' },
    ],
    doors: DOORS,
    props,
    stations,
    lift: [33.75, 12, -Math.PI / 2],
    spawn: [31, 12],
  };
}

export const TOWER3_LAYOUTS: Record<string, Layout> = Object.fromEntries(TOWER3.map((th) => [`f${th.n}`, towerLayout(th)]));
