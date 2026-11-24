import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { emojiTexture, glowTexture, posterTexture, textTexture, type PosterKind } from './tex';
import { waterMaterial } from './gfx';
import { PROPS2 } from './props2';

/**
 * Procedural furniture. Every builder returns a group whose origin is the
 * centre of its footprint on the floor, facing +Z ("front").
 */
export interface Prop {
  obj: THREE.Object3D;
  /** Footprint that blocks walking (before rotation), in metres. */
  solid?: { w: number; d: number };
  /** Called every frame for animated props. */
  tick?: (t: number, dt: number) => void;
  /** Point light this prop wants (kept to a few per zone). */
  light?: THREE.PointLight;
}

export type Opts = Record<string, any>;

// ------------------------------------------------------------- materials

const mats = new Map<string, THREE.Material>();

export function mat(color: string | number, rough = 0.6, metal = 0, emissive?: string | number, emi = 0): THREE.MeshStandardMaterial {
  const key = `${color}|${rough}|${metal}|${emissive}|${emi}`;
  let m = mats.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    if (emissive !== undefined) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emi; }
    mats.set(key, m);
  }
  return m;
}

export const GOLD = () => mat('#d8b45a', 0.28, 1);
export const CHROME = () => mat('#e5e8ec', 0.15, 1);
export const BLACKMETAL = () => mat('#1b1c1f', 0.4, 0.8);
export const WHITE = () => mat('#f7f5f2', 0.45);
export const OAK = () => mat('#b98a5c', 0.55);
export const WALNUT = () => mat('#5e3f2b', 0.5);
export const MARBLE = () => mat('#f3f0ec', 0.18, 0.05);
export const LEAF = () => mat('#3f8f4a', 0.7);
export const LEAF2 = () => mat('#2f6e3a', 0.75);

export function glass(tint = '#cfe9ff', opacity = 0.22): THREE.MeshStandardMaterial {
  const key = `glass|${tint}|${opacity}`;
  let m = mats.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.04, metalness: 0.2, transparent: true, opacity, envMapIntensity: 2.2, depthWrite: false });
    mats.set(key, m);
  }
  return m;
}

export function glow(color: string, intensity = 4): THREE.MeshStandardMaterial {
  return mat(color, 0.5, 0, color, intensity);
}

// ------------------------------------------------------------- shape helpers

const geoCache = new Map<string, THREE.BufferGeometry>();
function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined;
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}

function add(g: THREE.Object3D, mesh: THREE.Mesh, shadow = true): THREE.Mesh {
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

/** Box sitting on `y` (bottom), centred on x/z. */
export function box(g: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, ry = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = ry;
  return add(g, mesh);
}

/** Rounded box (cushions, mattresses, sofas). */
export function rbox(g: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, r = 0.06, ry = 0): THREE.Mesh {
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const mesh = new THREE.Mesh(geo(`r${w},${h},${d},${rr}`, () => new RoundedBoxGeometry(w, h, d, 3, rr)), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = ry;
  return add(g, mesh);
}

export function cyl(g: THREE.Object3D, rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 24): THREE.Mesh {
  const mesh = new THREE.Mesh(geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), m);
  mesh.position.set(x, y + h / 2, z);
  return add(g, mesh);
}

export function sph(g: THREE.Object3D, r: number, m: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  // Tiny spheres (bulbs, studs, beads) don't need much detail — this keeps big scenes fast.
  const [ws, hs] = r < 0.07 ? [8, 6] : r < 0.16 ? [12, 9] : r < 0.4 ? [18, 12] : [24, 16];
  const mesh = new THREE.Mesh(geo(`s${r}:${ws}`, () => new THREE.SphereGeometry(r, ws, hs)), m);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  return add(g, mesh);
}

export function torus(g: THREE.Object3D, r: number, tube: number, m: THREE.Material, x = 0, y = 0, z = 0, arc = Math.PI * 2): THREE.Mesh {
  const mesh = new THREE.Mesh(geo(`t${r},${tube},${arc}`, () => new THREE.TorusGeometry(r, tube, 12, 32, arc)), m);
  mesh.position.set(x, y, z);
  return add(g, mesh);
}

export function plane(g: THREE.Object3D, w: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geo(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h)), m);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

/** A flat decal lying on the floor. */
export function decal(g: THREE.Object3D, w: number, d: number, m: THREE.Material, x = 0, z = 0, y = 0.012): THREE.Mesh {
  const mesh = plane(g, w, d, m, x, y, z);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function picMat(tex: THREE.Texture, emissive = 0.25): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emissive });
  return m;
}

export function sprite(tex: THREE.Texture, size: number, color = 0xffffff, additive = false): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  s.scale.set(size, size, size);
  return s;
}

const G = () => new THREE.Group();
const c = (o: Opts, k: string, d: string) => (o[k] as string) ?? d;

// ------------------------------------------------------------- bedroom

function bed(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 1.8, l = o.l ?? 2.2;
  const frame = mat(c(o, 'frame', '#efe6dc'), 0.7);
  const spread = mat(c(o, 'color', '#f4dfe6'), 0.85);
  const sheet = mat('#fbfaf8', 0.9);
  rbox(g, w + 0.12, 0.32, l + 0.08, frame, 0, 0.05, 0, 0.05);
  rbox(g, w + 0.2, 1.15, 0.18, frame, 0, 0.05, -l / 2 - 0.02, 0.08);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) sph(g, 0.03, mat('#cdbfb2', 0.6), -w / 2 + 0.25 + i * (w - 0.5) / 3, 0.6 + j * 0.35, -l / 2 + 0.08);
  rbox(g, w, 0.26, l - 0.05, sheet, 0, 0.36, 0.02, 0.08);
  rbox(g, w + 0.04, 0.1, l * 0.62, spread, 0, 0.56, l * 0.18, 0.05);
  rbox(g, w + 0.06, 0.05, 0.4, mat(c(o, 'color2', '#ffffff'), 0.85), 0, 0.6, l * 0.5 - 0.25, 0.02);
  const pillow = mat(c(o, 'pillow', '#ffffff'), 0.9);
  const pw = (w - 0.2) / 2;
  rbox(g, pw, 0.16, 0.38, pillow, -pw / 2 - 0.04, 0.62, -l / 2 + 0.35, 0.07);
  rbox(g, pw, 0.16, 0.38, pillow, pw / 2 + 0.04, 0.62, -l / 2 + 0.35, 0.07);
  rbox(g, 0.42, 0.34, 0.12, mat(c(o, 'accent', '#f3a6c8'), 0.85), 0, 0.62, -l / 2 + 0.6, 0.06);
  return { obj: g, solid: { w: w + 0.2, d: l + 0.1 } };
}

function canopyBed(o: Opts): Prop {
  const p = bed({ ...o, w: 2, l: 2.3 });
  const g = p.obj;
  const post = GOLD();
  for (const [x, z] of [[-1.1, -1.2], [1.1, -1.2], [-1.1, 1.2], [1.1, 1.2]]) cyl(g, 0.04, 0.04, 2.5, post, x, 0, z, 10);
  box(g, 2.3, 0.06, 2.5, post, 0, 2.45, 0);
  const curtain = new THREE.MeshStandardMaterial({ color: c(o, 'color', '#ffd6e7'), roughness: 0.9, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  for (const x of [-1.12, 1.12]) { const m = plane(g, 2.4, 2.3, curtain, x, 1.3, 0); m.rotation.y = Math.PI / 2; }
  return p;
}

function nightstand(o: Opts): Prop {
  const g = G();
  rbox(g, 0.5, 0.55, 0.42, mat(c(o, 'color', '#efe6dc'), 0.6), 0, 0, 0, 0.03);
  box(g, 0.08, 0.02, 0.02, GOLD(), 0, 0.38, 0.215);
  cyl(g, 0.06, 0.09, 0.22, GOLD(), 0, 0.55, 0);
  const shade = cyl(g, 0.11, 0.15, 0.2, glow('#fff1d6', 1.2), 0, 0.77, 0);
  shade.castShadow = false;
  return { obj: g, solid: { w: 0.5, d: 0.42 } };
}

function wardrobeRack(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 2;
  const colors = o.colors ?? ['#f6a6c8', '#ffffff', '#1d2233', '#bfe3f2', '#ffd36e', '#c9a4ff', '#ff6f91', '#e4d6bf'];
  rbox(g, w, 2.2, 0.55, mat(c(o, 'color', '#f2ebe4'), 0.6), 0, 0, -0.05, 0.02);
  box(g, w - 0.1, 2.0, 0.02, mat('#e0d6cc', 0.7), 0, 0.1, 0.22);
  cyl(g, 0.015, 0.015, w - 0.15, GOLD(), 0, 1.75, 0.15, 8).rotation.z = Math.PI / 2;
  const n = Math.floor(w / 0.12);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.12 + i * ((w - 0.24) / (n - 1));
    const cm = mat(colors[i % colors.length], 0.85);
    const long = (i * 7) % 3 === 0;
    rbox(g, 0.05, long ? 1.0 : 0.65, 0.42, cm, x, long ? 0.7 : 1.05, 0.15, 0.02);
  }
  for (let i = 0; i < Math.floor(w / 0.35); i++) {
    rbox(g, 0.22, 0.12, 0.2, mat(['#111', '#f6a6c8', '#fff', '#c68660'][i % 4], 0.5), -w / 2 + 0.25 + i * 0.35, 0.15, 0.1, 0.04);
  }
  return { obj: g, solid: { w, d: 0.65 } };
}

function closet(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 1.6;
  rbox(g, w, 2.4, 0.6, mat(c(o, 'color', '#efe6dc'), 0.55), 0, 0, 0, 0.02);
  const doors = Math.max(2, Math.round(w / 0.55));
  for (let i = 0; i < doors; i++) {
    const x = -w / 2 + (i + 0.5) * (w / doors);
    box(g, w / doors - 0.04, 2.2, 0.02, glass('#ffffff', 0.35), x, 0.1, 0.305);
    box(g, 0.02, 0.4, 0.03, GOLD(), x + (i % 2 ? -1 : 1) * (w / doors / 2 - 0.08), 1.0, 0.33);
  }
  return { obj: g, solid: { w, d: 0.6 } };
}

function vanity(o: Opts): Prop {
  const g = G();
  rbox(g, 1.2, 0.75, 0.5, mat(c(o, 'color', '#ffffff'), 0.4), 0, 0, 0, 0.03);
  box(g, 1.0, 1.0, 0.04, CHROME(), 0, 0.85, -0.2);
  for (let i = 0; i < 5; i++) { sph(g, 0.035, glow('#fff3d6', 3), -0.48, 0.95 + i * 0.2, -0.17); sph(g, 0.035, glow('#fff3d6', 3), 0.48, 0.95 + i * 0.2, -0.17); }
  for (let i = 0; i < 5; i++) cyl(g, 0.025, 0.025, 0.12 + (i % 2) * 0.05, mat(['#ff6f91', '#f6a6c8', '#c9a4ff', '#ffd36e', '#111'][i], 0.3, 0.2), -0.35 + i * 0.12, 0.75, 0.05, 10);
  rbox(g, 0.45, 0.45, 0.45, mat('#f6c6d6', 0.9), 0, 0, 0.5, 0.15);
  return { obj: g, solid: { w: 1.2, d: 0.6 } };
}

function mirror(o: Opts): Prop {
  const g = G();
  rbox(g, 0.75, 1.9, 0.06, GOLD(), 0, 0.05, 0, 0.03);
  box(g, 0.65, 1.8, 0.02, mat('#dfe8ee', 0.02, 1), 0, 0.1, 0.025);
  box(g, 0.6, 0.05, 0.35, GOLD(), 0, 0, -0.1);
  return { obj: g, solid: { w: 0.75, d: 0.35 } };
}

function desk(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 1.4;
  box(g, w, 0.04, 0.65, mat(c(o, 'color', '#ffffff'), 0.4), 0, 0.72, 0);
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) box(g, 0.04, 0.72, 0.6, mat(c(o, 'color', '#ffffff'), 0.4), x, 0, 0);
  box(g, 0.55, 0.34, 0.03, BLACKMETAL(), 0, 0.85, -0.2);
  box(g, 0.5, 0.29, 0.005, glow(c(o, 'screen', '#7fc8ff'), 0.9), 0, 0.875, -0.183);
  box(g, 0.35, 0.02, 0.12, mat('#ddd', 0.4), 0, 0.76, 0.05);
  return { obj: g, solid: { w, d: 0.65 } };
}

function shelf(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 1.2, h = o.h ?? 1.9;
  const wood = mat(c(o, 'color', '#efe6dc'), 0.55);
  box(g, w, h, 0.03, wood, 0, 0, -0.17);
  for (const x of [-w / 2, w / 2]) box(g, 0.04, h, 0.36, wood, x, 0, 0);
  const shelves = Math.round(h / 0.4);
  const r = seeded(w * 100 + h);
  for (let i = 0; i <= shelves; i++) {
    const y = i * (h / shelves);
    box(g, w, 0.03, 0.36, wood, 0, Math.min(y, h - 0.03), 0);
    if (i === shelves) continue;
    let x = -w / 2 + 0.08;
    while (x < w / 2 - 0.15) {
      const kind = r();
      if (o.items === 'vinyl') {
        box(g, 0.3, 0.31, 0.015, mat(['#f95738', '#111', '#ee964b', '#33e1ff', '#f4d35e'][Math.floor(r() * 5)], 0.5), x + 0.15, y + 0.03, 0.02 + r() * 0.02, (r() - 0.5) * 0.1);
        x += 0.07;
      } else if (kind < 0.7) {
        const bw = 0.03 + r() * 0.03, bh = 0.2 + r() * 0.12;
        box(g, bw, bh, 0.22, mat(['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#2b6cff', '#ff6f91', '#fff'][Math.floor(r() * 7)], 0.7), x + bw / 2, y + 0.03, 0);
        x += bw + 0.005;
      } else {
        sph(g, 0.06, mat(['#ffd36e', '#bfe3f2', '#f6a6c8'][Math.floor(r() * 3)], 0.3, 0.3), x + 0.1, y + 0.1, 0);
        x += 0.22;
      }
    }
  }
  return { obj: g, solid: { w, d: 0.4 } };
}

// ------------------------------------------------------------- living

function sofa(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 2.4, d = 0.95;
  const fab = mat(c(o, 'color', '#efe7dd'), 0.95);
  rbox(g, w, 0.42, d, fab, 0, 0.08, 0, 0.08);
  rbox(g, w, 0.55, 0.25, fab, 0, 0.3, -d / 2 + 0.125, 0.1);
  for (const x of [-w / 2 + 0.12, w / 2 - 0.12]) rbox(g, 0.24, 0.32, d, fab, x, 0.3, 0, 0.1);
  const seats = Math.max(2, Math.round(w / 0.8));
  const sw = (w - 0.3) / seats;
  for (let i = 0; i < seats; i++) rbox(g, sw - 0.03, 0.14, d - 0.3, fab, -w / 2 + 0.15 + sw * (i + 0.5), 0.47, 0.1, 0.06);
  for (let i = 0; i < seats; i++) rbox(g, 0.42, 0.38, 0.12, mat([c(o, 'accent', '#f3a6c8'), c(o, 'accent2', '#ffffff')][i % 2], 0.95), -w / 2 + 0.15 + sw * (i + 0.5), 0.55, -d / 2 + 0.33, 0.08);
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) for (const z of [-d / 2 + 0.1, d / 2 - 0.1]) cyl(g, 0.025, 0.02, 0.08, GOLD(), x, 0, z, 8);
  return { obj: g, solid: { w, d } };
}

function sectional(o: Opts): Prop {
  const g = G();
  const a = sofa({ ...o, w: o.w ?? 3 });
  g.add(a.obj);
  const b = sofa({ ...o, w: 2 });
  b.obj.rotation.y = -Math.PI / 2;
  b.obj.position.set((o.w ?? 3) / 2 - 0.47, 0, 1.45);
  g.add(b.obj);
  return { obj: g, solid: { w: o.w ?? 3, d: 0.95 } };
}

function armchair(o: Opts): Prop {
  const g = G();
  const fab = mat(c(o, 'color', '#e9dccf'), 0.95);
  rbox(g, 0.85, 0.42, 0.85, fab, 0, 0.08, 0, 0.1);
  rbox(g, 0.85, 0.5, 0.2, fab, 0, 0.35, -0.33, 0.1);
  for (const x of [-0.36, 0.36]) rbox(g, 0.16, 0.25, 0.8, fab, x, 0.4, 0, 0.08);
  for (const x of [-0.33, 0.33]) for (const z of [-0.33, 0.33]) cyl(g, 0.02, 0.02, 0.08, GOLD(), x, 0, z, 8);
  return { obj: g, solid: { w: 0.85, d: 0.85 } };
}

function coffeeTable(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 1.2, d = o.d ?? 0.7;
  if (o.round) {
    cyl(g, w / 2, w / 2, 0.05, MARBLE(), 0, 0.38, 0, 40);
    cyl(g, 0.12, 0.2, 0.38, GOLD(), 0, 0, 0, 20);
  } else {
    rbox(g, w, 0.05, d, MARBLE(), 0, 0.38, 0, 0.02);
    for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) box(g, 0.03, 0.38, d - 0.1, GOLD(), x, 0, 0);
  }
  rbox(g, 0.25, 0.04, 0.18, mat('#3d405b', 0.7), 0.1, 0.43, 0, 0.01);
  cyl(g, 0.05, 0.04, 0.12, mat('#ffffff', 0.3), -0.25, 0.43, 0.05, 16);
  return { obj: g, solid: { w, d: o.round ? w : d } };
}

function rug(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 2.4, d = o.d ?? 1.7;
  const m = mat(c(o, 'color', '#efe4d6'), 1);
  if (o.round) {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 48), m);
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.012; mesh.receiveShadow = true; g.add(mesh);
  } else {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, 0.02, d, 2, 0.01), m);
    mesh.position.y = 0.01; mesh.receiveShadow = true; g.add(mesh);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.022, d - 0.2), mat(c(o, 'color2', '#ffffff'), 1));
    b.position.y = 0.011; b.receiveShadow = true; g.add(b);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.024, d - 0.3), m);
    inner.position.y = 0.012; inner.receiveShadow = true; g.add(inner);
  }
  return { obj: g };
}

function tv(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 2.2;
  rbox(g, w + 0.4, 0.45, 0.45, mat(c(o, 'color', '#2a2724'), 0.4), 0, 0, 0, 0.02);
  box(g, w, w * 0.56, 0.05, BLACKMETAL(), 0, 0.85, -0.12);
  const screen = box(g, w - 0.06, w * 0.56 - 0.06, 0.01, glow(c(o, 'screen', '#6db4ff'), 0.6), 0, 0.88, -0.09);
  screen.castShadow = false;
  return { obj: g, solid: { w: w + 0.4, d: 0.45 } };
}

function diningTable(o: Opts): Prop {
  const g = G();
  const l = o.l ?? 3.6, w = o.w ?? 1.1;
  rbox(g, l, 0.06, w, o.marble ? MARBLE() : WALNUT(), 0, 0.72, 0, 0.02);
  for (const x of [-l / 2 + 0.4, l / 2 - 0.4]) { box(g, 0.1, 0.72, 0.5, BLACKMETAL(), x, 0, 0); }
  const seats = Math.floor(l / 0.75);
  for (let i = 0; i < seats; i++) {
    const x = -l / 2 + 0.45 + i * ((l - 0.9) / Math.max(1, seats - 1));
    for (const s of [-1, 1]) {
      const ch = chair({ color: o.chair });
      ch.obj.position.set(x, 0, s * (w / 2 + 0.3));
      ch.obj.rotation.y = s > 0 ? Math.PI : 0;
      g.add(ch.obj);
    }
    if (o.set) {
      for (const s of [-1, 1]) {
        cyl(g, 0.13, 0.13, 0.01, WHITE(), x, 0.78, s * (w / 2 - 0.22), 24);
        cyl(g, 0.03, 0.02, 0.12, glass('#ffffff', 0.5), x + 0.18, 0.78, s * (w / 2 - 0.3), 10);
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    cyl(g, 0.02, 0.02, 0.25, mat('#fff8ee', 0.6), -0.4 + i * 0.4, 0.78, 0, 8);
    const f = sph(g, 0.025, glow('#ffb347', 4), -0.4 + i * 0.4, 1.06, 0);
    f.castShadow = false;
  }
  return { obj: g, solid: { w: l, d: w + 0.8 } };
}

function chair(o: Opts): Prop {
  const g = G();
  const fab = mat(c(o, 'color', '#e9dccf'), 0.9);
  rbox(g, 0.46, 0.1, 0.46, fab, 0, 0.42, 0, 0.04);
  rbox(g, 0.46, 0.5, 0.08, fab, 0, 0.5, -0.2, 0.04);
  for (const x of [-0.19, 0.19]) for (const z of [-0.19, 0.19]) cyl(g, 0.015, 0.015, 0.42, GOLD(), x, 0, z, 6);
  return { obj: g, solid: { w: 0.5, d: 0.5 } };
}

function stool(o: Opts): Prop {
  const g = G();
  cyl(g, 0.2, 0.2, 0.08, mat(c(o, 'color', '#e9dccf'), 0.9), 0, 0.72, 0, 20);
  cyl(g, 0.025, 0.025, 0.72, GOLD(), 0, 0, 0, 8);
  cyl(g, 0.2, 0.22, 0.02, GOLD(), 0, 0, 0, 20);
  torus(g, 0.16, 0.012, GOLD(), 0, 0.3, 0).rotation.x = Math.PI / 2;
  return { obj: g, solid: { w: 0.4, d: 0.4 } };
}

function plant(o: Opts): Prop {
  const g = G();
  const s = o.s ?? 1;
  const pot = mat(c(o, 'pot', '#e9e2d8'), 0.8);
  cyl(g, 0.22 * s, 0.17 * s, 0.45 * s, pot, 0, 0, 0, 20);
  cyl(g, 0.2 * s, 0.2 * s, 0.02, mat('#4a3426', 1), 0, 0.44 * s, 0, 16);
  const r = seeded((o.seed ?? 3) * 13);
  if (o.kind === 'tall') {
    cyl(g, 0.025 * s, 0.035 * s, 1.2 * s, WALNUT(), 0, 0.45 * s, 0, 6);
    for (let i = 0; i < 14; i++) sph(g, 0.17 * s, i % 2 ? LEAF() : LEAF2(), (r() - 0.5) * 0.55 * s, (1.1 + r() * 0.8) * s, (r() - 0.5) * 0.55 * s, 1.2, 0.5, 0.9);
  } else {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const leaf = sph(g, 0.2 * s, i % 2 ? LEAF() : LEAF2(), Math.cos(a) * 0.2 * s, (0.65 + r() * 0.35) * s, Math.sin(a) * 0.2 * s, 1.3, 0.35, 0.7);
      leaf.rotation.set(r() * 0.6, a, 0.5);
    }
  }
  return { obj: g, solid: { w: 0.45 * s, d: 0.45 * s } };
}

function palm(o: Opts): Prop {
  const g = G();
  const h = o.h ?? 5;
  const trunk = mat('#8a6a4a', 0.9);
  const segs = 8;
  let x = 0, y = 0;
  const lean = o.lean ?? 0.08;
  for (let i = 0; i < segs; i++) {
    const r = 0.16 - i * 0.008;
    const m = cyl(g, r - 0.01, r, h / segs + 0.02, trunk, x, y, 0, 10);
    m.rotation.z = -lean;
    x += Math.sin(lean) * h / segs; y += Math.cos(lean) * h / segs;
  }
  const frond = mat('#3d8b3d', 0.7);
  const fg = new THREE.ConeGeometry(0.28, 2.6, 4);
  fg.translate(0, 1.3, 0);
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(fg, frond);
    m.position.set(x, y, 0);
    m.rotation.set(0, (i / 9) * Math.PI * 2, 1.15 + (i % 2) * 0.25);
    m.rotation.order = 'YZX';
    m.scale.set(1, 1, 0.18);
    add(g, m);
  }
  for (let i = 0; i < 3; i++) sph(g, 0.1, mat('#5a4024', 0.6), x + Math.cos(i * 2) * 0.15, y - 0.15, Math.sin(i * 2) * 0.15);
  return { obj: g, solid: { w: 0.4, d: 0.4 } };
}

function floorLamp(o: Opts): Prop {
  const g = G();
  cyl(g, 0.18, 0.18, 0.03, GOLD(), 0, 0, 0, 20);
  cyl(g, 0.015, 0.015, 1.5, GOLD(), 0, 0, 0, 8);
  const sh = cyl(g, 0.17, 0.24, 0.32, glow(c(o, 'color', '#fff1d6'), 1.4), 0, 1.45, 0, 24);
  sh.castShadow = false;
  return { obj: g, solid: { w: 0.35, d: 0.35 } };
}

function chandelier(o: Opts): Prop {
  const g = G();
  const r = o.r ?? 0.8;
  const y = o.y ?? 2.6;
  const crystal = glow('#fff6e0', 3);
  torus(g, r, 0.02, GOLD(), 0, y, 0).rotation.x = Math.PI / 2;
  torus(g, r * 0.6, 0.02, GOLD(), 0, y - 0.25, 0).rotation.x = Math.PI / 2;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const m = sph(g, 0.05, crystal, Math.cos(a) * r, y - 0.08, Math.sin(a) * r, 0.7, 1.4, 0.7);
    m.castShadow = false;
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const m = sph(g, 0.045, crystal, Math.cos(a) * r * 0.6, y - 0.35, Math.sin(a) * r * 0.6, 0.7, 1.4, 0.7);
    m.castShadow = false;
  }
  const core = sph(g, 0.14, crystal, 0, y - 0.45, 0, 1, 1.6, 1);
  core.castShadow = false;
  g.traverse((m) => { (m as THREE.Mesh).castShadow = false; });
  return { obj: g };
}

// ------------------------------------------------------------- kitchen & dining

function kitchenIsland(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 3.2, d = o.d ?? 1.2;
  rbox(g, w, 0.88, d, mat(c(o, 'color', '#f5f2ee'), 0.35), 0, 0, 0, 0.02);
  box(g, w + 0.08, 0.06, d + 0.08, MARBLE(), 0, 0.88, 0);
  for (const x of [-w / 2 - 0.02, w / 2 + 0.02]) box(g, 0.06, 0.88, d + 0.08, MARBLE(), x, 0, 0);
  // bowls & fruit
  cyl(g, 0.2, 0.12, 0.1, WHITE(), -0.5, 0.94, 0, 24);
  for (let i = 0; i < 5; i++) sph(g, 0.055, mat(['#f25c54', '#f7b267', '#9bc53d'][i % 3], 0.5), -0.55 + (i % 3) * 0.06, 1.02, (i - 2) * 0.04);
  cyl(g, 0.012, 0.012, 0.35, CHROME(), 0.6, 0.94, -0.3, 8);
  if (o.stools !== false) {
    const n = Math.floor(w / 0.75);
    for (let i = 0; i < n; i++) {
      const s = stool({ color: o.stool });
      s.obj.position.set(-w / 2 + 0.4 + i * ((w - 0.8) / Math.max(1, n - 1)), 0, d / 2 + 0.45);
      g.add(s.obj);
    }
  }
  return { obj: g, solid: { w: w + 0.1, d: d + 0.6 } };
}

function counter(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 4;
  const cab = mat(c(o, 'color', '#f5f2ee'), 0.35);
  box(g, w, 0.88, 0.62, cab, 0, 0, 0);
  box(g, w + 0.02, 0.05, 0.66, MARBLE(), 0, 0.88, 0.02);
  const doors = Math.round(w / 0.6);
  for (let i = 0; i < doors; i++) box(g, 0.02, 0.3, 0.02, GOLD(), -w / 2 + (i + 0.5) * (w / doors), 0.5, 0.32);
  // upper cabinets + backsplash
  box(g, w, 0.7, 0.02, mat('#ffffff', 0.15, 0.1), 0, 0.93, -0.3);
  box(g, w, 0.75, 0.38, cab, 0, 1.6, -0.12);
  if (o.stove !== false) {
    box(g, 0.7, 0.01, 0.5, BLACKMETAL(), w * 0.2, 0.93, 0);
    for (const [x, z] of [[-0.15, -0.1], [0.15, -0.1], [-0.15, 0.12], [0.15, 0.12]]) torus(g, 0.07, 0.01, mat('#444', 0.4, 0.6), w * 0.2 + x, 0.945, z).rotation.x = Math.PI / 2;
  }
  if (o.sink !== false) {
    box(g, 0.6, 0.02, 0.42, CHROME(), -w * 0.2, 0.925, 0);
    cyl(g, 0.015, 0.015, 0.3, CHROME(), -w * 0.2, 0.93, -0.2, 8);
  }
  return { obj: g, solid: { w, d: 0.66 } };
}

function fridge(o: Opts): Prop {
  const g = G();
  rbox(g, 0.95, 2.1, 0.7, mat(c(o, 'color', '#d9dde2'), 0.25, 0.7), 0, 0, 0, 0.03);
  box(g, 0.01, 2.0, 0.02, BLACKMETAL(), 0, 0.05, 0.355);
  for (const x of [-0.06, 0.06]) box(g, 0.02, 0.8, 0.04, CHROME(), x, 0.9, 0.37);
  return { obj: g, solid: { w: 0.95, d: 0.7 } };
}

function sushiBar(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 4;
  rbox(g, w, 1.0, 0.7, WALNUT(), 0, 0, 0, 0.03);
  box(g, w + 0.1, 0.06, 0.85, mat('#d9c3a0', 0.5), 0, 1.0, 0.05);
  const r = seeded(9);
  for (let i = 0; i < Math.floor(w / 0.45); i++) {
    const x = -w / 2 + 0.3 + i * 0.45;
    rbox(g, 0.3, 0.02, 0.2, mat('#1a1a1a', 0.3), x, 1.06, 0.15, 0.01);
    for (let k = 0; k < 3; k++) {
      cyl(g, 0.035, 0.035, 0.035, mat('#fbfbf7', 0.7), x - 0.08 + k * 0.08, 1.08, 0.15, 12);
      cyl(g, 0.036, 0.036, 0.012, mat(r() < 0.5 ? '#ff8a5b' : '#e63946', 0.4), x - 0.08 + k * 0.08, 1.115, 0.15, 12);
    }
  }
  const n = Math.floor(w / 0.7);
  for (let i = 0; i < n; i++) {
    const s = stool({ color: '#c0392b' });
    s.obj.position.set(-w / 2 + 0.4 + i * ((w - 0.8) / Math.max(1, n - 1)), 0, 0.85);
    g.add(s.obj);
  }
  // lanterns
  for (let i = 0; i < 3; i++) {
    const l = sph(g, 0.16, glow('#ff5a4a', 1.6), -w / 3 + i * (w / 3), 2.3, 0, 1, 1.25, 1);
    l.castShadow = false;
  }
  return { obj: g, solid: { w, d: 1.2 } };
}

function receptionDesk(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 3.2;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, w / 2, Math.PI * 1.1, Math.PI * 1.9, false);
  shape.absarc(0, 0, w / 2 - 0.6, Math.PI * 1.9, Math.PI * 1.1, true);
  const ex = new THREE.ExtrudeGeometry(shape, { depth: 1.05, bevelEnabled: false, curveSegments: 32 });
  ex.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(ex, MARBLE());
  m.position.z = w / 2 - 0.35;
  add(g, m);
  const strip = new THREE.Mesh(ex.clone(), GOLD());
  strip.scale.set(1.005, 0.06, 1.005);
  strip.position.set(0, 1.04, w / 2 - 0.35);
  add(g, strip);
  const bell = sph(g, 0.06, GOLD(), 0.3, 1.12, 0.05, 1, 0.7, 1);
  bell.castShadow = false;
  return { obj: g, solid: { w: w * 0.9, d: 1.1 } };
}

function grandStairs(o: Opts): Prop {
  const g = G();
  const steps = 12;
  const stepMat = MARBLE();
  for (const side of [-1, 1]) {
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 0.55;
      const r = 3;
      const x = side * (Math.cos(a) * r - r + 0.9) * -1;
      const z = -Math.sin(a) * r;
      box(g, 1.4, 0.18 * (i + 1), 0.45, stepMat, x * (o.w ?? 1), 0, z, side * a);
    }
  }
  return { obj: g, solid: { w: 6, d: 3 } };
}

// ------------------------------------------------------------- bathroom & spa

function toilet(): Prop {
  const g = G();
  rbox(g, 0.4, 0.4, 0.55, WHITE(), 0, 0, 0.05, 0.12);
  rbox(g, 0.42, 0.06, 0.55, WHITE(), 0, 0.4, 0.05, 0.03);
  rbox(g, 0.42, 0.4, 0.18, WHITE(), 0, 0.42, -0.25, 0.05);
  return { obj: g, solid: { w: 0.45, d: 0.7 } };
}

function sink(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 1.2;
  rbox(g, w, 0.82, 0.5, mat(c(o, 'color', '#e9e2d8'), 0.5), 0, 0, 0, 0.02);
  box(g, w, 0.05, 0.52, MARBLE(), 0, 0.82, 0);
  const basins = w > 1.3 ? 2 : 1;
  for (let i = 0; i < basins; i++) {
    const x = basins === 1 ? 0 : (i - 0.5) * w * 0.5;
    cyl(g, 0.2, 0.15, 0.12, WHITE(), x, 0.87, 0.02, 24);
    cyl(g, 0.012, 0.012, 0.25, GOLD(), x, 0.87, -0.2, 8);
    box(g, w / basins - 0.1, 0.8, 0.03, mat('#e6eef2', 0.02, 1), x, 1.25, -0.24);
  }
  return { obj: g, solid: { w, d: 0.52 } };
}

function bathtub(): Prop {
  const g = G();
  const outer = sph(g, 1, WHITE(), 0, 0.3, 0, 0.85, 0.32, 0.45);
  outer.castShadow = true;
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 32), waterMaterial('#5fb8d6', '#bdeefa'));
  water.rotation.x = -Math.PI / 2;
  water.scale.set(0.78, 0.38, 1);
  water.position.y = 0.58;
  g.add(water);
  cyl(g, 0.015, 0.015, 0.7, GOLD(), 0.75, 0, 0, 8);
  return { obj: g, solid: { w: 1.75, d: 0.95 } };
}

function shower(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 1.1;
  box(g, w, 0.06, w, mat('#e9eef0', 0.3), 0, 0, 0);
  for (const [x, z, ry] of [[0, w / 2, 0], [w / 2, 0, Math.PI / 2]] as const) box(g, w, 2.1, 0.02, glass('#e6f6ff', 0.18), x, 0.06, z, ry);
  cyl(g, 0.012, 0.012, 2.1, CHROME(), -w / 2 + 0.1, 0, -w / 2 + 0.1, 8);
  cyl(g, 0.15, 0.15, 0.02, CHROME(), -w / 2 + 0.3, 2.05, -w / 2 + 0.3, 24);
  return { obj: g, solid: { w, d: w } };
}

function spaBed(o: Opts): Prop {
  const g = G();
  rbox(g, 0.75, 0.7, 1.9, mat('#efe6dc', 0.7), 0, 0, 0, 0.04);
  rbox(g, 0.78, 0.12, 1.95, mat(c(o, 'color', '#ffffff'), 0.95), 0, 0.7, 0, 0.05);
  rbox(g, 0.3, 0.1, 0.2, mat('#d8e8d0', 0.95), 0, 0.82, -0.7, 0.04);
  for (let i = 0; i < 3; i++) rbox(g, 0.3, 0.06, 0.3, mat(['#ffffff', '#f7e6ee', '#e8f3ee'][i], 0.95), 0, 0.82 + i * 0.06, 0.6, 0.03);
  return { obj: g, solid: { w: 0.8, d: 1.95 } };
}

function candles(): Prop {
  const g = G();
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.12, h = 0.1 + (i % 3) * 0.05;
    cyl(g, 0.04, 0.04, h, mat('#fff8ee', 0.7), x, 0, 0, 12);
    const f = sph(g, 0.018, glow('#ffb347', 5), x, h + 0.03, 0, 0.7, 1.4, 0.7);
    f.castShadow = false;
  }
  return { obj: g };
}

function hotTub(o: Opts): Prop {
  const g = G();
  const r = o.r ?? 1.3;
  const sq = !!o.square;
  if (sq) {
    rbox(g, r * 2 + 0.3, 0.75, r * 2 + 0.3, mat('#e9e2d8', 0.5), 0, 0, 0, 0.08);
  } else {
    cyl(g, r + 0.15, r + 0.2, 0.75, mat('#e9e2d8', 0.5), 0, 0, 0, 40);
  }
  const water = new THREE.Mesh(sq ? new THREE.PlaneGeometry(r * 2, r * 2) : new THREE.CircleGeometry(r, 40), waterMaterial('#1290b8', '#7fe7f5'));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.66;
  g.add(water);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const l = sph(g, 0.05, glow('#7fe7ff', 3), Math.cos(a) * (r + 0.05), 0.55, Math.sin(a) * (r + 0.05));
    l.castShadow = false;
  }
  // bubbles
  const bubbles = new THREE.Group();
  for (let i = 0; i < 24; i++) {
    const b = new THREE.Mesh(geo('bub', () => new THREE.SphereGeometry(0.03, 8, 6)), mat('#ffffff', 0.2));
    b.position.set((Math.random() - 0.5) * r * 1.5, 0.67, (Math.random() - 0.5) * r * 1.5);
    bubbles.add(b);
  }
  g.add(bubbles);
  return {
    obj: g,
    tick: (t) => bubbles.children.forEach((b, i) => { b.position.y = 0.66 + Math.abs(Math.sin(t * 3 + i)) * 0.04; }),
  };
}

// ------------------------------------------------------------- gym

function treadmill(): Prop {
  const g = G();
  rbox(g, 0.8, 0.18, 1.9, BLACKMETAL(), 0, 0, 0, 0.04);
  box(g, 0.6, 0.02, 1.6, mat('#222', 0.9), 0, 0.18, 0.05);
  for (const x of [-0.37, 0.37]) box(g, 0.05, 1.2, 0.05, BLACKMETAL(), x, 0.1, -0.85);
  rbox(g, 0.8, 0.3, 0.15, BLACKMETAL(), 0, 1.25, -0.85, 0.03);
  box(g, 0.45, 0.2, 0.01, glow('#33e1ff', 0.8), 0, 1.3, -0.77);
  return { obj: g, solid: { w: 0.8, d: 1.9 } };
}

function bike(): Prop {
  const g = G();
  rbox(g, 0.5, 0.08, 1.1, BLACKMETAL(), 0, 0, 0, 0.03);
  box(g, 0.08, 0.8, 0.08, BLACKMETAL(), 0, 0, -0.1);
  rbox(g, 0.26, 0.08, 0.32, mat('#222', 0.6), 0, 0.85, 0.05, 0.04);
  box(g, 0.06, 0.9, 0.06, BLACKMETAL(), 0, 0, -0.45);
  box(g, 0.5, 0.04, 0.05, CHROME(), 0, 0.95, -0.45);
  cyl(g, 0.25, 0.25, 0.08, mat('#ff6f91', 0.3, 0.6), 0, 0.2, -0.3, 24).rotation.z = Math.PI / 2;
  return { obj: g, solid: { w: 0.5, d: 1.1 } };
}

function weightBench(): Prop {
  const g = G();
  rbox(g, 0.35, 0.1, 1.2, mat('#222', 0.6), 0, 0.42, 0, 0.04);
  for (const z of [-0.45, 0.45]) box(g, 0.08, 0.42, 0.08, BLACKMETAL(), 0, 0, z);
  for (const x of [-0.6, 0.6]) box(g, 0.05, 1.2, 0.05, BLACKMETAL(), x, 0, -0.5);
  cyl(g, 0.015, 0.015, 1.6, CHROME(), 0, 1.1, -0.5, 8).rotation.z = Math.PI / 2;
  for (const x of [-0.7, 0.7]) cyl(g, 0.2, 0.2, 0.05, BLACKMETAL(), x, 0.9, -0.5, 24).rotation.z = Math.PI / 2;
  return { obj: g, solid: { w: 1.4, d: 1.2 } };
}

function dumbbellRack(): Prop {
  const g = G();
  box(g, 1.6, 0.6, 0.4, BLACKMETAL(), 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const x = -0.68 + i * 0.22;
    cyl(g, 0.012, 0.012, 0.22, CHROME(), x, 0.68, 0, 6).rotation.x = Math.PI / 2;
    for (const z of [-0.09, 0.09]) cyl(g, 0.05 + i * 0.005, 0.05 + i * 0.005, 0.05, mat(['#ff6f91', '#333'][i % 2], 0.4, 0.4), x, 0.66, z, 12).rotation.x = Math.PI / 2;
  }
  return { obj: g, solid: { w: 1.6, d: 0.4 } };
}

function yogaMat(o: Opts): Prop {
  const g = G();
  rbox(g, 0.65, 0.015, 1.8, mat(c(o, 'color', '#b9a2e8'), 0.95), 0, 0, 0, 0.005);
  return { obj: g };
}

function reformer(): Prop {
  const g = G();
  rbox(g, 0.75, 0.3, 2.3, mat('#efe6dc', 0.6), 0, 0, 0, 0.04);
  rbox(g, 0.6, 0.1, 0.8, mat('#f6c6d6', 0.9), 0, 0.3, -0.2, 0.04);
  box(g, 0.75, 0.6, 0.06, mat('#efe6dc', 0.6), 0, 0.3, 1.1);
  return { obj: g, solid: { w: 0.75, d: 2.3 } };
}

// ------------------------------------------------------------- music

function djBooth(o: Opts): Prop {
  const g = G();
  rbox(g, 2.2, 1.0, 0.8, mat('#121218', 0.3, 0.4), 0, 0, 0, 0.04);
  const strip = box(g, 2.22, 0.06, 0.82, glow(c(o, 'color', '#ff3df0'), 3), 0, 0.5, 0);
  strip.castShadow = false;
  for (const x of [-0.6, 0.6]) {
    cyl(g, 0.2, 0.2, 0.03, mat('#222', 0.4, 0.5), x, 1.0, 0, 32);
    cyl(g, 0.06, 0.06, 0.035, glow('#33e1ff', 2), x, 1.0, 0, 16);
  }
  box(g, 0.5, 0.04, 0.4, mat('#222', 0.4), 0, 1.0, 0);
  for (let i = 0; i < 8; i++) { const k = box(g, 0.03, 0.02, 0.03, glow(['#ff3df0', '#33e1ff', '#ffd23f'][i % 3], 3), -0.2 + (i % 4) * 0.13, 1.04, -0.1 + Math.floor(i / 4) * 0.15); k.castShadow = false; }
  const light = new THREE.PointLight(c(o, 'color', '#ff3df0'), 6, 7, 2);
  light.position.set(0, 2.2, 0.8);
  return { obj: g, solid: { w: 2.2, d: 0.8 }, light, tick: (t) => { light.color.setHSL((t * 0.08) % 1, 0.9, 0.6); } };
}

function speaker(): Prop {
  const g = G();
  rbox(g, 0.5, 1.2, 0.45, mat('#141414', 0.5), 0, 0, 0, 0.03);
  cyl(g, 0.17, 0.17, 0.02, mat('#2a2a2a', 0.4, 0.5), 0, 0.4, 0.23, 24).rotation.x = Math.PI / 2;
  cyl(g, 0.08, 0.08, 0.02, mat('#2a2a2a', 0.4, 0.5), 0, 0.88, 0.23, 24).rotation.x = Math.PI / 2;
  return { obj: g, solid: { w: 0.5, d: 0.45 } };
}

function piano(): Prop {
  const g = G();
  const body = new THREE.Shape();
  body.moveTo(-0.75, -0.8); body.lineTo(0.75, -0.8); body.lineTo(0.75, 0.2);
  body.bezierCurveTo(0.75, 0.9, 0.1, 0.9, 0, 0.9); body.bezierCurveTo(-0.6, 0.9, -0.75, 0.5, -0.75, 0.3); body.closePath();
  const ex = new THREE.ExtrudeGeometry(body, { depth: 0.3, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  ex.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(ex, mat('#0b0b0d', 0.12, 0.3));
  m.position.y = 1.0;
  add(g, m);
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [0, 0.7]]) cyl(g, 0.05, 0.04, 0.7, mat('#0b0b0d', 0.15, 0.3), x, 0, z, 10);
  box(g, 1.4, 0.04, 0.2, WHITE(), 0, 0.72, -0.88);
  for (let i = 0; i < 18; i++) box(g, 0.035, 0.03, 0.12, mat('#0b0b0d', 0.2), -0.66 + i * 0.077, 0.75, -0.84);
  return { obj: g, solid: { w: 1.6, d: 2 } };
}

function guitar(o: Opts): Prop {
  const g = G();
  const body = mat(c(o, 'color', '#c8743a'), 0.3, 0.1);
  box(g, 0.3, 0.04, 0.3, BLACKMETAL(), 0, 0, 0);
  const holder = new THREE.Group();
  holder.rotation.x = -0.25;
  holder.position.set(0, 0.05, 0.05);
  g.add(holder);
  sph(holder, 0.2, body, 0, 0.25, 0, 1, 1.15, 0.35);
  sph(holder, 0.15, body, 0, 0.55, 0, 1, 1, 0.35);
  cyl(holder, 0.05, 0.05, 0.02, mat('#2a1a10', 0.6), 0, 0.42, 0.065, 16).rotation.x = Math.PI / 2;
  box(holder, 0.05, 0.6, 0.03, WALNUT(), 0, 0.65, 0);
  box(holder, 0.08, 0.14, 0.03, WALNUT(), 0, 1.24, 0);
  return { obj: g, solid: { w: 0.4, d: 0.4 } };
}

function mic(): Prop {
  const g = G();
  cyl(g, 0.15, 0.15, 0.02, BLACKMETAL(), 0, 0, 0, 20);
  cyl(g, 0.012, 0.012, 1.5, BLACKMETAL(), 0, 0, 0, 8);
  sph(g, 0.05, mat('#999', 0.3, 0.9), 0, 1.55, 0.03, 1, 1.4, 1);
  return { obj: g };
}

function drums(): Prop {
  const g = G();
  cyl(g, 0.3, 0.3, 0.45, mat('#d7263d', 0.25, 0.3), 0, 0.15, 0, 24).rotation.x = Math.PI / 2;
  for (const [x, z, y] of [[-0.45, 0.35, 0.6], [0.45, 0.35, 0.6], [-0.2, 0.45, 0.75], [0.2, 0.45, 0.75]]) {
    cyl(g, 0.15, 0.15, 0.18, mat('#d7263d', 0.25, 0.3), x, y, z, 20);
  }
  for (const x of [-0.7, 0.7]) { cyl(g, 0.01, 0.01, 1.1, CHROME(), x, 0, 0.1, 6); cyl(g, 0.22, 0.22, 0.01, GOLD(), x, 1.1, 0.1, 24); }
  return { obj: g, solid: { w: 1.5, d: 1 } };
}

function mixingDesk(): Prop {
  const g = G();
  rbox(g, 2.0, 0.85, 0.8, mat('#1d1d22', 0.4), 0, 0, 0, 0.03);
  const top = box(g, 1.9, 0.04, 0.6, mat('#2a2a30', 0.4), 0, 0.85, 0);
  top.rotation.x = -0.15;
  for (let i = 0; i < 24; i++) { const k = box(g, 0.03, 0.03, 0.05, glow(['#33e1ff', '#ff3df0', '#9bff6a'][i % 3], 2.5), -0.85 + (i % 12) * 0.15, 0.9, -0.15 + Math.floor(i / 12) * 0.2); k.castShadow = false; }
  for (const x of [-0.75, 0.75]) { box(g, 0.5, 0.32, 0.04, BLACKMETAL(), x, 1.1, -0.35); box(g, 0.46, 0.28, 0.01, glow('#7fc8ff', 0.7), x, 1.12, -0.325); }
  return { obj: g, solid: { w: 2, d: 0.8 } };
}

function vinylWall(): Prop {
  const g = G();
  for (let i = 0; i < 9; i++) {
    const x = (i % 3 - 1) * 0.45, y = 1.2 + Math.floor(i / 3) * 0.45;
    const d = cyl(g, 0.17, 0.17, 0.01, mat('#111', 0.3, 0.3), x, y, 0, 32);
    d.rotation.x = Math.PI / 2;
    const l = cyl(g, 0.06, 0.06, 0.012, mat(['#f95738', '#33e1ff', '#ffd23f', '#ff6f91'][i % 4], 0.5), x, y, 0.001, 20);
    l.rotation.x = Math.PI / 2;
  }
  return { obj: g };
}

// ------------------------------------------------------------- outdoor

function sunbed(o: Opts): Prop {
  const g = G();
  rbox(g, 0.7, 0.25, 1.9, mat('#f5efe6', 0.6), 0, 0.05, 0, 0.04);
  rbox(g, 0.66, 0.1, 1.25, mat(c(o, 'color', '#ffffff'), 0.95), 0, 0.3, 0.3, 0.04);
  const back = rbox(g, 0.66, 0.1, 0.7, mat(c(o, 'color', '#ffffff'), 0.95), 0, 0.45, -0.55, 0.04);
  back.rotation.x = 0.6;
  rbox(g, 0.5, 0.04, 0.35, mat(c(o, 'towel', '#ff9fc4'), 0.95), 0, 0.42, 0.4, 0.02);
  return { obj: g, solid: { w: 0.7, d: 1.9 } };
}

function umbrella(o: Opts): Prop {
  const g = G();
  cyl(g, 0.25, 0.25, 0.05, mat('#ddd', 0.4), 0, 0, 0, 20);
  cyl(g, 0.025, 0.025, 2.4, mat('#f5efe6', 0.4), 0, 0, 0, 8);
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.45, 12, 1, true), new THREE.MeshStandardMaterial({ color: c(o, 'color', '#ffffff'), roughness: 0.9, side: THREE.DoubleSide }));
  top.position.y = 2.35;
  add(g, top);
  return { obj: g, solid: { w: 0.3, d: 0.3 } };
}

function firepit(): Prop {
  const g = G();
  cyl(g, 1.0, 1.05, 0.4, mat('#8d877e', 0.9), 0, 0, 0, 32);
  cyl(g, 0.8, 0.8, 0.02, mat('#222', 0.9), 0, 0.4, 0, 32);
  for (let i = 0; i < 6; i++) { const l = cyl(g, 0.06, 0.06, 0.8, mat('#5a3b22', 0.9), 0, 0.45, 0, 8); l.rotation.set(Math.PI / 2, 0, (i / 6) * Math.PI); l.position.y = 0.5; }
  const flames = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const s = sprite(glowTexture(), 0.6, i % 2 ? 0xff7a1a : 0xffc14d, true);
    s.position.set((Math.random() - 0.5) * 0.5, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.5);
    flames.add(s);
  }
  g.add(flames);
  const light = new THREE.PointLight(0xff8a3a, 12, 10, 2);
  light.position.set(0, 1.3, 0);
  return {
    obj: g, solid: { w: 2, d: 2 }, light,
    tick: (t) => {
      flames.children.forEach((s, i) => {
        const k = (t * 1.6 + i * 0.37) % 1;
        s.position.y = 0.55 + k * 1.1;
        s.scale.setScalar(0.7 * (1 - k) + 0.1);
        (s as THREE.Sprite).material.opacity = 1 - k;
      });
      light.intensity = 10 + Math.sin(t * 13) * 1.5 + Math.sin(t * 7) * 1.5;
    },
  };
}

function outdoorSofa(o: Opts): Prop {
  const p = sofa({ color: c(o, 'color', '#f5efe6'), accent: c(o, 'accent', '#4fd1c5'), accent2: '#ffd36e', w: o.w ?? 2.6 });
  return p;
}

function cabana(o: Opts): Prop {
  const g = G();
  for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) cyl(g, 0.06, 0.06, 2.6, mat('#f5efe6', 0.5), x, 0, z, 10);
  box(g, 3.1, 0.12, 3.1, mat('#f5efe6', 0.5), 0, 2.6, 0);
  const curtain = new THREE.MeshStandardMaterial({ color: c(o, 'color', '#ffffff'), roughness: 0.9, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  for (const [x, z, ry] of [[-1.45, 0, Math.PI / 2], [1.45, 0, Math.PI / 2], [0, -1.45, 0]] as const) { const m = plane(g, 2.8, 2.5, curtain, x, 1.3, z); m.rotation.y = ry; }
  rbox(g, 2.4, 0.4, 2.0, mat('#ffffff', 0.9), 0, 0, -0.2, 0.1);
  for (let i = 0; i < 3; i++) rbox(g, 0.5, 0.4, 0.14, mat(['#ffd23f', '#ff6f91', '#4fd1c5'][i], 0.9), -0.7 + i * 0.7, 0.4, -1.05, 0.06);
  if (o.vip) {
    const sign = plane(g, 1.6, 0.4, picMat(textTexture('VIP CABANA', { color: '#ffd76a', glow: '#ffb000', size: 70 }), 2.5), 0, 2.85, 1.56);
    (sign.material as THREE.MeshStandardMaterial).transparent = true;
  }
  return { obj: g, solid: { w: 3, d: 3 } };
}

function hedge(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 2;
  rbox(g, w, o.h ?? 0.9, 0.6, LEAF2(), 0, 0, 0, 0.2);
  const r = seeded(w * 10);
  for (let i = 0; i < w * 3; i++) {
    const f = sph(g, 0.05, mat(['#ff6f91', '#ffffff', '#ffd23f'][i % 3], 0.6), -w / 2 + r() * w, 0.5 + r() * 0.45, 0.3);
    f.castShadow = false;
  }
  return { obj: g, solid: { w, d: 0.6 } };
}

function planter(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 1.2;
  rbox(g, w, 0.55, 0.6, mat('#d9cfc2', 0.8), 0, 0, 0, 0.04);
  const r = seeded(w * 7 + 1);
  for (let i = 0; i < w * 5; i++) sph(g, 0.15 + r() * 0.08, i % 2 ? LEAF() : LEAF2(), -w / 2 + 0.15 + r() * (w - 0.3), 0.65 + r() * 0.2, (r() - 0.5) * 0.3);
  for (let i = 0; i < w * 3; i++) { const f = sph(g, 0.05, mat(['#ff6f91', '#ffd23f', '#c77dff'][i % 3], 0.6), -w / 2 + 0.15 + r() * (w - 0.3), 0.85 + r() * 0.15, (r() - 0.5) * 0.4); f.castShadow = false; }
  return { obj: g, solid: { w, d: 0.6 } };
}

function bar(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 3;
  rbox(g, w, 1.05, 0.7, mat(c(o, 'color', '#b07a4f'), 0.6), 0, 0, 0, 0.04);
  box(g, w + 0.15, 0.06, 0.85, MARBLE(), 0, 1.05, 0);
  for (let i = 0; i < 6; i++) {
    cyl(g, 0.035, 0.03, 0.2, glass(['#ff6f91', '#ffd23f', '#4fd1c5'][i % 3], 0.75), -w / 2 + 0.4 + i * (w - 0.8) / 5, 1.11, -0.15, 10);
  }
  for (let i = 0; i < Math.floor(w / 0.75); i++) {
    const s = stool({ color: '#ffffff' });
    s.obj.position.set(-w / 2 + 0.4 + i * 0.75, 0, 0.75);
    g.add(s.obj);
  }
  return { obj: g, solid: { w, d: 1.2 } };
}

// ------------------------------------------------------------- pets

function petBed(o: Opts): Prop {
  const g = G();
  torus(g, 0.35, 0.12, mat(c(o, 'color', '#f6c6d6'), 0.95), 0, 0.12, 0).rotation.x = Math.PI / 2;
  cyl(g, 0.35, 0.35, 0.08, mat('#fff8ee', 0.95), 0, 0, 0, 24);
  return { obj: g };
}

function petBowls(): Prop {
  const g = G();
  rbox(g, 0.9, 0.12, 0.4, WALNUT(), 0, 0, 0, 0.03);
  for (const [x, col] of [[-0.22, '#c68660'], [0.22, '#6ec6ff']] as const) {
    cyl(g, 0.15, 0.12, 0.08, CHROME(), x, 0.12, 0, 24);
    cyl(g, 0.13, 0.13, 0.01, mat(col, 0.5), x, 0.19, 0, 24);
  }
  return { obj: g, solid: { w: 0.9, d: 0.4 } };
}

function petBath(): Prop {
  const g = G();
  rbox(g, 1.2, 0.9, 0.7, WHITE(), 0, 0, 0, 0.06);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), waterMaterial('#6ec6ff', '#e0f8ff'));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.86; g.add(water);
  for (let i = 0; i < 10; i++) sph(g, 0.05 + Math.random() * 0.04, mat('#ffffff', 0.2), (Math.random() - 0.5) * 0.9, 0.9, (Math.random() - 0.5) * 0.4);
  cyl(g, 0.015, 0.015, 0.5, CHROME(), 0.5, 0.9, -0.3, 8);
  return { obj: g, solid: { w: 1.2, d: 0.7 } };
}

function catTree(): Prop {
  const g = G();
  rbox(g, 0.7, 0.08, 0.7, mat('#d9cfc2', 0.95), 0, 0, 0, 0.03);
  cyl(g, 0.08, 0.08, 1.5, mat('#c9a77c', 1), 0, 0, 0, 12);
  for (const y of [0.6, 1.1, 1.5]) rbox(g, 0.5, 0.08, 0.5, mat('#f6c6d6', 0.95), (y - 1) * 0.3, y, 0, 0.03);
  return { obj: g, solid: { w: 0.7, d: 0.7 } };
}

function toys(): Prop {
  const g = G();
  const cols = ['#ff6f91', '#ffd23f', '#4fd1c5', '#9b7ede'];
  for (let i = 0; i < 6; i++) sph(g, 0.1, mat(cols[i % 4], 0.4), (Math.random() - 0.5) * 1.5, 0.1, (Math.random() - 0.5) * 1.5);
  torus(g, 0.12, 0.04, mat('#ffd23f', 0.5), 0.5, 0.04, 0.4).rotation.x = Math.PI / 2;
  return { obj: g };
}

// ------------------------------------------------------------- walls & signs

function poster(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 0.75;
  box(g, w + 0.06, w * 1.375 + 0.06, 0.03, mat(c(o, 'frame', '#1a1a1a'), 0.4), 0, (o.y ?? 1.25), 0);
  plane(g, w, w * 1.375, picMat(posterTexture((o.kind ?? 'abstract') as PosterKind), 0.3), 0, (o.y ?? 1.25) + (w * 1.375 + 0.06) / 2, 0.02);
  return { obj: g };
}

function neon(o: Opts): Prop {
  const g = G();
  const text = String(o.text ?? '♥');
  const col = c(o, 'color', '#ff4fa3');
  const w = o.w ?? Math.max(0.8, text.length * 0.42);
  // Short signs use a 2:1 canvas, long ones 4:1, with the font sized to fit.
  const long = [...text].length > 4;
  const cw = long ? 1024 : 512;
  const size = Math.min(190, Math.floor((cw * 0.92) / Math.max(1, [...text].length * 0.62)));
  const tex = textTexture(text, { color: '#ffffff', glow: col, w: cw, h: 256, size });
  const m = new THREE.MeshStandardMaterial({ map: tex, color: col, emissive: col, emissiveMap: tex, emissiveIntensity: 6, transparent: true, depthWrite: false });
  const hgt = w * (256 / cw);
  plane(g, w, hgt, m, 0, o.y ?? 1.8, 0.02);
  box(g, w, hgt, 0.02, glass('#ffffff', 0.08), 0, (o.y ?? 1.8) - hgt / 2, 0);
  return { obj: g };
}

function label(o: Opts): Prop {
  const g = G();
  const text = String(o.text ?? '');
  const tex = textTexture(text, { color: c(o, 'color', '#3a2f2a'), w: 1024, h: 160, size: 90, font: '600 90px "Segoe Script","Brush Script MT","Comic Sans MS",cursive' });
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: o.opacity ?? 0.42, depthWrite: false });
  const w = o.w ?? Math.min(5, 0.35 * text.length + 0.6);
  const mesh = decal(g, w, w * 0.156, m, 0, 0, 0.015);
  mesh.renderOrder = 2;
  return { obj: g };
}

function lift(o: Opts): Prop {
  const g = G();
  box(g, 2.2, 3.0, 0.3, mat('#2b2a2e', 0.35, 0.6), 0, 0, -0.15);
  box(g, 1.6, 2.4, 0.04, GOLD(), 0, 0, 0.02);
  box(g, 0.02, 2.36, 0.05, mat('#7a5c1c', 0.4, 1), 0, 0, 0.03);
  const panel = box(g, 0.14, 0.3, 0.03, glow('#ffd76a', 1.2), 1.0, 1.15, 0.03);
  panel.castShadow = false;
  const sign = plane(g, 0.9, 0.3, picMat(textTexture(String(o.text ?? 'LIFT'), { color: '#ffd76a', size: 80 }), 1.6), 0, 2.65, 0.05);
  (sign.material as THREE.MeshStandardMaterial).transparent = true;
  return { obj: g, solid: { w: 2.2, d: 0.4 } };
}

// ------------------------------------------------------------- car park

function pillar(): Prop {
  const g = G();
  box(g, 0.6, 3.2, 0.6, mat('#b9bbbf', 0.85), 0, 0, 0);
  box(g, 0.62, 0.3, 0.62, mat('#ffd23f', 0.6), 0, 0.3, 0);
  box(g, 0.62, 0.1, 0.62, mat('#111', 0.6), 0, 0.6, 0);
  return { obj: g, solid: { w: 0.6, d: 0.6 } };
}

function carWash(): Prop {
  const g = G();
  for (const x of [-1.7, 1.7]) box(g, 0.3, 3, 0.6, mat('#2b6cff', 0.4, 0.3), x, 0, 0);
  box(g, 3.7, 0.4, 0.6, mat('#2b6cff', 0.4, 0.3), 0, 3, 0);
  const brushes = new THREE.Group();
  for (const x of [-1.2, 1.2]) {
    const b = cyl(brushes, 0.35, 0.35, 2.4, mat(x < 0 ? '#ff6f91' : '#4fd1c5', 0.95), x, 0.3, 0, 16);
    b.castShadow = false;
  }
  g.add(brushes);
  const sign = plane(g, 2.6, 0.38, picMat(textTexture('CAR WASH', { color: '#ffffff', glow: '#7fd8ff', size: 80 }), 1.5), 0, 3.2, 0.31);
  (sign.material as THREE.MeshStandardMaterial).transparent = true;
  return { obj: g, tick: (t) => brushes.children.forEach((b) => { b.rotation.y = t * 4; }) };
}

function storage(): Prop {
  const g = G();
  for (let s = 0; s < 4; s++) box(g, 2, 0.05, 0.6, BLACKMETAL(), 0, s * 0.6, 0);
  for (const x of [-0.98, 0.98]) box(g, 0.04, 2.0, 0.6, BLACKMETAL(), x, 0, 0);
  const r = seeded(4);
  for (let s = 0; s < 3; s++) for (let i = 0; i < 4; i++) rbox(g, 0.4, 0.35, 0.45, mat(['#c9a77c', '#d9cfc2', '#ff6f91', '#4fd1c5'][Math.floor(r() * 4)], 0.9), -0.7 + i * 0.47, s * 0.6 + 0.05, 0, 0.02);
  return { obj: g, solid: { w: 2, d: 0.6 } };
}

// ------------------------------------------------------------- shop decor

function teddy(o: Opts): Prop {
  const g = G();
  const fur = mat(c(o, 'color', '#c9915e'), 1);
  sph(g, 0.35, fur, 0, 0.35, 0, 1, 1.05, 0.9);
  sph(g, 0.25, fur, 0, 0.85, 0.02);
  for (const x of [-0.17, 0.17]) sph(g, 0.09, fur, x, 1.05, 0);
  sph(g, 0.09, mat('#e8c9a8', 1), 0, 0.8, 0.22, 1, 0.8, 0.6);
  for (const x of [-0.08, 0.08]) sph(g, 0.03, mat('#111', 0.2), x, 0.9, 0.22);
  for (const x of [-0.3, 0.3]) sph(g, 0.12, fur, x, 0.45, 0.12);
  for (const x of [-0.18, 0.18]) sph(g, 0.13, fur, x, 0.1, 0.25, 1, 0.8, 1.2);
  torus(g, 0.12, 0.03, mat('#ff4f9a', 0.6), 0, 0.65, 0.05).rotation.x = Math.PI / 2;
  return { obj: g, solid: { w: 0.7, d: 0.7 } };
}

function beanbag(o: Opts): Prop {
  const g = G();
  sph(g, 0.5, mat(c(o, 'color', '#f3a6c8'), 0.95), 0, 0.3, 0, 1, 0.65, 1);
  sph(g, 0.4, mat(c(o, 'color', '#f3a6c8'), 0.95), 0, 0.55, -0.2, 1, 0.8, 0.6);
  return { obj: g, solid: { w: 1, d: 1 } };
}

function lavaLamp(o: Opts): Prop {
  const g = G();
  cyl(g, 0.08, 0.12, 0.2, CHROME(), 0, 0, 0, 16);
  cyl(g, 0.07, 0.09, 0.45, glass('#ffffff', 0.25), 0, 0.2, 0, 16);
  const blobs = new THREE.Group();
  for (let i = 0; i < 4; i++) { const b = sph(blobs, 0.035, glow(c(o, 'color', '#ff5fa2'), 2.5), 0, 0.3 + i * 0.1, 0); b.castShadow = false; }
  g.add(blobs);
  cyl(g, 0.03, 0.07, 0.1, CHROME(), 0, 0.65, 0, 16);
  return { obj: g, tick: (t) => blobs.children.forEach((b, i) => { b.position.y = 0.3 + ((t * 0.08 + i * 0.25) % 1) * 0.32; b.scale.setScalar(0.8 + Math.sin(t + i) * 0.3); }) };
}

function fairyLights(): Prop {
  const g = G();
  cyl(g, 0.012, 0.012, 1.9, GOLD(), -0.6, 0, 0, 6);
  cyl(g, 0.012, 0.012, 1.9, GOLD(), 0.6, 0, 0, 6);
  const bulbs = new THREE.Group();
  for (let k = 0; k < 3; k++) for (let i = 0; i <= 12; i++) {
    const x = -0.6 + (i / 12) * 1.2;
    const y = 1.85 - k * 0.5 - Math.sin((i / 12) * Math.PI) * 0.25;
    const b = sph(bulbs, 0.025, glow('#ffe7a8', 4), x, y, 0);
    b.castShadow = false;
  }
  g.add(bulbs);
  return { obj: g, tick: (t) => bulbs.children.forEach((b, i) => { b.visible = Math.sin(t * 2 + i * 1.7) > -0.6; }) };
}

function shark(): Prop {
  const g = G();
  const skin = mat('#6f93b8', 0.85);
  sph(g, 0.4, skin, 0, 0.65, 0, 0.75, 0.75, 1.5);
  sph(g, 0.3, mat('#f4f4f4', 0.9), 0, 0.55, 0.15, 0.7, 0.6, 1.3);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.38, 4), skin);
  fin.position.set(0, 1.05, 0); fin.scale.z = 0.3; add(g, fin);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 4), skin);
  tail.position.set(0, 0.7, -0.75); tail.rotation.x = -Math.PI / 2; tail.scale.x = 0.3; add(g, tail);
  for (const x of [-0.15, 0.15]) sph(g, 0.045, mat('#111', 0.2), x, 0.78, 0.48);
  for (const x of [-0.16, 0.16]) {
    cyl(g, 0.06, 0.06, 0.32, skin, x, 0.1, 0, 10);
    rbox(g, 0.18, 0.12, 0.32, mat('#2f80ed', 0.5), x, 0, 0.06, 0.04);
    box(g, 0.19, 0.04, 0.33, WHITE(), x, 0, 0.06);
  }
  return { obj: g, solid: { w: 0.7, d: 1.2 } };
}

function surfboard(o: Opts): Prop {
  const g = G();
  const b = sph(g, 1, mat(c(o, 'color', '#4fd1c5'), 0.3), 0, 1.05, 0, 0.27, 1.05, 0.05);
  b.rotation.x = -0.12;
  box(g, 0.02, 2, 0.02, WHITE(), 0, 0.05, 0.06);
  return { obj: g, solid: { w: 0.5, d: 0.3 } };
}

function trident(): Prop {
  const g = G();
  cyl(g, 0.15, 0.18, 0.12, mat('#1b3a5c', 0.4, 0.3), 0, 0, 0, 16);
  cyl(g, 0.02, 0.02, 1.6, GOLD(), 0, 0.1, 0, 8);
  for (const x of [-0.13, 0, 0.13]) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2, 8), GOLD());
    p.position.set(x, x === 0 ? 2.0 : 1.9, 0); add(g, p);
    cyl(g, 0.015, 0.015, x === 0 ? 0.25 : 0.18, GOLD(), x, 1.7, 0, 6);
  }
  box(g, 0.3, 0.03, 0.03, GOLD(), 0, 1.7, 0);
  const l = sph(g, 0.06, glow('#33c4ff', 3), 0, 1.6, 0);
  l.castShadow = false;
  return { obj: g, solid: { w: 0.35, d: 0.35 } };
}

function gamingChair(o: Opts): Prop {
  const g = G();
  const col = mat(c(o, 'color', '#ff6f91'), 0.6);
  cyl(g, 0.3, 0.3, 0.05, BLACKMETAL(), 0, 0.05, 0, 5);
  cyl(g, 0.03, 0.03, 0.45, CHROME(), 0, 0.05, 0, 8);
  rbox(g, 0.55, 0.12, 0.55, col, 0, 0.48, 0, 0.05);
  rbox(g, 0.55, 0.85, 0.12, col, 0, 0.6, -0.25, 0.05);
  rbox(g, 0.3, 0.2, 0.06, mat('#111', 0.6), 0, 1.15, -0.2, 0.03);
  return { obj: g, solid: { w: 0.6, d: 0.6 } };
}

function recordPlayer(): Prop {
  const g = G();
  rbox(g, 0.8, 0.6, 0.45, WALNUT(), 0, 0, 0, 0.02);
  rbox(g, 0.5, 0.1, 0.4, mat('#2a1a10', 0.4), 0, 0.6, 0, 0.02);
  const disc = cyl(g, 0.15, 0.15, 0.01, mat('#111', 0.3, 0.3), -0.05, 0.7, 0, 32);
  box(g, 0.02, 0.02, 0.2, CHROME(), 0.17, 0.72, 0);
  return { obj: g, solid: { w: 0.8, d: 0.45 }, tick: (t) => { disc.rotation.y = t * 3; } };
}

function discoBall(): Prop {
  const g = G();
  cyl(g, 0.005, 0.005, 0.6, CHROME(), 0, 2.2, 0, 4);
  const ball = sph(g, 0.25, mat('#ffffff', 0.05, 1), 0, 2.05, 0);
  ball.castShadow = false;
  const flecks = new THREE.Group();
  for (let i = 0; i < 20; i++) {
    const s = sprite(glowTexture(), 0.15, [0xff6fd8, 0x6fd8ff, 0xffffff][i % 3], true);
    const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI;
    s.position.set(Math.cos(a) * Math.sin(b) * 0.27, 2.05 + Math.cos(b) * 0.27, Math.sin(a) * Math.sin(b) * 0.27);
    flecks.add(s);
  }
  g.add(flecks);
  cyl(g, 0.2, 0.2, 0.03, BLACKMETAL(), 0, 0, 0, 16);
  cyl(g, 0.012, 0.012, 2.2, BLACKMETAL(), 0, 0, 0, 6);
  return { obj: g, tick: (t) => { ball.rotation.y = t; flecks.rotation.y = t; } };
}

function aquarium(): Prop {
  const g = G();
  box(g, 1.4, 0.8, 0.5, WALNUT(), 0, 0, 0);
  box(g, 1.4, 0.7, 0.5, glass('#7fd8ff', 0.35), 0, 0.8, 0);
  box(g, 1.38, 0.08, 0.48, mat('#e8d9a8', 1), 0, 0.8, 0);
  const fish = new THREE.Group();
  for (let i = 0; i < 6; i++) { const f = sph(fish, 0.05, mat(['#ff9f1c', '#ff6f91', '#ffd23f', '#33e1ff'][i % 4], 0.4), 0, 0, 0, 1.4, 0.8, 0.5); f.castShadow = false; }
  g.add(fish);
  for (let i = 0; i < 5; i++) cyl(g, 0.02, 0.03, 0.3 + (i % 2) * 0.15, LEAF(), -0.55 + i * 0.27, 0.88, -0.1, 6);
  const l = box(g, 1.4, 0.04, 0.5, glow('#bfefff', 1.2), 0, 1.5, 0);
  l.castShadow = false;
  return {
    obj: g, solid: { w: 1.4, d: 0.5 },
    tick: (t) => fish.children.forEach((f, i) => {
      const a = t * (0.4 + i * 0.07) + i;
      f.position.set(Math.sin(a) * 0.55, 1.05 + Math.sin(a * 1.7 + i) * 0.18, Math.cos(a * 0.8) * 0.12);
      f.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
    }),
  };
}

function statue(): Prop {
  const g = G();
  box(g, 0.6, 0.8, 0.6, MARBLE(), 0, 0, 0);
  const gold = mat('#ffd23f', 0.2, 1);
  sph(g, 0.22, gold, 0, 1.2, 0, 1, 1.4, 0.8);
  sph(g, 0.16, gold, 0, 1.62, 0);
  for (const x of [-0.25, 0.25]) { const a = cyl(g, 0.05, 0.05, 0.4, gold, x, 1.1, 0, 8); a.rotation.z = x > 0 ? -0.5 : 0.5; }
  const crown = cyl(g, 0.12, 0.1, 0.1, gold, 0, 1.76, 0, 8);
  crown.castShadow = false;
  return { obj: g, solid: { w: 0.6, d: 0.6 } };
}

function miniFridge(): Prop {
  const g = G();
  rbox(g, 0.55, 0.85, 0.5, mat('#ffd6e7', 0.35), 0, 0, 0, 0.05);
  box(g, 0.45, 0.6, 0.02, glass('#ffffff', 0.4), 0, 0.15, 0.255);
  for (let i = 0; i < 4; i++) cyl(g, 0.03, 0.03, 0.12, mat(['#ff6f91', '#4fd1c5', '#ffd23f', '#9b7ede'][i], 0.4), -0.15 + i * 0.1, 0.3, 0.1, 8);
  const l = box(g, 0.45, 0.02, 0.4, glow('#ffffff', 1), 0, 0.72, 0);
  l.castShadow = false;
  return { obj: g, solid: { w: 0.55, d: 0.5 } };
}

function books(): Prop {
  const g = G();
  for (let i = 0; i < 4; i++) box(g, 0.28 - i * 0.02, 0.05, 0.2, mat(['#2b6cff', '#ff9f1c', '#33e1ff', '#1b3a5c'][i], 0.7), 0, i * 0.05, 0, i * 0.2);
  return { obj: g };
}

function stand(o: Opts): Prop {
  const g = G();
  cyl(g, 0.25, 0.3, 0.9, mat(c(o, 'color', '#ffffff'), 0.4), 0, 0, 0, 24);
  return { obj: g, solid: { w: 0.55, d: 0.55 } };
}

// ------------------------------------------------------------- villa

function eggChair(o: Opts): Prop {
  const g = G();
  const rattan = mat('#c9a06a', 0.85);
  cyl(g, 0.3, 0.35, 0.05, mat('#e9e2d8', 0.6), 0, 0, 0, 24);
  cyl(g, 0.02, 0.02, 2.0, GOLD(), 0, 0, -0.35, 8);
  const arm = box(g, 0.04, 0.04, 0.5, GOLD(), 0, 1.98, -0.12);
  arm.castShadow = false;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.48, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.72), rattan);
  shell.rotation.x = -Math.PI / 2 - 0.4;
  shell.position.set(0, 1.12, 0.05);
  shell.scale.set(1, 1, 1.25);
  (shell.material as THREE.Material).side = THREE.DoubleSide;
  add(g, shell);
  rbox(g, 0.5, 0.14, 0.45, mat(c(o, 'color', '#ffffff'), 0.95), 0, 0.82, 0.12, 0.07);
  rbox(g, 0.32, 0.3, 0.1, mat(c(o, 'accent', '#ff6f91'), 0.95), 0, 0.95, -0.12, 0.05);
  return { obj: g, solid: { w: 0.8, d: 0.8 } };
}

function daybed(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 2.2;
  rbox(g, w, 0.35, 1.8, mat('#e9e2d8', 0.7), 0, 0, 0, 0.06);
  rbox(g, w - 0.1, 0.18, 1.7, mat(c(o, 'color', '#ffffff'), 0.95), 0, 0.35, 0, 0.08);
  rbox(g, w, 0.55, 0.22, mat('#e9e2d8', 0.7), 0, 0.35, -0.8, 0.06);
  const cols = [c(o, 'accent', '#ff6f91'), '#ffd23f', '#4fd1c5', '#ffffff'];
  for (let i = 0; i < 4; i++) rbox(g, 0.42, 0.38, 0.14, mat(cols[i % 4], 0.95), -w / 2 + 0.35 + i * (w - 0.7) / 3, 0.5, -0.6, 0.07);
  return { obj: g, solid: { w, d: 1.8 } };
}

function festoon(o: Opts): Prop {
  const g = G();
  const len = o.len ?? 8;
  for (const x of [-len / 2, len / 2]) {
    cyl(g, 0.05, 0.06, 3.4, mat('#4a3426', 0.8), x, 0, 0, 8);
    cyl(g, 0.12, 0.14, 0.15, mat('#d9cfc2', 0.8), x, 0, 0, 12);
  }
  const bulbs = new THREE.Group();
  const n = Math.round(len * 2.5);
  const wire: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = -len / 2 + t * len;
    const y = 3.35 - Math.sin(t * Math.PI) * 0.7;
    wire.push(new THREE.Vector3(x, y, 0));
    if (i > 0 && i < n) {
      const b = sph(bulbs, 0.055, glow(i % 3 === 0 ? '#ffd9a0' : '#fff1c9', 5), x, y - 0.08, 0, 0.8, 1.1, 0.8);
      b.castShadow = false;
    }
  }
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wire), 40, 0.01, 4), mat('#222', 0.6));
  g.add(tube);
  g.add(bulbs);
  return { obj: g };
}

function tikiTorch(): Prop {
  const g = G();
  cyl(g, 0.03, 0.04, 1.6, mat('#8a6a4a', 0.9), 0, 0, 0, 6);
  cyl(g, 0.09, 0.06, 0.22, mat('#b07a4f', 0.9), 0, 1.55, 0, 10);
  const flames: THREE.Sprite[] = [];
  for (let i = 0; i < 4; i++) {
    const f = sprite(glowTexture(), 0.4, i % 2 ? 0xff8a2a : 0xffc860, true);
    f.position.set(0, 1.85 + i * 0.06, 0);
    g.add(f);
    flames.push(f);
  }
  return {
    obj: g, solid: { w: 0.2, d: 0.2 },
    tick: (t) => flames.forEach((f, i) => { const k = (t * 2.2 + i * 0.27) % 1; f.position.y = 1.78 + k * 0.35; f.scale.setScalar(0.42 * (1 - k) + 0.08); f.material.opacity = 1 - k; }),
  };
}

function flamingo(o: Opts): Prop {
  const g = G();
  const pink = mat(c(o, 'color', '#ff8fb8'), 0.35);
  const ring = torus(g, 0.55, 0.2, pink, 0, 0, 0);
  ring.rotation.x = Math.PI / 2;
  const neck = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, -0.5), new THREE.Vector3(0, 0.5, -0.65), new THREE.Vector3(0, 0.95, -0.45), new THREE.Vector3(0, 1.0, -0.25)]), 20, 0.09, 10), pink);
  add(g, neck);
  sph(g, 0.15, pink, 0, 1.0, -0.22);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 8), mat('#222', 0.4));
  beak.rotation.x = Math.PI / 2 + 0.4;
  beak.position.set(0, 0.95, -0.06);
  add(g, beak);
  for (const x of [-0.07, 0.07]) sph(g, 0.025, mat('#111', 0.2), x, 1.05, -0.12);
  const base = o.y ?? -0.1;
  return { obj: g, tick: (t) => { g.position.y = base + Math.sin(t * 1.3) * 0.04; g.rotation.y = Math.sin(t * 0.2) * 0.6; } };
}

function hutChair(o: Opts): Prop {
  const g = G();
  const rattan = mat('#b98a52', 0.8);
  rbox(g, 0.8, 0.45, 0.7, rattan, 0, 0, 0, 0.08);
  const back = new THREE.Mesh(new THREE.CircleGeometry(0.95, 40, 0, Math.PI), rattan);
  back.position.set(0, 0.5, -0.32);
  (back.material as THREE.Material).side = THREE.DoubleSide;
  add(g, back);
  torus(g, 0.95, 0.04, mat('#8a6236', 0.8), 0, 0.5, -0.31, Math.PI);
  rbox(g, 0.72, 0.14, 0.6, mat(c(o, 'color', '#ff6f91'), 0.95), 0, 0.45, 0.02, 0.06);
  rbox(g, 0.5, 0.4, 0.12, mat('#ffffff', 0.95), 0, 0.6, -0.26, 0.06);
  return { obj: g, solid: { w: 1.2, d: 0.8 } };
}

function camera(): Prop {
  const g = G();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = cyl(g, 0.015, 0.015, 1.4, BLACKMETAL(), Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25, 6);
    leg.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2);
  }
  rbox(g, 0.3, 0.22, 0.4, BLACKMETAL(), 0, 1.35, 0, 0.03);
  cyl(g, 0.08, 0.09, 0.2, mat('#111', 0.2, 0.5), 0, 1.46, 0.28, 16).rotation.x = Math.PI / 2;
  const rec = sph(g, 0.025, glow('#ff2030', 4), 0.1, 1.6, 0.1);
  rec.castShadow = false;
  return { obj: g, solid: { w: 0.5, d: 0.5 } };
}

function podium(): Prop {
  const g = G();
  rbox(g, 0.7, 1.05, 0.5, mat('#ffffff', 0.3), 0, 0, 0, 0.05);
  box(g, 0.74, 0.04, 0.54, GOLD(), 0, 1.05, 0);
  const heart = plane(g, 0.42, 0.42, new THREE.MeshStandardMaterial({ map: textTexture('♥', { color: '#ffffff', glow: '#ff2d75', w: 256, h: 256, size: 220 }), color: '#ff2d75', emissive: '#ff2d75', emissiveIntensity: 4, transparent: true }), 0, 0.6, 0.26);
  heart.castShadow = false;
  return { obj: g, solid: { w: 0.7, d: 0.5 } };
}

function stage(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 8;
  rbox(g, w, 0.5, 3, mat('#1d1b26', 0.4, 0.3), 0, 0, 0, 0.05);
  const edge = box(g, w + 0.02, 0.06, 0.06, glow('#ff3df0', 4), 0, 0.46, 1.5);
  edge.castShadow = false;
  box(g, w * 0.7, 2.6, 0.2, BLACKMETAL(), 0, 0.5, -1.2);
  const screen = plane(g, w * 0.66, 2.3, new THREE.MeshStandardMaterial({ map: textTexture(String(o.text ?? '♥ CHALLENGE ♥'), { color: '#ffffff', bg: '#ff2d75', w: 1024, h: 360, size: 120 }), emissive: '#ffffff', emissiveIntensity: 0.9, emissiveMap: textTexture(String(o.text ?? '♥ CHALLENGE ♥'), { color: '#ffffff', bg: '#ff2d75', w: 1024, h: 360, size: 120 }) }), 0, 1.95, -1.09);
  screen.castShadow = false;
  return { obj: g, solid: { w, d: 3 } };
}

function flowerArch(): Prop {
  const g = G();
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.4, 0, 0), new THREE.Vector3(-1.4, 2.2, 0), new THREE.Vector3(0, 3.1, 0), new THREE.Vector3(1.4, 2.2, 0), new THREE.Vector3(1.4, 0, 0)]);
  add(g, new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.06, 8), mat('#ffffff', 0.5)));
  const cols = ['#ff6f91', '#ffffff', '#ffb3c9', '#ffd23f', '#c77dff'];
  for (let i = 0; i < 70; i++) {
    const p = curve.getPoint(Math.random());
    const leaf = i % 3 === 0;
    const m = sph(g, leaf ? 0.12 : 0.09, leaf ? LEAF() : mat(cols[i % cols.length], 0.6), p.x + (Math.random() - 0.5) * 0.2, p.y + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.25);
    m.castShadow = false;
  }
  return { obj: g };
}

function lantern(o: Opts): Prop {
  const g = G();
  const h = o.h ?? 0.6;
  rbox(g, 0.3, 0.04, 0.3, mat('#2a2a2a', 0.5), 0, 0, 0, 0.01);
  for (const [x, z] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) box(g, 0.02, h, 0.02, mat('#2a2a2a', 0.5), x, 0, z);
  box(g, 0.26, h - 0.05, 0.26, glass('#fff3d6', 0.35), 0, 0.03, 0);
  const flame = sph(g, 0.05, glow('#ffb347', 5), 0, h * 0.45, 0, 0.8, 1.4, 0.8);
  flame.castShadow = false;
  rbox(g, 0.3, 0.06, 0.3, mat('#2a2a2a', 0.5), 0, h, 0, 0.02);
  return { obj: g };
}

function hammock(): Prop {
  const g = G();
  for (const x of [-1.6, 1.6]) cyl(g, 0.06, 0.07, 1.6, mat('#8a6a4a', 0.9), x, 0, 0, 8);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.55, 1.4, 0), new THREE.Vector3(0, 0.65, 0), new THREE.Vector3(1.55, 1.4, 0)]);
  const net = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.38, 3, false), mat('#ffffff', 0.95));
  net.scale.z = 0.1;
  net.rotation.x = 0;
  add(g, net);
  rbox(g, 0.5, 0.12, 0.3, mat('#ff6f91', 0.95), 0, 0.78, 0, 0.05);
  return { obj: g, solid: { w: 3.3, d: 0.6 } };
}

function telescope(): Prop {
  const g = G();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = cyl(g, 0.012, 0.012, 1.1, GOLD(), Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2, 6);
    leg.rotation.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18);
  }
  const tube = cyl(g, 0.07, 0.05, 0.9, mat('#1b3a5c', 0.3, 0.5), 0, 1.05, 0, 16);
  tube.rotation.x = -0.9;
  return { obj: g, solid: { w: 0.45, d: 0.45 } };
}

function floorCushions(): Prop {
  const g = G();
  const cols = ['#ff6f91', '#ffd23f', '#4fd1c5', '#ffffff', '#c77dff', '#ff9f1c'];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    rbox(g, 0.6, 0.18, 0.6, mat(cols[i], 0.95), Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9, 0.08, a);
  }
  rug({ round: true, w: 2.6, color: '#f2e6cf' }).obj.children.forEach((m) => g.add(m.clone()));
  return { obj: g };
}

function volleyNet(): Prop {
  const g = G();
  for (const x of [-4, 4]) cyl(g, 0.05, 0.05, 2.4, mat('#ffffff', 0.5), x, 0, 0, 8);
  const net = plane(g, 8, 0.9, new THREE.MeshStandardMaterial({ color: '#222', transparent: true, opacity: 0.45, side: THREE.DoubleSide, wireframe: false }), 0, 1.95, 0);
  net.castShadow = false;
  box(g, 8, 0.06, 0.02, mat('#ffffff', 0.5), 0, 2.37, 0);
  sph(g, 0.12, mat('#ffffff', 0.5), 1.5, 0.12, 1.5);
  return { obj: g, solid: { w: 8.2, d: 0.2 } };
}

// ------------------------------------------------------------- fun

/** The water slide's path, in the slide prop's local space (top → pool). */
export function slideCurve(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 4.3, 0), new THREE.Vector3(1.2, 3.9, -0.9), new THREE.Vector3(0.9, 3.3, -2.3),
    new THREE.Vector3(-0.6, 2.7, -2.9), new THREE.Vector3(-1.9, 2.1, -2.1), new THREE.Vector3(-1.5, 1.4, -0.8),
    new THREE.Vector3(-2.3, 0.8, -0.4), new THREE.Vector3(-3.3, 0.35, -1.4), new THREE.Vector3(-4.0, -0.1, -2.6),
  ]);
}

function waterSlide(): Prop {
  const g = G();
  const white = mat('#f7f5f2', 0.4);
  for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) cyl(g, 0.07, 0.07, 4.3, white, x, 0, z, 10);
  box(g, 1.6, 0.12, 1.6, mat('#4fd1c5', 0.4), 0, 4.2, 0);
  for (let i = 0; i < 4; i++) box(g, 1.6, 0.05, 0.05, white, 0, 4.4 + i * 0.12, -0.78);
  for (let i = 0; i < 14; i++) box(g, 0.9, 0.06, 0.3, mat('#ff6f91', 0.5), 1.2, i * 0.3, 0.8 - i * 0.06);
  const curve = slideCurve();
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.5, 14, false), new THREE.MeshPhysicalMaterial({ color: '#ffd23f', roughness: 0.2, clearcoat: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  tube.castShadow = true;
  g.add(tube);
  const water = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.42, 10, false), new THREE.MeshStandardMaterial({ color: '#7fe7f5', transparent: true, opacity: 0.35, side: THREE.BackSide }));
  g.add(water);
  for (const t of [0.2, 0.4, 0.6, 0.78]) {
    const p = curve.getPoint(t);
    if (p.y > 0.3) cyl(g, 0.06, 0.06, p.y - 0.45, white, p.x, 0, p.z, 8);
  }
  return { obj: g, solid: { w: 1.6, d: 1.6 } };
}

function gantry(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 5;
  for (const x of [-w / 2, w / 2]) cyl(g, 0.1, 0.1, 3.6, mat('#ffffff', 0.4), x, 0, 0, 10);
  const tex = textTexture(String(o.text ?? '🏁 START  ·  FINISH 🏁'), { color: '#ffffff', bg: '#111111', w: 1024, h: 160, size: 76 });
  // Two one-sided banners back to back, so the words read correctly from both directions.
  const bm = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.6 });
  const banner = plane(g, w, w * 0.156, bm, 0, 3.3, 0.01);
  banner.castShadow = true;
  plane(g, w, w * 0.156, bm, 0, 3.3, -0.01).rotation.y = Math.PI;
  // Checkered line on the road
  const c = document.createElement('canvas');
  c.width = 256; c.height = 32;
  const x = c.getContext('2d')!;
  for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 16, j * 16, 16, 16); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  decal(g, w, 0.6, new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }), 0, 0, 0.02);
  return { obj: g };
}

function cone(): Prop {
  const g = G();
  box(g, 0.4, 0.04, 0.4, mat('#ff6a00', 0.6), 0, 0, 0);
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.55, 16), mat('#ff6a00', 0.5));
  c.position.y = 0.3;
  add(g, c);
  const band = cyl(g, 0.095, 0.115, 0.08, mat('#ffffff', 0.4), 0, 0.27, 0, 16);
  band.castShadow = false;
  return { obj: g };
}

/** A gold scallop shell (for the hidden shell hunt). */
export function goldenShell(): THREE.Group {
  const g = G();
  const gold = mat('#ffcf4a', 0.2, 1, '#ffb300', 0.35);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 10, 0, Math.PI, 0, Math.PI / 2), gold);
  shell.rotation.x = -Math.PI / 2;
  shell.scale.set(1, 1, 0.35);
  g.add(shell);
  for (let i = 0; i < 7; i++) {
    const a = (i / 6) * Math.PI;
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), gold);
    rib.position.set(Math.cos(a) * 0.11, Math.sin(a) * 0.11, 0.05);
    rib.rotation.z = a - Math.PI / 2;
    g.add(rib);
  }
  box(g, 0.08, 0.06, 0.06, gold, 0, -0.03, 0.02);
  const s = sprite(glowTexture(), 1.0, 0xffd76a, true);
  s.material.opacity = 0.6;
  g.add(s);
  return g;
}

/** Furniture whose builder uses the chosen colour directly. */
export const COLOR_MODELS = new Set(['arcade', 'claw', 'popcorn', 'cinemaseats', 'bed', 'canopybed', 'rug', 'beanbag', 'lavalamp', 'surfboard', 'gamingchair', 'neon', 'teddy', 'floorlamp', 'vanity', 'bookshelf', 'shelf', 'closet', 'sofa', 'armchair', 'desk']);

/** Tints every solid, non-glowing material of an object toward a colour (for furniture without a colour option). */
export function tint(obj: THREE.Object3D, color: string): void {
  const c = new THREE.Color(color);
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const src = m.material as THREE.MeshStandardMaterial;
    if (!src.color || src.transparent || (src.emissiveIntensity ?? 0) > 0.5) return;
    const mm = src.clone();
    mm.color.lerp(c, 0.6);
    m.material = mm;
  });
}

/** Icon used for a task or action station. */
export function stationMarker(emoji: string, color: string): Prop {
  const g = G();
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(ring);
  const glowS = sprite(glowTexture(), 1.6, new THREE.Color(color).getHex(), true);
  glowS.position.y = 0.2;
  (glowS.material as THREE.SpriteMaterial).opacity = 0.35;
  g.add(glowS);
  const icon = sprite(emojiTexture(emoji, color), 0.7);
  icon.position.y = 2.3;
  g.add(icon);
  return {
    obj: g,
    tick: (t) => {
      icon.position.y = 2.3 + Math.sin(t * 2.2) * 0.1;
      ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
    },
  };
}

// ------------------------------------------------------------- registry

export const PROPS: Record<string, (o: Opts) => Prop> = {
  bed, canopybed: canopyBed, nightstand, rack: wardrobeRack, closet, vanity, mirror, desk, shelf, bookshelf: (o) => shelf({ w: 1, h: 1.8, ...o }),
  sofa, sectional, armchair, coffeetable: coffeeTable, rug, tv, diningtable: diningTable, chair, stool, plant, palm, floorlamp: floorLamp, chandelier,
  island: kitchenIsland, counter, fridge, sushibar: sushiBar, reception: receptionDesk, stairs: grandStairs,
  toilet, sink, bathtub, shower, spabed: spaBed, candles, hottub: hotTub,
  treadmill, bike, bench: weightBench, dumbbells: dumbbellRack, yogamat: yogaMat, reformer,
  djbooth: djBooth, speaker, piano, guitar, mic, drums, mixer: mixingDesk, vinylwall: vinylWall,
  sunbed, umbrella, firepit, outdoorsofa: outdoorSofa, cabana, hedge, planter, bar,
  petbed: petBed, petbowls: petBowls, petbath: petBath, cattree: catTree, toys,
  poster, neon, label, lift,
  pillar, carwash: carWash, storage,
  teddy, beanbag, lavalamp: lavaLamp, fairylights: fairyLights, shark, surfboard, trident, gamingchair: gamingChair,
  recordplayer: recordPlayer, discoball: discoBall, aquarium, statue, minifridge: miniFridge, books, stand,
  eggchair: eggChair, daybed, festoon, tikitorch: tikiTorch, flamingo, hutchair: hutChair, camera, podium, stage, arch: flowerArch,
  lantern, hammock, telescope, cushions: floorCushions, volleynet: volleyNet,
  waterslide: waterSlide, gantry, cone,
  ...PROPS2,
};

export function makeProp(type: string, o: Opts = {}): Prop {
  const f = PROPS[type];
  if (!f) throw new Error(`Unknown prop ${type}`);
  return f(o);
}

function seeded(seed: number) {
  let s = Math.floor(seed * 1000) >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
