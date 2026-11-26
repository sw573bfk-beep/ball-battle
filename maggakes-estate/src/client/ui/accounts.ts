import { h, sheet, fill } from './dom';
import type { Net } from '../net';
import type { AccountRow, AdminAction } from '../../shared/protocol';
import { zoneName } from '../../shared/floors';
import { OWNER, PAUSE_TEXT } from '../../shared/protocol';

interface AccountsCtx {
  net: Net;
  openReports: () => void;
  reports: () => number;
  admin: () => boolean;
  me: string;
  onAccounts: (fn: (rows: AccountRow[], paused: boolean, pauseText: string) => void) => () => void;
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
  const pauseBox = (paused: boolean, pauseText: string) => {
    const msg = h('textarea.pausemsg', { maxLength: 400, rows: 4, placeholder: 'Type the message everyone will see…', oninput: () => { draft = msg.value; } }) as HTMLTextAreaElement;
    msg.value = draft ?? (pauseText || PAUSE_TEXT);
    const send = (on: boolean) => { draft = null; ctx.net.send({ t: 'pause', on, text: msg.value }); };
    return h('div.pausebox' + (paused ? '.on' : ''), {},
      h('b', {}, paused ? '⏸️ The game is PAUSED. Only you can play.' : '▶️ The game is running.'),
      h('small.muted', {}, paused ? 'Everyone else sees this message (except people you 🔓 unlock below). Change it and press Update.' : 'Write a message, then pause. Everyone else (except people you 🔓 unlock below) is sent to a screen showing it. Their progress is kept.'),
      msg,
      h('div.row', {},
        paused
          ? h('button.btn.ghost', { onclick: () => send(true) }, '✏️ Update message')
          : h('button.btn.ghost', { onclick: () => { if (confirm('Pause the game for everyone except you?')) send(true); } }, '⏸️ Pause the game'),
        paused ? h('button.btn', { onclick: () => send(false) }, '▶️ Unpause the game') : null,
        h('button.mini', { onclick: () => { msg.value = PAUSE_TEXT; draft = PAUSE_TEXT; } }, 'Use the $15 message')));
  };
  const render = (rows: AccountRow[], paused: boolean, pauseText: string) => {
    const admin = ctx.admin();
    const pending = rows.filter((r) => r.status === 'pending');
    const others = rows.filter((r) => r.status !== 'pending');
    fill(body,
      h('div.actions', { style: { justifyContent: 'flex-start', marginTop: '0' } }, h('button.btn' + (ctx.reports() ? '' : '.ghost'), { onclick: () => ctx.openReports() }, `🐞 Problem reports${ctx.reports() ? ` (${ctx.reports()} open)` : ''}`)),
      ctx.me === OWNER ? pauseBox(paused, pauseText) : null,
      h('p.muted', {}, admin ? '🛡️ You are an admin. Passwords are scrambled — nobody can see them, but you can reset them.' : '⭐ VIPs can see every account. Only admins can change them.'),
      pending.length ? h('section.pending', {},
        h('h4', {}, `🆕 Waiting for approval (${pending.length})`),
        ...pending.map((r) => h('div.acct.pend', {},
          h('div', {}, h('b', {}, r.name), h('small.muted', {}, ` signed up ${when(r.created)}`)),
          admin ? h('div.acct-actions', {},
            h('button.btn', { onclick: () => act('approve', r.name) }, '✅ Approve'),
            h('button.btn.ghost', { onclick: () => act('reject', r.name, `Reject ${r.name}'s sign-up? Their account will be deleted.`) }, '✖ Reject')) : h('small.muted', {}, 'An admin needs to approve them')))) : null,
      h('section', {}, h('h4', {}, `👥 All accounts (${others.length})`),
        h('div.acct-list', {}, ...others.map((r) => h('div.acct' + (r.status === 'banned' ? '.banned' : ''), {},
          h('div.acct-main', {},
            h('b', {}, h('span.dot' + (r.online ? '.on' : '')), r.name,
              r.admin ? h('span.tag.adm', {}, '🛡️ Admin') : null, r.vip ? h('span.tag.vipt', {}, '⭐ VIP') : null,
              r.founder ? h('span.tag', {}, '🏠 Original') : null, r.pauseOk ? h('span.tag.unlock', {}, '🔓 Plays while paused') : null, r.status === 'banned' ? h('span.tag.ban', {}, '⛔ Banned') : null),
            h('small.muted', {}, `${r.totalAura.toLocaleString('en-AU')} Aura · ${r.home ? zoneName(r.home.zone) : 'no bedroom'} · joined ${when(r.created)} · seen ${r.online ? 'online now' : ago(r.lastSeen)}${r.hasPassword ? '' : ' · no password yet'}`)),
          admin && r.name !== ctx.me ? h('div.acct-actions', {},
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
