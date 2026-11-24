import * as THREE from 'three';
import { CHROME, GOLD, MARBLE, OAK, WHITE, box, cyl, glass, glow, mat, plane, rbox, sph, torus, type Opts, type Prop } from './props';
import { textTexture, emojiTexture } from './tex';

/**
 * Furniture for floors 13–24 (aquarium, fashion, bakery, spa, art, theme park,
 * space, jungle, candy, haunted, festival, sky garden). Origin = centre of the
 * footprint on the floor, facing +Z.
 */

const G = () => new THREE.Group();
const c = (o: Opts, k: string, d: string) => (o[k] as string) ?? d;
const RAINBOW = ['#ff3df0', '#33e1ff', '#ffd23f', '#7cff6b', '#ff7a1a', '#b388ff'];

function emojiSprite(e: string, size: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(e), transparent: true, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

// ------------------------------------------------------------- aquarium

function bigTank(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 5, h = o.h ?? 2.6, d = o.d ?? 0.9;
  rbox(g, w + 0.2, 0.35, d + 0.2, mat('#1b2a3a', 0.4), 0, 0, 0, 0.04);
  box(g, w, h, d, glass('#5fc8ff', 0.35), 0, 0.35, 0);
  box(g, w, 0.12, d, mat('#e8d8a8', 0.9), 0, 0.36, 0);
  for (let i = 0; i < 6; i++) { const cr = cyl(g, 0.05, 0.12, 0.4 + (i % 3) * 0.25, mat(RAINBOW[i], 0.7), -w / 2 + 0.4 + i * (w - 0.8) / 5, 0.45, (i % 2 ? 0.2 : -0.2), 6); cr.rotation.z = (i % 2 ? 0.2 : -0.2); }
  const fish: THREE.Sprite[] = [];
  for (let i = 0; i < 7; i++) { const f = emojiSprite(['🐠', '🐟', '🐡', '🦈', '🐢', '🐙', '🦑'][i], 0.4 + (i === 3 ? 0.3 : 0)); g.add(f); fish.push(f); }
  rbox(g, w + 0.2, 0.18, d + 0.2, mat('#1b2a3a', 0.4), 0, 0.35 + h, 0, 0.04);
  return { obj: g, solid: { w: w + 0.2, d: d + 0.2 }, tick: (t) => fish.forEach((f, i) => { const k = (t * (0.15 + i * 0.02) + i * 0.3) % 1; const dir = i % 2 ? 1 : -1; f.position.set(dir * (k - 0.5) * (w - 0.5), 0.7 + ((i * 0.37) % 1) * (h - 0.8), (i % 3 - 1) * d * 0.25); }) };
}

function jellyTube(o: Opts): Prop {
  const g = G();
  cyl(g, 0.55, 0.6, 0.3, mat('#1b2a3a', 0.4), 0, 0, 0, 24);
  cyl(g, 0.5, 0.5, 2.6, glass('#b388ff', 0.25), 0, 0.3, 0, 24);
  cyl(g, 0.55, 0.55, 0.2, mat('#1b2a3a', 0.4), 0, 2.9, 0, 24);
  const jelly: THREE.Object3D[] = [];
  for (let i = 0; i < 4; i++) { const j = G(); sph(j, 0.12, glow(c(o, 'color', '#ff9fe6'), 2), 0, 0, 0, 1, 0.6, 1); for (let k = 0; k < 4; k++) cyl(j, 0.008, 0.008, 0.3, glow('#ffd6f5', 1.5), Math.sin(k) * 0.06, -0.3, Math.cos(k) * 0.06, 4); g.add(j); jelly.push(j); }
  const light = new THREE.PointLight(c(o, 'color', '#ff9fe6'), 1.5, 4, 2);
  light.position.y = 1.6; g.add(light);
  return { obj: g, solid: { w: 1.2, d: 1.2 }, light, tick: (t) => jelly.forEach((j, i) => j.position.set(Math.sin(t * 0.4 + i) * 0.2, 0.8 + ((t * 0.15 + i * 0.25) % 1) * 1.9, Math.cos(t * 0.5 + i) * 0.2)) };
}

function touchPool(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 3, d = o.d ?? 1.6;
  rbox(g, w, 0.75, d, mat('#d8ccb8', 0.8), 0, 0, 0, 0.1);
  box(g, w - 0.2, 0.02, d - 0.2, glass('#4fb8e8', 0.75), 0, 0.72, 0);
  for (let i = 0; i < 5; i++) { const s = emojiSprite(['⭐', '🐚', '🦀', '🪸', '🐌'][i], 0.25); s.position.set(-w / 2 + 0.4 + i * (w - 0.8) / 4, 0.82, (i % 2 ? 0.2 : -0.2)); g.add(s); }
  return { obj: g, solid: { w, d } };
}

// ------------------------------------------------------------- fashion

function runway(o: Opts): Prop {
  const g = G();
  const l = o.l ?? 9;
  rbox(g, 1.6, 0.3, l, mat('#f7f3ee', 0.3), 0, 0, 0, 0.04);
  for (const x of [-0.8, 0.8]) for (let i = 0; i < Math.floor(l / 0.6); i++) sph(g, 0.03, glow(i % 2 ? '#ffffff' : '#ffd23f', 3), x, 0.31, -l / 2 + 0.3 + i * 0.6);
  box(g, 3, 2.8, 0.2, mat(c(o, 'color', '#1b1c24'), 0.4), 0, 0, -l / 2 - 0.1);
  const tex = textTexture(String(o.text ?? 'MAGGAKES FASHION'), { color: '#ffffff', glow: '#ff3df0', w: 1024, h: 160, size: 80 });
  plane(g, 2.8, 0.44, new THREE.MeshStandardMaterial({ map: tex, emissive: '#ff3df0', emissiveMap: tex, emissiveIntensity: 2, transparent: true }), 0, 2.2, -l / 2 + 0.01);
  return { obj: g, solid: { w: 1.6, d: l } };
}

function mannequin(o: Opts): Prop {
  const g = G();
  cyl(g, 0.22, 0.25, 0.04, CHROME(), 0, 0, 0, 20);
  cyl(g, 0.02, 0.02, 0.8, CHROME(), 0, 0.04, 0, 8);
  const dress = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.001, 1.55), new THREE.Vector2(0.14, 1.5), new THREE.Vector2(0.12, 1.25), new THREE.Vector2(0.16, 1.05), new THREE.Vector2(0.34, 0.7), new THREE.Vector2(0.001, 0.7)], 24), mat(c(o, 'color', '#ff6fb5'), 0.6));
  g.add(dress);
  sph(g, 0.06, mat('#f2e6da', 0.5), 0, 1.6, 0);
  return { obj: g, solid: { w: 0.6, d: 0.6 } };
}

function sewingTable(o: Opts): Prop {
  const g = G();
  rbox(g, 1.6, 0.75, 0.8, OAK(), 0, 0, 0, 0.03);
  rbox(g, 0.5, 0.25, 0.25, mat('#ffffff', 0.4), -0.2, 0.75, 0, 0.04);
  box(g, 0.1, 0.25, 0.2, mat('#ffffff', 0.4), 0.0, 0.85, 0);
  for (let i = 0; i < 3; i++) cyl(g, 0.04, 0.04, 0.08, mat(RAINBOW[i], 0.5), 0.4 + i * 0.12, 0.75, 0.2, 12);
  box(g, 0.6, 0.01, 0.4, mat(c(o, 'color', '#b388ff'), 0.9), 0.35, 0.755, -0.1);
  return { obj: g, solid: { w: 1.6, d: 0.8 } };
}

function spotlight(o: Opts): Prop {
  const g = G();
  for (let i = 0; i < 3; i++) { const l = cyl(g, 0.015, 0.015, 1.5, mat('#222', 0.4, 0.6), Math.sin(i * 2.1) * 0.3, 0, Math.cos(i * 2.1) * 0.3, 6); l.rotation.z = Math.sin(i * 2.1) * 0.2; l.rotation.x = -Math.cos(i * 2.1) * 0.2; }
  const head = cyl(g, 0.18, 0.12, 0.35, mat('#222', 0.4, 0.6), 0, 1.5, 0, 16);
  head.rotation.x = 0.8;
  sph(g, 0.15, glow(c(o, 'color', '#fff6e0'), 4), 0, 1.6, 0.15);
  return { obj: g, solid: { w: 0.7, d: 0.7 } };
}

// ------------------------------------------------------------- bakery

function oven(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 1.4;
  rbox(g, w, 1.6, 0.8, mat(c(o, 'color', '#e9e2d8'), 0.4, 0.3), 0, 0, 0, 0.04);
  for (const y of [0.25, 0.9]) { box(g, w - 0.3, 0.5, 0.02, glass('#ff9a3c', 0.6), 0, y, 0.41); box(g, w - 0.4, 0.04, 0.05, CHROME(), 0, y + 0.55, 0.43); }
  const glowM = glow('#ff7a1a', 1.5);
  box(g, w - 0.4, 0.02, 0.6, glowM, 0, 0.3, 0);
  return { obj: g, solid: { w, d: 0.8 }, tick: (t) => { glowM.emissiveIntensity = 1.3 + Math.sin(t * 3) * 0.3; } };
}

function cakeStand(o: Opts): Prop {
  const g = G();
  cyl(g, 0.25, 0.3, 0.75, WHITE(), 0, 0, 0, 20);
  const col = c(o, 'color', '#ffb3c9');
  for (let i = 0; i < 3; i++) cyl(g, 0.3 - i * 0.08, 0.3 - i * 0.08, 0.18, mat(i % 2 ? '#fff6e0' : col, 0.6), 0, 0.78 + i * 0.18, 0, 24);
  sph(g, 0.05, mat('#ff3d5a', 0.4), 0, 1.36, 0);
  return { obj: g, solid: { w: 0.6, d: 0.6 } };
}

function displayCase(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 2.4;
  rbox(g, w, 0.8, 0.7, mat(c(o, 'color', '#ffd6e7'), 0.5), 0, 0, 0, 0.04);
  box(g, w, 0.5, 0.7, glass('#ffffff', 0.25), 0, 0.8, 0);
  for (let i = 0; i < Math.floor(w / 0.35); i++) { const s = emojiSprite(['🧁', '🍰', '🥐', '🍩', '🍪', '🥧'][i % 6], 0.28); s.position.set(-w / 2 + 0.25 + i * 0.35, 1.0, 0); g.add(s); }
  return { obj: g, solid: { w, d: 0.7 } };
}

function cafeTable(o: Opts): Prop {
  const g = G();
  cyl(g, 0.4, 0.4, 0.03, MARBLE(), 0, 0.72, 0, 24);
  cyl(g, 0.03, 0.03, 0.72, GOLD(), 0, 0, 0, 8);
  cyl(g, 0.2, 0.22, 0.02, GOLD(), 0, 0, 0, 16);
  for (const a of [0, Math.PI]) { const ch = G(); rbox(ch, 0.4, 0.06, 0.4, mat(c(o, 'color', '#ff9fc4'), 0.7), 0, 0.45, 0, 0.03); rbox(ch, 0.4, 0.4, 0.05, mat(c(o, 'color', '#ff9fc4'), 0.7), 0, 0.5, -0.18, 0.03); for (const x of [-0.16, 0.16]) for (const z of [-0.16, 0.16]) cyl(ch, 0.012, 0.012, 0.45, GOLD(), x, 0, z, 6); ch.position.set(Math.sin(a) * 0.7, 0, Math.cos(a) * 0.7); ch.rotation.y = a + Math.PI; g.add(ch); }
  const cup = emojiSprite('☕', 0.22); cup.position.set(0.1, 0.86, 0); g.add(cup);
  return { obj: g, solid: { w: 1.0, d: 1.8 } };
}

function espresso(o: Opts): Prop {
  const g = G();
  rbox(g, 1.6, 0.95, 0.65, mat(c(o, 'color', '#7a4a2e'), 0.6), 0, 0, 0, 0.04);
  box(g, 1.7, 0.05, 0.75, MARBLE(), 0, 0.95, 0);
  rbox(g, 0.6, 0.45, 0.4, CHROME(), -0.3, 1.0, -0.05, 0.05);
  for (const x of [-0.45, -0.15]) cyl(g, 0.03, 0.03, 0.12, mat('#222', 0.4), x, 1.0, 0.18, 8);
  for (let i = 0; i < 4; i++) cyl(g, 0.045, 0.04, 0.08, WHITE(), 0.3 + i * 0.12, 1.0, 0.15, 12);
  return { obj: g, solid: { w: 1.7, d: 0.75 } };
}

// ------------------------------------------------------------- spa & salon

function salonChair(o: Opts): Prop {
  const g = G();
  cyl(g, 0.3, 0.3, 0.05, CHROME(), 0, 0, 0, 20);
  cyl(g, 0.05, 0.05, 0.4, CHROME(), 0, 0.05, 0, 10);
  rbox(g, 0.6, 0.15, 0.55, mat(c(o, 'color', '#ff6fb5'), 0.4), 0, 0.45, 0, 0.06);
  rbox(g, 0.6, 0.7, 0.12, mat(c(o, 'color', '#ff6fb5'), 0.4), 0, 0.55, -0.25, 0.06);
  box(g, 1.0, 1.4, 0.05, glass('#e8f6ff', 0.6), 0, 0.6, -0.9);
  box(g, 1.1, 1.5, 0.04, GOLD(), 0, 0.55, -0.93);
  return { obj: g, solid: { w: 0.7, d: 0.7 } };
}

function nailBar(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 2.4;
  rbox(g, w, 0.75, 0.6, mat('#ffffff', 0.3), 0, 0, 0, 0.04);
  box(g, w, 0.04, 0.65, MARBLE(), 0, 0.75, 0);
  for (let i = 0; i < 10; i++) cyl(g, 0.025, 0.025, 0.08, mat(RAINBOW[i % 6], 0.2), -w / 2 + 0.2 + i * (w - 0.4) / 9, 0.79, -0.2, 8);
  for (let i = 0; i < Math.floor(w / 0.8); i++) { const s = cyl(g, 0.18, 0.18, 0.06, mat(c(o, 'color', '#ffd6e7'), 0.6), -w / 2 + 0.4 + i * 0.8, 0.45, 0.65, 16); s.castShadow = true; }
  return { obj: g, solid: { w, d: 0.65 } };
}

function sauna(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 2.6, d = o.d ?? 2.2;
  const wood = mat('#c8925a', 0.7);
  box(g, w, 2.4, 0.08, wood, 0, 0, -d / 2); box(g, 0.08, 2.4, d, wood, -w / 2, 0, 0); box(g, 0.08, 2.4, d, wood, w / 2, 0, 0);
  box(g, w * 0.6, 2.2, 0.06, glass('#ffd9a0', 0.4), -w * 0.2, 0, d / 2); box(g, 0.08, 2.4, 0.08, wood, w * 0.15, 0, d / 2);
  box(g, w, 0.08, d, wood, 0, 2.4, 0);
  for (const y of [0.45, 0.9]) box(g, w - 0.2, 0.06, 0.45, wood, 0, y, -d / 2 + 0.3 + (y > 0.5 ? 0 : 0.4));
  const steam: THREE.Sprite[] = [];
  for (let i = 0; i < 4; i++) { const s = emojiSprite('💨', 0.4); g.add(s); steam.push(s); }
  return { obj: g, solid: { w, d }, tick: (t) => steam.forEach((s, i) => { const k = (t * 0.2 + i * 0.25) % 1; s.position.set(-0.5 + i * 0.35, 0.8 + k * 1.4, 0); s.material.opacity = 1 - k; }) };
}

// ------------------------------------------------------------- art

function easel(o: Opts): Prop {
  const g = G();
  for (const x of [-0.3, 0.3]) { const l = cyl(g, 0.025, 0.025, 1.7, OAK(), x, 0, 0, 6); l.rotation.z = x > 0 ? 0.12 : -0.12; }
  const back = cyl(g, 0.025, 0.025, 1.7, OAK(), 0, 0, -0.35, 6); back.rotation.x = -0.25;
  box(g, 0.8, 0.04, 0.06, OAK(), 0, 0.7, 0.04);
  const can = document.createElement('canvas'); can.width = 128; can.height = 96;
  const x = can.getContext('2d')!;
  x.fillStyle = '#fffaf0'; x.fillRect(0, 0, 128, 96);
  const seed = o.seed ?? 1;
  for (let i = 0; i < 9; i++) { x.fillStyle = RAINBOW[(i + seed) % 6]; x.beginPath(); x.arc(((i * 37 + seed * 13) % 120) + 4, ((i * 23 + seed * 7) % 88) + 4, 8 + (i % 4) * 6, 0, Math.PI * 2); x.fill(); }
  const tex = new THREE.CanvasTexture(can); tex.colorSpace = THREE.SRGBColorSpace;
  box(g, 0.75, 0.58, 0.03, mat('#ffffff', 0.8), 0, 1.0, 0.04);
  plane(g, 0.72, 0.54, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), 0, 1.02, 0.06);
  return { obj: g, solid: { w: 0.8, d: 0.6 } };
}

function potteryWheel(o: Opts): Prop {
  const g = G();
  rbox(g, 0.7, 0.55, 0.7, mat('#5a6270', 0.5), 0, 0, 0, 0.05);
  const wheel = G(); wheel.position.y = 0.58; g.add(wheel);
  cyl(wheel, 0.28, 0.28, 0.05, mat('#7a7f88', 0.4, 0.5), 0, 0, 0, 24);
  const pot = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.001, 0.05), new THREE.Vector2(0.1, 0.05), new THREE.Vector2(0.14, 0.15), new THREE.Vector2(0.08, 0.3), new THREE.Vector2(0.1, 0.34)], 20), mat(c(o, 'color', '#c97b55'), 0.8));
  wheel.add(pot);
  const stool = cyl(g, 0.2, 0.2, 0.45, OAK(), 0, 0, 0.7, 16); stool.castShadow = true;
  return { obj: g, solid: { w: 0.7, d: 1.2 }, tick: (t) => { wheel.rotation.y = t * 6; } };
}

function sculpture(o: Opts): Prop {
  const g = G();
  rbox(g, 0.6, 0.9, 0.6, WHITE(), 0, 0, 0, 0.03);
  const k = new THREE.Mesh(new THREE.TorusKnotGeometry(0.22, 0.07, 64, 10), mat(c(o, 'color', '#ffd23f'), 0.2, 0.8));
  k.position.y = 1.25; g.add(k);
  return { obj: g, solid: { w: 0.6, d: 0.6 }, tick: (t) => { k.rotation.y = t * 0.6; } };
}

// ------------------------------------------------------------- theme park

function carousel(o: Opts): Prop {
  const g = G();
  const r = o.r ?? 2.6;
  cyl(g, r, r, 0.25, mat('#ffd6e7', 0.5), 0, 0, 0, 32);
  const spin = G(); g.add(spin);
  cyl(spin, 0.15, 0.15, 3.0, GOLD(), 0, 0.25, 0, 12);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(r + 0.3, 1.0, 16), mat('#ff6fb5', 0.5)); roof.position.y = 3.7; spin.add(roof);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; box(spin, 0.3, 0.25, 0.05, mat(i % 2 ? '#ffffff' : '#ffd23f', 0.5), Math.sin(a) * (r + 0.15), 3.05, Math.cos(a) * (r + 0.15), a); }
  const horses: THREE.Object3D[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const hg = G(); hg.position.set(Math.sin(a) * (r - 0.6), 0, Math.cos(a) * (r - 0.6)); hg.rotation.y = a + Math.PI / 2; spin.add(hg);
    cyl(hg, 0.025, 0.025, 3.0, GOLD(), 0, 0.25, 0, 6);
    const body = G(); hg.add(body); horses.push(body);
    sph(body, 0.32, mat(['#ffffff', '#ffb3c9', '#bfe3f2'][i % 3], 0.4), 0, 1.15, 0, 1.4, 0.7, 0.6);
    sph(body, 0.16, mat(['#ffffff', '#ffb3c9', '#bfe3f2'][i % 3], 0.4), 0.42, 1.42, 0, 1.2, 1, 0.8);
  }
  return { obj: g, solid: { w: r * 2, d: r * 2 }, tick: (t) => { spin.rotation.y = t * 0.5; horses.forEach((b, i) => { b.position.y = Math.sin(t * 2 + i) * 0.15; }); } };
}

function ferrisWheel(o: Opts): Prop {
  const g = G();
  const R = o.r ?? 4;
  for (const z of [-0.6, 0.6]) for (const s of [-1, 1]) { const leg = cyl(g, 0.08, 0.1, R + 1.2, mat('#ffffff', 0.4), s * R * 0.35, 0, z, 8); leg.rotation.z = -s * 0.33; }
  const wheel = G(); wheel.position.y = R + 1; g.add(wheel);
  for (const z of [-0.5, 0.5]) torus(wheel, R, 0.06, mat('#ff6fb5', 0.4), 0, 0, z);
  const cars: THREE.Object3D[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const pivot = G(); pivot.rotation.z = a; wheel.add(pivot);
    cyl(pivot, 0.03, 0.03, R, mat('#ffffff', 0.4), 0, 0, 0, 6);
    const car = G(); wheel.add(car); cars.push(car);
    rbox(car, 0.8, 0.6, 0.8, mat(RAINBOW[i % 6], 0.4), 0, -0.7, 0, 0.12);
    cyl(car, 0.02, 0.02, 0.4, mat('#ffffff', 0.4), 0, -0.4, 0, 4);
    car.userData.a = a;
  }
  return { obj: g, solid: { w: R * 0.9, d: 1.6 }, tick: (t) => { wheel.rotation.z = t * 0.15; cars.forEach((cg) => { const a = cg.userData.a; cg.position.set(Math.sin(a) * R, Math.cos(a) * R, 0); cg.rotation.z = -t * 0.15; }); } };
}

function stall(o: Opts): Prop {
  const g = G();
  const col = c(o, 'color', '#ff3d5a');
  rbox(g, 2.2, 1.0, 0.8, mat('#ffffff', 0.5), 0, 0, 0, 0.04);
  for (let i = 0; i < 6; i++) box(g, 0.37, 0.1, 1.2, mat(i % 2 ? '#ffffff' : col, 0.5), -0.92 + i * 0.37, 2.3, 0.1);
  for (const x of [-1.05, 1.05]) cyl(g, 0.04, 0.04, 2.3, mat('#ffffff', 0.4), x, 0, 0.6, 8);
  const tex = textTexture(String(o.text ?? 'GAMES'), { color: '#ffffff', bg: col, w: 512, h: 128, size: 80 });
  plane(g, 1.6, 0.4, new THREE.MeshStandardMaterial({ map: tex }), 0, 1.75, 0.41);
  for (let i = 0; i < 5; i++) { const s = emojiSprite(['🧸', '🎈', '🦄', '🐻', '⭐'][i], 0.3); s.position.set(-0.8 + i * 0.4, 1.25, -0.2); g.add(s); }
  return { obj: g, solid: { w: 2.2, d: 0.9 } };
}

function balloons(o: Opts): Prop {
  const g = G();
  const bs: THREE.Object3D[] = [];
  for (let i = 0; i < 7; i++) { const b = G(); sph(b, 0.18, mat(RAINBOW[(i + (o.seed ?? 0)) % 6], 0.2), 0, 0, 0, 1, 1.2, 1); b.position.set(Math.sin(i * 2.4) * 0.3, 2.2 + (i % 3) * 0.25, Math.cos(i * 2.4) * 0.3); g.add(b); bs.push(b); cyl(g, 0.004, 0.004, b.position.y - 0.2, mat('#ffffff', 0.5), b.position.x * 0.5, 0.2, b.position.z * 0.5, 3); }
  cyl(g, 0.12, 0.15, 0.2, mat('#7a4a2e', 0.6), 0, 0, 0, 10);
  return { obj: g, tick: (t) => bs.forEach((b, i) => { b.position.y = 2.2 + (i % 3) * 0.25 + Math.sin(t * 1.5 + i) * 0.06; }) };
}

// ------------------------------------------------------------- space

function bigTelescope(o: Opts): Prop {
  const g = G();
  cyl(g, 0.6, 0.8, 0.8, mat('#2a2d34', 0.4, 0.6), 0, 0, 0, 20);
  const tube = cyl(g, 0.35, 0.45, 3.2, mat(c(o, 'color', '#e9e4dc'), 0.3, 0.4), 0, 0.8, 0, 24);
  tube.rotation.x = -0.8; tube.position.set(0, 1.0, -0.4);
  cyl(g, 0.38, 0.38, 0.05, glass('#9fdcff', 0.8), 0, 3.2, -2.3, 24).rotation.x = -0.8;
  return { obj: g, solid: { w: 1.6, d: 1.6 } };
}

function orrery(o: Opts): Prop {
  const g = G();
  cyl(g, 0.5, 0.6, 0.8, mat('#1b1c24', 0.4, 0.5), 0, 0, 0, 20);
  sph(g, 0.35, glow('#ffd23f', 3), 0, 1.6, 0);
  const planets: [THREE.Object3D, number, number][] = [];
  const cols = ['#b0a090', '#e8b870', '#4fa8ff', '#e05a3a', '#e0c090', '#f0d8a0'];
  for (let i = 0; i < 6; i++) { const p = G(); sph(p, 0.08 + (i === 4 ? 0.1 : i === 5 ? 0.08 : 0), mat(cols[i], 0.5), 0, 0, 0); if (i === 5) torus(p, 0.2, 0.015, mat('#f0d8a0', 0.4)).rotation.x = 1.2; g.add(p); planets.push([p, 0.6 + i * 0.35, 1 / (1 + i * 0.6)]); }
  return { obj: g, solid: { w: 1.2, d: 1.2 }, tick: (t) => planets.forEach(([p, r, s], i) => p.position.set(Math.sin(t * s + i) * r, 1.6, Math.cos(t * s + i) * r)) };
}

function rocket(o: Opts): Prop {
  const g = G();
  const s = o.s ?? 1;
  const body = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.001, 4.2 * s), new THREE.Vector2(0.25 * s, 3.6 * s), new THREE.Vector2(0.45 * s, 2.6 * s), new THREE.Vector2(0.5 * s, 0.6 * s), new THREE.Vector2(0.4 * s, 0.4 * s), new THREE.Vector2(0.001, 0.4 * s)], 24), mat('#f7f7f7', 0.3, 0.3));
  g.add(body);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const fin = box(g, 0.05, 0.9 * s, 0.6 * s, mat(c(o, 'color', '#ff3d5a'), 0.4), Math.sin(a) * 0.5 * s, 0.2, Math.cos(a) * 0.5 * s); fin.rotation.y = a; }
  sph(g, 0.15 * s, glass('#33e1ff', 0.8), 0, 2.8 * s, 0.44 * s);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.25 * s, 0.6 * s, 12), glow('#ff7a1a', 4)); flame.rotation.x = Math.PI; flame.position.y = 0.1; g.add(flame);
  return { obj: g, solid: { w: 1.2 * s, d: 1.2 * s }, tick: (t) => { flame.scale.y = 0.7 + Math.abs(Math.sin(t * 12)) * 0.5; } };
}

function controlDesk(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 3;
  rbox(g, w, 0.8, 0.8, mat('#2a2d34', 0.4, 0.4), 0, 0, 0, 0.04);
  const scr: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 3; i++) { const m = new THREE.MeshStandardMaterial({ color: '#111', emissive: ['#33e1ff', '#7cff6b', '#ff3df0'][i], emissiveIntensity: 1.2 }); scr.push(m); const s = box(g, w / 3 - 0.15, 0.5, 0.04, m, -w / 3 + i * (w / 3), 1.0, -0.3); s.rotation.x = -0.2; }
  for (let i = 0; i < 12; i++) sph(g, 0.025, glow(RAINBOW[i % 6], 3), -w / 2 + 0.2 + i * (w - 0.4) / 11, 0.82, 0.2);
  return { obj: g, solid: { w, d: 0.8 }, tick: (t) => scr.forEach((m, i) => { m.emissiveIntensity = 1 + Math.sin(t * 2 + i) * 0.4; }) };
}

// ------------------------------------------------------------- jungle

function bigTree(o: Opts): Prop {
  const g = G();
  const h = o.h ?? 5;
  cyl(g, 0.35, 0.55, h, mat('#6b4a33', 0.9), 0, 0, 0, 10);
  for (let i = 0; i < 5; i++) { const a = i * 1.3; sph(g, 1.1 + (i % 2) * 0.3, mat(i % 2 ? '#2f6e3a' : '#3f8f4a', 0.8), Math.sin(a) * 0.9, h - 0.3 + (i % 3) * 0.4, Math.cos(a) * 0.9); }
  for (let i = 0; i < 6; i++) { const v = cyl(g, 0.02, 0.02, 2 + (i % 3) * 0.6, mat('#3f8f4a', 0.8), Math.sin(i * 1.1) * 1.3, h - 2.3 - (i % 3) * 0.3, Math.cos(i * 1.1) * 1.3, 4); v.castShadow = false; }
  return { obj: g, solid: { w: 1.1, d: 1.1 } };
}

function waterfall(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 3;
  for (let i = 0; i < 6; i++) sph(g, 0.6 + (i % 3) * 0.2, mat('#8a8f96', 0.9), -w / 2 + i * w / 5, 0.4 + (i % 2) * 0.9, -0.3, 1, 1.2, 0.8);
  box(g, w * 0.8, 2.6, 0.5, mat('#7a7f86', 0.9), 0, 0, -0.5);
  const fallM = new THREE.MeshStandardMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.75, emissive: '#bfe8ff', emissiveIntensity: 0.3 });
  const fall = box(g, w * 0.45, 2.5, 0.08, fallM, 0, 0.1, -0.2);
  fall.castShadow = false;
  cyl(g, w * 0.55, w * 0.6, 0.15, glass('#4fb8e8', 0.75), 0, 0, 0.6, 24);
  const foam: THREE.Sprite[] = [];
  for (let i = 0; i < 5; i++) { const s = emojiSprite('💧', 0.25); g.add(s); foam.push(s); }
  return { obj: g, solid: { w: w * 1.1, d: 2 }, tick: (t) => { fallM.opacity = 0.65 + Math.sin(t * 8) * 0.08; foam.forEach((s, i) => { const k = (t * 0.8 + i * 0.2) % 1; s.position.set(-0.5 + i * 0.25, 2.5 - k * 2.4, 0); }); } };
}

function butterflies(o: Opts): Prop {
  const g = G();
  const bs: THREE.Sprite[] = [];
  for (let i = 0; i < 6; i++) { const s = emojiSprite('🦋', 0.3); g.add(s); bs.push(s); }
  return { obj: g, tick: (t) => bs.forEach((s, i) => s.position.set(Math.sin(t * 0.6 + i * 1.7) * (o.r ?? 2.5), 1.2 + Math.sin(t * 1.7 + i) * 0.5, Math.cos(t * 0.5 + i * 2.3) * (o.r ?? 2.5))) };
}

function parrotPerch(o: Opts): Prop {
  const g = G();
  cyl(g, 0.04, 0.05, 1.6, OAK(), 0, 0, 0, 8);
  const bar = cyl(g, 0.03, 0.03, 0.8, OAK(), 0, 1.6, 0, 8); bar.rotation.z = Math.PI / 2;
  const p = emojiSprite(c(o, 'bird', '🦜'), 0.5); p.position.set(0.15, 1.85, 0); g.add(p);
  return { obj: g, solid: { w: 0.4, d: 0.4 }, tick: (t) => { p.position.y = 1.85 + Math.abs(Math.sin(t * 3)) * 0.04; } };
}

// ------------------------------------------------------------- candy

function lollipop(o: Opts): Prop {
  const g = G();
  const h = o.h ?? 2.4;
  cyl(g, 0.05, 0.05, h, mat('#ffffff', 0.4), 0, 0, 0, 8);
  const disc = cyl(g, 0.6, 0.6, 0.12, mat(c(o, 'color', '#ff6fb5'), 0.25), 0, h, 0, 32); disc.rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) torus(g, 0.15 + i * 0.15, 0.03, mat(i % 2 ? '#ffffff' : '#ffd23f', 0.3), 0, h + 0.06, 0.06);
  return { obj: g, solid: { w: 0.4, d: 0.4 } };
}

function candyCane(o: Opts): Prop {
  const g = G();
  const h = o.h ?? 2.2;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h * 0.8, 0), new THREE.Vector3(0.15, h, 0), new THREE.Vector3(0.45, h * 0.95, 0), new THREE.Vector3(0.55, h * 0.8, 0)]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.1, 10), mat('#ffffff', 0.3));
  g.add(tube);
  for (let i = 0; i < 9; i++) { const p = curve.getPoint(i / 9); torus(g, 0.105, 0.03, mat('#e63946', 0.3), p.x, p.y, p.z).rotation.x = Math.PI / 2; }
  return { obj: g, solid: { w: 0.4, d: 0.4 } };
}

function chocFountain(o: Opts): Prop {
  const g = G();
  const choc = mat('#5a3420', 0.25);
  cyl(g, 0.6, 0.7, 0.75, mat('#ffffff', 0.4), 0, 0, 0, 24);
  const tiers: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) { tiers.push(cyl(g, 0.5 - i * 0.14, 0.5 - i * 0.14, 0.06, choc, 0, 0.8 + i * 0.35, 0, 24)); cyl(g, 0.05, 0.05, 0.35, choc, 0, 0.8 + i * 0.35, 0, 10); }
  const drip = cyl(g, 0.45, 0.5, 1.0, new THREE.MeshStandardMaterial({ color: '#6b3e26', transparent: true, opacity: 0.55, roughness: 0.2 }), 0, 0.8, 0, 24);
  drip.castShadow = false;
  for (let i = 0; i < 6; i++) { const s = emojiSprite(['🍓', '🍌', '🍡'][i % 3], 0.22); s.position.set(Math.sin(i) * 0.75, 0.85, Math.cos(i) * 0.75); g.add(s); }
  return { obj: g, solid: { w: 1.4, d: 1.4 }, tick: (t) => { drip.rotation.y = t; } };
}

function gummyTree(o: Opts): Prop {
  const g = G();
  cyl(g, 0.12, 0.18, 2, mat('#7a4a2e', 0.4), 0, 0, 0, 10);
  for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 0.5 + (i % 3) * 0.25; sph(g, 0.2, glass(RAINBOW[i % 6], 0.85), Math.sin(a) * r, 2 + (i % 4) * 0.3, Math.cos(a) * r, 0.8, 1.1, 0.8); }
  return { obj: g, solid: { w: 0.8, d: 0.8 } };
}

function giantCupcake(o: Opts): Prop {
  const g = G();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.6, 0.9, 16, 1), mat(c(o, 'color', '#ff6fb5'), 0.5)); cup.position.y = 0.45; g.add(cup);
  for (let i = 0; i < 3; i++) sph(g, 0.8 - i * 0.22, mat('#fff3f8', 0.5), 0, 1.0 + i * 0.35, 0, 1, 0.6, 1);
  sph(g, 0.15, mat('#e63946', 0.3), 0, 1.85, 0);
  for (let i = 0; i < 12; i++) box(g, 0.04, 0.12, 0.04, mat(RAINBOW[i % 6], 0.4), Math.sin(i) * 0.6, 1.25, Math.cos(i) * 0.6);
  return { obj: g, solid: { w: 1.6, d: 1.6 } };
}

// ------------------------------------------------------------- haunted

function ghost(o: Opts): Prop {
  const g = G();
  const gm = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, emissive: '#d8e8ff', emissiveIntensity: 0.4 });
  const body = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.001, 0.9), new THREE.Vector2(0.25, 0.8), new THREE.Vector2(0.32, 0.5), new THREE.Vector2(0.35, 0.0), new THREE.Vector2(0.001, 0.0)], 20), gm);
  const gh = G(); gh.add(body); g.add(gh);
  for (const x of [-0.09, 0.09]) sph(gh, 0.05, mat('#111', 0.4), x, 0.65, 0.26);
  sph(gh, 0.06, mat('#111', 0.4), 0, 0.48, 0.3, 1, 1.3, 0.6);
  return { obj: g, tick: (t) => { const s = o.seed ?? 0; gh.position.set(Math.sin(t * 0.4 + s) * 1.2, 0.6 + Math.sin(t * 1.3 + s) * 0.25, Math.cos(t * 0.3 + s) * 1.2); gh.rotation.y = t * 0.4 + s; } };
}

function pumpkin(o: Opts): Prop {
  const g = G();
  const s = o.s ?? 1;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; sph(g, 0.3 * s, mat('#ff7a1a', 0.5), Math.sin(a) * 0.14 * s, 0.32 * s, Math.cos(a) * 0.14 * s, 0.7, 1, 0.7); }
  cyl(g, 0.04 * s, 0.05 * s, 0.15 * s, mat('#3f8f4a', 0.7), 0, 0.6 * s, 0, 6);
  if (o.lit) { for (const x of [-0.1, 0.1]) box(g, 0.08 * s, 0.08 * s, 0.02, glow('#ffd23f', 4), x * s, 0.4 * s, 0.42 * s); box(g, 0.2 * s, 0.05 * s, 0.02, glow('#ffd23f', 4), 0, 0.25 * s, 0.42 * s); }
  return { obj: g, solid: { w: 0.7 * s, d: 0.7 * s } };
}

function cauldron(o: Opts): Prop {
  const g = G();
  sph(g, 0.55, mat('#1b1c24', 0.4, 0.5), 0, 0.5, 0, 1, 0.8, 1);
  torus(g, 0.5, 0.05, mat('#1b1c24', 0.4, 0.5), 0, 0.9, 0).rotation.x = Math.PI / 2;
  const brew = cyl(g, 0.46, 0.46, 0.04, glow(c(o, 'color', '#7cff6b'), 2), 0, 0.86, 0, 24); brew.castShadow = false;
  const bubbles: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) bubbles.push(sph(g, 0.06, glow(c(o, 'color', '#7cff6b'), 2), 0, 0.9, 0));
  const light = new THREE.PointLight(c(o, 'color', '#7cff6b'), 2, 4, 2); light.position.y = 1.2; g.add(light);
  return { obj: g, solid: { w: 1.1, d: 1.1 }, light, tick: (t) => bubbles.forEach((b, i) => { const k = (t * 0.7 + i * 0.2) % 1; b.position.set(Math.sin(i * 2) * 0.25, 0.9 + k * 0.6, Math.cos(i * 2) * 0.25); b.scale.setScalar(1 - k); }) };
}

function gravestone(o: Opts): Prop {
  const g = G();
  rbox(g, 0.6, 0.8, 0.15, mat('#8a8f96', 0.9), 0, 0, 0, 0.2);
  const tex = textTexture(String(o.text ?? 'R.I.P.'), { color: '#3a3d44', w: 256, h: 128, size: 60 });
  plane(g, 0.45, 0.22, new THREE.MeshStandardMaterial({ map: tex, transparent: true }), 0, 0.5, 0.08);
  return { obj: g, solid: { w: 0.6, d: 0.3 } };
}

function candelabra(o: Opts): Prop {
  const g = G();
  cyl(g, 0.15, 0.2, 0.05, GOLD(), 0, 0, 0, 16);
  cyl(g, 0.03, 0.03, 1.3, GOLD(), 0, 0, 0, 8);
  const flames: THREE.Mesh[] = [];
  for (const x of [-0.25, 0, 0.25]) { cyl(g, 0.03, 0.03, 0.25, mat('#fff6e0', 0.6), x, 1.3, 0, 8); if (x !== 0) box(g, Math.abs(x), 0.03, 0.03, GOLD(), x / 2, 1.3, 0); const f = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 8), glow('#ffb347', 5)); f.position.set(x, 1.6, 0); g.add(f); flames.push(f); }
  const light = new THREE.PointLight('#ffb347', 1.5, 5, 2); light.position.y = 1.7; g.add(light);
  return { obj: g, solid: { w: 0.4, d: 0.4 }, light, tick: (t) => { flames.forEach((f, i) => { f.scale.y = 0.8 + Math.abs(Math.sin(t * 10 + i)) * 0.5; }); light.intensity = 1.3 + Math.sin(t * 13) * 0.3; } };
}

// ------------------------------------------------------------- festival

function festivalStage(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 9;
  rbox(g, w, 1.0, 4, mat('#1b1c24', 0.5), 0, 0, 0, 0.04);
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) box(g, 0.3, 5, 0.3, mat('#2a2d34', 0.4, 0.6), x, 0, -1.8);
  box(g, w, 0.4, 0.4, mat('#2a2d34', 0.4, 0.6), 0, 5, -1.8);
  box(g, w - 1, 3.4, 0.1, mat('#111', 0.5), 0, 1.0, -1.9);
  const lights: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 8; i++) { const m = new THREE.MeshStandardMaterial({ color: '#111', emissive: RAINBOW[i % 6], emissiveIntensity: 3 }); lights.push(m); const l = cyl(g, 0.15, 0.1, 0.3, m, -w / 2 + 0.8 + i * (w - 1.6) / 7, 4.7, -1.6, 12); l.rotation.x = 0.7; }
  const tex = textTexture(String(o.text ?? '★ SKY FEST ★'), { color: '#ffffff', glow: '#ff3df0', w: 1024, h: 256, size: 150 });
  plane(g, w - 2, (w - 2) / 4, new THREE.MeshStandardMaterial({ map: tex, emissive: '#ff3df0', emissiveMap: tex, emissiveIntensity: 2.5, transparent: true }), 0, 2.2, -1.84);
  return { obj: g, solid: { w, d: 4 }, tick: (t) => lights.forEach((m, i) => { m.emissiveIntensity = 1 + Math.abs(Math.sin(t * 3 + i)) * 4; }) };
}

function foodTruck(o: Opts): Prop {
  const g = G();
  const col = c(o, 'color', '#33a8ff');
  rbox(g, 3.2, 1.9, 1.8, mat(col, 0.4, 0.2), 0, 0.35, 0, 0.15);
  box(g, 1.6, 0.8, 0.05, mat('#111', 0.4), 0.3, 1.1, 0.91);
  box(g, 1.7, 0.06, 0.5, mat('#ffffff', 0.4), 0.3, 1.0, 1.1);
  for (const x of [-1.1, 1.1]) for (const z of [-0.75, 0.75]) { const w = cyl(g, 0.32, 0.32, 0.25, mat('#141414', 0.8), x, 0.32, z, 16); w.rotation.x = Math.PI / 2; w.position.y = 0.32; }
  const tex = textTexture(String(o.text ?? 'TACOS 🌮'), { color: '#ffffff', bg: col, w: 512, h: 128, size: 70 });
  plane(g, 2.2, 0.5, new THREE.MeshStandardMaterial({ map: tex }), 0, 2.05, 0.92);
  return { obj: g, solid: { w: 3.2, d: 1.9 } };
}

function tent(o: Opts): Prop {
  const g = G();
  const r = o.r ?? 1.6;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 2.6, 8, 1, true), new THREE.MeshStandardMaterial({ color: c(o, 'color', '#ff6fb5'), roughness: 0.8, side: THREE.DoubleSide }));
  cone.position.y = 1.3; g.add(cone);
  sph(g, 0.08, GOLD(), 0, 2.65, 0);
  const s = emojiSprite('✨', 0.5); s.position.set(0, 1.6, r * 0.55); g.add(s);
  return { obj: g, solid: { w: r * 1.6, d: r * 1.6 } };
}

function bunting(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 6;
  for (const x of [-w / 2, w / 2]) cyl(g, 0.04, 0.04, 3, mat('#ffffff', 0.4), x, 0, 0, 8);
  for (let i = 0; i < Math.floor(w / 0.5); i++) { const x = -w / 2 + 0.25 + i * 0.5, sag = Math.sin(((i + 0.5) / Math.floor(w / 0.5)) * Math.PI) * 0.4; const f = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 3), mat(RAINBOW[i % 6], 0.6)); f.rotation.z = Math.PI; f.scale.z = 0.1; f.position.set(x, 2.85 - sag, 0); g.add(f); }
  return { obj: g };
}

// ------------------------------------------------------------- sky garden

function cherryTree(o: Opts): Prop {
  const g = G();
  const h = o.h ?? 3.2;
  const trunk = cyl(g, 0.12, 0.2, h * 0.7, mat('#5e3f2b', 0.8), 0, 0, 0, 8); trunk.rotation.z = 0.08;
  for (let i = 0; i < 7; i++) { const a = i * 0.9; sph(g, 0.7 + (i % 3) * 0.15, mat(i % 2 ? '#ffc0d9' : '#ffd6e7', 0.8), Math.sin(a) * 0.8, h * 0.7 + (i % 3) * 0.3, Math.cos(a) * 0.8); }
  const petals: THREE.Sprite[] = [];
  for (let i = 0; i < 5; i++) { const s = emojiSprite('🌸', 0.15); g.add(s); petals.push(s); }
  return { obj: g, solid: { w: 0.6, d: 0.6 }, tick: (t) => petals.forEach((p, i) => { const k = (t * 0.12 + i * 0.2) % 1; p.position.set(Math.sin(i * 2 + t * 0.3) * 1.2, h * 0.8 - k * h * 0.8, Math.cos(i * 2) * 1.2); }) };
}

function koiPond(o: Opts): Prop {
  const g = G();
  const r = o.r ?? 1.8;
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; sph(g, 0.25, mat('#9a9590', 0.9), Math.sin(a) * r, 0.1, Math.cos(a) * r, 1, 0.6, 1); }
  const water = cyl(g, r, r, 0.08, glass('#3a8fbf', 0.8), 0, 0.02, 0, 32); water.castShadow = false;
  const koi: THREE.Sprite[] = [];
  for (let i = 0; i < 4; i++) { const s = emojiSprite('🐟', 0.3); g.add(s); koi.push(s); }
  for (let i = 0; i < 3; i++) { const lp = cyl(g, 0.22, 0.22, 0.02, mat('#3f8f4a', 0.7), Math.sin(i * 2) * r * 0.5, 0.11, Math.cos(i * 2) * r * 0.5, 12); lp.castShadow = false; }
  return { obj: g, solid: { w: r * 2 + 0.3, d: r * 2 + 0.3 }, tick: (t) => koi.forEach((k, i) => k.position.set(Math.sin(t * 0.5 + i * 1.6) * r * 0.6, 0.12, Math.cos(t * 0.5 + i * 1.6) * r * 0.6)) };
}

function gazebo(o: Opts): Prop {
  const g = G();
  const r = o.r ?? 2;
  cyl(g, r, r, 0.15, WHITE(), 0, 0, 0, 8);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; cyl(g, 0.07, 0.07, 2.4, WHITE(), Math.sin(a) * (r - 0.15), 0.15, Math.cos(a) * (r - 0.15), 8); }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(r + 0.3, 1.1, 8), mat(c(o, 'color', '#ffffff'), 0.5)); roof.position.y = 3.1; g.add(roof);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; const f = emojiSprite('🌹', 0.25); f.position.set(Math.sin(a) * (r - 0.1), 2.2, Math.cos(a) * (r - 0.1)); g.add(f); }
  return { obj: g };
}

function bonsai(o: Opts): Prop {
  const g = G();
  rbox(g, 0.6, 0.2, 0.4, mat('#2a5a8a', 0.4), 0, 0.75, 0, 0.04);
  rbox(g, 0.6, 0.75, 0.4, OAK(), 0, 0, 0, 0.03);
  const tr = cyl(g, 0.03, 0.05, 0.35, mat('#5e3f2b', 0.8), 0, 0.95, 0, 6); tr.rotation.z = 0.3;
  for (let i = 0; i < 3; i++) sph(g, 0.14, mat('#2f6e3a', 0.8), -0.15 + i * 0.15, 1.3 + (i % 2) * 0.06, 0, 1, 0.55, 1);
  return { obj: g, solid: { w: 0.6, d: 0.4 } };
}

function hedgeMaze(o: Opts): Prop {
  const g = G();
  const hedge = mat('#2f6e3a', 0.85);
  const w = o.w ?? 6, d = o.d ?? 6;
  // An outer ring with gaps on two sides, and a few inner walls — decorative.
  for (const [x, z, bw, bd] of [[0, -d / 2, w, 0.5], [-w / 2, -0.8, 0.5, d - 1.6], [w / 2, 0.8, 0.5, d - 1.6], [-0.8, d / 2, w - 1.6, 0.5], [0.5, -0.8, 0.5, 3], [-1.2, 1, 3, 0.5]] as const) box(g, bw, 1.3, bd, hedge, x, 0, z);
  for (let i = 0; i < 6; i++) { const s = emojiSprite('🌹', 0.2); s.position.set(-w / 2 + 0.5 + i, 1.4, -d / 2); g.add(s); }
  return { obj: g };
}

export const PROPS3: Record<string, (o: Opts) => Prop> = {
  bigtank: bigTank, jellytube: jellyTube, touchpool: touchPool,
  runway, mannequin, sewing: sewingTable, spotlight,
  oven, cakestand: cakeStand, displaycase: displayCase, cafetable: cafeTable, espresso,
  salonchair: salonChair, nailbar: nailBar, sauna,
  easel, pottery: potteryWheel, sculpture,
  carousel, ferris: ferrisWheel, stall, balloons,
  bigscope: bigTelescope, orrery, rocket, controldesk: controlDesk,
  bigtree: bigTree, waterfall, butterflies, perch: parrotPerch,
  lollipop, candycane: candyCane, chocfountain: chocFountain, gummytree: gummyTree, cupcake: giantCupcake,
  ghost, pumpkin, cauldron, gravestone, candelabra,
  fstage: festivalStage, foodtruck: foodTruck, tent, bunting,
  cherry: cherryTree, koipond: koiPond, gazebo, bonsai, hedgemaze: hedgeMaze,
};
