import { h, sheet, fill } from './dom';
import type { Ctx } from './panels';
import { ACHIEVEMENTS, EVENTS, LEVEL_BADGES, LEVEL_ITEMS, MAX_LEVEL, currentEvent, levelOf, levelReward, levelStart, weekEndsAt, weekIndex } from '../../shared/progress';
import { shopItem } from '../../shared/shop';
import { questLog } from './quests';
import { COLLECTION, COLLECTION_MILESTONES, PET_MAX, PET_TRICKS, STREAK_MILESTONES, UPGRADES, UPGRADE_BONUS, collected, collectionPct, petLevel, petLevelStart, streakReward, upgradeBonus } from '../../shared/progress2';
import type { Save } from '../../shared/save';
import type { Achievement } from '../../shared/progress';

/** Ready to claim first, then in progress (closest first), then claimed. */
function achRank(s: Save, a: Achievement): number {
  if (s.ach?.[a.id]) return 3;
  const [c, g] = a.progress(s);
  return c >= g ? 0 : 1 + (1 - c / g);
}

const fmt = (n: number) => n.toLocaleString('en-AU');

/** ⭐ Progress: your level, achievements and this week's event. */
type PTab = 'level' | 'ach' | 'event' | 'quests' | 'collect' | 'streak' | 'estate' | 'pet';
export function openProgress(ctx: Ctx, start: PTab = 'level'): void {
  let tab: PTab = start;
  const body = h('div.progress');
  const render = () => {
    const s = ctx.save();
    const xp = s.xp ?? s.totalAura;
    const L = levelOf(xp);
    const streakReady = s.streak && s.streak.claimed !== s.streak.last;
    const tabs = h('div.wtabs', {}, ...([['level', `⭐ Level ${L}`], ['streak', `🔥 Streak${streakReady ? ' 🎁' : ''}`], ['quests', '📜 Quests'], ['ach', '🏆 Achievements'], ['event', `${currentEvent().emoji} This week`], ['collect', '📖 Collection'], ['pet', '🐾 Pet'], ['estate', '🏰 Estate']] as [PTab, string][]).map(([k, l]) =>
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
    } else if (tab === 'collect') {
      const pct = collectionPct(s), have = collected(s);
      const cats: [string, string][] = [['outfit', '👗 Outfits'], ['accessory', '🕶️ Accessories'], ['furniture', '🛋️ Furniture'], ['car', '🚗 Cars']];
      content = h('div', {},
        h('div.lvhead', {}, h('div.lvnum', {}, `${pct}%`), h('div', {}, h('b', {}, `${have} / ${COLLECTION.length} items collected`), h('div.bar', {}, h('i', { style: { width: `${pct}%` } })), h('small.muted', {}, 'Buy, win and earn every item in the game!'))),
        h('div.lvlist', {}, ...COLLECTION_MILESTONES.map((m) => {
          const claimed = s.collect?.includes(m.pct), ready = !claimed && pct >= m.pct;
          return h('div.lvrow.' + (claimed ? 'done' : ready ? 'ready' : 'locked'), {}, h('b', {}, `${m.pct}%`), h('span', {}, `💎 ${fmt(m.aura)}`), h('span.pill', {}, `${m.badge} badge`),
            ready ? h('button.btn', { onclick: () => ctx.net.send({ t: 'claimCollection', pct: m.pct }) }, 'Claim') : h('span.st', {}, claimed ? '✅' : '🔒'));
        })),
        ...cats.map(([cat, label]) => {
          const items = COLLECTION.filter((i) => i.cat === cat);
          return h('div', {}, h('h4', {}, `${label} · ${items.filter((i) => (s.inventory[i.id] ?? 0) > 0).length}/${items.length}`),
            h('div.colgrid', {}, ...items.map((i) => h('span.col' + ((s.inventory[i.id] ?? 0) > 0 ? '.have' : ''), { title: i.name }, (s.inventory[i.id] ?? 0) > 0 ? i.emoji : '❔'))));
        }));
    } else if (tab === 'streak') {
      const st = s.streak ?? { last: '', days: 0, best: 0, claimed: '' };
      const ready = st.claimed !== st.last;
      const next = Object.keys(STREAK_MILESTONES).map(Number).find((d) => d > st.days);
      content = h('div', {},
        h('div.lvhead', {}, h('div.lvnum', {}, `🔥${st.days}`), h('div', {}, h('b', {}, `${st.days}-day streak`), h('small.muted', {}, `Best: ${st.best} days. Play every day to keep it going — miss a day and it starts again!`))),
        h('div.actions', {}, ready ? h('button.btn.big', { onclick: () => ctx.net.send({ t: 'claimStreak' }) }, `🎁 Claim day ${st.days}: +${fmt(streakReward(st.days))} Aura`) : h('p.muted', {}, '✅ Claimed today — come back tomorrow!')),
        next ? h('p', {}, `Next milestone: day ${next} (+${fmt(STREAK_MILESTONES[next].aura)} bonus${STREAK_MILESTONES[next].badge ? ` and the ${STREAK_MILESTONES[next].badge} badge` : ''})`) : null,
        h('div.lvlist', {}, ...Object.entries(STREAK_MILESTONES).map(([d, m]) => h('div.lvrow.' + (st.best >= Number(d) ? 'done' : 'locked'), {}, h('b', {}, `Day ${d}`), h('span', {}, `💎 +${fmt(m.aura)}`), m.badge ? h('span.pill', {}, `${m.badge} badge`) : null, h('span.st', {}, st.best >= Number(d) ? '✅' : '🔒')))));
    } else if (tab === 'pet') {
      const pet = s.pet;
      if (!pet) content = h('p', {}, '🐾 You don\'t have a pet yet! Adopt one at the 2nd floor Pet Room.');
      else {
        const xp = pet.xp ?? 0, lv = petLevel(xp), a = petLevelStart(lv), b2 = petLevelStart(lv + 1);
        const pp = lv >= PET_MAX ? 100 : Math.round(((xp - a) / (b2 - a)) * 100);
        content = h('div', {},
          h('div.lvhead', {}, h('div.lvnum', {}, String(lv)), h('div', {}, h('b', {}, `${pet.name} · level ${lv}${lv >= PET_MAX ? ' (MAX!)' : ''}`), h('div.bar', {}, h('i', { style: { width: `${pp}%` } })), h('small.muted', {}, 'Your pet earns XP when you do tasks, pat pets, play soccer, race, slide, spin and more.'))),
          h('h4', {}, '🎪 Tricks'),
          h('div.row', {}, ...PET_TRICKS.map((tr) => lv >= tr.level
            ? h('button.chip', { onclick: () => ctx.net.send({ t: 'petTrick', trick: tr.id }) }, `${tr.emoji} ${tr.label}`)
            : h('span.chip.locked', {}, `🔒 ${tr.label} (Lv ${tr.level})`))));
      }
    } else if (tab === 'estate') {
      const owned = s.upgrades ?? [];
      content = h('div', {},
        h('p', {}, `🏰 Build your dream estate! Each upgrade gives you a new title and +${Math.round(UPGRADE_BONUS * 100)}% Aura from playing, forever. You have +${Math.round(upgradeBonus(s) * 100)}%.`),
        h('div.lvlist', {}, ...UPGRADES.map((u, i) => {
          const have = owned.includes(u.id), canBuy = !have && (i === 0 || owned.includes(UPGRADES[i - 1].id));
          return h('div.lvrow.' + (have ? 'done' : canBuy ? 'ready' : 'locked'), {},
            h('b', {}, `${u.emoji} ${u.name}`), h('small.muted', {}, `"${u.title}" · ${u.blurb}`),
            have ? h('span.st', {}, '✅') : canBuy ? h('button.btn' + (s.aura < u.price ? '.ghost' : ''), { onclick: () => ctx.net.send({ t: 'buyUpgrade', id: u.id }) }, `💎 ${fmt(u.price)}`) : h('span.st', {}, `🔒 ${fmt(u.price)}`));
        })));
    } else if (tab === 'quests') {
      content = questLog(ctx);
    } else if (tab === 'ach') {
      const done = ACHIEVEMENTS.filter((a) => s.ach?.[a.id]).length;
      content = h('div', {},
        h('p.muted', {}, `${done} / ${ACHIEVEMENTS.length} claimed`),
        h('div.achgrid', {}, ...[...ACHIEVEMENTS].sort((x, y) => achRank(s, x) - achRank(s, y)).map((a) => {
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
