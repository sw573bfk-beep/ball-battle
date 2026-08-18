/**
 * Maps the fixed logical arena onto whatever screen we're given.
 * Letterboxes rather than stretches, so every player sees the same play area.
 */

export class Viewport {
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  dpr = 1;
  cssWidth = 0;
  cssHeight = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private worldW: number,
    private worldH: number,
  ) {
    this.resize();
  }

  /** Swaps the logical arena size (used when the server picks a different map). */
  setWorldSize(w: number, h: number): void {
    this.worldW = w;
    this.worldH = h;
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;

    this.dpr = dpr;
    this.cssWidth = w;
    this.cssHeight = h;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));

    this.scale = Math.min(w / this.worldW, h / this.worldH);
    this.offsetX = (w - this.worldW * this.scale) / 2;
    this.offsetY = (h - this.worldH * this.scale) / 2;
  }

  /** Applies the world transform to a context that has just been reset. */
  apply(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.offsetX) / this.scale,
      y: (sy - this.offsetY) / this.scale,
    };
  }
}
