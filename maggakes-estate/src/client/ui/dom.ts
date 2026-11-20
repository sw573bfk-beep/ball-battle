type Child = Node | string | null | undefined | false;

/** Tiny element builder: h('div.card#id', {onclick}, ...children) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function h<T extends HTMLElement = HTMLElement & { disabled: boolean; value: string }>(sel: string, attrs: Record<string, any> = {}, ...kids: Child[]): T {
  const m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
  const tag = m?.[1] || 'div';
  const el = document.createElement(tag) as T;
  for (const part of (m?.[2] ?? '').match(/[.#][\w-]+/g) ?? []) {
    if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
  }
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) (el as any)[k] = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list') (el as any)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;

/** Opens a modal sheet; returns a close function. */
export function sheet(title: string, body: Node, opts: { wide?: boolean; onClose?: () => void; className?: string } = {}): () => void {
  const layer = $('#modals');
  const close = () => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 180); opts.onClose?.(); };
  const wrap = h('div.modal' + (opts.className ? '.' + opts.className : ''), { onclick: (e: MouseEvent) => { if (e.target === wrap) close(); } },
    h('div.sheet' + (opts.wide ? '.wide' : ''), {},
      h('div.sheet-head', {}, h('h2', {}, title), h('button.x', { onclick: close, title: 'Close', 'aria-label': 'Close' }, '✕')),
      h('div.sheet-body', {}, body)));
  layer.append(wrap);
  return close;
}

export function closeAllSheets(): void {
  document.querySelectorAll('#modals .modal').forEach((m) => m.remove());
}

let toastTimer = 0;
export function toast(text: string, good = false): void {
  const host = $('#toasts');
  const el = h('div.toast' + (good ? '.good' : ''), {}, text);
  host.append(el);
  while (host.children.length > 4) host.firstElementChild?.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3400);
  clearTimeout(toastTimer);
}

export function confetti(n = 80): void {
  const host = $('#fx');
  const colors = ['#ff6f91', '#ffd23f', '#4fd1c5', '#9b7ede', '#ffffff', '#ff9f1c'];
  for (let i = 0; i < n; i++) {
    const c = h('i.confetti', { style: { left: `${Math.random() * 100}vw`, background: colors[i % colors.length], animationDelay: `${Math.random() * 0.5}s`, transform: `rotate(${Math.random() * 360}deg)` } });
    host.append(c);
    setTimeout(() => c.remove(), 3200);
  }
}

/** replaceChildren that skips null/false children. */
export function fill(el: Element, ...kids: Child[]): void {
  el.replaceChildren(...(kids.filter((k) => k !== null && k !== undefined && k !== false) as (Node | string)[]));
}
