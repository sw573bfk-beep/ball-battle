import { h, sheet, fill, closeAllSheets } from './dom';
import { SHOP } from '../../shared/shop';
import type { Home } from '../../shared/people';
import type { Net } from '../net';
import type { AccountRow, AdminAction, OwnerAction } from '../../shared/protocol';
import { zoneName } from '../../shared/floors';
import { OWNER, PAUSE_TEXT } from '../../shared/protocol';

interface AccountsCtx {
  net: Net;
  openReports: () => void;
  reports: () => number;
  admin: () => boolean;
  me: string;
  onAccounts: (fn: (rows: AccountRow[], paused: boolean, pauseText: string) => void) => () => void;
  /** Owner: walk into someone's bedroom (any floor). */
  visitRoom?: (home: Home) => void;
}

const when = (t: number) => (t ? new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—');
const ago = (t: number) => {
  if (!t) return 'never';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
};

/** All accounts. VIPs can look; admins can approve, ban, give VIP, reset passwords and make admins. */
export function openAccounts(ctx: AccountsCtx): void {
  const body = h('div.accounts', {}, h('p.muted', {}, 'Loading…'));
  const act = (action: AdminAction, target: string, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    ctx.net.send({ t: 'admin', action, target });
  };
  let draft: string | null = null; // keep what Beau is typing when the list refreshes
  const pauseBox = (paused: boolean, pauseText: string, rows: AccountRow[]) => {
    const msg = h('textarea.pausemsg', { maxLength: 400, rows: 4, placeholder: 'Type the message everyone will see…', oninput: () => { draft = msg.value; } }) as HTMLTextAreaElement;
    msg.value = draft ?? (pauseText || PAUSE_TEXT);
    const send = (on: boolean) => { draft = null; ctx.net.send({ t: 'pause', on, text: msg.value }); };
    const unlocked = rows.filter((r) => r.pauseOk && r.name !== OWNER).length;
    return h('div.pausebox' + (paused ? '.on' : ''), {},
      h('b', {}, paused ? `⏸️ The game is PAUSED. Only you${unlocked ? ` and ${unlocked} unlocked ${unlocked === 1 ? 'person' : 'people'}` : ''} can play.` : '▶️ The game is running.'),
      h('small.muted', {}, paused ? 'Everyone else sees this message (except people you 🔓 unlock below). Change it and press Update.' : 'Write a message, then pause. Everyone else (except people you 🔓 unlock below) is sent to a screen showing it. Their progress is kept.'),
      msg,
      h('div.row', {},
        paused
          ? h('button.btn.ghost', { onclick: () => send(true) }, '✏️ Update message')
          : h('button.btn.ghost', { onclick: () => { if (confirm('Pause the game for everyone except you?')) send(true); } }, '⏸️ Pause the game'),
        paused ? h('button.btn', { onclick: () => send(false) }, '▶️ Unpause the game') : null,
        h('button.mini', { onclick: () => { msg.value = PAUSE_TEXT; draft = PAUSE_TEXT; } }, 'Use the $15 message')),
      allowBox(rows));
  };
  /** Who can keep playing while the game is paused: a list with ✖, plus a picker to add anyone. */
  const allowBox = (rows: AccountRow[]) => {
    const people = rows.filter((r) => r.status === 'approved' && r.name !== OWNER);
    const allowed = people.filter((r) => r.pauseOk);
    const set = (name: string, on: boolean) => ctx.net.send({ t: 'pauseAllow', target: name, on });
    const pick = h('select.allow-pick', {}, h('option', { value: '' }, '+ Choose someone…'),
      ...people.filter((r) => !r.pauseOk).map((r) => h('option', { value: r.name }, `${r.name}${r.admin ? ' 🛡️' : r.vip ? ' ⭐' : ''}`))) as HTMLSelectElement;
    pick.onchange = () => { if (pick.value) set(pick.value, true); };
    return h('div.allowbox', {},
      h('b', {}, `🔓 Who can play while paused (${allowed.length})`),
      allowed.length
        ? h('div.row', {}, ...allowed.map((r) => h('span.allow-chip', {}, `${r.name}`, h('button', { title: `Lock ${r.name} out while paused`, onclick: () => set(r.name, false) }, '✖'))))
        : h('small.muted', {}, 'Only you. Add people below.'),
      h('div.row', {}, pick,
        h('button.mini', { onclick: () => people.filter((r) => r.admin || r.vip).forEach((r) => { if (!r.pauseOk) set(r.name, true); }) }, '+ All admins & VIPs'),
        allowed.length ? h('button.mini', { onclick: () => { if (confirm('Lock everyone except you out while paused?')) allowed.forEach((r) => set(r.name, false)); } }, 'Remove all') : null));
  };
  const render = (rows: AccountRow[], paused: boolean, pauseText: string) => {
    const admin = ctx.admin();
    const pending = rows.filter((r) => r.status === 'pending');
    const others = rows.filter((r) => r.status !== 'pending');
    fill(body,
      h('div.actions', { style: { justifyContent: 'flex-start', marginTop: '0' } }, h('button.btn' + (ctx.reports() ? '' : '.ghost'), { onclick: () => ctx.openReports() }, `🐞 Problem reports${ctx.reports() ? ` (${ctx.reports()} open)` : ''}`)),
      ctx.me === OWNER ? pauseBox(paused, pauseText, rows) : null,
      h('p.muted', {}, admin ? '🛡️ You are an admin. Passwords are scrambled — nobody can see them, but you can reset them.' : '⭐ VIPs can see every account. Only admins can change them.'),
      pending.length ? h('section.pending', {},
        h('h4', {}, `🆕 Waiting for approval (${pending.length})`),
        ...pending.map((r) => h('div.acct.pend', {},
          h('div', {}, h('b', {}, r.name), h('small.muted', {}, ` signed up ${when(r.created)}`)),
          admin ? h('div.acct-actions', {},
            h('button.btn', { onclick: () => act('approve', r.name) }, '✅ Approve'),
            ctx.me === OWNER && paused ? h('button.btn', { onclick: () => { act('approve', r.name); ctx.net.send({ t: 'pauseAllow', target: r.name, on: true }); } }, '✅ Approve & let play') : null,
            h('button.btn.ghost', { onclick: () => act('reject', r.name, `Reject ${r.name}'s sign-up? Their account will be deleted.`) }, '✖ Reject')) : h('small.muted', {}, 'An admin needs to approve them')))) : null,
      h('section', {}, h('h4', {}, `👥 All accounts (${others.length})`),
        h('div.acct-list', {}, ...others.map((r) => h('div.acct' + (r.status === 'banned' ? '.banned' : ''), {},
          h('div.acct-main', {},
            h('b', {}, h('span.dot' + (r.online ? '.on' : '')), r.name,
              r.admin ? h('span.tag.adm', {}, '🛡️ Admin') : null, r.vip ? h('span.tag.vipt', {}, '⭐ VIP') : null,
              r.founder ? h('span.tag', {}, '🏠 Original') : null, r.pauseOk ? h('span.tag.unlock', {}, '🔓 Plays while paused') : null, r.status === 'banned' ? h('span.tag.ban', {}, '⛔ Banned') : null),
            h('small.muted', {}, `${r.totalAura.toLocaleString('en-AU')} Aura · ${r.home ? zoneName(r.home.zone) : 'no bedroom'} · joined ${when(r.created)} · seen ${r.online ? 'online now' : ago(r.lastSeen)}${r.hasPassword ? '' : ' · no password yet'}`)),
          admin && r.name !== ctx.me ? h('div.acct-actions', {},
            ctx.me === OWNER && r.status === 'approved' ? h('button.mini.owner', { onclick: () => openOwnerTools(ctx, r) }, '👑 Powers') : null,
            ctx.me === OWNER && r.status === 'approved' ? h('button.mini' + (r.pauseOk ? '.on' : ''), { onclick: () => ctx.net.send({ t: 'pauseAllow', target: r.name, on: !r.pauseOk }) }, r.pauseOk ? '🔒 Lock when paused' : '🔓 Let play when paused') : null,
            r.status === 'approved' ? h('button.mini', { onclick: () => act(r.vip ? 'unvip' : 'vip', r.name) }, r.vip ? 'Remove VIP' : 'Give VIP') : null,
            h('button.mini', { onclick: () => act(r.admin ? 'unadmin' : 'admin', r.name, r.admin ? undefined : `Make ${r.name} an admin? They'll be able to approve, ban and reset passwords.`) }, r.admin ? 'Remove admin' : 'Make admin'),
            r.hasPassword ? h('button.mini', { onclick: () => act('reset', r.name, `Reset ${r.name}'s password? They'll make a new one next time they sign in.`) }, 'Reset password') : null,
            r.status === 'banned'
              ? h('button.mini', { onclick: () => act('unban', r.name) }, 'Unban')
              : h('button.mini.warn', { onclick: () => act('ban', r.name, `Ban ${r.name}? They'll be kicked out and can't sign in again.`) }, 'Ban')) : null)))),
    );
  };
  const off = ctx.onAccounts(render);
  ctx.net.send({ t: 'accounts' });
  sheet('👥 Accounts', body, { wide: true, onClose: off });
}

/** Beau's owner powers for one person: Aura, items, kick/mute/pull, and their bedroom. */
function openOwnerTools(ctx: AccountsCtx, r: AccountRow): void {
  const send = (action: OwnerAction, extra: { n?: number; item?: string } = {}) => ctx.net.send({ t: 'owner', action, target: r.name, ...extra });
  const amount = h('input.owner-n', { type: 'number', min: '1', step: '100', value: '1000', placeholder: 'Amount' }) as HTMLInputElement;
  const cats: [string, string][] = [['outfit', '👗 Outfits'], ['accessory', '🕶️ Accessories'], ['furniture', '🛋️ Furniture'], ['car', '🚗 Cars'], ['fun', '🎉 Fun']];
  const pick = h('select.owner-item', {},
    ...cats.map(([cat, label]) => h('optgroup', { label }, ...SHOP.filter((i) => i.cat === cat).map((i) => h('option', { value: i.id }, `${i.emoji} ${i.name}`)))),
    h('optgroup', { label: '✨ Everything else' }, ...SHOP.filter((i) => !cats.some(([c]) => c === i.cat)).map((i) => h('option', { value: i.id }, `${i.emoji} ${i.name}`)))) as HTMLSelectElement;
  const me = r.name === OWNER;
  const muted = r.mutedUntil && r.mutedUntil > Date.now();
  const body = h('div.owner-tools', {},
    h('p.muted', {}, `${r.online ? '🟢 Online' : '⚪ Offline'} · 💎 ${(r.aura ?? 0).toLocaleString('en-AU')} available · ⭐ ${r.totalAura.toLocaleString('en-AU')} total${r.home ? ` · 🏠 ${zoneName(r.home.zone)}` : ''}`),
    h('h4', {}, '💎 Aura'),
    h('div.row', {}, amount,
      h('button.btn', { onclick: () => send('give', { n: Number(amount.value) }) }, '➕ Give'),
      h('button.btn.ghost', { onclick: () => { if (confirm(`Take ${Number(amount.value).toLocaleString()} Aura from ${r.name}? (Total Aura too, which can re-lock floors.)`)) send('take', { n: Number(amount.value) }); } }, '➖ Take')),
    h('h4', {}, '🎁 Give any item'),
    h('div.row', {}, pick, h('button.btn', { onclick: () => send('item', { item: pick.value }) }, '🎁 Give')),
    me ? null : h('h4', {}, '🎮 Player'),
    me ? null : h('div.row', {},
      h('button.mini', { disabled: !r.online, onclick: () => { closeAllSheets(); send('goto'); } }, '🚀 Go to them'),
      h('button.mini', { disabled: !r.online, onclick: () => send('summon') }, '🧲 Pull to me'),
      h('button.mini.warn', { disabled: !r.online, onclick: () => { if (confirm(`Kick ${r.name} out? They can sign in again.`)) send('kick'); } }, '👢 Kick'),
      muted ? h('button.mini', { onclick: () => send('unmute') }, '🔊 Unmute') : null,
      ...(muted ? [] : [[10, '10 min'], [60, '1 hour'], [1440, '1 day']] as [number, string][]).map(([n, l]) => h('button.mini', { onclick: () => send('mute', { n }) }, `🔇 Mute ${l}`))),
    me ? null : h('h4', {}, '🏠 Their bedroom'),
    me ? null : h('div.row', {},
      r.home && ctx.visitRoom ? h('button.mini', { onclick: () => { closeAllSheets(); ctx.visitRoom!(r.home!); } }, '🚪 Go & decorate it') : null,
      h('button.mini', { onclick: () => { if (confirm(`Clear all decorations from ${r.name}'s room? (The furniture goes back to their inventory.)`)) send('clearroom'); } }, '🧹 Clear decorations'),
      h('button.mini', { onclick: () => send('resetstyle') }, '🎨 Reset walls & floor'),
      h('button.mini', { onclick: () => { if (confirm(`Give ${r.name} a brand-new bedroom on the next free Residence floor? Their decorations go back to their inventory.`)) send('newhome'); } }, '🏠 New bedroom')),
    me ? null : h('p.muted', {}, 'Tip: stand in anyone\'s bedroom and press 👑 Decorate to change it like your own. You can also go on every floor.'));
  sheet(`👑 ${r.name}`, body, { wide: true });
}
