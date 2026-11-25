import './TryStage.css';

// Code-run picture for the try / catch / finally and try-with-resources scenes. On the left, the code with a marker
// per line (ran, skipped, threw) and arrows in the left margin for every jump the program makes (into a catch, into
// finally, out to the caller). On the right, cards for what exists at that moment: open resources, the exception
// object with its suppressed list, or what the caller receives.
//
// Frame: { case, result: { text, tone }, lines: [{ t, s }], jumps: [{ from, to, tone }], exit,
//          sideTitle, cards: [{ title, lines: [...], tone, inner: { title, lines, tone } }], note }
//   line.s: run | skip | throw | wait (not reached yet);  jump.to === lines.length means "out to the caller"

const W = 640;
const CODE = { x: 12, w: 406, top: 46, lh: 24 };
const MX = 60; // x of the line markers
const TEXT_X = 74;
const SIDE = { x: 430, w: 198, cardX: 438, cardW: 182 };
const HEAD = 8;
const TONE = {
  ok: 'var(--color-ok)',
  bad: 'var(--color-bad)',
  warn: 'var(--color-warn)',
  new: 'var(--color-pen)',
  none: '#556070',
};

const lineY = (i) => CODE.top + i * CODE.lh; // top of line i
const midY = (i) => lineY(i) + CODE.lh / 2;

const cardHeight = (c) => 26 + (c.lines || []).length * 16 + (c.inner ? cardHeight(c.inner) + 4 : 0);
const codeHeight = (f) => CODE.top + (f.lines.length + (hasExit(f) ? 1 : 0)) * CODE.lh + 10;
const sideHeight = (f) => 46 + (f.cards || []).reduce((s, c) => s + cardHeight(c) + 10, 0);
const hasExit = (f) => (f.jumps || []).some((j) => j.to >= f.lines.length);

function Card({ c, x, y, w, isNew }) {
  const tone = TONE[c.tone] || TONE.none;
  const h = cardHeight(c);
  return (
    <g className={isNew ? 'g-pop' : ''}>
      <rect x={x} y={y} width={w} height={h} rx="7" className="tr-card" style={{ stroke: tone }} />
      <text x={x + 10} y={y + 18} className="tr-card-title" fill={tone}>
        {c.title}
      </text>
      {(c.lines || []).map((ln, i) => (
        <text key={ln} x={x + 10} y={y + 35 + i * 16} className="tr-card-text">
          {ln}
        </text>
      ))}
      {c.inner && <Card c={c.inner} x={x + 8} y={y + 26 + (c.lines || []).length * 16} w={w - 16} isNew={false} />}
    </g>
  );
}

export function TryStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { cards: [] };
  const H = Math.max(...frames.map((x) => Math.max(codeHeight(x), sideHeight(x)))) + 8;
  const exitRow = f.lines.length;
  let cardY = 46;

  return (
    <div className="g-stage tr-stage">
      <div className="tr-bar">
        <span className="tr-case">{f.case}</span>
        {f.result && (
          <span className="tr-result" style={{ background: TONE[f.result.tone] || TONE.new }}>
            {f.result.text}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          {Object.entries(TONE).map(([k, c]) => (
            // fixed size; the line stops at the head's base, so the tip touches the line marker
            <marker key={k} id={`tr-arrow-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0 1L10 5L0 9z" fill={c} />
            </marker>
          ))}
        </defs>

        {/* the code */}
        <rect x={CODE.x} y="12" width={CODE.w} height={H - 24} rx="10" className="tr-panel" />
        <text x={CODE.x + 12} y="34" className="tr-panel-title">
          The code, line by line
        </text>
        {f.lines.map((ln, i) => {
          const s = ln.s || 'wait';
          return (
            <g key={i}>
              {(s === 'run' || s === 'throw') && (
                <rect x={MX + 9} y={lineY(i) + 2} width={CODE.x + CODE.w - MX - 17} height={CODE.lh - 4} rx="4" className={`tr-hl is-${s}`} />
              )}
              <circle cx={MX} cy={midY(i)} r="5" className={`tr-mark is-${s}`} />
              <text x={TEXT_X} y={midY(i) + 4.5} className={`tr-code is-${s}`} xmlSpace="preserve">
                {ln.t}
              </text>
            </g>
          );
        })}
        {hasExit(f) && (
          <g className="g-pop">
            <circle cx={MX} cy={midY(exitRow)} r="5" className="tr-mark is-throw" />
            <text x={TEXT_X} y={midY(exitRow) + 4.5} className="tr-exit">
              {f.exit || 'out of the method, to the caller'}
            </text>
          </g>
        )}

        {/* jumps in the left margin: from one line marker to another, each in its own lane */}
        {(f.jumps || []).map((j, k) => {
          const gx = 36 - k * 9;
          const y1 = midY(j.from);
          const y2 = midY(Math.min(j.to, exitRow));
          const x1 = MX - 6;
          const x2 = MX - 6 - 1 - HEAD;
          const dir = y2 > y1 ? 1 : -1;
          const d = `M${x1} ${y1} H${gx + 4} Q${gx} ${y1} ${gx} ${y1 + 4 * dir} V${y2 - 4 * dir} Q${gx} ${y2} ${gx + 4} ${y2} H${x2}`;
          const tone = j.tone || 'new';
          return (
            <g key={`${j.from}-${j.to}`} className="g-edge is-new">
              <path d={d} pathLength="1" className="g-edge-line" stroke={TONE[tone]} strokeWidth="2.25" fill="none" markerEnd={`url(#tr-arrow-${tone})`} />
            </g>
          );
        })}

        {/* what exists right now */}
        <rect x={SIDE.x} y="12" width={SIDE.w} height={H - 24} rx="10" className="tr-panel" />
        <text x={SIDE.x + 10} y="34" className="tr-panel-title">
          {f.sideTitle || 'What happens'}
        </text>
        {(f.cards || []).map((c) => {
          const y = cardY;
          cardY += cardHeight(c) + 10;
          const isNew = !(prev.cards || []).some((p) => p.title === c.title);
          return <Card key={c.title} c={c} x={SIDE.cardX} y={y} w={SIDE.cardW} isNew={isNew} />;
        })}
      </svg>
    </div>
  );
}
