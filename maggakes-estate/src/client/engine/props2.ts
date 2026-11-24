import * as THREE from 'three';
import { BLACKMETAL, CHROME, GOLD, MARBLE, WHITE, box, cyl, glass, glow, mat, plane, rbox, sph, torus, type Opts, type Prop } from './props';
import { textTexture } from './tex';

/**
 * Furniture for the sky floors (9th–12th): arcade, cinema & bowling,
 * ice rink & snow lounge, penthouse. Same rules as props.ts: origin at the
 * centre of the footprint on the floor, facing +Z.
 */

const G = () => new THREE.Group();
const c = (o: Opts, k: string, d: string) => (o[k] as string) ?? d;
const NEON = ['#ff3df0', '#33e1ff', '#ffd23f', '#7cff6b', '#ff7a1a', '#b388ff'];

// ------------------------------------------------------------- arcade

function arcade(o: Opts): Prop {
  const g = G();
  const col = c(o, 'color', NEON[(o.seed ?? 0) % NEON.length]);
  const body = mat('#1b1c24', 0.45, 0.3);
  rbox(g, 0.8, 1.15, 0.75, body, 0, 0, 0, 0.04);
  rbox(g, 0.8, 0.75, 0.45, body, 0, 1.15, -0.15, 0.04);
  // side stripes
  for (const x of [-0.41, 0.41]) box(g, 0.01, 1.7, 0.08, glow(col, 3), x, 0.1, 0.2);
  const screen = new THREE.MeshStandardMaterial({ color: '#111', emissive: col, emissiveIntensity: 1.6 });
  const s = box(g, 0.6, 0.46, 0.03, screen, 0, 1.3, 0.08);
  s.rotation.x = -0.25;
  box(g, 0.7, 0.05, 0.3, mat('#2a2b33', 0.5), 0, 1.0, 0.33);
  cyl(g, 0.025, 0.025, 0.12, BLACKMETAL(), -0.15, 1.05, 0.36, 8);
  sph(g, 0.045, mat('#ff3d5a', 0.4), -0.15, 1.18, 0.36);
  for (let i = 0; i < 3; i++) sph(g, 0.03, glow(NEON[(i + 1) % NEON.length], 2), 0.05 + i * 0.09, 1.07, 0.38);
  const tex = textTexture(String(o.text ?? 'PLAY'), { color: '#ffffff', glow: col, w: 512, h: 128, size: 84 });
  const marquee = new THREE.MeshStandardMaterial({ map: tex, emissive: col, emissiveMap: tex, emissiveIntensity: 3 });
  plane(g, 0.74, 0.18, marquee, 0, 1.75, 0.08);
  return { obj: g, solid: { w: 0.85, d: 0.8 }, tick: (t) => { screen.emissiveIntensity = 1.2 + Math.sin(t * 7 + (o.seed ?? 0)) * 0.5; } };
}

function claw(o: Opts): Prop {
  const g = G();
  const col = c(o, 'color', '#ff6fb5');
  rbox(g, 1.0, 0.9, 1.0, mat(col, 0.4), 0, 0, 0, 0.05);
  box(g, 0.96, 1.0, 0.96, glass('#e8f8ff', 0.18), 0, 0.9, 0);
  rbox(g, 1.04, 0.22, 1.04, mat(col, 0.4), 0, 1.9, 0, 0.05);
  const toys = ['#ffd23f', '#33e1ff', '#ff3df0', '#7cff6b', '#ffffff', '#ff7a1a'];
  for (let i = 0; i < 14; i++) sph(g, 0.09, mat(toys[i % toys.length], 0.8), -0.33 + (i % 5) * 0.16, 0.98 + Math.floor(i / 5) * 0.11, -0.3 + ((i * 7) % 5) * 0.14);
  const clawG = G();
  cyl(clawG, 0.008, 0.008, 0.5, CHROME(), 0, 0, 0, 6);
  for (let k = 0; k < 3; k++) { const f = box(clawG, 0.02, 0.12, 0.02, CHROME(), Math.sin(k * 2.1) * 0.05, -0.06, Math.cos(k * 2.1) * 0.05); f.rotation.z = 0.4; }
  clawG.position.y = 1.35;
  g.add(clawG);
  box(g, 0.3, 0.03, 0.15, mat('#222', 0.5), 0.25, 0.9, 0.53);
  sph(g, 0.04, mat('#ff3d5a', 0.4), 0.2, 0.98, 0.55);
  return { obj: g, solid: { w: 1.05, d: 1.05 }, tick: (t) => { clawG.position.x = Math.sin(t * 0.7) * 0.3; clawG.position.z = Math.cos(t * 0.5) * 0.25; } };
}

function airHockey(o: Opts): Prop {
  const g = G();
  rbox(g, 1.3, 0.72, 2.2, mat(c(o, 'color', '#1f3b5c'), 0.5), 0, 0, 0, 0.05);
  box(g, 1.2, 0.02, 2.1, mat('#ffffff', 0.15), 0, 0.73, 0);
  box(g, 1.2, 0.005, 0.02, glow('#ff3d5a', 2), 0, 0.745, 0);
  torus(g, 0.2, 0.01, glow('#33e1ff', 2), 0, 0.75, 0).rotation.x = Math.PI / 2;
  for (const z of [-0.85, 0.85]) cyl(g, 0.07, 0.07, 0.05, mat(z > 0 ? '#ff3d5a' : '#33e1ff', 0.4), 0, 0.745, z, 16);
  const puck = cyl(g, 0.05, 0.05, 0.015, mat('#222', 0.4), 0, 0.745, 0, 16);
  return { obj: g, solid: { w: 1.3, d: 2.2 }, tick: (t) => { puck.position.x = Math.sin(t * 2.3) * 0.45; puck.position.z = Math.sin(t * 1.7) * 0.9; } };
}

function dancePad(o: Opts): Prop {
  const g = G();
  const body = mat('#1b1c24', 0.45, 0.3);
  rbox(g, 1.6, 0.12, 1.4, body, 0, 0, 0.3, 0.03);
  const pads: THREE.MeshStandardMaterial[] = [];
  for (const [x, z, k] of [[-0.45, 0.3, 0], [0.45, 0.3, 1], [0, -0.1, 2], [0, 0.7, 3]] as const) {
    const m = new THREE.MeshStandardMaterial({ color: '#222', emissive: NEON[k], emissiveIntensity: 0.4 });
    pads.push(m);
    box(g, 0.38, 0.02, 0.38, m, x, 0.12, z);
  }
  rbox(g, 1.6, 1.9, 0.4, body, 0, 0, -0.75, 0.04);
  const screen = new THREE.MeshStandardMaterial({ color: '#111', emissive: c(o, 'color', '#ff3df0'), emissiveIntensity: 1.5 });
  box(g, 1.2, 0.7, 0.03, screen, 0, 1.0, -0.54);
  const tex = textTexture('DANCE!', { color: '#ffffff', glow: '#ff3df0', w: 512, h: 128, size: 84 });
  plane(g, 1.4, 0.35, new THREE.MeshStandardMaterial({ map: tex, emissive: '#ff3df0', emissiveMap: tex, emissiveIntensity: 3 }), 0, 1.95, -0.54);
  box(g, 1.4, 0.04, 0.04, CHROME(), 0, 1.05, 0.95);
  return { obj: g, solid: { w: 1.6, d: 0.5 }, tick: (t) => { const on = Math.floor(t * 3) % 4; pads.forEach((m, i) => { m.emissiveIntensity = i === on ? 3 : 0.3; }); } };
}

function prizeCounter(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 3;
  rbox(g, w, 1.0, 0.7, mat(c(o, 'color', '#ff6fb5'), 0.5), 0, 0, 0, 0.04);
  box(g, w, 0.04, 0.75, glass('#ffffff', 0.4), 0, 1.0, 0);
  rbox(g, w, 2.2, 0.35, mat('#fff3d6', 0.7), 0, 0, -1.0, 0.03);
  const toys = ['#ffd23f', '#33e1ff', '#ff3df0', '#7cff6b', '#ffffff', '#b388ff'];
  for (let row = 0; row < 3; row++) {
    box(g, w - 0.1, 0.03, 0.3, WHITE(), 0, 0.7 + row * 0.55, -0.85);
    for (let i = 0; i < Math.floor(w / 0.35); i++) sph(g, 0.12, mat(toys[(i + row) % toys.length], 0.85), -w / 2 + 0.25 + i * 0.35, 0.85 + row * 0.55, -0.85);
  }
  const tex = textTexture('PRIZES 🎟️', { color: '#ffffff', glow: '#ff3df0', w: 1024, h: 256, size: 150 });
  plane(g, 2, 0.5, new THREE.MeshStandardMaterial({ map: tex, emissive: '#ff3df0', emissiveMap: tex, emissiveIntensity: 2.5, transparent: true }), 0, 2.5, -0.82);
  return { obj: g, solid: { w, d: 1.9 } };
}

// ------------------------------------------------------------- cinema & bowling

function bowlingLane(o: Opts): Prop {
  const g = G();
  const l = o.l ?? 9;
  const wood = mat('#d8b07a', 0.25);
  box(g, 1.1, 0.04, l, wood, 0, 0, 0);
  for (const x of [-0.65, 0.65]) box(g, 0.2, 0.02, l, mat('#2a2b33', 0.4), x, 0, 0);
  for (let i = 0; i < 7; i++) box(g, 0.03, 0.005, 0.12, glow('#ffd23f', 1.5), -0.3 + i * 0.1, 0.045, l / 2 - 2.5);
  // pins at the far (-z) end
  const rows = [[0], [-0.12, 0.12], [-0.24, 0, 0.24], [-0.36, -0.12, 0.12, 0.36]];
  rows.forEach((row, ri) => row.forEach((x) => {
    const pin = G();
    cyl(pin, 0.04, 0.05, 0.25, WHITE(), 0, 0.04, 0, 10);
    sph(pin, 0.045, WHITE(), 0, 0.32, 0);
    cyl(pin, 0.042, 0.042, 0.03, mat('#ff3d5a', 0.4), 0, 0.22, 0, 10);
    pin.position.set(x, 0, -l / 2 + 0.6 + ri * 0.2);
    g.add(pin);
  }));
  rbox(g, 1.5, 1.2, 0.4, mat('#1b1c24', 0.5), 0, 0, -l / 2 - 0.2, 0.04);
  box(g, 1.4, 0.15, 0.02, glow(c(o, 'color', '#33e1ff'), 2.5), 0, 0.9, -l / 2 + 0.01);
  const ball = sph(g, 0.11, mat(c(o, 'ball', '#ff3df0'), 0.15, 0.3), 0, 0.15, l / 2 - 0.6);
  return { obj: g, solid: { w: 1.5, d: l - 1.6 }, tick: (t) => { const k = (t * 0.25 + (o.seed ?? 0) * 0.37) % 1; ball.position.z = l / 2 - 0.6 - k * (l - 1.6); ball.rotation.x = -k * 40; } };
}

function ballReturn(o: Opts): Prop {
  const g = G();
  rbox(g, 0.5, 0.6, 1.2, mat('#2a2b33', 0.4), 0, 0, 0, 0.08);
  const cols = ['#ff3df0', '#33e1ff', '#ffd23f', '#7cff6b', '#b388ff'];
  for (let i = 0; i < 5; i++) sph(g, 0.11, mat(cols[(i + (o.seed ?? 0)) % cols.length], 0.15, 0.3), 0, 0.68, -0.45 + i * 0.22);
  return { obj: g, solid: { w: 0.5, d: 1.2 } };
}

function cinemaScreen(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 8, h = w * 0.45;
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 116;
  const ctx = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 1.2 });
  plane(g, w, h, m, 0, 1.0 + h / 2, 0.06);
  box(g, w + 0.3, h + 0.3, 0.08, mat('#111', 0.6), 0, 0.85, 0);
  for (const x of [-w / 2 - 0.4, w / 2 + 0.4]) rbox(g, 0.5, 3.4, 0.4, mat('#7a1020', 0.9), x, 0, 0.1, 0.1);
  let last = -1;
  const draw = (t: number) => {
    const hue = (t * 12) % 360;
    const gr = ctx.createLinearGradient(0, 0, 256, 116);
    gr.addColorStop(0, `hsl(${hue},70%,55%)`);
    gr.addColorStop(1, `hsl(${(hue + 90) % 360},70%,35%)`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 256, 116);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 3; i++) { const x = (t * 30 + i * 90) % 300 - 20; ctx.beginPath(); ctx.arc(x, 60 + Math.sin(t + i) * 20, 10 + i * 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(o.text ?? '✨ NOW SHOWING ✨'), 128, 104);
    tex.needsUpdate = true;
  };
  draw(0);
  return { obj: g, tick: (t) => { const f = Math.floor(t * 8); if (f !== last) { last = f; draw(t); } } };
}

function cinemaSeats(o: Opts): Prop {
  const g = G();
  const n = o.n ?? 6;
  const red = mat(c(o, 'color', '#b5122b'), 0.85);
  for (let i = 0; i < n; i++) {
    const x = -(n - 1) * 0.35 + i * 0.7;
    rbox(g, 0.62, 0.42, 0.7, red, x, 0.02, 0, 0.08);
    rbox(g, 0.62, 0.65, 0.18, red, x, 0.3, -0.3, 0.08);
    cyl(g, 0.04, 0.04, 0.08, mat('#222', 0.5), x + 0.33, 0.6, 0.15, 10);
  }
  box(g, n * 0.7, 0.06, 0.06, mat('#222', 0.5), 0, 0.02, -0.4);
  return { obj: g, solid: { w: n * 0.7, d: 0.75 } };
}

function popcorn(o: Opts): Prop {
  const g = G();
  rbox(g, 0.9, 0.9, 0.6, mat(c(o, 'color', '#d7263d'), 0.5), 0, 0, 0, 0.05);
  box(g, 0.8, 0.7, 0.5, glass('#fff7d6', 0.25), 0, 0.92, 0);
  const pop = mat('#fff3c4', 0.9);
  for (let i = 0; i < 40; i++) sph(g, 0.035, pop, -0.33 + (i % 8) * 0.095, 0.95 + Math.floor(i / 8) * 0.06, -0.18 + ((i * 3) % 5) * 0.09);
  rbox(g, 0.95, 0.18, 0.65, mat(c(o, 'color', '#d7263d'), 0.5), 0, 1.62, 0, 0.05);
  const tex = textTexture('POPCORN', { color: '#ffffff', glow: '#ffd23f', w: 512, h: 128, size: 80 });
  plane(g, 0.85, 0.16, new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffd23f', emissiveMap: tex, emissiveIntensity: 2.5 }), 0, 1.7, 0.33);
  for (const x of [-0.3, 0.3]) for (const z of [-0.2, 0.2]) cyl(g, 0.06, 0.06, 0.05, mat('#222', 0.5), x, -0.02, z, 10);
  return { obj: g, solid: { w: 0.95, d: 0.65 } };
}

// ------------------------------------------------------------- ice & snow

function rinkBoard(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 4;
  box(g, w, 0.9, 0.12, WHITE(), 0, 0, 0);
  box(g, w, 0.08, 0.16, mat(c(o, 'color', '#33a8ff'), 0.4), 0, 0.9, 0);
  box(g, w, 0.9, 0.04, glass('#e8f8ff', 0.2), 0, 0.98, 0);
  return { obj: g, solid: { w, d: 0.2 } };
}

function snowman(o: Opts): Prop {
  const g = G();
  const s = o.s ?? 1;
  const snow = mat('#ffffff', 0.9);
  sph(g, 0.42 * s, snow, 0, 0.38 * s, 0);
  sph(g, 0.3 * s, snow, 0, 0.98 * s, 0);
  sph(g, 0.21 * s, snow, 0, 1.42 * s, 0);
  for (const x of [-0.07, 0.07]) sph(g, 0.025 * s, mat('#111', 0.4), x * s, 1.48 * s, 0.19 * s);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035 * s, 0.18 * s, 8), mat('#ff7a1a', 0.6));
  nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.42 * s, 0.27 * s); g.add(nose);
  torus(g, 0.21 * s, 0.045 * s, mat(c(o, 'scarf', '#ff3d5a'), 0.9), 0, 1.24 * s, 0).rotation.x = Math.PI / 2;
  cyl(g, 0.16 * s, 0.16 * s, 0.03, mat('#111', 0.5), 0, 1.58 * s, 0, 16);
  cyl(g, 0.11 * s, 0.11 * s, 0.22 * s, mat('#111', 0.5), 0, 1.6 * s, 0, 16);
  for (const sx of [-1, 1]) { const arm = cyl(g, 0.015, 0.015, 0.5 * s, mat('#5e3f2b', 0.8), sx * 0.38 * s, 1.0 * s, 0, 5); arm.rotation.z = sx * 1.0; }
  return { obj: g, solid: { w: 0.8 * s, d: 0.8 * s } };
}

function igloo(o: Opts): Prop {
  const g = G();
  const r = o.r ?? 1.6;
  const ice = mat('#f2fbff', 0.5);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), ice);
  g.add(dome);
  for (let k = 1; k < 4; k++) torus(g, r * Math.cos((k * Math.PI) / 9), 0.02, mat('#d3ecf7', 0.6), 0, r * Math.sin((k * Math.PI) / 9), 0).rotation.x = Math.PI / 2;
  const door = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.8, 16, 1, false, 0, Math.PI), ice);
  door.rotation.z = Math.PI / 2; door.rotation.y = Math.PI / 2; door.position.set(0, 0.5, r - 0.1);
  g.add(door);
  box(g, 0.7, 0.9, 0.05, mat('#26313d', 0.8), 0, 0.0, r + 0.25);
  return { obj: g, solid: { w: r * 2, d: r * 2 } };
}

function pine(o: Opts): Prop {
  const g = G();
  const h = o.h ?? 3;
  cyl(g, 0.1, 0.13, h * 0.25, mat('#5e3f2b', 0.8), 0, 0, 0, 8);
  const leaf = mat('#2f6e3a', 0.8), snow = mat('#ffffff', 0.9);
  for (let k = 0; k < 4; k++) {
    const r = (0.9 - k * 0.18) * (h / 3), y = h * 0.2 + k * h * 0.2;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h * 0.35, 10), leaf);
    cone.position.y = y + h * 0.17; g.add(cone);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, h * 0.14, 10), snow);
    cap.position.y = y + h * 0.3; g.add(cap);
  }
  if (o.lights) for (let i = 0; i < 14; i++) { const a = i * 2.3, y = 0.6 + (i / 14) * h * 0.75; sph(g, 0.04, glow(NEON[i % NEON.length], 3), Math.sin(a) * (0.75 - y / (h * 1.6)) * (h / 3), y, Math.cos(a) * (0.75 - y / (h * 1.6)) * (h / 3)); }
  if (o.star) sph(g, 0.12, glow('#ffd23f', 4), 0, h + 0.15, 0);
  return { obj: g, solid: { w: 1.2, d: 1.2 } };
}

function fireplace(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 2;
  rbox(g, w, 1.3, 0.6, mat(c(o, 'color', '#e9e2d8'), 0.7), 0, 0, 0, 0.04);
  box(g, w * 0.6, 0.65, 0.05, mat('#1b1612', 0.9), 0, 0.15, 0.29);
  box(g, w + 0.2, 0.1, 0.75, MARBLE(), 0, 1.3, 0);
  const flames: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 6), glow(i % 2 ? '#ff7a1a' : '#ffd23f', 4));
    f.position.set(-0.3 + i * 0.15, 0.35, 0.22); g.add(f); flames.push(f);
  }
  for (const x of [-0.3, 0, 0.3]) { const log = cyl(g, 0.06, 0.06, 0.45, mat('#5e3f2b', 0.8), x, 0.2, 0.22, 8); log.rotation.z = Math.PI / 2; }
  const light = new THREE.PointLight('#ff9a3c', 3, 6, 2);
  light.position.set(0, 0.6, 0.8);
  g.add(light);
  return { obj: g, solid: { w, d: 0.7 }, light, tick: (t) => { flames.forEach((f, i) => { f.scale.y = 0.8 + Math.abs(Math.sin(t * 9 + i * 1.7)) * 0.5; }); light.intensity = 2.6 + Math.sin(t * 11) * 0.5; } };
}

function hotChoc(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 2.4;
  rbox(g, w, 1.0, 0.7, mat(c(o, 'color', '#7a4a2e'), 0.7), 0, 0, 0, 0.04);
  box(g, w + 0.1, 0.06, 0.8, MARBLE(), 0, 1.0, 0);
  for (let i = 0; i < 5; i++) {
    const x = -w / 2 + 0.35 + i * (w - 0.7) / 4;
    cyl(g, 0.06, 0.05, 0.12, mat(NEON[i], 0.5), x, 1.06, 0.1, 12);
    cyl(g, 0.055, 0.055, 0.01, mat('#5a3420', 0.6), x, 1.17, 0.1, 12);
    sph(g, 0.025, mat('#ffffff', 0.9), x, 1.19, 0.1);
  }
  cyl(g, 0.18, 0.18, 0.4, CHROME(), -w / 2 + 0.3, 1.06, -0.15, 16);
  return { obj: g, solid: { w, d: 0.8 } };
}

// ------------------------------------------------------------- penthouse

function helipad(o: Opts): Prop {
  const g = G();
  const r = o.r ?? 3;
  cyl(g, r, r, 0.05, mat('#2a2d34', 0.7), 0, 0, 0, 40);
  torus(g, r - 0.2, 0.05, mat('#ffd23f', 0.5), 0, 0.06, 0).rotation.x = Math.PI / 2;
  const hm = mat('#ffffff', 0.5);
  box(g, 0.25, 0.01, 1.6, hm, -0.5, 0.055, 0); box(g, 0.25, 0.01, 1.6, hm, 0.5, 0.055, 0); box(g, 1.0, 0.01, 0.25, hm, 0, 0.055, 0);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; sph(g, 0.05, glow(i % 2 ? '#33e1ff' : '#7cff6b', 3), Math.sin(a) * (r - 0.05), 0.08, Math.cos(a) * (r - 0.05)); }
  return { obj: g };
}

function helicopter(o: Opts): Prop {
  const g = G();
  const body = mat(c(o, 'color', '#ffffff'), 0.25, 0.3);
  sph(g, 0.9, body, 0, 1.0, 0, 1, 0.85, 1.4);
  sph(g, 0.72, glass('#2a3440', 0.7), 0, 1.15, 0.45, 1, 0.8, 1);
  const tail = cyl(g, 0.12, 0.2, 2.4, body, 0, 1.1, -1.9, 10); tail.rotation.x = Math.PI / 2;
  box(g, 0.05, 0.6, 0.4, mat(c(o, 'accent', '#ff3df0'), 0.4), 0, 1.1, -3.0);
  for (const x of [-0.6, 0.6]) { box(g, 0.06, 0.06, 2.0, CHROME(), x, 0.05, 0); box(g, 0.05, 0.4, 0.05, CHROME(), x, 0.2, 0.5); box(g, 0.05, 0.4, 0.05, CHROME(), x, 0.2, -0.5); }
  const rotor = G();
  box(rotor, 5.5, 0.03, 0.18, BLACKMETAL(), 0, 0, 0); box(rotor, 0.18, 0.03, 5.5, BLACKMETAL(), 0, 0, 0);
  rotor.position.y = 1.95; g.add(rotor);
  cyl(g, 0.06, 0.06, 0.25, BLACKMETAL(), 0, 1.75, 0, 8);
  return { obj: g, solid: { w: 1.9, d: 2.6 }, tick: (t) => { rotor.rotation.y = t * (o.spin ?? 0.6); } };
}

function champagneTower(o: Opts): Prop {
  const g = G();
  rbox(g, 0.9, 0.85, 0.9, mat(c(o, 'color', '#ffffff'), 0.4), 0, 0, 0, 0.05);
  const gl = glass('#ffe9a8', 0.55);
  let y = 0.88;
  for (const n of [4, 3, 2, 1]) {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = (i - (n - 1) / 2) * 0.14, z = (j - (n - 1) / 2) * 0.14;
      cyl(g, 0.06, 0.02, 0.07, gl, x, y + 0.06, z, 10);
      cyl(g, 0.008, 0.008, 0.06, gl, x, y, z, 6);
    }
    y += 0.14;
  }
  return { obj: g, solid: { w: 0.9, d: 0.9 } };
}

function grandPiano(o: Opts): Prop {
  const g = G();
  const black = mat(c(o, 'color', '#111216'), 0.15, 0.2);
  const top = new THREE.Shape();
  top.moveTo(-0.75, -0.9); top.lineTo(0.75, -0.9); top.lineTo(0.75, 0.3);
  top.quadraticCurveTo(0.7, 1.2, -0.1, 1.3); top.quadraticCurveTo(-0.75, 1.0, -0.75, 0.3); top.lineTo(-0.75, -0.9);
  const geo = new THREE.ExtrudeGeometry(top, { depth: 0.32, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2); geo.translate(0, 0.62, 0);
  const m = new THREE.Mesh(geo, black); g.add(m);
  box(g, 1.5, 0.08, 0.25, WHITE(), 0, 0.82, -1.0);
  for (let i = 0; i < 24; i++) if (i % 7 !== 2 && i % 7 !== 6) box(g, 0.035, 0.03, 0.14, black, -0.7 + i * 0.062, 0.87, -0.97);
  for (const [x, z] of [[-0.65, -0.75], [0.65, -0.75], [0, 1.0]]) cyl(g, 0.05, 0.04, 0.62, black, x, 0, z, 10);
  const lid = box(g, 1.3, 0.02, 1.6, black, 0, 1.25, 0.2); lid.rotation.x = 0.5;
  rbox(g, 0.9, 0.5, 0.4, black, 0, 0, -1.55, 0.04);
  return { obj: g, solid: { w: 1.5, d: 2.4 } };
}

function vipRope(o: Opts): Prop {
  const g = G();
  const w = o.w ?? 2;
  for (const x of [-w / 2, w / 2]) { cyl(g, 0.15, 0.18, 0.04, GOLD(), x, 0, 0, 16); cyl(g, 0.03, 0.03, 0.95, GOLD(), x, 0, 0, 8); sph(g, 0.05, GOLD(), x, 0.98, 0); }
  const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-w / 2, 0.9, 0), new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(w / 2, 0.9, 0)), 12, 0.03, 6), mat(c(o, 'color', '#b5122b'), 0.7));
  g.add(rope);
  return { obj: g, solid: { w, d: 0.3 } };
}

export const PROPS2: Record<string, (o: Opts) => Prop> = {
  arcade, claw, airhockey: airHockey, dancepad: dancePad, prizes: prizeCounter,
  bowlinglane: bowlingLane, ballreturn: ballReturn, cinemascreen: cinemaScreen, cinemaseats: cinemaSeats, popcorn,
  rinkboard: rinkBoard, snowman, igloo, pine, fireplace, hotchoc: hotChoc,
  helipad, helicopter, champagne: champagneTower, grandpiano: grandPiano, viprope: vipRope,
};
