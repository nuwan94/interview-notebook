import './GcHeapStage.css';

// Heap picture for the young-collection scene: the young generation (eden and two survivor spaces) on top,
// the old generation below, each as a row of memory slots. Objects are lettered cells with their age.
// Copy and promote steps draw an arrow: arcs over the boxes between young spaces, a straight drop into old.
//
// Frame: { phase: { text, tone }, regions: { eden: [cell], s0: [cell], s1: [cell], old: [cell] },
//          moves: [{ from, to, label }], note }   cell: { id, state: new | live | marked | dead, age }

const W = 640;
const H = 404;
const HEAD = 10;
const CELL = 40;
const PITCH = 48;
const TONE = { ok: 'var(--color-ok)', bad: 'var(--color-bad)', warn: 'var(--color-warn)', new: 'var(--color-pen)' };

// each space: its box, and how many columns and rows of slots it has
const SPACES = {
  eden: { x: 28, y: 100, cols: 4, rows: 2, title: 'Eden', sub: 'new objects' },
  s0: { x: 264, y: 100, cols: 3, rows: 2, title: 'Survivor 0', sub: '' },
  s1: { x: 452, y: 100, cols: 3, rows: 2, title: 'Survivor 1', sub: '' },
  old: { x: 28, y: 282, cols: 12, rows: 1, title: 'Promoted objects', sub: '' },
};
const boxW = (s) => s.cols * PITCH - (PITCH - CELL) + 24;
const boxH = (s) => s.rows * PITCH - (PITCH - CELL) + 38;
const slot = (s, i) => ({ x: s.x + 12 + (i % s.cols) * PITCH, y: s.y + 28 + Math.floor(i / s.cols) * PITCH });

const LEGEND = [
  ['new', 'just created'],
  ['live', 'in use'],
  ['marked', 'found reachable'],
  ['dead', 'garbage'],
];

function Cell({ c, x, y, isNew }) {
  return (
    <g className={isNew ? 'g-pop' : ''}>
      <rect x={x} y={y} width={CELL} height={CELL} rx="6" className={`gch-cell is-${c.state || 'live'}`} />
      <text x={x + CELL / 2} y={y + 26} textAnchor="middle" className={`gch-cell-text is-${c.state || 'live'}`}>{c.id}</text>
      {c.age != null && (
        <g>
          <circle cx={x + CELL - 2} cy={y + 2} r="8.5" className="gch-age" />
          <text x={x + CELL - 2} y={y + 6} textAnchor="middle" className="gch-age-text">{c.age}</text>
        </g>
      )}
    </g>
  );
}

/** The path of one move arrow, ending one head-length before the target box. */
function movePath(from, to) {
  const a = SPACES[from];
  const b = SPACES[to];
  if (to === 'old') {
    const x = a.x + boxW(a) / 2;
    return `M${x} ${a.y + boxH(a) + 2} L${x} ${b.y - 1 - HEAD}`;
  }
  // an arc over the boxes; a longer jump arcs higher and lands further right, so arcs nest without crossing
  const leftToRight = b.x > a.x;
  const far = Math.abs(b.x - a.x) > 300;
  const x1 = a.x + boxW(a) * (leftToRight ? 0.5 : 0.35);
  const x2 = b.x + boxW(b) * (leftToRight ? (far ? 0.7 : 0.3) : 0.65);
  const top = far ? 50 : 66;
  return `M${x1} ${a.y - 2} C${x1} ${top} ${x2} ${top} ${x2} ${b.y - 1 - HEAD}`;
}

function labelAt(from, to) {
  const a = SPACES[from];
  const b = SPACES[to];
  if (to === 'old') return { x: a.x + boxW(a) / 2 + 10, y: (a.y + boxH(a) + b.y) / 2 + 4, anchor: 'start' };
  const far = Math.abs(b.x - a.x) > 300;
  return { x: (a.x + boxW(a) / 2 + b.x + boxW(b) / 2) / 2, y: far ? 56 : 68, anchor: 'middle' };
}

export function GcHeapStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { regions: {} };
  const seenBefore = (space, id) => (prev.regions[space] || []).some((c) => c.id === id);
  const active = new Set((f.moves || []).flatMap((m) => [m.from, m.to]));

  return (
    <div className="g-stage gch-stage">
      {f.phase && (
        <div className="gch-bar">
          <span className="gch-phase" style={{ background: TONE[f.phase.tone] || TONE.new }}>{f.phase.text}</span>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="gch-arrow" viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0 1L10 5L0 9z" fill="var(--color-pen)" />
          </marker>
        </defs>

        <rect x="12" y="12" width={W - 24} height="224" rx="10" className="gch-gen" />
        <text x="26" y="36" className="gch-gen-title">Young generation: collected often</text>
        <rect x="12" y="250" width={W - 24} height="120" rx="10" className="gch-gen" />
        <text x="26" y="272" className="gch-gen-title">Old generation: collected rarely</text>

        {Object.entries(SPACES).map(([key, s]) => {
          const cells = f.regions[key] || [];
          return (
            <g key={key} className={active.size && !active.has(key) ? 'gch-quiet' : ''}>
              <rect x={s.x} y={s.y} width={boxW(s)} height={boxH(s)} rx="8" className={`gch-space ${active.has(key) ? 'is-active' : ''}`} />
              <text x={s.x + 12} y={s.y + 18} className="gch-space-title">
                {s.title}
                {s.sub && <tspan className="gch-space-sub">{`  ${s.sub}`}</tspan>}
              </text>
              {Array.from({ length: s.cols * s.rows }, (_, i) => {
                const p = slot(s, i);
                const c = cells[i];
                return c ? (
                  <Cell key={c.id} c={c} x={p.x} y={p.y} isNew={!seenBefore(key, c.id)} />
                ) : (
                  <rect key={`free-${i}`} x={p.x} y={p.y} width={CELL} height={CELL} rx="6" className="gch-free" />
                );
              })}
            </g>
          );
        })}

        {(f.moves || []).map((m) => {
          const l = labelAt(m.from, m.to);
          return (
            <g key={`${m.from}-${m.to}`} className="g-edge is-new">
              <path d={movePath(m.from, m.to)} pathLength="1" className="g-edge-line" stroke="var(--color-pen)" strokeWidth="2.5" fill="none" markerEnd="url(#gch-arrow)" />
              <text x={l.x} y={l.y} textAnchor={l.anchor} className="g-edge-label" fill="var(--color-pen)">{m.label}</text>
            </g>
          );
        })}

        {LEGEND.map(([state, text], i) => (
          <g key={state} transform={`translate(${24 + i * 125} 392)`}>
            <rect x="0" y="-12" width="16" height="16" rx="3" className={`gch-cell is-${state}`} />
            <text x="22" y="1" className="gch-legend">{text}</text>
          </g>
        ))}
        <circle cx="610" cy="388" r="8" className="gch-age" />
        <text x="610" y="392" textAnchor="middle" className="gch-age-text">2</text>
        <text x="596" y="392" textAnchor="end" className="gch-legend">small number = age</text>
      </svg>
    </div>
  );
}
