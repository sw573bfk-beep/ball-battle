import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Look } from '../../shared/save';
import { shopItem } from '../../shared/shop';
import { bubbleTexture, emojiTexture, glowTexture, nameTexture } from './tex';
import { mat, GOLD } from './props';

export type Mode = 'walk' | 'swim' | 'soak' | 'drive';
export type Emote = 'wave' | 'dance' | 'heart' | 'sit' | 'pose';

const capsule = new Map<string, THREE.CapsuleGeometry>();
function cap(r: number, len: number): THREE.CapsuleGeometry {
  const k = `${r},${len}`;
  let g = capsule.get(k);
  if (!g) { g = new THREE.CapsuleGeometry(r, len, 6, 14); capsule.set(k, g); }
  return g;
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = true;
  me.receiveShadow = true;
  parent.add(me);
  return me;
}

const sphere = new THREE.SphereGeometry(1, 28, 20);

function fabric(color: string): THREE.MeshStandardMaterial {
  return mat(color, 0.82);
}

/** Puts an anchor at a shoulder/hip so the limb swings from the joint. */
function joint(parent: THREE.Object3D, x: number, y: number, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export class Avatar {
  root = new THREE.Group();
  private body = new THREE.Group();
  private parts = new THREE.Group();
  private lArm!: THREE.Group;
  private rArm!: THREE.Group;
  private lLeg!: THREE.Group;
  private rLeg!: THREE.Group;
  private head!: THREE.Group;
  private tag?: THREE.Sprite;
  private bubble?: THREE.Sprite;
  private bubbleUntil = 0;
  private emoteIcon?: THREE.Sprite;
  private sparkles: THREE.Sprite[] = [];
  private sparkleColor: number | null = null;
  private phase = 0;
  look: Look;
  emote: Emote | null = null;
  emoteUntil = 0;

  constructor(look: Look, name?: string, vip = false, sub?: string) {
    this.look = look;
    this.root.add(this.body);
    this.body.add(this.parts);
    this.build();
    if (name) this.setName(name, vip, sub);
  }

  setName(name: string, vip: boolean, sub?: string): void {
    if (this.tag) { this.root.remove(this.tag); this.tag.material.map?.dispose(); this.tag.material.dispose(); }
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTexture(name, vip, sub), transparent: true, depthWrite: false, depthTest: false }));
    this.tag.scale.set(1.6, 0.5, 1);
    this.tag.position.y = 2.15;
    this.tag.renderOrder = 10;
    this.root.add(this.tag);
  }

  say(text: string): void {
    if (this.bubble) { this.root.remove(this.bubble); this.bubble.material.map?.dispose(); this.bubble.material.dispose(); }
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture(text), transparent: true, depthWrite: false, depthTest: false }));
    this.bubble.scale.set(2.4, 0.9, 1);
    this.bubble.position.y = 2.75;
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
    this.emoteIcon.position.set(0.5, 2.0, 0);
    this.root.add(this.emoteIcon);
    setTimeout(() => { if (this.emoteIcon) { this.root.remove(this.emoteIcon); this.emoteIcon = undefined; } }, 2500);
  }

  setLook(look: Look): void {
    this.look = look;
    this.parts.clear();
    this.build();
  }

  private build(): void {
    const L = this.look;
    const girl = L.body === 'girl';
    const skin = mat(L.skin, 0.62);
    const fit = shopItem(L.outfit);
    const style = String(fit?.r.style ?? 'casual');
    const top = fabric(String(fit?.r.top ?? '#f6a6c8'));
    const bottom = fabric(String(fit?.r.bottom ?? '#7fa6d9'));
    const p = this.parts;

    // legs
    const hipY = 0.86;
    this.lLeg = joint(p, -0.09, hipY);
    this.rLeg = joint(p, 0.09, hipY);
    const shortsStyle = style === 'beach' || style === 'gym';
    const legMat = style === 'dress' || style === 'gown' || shortsStyle ? skin : bottom;
    const shoe = mat(style === 'gown' || style === 'suit' ? '#111111' : style === 'beach' ? L.skin : '#f7f7f7', 0.45);
    for (const leg of [this.lLeg, this.rLeg]) {
      mesh(cap(0.075, 0.62), legMat, leg, 0, -0.4, 0);
      if (shortsStyle) mesh(cap(0.088, 0.18), bottom, leg, 0, -0.14, 0);
      const s = mesh(new RoundedBoxGeometry(0.13, 0.08, 0.24, 2, 0.035), shoe, leg, 0, -0.82, 0.04);
      s.castShadow = true;
    }

    // torso
    const torso = mesh(cap(girl ? 0.155 : 0.17, 0.3), top, p, 0, 1.13, 0);
    torso.scale.set(girl ? 1.12 : 1.22, 1, 0.78);
    mesh(cap(girl ? 0.15 : 0.16, 0.06), bottom, p, 0, hipY + 0.03, 0).scale.set(girl ? 1.18 : 1.15, 1, 0.8);
    if (style === 'dress' || style === 'gown') {
      const len = style === 'gown' ? 0.86 : 0.48;
      const skirt = mesh(new THREE.CylinderGeometry(0.17, style === 'gown' ? 0.42 : 0.32, len, 28, 1, true), top, p, 0, hipY + 0.06 - len / 2, 0);
      skirt.material = top.clone();
      (skirt.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      if (style === 'gown') { (skirt.material as THREE.MeshStandardMaterial).roughness = 0.35; (skirt.material as THREE.MeshStandardMaterial).metalness = 0.25; }
    }
    if (style === 'suit') {
      mesh(new THREE.BoxGeometry(0.08, 0.26, 0.02), mat('#ffffff', 0.6), p, 0, 1.24, 0.125);
      mesh(new THREE.BoxGeometry(0.035, 0.2, 0.02), mat(L.outfit === 'fit_vip' ? '#111' : '#b3203a', 0.5), p, 0, 1.2, 0.135);
    }
    if (style === 'hoodie') {
      const hood = mesh(new THREE.TorusGeometry(0.13, 0.06, 10, 20), top, p, 0, 1.38, -0.05);
      hood.rotation.x = Math.PI / 2.4;
    }
    if (style === 'track') {
      mesh(new THREE.BoxGeometry(0.02, 0.4, 0.02), mat('#ffffff', 0.5), p, 0, 1.14, 0.135);
    }

    // arms
    const shY = 1.36;
    this.lArm = joint(p, -(girl ? 0.21 : 0.25), shY);
    this.rArm = joint(p, girl ? 0.21 : 0.25, shY);
    const longSleeve = ['track', 'hoodie', 'suit', 'pjs'].includes(style);
    const noSleeve = ['beach', 'gown', 'gym', 'dress'].includes(style);
    for (const arm of [this.lArm, this.rArm]) {
      mesh(cap(0.055, 0.46), longSleeve ? top : skin, arm, 0, -0.3, 0);
      if (!longSleeve && !noSleeve) mesh(cap(0.068, 0.14), top, arm, 0, -0.08, 0);
      mesh(sphere, skin, arm, 0, -0.6, 0).scale.setScalar(0.06);
    }

    // neck + head
    mesh(cap(0.055, 0.08), skin, p, 0, 1.47, 0);
    this.head = new THREE.Group();
    this.head.position.y = 1.66;
    p.add(this.head);
    const h = this.head;
    const headM = mesh(sphere, skin, h, 0, 0, 0);
    headM.scale.set(0.175, 0.19, 0.175);
    const eye = mat('#1b1418', 0.2);
    const shine = mat('#ffffff', 0.2, 0, '#ffffff', 0.6);
    for (const x of [-0.065, 0.065]) {
      mesh(sphere, eye, h, x, 0.005, 0.158).scale.set(0.028, girl ? 0.038 : 0.032, 0.015);
      const sh = mesh(sphere, shine, h, x + 0.01, 0.018, 0.17);
      sh.scale.setScalar(0.009);
      sh.castShadow = false;
      if (girl) {
        const lash = mesh(new THREE.BoxGeometry(0.05, 0.008, 0.01), eye, h, x + (x < 0 ? -0.006 : 0.006), 0.045, 0.158);
        lash.rotation.z = x < 0 ? 0.25 : -0.25;
      }
      const brow = mesh(new THREE.BoxGeometry(0.05, 0.012, 0.01), mat(L.hairColor, 0.8), h, x, 0.075, 0.162);
      brow.rotation.z = x < 0 ? 0.12 : -0.12;
      brow.castShadow = false;
    }
    const smile = mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 14, Math.PI), mat('#b4475a', 0.5), h, 0, -0.065, 0.158);
    smile.rotation.z = Math.PI;
    smile.castShadow = false;
    if (girl) for (const x of [-0.1, 0.1]) {
      const b = mesh(sphere, mat('#ff8fa8', 0.9, 0, '#ff8fa8', 0.05), h, x, -0.035, 0.14);
      b.scale.set(0.03, 0.018, 0.01);
      b.castShadow = false;
      (b.material as THREE.MeshStandardMaterial).transparent = true;
      (b.material as THREE.MeshStandardMaterial).opacity = 0.55;
    }
    mesh(sphere, skin, h, 0, -0.015, 0.175).scale.set(0.018, 0.022, 0.015);
    for (const x of [-0.175, 0.175]) mesh(sphere, skin, h, x, -0.01, 0).scale.set(0.025, 0.04, 0.03);

    this.buildHair(h, L);
    this.buildAccessories(L);
  }

  private buildHair(h: THREE.Group, L: Look): void {
    const hm = mat(L.hairColor, 0.55, 0.05);
    const capGeo = new THREE.SphereGeometry(0.192, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.56);
    const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0) => {
      const m = mesh(geo, hm, h, x, y, z);
      m.scale.set(sx, sy, sz);
      m.rotation.x = rx;
      return m;
    };
    const style = L.hair;
    if (style === 'buzz') {
      add(capGeo, 0, 0.01, -0.01, 0.96, 0.92, 0.96, -0.25);
      return;
    }
    add(capGeo, 0, 0.012, -0.012, 1, 1, 1, -0.32);
    // fringe/side volume
    add(sphere, 0, 0.12, 0.06, 0.16, 0.07, 0.12);
    if (style === 'short') {
      add(sphere, 0, 0.0, -0.06, 0.185, 0.17, 0.16);
    } else if (style === 'long') {
      add(new RoundedBoxGeometry(0.36, 0.5, 0.12, 3, 0.05), 0, -0.2, -0.11);
      for (const x of [-0.16, 0.16]) add(new RoundedBoxGeometry(0.07, 0.42, 0.12, 2, 0.03), x, -0.16, 0.03);
    } else if (style === 'bun') {
      add(sphere, 0, 0.0, -0.06, 0.185, 0.17, 0.16);
      add(sphere, 0, 0.2, -0.1, 0.1, 0.1, 0.1);
    } else if (style === 'ponytail') {
      add(sphere, 0, 0.0, -0.06, 0.185, 0.17, 0.16);
      add(sphere, 0, 0.08, -0.19, 0.06, 0.06, 0.06);
      const tail = add(cap(0.05, 0.3), 0, -0.12, -0.22);
      tail.rotation.x = 0.25;
    } else if (style === 'bob') {
      add(sphere, 0, -0.04, -0.03, 0.205, 0.2, 0.195);
    } else if (style === 'curly') {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        add(sphere, Math.cos(a) * 0.16, 0.06 + Math.sin(i * 1.3) * 0.08, Math.sin(a) * 0.14 - 0.04, 0.075, 0.075, 0.075);
      }
      for (let i = 0; i < 6; i++) add(sphere, (i - 2.5) * 0.06, 0.18, -0.02, 0.07, 0.07, 0.07);
    }
  }

  private buildAccessories(L: Look): void {
    const h = this.head;
    const gl = L.glasses ? shopItem(L.glasses) : undefined;
    if (gl) {
      const fm = mat(String(gl.r.color), 0.3, 0.4);
      const lens = mat(gl.r.style === 'heart' ? '#ff4f9a' : '#1a1a22', 0.1, 0.6);
      lens.transparent = true; lens.opacity = 0.85;
      for (const x of [-0.065, 0.065]) {
        if (gl.r.style === 'heart') {
          const s = new THREE.Shape();
          s.moveTo(0, -0.03); s.bezierCurveTo(-0.05, 0, -0.04, 0.04, 0, 0.02); s.bezierCurveTo(0.04, 0.04, 0.05, 0, 0, -0.03);
          const m = mesh(new THREE.ShapeGeometry(s), lens, h, x, 0.01, 0.185);
          m.scale.setScalar(1.3);
        } else {
          const ring = mesh(new THREE.TorusGeometry(0.04, 0.008, 8, 20), fm, h, x, 0.005, 0.18);
          ring.scale.set(gl.r.style === 'cateye' ? 1.25 : 1.1, 0.85, 1);
          mesh(new THREE.CircleGeometry(0.04, 20), lens, h, x, 0.005, 0.181).scale.set(1.1, 0.85, 1);
        }
      }
      mesh(new THREE.BoxGeometry(0.05, 0.01, 0.01), fm, h, 0, 0.012, 0.183);
    }
    const hat = L.hat ? shopItem(L.hat) : undefined;
    if (hat) {
      const hm = mat(String(hat.r.color), 0.8);
      if (hat.r.style === 'sun') {
        mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.015, 32), hm, h, 0, 0.13, -0.01);
        mesh(new THREE.SphereGeometry(0.19, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hm, h, 0, 0.12, -0.01);
        mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 24), mat('#ff6f91', 0.7), h, 0, 0.14, -0.01);
      } else {
        mesh(new THREE.SphereGeometry(0.195, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hm, h, 0, 0.06, -0.01);
        mesh(new RoundedBoxGeometry(0.28, 0.02, 0.18, 2, 0.008), hm, h, 0, 0.08, 0.2).rotation.x = 0.15;
      }
    }
    const jw = L.jewel ? shopItem(L.jewel) : undefined;
    if (jw) {
      const jm = mat(String(jw.r.color), 0.2, jw.r.style === 'pearl' ? 0.1 : 1);
      if (jw.r.style === 'pearl') {
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          const m = mesh(sphere, jm, this.parts, Math.cos(a) * 0.1, 1.44 - Math.max(0, Math.sin(a)) * 0.05, Math.sin(a) * 0.08 + 0.01);
          m.scale.setScalar(0.017);
        }
      } else if (jw.r.style === 'chain') {
        const m = mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 30), jm, this.parts, 0, 1.42, 0.02);
        m.rotation.x = Math.PI / 2.3;
      } else if (jw.r.style === 'tiara') {
        const m = mesh(new THREE.TorusGeometry(0.15, 0.012, 8, 30, Math.PI), jm, h, 0, 0.12, 0.02);
        m.rotation.x = -0.6;
        for (let i = 0; i < 5; i++) mesh(sphere, mat('#bfefff', 0.05, 0.3, '#bfefff', 0.6), h, (i - 2) * 0.05, 0.2 + (i === 2 ? 0.04 : 0), 0.08).scale.setScalar(0.022);
      } else {
        mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.09, 8, 1, true), GOLD(), h, 0, 0.22, -0.02);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const sp = mesh(new THREE.ConeGeometry(0.025, 0.07, 4), GOLD(), h, Math.cos(a) * 0.125, 0.3, Math.sin(a) * 0.125 - 0.02);
          sp.castShadow = false;
          if (i % 2 === 0) mesh(sphere, mat('#ff2d55', 0.1, 0.3, '#ff2d55', 0.4), h, Math.cos(a) * 0.13, 0.22, Math.sin(a) * 0.13 - 0.02).scale.setScalar(0.018);
        }
      }
    }
    const bag = L.bag ? shopItem(L.bag) : undefined;
    if (bag) {
      const s = Number(bag.r.size ?? 1);
      const bm = mat(String(bag.r.color), bag.id === 'bag_diamond' ? 0.05 : 0.4, bag.id === 'bag_diamond' ? 0.6 : 0.1);
      mesh(new RoundedBoxGeometry(0.2 * s, 0.16 * s, 0.08 * s, 2, 0.02), bm, this.lArm, -0.06, -0.5, 0.0);
      const handle = mesh(new THREE.TorusGeometry(0.06 * s, 0.008, 6, 16, Math.PI), GOLD(), this.lArm, -0.06, -0.42, 0);
      handle.castShadow = false;
    }
    const pf = L.perfume ? shopItem(L.perfume) : undefined;
    this.sparkleColor = pf ? new THREE.Color(String(pf.r.color)).getHex() : null;
  }

  /** Called every frame. `speed` 0..1 is how fast they are walking. */
  update(dt: number, t: number, speed: number, mode: Mode): void {
    const now = performance.now();
    if (this.bubble && now > this.bubbleUntil) { this.root.remove(this.bubble); this.bubble = undefined; }
    if (this.emote && (now > this.emoteUntil || speed > 0.2)) this.emote = null;
    this.phase += dt * (4 + speed * 6) * (speed > 0.05 ? 1 : 0.3);
    const s = Math.sin(this.phase);
    const reset = () => {
      this.lArm.rotation.set(0, 0, 0.08); this.rArm.rotation.set(0, 0, -0.08);
      this.lLeg.rotation.set(0, 0, 0); this.rLeg.rotation.set(0, 0, 0);
      this.body.position.set(0, 0, 0); this.body.rotation.set(0, 0, 0);
      this.head.rotation.set(0, 0, 0);
    };
    reset();
    if (mode === 'drive') {
      this.lLeg.rotation.x = this.rLeg.rotation.x = -1.4;
      this.lArm.rotation.x = this.rArm.rotation.x = -1.0;
      this.body.position.y = -0.25;
    } else if (mode === 'swim') {
      this.body.position.y = -0.95 + Math.sin(t * 2) * 0.04;
      if (speed > 0.05) {
        this.lArm.rotation.x = Math.sin(this.phase) * 2.6;
        this.rArm.rotation.x = Math.sin(this.phase + Math.PI) * 2.6;
      } else {
        this.lArm.rotation.z = 0.9 + Math.sin(t * 3) * 0.3;
        this.rArm.rotation.z = -0.9 - Math.sin(t * 3) * 0.3;
      }
      this.lLeg.rotation.x = Math.sin(this.phase * 2) * 0.4;
      this.rLeg.rotation.x = -Math.sin(this.phase * 2) * 0.4;
    } else if (mode === 'soak' || this.emote === 'sit') {
      this.lLeg.rotation.x = this.rLeg.rotation.x = -1.5;
      this.body.position.y = mode === 'soak' ? -0.05 : -0.42;
      this.lArm.rotation.z = 0.5; this.rArm.rotation.z = -0.5;
    } else if (this.emote === 'wave') {
      this.rArm.rotation.z = -2.6 + Math.sin(t * 10) * 0.35;
    } else if (this.emote === 'dance') {
      this.body.position.y = Math.abs(Math.sin(t * 6)) * 0.08;
      this.body.rotation.y = Math.sin(t * 3) * 0.5;
      this.lArm.rotation.z = 2.4 + Math.sin(t * 6) * 0.4;
      this.rArm.rotation.z = -2.4 + Math.sin(t * 6 + 1) * 0.4;
      this.lLeg.rotation.x = Math.sin(t * 6) * 0.3;
      this.rLeg.rotation.x = -Math.sin(t * 6) * 0.3;
      this.head.rotation.z = Math.sin(t * 6) * 0.15;
    } else if (this.emote === 'heart') {
      this.lArm.rotation.z = 2.7; this.rArm.rotation.z = -2.7;
      this.lArm.rotation.x = this.rArm.rotation.x = -0.3;
    } else if (this.emote === 'pose') {
      this.lArm.rotation.z = 0.7; this.lArm.rotation.x = 0.3;
      this.rArm.rotation.z = -2.8;
      this.body.rotation.z = 0.06;
      this.head.rotation.z = -0.15;
    } else if (speed > 0.05) {
      this.lLeg.rotation.x = s * 0.65 * speed;
      this.rLeg.rotation.x = -s * 0.65 * speed;
      this.lArm.rotation.x = -s * 0.55 * speed;
      this.rArm.rotation.x = s * 0.55 * speed;
      this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.05 * speed;
      this.body.rotation.y = s * 0.06;
    } else {
      this.body.position.y = Math.sin(t * 1.8) * 0.006;
      this.head.rotation.y = Math.sin(t * 0.5) * 0.15;
    }
    if (mode === 'soak') this.body.position.y = -0.05;
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
