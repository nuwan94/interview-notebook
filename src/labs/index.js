// Every lab lives in its own file here. The file name is the lab's slug (src/labs/request-path.js is #/lab/request-path)
// and its `topic` ("Full stack / Node.js") puts it in the "Labs" group of that sub-topic, next to the lessons.
// `lesson` names the lesson it belongs to: labs of one lesson are listed together.
import { normalizeLab } from './normalize.js';

const files = import.meta.glob(['./*.js', '!./index.js', '!./normalize.js'], { import: 'default', eager: true });

export const labs = Object.entries(files)
  .map(([p, lab]) => ({
    ...normalizeLab(lab),
    slug: p.slice(2, -3),
    topic: String(lab.topic || '').split(/\s+\/\s+/).map((s) => s.trim()).filter(Boolean),
  }))
  .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.title.localeCompare(b.title));

export const getLab = (slug) => labs.find((l) => l.slug === slug);
export const labPath = (lab, step) => `/lab/${lab.slug}${step ? `/${step}` : ''}`;
