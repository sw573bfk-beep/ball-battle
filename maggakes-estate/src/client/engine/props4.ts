import * as THREE from 'three';
import { CHROME, MARBLE, WHITE, box, cyl, glass, glow, mat, plane, rbox, sph, type Opts, type Prop } from './props';
import { textTexture, emojiTexture } from './tex';

/** Furniture for the outside world: beach, mall and town. */

const G = () => new THREE.Group();
const c = (o: Opts, k: string, d: string) => (o[k] as string) ?? d;

function emojiSprite(e: string, size: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(e), transparent: true, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

/** A shop front: wall, big window with goods, door and a sign. Faces +Z. */
function shopfront(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 5, h = o.h ?? 3.4;
  const col = c(o, 'color', '#ff6fb5');
  box(g, w, h, 0.4, mat(c(o, 'wall', '#f7f1ea'), 0.7), 0, 0, -0.2);
  box(g, w, 0.5, 0.5, mat(col, 0.5), 0, h - 0.5, 0);
  const tex = textTexture(String(o.text ?? 'SHOP'), { color: '#ffffff', bg: col, w: 1024, h: 160, size: 90 });
  plane(g, w - 0.3, 0.44, new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.25 }), 0, h - 0.47, 0.26);
  box(g, w * 0.55, 1.7, 0.05, glass('#d8f1ff', 0.35), -w * 0.18, 0.5, 0.02);
  box(g, 1.1, 2.2, 0.05, mat('#3a2f2a', 0.5), w / 2 - 0.9, 0, 0.02);
  sph(g, 0.04, mat('#d8b45a', 0.3, 1), w / 2 - 0.5, 1.1, 0.08);
  const goods = String(o.goods ?? '👗👜👠');
  [...goods].filter((ch) => ch.trim() && ch !== '️').slice(0, 4).forEach((e, i) => { const s = emojiSprite(e, 0.5); s.position.set(-w * 0.18 - 0.8 + i * 0.55, 1.3, -0.1); g.add(s); });
  // awning
  const aw = box(g, w * 0.6, 0.06, 0.8, mat(col, 0.6), -w * 0.18, 2.35, 0.4); aw.rotation.x = 0.25;
  return { obj: g, solid: { w, d: 0.5 } };
}

/** Round fountain with an animated water jet. */
function fountain(o: Opts): Prop {
  const g = G();
  const r = o.r ?? 1.6;
  cyl(g, r, r + 0.1, 0.55, MARBLE(), 0, 0, 0, 32);
  const water = cyl(g, r - 0.12, r - 0.12, 0.04, glass('#5fb8e8', 0.8), 0, 0.5, 0, 32); water.castShadow = false;
  cyl(g, 0.18, 0.25, 1.2, MARBLE(), 0, 0.5, 0, 16);
  cyl(g, 0.6, 0.5, 0.15, MARBLE(), 0, 1.6, 0, 24);
  const jetM = new THREE.MeshStandardMaterial({ color: '#cfeeff', transparent: true, opacity: 0.6, emissive: '#cfeeff', emissiveIntensity: 0.3 });
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.0, 12, 1, true), jetM); jet.position.y = 2.2; g.add(jet);
  const drops: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) drops.push(sph(g, 0.05, jetM, 0, 2, 0));
  return { obj: g, solid: { w: r * 2, d: r * 2 }, tick: (t) => { jet.scale.y = 0.85 + Math.sin(t * 6) * 0.15; drops.forEach((d, i) => { const k = (t * 0.9 + i / 10) % 1, a = i * 0.63; d.position.set(Math.sin(a) * k * 0.7, 2.6 - k * k * 2.0, Math.cos(a) * k * 0.7); }); } };
}

function lifeguardTower(o: Opts): Prop {
  const g = G();
  const wood = mat('#f5efe6', 0.6);
  for (const x of [-0.6, 0.6]) for (const z of [-0.6, 0.6]) { const leg = cyl(g, 0.06, 0.06, 2.2, wood, x, 0, z, 8); leg.rotation.z = x * 0.05; }
  rbox(g, 1.6, 0.12, 1.6, wood, 0, 2.2, 0, 0.03);
  box(g, 1.6, 0.9, 0.08, mat(c(o, 'color', '#e63946'), 0.5), 0, 2.3, -0.8);
  for (const x of [-0.8, 0.8]) box(g, 0.08, 0.6, 1.6, mat(c(o, 'color', '#e63946'), 0.5), x, 2.3, 0);
  const roof = box(g, 1.9, 0.08, 1.9, mat('#ffffff', 0.5), 0, 3.3, 0); roof.rotation.x = 0.1;
  for (const x of [-0.75, 0.75]) cyl(g, 0.04, 0.04, 1.0, wood, x, 2.3, 0.75, 6);
  const tex = textTexture('LIFEGUARD', { color: '#ffffff', bg: '#e63946', w: 512, h: 96, size: 64 });
  plane(g, 1.4, 0.26, new THREE.MeshStandardMaterial({ map: tex }), 0, 2.85, -0.75);
  return { obj: g, solid: { w: 1.5, d: 1.5 } };
}

function sandcastle(o: Opts): Prop {
  const g = G();
  const sand = mat('#e8cf98', 0.95);
  box(g, 1.2, 0.35, 1.2, sand, 0, 0, 0);
  for (const x of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) { cyl(g, 0.18, 0.2, 0.7, sand, x, 0, z, 12); const top = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 12), sand); top.position.set(x, 0.85, z); g.add(top); }
  cyl(g, 0.3, 0.35, 0.9, sand, 0, 0.3, 0, 14);
  const flag = emojiSprite(c(o, 'flag', '🚩'), 0.3); flag.position.y = 1.5; g.add(flag);
  return { obj: g, solid: { w: 1.4, d: 1.4 } };
}

function streetLamp(o: Opts): Prop {
  const g = G();
  cyl(g, 0.08, 0.12, 3.4, mat('#2a2d34', 0.4, 0.6), 0, 0, 0, 10);
  const arm = box(g, 0.06, 0.06, 0.8, mat('#2a2d34', 0.4, 0.6), 0, 3.35, 0.35); arm.castShadow = false;
  const lamp = sph(g, 0.16, glow(c(o, 'color', '#fff2cc'), 2.5), 0, 3.25, 0.7); lamp.castShadow = false;
  return { obj: g, solid: { w: 0.3, d: 0.3 } };
}

function busStop(o: Opts): Prop {
  const g = G();
  const frame = mat('#2a2d34', 0.4, 0.6);
  for (const x of [-1.3, 1.3]) box(g, 0.08, 2.4, 0.08, frame, x, 0, -0.5);
  box(g, 2.8, 0.08, 1.2, frame, 0, 2.4, 0);
  box(g, 2.7, 2.0, 0.04, glass('#d8f1ff', 0.3), 0, 0.3, -0.55);
  rbox(g, 2.2, 0.08, 0.4, mat(c(o, 'color', '#33a8ff'), 0.5), 0, 0.5, -0.3, 0.02);
  const tex = textTexture('🚌 BUS STOP', { color: '#ffffff', bg: '#33a8ff', w: 512, h: 96, size: 60 });
  plane(g, 1.4, 0.26, new THREE.MeshStandardMaterial({ map: tex }), 0, 2.7, 0);
  return { obj: g, solid: { w: 2.8, d: 0.6 } };
}

function swingSet(o: Opts): Prop {
  const g = G();
  const pole = mat(c(o, 'color', '#ff6fb5'), 0.5);
  for (const x of [-1.6, 1.6]) for (const z of [-0.5, 0.5]) { const l = cyl(g, 0.06, 0.06, 2.6, pole, x, 0, z * 0.2, 8); l.rotation.x = z * 0.35; }
  const bar = cyl(g, 0.06, 0.06, 3.3, pole, -1.65, 2.5, 0, 8); bar.rotation.z = Math.PI / 2; bar.position.set(0, 2.5, 0);
  const seats: THREE.Object3D[] = [];
  for (const x of [-0.7, 0.7]) { const sw = G(); sw.position.set(x, 2.5, 0); g.add(sw); seats.push(sw); for (const dx of [-0.2, 0.2]) cyl(sw, 0.01, 0.01, 1.9, CHROME(), dx, -1.9, 0, 4); box(sw, 0.5, 0.05, 0.2, mat('#ffd23f', 0.5), 0, -1.95, 0); }
  return { obj: g, solid: { w: 3.4, d: 0.8 }, tick: (t) => seats.forEach((s, i) => { s.rotation.x = Math.sin(t * 1.6 + i * 1.4) * 0.35; }) };
}

function slide(o: Opts): Prop {
  const g = G();
  const col = c(o, 'color', '#33a8ff');
  for (const x of [-0.4, 0.4]) for (const z of [-0.4, 0.4]) cyl(g, 0.05, 0.05, 1.8, mat('#ffd23f', 0.5), x, 0, z - 0.8, 8);
  box(g, 0.9, 0.08, 0.9, mat('#ffd23f', 0.5), 0, 1.8, -0.8);
  const ch = box(g, 0.7, 0.06, 2.6, mat(col, 0.3), 0, 0.9, 0.9); ch.rotation.x = 0.62;
  for (let i = 0; i < 5; i++) box(g, 0.7, 0.05, 0.1, mat('#ffd23f', 0.5), 0, 0.35 * i, -1.3 - i * 0.02);
  return { obj: g, solid: { w: 1.0, d: 3.2 } };
}

function escalator(o: Opts): Prop {
  const g = G();
  const l = o.l ?? 5;
  const side = mat('#d8dde3', 0.3, 0.4);
  for (const x of [-0.6, 0.6]) { const s = box(g, 0.1, 0.9, l, side, x, 0, 0); s.rotation.x = -0.45; s.position.y = 1.2; }
  const steps = box(g, 1.1, 0.06, l, mat('#4a4f58', 0.4, 0.6), 0, 1.0, 0); steps.rotation.x = -0.45;
  for (const x of [-0.6, 0.6]) { const r = box(g, 0.06, 0.06, l, mat('#1b1c24', 0.5), x, 2.1, 0); r.rotation.x = -0.45; }
  return { obj: g, solid: { w: 1.4, d: l * 0.9 } };
}

function planterTree(o: Opts): Prop {
  const g = G();
  rbox(g, 1.0, 0.6, 1.0, mat(c(o, 'pot', '#e9e2d8'), 0.7), 0, 0, 0, 0.06);
  cyl(g, 0.08, 0.1, 1.6, mat('#6b4a33', 0.9), 0, 0.6, 0, 8);
  for (let i = 0; i < 4; i++) sph(g, 0.55 - i * 0.05, mat(i % 2 ? '#3f8f4a' : '#2f6e3a', 0.8), Math.sin(i * 1.6) * 0.25, 2.2 + i * 0.12, Math.cos(i * 1.6) * 0.25);
  return { obj: g, solid: { w: 1.0, d: 1.0 } };
}

function kiosk(o: Opts): Prop {
  const g = G();
  const col = c(o, 'color', '#ffd23f');
  rbox(g, 1.6, 1.0, 1.0, mat('#ffffff', 0.5), 0, 0, 0, 0.05);
  box(g, 1.7, 0.06, 1.1, mat(col, 0.4), 0, 1.0, 0);
  for (const x of [-0.75, 0.75]) cyl(g, 0.04, 0.04, 1.3, mat('#ffffff', 0.4), x, 1.0, 0.45, 6);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.6, 4), mat(col, 0.5)); roof.rotation.y = Math.PI / 4; roof.position.y = 2.6; g.add(roof);
  const tex = textTexture(String(o.text ?? 'SNACKS'), { color: '#ffffff', bg: col, w: 512, h: 128, size: 72 });
  plane(g, 1.4, 0.35, new THREE.MeshStandardMaterial({ map: tex }), 0, 0.55, 0.51);
  const e = emojiSprite(c(o, 'emoji', '🍦'), 0.5); e.position.y = 1.5; g.add(e);
  return { obj: g, solid: { w: 1.6, d: 1.0 } };
}

function crosswalk(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 6;
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -48 });
  for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.5, w), m); s.rotation.x = -Math.PI / 2; s.position.set(-1.8 + i * 0.6, 0.02, 0); g.add(s); }
  return { obj: g };
}

function road(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 40, d = o.d ?? 6;
  const asphalt = new THREE.MeshStandardMaterial({ color: '#3a3d44', roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -32 });
  const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), asphalt); r.rotation.x = -Math.PI / 2; r.position.y = 0.012; r.receiveShadow = true; g.add(r);
  const dash = new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -40 });
  for (let x = -w / 2 + 1; x < w / 2; x += 3) { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.15), dash); s.rotation.x = -Math.PI / 2; s.position.set(x + 0.8, 0.016, 0); g.add(s); }
  return { obj: g };
}

function parkedCar(o: Opts): Prop {
  const g = G();
  const col = c(o, 'color', '#ff6fb5');
  rbox(g, 1.8, 0.7, 4, mat(col, 0.3, 0.4), 0, 0.25, 0, 0.18);
  rbox(g, 1.6, 0.55, 2.1, glass('#2a3440', 0.75), 0, 0.9, -0.2, 0.15);
  for (const x of [-0.85, 0.85]) for (const z of [-1.3, 1.3]) { const w = cyl(g, 0.32, 0.32, 0.25, mat('#141414', 0.8), x, 0.32, z, 16); w.rotation.z = Math.PI / 2; w.position.y = 0.32; }
  return { obj: g, solid: { w: 1.9, d: 4.1 } };
}

export const PROPS4: Record<string, (o: Opts) => Prop> = {
  shopfront, fountain, lifeguard: lifeguardTower, sandcastle, streetlamp: streetLamp, busstop: busStop,
  swings: swingSet, kidslide: slide, escalator, planttree: planterTree, kiosk, crosswalk, road, parkedcar: parkedCar,
};
void WHITE;
