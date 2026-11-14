// Auto layout for one animation frame: nodes (box titles) and arrows (deps). No library: layered layout in a few steps.
//   1. rank: longest path from the sources, ignoring edges that would close a cycle
//   2. order: within a rank, by the average position of the nodes feeding it (fewer crossings), ties by box order
//   3. coordinates: ranks left to right ('LR') or top to bottom ('TB'); frames with no arrows become a tidy grid

const BASE = { LR: { along: 210, across: 130 }, TB: { along: 190, across: 150 } };
// room around the outermost node centres: icon, badge and label above/below, label width left/right
const PAD = { LR: { x: 110, top: 60, bottom: 120 }, TB: { x: 90, top: 60, bottom: 100 } };

/** Estimated drawn size of a node (icon, badge, wrapped title and detail lines), matching GraphStage. */
export function nodeSize(b) {
  const tl = wrap(b.title, 17, 2);
  const sl = (b.lines || []).flatMap((l) => wrap(l, 22, 2)).slice(0, 4);
  const w = Math.max(70, ...tl.map((x) => x.length * 8.7), ...sl.map((x) => x.length * 7.2));
  const top = 30 + (b.badge ? 20 : 0);
  const bottom = 30 + 19 + 15 * (tl.length - 1) + 16 + 13 * Math.max(0, sl.length - 1) + 4;
  return { w, top, bottom, h: top + bottom };
}

/** Gaps between node centres for a scene: never less than the widest/tallest node needs. */
function gapsFor(frames, dir) {
  const sizes = frames.flatMap((f) => f.boxes.map(nodeSize));
  const W = Math.max(70, ...sizes.map((s) => s.w));
  const H = Math.max(90, ...sizes.map((s) => s.h));
  const g = BASE[dir];
  return dir === 'LR'
    ? { along: Math.max(g.along, W + 44), across: Math.max(g.across, H + 16) }
    : { along: Math.max(g.along, H + 36), across: Math.max(g.across, W + 18) };
}

/** Positions of one frame's nodes around (0, 0): { pos: Map(title -> {x, y}), minX, maxX, minY, maxY }. */
export function layoutFrame(boxes, deps, dir, gaps) {
  const titles = boxes.map((b) => b.title);
  const has = new Set(titles);
  const edges = [];
  const seen = new Set();
  for (const d of deps) {
    const key = `${d.from}>${d.to}`;
    if (d.from === d.to || !has.has(d.from) || !has.has(d.to) || seen.has(key)) continue;
    seen.add(key);
    edges.push([d.from, d.to]);
  }
  const g = gaps || BASE[dir];
  const pos = new Map();

  if (!edges.length) {
    // no arrows: a grid, at most four across (two on a narrow screen)
    const n = titles.length;
    const cols = dir === 'TB' ? Math.min(n, 2) : n <= 4 ? n : Math.ceil(n / 2);
    titles.forEach((t, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const inRow = Math.min(cols, n - r * cols);
      pos.set(t, { x: (c - (inRow - 1) / 2) * g.along, y: r * g.across });
    });
  } else {
    // 1. ranks (depth-first, skipping back edges so cycles cannot loop forever)
    const out = new Map(titles.map((t) => [t, []]));
    for (const [a, b] of edges) out.get(a).push(b);
    const state = new Map(); // 1 = on the stack, 2 = done
    const forward = [];
    const dfs = (u) => {
      state.set(u, 1);
      for (const v of out.get(u)) {
        if (state.get(v) === 1) continue; // back edge
        forward.push([u, v]);
        if (!state.get(v)) dfs(v);
      }
      state.set(u, 2);
    };
    titles.forEach((t) => !state.get(t) && dfs(t));
    const rank = new Map(titles.map((t) => [t, 0]));
    for (let pass = 0; pass < titles.length; pass++) {
      let changed = false;
      for (const [u, v] of forward) {
        if (rank.get(v) < rank.get(u) + 1) {
          rank.set(v, rank.get(u) + 1);
          changed = true;
        }
      }
      if (!changed) break;
    }
    // 2. order inside each rank
    const maxRank = Math.max(...rank.values());
    const rows = Array.from({ length: maxRank + 1 }, () => []);
    titles.forEach((t) => rows[rank.get(t)].push(t));
    const index = new Map();
    rows.forEach((r) => r.forEach((t, i) => index.set(t, i)));
    for (let r = 1; r <= maxRank; r++) {
      const score = (t) => {
        const feeders = forward.filter(([, v]) => v === t).map(([u]) => index.get(u));
        return feeders.length ? feeders.reduce((s, x) => s + x, 0) / feeders.length : index.get(t);
      };
      const orig = new Map(rows[r].map((t, i) => [t, i]));
      rows[r].sort((a, b) => score(a) - score(b) || orig.get(a) - orig.get(b));
      rows[r].forEach((t, i) => index.set(t, i));
    }
    // 3. coordinates
    rows.forEach((row, r) =>
      row.forEach((t, i) => {
        const across = (i - (row.length - 1) / 2) * g.across;
        pos.set(t, dir === 'LR' ? { x: r * g.along, y: across } : { x: (i - (row.length - 1) / 2) * g.across, y: r * g.along });
      }),
    );
  }

  if (!pos.size) pos.set("", { x: 0, y: 0 });
  const xs = [...pos.values()].map((p) => p.x);
  const ys = [...pos.values()].map((p) => p.y);
  return { pos, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/**
 * Layout every frame of a scene on one fixed-size canvas, so the picture never jumps in size between steps.
 * Returns { width, height, frames: Map(title -> {x, y})[] } with each frame centred on the canvas.
 */
export function layoutScene(frames, dir) {
  const gaps = gapsFor(frames, dir);
  const raw = frames.map((f) => layoutFrame(f.boxes, f.deps || [], dir, gaps));
  const pad = PAD[dir];
  const spanX = Math.max(...raw.map((r) => r.maxX - r.minX));
  const spanY = Math.max(...raw.map((r) => r.maxY - r.minY));
  const width = Math.max(dir === "TB" ? 300 : 420, spanX + pad.x * 2);
  const height = spanY + pad.top + pad.bottom;
  const placed = raw.map((r) => {
    const cx = (r.minX + r.maxX) / 2;
    const cy = (r.minY + r.maxY) / 2;
    const out = new Map();
    for (const [t, p] of r.pos) out.set(t, { x: width / 2 + (p.x - cx), y: pad.top + spanY / 2 + (p.y - cy) });
    return out;
  });
  return { width, height, frames: placed };
}

/** Wrap text on spaces to lines of at most `max` characters (long words are cut), at most `lines` lines. */
export function wrap(text, max, lines = 3) {
  const out = [];
  let cur = '';
  for (let w of String(text).split(/\s+/)) {
    while (w.length > max) {
      if (cur) {
        out.push(cur);
        cur = '';
      }
      out.push(w.slice(0, max));
      w = w.slice(max);
    }
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= max) cur += ' ' + w;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  if (out.length > lines) {
    const kept = out.slice(0, lines);
    kept[lines - 1] = kept[lines - 1].replace(/.{0,1}$/, '…');
    return kept;
  }
  return out;
}
