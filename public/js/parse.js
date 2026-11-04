// Turns pasted text (from ChatGPT, Claude, Gemini, Quizlet exports, notes, CSV, JSON...)
// into quiz questions. Shared by the browser and the Cloudflare Worker.
//
// Question shape: { q: string, answers: string[2..6], correct: number (index, -1 = unknown), time: seconds }

export const MAX_ANSWERS = 6;
export const DEFAULT_TIME = 20;

const LETTERS = 'ABCDEFGH';
const CORRECT_MARK = /(\s*[(\[]\s*(correct|right|answer|✓|✔|x)\s*[)\]]|\s*[✓✔✅☑]|\s*\*{1,2}\s*$|\s+<-+\s*(correct)?\s*$)/i;
const OPTION_LETTER = /^\s*(?:([-*•✓✔✅])\s*)?[(\[]?([A-Ha-h])\s*[).\]:]\s*(.*)$/;
const OPTION_LETTER_BARE = /^\s*()([A-H])\s+-\s+(.+)$/;
const OPTION_NUMBER = /^\s*[(\[]?(\d{1,2})\s*[).\]:]\s+(.*)$/;
const OPTION_BULLET = /^\s*(?:[-•]|\*(?!\*)|\[[ xX]\])\s+(.*)$/;
const QUESTION_PREFIX = /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:q(?:uestion)?\s*#?\s*(\d+)?\s*[:.)-]|(\d{1,3})\s*[).:]|#\s*\d+\s*[:.)-]?)\s*(?:\*\*)?\s*(.*)$/i;
const ANSWER_LINE = /^\s*(?:\*\*)?\s*(?:correct\s+answer|correct\s+option|right\s+answer|answer|ans|correct|key|solution)\s*(?:\(s\))?\s*(?:\*\*)?\s*[:=\-–]\s*(?:\*\*)?\s*(.+?)\s*(?:\*\*)?\s*$/i;
const ANSWER_KEY_HEADER = /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(answer\s*key|answers|key|solutions)\s*:?\s*(?:\*\*)?\s*:?\s*$/i;
const IGNORE_LINE = /^\s*(?:\*\*)?\s*(explanation|reason|why|hint|note|difficulty|topic|source)\s*(?:\*\*)?\s*[:\-–]/i;
const TIME_LINE = /^\s*(?:\*\*)?\s*(time|timer|seconds)\s*(?:\*\*)?\s*[:=]\s*(\d{1,3})/i;
const TRUE_FALSE = /^(true\s*(or|\/)\s*false|t\s*\/\s*f)\s*[:\-–]?\s*/i;

function cleanText(s) {
  return String(s ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*\*\*\s*|\s*\*\*\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripCorrectMark(text) {
  let s = String(text);
  let marked = false;
  if (/^\s*\*\*.+\*\*\s*$/.test(s) && !/^\s*\*\*\s*$/.test(s)) marked = true; // whole option bold
  if (/^\s*[*✓✔✅☑]\s*/.test(s)) { marked = true; s = s.replace(/^\s*[*✓✔✅☑]\s*/, ''); }
  if (CORRECT_MARK.test(s)) { marked = true; s = s.replace(CORRECT_MARK, ''); }
  if (/^\s*\[[xX]\]/.test(text)) marked = true;
  return { text: cleanText(s), marked };
}

/** Resolve an answer key value ("B", "b)", "2", "Paris", "B) Paris") to an index. */
export function resolveAnswer(value, answers) {
  const v = cleanText(value).replace(/[.。]$/, '');
  if (!v) return -1;
  const lower = v.toLowerCase();
  const exact = answers.findIndex((a) => a.toLowerCase() === lower);
  if (exact >= 0) return exact;
  const m = v.match(/^[(\[]?([A-Ha-h])(?:[).\]:]|\s|$)/);
  if (m) {
    const idx = LETTERS.indexOf(m[1].toUpperCase());
    if (idx < answers.length) {
      return idx;
    }
  }
  const n = v.match(/^(?:option\s*)?(\d{1,2})(?:[).\]:]|\s|$)/i);
  if (n) {
    const idx = Number(n[1]) - 1;
    if (idx >= 0 && idx < answers.length) return idx;
  }
  if (/^(t|true|yes)$/i.test(v)) { const i = answers.findIndex((a) => /^true$/i.test(a)); if (i >= 0) return i; }
  if (/^(f|false|no)$/i.test(v)) { const i = answers.findIndex((a) => /^false$/i.test(a)); if (i >= 0) return i; }
  // Text after a letter: "B) Paris" or partial match.
  const tail = v.replace(/^[(\[]?[A-Ha-h][).\]:]\s*/, '').toLowerCase();
  const partial = answers.findIndex((a) => a.toLowerCase() === tail || (tail.length > 3 && a.toLowerCase().includes(tail)));
  return partial;
}

function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Final cleanup + validation of one question. Returns the question with `problems`. */
export function normalizeQuestion(raw) {
  const q = {
    q: cleanText(raw.q).slice(0, 300),
    answers: (raw.answers || []).map((a) => cleanText(a).slice(0, 120)).filter((a) => a.length > 0).slice(0, MAX_ANSWERS),
    correct: Number.isInteger(raw.correct) ? raw.correct : -1,
    time: clampTime(raw.time),
  };
  if (q.correct >= q.answers.length) q.correct = -1;
  return q;
}

export function clampTime(t) {
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIME;
  return Math.max(5, Math.min(120, Math.round(n)));
}

export function questionProblems(q) {
  const p = [];
  if (!q.q) p.push('missing question text');
  if (q.answers.length < 2) p.push('needs at least 2 answers');
  if (q.correct < 0 || q.correct >= q.answers.length) p.push('no correct answer marked');
  return p;
}

// ---------------------------------------------------------------- JSON

function tryJson(text) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = t.search(/[\[{]/);
  if (start < 0) return null;
  const open = t[start];
  const end = t.lastIndexOf(open === '[' ? ']' : '}');
  if (end <= start) return null;
  let data;
  try { data = JSON.parse(t.slice(start, end + 1)); } catch { return null; }
  if (!Array.isArray(data)) data = data.questions || data.quiz || data.items || data.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const out = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const qText = item.question ?? item.q ?? item.prompt ?? item.text ?? item.title;
    let answers = item.answers ?? item.options ?? item.choices ?? item.alternatives;
    let correct = -1;
    if (answers && !Array.isArray(answers) && typeof answers === 'object') {
      // {"A": "...", "B": "..."}
      answers = Object.values(answers);
    }
    if (!Array.isArray(answers)) {
      // Format: {question, correct_answer, incorrect_answers}
      const right = item.correct_answer ?? item.correctAnswer ?? item.answer;
      const wrong = item.incorrect_answers ?? item.incorrectAnswers ?? item.wrong ?? item.distractors;
      if (right != null && Array.isArray(wrong)) {
        answers = shuffle([String(right), ...wrong.map(String)]);
        correct = answers.indexOf(String(right));
      } else continue;
    } else {
      answers = answers.map((a, i) => {
        if (a && typeof a === 'object') {
          if (a.correct === true || a.isCorrect === true || a.is_correct === true) correct = i;
          return String(a.text ?? a.answer ?? a.option ?? a.value ?? '');
        }
        return String(a);
      });
      if (correct < 0) {
        const key = item.correct ?? item.answer ?? item.correctIndex ?? item.correct_index ?? item.correctAnswer ?? item.correct_answer ?? item.solution;
        if (typeof key === 'number') {
          correct = key >= 0 && key < answers.length ? key : key === answers.length ? key - 1 : -1;
        } else if (Array.isArray(key) && key.length) {
          correct = typeof key[0] === 'number' ? key[0] : resolveAnswer(key[0], answers);
        } else if (key != null) {
          correct = resolveAnswer(String(key), answers);
        }
      }
    }
    out.push({ q: String(qText ?? ''), answers, correct, time: item.time ?? item.timeLimit ?? item.seconds });
  }
  return out.length ? out : null;
}

// ---------------------------------------------------------------- table formats

function splitCsvLine(line, sep) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"' && cur.trim() === '') { inQ = true; cur = ''; }
    else if (c === sep) { out.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function tryTable(lines) {
  const nonEmpty = lines.filter((l) => l.trim());
  if (nonEmpty.length < 1) return null;
  let sep = null;
  if (nonEmpty.every((l) => l.split('\t').length >= 3)) sep = '\t';
  else if (/question/i.test(nonEmpty[0]) && splitCsvLine(nonEmpty[0], ',').length >= 3) sep = ',';
  else if (nonEmpty.length >= 2 && nonEmpty.every((l) => l.split('|').filter((c) => c.trim()).length >= 3) && !nonEmpty.some((l) => OPTION_LETTER.test(l))) sep = '|';
  if (!sep) return null;
  let rows = nonEmpty.map((l) => (sep === '|' ? l.replace(/^\s*\||\|\s*$/g, '') : l))
    .map((l) => (sep === ',' ? splitCsvLine(l, ',') : l.split(sep).map((c) => c.trim())))
    .filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c) || c === ''));
  let header = null;
  if (rows[0].some((c) => /^(question|q|prompt)$/i.test(c))) { header = rows[0].map((c) => c.toLowerCase()); rows = rows.slice(1); }
  const out = [];
  for (const r of rows) {
    if (header) {
      const qi = header.findIndex((h) => /^(question|q|prompt)$/.test(h));
      let ci = header.findIndex((h) => /^(correct(\s*(answer|option))?|answer|right\s*answer|key|solution)$/.test(h));
      if (ci < 0) ci = header.findIndex((h) => /correct|right/.test(h) && !/wrong|incorrect/.test(h));
      const timeI = header.findIndex((h) => /time|seconds/.test(h));
      const optI = header.map((h, i) => (/^(option|choice|answer)\s*([a-h]|\d+)$|^[a-h]$|wrong|incorrect|distractor/.test(h) && i !== ci ? i : -1)).filter((i) => i >= 0);
      const opts = optI.map((i) => r[i]).filter(Boolean);
      const key = r[ci];
      if (header.some((h) => /wrong|incorrect|distractor/.test(h))) {
        const answers = shuffle([key, ...opts].filter(Boolean));
        out.push({ q: r[qi], answers, correct: answers.indexOf(key), time: r[timeI] });
      } else {
        out.push({ q: r[qi], answers: opts, correct: resolveAnswer(key ?? '', opts), time: r[timeI] });
      }
    } else {
      // question, correct, wrong, wrong, ...
      const [q, right, ...wrong] = r;
      const answers = shuffle([right, ...wrong].filter(Boolean));
      out.push({ q, answers, correct: answers.indexOf(right) });
    }
  }
  return out.length ? out : null;
}

// ---------------------------------------------------------------- flashcards

const CARD_SEPS = ['\t', ' — ', ' – ', ' - ', ' : ', ': ', ' = ', ' | ', ' -> ', ' => '];

function cardSplit(line) {
  for (const sep of CARD_SEPS) {
    const i = line.indexOf(sep);
    if (i > 0 && i < line.length - sep.length) {
      return [line.slice(0, i), line.slice(i + sep.length)].map(cleanText);
    }
  }
  return null;
}

/**
 * Term/definition lines -> multiple-choice questions with wrong answers taken from other cards.
 * direction: 'term' = show the term, pick the definition; 'definition' = the reverse.
 */
export function parseFlashcards(text, { direction = 'term', rand = Math.random } = {}) {
  const cards = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim();
    if (!line) continue;
    const split = cardSplit(line);
    if (split && split[0] && split[1]) cards.push(split);
  }
  if (cards.length < 2) return { questions: [], warnings: ['Need at least 2 "term - definition" lines to make flashcard questions.'] };
  const pairs = cards.map(([a, b]) => (direction === 'definition' ? [b, a] : [a, b]));
  const allAnswers = [...new Set(pairs.map((p) => p[1]))];
  const questions = pairs.map(([prompt, right]) => {
    const wrong = shuffle(allAnswers.filter((a) => a !== right), rand).slice(0, 3);
    const answers = shuffle([right, ...wrong], rand);
    return normalizeQuestion({ q: prompt, answers, correct: answers.indexOf(right) });
  });
  return { questions, warnings: [] };
}

function looksLikeFlashcards(lines) {
  const nonEmpty = lines.filter((l) => l.trim());
  if (nonEmpty.length < 3) return false;
  const withSep = nonEmpty.filter((l) => cardSplit(l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '')));
  const hasOptions = nonEmpty.some((l) => OPTION_LETTER.test(l) || ANSWER_LINE.test(l));
  return !hasOptions && withSep.length / nonEmpty.length >= 0.8;
}

// ---------------------------------------------------------------- free text (the main AI format)

function parseText(lines) {
  const questions = [];
  let cur = null;
  let keyMode = false;
  const keyEntries = [];

  const finish = () => {
    if (cur && (cur.q || cur.answers.length)) {
      if (cur.answers.length === 0 && cur.tf) cur.answers = ['True', 'False'];
      if (cur.correct < 0 && cur.pendingKey != null) cur.correct = resolveAnswer(cur.pendingKey, cur.answers);
      questions.push(cur);
    }
    cur = null;
  };
  const start = (text, num) => {
    finish();
    let q = text;
    let tf = false;
    if (TRUE_FALSE.test(q)) { tf = true; q = q.replace(TRUE_FALSE, ''); }
    cur = { q, answers: [], correct: -1, time: undefined, num, tf, pendingKey: null };
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/ /g, ' ').trimEnd();
    const trimmed = line.trim();
    if (!trimmed || /^[-=_*]{3,}$/.test(trimmed) || /^```/.test(trimmed)) {
      if (!trimmed && cur && cur.answers.length >= 2 && cur.correct >= 0) finish();
      continue;
    }
    if (ANSWER_KEY_HEADER.test(trimmed)) { finish(); keyMode = true; continue; }
    if (keyMode) {
      // "1. B", "1-B, 2-C", "1) Paris"
      const parts = trimmed.split(/[,;]\s*(?=\d)/);
      let any = false;
      for (const part of parts) {
        const m = part.match(/^\s*(?:q(?:uestion)?\s*)?(\d{1,3})\s*[).:\-–=]?\s*(.+)$/i);
        if (m) { keyEntries.push([Number(m[1]), m[2]]); any = true; }
      }
      if (any) continue;
      keyMode = false;
    }
    const time = trimmed.match(TIME_LINE);
    if (time && cur) { cur.time = Number(time[2]); continue; }
    if (IGNORE_LINE.test(trimmed)) continue;

    const ans = trimmed.match(ANSWER_LINE);
    if (ans && cur) {
      const value = ans[1];
      if (cur.answers.length === 0 && !cur.tf) {
        // Two-line flashcard style: "Q: ...  A: ..." — the answer IS the only answer. Treat as pending.
        cur.pendingKey = value;
        cur.loneAnswer = cleanText(value);
      } else {
        const idx = resolveAnswer(value, cur.answers.length ? cur.answers : ['True', 'False']);
        if (cur.tf && cur.answers.length === 0) cur.answers = ['True', 'False'];
        if (idx >= 0) cur.correct = idx; else cur.pendingKey = value;
      }
      continue;
    }

    // "Q: ...\nA: ..." flashcard pairs: the A: line is the answer, not option A.
    const qa = trimmed.match(/^\s*a\s*:\s*(.+)$/i);
    if (qa && cur && cur.qColon && cur.answers.length === 0) {
      cur.pendingKey = qa[1];
      cur.loneAnswer = cleanText(qa[1]);
      continue;
    }

    const letter = trimmed.match(OPTION_LETTER) || trimmed.match(OPTION_LETTER_BARE);
    // "A) ..." is an option only if we already have a question going (otherwise "A. Lincoln was..." is text)
    if (letter && cur && cur.q && letter[3] !== undefined && letter[3].trim() !== '') {
      const idx = LETTERS.indexOf(letter[2].toUpperCase());
      if (idx === cur.answers.length || (idx < MAX_ANSWERS && idx > cur.answers.length)) {
        const { text, marked } = stripCorrectMark(letter[3]);
        if (marked || (letter[1] && letter[1] !== '-' && letter[1] !== '•')) cur.correct = cur.answers.length;
        cur.answers.push(text);
        continue;
      }
    }

    const qp = trimmed.match(QUESTION_PREFIX);
    const numOpt = trimmed.match(OPTION_NUMBER);
    if (numOpt && cur && cur.q && cur.answers.length < 2 && !cur.pendingKey && !/\?\s*$/.test(numOpt[2]) && Number(numOpt[1]) === cur.answers.length + 1 && cur.answers.length < MAX_ANSWERS && !(qp && /^\s*q/i.test(trimmed))) {
      // "1. Paris" under a question = numbered option
      cur.numberedOptions = true;
      const { text, marked } = stripCorrectMark(numOpt[2]);
      if (marked) cur.correct = cur.answers.length;
      cur.answers.push(text);
      continue;
    }
    if (numOpt && cur && cur.q && cur.answers.length >= 2 && cur.answers.length < MAX_ANSWERS && Number(numOpt[1]) === cur.answers.length + 1 && cur.numberedOptions && !/\?\s*$/.test(numOpt[2])) {
      const { text, marked } = stripCorrectMark(numOpt[2]);
      if (marked) cur.correct = cur.answers.length;
      cur.answers.push(text);
      continue;
    }

    if (qp && (qp[3] ?? '').trim()) {
      start(qp[3], Number(qp[1] || qp[2]) || questions.length + 1);
      cur.qColon = /^\s*q\s*:/i.test(trimmed);
      continue;
    }

    const bullet = trimmed.match(OPTION_BULLET);
    if (bullet && cur && cur.q) {
      const { text, marked } = stripCorrectMark(trimmed.replace(/^\s*(?:[-•]|\*(?!\*))\s+/, ''));
      if (marked) cur.correct = cur.answers.length;
      cur.answers.push(text);
      continue;
    }

    // Plain line.
    if (!cur) { start(trimmed); continue; }
    if (cur.answers.length === 0 && !cur.loneAnswer) { cur.q += ' ' + trimmed; continue; }
    start(trimmed);
  }
  finish();

  for (const [num, value] of keyEntries) {
    const q = questions.find((x) => x.num === num) ?? questions[num - 1];
    if (q) q.correct = resolveAnswer(value, q.answers.length ? q.answers : (q.tf ? (q.answers = ['True', 'False']) : []));
  }

  // "Q: ... A: ..." pairs with no options: turn into a flashcard-style set if there are several.
  const lone = questions.filter((q) => q.answers.length === 0 && q.loneAnswer);
  if (lone.length >= 2 && lone.length === questions.length) {
    const all = [...new Set(lone.map((q) => q.loneAnswer))];
    return lone.map((q) => {
      const answers = shuffle([q.loneAnswer, ...shuffle(all.filter((a) => a !== q.loneAnswer)).slice(0, 3)]);
      return { q: q.q, answers, correct: answers.indexOf(q.loneAnswer) };
    });
  }
  return questions;
}

/**
 * Main entry. mode: 'auto' | 'flashcards'
 * Returns { questions, warnings, format }.
 */
export function parseQuestions(text, { mode = 'auto', direction = 'term' } = {}) {
  const src = String(text ?? '').replace(/\r\n?/g, '\n');
  if (!src.trim()) return { questions: [], warnings: ['Nothing to import — paste some questions first.'], format: 'none' };
  if (mode === 'flashcards') return { ...parseFlashcards(src, { direction }), format: 'flashcards' };

  let raw = null;
  let format = 'text';
  if (/^\s*(```(json)?\s*)?[\[{]/i.test(src)) { raw = tryJson(src); format = 'json'; }
  const lines = src.split('\n');
  if (!raw) { raw = tryTable(lines); if (raw) format = 'table'; }
  if (!raw && looksLikeFlashcards(lines)) return { ...parseFlashcards(src, { direction }), format: 'flashcards' };
  if (!raw) { raw = parseText(lines); format = 'text'; }

  let questions = raw.map(normalizeQuestion).filter((q) => q.q || q.answers.length);
  // Drop chatter like "Here are your questions:" — text with no answers, when real questions exist.
  if (questions.some((q) => q.answers.length >= 2)) questions = questions.filter((q) => q.answers.length > 0);
  const warnings = [];
  questions.forEach((q, i) => {
    const p = questionProblems(q);
    if (p.length) warnings.push(`Question ${i + 1}: ${p.join(', ')}`);
  });
  if (!questions.length) warnings.push("Couldn't find any questions. Try the \"Copy AI prompt\" button so your AI uses a format this understands.");
  return { questions, warnings, format };
}

/** The prompt users copy into their own AI (ChatGPT, Claude, Gemini...). Also used server-side. */
export function buildAiPrompt({ topic = '', notes = '', count = 10, difficulty = 'medium', grade = '', answers = 4 } = {}) {
  const n = Math.max(1, Math.min(50, Number(count) || 10));
  const k = Math.max(2, Math.min(6, Number(answers) || 4));
  const letters = LETTERS.slice(0, k).split('');
  const about = notes.trim()
    ? `based ONLY on these notes:\n"""\n${notes.trim().slice(0, 12000)}\n"""`
    : `about: ${topic.trim() || 'general knowledge'}`;
  const level = grade ? ` for ${grade} students` : '';
  return `Write ${n} ${difficulty} multiple-choice quiz questions${level} ${about}

Rules:
- Each question has exactly ${k} answer options and exactly ONE correct answer.
- Keep questions under 120 characters and answers under 60 characters.
- Make the wrong answers believable. Don't use "all of the above".
- Vary which letter is correct.
- Output ONLY the questions in exactly this format, nothing else:

1. Question text here?
${letters.map((l, i) => `${l}) ${i === 0 ? 'First option' : 'Another option'}`).join('\n')}
Answer: ${letters[1]}

2. Next question?
${letters.map((l) => `${l}) ...`).join('\n')}
Answer: ${letters[0]}`;
}
