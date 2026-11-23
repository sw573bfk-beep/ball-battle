import * as THREE from 'three';

/** Procedural textures drawn on canvases, so the game needs no image files. */

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

function finish(c: HTMLCanvasElement, repeat = 1, srgb = true): THREE.Texture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function rand(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return `#${c.getHexString()}`;
}

export type FloorMat = 'wood' | 'darkwood' | 'marble' | 'tile' | 'carpet' | 'pinkcarpet' | 'concrete' | 'grass' | 'deck' | 'rubber' | 'sand' | 'terrazzo' | 'stone';

/** Base colour textures for floors. Tiled 1 repeat per 4 metres. */
export function floorTexture(kind: FloorMat, tint?: string): THREE.Texture {
  const key = `floor:${kind}:${tint ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas(512, 512);
  const r = rand(kind.length * 97 + (tint ? parseInt(tint.slice(1), 16) : 0));
  const base = tint ?? ({
    wood: '#c99a6b', darkwood: '#6e4a33', marble: '#f2eee9', tile: '#e9eef0', carpet: '#d8cdc2', pinkcarpet: '#f3cfdc',
    concrete: '#8d8f93', grass: '#5d9a49', deck: '#b07a4f', rubber: '#3a3d44', sand: '#ecd9a8', terrazzo: '#eae4dc', stone: '#cfc6b8',
  } as Record<FloorMat, string>)[kind];
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);

  if (kind === 'wood' || kind === 'darkwood' || kind === 'deck') {
    const plank = kind === 'deck' ? 64 : 48;
    for (let y = 0; y < 512; y += plank) {
      let x = -r() * 300;
      while (x < 512) {
        const len = 180 + r() * 220;
        g.fillStyle = shade(base, (r() - 0.5) * 0.08);
        g.fillRect(x, y, len, plank);
        for (let i = 0; i < 14; i++) {
          g.strokeStyle = `rgba(60,30,10,${0.05 + r() * 0.07})`;
          g.lineWidth = 1 + r() * 1.5;
          g.beginPath();
          const yy = y + r() * plank;
          g.moveTo(x, yy);
          g.bezierCurveTo(x + len * 0.3, yy + (r() - 0.5) * 6, x + len * 0.7, yy + (r() - 0.5) * 6, x + len, yy);
          g.stroke();
        }
        g.fillStyle = 'rgba(40,20,5,0.35)';
        g.fillRect(x, y, 2, plank);
        x += len;
      }
      g.fillStyle = 'rgba(40,20,5,0.4)';
      g.fillRect(0, y, 512, kind === 'deck' ? 5 : 2);
    }
  } else if (kind === 'marble' || kind === 'stone') {
    const sz = 256;
    for (let y = 0; y < 512; y += sz) for (let x = 0; x < 512; x += sz) {
      g.fillStyle = shade(base, (r() - 0.5) * 0.04);
      g.fillRect(x, y, sz, sz);
    }
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = kind === 'marble' ? `rgba(150,140,135,${0.12 + r() * 0.25})` : `rgba(120,110,95,${0.1 + r() * 0.15})`;
      g.lineWidth = 0.5 + r() * 2;
      g.beginPath();
      let x = r() * 512, y = r() * 512;
      g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (r() - 0.3) * 90; y += (r() - 0.5) * 90; g.lineTo(x, y); }
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2;
    for (let p = 0; p <= 512; p += sz) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 512); g.moveTo(0, p); g.lineTo(512, p); g.stroke(); }
  } else if (kind === 'tile') {
    const sz = 64;
    for (let y = 0; y < 512; y += sz) for (let x = 0; x < 512; x += sz) {
      g.fillStyle = shade(base, (r() - 0.5) * 0.05);
      g.fillRect(x + 2, y + 2, sz - 4, sz - 4);
    }
    g.fillStyle = 'rgba(120,130,140,0.5)';
    for (let p = 0; p < 512; p += sz) { g.fillRect(p, 0, 2, 512); g.fillRect(0, p, 512, 2); }
  } else if (kind === 'carpet' || kind === 'pinkcarpet' || kind === 'rubber') {
    const img = g.getImageData(0, 0, 512, 512);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (r() - 0.5) * (kind === 'rubber' ? 18 : 26);
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    if (kind === 'rubber') {
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let p = 0; p < 512; p += 128) { g.fillRect(p, 0, 3, 512); g.fillRect(0, p, 512, 3); }
    }
  } else if (kind === 'concrete') {
    const img = g.getImageData(0, 0, 512, 512);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (r() - 0.5) * 22;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.06})`;
      g.beginPath(); g.arc(r() * 512, r() * 512, 10 + r() * 60, 0, Math.PI * 2); g.fill();
    }
  } else if (kind === 'grass') {
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = shade(base, (r() - 0.5) * 0.18);
      g.fillRect(r() * 512, r() * 512, 1.5, 4 + r() * 5);
    }
  } else if (kind === 'sand') {
    for (let i = 0; i < 12000; i++) {
      g.fillStyle = shade(base, (r() - 0.5) * 0.12);
      g.fillRect(r() * 512, r() * 512, 2, 2);
    }
  } else if (kind === 'terrazzo') {
    for (let i = 0; i < 900; i++) {
      g.fillStyle = ['#d9b8a8', '#a7a29b', '#f7f3ee', '#c7cfd2', '#e8c9b6'][Math.floor(r() * 5)];
      g.beginPath();
      g.ellipse(r() * 512, r() * 512, 2 + r() * 6, 2 + r() * 4, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = finish(c);
  cache.set(key, t);
  return t;
}

/** Text drawn on a transparent canvas (signs, labels, posters). */
export function textTexture(text: string, opts: { color?: string; bg?: string; font?: string; w?: number; h?: number; glow?: string; size?: number } = {}): THREE.Texture {
  const key = `text:${text}:${JSON.stringify(opts)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const w = opts.w ?? 512, h = opts.h ?? 128;
  const [c, g] = canvas(w, h);
  if (opts.bg) { g.fillStyle = opts.bg; g.fillRect(0, 0, w, h); }
  g.font = opts.font ?? `bold ${opts.size ?? Math.floor(h * 0.6)}px "Segoe UI", system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (opts.glow) { g.shadowColor = opts.glow; g.shadowBlur = h * 0.15; }
  g.fillStyle = opts.color ?? '#fff';
  const lines = text.split('\n');
  const lh = h / (lines.length + 0.4);
  lines.forEach((ln, i) => g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
  const t = finish(c, 1);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(key, t);
  return t;
}

export type PosterKind = 'ocean' | 'sixseven' | 'concert' | 'vinyl' | 'brainrot' | 'beach' | 'music' | 'abstract' | 'sunset' | 'star' | 'trident' | 'flower';

/** Little illustrated posters for themed bedrooms. */
export function posterTexture(kind: PosterKind): THREE.Texture {
  const key = `poster:${kind}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas(256, 352);
  const r = rand(kind.length * 31);
  const grad = (a: string, b: string) => {
    const gr = g.createLinearGradient(0, 0, 0, 352);
    gr.addColorStop(0, a); gr.addColorStop(1, b);
    g.fillStyle = gr; g.fillRect(0, 0, 256, 352);
  };
  const title = (t: string, color = '#fff', y = 310, size = 34) => {
    g.font = `900 ${size}px "Segoe UI", system-ui, sans-serif`;
    g.textAlign = 'center'; g.fillStyle = color; g.fillText(t, 128, y);
  };
  switch (kind) {
    case 'ocean':
    case 'trident': {
      grad('#0a4d8c', '#04203d');
      for (let i = 0; i < 6; i++) {
        g.strokeStyle = `rgba(120,210,255,${0.25 + i * 0.1})`; g.lineWidth = 6;
        g.beginPath();
        for (let x = 0; x <= 256; x += 8) g.lineTo(x, 200 + i * 18 + Math.sin(x / 20 + i) * 8);
        g.stroke();
      }
      g.strokeStyle = '#ffd56b'; g.lineWidth = 8;
      g.beginPath(); g.moveTo(128, 60); g.lineTo(128, 190);
      g.moveTo(88, 60); g.lineTo(88, 100); g.quadraticCurveTo(128, 130, 168, 100); g.lineTo(168, 60); g.stroke();
      title(kind === 'ocean' ? 'SON OF THE SEA' : 'DEMIGOD', '#bfe9ff', 320, 26);
      break;
    }
    case 'sixseven': {
      grad('#141414', '#2b2b2b');
      g.font = '900 170px "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center';
      g.shadowColor = '#33e1ff'; g.shadowBlur = 25; g.fillStyle = '#33e1ff'; g.fillText('67', 128, 220);
      g.shadowBlur = 0; title('SIX SEVEN', '#fff', 315, 30);
      break;
    }
    case 'concert': {
      grad('#1a0628', '#5c1a5e');
      for (let i = 0; i < 7; i++) {
        g.fillStyle = `rgba(255,${120 + i * 15},220,0.18)`;
        g.beginPath(); g.moveTo(40 + i * 30, 0); g.lineTo(0 + i * 40, 260); g.lineTo(60 + i * 40, 260); g.fill();
      }
      g.fillStyle = '#000'; g.fillRect(0, 240, 256, 112);
      g.beginPath(); g.arc(128, 215, 26, 0, Math.PI * 2); g.fill(); g.fillRect(108, 230, 40, 40);
      title('THE KID LAROI', '#ffb3f0', 300, 26); title('WORLD TOUR', '#fff', 330, 18);
      break;
    }
    case 'vinyl':
    case 'music': {
      grad(kind === 'vinyl' ? '#f4d35e' : '#ee964b', '#f95738');
      g.fillStyle = '#111'; g.beginPath(); g.arc(128, 150, 90, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 8; i++) { g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1; g.beginPath(); g.arc(128, 150, 30 + i * 8, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = '#fff2'; g.beginPath(); g.arc(128, 150, 26, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f95738'; g.beginPath(); g.arc(128, 150, 22, 0, Math.PI * 2); g.fill();
      title(kind === 'vinyl' ? 'VINYL CLUB' : 'MUSIC IS LIFE', '#111', 310, 28);
      break;
    }
    case 'brainrot': {
      grad('#7bdff2', '#b2f7ef');
      // shark in sneakers
      g.fillStyle = '#5b7ea4';
      g.beginPath(); g.ellipse(128, 150, 80, 38, -0.1, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(120, 115); g.lineTo(140, 70); g.lineTo(155, 118); g.fill();
      g.beginPath(); g.moveTo(205, 150); g.lineTo(240, 120); g.lineTo(240, 180); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(110, 165, 50, 14, -0.1, 0, Math.PI); g.fill();
      g.fillStyle = '#111'; g.beginPath(); g.arc(80, 140, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2f80ed'; g.fillRect(85, 188, 34, 30); g.fillRect(140, 188, 34, 30);
      g.fillStyle = '#fff'; g.fillRect(80, 212, 44, 12); g.fillRect(135, 212, 44, 12);
      title('TRALALERO', '#ff3d7f', 280, 32); title('TRALALA', '#ff3d7f', 318, 32);
      break;
    }
    case 'beach':
    case 'sunset': {
      grad(kind === 'beach' ? '#8fd3ff' : '#ff9a8b', kind === 'beach' ? '#e0f7ff' : '#ffd194');
      g.fillStyle = kind === 'beach' ? '#ffe066' : '#ff6a3d';
      g.beginPath(); g.arc(128, 140, 46, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2a9df4'; g.fillRect(0, 190, 256, 70);
      g.fillStyle = '#f2d49b'; g.fillRect(0, 255, 256, 97);
      g.strokeStyle = '#5a3b1e'; g.lineWidth = 7; g.beginPath(); g.moveTo(40, 300); g.quadraticCurveTo(50, 200, 70, 150); g.stroke();
      g.fillStyle = '#2f9e44';
      for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(70, 150, 40, 9, i * 1.25, 0, Math.PI * 2); g.fill(); }
      title(kind === 'beach' ? 'SALTY HAIR' : 'GOLDEN HOUR', '#fff', 330, 28);
      break;
    }
    case 'star': {
      grad('#20124d', '#000');
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${r()})`; g.fillRect(r() * 256, r() * 352, 2, 2); }
      g.fillStyle = '#ffd23f'; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? 30 : 75; g.lineTo(128 + Math.cos(a) * rr, 160 + Math.sin(a) * rr); }
      g.fill(); title('SUPERSTAR', '#ffd23f', 310, 30);
      break;
    }
    case 'flower': {
      grad('#ffe3ec', '#ffc2d4');
      for (let k = 0; k < 3; k++) {
        const cx = 70 + k * 60, cy = 120 + (k % 2) * 60;
        g.fillStyle = ['#ff6b9a', '#ffa94d', '#c77dff'][k];
        for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(cx + Math.cos(i) * 18, cy + Math.sin(i) * 18, 16, 10, i, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#ffe066'; g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.fill();
      }
      title('BLOOM', '#d6336c', 310, 34);
      break;
    }
    default: {
      grad('#f8f0e3', '#efe3d0');
      for (let i = 0; i < 6; i++) {
        g.fillStyle = ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f'][i % 4];
        g.beginPath(); g.arc(40 + r() * 180, 40 + r() * 250, 20 + r() * 50, 0, Math.PI * 2); g.fill();
      }
    }
  }
  g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(0, 0, 256, 352);
  const t = finish(c, 1);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(key, t);
  return t;
}

/** Soft round glow used for sparkles, lights and pickups. */
export function glowTexture(): THREE.Texture {
  const key = 'glow';
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = finish(c, 1);
  cache.set(key, t);
  return t;
}

/** Emoji drawn into a texture (for floating icons above stations). */
export function emojiTexture(emoji: string, ring?: string): THREE.Texture {
  const key = `emoji:${emoji}:${ring ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas(128, 128);
  if (ring) {
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
    g.strokeStyle = ring; g.lineWidth = 8; g.stroke();
  }
  g.font = '72px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(emoji, 64, 70);
  const t = finish(c, 1);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  cache.set(key, t);
  return t;
}

/** Name tag above a player. */
export function nameTexture(name: string, vip: boolean, sub?: string, color?: string, badge?: string): THREE.Texture {
  const [c, g] = canvas(512, 160);
  g.font = 'bold 64px "Segoe UI", system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const label = `${badge ? `${badge} ` : ''}${vip ? '⭐ ' : ''}${name}`;
  const w = Math.min(500, g.measureText(label).width + 60);
  if (color) {
    // Custom tag colour: tinted pill with readable text.
    const lum = parseInt(color.slice(1, 3), 16) * 0.3 + parseInt(color.slice(3, 5), 16) * 0.59 + parseInt(color.slice(5, 7), 16) * 0.11;
    g.fillStyle = color;
    g.globalAlpha = 0.88;
    roundRect(g, 256 - w / 2, 14, w, 84, 42); g.fill();
    g.globalAlpha = 1;
    g.fillStyle = lum > 150 ? '#2a1f2d' : '#ffffff';
  } else {
    g.fillStyle = vip ? 'rgba(60,40,0,0.7)' : 'rgba(20,20,30,0.55)';
    roundRect(g, 256 - w / 2, 14, w, 84, 42); g.fill();
    g.fillStyle = vip ? '#ffd76a' : '#fff';
  }
  g.fillText(label, 256, 58);
  if (sub) {
    g.font = 'bold 36px "Segoe UI", system-ui, sans-serif';
    g.fillStyle = '#ff9cc8';
    g.fillText(sub, 256, 130);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function bubbleTexture(text: string): THREE.Texture {
  const [c, g] = canvas(512, 192);
  g.font = 'bold 40px "Segoe UI", system-ui, sans-serif';
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (g.measureText(t).width > 440 && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 3);
  const bw = Math.min(500, Math.max(...shown.map((l) => g.measureText(l).width)) + 50);
  const bh = shown.length * 46 + 30;
  g.fillStyle = 'rgba(255,255,255,0.95)';
  roundRect(g, 256 - bw / 2, 180 - bh - 14, bw, bh, 26); g.fill();
  g.beginPath(); g.moveTo(240, 166); g.lineTo(256, 190); g.lineTo(272, 166); g.fill();
  g.fillStyle = '#222'; g.textAlign = 'center'; g.textBaseline = 'middle';
  shown.forEach((l, i) => g.fillText(l, 256, 180 - bh - 14 + 38 + i * 46));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Night-city skyline used as a backdrop behind the window walls. */
export function skylineTexture(night: boolean): THREE.Texture {
  const key = `skyline:${night}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas(2048, 256);
  const r = rand(7);
  let x = 0;
  while (x < 2048) {
    const w = 40 + r() * 90, h = 40 + r() * 190;
    g.fillStyle = night ? `rgb(${20 + r() * 20},${25 + r() * 20},${45 + r() * 25})` : `rgb(${150 + r() * 40},${170 + r() * 30},${190 + r() * 30})`;
    g.fillRect(x, 256 - h, w, h);
    for (let wy = 256 - h + 8; wy < 250; wy += 12) for (let wx = x + 5; wx < x + w - 6; wx += 10) {
      if (r() < (night ? 0.45 : 0.25)) {
        g.fillStyle = night ? `rgba(255,${200 + r() * 55},${120 + r() * 80},${0.6 + r() * 0.4})` : 'rgba(255,255,255,0.35)';
        g.fillRect(wx, wy, 5, 6);
      }
    }
    x += w + r() * 8;
  }
  const t = finish(c, 1);
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(3, 1);
  cache.set(key, t);
  return t;
}

/** Fine strand texture for hair (white, tinted by the material colour). */
export function hairTexture(): THREE.Texture {
  const key = 'hair';
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 256, 256);
  const r = rand(42);
  for (let i = 0; i < 1400; i++) {
    const x = r() * 256;
    const v = 150 + Math.floor(r() * 105);
    g.strokeStyle = `rgba(${v},${v},${v},${0.35 + r() * 0.5})`;
    g.lineWidth = 0.6 + r() * 1.4;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + (r() - 0.5) * 10, 85, x + (r() - 0.5) * 10, 170, x + (r() - 0.5) * 6, 256);
    g.stroke();
  }
  for (let i = 0; i < 300; i++) {
    g.strokeStyle = `rgba(60,60,60,${0.15 + r() * 0.2})`;
    g.lineWidth = 0.8;
    const x = r() * 256;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 8, 256); g.stroke();
  }
  const t = finish(c, 1);
  t.repeat.set(3, 1);
  cache.set(key, t);
  return t;
}
