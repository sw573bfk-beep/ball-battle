import './style.css';
import { MATCH, PLAYER, SWORD, TIERS, type Difficulty } from '../sim/config.js';
import type { Player, World } from '../sim/types.js';
import { rankPlayers } from '../sim/world.js';
import { Audio } from './audio.js';
import { Game, type GameOptions } from './game.js';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const menu = document.getElementById('menu') as HTMLDivElement;
const pause = document.getElementById('pause') as HTMLDivElement;
const results = document.getElementById('results') as HTMLDivElement;
const audio = new Audio();

let game: Game | null = null;
let lastOpts: GameOptions | null = null;

// Remember menu choices between visits. Storage can be unavailable (private
// mode, sandboxed previews), so every access is guarded.
const store = {
  get(key: string): string | null {
    try { return localStorage.getItem(`sa.${key}`); } catch { return null; }
  },
  set(key: string, value: string): void {
    try { localStorage.setItem(`sa.${key}`, value); } catch { /* ignore */ }
  },
};

// ------------------------------------------------------------------ menu

menu.innerHTML = `
  <div class="card">
    <h1>SWORD <span>ARENA</span></h1>
    <p class="tag">Free-for-all · grab swords · throw them · be the last ball spinning</p>
    <label class="field"><span>Your name</span>
      <input id="name" maxlength="12" autocomplete="off" spellcheck="false" placeholder="You" />
    </label>
    <div class="row">
      <label class="field"><span>Bots: <b id="botsVal">7</b></span>
        <input id="bots" type="range" min="1" max="11" value="7" />
      </label>
      <label class="field"><span>Difficulty</span>
        <select id="diff">
          <option value="easy">Easy</option>
          <option value="normal" selected>Normal</option>
          <option value="hard">Hard</option>
          <option value="mixed">Mixed</option>
        </select>
      </label>
    </div>
    <button id="play" class="primary">PLAY</button>
    <details class="how">
      <summary>How to play</summary>
      <ul>
        <li>Swords <b>spin around you</b> and hurt anyone they touch. Pick up more (up to ${SWORD.MAX_HELD}) to spin more.</li>
        <li><b>Throw</b> your best sword at your aim. It lands where it hits, so go get it back.</li>
        <li>Each sword slows you down a little. Hoard or throw: your call.</li>
        <li>Enemy blades can <b>block</b> thrown swords, and blades that touch <b>clash</b> and push you apart.</li>
        <li>Smash <b>crates</b> for loot. Green pads heal. A knockout drops <b>all</b> of the loser's swords.</li>
        <li>Sword tiers: <span class="t0">${TIERS[0].name}</span> · <span class="t1">${TIERS[1].name}</span> · <span class="t2">${TIERS[2].name}</span> (rarer hits harder).</li>
        <li>First to <b>${MATCH.KILL_TARGET}</b> knockouts, or most after ${MATCH.DURATION / 60} minutes, wins. Each knockout heals you ${PLAYER.KILL_HEAL}.</li>
      </ul>
      <table class="keys">
        <tr><td>Move</td><td>WASD / arrows</td><td>left stick</td></tr>
        <tr><td>Aim</td><td>mouse</td><td>right stick</td></tr>
        <tr><td>Throw</td><td>Space / left click</td><td>release right stick (tap = auto-aim)</td></tr>
        <tr><td>Dash</td><td>Shift / right click</td><td>DASH button</td></tr>
        <tr><td>Pause / mute</td><td>Esc · M</td><td>❚❚ button</td></tr>
      </table>
    </details>
  </div>`;

const nameEl = menu.querySelector('#name') as HTMLInputElement;
const botsEl = menu.querySelector('#bots') as HTMLInputElement;
const botsVal = menu.querySelector('#botsVal') as HTMLElement;
const diffEl = menu.querySelector('#diff') as HTMLSelectElement;
nameEl.value = store.get('name') ?? '';
botsEl.value = store.get('bots') ?? '7';
diffEl.value = store.get('diff') ?? 'normal';
botsVal.textContent = botsEl.value;
botsEl.addEventListener('input', () => { botsVal.textContent = botsEl.value; });

menu.querySelector('#play')!.addEventListener('click', () => {
  const opts: GameOptions = {
    name: nameEl.value.trim().slice(0, 12) || 'You',
    bots: Number(botsEl.value),
    difficulty: diffEl.value as Difficulty | 'mixed',
  };
  store.set('name', nameEl.value.trim());
  store.set('bots', botsEl.value);
  store.set('diff', diffEl.value);
  startGame(opts);
});
nameEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') (menu.querySelector('#play') as HTMLButtonElement).click();
});

// ------------------------------------------------------------ pause etc.

const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
pause.innerHTML = `
  <div class="card small">
    <h2>Paused</h2>
    <button id="resume" class="primary">Resume</button>
    <button id="mute">Sound: on</button>
    <button id="quit">Quit to menu</button>
  </div>`;
const muteBtn = pause.querySelector('#mute') as HTMLButtonElement;
pause.querySelector('#resume')!.addEventListener('click', () => game?.togglePause(false));
muteBtn.addEventListener('click', () => {
  audio.muted = !audio.muted;
  muteBtn.textContent = `Sound: ${audio.muted ? 'off' : 'on'}`;
});
pause.querySelector('#quit')!.addEventListener('click', () => showMenu());
pauseBtn.addEventListener('click', () => game?.togglePause());

function startGame(opts: GameOptions): void {
  audio.unlock();
  game?.destroy();
  lastOpts = opts;
  menu.hidden = true;
  results.hidden = true;
  pause.hidden = true;
  pauseBtn.hidden = false;
  game = new Game(canvas, opts, audio);
  game.onPauseToggle = (p) => {
    pause.hidden = !p;
    muteBtn.textContent = `Sound: ${audio.muted ? 'off' : 'on'}`;
  };
  game.onOver = (w) => setTimeout(() => showResults(w), 1400);
  game.start();
  canvas.focus();
  (window as unknown as { game: Game }).game = game;
}

function showMenu(): void {
  game?.destroy();
  game = null;
  pause.hidden = true;
  results.hidden = true;
  pauseBtn.hidden = true;
  menu.hidden = false;
}

function showResults(w: World): void {
  if (!game || game.world !== w) return;
  pauseBtn.hidden = true;
  const ranked = rankPlayers(w);
  // Ties share a place: your rank is 1 + everyone who strictly beat you.
  const placeOf = (p: Player) => 1 + ranked.filter((o) => o.kills > p.kills || (o.kills === p.kills && o.deaths < p.deaths)).length;
  const me = ranked.find((p) => p.id === game!.localId)!;
  const place = placeOf(me);
  const title = place === 1 ? 'VICTORY!' : `#${place} of ${ranked.length}`;
  const top = ranked[0];
  const tag = place === 1 ? 'Last ball spinning.'
    : top.kills === 0 ? 'Nobody scored a knockout.'
    : `${escapeHtml(top.name)} wins with ${top.kills} knockout${top.kills === 1 ? '' : 's'}.`;
  const rows = ranked.map((p) => `
    <tr class="${p.id === game!.localId ? 'me' : ''}">
      <td>${placeOf(p)}</td>
      <td><i style="background:${p.color}"></i>${escapeHtml(p.name)}</td>
      <td>${p.kills}</td><td>${p.deaths}</td>
    </tr>`).join('');
  results.innerHTML = `
    <div class="card">
      <h1 class="${place === 1 ? 'win' : ''}">${title}</h1>
      <p class="tag">${tag}</p>
      <table class="board"><thead><tr><th>#</th><th>Player</th><th>KOs</th><th>Deaths</th></tr></thead><tbody>${rows}</tbody></table>
      <button id="again" class="primary">Play again</button>
      <button id="toMenu">Menu</button>
    </div>`;
  results.hidden = false;
  results.querySelector('#again')!.addEventListener('click', () => lastOpts && startGame(lastOpts));
  results.querySelector('#toMenu')!.addEventListener('click', showMenu);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// Pause when the tab is hidden so bots don't farm you while you're away.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game && !game.paused) game.togglePause(true);
});

// Dev/testing hook: ?autostart skips the menu.
if (new URLSearchParams(location.search).has('autostart')) {
  startGame({ name: 'You', bots: 7, difficulty: 'normal', seed: 1234 });
}
