// Stage for array algorithms (sorting, searching, two pointers, sliding window, dynamic programming).
// A frame has rows; a row has an optional label, cells (a value, or { v, tone }) and pointers ({ name, at }).
// Cells keep their place between frames, so colour changes animate; pointers glide to their new index.

const cellOf = (c) => (c !== null && typeof c === 'object' ? c : { v: c });

export function ArrayStage({ frames, index, label }) {
  const f = frames[index];
  return (
    <div className="a-stage" role="img" aria-label={label}>
      {f.rows.map((row, ri) => {
        const cells = row.cells.map(cellOf);
        const n = cells.length;
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
              <div className="a-cells" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden="true">
                {cells.map((c, i) => (
                  <div className="a-slot" key={i}>
                    <div className={`a-cell tone-${c.tone || 'none'}`}>{c.v}</div>
                    {row.index !== false && <div className="a-idx">{i}</div>}
                  </div>
                ))}
              </div>
              {depth > 0 && (
                <div className="a-ptrs" style={{ height: `${depth * 1.25 + 0.2}rem` }} aria-hidden="true">
                  {ptrs.map((p) => (
                    <div key={p.name} className={`a-ptr ${p.tone ? `tone-${p.tone}` : ''}`} style={{ left: `${((p.at + 0.5) / n) * 100}%`, top: `${p.k * 1.25}rem` }}>
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
        {f.rows.map((row, ri) => (
          <li key={ri}>
            {row.label ? `${row.label}: ` : ''}
            {row.cells.map((c) => cellOf(c).v).join(', ')}
            {(row.pointers || []).length ? `. ${(row.pointers || []).map((p) => `${p.name} at position ${p.at}`).join(', ')}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
