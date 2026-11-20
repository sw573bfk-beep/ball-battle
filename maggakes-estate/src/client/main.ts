import './style.css';
import { Net, api } from './net';
import { Game } from './game';
import { h, $, fill } from './ui/dom';

const KEY = 'maggakes.token';
let game: Game | null = null;

function signOut(): void {
  localStorage.removeItem(KEY);
  location.reload();
}

function start(token: string): void {
  const net = new Net(token);
  net.on((m) => {
    if (m.t === 'welcome') {
      if (!game) {
        $('#login').classList.add('gone');
        document.body.classList.add('playing');
        game = new Game($('#app'), m.save, m.admin, net, signOut);
      } else {
        game.resume(m.save);
      }
    } else if (m.t === 'kicked') {
      if (m.reason.includes('sign in again') || m.reason.includes('reset')) localStorage.removeItem(KEY);
      showLogin(m.reason);
      $('#login').classList.remove('gone');
    }
  });
  net.connect();
}

function showLogin(message?: string): void {
  const box = $('#login .panel');
  let step: 'name' | 'password' = 'name';
  let name = '';
  let hasPassword = false;
  const err = h('p.err');
  const nameIn = h('input', { placeholder: 'Your first name', autocomplete: 'username', maxLength: 20 }) as HTMLInputElement;
  const passIn = h('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password', maxLength: 64 }) as HTMLInputElement;
  const pass2 = h('input', { type: 'password', placeholder: 'Type it again', autocomplete: 'new-password', maxLength: 64 }) as HTMLInputElement;
  const go = h('button.btn.big', {}, 'Enter the estate ✨') as HTMLButtonElement;

  const render = () => {
    err.textContent = '';
    if (step === 'name') {
      fill(box, 
        h('h1', {}, 'The Maggakes Estate'),
        h('p.sub', {}, 'Luxury mansion roleplay · Residents only'),
        message ? h('p.notice', {}, message) : null,
        h('label', {}, 'Who are you?'), nameIn, err, go,
      );
      go.textContent = 'Next ›';
      setTimeout(() => nameIn.focus(), 50);
    } else {
      fill(box, 
        h('h1', {}, hasPassword ? `Welcome back, ${name}!` : `Hi ${name}! 💖`),
        h('p.sub', {}, hasPassword ? 'Enter your password.' : 'First time here — make a password so nobody else can be you.'),
        h('label', {}, 'Password'), passIn,
        hasPassword ? null : h('label', {}, 'Confirm password'), hasPassword ? null : pass2,
        err, go,
        h('button.link', { onclick: () => { step = 'name'; render(); } }, '‹ Not you?'),
      );
      go.textContent = hasPassword ? 'Sign in ✨' : 'Create password & play ✨';
      setTimeout(() => passIn.focus(), 50);
    }
  };

  const kick = () => {
    fill(box, 
      h('div.kicked', {}, h('div.big', {}, '🚫'), h('h1', {}, 'KICKED!'),
        h('p', {}, "That name isn't on the guest list. The Maggakes Estate is residents only."),
        h('button.btn', { onclick: () => { nameIn.value = ''; render(); } }, 'Try again')),
    );
    box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
  };

  const submit = async () => {
    go.disabled = true;
    try {
      if (step === 'name') {
        const r = await api<{ kicked?: boolean; name?: string; hasPassword?: boolean; error?: string }>('/api/check', { name: nameIn.value });
        if (r.kicked) { kick(); return; }
        if (r.error || !r.name) { err.textContent = r.error ?? 'Could not reach the estate.'; return; }
        name = r.name; hasPassword = !!r.hasPassword; step = 'password';
        passIn.value = ''; pass2.value = '';
        render();
      } else {
        if (!hasPassword && passIn.value !== pass2.value) { err.textContent = "Those passwords don't match."; return; }
        const r = await api<{ kicked?: boolean; token?: string; error?: string }>('/api/login', { name, password: passIn.value });
        if (r.kicked) { kick(); return; }
        if (!r.token) { err.textContent = r.error ?? 'Could not sign in.'; return; }
        localStorage.setItem(KEY, r.token);
        fill(box, h('h1', {}, '✨ Opening the doors…'));
        start(r.token);
      }
    } catch {
      err.textContent = 'Could not reach the estate. Check your internet.';
    } finally {
      go.disabled = false;
    }
  };
  go.onclick = submit;
  for (const el of [nameIn, passIn, pass2]) el.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
  render();
}

if (location.search.includes('debug')) {
  import('./world/check').then((m) => { (window as unknown as Record<string, unknown>).__checkZones = m.checkZones; (window as unknown as Record<string, unknown>).__near = m.near; });
  (window as unknown as Record<string, unknown>).__game = () => game;
}

const saved = localStorage.getItem(KEY);
if (saved) start(saved);
else showLogin();
