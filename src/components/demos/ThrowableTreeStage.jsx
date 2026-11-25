import './ThrowableTreeStage.css';

// Class tree for the exceptions hierarchy scene: an indented tree (like a file tree) with elbow lines from each
// class to its subclasses, coloured by kind, and brackets on the right that name each group (errors, checked,
// unchecked).
//
// Frame: { line, result: { text, tone }, show: [node ids], focus: [node ids], groups: [group ids], note }
// Scene-level data (passed in every frame, the same each time): tree: [{ id, name, depth, kind, parent, tag }],
//   groupDefs: [{ id, members: [ids], title, lines: [...], tone }]
//   kind: base | error | checked | unchecked | yours

const W = 640;
const TOP = 14;
const ROW = 27;
const BOX_H = 21;
const INDENT = 30;
const X0 = 18;
const BRACKET_X = 430;
const KIND = {
  base: { stroke: '#556070', fill: '#fff' },
  error: { stroke: 'var(--color-bad)', fill: 'var(--color-bad-soft)' },
  checked: { stroke: 'var(--color-warn)', fill: 'var(--color-warn-soft)' },
  unchecked: { stroke: 'var(--color-ok)', fill: 'var(--color-ok-soft)' },
  yours: { stroke: 'var(--color-pen)', fill: 'var(--color-pen-soft)' },
};
const TONE = { ok: 'var(--color-ok)', bad: 'var(--color-bad)', warn: 'var(--color-warn)', new: 'var(--color-pen)' };

const boxW = (name) => name.length * 7.5 + 18;

export function ThrowableTreeStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { show: [], groups: [] };
  const shown = f.tree.filter((n) => f.show.includes(n.id));
  const maxRows = Math.max(...frames.map((x) => x.show.length));
  const H = TOP + maxRows * ROW + 10;
  const row = Object.fromEntries(shown.map((n, i) => [n.id, i]));
  const byId = Object.fromEntries(f.tree.map((n) => [n.id, n]));
  const focus = new Set(f.focus || []);
  const hasFocus = focus.size > 0;
  const boxX = (n) => X0 + n.depth * INDENT;
  const y = (id) => TOP + row[id] * ROW;

  return (
    <div className="g-stage tt-stage">
      {(f.line || f.result) && (
        <div className="tt-bar">
          {f.line && <code className="tt-line">{f.line}</code>}
          {f.result && (
            <span className="tt-result" style={{ background: TONE[f.result.tone] || TONE.new }}>
              {f.result.text}
            </span>
          )}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        {/* elbow lines: down from the parent, then right to the child */}
        {shown.map((n) => {
          if (!n.parent || row[n.parent] === undefined) return null;
          const p = byId[n.parent];
          const px = boxX(p) + 12;
          const cy = y(n.id) + BOX_H / 2;
          const dim = hasFocus && !focus.has(n.id);
          return (
            <path key={`l-${n.id}`} d={`M${px} ${y(p.id) + BOX_H} V${cy - 6} Q${px} ${cy} ${px + 6} ${cy} H${boxX(n)}`} className="tt-link" opacity={dim ? 0.35 : 1} />
          );
        })}

        {/* the classes */}
        {shown.map((n) => {
          const k = KIND[n.kind] || KIND.base;
          const isNew = !prev.show.includes(n.id);
          const dim = hasFocus && !focus.has(n.id);
          const x = boxX(n);
          const w = boxW(n.name);
          return (
            <g key={n.id} className={isNew ? 'g-pop' : ''} opacity={dim ? 0.35 : 1}>
              <rect x={x} y={y(n.id)} width={w} height={BOX_H} rx="5" fill={k.fill} stroke={k.stroke} strokeWidth={focus.has(n.id) ? 3 : 1.75} strokeDasharray={n.kind === 'yours' ? '5 3' : undefined} />
              <text x={x + 9} y={y(n.id) + 15} className="tt-name">
                {n.name}
              </text>
              {n.tag && (
                <text x={x + w + 8} y={y(n.id) + 15} className="tt-tag">
                  {n.tag}
                </text>
              )}
            </g>
          );
        })}

        {/* brackets that name each group; the text is centred on its bracket, but pushed down if it would run
            into the text of the group above */}
        {(() => {
          let textBottom = 0;
          return (f.groupDefs || [])
            .filter((g) => (f.groups || []).includes(g.id))
            .map((g) => {
              const rows = g.members.filter((m) => row[m] !== undefined).map((m) => row[m]);
              if (!rows.length) return null;
              const y1 = TOP + Math.min(...rows) * ROW + 2;
              const y2 = TOP + Math.max(...rows) * ROW + BOX_H - 2;
              const textH = 16 + g.lines.length * 15;
              const t0 = Math.max((y1 + y2) / 2 - textH / 2, textBottom + 8);
              textBottom = t0 + textH;
              const c = TONE[g.tone] || TONE.new;
              const isNew = !(prev.groups || []).includes(g.id);
              return (
                <g key={g.id} className={isNew ? 'g-pop' : ''}>
                  <path d={`M${BRACKET_X - 8} ${y1} H${BRACKET_X} V${y2} H${BRACKET_X - 8}`} stroke={c} strokeWidth="2.5" fill="none" />
                  <text x={BRACKET_X + 12} y={t0 + 12} className="tt-group-title" fill={c}>
                    {g.title}
                  </text>
                  {g.lines.map((ln, i) => (
                    <text key={ln} x={BRACKET_X + 12} y={t0 + 28 + i * 15} className="tt-group-text">
                      {ln}
                    </text>
                  ))}
                </g>
              );
            });
        })()}
      </svg>
    </div>
  );
}
