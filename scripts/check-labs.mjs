// Validates every lab in src/labs: node kinds and positions, references to nodes that are on stage,
// metrics, learning goals, step kinds and text lengths. Run with `pnpm check:labs`.
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizeLab } from '../src/labs/normalize.js';
import { bendOf } from '../src/labs/route.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const labsDir = join(root, 'src', 'labs');
const kindSrc = readFileSync(join(root, 'src', 'components', 'lab', 'IsoScene.jsx'), 'utf8');
const KINDS = new Set([...kindSrc.matchAll(/^\s{2}(\w+):\s*\{\s*shape:/gm)].map((m) => m[1]));
const COLORS = new Set(['orange', 'green', 'blue', 'yellow', 'purple', 'teal', 'red']);
const STEP_KINDS = new Set(['setup', 'problem', 'technique', 'case', 'recap', 'try']);
const TONES = new Set(['ok', 'bad', 'warn', 'new', 'none']);
const FLOW_TONES = new Set(['req', 'res', 'bad', 'msg', 'data']);
const PILL_KINDS = new Set(['database', 'storage', 'cache', 'queue', 'users']);
const BOX_KINDS = new Set(['idea', 'tip', 'warn']);

// every topic path a lesson uses, so a lab lands in an existing sub-topic
const lessonsDir = join(root, 'content', 'lessons');
const lessonTopics = new Set(
  readdirSync(lessonsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => /^topic:\s*(.+)$/m.exec(readFileSync(join(lessonsDir, f), 'utf8'))?.[1].trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean),
);

let errors = 0;
let warnings = 0;
const files = readdirSync(labsDir).filter((f) => f.endsWith('.js') && f !== 'index.js' && f !== 'normalize.js' && f !== 'route.js');

for (const file of files) {
  const slug = file.slice(0, -3);
  const raw = (await import(pathToFileURL(join(labsDir, file)).href)).default;
  const lab = normalizeLab(raw);
  const err = (msg) => (errors++, console.log(`  ✗ ${slug}: ${msg}`));
  const warn = (msg) => (warnings++, console.log(`  ! ${slug}: ${msg}`));

  for (const key of ['title', 'topic', 'nodes', 'steps']) if (!lab[key]) err(`missing ${key}`);
  if (lab.topic && !lessonTopics.has(lab.topic)) err(`topic "${lab.topic}" has no lessons (known: a lesson's "topic:" front matter)`);
  if ((lab.nav ?? lab.title ?? '').length > 30) warn('sidebar name is long, add a short `nav`');
  if (!lab.nodes || !lab.steps) continue;
  if (lab.lesson && !readdirSync(join(root, 'content', 'lessons')).includes(`${lab.lesson}.md`)) err(`lesson ${lab.lesson} not found`);

  // nodes: known kind, a position, and no two close enough on screen for their labels to collide
  const screen = new Map();
  for (const [id, n] of Object.entries(lab.nodes)) {
    if (!KINDS.has(n.kind)) err(`node ${id}: unknown kind "${n.kind}" (known: ${[...KINDS].join(', ')})`);
    if (!Array.isArray(n.at) || !n.at.every(Number.isFinite)) err(`node ${id}: needs "col" and "row" (or "at": [gx, gy])`);
    else {
      const sx = (n.at[0] - n.at[1]) * 64;
      const sy = (n.at[0] + n.at[1]) * 32;
      screen.set(id, [sx, sy]);
    }
    if ((n.label ?? id).length > 16) warn(`node ${id}: label "${n.label ?? id}" is longer than 16 characters`);
    if (n.sub && n.sub.length > 22) warn(`node ${id}: sub "${n.sub}" is longer than 22 characters`);
  }

  const metricIds = new Set((lab.metrics ?? []).map((m) => m.id));
  const setMetrics = new Set();
  const learned = new Set();
  const clash = new Set();
  const onStage = new Set();
  const links = new Map();   // active links, so a line that runs through a third node can be reported
  const passed = new Set();
  const need = (id, where) => {
    if (!lab.nodes[id]) err(`${where}: unknown node "${id}"`);
    else if (!onStage.has(id)) err(`${where}: node "${id}" is not on stage`);
  };

  lab.steps.forEach((s, i) => {
    const at = `step ${i + 1}`;
    for (const id of s.hide ?? []) onStage.delete(id);
    for (const id of s.show ?? []) {
      if (!lab.nodes[id]) err(`${at} show: unknown node "${id}"`);
      onStage.add(id);
    }
    for (const [id, patch] of Object.entries(s.set ?? {})) {
      need(id, `${at} set`);
      if (patch?.color && !COLORS.has(patch.color)) err(`${at} set ${id}: unknown color ${patch.color}`);
    }
    for (const [from, to] of s.unlink ?? []) links.delete(`${from}>${to}`);
    for (const l of s.link ?? []) {
      const [from, to, opts] = Array.isArray(l) ? l : [l.from, l.to, l];
      links.set(`${from}>${to}`, [from, to]);
      need(from, `${at} link`);
      need(to, `${at} link`);
      if (opts && typeof opts === 'object' && opts.tone && !TONES.has(opts.tone)) err(`${at} link ${from}>${to}: unknown tone ${opts.tone}`);
    }
    for (const f of s.flows ?? []) {
      if (!Array.isArray(f.path) || f.path.length < 2) err(`${at} flow: path needs two or more nodes`);
      for (const id of f.path ?? []) need(id, `${at} flow`);
      if (f.tone && !FLOW_TONES.has(f.tone)) err(`${at} flow: unknown tone ${f.tone}`);
    }
    for (const n of s.notes ?? []) {
      need(n.at, `${at} note`);
      if (n.text.length > 34) warn(`${at} note "${n.text}" is long for the scene`);
    }
    for (const id of Object.keys(s.metrics ?? {})) {
      if (!metricIds.has(id)) err(`${at}: metric "${id}" is not declared in lab.metrics`);
      setMetrics.add(id);
    }
    for (const n of s.learns ?? []) {
      if (!lab.learn?.[n]) err(`${at}: learns ${n} is out of range`);
      learned.add(n);
    }
    if (!STEP_KINDS.has(s.kind)) err(`${at}: unknown kind "${s.kind}"`);
    if (!s.title) err(`${at}: missing title`);
    if (!s.text) err(`${at}: missing text`);
    if ((s.label ?? s.title ?? '').length > 16) warn(`${at}: timeline label "${s.label ?? s.title}" is long, add a short label`);
    const words = String(Array.isArray(s.text) ? s.text.join(' ') : s.text ?? '').split(/\s+/).length;
    if (words > 120) warn(`${at}: ${words} words of text, aim for 120 or fewer`);
    if (s.box && !BOX_KINDS.has(s.box.kind ?? 'idea')) err(`${at}: unknown box kind ${s.box.kind}`);
    if (s.table && !(s.table.rows ?? []).every((r) => Array.isArray(r) && r.length === 2)) err(`${at}: table rows must be [label, value]`);
    if (onStage.size === 0) err(`${at}: nothing on stage`);
    // a line should not run through a node that is neither of its ends
    const segs = [...links.values(), ...(s.flows ?? []).flatMap((f) => (f.path ?? []).slice(1).map((id, k) => [f.path[k], id]))];
    for (const [from, to] of segs) {
      if (!screen.has(from) || !screen.has(to) || !onStage.has(from) || !onStage.has(to)) continue;
      // the line follows the grid axes, with one bend unless the nodes sit on one axis (see src/labs/route.js)
      const others = [...onStage].filter((id) => id !== from && id !== to && lab.nodes[id]).map((id) => ({ at: lab.nodes[id].at, pill: PILL_KINDS.has(lab.nodes[id].kind) }));
      const bend = bendOf(lab.nodes[from].at, lab.nodes[to].at, others);
      const poly = [screen.get(from), ...(bend ? [[(bend[0] - bend[1]) * 64, (bend[0] + bend[1]) * 32]] : []), screen.get(to)];
      // is the point (cx, cy) inside the ellipse of half sizes (rx, ry) of any part of the line?
      const near = (cx, cy, rx, ry) => {
        for (let i = 1; i < poly.length; i++) {
          const [px, py] = poly[i - 1];
          const [qx, qy] = poly[i];
          const len2 = (qx - px) ** 2 + (qy - py) ** 2 || 1;
          const t = Math.max(0, Math.min(1, ((cx - px) * (qx - px) + (cy - py) * (qy - py)) / len2));
          const dx = (px + (qx - px) * t - cx) / rx;
          const dy = (py + (qy - py) * t - cy) / ry;
          if (dx * dx + dy * dy < 1) return true;
        }
        return false;
      };
      for (const id of onStage) {
        if (id === from || id === to || !screen.has(id)) continue;
        const [cx, cy] = screen.get(id);
        const key = `${from}>${to}|${id}`;
        if (near(cx, cy, 62, 44) && !passed.has(key)) {
          passed.add(key);
          warn(`${at}: the line ${from} > ${to} runs through ${id}`);
        }
        // cylinders, stacks and crowds print their name under the body
        if (PILL_KINDS.has(lab.nodes[id].kind) && near(cx, cy + 84, 72, 22) && !passed.has(`${key}|name`)) {
          passed.add(`${key}|name`);
          warn(`${at}: the line ${from} > ${to} crosses the name of ${id}`);
        }
      }
    }
    // nodes shown together must not sit on top of each other
    const ids = [...onStage].filter((id) => screen.has(id));
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const [ax, ay] = screen.get(ids[a]);
        const [bx, by] = screen.get(ids[b]);
        const key = `${ids[a]}|${ids[b]}`;
        if (Math.abs(ax - bx) < 150 && Math.abs(ay - by) < 110 && !clash.has(key)) {
          clash.add(key);
          err(`${at}: nodes ${ids[a]} and ${ids[b]} are too close on screen (use a different col or row)`);
        }
      }
    }
  });

  for (const id of metricIds) if (!setMetrics.has(id)) warn(`metric "${id}" is never set`);
  (lab.learn ?? []).forEach((item, n) => {
    if (!learned.has(n)) warn(`learning goal ${n} ("${item}") is only ticked by the recap`);
  });
  if (lab.steps.at(-1)?.kind !== 'recap') warn('the last step is not a recap');
  console.log(`  ${slug}: ${lab.steps.length} steps, ${Object.keys(lab.nodes).length} nodes`);
}

console.log(`${files.length} labs, ${errors} errors, ${warnings} warnings`);
process.exit(errors ? 1 : 0);
