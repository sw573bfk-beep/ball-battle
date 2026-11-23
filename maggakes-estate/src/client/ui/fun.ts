import { h, sheet, closeAllSheets, confetti, fill, toast } from './dom';
import { SPIN_PRIZES, SHELL_TOTAL, today, type Save } from '../../shared/save';
import type { Music, Station } from '../engine/music';
import { colorRow } from './color';

export interface FunCtx {
  save: () => Save;
  driving: () => boolean;
  kart: () => void;
  spin: () => void;
  party: () => void;
  tag: () => void;
  fireworks: () => void;
  callPet: () => void;
  shellsHere: () => { found: number; total: number };
  music: Music;
}

/** The 🎉 Fun menu: everything fun in one tidy place. */
export function openFun(ctx: FunCtx): void {
  const s = ctx.save();
  const spun = s.spinDate === today();
  const shells = s.shells?.length ?? 0;
  const here = ctx.shellsHere();
  const card = (emoji: string, title: string, sub: string, run: (() => void) | null, extra = '') =>
    h('button.fun' + extra, { disabled: !run, onclick: () => { if (run) { closeAllSheets(); run(); } } }, h('span.e', {}, emoji), h('b', {}, title), h('small', {}, sub));
  const stations: [Station, string][] = [['chill', '🌴 Chill'], ['pop', '🎤 Pop'], ['night', '🌙 Night'], ['party', '🪩 Party']];
  const music = h('section.music', {},
    h('h4', {}, '🎵 Music'),
    h('div.row', {},
      h('button.chip' + (!ctx.music.on ? '.on' : ''), { onclick: () => { ctx.music.set({ on: !ctx.music.on }); closeAllSheets(); openFun(ctx); } }, ctx.music.on ? '🔇 Turn off' : '🔈 Turn on'),
      ...stations.map(([id, label]) => h('button.chip' + (ctx.music.on && ctx.music.station === id ? '.on' : ''), { onclick: () => { ctx.music.unlock(); ctx.music.set({ station: id, on: true }); closeAllSheets(); openFun(ctx); } }, label))),
    h('input.vol', { type: 'range', min: 0, max: 1, step: 0.05, value: String(ctx.music.volume), oninput: (e: Event) => ctx.music.set({ volume: Number((e.target as HTMLInputElement).value) }) }));
  sheet('🎉 Fun', h('div.funhub', {},
    h('div.fungrid', {},
      card('🏎️', ctx.driving() ? 'Get out' : 'Mini kart', ctx.driving() ? 'Park your ride' : 'Drive anywhere!', ctx.kart),
      card('🎡', 'Daily spin', spun ? 'Come back tomorrow' : 'Free spin today!', spun ? null : ctx.spin, spun ? '' : '.glow'),
      card('🐾', s.pet ? s.pet.name : 'Get a pet', s.pet ? 'Call them over' : 'Adopt at the 2nd floor Pet Room', s.pet ? ctx.callPet : null),
      card('🎉', 'Party!', 'Disco on this floor', ctx.party),
      card('🏃', 'Tag', 'Needs 2+ players here', ctx.tag),
      card('🎆', 'Fireworks', `You have ${s.inventory.fx_fireworks ?? 0}`, (s.inventory.fx_fireworks ?? 0) > 0 ? ctx.fireworks : null),
      card('🐚', `Shells ${shells}/${SHELL_TOTAL}`, here.total ? `${here.found}/${here.total} found on this floor` : 'None hidden here', null),
    ),
    h('p.muted', {}, '🏁 Race karts at the car park · 🌊 Water slide on the rooftop'),
    music));
}

/** The daily prize wheel. Spins to `index` when the server answers. */
export function openSpin(onSpin: () => void): { land: (index: number, msg: string) => void } {
  const n = SPIN_PRIZES.length;
  const colors = ['#ff6f91', '#ffd23f', '#4fd1c5', '#9b7ede', '#ff9a6f', '#7fd8ff', '#ff4fa3'];
  const c = h<HTMLCanvasElement>('canvas.wheel', { width: 320, height: 320 });
  const g = c.getContext('2d')!;
  const draw = (rot: number) => {
    g.clearRect(0, 0, 320, 320);
    for (let i = 0; i < n; i++) {
      const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2;
      g.beginPath(); g.moveTo(160, 160); g.arc(160, 160, 150, a0, a1); g.closePath();
      g.fillStyle = colors[i % colors.length]; g.fill();
      g.save(); g.translate(160, 160); g.rotate((a0 + a1) / 2);
      g.fillStyle = '#fff'; g.font = 'bold 15px system-ui'; g.textAlign = 'right';
      g.fillText(`${SPIN_PRIZES[i].emoji} ${SPIN_PRIZES[i].label}`, 140, 5);
      g.restore();
    }
    g.beginPath(); g.arc(160, 160, 22, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    g.beginPath(); g.moveTo(300, 160); g.lineTo(325, 148); g.lineTo(325, 172); g.fillStyle = '#2a1f2d'; g.fill();
  };
  draw(0);
  const btn = h('button.btn.big', {}, '🎡 SPIN!');
  const result = h('p.spinres');
  btn.onclick = () => { btn.disabled = true; btn.textContent = 'Spinning…'; onSpin(); };
  sheet('🎡 Daily Spin', h('div.spin', {}, c, result, btn));
  return {
    land: (index, msg) => {
      // Pointer is on the right (angle 0): spin so the middle of `index` ends there.
      const target = -((index + 0.5) / n) * Math.PI * 2 + Math.PI * 2 * 6;
      const start = performance.now(), dur = 3600;
      const tick = (t: number) => {
        const k = Math.min(1, (t - start) / dur);
        draw(target * (1 - (1 - k) ** 3));
        if (k < 1) requestAnimationFrame(tick);
        else { result.textContent = msg; btn.textContent = 'See you tomorrow!'; confetti(70); toast(msg, true); }
      };
      requestAnimationFrame(tick);
    },
  };
}

const FURS: Record<string, string[]> = {
  dog: ['#c8925a', '#f2e3c6', '#3b2a20', '#ffffff', '#8a8a8a', '#e0b070'],
  cat: ['#f0a040', '#2a2a2a', '#ffffff', '#9a9a9a', '#e8d8c0', '#7a5030'],
  bunny: ['#ffffff', '#d9c2a8', '#8a7060', '#c0c0c0', '#ffd6e8', '#3a3a3a'],
};
const COLLARS = ['#ff3d7f', '#2aa8ff', '#ffd23d', '#7cff6b', '#b388ff', '#ff7a2a', '#1b1c1f', '#ffffff'];

export function openAdopt(current: Save['pet'], adopt: (kind: string, name: string, fur?: string, collar?: string) => void): void {
  let kind = current?.kind ?? 'dog';
  let fur = current?.fur;
  let collar = current?.collar;
  const name = h<HTMLInputElement>('input.petname', { placeholder: 'Pet name', maxLength: 12, value: current?.name ?? '' });
  const box = h('div');
  const draw = () => fill(box,
    h('div.row', {}, ...([['dog', '🐶 Puppy'], ['cat', '🐱 Kitten'], ['bunny', '🐰 Bunny']] as const).map(([k, l]) =>
      h('button.chip' + (kind === k ? '.on' : ''), { onclick: () => { kind = k; draw(); } }, l))),
    h('h4', {}, '🎨 Fur colour'), colorRow(fur, FURS[kind] ?? FURS.dog, (c) => { fur = c; }),
    h('h4', {}, '🎀 Collar colour'), colorRow(collar, COLLARS, (c) => { collar = c; }));
  draw();
  sheet('🐾 Adopt a pet', h('div.mg', {},
    h('p', {}, current ? `${current.name} is your pet right now. You can swap, rename or recolour them.` : 'Pick a pet — they\'ll follow you everywhere, and your friends can see them!'),
    box, name,
    h('div.actions', {}, h('button.btn.big', { onclick: () => { closeAllSheets(); adopt(kind, name.value, fur, collar); } }, current ? '💾 Save' : '🐾 Adopt!'))));
}

export function openRace(rows: { name: string; ms: number }[], me: Save, start: () => void): void {
  const medal = ['🥇', '🥈', '🥉'];
  sheet('🏁 Kart Race', h('div.mg', {},
    h('p', {}, 'One lap around the estate drive. Hit all the checkpoints, then cross the finish line! Your best lap goes on the board.'),
    me.bestLap ? h('p', {}, `Your best: ${(me.bestLap / 1000).toFixed(2)}s`) : null,
    rows.length ? h('ol.laps', {}, ...rows.map((r, i) => h('li', {}, `${medal[i] ?? `${i + 1}.`} ${r.name} — ${(r.ms / 1000).toFixed(2)}s`))) : h('p.muted', {}, 'No laps yet — be the first!'),
    h('div.actions', {}, h('button.btn.big', { onclick: () => { closeAllSheets(); start(); } }, '🏎️ Start race'))));
}
