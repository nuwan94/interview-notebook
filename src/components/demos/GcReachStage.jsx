import './GcReachStage.css';

// Reachability picture: GC roots on the left (a stack variable and a static field), heap objects on the right
// in rows, with an arrow for every reference. Each row is one chain, so no arrow crosses another card.
// X and Y point at each other (a cycle) but no root reaches them.
//
// Frame: { phase: { text, tone }, roots: [{ id, name, kind, to }], cells: [{ id, refs: [id], state }], note }
// cell state: live | marked | dead. A cell missing from a frame has been freed.

const W = 640;
const H = 300;
const HEAD = 10;
const CW = 64; // object card size
const CH = 40;
const ROWS = { A: 0, B: 0, C: 0, D: 1, E: 1, X: 2, Y: 2 };
const COLS = { A: 0, B: 1, C: 2, D: 0, E: 1, X: 0, Y: 1 };
const ROW_Y = [58, 132, 206];
const COL_X = [262, 392, 522];
const ROOT = { x: 24, w: 168, h: 46 };
const TONE = { ok: 'var(--color-ok)', bad: 'var(--color-bad)', warn: 'var(--color-warn)', new: 'var(--color-pen)', dead: '#8b97a8' };

const pos = (id) => ({ x: COL_X[COLS[id]], y: ROW_Y[ROWS[id]] });

const LEGEND = [
  ['live', 'not checked yet'],
  ['marked', 'reachable: kept'],
  ['dead', 'unreachable: garbage'],
];

export function GcReachStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { roots: [], cells: [] };
  const state = Object.fromEntries(f.cells.map((c) => [c.id, c.state || 'live']));
  const toneOf = (id) => (state[id] === 'dead' ? 'dead' : state[id] === 'marked' ? 'ok' : 'new');
  const hadEdge = (from, to) => prev.cells.some((c) => c.id === from && c.refs.includes(to));

  const edges = [];
  f.cells.forEach((c) =>
    c.refs.forEach((to) => {
      if (!(to in state)) return;
      const a = pos(c.id);
      const b = pos(to);
      if (ROWS[c.id] === ROWS[to] && COLS[to] > COLS[c.id]) {
        // left to right in the same row; a cycle's way back runs below the cards
        const back = f.cells.find((x) => x.id === to)?.refs.includes(c.id);
        const y = a.y + CH / 2 - (back ? 8 : 0);
        edges.push({ key: `${c.id}-${to}`, d: `M${a.x + CW} ${y} L${b.x - 1 - HEAD} ${y}`, tone: toneOf(c.id), isNew: !hadEdge(c.id, to) });
      } else {
        const y = a.y + CH / 2 + 8;
        edges.push({ key: `${c.id}-${to}`, d: `M${a.x} ${y} L${b.x + CW + 1 + HEAD} ${y}`, tone: toneOf(c.id), isNew: !hadEdge(c.id, to) });
      }
    }),
  );

  return (
    <div className="g-stage gcr-stage">
      {f.phase && (
        <div className="gcr-bar">
          <span className="gcr-phase" style={{ background: TONE[f.phase.tone] || TONE.new }}>{f.phase.text}</span>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          {Object.entries(TONE).map(([k, c]) => (
            <marker key={k} id={`gcr-arrow-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0 1L10 5L0 9z" fill={c} />
            </marker>
          ))}
        </defs>

        <rect x="12" y="12" width="192" height={H - 52} rx="10" className="gcr-panel" />
        <text x="24" y="36" className="gcr-panel-title">GC roots</text>
        <rect x="216" y="12" width="412" height={H - 52} rx="10" className="gcr-panel" />
        <text x="230" y="36" className="gcr-panel-title">Heap objects</text>
        {'X' in state && (
          <text x="610" y={ROW_Y[2] + CH / 2 + 5} textAnchor="end" className="gcr-hint">no root points here</text>
        )}

        {f.roots.map((r) => {
          const y = ROW_Y[r.row] + CH / 2 - ROOT.h / 2;
          const isNew = !prev.roots.some((p) => p.id === r.id);
          return (
            <g key={r.id} className={isNew ? 'g-pop' : ''}>
              <rect x={ROOT.x} y={y} width={ROOT.w} height={ROOT.h} rx="7" className="gcr-root" />
              <text x={ROOT.x + 10} y={y + 19} className="gcr-root-name">{r.name}</text>
              <text x={ROOT.x + 10} y={y + 36} className="gcr-root-kind">{r.kind}</text>
            </g>
          );
        })}
        {f.roots.map((r) => {
          const y = ROW_Y[r.row] + CH / 2;
          const t = pos(r.to);
          const isNew = !prev.roots.some((p) => p.id === r.id);
          return (
            <g key={`edge-${r.id}`} className={`g-edge ${isNew ? 'is-new' : ''}`}>
              <path d={`M${ROOT.x + ROOT.w} ${y} L${t.x - 1 - HEAD} ${y}`} pathLength="1" className="g-edge-line" stroke={TONE[toneOf(r.to)]} strokeWidth="2.5" fill="none" markerEnd={`url(#gcr-arrow-${toneOf(r.to)})`} />
            </g>
          );
        })}

        {f.cells.map((c) => {
          const p = pos(c.id);
          const st = c.state || 'live';
          return (
            <g key={c.id}>
              <rect x={p.x} y={p.y} width={CW} height={CH} rx="7" className={`gcr-obj is-${st}`} />
              <text x={p.x + CW / 2} y={p.y + 26} textAnchor="middle" className={`gcr-obj-text is-${st}`}>{c.id}</text>
            </g>
          );
        })}
        {edges.map((e) => (
          <g key={e.key} className={`g-edge ${e.isNew ? 'is-new' : ''}`}>
            <path d={e.d} pathLength="1" className="g-edge-line" stroke={TONE[e.tone]} strokeWidth="2" strokeDasharray={e.tone === 'dead' ? '5 4' : undefined} fill="none" markerEnd={`url(#gcr-arrow-${e.tone})`} />
          </g>
        ))}

        {LEGEND.map(([st, text], i) => (
          <g key={st} transform={`translate(${24 + i * 190} ${H - 14})`}>
            <rect x="0" y="-12" width="16" height="16" rx="3" className={`gcr-obj is-${st}`} />
            <text x="22" y="1" className="gcr-legend">{text}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
