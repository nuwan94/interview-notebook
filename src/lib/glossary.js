import raw from '../../content/glossary.json';
import { slugify } from './content.js';

// Every glossary entry becomes a dotted-underline tooltip wherever its term (or an alias) appears in lesson prose.
export const glossary = raw
  .map((e) => ({ ...e, id: slugify(e.term) }))
  .sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }));

export const byId = new Map(glossary.map((e) => [e.id, e]));
const byWord = new Map();
for (const e of glossary) {
  byWord.set(e.term.toLowerCase(), e);
  for (const a of e.aliases || []) byWord.set(a.toLowerCase(), e);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alternatives = [...byWord.keys()].sort((a, b) => b.length - a.length).map(esc);
// longest term first; optional plural suffix; no letter/digit directly before or after
const TERM_RE = new RegExp(`(?<![A-Za-z0-9_])(?:${alternatives.join('|')})(?:es|s)?(?![A-Za-z0-9_])`, 'gi');

export function lookup(matched) {
  const k = matched.toLowerCase();
  return byWord.get(k) || byWord.get(k.replace(/es$/, '')) || byWord.get(k.replace(/s$/, ''));
}

/** Split a string into plain text parts and glossary hits. */
export function splitByGlossary(text) {
  const parts = [];
  let last = 0;
  TERM_RE.lastIndex = 0;
  let m;
  while ((m = TERM_RE.exec(text))) {
    const entry = lookup(m[0]);
    if (!entry) continue;
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: m[0], entry });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** rehype plugin: wrap glossary words in <span data-term="id">. Skips fenced code and links. */
export function rehypeGlossary() {
  return (tree) => {
    // per rendered block of markdown: only the first use of each term is a keyboard tab stop,
    // so keyboard users are not forced through hundreds of focusable words
    const seen = new Set();
    visit(tree, seen);
  };
}

function visit(node, seen) {
  if (!node.children) return;
  if (node.type === 'element' && ['pre', 'a', 'script', 'style'].includes(node.tagName)) return;
  const out = [];
  for (const child of node.children) {
    if (child.type === 'text') {
      // heading id markers such as "{#trail-gc}" must stay literal text for the Heading renderer
      const pieces = child.value.split(/(\{#[a-z0-9-]+\})/).flatMap((seg) => (/^\{#[a-z0-9-]+\}$/.test(seg) ? [{ text: seg }] : splitByGlossary(seg)));
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
      visit(child, seen);
      out.push(child);
    }
  }
  node.children = out;
}
