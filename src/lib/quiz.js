// Multiple-choice quizzes live in content/quizzes/<lesson-slug>.json and are loaded only when a reader opens one.
//
// File format: a quiz is a list of AREAS. Each area is one idea to test and holds one or more VARIANTS (the same
// point asked as IS / NOT, from another angle, or a different question on the same topic). An attempt shows ONE
// variant per area, preferring one that was not shown last time.
//   { "questions": [ { "t": "Topic label", "v": [ { "q": "...", "o": ["correct", "wrong", "wrong", "wrong"], "w": "why", "s": 30 }, ... ] } ] }
//   o: the FIRST option is always the correct one; the UI shuffles them for every attempt.
//   w: short explanation shown after answering.   s: optional seconds for this variant (default 30).
// A plain question object (with `q` and no `v`) is still accepted: it is an area with a single variant.

const loaders = import.meta.glob('../../content/quizzes/*.json', { import: 'default' });
const path = (slug) => `../../content/quizzes/${slug}.json`;

export const DEFAULT_SECONDS = 30;
export const hasQuiz = (slug) => path(slug) in loaders;

/** Turns file entries into areas { id, t, v: [variant, ...] }; `s` given as text is a topic label, as a number it is seconds. */
const areasOf = (slug, quiz) =>
  quiz.questions.map((e, i) => {
    const v = Array.isArray(e.v) ? e.v : [e];
    return { id: `${slug}#${i}`, from: slug, t: e.t || (typeof e.s === 'string' ? e.s : ''), v };
  });

export const loadQuiz = async (slug) => ({ questions: areasOf(slug, await loaders[path(slug)]()) });

/** Every quiz file as { slug, questions } (raw file entries), for the search index. Loads all of them, so call it only when needed. */
export const loadEveryQuiz = () =>
  Promise.all(
    Object.entries(loaders).map(async ([p, load]) => ({ slug: /([^/]+)\.json$/.exec(p)[1], questions: (await load()).questions })),
  );

/** Areas of several lessons in one list (each remembers its lesson in `from`), for topic and mixed quizzes. */
export async function loadMany(slugs) {
  const parts = await Promise.all(slugs.filter(hasQuiz).map((slug) => loadQuiz(slug)));
  return { questions: parts.flatMap((p) => p.questions) };
}

const KEY = 'interview-notebook:quiz:v1';
const SEEN_KEY = 'interview-notebook:quiz-seen:v1';

/** Which variant of each area was shown last: { areaId: variantIndex }. */
function readSeen() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeSeen(seen) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* storage unavailable: variants may simply repeat */
  }
}

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

/**
 * One attempt: one variant per area (not the one shown last time when the area has another), options shuffled so
 * the answer position changes every time. `count` draws a random sample of that many areas.
 */
export function buildAttempt(quiz, count) {
  const seen = readSeen();
  const areas = count && count < quiz.questions.length ? shuffle(quiz.questions).slice(0, count) : quiz.questions;
  const attempt = areas.map((area) => {
    const idxs = area.v.map((_, i) => i);
    const fresh = idxs.filter((i) => i !== seen[area.id]);
    const pickIdx = (fresh.length ? fresh : idxs)[Math.floor(Math.random() * (fresh.length || idxs.length))];
    seen[area.id] = pickIdx;
    const q = area.v[pickIdx];
    return {
      q: q.q,
      w: q.w,
      from: area.from,
      seconds: Number.isFinite(q.s) && q.s > 0 ? q.s : DEFAULT_SECONDS, // `s` as text is a label, not seconds
      options: shuffle(q.o.map((t, i) => ({ t, ok: i === 0 }))),
    };
  });
  writeSeen(seen);
  return attempt;
}

export function grade(percent) {
  if (percent >= 90) return { label: 'Interview ready', tone: 'ok' };
  if (percent >= 70) return { label: 'Solid grasp: review the misses', tone: 'ok' };
  if (percent >= 50) return { label: 'Getting there: revisit the weak spots', tone: 'warn' };
  return { label: 'Re-read the lesson, then try again', tone: 'bad' };
}
