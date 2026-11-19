// Turns a lab definition into the full state of every step.
//
// A lab is one fixed scene that changes step by step. Nodes, links, node settings and metrics
// are cumulative: once shown they stay until a later step hides or changes them. Flows (moving
// dots), notes and tables belong to one step only.

const linkKey = (from, to) => `${from}>${to}`;

/** Normalises a link written as [from, to, opts] or { from, to, ...opts }. */
function asLink(l) {
  if (Array.isArray(l)) {
    const [from, to, opts = {}] = l;
    return { from, to, ...(typeof opts === 'string' ? { label: opts } : opts) };
  }
  return l;
}

const metricText = (v) => (v && typeof v === 'object' ? v.v : v);

/**
 * @returns {Array<{ step, nodes, links, metrics, metricTone, learned, changes, changedMetrics, changedNodes, newLinks }>}
 */
export function buildStates(lab) {
  const states = [];
  const nodes = new Map();          // id -> { ...definition, ...set }
  const links = new Map();          // key -> link
  const metrics = {};               // id -> text
  const metricTone = {};            // id -> tone
  const learned = new Set();
  const label = (id) => lab.nodes[id]?.label ?? id;

  lab.steps.forEach((step, i) => {
    const changes = [];
    const changedNodes = new Set();
    const changedMetrics = new Set();
    const newLinks = new Set();

    for (const id of step.hide ?? []) {
      if (nodes.delete(id)) changes.push({ sign: '-', text: label(id) });
      for (const k of [...links.keys()]) {
        const l = links.get(k);
        if (l.from === id || l.to === id) links.delete(k);
      }
    }
    for (const id of step.show ?? []) {
      if (!nodes.has(id)) {
        nodes.set(id, { id, ...lab.nodes[id] });
        changedNodes.add(id);
        changes.push({ sign: '+', text: label(id) });
      }
    }
    for (const [id, patch] of Object.entries(step.set ?? {})) {
      const cur = nodes.get(id) ?? { id, ...lab.nodes[id] };
      const next = { ...cur, ...patch };
      for (const k of Object.keys(patch)) if (patch[k] === null) delete next[k];   // null clears a setting
      nodes.set(id, next);
      changedNodes.add(id);
      if (patch.badge) changes.push({ sign: '~', text: `${label(id)}: ${patch.badge}` });
    }
    for (const pair of step.unlink ?? []) links.delete(linkKey(pair[0], pair[1]));
    for (const raw of step.link ?? []) {
      const l = asLink(raw);
      const k = linkKey(l.from, l.to);
      const prev = links.get(k);
      links.set(k, { ...l, key: k });   // re-linking replaces the link's label and style
      if (!prev || prev.label !== l.label || prev.tone !== l.tone) newLinks.add(k);
    }
    for (const [id, v] of Object.entries(step.metrics ?? {})) {
      const text = metricText(v);
      const before = metrics[id];
      const blank = (x) => x === undefined || x === '-' || x === '—';
      if (before !== text && !(before === undefined && blank(text))) {
        changedMetrics.add(id);
        const name = lab.metrics?.find((m) => m.id === id)?.label ?? id;
        changes.push(blank(before) ? { sign: '+', text: `${name}: ${text}` } : { sign: '~', text: `${name}: ${before} → ${text}` });
      }
      metrics[id] = text;
      if (v && typeof v === 'object' && v.tone) metricTone[id] = v.tone;
      else delete metricTone[id];
    }
    for (const n of step.learns ?? []) learned.add(n);
    if (i === lab.steps.length - 1) (lab.learn ?? []).forEach((_, n) => learned.add(n));   // the recap ticks everything

    states.push({
      step,
      nodes: [...nodes.values()],
      links: [...links.values()],
      metrics: { ...metrics },
      metricTone: { ...metricTone },
      learned: new Set(learned),
      changes: step.changes ? step.changes.map((t) => (typeof t === 'string' ? { sign: '~', text: t } : t)) : changes,
      changedNodes,
      changedMetrics,
      newLinks,
    });
  });
  return states;
}

/** Every node that appears in any step, used to fix the scene size so the layout never jumps. */
export function allPlacedNodes(lab) {
  return Object.entries(lab.nodes).map(([id, n]) => ({ id, ...n }));
}
