import './LockStage.css';

// Deadlock picture: two threads and two account locks placed on a ring, so a wait-for cycle runs around the
// edge and no arrow crosses another: transfer-1 (top left) -> lock B (top right) -> transfer-2 (bottom right)
// -> lock A (bottom left) -> transfer-1. "held by" arrows go from a lock to its owner, "waits for" arrows go
// from a thread to the lock it wants. A thread-dump excerpt sits under the ring.
//
// Frame: { nodes: { t1, t2, a, b: { sub, tone } }, edges: [{ from, to, label, tone }], center: { text, tone },
//          report: [lines], note }

const W = 640;
const H = 396;
const HEAD = 10;
const BOX = { w: 200, h: 58 };
const NODES = {
  t1: { x: 60, y: 24, title: 'Thread transfer-1' },
  b: { x: 380, y: 24, title: 'Account B lock' },
  t2: { x: 380, y: 186, title: 'Thread transfer-2' },
  a: { x: 60, y: 186, title: 'Account A lock' },
};
const TONE = { ok: 'var(--color-ok)', bad: 'var(--color-bad)', warn: 'var(--color-warn)', new: 'var(--color-pen)', none: '#556070' };

// each ring edge: the straight path between two neighbours, and where its label goes
function route(from, to) {
  const a = NODES[from];
  const b = NODES[to];
  if (a.y === b.y) {
    // along the top or the bottom
    const y = a.y + BOX.h / 2;
    const ltr = b.x > a.x;
    const x1 = ltr ? a.x + BOX.w : a.x;
    const x2 = ltr ? b.x - 1 - HEAD : b.x + BOX.w + 1 + HEAD;
    return { d: `M${x1} ${y} L${x2} ${y}`, lx: (x1 + x2) / 2, ly: y - 10, anchor: 'middle' };
  }
  // down the right side or up the left side
  const x = a.x + BOX.w / 2;
  const down = b.y > a.y;
  const y1 = down ? a.y + BOX.h : a.y;
  const y2 = down ? b.y - 1 - HEAD : b.y + BOX.h + 1 + HEAD;
  return { d: `M${x} ${y1} L${x} ${y2}`, lx: x + 10, ly: (y1 + y2) / 2 + 4, anchor: 'start' };
}

export function LockStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { edges: [] };
  const had = (e) => prev.edges.some((p) => p.from === e.from && p.to === e.to && p.label === e.label);

  return (
    <div className="g-stage lock-stage">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          {Object.entries(TONE).map(([k, c]) => (
            <marker key={k} id={`lock-arrow-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0 1L10 5L0 9z" fill={c} />
            </marker>
          ))}
        </defs>

        {Object.entries(NODES).map(([id, n]) => {
          const s = f.nodes[id] || {};
          const isLock = id === 'a' || id === 'b';
          return (
            <g key={id}>
              <rect x={n.x} y={n.y} width={BOX.w} height={BOX.h} rx={isLock ? 6 : 12} className={`lock-node tone-${s.tone || 'none'} ${isLock ? 'is-lock' : ''}`} />
              <text x={n.x + 14} y={n.y + 23} className="lock-title">{n.title}</text>
              <text x={n.x + 14} y={n.y + 43} className="lock-sub">{s.sub || ''}</text>
            </g>
          );
        })}

        {f.edges.map((e) => {
          const r = route(e.from, e.to);
          const tone = e.tone || 'none';
          return (
            <g key={`${e.from}-${e.to}-${e.label}`} className={`g-edge ${had(e) ? '' : 'is-new'}`}>
              <path d={r.d} pathLength="1" className="g-edge-line" stroke={TONE[tone]} strokeWidth="2.5" fill="none" markerEnd={`url(#lock-arrow-${tone})`} />
              <text x={r.lx} y={r.ly} textAnchor={r.anchor} className="g-edge-label" fill={TONE[tone]}>{e.label}</text>
            </g>
          );
        })}

        {f.center && (
          <text key={f.center.text} x="320" y="158" textAnchor="middle" className="lock-center g-pop" fill={TONE[f.center.tone] || TONE.none}>
            {f.center.text}
          </text>
        )}

        {f.report && (
          <g className="g-pop">
            <rect x="24" y="268" width={W - 48} height="114" rx="8" className="lock-report" />
            {f.report.map((ln, i) => (
              <text key={i} x="36" y={290 + i * 19} className={`lock-report-text ${i === 0 ? 'is-head' : ''}`}>{ln}</text>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
