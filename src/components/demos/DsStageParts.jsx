// Shared parts for the data structure stages (DsListStage, DsHashStage, DsTreeStage, DsGraphStage) and ArrayStage:
// the bar with the current code line and the result, the colour tones and fixed-size arrowheads.
import './DsStage.css';

export const HEAD = 9; // arrowhead length in SVG units

export const TONE = {
  none: '#7b8697',
  ok: 'var(--color-ok)',
  bad: 'var(--color-bad)',
  warn: 'var(--color-warn)',
  new: 'var(--color-pen)',
};

// the code line being run and its result (true, found, not found ...)
export function StageBar({ line, result }) {
  if (!line && !result) return null;
  return (
    <div className="ds-bar">
      {line && <code className="ds-line">{line}</code>}
      {result && (
        <span className="ds-result" style={{ background: TONE[result.tone] || TONE.new }}>
          {result.text}
        </span>
      )}
    </div>
  );
}

// one marker per tone; markerUnits="userSpaceOnUse" keeps the head the same size whatever the line width.
// A path should stop HEAD units before the card, so the tip just touches its edge.
export function ArrowDefs({ prefix }) {
  return (
    <defs>
      {Object.entries(TONE).map(([k, c]) => (
        <marker key={k} id={`${prefix}-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0 1L10 5L0 9z" fill={c} />
        </marker>
      ))}
    </defs>
  );
}

// an arrow drawn with the shared animation classes; `isNew` draws it in
export function Arrow({ d, tone = 'none', prefix, isNew, dashed, width = 2, opacity = 1 }) {
  return (
    <g className={`g-edge ${isNew ? 'is-new' : ''}`} opacity={opacity}>
      <path
        d={d}
        pathLength="1"
        className="g-edge-line"
        stroke={TONE[tone]}
        strokeWidth={width}
        strokeDasharray={dashed && !isNew ? '0.02 0.015' : undefined}
        fill="none"
        markerEnd={`url(#${prefix}-${tone})`}
      />
    </g>
  );
}

// trim a straight segment so it starts outside box a and ends HEAD units before box b (boxes are { cx, cy, hw, hh })
export function boxToBox(a, b) {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const exit = (bx) => {
    const tx = dx === 0 ? Infinity : bx.hw / Math.abs(dx);
    const ty = dy === 0 ? Infinity : bx.hh / Math.abs(dy);
    return Math.min(tx, ty);
  };
  const len = Math.hypot(dx, dy);
  const t0 = exit(a) + 2 / len;
  const t1 = 1 - exit(b) - (HEAD + 1) / len;
  return { x1: a.cx + dx * t0, y1: a.cy + dy * t0, x2: a.cx + dx * t1, y2: a.cy + dy * t1 };
}
