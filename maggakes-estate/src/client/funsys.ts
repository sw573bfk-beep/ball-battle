import * as THREE from 'three';
import type { Game } from './game';
import { Music } from './engine/music';
import { goldenShell, slideCurve, sprite } from './engine/props';
import { emojiTexture, glowTexture, skylineTexture } from './engine/tex';
import { petModel } from './world/npc';
import { SHELLS } from '../shared/save';
import type { ZoneId } from '../shared/people';
import { $, confetti, h, fill, toast } from './ui/dom';
import { openRace, openSpin } from './ui/fun';

interface PetObj { obj: THREE.Object3D; tick: (dt: number, t: number, moving: number) => void; x: number; z: number; ry: number; key: string }
interface Particle { s: THREE.Sprite; v: THREE.Vector3; life: number; max: number; gravity: number }

const DAY_MS = 20 * 60 * 1000;
const FIREWORK_COLORS = [0xff4fa3, 0xffd23f, 0x33e1ff, 0x9bff6a, 0xff7a1a, 0xc77dff, 0xffffff];

/** Pets, shells, fireworks, parties, tag, races, the water slide and day/night. */
export class Fun {
  music = new Music();
  private myPet: PetObj | null = null;
  private peerPets = new Map<string, PetObj>();
  private shells: { id: string; obj: THREE.Group; x: number; z: number }[] = [];
  private particles: Particle[] = [];
  private rockets: { s: THREE.Sprite; x: number; z: number; y: number; top: number; color: number }[] = [];
  private party: { until: number; group: THREE.Group; lights: THREE.PointLight[] } | null = null;
  private tag: { it: string; until: number; marker: THREE.Group; lastSent: number } | null = null;
  private race: { start: number; next: number; cps: { x: number; z: number }[]; ring: THREE.Mesh; beam: THREE.Mesh; arrow: THREE.Mesh; begun: boolean; sx: number; sz: number; heading: number } | null = null;
  get racing(): boolean { return !!this.race; }
  private slide: { t0: number; pts: THREE.CatmullRomCurve3 } | null = null;
  private dayTimer = 0;
  private spinUI: { land: (i: number, msg: string) => void } | null = null;

  constructor(private g: Game) {
    const unlock = () => { if (this.music.on) this.music.unlock(); };
    addEventListener('pointerdown', unlock, { once: true });
    addEventListener('keydown', unlock, { once: true });
  }

  // ------------------------------------------------------------ zone changes

  onZone(): void {
    this.endParty();
    this.clearTag();
    this.cancelRace();
    this.slide = null;
    for (const p of this.peerPets.values()) p.obj.removeFromParent();
    this.peerPets.clear();
    this.myPet?.obj.removeFromParent();
    this.myPet = null;
    this.syncMyPet();
    this.buildShells();
    this.dayTimer = 0;
  }

  onSave(): void {
    this.syncMyPet();
    for (let i = this.shells.length - 1; i >= 0; i--) {
      if (this.g.save.shells?.includes(this.shells[i].id)) { this.shells[i].obj.removeFromParent(); this.shells.splice(i, 1); }
    }
  }

  // ------------------------------------------------------------ pets

  private makePet(kind: 'dog' | 'cat' | 'bunny', name: string, x: number, z: number, fur?: string, collar?: string): PetObj {
    const m = petModel(kind, name, fur, collar);
    m.obj.scale.setScalar(0.85);
    this.g.zone!.root.add(m.obj);
    return { obj: m.obj, tick: m.tick, x, z, ry: 0, key: `${kind}|${name}|${fur}|${collar}` };
  }

  private syncMyPet(): void {
    const pet = this.g.save.pet;
    const key = pet ? `${pet.kind}|${pet.name}|${pet.fur}|${pet.collar}` : '';
    if (this.myPet?.key === key) return;
    const at = this.myPet ? { x: this.myPet.x, z: this.myPet.z } : { x: this.g.pos.x + 1, z: this.g.pos.y + 1 };
    this.myPet?.obj.removeFromParent();
    this.myPet = pet && this.g.zone ? this.makePet(pet.kind, pet.name, at.x, at.z, pet.fur, pet.collar) : null;
  }

  callPet(): void {
    if (!this.myPet) return;
    this.myPet.x = this.g.pos.x + 0.8;
    this.myPet.z = this.g.pos.y + 0.8;
    this.heart(this.myPet.x, this.myPet.z);
    toast(`🐾 ${this.g.save.pet?.name} came running!`);
  }

  private followPet(p: PetObj, tx: number, tz: number, ry: number, dt: number, t: number): void {
    const bx = tx - Math.sin(ry) * 1.1 + Math.cos(ry) * 0.55, bz = tz - Math.cos(ry) * 1.1 - Math.sin(ry) * 0.55;
    const dx = bx - p.x, dz = bz - p.z;
    const d = Math.hypot(dx, dz);
    let moving = 0;
    if (d > 10) { p.x = bx; p.z = bz; }
    else if (d > 0.25) {
      const step = Math.min(d, Math.min(8, 1.5 + d * 2.5) * dt);
      p.x += (dx / d) * step; p.z += (dz / d) * step;
      p.ry = Math.atan2(dx, dz);
      moving = 1;
    }
    p.obj.position.set(p.x, 0, p.z);
    p.obj.rotation.y = p.ry;
    p.tick(dt, t, moving);
  }

  private updatePets(dt: number, t: number): void {
    if (this.myPet) this.followPet(this.myPet, this.g.pos.x, this.g.pos.y, this.g.ry, dt, t);
    const seen = new Set<string>();
    for (const [name, peer] of this.g.peers) {
      const pet = peer.info.pet;
      if (!pet) continue;
      seen.add(name);
      let p = this.peerPets.get(name);
      const key = `${pet.kind}|${pet.name}|${pet.fur}|${pet.collar}`;
      if (p && p.key !== key) { p.obj.removeFromParent(); p = undefined; }
      if (!p) { p = this.makePet(pet.kind, pet.name, peer.x, peer.z, pet.fur, pet.collar); this.peerPets.set(name, p); }
      this.followPet(p, peer.x, peer.z, peer.ry, dt, t);
    }
    for (const [name, p] of this.peerPets) if (!seen.has(name)) { p.obj.removeFromParent(); this.peerPets.delete(name); }
  }

  // ------------------------------------------------------------ golden shells

  private buildShells(): void {
    for (const s of this.shells) s.obj.removeFromParent();
    this.shells = [];
    const zone = this.g.zone;
    if (!zone) return;
    const count = SHELLS[this.g.zoneId] ?? 0;
    // Same spots for everyone: seeded by the floor's name.
    let seed = 0;
    for (const ch of this.g.zoneId) seed = (seed * 131 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const spots: { x: number; z: number }[] = [];
    for (let tries = 0; spots.length < count && tries < 3000; tries++) {
      const x = (rnd() - 0.5) * zone.half.w * 1.9, z = (rnd() - 0.5) * zone.half.d * 1.9;
      if (!zone.walkable(x, z, 0.45) || !zone.reach(x, z)) continue;
      if (Math.hypot(x - zone.lift.x, z - zone.lift.z) < 5) continue;
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 6)) continue;
      spots.push({ x, z });
    }
    spots.forEach((s, i) => {
      const id = `${this.g.zoneId}:${i}`;
      if (this.g.save.shells?.includes(id)) return;
      const obj = goldenShell();
      obj.position.set(s.x, 0.35, s.z);
      zone.root.add(obj);
      this.shells.push({ id, obj, x: s.x, z: s.z });
    });
  }

  shellsHere(): { found: number; total: number } {
    const total = SHELLS[this.g.zoneId] ?? 0;
    const found = (this.g.save.shells ?? []).filter((s) => s.startsWith(`${this.g.zoneId}:`)).length;
    return { found, total };
  }

  private updateShells(t: number): void {
    for (const s of this.shells) {
      s.obj.rotation.y = t * 1.5;
      s.obj.position.y = 0.35 + Math.sin(t * 2 + s.x) * 0.08;
      if (Math.hypot(this.g.pos.x - s.x, this.g.pos.y - s.z) < 1.0 && !s.obj.userData.sent) {
        s.obj.userData.sent = true;
        this.burst(s.x, 0.6, s.z, 0xffd23f, 26, 3);
        this.g.net.send({ t: 'shell', id: s.id });
      }
    }
  }

  // ------------------------------------------------------------ particles & fireworks

  private burst(x: number, y: number, z: number, color: number, n: number, speed: number, gravity = 4): void {
    for (let i = 0; i < n; i++) {
      const s = sprite(glowTexture(), 0.35, color, true);
      s.position.set(x, y, z);
      this.g.zone!.root.add(s);
      const v = new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.6 + Math.random() * 0.6));
      this.particles.push({ s, v, life: 1.4 + Math.random() * 0.6, max: 2, gravity });
    }
  }

  /** Bubbles / shower drops around the player for a few seconds (bathroom moments). */
  bubbles(kind: string, secs: number): void {
    if (kind === 'none') return;
    const end = performance.now() + secs * 1000;
    const emit = () => {
      if (performance.now() > end || !this.g.zone) return;
      const me = this.g.me.root.position;
      for (let k = 0; k < 3; k++) {
        const shower = kind === 'shower';
        const s = shower ? sprite(glowTexture(), 0.12, 0x9fdcff, true) : sprite(emojiTexture('🫧'), 0.22);
        s.position.set(me.x + (Math.random() - 0.5) * 0.6, shower ? 2.3 : 0.9 + Math.random() * 0.4, me.z + (Math.random() - 0.5) * 0.6);
        this.g.zone.root.add(s);
        this.particles.push({ s, v: new THREE.Vector3(0, shower ? -3 : 0.5, 0), life: shower ? 0.7 : 1.4, max: shower ? 0.7 : 1.4, gravity: 0 });
      }
      setTimeout(emit, 120);
    };
    emit();
  }

  /** A little flush sound. */
  flush(): void {
    try {
      const ctx = new AudioContext();
      const len = ctx.sampleRate * 1.4;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI) * 0.35;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      src.connect(f).connect(ctx.destination);
      setTimeout(() => { src.start(); setTimeout(() => ctx.close(), 1600); }, 2600);
    } catch { /* no audio */ }
  }

  private heart(x: number, z: number): void {
    const s = sprite(emojiTexture('💖'), 0.5);
    s.position.set(x, 0.9, z);
    this.g.zone!.root.add(s);
    this.particles.push({ s, v: new THREE.Vector3(0, 0.8, 0), life: 1.2, max: 1.2, gravity: 0 });
  }

  launchFireworks(): void {
    this.g.net.send({ t: 'fireworks', x: this.g.pos.x, z: this.g.pos.y });
  }

  onFireworks(x: number, z: number, from: string): void {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (!this.g.zone) return;
        const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
        const s = sprite(glowTexture(), 0.6, color, true);
        const rx = x + (Math.random() - 0.5) * 4, rz = z + (Math.random() - 0.5) * 4;
        s.position.set(rx, 0.5, rz);
        this.g.zone.root.add(s);
        this.rockets.push({ s, x: rx, z: rz, y: 0.5, top: 13 + Math.random() * 7, color });
      }, i * 450);
    }
    if (from !== this.g.save.name) toast(`🎆 ${from} set off fireworks!`);
  }

  private updateParticles(dt: number): void {
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.y += dt * 14;
      r.s.position.y = r.y;
      if (Math.random() < 0.6) {
        const trail = sprite(glowTexture(), 0.25, 0xffd9a0, true);
        trail.position.set(r.x, r.y, r.z);
        this.g.zone!.root.add(trail);
        this.particles.push({ s: trail, v: new THREE.Vector3(0, -1, 0), life: 0.4, max: 0.4, gravity: 0 });
      }
      if (r.y >= r.top) {
        r.s.removeFromParent();
        this.rockets.splice(i, 1);
        this.burst(r.x, r.y, r.z, r.color, 70, 8, 3);
        this.burst(r.x, r.y, r.z, 0xffffff, 20, 5, 3);
        this.music.boom();
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.v.y -= p.gravity * dt;
      p.v.multiplyScalar(1 - dt * 0.8);
      p.s.position.addScaledVector(p.v, dt);
      p.s.material.opacity = Math.max(0, p.life / p.max);
      if (p.life <= 0) { p.s.removeFromParent(); p.s.material.dispose(); this.particles.splice(i, 1); }
    }
  }

  // ------------------------------------------------------------ party

  onParty(until: number, by: string): void {
    this.endParty();
    const zone = this.g.zone!;
    const group = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 14), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.05, metalness: 1 }));
    ball.position.set(this.g.pos.x, 3.2, this.g.pos.y);
    group.add(ball);
    for (let i = 0; i < 40; i++) {
      const s = sprite(glowTexture(), 0.4, FIREWORK_COLORS[i % FIREWORK_COLORS.length], true);
      s.userData.a = Math.random() * Math.PI * 2;
      s.userData.r = 2 + Math.random() * 7;
      s.userData.y = 0.5 + Math.random() * 2.5;
      group.add(s);
    }
    const lights = [new THREE.PointLight(0xff3df0, 8, 14, 2), new THREE.PointLight(0x33e1ff, 8, 14, 2)];
    for (const l of lights) group.add(l);
    group.userData.cx = this.g.pos.x;
    group.userData.cz = this.g.pos.y;
    zone.root.add(group);
    this.party = { until, group, lights };
    this.music.setOverride('party');
    if (by) toast(`🎉 ${by === this.g.save.name ? 'You' : by} started a PARTY! Dance (press 2) to earn Aura!`, true);
  }

  private endParty(): void {
    if (!this.party) return;
    this.party.group.removeFromParent();
    this.party = null;
    this.music.setOverride(null);
  }

  private updateParty(t: number): void {
    const p = this.party;
    if (!p) return;
    if (Date.now() > p.until) { this.endParty(); toast('🎉 The party is over — what a night!'); return; }
    const { cx, cz } = p.group.userData;
    p.group.children.forEach((c) => {
      if ((c as THREE.Sprite).isSprite) {
        const a = c.userData.a + t * 0.6;
        c.position.set(cx + Math.cos(a) * c.userData.r, c.userData.y + Math.sin(t * 3 + c.userData.r) * 0.3, cz + Math.sin(a) * c.userData.r);
      } else if ((c as THREE.Mesh).isMesh) c.rotation.y = t;
    });
    p.lights.forEach((l, i) => {
      l.position.set(cx + Math.cos(t * 1.5 + i * Math.PI) * 4, 2.5, cz + Math.sin(t * 1.5 + i * Math.PI) * 4);
      l.color.setHSL((t * 0.15 + i * 0.5) % 1, 1, 0.55);
    });
  }

  // ------------------------------------------------------------ tag

  onTag(it: string, until: number): void {
    const zone = this.g.zone!;
    if (!this.tag) {
      const marker = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 32), new THREE.MeshBasicMaterial({ color: 0xff2d55, transparent: true, opacity: 0.85, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      marker.add(ring);
      const s = sprite(glowTexture(), 2, 0xff2d55, true);
      s.position.y = 1;
      s.material.opacity = 0.5;
      marker.add(s);
      const icon = sprite(emojiTexture('🏃', '#ff2d55'), 0.6);
      icon.position.y = 2.8;
      marker.add(icon);
      zone.root.add(marker);
      this.tag = { it, until, marker, lastSent: 0 };
    }
    if (this.tag.it !== it && it === this.g.save.name) toast("🏃 You're IT! Tag someone!");
    this.tag.it = it;
    this.tag.until = until;
  }

  onTagEnd(it: string, winners: string[]): void {
    this.clearTag();
    if (winners.includes(this.g.save.name)) { confetti(50); toast(`🏃 Tag over! ${it} was IT at the end. You win +30 Aura!`, true); }
    else toast(`🏃 Tag over! ${it === this.g.save.name ? 'You were' : `${it} was`} IT at the end.`);
  }

  private clearTag(): void {
    this.tag?.marker.removeFromParent();
    this.tag = null;
  }

  private updateTag(t: number): void {
    const tag = this.tag;
    if (!tag) return;
    const me = this.g.save.name;
    const it = tag.it === me ? { x: this.g.pos.x, z: this.g.pos.y } : this.g.peers.get(tag.it);
    if (it) tag.marker.position.set(it.x, 0, it.z);
    tag.marker.children[0].scale.setScalar(1 + Math.sin(t * 6) * 0.1);
    if (tag.it === me && Date.now() - tag.lastSent > 800) {
      for (const [name, p] of this.g.peers) {
        if (Math.hypot(p.x - this.g.pos.x, p.z - this.g.pos.y) < 1.3) {
          tag.lastSent = Date.now();
          this.g.net.send({ t: 'tagged', who: name });
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------ race

  openRace(rows: { name: string; ms: number }[]): void {
    openRace(rows, this.g.save, () => this.startRace());
  }

  private startRace(): void {
    const zone = this.g.zone!, L = zone.layout;
    if (!L.race) return;
    this.cancelRace();
    const W = (x: number) => x - zone.half.w, Z = (z: number) => z - zone.half.d;
    const [sx, sz, heading] = L.race.start;
    this.g.placeCar(W(sx), Z(sz), heading);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.15, 10, 40), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9 }));
    zone.root.add(ring);
    // A tall glowing beam so the next checkpoint is easy to spot from anywhere.
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 14, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    zone.root.add(beam);
    // An arrow floating over your kart that points at the next checkpoint.
    const ag = new THREE.ConeGeometry(0.35, 0.9, 12);
    ag.rotateX(Math.PI / 2);
    const arrow = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    zone.root.add(arrow);
    this.race = { start: performance.now() + 3000, next: 0, cps: L.race.checkpoints.map(([x, z]) => ({ x: W(x), z: Z(z) })), ring, beam, arrow, begun: false, sx: W(sx), sz: Z(sz), heading };
    this.g.lockMove = true;
    const cd = $('#countdown');
    ['3', '2', '1', 'GO!'].forEach((n, i) => setTimeout(() => { cd.textContent = n; cd.classList.remove('on'); void cd.offsetWidth; cd.classList.add('on'); }, i * 1000));
    setTimeout(() => { this.g.lockMove = false; }, 3000);
  }

  private cancelRace(): void {
    if (!this.race) return;
    this.race.ring.removeFromParent();
    this.race.beam.removeFromParent();
    this.race.arrow.removeFromParent();
    this.race = null;
    this.g.lockMove = false;
  }

  private updateRace(t: number): void {
    const r = this.race;
    if (!r) return;
    if (!this.g.isDriving()) { this.cancelRace(); toast('🏁 Race cancelled — you left your kart.'); return; }
    const cp = r.cps[r.next];
    r.ring.position.set(cp.x, 2.4, cp.z);
    r.ring.rotation.y = t;
    r.beam.position.set(cp.x, 7, cp.z);
    r.arrow.position.set(this.g.pos.x, 2.6 + Math.sin(t * 4) * 0.1, this.g.pos.y);
    r.arrow.rotation.y = Math.atan2(cp.x - this.g.pos.x, cp.z - this.g.pos.y);
    const now = performance.now();
    if (now < r.start) return;
    if (Math.hypot(this.g.pos.x - cp.x, this.g.pos.y - cp.z) < 4.5) {
      r.next++;
      if (r.next >= r.cps.length) {
        const ms = now - r.start;
        this.g.net.send({ t: 'lap', ms });
        confetti(60);
        this.cancelRace();
        return;
      }
    }
  }

  /** Stuck? Put the kart back on the last checkpoint, facing the next one (the timer keeps going). */
  resetRace(): void {
    const r = this.race;
    if (!r || performance.now() < r.start) return;
    const from = r.next === 0 ? { x: r.sx, z: r.sz } : r.cps[r.next - 1];
    const to = r.cps[r.next];
    this.g.placeCar(from.x, from.z, Math.atan2(to.x - from.x, to.z - from.z));
    toast('↺ Back on track!');
  }

  // ------------------------------------------------------------ water slide

  startSlide(): void {
    const zone = this.g.zone!;
    const p = zone.layout.props.find((x) => x.t === 'waterslide');
    if (!p) return;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(p.x - zone.half.w, 0, p.z - zone.half.d), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.r, 0)), new THREE.Vector3(1, 1, 1));
    const pts = slideCurve().points.map((v) => v.clone().applyMatrix4(m));
    this.g.stopDriving();
    this.slide = { t0: performance.now(), pts: new THREE.CatmullRomCurve3(pts) };
    this.g.lockMove = true;
  }

  private updateSlide(dt: number, t: number): void {
    const s = this.slide;
    if (!s) return;
    const k = Math.min(1, (performance.now() - s.t0) / 3400);
    const e = k * k * (3 - 2 * k) * 0.25 + k * 0.75;
    const pos = s.pts.getPoint(e);
    const ahead = s.pts.getPoint(Math.min(1, e + 0.02));
    this.g.pos.set(pos.x, pos.z);
    this.g.ry = Math.atan2(ahead.x - pos.x, ahead.z - pos.z);
    this.g.me.root.position.set(pos.x, pos.y - 0.2, pos.z);
    this.g.me.root.rotation.y = this.g.ry;
    this.g.me.update(dt, t, 0, 'drive');
    if (Math.random() < 0.5) this.burst(pos.x, pos.y + 0.2, pos.z, 0xbff6ff, 1, 1.5, 2);
    if (k >= 1) {
      this.slide = null;
      this.g.lockMove = false;
      this.burst(pos.x, 0, pos.z, 0xbff6ff, 60, 5, 6);
      this.burst(pos.x, 0, pos.z, 0xffffff, 30, 4, 6);
      toast('🌊 SPLASH!');
      this.g.net.send({ t: 'stat', stat: 'slide', by: 1 });
    }
  }

  // ------------------------------------------------------------ spin

  openSpin(): void {
    this.spinUI = openSpin(() => this.g.net.send({ t: 'spin' }));
  }

  onSpun(index: number, msg: string): void {
    if (this.spinUI) this.spinUI.land(index, msg);
    else toast(msg, true);
  }

  // ------------------------------------------------------------ day & night + banner

  private updateDay(dt: number): void {
    this.dayTimer -= dt;
    if (this.dayTimer > 0 || !this.g.zone) return;
    this.dayTimer = 0.5;
    const L = this.g.zone.layout;
    const phase = (Date.now() % DAY_MS) / DAY_MS;
    if (L.mood !== 'moody') this.g.gfx.setTimeOfDay(phase, Math.max(L.w, L.d), L.exterior === 'glass' || L.exterior === 'solid');
    const sky = this.g.zone.root.getObjectByName('skyline') as THREE.Mesh | undefined;
    if (sky) {
      const m = sky.material as THREE.MeshBasicMaterial;
      const night = this.g.gfx.night > 0.5;
      const tex = skylineTexture(night);
      if (m.map !== tex) { m.map = tex; m.needsUpdate = true; }
      m.color.setScalar(1 - this.g.gfx.night * 0.35);
    }
    const icon = phase < 0.06 ? '🌅' : phase < 0.55 ? '☀️' : phase < 0.64 ? '🌇' : phase < 0.94 ? '🌙' : '🌅';
    const el = $('#daytime');
    if (el && el.textContent !== icon) el.textContent = icon;
  }

  private updateBanner(): void {
    const el = $('#banner');
    const fmt = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    let cls = '', text = '';
    if (this.race) {
      const now = performance.now();
      cls = 'race';
      text = now < this.race.start ? '🏁 Get ready…' : `🏁 ${((now - this.race.start) / 1000).toFixed(2)}s · checkpoint ${this.race.next + 1}/${this.race.cps.length} · follow the yellow arrow (R = reset)`;
    } else if (this.tag) {
      cls = 'tag';
      text = `🏃 TAG · ${this.tag.it === this.g.save.name ? "YOU'RE IT!" : `${this.tag.it} is IT — run!`} · ${fmt(this.tag.until - Date.now())}`;
    } else if (this.party) {
      cls = 'party';
      text = `🎉 PARTY! Press 2 to dance for Aura · ${fmt(this.party.until - Date.now())}`;
    }
    el.className = text ? `on ${cls}` : '';
    if (el.textContent !== text) fill(el, text ? h('span', {}, text) : null);
  }

  update(dt: number, t: number): void {
    this.updateDay(dt);
    this.updatePets(dt, t);
    this.updateShells(t);
    this.updateParticles(dt);
    this.updateParty(t);
    this.updateTag(t);
    this.updateRace(t);
    this.updateSlide(dt, t);
    this.updateBanner();
  }

  zoneId(): ZoneId { return this.g.zoneId; }
}
