import { buildAiPrompt, parseQuestions, questionProblems } from '../public/js/parse.js';
import { AI_DAILY_LIMIT } from '../public/js/rules.js';
import { Env, HttpError, today } from './util';
import type { UserRow } from './auth';

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/** Generate questions with Cloudflare Workers AI, then run them through the same parser as pasted text. */
export async function generateQuestions(env: Env, user: UserRow, body: any) {
  if (!env.AI && !env.MOCK_AI) throw new HttpError(503, 'AI is not set up on this server. Use "Copy AI prompt" and paste the answer instead.');
  const topic = String(body.topic ?? '').slice(0, 300);
  const notes = String(body.notes ?? '').slice(0, 12000);
  if (!topic.trim() && !notes.trim()) throw new HttpError(400, 'Give a topic or paste some notes');
  const count = Math.max(1, Math.min(30, Number(body.count) || 10));
  const difficulty = ['easy', 'medium', 'hard'].includes(body.difficulty) ? body.difficulty : 'medium';
  const grade = String(body.grade ?? '').slice(0, 40);

  // Daily limit per account (Workers AI free tier is generous but finite).
  const day = today();
  const row = await env.DB.prepare('SELECT ai_day, ai_count FROM users WHERE id = ?').bind(user.id).first<{ ai_day: string | null; ai_count: number }>();
  const used = row?.ai_day === day ? row.ai_count : 0;
  if (used >= AI_DAILY_LIMIT) throw new HttpError(429, `You've used all ${AI_DAILY_LIMIT} AI generations for today. Use "Copy AI prompt" with your own AI instead!`);
  await env.DB.prepare('UPDATE users SET ai_day = ?, ai_count = ? WHERE id = ?').bind(day, used + 1, user.id).run();

  const prompt = buildAiPrompt({ topic, notes, count, difficulty, grade });
  let text = '';
  try {
    if (env.MOCK_AI) return finish(mockAi(topic, count), count, used);
    const out: any = await env.AI!.run((env.AI_MODEL || DEFAULT_MODEL) as any, {
      messages: [
        { role: 'system', content: 'You write accurate, kid-friendly quiz questions. You follow the output format exactly and never add commentary.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: Math.min(4096, 120 * count + 200),
      temperature: 0.6,
    } as any);
    text = typeof out === 'string' ? out : out?.response ?? out?.result?.response ?? '';
  } catch (e: any) {
    throw new HttpError(502, 'The AI had a problem: ' + String(e?.message || e).slice(0, 200));
  }
  return finish(text, count, used);
}

function finish(text: string, count: number, used: number) {
  const parsed = parseQuestions(text);
  const good = parsed.questions.filter((q: any) => questionProblems(q).length === 0);
  if (!good.length) throw new HttpError(502, "The AI's answer couldn't be turned into questions. Try again or use Copy AI prompt.");
  return { questions: good.slice(0, count), warnings: parsed.warnings, remaining: AI_DAILY_LIMIT - used - 1 };
}

/** Local dev/test stand-in for Workers AI (set MOCK_AI in wrangler.local.toml). */
function mockAi(topic: string, count: number): string {
  const out: string[] = ['Sure! Here are your questions:', ''];
  for (let i = 1; i <= count; i++) {
    out.push(`**${i}. Mock question ${i} about ${topic || 'your notes'}?**`, 'A) Wrong one', 'B) Right one', 'C) Also wrong', 'D) Nope', '**Answer: B**', '');
  }
  return out.join('\n');
}
