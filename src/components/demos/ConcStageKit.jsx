// Small shared parts for the concurrency stages (threads, deadlock, pool, map bins, copy-on-write, queue):
// the code bar with a result pill, fixed-size arrowheads, arrows, state pills and a padlock.
import './ConcStageKit.css';

export const HEAD = 10; // arrowhead length in SVG units

export const TONE = {
  ok: 'var(--color-ok)',
  bad: 'var(--color-bad)',
  warn: 'var(--color-warn)',
  new: 'var(--color-pen)',
  none: '#8d9bb0',
};

export const SOFT = {
  ok: 'var(--color-ok-soft)',
  bad: 'var(--color-bad-soft)',
  warn: 'var(--color-warn-soft)',
  new: 'var(--color-pen-soft)',
  none: '#fff',
};

// thread states shown as a small pill
export const STATE = {
  running: { label: 'RUNNING', tone: 'ok' },
  blocked: { label: 'BLOCKED', tone: 'bad' },
  waiting: { label: 'WAITING', tone: 'warn' },
  paused: { label: 'PAUSED', tone: 'none' },
  idle: { label: 'IDLE', tone: 'none' },
  done: { label: 'DONE', tone: 'new' },
  error: { label: 'EXCEPTION', tone: 'bad' },
};

/** The line of code for this step and its result, above the picture. */
export function Bar({ line, result }) {
  if (!line && !result) return null;
  return (
    <div className="ck-bar">
      {line && <code className="ck-line">{line}</code>}
      {result && (
        <span className="ck-result" style={{ background: TONE[result.tone] || TONE.new }}>
          {result.text}
        </span>
      )}
    </div>
  );
}

/** Arrowhead markers, one per tone. Fixed size: they do not grow with the line width. */
export function Markers({ id }) {
  return (
    <defs>
      {Object.entries(TONE).map(([k, c]) => (
        <marker key={k} id={`${id}-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0 1L10 5L0 9z" fill={c} />
        </marker>
      ))}
    </defs>
  );
}

/**
 * One arrow. The path must end one head-length before the target edge, so the tip just touches it.
 * label: { x, y, text } drawn with a white halo.
 */
export function Arrow({ id, d, tone = 'new', isNew, dashed, width = 2.25, dim, label }) {
  return (
    <g className={`g-edge ${isNew ? 'is-new' : ''}`} opacity={dim ? 0.25 : 1}>
      <path
        d={d}
        pathLength={dashed ? undefined : 1}
        className={dashed ? 'ck-dashed' : 'g-edge-line'}
        stroke={TONE[tone]}
        strokeWidth={width}
        fill="none"
        markerEnd={`url(#${id}-${tone})`}
      />
      {label && (
        <text x={label.x} y={label.y} textAnchor={label.anchor || 'middle'} className="ck-arrow-label" fill={TONE[tone]}>
          {label.text}
        </text>
      )}
    </g>
  );
}

/** A thread-state pill. x is the left edge unless anchor="end". */
export function StatePill({ x, y, state, anchor }) {
  const s = STATE[state] || STATE.idle;
  const w = s.label.length * 6.6 + 14;
  const left = anchor === 'end' ? x - w : x;
  return (
    <g>
      <rect x={left} y={y} width={w} height="17" rx="8.5" fill={SOFT[s.tone]} stroke={TONE[s.tone]} strokeWidth="1.25" />
      <text x={left + w / 2} y={y + 12.5} textAnchor="middle" className="ck-pill" fill={TONE[s.tone]}>
        {s.label}
      </text>
    </g>
  );
}

/** A small padlock, open when `open`. (x, y) is the top-left of the body; the shackle sits above it. */
export function Padlock({ x, y, w = 22, h = 16, tone = 'none', open }) {
  const c = TONE[tone];
  const r = w * 0.3;
  const cx = x + w / 2;
  return (
    <g>
      <path
        // open: the shackle is lifted, so its right leg stops above the body
        d={open
          ? `M${cx - r} ${y} v-${r * 1.6} a${r} ${r} 0 0 1 ${2 * r} 0 v${r * 0.3}`
          : `M${cx - r} ${y} v-${r * 0.9} a${r} ${r} 0 0 1 ${2 * r} 0 v${r * 0.9}`}
        fill="none"
        stroke={c}
        strokeWidth="2.25"
      />
      <rect x={x} y={y} width={w} height={h} rx="3" fill={c} />
    </g>
  );
}
