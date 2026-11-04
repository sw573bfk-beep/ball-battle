import { api } from './api.js';
import { $, $$, esc, toast, copyText, confirmBox } from './ui.js';
import { parseQuestions, buildAiPrompt, questionProblems, normalizeQuestion, DEFAULT_TIME, MAX_ANSWERS } from './parse.js';
import { ANSWER_COLORS, ANSWER_SHAPES } from './rules.js';

const TIMES = [5, 10, 15, 20, 30, 45, 60, 90, 120];

export async function editorView(app, id) {
  let set = { title: '', description: '', isPublic: false, questions: [] };
  if (id) {
    app.innerHTML = '<div class="loading">Loading…</div>';
    try {
      const r = await api(`/api/sets/${id}`);
      if (!r.set.mine) { toast("You can only edit your own sets", 'bad'); location.hash = `#/set/${id}`; return; }
      set = r.set;
    } catch (e) { toast(e.message, 'bad'); location.hash = '#/sets'; return; }
  }
  let dirty = false;
  const qs = set.questions.map((q) => ({ ...q }));

  app.innerHTML = `
  <div class="editor">
    <section class="card">
      <div class="row wrap">
        <input id="title" class="title-input" maxlength="100" placeholder="Set title, e.g. Year 7 Science: Cells" value="${esc(set.title)}" />
        <label class="check"><input type="checkbox" id="public" ${set.isPublic ? 'checked' : ''}/> 🌍 Public (others can find &amp; host it)</label>
      </div>
      <input id="desc" maxlength="500" placeholder="Description (optional)" value="${esc(set.description)}" />
    </section>

    <section class="card import">
      <div class="tabs" role="tablist">
        <button class="tab active" data-tab="paste">✨ Paste from your AI</button>
        <button class="tab" data-tab="gen">🤖 Built-in AI</button>
        <button class="tab" data-tab="cards">🃏 Flashcards / word list</button>
      </div>

      <div class="tab-body" data-body="paste">
        <div class="steps">
          <div class="step">
            <div class="step-num">1</div>
            <div class="grow stack">
              <b>Tell us what the quiz is about, then copy the prompt</b>
              <div class="row wrap">
                <input id="p-topic" class="grow" placeholder="Topic, e.g. the water cycle, WW2, Spanish food words" />
                <select id="p-count">${[5, 10, 15, 20, 30].map((n) => `<option ${n === 10 ? 'selected' : ''}>${n}</option>`).join('')}</select>
                <select id="p-diff"><option>easy</option><option selected>medium</option><option>hard</option></select>
              </div>
              <details><summary>Or make questions from your own notes</summary><textarea id="p-notes" rows="4" placeholder="Paste notes, a textbook page, or an article. The AI will only use this."></textarea></details>
              <div class="row wrap">
                <button class="btn" id="copy-prompt">📋 Copy AI prompt</button>
                <a class="btn ghost small" href="https://chatgpt.com/" target="_blank" rel="noopener">Open ChatGPT ↗</a>
                <a class="btn ghost small" href="https://claude.ai/new" target="_blank" rel="noopener">Open Claude ↗</a>
                <a class="btn ghost small" href="https://gemini.google.com/app" target="_blank" rel="noopener">Open Gemini ↗</a>
              </div>
            </div>
          </div>
          <div class="step">
            <div class="step-num">2</div>
            <div class="grow stack">
              <b>Paste the AI's answer here</b>
              <textarea id="paste" rows="8" placeholder="1. What is the capital of France?&#10;A) London&#10;B) Paris&#10;C) Rome&#10;D) Berlin&#10;Answer: B&#10;&#10;Most formats work: numbered lists, JSON, CSV, Q:/A:, answer keys at the bottom, ✓ or * marks…"></textarea>
              <div class="row between wrap"><span id="paste-status" class="muted">Paste text to see a preview</span><button class="btn yellow" id="add-paste" disabled>Add questions</button></div>
            </div>
          </div>
        </div>
      </div>

      <div class="tab-body hidden" data-body="gen">
        <p class="muted">Our server's AI writes the questions for you, free (up to 25 times a day). Always double-check facts!</p>
        <div class="stack">
          <div class="row wrap">
            <input id="g-topic" class="grow" placeholder="Topic, e.g. photosynthesis for year 8" />
            <select id="g-count">${[5, 10, 15, 20].map((n) => `<option ${n === 10 ? 'selected' : ''}>${n}</option>`).join('')}</select>
            <select id="g-diff"><option>easy</option><option selected>medium</option><option>hard</option></select>
          </div>
          <details><summary>Or use your own notes</summary><textarea id="g-notes" rows="4" placeholder="Paste notes here"></textarea></details>
          <div><button class="btn yellow" id="gen">🤖 Generate questions</button></div>
        </div>
      </div>

      <div class="tab-body hidden" data-body="cards">
        <p class="muted">One per line: <code>term - definition</code> (tabs, colons, = and | work too). We make the wrong answers from your other cards. Great for Quizlet exports and vocab lists.</p>
        <textarea id="cards" rows="7" placeholder="Perro - Dog&#10;Gato - Cat&#10;Pájaro - Bird&#10;Pez - Fish"></textarea>
        <div class="row between wrap">
          <label>Ask with <select id="c-dir"><option value="term">term → pick the definition</option><option value="definition">definition → pick the term</option></select></label>
          <button class="btn yellow" id="add-cards">Add flashcards</button>
        </div>
      </div>
    </section>

    <div class="row between q-head">
      <h2 class="section-title" id="q-count">Questions</h2>
      <div class="row"><button class="btn ghost small" id="clear">Clear all</button><button class="btn small" id="add-q">＋ Add question</button></div>
    </div>
    <div id="qlist" class="qlist"></div>
    <div class="savebar"><span id="save-status" class="muted"></span><button class="btn big" id="save">💾 Save set</button></div>
  </div>`;

  const markDirty = () => { dirty = true; $('#save-status').textContent = 'Unsaved changes'; };
  ['#title', '#desc'].forEach((s) => $(s).addEventListener('input', markDirty));
  $('#public').addEventListener('change', markDirty);

  // ---- tabs
  $$('.tab', app).forEach((t) => t.addEventListener('click', () => {
    $$('.tab', app).forEach((x) => x.classList.toggle('active', x === t));
    $$('.tab-body', app).forEach((b) => b.classList.toggle('hidden', b.dataset.body !== t.dataset.tab));
  }));

  // ---- paste flow
  $('#p-topic').value = set.title || '';
  $('#copy-prompt').addEventListener('click', async () => {
    const prompt = buildAiPrompt({ topic: $('#p-topic').value || $('#title').value, notes: $('#p-notes').value, count: $('#p-count').value, difficulty: $('#p-diff').value });
    const ok = await copyText(prompt);
    toast(ok ? 'Prompt copied! Paste it into your AI, then paste the answer back in step 2.' : "Couldn't copy, please select the text manually", ok ? 'good' : 'bad');
    if (!ok) $('#paste').value = prompt;
  });
  let preview = null;
  const updatePreview = () => {
    const text = $('#paste').value;
    preview = text.trim() ? parseQuestions(text) : null;
    const status = $('#paste-status');
    const btn = $('#add-paste');
    if (!preview) { status.textContent = 'Paste text to see a preview'; btn.disabled = true; return; }
    const good = preview.questions.filter((q) => !questionProblems(q).length).length;
    const bad = preview.questions.length - good;
    status.innerHTML = preview.questions.length
      ? `Found <b>${preview.questions.length}</b> question${preview.questions.length === 1 ? '' : 's'}${bad ? ` · <span class="warn">${bad} need fixing after adding</span>` : ' ✓'}`
      : `<span class="warn">${esc(preview.warnings[0] || 'No questions found')}</span>`;
    btn.disabled = !preview.questions.length;
    btn.textContent = preview.questions.length ? `Add ${preview.questions.length} questions` : 'Add questions';
  };
  $('#paste').addEventListener('input', updatePreview);
  $('#add-paste').addEventListener('click', () => {
    if (!preview?.questions.length) return;
    addQuestions(preview.questions, preview.warnings);
    $('#paste').value = '';
    updatePreview();
  });

  // ---- built-in AI
  $('#g-topic').value = set.title || '';
  $('#gen').addEventListener('click', async (e) => {
    const topic = $('#g-topic').value.trim() || $('#title').value.trim();
    const notes = $('#g-notes').value.trim();
    if (!topic && !notes) return toast('Type a topic first', 'bad');
    e.target.disabled = true;
    e.target.textContent = '🤖 Thinking… (10–30s)';
    try {
      const r = await api('/api/generate', { method: 'POST', body: { topic, notes, count: Number($('#g-count').value), difficulty: $('#g-diff').value } });
      addQuestions(r.questions, []);
      toast(`Added ${r.questions.length} AI questions · ${r.remaining} generations left today`, 'good');
    } catch (err) { toast(err.message, 'bad'); }
    e.target.disabled = false;
    e.target.textContent = '🤖 Generate questions';
  });

  // ---- flashcards
  $('#add-cards').addEventListener('click', () => {
    const r = parseQuestions($('#cards').value, { mode: 'flashcards', direction: $('#c-dir').value });
    if (!r.questions.length) return toast(r.warnings[0] || 'No cards found', 'bad');
    addQuestions(r.questions, r.warnings);
    $('#cards').value = '';
  });

  function addQuestions(list, warnings) {
    if (!$('#title').value.trim() && $('#p-topic').value.trim()) $('#title').value = $('#p-topic').value.trim().replace(/^./, (c) => c.toUpperCase());
    const start = qs.length;
    qs.push(...list.map((q) => ({ ...q })));
    markDirty();
    renderList();
    const needFix = list.filter((q) => questionProblems(q).length).length;
    toast(`Added ${list.length} question${list.length === 1 ? '' : 's'}${needFix ? ` · ${needFix} need a correct answer picked (marked red)` : ''}`, needFix ? 'info' : 'good');
    void warnings;
    document.querySelectorAll('.qcard')[start]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ---- question list
  const list = $('#qlist');
  function renderList() {
    $('#q-count').textContent = `Questions (${qs.length})`;
    if (!qs.length) {
      list.innerHTML = '<div class="empty"><p>No questions yet. Use the import box above, or add one by hand.</p></div>';
      return;
    }
    list.innerHTML = qs.map((q, i) => qCard(q, i)).join('');
  }
  function qCard(q, i) {
    const problems = questionProblems(normalizeQuestion(q));
    return `<div class="qcard ${problems.length ? 'invalid' : ''}" data-i="${i}">
      <div class="qcard-top">
        <span class="qnum">${i + 1}</span>
        <textarea class="q-text grow" rows="1" maxlength="300" placeholder="Question">${esc(q.q)}</textarea>
        <select class="q-time" title="Time limit (Live Quiz)">${TIMES.map((t) => `<option value="${t}" ${t === (q.time || DEFAULT_TIME) ? 'selected' : ''}>${t}s</option>`).join('')}</select>
        <div class="qtools"><button title="Move up" data-act="up">↑</button><button title="Move down" data-act="down">↓</button><button title="Duplicate" data-act="dup">⧉</button><button title="Delete" data-act="del">🗑</button></div>
      </div>
      <div class="answers-edit">
        ${q.answers.map((a, j) => `<div class="ans-edit" style="--c:${ANSWER_COLORS[j]}">
          <span class="shape">${ANSWER_SHAPES[j]}</span>
          <input class="a-text" data-j="${j}" maxlength="120" value="${esc(a)}" placeholder="Answer ${j + 1}" />
          <label class="correct-pick" title="Mark correct"><input type="radio" name="c${i}" data-j="${j}" ${q.correct === j ? 'checked' : ''}/><span>✓</span></label>
          ${q.answers.length > 2 ? `<button class="a-del" data-act="adel" data-j="${j}" title="Remove answer">✕</button>` : ''}
        </div>`).join('')}
        ${q.answers.length < MAX_ANSWERS ? '<button class="add-ans" data-act="aadd">＋ answer</button>' : ''}
      </div>
      ${problems.length ? `<div class="problem">⚠ ${esc(problems.join(', '))}</div>` : ''}
    </div>`;
  }
  const refreshCard = (i) => {
    const el = list.querySelector(`.qcard[data-i="${i}"]`);
    const problems = questionProblems(normalizeQuestion(qs[i]));
    el.classList.toggle('invalid', problems.length > 0);
    el.querySelector('.problem')?.remove();
    if (problems.length) el.insertAdjacentHTML('beforeend', `<div class="problem">⚠ ${esc(problems.join(', '))}</div>`);
  };
  list.addEventListener('input', (e) => {
    const card = e.target.closest('.qcard');
    if (!card) return;
    const i = Number(card.dataset.i);
    if (e.target.classList.contains('q-text')) qs[i].q = e.target.value;
    else if (e.target.classList.contains('a-text')) qs[i].answers[Number(e.target.dataset.j)] = e.target.value;
    markDirty();
    refreshCard(i);
  });
  list.addEventListener('change', (e) => {
    const card = e.target.closest('.qcard');
    if (!card) return;
    const i = Number(card.dataset.i);
    if (e.target.type === 'radio') qs[i].correct = Number(e.target.dataset.j);
    if (e.target.classList.contains('q-time')) qs[i].time = Number(e.target.value);
    markDirty();
    refreshCard(i);
  });
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const i = Number(btn.closest('.qcard').dataset.i);
    const j = Number(btn.dataset.j);
    const q = qs[i];
    switch (btn.dataset.act) {
      case 'up': if (i > 0) [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]]; break;
      case 'down': if (i < qs.length - 1) [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]]; break;
      case 'dup': qs.splice(i + 1, 0, { ...q, answers: [...q.answers] }); break;
      case 'del': qs.splice(i, 1); break;
      case 'aadd': q.answers.push(''); break;
      case 'adel':
        q.answers.splice(j, 1);
        if (q.correct === j) q.correct = -1; else if (q.correct > j) q.correct--;
        break;
    }
    markDirty();
    renderList();
  });
  $('#add-q').addEventListener('click', () => {
    qs.push({ q: '', answers: ['', '', '', ''], correct: -1, time: DEFAULT_TIME });
    markDirty();
    renderList();
    const cards = list.querySelectorAll('.qcard');
    cards[cards.length - 1].querySelector('.q-text').focus();
  });
  $('#clear').addEventListener('click', async () => {
    if (!qs.length || !(await confirmBox(`Remove all ${qs.length} questions?`, 'Clear'))) return;
    qs.length = 0;
    markDirty();
    renderList();
  });

  // ---- save
  $('#save').addEventListener('click', async (e) => {
    const title = $('#title').value.trim();
    if (!title) { $('#title').focus(); return toast('Give your set a title', 'bad'); }
    const clean = qs.map(normalizeQuestion);
    const badIdx = clean.findIndex((q) => questionProblems(q).length);
    if (!clean.length) return toast('Add at least one question', 'bad');
    if (badIdx >= 0) {
      list.querySelectorAll('.qcard')[badIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return toast(`Question ${badIdx + 1}: ${questionProblems(clean[badIdx]).join(', ')}`, 'bad');
    }
    e.target.disabled = true;
    const body = { title, description: $('#desc').value.trim(), isPublic: $('#public').checked, questions: clean };
    try {
      if (id) await api(`/api/sets/${id}`, { method: 'PUT', body });
      else { const r = await api('/api/sets', { method: 'POST', body }); id = r.id; history.replaceState(null, '', `#/edit/${id}`); }
      dirty = false;
      $('#save-status').innerHTML = `Saved ✓ <a href="#/host-setup/${id}">Host it now ▶</a>`;
      toast('Saved!', 'good');
    } catch (err) { toast(err.message, 'bad'); }
    e.target.disabled = false;
  });

  renderList();
  const beforeUnload = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);
  return () => window.removeEventListener('beforeunload', beforeUnload);
}
