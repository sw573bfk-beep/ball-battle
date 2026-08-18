/**
 * Keyboard + mouse -> InputCmd.
 * All bindings come from config so Milestone 13 can rebind them in one place.
 */

import { DEFAULT_BINDINGS, type BindingAction } from '@shared/config.js';
import { BTN, emptyInput, type InputCmd } from '@shared/types.js';
import type { Viewport } from './viewport.js';

type Bindings = Record<BindingAction, string[]>;

export class InputManager {
  private held = new Set<string>();
  /** Actions pressed since the last consume() — guarantees no dropped taps. */
  private pressed = new Set<BindingAction>();
  private mouseButtons = 0;
  private mouseX = 0;
  private mouseY = 0;
  private bindings: Bindings;
  private seq = 0;

  /** World-space aim point, updated from the pointer. */
  aimWorldX = 0;
  aimWorldY = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private viewport: Viewport,
    bindings: Partial<Bindings> = {},
  ) {
    this.bindings = { ...(DEFAULT_BINDINGS as unknown as Bindings), ...bindings };
    this.attach();
  }

  setBindings(b: Partial<Bindings>): void {
    this.bindings = { ...this.bindings, ...b };
  }

  private attach(): void {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    // Stop space/arrows scrolling the page.
    if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
    this.held.add(e.code);
    for (const action of Object.keys(this.bindings) as BindingAction[]) {
      if (this.bindings[action].includes(e.code)) this.pressed.add(action);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => { this.held.delete(e.code); };

  private onBlur = (): void => {
    this.held.clear();
    this.mouseButtons = 0;
  };

  private onPointerMove = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
  };

  private onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.mouseButtons |= 1 << e.button;
    this.onPointerMove(e);
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.mouseButtons &= ~(1 << e.button);
  };

  isDown(action: BindingAction): boolean {
    return this.bindings[action].some((code) => this.held.has(code));
  }

  /** Builds this tick's command and clears one-shot press latches. */
  consume(originX: number, originY: number): InputCmd {
    const cmd = emptyInput(++this.seq);

    cmd.moveX = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    cmd.moveY = (this.isDown('down') ? 1 : 0) - (this.isDown('up') ? 1 : 0);

    const world = this.viewport.screenToWorld(this.mouseX, this.mouseY);
    this.aimWorldX = world.x;
    this.aimWorldY = world.y;
    const ax = world.x - originX;
    const ay = world.y - originY;
    const l = Math.hypot(ax, ay);
    if (l > 1e-6) { cmd.aimX = ax / l; cmd.aimY = ay / l; }

    let buttons = 0;
    if (this.pressed.has('dash') || this.isDown('dash')) buttons |= BTN.DASH;
    if (this.mouseButtons & 1) buttons |= BTN.SHOOT;
    if (this.mouseButtons & 2 || this.pressed.has('sword') || this.isDown('sword')) buttons |= BTN.SWORD;
    if (this.pressed.has('reload')) buttons |= BTN.RELOAD;
    cmd.buttons = buttons;

    this.pressed.clear();
    return cmd;
  }
}
