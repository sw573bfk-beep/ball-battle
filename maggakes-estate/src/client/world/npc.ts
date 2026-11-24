import * as THREE from 'three';
import type { Look } from '../../shared/look';
import { mat } from '../engine/props';
import { Avatar } from '../engine/avatar';
import { nameTexture } from '../engine/tex';
import type { Zone } from './build';
import { CAST, HOST, PERSONAS, islander } from '../../shared/season';

export interface Wanderer {
  name: string;
  obj: THREE.Object3D;
  x: number; z: number; ry: number;
  tx: number; tz: number;
  wait: number;
  speed: number;
  /** follow this point instead of wandering */
  follow?: () => { x: number; z: number; exact?: boolean; face?: number } | null;
  tick: (dt: number, t: number, moving: number) => void;
  line?: string;
  avatar?: Avatar;
  kind: 'pet' | 'islander' | 'host' | 'npc';
  /** Quest character id (kind 'npc'). */
  npcId?: string;
  /** Floating ❗ / ✅ above a quest character. */
  marker?: THREE.Sprite;
}

function pickTarget(zone: Zone, w: Wanderer, area?: (x: number, z: number) => boolean): void {
  for (let i = 0; i < 30; i++) {
    const x = (Math.random() - 0.5) * zone.half.w * 2, z = (Math.random() - 0.5) * zone.half.d * 2;
    if (zone.walkable(x, z, 0.45) && zone.reach(x, z) && (!area || area(x, z))) { w.tx = x; w.tz = z; return; }
  }
  w.tx = w.x; w.tz = w.z;
}

export function petModel(kind: 'dog' | 'cat' | 'bunny', name: string, furColor?: string, collarColor?: string): { obj: THREE.Group; tick: Wanderer['tick'] } {
  const g = new THREE.Group();
  const fur = mat(furColor ?? (kind === 'dog' ? '#d9a35c' : kind === 'bunny' ? '#f4efe9' : '#b8b8c0'), 0.95);
  const light = mat(kind === 'dog' ? '#f3dcb8' : '#ffffff', 0.95);
  const s = kind === 'dog' ? 1 : kind === 'bunny' ? 0.6 : 0.75;
  const sph = (r: number, m: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const me = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), m);
    me.position.set(x, y, z); me.scale.set(sx, sy, sz); me.castShadow = true; g.add(me); return me;
  };
  const body = sph(0.22 * s, fur, 0, 0.36 * s, 0, 1, 0.85, 1.5);
  sph(0.15 * s, light, 0, 0.3 * s, 0.12 * s, 0.9, 0.7, 1.1);
  const head = new THREE.Group();
  head.position.set(0, 0.55 * s, 0.33 * s);
  g.add(head);
  const hm = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 18, 12), fur); hm.castShadow = true; head.add(hm);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.08 * s, 12, 8), light); snout.position.set(0, -0.04 * s, 0.13 * s); snout.scale.set(1, 0.8, kind === 'dog' ? 1.3 : 0.8); head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025 * s, 8, 6), mat('#222', 0.3)); nose.position.set(0, -0.02 * s, 0.22 * s); head.add(nose);
  for (const x of [-0.06, 0.06]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.022 * s, 8, 6), mat('#111', 0.2)); e.position.set(x * s, 0.04 * s, 0.13 * s); head.add(e);
    const ear = new THREE.Mesh(kind === 'dog' ? new THREE.SphereGeometry(0.07 * s, 10, 8) : kind === 'bunny' ? new THREE.CapsuleGeometry(0.035 * s, 0.22 * s, 4, 8) : new THREE.ConeGeometry(0.06 * s, 0.12 * s, 4), kind === 'dog' ? mat('#a8763c', 0.95) : fur);
    ear.position.set(x * (kind === 'bunny' ? 0.9 : 1.8) * s, kind === 'dog' ? 0.02 * s : kind === 'bunny' ? 0.24 * s : 0.15 * s, -0.02 * s);
    if (kind === 'dog') ear.scale.set(0.6, 1.4, 0.4);
    if (kind === 'bunny') { ear.rotation.z = x * -2; const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.018 * s, 0.16 * s, 4, 6), mat('#ffb3c1', 0.9)); inner.position.z = 0.02 * s; ear.add(inner); }
    head.add(ear);
  }
  const legs: THREE.Mesh[] = [];
  for (const [x, z] of [[-0.1, 0.18], [0.1, 0.18], [-0.1, -0.18], [0.1, -0.18]]) {
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.04 * s, 0.18 * s, 4, 8), fur);
    l.position.set(x * s, 0.13 * s, z * s); l.castShadow = true; g.add(l); legs.push(l);
  }
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.03 * s, 0.22 * s, 4, 8), fur);
  tail.position.set(0, 0.48 * s, -0.33 * s); tail.rotation.x = -0.8; g.add(tail);
  if (kind === 'bunny') { tail.scale.set(2.5, 0.6, 2.5); tail.position.set(0, 0.38 * s, -0.3 * s); }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.11 * s, 0.02 * s, 6, 16), mat(collarColor ?? (kind === 'dog' ? '#ff4f9a' : '#4fd1c5'), 0.5));
  collar.position.set(0, 0.47 * s, 0.25 * s); collar.rotation.x = 1.2; g.add(collar);
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTexture(name, false), transparent: true, depthWrite: false, depthTest: false }));
  tag.visible = name.length > 0;
  tag.scale.set(1.1, 0.34, 1); tag.position.y = 1.0; tag.renderOrder = 10; g.add(tag);
  let ph = 0;
  return {
    obj: g,
    tick: (dt, t, moving) => {
      ph += dt * (moving > 0.1 ? 12 : 2);
      legs.forEach((l, i) => { l.rotation.x = moving > 0.1 ? Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.6 : 0; });
      tail.rotation.z = Math.sin(t * (kind === 'dog' ? 12 : 3)) * 0.5;
      head.rotation.y = Math.sin(t * 0.7) * 0.3;
      body.position.y = 0.36 * s + (moving > 0.1 ? Math.abs(Math.sin(ph)) * 0.02 : Math.sin(t * 2) * 0.005);
    },
  };
}

export function spawnPets(zone: Zone): Wanderer[] {
  const out: Wanderer[] = [];
  for (const [kind, name] of [['dog', 'Biscuit'], ['cat', 'Mochi']] as const) {
    const m = petModel(kind, name);
    const w: Wanderer = { name, obj: m.obj, x: 0, z: 0, ry: 0, tx: 0, tz: 0, wait: 1, speed: kind === 'dog' ? 1.6 : 1.1, tick: m.tick, kind: 'pet' };
    pickTarget(zone, w);
    w.x = w.tx; w.z = w.tz;
    m.obj.position.set(w.x, 0, w.z);
    zone.root.add(m.obj);
    out.push(w);
  }
  return out;
}

/** Spawns season islanders. `at` lets a bombshell make an entrance from a spot. */
export function spawnIslander(zone: Zone, name: string, at?: { x: number; z: number }): Wanderer | null {
  const isl = islander(name) ?? CAST.find((c) => c.name === name);
  if (!isl) return null;
  const per = PERSONAS[isl.persona];
  const av = new Avatar(isl.look, isl.name, false, `${per.emoji} ${per.label}`);
  const w: Wanderer = { name: isl.name, obj: av.root, x: 0, z: 0, ry: 0, tx: 0, tz: 0, wait: Math.random() * 3, speed: 1.3, avatar: av, line: isl.line, kind: 'islander', tick: () => {} };
  if (at) { w.x = at.x; w.z = at.z; pickTarget(zone, w); w.wait = 0; }
  else { pickTarget(zone, w); w.x = w.tx; w.z = w.tz; }
  av.root.position.set(w.x, 0, w.z);
  zone.root.add(av.root);
  return w;
}

/** A quest character who stands in one spot. */
export function spawnNpc(zone: Zone, npc: { id: string; name: string; emoji: string; role: string; x: number; z: number; ry: number; look: Look }): Wanderer {
  const av = new Avatar(npc.look, npc.name, false, `${npc.emoji} ${npc.role}`);
  const x = npc.x - zone.half.w, z = npc.z - zone.half.d;
  const w: Wanderer = { name: npc.name, obj: av.root, x, z, ry: npc.ry, tx: x, tz: z, wait: 1e9, speed: 0, avatar: av, kind: 'npc', npcId: npc.id, tick: () => {} };
  av.root.position.set(x, 0, z);
  av.root.rotation.y = npc.ry;
  zone.root.add(av.root);
  return w;
}

export function spawnHost(zone: Zone, x: number, z: number, ry: number): Wanderer {
  const av = new Avatar(HOST.look, HOST.name, false, '🎤 Your host', 'mic');
  const w: Wanderer = { name: HOST.name, obj: av.root, x, z, ry, tx: x, tz: z, wait: 1e9, speed: 0, avatar: av, line: 'Islaaanders!', kind: 'host', tick: () => {} };
  av.root.position.set(x, 0, z);
  av.root.rotation.y = ry;
  zone.root.add(av.root);
  return w;
}

export function updateWanderers(list: Wanderer[], zone: Zone, dt: number, t: number): void {
  for (const w of list) {
    const f = w.follow?.();
    if (f) {
      const dx = f.x - w.x, dz = f.z - w.z;
      if (f.exact) { if (Math.hypot(dx, dz) > 0.25) { w.tx = f.x; w.tz = f.z; w.wait = 0; } else if (f.face !== undefined) w.ry = f.face; }
      else if (Math.hypot(dx, dz) > 2.2) { w.tx = f.x - dx * 0.3; w.tz = f.z - dz * 0.3; w.wait = 0; }
    }
    let moving = 0;
    if (w.kind === 'host' || w.kind === 'npc') { if (w.obj.visible) w.avatar?.update(dt, t, 0, 'walk'); if (w.marker) w.marker.position.y = 2.55 + Math.sin(t * 3) * 0.06; continue; }
    if (w.wait > 0) {
      w.wait -= dt;
    } else {
      const dx = w.tx - w.x, dz = w.tz - w.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) {
        w.wait = f ? 0.3 : 2 + Math.random() * 5;
        if (!f) pickTarget(zone, w);
        else if (f && Math.hypot(f.x - w.x, f.z - w.z) < 0.6) w.wait = 0.5;
      } else {
        const step = Math.min(d, w.speed * (f ? 1.8 : 1) * dt);
        const nx = w.x + (dx / d) * step, nz = w.z + (dz / d) * step;
        if (zone.walkable(nx, nz, 0.25) || f) { w.x = nx; w.z = nz; moving = 1; }
        else { pickTarget(zone, w); }
        const want = Math.atan2(dx, dz);
        let diff = want - w.ry;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        w.ry += diff * Math.min(1, dt * 8);
      }
    }
    w.obj.position.set(w.x, 0, w.z);
    w.obj.rotation.y = w.ry;
    // Far-away characters are hidden (see Game.lod) — skip animating them.
    if (!w.obj.visible) continue;
    if (w.avatar) w.avatar.update(dt, t, moving * 0.6, 'walk');
    else w.tick(dt, t, moving);
  }
}
