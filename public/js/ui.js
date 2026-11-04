// Tiny UI helpers.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(message, kind = 'info') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  box.append(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

export function modal(html, { onMount, wide = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true"><button class="modal-x" aria-label="Close">✕</button>${html}</div>`;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('.modal-x')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(wrap);
  onMount?.(wrap.querySelector('.modal'), close);
  return close;
}

export function confirmBox(text, yes = 'Yes') {
  return new Promise((resolve) => {
    let done = false;
    const close = modal(`<p class="confirm-text">${esc(text)}</p><div class="row end"><button class="btn ghost" data-no>Cancel</button><button class="btn danger" data-yes>${esc(yes)}</button></div>`, {
      onMount(m, c) {
        m.querySelector('[data-no]').onclick = () => { done = true; c(); resolve(false); };
        m.querySelector('[data-yes]').onclick = () => { done = true; c(); resolve(true); };
      },
    });
    void close; void done;
  });
}

export function fmt(n) {
  return Math.round(n).toLocaleString();
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true, () => fallbackCopy(text));
  return Promise.resolve(fallbackCopy(text));
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  return ok;
}

/** Simple sound effects with WebAudio (no files needed). */
let actx = null;
export function beep(kind) {
  try {
    if (localStorage.getItem('qc-mute') === '1') return;
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    const notes = { good: [523, 784], bad: [220, 160], tick: [880], pop: [660, 990], win: [523, 659, 784, 1047] }[kind] || [440];
    notes.forEach((f, i) => {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = kind === 'bad' ? 'sawtooth' : 'triangle';
      o.frequency.value = f;
      const t = actx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g).connect(actx.destination);
      o.start(t);
      o.stop(t + 0.22);
    });
  } catch {}
}
