import * as THREE from 'three';
import { Gfx, MOODS, tickWater, type Quality } from './engine/gfx';
import { Avatar, type Emote, type Mode } from './engine/avatar';
import { buildCar, Driving, type CarModel } from './engine/car';
import { makeProp, sprite, stationMarker, type Prop } from './engine/props';
import { emojiTexture, glowTexture } from './engine/tex';
import { buildZone, roomAt, roomBox, type Zone } from './world/build';
import { spawnHost, spawnIslander, spawnPets, updateWanderers, type Wanderer } from './world/npc';
import { openCast, showScene } from './ui/season';
import { FINAL_DAY, nextStep, type SeasonAction } from '../shared/season';
import { Input } from './input';
import type { Net } from './net';
import { h, sheet, toast, confetti, closeAllSheets, $, fill } from './ui/dom';
import { choiceGame, holdGame, sequenceGame, simonGame, timingGame } from './ui/minigames';
import { openBoard, openDaily, openGarage, openMap, openSettings, openShop, openWardrobe, nextGoal, taskList, type Ctx } from './ui/panels';
import type { ZoneId } from '../shared/people';
import { setResidences, getResidences } from './world/layouts';
import { openAccounts } from './ui/accounts';
import { Fun } from './funsys';
import { openAdopt, openFun } from './ui/fun';
import type { AccountRow, Residence } from '../shared/protocol';
import { ALL_ZONES, floorById, zoneName, type TaskDef } from '../shared/floors';
import { canEnter, zoneUnlocked, ROOM_LIMIT, type Look, type PlacedItem, type Save } from '../shared/save';
import { SHOP, shopItem } from '../shared/shop';
import { ISLANDERS, VILLA_CHALLENGES } from '../shared/villa';
import type { BoardRow, PeerInfo, ServerMsg } from '../shared/protocol';

const SPEED = 4.4;
const SWIM_SPEED = 2.6;
const RADIUS = 0.32;

const TASK_EMOJI: Record<string, string> = {
  checkin: '🛎️', sushi: '🍣', cleanguest: '🧹', spa: '💆', drink: '🥤', breakfast: '🥞', feed: '🦴', wash: '🛁', cleankitchen: '🍽️', snack: '🍓',
  setupgym: '💡', swim: '🏊', organisegym: '🏋️', hottub: '♨️', stretch: '🤸', bed: '🛏️', wardrobe: '👗', dining: '🍴', outfit: '👠', decorate: '🖼️',
  record: '🎙️', dj: '🎧', organisemusic: '💿', photo: '📸', musicchallenge: '🎹', cleanensuite: '🧽', yoga: '🧘', getready: '💄', cleanlounge: '🛋️',
  infinity: '🌊', tropical: '🍹', sunbeds: '🏖️', garden: '🌱', sunset: '🏐',
};
const VILLA_EMOJI: Record<string, string> = { dance: '💃', coconut: '🥥', quiz: '❓', volley: '🏐' };

interface Peer {
  info: PeerInfo;
  avatar: Avatar;
  x: number; z: number; ry: number;
  tx: number; tz: number; try: number;
  a: number;
  car: CarModel | null;
  carKey: string;
}

interface Action { key: string; label: string; run: () => void }

export class Game {
  gfx: Gfx;
  input: Input;
  save: Save;
  admin: boolean;
  zone: Zone | null = null;
  zoneId: ZoneId = 'b';
  me: Avatar;
  pos = new THREE.Vector2();
  ry = 0;
  vel = new THREE.Vector2();
  mode: Mode = 'walk';
  peers = new Map<string, Peer>();
  camYaw = 0;
  camPitch = 0.86;
  camDist = 11;
  camTarget = new THREE.Vector3();
  wallMode: 'auto' | 'low' = (localStorage.getItem('walls') as 'auto' | 'low') || 'auto';
  private markers: { prop: Prop; key: string }[] = [];
  private ticks: ((t: number, dt: number) => void)[] = [];
  private wanderers: Wanderer[] = [];
  private decorGroups = new Map<string, THREE.Group>();
  private pickups: { s: THREE.Sprite; x: number; z: number }[] = [];
  private collect: { label: string; total: number; got: number; done: () => void } | null = null;
  private car: { model: CarModel; drive: Driving; x: number; z: number; heading: number } | null = null;
  private driveAcc = 0;
  private swimAcc = 0;
  private previewing: Look | null = null;
  private decor: { items: PlacedItem[]; pick: string | null; ghost: THREE.Object3D | null; rot: number; box: { x0: number; z0: number; x1: number; z1: number } } | null = null;
  private saveListeners = new Set<() => void>();
  private boardListeners = new Set<(r: BoardRow[]) => void>();
  private lastSent = { x: 0, z: 0, ry: 0, a: -1, t: 0 };
  private actions: Action[] = [];
  private actionKey = '';
  private wantPhoto: ((url: string) => void) | null = null;
  private clock = new THREE.Clock();
  private elapsed = 0;
  private textTimer = 120;
  private ready = false;
  /** Test-only: ?norender skips drawing so automated tests run fast. */
  private noRender = location.search.includes('norender');
  private transitioning = false;
  ctx: Ctx;

  pending = 0;
  fun!: Fun;
  /** Set while racing countdowns / the water slide take over movement. */
  lockMove = false;
  private wantLaps = false;
  private accountListeners = new Set<(r: AccountRow[]) => void>();

  constructor(host: HTMLElement, save: Save, admin: boolean, public net: Net, private signOut: () => void, residences: Residence[] = [], pending = 0) {
    setResidences(residences);
    this.pending = pending;
    this.save = save;
    this.admin = admin;
    const q = (localStorage.getItem('quality') as Quality) || (matchMedia('(pointer: coarse)').matches ? 'medium' : 'high');
    this.gfx = new Gfx(host, q);
    this.input = new Input(this.gfx.renderer.domElement, $('#joy'));
    this.me = new Avatar(save.look, save.name, save.vip);
    this.fun = new Fun(this);
    this.ctx = {
      save: () => this.save,
      admin,
      net,
      zone: () => this.zoneId,
      travel: (z) => this.travel(z),
      previewLook: (l) => this.preview(l),
      onSave: (fn) => { this.saveListeners.add(fn); return () => this.saveListeners.delete(fn); },
      onBoard: (fn) => { this.boardListeners.add(fn); return () => this.boardListeners.delete(fn); },
      quality: () => this.gfx.quality,
      setQuality: (q2) => { this.gfx.setQuality(q2); localStorage.setItem('quality', q2); },
      walls: () => this.wallMode,
      setWalls: (w) => { this.wallMode = w; localStorage.setItem('walls', w); },
      signOut: () => this.signOut(),
    };
    net.on((m) => this.onMsg(m));
    this.input.onKey = (k) => this.onKey(k);
    this.bindHud();
    this.renderHud();
    const start = canEnter(save, save.lastZone) && this.zoneExists(save.lastZone) ? save.lastZone : save.home?.zone ?? 'f1';
    this.travel(start, true);
    this.loop();
  }

  openFunMenu(): void {
    openFun({
      save: () => this.save,
      driving: () => !!this.car,
      kart: () => this.startKart(),
      spin: () => this.fun.openSpin(),
      party: () => this.net.send({ t: 'party' }),
      tag: () => this.net.send({ t: 'tag' }),
      fireworks: () => this.fun.launchFireworks(),
      callPet: () => this.fun.callPet(),
      shellsHere: () => this.fun.shellsHere(),
      music: this.fun.music,
    });
  }

  private zoneExists(z: ZoneId): boolean {
    return ALL_ZONES.includes(z) || getResidences().some((r) => r.zone === z);
  }

  /** Shows the accounts button (VIPs + admins) with a badge for sign-ups waiting. */
  renderBadge(): void {
    const btn = $('#b-accounts');
    btn.style.display = this.admin || this.save.vip ? '' : 'none';
    const badge = btn.querySelector('.badge') as HTMLElement;
    badge.textContent = this.pending > 0 ? String(this.pending) : '';
    badge.style.display = this.admin && this.pending > 0 ? '' : 'none';
  }

  /** Called when the connection drops and comes back. */
  resume(save: Save): void {
    this.save = save;
    this.net.send({ t: 'zone', zone: this.zoneId });
    this.renderHud();
    this.buildMarkers();
  }

  // ================================================================== zones

  travel(z: ZoneId, first = false): void {
    if (this.transitioning) return;
    if (!canEnter(this.save, z)) { toast('That floor is still locked.'); return; }
    this.transitioning = true;
    const fade = $('#fade');
    fade.querySelector('b')!.textContent = zoneName(z);
    fade.classList.add('on');
    setTimeout(() => {
      try { this.loadZone(z); } finally {
        this.transitioning = false;
        setTimeout(() => fade.classList.remove('on'), first ? 250 : 120);
      }
    }, first ? 50 : 380);
  }

  private loadZone(z: ZoneId): void {
    this.stopDriving(false);
    this.endDecor();
    this.cancelCollect();
    if (this.zone) {
      this.gfx.scene.remove(this.zone.root);
      this.zone.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    }
    for (const p of this.peers.values()) p.avatar.dispose();
    this.peers.clear();
    this.decorGroups.clear();
    this.markers = [];
    this.markerSig = '';
    const zone = buildZone(z);
    this.zone = zone;
    this.zoneId = z;
    this.ticks = [...zone.ticks];
    this.gfx.scene.add(zone.root);
    zone.root.add(this.me.root);
    const L = zone.layout;
    this.gfx.setMood(MOODS[L.mood], Math.max(L.w, L.d));
    // Arrive in front of the lift.
    const lx = zone.lift.x + Math.sin(zone.lift.rot) * 1.8, lz = zone.lift.z + Math.cos(zone.lift.rot) * 1.8;
    const ok = zone.walkable(lx, lz);
    this.pos.set(ok ? lx : zone.spawn.x, ok ? lz : zone.spawn.z);
    this.ry = zone.lift.rot;
    this.camYaw = zone.lift.rot;
    this.camDist = L.exterior === 'none' ? 13 : 11;
    this.camTarget.set(this.pos.x, 1.2, this.pos.y);
    this.wanderers = [];
    if (L.pets) this.wanderers.push(...spawnPets(zone));
    if (z === 'villa') {
      const pod = zone.layout.props.find((p) => p.t === 'podium');
      if (pod) this.wanderers.push(spawnHost(zone, pod.x - zone.half.w, pod.z - zone.half.d - 0.55, 0));
      this.syncCast(false);
      if (!this.save.villa.look || !this.save.villa.season) setTimeout(() => this.villaIntro(), 700);
      this.me.setLook(this.save.villa.look ?? { ...this.save.look, outfit: 'fit_villa' });
    } else {
      this.me.setLook(this.save.look);
    }
    if (z === 'park') this.buildParkedCars();
    this.buildMarkers();
    this.fun.onZone();
    this.net.send({ t: 'zone', zone: z });
    this.renderHud();
    this.ready = true;
  }

  private markerSig = '';

  private buildMarkers(): void {
    if (!this.zone) return;
    const sig = `${this.zoneId}|${Object.keys(this.save.tasks).join()}|${this.save.totalAura >= 7000}|${zoneUnlocked(this.save, this.zoneId)}`;
    if (sig === this.markerSig && this.markers.length) return;
    this.markerSig = sig;
    for (const m of this.markers) {
      m.prop.obj.removeFromParent();
      m.prop.obj.traverse((o) => { const sp = o as THREE.Sprite; if (sp.isSprite) sp.material.dispose(); });
    }
    this.markers = [];
    const s = this.save;
    for (const st of this.zone.stations) {
      let emoji = '⭐', color = '#ff6f91', key: string = st.kind;
      if (st.kind === 'task') {
        key = `${this.zoneId}:${st.id}`;
        emoji = TASK_EMOJI[st.id!] ?? '⭐';
        if (s.tasks[key]) color = '#6fd38a';
        else if (!zoneUnlocked(s, this.zoneId)) color = '#9a9aa5';
      } else if (st.kind === 'garage') { emoji = '🚗'; color = '#4fd1c5'; }
      else if (st.kind === 'carwash') { emoji = '🫧'; color = '#7fd8ff'; }
      else if (st.kind === 'cabana') { emoji = '⭐'; color = '#ffc93c'; }
      else if (st.kind === 'villa') { emoji = VILLA_EMOJI[st.id!] ?? '💘'; color = '#ff4fa3'; key = `villa:${st.id}`; }
      else if (st.kind === 'firepit') { emoji = '🔥'; color = '#ff8a3a'; }
      else if (st.kind === 'dress') { emoji = '🌺'; color = '#ff6f91'; }
      else if (st.kind === 'beachhut') { emoji = '🎥'; color = '#ff4fa3'; }
      else if (st.kind === 'hideaway') { emoji = '🌌'; color = '#c77dff'; }
      else if (st.kind === 'adopt') { emoji = '🐾'; color = '#ff9a6f'; }
      else if (st.kind === 'race') { emoji = '🏁'; color = '#ffd23f'; }
      else if (st.kind === 'slide') { emoji = '🌊'; color = '#33c4ff'; }
      else if (st.kind === 'portal') {
        emoji = this.zoneId === 'villa' ? '🏰' : '💘';
        color = this.zoneId === 'villa' || zoneUnlocked(s, 'villa') ? '#ff4fa3' : '#9a9aa5';
      }
      const p = stationMarker(emoji, color);
      p.obj.position.set(st.wx, 0, st.wz);
      this.zone.root.add(p.obj);
      this.markers.push({ prop: p, key });
    }
  }

  private buildParkedCars(): void {
    if (!this.zone) return;
    const cars = SHOP.filter((i) => i.cat === 'car' && this.save.inventory[i.id]);
    const g = new THREE.Group();
    cars.forEach((c, i) => {
      const m = buildCar(String(c.r.model), this.save.carPaint[c.id] ?? String(c.r.color));
      m.obj.position.set(-this.zone!.half.w + 3.2 + i * 2.8 + 1.2, 0, -this.zone!.half.d + 2.8);
      if (c.r.model === 'limo') m.obj.position.z += 1.2;
      g.add(m.obj);
      this.zone!.colliders.push({ x0: m.obj.position.x - 0.95, z0: m.obj.position.z - m.length / 2, x1: m.obj.position.x + 0.95, z1: m.obj.position.z + m.length / 2 });
    });
    g.name = 'parked';
    this.zone.root.add(g);
  }

  // ================================================================== network

  private onMsg(m: ServerMsg): void {
    switch (m.t) {
      case 'save': {
        const prevLook = JSON.stringify(this.save.look), prevVilla = JSON.stringify(this.save.villa.look);
        const prevCars = Object.keys(this.save.inventory).filter((k) => k.startsWith('car_')).join() + JSON.stringify(this.save.carPaint);
        const prevVip = this.save.vip;
        this.save = m.save;
        if (!this.previewing) {
          if (this.zoneId === 'villa' && prevVilla !== JSON.stringify(m.save.villa.look) && m.save.villa.look) this.me.setLook(m.save.villa.look);
          else if (this.zoneId !== 'villa' && prevLook !== JSON.stringify(m.save.look)) this.me.setLook(m.save.look);
        }
        if (prevVip !== m.save.vip) this.me.setName(m.save.name, m.save.vip, this.partnerSub());
        if (this.zoneId === 'park' && prevCars !== Object.keys(m.save.inventory).filter((k) => k.startsWith('car_')).join() + JSON.stringify(m.save.carPaint)) {
          this.zone?.root.getObjectByName('parked')?.removeFromParent();
          this.buildParkedCars();
        }
        this.buildMarkers();
        if (this.zoneId === 'villa') this.syncCast(true);
        this.renderHud();
        this.saveListeners.forEach((f) => f());
        this.fun.onSave();
        return;
      }
      case 'spun': this.fun.onSpun(m.index, m.msg); return;
      case 'laps': if (this.wantLaps) { this.wantLaps = false; this.fun.openRace(m.rows); } return;
      case 'fireworks': this.fun.onFireworks(m.x, m.z, m.from); return;
      case 'party': this.fun.onParty(m.until, m.by); return;
      case 'tag': this.fun.onTag(m.it, m.until); return;
      case 'tagEnd': this.fun.onTagEnd(m.it, m.winners); return;
      case 'toast': toast(m.text, m.good); if (m.good && m.text.includes('unlocked')) confetti(); return;
      case 'peers': {
        for (const p of this.peers.values()) p.avatar.dispose();
        this.peers.clear();
        for (const info of m.list) this.addPeer(info);
        return;
      }
      case 'peer': {
        if (info2zone(m.info) !== this.zoneId) return;
        const p = this.peers.get(m.info.name);
        if (!p) { this.addPeer(m.info); return; }
        if (JSON.stringify(p.info.look) !== JSON.stringify(m.info.look)) p.avatar.setLook(m.info.look);
        if (p.info.vip !== m.info.vip || p.info.partner !== m.info.partner) p.avatar.setName(m.info.name, m.info.vip, m.info.partner && this.zoneId === 'villa' ? `💘 ${m.info.partner.replace(/^npc:/, '')}` : undefined);
        p.info = m.info;
        this.setPeerCar(p);
        return;
      }
      case 'gone': {
        const p = this.peers.get(m.name);
        if (p) { p.avatar.dispose(); p.car?.obj.removeFromParent(); this.peers.delete(m.name); }
        return;
      }
      case 'pos': {
        const p = this.peers.get(m.p.name);
        if (!p) return;
        p.tx = m.p.x; p.tz = m.p.z; p.try = m.p.ry; p.a = m.p.a;
        return;
      }
      case 'chat': {
        const av = m.from === this.save.name ? this.me : this.peers.get(m.from)?.avatar;
        av?.say(m.text);
        this.chatLine(m.from, m.text);
        return;
      }
      case 'emote': {
        const av = m.from === this.save.name ? this.me : this.peers.get(m.from)?.avatar;
        av?.doEmote(m.e as Emote);
        return;
      }
      case 'room': this.buildDecor(m.owner, m.items); return;
      case 'board': this.boardListeners.forEach((f) => f(m.rows)); return;
      case 'accounts': this.accountListeners.forEach((f) => f(m.rows)); return;
      case 'world': {
        setResidences(m.residences);
        if (this.zoneId.startsWith('r')) toast('🏠 Someone new moved into the mansion!');
        this.saveListeners.forEach((f) => f());
        return;
      }
      case 'role': {
        this.admin = m.admin;
        this.ctx.admin = m.admin;
        this.pending = m.pending;
        this.renderBadge();
        return;
      }
      case 'scene': showScene(m.scene, (choice) => this.seasonAct({ a: 'answer', choice }), this.save.villa.season); return;
      case 'coupleAsk': this.coupleAsk(m.from); return;
      case 'ceremony': this.ceremony(m.endsAt, m.options); return;
      case 'ceremonyResult': {
        closeAllSheets();
        sheet('🔥 Recoupling Results', h('div.results', {}, ...m.lines.map((l) => h('p', {}, l))));
        if (m.lines.some((l) => l.includes(this.save.name) && l.startsWith('💘'))) confetti(60);
        return;
      }
      case 'final': {
        confetti(160);
        sheet('🏆 Love Island Final', h('div.final', {}, h('div.big', {}, '👑'), h('h3', {}, `${m.winner}${m.partner ? ` & ${m.partner}` : ''} won Love Island!`), h('p', {}, 'The villa points reset — a new season begins!')));
        return;
      }
      default: return;
    }
  }

  private partnerSub(): string | undefined {
    return this.zoneId === 'villa' && this.save.villa.partner ? `💘 ${this.save.villa.partner.replace(/^npc:/, '')}` : undefined;
  }

  private addPeer(info: PeerInfo): void {
    if (!this.zone || info.name === this.save.name) return;
    const av = new Avatar(info.look, info.name, info.vip, info.partner && this.zoneId === 'villa' ? `💘 ${info.partner.replace(/^npc:/, '')}` : undefined);
    this.zone.root.add(av.root);
    const p: Peer = { info, avatar: av, x: 0, z: 0, ry: 0, tx: 0, tz: 0, try: 0, a: 0, car: null, carKey: '' };
    p.x = p.tx = this.zone.spawn.x; p.z = p.tz = this.zone.spawn.z;
    this.peers.set(info.name, p);
    this.setPeerCar(p);
  }

  private setPeerCar(p: Peer): void {
    const key = p.info.car ? `${p.info.car.id}|${p.info.car.paint}` : '';
    if (key === p.carKey) return;
    p.carKey = key;
    p.car?.obj.removeFromParent();
    p.car = null;
    if (p.info.car && this.zone) {
      const item = shopItem(p.info.car.id);
      p.car = buildCar(String(item?.r.model ?? 'hatch'), p.info.car.paint);
      this.zone.root.add(p.car.obj);
    }
  }

  // ================================================================== main loop

  private loop = (): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;
    if (!this.zone || !this.ready) return;
    const t = this.elapsed;
    this.updatePlayer(dt, t);
    this.updatePeers(dt, t);
    updateWanderers(this.wanderers, this.zone, dt, t);
    for (const f of this.ticks) f(t, dt);
    for (const m of this.markers) m.prop.tick?.(t, dt);
    this.updatePickups(t);
    this.updateCamera(dt);
    this.updateWalls(dt);
    this.updateDecorGhost();
    this.updateActions();
    this.sendPos(t);
    this.villaTexts(dt);
    this.fun.update(dt, t);
    tickWater(t);
    if (this.noRender && !this.wantPhoto) return;
    this.gfx.render();
    if (this.wantPhoto) {
      const cb = this.wantPhoto;
      this.wantPhoto = null;
      cb(this.gfx.renderer.domElement.toDataURL('image/jpeg', 0.92));
    }
  };

  private blocked(): boolean {
    return !!document.querySelector('#modals .modal:not(.side)');
  }

  private updatePlayer(dt: number, t: number): void {
    const zone = this.zone!;
    const mv = this.blocked() || this.lockMove ? { x: 0, y: 0 } : this.input.move();
    if (this.car) { this.updateCar(dt, mv); return; }
    if (this.lockMove) return;
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
    const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
    const dx = rx * mv.x + fx * mv.y, dz = rz * mv.x + fz * mv.y;
    const inPool = zone.pools.some((p) => this.pos.x > p.x0 && this.pos.x < p.x1 && this.pos.y > p.z0 && this.pos.y < p.z1);
    const inTub = zone.tubs.some((tb) => Math.hypot(this.pos.x - tb.x, this.pos.y - tb.z) < tb.r - 0.1);
    const speed = inPool ? SWIM_SPEED : SPEED;
    const k = Math.min(1, dt * 12);
    this.vel.x += (dx * speed - this.vel.x) * k;
    this.vel.y += (dz * speed - this.vel.y) * k;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.collide(RADIUS);
    const sp = this.vel.length();
    if (sp > 0.3) {
      const want = Math.atan2(this.vel.x, this.vel.y);
      let diff = want - this.ry;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.ry += diff * Math.min(1, dt * 12);
    }
    this.mode = inPool ? 'swim' : inTub ? 'soak' : 'walk';
    if (inPool || inTub) {
      this.swimAcc += dt;
      if (this.swimAcc >= 10) { this.net.send({ t: 'stat', stat: 'swim', by: 10 }); this.swimAcc = 0; }
    }
    if (this.previewing) {
      // Face the camera while trying on clothes.
      this.ry = this.camYaw;
    }
    this.me.root.position.set(this.pos.x, inTub ? 0.15 : 0, this.pos.y);
    this.me.root.rotation.y = this.ry;
    this.me.update(dt, t, Math.min(1, sp / SPEED), this.mode);
  }

  private collide(r: number): boolean {
    const zone = this.zone!;
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of zone.colliders) {
        const nx = Math.max(c.x0, Math.min(this.pos.x, c.x1));
        const nz = Math.max(c.z0, Math.min(this.pos.y, c.z1));
        const dx = this.pos.x - nx, dz = this.pos.y - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          this.pos.x += (dx / d) * (r - d);
          this.pos.y += (dz / d) * (r - d);
        } else {
          const pl = this.pos.x - c.x0, pr = c.x1 - this.pos.x, pt = this.pos.y - c.z0, pb = c.z1 - this.pos.y;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) this.pos.x = c.x0 - r; else if (m === pr) this.pos.x = c.x1 + r; else if (m === pt) this.pos.y = c.z0 - r; else this.pos.y = c.z1 + r;
        }
      }
    }
    this.pos.x = Math.max(-zone.half.w + r, Math.min(zone.half.w - r, this.pos.x));
    this.pos.y = Math.max(-zone.half.d + r, Math.min(zone.half.d - r, this.pos.y));
    return hit;
  }

  private updateCar(dt: number, mv: { x: number; y: number }): void {
    const c = this.car!;
    c.drive.update(dt, mv.y, -mv.x, this.input.keys.has('shift'));
    c.heading += c.drive.steer * dt * 2.2 * Math.max(-1, Math.min(1, c.drive.speed / 6));
    this.pos.x = c.x + Math.sin(c.heading) * c.drive.speed * dt;
    this.pos.y = c.z + Math.cos(c.heading) * c.drive.speed * dt;
    const kart = c.model.length < 2;
    if (this.collide(kart ? 0.55 : 1.0)) c.drive.speed *= 0.6;
    // Cars don't drive into pools.
    for (const p of this.zone!.pools) {
      if (this.pos.x > p.x0 - 0.4 && this.pos.x < p.x1 + 0.4 && this.pos.y > p.z0 - 0.4 && this.pos.y < p.z1 + 0.4) { this.pos.set(c.x, c.z); c.drive.speed *= -0.3; }
    }
    c.x = this.pos.x; c.z = this.pos.y;
    c.model.obj.position.set(c.x, 0, c.z);
    c.model.obj.rotation.y = c.heading;
    for (const w of c.model.wheels) w.rotation.x += (c.drive.speed * dt) / 0.34;
    for (const f of c.model.front) f.rotation.y = c.drive.steer * 0.45;
    this.ry = c.heading;
    const side = kart ? 0 : -0.38, back = kart ? -0.12 : 0;
    this.me.root.position.set(c.x + Math.cos(c.heading) * side + Math.sin(c.heading) * back, c.model.seat - 0.55, c.z - Math.sin(c.heading) * side + Math.cos(c.heading) * back);
    this.me.root.rotation.y = c.heading;
    this.me.update(dt, this.elapsed, 0, 'drive');
    // Camera swings behind the car while moving.
    if (Math.abs(c.drive.speed) > 2) {
      const want = c.heading + Math.PI;
      let diff = want - this.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.camYaw += diff * Math.min(1, dt * 1.5);
    }
    this.driveAcc += dt;
    if (this.driveAcc >= 10) { this.net.send({ t: 'stat', stat: 'drive', by: 10 }); this.driveAcc = 0; }
  }

  private updatePeers(dt: number, t: number): void {
    const k = Math.min(1, dt * 10);
    for (const p of this.peers.values()) {
      const dx = p.tx - p.x, dz = p.tz - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 8) { p.x = p.tx; p.z = p.tz; } else { p.x += dx * k; p.z += dz * k; }
      let diff = p.try - p.ry;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.ry += diff * k;
      const mode: Mode = p.a === 2 ? 'swim' : p.a === 3 ? 'drive' : p.a === 4 ? 'soak' : 'walk';
      if (p.car && mode === 'drive') {
        p.car.obj.visible = true;
        p.car.obj.position.set(p.x, 0, p.z);
        p.car.obj.rotation.y = p.ry;
        const side = p.car.length < 2 ? 0 : -0.38;
        p.avatar.root.position.set(p.x + Math.cos(p.ry) * side, p.car.seat - 0.55, p.z - Math.sin(p.ry) * side);
      } else {
        if (p.car) p.car.obj.visible = false;
        p.avatar.root.position.set(p.x, mode === 'soak' ? 0.15 : 0, p.z);
      }
      p.avatar.root.rotation.y = p.ry;
      p.avatar.update(dt, t, p.a === 1 ? Math.min(1, dist * 3 + 0.5) : 0, mode);
    }
  }

  private updateCamera(dt: number): void {
    const o = this.input.takeOrbit();
    this.camYaw -= o.dx * 0.006;
    this.camPitch = Math.max(0.3, Math.min(1.3, this.camPitch + o.dy * 0.004));
    const minD = 3.5, maxD = this.zone?.layout.exterior === 'none' ? 30 : 22;
    this.camDist = Math.max(minD, Math.min(maxD, this.camDist + o.zoom));
    const dist = this.previewing ? 4.2 : this.car ? Math.max(this.camDist, 12) : this.camDist;
    const pitch = this.previewing ? 0.25 : this.camPitch;
    const target = new THREE.Vector3(this.pos.x, this.previewing ? 1.1 : this.mode === 'swim' ? 0.4 : 1.2, this.pos.y);
    this.camTarget.lerp(target, Math.min(1, dt * 8));
    const cam = this.gfx.camera;
    const want = new THREE.Vector3(
      this.camTarget.x + Math.sin(this.camYaw) * Math.cos(pitch) * dist,
      this.camTarget.y + Math.sin(pitch) * dist,
      this.camTarget.z + Math.cos(this.camYaw) * Math.cos(pitch) * dist,
    );
    cam.position.lerp(want, Math.min(1, dt * 10));
    cam.lookAt(this.camTarget);
  }

  private updateWalls(dt: number): void {
    const zone = this.zone!;
    const cam = this.gfx.camera.position;
    const px = this.pos.x, pz = this.pos.y;
    const headY = 1.0;
    for (const w of zone.walls) {
      let target = 1;
      if (this.wallMode === 'low') target = 0.14;
      else {
        const t = segT(px, pz, cam.x, cam.z, w.ax, w.az, w.bx, w.bz);
        if (t !== null) {
          const y = headY + t * (cam.y - headY);
          if (y < 5) target = 0.14;
        }
        // Also lower walls hugging the player on the camera side.
        if (target === 1 && distToSeg(px, pz, w.ax, w.az, w.bx, w.bz) < 1.1) {
          const mx = (w.ax + w.bx) / 2 - px, mz = (w.az + w.bz) / 2 - pz;
          if (mx * (cam.x - px) + mz * (cam.z - pz) > 0) target = 0.14;
        }
      }
      const cur = w.mesh.scale.y;
      if (Math.abs(cur - target) > 0.001) w.mesh.scale.y = cur + (target - cur) * Math.min(1, dt * 9);
    }
  }

  private sendPos(t: number): void {
    const a = this.car ? 3 : this.mode === 'swim' ? 2 : this.mode === 'soak' ? 4 : this.vel.length() > 0.4 ? 1 : 0;
    const L = this.lastSent;
    if (t - L.t < 0.1) return;
    if (Math.abs(L.x - this.pos.x) < 0.02 && Math.abs(L.z - this.pos.y) < 0.02 && Math.abs(L.ry - this.ry) < 0.05 && L.a === a && t - L.t < 2) return;
    this.lastSent = { x: this.pos.x, z: this.pos.y, ry: this.ry, a, t };
    this.net.send({ t: 'pos', x: this.pos.x, z: this.pos.y, ry: this.ry, a });
  }

  // ================================================================== interactions

  private updateActions(): void {
    if (!this.zone) return;
    const acts: Action[] = [];
    const near = (x: number, z: number, r: number) => Math.hypot(this.pos.x - x, this.pos.y - z) < r;
    if (this.car) {
      acts.push({ key: 'exitcar', label: '🚪 Get out', run: () => this.stopDriving(true) });
    } else if (this.decor) {
      // decor dock handles its own buttons
    } else {
      let best: { d: number; a: Action } | null = null;
      const consider = (d: number, a: Action) => { if (!best || d < best.d) best = { d, a }; };
      for (const st of this.zone.stations) {
        const d = Math.hypot(this.pos.x - st.wx, this.pos.y - st.wz);
        if (d > 1.7) continue;
        consider(d, this.stationAction(st));
      }
      const lx = this.zone.lift.x + Math.sin(this.zone.lift.rot) * 0.6, lz = this.zone.lift.z + Math.cos(this.zone.lift.rot) * 0.6;
      if (this.zoneId !== 'villa' && near(lx, lz, 2.2)) consider(Math.hypot(this.pos.x - lx, this.pos.y - lz), { key: 'lift', label: '🛗 Take the lift', run: () => openMap(this.ctx) });
      for (const w of this.wanderers) {
        const d = Math.hypot(this.pos.x - w.x, this.pos.y - w.z);
        if (d > 1.8) continue;
        if (w.kind === 'pet') consider(d, { key: `pat:${w.name}`, label: `🐾 Pat ${w.name}`, run: () => this.pat(w) });
        else if (w.kind === 'host') consider(d, { key: 'host', label: '🎤 Talk to Jazz (host)', run: () => this.hostMenu() });
        else consider(d, { key: `talk:${w.name}`, label: `💬 Chat with ${w.name}`, run: () => this.talkIslander(w) });
      }
      if (this.zoneId === 'villa') {
        for (const p of this.peers.values()) {
          const d = Math.hypot(this.pos.x - p.x, this.pos.y - p.z);
          if (d < 2 && this.save.villa.partner !== p.info.name) consider(d, { key: `couple:${p.info.name}`, label: `💘 Couple up with ${p.info.name}?`, run: () => this.net.send({ t: 'couple', to: p.info.name }) });
        }
      }
      if (best) acts.push((best as { a: Action }).a);
      if (this.zoneId === 'park') acts.push({ key: 'drive', label: '🚗 Drive', run: () => this.startDriving() });
      const home = this.save.home;
      if (home && home.zone === this.zoneId) {
        const b = roomBox(this.zone, home.room);
        if (b && this.pos.x > b.x0 && this.pos.x < b.x1 && this.pos.y > b.z0 && this.pos.y < b.z1) acts.push({ key: 'decor', label: '🖼️ Decorate my room', run: () => this.startDecor() });
      }
    }
    const key = acts.map((a) => a.key + a.label).join('|');
    this.actions = acts;
    if (key === this.actionKey) return;
    this.actionKey = key;
    const host = $('#actions');
    fill(host, ...acts.map((a, i) => h('button.act' + (i === 0 ? '.primary' : ''), { onclick: () => this.actions.find((x) => x.key === a.key)?.run() }, a.label, i === 0 ? h('kbd', {}, 'E') : null)));
  }

  private stationAction(st: Zone['stations'][number]): Action {
    const s = this.save;
    switch (st.kind) {
      case 'task': {
        const task = floorById(this.zoneId)?.tasks.find((t) => t.id === st.id)!;
        const done = s.tasks[`${this.zoneId}:${task.id}`];
        return { key: `task:${task.id}`, label: `${TASK_EMOJI[task.id] ?? '⭐'} ${task.label}${done ? ' (replay +50)' : ' +200'}`, run: () => this.startTask(task) };
      }
      case 'garage': return { key: 'garage', label: '🚗 Garage', run: () => openGarage(this.ctx, () => this.startDriving()) };
      case 'carwash': return { key: 'carwash', label: '🫧 Wash your car', run: () => holdGame('Car Wash', 'Hold to scrub your car until it gleams!', (ok) => { if (ok) toast('✨ Sparkling clean!', true); }) };
      case 'cabana': return { key: 'cabana', label: s.vip ? '⭐ Relax in the VIP Cabana' : '⭐ VIP Cabana (VIP only)', run: () => this.cabana() };
      case 'villa': {
        const c = VILLA_CHALLENGES.find((v) => v.id === st.id)!;
        return { key: `villa:${c.id}`, label: `${VILLA_EMOJI[c.id]} ${c.label}`, run: () => this.villaChallenge(c.id) };
      }
      case 'firepit': return { key: 'firepit', label: '🔥 The Firepit', run: () => this.firepit() };
      case 'beachhut': return { key: 'beachhut', label: '🎥 Sit in the Beach Hut', run: () => this.seasonAct({ a: 'hut' }) };
      case 'hideaway': return { key: 'hideaway', label: '🌌 The Hideaway', run: () => this.hideaway() };
      case 'adopt': return { key: 'adopt', label: s.pet ? `🐾 Swap or rename ${s.pet.name}` : '🐾 Adopt a pet', run: () => openAdopt(s.pet, (kind, name) => this.net.send({ t: 'pet', kind, name })) };
      case 'race': return { key: 'race', label: '🏁 Kart race', run: () => { this.wantLaps = true; this.net.send({ t: 'laps' }); } };
      case 'slide': return { key: 'slide', label: '🌊 Go down the water slide!', run: () => this.fun.startSlide() };
      case 'dress': return { key: 'dress', label: '🌺 Villa dressing room', run: () => openWardrobe(this.ctx, { villa: true }) };
      case 'portal':
        if (this.zoneId === 'villa') return { key: 'portal', label: '🏰 Back to the mansion', run: () => this.travel('f8') };
        return { key: 'portal', label: zoneUnlocked(s, 'villa') ? '💘 Go to Love Island!' : '💘 Love Island (locked)', run: () => this.travel('villa') };
    }
  }

  private onKey(k: string): void {
    if (k === 'escape') { closeAllSheets(); if (this.decor) this.endDecor(); return; }
    if (document.querySelector('#modals .modal')) return;
    if (k === 'e' || k === ' ') { this.actions[0]?.run(); return; }
    if (k === 'enter') { ($('#chatin') as HTMLInputElement).focus(); return; }
    if (k === 'm') openMap(this.ctx);
    if (k === 'b') openShop(this.ctx);
    if (k === 'f') this.openFunMenu();
    if (k === 'r' && this.decor) this.decor.rot += Math.PI / 4;
    const emo: Emote[] = ['wave', 'dance', 'heart', 'sit', 'pose'];
    const n = Number(k);
    if (n >= 1 && n <= 5) this.emote(emo[n - 1]);
  }

  emote(e: Emote): void {
    this.me.doEmote(e);
    this.net.send({ t: 'emote', e });
  }

  // ================================================================== tasks

  private startTask(task: TaskDef): void {
    if (!zoneUnlocked(this.save, this.zoneId)) { toast(`Earn more Aura to unlock tasks on this floor. This is your home, so you can still visit!`); return; }
    const z = this.zoneId;
    const finish = (ok: boolean) => { if (ok) this.net.send({ t: 'task', zone: z, task: task.id }); };
    switch (task.kind) {
      case 'sequence': sequenceGame(task.label, task.hint, task.steps!, finish); break;
      case 'hold': holdGame(task.label, task.hint, finish); break;
      case 'timing': timingGame(task.label, task.hint, finish); break;
      case 'simon': simonGame(task.label, task.hint, finish); break;
      case 'choice': choiceGame(task.label, task.hint, task.question!, finish); break;
      case 'collect': this.startCollect(task.label, task.count ?? 5, task.item ?? '⭐', () => finish(true)); break;
      case 'outfit': openWardrobe(this.ctx, { onSaved: () => finish(true) }); toast('Put together a look, then save it!'); break;
      case 'decorate': {
        const need = task.count ?? 1;
        if (this.save.room.length >= need) finish(true);
        else {
          const home = this.save.home;
          sheet(task.label, h('div.mg', {}, h('p', {}, task.hint), h('p.muted', {}, `You have ${this.save.room.length} placed. Go to your bedroom on ${home ? zoneName(home.zone) : 'your floor'} and press “Decorate my room”.`),
            h('div.actions', {}, home ? h('button.btn', { onclick: () => { closeAllSheets(); this.travel(home.zone); } }, '🛗 Take me home') : null)));
        }
        break;
      }
      case 'photo': this.photo(() => finish(true)); break;
    }
  }

  private villaChallenge(id: string): void {
    const c = VILLA_CHALLENGES.find((v) => v.id === id)!;
    const finish = (ok: boolean) => { if (ok) this.net.send({ t: 'villa', challenge: id }); };
    if (c.kind === 'simon') simonGame(c.label, c.hint, finish);
    else if (c.kind === 'timing') timingGame(c.label, c.hint, finish);
    else if (c.kind === 'choice') choiceGame(c.label, c.hint, [...c.question!].sort(() => Math.random() - 0.5).slice(0, 3), finish);
    else this.startCollect(c.label, c.count ?? 6, c.item ?? '🥥', () => finish(true));
  }

  private startCollect(label: string, n: number, emoji: string, done: () => void): void {
    this.cancelCollect();
    const zone = this.zone!;
    for (let i = 0; i < n; i++) {
      let x = 0, z = 0;
      for (let k = 0; k < 80; k++) {
        x = (Math.random() - 0.5) * zone.half.w * 1.9; z = (Math.random() - 0.5) * zone.half.d * 1.9;
        if (zone.walkable(x, z, 0.5) && Math.hypot(x - this.pos.x, z - this.pos.y) > 3) break;
      }
      const s = sprite(emojiTexture(emoji), 0.75);
      const glowS = sprite(glowTexture(), 1.4, 0xfff2a8, true);
      glowS.position.y = -0.1;
      s.add(glowS);
      s.position.set(x, 0.9, z);
      zone.root.add(s);
      this.pickups.push({ s, x, z });
    }
    this.collect = { label, total: n, got: 0, done };
    toast(`${emoji} Find all ${n}! Follow the glowing icons.`);
    this.renderCollect();
  }

  private updatePickups(t: number): void {
    if (!this.collect) return;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.s.position.y = 0.9 + Math.sin(t * 3 + i) * 0.15;
      if (Math.hypot(this.pos.x - p.x, this.pos.y - p.z) < 1.0) {
        p.s.removeFromParent();
        this.pickups.splice(i, 1);
        const c = this.collect;
        if (!c) return;
        c.got++;
        this.renderCollect();
        if (this.pickups.length === 0) {
          const done = c.done;
          this.collect = null;
          this.renderCollect();
          confetti(30);
          done();
        }
      }
    }
  }

  private renderCollect(): void {
    const el = $('#collect');
    if (!this.collect) { el.classList.remove('on'); return; }
    el.classList.add('on');
    fill(el, h('b', {}, this.collect.label), h('span', {}, ` ${this.collect.got}/${this.collect.total}`), h('button.mini', { onclick: () => this.cancelCollect() }, 'Quit'));
  }

  private cancelCollect(): void {
    for (const p of this.pickups) p.s.removeFromParent();
    this.pickups = [];
    this.collect = null;
    this.renderCollect();
  }

  private photo(done: () => void): void {
    document.body.classList.add('photo-mode');
    this.emote('pose');
    const flash = $('#flash');
    setTimeout(() => {
      this.wantPhoto = (url) => {
        flash.classList.add('on');
        setTimeout(() => flash.classList.remove('on'), 300);
        document.body.classList.remove('photo-mode');
        sheet('📸 Your photo', h('div.photo', {}, h('img', { src: url, alt: 'Your photo' }),
          h('div.actions', {}, h('a.btn', { href: url, download: 'maggakes-estate.jpg' }, '💾 Save photo'))));
        done();
      };
    }, 1300);
  }

  private pat(w: Wanderer): void {
    const heart = sprite(emojiTexture('💖'), 0.5);
    heart.position.set(w.x, 1.1, w.z);
    this.zone!.root.add(heart);
    const start = this.elapsed;
    const tick = (t: number) => { heart.position.y = 1.1 + (t - start) * 0.8; if (t - start > 1.2) { heart.removeFromParent(); this.ticks.splice(this.ticks.indexOf(tick), 1); } };
    this.ticks.push(tick);
    w.wait = 2;
    this.net.send({ t: 'stat', stat: 'pats', by: 1 });
    toast(`${w.name} loves you! 🐾`);
  }

  private cabana(): void {
    if (!this.save.vip) { toast('⭐ The cabana is VIP only. Ask Beau, Milla or Keola for VIP!'); return; }
    this.emote('sit');
    this.net.send({ t: 'stat', stat: 'cabana', by: 1 });
    toast('⭐ Relaxing in the VIP cabana… check your daily challenges!', true);
  }

  // ================================================================== cars

  /** Big cars in the car park; the mini kart anywhere. */
  private startDriving(kind: 'auto' | 'kart' = 'auto'): void {
    if (this.car || !this.zone) return;
    const useKart = kind === 'kart' || this.zoneId !== 'park';
    const item = useKart ? shopItem('car_kart')! : shopItem(this.save.car) ?? shopItem('car_hatch')!;
    const paint = this.save.carPaint[item.id] ?? String(item.r.color);
    const model = buildCar(String(item.r.model), paint);
    this.zone.root.add(model.obj);
    let x = this.pos.x, z = this.pos.y;
    const r = useKart ? 0.6 : 1.1;
    for (let i = 0; i < 40 && !this.zone.walkable(x, z, r); i++) { x = this.pos.x + (Math.random() - 0.5) * i * 0.6; z = this.pos.y + (Math.random() - 0.5) * i * 0.6; }
    this.car = { model, drive: new Driving(useKart ? 8 : 14), x, z, heading: this.ry };
    this.pos.set(x, z);
    this.net.send({ t: 'car', car: item.id });
    toast(`${useKart ? '🏎️' : '🚗'} W/S or joystick to drive, A/D to steer, Shift to boost`);
  }

  isDriving(): boolean { return !!this.car; }

  startKart(): void { if (this.car) this.stopDriving(true); else this.startDriving('kart'); }

  /** Puts you in a kart (or your current car) at a spot, e.g. the race start line. */
  placeCar(x: number, z: number, heading: number): void {
    if (this.car) this.stopDriving(true);
    this.pos.set(x, z);
    this.ry = heading;
    this.startDriving(this.zoneId === 'park' ? 'auto' : 'kart');
    if (this.car) { this.car.x = x; this.car.z = z; this.car.heading = heading; this.pos.set(x, z); this.camYaw = heading + Math.PI; }
  }

  stopDriving(announce = true): void {
    if (!this.car) return;
    this.car.model.obj.removeFromParent();
    const c = this.car;
    this.car = null;
    this.pos.set(c.x + Math.cos(c.heading) * -1.6, c.z - Math.sin(c.heading) * -1.6);
    if (this.zone) this.collide(RADIUS);
    if (announce) this.net.send({ t: 'car', car: null });
  }

  // ================================================================== decorating

  private buildDecor(owner: string, items: PlacedItem[]): void {
    if (!this.zone) return;
    // The server only sends decorations for bedrooms on the floor you're on.
    if (!this.zone) return;
    this.decorGroups.get(owner)?.removeFromParent();
    const g = new THREE.Group();
    for (const it of items) {
      const shop = shopItem(it.item);
      if (!shop) continue;
      const p = makeProp(String(shop.r.model), shop.r);
      p.obj.position.set(it.x, 0, it.z);
      p.obj.rotation.y = it.rot;
      if (p.tick) this.ticks.push(p.tick);
      g.add(p.obj);
    }
    this.zone.root.add(g);
    this.decorGroups.set(owner, g);
    if (owner === this.save.name && this.decor) this.decor.items = items.map((i) => ({ ...i }));
  }

  private startDecor(): void {
    const res = this.save.home!;
    const box = roomBox(this.zone!, res.room)!;
    this.decor = { items: this.save.room.map((i) => ({ ...i })), pick: null, ghost: null, rot: this.ry + Math.PI, box };
    this.camDist = Math.max(this.camDist, 12);
    this.renderDecorDock();
  }

  private endDecor(): void {
    if (!this.decor) return;
    this.decor.ghost?.removeFromParent();
    this.decor = null;
    $('#decor').classList.remove('on');
    this.actionKey = '';
  }

  private renderDecorDock(): void {
    const d = this.decor;
    const el = $('#decor');
    if (!d) { el.classList.remove('on'); return; }
    el.classList.add('on');
    const furniture = SHOP.filter((i) => i.cat === 'furniture' && (this.save.inventory[i.id] ?? 0) > 0);
    const left = (id: string) => (this.save.inventory[id] ?? 0) - d.items.filter((x) => x.item === id).length;
    fill(el, 
      h('div.decor-items', {}, ...furniture.map((i) => h('button.chip' + (d.pick === i.id ? '.on' : ''), {
        disabled: left(i.id) <= 0, onclick: () => this.pickDecor(i.id),
      }, `${i.emoji} ${i.name} ×${left(i.id)}`)),
      furniture.length ? null : h('span.muted', {}, 'Buy furniture in the shop first!')),
      h('div.decor-btns', {},
        h('button.btn', { disabled: !d.pick, onclick: () => { if (this.decor) { this.decor.rot += Math.PI / 4; } } }, '⟳ Rotate'),
        h('button.btn', { disabled: !d.pick, onclick: () => this.placeDecor() }, '✓ Place'),
        h('button.btn.ghost', { onclick: () => this.pickUpDecor() }, '↩ Pick up nearest'),
        h('button.btn.ghost', { onclick: () => this.endDecor() }, 'Done')),
      h('small.muted', {}, `Walk to aim. ${d.items.length}/${ROOM_LIMIT} items placed.`),
    );
  }

  private pickDecor(id: string): void {
    const d = this.decor!;
    d.ghost?.removeFromParent();
    d.pick = id;
    const it = shopItem(id)!;
    const p = makeProp(String(it.r.model), it.r);
    p.obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { const mm = (m.material as THREE.Material).clone(); mm.transparent = true; (mm as THREE.MeshStandardMaterial).opacity = 0.6; m.material = mm; m.castShadow = false; }
    });
    d.ghost = p.obj;
    this.zone!.root.add(p.obj);
    this.renderDecorDock();
  }

  private ghostSpot(): { x: number; z: number } {
    const d = this.decor!;
    const m = 0.45;
    return {
      x: Math.max(d.box.x0 + m, Math.min(d.box.x1 - m, this.pos.x + Math.sin(this.ry) * 1.6)),
      z: Math.max(d.box.z0 + m, Math.min(d.box.z1 - m, this.pos.y + Math.cos(this.ry) * 1.6)),
    };
  }

  private updateDecorGhost(): void {
    const d = this.decor;
    if (!d?.ghost) return;
    const s = this.ghostSpot();
    d.ghost.position.set(s.x, 0, s.z);
    d.ghost.rotation.y = d.rot;
  }

  private placeDecor(): void {
    const d = this.decor!;
    if (!d.pick) return;
    if (d.items.length >= ROOM_LIMIT) { toast('Your room is full!'); return; }
    const s = this.ghostSpot();
    d.items.push({ uid: Math.random().toString(36).slice(2, 10), item: d.pick, x: s.x, z: s.z, rot: d.rot });
    this.net.send({ t: 'room', items: d.items });
    const id = d.pick;
    const left = (this.save.inventory[id] ?? 0) - d.items.filter((x) => x.item === id).length;
    if (left <= 0) { d.ghost?.removeFromParent(); d.ghost = null; d.pick = null; }
    toast('Placed! ✨');
    this.renderDecorDock();
  }

  private pickUpDecor(): void {
    const d = this.decor!;
    let best = -1, bd = 2.5;
    d.items.forEach((it, i) => { const dist = Math.hypot(it.x - this.pos.x, it.z - this.pos.y); if (dist < bd) { bd = dist; best = i; } });
    if (best < 0) { toast('Stand next to the item you want to pick up.'); return; }
    d.items.splice(best, 1);
    this.net.send({ t: 'room', items: d.items });
    this.renderDecorDock();
  }

  // ================================================================== villa

  private villaIntro(): void {
    const s = this.save;
    if (!s.villa.look) {
      sheet('💘 Welcome to the Villa!', h('div.villa-intro', {},
        h('p', {}, "You made it to the top of the estate! Love Island Mode is a whole new game — a 10-day season full of bombshells, dates, challenges, recouplings and dumpings."),
        h('p', {}, 'First, get villa-ready:'),
        h('div.actions', {}, h('button.btn.big', { onclick: () => { closeAllSheets(); openWardrobe(this.ctx, { villa: true, onSaved: () => setTimeout(() => this.villaIntro(), 400) }); } }, '🌺 Choose my villa look'))));
      return;
    }
    if (!s.villa.season) openCast(undefined, () => this.seasonAct({ a: 'start' }));
  }

  /** Sends a season action to the server; the reply arrives as a scene. */
  seasonAct(act: SeasonAction): void {
    if (this.zoneId !== 'villa') return;
    this.net.send({ t: 'season', act });
  }

  /** Keeps the 3D islanders in step with the season cast. */
  private syncCast(arrivals: boolean): void {
    if (!this.zone || this.zoneId !== 'villa') return;
    const season = this.save.villa.season;
    const cast = new Set(season && season.phase !== 'over' ? season.cast : []);
    // Gone (dumped / season over)
    for (const w of this.wanderers.filter((x) => x.kind === 'islander' && !cast.has(x.name))) {
      w.avatar?.dispose();
      this.wanderers.splice(this.wanderers.indexOf(w), 1);
    }
    const arch = this.zone.layout.props.find((p) => p.t === 'arch');
    const entrance = arch ? { x: arch.x - this.zone.half.w, z: arch.z - this.zone.half.d - 1 } : undefined;
    for (const name of cast) {
      if (this.wanderers.some((w) => w.name === name)) continue;
      const w = spawnIslander(this.zone, name, arrivals ? entrance : undefined);
      if (!w) continue;
      w.follow = () => this.islanderTarget(w.name);
      this.wanderers.push(w);
    }
  }

  /** Where an islander should be: with you, with their partner, or at the firepit. */
  private islanderTarget(name: string): { x: number; z: number; exact?: boolean; face?: number } | null {
    const s = this.save.villa.season;
    if (!s || !this.zone) return null;
    if (s.phase === 'firepit' || s.phase === 'evening') {
      const pit = this.zone.layout.props.find((p) => p.t === 'firepit');
      if (pit) {
        const i = s.cast.indexOf(name);
        const a = Math.PI * 0.45 + (i / Math.max(1, s.cast.length)) * Math.PI * 1.6;
        const cx = pit.x - this.zone.half.w, cz = pit.z - this.zone.half.d;
        return { x: cx + Math.cos(a) * 2.5, z: cz + Math.sin(a) * 2.5, exact: true, face: Math.atan2(-Math.cos(a), -Math.sin(a)) };
      }
    }
    if (s.partner === name) return { x: this.pos.x, z: this.pos.y };
    for (const [a, b] of s.couples) {
      if (b === name) { const w = this.wanderers.find((x) => x.name === a); if (w) return { x: w.x, z: w.z }; }
    }
    return null;
  }

  private talkIslander(w: Wanderer): void {
    w.wait = 4;
    const s = this.save.villa.season;
    if (!s || s.phase === 'over') {
      w.avatar?.say(w.line ?? 'Hey!');
      toast('Start your season at the firepit to really get to know the islanders! 🔥');
      return;
    }
    w.ry = Math.atan2(this.pos.x - w.x, this.pos.y - w.z);
    this.seasonAct({ a: 'chat', who: w.name });
  }

  private hostMenu(): void {
    const s = this.save.villa.season;
    if (!s || s.phase === 'over') { openCast(s, () => this.seasonAct({ a: 'start' })); return; }
    this.seasonAct({ a: 'status' });
  }

  private hideaway(): void {
    const s = this.save.villa.season;
    const p = s?.partner;
    if (!s || !p) { toast('🌌 The Hideaway is for couples. Couple up first!'); return; }
    if ((s.bonds[p] ?? 0) < 70) { toast(`🌌 You and ${p} need a stronger connection (bond 70+) to unlock the Hideaway. You're at ${s.bonds[p] ?? 0}.`); return; }
    this.emote('sit');
    confetti(50);
    sheet('🌌 The Hideaway', h('div.mg', {}, h('p', {}, `You and ${p} spend the evening stargazing in the Hideaway, talking about everything. 🌠`), h('p', {}, '"This is the best night I\'ve had in the villa." 🥹')));
  }

  private firepit(): void {
    const s = this.save.villa.season;
    const players = [...this.peers.values()].length;
    if (!s || s.phase === 'over') { openCast(s, () => this.seasonAct({ a: 'start' })); return; }
    if (s.phase === 'morning' && s.actions > 0) {
      sheet('🔥 The Firepit', h('div.mg', {},
        h('p', {}, `It's still daytime — you have ${s.actions} chat${s.actions === 1 ? '' : 's'} left. Head to tonight's twist now?`),
        h('div.actions', {},
          h('button.btn', { onclick: () => { closeAllSheets(); this.seasonAct({ a: 'firepit' }); } }, "🌙 Yes, bring on tonight"),
          h('button.btn.ghost', { onclick: () => closeAllSheets() }, 'Not yet')),
        players ? h('div.actions', {}, h('button.btn.ghost', { onclick: () => { closeAllSheets(); this.net.send({ t: 'recouple' }); } }, '👯 Group recoupling with the players here')) : null));
      return;
    }
    this.seasonAct({ a: 'firepit' });
  }

  private coupleAsk(from: string): void {
    const close = sheet('💌 Couple up?', h('div.mg', {}, h('p', {}, `${from} wants to couple up with you!`),
      h('div.actions', {},
        h('button.btn', { onclick: () => { this.net.send({ t: 'coupleReply', from, yes: true }); close(); } }, '💘 Yes!'),
        h('button.btn.ghost', { onclick: () => { this.net.send({ t: 'coupleReply', from, yes: false }); close(); } }, 'Not right now'))));
  }

  private ceremony(endsAt: number, options: string[]): void {
    closeAllSheets();
    let picked = '';
    const timer = h('b', {}, '');
    const list = h('div.grid.pick');
    const render = () => fill(list, ...options.filter((o) => o !== this.save.name).map((o) => {
      const npc = ISLANDERS.some((i) => i.name === o);
      return h('button.card' + (picked === o ? '.on' : ''), { onclick: () => { picked = o; this.net.send({ t: 'pick', who: o }); render(); } },
        h('div.emoji', {}, npc ? '🌴' : '💖'), h('div.name', {}, o), h('small.muted', {}, npc ? 'Islander' : 'Player'));
    }));
    render();
    sheet('🔥 Recoupling!', h('div', {}, h('p', {}, 'Choose who you want to couple up with. Time left: ', timer), list));
    const iv = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      timer.textContent = `${left}s`;
      if (left <= 0) clearInterval(iv);
    }, 250);
  }

  private villaTexts(dt: number): void {
    if (this.zoneId !== 'villa') return;
    this.textTimer -= dt;
    if (this.textTimer > 0) return;
    this.textTimer = 150 + Math.random() * 120;
    const texts = [
      'Islanders, it’s time for a challenge! Head to the dance floor 💃 #HeartRate',
      'Islanders, there’s a coconut shortage on the beach 🥥 #GetCollecting',
      'Islanders, gather at the firepit tonight for a recoupling 🔥 #DecisionTime',
      'Islanders, the villa quiz is open at the lounge ❓ #BigBrains',
      'Islanders, beach volleyball starts now 🏐 #GameOn',
      'A new islander might be arriving soon… 👀 #Twist',
    ];
    const el = $('#text');
    fill(el, h('div.phone', {}, h('b', {}, '📱 I GOT A TEXT!'), h('p', {}, texts[Math.floor(Math.random() * texts.length)])));
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 6500);
  }

  // ================================================================== HUD

  private preview(look: Look | null): void {
    this.previewing = look;
    this.me.setLook(look ?? (this.zoneId === 'villa' ? this.save.villa.look ?? { ...this.save.look, outfit: 'fit_villa' } : this.save.look));
  }

  private bindHud(): void {
    const btn = (id: string, fn: () => void) => { const el = $(id); el.onclick = fn; };
    btn('#b-map', () => openMap(this.ctx));
    btn('#b-shop', () => openShop(this.ctx));
    btn('#b-wardrobe', () => openWardrobe(this.ctx, { villa: this.zoneId === 'villa' }));
    btn('#b-daily', () => openDaily(this.ctx));
    btn('#b-board', () => openBoard(this.ctx));
    btn('#b-settings', () => openSettings(this.ctx));
    btn('#b-fun', () => this.openFunMenu());
    btn('#b-accounts', () => openAccounts({ net: this.net, admin: () => this.admin, me: this.save.name, onAccounts: (fn) => { this.accountListeners.add(fn); return () => this.accountListeners.delete(fn); } }));
    btn('#b-emote', () => $('#emotes').classList.toggle('on'));
    btn('#b-tasks', () => $('#hud').classList.toggle('collapsed'));
    document.querySelectorAll<HTMLButtonElement>('#emotes button').forEach((b) => {
      b.onclick = () => { this.emote(b.dataset.e as Emote); $('#emotes').classList.remove('on'); };
    });
    const chatin = $('#chatin') as HTMLInputElement;
    chatin.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const v = chatin.value.trim();
        if (v) this.net.send({ t: 'chat', text: v });
        chatin.value = '';
        chatin.blur();
      } else if (e.key === 'Escape') chatin.blur();
      e.stopPropagation();
    };
    ($('#chatsend') as HTMLButtonElement).onclick = () => { const v = chatin.value.trim(); if (v) this.net.send({ t: 'chat', text: v }); chatin.value = ''; };
    this.net.onStatus = (on) => $('#net').classList.toggle('off', !on);
  }

  private chatLine(from: string, text: string): void {
    const log = $('#chatlog');
    log.append(h('div.line', {}, h('b', {}, from), ` ${text}`));
    while (log.children.length > 6) log.firstElementChild?.remove();
  }

  renderHud(): void {
    this.renderBadge();
    const s = this.save;
    const goal = nextGoal(s);
    fill($('#who'), h('b', {}, s.vip ? `⭐ ${s.name}` : s.name), s.vip ? h('span.vip', {}, 'VIP') : null);
    fill($('#aura'), 
      h('div.stat', { title: 'Total Aura Earned — unlocks floors and never goes down' }, h('span', {}, '⭐'), h('b', {}, s.totalAura.toLocaleString('en-AU')), h('small', {}, 'Total')),
      h('div.stat', { title: 'Available Aura — spend it in the shop' }, h('span', {}, '💎'), h('b', {}, s.aura.toLocaleString('en-AU')), h('small', {}, 'Available')),
    );
    fill($('#goal'), h('div.bar', {}, h('i', { style: { width: `${Math.round(goal.frac * 100)}%` } })), h('small', {}, goal.text));
    const zEl = $('#zonename');
    zEl.textContent = zoneName(this.zoneId);
    const list = $('#tasklist');
    if (this.zoneId === 'villa') {
      const se = s.villa.season;
      const p = se?.partner;
      fill(list,
        h('li', {}, se && se.phase !== 'over' ? `📺 Day ${Math.min(se.day, FINAL_DAY)}/${FINAL_DAY} · ${se.phase === 'morning' ? `☀️ ${se.actions} chats left` : '🌙 Tonight'}` : '📺 No season running'),
        h('li', {}, p ? `💘 ${p} · bond ${se!.bonds[p] ?? 0}` : '💔 Single'),
        se ? h('li', {}, `📈 Popularity ${se.popularity}/100`) : null,
        h('li.next', {}, `👉 ${nextStep(se)}`),
        h('li', {}, h('button.mini', { onclick: () => openCast(se, () => this.seasonAct({ a: 'start' })) }, '📺 Islanders & season'), ` 🏆 ${s.villa.wins}`),
      );
    } else {
      const tasks = taskList(s, this.zoneId);
      const unlocked = zoneUnlocked(s, this.zoneId);
      fill(list, ...(tasks.length
        ? tasks.map((t) => h('li' + (t.done ? '.done' : ''), {}, `${t.done ? '✅' : unlocked ? '⬜' : '🔒'} ${t.label}`))
        : [h('li', {}, this.zoneId === 'b' ? '🆓 Free level — explore and decorate!' : this.zoneId === 'park' ? '🚗 Drive your cars and visit the garage' : '')]));
    }
    const room = this.zone && roomAt(this.zone, this.pos.x, this.pos.y);
    void room;
    this.me.setName(s.name, s.vip, this.partnerSub());
  }
}

function info2zone(info: PeerInfo): ZoneId { return info.zone; }

/** Where along segment P→C (0..1) it crosses segment A→B, or null. */
function segT(px: number, pz: number, cx: number, cz: number, ax: number, az: number, bx: number, bz: number): number | null {
  const rX = cx - px, rZ = cz - pz, sX = bx - ax, sZ = bz - az;
  const den = rX * sZ - rZ * sX;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((ax - px) * sZ - (az - pz) * sX) / den;
  const u = ((ax - px) * rZ - (az - pz) * rX) / den;
  if (t < 0 || t > 1 || u < -0.05 || u > 1.05) return null;
  return t;
}

function distToSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax, vz = bz - az;
  const l2 = vx * vx + vz * vz;
  let t = l2 ? ((px - ax) * vx + (pz - az) * vz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * vx), pz - (az + t * vz));
}
