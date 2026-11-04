import { api, loadMe, login, logout, onUser, signup, state } from './api.js';
import { $, esc, fmt, toast, confirmBox } from './ui.js';
import { skinSvg } from './skins.js';
import { MODES, DEFAULT_OPTIONS } from './rules.js';
import { editorView } from './editor.js';
import { hostView } from './host.js';
import { playView } from './play.js';
import { shopView, lockerView } from './shop.js';

const app = $('#app');
let cleanup = null;

// ------------------------------------------------------------------ nav

function renderNav() {
  const u = state.user;
  $('#nav').innerHTML = u
    ? `<a href="#/sets">My Sets</a><a href="#/discover">Discover</a><a href="#/shop">Shop</a><a href="#/locker">Locker</a>
       <a class="coins" href="#/shop" title="Coins">🪙 <b>${fmt(u.coins)}</b></a>
       <button class="avatar-btn" id="acct" title="${esc(u.username)}">${skinSvg(u.skin, 36)}</button>`
    : `<a href="#/discover">Discover</a><a href="#/login">Log in</a><a class="btn small" href="#/signup">Sign up</a>`;
  $('#acct')?.addEventListener('click', async () => {
    if (await confirmBox(`Log out of ${u.username}?`, 'Log out')) { await logout(); location.hash = '#/'; }
  });
}
onUser(renderNav);

// ------------------------------------------------------------------ views

function home() {
  const u = state.user;
  app.innerHTML = `
  <section class="hero">
    <div class="hero-text">
      <h1>Quiz games that <span class="pop">slap</span>.</h1>
      <p>Host live quizzes with a PIN, race for cash, or steal treasure from your friends. Make a whole quiz in seconds: ask any AI, paste the answer, done.</p>
    </div>
    <form class="join-card" id="join">
      <label for="pin">Join a game</label>
      <input id="pin" inputmode="numeric" autocomplete="off" maxlength="7" placeholder="Game PIN" />
      <button class="btn big yellow" type="submit">Enter</button>
    </form>
  </section>
  <section class="features">
    <a class="feature" href="${u ? '#/new' : '#/signup'}"><div class="ficon">✨</div><h3>Paste from any AI</h3><p>Copy our prompt into ChatGPT, Claude or Gemini, paste the result back, and it becomes questions instantly. Or let our built-in AI write them.</p></a>
    <a class="feature" href="${u ? '#/sets' : '#/signup'}"><div class="ficon">🎮</div><h3>3 game modes</h3><p><b>Live Quiz</b> on the big screen, <b>Cash Race</b> with upgrades, and <b>Treasure Steal</b> with chests.</p></a>
    <a class="feature" href="${u ? '#/shop' : '#/signup'}"><div class="ficon">🎁</div><h3>Collect skins</h3><p>Earn coins by playing, open boxes, and show off your Legendary blob in every lobby.</p></a>
  </section>`;
  const pin = $('#pin');
  pin.addEventListener('input', () => { pin.value = pin.value.replace(/\D/g, '').slice(0, 6); });
  $('#join').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin.value)) return toast('Game PINs are 6 digits', 'bad');
    location.hash = `#/play/${pin.value}`;
  });
  pin.focus();
}

function authView(mode) {
  if (state.user) { location.hash = '#/sets'; return; }
  const isSignup = mode === 'signup';
  app.innerHTML = `
  <section class="card narrow">
    <h2>${isSignup ? 'Create your account' : 'Welcome back'}</h2>
    <p class="muted">${isSignup ? 'Free. Get 100 coins to start, plus a coin bonus every day.' : 'Log in to host games, earn coins and open boxes.'}</p>
    <form id="auth" class="stack">
      <label>Username <input name="username" autocomplete="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" title="Letters, numbers and _" /></label>
      <label>Password <input name="password" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" required minlength="6" /></label>
      <button class="btn big" type="submit">${isSignup ? 'Sign up' : 'Log in'}</button>
    </form>
    <p class="muted center">${isSignup ? 'Already have an account? <a href="#/login">Log in</a>' : 'New here? <a href="#/signup">Create an account</a>'}</p>
    <p class="tiny muted center">Don't use your real name or a password you use anywhere else.</p>
  </section>`;
  $('#auth').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      await (isSignup ? signup : login)(String(f.get('username')), String(f.get('password')));
      toast(isSignup ? 'Account created! You got 100 coins 🪙' : 'Logged in!', 'good');
      location.hash = sessionStorage.getItem('qc-after-login') || '#/sets';
      sessionStorage.removeItem('qc-after-login');
    } catch (err) {
      toast(err.message, 'bad');
      btn.disabled = false;
    }
  });
  $('#auth input').focus();
}

function needLogin() {
  if (state.user) return false;
  sessionStorage.setItem('qc-after-login', location.hash);
  location.hash = '#/login';
  return true;
}

async function dashboard() {
  if (needLogin()) return;
  const u = state.user;
  app.innerHTML = `
  <section class="dash-head">
    <div class="me-card">
      <div class="me-skin">${skinSvg(u.skin, 88)}</div>
      <div>
        <h2>${esc(u.username)}</h2>
        <p class="muted">${fmt(u.stats.games)} games · ${fmt(u.stats.wins)} wins · ${fmt(u.stats.correct)} correct answers</p>
        ${u.dailyReady ? '<button class="btn yellow small" id="daily">🎁 Claim daily coins</button>' : '<span class="tiny muted">Daily bonus claimed ✓ come back tomorrow</span>'}
      </div>
    </div>
    <a class="btn big" href="#/new">＋ New question set</a>
  </section>
  <h2 class="section-title">My question sets</h2>
  <div id="sets" class="set-grid"><div class="loading">Loading…</div></div>`;
  $('#daily')?.addEventListener('click', async () => {
    try { const r = await api('/api/daily', { method: 'POST' }); toast(`+${r.bonus} coins!`, 'good'); dashboard(); }
    catch (e) { toast(e.message, 'bad'); }
  });
  try {
    const { sets } = await api('/api/sets');
    const box = $('#sets');
    if (!box) return;
    if (!sets.length) {
      box.innerHTML = `<div class="empty"><p>No sets yet. Make one in 30 seconds: hit <b>New question set</b>, then paste questions from any AI.</p><a class="btn" href="#/new">Make my first set</a></div>`;
      return;
    }
    box.innerHTML = sets.map((s) => setCard(s, true)).join('');
    box.addEventListener('click', async (e) => {
      const del = e.target.closest('[data-del]');
      if (del) {
        e.preventDefault();
        if (await confirmBox('Delete this set? This cannot be undone.', 'Delete')) {
          await api(`/api/sets/${del.dataset.del}`, { method: 'DELETE' });
          dashboard();
        }
      }
    });
  } catch (e) { toast(e.message, 'bad'); }
}

function setCard(s, mine) {
  return `<div class="set-card">
    <a class="set-main" href="#/set/${s.id}">
      <h3>${esc(s.title)}</h3>
      <p class="muted">${s.question_count} questions · ${fmt(s.plays)} plays${s.author ? ` · by ${esc(s.author)}` : ''}${mine && s.is_public ? ' · 🌍 public' : ''}</p>
      ${s.description ? `<p class="desc">${esc(s.description)}</p>` : ''}
    </a>
    <div class="set-actions">
      <a class="btn small" href="#/host-setup/${s.id}">▶ Host</a>
      ${mine ? `<a class="btn small ghost" href="#/edit/${s.id}">Edit</a><button class="btn small ghost danger-text" data-del="${s.id}">Delete</button>` : ''}
    </div>
  </div>`;
}

async function discover() {
  app.innerHTML = `
  <h2 class="section-title">Discover sets</h2>
  <form id="search" class="row"><input id="q" placeholder="Search public sets: math, spanish, science…" /><button class="btn">Search</button></form>
  <div id="sets" class="set-grid"><div class="loading">Loading…</div></div>`;
  const load = async (q = '') => {
    try {
      const { sets } = await api('/api/sets/public' + (q ? `?q=${encodeURIComponent(q)}` : ''));
      $('#sets').innerHTML = sets.length ? sets.map((s) => setCard(s, false)).join('') : '<div class="empty"><p>No public sets found yet. Make one and tick "Public" to share it here!</p></div>';
    } catch (e) { toast(e.message, 'bad'); }
  };
  $('#search').addEventListener('submit', (e) => { e.preventDefault(); load($('#q').value.trim()); });
  load();
}

async function setDetail(id) {
  app.innerHTML = '<div class="loading">Loading…</div>';
  let set;
  try { ({ set } = await api(`/api/sets/${id}`)); } catch (e) { app.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; return; }
  app.innerHTML = `
  <section class="card">
    <div class="row between wrap">
      <div><h2>${esc(set.title)}</h2><p class="muted">${set.questions.length} questions · by ${esc(set.author)} · ${fmt(set.plays)} plays</p>${set.description ? `<p>${esc(set.description)}</p>` : ''}</div>
      <div class="row">
        <a class="btn" href="#/host-setup/${set.id}">▶ Host this</a>
        ${set.mine ? `<a class="btn ghost" href="#/edit/${set.id}">Edit</a>` : state.user ? '<button class="btn ghost" id="copy">Copy to my sets</button>' : ''}
      </div>
    </div>
    <ol class="q-preview">${set.questions.map((q) => `<li><b>${esc(q.q)}</b><ul>${q.answers.map((a, i) => `<li class="${i === q.correct ? 'right' : ''}">${esc(a)}</li>`).join('')}</ul></li>`).join('')}</ol>
  </section>`;
  $('#copy')?.addEventListener('click', async () => {
    try { const r = await api(`/api/sets/${set.id}/copy`, { method: 'POST' }); toast('Copied to your sets!', 'good'); location.hash = `#/edit/${r.id}`; }
    catch (e) { toast(e.message, 'bad'); }
  });
}

async function hostSetup(id) {
  if (needLogin()) return;
  app.innerHTML = '<div class="loading">Loading…</div>';
  let set;
  try { ({ set } = await api(`/api/sets/${id}`)); } catch (e) { app.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; return; }
  const last = localStorage.getItem('qc-last-mode') || 'classic';
  app.innerHTML = `
  <section class="card">
    <p class="muted">Hosting</p>
    <h2>${esc(set.title)} <span class="muted small">· ${set.questions.length} questions</span></h2>
    <h3 class="section-title">Pick a game mode</h3>
    <div class="mode-grid">
      ${Object.entries(MODES).map(([k, m]) => `
        <label class="mode-card mode-${k}">
          <input type="radio" name="mode" value="${k}" ${k === last ? 'checked' : ''} />
          <div class="mode-icon">${{ classic: '📺', race: '💸', gold: '👑' }[k]}</div>
          <h3>${m.name}</h3><p>${m.tagline}</p>
        </label>`).join('')}
    </div>
    <div id="opts" class="opts"></div>
    <button class="btn big yellow" id="go">Create game</button>
  </section>`;
  const renderOpts = () => {
    const mode = app.querySelector('input[name=mode]:checked').value;
    const d = DEFAULT_OPTIONS[mode];
    $('#opts').innerHTML = mode === 'classic'
      ? `<label class="check"><input type="checkbox" id="o-shuffle" /> Shuffle question order</label>
         <label>Timer speed <select id="o-timeScale"><option value="0.5">Fast (½ time)</option><option value="1" selected>Normal</option><option value="1.5">Relaxed (1.5×)</option><option value="2">Slow (2×)</option></select></label>`
      : `<label>Time limit <select id="o-minutes">${[3, 5, 7, 10, 15, 20].map((m) => `<option value="${m}" ${m === d.minutes ? 'selected' : ''}>${m} minutes</option>`).join('')}</select></label>
         <label>${mode === 'race' ? 'Cash goal (ends early when someone reaches it)' : 'Gold goal (optional, ends early)'}
           <select id="o-goal">${(mode === 'race' ? [5000, 10000, 25000, 100000, 1000000, 0] : [0, 500, 1000, 2500, 5000, 10000]).map((g) => `<option value="${g}" ${g === d.goal ? 'selected' : ''}>${g ? fmt(g) : 'No goal (time only)'}</option>`).join('')}</select></label>`;
  };
  app.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', renderOpts));
  renderOpts();
  $('#go').addEventListener('click', async (e) => {
    const mode = app.querySelector('input[name=mode]:checked').value;
    const options = mode === 'classic'
      ? { shuffle: $('#o-shuffle').checked, timeScale: Number($('#o-timeScale').value) }
      : { minutes: Number($('#o-minutes').value), goal: Number($('#o-goal').value) };
    e.target.disabled = true;
    try {
      const { pin, hostKey } = await api('/api/games', { method: 'POST', body: { setId: set.id, mode, options } });
      localStorage.setItem('qc-last-mode', mode);
      sessionStorage.setItem(`qc-host-${pin}`, hostKey);
      location.hash = `#/host/${pin}`;
    } catch (err) { toast(err.message, 'bad'); e.target.disabled = false; }
  });
}

// ------------------------------------------------------------------ router

const routes = [
  [/^#?\/?$/, home],
  [/^#\/login$/, () => authView('login')],
  [/^#\/signup$/, () => authView('signup')],
  [/^#\/sets$/, dashboard],
  [/^#\/discover$/, discover],
  [/^#\/new$/, () => { if (!needLogin()) return editorView(app, null); }],
  [/^#\/edit\/(\d+)$/, (id) => { if (!needLogin()) return editorView(app, Number(id)); }],
  [/^#\/set\/(\d+)$/, setDetail],
  [/^#\/host-setup\/(\d+)$/, hostSetup],
  [/^#\/host\/(\d{6})$/, (pin) => hostView(app, pin)],
  [/^#\/play\/(\d{6})$/, (pin) => playView(app, pin)],
  [/^#\/shop$/, () => { if (!needLogin()) return shopView(app); }],
  [/^#\/locker$/, () => { if (!needLogin()) return lockerView(app); }],
];

async function route() {
  if (typeof cleanup === 'function') { try { cleanup(); } catch {} }
  cleanup = null;
  const hash = location.hash || '#/';
  const inGame = /^#\/(host|play)\//.test(hash);
  document.body.classList.toggle('in-game', inGame);
  for (const [re, fn] of routes) {
    const m = hash.match(re);
    if (m) {
      const r = await fn(...m.slice(1));
      if (typeof r === 'function') cleanup = r;
      window.scrollTo(0, 0);
      return;
    }
  }
  app.innerHTML = '<div class="empty"><h2>Page not found</h2><a class="btn" href="#/">Go home</a></div>';
}

window.addEventListener('hashchange', route);
renderNav();
loadMe().then(() => { renderNav(); route(); });
