import { h, sheet, toast, fill } from './dom';
import { SHOP, CAR_PAINTS, shopItem, type ShopCat, type ShopItem } from '../../shared/shop';
import { ALL_ZONES, FLOORS, TASK_AURA, floorById, zoneName, zoneNeed } from '../../shared/floors';
import { HAIR_COLORS, SKINS, VIP_DAILY, canEnter, dailyFor, floorDone, zoneUnlocked, type Look, type Save } from '../../shared/save';
import type { BoardRow } from '../../shared/protocol';
import type { ZoneId } from '../../shared/people';
import { isResidence, residenceNumber } from '../../shared/people';
import { getResidences } from '../world/layouts';
import type { Net } from '../net';
import type { Quality } from '../engine/gfx';
import { BEARDS, BUILDS, EYE_COLORS, HAIR, HEIGHTS, LIP_COLORS, normalizeLook } from '../../shared/look';

export interface Ctx {
  save: () => Save;
  admin: boolean;
  net: Net;
  zone: () => ZoneId;
  travel: (z: ZoneId) => void;
  previewLook: (look: Look | null) => void;
  onSave: (fn: () => void) => () => void;
  onBoard: (fn: (rows: BoardRow[]) => void) => () => void;
  quality: () => Quality;
  setQuality: (q: Quality) => void;
  walls: () => 'auto' | 'low';
  setWalls: (w: 'auto' | 'low') => void;
  signOut: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-AU');

function floorLabel(z: ZoneId): string {
  if (z === 'villa') return 'Love Island';
  if (z === 'park') return 'Car Park';
  return zoneName(z).split(' – ')[0];
}

// ===================================================================== Shop

export function openShop(ctx: Ctx, startTab: ShopCat = 'outfit'): void {
  let tab: ShopCat = startTab;
  const body = h('div.shop');
  const tabs: [ShopCat, string][] = [['outfit', '👗 Outfits'], ['accessory', '🕶️ Accessories'], ['furniture', '🛋️ Furniture'], ['car', '🚗 Cars']];
  const render = () => {
    const s = ctx.save();
    const items = SHOP.filter((i) => i.cat === tab && i.id !== 'fit_villa');
    fill(body, 
      h('div.wallet', {}, h('span', {}, '💎 Available Aura: ', h('b', {}, fmt(s.aura))), h('span.muted', {}, `⭐ Total ${fmt(s.totalAura)}`)),
      h('div.tabs', {}, ...tabs.map(([k, l]) => h('button.tab' + (k === tab ? '.on' : ''), { onclick: () => { tab = k; render(); } }, l))),
      h('div.grid', {}, ...items.map((it) => card(it, s))),
    );
  };
  const card = (it: ShopItem, s: Save) => {
    const owned = s.inventory[it.id] ?? 0;
    const floorLocked = it.floor && !zoneUnlocked(s, it.floor);
    const vipLocked = it.vip && !s.vip;
    const stackable = it.cat === 'furniture';
    let btn: HTMLElement;
    if (owned && !stackable) btn = h('button.btn.ghost', { disabled: true }, '✓ Owned');
    else if (vipLocked) btn = h('button.btn.ghost', { disabled: true }, '⭐ VIP only');
    else if (floorLocked) btn = h('button.btn.ghost', { disabled: true }, `🔒 ${floorLabel(it.floor!)}`);
    else btn = h('button.btn' + (s.aura < it.price ? '.ghost' : ''), { onclick: () => ctx.net.send({ t: 'buy', item: it.id }) }, it.price === 0 ? 'Free' : `💎 ${fmt(it.price)}`);
    return h('div.card' + (it.vip ? '.vip' : ''), {},
      h('div.emoji', {}, it.emoji),
      h('div.name', {}, it.name),
      stackable && owned ? h('div.muted', {}, `You have ${owned}`) : null,
      btn);
  };
  const off = ctx.onSave(render);
  render();
  sheet('Aura Shop', body, { wide: true, onClose: off });
}

// ===================================================================== Wardrobe

export function openWardrobe(ctx: Ctx, opts: { villa?: boolean; onSaved?: () => void } = {}): void {
  const s0 = ctx.save();
  const look: Look = normalizeLook({ ...(opts.villa && s0.villa.look ? s0.villa.look : s0.look) });
  if (opts.villa && !s0.villa.look) look.outfit = 'fit_villa';
  let saved = false;
  const body = h('div.wardrobe');
  const owned = (slot: string) => SHOP.filter((i) => i.slot === slot && (ctx.save().inventory[i.id] ?? 0) > 0);
  const chip = (on: boolean, label: string | Node, fn: () => void, extra = '') => h('button.chip' + (on ? '.on' : '') + extra, { onclick: () => { fn(); ctx.previewLook({ ...look }); render(); } }, label);
  const sw = (on: boolean, color: string, fn: () => void) => h('button.swatch' + (on ? '.on' : ''), { style: { background: color }, onclick: () => { fn(); ctx.previewLook({ ...look }); render(); }, title: color });
  const slotRow = (slot: 'glasses' | 'bag' | 'jewel' | 'hat' | 'perfume', title: string) => {
    const items = owned(slot);
    return h('section', {}, h('h4', {}, title),
      h('div.row', {}, chip(!look[slot], 'None', () => { delete look[slot]; }),
        ...items.map((i) => chip(look[slot] === i.id, `${i.emoji} ${i.name}`, () => { look[slot] = i.id; }))),
      items.length ? null : h('p.muted', {}, 'Buy some in the shop!'));
  };
  const render = () => {
    const outfits = owned('outfit');
    fill(body, 
      h('section', {}, h('h4', {}, 'Avatar'), h('div.row', {}, chip(look.body === 'girl', '👧 Girl', () => { look.body = 'girl'; }), chip(look.body === 'boy', '👦 Boy', () => { look.body = 'boy'; }))),
      h('section', {}, h('h4', {}, 'Skin'), h('div.row', {}, ...SKINS.map((c) => sw(look.skin === c, c, () => { look.skin = c; })))),
      h('section', {}, h('h4', {}, 'Build'), h('div.row', {}, ...BUILDS.map((b) => chip(look.build === b.id, b.label, () => { look.build = b.id; })))),
      h('section', {}, h('h4', {}, 'Height'), h('div.row', {}, ...HEIGHTS.map((b) => chip(look.height === b.id, b.label, () => { look.height = b.id; })))),
      h('section', {}, h('h4', {}, 'Hairstyle'), h('div.row', {}, ...[...HAIR].sort((a, b) => Number(b.for === look.body) - Number(a.for === look.body)).map((st) => chip(look.hair === st.id, st.label, () => { look.hair = st.id; })))),
      h('section', {}, h('h4', {}, 'Hair colour'), h('div.row', {}, ...HAIR_COLORS.map((c) => sw(look.hairColor === c, c, () => { look.hairColor = c; })))),
      h('section', {}, h('h4', {}, 'Eyes'), h('div.row', {}, ...EYE_COLORS.map((c) => sw(look.eyes === c, c, () => { look.eyes = c; })))),
      h('section', {}, h('h4', {}, 'Lips'), h('div.row', {}, ...[...LIP_COLORS, '#b07a6e'].map((c) => sw(look.lips === c, c, () => { look.lips = c; })))),
      look.body === 'boy' ? h('section', {}, h('h4', {}, 'Facial hair'), h('div.row', {}, ...BEARDS.map((b) => chip(look.beard === b.id, b.label, () => { look.beard = b.id; })))) : null,
      h('section', {}, h('h4', {}, 'Outfit'), h('div.row', {}, ...outfits.map((i) => chip(look.outfit === i.id, `${i.emoji} ${i.name}`, () => { look.outfit = i.id; })))),
      slotRow('glasses', 'Sunglasses'), slotRow('bag', 'Handbag'), slotRow('jewel', 'Jewellery'), slotRow('hat', 'Hat'), slotRow('perfume', 'Perfume (sparkle trail)'),
      h('div.actions', {}, h('button.btn.big', {
        onclick: () => {
          saved = true;
          ctx.net.send(opts.villa ? { t: 'villaLook', look } : { t: 'look', look });
          ctx.previewLook(null);
          close();
          opts.onSaved?.();
        },
      }, opts.villa ? '🌴 Save villa look' : '💾 Save look')),
    );
  };
  ctx.previewLook({ ...look });
  render();
  const close = sheet(opts.villa ? 'Villa Dressing Room' : 'Wardrobe', body, { className: 'side', onClose: () => { if (!saved) ctx.previewLook(null); } });
}

// ===================================================================== Map

export function openMap(ctx: Ctx): void {
  const body = h('div.map');
  const render = () => {
    const s = ctx.save();
    const res = getResidences();
    const order: ZoneId[] = ['villa', ...res.map((r) => r.zone).reverse(), 'f8', 'f7', 'f6', 'f5', 'f4', 'f3', 'f2', 'f1', 'b', 'park'];
    fill(body, ...order.map((z) => {
      const here = ctx.zone() === z;
      const open = canEnter(s, z);
      const unlocked = zoneUnlocked(s, z);
      const f = floorById(z);
      const home = s.home?.zone === z;
      let status: string;
      if (isResidence(z)) {
        const who = res.find((r) => r.zone === z)?.owners.map((o) => o.name) ?? [];
        status = `🏠 ${home ? 'Your floor! ' : ''}Bedrooms: ${who.join(' & ') || 'empty'}`;
      } else if (!open) status = `🔒 Needs ${fmt(zoneNeed(z))} Total Aura (${fmt(Math.max(0, zoneNeed(z) - s.totalAura))} to go)`;
      else if (!unlocked && home) status = '🏠 Your home floor — tasks unlock later';
      else if (f && f.tasks.length) status = `${floorDone(s, z) === 5 ? '✅' : '📝'} ${floorDone(s, z)}/5 tasks done`;
      else status = z === 'villa' ? '💘 Love Island Mode unlocked!' : z === 'b' ? '🆓 Free level' : '🚗 Your car collection';
      return h('div.flr' + (open ? '' : '.locked') + (here ? '.here' : '') + (z === 'villa' ? '.villa' : ''), {},
        h('div.lvl', {}, z === 'villa' ? '♥' : z === 'park' ? 'P' : isResidence(z) ? `R${residenceNumber(z)}` : f?.short ?? '?'),
        h('div.info', {}, h('b', {}, zoneName(z)), h('small', {}, status), f?.blurb ? h('small.muted', {}, f.blurb) : null),
        here ? h('span.pill', {}, 'You are here') : h('button.btn' + (open ? '' : '.ghost'), { disabled: !open, onclick: () => { close(); ctx.travel(z); } }, open ? 'Go ▸' : '🔒'));
    }));
  };
  const off = ctx.onSave(render);
  render();
  const close = sheet('Mansion Map & Lift', body, { onClose: off });
}

// ===================================================================== Daily

export function openDaily(ctx: Ctx): void {
  const body = h('div.daily');
  const render = () => {
    const s = ctx.save();
    const list = [...dailyFor(s.daily.date), ...(s.vip ? [VIP_DAILY] : [])];
    fill(body, 
      h('p.muted', {}, `New challenges every day at midnight. Today: ${s.daily.date}`),
      ...list.map((d) => {
        const v = Math.min(d.goal, s.daily.stats[d.stat] ?? 0);
        const claimed = s.daily.claimed.includes(d.id);
        return h('div.challenge' + (d.vip ? '.vip' : ''), {},
          h('div', {}, h('b', {}, d.label), h('div.bar', {}, h('i', { style: { width: `${(v / d.goal) * 100}%` } })), h('small', {}, `${v}/${d.goal} · +${d.reward} Aura`)),
          claimed ? h('span.pill', {}, '✓ Claimed') : h('button.btn' + (v >= d.goal ? '' : '.ghost'), { disabled: v < d.goal, onclick: () => ctx.net.send({ t: 'daily', id: d.id }) }, 'Claim'));
      }),
      s.vip ? null : h('p.muted', {}, '⭐ VIP players get an extra daily challenge. Beau, Milla and Keola hand out VIP.'),
    );
  };
  const off = ctx.onSave(render);
  render();
  sheet('Daily Challenges', body, { onClose: off });
}

// ===================================================================== Leaderboard + admin

export function openBoard(ctx: Ctx): void {
  const body = h('div.board', {}, h('p.muted', {}, 'Loading…'));
  const render = (rows: BoardRow[]) => {
    const medal = ['🥇', '🥈', '🥉'];
    fill(body, 
      h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Name'), h('th', {}, '⭐ Aura'), h('th', {}, 'Floor'), h('th', {}, '🏆'), ctx.admin ? h('th', {}, 'Admin') : null)),
        h('tbody', {}, ...rows.map((r, i) => h('tr' + (r.name === ctx.save().name ? '.me' : ''), {},
          h('td', {}, medal[i] ?? String(i + 1)),
          h('td', {}, h('span.dot' + (r.online ? '.on' : ''), { title: r.online ? 'Online' : 'Offline' }), r.vip ? '⭐ ' : '', r.name, r.partner ? h('small.muted', {}, ` 💘 ${r.partner}`) : null),
          h('td', {}, fmt(r.totalAura)),
          h('td', {}, floorLabel(r.top)),
          h('td', {}, r.villaWins ? String(r.villaWins) : '–'),
          ctx.admin ? h('td.admin', {},
            h('button.mini', { onclick: () => ctx.net.send({ t: 'admin', action: r.vip ? 'unvip' : 'vip', target: r.name }) }, r.vip ? 'Remove VIP' : 'Give VIP'),
            r.hasPassword ? h('button.mini.warn', { onclick: () => { if (confirm(`Reset ${r.name}'s password? They'll make a new one next time they sign in.`)) ctx.net.send({ t: 'admin', action: 'reset', target: r.name }); } }, 'Reset password') : h('small.muted', {}, 'no password yet'),
          ) : null,
        )))),
      ctx.admin ? h('p.muted', {}, '🛡️ You can give VIP and reset passwords because you are an estate manager.') : null,
    );
  };
  const off = ctx.onBoard(render);
  ctx.net.send({ t: 'board' });
  sheet('Aura Leaderboard', body, { wide: true, onClose: off });
}

// ===================================================================== Settings

export function openSettings(ctx: Ctx): void {
  const body = h('div.settings');
  const render = () => {
    fill(body, 
      h('section', {}, h('h4', {}, 'Graphics'), h('div.row', {}, ...(['high', 'medium', 'low'] as Quality[]).map((q) => h('button.chip' + (ctx.quality() === q ? '.on' : ''), { onclick: () => { ctx.setQuality(q); render(); } }, q[0].toUpperCase() + q.slice(1)))),
        h('p.muted', {}, 'Use Low on older phones if the game feels slow.')),
      h('section', {}, h('h4', {}, 'Walls'), h('div.row', {},
        h('button.chip' + (ctx.walls() === 'auto' ? '.on' : ''), { onclick: () => { ctx.setWalls('auto'); render(); } }, 'Auto (hide walls in the way)'),
        h('button.chip' + (ctx.walls() === 'low' ? '.on' : ''), { onclick: () => { ctx.setWalls('low'); render(); } }, 'Dollhouse (all walls low)'))),
      h('section', {}, h('h4', {}, 'Controls'), h('ul.help', {},
        h('li', {}, 'Move: WASD / arrow keys, or the joystick on phones'),
        h('li', {}, 'Camera: drag the screen · zoom: scroll or pinch'),
        h('li', {}, 'Interact: E or the big button'),
        h('li', {}, 'Chat: Enter · Emotes: 1–5'))),
      h('section', {}, h('button.btn.warn', { onclick: () => ctx.signOut() }, 'Sign out')),
    );
  };
  render();
  sheet('Settings', body);
}

// ===================================================================== Garage

export function openGarage(ctx: Ctx, onDrive: () => void): void {
  const body = h('div.garage');
  const render = () => {
    const s = ctx.save();
    const cars = SHOP.filter((i) => i.cat === 'car' && s.inventory[i.id]);
    const cur = shopItem(s.car) ?? cars[0];
    const paint = s.carPaint[cur.id] ?? String(cur.r.color);
    fill(body, 
      h('section', {}, h('h4', {}, 'Your cars'), h('div.row', {}, ...cars.map((c) => h('button.chip' + (c.id === cur.id ? '.on' : ''), { onclick: () => { ctx.net.send({ t: 'car', car: c.id }); ctx.net.send({ t: 'car', car: null }); } }, `${c.emoji} ${c.name}`))),
        h('p.muted', {}, 'Buy more cars in the shop — they park in your bays here.')),
      h('section', {}, h('h4', {}, `Paint for ${cur.name}`), h('div.row', {}, ...CAR_PAINTS.map((p) => h('button.swatch' + (p === paint ? '.on' : ''), { style: { background: p }, onclick: () => { ctx.net.send({ t: 'car', car: cur.id, paint: p }); ctx.net.send({ t: 'car', car: null }); } })))),
      h('div.actions', {}, h('button.btn.big', { onclick: () => { close(); onDrive(); } }, '🚗 Drive it!')),
    );
  };
  const off = ctx.onSave(render);
  render();
  const close = sheet('Garage', body, { onClose: off });
}

// ===================================================================== Floor tasks summary

export function taskList(save: Save, zone: ZoneId): { label: string; done: boolean }[] {
  const f = floorById(zone);
  if (!f) return [];
  return f.tasks.map((t) => ({ label: t.label, done: !!save.tasks[`${zone}:${t.id}`] }));
}

export function nextGoal(save: Save): { text: string; frac: number } {
  const next = FLOORS.find((f) => f.need > save.totalAura);
  if (!next) {
    return zoneUnlocked(save, 'villa') ? { text: 'All floors unlocked! 💘 Love Island is open', frac: 1 } : { text: '', frac: 1 };
  }
  const prev = Math.max(0, next.need - 1000);
  return { text: `${fmt(next.need - save.totalAura)} Aura to unlock ${next.name.split(' – ')[0]}`, frac: (save.totalAura - prev) / (next.need - prev) };
}

export { TASK_AURA, ALL_ZONES, toast };
