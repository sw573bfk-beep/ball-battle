import { h, sheet, fill } from './dom';
import type { Ctx } from './panels';
import { ACHIEVEMENTS, EVENTS, LEVEL_BADGES, LEVEL_ITEMS, MAX_LEVEL, currentEvent, levelOf, levelReward, levelStart, weekEndsAt, weekIndex } from '../../shared/progress';
import { shopItem } from '../../shared/shop';

const fmt = (n: number) => n.toLocaleString('en-AU');

/** ⭐ Progress: your level, achievements and this week's event. */
export function openProgress(ctx: Ctx, start: 'level' | 'ach' | 'event' = 'level'): void {
  let tab = start;
  const body = h('div.progress');
  const render = () => {
    const s = ctx.save();
    const xp = s.xp ?? s.totalAura;
    const L = levelOf(xp);
    const tabs = h('div.wtabs', {}, ...([['level', `⭐ Level ${L}`], ['ach', '🏆 Achievements'], ['event', `${currentEvent().emoji} This week`]] as const).map(([k, l]) =>
      h('button.tab' + (tab === k ? '.on' : ''), { onclick: () => { tab = k; render(); } }, l)));
    let content: HTMLElement;
    if (tab === 'level') {
      const a = levelStart(L), b = levelStart(L + 1);
      const pct = L >= MAX_LEVEL ? 100 : Math.round(((xp - a) / (b - a)) * 100);
      const claimed = s.levelClaimed ?? 1;
      const pending = L - claimed;
      const rows: HTMLElement[] = [];
      for (let l = Math.max(2, L - 2); l <= Math.min(MAX_LEVEL, L + 12); l++) {
        const r = levelReward(l);
        const item = r.item ? shopItem(r.item) : undefined;
        const state = l <= claimed ? 'done' : l <= L ? 'ready' : 'locked';
        rows.push(h('div.lvrow.' + state, {},
          h('b', {}, `Lv ${l}`),
          h('span', {}, `💎 ${fmt(r.aura)}`),
          r.badge ? h('span.pill', {}, `${r.badge} badge`) : null,
          item ? h('span.pill', {}, `${item.emoji} ${item.name}`) : null,
          h('span.st', {}, state === 'done' ? '✅' : state === 'ready' ? '🎁' : '🔒')));
      }
      content = h('div', {},
        h('div.lvhead', {}, h('div.lvnum', {}, String(L)), h('div', {},
          h('b', {}, L >= MAX_LEVEL ? 'MAX LEVEL! 🏆' : `Level ${L} → ${L + 1}`),
          h('div.bar', {}, h('i', { style: { width: `${pct}%` } })),
          h('small.muted', {}, L >= MAX_LEVEL ? `${fmt(xp)} XP` : `${fmt(xp - a)} / ${fmt(b - a)} XP · every Aura you earn is XP`))),
        pending > 0 ? h('div.actions', {}, h('button.btn.big', { onclick: () => ctx.net.send({ t: 'claimLevel' }) }, `🎁 Claim ${pending} level reward${pending > 1 ? 's' : ''}`)) : null,
        h('div.lvlist', {}, ...rows),
        h('p.muted', {}, `Badges at levels ${Object.entries(LEVEL_BADGES).map(([l, b]) => `${l} ${b}`).join(' · ')}. Free items at levels ${Object.keys(LEVEL_ITEMS).join(', ')}. Use badges in 👗 Style → Profile.`));
    } else if (tab === 'ach') {
      const done = ACHIEVEMENTS.filter((a) => s.ach?.[a.id]).length;
      content = h('div', {},
        h('p.muted', {}, `${done} / ${ACHIEVEMENTS.length} claimed`),
        h('div.achgrid', {}, ...ACHIEVEMENTS.map((a) => {
          const [cur, goal] = a.progress(s);
          const claimed = !!s.ach?.[a.id];
          const ready = !claimed && cur >= goal;
          return h('div.ach' + (claimed ? '.done' : ready ? '.ready' : ''), {},
            h('div.ae', {}, a.emoji),
            h('div', {}, h('b', {}, a.label), h('small', {}, a.desc),
              claimed ? h('small.muted', {}, '✅ Claimed') : ready ? h('button.btn', { onclick: () => ctx.net.send({ t: 'claimAch', id: a.id }) }, `Claim +${fmt(a.reward)}`)
                : h('div.bar.sm', {}, h('i', { style: { width: `${Math.round((cur / goal) * 100)}%` } })),
              !claimed && !ready ? h('small.muted', {}, `${fmt(cur)} / ${fmt(goal)} · +${fmt(a.reward)} Aura`) : null));
        })));
    } else {
      const ev = currentEvent();
      const week = s.week?.id === String(weekIndex()) ? s.week : { stats: {} as Record<string, number>, claimed: [] as number[] };
      const left = Math.max(0, weekEndsAt() - Date.now());
      const days = Math.floor(left / 86400_000), hours = Math.floor((left % 86400_000) / 3600_000);
      const next = EVENTS[(weekIndex() + 1) % EVENTS.length];
      content = h('div', {},
        h('div.evhead', { style: { background: ev.color } }, h('div.ae', {}, ev.emoji), h('div', {}, h('b', {}, ev.name), h('small', {}, ev.blurb), h('small', {}, `⏳ Ends in ${days}d ${hours}h`))),
        ...ev.goals.map((g, i) => {
          const cur = Math.min(g.goal, week.stats[g.stat] ?? 0);
          const claimed = week.claimed.includes(i);
          const ready = !claimed && cur >= g.goal;
          return h('div.ach' + (claimed ? '.done' : ready ? '.ready' : ''), {},
            h('div.ae', {}, claimed ? '✅' : ready ? '🎁' : '🎯'),
            h('div', {}, h('b', {}, g.label),
              claimed ? h('small.muted', {}, 'Claimed') : ready ? h('button.btn', { onclick: () => ctx.net.send({ t: 'claimEvent', i }) }, `Claim +${fmt(g.reward)}`)
                : h('div.bar.sm', {}, h('i', { style: { width: `${Math.round((cur / g.goal) * 100)}%` } })),
              !claimed && !ready ? h('small.muted', {}, `${fmt(cur)} / ${fmt(g.goal)} · +${fmt(g.reward)} Aura`) : null));
        }),
        h('h4', {}, '🛍️ This week only in the shop'),
        h('div.row', {}, ...ev.items.map((id) => { const it = shopItem(id); return it ? h('span.pill', {}, `${it.emoji} ${it.name} · ${fmt(it.price)}`) : null; })),
        h('p.muted', {}, `Next week: ${next.emoji} ${next.name}`));
    }
    fill(body, tabs, content);
  };
  const off = ctx.onSave(render);
  render();
  sheet('⭐ Progress', body, { onClose: off });
}
