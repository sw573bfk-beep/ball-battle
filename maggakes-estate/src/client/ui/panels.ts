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
import { BADGES, BEARDS, BOTTOMS, BUILDS, EYE_COLORS, HAIR, HEIGHTS, LIP_COLORS, SHOES, TOPS, normalizeLook } from '../../shared/look';
import { colorRow, CLOTH_COLORS } from './color';
import { portrait } from '../engine/portrait';

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
  report: () => void;
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
  const look: Look = normalizeLook(JSON.parse(JSON.stringify(opts.villa && s0.villa.look ? s0.villa.look : s0.look)));
  if (opts.villa && !s0.villa.look) look.outfit = 'fit_villa';
  let saved = false;
  type WTab = 'look' | 'clothes' | 'extras' | 'saved' | 'profile';
  let tab = 'look' as WTab;
  let mix = !!(look.top || look.bottom);
  const prof = { ...(s0.profile ?? {}) };
  const body = h('div.wardrobe');
  const owned = (slot: string) => SHOP.filter((i) => i.slot === slot && (ctx.save().inventory[i.id] ?? 0) > 0);
  const update = () => { ctx.previewLook(JSON.parse(JSON.stringify(look))); render(); };
  const chip = (on: boolean, label: string | Node, fn: () => void) => h('button.chip' + (on ? '.on' : ''), { onclick: () => { fn(); update(); } }, label);
  const sec = (title: string, ...kids: (Node | null)[]) => h('section', {}, h('h4', {}, title), ...kids.filter(Boolean) as Node[]);
  const colors = (v: string | undefined, presets: string[], set: (c: string) => void) => colorRow(v, presets, (c, live) => { set(c); if (live) ctx.previewLook(JSON.parse(JSON.stringify(look))); else update(); });
  const slotRow = (slot: 'glasses' | 'bag' | 'jewel' | 'hat' | 'perfume', title: string) => {
    const items = owned(slot);
    return sec(title, h('div.row', {}, chip(!look[slot], 'None', () => { delete look[slot]; }),
      ...items.map((i) => chip(look[slot] === i.id, `${i.emoji} ${i.name}`, () => { look[slot] = i.id; }))),
    items.length ? null : h('p.muted', {}, 'Buy some in the shop!'));
  };
  const saveBtn = () => h('div.actions', {}, h('button.btn.big', {
    onclick: () => {
      saved = true;
      ctx.net.send(opts.villa ? { t: 'villaLook', look } : { t: 'look', look });
      ctx.previewLook(null);
      close();
      opts.onSaved?.();
    },
  }, opts.villa ? '🌴 Save villa look' : '💾 Save look'));
  const tabs: [WTab, string][] = [['look', '🙂 Look'], ['clothes', '👕 Clothes'], ['extras', '🕶️ Extras'], ['saved', '💾 Saved'], ['profile', '🏷️ Profile']];
  const render = () => {
    const s = ctx.save();
    const head = h('div.wtabs', {}, ...tabs.map(([k, l]) => h('button.tab' + (tab === k ? '.on' : ''), { onclick: () => { tab = k; render(); } }, l)));
    let content: Node[] = [];
    if (tab === 'look') {
      content = [
        sec('Avatar', h('div.row', {}, chip(look.body === 'girl', '👧 Girl', () => { look.body = 'girl'; }), chip(look.body === 'boy', '👦 Boy', () => { look.body = 'boy'; }))),
        sec('Build', h('div.row', {}, ...BUILDS.map((b) => chip(look.build === b.id, b.label, () => { look.build = b.id; })))),
        sec('Height', h('div.row', {}, ...HEIGHTS.map((b) => chip(look.height === b.id, b.label, () => { look.height = b.id; })))),
        sec('Skin', colors(look.skin, SKINS, (c) => { look.skin = c; })),
        sec('Hairstyle', h('div.row', {}, ...[...HAIR].sort((a, b) => Number(b.for === look.body) - Number(a.for === look.body)).map((st) => chip(look.hair === st.id, st.label, () => { look.hair = st.id; })))),
        sec('Hair colour', colors(look.hairColor, HAIR_COLORS, (c) => { look.hairColor = c; })),
        sec('Eyes', colors(look.eyes, EYE_COLORS, (c) => { look.eyes = c; })),
        sec('Lips', colors(look.lips, [...LIP_COLORS, '#b07a6e'], (c) => { look.lips = c; })),
        look.body === 'boy' ? sec('Facial hair', h('div.row', {}, ...BEARDS.map((b) => chip(look.beard === b.id, b.label, () => { look.beard = b.id; })))) : null,
        saveBtn(),
      ].filter(Boolean) as Node[];
    } else if (tab === 'clothes') {
      const outfits = owned('outfit');
      content = [
        sec('Style', h('div.row', {},
          chip(!mix, '👗 Outfits', () => { mix = false; delete look.top; delete look.bottom; }),
          chip(mix, '🧩 Mix & match', () => { mix = true; look.top ??= 'tee'; look.bottom ??= 'jeans'; }))),
        mix
          ? h('div', {},
            sec('Top', h('div.row', {}, ...TOPS.map((t) => chip(look.top === t.id, t.label, () => { look.top = t.id; })))),
            sec('Bottoms', h('div.row', {}, ...BOTTOMS.map((t) => chip(look.bottom === t.id, t.label, () => { look.bottom = t.id; })))))
          : sec('Outfit', h('div.row', {}, ...outfits.map((i) => chip(look.outfit === i.id, `${i.emoji} ${i.name}`, () => { look.outfit = i.id; })))),
        sec('Shoes', h('div.row', {}, chip(!look.shoes, 'Match outfit', () => { delete look.shoes; }), ...SHOES.map((t) => chip(look.shoes === t.id, t.label, () => { look.shoes = t.id; })))),
        sec('Top colour', colors(look.colors?.top, CLOTH_COLORS, (c) => { look.colors = { ...look.colors, top: c }; })),
        sec('Bottoms colour', colors(look.colors?.bottom, CLOTH_COLORS, (c) => { look.colors = { ...look.colors, bottom: c }; })),
        sec('Shoe colour', colors(look.colors?.shoes, CLOTH_COLORS, (c) => { look.colors = { ...look.colors, shoes: c }; })),
        look.colors ? h('div.row', {}, chip(false, '↩ Reset colours', () => { delete look.colors; })) : null,
        saveBtn(),
      ].filter(Boolean) as Node[];
    } else if (tab === 'extras') {
      content = [slotRow('glasses', 'Sunglasses'), slotRow('bag', 'Handbag'), slotRow('jewel', 'Jewellery'), slotRow('hat', 'Hat'), slotRow('perfume', 'Perfume (sparkle trail)'), saveBtn()];
    } else if (tab === 'saved') {
      const slots = Array.from({ length: 6 }, (_, i) => s.outfits?.[i]);
      content = [
        h('p.muted', {}, 'Save up to 6 looks and swap with one tap.'),
        h('div.slots', {}, ...slots.map((o, i) => {
          const name = h<HTMLInputElement>('input', { placeholder: `Look ${i + 1}`, value: o?.name ?? '', maxLength: 16 });
          return h('div.slot', {},
            o ? h('img', { src: portrait(o.look, 'head', 168), alt: o.name }) : h('div.empty', {}, '+'),
            name,
            h('div.row', {},
              o ? h('button.mini', { onclick: () => {
                Object.assign(look, normalizeLook(JSON.parse(JSON.stringify(o.look))));
                for (const k of ['top', 'bottom', 'shoes', 'colors', 'glasses', 'bag', 'jewel', 'hat', 'perfume'] as const) if (!(k in o.look)) delete look[k];
                mix = !!(look.top || look.bottom);
                ctx.net.send(opts.villa ? { t: 'villaLook', look } : { t: 'look', look });
                update();
              } }, '👗 Wear') : null,
              h('button.mini', { onclick: () => ctx.net.send({ t: 'outfit', slot: i, name: name.value, look }) }, o ? '💾 Replace' : '💾 Save here')));
        })),
      ];
    } else {
      const label = `${prof.badge ? prof.badge + ' ' : ''}${s.name}`;
      const bio = h<HTMLTextAreaElement>('textarea.bio', { maxLength: 80, rows: 2, placeholder: 'A short bio friends can see (80 letters)' });
      bio.value = prof.bio ?? '';
      bio.oninput = () => { prof.bio = bio.value; };
      content = [
        sec('Name tag preview', h('span.tagprev', { style: { background: prof.color ?? 'rgba(20,20,30,.55)', color: '#fff' } }, label)),
        sec('Name tag colour', colorRow(prof.color, ['#ff6f91', '#9b7ede', '#4fd1c5', '#ffd23f', '#2b6cff', '#111111', '#ff9f1c'], (c, live) => { prof.color = c; if (!live) render(); }),
          prof.color ? h('button.mini', { onclick: () => { delete prof.color; render(); } }, '↩ Default') : null),
        sec('Badge', h('div.badges', {}, ...BADGES.map((b) => h('button' + ((prof.badge ?? '') === b ? '.on' : ''), { onclick: () => { prof.badge = b; render(); } }, b || '✕')))),
        sec('Bio', bio),
        h('div.actions', {}, h('button.btn.big', { onclick: () => ctx.net.send({ t: 'profile', profile: prof }) }, '✨ Save profile')),
      ];
    }
    fill(body, head, ...content);
  };
  const off = ctx.onSave(() => { if (tab === 'saved') render(); });
  ctx.previewLook(JSON.parse(JSON.stringify(look)));
  render();
  const close = sheet(opts.villa ? 'Villa Dressing Room' : 'Wardrobe', body, { className: 'side', onClose: () => { off(); if (!saved) ctx.previewLook(null); } });
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
      h('section', {}, h('h4', {}, 'Something wrong?'), h('button.btn', { onclick: () => ctx.report() }, '🐞 Report a problem'),
        h('p.muted', {}, "Or message Beau on Teams about errors and they'll be fixed.")),
      h('section', {}, h('button.btn.warn', { onclick: () => ctx.signOut() }, 'Sign out')),
    );
  };
  render();
  sheet('Settings', body);
}

// ===================================================================== Garage

export function openGarage(ctx: Ctx, onDrive: () => void): void {
  const body = h('div.garage');
  let picked: string | null = null;
  const RIMS = ['#cfd4da', '#d8b45a', '#1b1c1f', '#ffffff', '#ff3d7f', '#2aa8ff', '#7cff6b', '#b388ff'];
  const render = () => {
    const s = ctx.save();
    const cars = SHOP.filter((i) => i.cat === 'car' && (s.inventory[i.id] || i.free));
    const cur = shopItem(picked ?? '') ?? shopItem(s.car) ?? cars[0];
    const paint = s.carPaint[cur.id] ?? String(cur.r.color);
    const rim = s.carWheels?.[cur.id];
    const send = (paint?: string, wheels?: string) => {
      ctx.net.send({ t: 'car', car: cur.id, paint, wheels });
      ctx.net.send({ t: 'car', car: null });
    };
    fill(body,
      h('section', {}, h('h4', {}, 'Your cars'), h('div.row', {}, ...cars.map((c) => h('button.chip' + (c.id === cur.id ? '.on' : ''), { onclick: () => {
        picked = c.id;
        if (c.id !== 'car_kart') { ctx.net.send({ t: 'car', car: c.id }); ctx.net.send({ t: 'car', car: null }); } else render();
      } }, `${c.emoji} ${c.name}`))),
        h('p.muted', {}, 'Tap a car to pick it. The Mini Kart is for zooming around inside. Buy more cars in the shop.')),
      h('section', {}, h('h4', {}, `🎨 Paint for ${cur.name}`), colorRow(paint, [...CAR_PAINTS], (c, live) => { if (!live) send(c); })),
      h('section', {}, h('h4', {}, '🛞 Wheel colour'), colorRow(rim, RIMS, (c, live) => { if (!live) send(undefined, c); })),
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
