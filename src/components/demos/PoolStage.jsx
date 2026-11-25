// Memory picture for the string pool scene: variables on the left, the heap on the right with the string pool
// drawn as a dashed region holding one copy of each literal, objects made with `new` outside it, and arrows
// from each variable to the object it points to.
//
// Frame: { line, vars: [{ n, to }], pool: [{ id, text }], heap: [{ id, text }], focus: ['a', 'c'],
//          result: { text, tone }, note }

const W = 640;
const H = 322; // room under the heap cards for an arrow that enters from below
const VAR = { x: 24, y0: 58, step: 46, w: 146, h: 34 };
const POOL = { x: 246, y: 46, w: 368, h: 140, colX: [262, 380, 498], rowY: [82, 134], cw: 104, ch: 38 };
const HEAP = { y: 236, colX: [262, 380, 498], cw: 104, ch: 38 };
const HEAD = 10; // arrowhead length
const TONE = {
  ok: 'var(--color-ok)',
  bad: 'var(--color-bad)',
  warn: 'var(--color-warn)',
  new: 'var(--color-pen)',
};

const poolPos = (i) => ({ x: POOL.colX[i % 3], y: POOL.rowY[Math.floor(i / 3)] });
const heapPos = (i) => ({ x: HEAP.colX[i % 3], y: HEAP.y });

export function PoolStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { vars: [], pool: [], heap: [] };
  const seen = (list, id) => list.some((x) => x.id === id);
  const focus = new Set(f.focus || []);
  const hasFocus = focus.size > 0;

  // where each object sits, so arrows can find it
  const at = {};
  f.pool.forEach((o, i) => (at[o.id] = { ...poolPos(i), inPool: true, below: false }));
  f.heap.forEach((o, i) => (at[o.id] = { ...heapPos(i), inPool: false, below: i > 0 })); // later heap objects are reached from below
  const targets = new Set(f.vars.filter((v) => !hasFocus || focus.has(v.n)).map((v) => v.to));

  return (
    <div className="g-stage pool-stage">
      <div className="pool-bar">
        <code className="pool-line">{f.line}</code>
        {f.result && (
          <span className="pool-result" style={{ background: TONE[f.result.tone] || TONE.new }}>
            {f.result.text}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          {Object.entries(TONE).map(([k, c]) => (
            // fixed size (not scaled by stroke width); the line stops at the head's base, the tip touches the card
            <marker key={k} id={`pool-arrow-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0 1L10 5L0 9z" fill={c} />
            </marker>
          ))}
        </defs>

        {/* stack: the variables */}
        <rect x="12" y="12" width="182" height={H - 24} rx="10" className="pool-panel" />
        <text x="24" y="36" className="pool-panel-title">Stack: variables</text>
        {f.vars.map((v, i) => {
          const y = VAR.y0 + i * VAR.step;
          const isNew = !prev.vars.some((p) => p.n === v.n);
          const dim = hasFocus && !focus.has(v.n);
          return (
            <g key={v.n} className={isNew ? 'g-pop' : ''} opacity={dim ? 0.35 : 1}>
              <rect x={VAR.x} y={y} width={VAR.w} height={VAR.h} rx="6" className={`pool-var ${focus.has(v.n) ? 'is-focus' : ''}`} />
              <text x={VAR.x + 12} y={y + 22} className="pool-var-text">String {v.n}</text>
              <circle cx={VAR.x + VAR.w} cy={y + VAR.h / 2} r="4" className="pool-dot" />
            </g>
          );
        })}

        {/* heap with the string pool inside it */}
        <rect x="232" y="12" width="396" height={H - 24} rx="10" className="pool-panel" />
        <text x="246" y="36" className="pool-panel-title">Heap</text>
        <rect x={POOL.x} y={POOL.y} width={POOL.w} height={POOL.h} rx="8" className="pool-region" />
        <text x={POOL.x + 14} y={POOL.y + 22} className="pool-region-title">String pool: one copy of each literal</text>
        {f.pool.map((o, i) => {
          const p = poolPos(i);
          const isNew = !seen(prev.pool, o.id);
          const hit = targets.has(o.id) && f.vars.some((v) => v.to === o.id);
          return (
            <g key={o.id} className={isNew ? 'g-pop' : ''}>
              <rect x={p.x} y={p.y} width={POOL.cw} height={POOL.ch} rx="6" className={`pool-obj in-pool ${hit ? 'is-hit' : ''}`} />
              <text x={p.x + POOL.cw / 2} y={p.y + 24} textAnchor="middle" className="pool-obj-text">{o.text}</text>
            </g>
          );
        })}

        <text x={POOL.x + 14} y={HEAP.y - 12} className="pool-region-title">Made with new: outside the pool</text>
        {f.heap.length === 0 && (
          <text x={POOL.x + 14} y={HEAP.y + 24} className="pool-empty">(none yet)</text>
        )}
        {f.heap.map((o, i) => {
          const p = heapPos(i);
          const isNew = !seen(prev.heap, o.id);
          const hit = targets.has(o.id) && f.vars.some((v) => v.to === o.id);
          return (
            <g key={o.id} className={isNew ? 'g-pop' : ''}>
              <rect x={p.x} y={p.y} width={HEAP.cw} height={HEAP.ch} rx="6" className={`pool-obj in-heap ${hit ? 'is-hit' : ''}`} />
              <text x={p.x + HEAP.cw / 2} y={p.y + 24} textAnchor="middle" className="pool-obj-text">{o.text}</text>
            </g>
          );
        })}

        {/* arrows: variable to the object it points to */}
        {f.vars.map((v, i) => {
          const t = at[v.to];
          if (!t) return null;
          const y1 = VAR.y0 + i * VAR.step + VAR.h / 2;
          const x1 = VAR.x + VAR.w + 4;
          // most arrows enter an object from the left; a second heap object is entered from below, so the
          // arrow passes under the first one instead of through it
          // the path ends one head-length short of the card, so the head fills the gap
          const x2 = t.below ? t.x + HEAP.cw / 2 : t.x - 1 - HEAD;
          const y2 = t.below ? t.y + HEAP.ch + 1 + HEAD : t.y + POOL.ch / 2;
          const d = t.below
            ? `M${x1} ${y1} C${x1 + 60} ${H - 18} ${x2} ${H - 18} ${x2} ${y2}`
            : `M${x1} ${y1} C${x1 + 50} ${y1} ${x2 - 50} ${y2} ${x2} ${y2}`;
          const tone = t.inPool ? 'ok' : 'warn';
          const before = prev.vars.find((p) => p.n === v.n);
          const isNew = !before || before.to !== v.to;
          const dim = hasFocus && !focus.has(v.n);
          return (
            <g key={`${v.n}-${v.to}`} className={`g-edge ${isNew ? 'is-new' : ''}`} opacity={dim ? 0.2 : 1}>
              <path
                d={d}
                pathLength="1"
                className="g-edge-line"
                stroke={TONE[tone]}
                strokeWidth={focus.has(v.n) ? 2.75 : 2}
                fill="none"
                markerEnd={`url(#pool-arrow-${tone})`}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
