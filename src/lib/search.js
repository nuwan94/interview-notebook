import MiniSearch from 'minisearch';
import { getLesson, lessons, plainText } from './content.js';
import { glossary } from './glossary.js';
import { labs } from '../labs/index.js';
import { loadEveryQuiz } from './quiz.js';

const docs = [];
for (const l of lessons) {
  docs.push({
    id: `lesson:${l.slug}`,
    type: 'lesson',
    title: l.title,
    text: `${l.summary} ${l.tags.join(' ')}`,
    url: `/lessons/${l.slug}`,
    lessonTitle: l.title,
  });
  for (const s of l.sections) {
    docs.push({
      id: `section:${l.slug}:${s.id}`,
      type: 'section',
      title: s.title,
      // sections with ### sub-sections index those separately so a result lands on the exact heading
      text: plainText(s.subs?.length ? s.lead : s.md),
      url: `/lessons/${l.slug}/${s.id}`,
      lessonTitle: l.title,
    });
    for (const sub of s.subs || []) {
      if (s.isQuestions) continue;
      docs.push({
        id: `sub:${l.slug}:${sub.id}`,
        type: 'section',
        title: sub.title,
        text: plainText(sub.md),
        url: `/lessons/${l.slug}/${sub.id}`,
        lessonTitle: `${l.title} › ${s.title}`,
      });
    }
  }
  for (const q of l.questions) {
    docs.push({
      id: `question:${l.slug}:${q.id}`,
      type: 'question',
      title: q.title,
      text: plainText(q.md),
      url: `/lessons/${l.slug}/${q.id}`,
      lessonTitle: l.title,
      level: q.level,
    });
  }
}
for (const x of labs) {
  docs.push({
    id: `lab:${x.slug}`,
    type: 'lab',
    title: x.title,
    text: `lab ${x.subtitle ?? ''} ${(x.learn ?? []).join(' ')} ${x.steps.map((s) => s.title).join(' ')}`,
    url: `/lab/${x.slug}`,
    lessonTitle: `Lab · ${x.topic.join(' / ')}`,
  });
}
for (const g of glossary) {
  docs.push({
    id: `term:${g.id}`,
    type: 'term',
    title: g.term,
    text: `${(g.aliases || []).join(' ')} ${g.short} ${g.more || ''}`,
    url: `/glossary/${g.id}`,
    lessonTitle: 'Glossary',
  });
}

const index = new MiniSearch({
  fields: ['title', 'text', 'lessonTitle'],
  storeFields: ['title', 'type', 'url', 'lessonTitle', 'level', 'text', 'answer'],
  searchOptions: {
    boost: { title: 6, lessonTitle: 0.5 },
    prefix: true,
    fuzzy: 0.15,
    // for interview prep, questions and sections matter more than glossary entries
    boostDocument: (_id, _term, stored) => (stored?.type === 'question' ? 1.4 : stored?.type === 'term' ? 0.6 : 1),
  },
});
index.addAll(docs);

/** Quiz questions are loaded on demand (about 0.8 MB of JSON) the first time search is opened, then added to the same index. */
let quizLoad;
export function loadQuizIndex() {
  quizLoad ??= loadEveryQuiz()
    .then((files) => {
      const quizDocs = [];
      for (const { slug, questions } of files) {
        const label = getLesson(slug)?.nav ?? slug;
        questions.forEach((area, ai) => {
          (Array.isArray(area.v) ? area.v : [area]).forEach((v, vi) => {
            quizDocs.push({
              id: `quiz:${slug}:${ai}:${vi}`,
              type: 'quiz',
              title: v.q,
              text: `${v.o.join(' ')} ${v.w ?? ''} ${area.t ?? ''}`,
              answer: `${v.o[0]}${v.w ? `. ${v.w}` : ''}`,
              url: `/lessons/${slug}?quiz=1`,
              lessonTitle: `Quiz · ${label}`,
            });
          });
        });
      }
      index.addAll(quizDocs);
      return quizDocs.length;
    })
    .catch(() => {
      quizLoad = undefined; // allow a retry the next time search opens
      return 0;
    });
  return quizLoad;
}

/** The result groups, in display order. Each result type belongs to exactly one group. */
export const GROUPS = [
  { id: 'lessons', label: 'Lessons', types: ['lesson', 'section'] },
  { id: 'labs', label: 'Labs', types: ['lab'] },
  { id: 'questions', label: 'Questions', types: ['question'] },
  { id: 'quiz', label: 'Quiz', types: ['quiz'] },
  { id: 'glossary', label: 'Glossary', types: ['term'] },
];
const GROUP_OF = Object.fromEntries(GROUPS.flatMap((g) => g.types.map((t) => [t, g.id])));
const PER_GROUP = 60;

/** Results for a query as { lessons: [], labs: [], questions: [], quiz: [], glossary: [] }, best first inside each group. */
export function search(query) {
  const out = Object.fromEntries(GROUPS.map((g) => [g.id, []]));
  const q = query.trim();
  if (!q) return out;
  let hits = index.search(q, { combineWith: 'AND' });
  if (!hits.length) hits = index.search(q, { combineWith: 'OR' });
  const words = q.toLowerCase().split(/\s+/);
  for (const h of hits) {
    const list = out[GROUP_OF[h.type]];
    if (list.length >= PER_GROUP) continue;
    let excerpt;
    if (h.type === 'quiz') {
      excerpt = `Answer: ${h.answer}`;
    } else {
      const text = h.text || '';
      const low = text.toLowerCase();
      const at = words.map((w) => low.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
      excerpt = at === undefined ? text.slice(0, 110) : `${at > 40 ? '…' : ''}${text.slice(Math.max(0, at - 40), at + 90)}…`;
    }
    list.push({ ...h, excerpt });
  }
  // a lesson match comes before the sections of lessons; the rest keep their score order
  out.lessons.sort((a, b) => (a.type === 'lesson' ? 0 : 1) - (b.type === 'lesson' ? 0 : 1) || b.score - a.score);
  return out;
}
