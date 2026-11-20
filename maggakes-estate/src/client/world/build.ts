import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LAYOUTS, type Layout, type StationDef } from './layouts';
import { makeProp, mat, glass, box, cyl, glow, type Prop } from '../engine/props';
import { floorTexture, skylineTexture, textTexture, type FloorMat } from '../engine/tex';
import { waterMaterial, clearWater } from '../engine/gfx';
import type { ZoneId } from '../../shared/people';
import type { Rect } from './kit';

export interface Box2 { x0: number; z0: number; x1: number; z1: number }

export interface WallSeg {
  mesh: THREE.Object3D;
  ax: number; az: number; bx: number; bz: number;
  target: number;
}

export interface Zone {
  id: ZoneId;
  layout: Layout;
  root: THREE.Group;
  colliders: Box2[];
  walls: WallSeg[];
  pools: Box2[];
  tubs: { x: number; z: number; r: number }[];
  stations: (StationDef & { wx: number; wz: number })[];
  lift: { x: number; z: number; rot: number };
  spawn: { x: number; z: number };
  rooms: { id: string; name: string; box: Box2 }[];
  ticks: ((t: number, dt: number) => void)[];
  half: { w: number; d: number };
  /** Walkable test grid for spawning pickups. */
  walkable: (x: number, z: number, r?: number) => boolean;
}

const WALL_H = 3.0;
const ROUGH: Partial<Record<FloorMat, number>> = { marble: 0.12, tile: 0.25, wood: 0.42, darkwood: 0.38, terrazzo: 0.3, stone: 0.6, deck: 0.7, carpet: 0.95, pinkcarpet: 0.95, grass: 0.95, sand: 1, concrete: 0.8, rubber: 0.9 };

export function buildZone(id: ZoneId): Zone {
  clearWater();
  const L = LAYOUTS[id];
  const ox = -L.w / 2, oz = -L.d / 2;
  const root = new THREE.Group();
  const staticGroup = new THREE.Group();
  const colliders: Box2[] = [];
  const ticks: Zone['ticks'] = [];
  const lights: THREE.PointLight[] = [];
  const W = (x: number) => x + ox, Z = (z: number) => z + oz;

  const pools: Box2[] = (L.pools ?? []).map(([x, z, w, d]) => ({ x0: W(x), z0: Z(z), x1: W(x + w), z1: Z(z + d) }));

  // ---------------------------------------------------------------- floors
  for (const room of L.rooms) {
    const [x, z, w, d] = room.r;
    const shape = new THREE.Shape();
    shape.moveTo(W(x), -Z(z)); shape.lineTo(W(x + w), -Z(z)); shape.lineTo(W(x + w), -Z(z + d)); shape.lineTo(W(x), -Z(z + d)); shape.closePath();
    for (const p of pools) {
      if (p.x0 >= W(x) - 0.01 && p.x1 <= W(x + w) + 0.01 && p.z0 >= Z(z) - 0.01 && p.z1 <= Z(z + d) + 0.01) {
        const hole = new THREE.Path();
        hole.moveTo(p.x0, -p.z0); hole.lineTo(p.x0, -p.z1); hole.lineTo(p.x1, -p.z1); hole.lineTo(p.x1, -p.z0); hole.closePath();
        shape.holes.push(hole);
      }
    }
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4);
    const tex = floorTexture(room.floor, room.tint);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: ROUGH[room.floor] ?? 0.6, metalness: 0, envMapIntensity: room.floor === 'marble' ? 1.4 : 0.8 });
    const floor = new THREE.Mesh(geo, m);
    floor.receiveShadow = true;
    floor.position.y = 0;
    root.add(floor);
  }

  // ---------------------------------------------------------------- walls
  const walls: WallSeg[] = [];
  const RES = 0.5;
  const gw = Math.round(L.w / RES), gd = Math.round(L.d / RES);
  const grid = new Int16Array(gw * gd).fill(-1);
  L.rooms.forEach((room, idx) => {
    const [x, z, w, d] = room.r;
    for (let j = Math.round(z / RES); j < Math.round((z + d) / RES); j++) for (let i = Math.round(x / RES); i < Math.round((x + w) / RES); i++) {
      if (i >= 0 && j >= 0 && i < gw && j < gd) grid[j * gw + i] = idx;
    }
  });
  const cell = (i: number, j: number) => (i < 0 || j < 0 || i >= gw || j >= gd ? -1 : grid[j * gw + i]);
  const openPair = (a: number, b: number) => {
    if (a < 0 || b < 0) return false;
    const ia = L.rooms[a].id, ib = L.rooms[b].id;
    return (L.open ?? []).some(([p, q]) => (p === ia && q === ib) || (p === ib && q === ia));
  };
  const nearDoor = (x: number, z: number) => L.doors.some(([dx, dz]) => Math.abs(dx - x) + Math.abs(dz - z) < 1.01);
  type Edge = { a: number; b: number; x0: number; z0: number; x1: number; z1: number };
  const edges: Edge[] = [];
  // Horizontal edges (between rows j-1 and j) along x.
  for (let j = 0; j <= gd; j++) {
    let run: Edge | null = null;
    for (let i = 0; i <= gw; i++) {
      const a = i < gw ? cell(i, j - 1) : -2, b = i < gw ? cell(i, j) : -2;
      const x = i * RES, z = j * RES;
      const wall = i < gw && a !== b && !(a < 0 && b < 0) && !openPair(a, b) && !nearDoor(x + RES / 2, z);
      if (wall && run && run.a === a && run.b === b) { run.x1 = x + RES; continue; }
      if (run) { edges.push(run); run = null; }
      if (wall) run = { a, b, x0: x, z0: z, x1: x + RES, z1: z };
    }
  }
  for (let i = 0; i <= gw; i++) {
    let run: Edge | null = null;
    for (let j = 0; j <= gd; j++) {
      const a = j < gd ? cell(i - 1, j) : -2, b = j < gd ? cell(i, j) : -2;
      const x = i * RES, z = j * RES;
      const wall = j < gd && a !== b && !(a < 0 && b < 0) && !openPair(a, b) && !nearDoor(x, z + RES / 2);
      if (wall && run && run.a === a && run.b === b) { run.z1 = z + RES; continue; }
      if (run) { edges.push(run); run = null; }
      if (wall) run = { a, b, x0: x, z0: z, x1: x, z1: z + RES };
    }
  }

  const wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const exteriorGroup = new THREE.Group();
  for (const e of edges) {
    const exterior = e.a < 0 || e.b < 0;
    const horiz = e.z0 === e.z1;
    const len = horiz ? e.x1 - e.x0 : e.z1 - e.z0;
    const ax = W(e.x0), az = Z(e.z0), bx = W(e.x1), bz = Z(e.z1);
    if (exterior && L.exterior !== 'solid') {
      if (L.exterior === 'none') continue;
      const seg = exteriorWall(L.exterior, len, horiz);
      seg.position.set((ax + bx) / 2, 0, (az + bz) / 2);
      exteriorGroup.add(seg);
      const t = 0.12;
      colliders.push(horiz ? { x0: ax, z0: az - t, x1: bx, z1: az + t } : { x0: ax - t, z0: az, x1: ax + t, z1: bz });
      walls.push({ mesh: seg, ax, az, bx, bz, target: 1 });
      continue;
    }
    // Two-tone interior wall: each face takes the colour of the room it faces.
    const colA = e.a >= 0 ? L.rooms[e.a].wall ?? L.wall : L.wall;
    const colB = e.b >= 0 ? L.rooms[e.b].wall ?? L.wall : L.wall;
    const geo = twoToneWall(len, horiz, colA, colB, exterior && L.exterior === 'solid');
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set((ax + bx) / 2, 0, (az + bz) / 2);
    root.add(mesh);
    const t = 0.1;
    colliders.push(horiz ? { x0: ax, z0: az - t, x1: bx, z1: az + t } : { x0: ax - t, z0: az, x1: ax + t, z1: bz });
    walls.push({ mesh, ax, az, bx, bz, target: 1 });
  }
  root.add(exteriorGroup);
  // Door trims
  for (const [dx, dz] of L.doors) {
    const i = Math.floor(dx / RES), j = Math.round(dz / RES);
    const horizontalWall = Math.abs(dz / RES - j) < 1e-6 && cell(i, j - 1) !== cell(i, j);
    const g = new THREE.Group();
    for (const s of [-1, 1]) box(g, horizontalWall ? 0.08 : 0.18, 2.4, horizontalWall ? 0.18 : 0.08, mat('#ffffff', 0.4), horizontalWall ? s * 1.0 : 0, 0, horizontalWall ? 0 : s * 1.0);
    g.position.set(W(dx), 0, Z(dz));
    staticGroup.add(g);
  }

  // Invisible boundary for open-air zones
  if (L.exterior === 'none') {
    const t = 0.5;
    colliders.push({ x0: ox - t, z0: oz - t, x1: -ox + t, z1: oz }, { x0: ox - t, z0: -oz, x1: -ox + t, z1: -oz + t });
    colliders.push({ x0: ox - t, z0: oz, x1: ox, z1: -oz }, { x0: -ox, z0: oz, x1: -ox + t, z1: -oz });
  }

  // ---------------------------------------------------------------- pools
  for (const p of pools) {
    const pw = p.x1 - p.x0, pd = p.z1 - p.z0, depth = 1.6;
    const tile = new THREE.MeshStandardMaterial({ color: '#5cc4dc', roughness: 0.3 });
    const g = new THREE.Group();
    box(g, pw, 0.05, pd, tile, 0, -depth, 0);
    box(g, pw, depth, 0.05, tile, 0, -depth, -pd / 2);
    box(g, pw, depth, 0.05, tile, 0, -depth, pd / 2);
    box(g, 0.05, depth, pd, tile, -pw / 2, -depth, 0);
    box(g, 0.05, depth, pd, tile, pw / 2, -depth, 0);
    const coping = mat('#f4f1ec', 0.5);
    box(g, pw + 0.5, 0.05, 0.25, coping, 0, 0, -pd / 2 - 0.125);
    box(g, pw + 0.5, 0.05, 0.25, coping, 0, 0, pd / 2 + 0.125);
    box(g, 0.25, 0.05, pd, coping, -pw / 2 - 0.125, 0, 0);
    box(g, 0.25, 0.05, pd, coping, pw / 2 + 0.125, 0, 0);
    for (let i = 0; i < Math.floor(pw / 2.5); i++) {
      const l = box(g, 0.3, 0.12, 0.02, glow('#bff6ff', 2.5), -pw / 2 + 1.25 + i * 2.5, -0.9, -pd / 2 + 0.04);
      l.castShadow = false;
    }
    g.traverse((o) => { (o as THREE.Mesh).castShadow = false; });
    g.position.set((p.x0 + p.x1) / 2, 0, (p.z0 + p.z1) / 2);
    root.add(g);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), waterMaterial());
    water.rotation.x = -Math.PI / 2;
    water.position.set((p.x0 + p.x1) / 2, -0.14, (p.z0 + p.z1) / 2);
    water.renderOrder = 3;
    root.add(water);
  }

  // ---------------------------------------------------------------- props
  const addProp = (p: Prop, x: number, z: number, rot: number) => {
    p.obj.position.set(x, 0, z);
    p.obj.rotation.y = rot;
    if (p.tick || p.light) {
      root.add(p.obj);
      if (p.tick) ticks.push(p.tick);
      if (p.light && lights.length < 4) { p.obj.add(p.light); lights.push(p.light); }
    } else {
      staticGroup.add(p.obj);
    }
    if (p.solid) colliders.push(footprint(x, z, rot, p.solid.w, p.solid.d));
  };
  for (const pd of L.props) {
    addProp(makeProp(pd.t, pd.o), W(pd.x), Z(pd.z), pd.r);
  }
  if (id !== 'villa') {
    addProp(makeProp('lift', { text: id === 'park' ? 'LIFT' : 'LIFT' }), W(L.lift[0]), Z(L.lift[1]), L.lift[2]);
  }

  // ---------------------------------------------------------------- surroundings
  root.add(backdrop(L));

  root.add(staticGroup);
  mergeStatic(staticGroup);

  const zone: Zone = {
    id, layout: L, root, colliders, walls, pools,
    tubs: (L.tubs ?? []).map(([x, z, r]) => ({ x: W(x), z: Z(z), r })),
    stations: L.stations.map((s) => ({ ...s, wx: W(s.x), wz: Z(s.z) })),
    lift: { x: W(L.lift[0]), z: Z(L.lift[1]), rot: L.lift[2] },
    spawn: { x: W(L.spawn[0]), z: Z(L.spawn[1]) },
    rooms: L.rooms.map((r) => ({ id: r.id, name: r.name, box: { x0: W(r.r[0]), z0: Z(r.r[1]), x1: W(r.r[0] + r.r[2]), z1: Z(r.r[1] + r.r[3]) } })),
    ticks,
    half: { w: L.w / 2, d: L.d / 2 },
    walkable: (x, z, r = 0.35) => {
      if (Math.abs(x) > L.w / 2 - r || Math.abs(z) > L.d / 2 - r) return false;
      const i = Math.floor((x - ox) / RES), j = Math.floor((z - oz) / RES);
      if (cell(i, j) < 0) return false;
      for (const c of colliders) if (x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1) return false;
      for (const p of pools) if (x > p.x0 - 0.2 && x < p.x1 + 0.2 && z > p.z0 - 0.2 && z < p.z1 + 0.2) return false;
      return true;
    },
  };
  return zone;
}

/** Axis-aligned bounds of a rotated rectangle footprint. */
export function footprint(x: number, z: number, rot: number, w: number, d: number): Box2 {
  const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
  const hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2;
  return { x0: x - hw, z0: z - hd, x1: x + hw, z1: z + hd };
}

function twoToneWall(len: number, horiz: boolean, colA: string, colB: string, outerSolid: boolean): THREE.BufferGeometry {
  const t = outerSolid ? 0.12 : 0.07;
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, color: string) => {
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  };
  const side = (offset: number, color: string) => {
    const g = new THREE.BoxGeometry(horiz ? len : t, WALL_H, horiz ? t : len).toNonIndexed();
    g.translate(horiz ? 0 : offset, WALL_H / 2, horiz ? offset : 0);
    parts.push(paint(g, color));
    const sk = new THREE.BoxGeometry(horiz ? len : t + 0.02, 0.12, horiz ? t + 0.02 : len).toNonIndexed();
    sk.translate(horiz ? 0 : offset * 1.15, 0.06, horiz ? offset * 1.15 : 0);
    parts.push(paint(sk, '#ffffff'));
  };
  // Side A is the room on the -z (horizontal) / -x (vertical) side.
  side(-t / 2, colA);
  side(t / 2, colB);
  const cap = new THREE.BoxGeometry(horiz ? len : t * 2 + 0.02, 0.04, horiz ? t * 2 + 0.02 : len).toNonIndexed();
  cap.translate(0, WALL_H, 0);
  parts.push(paint(cap, '#e9e3dc'));
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

function exteriorWall(kind: 'glass' | 'rail', len: number, horiz: boolean): THREE.Group {
  const g = new THREE.Group();
  const frame = mat('#2c2f36', 0.35, 0.7);
  const h = kind === 'glass' ? WALL_H : 1.1;
  const pane = box(g, horiz ? len : 0.03, h, horiz ? 0.03 : len, glass(kind === 'glass' ? '#bfe0f5' : '#dff2ff', kind === 'glass' ? 0.14 : 0.18), 0, 0, 0);
  pane.castShadow = false;
  box(g, horiz ? len : 0.1, 0.08, horiz ? 0.1 : len, frame, 0, h - 0.08, 0);
  box(g, horiz ? len : 0.12, 0.1, horiz ? 0.12 : len, frame, 0, 0, 0);
  const n = Math.max(1, Math.round(len / 1.5));
  for (let i = 0; i <= n; i++) {
    const p = -len / 2 + (i / n) * len;
    const m = box(g, horiz ? 0.05 : 0.08, h, horiz ? 0.08 : 0.05, frame, horiz ? p : 0, 0, horiz ? 0 : p);
    m.castShadow = kind === 'glass';
  }
  return g;
}

function backdrop(L: Layout): THREE.Group {
  const g = new THREE.Group();
  const big = Math.max(L.w, L.d);
  if (L.backdrop === 'city' || L.backdrop === 'tower') {
    const drop = L.backdrop === 'city' ? L.storey * 3.6 + 1 : -0.56;
    // Slab + tower body under the floor
    if (L.backdrop === 'city') {
      box(g, L.w + 0.6, 0.5, L.d + 0.6, mat('#e9e4dc', 0.6), 0, -0.5, 0);
      const body = box(g, L.w + 0.2, drop, L.d + 0.2, mat('#3a4656', 0.15, 0.6), 0, -drop - 0.5, 0);
      body.castShadow = false;
      for (let i = 1; i <= L.storey; i++) box(g, L.w + 0.4, 0.25, L.d + 0.4, mat('#e9e4dc', 0.6), 0, -i * 3.6 - 0.4, 0);
    }
    const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 48), mat('#7d9a6a', 0.95));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -drop - 0.6;
    ground.receiveShadow = true;
    g.add(ground);
    const sea = new THREE.Mesh(new THREE.CircleGeometry(700, 48), new THREE.MeshStandardMaterial({ color: '#2b7bb9', roughness: 0.15, metalness: 0.2 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -drop - 0.9, 0);
    g.add(sea);
    if (L.backdrop === 'city') ground.position.z = -60;
    // City blocks around (simple boxes with emissive windows)
    const rnd = seeded(L.storey + 3);
    const towerMat = [mat('#c9d3dd', 0.2, 0.5), mat('#9fb3c8', 0.2, 0.5), mat('#e8e2d8', 0.5, 0.1), mat('#59687a', 0.2, 0.6)];
    for (let i = 0; i < 60; i++) {
      const a = rnd() * Math.PI * 2 * 0.7 + Math.PI * 0.65;
      const r = big + 25 + rnd() * 140;
      const h = 8 + rnd() * 70;
      const w = 6 + rnd() * 14;
      const m = box(g, w, h, w, towerMat[i % 4], Math.cos(a) * r, -drop - 0.6, Math.sin(a) * r);
      m.castShadow = false;
    }
    const sky = new THREE.Mesh(new THREE.CylinderGeometry(320, 320, 70, 64, 1, true), new THREE.MeshBasicMaterial({ map: skylineTexture(false), transparent: true, side: THREE.BackSide, depthWrite: false, fog: false, opacity: 0.85 }));
    sky.position.y = -drop + 25;
    g.add(sky);
    if (L.backdrop === 'tower') {
      // The mansion itself, towering over the car park.
      const tower = new THREE.Group();
      const tw = 30, td = 20;
      for (let f = 0; f < 9; f++) {
        const y = 3.4 + f * 3.6;
        const body = box(tower, tw, 3.2, td, glass('#8fb8d8', 0.85), 0, y, 0);
        body.castShadow = false;
        box(tower, tw + 0.6, 0.4, td + 0.6, mat('#f2ede6', 0.5), 0, y - 0.4, 0);
        for (let i = 0; i < 8; i++) {
          const win = box(tower, 2.4, 1.8, 0.05, glow(i % 3 === 0 ? '#ffe2a8' : '#cfe6ff', 0.5), -tw / 2 + 2.5 + i * 3.6, y + 0.6, td / 2 + 0.03);
          win.castShadow = false;
        }
      }
      box(tower, tw + 0.6, 0.4, td + 0.6, mat('#f2ede6', 0.5), 0, 3.4 + 9 * 3.6 - 0.4, 0);
      for (const x of [-10, 0, 10]) { const p = makeProp('palm', { h: 3 }); p.obj.position.set(x, 3.4 + 9 * 3.6, 6); tower.add(p.obj); }
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.4), new THREE.MeshStandardMaterial({ map: textTexture('THE MAGGAKES ESTATE', { color: '#ffd76a', glow: '#ffb000', w: 1024, h: 160, size: 96 }), transparent: true, emissive: '#ffd76a', emissiveIntensity: 1.2 }));
      sign.position.set(0, 6.3, td / 2 + 0.1);
      tower.add(sign);
      tower.position.set(0, 0, -L.d / 2 - td / 2 - 4);
      g.add(tower);
      // Driveway road loop
      const road = mat('#3b3e44', 0.85);
      const loop: [number, number, number, number][] = [[-20, 16, 40, 3.5], [-20, 33, 40, 3.5], [-20, 16, 3.5, 20.5], [16.5, 16, 3.5, 20.5]];
      for (const [x, z, w, d] of loop) {
        const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), road);
        r.rotation.x = -Math.PI / 2;
        r.position.set(x + w / 2, 0.015, z + d / 2 - L.d / 2 + 0.5);
        r.receiveShadow = true;
        g.add(r);
      }
      const ramp = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), road);
      ramp.rotation.x = -Math.PI / 2;
      ramp.position.set(0, 0.016, 15.5 - L.d / 2 + 0.5);
      g.add(ramp);
      for (let i = 0; i < 10; i++) {
        const bay = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 5), mat('#f2f2f2', 0.6));
        bay.rotation.x = -Math.PI / 2;
        bay.position.set(-L.w / 2 + 3.2 + i * 2.8 + 1.4 - 0.2, 0.02, -L.d / 2 + 2.5);
        g.add(bay);
      }
    }
  } else if (L.backdrop === 'ocean') {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 500), new THREE.MeshStandardMaterial({ color: '#1f8fbf', roughness: 0.08, metalness: 0.3 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.35, L.d / 2 + 250 - 1);
    g.add(sea);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(L.w + 40, 1.2), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(0, -0.3, L.d / 2 + 0.2);
    g.add(foam);
    const island = new THREE.Mesh(new THREE.CircleGeometry(220, 48), mat('#5d9a49', 0.95));
    island.rotation.x = -Math.PI / 2;
    island.position.set(0, -0.05, -150);
    island.receiveShadow = true;
    g.add(island);
    const rnd = seeded(9);
    for (let i = 0; i < 40; i++) {
      const p = makeProp('palm', { h: 4 + rnd() * 3, lean: (rnd() - 0.5) * 0.3 });
      const a = rnd() * Math.PI + Math.PI;
      const r = big * 0.6 + 6 + rnd() * 40;
      p.obj.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * 0.7 - 6);
      g.add(p.obj);
    }
    for (let i = 0; i < 4; i++) {
      const hill = new THREE.Mesh(new THREE.ConeGeometry(40 + i * 10, 25 + i * 6, 12), mat('#4b7f45', 1));
      hill.position.set(-120 + i * 80, 8, -180 - i * 20);
      g.add(hill);
    }
  } else {
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat('#2b2a2e', 1));
    dark.rotation.x = -Math.PI / 2;
    dark.position.y = -0.02;
    g.add(dark);
    // Basement: solid ceiling lights hint
    for (let i = 0; i < 6; i++) {
      const lamp = cyl(g, 0.25, 0.25, 0.04, glow('#fff2d8', 1.8), -L.w / 2 + 3 + i * (L.w - 6) / 5, 3.05, 0, 16);
      lamp.castShadow = false;
    }
  }
  return g;
}

/** Merges all static meshes that share a material into one draw call. */
function mergeStatic(group: THREE.Group): void {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map<string, { mat: THREE.Material; shadow: boolean; geos: THREE.BufferGeometry[] }>();
  const keep: THREE.Object3D[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) { if ((o as THREE.Sprite).isSprite) keep.push(o); return; }
    const material = m.material as THREE.Material;
    if (Array.isArray(m.material)) { keep.push(o); return; }
    const key = `${material.uuid}|${m.castShadow}`;
    let b = buckets.get(key);
    if (!b) { b = { mat: material, shadow: m.castShadow, geos: [] }; buckets.set(key, b); }
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    b.geos.push(g);
  });
  for (const k of keep) {
    const wp = new THREE.Vector3(), ws = new THREE.Vector3(), wq = new THREE.Quaternion();
    k.updateMatrixWorld(true);
    k.matrixWorld.decompose(wp, wq, ws);
    k.userData.keep = { wp, wq, ws };
  }
  const kept = keep.map((k) => { k.removeFromParent(); return k; });
  group.clear();
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    b.geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.shadow;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  for (const k of kept) {
    const { wp, wq, ws } = k.userData.keep;
    k.position.copy(wp).applyMatrix4(inv);
    k.quaternion.copy(wq);
    k.scale.copy(ws);
    group.add(k);
  }
}

function seeded(seed: number) {
  let s = (seed * 9301 + 49297) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function roomAt(zone: Zone, x: number, z: number): { id: string; name: string } | undefined {
  for (let i = zone.rooms.length - 1; i >= 0; i--) {
    const r = zone.rooms[i];
    if (x >= r.box.x0 && x < r.box.x1 && z >= r.box.z0 && z < r.box.z1) return r;
  }
  return undefined;
}

export function roomBox(zone: Zone, roomId: string): Box2 | undefined {
  return zone.rooms.find((r) => r.id === roomId)?.box;
}

export type { Rect };
