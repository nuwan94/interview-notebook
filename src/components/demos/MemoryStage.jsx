import './MemoryStage.css';

// Memory picture for the memory walk: the code with the current line, the thread's stack drawn as frames that
// grow upwards (main at the bottom), the heap with the string pool as a region, and an arrow from every
// reference variable to the object it points to.
//
// Frame: { line, stack: [{ name, vars: [{ n, v } | { n, ref }] }], heap: [{ id, type, body, dim }],
//          pool: [{ id, type, body }], focus: ['a', 'b'], result: { text, tone }, note }
// Objects are placed next to the variables that point to them, so every arrow is a short horizontal line.

const W = 640;
const HEAD = 10; // arrowhead length
const ROW = 40; // height of one variable row
const FHEAD = 24; // frame title height
const FPAD = 8; // space under the last row
const FGAP = 8; // gap between two frames
const STACK = { x: 12, w: 222, fx: 24, fw: 198, slotX: 116, slotW: 92 };
const TONE = { ok: 'var(--color-ok)', bad: 'var(--color-bad)', warn: 'var(--color-warn)', new: 'var(--color-pen)' };

const frameH = (size) => FHEAD + ROW * size + FPAD;

/** The scene's fixed geometry: frame sizes, the picture height and where each object sits. */
function layout(frames) {
  const size = {};
  frames.forEach((f) => f.stack.forEach((fr) => (size[fr.name] = Math.max(size[fr.name] || 1, fr.vars.length))));
  const tallest = Math.max(...frames.map((f) => f.stack.reduce((s, fr) => s + frameH(size[fr.name]) + FGAP, 0)), frameH(1));
  const H = Math.max(250, 52 + tallest + 16);
  const bottom = H - 20;

  // y of each row, for one frame of the animation
  const rowsOf = (f) => {
    const rows = {};
    let y = bottom;
    f.stack.forEach((fr, i) => {
      const top = y - frameH(size[fr.name]);
      fr.vars.forEach((v, j) => (rows[`${i}:${v.n}`] = top + FHEAD + ROW * j + ROW / 2));
      rows[`frame:${i}`] = top;
      y = top - FGAP;
    });
    return rows;
  };

  // each object spans the rows of every variable that ever points to it
  const span = {};
  frames.forEach((f) => {
    const rows = rowsOf(f);
    f.stack.forEach((fr, i) =>
      fr.vars.forEach((v) => {
        if (!v.ref) return;
        const y = rows[`${i}:${v.n}`];
        const s = span[v.ref] || { lo: y, hi: y };
        span[v.ref] = { lo: Math.min(s.lo, y), hi: Math.max(s.hi, y) };
      }),
    );
  });
  const hasPool = frames.some((f) => f.pool.length > 0);
  const col = hasPool ? { heap: { x: 262, w: 118 }, pool: { x: 416, w: 186 } } : { heap: { x: 330, w: 210 } };
  const box = (id, inPool) => {
    const s = span[id] || { lo: H / 2, hi: H / 2 };
    const pad = s.hi - s.lo > 0 ? 18 : 26;
    const c = inPool ? col.pool : col.heap;
    return { x: c.x, w: c.w, y: s.lo - pad, h: s.hi - s.lo + pad * 2 };
  };
  return { H, size, bottom, rowsOf, box, hasPool, poolBox: hasPool && { x: 400, w: 218 } };
}

function CodePanel({ code, line, result }) {
  return (
    <pre className="mem-code" aria-label="Code">
      {code.map((ln, i) => (
        <div key={i} className={`mem-line ${i === line ? 'is-current' : ''}`}>
          <span className="mem-num">{i + 1}</span>
          {ln}
          {i === line && result && (
            <span className="mem-result" style={{ background: TONE[result.tone] || TONE.new }}>
              {result.text}
            </span>
          )}
        </div>
      ))}
    </pre>
  );
}

export function MemoryStage({ frames, index, label, code }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { stack: [], heap: [], pool: [] };
  const L = layout(frames);
  const rows = L.rowsOf(f);
  const focus = new Set(f.focus || []);
  const hasFocus = focus.size > 0;
  const prevVar = (i, n) => prev.stack[i]?.name === f.stack[i]?.name && prev.stack[i].vars.find((v) => v.n === n);

  const objects = [...f.heap.map((o) => ({ ...o, inPool: false })), ...f.pool.map((o) => ({ ...o, inPool: true }))];
  const at = {};
  objects.forEach((o) => (at[o.id] = L.box(o.id, o.inPool)));
  const wasThere = (id) => prev.heap.some((o) => o.id === id) || prev.pool.some((o) => o.id === id);
  const prevBody = (id) => [...prev.heap, ...prev.pool].find((o) => o.id === id)?.body;
  const hitIds = new Set();
  f.stack.forEach((fr) => fr.vars.forEach((v) => v.ref && (!hasFocus || focus.has(v.n)) && hitIds.add(v.ref)));

  return (
    <div className="g-stage mem-stage">
      {code && <CodePanel code={code} line={f.line} result={f.result} />}
      <svg viewBox={`0 0 ${W} ${L.H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          {Object.entries(TONE).map(([k, c]) => (
            // fixed size (not scaled by stroke width); the line stops at the head's base, the tip touches the card
            <marker key={k} id={`mem-arrow-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0 1L10 5L0 9z" fill={c} />
            </marker>
          ))}
        </defs>

        {/* the stack of the main thread: frames grow upwards */}
        <rect x={STACK.x} y="12" width={STACK.w} height={L.H - 24} rx="10" className="mem-panel" />
        <text x={STACK.fx} y="36" className="mem-panel-title">Stack (one per thread)</text>
        {f.stack.length === 0 && (
          <text x={STACK.fx + 8} y={L.bottom - 16} className="mem-empty">(empty: every method has returned)</text>
        )}
        {f.stack.map((fr, i) => {
          const top = rows[`frame:${i}`];
          const h = frameH(L.size[fr.name]);
          const isNew = prev.stack[i]?.name !== fr.name;
          return (
            <g key={`${fr.name}-${i}`} className={isNew ? 'g-pop' : ''}>
              <rect x={STACK.fx} y={top} width={STACK.fw} height={h} rx="7" className={`mem-frame ${i === f.stack.length - 1 ? 'is-top' : ''}`} />
              <text x={STACK.fx + 10} y={top + 17} className="mem-frame-title">{fr.name}() frame</text>
              {fr.vars.length === 0 && (
                <text x={STACK.fx + 12} y={top + FHEAD + 24} className="mem-empty">(no variables yet)</text>
              )}
              {fr.vars.map((v) => {
                const y = rows[`${i}:${v.n}`];
                const before = prevVar(i, v.n);
                const changed = before && !v.ref && before.v !== v.v;
                const dim = hasFocus && !focus.has(v.n);
                return (
                  <g key={v.n} className={before ? '' : 'g-pop'} opacity={dim ? 0.35 : 1}>
                    <text x={STACK.fx + 12} y={y + 5} className="mem-var">{v.n}</text>
                    <rect x={STACK.slotX} y={y - 14} width={STACK.slotW} height="28" rx="5" className={`mem-slot ${focus.has(v.n) ? 'is-focus' : ''} ${changed ? 'is-changed' : ''}`} />
                    {v.ref ? (
                      <circle cx={STACK.slotX + STACK.slotW / 2} cy={y} r="4.5" className="mem-dot" />
                    ) : (
                      <text x={STACK.slotX + STACK.slotW / 2} y={y + 5} textAnchor="middle" className="mem-value">{v.v}</text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* the heap, shared by all threads, with the string pool inside it */}
        <rect x="248" y="12" width="380" height={L.H - 24} rx="10" className="mem-panel" />
        <text x="262" y="36" className="mem-panel-title">Heap (shared by all threads)</text>
        {L.poolBox && (
          <>
            <rect x={L.poolBox.x} y="46" width={L.poolBox.w} height={L.H - 66} rx="8" className="mem-pool" />
            <text x={L.poolBox.x + 12} y="64" className="mem-pool-title">String pool</text>
          </>
        )}
        {objects.map((o) => {
          const b = at[o.id];
          const cy = b.y + b.h / 2;
          const changed = prevBody(o.id) != null && prevBody(o.id) !== o.body;
          const extra = o.dim ? 'unreachable: garbage' : o.note;
          const dy = extra ? [-10, 6, 20] : [-3, 14];
          return (
            <g key={o.id} className={wasThere(o.id) ? '' : 'g-pop'}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="7" className={`mem-obj ${o.inPool ? 'in-pool' : ''} ${o.dim ? 'is-dead' : ''} ${hitIds.has(o.id) && hasFocus ? 'is-hit' : ''} ${changed ? 'is-changed' : ''}`} />
              <text x={b.x + b.w / 2} y={cy + dy[0]} textAnchor="middle" className="mem-obj-type">{o.type}</text>
              <text x={b.x + b.w / 2} y={cy + dy[1]} textAnchor="middle" className="mem-obj-body">{o.body}</text>
              {extra && <text x={b.x + b.w / 2} y={cy + dy[2]} textAnchor="middle" className="mem-obj-note">{extra}</text>}
            </g>
          );
        })}

        {/* arrows: each reference variable to its object, entering the card at the variable's own height */}
        {f.stack.map((fr, i) =>
          fr.vars.map((v) => {
            const b = v.ref && at[v.ref];
            if (!b) return null;
            const y1 = rows[`${i}:${v.n}`];
            const x1 = STACK.slotX + STACK.slotW / 2 + 5;
            const x2 = b.x - 1 - HEAD;
            const y2 = Math.min(Math.max(y1, b.y + 10), b.y + b.h - 10);
            const d = Math.abs(y2 - y1) < 1 ? `M${x1} ${y1} L${x2} ${y2}` : `M${x1} ${y1} C${x1 + 60} ${y1} ${x2 - 50} ${y2} ${x2} ${y2}`;
            const tone = f.pool.some((o) => o.id === v.ref) ? 'ok' : 'new';
            const before = prevVar(i, v.n);
            const isNew = !before || before.ref !== v.ref;
            const dim = hasFocus && !focus.has(v.n);
            return (
              <g key={`${i}-${v.n}-${v.ref}`} className={`g-edge ${isNew ? 'is-new' : ''}`} opacity={dim ? 0.2 : 1}>
                <path d={d} pathLength="1" className="g-edge-line" stroke={TONE[tone]} strokeWidth={focus.has(v.n) ? 2.75 : 2} fill="none" markerEnd={`url(#mem-arrow-${tone})`} />
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}

/** A stage component bound to one scene's code listing, for `stage:` in the scene data. */
export const memoryStage = (code) =>
  function MemoryStageWithCode(props) {
    return <MemoryStage {...props} code={code} />;
  };
