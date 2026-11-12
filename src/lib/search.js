import MiniSearch from 'minisearch';
import { lessons, plainText } from './content.js';
import { glossary } from './glossary.js';

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
      text: plainText(s.md),
      url: `/lessons/${l.slug}/${s.id}`,
      lessonTitle: l.title,
    });
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
  storeFields: ['title', 'type', 'url', 'lessonTitle', 'level', 'text'],
  searchOptions: { boost: { title: 3, lessonTitle: 0.5 }, prefix: true, fuzzy: 0.15 },
});
index.addAll(docs);

const ORDER = { lesson: 0, question: 1, section: 2, term: 3 };

export function search(query, limit = 14) {
  const q = query.trim();
  if (!q) return [];
  let hits = index.search(q, { combineWith: 'AND' });
  if (!hits.length) hits = index.search(q, { combineWith: 'OR' });
  const words = q.toLowerCase().split(/\s+/);
  return hits.slice(0, limit * 2).map((h) => {
    const text = h.text || '';
    const low = text.toLowerCase();
    const at = words.map((w) => low.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
    const excerpt =
      at === undefined ? text.slice(0, 110) : `${at > 40 ? '…' : ''}${text.slice(Math.max(0, at - 40), at + 90)}…`;
    return { ...h, excerpt };
  }).sort((a, b) => b.score - a.score || ORDER[a.type] - ORDER[b.type]).slice(0, limit);
}
