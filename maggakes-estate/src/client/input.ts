/** Keyboard + on-screen joystick + camera drag. */
export class Input {
  keys = new Set<string>();
  joy = { x: 0, y: 0, active: false };
  /** Camera orbit deltas accumulated since last frame. */
  orbit = { dx: 0, dy: 0, zoom: 0 };
  onKey: (key: string) => void = () => {};
  private typing = () => {
    const el = document.activeElement as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  };

  constructor(canvas: HTMLCanvasElement, joyEl: HTMLElement) {
    addEventListener('keydown', (e) => {
      if (this.typing()) return;
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.onKey(k);
      this.keys.add(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());

    // Camera drag (mouse or one finger on the canvas)
    let drag: { id: number; x: number; y: number } | null = null;
    const pinch = new Map<number, { x: number; y: number }>();
    let pinchDist = 0;
    canvas.addEventListener('pointerdown', (e) => {
      pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.size === 2) {
        const [a, b] = [...pinch.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        drag = null;
        return;
      }
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (pinch.has(e.pointerId)) pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.size === 2) {
        const [a, b] = [...pinch.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.orbit.zoom += (pinchDist - d) * 0.03;
        pinchDist = d;
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      this.orbit.dx += e.clientX - drag.x;
      this.orbit.dy += e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
    });
    const up = (e: PointerEvent) => {
      pinch.delete(e.pointerId);
      if (drag?.id === e.pointerId) drag = null;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => { this.orbit.zoom += e.deltaY * 0.01; e.preventDefault(); }, { passive: false });

    // Joystick
    const knob = joyEl.querySelector('.knob') as HTMLElement;
    let jid = -1;
    const R = 50;
    const move = (e: PointerEvent) => {
      const r = joyEl.getBoundingClientRect();
      let x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      const l = Math.hypot(x, y);
      if (l > R) { x *= R / l; y *= R / l; }
      knob.style.transform = `translate(${x}px, ${y}px)`;
      this.joy.x = x / R; this.joy.y = y / R;
    };
    joyEl.addEventListener('pointerdown', (e) => { jid = e.pointerId; joyEl.setPointerCapture(jid); this.joy.active = true; move(e); });
    joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === jid) move(e); });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== jid) return;
      jid = -1; this.joy = { x: 0, y: 0, active: false };
      knob.style.transform = '';
    };
    joyEl.addEventListener('pointerup', end);
    joyEl.addEventListener('pointercancel', end);
  }

  /** Movement intent: x = right, y = forward (both -1..1). */
  move(): { x: number; y: number } {
    if (this.typing()) return { x: 0, y: 0 };
    let x = 0, y = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) y += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y -= 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.joy.active) { x += this.joy.x; y -= this.joy.y; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  takeOrbit(): { dx: number; dy: number; zoom: number } {
    const o = this.orbit;
    this.orbit = { dx: 0, dy: 0, zoom: 0 };
    return o;
  }
}
