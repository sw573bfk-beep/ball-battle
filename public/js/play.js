import { GameConn } from './conn.js';
import { api, state } from './api.js';
import { $, esc, fmt, toast, beep } from './ui.js';
import { skinSvg } from './skins.js';
import { MODES, UPGRADES, ANSWER_COLORS, ANSWER_SHAPES } from './rules.js';
import { confetti } from './host.js';

export async function playView(app, pin) {
  const storeKey = `qc-player-${pin}`;
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null'); } catch {}

  if (!saved) {
    app.innerHTML = '<div class="loading">Finding game…</div>';
    let info;
    try { info = await api(`/api/games/${pin}`); } catch (e) { info = { exists: false, error: e.message }; }
    if (!info.exists) {
      app.innerHTML = `<div class="empty"><h2>No game with PIN ${esc(pin)}</h2><p>${esc(info.error || 'Check the PIN on the host screen and try again.')}</p><a class="btn" href="#/">Try another PIN</a></div>`;
      return;
    }
    const u = state.user;
    app.innerHTML = `
    <section class="card narrow join-name">
      <div class="center">${skinSvg(u ? u.skin : 'blob-mint', 96)}</div>
      <p class="muted center">${esc(MODES[info.mode].name)} · ${esc(info.title)}</p>
      <form id="nameform" class="stack">
        <label>Nickname <input id="nick" maxlength="18" autocomplete="off" required value="${esc(u?.username || '')}" /></label>
        <button class="btn big yellow">Join game</button>
      </form>
      ${u ? '' : '<p class="tiny muted center">Playing as a guest. <a href="#/login" id="loginlink">Log in</a> to earn coins and use your skins.</p>'}
    </section>`;
    $('#loginlink')?.addEventListener('click', () => sessionStorage.setItem('qc-after-login', `#/play/${pin}`));
    const nick = $('#nick');
    nick.focus();
    await new Promise((resolve) => {
      $('#nameform').addEventListener('submit', (e) => { e.preventDefault(); if (nick.value.trim()) resolve(); });
    });
    saved = { name: nick.value.trim() };
  }

  let you = null;
  let game = null;
  let mode = null;
  let me = { score: 0, streak: 0, correct: 0, levels: { income: 0, multiplier: 0, streak: 0, shield: 0 } };
  let rank = null;
  let endsAt = 0;
  let tick = null;
  let advanceTimer = null;

  app.innerHTML = `<div class="player" id="player"><div class="phead" id="phead"></div><div class="pbody" id="pbody"><div class="loading">Joining…</div></div></div><div class="conn-status" id="cstat"></div>`;
  const body = $('#pbody');

  const conn = new GameConn(
    () => (saved.pid ? { pin, role: 'player', pid: saved.pid, secret: saved.secret } : { pin, role: 'player', name: saved.name }),
    onMsg,
    (s) => { $('#cstat').textContent = s === 'reconnecting' ? 'Reconnecting…' : ''; },
  );

  const setTick = (fn) => { clearInterval(tick); tick = fn ? setInterval(fn, 250) : null; fn?.(); };
  const unit = () => (mode === 'race' ? '$' : '');
  const scoreLabel = () => (mode === 'race' ? `$${fmt(me.score)}` : mode === 'gold' ? `${fmt(me.score)} gold` : `${fmt(me.score)} pts`);

  let headHtml = '';
  function clockText() {
    const left = Math.max(0, endsAt - conn.now());
    return `⏱ ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
  }
  function head() {
    const h = $('#phead');
    if (!h || !you) return;
    const html = `
      <div class="ph-me">${skinSvg(you.skin, 34)}<b>${esc(you.name)}</b></div>
      ${endsAt ? '<div class="ph-clock" id="phclock"></div>' : ''}
      <div class="ph-score">${rank ? `<span class="ph-rank">#${rank}</span>` : ''}<b>${scoreLabel()}</b>${me.streak >= 2 ? ` <span class="streak">🔥${me.streak}</span>` : ''}</div>
      ${mode === 'race' && endsAt ? '<button class="btn small yellow" id="shopbtn">🛒 Upgrades</button>' : ''}`;
    // skinSvg ids differ per call; compare without them.
    const key = html.replace(/id="[gc][^"]*"|url\(#[^)]*\)/g, '');
    if (key !== headHtml) {
      headHtml = key;
      h.innerHTML = html;
      $('#shopbtn')?.addEventListener('click', shop);
    }
    const c = $('#phclock');
    if (c) c.textContent = clockText();
  }

  function onMsg(m) {
    if (m.me) me = m.me;
    switch (m.t) {
      case 'error':
        sessionStorage.removeItem(storeKey);
        body.innerHTML = `<div class="empty"><h2>${esc(m.message)}</h2><a class="btn" href="#/">Home</a></div>`;
        break;
      case 'kicked':
        sessionStorage.removeItem(storeKey);
        body.innerHTML = '<div class="empty"><h2>The host removed you from this game.</h2><a class="btn" href="#/">Home</a></div>';
        break;
      case 'welcome':
        you = m.you; game = m.game; mode = game.mode;
        saved = { pid: you.id, secret: you.secret, name: you.name };
        sessionStorage.setItem(storeKey, JSON.stringify(saved));
        head();
        break;
      case 'lobby':
        body.innerHTML = `<div class="p-wait">${skinSvg(you.skin, 120)}<h2>You're in, ${esc(you.name)}!</h2><p>See your name on the host's screen? Get ready…</p><p class="muted">${m.count} player${m.count === 1 ? '' : 's'} joined</p>${you.guest ? '<p class="tiny muted">Playing as a guest: no coins this time.</p>' : ''}</div>`;
        break;
      case 'getready':
        setTick(() => {
          const s = Math.max(0, Math.ceil((m.at - conn.now()) / 1000));
          body.innerHTML = `<div class="p-wait"><div class="qcounter">Question ${m.n} of ${m.total}</div><div class="gr-count">${s || 'Go!'}</div></div>`;
        });
        break;
      case 'question':
        setTick(mode === 'classic' ? null : head);
        clearTimeout(advanceTimer);
        questionView(m);
        break;
      case 'answered':
        setTick(null);
        body.innerHTML = '<div class="p-wait"><div class="spinner"></div><h2>Answer locked in!</h2><p>Waiting for everyone else…</p></div>';
        break;
      case 'reveal': classicReveal(m); break;
      case 'playing':
        endsAt = m.endsAt;
        setTick(head);
        break;
      case 'result': selfResult(m); break;
      case 'chests': chests(); break;
      case 'chestResult': chestResult(m); break;
      case 'pickTarget': pickTarget(m.targets, m.kind, m.amount); break;
      case 'targetResult':
        beep('good');
        body.innerHTML = `<div class="p-result good"><div class="big-emoji">${m.kind === 'swap' ? '🔄' : '🦹'}</div><h2>${m.kind === 'swap' ? `Swapped with ${esc(m.target)}!` : `Stole ${fmt(m.delta)} from ${esc(m.target)}!`}</h2>${nextBtn()}</div>`;
        wireNext();
        head();
        break;
      case 'robbed': toast(`😱 ${m.by} stole ${fmt(m.amount)} gold from you!`, 'bad'); beep('bad'); head(); break;
      case 'swapped': toast(`🔄 ${m.by} swapped gold with you!`, 'bad'); head(); break;
      case 'me': head(); if ($('.shop-sheet')) shop(); break;
      case 'rank': rank = m.rank; head(); break;
      case 'toast': toast(m.message); break;
      case 'end': endView(m); break;
    }
    if (m.me) head();
  }

  function questionView(m) {
    body.innerHTML = `
    <div class="pq">
      ${mode === 'classic' ? `<div class="pq-top"><span class="qcounter">${m.n} / ${m.total}</span><span class="timer small" id="ptimer"></span></div>` : ''}
      <h2 class="pq-text">${esc(m.q)}</h2>
      <div class="answer-grid p n${m.answers.length}">${m.answers.map((a, i) => `<button class="ans" data-i="${i}" style="--c:${ANSWER_COLORS[i]}"><span class="shape">${ANSWER_SHAPES[i]}</span>${esc(a)}</button>`).join('')}</div>
    </div>`;
    body.querySelector('.answer-grid').onclick = (e) => {
      const b = e.target.closest('[data-i]');
      if (!b || body.querySelector('.ans.chosen')) return;
      b.classList.add('chosen');
      body.querySelectorAll('.ans').forEach((x) => (x.disabled = true));
      conn.send({ t: 'answer', i: Number(b.dataset.i) });
    };
    if (mode === 'classic') {
      setTick(() => {
        const el = $('#ptimer');
        if (el) el.textContent = Math.max(0, Math.ceil((m.endsAt - conn.now()) / 1000));
      });
    }
  }

  function classicReveal(m) {
    setTick(null);
    beep(m.correct ? 'good' : 'bad');
    me.score = m.score; me.streak = m.streak; rank = m.rank;
    head();
    body.innerHTML = `
    <div class="p-result ${m.correct ? 'good' : 'bad'}">
      <div class="big-emoji">${m.correct ? '✅' : m.answered ? '❌' : '⏰'}</div>
      <h2>${m.correct ? 'Correct!' : m.answered ? 'Not quite' : "Time's up!"}</h2>
      ${m.correct ? `<div class="points">+${fmt(m.points)}</div>` : `<p>Answer: <b>${esc(m.correctAnswer)}</b></p>`}
      ${m.streak >= 2 ? `<p class="streak">🔥 Answer streak: ${m.streak}</p>` : ''}
      <p class="rankline">You're <b>#${m.rank}</b> of ${m.of}${m.behind ? ` · ${fmt(m.behind.by)} behind ${esc(m.behind.name)}` : m.rank === 1 ? ' · in the lead! 👑' : ''}</p>
    </div>`;
  }

  function nextBtn() { return '<button class="btn big yellow" id="nextq">Next question ▶</button>'; }
  function wireNext() { $('#nextq')?.addEventListener('click', () => { $('#nextq').disabled = true; conn.send({ t: 'next' }); }); }

  function selfResult(m) {
    beep(m.correct ? 'good' : 'bad');
    head();
    if (mode === 'gold' && m.correct) return chests();
    const delta = m.delta ? `<div class="points ${m.delta < 0 ? 'neg' : ''}">${m.delta > 0 ? '+' : '−'}${unit()}${fmt(Math.abs(m.delta))}</div>` : '';
    body.innerHTML = `
    <div class="p-result ${m.correct ? 'good' : 'bad'}">
      <div class="big-emoji">${m.correct ? '✅' : '❌'}</div>
      <h2>${m.correct ? 'Correct!' : 'Not quite'}</h2>
      ${delta}
      ${m.correct ? '' : `<p>Answer: <b>${esc(m.correctAnswer)}</b></p>`}
    </div>`;
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(() => conn.send({ t: 'next' }), m.correct ? 900 : 1700);
  }

  function chests() {
    body.innerHTML = `<div class="chests-screen"><h2>✅ Correct! Pick a chest</h2><div class="chests">${[0, 1, 2].map((i) => `<button class="chest" data-c="${i}"><span>🎁</span></button>`).join('')}</div></div>`;
    body.querySelector('.chests').onclick = (e) => {
      const c = e.target.closest('[data-c]');
      if (!c || body.querySelector('.chest.opened')) return;
      c.classList.add('opened');
      conn.send({ t: 'chest', i: Number(c.dataset.c) });
    };
  }

  function chestResult(m) {
    const good = m.delta > 0 || m.needTarget;
    beep(good ? 'pop' : m.delta < 0 ? 'bad' : 'tick');
    body.innerHTML = `
    <div class="chests-screen">
      <div class="chests revealed">${m.outcomes.map((o, i) => `<div class="chest ${i === m.picked ? 'picked' : 'other'} k-${o.kind}"><span>${chestIcon(o.kind)}</span><small>${esc(o.label)}</small></div>`).join('')}</div>
      <h2 class="chest-msg">${m.needTarget ? (m.kind === 'swap' ? 'Who do you want to swap with?' : `Who do you want to steal ${m.amount}% from?`) : m.delta > 0 ? `+${fmt(m.delta)} gold!` : m.delta < 0 ? `Lost ${fmt(-m.delta)} gold 😬` : 'Nothing this time'}</h2>
      <div id="after"></div>
    </div>`;
    if (m.needTarget) pickTarget(m.targets, m.kind, m.amount, $('#after'));
    else { $('#after').innerHTML = nextBtn(); wireNext(); }
  }

  function pickTarget(targets, kind, amount, into) {
    const box = into || body;
    if (!into) box.innerHTML = `<div class="chests-screen"><h2>${kind === 'swap' ? 'Swap with who?' : `Steal ${amount}% from who?`}</h2><div id="after"></div></div>`;
    const target = into || $('#after');
    target.innerHTML = `<div class="targets">${targets.map((t) => `<button class="target" data-id="${t.id}">${skinSvg(t.skin, 40)}<span>${esc(t.name)}</span><b>${fmt(t.score)}</b></button>`).join('')}</div>`;
    target.querySelector('.targets').onclick = (e) => {
      const b = e.target.closest('[data-id]');
      if (!b) return;
      target.querySelectorAll('.target').forEach((x) => (x.disabled = true));
      conn.send({ t: 'target', id: b.dataset.id });
    };
  }

  function shop() {
    document.querySelector('.shop-sheet')?.remove();
    const sheet = document.createElement('div');
    sheet.className = 'shop-sheet';
    sheet.innerHTML = `<div class="sheet"><div class="row between"><h2>Upgrades</h2><button class="btn ghost small" data-close>Close ✕</button></div><p class="muted">You have <b>$${fmt(me.score)}</b></p>
      <div class="upgrades">${Object.entries(UPGRADES).map(([k, u]) => {
        const lvl = me.levels[k];
        const next = u.levels[lvl + 1];
        return `<div class="upgrade">
          <div><b>${u.name}</b> <span class="lvl">Lv ${lvl + 1}/${u.levels.length}</span><p class="tiny muted">${u.desc}</p><p>Now: <b>${u.fmt(u.levels[lvl].value)}</b>${next ? ` → ${u.fmt(next.value)}` : ''}</p></div>
          ${next ? `<button class="btn small ${me.score >= next.cost ? 'yellow' : 'ghost'}" data-buy="${k}" ${me.score >= next.cost ? '' : 'disabled'}>$${fmt(next.cost)}</button>` : '<span class="maxed">MAX</span>'}
        </div>`;
      }).join('')}</div></div>`;
    sheet.onclick = (e) => {
      if (e.target === sheet || e.target.closest('[data-close]')) return sheet.remove();
      const b = e.target.closest('[data-buy]');
      if (b) { conn.send({ t: 'buy', up: b.dataset.buy }); beep('pop'); }
    };
    document.body.append(sheet);
  }

  function endView(m) {
    setTick(null);
    endsAt = 0;
    document.querySelector('.shop-sheet')?.remove();
    sessionStorage.removeItem(storeKey);
    if (m.place === 1) beep('win');
    head();
    const podium = m.podium || [];
    body.innerHTML = `
    <div class="p-end">
      <h2>${m.place === 1 ? '🏆 You won!' : m.place <= 3 ? `🎉 ${['', '1st', '2nd', '3rd'][m.place]} place!` : `You finished #${m.place}`}</h2>
      <p class="muted">of ${m.of} players · ${fmt(m.correct)} correct · ${unit()}${fmt(m.score)}${mode === 'gold' ? ' gold' : mode === 'classic' ? ' points' : ''}</p>
      ${m.guest ? '<div class="coins-earned guest"><a href="#/signup">Make a free account</a> to earn coins and unlock skins next time!</div>' : m.coins ? `<div class="coins-earned">+${m.coins} 🪙 coins earned!</div>` : ''}
      <ol class="board small-board">${podium.slice(0, 5).map((p) => `<li class="${p.name === you?.name ? 'me' : ''}">${skinSvg(p.skin, 32)}<span class="bname">${esc(p.name)}</span><b>${unit()}${fmt(p.score)}</b></li>`).join('')}</ol>
      <div class="row center wrap"><a class="btn yellow" href="#/">Play again</a>${m.guest ? '' : '<a class="btn ghost" href="#/shop">Open boxes 🎁</a>'}</div>
    </div>`;
    if (m.place <= 3) confetti(body);
    if (!m.guest) api('/api/me').catch(() => {});
  }

  return () => { clearInterval(tick); clearTimeout(advanceTimer); conn.close(); document.querySelector('.shop-sheet')?.remove(); };
}

function chestIcon(kind) {
  return { gain: '💰', gainPct: '📈', double: '✌️', triple: '🤑', steal: '🦹', swap: '🔄', losePct: '💸', nothing: '🕸️' }[kind] || '🎁';
}
