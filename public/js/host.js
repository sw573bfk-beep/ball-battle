import { GameConn } from './conn.js';
import { $, esc, fmt, toast, beep, confirmBox } from './ui.js';
import { skinSvg } from './skins.js';
import { MODES, ANSWER_COLORS, ANSWER_SHAPES } from './rules.js';

export function hostView(app, pin) {
  const key = sessionStorage.getItem(`qc-host-${pin}`);
  if (!key) {
    app.innerHTML = `<div class="empty"><h2>Can't host this game here</h2><p>The host link only works in the browser tab that created the game.</p><a class="btn" href="#/sets">My sets</a></div>`;
    return;
  }
  let game = null;
  let phase = 'connecting';
  let players = [];
  let feed = [];
  let tick = null;
  const joinUrl = `${location.origin}/#/play/${pin}`;

  app.innerHTML = `<div class="host" id="host"><div class="loading">Connecting…</div></div><div class="conn-status" id="cstat"></div>`;
  const root = $('#host');
  const conn = new GameConn(() => ({ pin, role: 'host', key }), onMsg, (s) => {
    $('#cstat').textContent = s === 'reconnecting' ? 'Reconnecting…' : '';
  });

  const setTick = (fn) => {
    clearInterval(tick);
    tick = fn ? setInterval(fn, 200) : null;
    fn?.();
  };

  function onMsg(m) {
    switch (m.t) {
      case 'error': root.innerHTML = `<div class="empty"><h2>${esc(m.message)}</h2><a class="btn" href="#/sets">Back to my sets</a></div>`; break;
      case 'hostWelcome':
        game = m.game; phase = m.phase; players = m.players; feed = m.feed || [];
        if (phase === 'lobby') lobby();
        break;
      case 'lobby': players = m.players; if (phase === 'lobby') lobby(); break;
      case 'toast': toast(m.message); break;
      case 'feed': feed.push(m.item); if (feed.length > 30) feed.shift(); renderFeed(); break;
      case 'getready': phase = 'getready'; getReady(m); break;
      case 'question': phase = 'question'; question(m); break;
      case 'answerCount': { const el = $('#answered'); if (el) el.textContent = `${m.answered} / ${m.players} answered`; break; }
      case 'reveal': phase = 'reveal'; reveal(m); break;
      case 'leaderboard': phase = 'leaderboard'; leaderboard(m); break;
      case 'playing': phase = 'playing'; playing(m); break;
      case 'board': if (phase === 'playing') liveBoard(m.board, m.players); break;
      case 'end': phase = 'ended'; end(m.podium || []); break;
    }
  }

  // ---------------------------------------------------------------- lobby
  function lobby() {
    setTick(null);
    root.innerHTML = `
    <div class="lobby">
      <div class="pin-banner">
        <div>Join at <b>${esc(location.host)}</b> with PIN</div>
        <div class="big-pin">${pin.slice(0, 3)} ${pin.slice(3)}</div>
        <button class="btn ghost small light" id="copy-link">Copy join link</button>
      </div>
      <div class="lobby-bar">
        <div><span class="mode-chip">${esc(MODES[game.mode].name)}</span> <b>${esc(game.title)}</b> · ${game.total} questions</div>
        <div class="row"><span class="count">👥 ${players.length}</span><button class="btn yellow big" id="start" ${players.length ? '' : 'disabled'}>Start</button></div>
      </div>
      <div class="lobby-players">${players.length ? players.map((p) => `<button class="lobby-p ${p.online ? '' : 'off'}" data-kick="${p.id}" title="Click to remove">${skinSvg(p.skin, 56)}<span>${esc(p.name)}</span></button>`).join('') : '<p class="waiting">Waiting for players to join…</p>'}</div>
    </div>`;
    $('#start').onclick = () => conn.send({ t: 'start' });
    $('#copy-link').onclick = () => navigator.clipboard?.writeText(joinUrl).then(() => toast('Join link copied', 'good'));
    root.querySelector('.lobby-players').onclick = async (e) => {
      const b = e.target.closest('[data-kick]');
      if (b && (await confirmBox(`Remove ${b.querySelector('span').textContent}?`, 'Remove'))) conn.send({ t: 'kick', id: b.dataset.kick });
    };
  }

  // ---------------------------------------------------------------- classic
  function getReady(m) {
    beep('pop');
    root.innerHTML = `<div class="getready"><div class="qcounter">Question ${m.n} of ${m.total}</div><h1 class="gr-q">${esc(m.q)}</h1><div class="gr-count" id="grc"></div></div>`;
    setTick(() => {
      const s = Math.max(0, Math.ceil((m.at - conn.now()) / 1000));
      const el = $('#grc');
      if (el) el.textContent = s || 'Go!';
    });
  }

  function question(m) {
    root.innerHTML = `
    <div class="hq">
      <div class="hq-top"><span class="qcounter">${m.n} / ${m.total}</span><button class="btn ghost small light" id="skip">Skip ⏭</button></div>
      <h1 class="hq-text">${esc(m.q)}</h1>
      <div class="hq-mid"><div class="timer" id="timer"></div><div class="answered" id="answered">${m.answered} / ${m.players} answered</div></div>
      <div class="answer-grid n${m.answers.length}">${m.answers.map((a, i) => `<div class="ans" style="--c:${ANSWER_COLORS[i]}"><span class="shape">${ANSWER_SHAPES[i]}</span>${esc(a)}</div>`).join('')}</div>
    </div>`;
    $('#skip').onclick = () => conn.send({ t: 'next' });
    let lastSec = -1;
    setTick(() => {
      const left = Math.max(0, m.endsAt - conn.now());
      const s = Math.ceil(left / 1000);
      const el = $('#timer');
      if (el) { el.textContent = s; el.classList.toggle('low', s <= 5); }
      if (s !== lastSec && s <= 5 && s > 0) beep('tick');
      lastSec = s;
    });
  }

  function reveal(m) {
    setTick(null);
    const max = Math.max(1, ...m.counts);
    root.innerHTML = `
    <div class="hq">
      <div class="hq-top"><span class="qcounter">${m.n} / ${m.total}</span><button class="btn yellow" id="next">${m.last ? 'Final results 🏆' : 'Next ▶'}</button></div>
      <h1 class="hq-text">${esc(m.q)}</h1>
      <div class="bars">${m.counts.map((c, i) => `<div class="bar-col ${i === m.correct ? 'right' : 'dim'}"><div class="bar-num">${c}</div><div class="bar" style="--c:${ANSWER_COLORS[i]};height:${(c / max) * 100}%"></div><div class="bar-shape" style="--c:${ANSWER_COLORS[i]}">${ANSWER_SHAPES[i]}${i === m.correct ? ' ✓' : ''}</div></div>`).join('')}</div>
      <div class="answer-grid n${m.answers.length}">${m.answers.map((a, i) => `<div class="ans ${i === m.correct ? 'right' : 'dim'}" style="--c:${ANSWER_COLORS[i]}"><span class="shape">${ANSWER_SHAPES[i]}</span>${esc(a)}${i === m.correct ? ' ✓' : ''}</div>`).join('')}</div>
    </div>`;
    $('#next').onclick = () => conn.send({ t: m.last ? 'end' : 'next' });
  }

  function leaderboard(m) {
    setTick(null);
    root.innerHTML = `
    <div class="hboard">
      <div class="hq-top"><h1>Leaderboard</h1><button class="btn yellow" id="next">Next question ▶</button></div>
      <ol class="board">${m.board.slice(0, 8).map((p) => `<li>${skinSvg(p.skin, 44)}<span class="bname">${esc(p.name)}</span>${p.streak >= 2 ? `<span class="streak">🔥${p.streak}</span>` : ''}<b>${fmt(p.score)}</b></li>`).join('')}</ol>
    </div>`;
    $('#next').onclick = () => conn.send({ t: 'next' });
  }

  // ---------------------------------------------------------------- self-paced
  function playing(m) {
    const unit = game.mode === 'race' ? '$' : '🪙';
    root.innerHTML = `
    <div class="live">
      <div class="live-top">
        <div><span class="mode-chip">${esc(MODES[game.mode].name)}</span> <b>${esc(game.title)}</b> · PIN <b>${pin}</b></div>
        <div class="row"><div class="clock" id="clock"></div><button class="btn danger small" id="endb">End game</button></div>
      </div>
      ${m.goal ? `<div class="goal">Goal: ${unit === '$' ? '$' : ''}${fmt(m.goal)}${unit === '🪙' ? ' gold' : ''}</div>` : ''}
      <div class="live-body">
        <ol class="board live-board" id="lb"></ol>
        <aside class="feed"><h3>Live feed</h3><ul id="feed"></ul></aside>
      </div>
    </div>`;
    $('#endb').onclick = async () => { if (await confirmBox('End the game now?', 'End game')) conn.send({ t: 'end' }); };
    renderFeed();
    setTick(() => {
      const left = Math.max(0, m.endsAt - conn.now());
      const el = $('#clock');
      if (el) el.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
    });
  }

  function liveBoard(board, count) {
    const lb = $('#lb');
    if (!lb) return;
    const top = Math.max(1, board[0]?.score || 1, 1);
    const unit = game.mode === 'race' ? '$' : '';
    lb.innerHTML = board.slice(0, 15).map((p) => `<li><span class="rank">${p.rank}</span>${skinSvg(p.skin, 40)}<span class="bname">${esc(p.name)}</span><span class="pbar"><span style="width:${Math.max(2, (p.score / top) * 100)}%"></span></span><b>${unit}${fmt(p.score)}</b></li>`).join('')
      + (count > 15 ? `<li class="more">+ ${count - 15} more players</li>` : '');
  }

  function renderFeed() {
    const ul = $('#feed');
    if (!ul) return;
    ul.innerHTML = feed.slice(-14).reverse().map((f) => `<li>${esc(f.text)}</li>`).join('');
  }

  // ---------------------------------------------------------------- end
  function end(podium) {
    setTick(null);
    beep('win');
    const unit = game?.mode === 'race' ? '$' : '';
    const order = [podium[1], podium[0], podium[2]];
    root.innerHTML = `
    <div class="podium-screen">
      <h1>🏆 Final results</h1>
      <div class="podium">${order.map((p, i) => p ? `<div class="pod pod-${[2, 1, 3][i]}"><div class="pod-skin">${skinSvg(p.skin, [80, 110, 70][i])}</div><div class="pod-name">${esc(p.name)}</div><div class="pod-score">${unit}${fmt(p.score)}</div><div class="pod-block">${[2, 1, 3][i]}</div></div>` : '<div class="pod empty-pod"></div>').join('')}</div>
      ${podium.length > 3 ? `<ol class="board small-board" start="4">${podium.slice(3).map((p) => `<li>${skinSvg(p.skin, 32)}<span class="bname">${esc(p.name)}</span><b>${unit}${fmt(p.score)}</b></li>`).join('')}</ol>` : ''}
      <div class="row center"><a class="btn yellow big" href="#/sets">Back to my sets</a></div>
    </div>`;
    confetti(root);
  }

  return () => { clearInterval(tick); conn.close(); };
}

export function confetti(root) {
  const colors = ['#fde047', '#f472b6', '#60a5fa', '#4ade80', '#c084fc', '#fb923c'];
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < 80; i++) {
    const s = document.createElement('i');
    s.style.left = Math.random() * 100 + '%';
    s.style.background = colors[i % colors.length];
    s.style.animationDelay = Math.random() * 1.5 + 's';
    s.style.animationDuration = 2.5 + Math.random() * 2 + 's';
    s.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.append(s);
  }
  root.append(box);
  setTimeout(() => box.remove(), 6000);
}
