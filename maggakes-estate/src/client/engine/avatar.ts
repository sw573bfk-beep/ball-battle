import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { normalizeLook, type Look } from '../../shared/look';
import { shopItem } from '../../shared/shop';
import { bubbleTexture, emojiTexture, glowTexture, hairTexture, nameTexture } from './tex';
import { mat, GOLD } from './props';

export type Mode = 'walk' | 'swim' | 'soak' | 'drive';
export type Emote = 'wave' | 'dance' | 'heart' | 'sit' | 'pose';

// ------------------------------------------------------------------ geometry helpers

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined;
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}

const SPHERE = new THREE.SphereGeometry(1, 28, 20);

/** A rounded, tapered limb hanging down from its origin (like an arm or leg). */
function limb(rTop: number, rBot: number, len: number): THREE.BufferGeometry {
  const k = `limb${rTop.toFixed(3)},${rBot.toFixed(3)},${len.toFixed(3)}`;
  return cached(k, () => {
    // Bottom pole → bottom equator → taper → top equator → top pole (bottom-to-top for outward normals).
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * rBot, -len - Math.cos(a) * rBot)); }
    pts.push(new THREE.Vector2(rBot + (rTop - rBot) * 0.35, -len * 0.66), new THREE.Vector2(rBot + (rTop - rBot) * 0.75, -len * 0.3));
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * rTop, Math.sin(a) * rTop)); }
    pts[0].x = 0.0001;
    pts[pts.length - 1].x = 0.0001;
    return new THREE.LatheGeometry(pts, 18);
  });
}

/** Cuts a lathe profile to the height band [y0, y1]. */
function band(profile: [number, number][], y0: number, y1: number, grow = 1, close = true): THREE.Vector2[] {
  const at = (y: number) => {
    for (let i = 0; i < profile.length - 1; i++) {
      const [r0, a] = profile[i], [r1, b] = profile[i + 1];
      if (y >= a && y <= b) return r0 + ((y - a) / (b - a || 1)) * (r1 - r0);
    }
    return profile[profile.length - 1][0];
  };
  const pts: THREE.Vector2[] = [];
  if (close) pts.push(new THREE.Vector2(0.0001, y0));
  pts.push(new THREE.Vector2(at(y0) * grow, y0));
  for (const [r, y] of profile) if (y > y0 && y < y1) pts.push(new THREE.Vector2(r * grow, y));
  pts.push(new THREE.Vector2(at(y1) * grow, y1));
  if (close) pts.push(new THREE.Vector2(0.0001, y1));
  return pts;
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = shadow;
  me.receiveShadow = true;
  parent.add(me);
  return me;
}

function joint(parent: THREE.Object3D, x: number, y: number, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

const fabricCache = new Map<string, THREE.MeshStandardMaterial>();
function fabric(color: string, kind: 'cotton' | 'satin' | 'sequin' | 'denim' | 'linen' = 'cotton'): THREE.MeshStandardMaterial {
  const k = `${color}|${kind}`;
  let m = fabricCache.get(k);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({
      color, roughness: kind === 'satin' ? 0.32 : kind === 'sequin' ? 0.25 : kind === 'denim' ? 0.85 : 0.78,
      metalness: kind === 'sequin' ? 0.55 : 0, sheen: kind === 'satin' || kind === 'cotton' ? 0.6 : 0, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.5,
    });
    fabricCache.set(k, m);
  }
  return m;
}

function skinMat(color: string): THREE.MeshStandardMaterial {
  const k = `skin${color}`;
  let m = fabricCache.get(k);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, sheen: 0.25, sheenColor: new THREE.Color('#ffd9c9'), clearcoat: 0.05 });
    fabricCache.set(k, m);
  }
  return m;
}

function hairMat(color: string, glossy = false): THREE.MeshStandardMaterial {
  const k = `hair${color}${glossy}`;
  let m = fabricCache.get(k);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color, map: hairTexture(), roughness: glossy ? 0.28 : 0.48, sheen: 0.8, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.35), sheenRoughness: 0.35, side: THREE.DoubleSide });
    fabricCache.set(k, m);
  }
  return m;
}

// ------------------------------------------------------------------ outfits

type Sleeve = 'none' | 'strap' | 'short' | 'long';
type Legs = 'pants' | 'shorts' | 'mini' | 'knee' | 'midi' | 'maxi' | 'leggings';
type Shoe = 'sneakers' | 'heels' | 'sandals' | 'dress' | 'loafers' | 'slides' | 'barefoot';
interface Style { sleeve: Sleeve; legs: Legs; shoe: Shoe; kind?: 'cotton' | 'satin' | 'sequin' | 'linen' | 'denim'; jacket?: boolean; open?: boolean; collar?: boolean; hood?: boolean; vneck?: boolean }

const STYLES: Record<string, Style> = {
  casual: { sleeve: 'short', legs: 'pants', shoe: 'sneakers' },
  dress: { sleeve: 'strap', legs: 'knee', shoe: 'sandals' },
  gown: { sleeve: 'strap', legs: 'maxi', shoe: 'heels', kind: 'satin' },
  suit: { sleeve: 'long', legs: 'pants', shoe: 'dress', jacket: true, collar: true },
  track: { sleeve: 'long', legs: 'pants', shoe: 'sneakers' },
  hoodie: { sleeve: 'long', legs: 'pants', shoe: 'sneakers', hood: true },
  beach: { sleeve: 'none', legs: 'shorts', shoe: 'slides' },
  gym: { sleeve: 'none', legs: 'leggings', shoe: 'sneakers' },
  pjs: { sleeve: 'long', legs: 'pants', shoe: 'slides', kind: 'satin', collar: true },
  slip: { sleeve: 'strap', legs: 'midi', shoe: 'heels', kind: 'satin' },
  coord: { sleeve: 'short', legs: 'knee', shoe: 'heels' },
  sequin: { sleeve: 'strap', legs: 'knee', shoe: 'heels', kind: 'sequin' },
  sundress: { sleeve: 'strap', legs: 'midi', shoe: 'sandals' },
  linen: { sleeve: 'short', legs: 'shorts', shoe: 'loafers', kind: 'linen', collar: true, vneck: true },
  openshirt: { sleeve: 'short', legs: 'shorts', shoe: 'slides', open: true, collar: true },
  polo: { sleeve: 'short', legs: 'pants', shoe: 'loafers', collar: true },
  blazer: { sleeve: 'long', legs: 'pants', shoe: 'loafers', jacket: true, vneck: true },
};

// Torso control points: [radius, height above the hip line]. Smoothed with a spline.
const GIRL_CTRL: [number, number][] = [[0.126, 0], [0.142, 0.06], [0.143, 0.12], [0.13, 0.19], [0.117, 0.25], [0.121, 0.3], [0.132, 0.36], [0.134, 0.41], [0.122, 0.45], [0.094, 0.48], [0.058, 0.5], [0.045, 0.515]];
const BOY_CTRL: [number, number][] = [[0.128, 0], [0.144, 0.06], [0.146, 0.13], [0.141, 0.2], [0.141, 0.26], [0.152, 0.32], [0.167, 0.39], [0.17, 0.44], [0.155, 0.49], [0.116, 0.53], [0.068, 0.56], [0.055, 0.575]];
function smooth(ctrl: [number, number][]): [number, number][] {
  const curve = new THREE.SplineCurve(ctrl.map(([r, y]) => new THREE.Vector2(r, y)));
  return curve.getSpacedPoints(40).map((v) => [v.x, v.y] as [number, number]);
}
const GIRL_TORSO = smooth(GIRL_CTRL);
const BOY_TORSO = smooth(BOY_CTRL);

/** A head-shaped sphere: tapered jaw, chin, cheekbones. Squarer jaw for boys. */
function headGeo(girl: boolean): THREE.BufferGeometry {
  return cached(girl ? 'headg' : 'headb', () => {
    const g = new THREE.SphereGeometry(1, 56, 44);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (y < 0) {
        const t = -y;
        x *= 1 - (girl ? 0.34 : 0.2) * t * t;
        if (!girl) x *= 1 + 0.07 * Math.exp(-((y + 0.62) ** 2) / 0.03);
        if (z > 0) z += (girl ? 0.06 : 0.09) * Math.exp(-((y + 0.86) ** 2) / 0.02) * z;
        z *= 1 - 0.08 * t * t;
      }
      if (z > 0.3 && y > -0.35 && y < 0.1) x *= 1.025;
      if (z < 0) z *= 1.06;
      x *= 0.97;
      pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
  });
}

/** Lower-face shell from the head shape, used for stubble and beards. */
function beardGeo(girl: boolean): THREE.BufferGeometry {
  return cached('beard' + girl, () => {
    const src = headGeo(girl).toNonIndexed();
    const p = src.attributes.position as THREE.BufferAttribute;
    const keep: number[] = [];
    for (let i = 0; i < p.count; i += 3) {
      let cy = 0, cz = 0;
      for (let k = 0; k < 3; k++) { cy += p.getY(i + k) / 3; cz += p.getZ(i + k) / 3; }
      if (cy < -0.28 && cz > -0.25 && !(cy > -0.62 && cy < -0.46 && cz > 0.75)) for (let k = 0; k < 3; k++) keep.push(p.getX(i + k) * 1.03, p.getY(i + k) * 1.02, p.getZ(i + k) * 1.03);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
    g.computeVertexNormals();
    return g;
  });
}

function shapeTorso(base: [number, number][], build: string, girl: boolean): [number, number][] {
  const w = { slim: 0.9, average: 1, athletic: 1.02, curvy: 1.02, strong: 1.12 }[build] ?? 1;
  const hip = { slim: 0.95, average: 1, athletic: 0.97, curvy: 1.1, strong: 1.02 }[build] ?? 1;
  const top = { slim: 0.95, average: 1, athletic: girl ? 1.04 : 1.1, curvy: 1.02, strong: 1.1 }[build] ?? 1;
  const n = base.length;
  return base.map(([r, y], i) => [r * w * (i < 4 ? hip : i > n - 5 ? top : (hip + top) / 2), y]);
}

// ------------------------------------------------------------------ avatar

export class Avatar {
  root = new THREE.Group();
  private body = new THREE.Group();
  private parts = new THREE.Group();
  private lArm!: THREE.Group;
  private rArm!: THREE.Group;
  private lElbow!: THREE.Group;
  private rElbow!: THREE.Group;
  private lLeg!: THREE.Group;
  private rLeg!: THREE.Group;
  private lKnee!: THREE.Group;
  private rKnee!: THREE.Group;
  private head!: THREE.Group;
  private hipY = 0.9;
  private tag?: THREE.Sprite;
  private bubble?: THREE.Sprite;
  private bubbleUntil = 0;
  private emoteIcon?: THREE.Sprite;
  private sparkles: THREE.Sprite[] = [];
  private sparkleColor: number | null = null;
  private phase = 0;
  private blinkAt = 0;
  private eyes: THREE.Object3D[] = [];
  private tagY = 2.1;
  look: Look;
  emote: Emote | null = null;
  emoteUntil = 0;
  /** Optional prop held in the right hand (e.g. the host's microphone). */
  holding: 'mic' | null = null;

  constructor(look: Look, name?: string, vip = false, sub?: string, holding: 'mic' | null = null) {
    this.look = normalizeLook(look);
    this.holding = holding;
    this.root.add(this.body);
    this.body.add(this.parts);
    this.build();
    if (name) this.setName(name, vip, sub);
  }

  setName(name: string, vip: boolean, sub?: string): void {
    if (this.tag) { this.root.remove(this.tag); this.tag.material.map?.dispose(); this.tag.material.dispose(); }
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTexture(name, vip, sub), transparent: true, depthWrite: false, depthTest: false }));
    this.tag.scale.set(1.6, 0.5, 1);
    this.tag.position.y = this.tagY;
    this.tag.renderOrder = 10;
    this.root.add(this.tag);
  }

  say(text: string): void {
    if (this.bubble) { this.root.remove(this.bubble); this.bubble.material.map?.dispose(); this.bubble.material.dispose(); }
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture(text), transparent: true, depthWrite: false, depthTest: false }));
    this.bubble.scale.set(2.4, 0.9, 1);
    this.bubble.position.y = this.tagY + 0.6;
    this.bubble.renderOrder = 11;
    this.root.add(this.bubble);
    this.bubbleUntil = performance.now() + 6000;
  }

  doEmote(e: Emote): void {
    this.emote = e;
    this.emoteUntil = performance.now() + (e === 'sit' ? 600_000 : 3500);
    if (this.emoteIcon) this.root.remove(this.emoteIcon);
    const icon = { wave: '👋', dance: '💃', heart: '💖', sit: '🪑', pose: '📸' }[e];
    this.emoteIcon = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(icon), transparent: true, depthWrite: false }));
    this.emoteIcon.scale.setScalar(0.5);
    this.emoteIcon.position.set(0.5, this.tagY - 0.15, 0);
    this.root.add(this.emoteIcon);
    setTimeout(() => { if (this.emoteIcon) { this.root.remove(this.emoteIcon); this.emoteIcon = undefined; } }, 2500);
  }

  setLook(look: Look): void {
    this.look = normalizeLook(look);
    this.parts.clear();
    this.eyes = [];
    this.build();
    if (this.tag) this.tag.position.y = this.tagY;
  }

  private build(): void {
    const L = this.look;
    const girl = L.body === 'girl';
    const skin = skinMat(L.skin);
    const fit = shopItem(L.outfit);
    const st = STYLES[String(fit?.r.style ?? 'casual')] ?? STYLES.casual;
    const kind = st.kind ?? 'cotton';
    const topCol = String(fit?.r.top ?? '#f6a6c8'), botCol = String(fit?.r.bottom ?? '#7fa6d9');
    const top = fabric(topCol, kind === 'linen' ? 'cotton' : kind);
    const isDress = ['knee', 'midi', 'maxi', 'mini'].includes(st.legs) && ['strap', 'none'].includes(st.sleeve) && topCol === botCol;
    const bottom = fabric(botCol, st.legs === 'pants' && !st.jacket && L.outfit !== 'fit_track' && L.outfit !== 'fit_pjs' ? 'denim' : kind === 'linen' ? 'cotton' : kind);
    const p = this.parts;
    const hs = { short: 0.95, medium: 1, tall: 1.05 }[L.height ?? 'medium'] ?? 1;
    this.body.scale.setScalar(hs);

    const hipY = girl ? 0.9 : 0.95;
    this.hipY = hipY;
    const profile = shapeTorso(girl ? GIRL_TORSO : BOY_TORSO, L.build ?? 'average', girl);
    const torsoTop = profile[profile.length - 1][1];
    const shoulderY = hipY + torsoTop - 0.07;
    const depth = girl ? 0.72 : 0.68;
    const tBase = hipY - 0.06;

    // ---- torso: pelvis (bottoms), body (top), shoulders (top or skin)
    const lathe = (pts: THREE.Vector2[], m: THREE.Material, open = false) => {
      const g = new THREE.LatheGeometry(pts, 28);
      const me = mesh(g, m, p, 0, tBase, 0);
      me.scale.z = depth;
      if (open) (me.material as THREE.Material).side = THREE.DoubleSide;
      return me;
    };
    const bare = st.sleeve === 'strap' || st.sleeve === 'none';
    const shoulderCut = torsoTop - (st.sleeve === 'strap' ? 0.07 : st.sleeve === 'none' ? 0.06 : 0.0);
    const seg = (y0: number, y1: number, m: THREE.Material) => {
      const pts = band(profile, y0, y1, 1, false);
      if (y0 <= 0) pts.unshift(new THREE.Vector2(0.0001, 0));
      if (y1 >= torsoTop) pts.push(new THREE.Vector2(0.0001, torsoTop));
      lathe(pts, m);
    };
    seg(0, 0.12, isDress ? top : bottom);
    seg(0.118, bare ? shoulderCut : torsoTop - 0.035, top);
    if (bare) seg(shoulderCut - 0.002, torsoTop, skin);
    else seg(torsoTop - 0.037, torsoTop, st.vneck || st.open ? skin : top);
    // Straps for strappy tops/dresses
    if (st.sleeve === 'strap') {
      for (const s of [-1, 1]) {
        const strap = mesh(new THREE.BoxGeometry(0.018, 0.07, 0.005), top, p, s * 0.075, tBase + shoulderCut + 0.03, 0.085 * (girl ? 1 : 1.05));
        strap.rotation.x = -0.35;
        const back = mesh(new THREE.BoxGeometry(0.018, 0.07, 0.005), top, p, s * 0.075, tBase + shoulderCut + 0.03, -0.085);
        back.rotation.x = 0.35;
      }
    }
    if (st.vneck || st.open) {
      const v = mesh(cached('vneck', () => new THREE.CircleGeometry(0.06, 3)), skin, p, 0, tBase + torsoTop - 0.085, profile[profile.length - 3][0] * depth + 0.004, false);
      v.rotation.z = Math.PI;
      v.scale.set(0.8, 1.2, 1);
    }
    if (st.open) {
      // Open shirt: tee underneath + shirt panels either side.
      const tee = fabric('#f4f1ea');
      const panel = (s: number) => {
        const m = mesh(new RoundedBoxGeometry(0.1, 0.42, 0.02, 2, 0.008), top, p, s * 0.085, tBase + 0.3, profile[6][0] * depth + 0.01);
        m.rotation.z = s * 0.04;
      };
      mesh(new RoundedBoxGeometry(0.1, 0.4, 0.015, 2, 0.006), tee, p, 0, tBase + 0.29, profile[6][0] * depth + 0.006);
      panel(-1); panel(1);
    }
    if (st.collar) {
      for (const s of [-1, 1]) {
        const c = mesh(new RoundedBoxGeometry(0.06, 0.035, 0.012, 2, 0.005), st.jacket ? fabric('#ffffff') : top, p, s * 0.045, tBase + torsoTop - 0.03, 0.055);
        c.rotation.set(-0.5, 0, s * 0.5);
      }
    }
    if (st.jacket) {
      // Lapels + buttons
      for (const s of [-1, 1]) {
        const lap = mesh(new THREE.BoxGeometry(0.05, 0.2, 0.008), fabric(topCol), p, s * 0.06, tBase + torsoTop - 0.15, profile[7][0] * depth + 0.012);
        lap.rotation.z = s * 0.28;
      }
      for (let i = 0; i < 2; i++) mesh(SPHERE, mat('#111', 0.4), p, 0, tBase + 0.2 + i * 0.08, profile[5][0] * depth + 0.012, false).scale.setScalar(0.008);
      if (L.outfit === 'fit_suit' || L.outfit === 'fit_vip') {
        mesh(new THREE.BoxGeometry(0.06, 0.14, 0.01), fabric('#ffffff'), p, 0, tBase + torsoTop - 0.17, profile[7][0] * depth + 0.006);
        mesh(new THREE.BoxGeometry(0.025, 0.12, 0.012), mat(L.outfit === 'fit_vip' ? '#111' : '#8a1c2b', 0.5), p, 0, tBase + torsoTop - 0.17, profile[7][0] * depth + 0.012);
      }
    }
    if (st.hood) {
      const hood = mesh(new THREE.TorusGeometry(0.1, 0.04, 10, 24), top, p, 0, tBase + torsoTop - 0.01, -0.06);
      hood.rotation.x = Math.PI / 2.3;
    }
    if (L.outfit === 'fit_track') mesh(new THREE.BoxGeometry(0.008, 0.38, 0.012), mat('#ffffff', 0.5), p, 0, tBase + 0.13, profile[5][0] * depth + 0.003);
    if (kind === 'sequin') {
      // Little sparkle flecks
      const fleck = mat('#ffffff', 0.1, 1, '#ffffff', 0.6);
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, y = 0.05 + Math.random() * 0.38;
        const r = (profile.find(([, yy]) => yy >= y)?.[0] ?? 0.13) * 1.01;
        mesh(SPHERE, fleck, p, Math.sin(a) * r, tBase + y, Math.cos(a) * r * depth, false).scale.setScalar(0.006);
      }
    }

    // ---- skirt
    if (['mini', 'knee', 'midi', 'maxi'].includes(st.legs)) {
      const len = { mini: 0.28, knee: 0.45, midi: 0.62, maxi: hipY - 0.06 }[st.legs as 'mini'] ?? 0.45;
      const r0 = profile[2][0] * 1.03;
      const flare = st.legs === 'maxi' ? 0.3 : st.legs === 'midi' ? 0.24 : 0.22;
      const pts = [new THREE.Vector2(r0, 0), new THREE.Vector2(r0 * 1.05, -len * 0.3), new THREE.Vector2((r0 + flare) / 2 * 1.1, -len * 0.7), new THREE.Vector2(flare, -len)];
      const sk = mesh(new THREE.LatheGeometry(pts, 32), isDress ? top : bottom, p, 0, hipY + 0.02, 0);
      sk.scale.z = 0.82;
      sk.material = (sk.material as THREE.Material).clone();
      (sk.material as THREE.Material).side = THREE.DoubleSide;
    }

    // ---- legs
    if (!['knee', 'midi', 'maxi', 'mini'].includes(st.legs)) mesh(SPHERE, isDress ? top : bottom, p, 0, hipY - 0.035, 0).scale.set(profile[2][0] * 0.98, 0.11, profile[2][0] * depth * 0.98);
    const thighR = (girl ? 0.077 : 0.086) * ((({ slim: 0.9, curvy: 1.08, strong: 1.12, athletic: 1.03 }) as Record<string, number>)[L.build ?? 'average'] ?? 1);
    const thighLen = hipY * 0.47, shinLen = hipY * 0.45;
    this.lLeg = joint(p, -(girl ? 0.08 : 0.09), hipY);
    this.rLeg = joint(p, girl ? 0.08 : 0.09, hipY);
    const legCloth = st.legs === 'pants' || st.legs === 'leggings';
    const shoeKind: Shoe = st.shoe;
    for (const leg of [this.lLeg, this.rLeg]) {
      mesh(limb(thighR, thighR * 0.68, thighLen), legCloth ? bottom : skin, leg, 0, 0, 0);
      if (st.legs === 'shorts') mesh(limb(thighR * 1.05, thighR * 0.92, thighLen * 0.55), bottom, leg, 0, 0, 0);
      const knee = joint(leg, 0, -thighLen);
      mesh(limb(thighR * 0.7, thighR * 0.47, shinLen), legCloth ? bottom : skin, knee, 0, 0, 0);
      this.foot(knee, shinLen, thighR * 0.45, shoeKind, skin, legCloth ? bottom : skin);
      if (leg === this.lLeg) this.lKnee = knee; else this.rKnee = knee;
    }

    // ---- arms
    const shX = (profile.find(([, y]) => y >= torsoTop - 0.09)?.[0] ?? 0.14) * 0.96 + 0.012;
    this.lArm = joint(p, -shX, shoulderY - 0.035);
    this.rArm = joint(p, shX, shoulderY - 0.035);
    const armR = (girl ? 0.04 : 0.05) * ((({ slim: 0.9, strong: 1.15, athletic: 1.08 }) as Record<string, number>)[L.build ?? 'average'] ?? 1);
    const upLen = girl ? 0.27 : 0.3, foreLen = girl ? 0.24 : 0.26;
    for (const arm of [this.lArm, this.rArm]) {
      const s = arm === this.lArm ? -1 : 1;
      mesh(SPHERE, st.sleeve === 'short' || st.sleeve === 'long' ? top : skin, arm, 0, -0.005, 0).scale.set(armR * 1.05, armR * 1.1, armR * 1.05);
      mesh(limb(armR, armR * 0.8, upLen), st.sleeve === 'long' ? top : skin, arm, 0, 0, 0);
      if (st.sleeve === 'short') mesh(limb(armR * 1.1, armR * 1.04, upLen * 0.5), top, arm, 0, -0.004, 0);
      const elbow = joint(arm, 0, -upLen);
      mesh(limb(armR * 0.78, armR * 0.6, foreLen), st.sleeve === 'long' ? top : skin, elbow, 0, 0, 0);
      const hand = new THREE.Group();
      hand.position.y = -foreLen - armR * 0.5;
      elbow.add(hand);
      mesh(SPHERE, skin, hand, 0, -0.03, 0).scale.set(0.024, 0.045, 0.035 * 0.6);
      mesh(SPHERE, skin, hand, s * -0.012, -0.02, 0.018).scale.set(0.01, 0.025, 0.01);
      if (st.sleeve === 'long' && st.jacket) mesh(limb(armR * 0.62, armR * 0.62, 0.02), fabric('#ffffff'), elbow, 0, -foreLen + 0.015, 0);
      if (arm === this.lArm) this.lElbow = elbow; else this.rElbow = elbow;
      if (arm === this.rArm && this.holding === 'mic') {
        const mic = new THREE.Group();
        mic.position.set(0, -0.05, 0.03);
        mic.rotation.x = -0.4;
        hand.add(mic);
        mesh(new THREE.CylinderGeometry(0.012, 0.009, 0.16, 10), mat('#1a1a1a', 0.4, 0.6), mic, 0, 0.02, 0);
        mesh(SPHERE, mat('#d8b45a', 0.25, 1), mic, 0, 0.11, 0).scale.setScalar(0.024);
      }
    }

    // ---- neck + head
    const neckR = girl ? 0.046 : 0.056;
    mesh(limb(neckR, neckR * 1.08, 0.1), skin, p, 0, shoulderY + 0.16, 0);
    const headCY = shoulderY + (girl ? 0.2 : 0.228);
    this.head = new THREE.Group();
    this.head.position.y = headCY;
    p.add(this.head);
    this.buildFace(this.head, L, skin, girl);
    this.buildHair(this.head, L, girl);
    this.buildAccessories(L, girl, shoulderY);
    this.tagY = (headCY + 0.42) * hs;
  }

  private foot(knee: THREE.Group, shinLen: number, r: number, kind: Shoe, skin: THREE.Material, sock: THREE.Material): void {
    const y = -shinLen - r * 0.6;
    const f = new THREE.Group();
    f.position.set(0, y, 0);
    knee.add(f);
    const col = { sneakers: '#f7f7f7', heels: this.look.body === 'girl' ? '#e9c6b0' : '#1a1a1a', sandals: '#c89b6d', dress: '#141414', loafers: '#5a3a25', slides: '#ffffff', barefoot: '#000' }[kind];
    if (kind === 'barefoot' || kind === 'sandals' || kind === 'slides') {
      mesh(new RoundedBoxGeometry(0.075, 0.045, 0.2, 2, 0.02), skin, f, 0, -0.02, 0.045);
      mesh(new RoundedBoxGeometry(0.085, 0.018, 0.22, 2, 0.008), mat(col, 0.6), f, 0, -0.05, 0.045);
      mesh(new THREE.BoxGeometry(0.086, 0.012, 0.03), mat(kind === 'slides' ? '#ff6f91' : col, 0.6), f, 0, -0.012, 0.08);
      void sock;
    } else if (kind === 'heels') {
      const shoe = mesh(new RoundedBoxGeometry(0.07, 0.05, 0.19, 2, 0.02), mat(col, 0.35, 0.1), f, 0, -0.02, 0.05);
      shoe.rotation.x = 0.28;
      mesh(new THREE.BoxGeometry(0.02, 0.06, 0.02), mat(col, 0.35), f, 0, -0.05, -0.035);
    } else {
      mesh(new RoundedBoxGeometry(0.09, 0.07, 0.24, 2, 0.03), mat(col, kind === 'dress' ? 0.2 : 0.5, kind === 'dress' ? 0.2 : 0), f, 0, -0.025, 0.05);
      if (kind === 'sneakers') mesh(new RoundedBoxGeometry(0.094, 0.02, 0.245, 2, 0.008), mat('#dcdcdc', 0.6), f, 0, -0.06, 0.05);
    }
  }

  private buildFace(h: THREE.Group, L: Look, skin: THREE.Material, girl: boolean): void {
    const rx = girl ? 0.096 : 0.102, ry = girl ? 0.118 : 0.124, rz = girl ? 0.106 : 0.11;
    mesh(headGeo(girl), skin, h, 0, 0, 0).scale.set(rx, ry, rz);
    // Ears
    for (const s of [-1, 1]) mesh(SPHERE, skin, h, s * rx * 0.98, -0.01, -0.005).scale.set(0.016, 0.03, 0.022);
    // Nose
    const nose = mesh(SPHERE, skin, h, 0, -0.022, rz * 0.98);
    nose.scale.set(girl ? 0.014 : 0.017, 0.032, 0.02);
    nose.rotation.x = -0.25;
    mesh(SPHERE, skin, h, 0, -0.045, rz * 1.02).scale.set(girl ? 0.015 : 0.019, 0.013, 0.014);
    // Eyes
    const ey = 0.012, ex = girl ? 0.036 : 0.038, ez = rz * 0.935;
    const white = mat('#f8f6f2', 0.25);
    const iris = mat(L.eyes ?? '#4a2e1a', 0.2);
    const pupil = mat('#0b0806', 0.1);
    const shine = mat('#ffffff', 0.1, 0, '#ffffff', 1.2);
    const lid = mat(girl ? '#2a1a14' : new THREE.Color(L.skin).multiplyScalar(0.6).getStyle(), 0.6);
    for (const s of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(s * ex, ey, ez);
      h.add(eye);
      mesh(SPHERE, white, eye, 0, 0, 0, false).scale.set(0.019, girl ? 0.0125 : 0.011, 0.01);
      mesh(cached('iris', () => new THREE.CircleGeometry(0.0085, 20)), iris, eye, 0, 0, 0.0098, false);
      mesh(cached('pupil', () => new THREE.CircleGeometry(0.0042, 16)), pupil, eye, 0, 0, 0.0101, false);
      mesh(SPHERE, shine, eye, 0.003, 0.003, 0.0105, false).scale.setScalar(0.0022);
      const lidLine = mesh(cached(girl ? 'lidg' : 'lidb', () => new THREE.TorusGeometry(0.019, girl ? 0.0028 : 0.0018, 6, 18, Math.PI)), lid, eye, 0, girl ? 0.002 : 0.001, 0.004, false);
      lidLine.scale.y = 0.62;
      if (girl) {
        const flick = mesh(cached('flick', () => new THREE.BoxGeometry(0.012, 0.0025, 0.003)), lid, eye, s * 0.022, 0.006, 0.006, false);
        flick.rotation.z = s * 0.5;
      }
      this.eyes.push(eye);
      // Eyebrow
      const browCol = new THREE.Color(L.hairColor).multiplyScalar(0.8).getStyle();
      const brow = mesh(cached(girl ? 'browg' : 'browb', () => new RoundedBoxGeometry(0.036, girl ? 0.0065 : 0.0095, 0.006, 2, 0.003)), mat(browCol, 0.8), h, s * (ex + 0.002), ey + (girl ? 0.034 : 0.03), rz * 0.9, false);
      brow.rotation.z = s * (girl ? -0.18 : -0.08);
      brow.rotation.y = s * 0.25;
    }
    // Lips
    const lipM = mat(L.lips ?? '#c9867a', girl ? 0.35 : 0.6);
    mesh(SPHERE, lipM, h, 0, -0.064, rz * 0.96, false).scale.set(girl ? 0.022 : 0.021, girl ? 0.0065 : 0.0045, 0.009);
    mesh(SPHERE, lipM, h, 0, -0.073, rz * 0.94, false).scale.set(girl ? 0.02 : 0.019, girl ? 0.0085 : 0.006, 0.009);
    if (girl) for (const s of [-1, 1]) {
      const b = mesh(SPHERE, mat(new THREE.Color(L.skin).lerp(new THREE.Color('#ff8a9a'), 0.35).getStyle(), 0.9), h, s * 0.056, -0.028, rz * 0.8, false);
      b.scale.set(0.022, 0.012, 0.008);
      (b.material as THREE.MeshStandardMaterial).transparent = true;
      (b.material as THREE.MeshStandardMaterial).opacity = 0.22;
    }
    // Facial hair
    if (!girl && L.beard && L.beard !== 'none') {
      const bm = new THREE.MeshStandardMaterial({ color: new THREE.Color(L.hairColor).multiplyScalar(0.85), roughness: 0.9, transparent: true, opacity: L.beard === 'stubble' ? 0.3 : 0.88, depthWrite: false });
      const beard = mesh(beardGeo(girl), bm, h, 0, 0, 0, false);
      beard.scale.set(rx, ry, rz);
      beard.renderOrder = 2;
      const mous = mesh(cached('mous', () => new RoundedBoxGeometry(0.044, 0.01, 0.012, 2, 0.005)), bm, h, 0, -0.054, rz * 0.94, false);
      mous.renderOrder = 2;
    }
  }

  private buildHair(h: THREE.Group, L: Look, girl: boolean): void {
    const rx = girl ? 0.096 : 0.102, ry = girl ? 0.118 : 0.124, rz = girl ? 0.106 : 0.11;
    const style = L.hair;
    const glossy = style === 'slick' || style === 'sleekpony' || style === 'long';
    const hm = hairMat(L.hairColor, glossy);
    const g = new THREE.Group();
    const tight = ['sleekpony', 'topbun', 'manbun', 'slick', 'buzz', 'braids'].includes(style);
    const k = tight ? 1.045 : 1.08;
    g.scale.set(rx * k, ry * (tight ? 1.04 : 1.07), rz * k);
    h.add(g);
    const parts: THREE.BufferGeometry[] = [];
    const add = (geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rxr = 0, ryr = 0, rzr = 0) => {
      const c = geo.clone();
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rxr, ryr, rzr)), new THREE.Vector3(sx, sy, sz));
      c.applyMatrix4(m);
      parts.push(c.index ? c.toNonIndexed() : c);
    };
    // Scalp: a cap over the top (hairline above the forehead — no fringe) and sides/back.
    const sideLow = { long: 0.66, waves: 0.66, lob: 0.64, curls: 0.62, surfer: 0.62, braids: 0.6, sleekpony: 0.56, topbun: 0.56, manbun: 0.56, slick: 0.55, crop: 0.54, quiff: 0.53, curlytop: 0.53, buzz: 0.52 }[style] ?? 0.58;
    // Top cap tilted back so the hairline sits high on the forehead.
    add(new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI * 0.36), 0, 0, 0, 1, 1, 1, -0.42);
    add(new THREE.SphereGeometry(1, 40, 16, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, Math.PI * 0.2, Math.PI * (sideLow - 0.2)));
    const panel = (len: number, rTop: number, rBot: number, wavy = 0, wedge = 1.15) => {
      const geo = new THREE.CylinderGeometry(rTop, rBot, len, 40, 10, true, wedge, Math.PI * 2 - wedge * 2);
      if (wavy) {
        const pos = geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          const a = Math.atan2(x, z);
          const f = 1 + wavy * Math.sin(y * 4.5 + a * 3) * Math.min(1, (len / 2 - y) / len * 2);
          pos.setXYZ(i, x * f, y, z * f);
        }
        geo.computeVertexNormals();
      }
      return geo;
    };
    const chain = (pts: [number, number, number, number][]) => { for (const [x, y, z, r] of pts) add(SPHERE, x, y, z, r, r * 1.15, r); };

    switch (style) {
      case 'long':
      case 'waves': {
        const len = 3.6;
        add(panel(len, 0.98, style === 'waves' ? 1.05 : 0.86, style === 'waves' ? 0.07 : 0, 1.45), 0, -len / 2 + 0.1, -0.06);
        add(SPHERE, 0, -len + 0.25, -0.15, style === 'waves' ? 0.9 : 0.78, 0.2, 0.55);
        for (const s of [-1, 1]) {
          const strand = new RoundedBoxGeometry(0.32, 2.5, 0.34, 3, 0.15);
          add(strand, s * 0.84, -1.2, 0.18, 1, 1, 1, 0.08, 0, s * -0.06);
        }
        break;
      }
      case 'lob': {
        add(panel(1.7, 1.02, 1.1, 0.02), 0, -0.6, -0.02);
        add(SPHERE, 0, -1.45, -0.05, 1.05, 0.18, 0.95);
        break;
      }
      case 'surfer': {
        add(panel(1.4, 1.0, 1.06, 0.06, 1.35), 0, -0.45, -0.06);
        add(SPHERE, 0, 0.62, -0.25, 0.95, 0.5, 0.85);
        break;
      }
      case 'sleekpony': {
        add(new THREE.TorusGeometry(0.2, 0.07, 8, 16), 0, 0.62, -0.86, 1, 1, 1, 0.9);
        chain([[0, 0.66, -1.05, 0.26], [0, 0.45, -1.22, 0.27], [0, 0.15, -1.3, 0.26], [0, -0.2, -1.32, 0.24], [0, -0.55, -1.3, 0.21], [0, -0.9, -1.25, 0.17], [0, -1.2, -1.18, 0.12]]);
        break;
      }
      case 'topbun': {
        add(SPHERE, 0, 1.12, -0.18, 0.48, 0.38, 0.48);
        add(new THREE.TorusGeometry(0.32, 0.07, 8, 20), 0, 0.92, -0.14, 1, 1, 1, Math.PI / 2 - 0.2);
        break;
      }
      case 'manbun': {
        add(SPHERE, 0, 0.75, -0.95, 0.36, 0.32, 0.34);
        break;
      }
      case 'braids': {
        for (const s of [-1, 1]) {
          const pts: [number, number, number, number][] = [];
          for (let i = 0; i < 12; i++) pts.push([s * (0.82 + (i % 2) * 0.06) + s * Math.min(i, 3) * 0.02, -0.35 - i * 0.27, 0.05 + Math.min(i, 4) * 0.05, 0.2 - i * 0.006]);
          chain(pts);
          add(SPHERE, s * 0.9, -3.65, 0.25, 0.1, 0.12, 0.1);
        }
        break;
      }
      case 'curls': {
        for (let i = 0; i < 260; i++) {
          const th = Math.acos(1 - Math.random() * 1.7);
          const ph = Math.random() * Math.PI * 2;
          const front = Math.cos(ph - Math.PI / 2) * Math.sin(th);
          if (front > 0.5 && th > 0.75) continue;
          const r = 1.06 + Math.random() * 0.14;
          add(SPHERE, -Math.cos(ph) * Math.sin(th) * r, Math.cos(th) * r, Math.sin(ph) * Math.sin(th) * r, 0.16, 0.16, 0.16);
        }
        for (let i = 0; i < 120; i++) {
          const a = Math.PI + (Math.random() - 0.5) * 3.4;
          const rr = 0.95 + Math.random() * 0.25;
          add(SPHERE, Math.sin(a) * rr * 1.08, -0.2 - Math.random() * 1.3, Math.cos(a) * rr, 0.17, 0.17, 0.17);
        }
        break;
      }
      case 'crop': {
        add(SPHERE, 0, 0.56, 0.02, 0.99, 0.52, 0.94);
        break;
      }
      case 'quiff': {
        add(SPHERE, 0, 0.5, -0.05, 0.98, 0.5, 0.92);
        add(SPHERE, 0, 0.92, 0.12, 0.6, 0.27, 0.55, -0.3);
        break;
      }
      case 'slick': {
        add(SPHERE, 0, 0.45, -0.25, 0.98, 0.55, 0.95);
        break;
      }
      case 'curlytop': {
        for (let i = 0; i < 110; i++) {
          const th = Math.random() * 0.95;
          const ph = Math.random() * Math.PI * 2;
          const r = 1.02 + Math.random() * 0.12;
          add(SPHERE, -Math.cos(ph) * Math.sin(th) * r, Math.cos(th) * r, Math.sin(ph) * Math.sin(th) * r * 0.95, 0.14, 0.14, 0.14);
        }
        break;
      }
      default: break; // buzz: scalp only
    }
    const merged = mergeGeometries(parts.map((pg) => { for (const n of Object.keys(pg.attributes)) if (!['position', 'normal', 'uv'].includes(n)) pg.deleteAttribute(n); if (!pg.attributes.uv) pg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pg.attributes.position.count * 2), 2)); return pg; }), false);
    parts.forEach((pg) => pg.dispose());
    if (merged) {
      const me = mesh(merged, style === 'buzz' ? hairMat(new THREE.Color(L.hairColor).lerp(new THREE.Color(L.skin), 0.35).getStyle()) : hm, g, 0, 0, 0);
      me.castShadow = true;
    }
  }

  private buildAccessories(L: Look, girl: boolean, shoulderY: number): void {
    const h = this.head;
    const rz = girl ? 0.106 : 0.11, ry = girl ? 0.118 : 0.124;
    const gl = L.glasses ? shopItem(L.glasses) : undefined;
    if (gl) {
      const fm = mat(String(gl.r.color), 0.3, 0.4);
      const lens = new THREE.MeshStandardMaterial({ color: gl.r.style === 'heart' ? '#ff4f9a' : '#1a1a22', roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.85 });
      const ex = girl ? 0.036 : 0.038;
      for (const s of [-1, 1]) {
        if (gl.r.style === 'heart') {
          const sh = new THREE.Shape();
          sh.moveTo(0, -0.018); sh.bezierCurveTo(-0.03, 0, -0.024, 0.024, 0, 0.012); sh.bezierCurveTo(0.024, 0.024, 0.03, 0, 0, -0.018);
          mesh(new THREE.ShapeGeometry(sh), lens, h, s * ex, 0.012, rz + 0.012, false);
        } else {
          const ring = mesh(new THREE.TorusGeometry(0.022, 0.0035, 8, 24), fm, h, s * ex, 0.012, rz + 0.01, false);
          ring.scale.set(gl.r.style === 'cateye' ? 1.25 : 1.12, 0.82, 1);
          mesh(new THREE.CircleGeometry(0.022, 24), lens, h, s * ex, 0.012, rz + 0.009, false).scale.set(1.12, 0.82, 1);
        }
        const arm = mesh(new THREE.BoxGeometry(0.004, 0.004, 0.1), fm, h, s * (girl ? 0.095 : 0.1), 0.014, rz - 0.045, false);
        arm.rotation.y = s * 0.08;
      }
      mesh(new THREE.BoxGeometry(0.026, 0.004, 0.004), fm, h, 0, 0.016, rz + 0.012, false);
    }
    const hat = L.hat ? shopItem(L.hat) : undefined;
    if (hat) {
      const hm = mat(String(hat.r.color), 0.8);
      if (hat.r.style === 'sun') {
        mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.01, 40), hm, h, 0, ry * 0.75, -0.01);
        mesh(new THREE.SphereGeometry(0.125, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hm, h, 0, ry * 0.7, -0.01);
        mesh(new THREE.CylinderGeometry(0.126, 0.126, 0.025, 24), mat('#ff6f91', 0.7), h, 0, ry * 0.75, -0.01);
      } else {
        mesh(new THREE.SphereGeometry(0.122, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hm, h, 0, ry * 0.42, -0.01);
        mesh(new RoundedBoxGeometry(0.17, 0.012, 0.11, 2, 0.005), hm, h, 0, ry * 0.45, 0.13).rotation.x = 0.12;
      }
    }
    const jw = L.jewel ? shopItem(L.jewel) : undefined;
    if (jw) {
      const jm = mat(String(jw.r.color), 0.2, jw.r.style === 'pearl' ? 0.1 : 1);
      const ny = shoulderY + 0.085;
      if (jw.r.style === 'pearl') {
        for (let i = 0; i < 22; i++) {
          const a = (i / 22) * Math.PI * 2;
          mesh(SPHERE, jm, this.parts, Math.cos(a) * 0.075, ny - Math.max(0, Math.sin(a)) * 0.035, Math.sin(a) * 0.06 + 0.01, false).scale.setScalar(0.009);
        }
      } else if (jw.r.style === 'chain') {
        const m = mesh(new THREE.TorusGeometry(0.075, 0.006, 8, 30), jm, this.parts, 0, ny - 0.01, 0.015, false);
        m.rotation.x = Math.PI / 2.3;
      } else if (jw.r.style === 'tiara') {
        const m = mesh(new THREE.TorusGeometry(0.09, 0.006, 8, 30, Math.PI), jm, h, 0, ry * 0.62, 0.0, false);
        m.rotation.x = -0.5;
        for (let i = 0; i < 5; i++) mesh(SPHERE, mat('#bfefff', 0.05, 0.3, '#bfefff', 0.6), h, (i - 2) * 0.032, ry * 0.75 + (i === 2 ? 0.02 : 0), 0.045, false).scale.setScalar(0.012);
      } else {
        mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.06, 8, 1, true), GOLD(), h, 0, ry * 0.98, -0.01);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          mesh(new THREE.ConeGeometry(0.016, 0.045, 4), GOLD(), h, Math.cos(a) * 0.082, ry * 0.98 + 0.05, Math.sin(a) * 0.082 - 0.01, false);
          if (i % 2 === 0) mesh(SPHERE, mat('#ff2d55', 0.1, 0.3, '#ff2d55', 0.4), h, Math.cos(a) * 0.086, ry * 0.98 + 0.01, Math.sin(a) * 0.086 - 0.01, false).scale.setScalar(0.011);
        }
      }
    }
    const bag = L.bag ? shopItem(L.bag) : undefined;
    if (bag) {
      const s = Number(bag.r.size ?? 1);
      const bm = mat(String(bag.r.color), bag.id === 'bag_diamond' ? 0.05 : 0.4, bag.id === 'bag_diamond' ? 0.6 : 0.1);
      mesh(new RoundedBoxGeometry(0.18 * s, 0.13 * s, 0.07 * s, 2, 0.02), bm, this.lElbow, -0.04, -0.2, 0.0);
      mesh(new THREE.TorusGeometry(0.05 * s, 0.006, 6, 16, Math.PI), GOLD(), this.lElbow, -0.04, -0.13, 0, false);
    }
    const pf = L.perfume ? shopItem(L.perfume) : undefined;
    this.sparkleColor = pf ? new THREE.Color(String(pf.r.color)).getHex() : null;
  }

  /** Called every frame. `speed` 0..1 is how fast they are walking. */
  update(dt: number, t: number, speed: number, mode: Mode): void {
    const now = performance.now();
    if (this.bubble && now > this.bubbleUntil) { this.root.remove(this.bubble); this.bubble = undefined; }
    if (this.emote && (now > this.emoteUntil || speed > 0.2)) this.emote = null;
    this.phase += dt * (4 + speed * 5) * (speed > 0.05 ? 1 : 0.3);
    const s = Math.sin(this.phase);
    const hip = this.hipY * this.body.scale.y;
    const L = this.lArm, R = this.rArm;
    L.rotation.set(0, 0, 0.1); R.rotation.set(0, 0, -0.1);
    this.lElbow.rotation.set(-0.15, 0, 0); this.rElbow.rotation.set(-0.15, 0, 0);
    this.lLeg.rotation.set(0, 0, 0); this.rLeg.rotation.set(0, 0, 0);
    this.lKnee.rotation.set(0, 0, 0); this.rKnee.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0); this.body.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    const sit = () => {
      this.lLeg.rotation.x = this.rLeg.rotation.x = -1.5;
      this.lKnee.rotation.x = this.rKnee.rotation.x = 1.45;
      this.body.position.y = 0.47 - hip;
    };
    if (mode === 'drive') {
      sit();
      this.lLeg.rotation.x = this.rLeg.rotation.x = -1.35;
      this.lKnee.rotation.x = this.rKnee.rotation.x = 1.1;
      L.rotation.x = R.rotation.x = -0.9;
      this.lElbow.rotation.x = this.rElbow.rotation.x = -0.5;
      this.body.position.y = 0.61 - hip;
    } else if (mode === 'swim') {
      this.body.position.y = -0.95 + Math.sin(t * 2) * 0.04;
      if (speed > 0.05) {
        L.rotation.x = Math.sin(this.phase) * 2.6;
        R.rotation.x = Math.sin(this.phase + Math.PI) * 2.6;
      } else {
        L.rotation.z = 0.9 + Math.sin(t * 3) * 0.3;
        R.rotation.z = -0.9 - Math.sin(t * 3) * 0.3;
      }
      this.lLeg.rotation.x = Math.sin(this.phase * 2) * 0.4;
      this.rLeg.rotation.x = -Math.sin(this.phase * 2) * 0.4;
    } else if (mode === 'soak' || this.emote === 'sit') {
      sit();
      if (mode === 'soak') this.body.position.y = -0.05 - (hip - 0.9);
      L.rotation.z = 0.45; R.rotation.z = -0.45;
      this.lElbow.rotation.x = this.rElbow.rotation.x = -0.6;
    } else if (this.emote === 'wave') {
      R.rotation.z = -2.5;
      this.rElbow.rotation.z = Math.sin(t * 10) * 0.4;
      this.rElbow.rotation.x = 0;
    } else if (this.emote === 'dance') {
      this.body.position.y = Math.abs(Math.sin(t * 6)) * 0.06;
      this.body.rotation.y = Math.sin(t * 3) * 0.45;
      L.rotation.z = 2.3 + Math.sin(t * 6) * 0.4;
      R.rotation.z = -2.3 + Math.sin(t * 6 + 1) * 0.4;
      this.lElbow.rotation.x = this.rElbow.rotation.x = -0.6;
      this.lLeg.rotation.x = Math.sin(t * 6) * 0.3;
      this.rLeg.rotation.x = -Math.sin(t * 6) * 0.3;
      this.lKnee.rotation.x = Math.max(0, Math.sin(t * 6)) * 0.5;
      this.head.rotation.z = Math.sin(t * 6) * 0.12;
    } else if (this.emote === 'heart') {
      L.rotation.z = 2.6; R.rotation.z = -2.6;
      L.rotation.x = R.rotation.x = -0.3;
      this.lElbow.rotation.x = this.rElbow.rotation.x = -1.1;
    } else if (this.emote === 'pose') {
      L.rotation.z = 0.55; this.lElbow.rotation.x = -1.6; L.rotation.x = 0.4;
      R.rotation.z = -2.7;
      this.body.rotation.z = 0.04;
      this.head.rotation.z = -0.12;
      this.lLeg.rotation.z = 0.12;
    } else if (speed > 0.05) {
      this.lLeg.rotation.x = s * 0.6 * speed;
      this.rLeg.rotation.x = -s * 0.6 * speed;
      this.lKnee.rotation.x = Math.max(0, -Math.cos(this.phase)) * 0.75 * speed;
      this.rKnee.rotation.x = Math.max(0, Math.cos(this.phase)) * 0.75 * speed;
      L.rotation.x = -s * 0.5 * speed;
      R.rotation.x = s * 0.5 * speed;
      this.lElbow.rotation.x = -0.25 - Math.max(0, s) * 0.4 * speed;
      this.rElbow.rotation.x = -0.25 - Math.max(0, -s) * 0.4 * speed;
      this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.035 * speed;
      this.body.rotation.y = s * 0.05;
    } else {
      this.body.position.y = Math.sin(t * 1.8) * 0.004;
      this.head.rotation.y = Math.sin(t * 0.5) * 0.18;
      this.head.rotation.x = Math.sin(t * 0.37) * 0.04;
      if (this.holding === 'mic') { R.rotation.x = -0.9; this.rElbow.rotation.x = -1.2; }
    }
    if (mode === 'soak') this.body.position.y = -0.05 - (hip - 0.9);
    // Blink
    if (t > this.blinkAt) { this.blinkAt = t + 2.5 + Math.random() * 3; }
    const closed = t > this.blinkAt - 0.12;
    for (const e of this.eyes) e.scale.y = closed ? 0.15 : 1;
    this.updateSparkles(dt, speed);
  }

  private updateSparkles(dt: number, speed: number): void {
    if (this.sparkleColor !== null && Math.random() < dt * (3 + speed * 12)) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: this.sparkleColor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.scale.setScalar(0.18);
      const wp = new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 1.4, (Math.random() - 0.5) * 0.6);
      this.root.localToWorld(wp);
      sp.position.copy(wp);
      sp.userData.life = 1;
      this.root.parent?.add(sp);
      this.sparkles.push(sp);
    }
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const sp = this.sparkles[i];
      sp.userData.life -= dt * 0.9;
      sp.position.y += dt * 0.3;
      sp.material.opacity = Math.max(0, sp.userData.life);
      if (sp.userData.life <= 0) { sp.parent?.remove(sp); sp.material.dispose(); this.sparkles.splice(i, 1); }
    }
  }

  dispose(): void {
    for (const sp of this.sparkles) { sp.parent?.remove(sp); sp.material.dispose(); }
    this.sparkles = [];
    this.root.parent?.remove(this.root);
  }
}
