import { api, state } from './api.js';
import { $, esc, fmt, toast, beep, modal } from './ui.js';
import { BOXES, SKINS, SKIN_MAP, RARITIES, RARITY_ORDER, boxOdds, skinSvg } from './skins.js';

export function shopView(app) {
  const u = state.user;
  app.innerHTML = `
  <div class="row between wrap">
    <h2 class="section-title">Skin Shop</h2>
    <div class="coin-big">🪙 <b id="mycoins">${fmt(u.coins)}</b> coins</div>
  </div>
  <p class="muted">Earn coins by playing games (up to 100 a game) and claiming your daily bonus. Duplicates give coins back.</p>
  <div class="box-grid">
    ${BOXES.map((b) => `
      <div class="box-card" style="--bc:${b.color}">
        <div class="box-art"><div class="box-lid"></div><div class="box-body">?</div></div>
        <h3>${esc(b.name)}</h3>
        <div class="box-preview">${b.skins.slice(-4).map((id) => skinSvg(id, 34)).join('')}</div>
        <button class="btn yellow" data-open="${b.id}">Open · 🪙 ${b.price}</button>
        <button class="linkish" data-odds="${b.id}">See what's inside</button>
      </div>`).join('')}
  </div>`;
  app.querySelector('.box-grid').addEventListener('click', async (e) => {
    const odds = e.target.closest('[data-odds]');
    if (odds) return showOdds(BOXES.find((b) => b.id === odds.dataset.odds));
    const open = e.target.closest('[data-open]');
    if (!open) return;
    const box = BOXES.find((b) => b.id === open.dataset.open);
    if (state.user.coins < box.price) return toast(`You need ${box.price - state.user.coins} more coins. Play a game or claim your daily bonus!`, 'bad');
    open.disabled = true;
    try {
      const r = await api('/api/shop/open', { method: 'POST', body: { box: box.id } });
      $('#mycoins').textContent = fmt(r.user.coins);
      reveal(box, r);
    } catch (err) { toast(err.message, 'bad'); }
    open.disabled = false;
  });
}

function showOdds(box) {
  modal(`<h2>${esc(box.name)}</h2>
    ${boxOdds(box).map((o) => `<div class="odds-row"><div class="odds-head" style="color:${RARITIES[o.rarity].color}"><b>${RARITIES[o.rarity].name}</b><span>${o.pct < 1 ? o.pct.toFixed(2) : o.pct.toFixed(1)}%</span></div>
      <div class="odds-skins">${o.skins.map((id) => `<div class="mini-skin" title="${esc(SKIN_MAP[id].name)}">${skinSvg(id, 48)}<small>${esc(SKIN_MAP[id].name)}</small></div>`).join('')}</div></div>`).join('')}`, { wide: true });
}

function reveal(box, r) {
  const skin = SKIN_MAP[r.skin];
  const rar = RARITIES[skin.rarity];
  modal(`<div class="opening" style="--bc:${box.color};--rc:${rar.color}">
      <div class="open-box shake"><div class="box-art big"><div class="box-lid"></div><div class="box-body">?</div></div></div>
      <div class="open-result hidden">
        <div class="burst"></div>
        <div class="open-skin">${skinSvg(skin.id, 160)}</div>
        <div class="rarity-tag" style="background:${rar.color}">${rar.name}</div>
        <h2>${esc(skin.name)}</h2>
        ${r.duplicate ? `<p class="muted">You already had this one: +${r.refund} coins back</p>` : '<p class="good-text">New skin unlocked!</p>'}
        <div class="row center">${r.duplicate ? '' : '<button class="btn yellow" data-equip>Equip it</button>'}<button class="btn ghost" data-close>Nice!</button></div>
      </div>
    </div>`, {
    onMount(m, close) {
      setTimeout(() => {
        m.querySelector('.open-box').classList.add('hidden');
        m.querySelector('.open-result').classList.remove('hidden');
        beep(RARITY_ORDER.indexOf(skin.rarity) >= 4 ? 'win' : 'pop');
      }, 1300);
      m.querySelector('[data-close]').onclick = close;
      m.querySelector('[data-equip]')?.addEventListener('click', async () => {
        try { await api('/api/equip', { method: 'POST', body: { skin: skin.id } }); toast(`Equipped ${skin.name}!`, 'good'); close(); }
        catch (e) { toast(e.message, 'bad'); }
      });
    },
  });
}

export function lockerView(app) {
  const render = () => {
    const u = state.user;
    const ownedCount = SKINS.filter((s) => u.owned[s.id]).length;
    const sorted = [...SKINS].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
    app.innerHTML = `
    <div class="row between wrap"><h2 class="section-title">Locker</h2><span class="muted">${ownedCount} / ${SKINS.length} skins collected</span></div>
    <div class="locker-top">${skinSvg(u.skin, 120)}<div><p class="muted">Equipped</p><h2>${esc(SKIN_MAP[u.skin]?.name || '')}</h2><a class="btn small yellow" href="#/shop">Get more skins</a></div></div>
    <div class="skin-grid">
      ${sorted.map((s) => {
        const own = u.owned[s.id];
        const rar = RARITIES[s.rarity];
        return `<button class="skin-card ${own ? '' : 'locked'} ${u.skin === s.id ? 'equipped' : ''}" data-skin="${s.id}" ${own ? '' : 'disabled'} style="--rc:${rar.color}">
          <div class="skin-art">${skinSvg(s.id, 72)}</div>
          <b>${own ? esc(s.name) : '???'}</b>
          <small style="color:${rar.color}">${rar.name}${own > 1 ? ` · ×${own}` : ''}</small>
          ${u.skin === s.id ? '<span class="eq">Equipped</span>' : ''}
        </button>`;
      }).join('')}
    </div>`;
  };
  render();
  app.addEventListener('click', onClick);
  async function onClick(e) {
    const b = e.target.closest('[data-skin]');
    if (!b || b.disabled || b.classList.contains('equipped')) return;
    try { await api('/api/equip', { method: 'POST', body: { skin: b.dataset.skin } }); beep('pop'); render(); }
    catch (err) { toast(err.message, 'bad'); }
  }
  return () => app.removeEventListener('click', onClick);
}
