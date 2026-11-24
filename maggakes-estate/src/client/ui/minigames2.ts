import { h, fill } from './dom';
import { shell, shuffle, type Done } from './minigames';

/**
 * Six more task mini-games: catch, memory, rhythm, spot-the-odd-one, maze and unscramble.
 * Each one works with mouse, touch and keyboard, and calls done(true) when won.
 */

/** Move the basket to catch the good things and dodge the bad ones. */
export function catchGame(title: string, hint: string, item: string, bad: string, goal: number, done: Done): void {
  const W = 300, H = 320;
  const field = h('div.mg-field', { style: { width: `${W}px`, height: `${H}px` } });
  const basket = h('div.mg-basket', {}, '🧺');
  const score = h('div.mg-status', {}, `Caught 0 / ${goal}`);
  field.append(basket);
  const body = h('div', {}, score, field, h('div.row.mg-lr', {}, h('button.btn', { onpointerdown: () => { dir = -1; }, onpointerup: () => { dir = 0; }, onpointerleave: () => { dir = 0; } }, '◀'), h('button.btn', { onpointerdown: () => { dir = 1; }, onpointerup: () => { dir = 0; }, onpointerleave: () => { dir = 0; } }, '▶')));
  let x = W / 2, dir = 0, caught = 0, raf = 0, last = performance.now(), spawn = 0, over = false;
  const drops: { el: HTMLElement; x: number; y: number; v: number; good: boolean }[] = [];
  const key = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft' || e.key === 'a') dir = e.type === 'keydown' ? -1 : 0; if (e.key === 'ArrowRight' || e.key === 'd') dir = e.type === 'keydown' ? 1 : 0; };
  addEventListener('keydown', key); addEventListener('keyup', key);
  field.onpointermove = (e) => { const r = field.getBoundingClientRect(); x = Math.max(20, Math.min(W - 20, e.clientX - r.left)); };
  const stop = () => { over = true; cancelAnimationFrame(raf); removeEventListener('keydown', key); removeEventListener('keyup', key); };
  const g = shell(title, hint, body, (ok) => { stop(); done(ok); });
  const tick = (now: number) => {
    if (over) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    x = Math.max(20, Math.min(W - 20, x + dir * 260 * dt));
    basket.style.left = `${x - 20}px`;
    spawn -= dt;
    if (spawn <= 0) {
      spawn = 0.55 + Math.random() * 0.35;
      const good = Math.random() > 0.28;
      const el = h('div.mg-drop', {}, good ? item : bad);
      field.append(el);
      drops.push({ el, x: 20 + Math.random() * (W - 40), y: -30, v: 110 + Math.random() * 70 + caught * 6, good });
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += d.v * dt;
      d.el.style.transform = `translate(${d.x - 15}px, ${d.y}px)`;
      if (d.y > H - 58 && d.y < H - 20 && Math.abs(d.x - x) < 32) {
        d.el.remove(); drops.splice(i, 1);
        if (d.good) caught++; else { caught = Math.max(0, caught - 1); field.classList.remove('shake'); void field.offsetWidth; field.classList.add('shake'); }
        score.textContent = `Caught ${caught} / ${goal}`;
        if (caught >= goal) { stop(); g.finish(); return; }
      } else if (d.y > H) { d.el.remove(); drops.splice(i, 1); }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

/** Flip cards two at a time and find all the pairs. */
export function memoryGame(title: string, hint: string, symbols: string[], done: Done): void {
  const cards = shuffle([...symbols, ...symbols]);
  let open: number[] = [], found = 0, locked = false;
  const status = h('div.mg-status', {}, `Pairs found: 0 / ${symbols.length}`);
  const grid = h('div.mg-memory', { style: { gridTemplateColumns: `repeat(${cards.length > 12 ? 4 : cards.length > 8 ? 4 : 3}, 1fr)` } });
  const body = h('div', {}, status, grid);
  const g = shell(title, hint, body, done);
  const els = cards.map((sym, i) => {
    const b = h('button.mg-card', { onclick: () => {
      if (locked || open.includes(i) || b.classList.contains('done')) return;
      b.classList.add('up'); b.textContent = sym; open.push(i);
      if (open.length === 2) {
        const [a, c] = open;
        if (cards[a] === cards[c]) {
          els[a].classList.add('done'); els[c].classList.add('done'); open = []; found++;
          status.textContent = `Pairs found: ${found} / ${symbols.length}`;
          if (found === symbols.length) setTimeout(() => g.finish(), 300);
        } else {
          locked = true;
          setTimeout(() => { for (const k of open) { els[k].classList.remove('up'); els[k].textContent = '❔'; } open = []; locked = false; }, 750);
        }
      }
    } }, '❔');
    grid.append(b);
    return b;
  });
}

/** Notes slide down three lanes — tap the lane when a note reaches the line. */
export function rhythmGame(title: string, hint: string, done: Done): void {
  const LANES = 3, H = 280, LINE = H - 40, GOAL = 12;
  const lanes = [0, 1, 2].map(() => h('div.mg-lane'));
  const field = h('div.mg-rhythm', { style: { height: `${H}px` } }, ...lanes, h('div.mg-line', { style: { top: `${LINE}px` } }));
  const status = h('div.mg-status', {}, `Hits: 0 / ${GOAL}`);
  const keys = ['a', 's', 'd'];
  const btns = [0, 1, 2].map((i) => h('button.btn.mg-tap', { onpointerdown: () => hit(i) }, ['🎵', '🎶', '🎤'][i] + ` ${keys[i].toUpperCase()}`));
  const body = h('div', {}, status, field, h('div.row.mg-lr', {}, ...btns));
  let hits = 0, raf = 0, last = performance.now(), spawn = 0.6, over = false, speed = 140;
  const notes: { el: HTMLElement; lane: number; y: number }[] = [];
  const key = (e: KeyboardEvent) => { const i = keys.indexOf(e.key.toLowerCase()); if (i >= 0) hit(i); };
  addEventListener('keydown', key);
  const stop = () => { over = true; cancelAnimationFrame(raf); removeEventListener('keydown', key); };
  const g = shell(title, hint, body, (ok) => { stop(); done(ok); });
  const flash = (i: number, good: boolean) => { lanes[i].classList.remove('hit', 'miss'); void lanes[i].offsetWidth; lanes[i].classList.add(good ? 'hit' : 'miss'); };
  function hit(i: number): void {
    if (over) return;
    const n = notes.find((n) => n.lane === i && Math.abs(n.y - LINE) < 34);
    if (n) { n.el.remove(); notes.splice(notes.indexOf(n), 1); hits++; status.textContent = `Hits: ${hits} / ${GOAL}`; flash(i, true); if (hits >= GOAL) { stop(); g.finish(); } }
    else flash(i, false);
  }
  const tick = (now: number) => {
    if (over) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    spawn -= dt;
    if (spawn <= 0) {
      spawn = 0.55 + Math.random() * 0.5;
      const lane = Math.floor(Math.random() * LANES);
      const el = h('div.mg-note', {}, '●');
      lanes[lane].append(el);
      notes.push({ el, lane, y: -20 });
    }
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      n.y += speed * dt;
      n.el.style.transform = `translateY(${n.y}px)`;
      if (n.y > H) { n.el.remove(); notes.splice(i, 1); }
    }
    speed = 140 + hits * 6;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

/** Find the one that's different, three rounds. */
export function spotGame(title: string, hint: string, pairs: [string, string][], done: Done): void {
  let round = 0;
  const status = h('div.mg-status');
  const grid = h('div.mg-spot');
  const body = h('div', {}, status, grid);
  const g = shell(title, hint, body, done);
  const play = () => {
    const [same, odd] = pairs[round % pairs.length];
    const n = 16 + round * 4;
    const oddAt = Math.floor(Math.random() * n);
    status.textContent = `Round ${round + 1} of 3 — find the odd one out!`;
    grid.style.gridTemplateColumns = `repeat(${round === 0 ? 4 : 5}, 1fr)`;
    fill(grid, ...Array.from({ length: n }, (_, i) => h('button.mg-spotcell', { onclick: (e: Event) => {
      const el = e.currentTarget as HTMLElement;
      if (i === oddAt) { round++; if (round === 3) g.finish(); else play(); }
      else { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
    } }, i === oddAt ? odd : same)));
  };
  play();
}

/** Guide the character through the maze to the goal. */
export function mazeGame(title: string, hint: string, who: string, goal: string, done: Done): void {
  const N = 9;
  // Carve a perfect maze with a randomised depth-first search (odd cells are rooms).
  const wall = Array.from({ length: N }, () => Array(N).fill(true));
  const stack: [number, number][] = [[1, 1]];
  wall[1][1] = false;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const next = shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]]).map(([dx, dy]) => [x + dx, y + dy, dx, dy]).filter(([nx, ny]) => nx > 0 && ny > 0 && nx < N - 1 && ny < N - 1 && wall[ny][nx]);
    if (!next.length) { stack.pop(); continue; }
    const [nx, ny, dx, dy] = next[0];
    wall[y + dy / 2][x + dx / 2] = false; wall[ny][nx] = false;
    stack.push([nx, ny]);
  }
  let px = 1, py = 1;
  const gx = N - 2, gy = N - 2;
  const grid = h('div.mg-maze', { style: { gridTemplateColumns: `repeat(${N}, 1fr)` } });
  const draw = () => fill(grid, ...wall.flatMap((row, y) => row.map((w, x) => h('div.mz' + (w ? '.w' : ''), {}, x === px && y === py ? who : x === gx && y === gy ? goal : ''))));
  const move = (dx: number, dy: number) => {
    const nx = px + dx, ny = py + dy;
    if (wall[ny]?.[nx] !== false) return;
    px = nx; py = ny; draw();
    if (px === gx && py === gy) { removeEventListener('keydown', key); g.finish(); }
  };
  const key = (e: KeyboardEvent) => {
    const m: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
    const d = m[e.key]; if (d) { e.preventDefault(); move(d[0], d[1]); }
  };
  addEventListener('keydown', key);
  const pad = h('div.mg-dpad', {},
    h('button.btn', { onclick: () => move(0, -1) }, '▲'),
    h('div.row', {}, h('button.btn', { onclick: () => move(-1, 0) }, '◀'), h('button.btn', { onclick: () => move(0, 1) }, '▼'), h('button.btn', { onclick: () => move(1, 0) }, '▶')));
  const body = h('div', {}, grid, pad);
  const g = shell(title, hint, body, (ok) => { removeEventListener('keydown', key); done(ok); });
  draw();
}

/** Tap the letters in the right order to spell each word. */
export function unscrambleGame(title: string, hint: string, words: string[], done: Done): void {
  const list = shuffle(words).slice(0, 3);
  let round = 0, typed = '';
  const status = h('div.mg-status');
  const answer = h('div.mg-answer');
  const tiles = h('div.mg-letters');
  const body = h('div', {}, status, answer, tiles, h('div.row.mg-lr', {}, h('button.btn.ghost', { onclick: () => { typed = ''; play(); } }, '↺ Start again')));
  const g = shell(title, hint, body, done);
  const play = () => {
    const word = list[round].toUpperCase();
    status.textContent = `Word ${round + 1} of 3`;
    let letters = shuffle([...word]);
    if (letters.join('') === word && word.length > 1) letters = [...letters.slice(1), letters[0]];
    answer.textContent = word.split('').map((_, i) => typed[i] ?? '_').join(' ');
    fill(tiles, ...letters.map((ch) => {
      const b = h('button.mg-letter', { onclick: () => {
        if (b.classList.contains('used')) return;
        if (word[typed.length] !== ch) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; }
        b.classList.add('used'); typed += ch;
        answer.textContent = word.split('').map((_, i) => typed[i] ?? '_').join(' ');
        if (typed === word) { typed = ''; round++; setTimeout(() => (round === 3 ? g.finish() : play()), 350); }
      } }, ch);
      return b;
    }));
  };
  play();
}
