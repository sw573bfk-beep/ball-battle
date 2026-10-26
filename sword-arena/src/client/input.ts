/**
 * Keyboard + mouse and touch input, turned into one InputCmd per tick.
 *
 * Touch layout (Brawl-Stars style):
 *   left half  — floating move stick
 *   right half — aim stick: drag to aim, release to throw; a quick tap throws
 *                at the nearest enemy
 *   dash button — above the aim stick
 */

import type { InputCmd } from '../sim/types.js';
import { actionsFor, type Action, type Bindings } from './bindings.js';

export interface Stick {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
  /** Time the finger went down (ms), to tell a tap from a drag. */
  t0: number;
}

const STICK_RADIUS = 60;
const DEADZONE = 14;
const TAP_MS = 220;

export class Input {
  /** Key codes and mouse buttons ("Mouse0") currently held. */
  private held = new Set<string>();
  private throwLatch = false;
  private dashLatch = false;
  private mouseX = 0;
  private mouseY = 0;
  private mouseActive = false;

  touchMode = false;
  moveStick: Stick | null = null;
  aimStick: Stick | null = null;
  /** Last direction the aim stick pointed, so a released throw keeps it. */
  private touchAim = { x: 1, y: 0 };
  /** Set by a quick tap; the game resolves it to the nearest enemy. */
  autoAim = false;
  dashButton = { x: 0, y: 0, r: 34 };

  /** Fired when a menu-type action (pause, mute) is pressed. */
  onAction: ((action: Action) => void) | null = null;

  private listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [];

  /** `bindings` is shared and live: edits from the controls menu apply at once. */
  constructor(private canvas: HTMLCanvasElement, private bindings: Bindings) {
    const on = <K extends string>(t: EventTarget, type: K, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.listeners.push([t, type, fn as EventListener, opts]);
    };

    on(window, 'keydown', (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const actions = actionsFor(this.bindings, e.code);
      // Bound keys (Space, arrows, Tab...) shouldn't scroll or move focus.
      if (actions.length || e.code === 'Tab') e.preventDefault();
      if (!e.repeat) this.press(actions);
      this.held.add(e.code);
      this.touchMode = false;
    });
    on(window, 'keyup', (e: KeyboardEvent) => this.held.delete(e.code));
    on(window, 'blur', () => this.held.clear());

    on(canvas, 'mousemove', (e: MouseEvent) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.mouseActive = true;
    });
    on(canvas, 'mousedown', (e: MouseEvent) => {
      this.touchMode = false;
      const code = `Mouse${e.button}`;
      this.press(actionsFor(this.bindings, code));
      this.held.add(code);
    });
    on(window, 'mouseup', (e: MouseEvent) => this.held.delete(`Mouse${e.button}`));
    on(canvas, 'contextmenu', (e: Event) => e.preventDefault());

    on(canvas, 'touchstart', (e: TouchEvent) => this.touchStart(e), { passive: false });
    on(canvas, 'touchmove', (e: TouchEvent) => this.touchMove(e), { passive: false });
    on(canvas, 'touchend', (e: TouchEvent) => this.touchEnd(e), { passive: false });
    on(canvas, 'touchcancel', (e: TouchEvent) => this.touchEnd(e), { passive: false });
  }

  destroy(): void {
    for (const [t, type, fn, opts] of this.listeners) t.removeEventListener(type, fn, opts);
    this.listeners = [];
  }

  /** Lay out touch buttons for the current screen size (CSS pixels). */
  layout(w: number, h: number): void {
    // Right edge, above where the aim thumb usually lands.
    const r = Math.max(28, Math.min(40, Math.min(w, h) * 0.07));
    this.dashButton = { x: w - r - 18, y: h - r * 5.6, r };
  }

  private press(actions: Action[]): void {
    for (const a of actions) {
      if (a === 'throw') this.throwLatch = true;
      else if (a === 'dash') this.dashLatch = true;
      else if (a === 'pause' || a === 'mute') this.onAction?.(a);
    }
  }

  private isDown(action: Action): boolean {
    const [a, b] = this.bindings[action];
    return (!!a && this.held.has(a)) || (!!b && this.held.has(b));
  }

  // ---------------------------------------------------------------- touch

  private touchStart(e: TouchEvent): void {
    e.preventDefault();
    this.touchMode = true;
    const w = this.canvas.clientWidth;
    for (const t of Array.from(e.changedTouches)) {
      const d = this.dashButton;
      if (Math.hypot(t.clientX - d.x, t.clientY - d.y) < d.r * 1.3) {
        this.dashLatch = true;
        continue;
      }
      const stick: Stick = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY, t0: performance.now() };
      if (t.clientX < w * 0.5) { if (!this.moveStick) this.moveStick = stick; }
      else if (!this.aimStick) this.aimStick = stick;
    }
  }

  private touchMove(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      for (const s of [this.moveStick, this.aimStick]) {
        if (!s || s.id !== t.identifier) continue;
        s.x = t.clientX;
        s.y = t.clientY;
        // Drag the origin along so the stick never feels "stuck" at its edge.
        const dx = s.x - s.ox;
        const dy = s.y - s.oy;
        const d = Math.hypot(dx, dy);
        if (d > STICK_RADIUS) {
          s.ox = s.x - (dx / d) * STICK_RADIUS;
          s.oy = s.y - (dy / d) * STICK_RADIUS;
        }
        if (s === this.aimStick && d > DEADZONE) this.touchAim = { x: dx / d, y: dy / d };
      }
    }
  }

  private touchEnd(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (this.moveStick?.id === t.identifier) this.moveStick = null;
      const a = this.aimStick;
      if (a?.id === t.identifier) {
        const dragged = Math.hypot(a.x - a.ox, a.y - a.oy) > DEADZONE;
        if (dragged) this.throwLatch = true;
        else if (performance.now() - a.t0 < TAP_MS) { this.throwLatch = true; this.autoAim = true; }
        this.aimStick = null;
      }
    }
  }

  // ------------------------------------------------------------- sampling

  /**
   * Build this tick's command. `self` is the player's screen position, used to
   * turn the mouse cursor into an aim direction.
   */
  sample(self: { sx: number; sy: number }): InputCmd {
    let mx = 0;
    let my = 0;
    if (this.isDown('up')) my -= 1;
    if (this.isDown('down')) my += 1;
    if (this.isDown('left')) mx -= 1;
    if (this.isDown('right')) mx += 1;

    let ax = 1;
    let ay = 0;
    if (this.touchMode) {
      const m = this.moveStick;
      if (m) {
        const dx = m.x - m.ox;
        const dy = m.y - m.oy;
        const d = Math.hypot(dx, dy);
        if (d > DEADZONE * 0.6) {
          const mag = Math.min(1, d / STICK_RADIUS);
          mx = (dx / d) * mag;
          my = (dy / d) * mag;
        }
      }
      ax = this.touchAim.x;
      ay = this.touchAim.y;
      // With no aim stick held, face where you're walking.
      if (!this.aimStick && (mx || my)) { ax = mx; ay = my; this.touchAim = { x: mx, y: my }; }
    } else if (this.mouseActive) {
      ax = this.mouseX - self.sx;
      ay = this.mouseY - self.sy;
    } else if (mx || my) {
      ax = mx;
      ay = my;
    }

    const cmd: InputCmd = { moveX: mx, moveY: my, aimX: ax, aimY: ay, throw: this.throwLatch, dash: this.dashLatch };
    this.throwLatch = false;
    this.dashLatch = false;
    return cmd;
  }

  /** Clear latched presses (e.g. a click on "Play" shouldn't throw). */
  reset(): void {
    this.throwLatch = this.dashLatch = this.autoAim = false;
    this.held.clear();
    this.moveStick = this.aimStick = null;
  }

  static readonly STICK_RADIUS = STICK_RADIUS;
}
