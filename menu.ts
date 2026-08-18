/**
 * Front-end shell: menu, room codes, connection status.
 * Plain DOM on top of the canvas — no framework, nothing to ship to the player.
 */

import { MODE_RULES, type ModeId } from '@shared/config.js';
import { MAPS, MAP_ROTATION } from '@shared/maps.js';

export interface MenuCallbacks {
  onPractice(name: string): void;
  onCreate(name: string, mode: ModeId, mapId: string): void;
  onJoin(name: string, code: string): void;
}

const NAME_KEY = 'bc.name';
const MODE_KEY = 'bc.mode';
const MAP_KEY = 'bc.map';

export class Menu {
  readonly root: HTMLDivElement;
  private nameInput!: HTMLInputElement;
  private codeInput!: HTMLInputElement;
  private statusEl!: HTMLDivElement;
  private buttons: HTMLButtonElement[] = [];

  constructor(private cb: MenuCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'menu';
    this.root.innerHTML = `
      <div class="menu-card">
        <h1>BALL <span>COMBAT</span></h1>
        <p class="tag">dash · wall-bounce · one-hit sword</p>

        <label class="field">
          <span>YOUR NAME</span>
          <input id="bc-name" maxlength="16" autocomplete="off" spellcheck="false" placeholder="Player" />
        </label>

        <div class="field">
          <span>GAME MODE</span>
          <div class="chips" id="bc-modes"></div>
        </div>

        <div class="field">
          <span>ARENA</span>
          <div class="chips" id="bc-maps"></div>
        </div>

        <button class="primary" id="bc-create">CREATE PRIVATE ROOM</button>

        <div class="join-row">
          <input id="bc-code" maxlength="4" autocomplete="off" spellcheck="false" placeholder="CODE" />
          <button id="bc-join">JOIN</button>
        </div>

        <button class="ghost" id="bc-practice">PRACTICE (offline)</button>

        <div class="status" id="bc-status"></div>

        <div class="how">
          <b>WASD</b> move · <b>SPACE</b> dash · <b>LEFT CLICK</b> gun · <b>E</b> / <b>RIGHT CLICK</b> sword · <b>R</b> reload
        </div>
      </div>`;
    document.body.appendChild(this.root);

    this.nameInput = this.root.querySelector('#bc-name') as HTMLInputElement;
    this.codeInput = this.root.querySelector('#bc-code') as HTMLInputElement;
    this.statusEl = this.root.querySelector('#bc-status') as HTMLDivElement;

    this.nameInput.value = localStorage.getItem(NAME_KEY) ?? '';
    this.buildModeChips();
    this.buildMapChips();
    this.codeInput.addEventListener('input', () => {
      this.codeInput.value = this.codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
    this.codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.join();
    });

    this.bind('#bc-create', () => { this.setBusy(true); this.cb.onCreate(this.name(), this.mode, this.mapId); });
    this.bind('#bc-join', () => this.join());
    this.bind('#bc-practice', () => { this.hide(); this.cb.onPractice(this.name()); });
  }

  private mode: ModeId = (localStorage.getItem(MODE_KEY) as ModeId) ?? 'tdm';
  private mapId: string = localStorage.getItem(MAP_KEY) ?? MAP_ROTATION[0];

  private buildMapChips(): void {
    const host = this.root.querySelector('#bc-maps') as HTMLDivElement;
    if (!(MAP_ROTATION as readonly string[]).includes(this.mapId)) this.mapId = MAP_ROTATION[0];
    host.innerHTML = '';
    for (const id of MAP_ROTATION) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (id === this.mapId ? ' on' : '');
      chip.textContent = MAPS[id].name;
      chip.addEventListener('click', () => {
        this.mapId = id;
        localStorage.setItem(MAP_KEY, id);
        host.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
        chip.classList.add('on');
      });
      host.appendChild(chip);
    }
  }

  private buildModeChips(): void {
    const host = this.root.querySelector('#bc-modes') as HTMLDivElement;
    if (!(this.mode in MODE_RULES)) this.mode = 'tdm';
    host.innerHTML = '';
    for (const id of Object.keys(MODE_RULES) as ModeId[]) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (id === this.mode ? ' on' : '');
      chip.textContent = MODE_RULES[id].name;
      chip.addEventListener('click', () => {
        this.mode = id;
        localStorage.setItem(MODE_KEY, id);
        host.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
        chip.classList.add('on');
      });
      host.appendChild(chip);
    }
  }

  private bind(sel: string, fn: () => void): void {
    const el = this.root.querySelector(sel) as HTMLButtonElement;
    this.buttons.push(el);
    el.addEventListener('click', fn);
  }

  private join(): void {
    const code = this.codeInput.value.trim();
    if (code.length < 3) { this.setStatus('Enter the 4-character room code.', 'warn'); return; }
    this.setBusy(true);
    this.cb.onJoin(this.name(), code);
  }

  private name(): string {
    const n = (this.nameInput.value.trim() || 'Player').slice(0, 16);
    localStorage.setItem(NAME_KEY, n);
    return n;
  }

  setStatus(text: string, kind: 'info' | 'warn' | 'error' = 'info'): void {
    this.statusEl.textContent = text;
    this.statusEl.dataset.kind = kind;
  }

  setBusy(busy: boolean): void {
    for (const b of this.buttons) b.disabled = busy;
    if (busy) this.setStatus('Connecting…');
  }

  show(message?: string, kind: 'info' | 'warn' | 'error' = 'info'): void {
    this.root.style.display = '';
    this.setBusy(false);
    this.setStatus(message ?? '', kind);
  }

  hide(): void {
    this.root.style.display = 'none';
  }
}

/**
 * Between-match strip: room code, who's here, and mode switching. Only shown
 * while the room is in the lobby or on the results screen.
 */
export class LobbyBar {
  private el: HTMLDivElement;
  private modesEl: HTMLDivElement;
  private mapsEl: HTMLDivElement;
  private infoEl: HTMLDivElement;
  private currentMode: ModeId | null = null;
  private currentMap: string | null = null;

  constructor(
    private onMode: (mode: ModeId) => void,
    private onMap: (mapId: string) => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'lobby-bar';
    this.el.style.display = 'none';
    this.el.innerHTML =
      '<div class="lobby-info"></div>' +
      '<div class="chips chips-mode"></div>' +
      '<div class="chips chips-map"></div>';
    document.body.appendChild(this.el);
    this.infoEl = this.el.querySelector('.lobby-info') as HTMLDivElement;
    this.modesEl = this.el.querySelector('.chips-mode') as HTMLDivElement;
    this.mapsEl = this.el.querySelector('.chips-map') as HTMLDivElement;

    for (const id of Object.keys(MODE_RULES) as ModeId[]) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.dataset.mode = id;
      chip.textContent = MODE_RULES[id].name;
      chip.addEventListener('click', () => this.onMode(id));
      this.modesEl.appendChild(chip);
    }
    for (const id of MAP_ROTATION) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip chip-map';
      chip.dataset.map = id;
      chip.textContent = MAPS[id].name;
      chip.addEventListener('click', () => this.onMap(id));
      this.mapsEl.appendChild(chip);
    }
  }

  update(visible: boolean, code: string, players: number, mode: ModeId, mapId: string): void {
    this.el.style.display = visible ? '' : 'none';
    if (!visible) return;
    this.infoEl.innerHTML =
      `<span class="lbl">ROOM</span><b>${code}</b>` +
      `<span class="cnt">${players} ${players === 1 ? 'player' : 'players'}</span>`;
    if (this.currentMode !== mode) {
      this.currentMode = mode;
      this.modesEl.querySelectorAll('.chip').forEach((c) => {
        c.classList.toggle('on', (c as HTMLElement).dataset.mode === mode);
      });
    }
    if (this.currentMap !== mapId) {
      this.currentMap = mapId;
      this.mapsEl.querySelectorAll('.chip').forEach((c) => {
        c.classList.toggle('on', (c as HTMLElement).dataset.map === mapId);
      });
    }
  }

  hide(): void { this.el.style.display = 'none'; }
}

/** Small always-visible banner with the room code, easy to read out loud. */
export class RoomBanner {
  private el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'room-banner';
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
  }

  show(code: string, players: number): void {
    this.el.style.display = '';
    this.el.innerHTML = `<span class="lbl">ROOM</span><b>${code}</b><span class="cnt">${players} in lobby</span>`;
  }

  hide(): void { this.el.style.display = 'none'; }
}
