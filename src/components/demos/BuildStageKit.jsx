// Shared pieces for the build-tool stages (Maven and Gradle demos): the code bar, arrow markers, cards, arrows
// and code lines. Each stage draws its own picture with these, in an SVG viewBox so it scales.
import './BuildStage.css';

export const HEAD = 10; // arrowhead length; a path ends one head-length before the card it points at
export const TONE = {
  ok: 'var(--color-ok)',
  bad: 'var(--color-bad)',
  warn: 'var(--color-warn)',
  new: 'var(--color-pen)',
  none: '#8d9bb0',
};

// rough text widths, used to size pills and check that labels fit
export const monoW = (s, size = 12) => s.length * size * 0.6;
export const sansW = (s, size = 11) => s.length * size * 0.58;

export function Stage({ name, line, result, W, H, label, children }) {
  return (
    <div className={`g-stage bst-stage ${name}`}>
      {(line || result) && (
        <div className="bst-bar">
          {line && <code className="bst-line">{line}</code>}
          {result && (
            <span className="bst-result" style={{ background: TONE[result.tone] || TONE.new }}>
              {result.text}
            </span>
          )}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          {Object.entries(TONE).map(([k, c]) => (
            // fixed size, not scaled by the stroke width; the tip touches the card edge
            <marker key={k} id={`${name}-arrow-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0 1L10 5L0 9z" fill={c} />
            </marker>
          ))}
        </defs>
        {children}
      </svg>
    </div>
  );
}

export function Panel({ x, y, w, h, title, dashed }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="10" className={`bst-panel ${dashed ? 'is-dashed' : ''}`} />
      {title && (
        <text x={x + 12} y={y + 24} className="bst-panel-title">
          {title}
        </text>
      )}
    </g>
  );
}

// A small rounded label. Width follows the text.
export function Pill({ x, y, text, tone = 'new', anchor = 'start', size = 11 }) {
  const w = sansW(text, size) + 14;
  const left = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return (
    <g>
      <rect x={left} y={y} width={w} height={size + 7} rx={(size + 7) / 2} fill={TONE[tone] || TONE.new} />
      <text x={left + w / 2} y={y + size + 2} textAnchor="middle" className="bst-pill" style={{ fontSize: size }}>
        {text}
      </text>
    </g>
  );
}

// A card with a title, an optional second line and an optional badge on its top edge.
// state: 'focus' draws a thicker border, 'dim' fades it, 'ghost' draws it dashed (it is not there).
// titleTop puts the title at the top of a tall card, leaving room for content drawn inside it.
export function Card({ x, y, w, h, title, sub, tone = 'none', state, isNew, badge, badgeTone, titleSize = 13, titleTop }) {
  const cls = `bst-card tone-${tone} ${state === 'focus' ? 'is-focus' : ''} ${state === 'ghost' ? 'is-ghost' : ''}`;
  const ty = titleTop ? y + 20 : sub ? y + h / 2 - 3 : y + h / 2 + titleSize * 0.36;
  return (
    <g className={isNew ? 'g-pop' : ''} opacity={state === 'dim' ? 0.35 : 1}>
      <rect x={x} y={y} width={w} height={h} rx="7" className={cls} />
      <text x={x + 9} y={ty} className="bst-title" style={{ fontSize: titleSize }}>
        {title}
      </text>
      {sub && (
        <text x={x + 9} y={y + h / 2 + 13} className="bst-sub">
          {sub}
        </text>
      )}
      {badge && <Pill x={x + w - 6} y={y - 9} text={badge} tone={badgeTone || tone} anchor="end" />}
    </g>
  );
}

export function Arrow({ stage, d, tone = 'new', isNew, dim, bold, label, lx, ly, anchor = 'start' }) {
  return (
    <g className={`g-edge ${isNew ? 'is-new' : ''}`} opacity={dim ? 0.25 : 1}>
      <path
        d={d}
        pathLength="1"
        className="g-edge-line"
        stroke={TONE[tone]}
        style={{ strokeWidth: bold ? 2.75 : 2 }}
        fill="none"
        markerEnd={`url(#${stage}-arrow-${tone})`}
      />
      {label && (
        <text x={lx} y={ly} textAnchor={anchor} className="g-edge-label bst-edge-label" fill={TONE[tone]}>
          {label}
        </text>
      )}
    </g>
  );
}

// Horizontal arrow from the right edge of one card to the left edge of another, as a smooth S curve.
export const hCurve = (x1, y1, cardX2, y2) => {
  const x2 = cardX2 - 1 - HEAD;
  const k = Math.max(8, (x2 - x1) / 2);
  return `M${x1} ${y1} C${x1 + k} ${y1} ${x2 - k} ${y2} ${x2} ${y2}`;
};

// Lines of code with optional highlighted lines (indices in hl).
export function CodeLines({ x, y, w, lines, hl = [], step = 22, size = 12 }) {
  const on = new Set(hl);
  return (
    <g>
      {lines.map((ln, i) =>
        on.has(i) ? <rect key={`h${i}`} x={x - 6} y={y + i * step - size - 3} width={w} height={size + 9} rx="4" className="bst-hl" /> : null,
      )}
      {lines.map((ln, i) => (
        <text key={i} x={x} y={y + i * step} className="bst-code" style={{ fontSize: size }} opacity={hl.length && !on.has(i) ? 0.55 : 1}>
          {ln}
        </text>
      ))}
    </g>
  );
}
