import './style.css';
import { LocalGame } from './game.js';
import { OnlineGame } from './onlineGame.js';
import { LobbyBar, Menu, RoomBanner } from './menu.js';
import type { ModeId } from '@shared/config.js';
import { MULTIPLAYER_AVAILABLE, SERVER_URL } from './serverUrl.js';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvas) throw new Error('#game canvas missing');

const hint = document.getElementById('hint') as HTMLDivElement | null;
const banner = new RoomBanner();
banner.hide();

let lobbyBar: LobbyBar | null = null;

type AnyGame = LocalGame | OnlineGame;
let game: AnyGame | null = null;

function teardown(): void {
  game?.destroy();
  game = null;
  banner.hide();
  lobbyBar?.hide();
}

const menu = new Menu({
  onPractice() {
    teardown();
    const g = new LocalGame(canvas!, new URLSearchParams(location.search).get('map') ?? undefined);
    g.debug = debugRequested();
    g.start();
    game = g;
    expose(g);
    if (hint) hint.style.display = '';
  },

  async onCreate(name, mode, mapId) {
    if (!guardServer()) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/room`, { method: 'POST' });
      if (!res.ok) throw new Error(`server said ${res.status}`);
      const { code } = (await res.json()) as { code: string };
      connect(name, code, mode, mapId);
    } catch (err) {
      menu.show(`Could not reach the server (${(err as Error).message}).`, 'error');
    }
  },

  onJoin(name, code) {
    if (!guardServer()) return;
    connect(name, code);
  },
});

function guardServer(): boolean {
  if (MULTIPLAYER_AVAILABLE) return true;
  menu.show('Multiplayer server is not configured for this build. Practice mode still works.', 'warn');
  return false;
}

function connect(name: string, code: string, mode?: ModeId, mapId?: string): void {
  teardown();
  if (hint) hint.style.display = 'none';

  const g = new OnlineGame(canvas!, {
    onStatus(status, detail) {
      if (status === 'connected') {
        menu.hide();
      } else if (status === 'full') {
        teardown();
        menu.show('That room is full (12 players max).', 'warn');
      } else if (status === 'closed') {
        teardown();
        menu.show('Disconnected from the room.', 'warn');
      } else if (status === 'error') {
        teardown();
        menu.show(`Connection problem: ${detail ?? 'unknown'}`, 'error');
      }
    },
    onRoster() { /* the lobby bar refreshes itself each frame */ },
  });

  if (!lobbyBar) {
    lobbyBar = new LobbyBar(
      (m) => { if (game instanceof OnlineGame) game.setMode(m); },
      (mp) => { if (game instanceof OnlineGame) game.setMap(mp); },
    );
  }

  g.debug = debugRequested();
  g.connect(SERVER_URL, code, name, mode, mapId);
  g.start();
  game = g;
  expose(g);

  // Keep the lobby strip in sync with the authoritative match phase.
  const sync = (): void => {
    if (game !== g) return;
    const phase = g.world.match.phase;
    const between = phase === 'lobby' || phase === 'results';
    lobbyBar!.update(between, g.roomCode || code, g.world.players.size, g.world.match.mode, g.world.map.id);
    requestAnimationFrame(sync);
  };
  requestAnimationFrame(sync);
}

function debugRequested(): boolean {
  return new URLSearchParams(location.search).has('debug');
}

// Debug/testing hook — headless tests drive the game through this.
declare global {
  interface Window { __game?: AnyGame; }
}
function expose(g: AnyGame): void { window.__game = g; }

window.addEventListener('keydown', (e) => {
  if (e.code === 'F1') { e.preventDefault(); if (game) game.debug = !game.debug; }
});

// Deep link: /?room=ABX7 jumps straight to the join box.
const wanted = new URLSearchParams(location.search).get('room');
if (wanted) {
  const codeInput = document.getElementById('bc-code') as HTMLInputElement | null;
  if (codeInput) codeInput.value = wanted.toUpperCase().slice(0, 4);
}
