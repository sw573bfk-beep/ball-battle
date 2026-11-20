import { h, sheet, fill } from './dom';

/** Every mini-game resolves true when completed, false if closed early. */
type Done = (ok: boolean) => void;

function shell(title: string, hint: string, body: HTMLElement, done: Done): { finish: () => void; close: () => void } {
  let finished = false;
  const wrap = h('div.mg', {}, h('p.mg-hint', {}, hint), body);
  const close = sheet(title, wrap, { onClose: () => { if (!finished) done(false); }, className: 'mg-modal' });
  return {
    finish: () => {
      finished = true;
      fill(wrap, h('div.mg-win', {}, h('div.big', {}, '✨'), h('h3', {}, 'Task complete!')));
      setTimeout(() => { close(); done(true); }, 900);
    },
    close,
  };
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

/** Tap the steps in the right order. */
export function sequenceGame(title: string, hint: string, steps: string[], done: Done): void {
  let next = 0;
  const progress = h('div.mg-steps', {}, ...steps.map((s, i) => h('span.step', { 'data-i': i }, `${i + 1}`)));
  const grid = h('div.mg-grid');
  const body = h('div', {}, progress, grid);
  const g = shell(title, hint, body, done);
  for (const s of shuffle(steps)) {
    const btn = h('button.mg-tile', {
      onclick: () => {
        if (s === steps[next]) {
          btn.classList.add('used'); btn.disabled = true;
          progress.children[next].classList.add('ok');
          progress.children[next].textContent = s.split(' ')[0];
          next++;
          if (next === steps.length) g.finish();
        } else {
          btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
        }
      },
    }, h('span.e', {}, s.split(' ')[0]), h('span', {}, s.split(' ').slice(1).join(' ')));
    grid.append(btn);
  }
}

/** Hold the button to fill the meter. */
export function holdGame(title: string, hint: string, done: Done): void {
  let v = 0, holding = false, raf = 0, last = performance.now();
  const fill = h('div.fill');
  const meter = h('div.mg-meter', {}, fill);
  const bubbles = h('div.mg-bubbles');
  const btn = h('button.mg-hold', {}, '🧽 Hold to scrub');
  const body = h('div', {}, bubbles, meter, btn);
  const g = shell(title, hint, body, (ok) => { cancelAnimationFrame(raf); done(ok); });
  const start = (e: Event) => { e.preventDefault(); holding = true; btn.classList.add('on'); };
  const stop = () => { holding = false; btn.classList.remove('on'); };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointerleave', stop);
  addEventListener('keydown', function k(e) { if (e.key === ' ') { holding = true; } if (!document.body.contains(btn)) removeEventListener('keydown', k); });
  addEventListener('keyup', function k(e) { if (e.key === ' ') holding = false; if (!document.body.contains(btn)) removeEventListener('keyup', k); });
  const loop = (t: number) => {
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    v = Math.max(0, Math.min(1, v + (holding ? dt / 2.6 : -dt / 8)));
    fill.style.width = `${v * 100}%`;
    if (holding && Math.random() < 0.3) {
      const b = h('i', { style: { left: `${10 + Math.random() * 80}%` } }, ['🫧', '✨', '🧼'][Math.floor(Math.random() * 3)]);
      bubbles.append(b);
      setTimeout(() => b.remove(), 1000);
    }
    if (v >= 1) { g.finish(); return; }
    if (document.body.contains(btn)) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

/** Stop the marker inside the sweet spot, three times. */
export function timingGame(title: string, hint: string, done: Done): void {
  let hits = 0, pos = 0, dir = 1, speed = 0.9, raf = 0, last = performance.now();
  let zone = { a: 0.4, w: 0.22 };
  const zoneEl = h('div.zone');
  const marker = h('div.marker');
  const bar = h('div.mg-bar', {}, zoneEl, marker);
  const stars = h('div.mg-stars', {}, '☆ ☆ ☆');
  const btn = h('button.mg-go', {}, 'TAP!');
  const body = h('div', {}, stars, bar, btn);
  const g = shell(title, hint, body, (ok) => { cancelAnimationFrame(raf); done(ok); });
  const place = () => {
    zone = { a: 0.08 + Math.random() * (0.84 - zone.w), w: Math.max(0.12, 0.22 - hits * 0.04) };
    zoneEl.style.left = `${zone.a * 100}%`;
    zoneEl.style.width = `${zone.w * 100}%`;
  };
  place();
  const tap = () => {
    if (pos >= zone.a && pos <= zone.a + zone.w) {
      hits++;
      stars.textContent = '★ '.repeat(hits) + '☆ '.repeat(3 - hits);
      bar.classList.add('hit'); setTimeout(() => bar.classList.remove('hit'), 250);
      speed += 0.35;
      if (hits >= 3) { g.finish(); return; }
      place();
    } else {
      bar.classList.remove('miss'); void bar.offsetWidth; bar.classList.add('miss');
    }
  };
  btn.onclick = tap;
  addEventListener('keydown', function k(e) { if (!document.body.contains(btn)) { removeEventListener('keydown', k); return; } if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tap(); } });
  const loop = (t: number) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    pos += dir * speed * dt;
    if (pos > 1) { pos = 1; dir = -1; } else if (pos < 0) { pos = 0; dir = 1; }
    marker.style.left = `${pos * 100}%`;
    if (document.body.contains(btn)) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

/** Watch the pads light up, then repeat the pattern. 3 rounds. */
export function simonGame(title: string, hint: string, done: Done): void {
  const pads = [
    { e: '🎵', c: '#ff6f91', f: 330 }, { e: '🎹', c: '#4fd1c5', f: 392 },
    { e: '🥁', c: '#ffd23f', f: 494 }, { e: '🎤', c: '#9b7ede', f: 587 },
  ];
  let round = 0, seq: number[] = [], idx = 0, locked = true;
  const status = h('div.mg-status', {}, 'Watch…');
  const grid = h('div.mg-pads');
  const body = h('div', {}, status, grid);
  const g = shell(title, hint, body, done);
  let ctx: AudioContext | null = null;
  const beep = (f: number) => {
    try {
      ctx ??= new AudioContext();
      const o = ctx.createOscillator(), gn = ctx.createGain();
      o.frequency.value = f; o.type = 'triangle';
      gn.gain.setValueAtTime(0.15, ctx.currentTime); gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      o.connect(gn).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.36);
    } catch { /* no audio */ }
  };
  const els = pads.map((p, i) => {
    const b = h('button.pad', { style: { '--c': p.c }, onclick: () => press(i) }, p.e);
    grid.append(b);
    return b;
  });
  const flash = (i: number) => { els[i].classList.add('lit'); beep(pads[i].f); setTimeout(() => els[i].classList.remove('lit'), 320); };
  const play = () => {
    locked = true; status.textContent = `Round ${round + 1} of 3 — watch…`;
    seq.forEach((p, k) => setTimeout(() => flash(p), 600 + k * 520));
    setTimeout(() => { locked = false; idx = 0; status.textContent = 'Your turn!'; }, 600 + seq.length * 520);
  };
  const press = (i: number) => {
    if (locked) return;
    flash(i);
    if (seq[idx] !== i) { status.textContent = 'Oops! Watch again…'; grid.classList.add('shake'); setTimeout(() => grid.classList.remove('shake'), 400); setTimeout(play, 700); return; }
    idx++;
    if (idx === seq.length) {
      round++;
      if (round === 3) { setTimeout(() => g.finish(), 350); return; }
      seq.push(Math.floor(Math.random() * 4));
      setTimeout(play, 700);
    }
  };
  seq = [0, 1, 2].map(() => Math.floor(Math.random() * 4));
  play();
}

/** Multiple-choice questions. */
export function choiceGame(title: string, hint: string, qs: { q: string; options: string[]; answer: number }[], done: Done): void {
  let i = 0;
  const box = h('div.mg-quiz');
  const g = shell(title, hint, box, done);
  const show = () => {
    const q = qs[i];
    fill(box, 
      h('div.mg-q', {}, h('small', {}, `Question ${i + 1} of ${qs.length}`), h('p', {}, q.q)),
      ...q.options.map((o, k) => {
        const b = h('button.mg-opt', {
          onclick: () => {
            if (k === q.answer) {
              b.classList.add('right');
              i++;
              setTimeout(() => (i >= qs.length ? g.finish() : show()), 450);
            } else {
              b.classList.add('wrong'); b.disabled = true;
            }
          },
        }, o);
        return b;
      }),
    );
  };
  show();
}
