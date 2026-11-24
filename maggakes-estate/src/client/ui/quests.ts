import { h, sheet, fill, closeAllSheets } from './dom';
import type { Ctx } from './panels';
import { NPCS, QUESTS, npcById, npcQuest, questStatus, stepProgress, type Npc } from '../../shared/quests';
import { zoneName, zoneNeed } from '../../shared/floors';
import { shopItem } from '../../shared/shop';

const fmt = (n: number) => n.toLocaleString('en-AU');

/** Talking to a quest character: offer, progress or hand-in. */
export function openNpc(ctx: Ctx, npc: Npc): void {
  const body = h('div.quest');
  const render = () => {
    const s = ctx.save();
    const q = npcQuest(s, npc.id, zoneNeed);
    const head = h('div.qhead', {}, h('div.qe', {}, npc.emoji), h('div', {}, h('b', {}, npc.name), h('small.muted', {}, npc.role)));
    if (!q) {
      const left = QUESTS.filter((x) => x.npc === npc.id && questStatus(s, x, zoneNeed) === 'locked');
      fill(body, head, h('p', {}, left.length ? `"Come back later — I'll have something for you soon!"` : `"You've done everything I asked. Thank you, legend! 💖"`),
        left[0]?.needs && s.totalAura < zoneNeed(left[0].needs) ? h('p.muted', {}, `Next quest needs ${zoneName(left[0].needs)} unlocked.`) : null);
      return;
    }
    const st = s.quests?.[q.id];
    const status = questStatus(s, q, zoneNeed);
    const reward = h('p.qreward', {}, `🎁 Reward: ${fmt(q.reward.aura)} Aura${q.reward.item ? ` + ${shopItem(q.reward.item)?.emoji ?? ''} ${shopItem(q.reward.item)?.name ?? 'a gift'}` : ''}`);
    const steps = h('ol.qsteps', {}, ...q.steps.map((step, i) => {
      const [d, n] = st && i === st.step ? stepProgress(s, q, st, i) : [st && i < st.step ? step.n : 0, step.n];
      const done = !!st && i < st.step;
      return h('li' + (done ? '.done' : st && i === st.step ? '.now' : ''), {}, `${done ? '✅' : st && i === st.step ? '👉' : '⬜'} ${step.label}`, st && i === st.step && n > 1 ? h('small.muted', {}, ` (${fmt(d)}/${fmt(n)})`) : null);
    }));
    fill(body, head,
      h('h4', {}, `📜 ${q.title}`),
      ...(status === 'ready' ? [h('p', {}, `"${q.outro}"`)] : q.intro.map((l) => h('p', {}, `"${l}"`))),
      steps, reward,
      h('div.actions', {},
        status === 'available' ? h('button.btn.big', { onclick: () => ctx.net.send({ t: 'quest', a: 'accept', id: q.id }) }, '📜 Accept quest') : null,
        status === 'ready' ? h('button.btn.big', { onclick: () => ctx.net.send({ t: 'quest', a: 'claim', id: q.id }) }, '🎁 Claim reward') : null,
        status === 'active' ? h('button.btn.ghost', { onclick: () => closeAllSheets() }, "On it! 👍") : null));
  };
  const off = ctx.onSave(render);
  render();
  sheet(`${npc.emoji} ${npc.name}`, body, { onClose: off });
}

/** Quest log (used inside ⭐ Progress). */
export function questLog(ctx: Ctx): HTMLElement {
  const s = ctx.save();
  const done = QUESTS.filter((q) => questStatus(s, q, zoneNeed) === 'done').length;
  const chapters = [...new Set(QUESTS.map((q) => q.chapter))];
  return h('div', {},
    h('p.muted', {}, `${done} / ${QUESTS.length} quests done. Talk to the characters around the estate to get quests — look for ❗ above their heads.`),
    ...chapters.map((ch) => {
      const qs = QUESTS.filter((q) => q.chapter === ch);
      const npc = npcById(qs[0].npc)!;
      return h('div.qchap', {},
        h('b', {}, `${npc.emoji} ${npc.name} · ${zoneName(npc.zone)}`),
        ...qs.map((q) => {
          const st = questStatus(s, q, zoneNeed);
          const icon = { locked: '🔒', available: '❗', active: '👉', ready: '🎁', done: '✅' }[st];
          const cur = s.quests?.[q.id];
          const now = st === 'active' && cur ? q.steps[cur.step] : null;
          const prog = now && cur ? stepProgress(s, q, cur, cur.step) : null;
          return h('div.qrow.' + st, {}, h('span', {}, `${icon} ${q.title}`), now && prog ? h('small.muted', {}, ` — ${now.label}${prog[1] > 1 ? ` (${prog[0]}/${prog[1]})` : ''}`) : st === 'ready' ? h('small', {}, ` — go see ${npc.name}!`) : null);
        }));
    }));
}

export { NPCS };
