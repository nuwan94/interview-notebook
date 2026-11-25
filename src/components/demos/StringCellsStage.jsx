import './StringCellsStage.css';

// Memory picture for the strings scenes that are about characters: each row is one object (a String, a builder's
// buffer, a char[] or a byte[]) drawn as a strip of cells, with variables on the left pointing at the row they hold.
//
// Frame: { line, result: { text, tone }, rows: [{ id, label, tag: { text, tone }, cells: [{ t, tone, sub }],
//          empty, dim }], pointers: [{ name, to, at }], footer: { text, tone }, note }
//   cell.tone: none | new | warn | ok | bad;  empty = number of unused (capacity) cells after the filled ones
//   row.slot = the line the row is drawn on (defaults to its position in the list)
//   pointer.at = the line the variable box sits on (defaults to its target row's line)

const W = 640;
const TOP = 14;
const ROW_H = 78;
const VAR = { x: 16, w: 152, h: 32 };
const CELL = { x: 250, w: 34, gap: 4, h: 32 };
const HEAD = 9; // arrowhead length
const TONE = {
  ok: 'var(--color-ok)',
  bad: 'var(--color-bad)',
  warn: 'var(--color-warn)',
  new: 'var(--color-pen)',
  none: '#556070',
};

const rowTop = (i) => TOP + i * ROW_H;
const cellY = (i) => rowTop(i) + 22;
const midY = (i) => cellY(i) + CELL.h / 2;

export function StringCellsStage({ frames, index, label }) {
  const f = frames[index];
  // without any variables in the scene, the objects move to the left edge
  const cx = frames.some((x) => (x.pointers || []).length) ? CELL.x : 28;
  const prev = index > 0 ? frames[index - 1] : { rows: [], pointers: [] };
  const pointers = f.pointers || [];
  // lines used by rows and by variable boxes, so nothing is drawn below the picture
  const maxRows = Math.max(...frames.map((x) => Math.max(...x.rows.map((r, i) => (r.slot ?? i) + 1), ...(x.pointers || []).map((p) => (p.at ?? 0) + 1))));
  const hasFooter = frames.some((x) => x.footer);
  const H = rowTop(maxRows) + (hasFooter ? 44 : 0) + 4;
  const rowIndex = Object.fromEntries(f.rows.map((r, k) => [r.id, r.slot ?? k]));

  return (
    <div className="g-stage sc-stage">
      <div className="sc-bar">
        <code className="sc-line">{f.line}</code>
        {f.result && (
          <span className="sc-result" style={{ background: TONE[f.result.tone] || TONE.new }}>
            {f.result.text}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          {Object.entries(TONE).map(([k, c]) => (
            // fixed size (not scaled by stroke width); the line stops at the head's base, so the tip touches the cell
            <marker key={k} id={`sc-arrow-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0 1L10 5L0 9z" fill={c} />
            </marker>
          ))}
        </defs>

        {/* the objects, one row each */}
        {f.rows.map((r, k) => {
          const i = r.slot ?? k;
          const isNew = !prev.rows.some((p) => p.id === r.id);
          const filled = r.cells.length;
          const total = filled + (r.empty || 0);
          return (
            <g key={r.id} className={isNew ? 'g-pop' : ''} opacity={r.dim ? 0.45 : 1}>
              <text x={cx} y={rowTop(i) + 13} className="sc-label">
                {r.label}
                {r.tag && (
                  <tspan dx="10" className="sc-tag" fill={TONE[r.tag.tone] || TONE.none}>
                    {r.tag.text}
                  </tspan>
                )}
              </text>
              {/* the object outline around all its cells, including unused capacity */}
              <rect x={cx - 5} y={cellY(i) - 5} width={total * (CELL.w + CELL.gap) - CELL.gap + 10} height={CELL.h + 10} rx="7" className="sc-obj" />
              {r.cells.map((c, j) => {
                const x = cx + j * (CELL.w + CELL.gap);
                return (
                  <g key={j}>
                    <rect x={x} y={cellY(i)} width={CELL.w} height={CELL.h} rx="4" className={`sc-cell tone-${c.tone || 'none'}`} />
                    <text x={x + CELL.w / 2} y={cellY(i) + 21} textAnchor="middle" className={`sc-ch ${c.t.length > 2 ? 'is-small' : ''}`}>
                      {c.t}
                    </text>
                    {c.sub !== undefined && (
                      <text x={x + CELL.w / 2} y={cellY(i) + CELL.h + 18} textAnchor="middle" className="sc-sub">
                        {c.sub}
                      </text>
                    )}
                  </g>
                );
              })}
              {Array.from({ length: r.empty || 0 }, (_, k) => (
                <rect key={`e${k}`} x={cx + (filled + k) * (CELL.w + CELL.gap)} y={cellY(i)} width={CELL.w} height={CELL.h} rx="4" className="sc-cell is-empty" />
              ))}
            </g>
          );
        })}

        {/* variables on the left and the arrow to the object each one holds */}
        {pointers.map((p) => {
          const to = rowIndex[p.to];
          if (to === undefined) return null;
          const at = p.at ?? to;
          const vy = midY(at) - VAR.h / 2;
          const x1 = VAR.x + VAR.w + 4;
          const y1 = midY(at);
          const x2 = cx - 5 - 1 - HEAD; // stop one head-length before the object outline
          const y2 = midY(to);
          const d = `M${x1} ${y1} C${x1 + 26} ${y1} ${x2 - 26} ${y2} ${x2} ${y2}`;
          const before = (prev.pointers || []).find((q) => q.name === p.name);
          const isNew = !before || before.to !== p.to;
          const tone = p.tone || 'new';
          return (
            <g key={p.name}>
              <g className={!before ? 'g-pop' : ''}>
                <rect x={VAR.x} y={vy} width={VAR.w} height={VAR.h} rx="6" className="sc-var" />
                <text x={VAR.x + 10} y={vy + 21} className="sc-var-text">
                  {p.name}
                </text>
                <circle cx={VAR.x + VAR.w} cy={y1} r="4" className="sc-dot" />
              </g>
              <g className={`g-edge ${isNew ? 'is-new' : ''}`}>
                <path d={d} pathLength="1" className="g-edge-line" stroke={TONE[tone]} strokeWidth="2.25" fill="none" markerEnd={`url(#sc-arrow-${tone})`} />
              </g>
            </g>
          );
        })}

        {f.footer && (
          <g>
            <rect x="16" y={rowTop(maxRows) + 4} width={W - 32} height="32" rx="8" className="sc-footer" style={{ stroke: TONE[f.footer.tone] || TONE.none }} />
            <text x="30" y={rowTop(maxRows) + 25} className="sc-footer-text" fill={TONE[f.footer.tone] || TONE.none}>
              {f.footer.text}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
