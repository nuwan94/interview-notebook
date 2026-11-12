// Loads lessons from /content/lessons/*.md at build time and splits them into
// intro / sections / interview questions so the UI can navigate and search them.

const files = import.meta.glob('../../content/lessons/*.md', { query: '?raw', import: 'default', eager: true });

export const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function parseFrontMatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      v = v
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else v = v.replace(/^["']|["']$/g, '');
    meta[kv[1]] = v;
  }
  return { meta, body: src.slice(m[0].length) };
}

export const plainText = (md) =>
  md
    .replace(/```[\s\S]*?```/g, (b) => b.replace(/```\w*/g, ' '))
    .replace(/[`*_>#|]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

const H2 = /^##\s+(.+?)\s*(?:\{#([a-z0-9-]+)\})?\s*$/;
const H3Q = /^###\s+\[(\w+)\]\s+(.+?)\s*(?:\{#([a-z0-9-]+)\})?\s*$/;

function splitLines(body, re, onMatch) {
  // yields chunks split at headings that are not inside fenced code
  const chunks = [];
  let cur = { head: null, lines: [] };
  let fence = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^```/.test(line)) fence = !fence;
    const m = !fence && line.match(re);
    if (m) {
      chunks.push(cur);
      cur = { head: onMatch(m), lines: [] };
    } else cur.lines.push(line);
  }
  chunks.push(cur);
  return chunks.map((c) => ({ ...c, md: c.lines.join('\n').trim() }));
}

const H3 = /^###\s+(.+?)\s*(?:\{#([a-z0-9-]+)\})?\s*$/;

/** Split a section into its lead-in text and its ### sub-sections (each gets a stable id for links and search). */
function parseSubs(md) {
  const chunks = splitLines(md, H3, (m) => ({ title: m[1], id: m[2] || slugify(m[1]) }));
  return { lead: chunks[0].md, subs: chunks.slice(1).map((c) => ({ ...c.head, md: c.md })) };
}

function parseLesson(path, src) {
  const { meta, body } = parseFrontMatter(src);
  const slug = meta.slug || path.split('/').pop().replace(/\.md$/, '');
  const chunks = splitLines(body, H2, (m) => ({ title: m[1], id: m[2] || slugify(m[1]) }));
  const intro = chunks[0].md;
  const sections = [];
  let questions = [];
  for (const c of chunks.slice(1)) {
    if (c.head.id === 'questions') {
      const qs = splitLines(c.md, H3Q, (m) => ({ level: m[1].toLowerCase(), title: m[2], id: m[3] || slugify(m[2]) }));
      questions = qs
        .slice(1)
        .map((q) => ({ ...q.head, id: `q-${q.head.id}`, md: q.md }))
        .filter((q) => q.title);
      sections.push({ ...c.head, md: qs[0].md, isQuestions: true });
    } else sections.push({ ...c.head, md: c.md, ...parseSubs(c.md) });
  }
  return {
    slug,
    title: meta.title || slug,
    summary: meta.summary || '',
    tags: meta.tags || [],
    order: Number(meta.order || 99),
    updated: meta.updated || '',
    // "Java / Collections" -> ['Java', 'Collections']: where the lesson sits in the topic tree
    topic: (meta.topic || '').split('/').map((s) => s.trim()).filter(Boolean),
    subnav: meta.subnav === 'true', // list ### sub-sections under each section in the sidebar
    intro,
    sections,
    questions,
  };
}

export const lessons = Object.entries(files)
  .map(([p, src]) => parseLesson(p, src))
  .sort((a, b) => a.order - b.order);

export const getLesson = (slug) => lessons.find((l) => l.slug === slug);

/**
 * Nested topics built from each lesson's `topic:` front matter ("Java / Collections").
 * Node: { name, path, children: Node[], lessons: Lesson[] }. Lessons without a topic sit at the root.
 */
function buildTopicTree(list) {
  const root = { name: '', path: '', children: [], lessons: [] };
  for (const l of list) {
    let node = root;
    for (const name of l.topic) {
      const path = node.path ? `${node.path}/${name}` : name;
      let child = node.children.find((c) => c.name === name);
      if (!child) node.children.push((child = { name, path, children: [], lessons: [] }));
      node = child;
    }
    node.lessons.push(l);
  }
  return root;
}
export const topicTree = buildTopicTree(lessons);

export const topicLessonCount = (node) => node.lessons.length + node.children.reduce((n, c) => n + topicLessonCount(c), 0);
export const topicContains = (node, slug) => node.lessons.some((l) => l.slug === slug) || node.children.some((c) => topicContains(c, slug));

/**
 * Resolve a cross-lesson link written in Markdown as [text](lesson:slug#anchor).
 * Returns { to } when the lesson exists, or { pending: true } so links can be written before the target lesson is.
 */
export function resolveLessonLink(spec) {
  const [slug, anchor] = spec.split('#');
  const lesson = getLesson(slug);
  if (!lesson) return { pending: true, slug };
  return { to: `/lessons/${slug}${anchor ? `/${anchor}` : ''}` };
}

export const LEVELS = ['basic', 'intermediate', 'deep', 'coding'];
