/**
 * Rebindable controls. Each action has two slots; a slot holds a
 * KeyboardEvent.code ("KeyF", "Space") or a mouse button ("Mouse0" = left,
 * "Mouse1" = middle, "Mouse2" = right). Saved in this browser only.
 */

export const ACTIONS = ['up', 'down', 'left', 'right', 'throw', 'dash', 'pause', 'mute'] as const;
export type Action = (typeof ACTIONS)[number];
export type Bindings = Record<Action, [string, string]>;

export const ACTION_LABELS: Record<Action, string> = {
  up: 'Move up',
  down: 'Move down',
  left: 'Move left',
  right: 'Move right',
  throw: 'Throw sword',
  dash: 'Dash',
  pause: 'Pause',
  mute: 'Mute sound',
};

export const DEFAULT_BINDINGS: Bindings = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  throw: ['Space', 'Mouse0'],
  dash: ['ShiftLeft', 'Mouse2'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM', ''],
};

const STORE_KEY = 'sa.bindings';

export function loadBindings(): Bindings {
  const out = cloneBindings(DEFAULT_BINDINGS);
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<Bindings> | null;
    if (saved) {
      for (const a of ACTIONS) {
        const v = saved[a];
        if (Array.isArray(v) && v.length === 2 && v.every((c) => typeof c === 'string')) out[a] = [v[0], v[1]];
      }
    }
  } catch { /* storage blocked or corrupt: use defaults */ }
  return out;
}

export function saveBindings(b: Bindings): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(b)); } catch { /* ignore */ }
}

export function cloneBindings(b: Bindings): Bindings {
  const out = {} as Bindings;
  for (const a of ACTIONS) out[a] = [b[a][0], b[a][1]];
  return out;
}

/** Put `code` in one slot, removing it from wherever else it was bound. */
export function assign(b: Bindings, action: Action, slot: 0 | 1, code: string): void {
  if (code) {
    for (const a of ACTIONS) {
      for (const s of [0, 1] as const) if (b[a][s] === code) b[a][s] = '';
    }
  }
  b[action][slot] = code;
}

/** Which actions a key or mouse code triggers. */
export function actionsFor(b: Bindings, code: string): Action[] {
  if (!code) return [];
  return ACTIONS.filter((a) => b[a][0] === code || b[a][1] === code);
}

const NAMED: Record<string, string> = {
  Space: 'Space', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace',
  ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
  AltLeft: 'L-Alt', AltRight: 'R-Alt', CapsLock: 'Caps',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Mouse0: 'Left click', Mouse1: 'Middle click', Mouse2: 'Right click',
  Mouse3: 'Mouse 4', Mouse4: 'Mouse 5',
};

/** Human label for a binding code, e.g. "KeyF" -> "F". */
export function keyLabel(code: string): string {
  if (!code) return '—';
  if (NAMED[code]) return NAMED[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

/** "W / ↑" style label for both slots of an action. */
export function bindingLabel(b: Bindings, action: Action): string {
  const parts = b[action].filter(Boolean).map(keyLabel);
  return parts.length ? parts.join(' / ') : 'unbound';
}
