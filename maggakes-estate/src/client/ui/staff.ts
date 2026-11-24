import { h, sheet, fill } from './dom';
import type { Net } from '../net';
import type { StaffMsg } from '../../shared/protocol';

/** The Staff Chat window (admins + VIPs). Live messages are pushed in with `add`. */
export class StaffChat {
  rows: StaffMsg[] = [];
  unread = 0;
  private list: HTMLElement | null = null;
  private close: (() => void) | null = null;

  constructor(private net: Net, private me: () => string, private onUnread: () => void) {}

  get isOpen(): boolean { return !!this.list; }

  open(): void {
    if (this.list) return;
    this.unread = 0;
    this.onUnread();
    const list = h('div.staff-list');
    const input = h<HTMLInputElement>('input.staff-in', { placeholder: 'Message the staff…', maxLength: 300 });
    const send = () => { const text = input.value.trim(); if (!text) return; this.net.send({ t: 'staff', text }); input.value = ''; input.focus(); };
    input.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') send(); };
    const body = h('div.staff', {},
      h('p.muted', {}, '🔒 Only admins and VIPs can see this chat. People are added when they become an admin or VIP, and removed when they stop being one.'),
      list,
      h('div.staff-send', {}, input, h('button.btn', { onclick: send }, 'Send')));
    this.list = list;
    this.render();
    this.close = sheet('💬 Staff Chat', body, { onClose: () => { this.list = null; this.close = null; } });
    this.net.send({ t: 'staff?' });
    setTimeout(() => input.focus(), 50);
  }

  /** Kicked out: close the window and forget the messages. */
  shut(): void {
    this.close?.();
    this.list = null;
    this.close = null;
    this.rows = [];
    this.unread = 0;
    this.onUnread();
  }

  history(rows: StaffMsg[]): void { this.rows = rows; this.render(); }

  add(msg: StaffMsg): void {
    this.rows.push(msg);
    if (this.rows.length > 100) this.rows.shift();
    if (this.list) this.render();
    else if (msg.from !== this.me()) { this.unread++; this.onUnread(); }
  }

  private render(): void {
    if (!this.list) return;
    const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    fill(this.list, ...(this.rows.length ? this.rows.map((m) => m.sys
      ? h('div.staff-sys', {}, m.text)
      : h('div.staff-msg' + (m.from === this.me() ? '.me' : ''), {}, h('b', {}, `${m.admin ? '🛡️' : '⭐'} ${m.from}`), h('span', {}, m.text), h('small.muted', {}, time(m.at))))
      : [h('p.muted', {}, 'No messages yet — say hi! 👋')]));
    this.list.scrollTop = this.list.scrollHeight;
  }
}
