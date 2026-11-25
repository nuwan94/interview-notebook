// Picture for the OOP walk-through: the variable and the object on the left, the class hierarchy on the right.
// Each row on the left lines up with a class row on the right, so the arrows between them are straight and short.
//
// Frame: { classes: [{ name, parent, state, methods: [{ sig, state, order }] }],
//          vars: [{ n, declared, actual }], varRow, objRow,
//          object: { sections: [{ cls, field, set }] },        (constructor scene: the parts of one object)
//          arrows: { compile: ['line 1', 'line 2'], run: ['line 1', 'line 2'] },
//          up: ['ChildClass'], upLabel, focus: ['ClassName'] }

import './OopStage.css';

const W = 680;
const H = 324;
const ROW_Y = [58, 150, 242];
const CARD_H = 66;
const LEFT = { x: 24, w: 186 };
const CLS = { x: 334, w: 322 };
const HEAD = 10;
const TONE = {
  ok: 'var(--color-ok)',
  bad: 'var(--color-bad)',
  warn: 'var(--color-warn)',
  new: 'var(--color-pen)',
  none: '#6b7788',
};
// what the tag in the corner of a class card says, and its colour
const TAG = {
  checked: ['compiler looks here', 'warn'],
  searching: ['JVM searches here', 'warn'],
  passed: ['not here: go up', 'none'],
  found: ['this version runs', 'ok'],
  actual: ['class of the object', 'new'],
  active: ['running now', 'new'],
  waiting: ['waiting for parent', 'warn'],
  done: ['done', 'ok'],
};

const pillW = (sig) => sig.length * 7.6 + 18;

function Arrowheads() {
  return (
    <defs>
      {Object.entries(TONE).map(([k, c]) => (
        <g key={k}>
          <marker id={`oop-head-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0 1L10 5L0 9z" fill={c} />
          </marker>
          <marker id={`oop-tri-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0.8 0.8L9.4 5L0.8 9.2z" fill="#fff" stroke={c} strokeWidth="1.4" strokeLinejoin="round" />
          </marker>
        </g>
      ))}
    </defs>
  );
}

function ClassCard({ c, row, dim }) {
  const y = ROW_Y[row];
  const tag = TAG[c.state];
  let px = CLS.x + 12;
  return (
    <g opacity={dim ? 0.35 : 1}>
      <rect x={CLS.x} y={y} width={CLS.w} height={CARD_H} rx="8" className={`oop-class is-${c.state || 'idle'}`} />
      <text x={CLS.x + 12} y={y + 21} className="oop-class-name">{c.name}</text>
      {tag && (
        <text x={CLS.x + CLS.w - 12} y={y + 20} textAnchor="end" className="oop-tag" fill={TONE[tag[1]]}>{tag[0]}</text>
      )}
      {c.methods.map((m) => {
        // a numbered step gets a small circle inside the pill, before the name
        const pad = m.order ? 20 : 0;
        const w = pillW(m.sig) + pad;
        const x = px;
        px += w + 8;
        return (
          <g key={m.sig}>
            <rect x={x} y={y + 32} width={w} height="24" rx="5" className={`oop-pill is-${m.state || 'idle'}`} />
            {m.order && (
              <g>
                <circle cx={x + 13} cy={y + 44} r="8.5" fill={TONE.ok} />
                <text x={x + 13} y={y + 48} textAnchor="middle" className="oop-order">{m.order}</text>
              </g>
            )}
            <text x={x + pad + (w - pad) / 2} y={y + 48.5} textAnchor="middle" className={`oop-pill-text is-${m.state || 'idle'}`}>{m.sig}</text>
          </g>
        );
      })}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, tone, tri, fresh }) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ex = x2 - ((x2 - x1) / len) * (HEAD + 1);
  const ey = y2 - ((y2 - y1) / len) * (HEAD + 1);
  return (
    <g className={`g-edge ${fresh ? 'is-new' : ''}`}>
      <path
        d={`M${x1} ${y1} L${ex} ${ey}`}
        pathLength="1"
        className="g-edge-line"
        stroke={TONE[tone]}
        fill="none"
        markerEnd={`url(#oop-${tri ? 'tri' : 'head'}-${tone})`}
      />
    </g>
  );
}

export function OopStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : {};
  const rowOf = Object.fromEntries(f.classes.map((c, i) => [c.name, i]));
  const focus = new Set(f.focus || []);
  const v = (f.vars || [])[0];
  const varRow = f.varRow ?? 0;
  const objRow = f.objRow ?? 2;
  const up = new Set(f.up || []);
  const arrows = f.arrows || {};
  const prevArrows = prev.arrows || {};
  const midX = (LEFT.x + LEFT.w + CLS.x) / 2;

  return (
    <div className="g-stage oop-stage">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <Arrowheads />
        <rect x="12" y="12" width={LEFT.w + 24} height={H - 24} rx="10" className="oop-panel" />
        <rect x={CLS.x - 14} y="12" width={CLS.w + 28} height={H - 24} rx="10" className="oop-panel" />
        <text x={CLS.x} y="44" className="oop-panel-title">Classes: the blueprints</text>

        {/* classes, parent above child, joined by "extends" arrows that point up */}
        {f.classes.map((c, i) => (
          <ClassCard key={c.name} c={c} row={i} dim={focus.size > 0 && !focus.has(c.name)} />
        ))}
        {f.classes.map((c, i) => {
          if (!c.parent || rowOf[c.parent] === undefined) return null;
          const x = CLS.x + 30;
          const y1 = ROW_Y[i];
          const y2 = ROW_Y[rowOf[c.parent]] + CARD_H;
          const hot = up.has(c.name);
          const tone = hot ? (f.upTone || 'warn') : 'none';
          return (
            <g key={`up-${c.name}`}>
              <Arrow x1={x} y1={y1} x2={x} y2={y2} tone={tone} tri={!hot} fresh={hot && !(prev.up || []).includes(c.name)} />
              <text x={x + 12} y={(y1 + y2) / 2 + 4} className={`oop-up-label ${hot ? 'is-hot' : ''}`} fill={TONE[tone]}>
                {hot ? f.upLabel : 'extends'}
              </text>
            </g>
          );
        })}

        {!v && !f.object && (
          <text x={LEFT.x + LEFT.w / 2} y={H / 2} textAnchor="middle" className="oop-empty">no object yet</text>
        )}

        {/* the variable: its declared type */}
        {v && (
          <g className={prev.vars?.length ? '' : 'g-pop'}>
            <text x={LEFT.x} y={ROW_Y[varRow] - 8} className="oop-heading">Variable</text>
            <rect x={LEFT.x} y={ROW_Y[varRow]} width={LEFT.w} height={CARD_H} rx="8" className="oop-var" />
            <text x={LEFT.x + 12} y={ROW_Y[varRow] + 25} className="oop-var-name">{`${v.declared} ${v.n}`}</text>
            <text x={LEFT.x + 12} y={ROW_Y[varRow] + 47} className="oop-small">
              declared type: <tspan className="oop-small-strong" fill={TONE.warn}>{v.declared}</tspan>
            </text>
          </g>
        )}

        {/* the object it points to: its actual class */}
        {v && (
          <g className={prev.vars?.length ? '' : 'g-pop'}>
            <text x={LEFT.x} y={ROW_Y[objRow] - 8} className="oop-heading">Object on the heap</text>
            <rect x={LEFT.x} y={ROW_Y[objRow]} width={LEFT.w} height={CARD_H} rx="8" className="oop-obj" />
            <text x={LEFT.x + 12} y={ROW_Y[objRow] + 25} className="oop-var-name">{`${v.actual} object`}</text>
            <text x={LEFT.x + 12} y={ROW_Y[objRow] + 47} className="oop-small">
              actual class: <tspan className="oop-small-strong" fill={TONE.ok}>{v.actual}</tspan>
            </text>
            <Arrow x1={LEFT.x + 152} y1={ROW_Y[varRow] + CARD_H} x2={LEFT.x + 152} y2={ROW_Y[objRow]} tone="none" fresh={!prev.vars?.length} />
            <text x={LEFT.x + 144} y={(ROW_Y[varRow] + CARD_H + ROW_Y[objRow]) / 2 + 4} textAnchor="end" className="oop-small">points to</text>
          </g>
        )}

        {/* constructor scene: one object, with one part for each class in the hierarchy */}
        {f.object && (
          <g className={prev.object ? '' : 'g-pop'}>
            <text x={LEFT.x} y={ROW_Y[0] - 8} className="oop-heading">The new object</text>
            <rect x={LEFT.x} y={ROW_Y[0]} width={LEFT.w} height={ROW_Y[2] + CARD_H - ROW_Y[0]} rx="8" className="oop-obj" />
            {f.object.sections.map((s, i) => {
              const y = ROW_Y[i];
              return (
                <g key={s.cls}>
                  {i > 0 && <line x1={LEFT.x} x2={LEFT.x + LEFT.w} y1={y - 13} y2={y - 13} className="oop-divider" />}
                  <text x={LEFT.x + 12} y={y + 22} className="oop-part">{`${s.cls} part`}</text>
                  {s.set && <rect x={LEFT.x + 8} y={y + 32} width={LEFT.w - 16} height="24" rx="5" className="oop-field-set" />}
                  <text x={LEFT.x + 14} y={y + 49} className={`oop-field ${s.set ? 'is-set' : ''}`}>{s.field}</text>
                </g>
              );
            })}
          </g>
        )}

        {/* compile time: from the variable's declared type to the class the compiler checks */}
        {arrows.compile && (
          <g>
            <Arrow x1={LEFT.x + LEFT.w} y1={ROW_Y[varRow] + 33} x2={CLS.x} y2={ROW_Y[varRow] + 33} tone="warn" fresh={!prevArrows.compile} />
            {arrows.compile.map((t, i) => (
              <text key={t} x={midX} y={ROW_Y[varRow] + 33 - 20 + i * 13} textAnchor="middle" className="oop-arrow-label" fill={TONE.warn}>{t}</text>
            ))}
          </g>
        )}

        {/* run time: from the actual object to the class where the JVM starts looking */}
        {arrows.run && (
          <g>
            <Arrow x1={LEFT.x + LEFT.w} y1={ROW_Y[objRow] + 33} x2={CLS.x} y2={ROW_Y[objRow] + 33} tone="ok" fresh={!prevArrows.run} />
            {arrows.run.map((t, i) => (
              <text key={t} x={midX} y={ROW_Y[objRow] + 33 - 20 + i * 13} textAnchor="middle" className="oop-arrow-label" fill={TONE.ok}>{t}</text>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
