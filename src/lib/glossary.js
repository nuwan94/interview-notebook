import raw from '../../content/glossary.json';
import { slugify } from './content.js';

// Every glossary entry becomes a dotted-underline tooltip wherever its term (or an alias) appears in lesson prose.
export const glossary = raw
  .map((e) => ({ ...e, id: slugify(e.term) }))
  .sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }));

export const byId = new Map(glossary.map((e) => [e.id, e]));
// word -> every entry that uses it (a word such as "heap" can mean different things in different lessons)
const byWord = new Map();
const addWord = (w, e) => {
  const k = w.toLowerCase();
  if (!byWord.has(k)) byWord.set(k, []);
  byWord.get(k).push(e);
};
for (const e of glossary) {
  addWord(e.term, e);
  for (const a of e.aliases || []) addWord(a, e);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alternatives = [...byWord.keys()].sort((a, b) => b.length - a.length).map(esc);
// longest term first; optional plural suffix; no letter/digit directly before or after
const TERM_RE = new RegExp(`(?<![A-Za-z0-9_])(?:${alternatives.join('|')})(?:es|s)?(?![A-Za-z0-9_])`, 'gi');

// scope entries to lessons: "in" = only these lessons, "out" = never these (slug, or "prefix*")
const inList = (list, slug) => list.some((p) => (p.endsWith('*') ? slug.startsWith(p.slice(0, -1)) : p === slug));
function applies(e, lesson) {
  if (e.in && !(lesson && inList(e.in, lesson))) return false;
  if (e.out && lesson && inList(e.out, lesson)) return false;
  return true;
}
const exactCase = (e, word) => word === e.term || (e.aliases || []).includes(word);

// "cases" is the plural of "case", not of "cas": only add "es" after s, x, z, ch, sh
function stems(k) {
  const out = [k];
  if (k.endsWith('es') && /(s|x|z|ch|sh)$/.test(k.slice(0, -2))) out.push(k.slice(0, -2));
  if (k.endsWith('s')) out.push(k.slice(0, -1));
  return out;
}

export function lookup(matched, lesson) {
  const k = matched.toLowerCase();
  for (const stem of stems(k)) {
    const list = byWord.get(stem);
    if (!list) continue;
    const word = matched.slice(0, stem.length);
    const hit = list.find((e) => applies(e, lesson) && (!e.cs || exactCase(e, word)) && (stem === k || !e.np));
    if (hit) return hit;
  }
  return undefined;
}

/** Split a string into plain text parts and glossary hits (for the given lesson slug). */
export function splitByGlossary(text, lesson) {
  const parts = [];
  let last = 0;
  TERM_RE.lastIndex = 0;
  let m;
  while ((m = TERM_RE.exec(text))) {
    const entry = lookup(m[0], lesson);
    if (!entry) continue;
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: m[0], entry });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** rehype plugin: wrap glossary words in <span data-term="id">. Skips fenced code and links. */
export function rehypeGlossary({ lesson } = {}) {
  return (tree) => {
    // per rendered block of markdown: only the first use of each term is a keyboard tab stop,
    // so keyboard users are not forced through hundreds of focusable words
    const seen = new Set();
    visit(tree, seen, lesson);
  };
}

function visit(node, seen, lesson) {
  if (!node.children) return;
  if (node.type === 'element' && ['pre', 'a', 'script', 'style'].includes(node.tagName)) return;
  const out = [];
  for (const child of node.children) {
    if (child.type === 'text') {
      // heading id markers such as "{#trail-gc}" must stay literal text for the Heading renderer
      const pieces = child.value.split(/(\{#[a-z0-9-]+\})/).flatMap((seg) => (/^\{#[a-z0-9-]+\}$/.test(seg) ? [{ text: seg }] : splitByGlossary(seg, lesson)));
      for (const p of pieces) {
        if (!p.entry) {
          out.push({ type: 'text', value: p.text });
          continue;
        }
        const first = !seen.has(p.entry.id);
        seen.add(p.entry.id);
        out.push({
          type: 'element',
          tagName: 'span',
          properties: { dataTerm: p.entry.id, dataFirst: first ? 'yes' : 'no' },
          children: [{ type: 'text', value: p.text }],
        });
      }
    } else {
      visit(child, seen, lesson);
      out.push(child);
    }
  }
  node.children = out;
}
