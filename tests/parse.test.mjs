import { parseQuestions, buildAiPrompt, parseFlashcards } from '../public/js/parse.js';
import assert from 'node:assert/strict';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL', name); throw e; }
}
const ok = (r, n) => {
  assert.equal(r.questions.length, n, JSON.stringify(r, null, 1));
  for (const q of r.questions) assert.ok(q.correct >= 0, 'correct missing: ' + JSON.stringify(q));
};

test('standard AI format', () => {
  const r = parseQuestions(`1. What is the capital of France?
A) London
B) Paris
C) Rome
D) Berlin
Answer: B

2. What is 2 + 2?
A) 3
B) 5
C) 4
D) 22
Answer: C`);
  ok(r, 2);
  assert.equal(r.questions[0].answers[r.questions[0].correct], 'Paris');
  assert.equal(r.questions[1].answers[r.questions[1].correct], '4');
});

test('chatgpt markdown with bold and explanation, no blank lines', () => {
  const r = parseQuestions(`Here are your questions:

**1. Which planet is known as the Red Planet?**
a) Venus
b) Mars
c) Jupiter
d) Saturn
**Answer: b) Mars**
Explanation: iron oxide.
**2. Largest ocean?**
a) Atlantic
b) Indian
c) Pacific
d) Arctic
**Correct answer:** c`);
  ok(r, 2);
  assert.equal(r.questions[0].q, 'Which planet is known as the Red Planet?');
  assert.equal(r.questions[0].answers[r.questions[0].correct], 'Mars');
  assert.equal(r.questions[1].answers[r.questions[1].correct], 'Pacific');
});

test('asterisk marks the correct option', () => {
  const r = parseQuestions(`Q1: Who wrote Hamlet?
A. Dickens
*B. Shakespeare
C. Austen
Q2: H2O is?
- Salt
- Water (correct)
- Air`);
  ok(r, 2);
  assert.equal(r.questions[0].answers[r.questions[0].correct], 'Shakespeare');
  assert.equal(r.questions[1].answers[r.questions[1].correct], 'Water');
});

test('answer key at the bottom', () => {
  const r = parseQuestions(`1. Sky colour?
A) Blue
B) Green
2. Grass colour?
A) Blue
B) Green

Answer Key:
1. A
2. B`);
  ok(r, 2);
  assert.equal(r.questions[0].correct, 0);
  assert.equal(r.questions[1].correct, 1);
});

test('inline answer key', () => {
  const r = parseQuestions(`1. One?
A) 1
B) 2
2. Two?
A) 1
B) 2
Answers:
1-A, 2-B`);
  ok(r, 2);
  assert.equal(r.questions[1].correct, 1);
});

test('numbered options under unnumbered question', () => {
  const r = parseQuestions(`Capital of Japan?
1. Kyoto
2. Tokyo
3. Osaka
Answer: 2`);
  ok(r, 1);
  assert.equal(r.questions[0].answers[r.questions[0].correct], 'Tokyo');
});

test('true/false', () => {
  const r = parseQuestions(`1. True or False: The sun is a star.
Answer: True`);
  ok(r, 1);
  assert.deepEqual(r.questions[0].answers, ['True', 'False']);
  assert.equal(r.questions[0].correct, 0);
});

test('JSON array', () => {
  const r = parseQuestions('```json\n[{"question":"A?","options":["x","y","z"],"answer":"y"},{"q":"B?","answers":["1","2"],"correct":1}]\n```');
  ok(r, 2);
  assert.equal(r.questions[0].correct, 1);
  assert.equal(r.format, 'json');
});

test('JSON opentdb style', () => {
  const r = parseQuestions('{"questions":[{"question":"A?","correct_answer":"yes","incorrect_answers":["no","maybe"]}]}');
  ok(r, 1);
  assert.equal(r.questions[0].answers[r.questions[0].correct], 'yes');
});

test('tab separated: question, correct, wrongs', () => {
  const r = parseQuestions('Capital of Italy?\tRome\tMilan\tNaples\nCapital of Spain?\tMadrid\tSeville\tBarcelona');
  ok(r, 2);
  assert.equal(r.questions[0].answers[r.questions[0].correct], 'Rome');
});

test('CSV with header', () => {
  const r = parseQuestions('Question,Option A,Option B,Option C,Answer\n"Biggest, animal?",Whale,Ant,Cat,A\nFastest?,Snail,Cheetah,Turtle,B');
  ok(r, 2);
  assert.equal(r.questions[0].q, 'Biggest, animal?');
  assert.equal(r.questions[1].answers[r.questions[1].correct], 'Cheetah');
});

test('flashcards auto-detect', () => {
  const r = parseQuestions('Perro - Dog\nGato - Cat\nPájaro - Bird\nPez - Fish');
  ok(r, 4);
  assert.equal(r.format, 'flashcards');
  const q = r.questions.find((x) => x.q === 'Perro');
  assert.equal(q.answers[q.correct], 'Dog');
  assert.equal(q.answers.length, 4);
});

test('flashcards reversed', () => {
  const r = parseFlashcards('H\tHydrogen\nO\tOxygen\nC\tCarbon', { direction: 'definition' });
  assert.equal(r.questions.length, 3);
  const q = r.questions.find((x) => x.q === 'Oxygen');
  assert.equal(q.answers[q.correct], 'O');
});

test('Q:/A: pairs become multiple choice', () => {
  const r = parseQuestions('Q: Capital of France?\nA: Paris\n\nQ: Capital of Spain?\nA: Madrid\n\nQ: Capital of Peru?\nA: Lima');
  ok(r, 3);
  const q = r.questions[2];
  assert.equal(q.answers[q.correct], 'Lima');
});

test('missing answer gives a warning, not a crash', () => {
  const r = parseQuestions('1. Hmm?\nA) yes\nB) no');
  assert.equal(r.questions.length, 1);
  assert.equal(r.questions[0].correct, -1);
  assert.ok(r.warnings.length === 1);
});

test('multi-line question text', () => {
  const r = parseQuestions('1. Read this:\nThe cat sat on the mat.\nWhere did it sit?\nA) Mat\nB) Hat\nAnswer: A');
  ok(r, 1);
  assert.match(r.questions[0].q, /cat sat.*Where/);
});

test('prompt round-trip format is parseable', () => {
  const p = buildAiPrompt({ topic: 'space', count: 2 });
  const example = p.slice(p.indexOf('1. Question'));
  const r = parseQuestions(example);
  ok(r, 2);
});

test('empty input', () => {
  assert.equal(parseQuestions('   ').questions.length, 0);
});

console.log(`parse: ${passed} tests passed`);
