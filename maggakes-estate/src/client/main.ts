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
        game = new Game($('#app'), m.save, m.admin, net, signOut, m.residences, m.pending);
      } else {
        game.resume(m.save);
      }
    } else if (m.t === 'kicked') {
      if (m.reason.includes('sign in again') || m.reason.includes('reset') || m.reason.includes('banned')) localStorage.removeItem(KEY);
      showLogin(m.reason);
      $('#login').classList.remove('gone');
    }
  });
  net.connect();
}

function showLogin(message?: string): void {
  const box = $('#login .panel');
  let step: 'name' | 'password' | 'pending' = 'name';
  let name = '';
  let hasPassword = false;
  let isNew = false;
  const err = h('p.err');
  const nameIn = h('input', { placeholder: 'Username', autocomplete: 'username', maxLength: 16 }) as HTMLInputElement;
  const passIn = h('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password', maxLength: 64 }) as HTMLInputElement;
  const pass2 = h('input', { type: 'password', placeholder: 'Type it again', autocomplete: 'new-password', maxLength: 64 }) as HTMLInputElement;
  const go = h('button.btn.big', {}, 'Next ›') as HTMLButtonElement;

  const render = () => {
    err.textContent = '';
    if (step === 'name') {
      fill(box,
        h('h1', {}, 'The Maggakes Estate'),
        h('p.sub', {}, 'Luxury mansion roleplay'),
        message ? h('p.notice', {}, message) : null,
        h('label', {}, 'Username'), nameIn,
        h('small.muted', {}, 'New here? Type the username you want — letters, numbers and _ only.'),
        err, go,
      );
      go.textContent = 'Next ›';
      setTimeout(() => nameIn.focus(), 50);
    } else if (step === 'password') {
      fill(box,
        h('h1', {}, isNew ? `Welcome, ${name}! ✨` : hasPassword ? `Welcome back, ${name}!` : `Hi ${name}! 💖`),
        h('p.sub', {}, isNew ? 'Make a password for your new account. An admin will approve you before you can play.' : hasPassword ? 'Enter your password.' : 'Make a password so nobody else can be you.'),
        h('label', {}, 'Password'), passIn,
        hasPassword ? null : h('label', {}, 'Confirm password'), hasPassword ? null : pass2,
        err, go,
        h('button.link', { onclick: () => { step = 'name'; render(); } }, '‹ Back'),
      );
      go.textContent = isNew ? 'Create my account ✨' : hasPassword ? 'Sign in ✨' : 'Create password & play ✨';
      setTimeout(() => passIn.focus(), 50);
    } else {
      fill(box,
        h('div.pending-box', {},
          h('div.big', {}, '⏳'),
          h('h1', {}, 'Waiting for approval'),
          h('p', {}, `Your account “${name}” is made! Beau, Keola or Milla need to approve it before you can move in.`),
          h('p.muted', {}, 'Ask one of them to check the 👥 Admin page, then press the button below.'),
          err,
          h('button.btn', { onclick: () => submit() }, '🔄 Check again'),
          h('button.link', { onclick: () => { step = 'name'; render(); } }, '‹ Use a different account')),
      );
    }
  };

  const banned = () => {
    fill(box, h('div.kicked', {}, h('div.big', {}, '⛔'), h('h1', {}, 'BANNED'),
      h('p', {}, 'This account has been banned by an admin.'),
      h('button.btn', { onclick: () => { step = 'name'; nameIn.value = ''; render(); } }, 'Back')));
    box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
  };

  const submit = async () => {
    go.disabled = true;
    try {
      if (step === 'name') {
        const r = await api<{ banned?: boolean; invalid?: string; name?: string; hasPassword?: boolean; isNew?: boolean; error?: string }>('/api/check', { name: nameIn.value });
        if (r.banned) { banned(); return; }
        if (r.invalid) { err.textContent = r.invalid; return; }
        if (r.error || !r.name) { err.textContent = r.error ?? 'Could not reach the estate.'; return; }
        name = r.name; hasPassword = !!r.hasPassword; isNew = !!r.isNew; step = 'password';
        passIn.value = ''; pass2.value = '';
        render();
      } else {
        if (step === 'password' && !hasPassword && passIn.value !== pass2.value) { err.textContent = "Those passwords don't match."; return; }
        const r = await api<{ banned?: boolean; pending?: boolean; token?: string; error?: string }>('/api/login', { name, password: passIn.value });
        if (r.banned) { banned(); return; }
        if (r.pending) {
          if (step === 'pending') err.textContent = 'Not approved yet — try again soon!';
          hasPassword = true;
          step = 'pending';
          if (!err.textContent) render();
          return;
        }
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
  import('./world/check').then((m) => { (window as unknown as Record<string, unknown>).__checkZones = m.checkZones; (window as unknown as Record<string, unknown>).__near = m.near; (window as unknown as Record<string, unknown>).__dbg = m; });
  (window as unknown as Record<string, unknown>).__game = () => game;
}

const saved = localStorage.getItem(KEY);
if (saved) start(saved);
else showLogin();
