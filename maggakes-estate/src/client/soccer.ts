import * as THREE from 'three';
import { Avatar } from './engine/avatar';
import { normalizeLook, type Look } from '../shared/look';
import { TEAM_COLORS, TEAM_NAMES, type SoccerWire, type Team } from '../shared/soccer';
import type { Zone } from './world/build';
import { $, confetti, toast } from './ui/dom';

const BOT_NAMES = ['Ace', 'Blaze', 'Comet', 'Dash', 'Echo', 'Flash', 'Gigi', 'Hex', 'Iggy', 'Jinx'];
const SKINS = ['#f7d0b2', '#eab48f', '#d39a72', '#b07650', '#8a5636', '#ffe3d3'];
const HAIRS = ['crop', 'quiff', 'curlytop', 'sleekpony', 'braids', 'topbun'];

/** A soccer ball texture: white with black patches. */
function ballTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#1b1c1f';
  for (const [px, py] of [[32, 30], [96, 70], [160, 30], [224, 70], [64, 110], [192, 110], [128, 8]]) {
    x.beginPath();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; x.lineTo(px + Math.cos(a) * 16, py + Math.sin(a) * 16); }
    x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function kitLook(id: string, team: Team, keeper: boolean): Look {
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const girl = h % 2 === 0;
  return normalizeLook({
    body: girl ? 'girl' : 'boy', skin: SKINS[h % SKINS.length], hair: HAIRS[(h >> 3) % HAIRS.length], hairColor: ['#1c1410', '#3b2518', '#b98552', '#d9b277'][(h >> 5) % 4],
    outfit: 'fit_gym', top: 'tee', bottom: 'shorts', shoes: 'sneakers',
    colors: { top: keeper ? '#2fd36b' : TEAM_COLORS[team], bottom: '#ffffff', shoes: '#111111' },
  } as Look);
}

/**
 * Everything soccer on the client: the ball, bot players, team rings under real
 * players, the scoreboard and the HUD. The server sends the match state ~10×/s and
 * we smooth it in between.
 */
export class SoccerView {
  private zone: Zone | null = null;
  private ball: THREE.Mesh | null = null;
  private ballTarget = { x: 0, z: 0, vx: 0, vz: 0 };
  private bots = new Map<string, { av: Avatar; x: number; z: number; ry: number; tx: number; tz: number; tr: number }>();
  private rings = new Map<string, THREE.Mesh>();
  private board: ((p: number, b: number, clock: string, line: string) => void) | null = null;
  state: SoccerWire | null = null;
  myTeam: Team | null = null;
  private lastGoalKey = '';

  constructor(private me: () => { name: string; root: THREE.Object3D; x: number; z: number }, private peerRoot: (name: string) => THREE.Object3D | undefined) {}

  enter(zone: Zone): void {
    this.leave();
    if (zone.layout.id !== 'stadium') return;
    this.zone = zone;
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45 }));
    this.ball.castShadow = true;
    this.ball.position.set(0, 0.22, 0);
    zone.root.add(this.ball);
    zone.root.traverse((o) => { if (o.userData.scoreboard) this.board = o.userData.scoreboard; });
    $('#soccerhud').classList.add('on');
  }

  leave(): void {
    for (const b of this.bots.values()) { b.av.root.removeFromParent(); b.av.dispose(); }
    this.bots.clear();
    for (const r of this.rings.values()) r.removeFromParent();
    this.rings.clear();
    this.ball?.removeFromParent();
    this.ball = null; this.zone = null; this.board = null; this.state = null; this.myTeam = null;
    $('#soccerhud').classList.remove('on');
  }

  get active(): boolean { return !!this.zone; }

  /** True when the ball is close enough to kick. */
  nearBall(x: number, z: number): boolean {
    // Use the server's ball (not the smoothed one on screen) so the button matches what the server allows.
    return !!this.ball && this.state?.ph === 'play' && Math.hypot(this.ballTarget.x - x, this.ballTarget.z - z) < 1.6;
  }

  onState(s: SoccerWire): void {
    if (!this.zone) return;
    this.state = s;
    const [bx, bz, vx, vz] = s.b;
    this.ballTarget = { x: bx, z: bz, vx, vz };
    if (s.ph !== 'play' && this.ball) { this.ball.position.x = bx; this.ball.position.z = bz; }
    const me = this.me().name;
    const seen = new Set<string>();
    for (const [id, team, x, z, ry, bot, keeper] of s.p) {
      seen.add(id);
      if (id === me) this.myTeam = team;
      if (bot) {
        let b = this.bots.get(id);
        if (!b) {
          const n = BOT_NAMES[(id.charCodeAt(id.length - 1) + id.charCodeAt(id.length - 2)) % BOT_NAMES.length];
          const av = new Avatar(kitLook(id, team, !!keeper), keeper ? `🧤 ${n}` : n, false, `${team === 0 ? '🩷' : '💙'} ${TEAM_NAMES[team]} bot`);
          av.root.position.set(x, 0, z);
          this.zone.root.add(av.root);
          b = { av, x, z, ry, tx: x, tz: z, tr: ry };
          this.bots.set(id, b);
        }
        b.tx = x; b.tz = z; b.tr = ry;
      } else {
        // Team-coloured ring under real players.
        const root = id === me ? this.me().root : this.peerRoot(id);
        if (!root) continue;
        let ring = this.rings.get(id);
        if (!ring || ring.parent !== root || ring.userData.team !== team) {
          ring?.removeFromParent();
          ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 28), new THREE.MeshBasicMaterial({ color: TEAM_COLORS[team], transparent: true, opacity: 0.9, depthWrite: false }));
          ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.renderOrder = 3; ring.userData.team = team;
          root.add(ring);
          this.rings.set(id, ring);
        }
      }
    }
    for (const [id, b] of this.bots) if (!seen.has(id)) { b.av.root.removeFromParent(); b.av.dispose(); this.bots.delete(id); }
    for (const [id, r] of this.rings) if (!seen.has(id)) { r.removeFromParent(); this.rings.delete(id); }
    this.hud(s);
  }

  private hud(s: SoccerWire): void {
    const clock = `${Math.floor(s.c / 60)}:${String(s.c % 60).padStart(2, '0')}`;
    const goalKey = s.g ? `${s.sc[0]}-${s.sc[1]}` : '';
    let line = s.ph === 'kickoff' ? 'KICK OFF!' : s.ph === 'goal' ? `GOAL ${TEAM_NAMES[s.g?.team ?? 0].toUpperCase()}!` : s.ph === 'over' ? 'FULL TIME' : 'LIVE';
    if (s.ph === 'goal' && s.g?.by && !s.g.by.startsWith('bot')) line = `GOAL! ${s.g.by.toUpperCase()}`;
    this.board?.(s.sc[0], s.sc[1], clock, line);
    const team = this.myTeam;
    $('#soccerhud').innerHTML = `<span class="sc pink">PINK ${s.sc[0]}</span><span class="clk">${clock}</span><span class="sc blue">${s.sc[1]} BLUE</span>`
      + `<small>${team === null ? '' : `You're on ${team === 0 ? '🩷 PINK' : '💙 BLUE'} · `}${s.ph === 'play' ? 'Walk into the ball to dribble, press E to shoot!' : line}</small>`;
    if (s.ph === 'goal' && goalKey !== this.lastGoalKey) {
      this.lastGoalKey = goalKey;
      const mine = s.g && team === s.g.team;
      toast(`⚽ GOAL for ${TEAM_NAMES[s.g?.team ?? 0]}!${s.g?.by && !s.g.by.startsWith('bot') ? ` (${s.g.by})` : ''}`, mine);
      if (mine) confetti(40);
    }
    if (s.ph === 'kickoff' && s.sc[0] + s.sc[1] === 0) this.lastGoalKey = '';
  }

  update(dt: number, t: number): void {
    if (!this.ball || !this.state) return;
    const b = this.ballTarget;
    if (this.state.ph === 'play') {
      // Extrapolate with the ball's speed, and ease toward the server's position.
      b.x += b.vx * dt; b.z += b.vz * dt;
      const f = Math.exp(-0.85 * dt); b.vx *= f; b.vz *= f;
      const p = this.ball.position;
      const k = Math.min(1, dt * 10);
      const ox = p.x, oz = p.z;
      p.x += (b.x - p.x) * k; p.z += (b.z - p.z) * k;
      const moved = Math.hypot(p.x - ox, p.z - oz);
      if (moved > 1e-4) this.ball.rotateOnWorldAxis(new THREE.Vector3(p.z - oz, 0, -(p.x - ox)).normalize(), moved / 0.22);
    }
    for (const bot of this.bots.values()) {
      const k = Math.min(1, dt * 8);
      const ox = bot.x, oz = bot.z;
      bot.x += (bot.tx - bot.x) * k; bot.z += (bot.tz - bot.z) * k;
      let dr = bot.tr - bot.ry; while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2;
      bot.ry += dr * k;
      bot.av.root.position.set(bot.x, 0, bot.z);
      bot.av.root.rotation.y = bot.ry;
      const sp = Math.hypot(bot.x - ox, bot.z - oz) / Math.max(dt, 1e-3);
      bot.av.update(dt, t, Math.min(1, sp / 4.4), 'walk');
    }
  }

  onEnd(m: { result: 'win' | 'draw' | 'loss'; score: [number, number]; team: Team; goals: number; aura: number }): void {
    const [a, b] = m.team === 0 ? m.score : [m.score[1], m.score[0]];
    const head = m.result === 'win' ? '🏆 You WON' : m.result === 'draw' ? '🤝 It\'s a DRAW' : '😅 You lost';
    toast(`${head} ${a}–${b}!${m.goals ? ` You scored ${m.goals} ⚽` : ''}${m.aura ? ` +${m.aura} Aura` : ' (daily Aura limit reached)'}`, m.result !== 'loss');
    if (m.result === 'win') confetti(90);
  }
}
