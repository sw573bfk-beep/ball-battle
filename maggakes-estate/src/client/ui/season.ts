import { h, sheet, closeAllSheets, confetti, fill } from './dom';
import { portrait } from '../engine/portrait';
import { CAST, HOST, PERSONAS, islander, nextStep, FINAL_DAY, type Scene, type Season } from '../../shared/season';
import { choiceGame, simonGame, timingGame } from './minigames';

const QUIZ = [
  { q: 'Which islander is a lifeguard?', options: ['Kai', 'Mateo', 'Zara'], answer: 0 },
  { q: 'Where do islanders go to tell the cameras their secrets?', options: ['The Hideaway', 'The Beach Hut', 'The Gym'], answer: 1 },
  { q: 'What happens at the firepit?', options: ['Recouplings & dumpings', 'Cooking class', 'Yoga'], answer: 0 },
  { q: 'What do you call a surprise new islander?', options: ['A firework', 'A bombshell', 'A sparkler'], answer: 1 },
  { q: 'Who hosts the villa?', options: ['Jazz', 'Mia', 'Ruby'], answer: 0 },
];

function face(name: string): HTMLElement {
  const look = name === HOST.name ? HOST.look : islander(name)?.look;
  if (!look) return h('div.face.emoji', {}, name === '📱 Text' ? '📱' : name === 'Beach Hut' ? '🎥' : '💬');
  return h('img.face', { src: portrait(look, 'head', 192), alt: name });
}

export function castCard(name: string, s?: Season): HTMLElement {
  const isl = islander(name)!;
  const per = PERSONAS[isl.persona];
  const bond = s?.bonds[name];
  const partner = s?.partner === name;
  return h('div.isl' + (partner ? '.partner' : ''), {},
    face(name),
    h('div.isl-info', {},
      h('b', {}, `${name}, ${isl.age}`, partner ? h('span.pill', {}, '💘 Your partner') : null),
      h('small', {}, `${isl.job} · ${isl.from}`),
      h('small.persona', {}, `${per.emoji} ${per.label}`),
      bond !== undefined ? h('div.bond', { title: `Bond ${bond}/100` }, h('i', { style: { width: `${bond}%` } })) : h('small.muted', {}, isl.bio)));
}

/** Shows a season moment. `send` posts the player's choice back to the server. */
export function showScene(scene: Scene, send: (choice: string) => void, season?: Season): void {
  closeAllSheets();
  const lines = h('div.scene-lines');
  const body = h('div.scene' + (scene.mood ? `.${scene.mood}` : ''), {},
    h('div.scene-head', {}, face(scene.speaker ?? HOST.name), h('div', {}, h('small', {}, scene.speaker === HOST.name ? '🎤 Your host' : scene.speaker ?? ''), h('b', {}, scene.speaker ?? ''))),
    lines);
  let close: () => void = () => {};
  const actions = h('div.scene-choices');
  const finish = () => {
    if (scene.cards?.length) body.append(h('div.cards', {}, ...scene.cards.map((n) => castCard(n, season))));
    if (scene.bonds?.length) {
      body.append(h('div.bonds', {}, ...scene.bonds.filter((b) => b.delta !== 0).map((b) => h('span.bondchip' + (b.delta > 0 ? '.up' : '.down'), {}, `${b.delta > 0 ? '❤️' : '💔'} ${b.who} ${b.delta > 0 ? '+' : ''}${b.delta}`))));
    }
    if (scene.choices?.length) {
      fill(actions, ...scene.choices.map((c) => h('button.btn.choice', {
        onclick: () => {
          close();
          if (scene.kind === 'game') playGame(scene.game ?? 'timing', send);
          else send(c.id);
        },
      }, c.label)));
    } else {
      fill(actions, h('button.btn', { onclick: () => close() }, 'Continue ✨'));
    }
    body.append(actions);
    if (scene.mood === 'love' || scene.kind === 'final') confetti(scene.kind === 'final' ? 140 : 40);
  };
  // Type the lines out one by one, host style. Tap to skip.
  const all = scene.lines.filter((l) => l !== undefined);
  let i = 0;
  let timer = 0;
  const next = () => {
    if (i >= all.length) { finish(); return; }
    const l = all[i++];
    lines.append(l ? h('p', {}, l) : h('br'));
    lines.scrollTop = lines.scrollHeight;
    timer = window.setTimeout(next, Math.min(1100, 250 + l.length * 12));
  };
  body.onclick = (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (i < all.length) { clearTimeout(timer); while (i < all.length) { const l = all[i++]; lines.append(l ? h('p', {}, l) : h('br')); } finish(); }
  };
  close = sheet(scene.title, body, { className: 'scene-modal' });
  next();
}

function playGame(game: 'timing' | 'simon' | 'choice', send: (choice: string) => void): void {
  const done = (ok: boolean) => send(ok ? 'win' : 'lose');
  if (game === 'timing') timingGame('Beach Volleyball Showdown', 'Spike it in the sweet spot three times!', done);
  else if (game === 'simon') simonGame('Heart Rate Dance-off', 'Copy the dance moves!', done);
  else choiceGame('Villa Quiz', 'How well do you know the villa?', [...QUIZ].sort(() => Math.random() - 0.5).slice(0, 3), done);
}

/** The islanders panel: who's in, who's coupled, how strong your bonds are. */
export function openCast(season: Season | undefined, start: () => void): void {
  if (!season) {
    sheet('💘 Love Island', h('div.scene', {},
      h('div.scene-head', {}, face(HOST.name), h('div', {}, h('small', {}, '🎤 Your host'), h('b', {}, 'Jazz'))),
      h('p', {}, "You haven't started a season yet! Meet me at the firepit, or start right now."),
      h('div.cards', {}, ...CAST.slice(0, 4).map((c) => castCard(c.name))),
      h('div.scene-choices', {}, h('button.btn.big', { onclick: () => { closeAllSheets(); start(); } }, '🌴 Start my season'))));
    return;
  }
  const partner = season.partner;
  const couples = season.couples.map(([a, b]) => `${a} & ${b}`);
  sheet(`📺 Day ${Math.min(season.day, FINAL_DAY)} of ${FINAL_DAY}`, h('div.scene', {},
    h('div.season-stats', {},
      h('div', {}, h('small', {}, 'Status'), h('b', {}, partner ? `💘 Coupled with ${partner}` : '💔 Single')),
      h('div', {}, h('small', {}, 'Public popularity'), h('div.bond.pop', {}, h('i', { style: { width: `${season.popularity}%` } })), h('small', {}, `${season.popularity}/100`)),
      h('div', {}, h('small', {}, 'Next'), h('b', {}, nextStep(season)))),
    h('h4', {}, 'Islanders'),
    h('div.cards', {}, ...season.cast.map((n) => castCard(n, season))),
    couples.length ? h('p.muted', {}, `Other couples: ${couples.join(' · ')}`) : null,
    season.dumped.length ? h('p.muted', {}, `Dumped: ${season.dumped.join(', ')} 💔`) : null,
    season.phase === 'over' ? h('div.scene-choices', {}, h('button.btn.big', { onclick: () => { closeAllSheets(); start(); } }, '🌴 Start a new season')) : null,
  ), { wide: true });
}
