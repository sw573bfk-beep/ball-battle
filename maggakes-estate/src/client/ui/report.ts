import { h, sheet, fill, closeAllSheets } from './dom';
import type { Net } from '../net';
import type { Report } from '../../shared/protocol';

/** Recent errors caught on this device (sent along with reports). */
export const recentErrors: string[] = [];

export const TEAMS_NOTE = "You can also message Beau on Teams about errors and they'll be fixed.";

/** "Report a problem" form, open to every player. */
export function openReportDialog(net: Net, info: () => string): void {
  const text = h<HTMLTextAreaElement>('textarea.report-text', { placeholder: 'What happened? e.g. "I went to the firepit and it said I was doing something"', maxLength: 1000, rows: 5 });
  sheet('🐞 Report a problem', h('div.mg', {},
    h('p', {}, 'Tell us what went wrong. Your report goes straight to Beau and the VIPs.'),
    text,
    h('p.muted', {}, `💬 ${TEAMS_NOTE}`),
    h('div.actions', {}, h('button.btn.big', {
      onclick: () => {
        if (!text.value.trim()) { text.focus(); return; }
        net.send({ t: 'report', text: text.value.trim(), info: info() });
        closeAllSheets();
      },
    }, '📨 Send report'))));
  setTimeout(() => text.focus(), 60);
}

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

/** Problem reports list (VIPs + admins). */
export function openReports(net: Net, onReports: (fn: (rows: Report[]) => void) => () => void): void {
  const body = h('div.reports', {}, h('p.muted', {}, 'Loading…'));
  let showDone = false;
  let last: Report[] = [];
  const render = (rows: Report[]) => {
    last = rows;
    const open = rows.filter((r) => !r.done);
    const list = showDone ? rows : open;
    fill(body,
      h('p.muted', {}, `🐞 ${open.length} open report${open.length === 1 ? '' : 's'}. Players are told: “${TEAMS_NOTE}”`),
      h('div.row', {}, h('button.chip' + (!showDone ? '.on' : ''), { onclick: () => { showDone = false; render(last); } }, 'Open'), h('button.chip' + (showDone ? '.on' : ''), { onclick: () => { showDone = true; render(last); } }, 'All')),
      list.length ? null : h('p', {}, '🎉 Nothing to fix right now!'),
      ...list.map((r) => h('div.report' + (r.done ? '.done' : '') + (r.auto ? '.auto' : ''), {},
        h('div.report-head', {}, h('b', {}, r.from), r.auto ? h('span.tag.ban', {}, '⚠️ Automatic error') : h('span.tag', {}, '📝 Report'), h('small.muted', {}, ago(r.at))),
        h('p', {}, r.text),
        r.info ? h('details', {}, h('summary', {}, 'Details for fixing'), h('pre', {}, r.info)) : null,
        h('button.mini', { onclick: () => net.send({ t: 'reportDone', id: r.id, done: !r.done }) }, r.done ? '↩ Reopen' : '✅ Mark fixed'))),
    );
  };
  const off = onReports(render);
  net.send({ t: 'reports' });
  sheet('🐞 Problem reports', body, { wide: true, onClose: off });
}
