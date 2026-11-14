// Multiple-choice quizzes live in content/quizzes/<lesson-slug>.json and are loaded only when a reader opens one.
//
// File format:  { "questions": [ { "q": "...", "o": ["correct", "wrong", "wrong", "wrong"], "w": "why", "s": 30 } ] }
//   o: the FIRST option is always the correct one; the UI shuffles them for every attempt.
//   w: short explanation shown after answering.   s: optional seconds for this question (default 30).

const loaders = import.meta.glob('../../content/quizzes/*.json', { import: 'default' });
const path = (slug) => `../../content/quizzes/${slug}.json`;

export const DEFAULT_SECONDS = 30;
export const hasQuiz = (slug) => path(slug) in loaders;
export const loadQuiz = (slug) => loaders[path(slug)]();

/** Questions of several lessons in one list (each remembers its lesson in `from`), for topic and mixed quizzes. */
export async function loadMany(slugs) {
  const parts = await Promise.all(slugs.filter(hasQuiz).map(async (slug) => ({ slug, quiz: await loadQuiz(slug) })));
  return { questions: parts.flatMap(({ slug, quiz }) => quiz.questions.map((q) => ({ ...q, from: slug }))) };
}

const KEY = 'interview-notebook:quiz:v1';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export const bestScore = (slug) => readAll()[slug] ?? null;

/** Remembers the best attempt per lesson; returns true when this attempt is a new best. */
export function saveScore(slug, correct, total) {
  const all = readAll();
  const prev = all[slug];
  const better = !prev || correct / total > prev.correct / prev.total;
  if (better) all[slug] = { correct, total, at: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable: the score is simply not remembered */
  }
  return better && !!prev;
}

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** One attempt: options shuffled, so the answer position changes every time. `count` draws a random sample of that size. */
export const buildAttempt = (quiz, count) =>
  (count && count < quiz.questions.length ? shuffle(quiz.questions).slice(0, count) : quiz.questions).map((q) => ({
    q: q.q,
    w: q.w,
    from: q.from,
    seconds: q.s || DEFAULT_SECONDS,
    options: shuffle(q.o.map((t, i) => ({ t, ok: i === 0 }))),
  }));

export function grade(percent) {
  if (percent >= 90) return { label: 'Interview ready', tone: 'ok' };
  if (percent >= 70) return { label: 'Solid grasp: review the misses', tone: 'ok' };
  if (percent >= 50) return { label: 'Getting there: revisit the weak spots', tone: 'warn' };
  return { label: 'Re-read the lesson, then try again', tone: 'bad' };
}
