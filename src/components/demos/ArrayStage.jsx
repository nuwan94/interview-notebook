// Stage for array algorithms (sorting, searching, two pointers, sliding window, dynamic programming).
// A frame is { line, result, rows }. line is the code being run and result a short outcome ({ text, tone }).
// A row has an optional label, cells (a value, or { v, tone }), pointers ({ name, at, tone }),
// spans (a bracket under cells: { from, to, name, tone }) and breaks (indexes where a new group starts,
// drawn with a gap, for example the halves of merge sort).
// Cells keep their place between frames, so colour changes animate; pointers and brackets glide to their new place.
import { StageBar } from './DsStageParts.jsx';

const GAP = 0.7; // rem between groups

const cellOf = (c) => (c !== null && typeof c === 'object' ? c : { v: c });

export function ArrayStage({ frames, index, label }) {
  const f = frames[index];
  return (
    <div className="a-stage" role="img" aria-label={label}>
      <StageBar line={f.line} result={f.result} />
      {f.rows.map((row, ri) => {
        const cells = row.cells.map(cellOf);
        const n = cells.length;
        const breaks = row.breaks || [];
        const total = breaks.length * GAP;
        const gapsBefore = (i) => breaks.filter((b) => b <= i).length;
        // the left edge of cell i, as a CSS length, allowing for the gaps between groups
        const edge = (i) => `calc(${i / n} * (100% - ${total}rem) + ${gapsBefore(i) * GAP}rem)`;
        const centre = (i) => `calc(${(i + 0.5) / n} * (100% - ${total}rem) + ${gapsBefore(i) * GAP}rem)`;
        const width = (from, to) => `calc(${(to - from + 1) / n} * (100% - ${total}rem) + ${(gapsBefore(to) - gapsBefore(from)) * GAP}rem)`;
        const columns = cells.map((_, i) => (breaks.includes(i) ? `${GAP}rem minmax(0, 1fr)` : 'minmax(0, 1fr)')).join(' ');

        // pointers on the same cell stack on top of each other
        const stack = new Map();
        const ptrs = (row.pointers || []).map((p) => {
          const k = stack.get(p.at) || 0;
          stack.set(p.at, k + 1);
          return { ...p, k };
        });
        const depth = ptrs.length ? Math.max(...ptrs.map((p) => p.k)) + 1 : 0;
        return (
          <div className="a-row" key={ri}>
            {row.label && <div className="a-label">{row.label}</div>}
            <div className="a-body" style={{ maxWidth: `${Math.max(n * 4.2, 12)}rem` }}>
              <div className="a-cells" style={{ gridTemplateColumns: columns }} aria-hidden="true">
                {cells.map((c, i) => [
                  breaks.includes(i) && <div key={`g${i}`} />,
                  <div className="a-slot" key={i}>
                    <div className={`a-cell tone-${c.tone || 'none'}`}>{c.v}</div>
                    {row.index !== false && <div className="a-idx">{i}</div>}
                  </div>,
                ])}
              </div>
              {row.spans && row.spans.length > 0 && (
                <div className="a-spans" aria-hidden="true">
                  {row.spans.map((s) => (
                    <div key={s.name} className={`a-span ${s.tone ? `tone-${s.tone}` : ''}`} style={{ left: `calc(${edge(s.from)} + 0.2rem)`, width: `calc(${width(s.from, s.to)} - 0.4rem)` }}>
                      <span className="a-span-label">{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {depth > 0 && (
                <div className="a-ptrs" style={{ height: `${depth * 1.25 + 0.2}rem` }} aria-hidden="true">
                  {ptrs.map((p) => (
                    <div key={p.name} className={`a-ptr ${p.tone ? `tone-${p.tone}` : ''}`} style={{ left: centre(p.at), top: `${p.k * 1.25}rem` }}>
                      <span aria-hidden="true">▲</span> {p.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* the same information as text for screen readers */}
      <ul className="sr-only">
        {f.line && <li>Code: {f.line}{f.result ? `. Result: ${f.result.text}` : ''}</li>}
        {f.rows.map((row, ri) => (
          <li key={ri}>
            {row.label ? `${row.label}: ` : ''}
            {row.cells.map((c) => cellOf(c).v).join(', ')}
            {(row.pointers || []).length ? `. ${(row.pointers || []).map((p) => `${p.name} at position ${p.at}`).join(', ')}` : ''}
            {(row.spans || []).length ? `. ${row.spans.map((s) => `${s.name} from position ${s.from} to ${s.to}`).join(', ')}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
