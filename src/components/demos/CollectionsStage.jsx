// Custom pictures for the Java collections walk-through (javaCollectionsScenes.js).
//
// ChooseStage    the four shapes: a List as indexed slots, a Set as a bag of unique values, a Map as a key-value table,
//                a Queue as a pipe with a head and a tail.
// ArrayListStage the ArrayList object and its backing array: adding, growing into a bigger array, shifting on remove.
// FailFastStage  the list, the iterator's cursor and the two counters (modCount and expectedModCount).
// SortStage      a table of transactions whose rows move as each comparator sorts them.
//
// Every frame may carry { line, result: { text, tone }, note }; the line and result are shown above the picture.
import './CollectionsStage.css';

const HEAD = 10; // arrowhead length; lines stop this far before the target so the tip just touches it
const TONE = {
  ok: 'var(--color-ok)',
  bad: 'var(--color-bad)',
  warn: 'var(--color-warn)',
  new: 'var(--color-pen)',
  none: '#6b7686',
};

function Bar({ f }) {
  if (!f.line && !f.result) return null;
  return (
    <div className="coll-bar">
      {f.line && <code className="coll-line">{f.line}</code>}
      {f.result && (
        <span className="coll-result" style={{ background: TONE[f.result.tone] || TONE.new }}>
          {f.result.text}
        </span>
      )}
    </div>
  );
}

function Markers({ id }) {
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

// a straight arrow whose tip lands exactly on (x2, y2)
function Arrow({ x1, y1, x2, y2, tone = 'none', id, width = 2, isNew = false }) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const k = (len - HEAD) / len;
  const ex = x1 + (x2 - x1) * k;
  const ey = y1 + (y2 - y1) * k;
  return (
    <g className={`g-edge ${isNew ? 'is-new' : ''}`}>
      <path d={`M${x1} ${y1} L${ex} ${ey}`} pathLength="1" className="g-edge-line" stroke={TONE[tone]} strokeWidth={width} fill="none" markerEnd={`url(#${id}-${tone})`} />
    </g>
  );
}

const cellClass = (c) => `coll-cell ${!c || c.t === '' ? 'is-empty' : ''} ${c?.tone ? `tone-${c.tone}` : ''}`;

/* ------------------------------------------------------------------------------------------------ */
/* ChooseStage                                                                                        */
/* Frame: { panels: { list, set, map, queue: { q, op, lines: [], hl } }, note }                       */

const CW = 640;
const CH = 392;
const PW = 302;
const PH = 180;
const PANELS = [
  { id: 'list', title: 'List', x: 12, y: 12 },
  { id: 'set', title: 'Set', x: 326, y: 12 },
  { id: 'map', title: 'Map', x: 12, y: 200 },
  { id: 'queue', title: 'Queue / Deque', x: 326, y: 200 },
];

function ListShape({ x, y, hl }) {
  return ['T1', 'T2', 'T3', 'T4', 'T5'].map((t, i) => {
    const cx = x + 14 + i * 56;
    return (
      <g key={t}>
        <rect x={cx} y={y + 58} width="50" height="34" rx="5" className={cellClass({ t, tone: hl && i === 2 ? 'ok' : undefined })} />
        <text x={cx + 25} y={y + 80} textAnchor="middle" className="coll-text">{t}</text>
        <text x={cx + 25} y={y + 108} textAnchor="middle" className="coll-idx">{i}</text>
      </g>
    );
  });
}

function SetShape({ x, y, hl }) {
  const cx = x + 112;
  const cy = y + 84;
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx="98" ry="30" className="coll-set" />
      {['ACC-1', 'ACC-7', 'ACC-3'].map((t, i) => (
        <text key={t} x={cx - 58 + i * 58} y={cy + 5} textAnchor="middle" className="coll-text-sm" style={hl && t === 'ACC-7' ? { fill: 'var(--color-ok)' } : undefined}>
          {t}
        </text>
      ))}
      <rect x={x + 222} y={y + 70} width="66" height="28" rx="5" className={cellClass({ t: 'x', tone: 'bad' })} />
      <text x={x + 255} y={y + 89} textAnchor="middle" className="coll-text-sm">ACC-7</text>
      <text x={x + 255} y={y + 114} textAnchor="middle" className="coll-label" style={{ fill: 'var(--color-bad)' }}>add() is false</text>
    </g>
  );
}

function MapShape({ x, y, hl }) {
  const rows = [
    ['ACC-1', '1 200.00'],
    ['ACC-2', '560.50'],
    ['ACC-3', '75.00'],
  ];
  return rows.map(([k, v], i) => {
    const ry = y + 52 + i * 22;
    const tone = hl && i === 1 ? 'ok' : undefined;
    return (
      <g key={k}>
        <rect x={x + 14} y={ry} width="96" height="19" rx="4" className={cellClass({ t: k, tone })} />
        <text x={x + 62} y={ry + 14} textAnchor="middle" className="coll-text-sm">{k}</text>
        <text x={x + 123} y={ry + 14} textAnchor="middle" className="coll-text-sm">→</text>
        <rect x={x + 136} y={ry} width="110" height="19" rx="4" className={cellClass({ t: v, tone })} />
        <text x={x + 191} y={ry + 14} textAnchor="middle" className="coll-text-sm">{v}</text>
      </g>
    );
  });
}

function QueueShape({ x, y, hl, id }) {
  return (
    <g>
      <rect x={x + 44} y={y + 62} width="214" height="36" rx="8" className="coll-pipe" />
      {['Tx A', 'Tx B', 'Tx C', 'Tx D'].map((t, i) => (
        <g key={t}>
          <rect x={x + 50 + i * 52} y={y + 66} width="46" height="28" rx="4" className={cellClass({ t, tone: hl && i === 0 ? 'ok' : undefined })} />
          <text x={x + 73 + i * 52} y={y + 85} textAnchor="middle" className="coll-text-sm">{t}</text>
        </g>
      ))}
      <text x={x + 73} y={y + 114} textAnchor="middle" className="coll-idx">head</text>
      <text x={x + 229} y={y + 114} textAnchor="middle" className="coll-idx">tail</text>
      <Arrow id={id} x1={x + 42} y1={y + 80} x2={x + 12} y2={y + 80} tone={hl ? 'ok' : 'none'} />
      <text x={x + 26} y={y + 58} textAnchor="middle" className="coll-op">poll</text>
      <Arrow id={id} x1={x + 292} y1={y + 80} x2={x + 260} y2={y + 80} tone="none" />
      <text x={x + 276} y={y + 58} textAnchor="middle" className="coll-op">offer</text>
    </g>
  );
}

const SHAPES = { list: ListShape, set: SetShape, map: MapShape, queue: QueueShape };

export function ChooseStage({ frames, index, label }) {
  const f = frames[index];
  return (
    <div className="g-stage">
      <Bar f={f} />
      <svg viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <Markers id="coll-choose" />
        {PANELS.map((p) => {
          const d = f.panels[p.id];
          const Shape = SHAPES[p.id];
          return (
            <g key={p.id}>
              <rect x={p.x} y={p.y} width={PW} height={PH} rx="10" className="coll-panel" />
              <text x={p.x + 12} y={p.y + 22} className="coll-title">{p.title}</text>
              {d.op && <text x={p.x + PW - 12} y={p.y + 22} textAnchor="end" className="coll-op">{d.op}</text>}
              <text x={p.x + 12} y={p.y + 42} className="coll-q">{d.q}</text>
              <Shape x={p.x} y={p.y} hl={d.hl} id="coll-choose" />
              <g key={`${index}-${p.id}`} className="g-pop">
                {d.lines.map((ln, i) => (
                  <text key={ln} x={p.x + 12} y={p.y + 138 + i * 15} className="coll-foot">{ln}</text>
                ))}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* ArrayListStage                                                                                     */
/* Frame: { line, result, size, cap, rows: [{ label, cells: [{ t, tone }], dim }], links: 'copy' | 'shift' } */

const AW = 640;
const AH = 268;
const ROW_Y = [118, 204];
const SLOT = { x0: 20, step: 40, w: 36, h: 36 };
const slotX = (i) => SLOT.x0 + i * SLOT.step;

export function ArrayListStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : null;
  const changed = (k) => prev && prev[k] !== f[k];
  return (
    <div className="g-stage">
      <Bar f={f} />
      <svg viewBox={`0 0 ${AW} ${AH}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <Markers id="coll-al" />
        {/* the ArrayList object */}
        <rect x="20" y="14" width="260" height="60" rx="8" className="coll-panel" />
        <text x="32" y="36" className="coll-text">ArrayList&lt;String&gt; list</text>
        <text x="32" y="60" className="coll-text-sm" style={changed('size') ? { fill: 'var(--color-pen)' } : undefined}>size = {f.size}</text>
        <text x="140" y="60" className="coll-text-sm" style={changed('cap') ? { fill: 'var(--color-pen)' } : undefined}>capacity = {f.cap}</text>
        <Arrow id="coll-al" x1={38} y1={76} x2={38} y2={ROW_Y[0] - 1} tone="new" isNew={changed('cap')} />

        {f.rows.map((r, ri) => {
          const y = ROW_Y[ri];
          const right = ri === 1; // the second row has 10 slots, so its label fits to the right of it
          return (
            <g key={`${ri}-${r.label}`} opacity={r.dim ? 0.55 : 1}>
              <text x={right ? slotX(r.cells.length) + 6 : 60} y={right ? y + 22 : y - 8} className="coll-label">{r.label}</text>
              {r.cells.map((c, i) => (
                <g key={i}>
                  <rect x={slotX(i)} y={y} width={SLOT.w} height={SLOT.h} rx="4" className={cellClass(c)} />
                  {c.t && <text x={slotX(i) + SLOT.w / 2} y={y + 23} textAnchor="middle" className="coll-text">{c.t}</text>}
                  {!r.noIndex && <text x={slotX(i) + SLOT.w / 2} y={y + SLOT.h + 14} textAnchor="middle" className="coll-idx">{i}</text>}
                </g>
              ))}
            </g>
          );
        })}

        {/* copy: every old slot goes up into the same index of the new array */}
        {f.links === 'copy' &&
          f.rows[1].cells.map((_, i) => (
            <Arrow key={`c${i}`} id="coll-al" x1={slotX(i) + 7} y1={ROW_Y[1] - 2} x2={slotX(i) + 7} y2={ROW_Y[0] + SLOT.h + 1} tone="ok" width={1.6} isNew />
          ))}
        {/* shift: each element moves one slot to the left */}
        {f.links === 'shift' &&
          f.rows[0].cells.map((c, i) =>
            i > 0 && c.t ? (
              <Arrow key={`s${i}`} id="coll-al" x1={slotX(i) + 12} y1={ROW_Y[0] + SLOT.h + 2} x2={slotX(i - 1) + 24} y2={ROW_Y[1] - 1} tone="warn" width={1.6} isNew />
            ) : null,
          )}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* FailFastStage                                                                                      */
/* Frame: { line, result, cells: [{ t, tone }], cursor, mod, expected, check, banner, options: [{ text, tone }] } */

const FW = 640;
const FH = 252;

export function FailFastStage({ frames, index, label }) {
  const f = frames[index];
  const same = f.mod === f.expected;
  const px = 28 + f.cursor * 64 - 4; // the cursor sits in the gap before slot `cursor`
  return (
    <div className="g-stage">
      <Bar f={f} />
      <svg viewBox={`0 0 ${FW} ${FH}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        {/* the list and the iterator's cursor */}
        <rect x="12" y="12" width="300" height="150" rx="10" className="coll-panel" />
        <text x="24" y="36" className="coll-title">The list</text>
        {f.cells.map((c, i) => (
          <g key={i}>
            <rect x={28 + i * 64} y="54" width="56" height="40" rx="5" className={cellClass(c)} />
            {c.t && <text x={56 + i * 64} y="80" textAnchor="middle" className="coll-text">{c.t}</text>}
          </g>
        ))}
        <g className="coll-move" style={{ transform: `translate(${px}px, 0px)` }}>
          <path d="M0 100 L-7 112 L7 112 Z" fill="var(--color-pen)" />
          <line x1="0" y1="112" x2="0" y2="122" stroke="var(--color-pen)" strokeWidth="2" />
        </g>
        <text x={Math.min(Math.max(px, 70), 250)} y="140" textAnchor="middle" className="coll-op">iterator cursor = {f.cursor}</text>

        {/* the two counters */}
        <rect x="328" y="12" width="300" height="150" rx="10" className="coll-panel" />
        <text x="340" y="36" className="coll-title">The two counters</text>
        <rect x="340" y="50" width="126" height="70" rx="8" className={cellClass({ t: 'm', tone: same ? 'ok' : 'warn' })} />
        <text x="403" y="68" textAnchor="middle" className="coll-label">list.modCount</text>
        <text x="403" y="106" textAnchor="middle" className="coll-big">{f.mod}</text>
        <text x="481" y="96" textAnchor="middle" className="coll-sign" style={{ fill: same ? TONE.ok : TONE.bad }}>{same ? '=' : '≠'}</text>
        <rect x="496" y="50" width="126" height="70" rx="8" className={cellClass({ t: 'e', tone: same ? 'ok' : 'warn' })} />
        <text x="559" y="68" textAnchor="middle" className="coll-label">expectedModCount</text>
        <text x="559" y="106" textAnchor="middle" className="coll-big">{f.expected}</text>
        <text x="478" y="144" textAnchor="middle" className="coll-note">{f.check}</text>

        {/* what happens next */}
        {f.banner && (
          <g key={`b${index}`} className="g-pop">
            <rect x="12" y="176" width="616" height="44" rx="8" className="coll-banner" fill={`var(--color-${f.banner.tone}-soft)`} stroke={TONE[f.banner.tone]} />
            <text x="28" y="203" className="coll-text" style={{ fill: TONE[f.banner.tone] }}>{f.banner.text}</text>
          </g>
        )}
        {f.options &&
          f.options.map((o, i) => (
            <g key={o.text} className="g-pop">
              <circle cx="24" cy={186 + i * 22} r="5" fill={TONE[o.tone]} />
              <text x="36" y={190 + i * 22} className="coll-note">{o.text}</text>
            </g>
          ))}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* SortStage                                                                                          */
/* Frame: { line, result, order: ['t1', ...], key: 'date' | 'amount' | 'both', calc }                 */

const SW = 640;
const SH = 236;
const ROW_H = 34;
const ROW_Y0 = 44;
export const TXNS = {
  t1: { date: '2026-03-02', merchant: 'Grocer', amount: '45.00' },
  t2: { date: '2026-03-05', merchant: 'Rent', amount: '1 200.00' },
  t3: { date: '2026-03-02', merchant: 'Fuel', amount: '80.00' },
  t4: { date: '2026-03-04', merchant: 'Cafe', amount: '12.50' },
  t5: { date: '2026-03-05', merchant: 'Books', amount: '30.00' },
};

function OverflowPanel({ calc }) {
  return (
    <g className="g-pop">
      {calc.map((row, i) => {
        const y = 24 + i * 64;
        return (
          <g key={row.code}>
            <rect x="12" y={y} width="616" height="54" rx="8" className={cellClass({ t: 'x', tone: row.tone })} />
            <text x="26" y={y + 22} className="coll-text">{row.code}</text>
            <text x="26" y={y + 42} className="coll-note">{row.says}</text>
          </g>
        );
      })}
    </g>
  );
}

export function SortStage({ frames, index, label }) {
  const f = frames[index];
  const pos = {};
  f.order.forEach((id, i) => (pos[id] = i));
  const keyDate = f.key === 'date' || f.key === 'both';
  const keyAmount = f.key === 'amount' || f.key === 'both';
  return (
    <div className="g-stage">
      <Bar f={f} />
      <svg viewBox={`0 0 ${SW} ${SH}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        {f.calc ? (
          <OverflowPanel calc={f.calc} />
        ) : (
          <>
            <text x="30" y="32" className="coll-th">#</text>
            <text x="70" y="32" className={`coll-th ${keyDate ? 'is-key' : ''}`}>date{f.key === 'both' ? ' (1st key, newest first)' : ''}</text>
            <text x="330" y="32" className="coll-th">merchant</text>
            <text x="610" y="32" textAnchor="end" className={`coll-th ${keyAmount ? 'is-key' : ''}`}>{f.key === 'both' ? 'amount (2nd key, biggest first)' : 'amount'}</text>
            {[0, 1, 2, 3, 4].map((i) => (
              <text key={i} x="34" y={ROW_Y0 + i * ROW_H + 22} textAnchor="middle" className="coll-idx">{i}</text>
            ))}
            {Object.entries(TXNS).map(([id, t]) => {
              const hl = (f.hl || []).includes(id);
              return (
                <g key={id} className="coll-move" style={{ transform: `translate(0px, ${ROW_Y0 + pos[id] * ROW_H}px)` }}>
                  <rect x="52" y="0" width="576" height={ROW_H - 4} rx="5" className={`coll-row ${hl ? 'is-hl' : ''}`} />
                  <text x="70" y="20" className="coll-text" style={keyDate ? { fill: 'var(--color-pen)' } : undefined}>{t.date}</text>
                  <text x="330" y="20" className="coll-text">{t.merchant}</text>
                  <text x="610" y="20" textAnchor="end" className="coll-text" style={keyAmount ? { fill: 'var(--color-pen)' } : undefined}>{t.amount}</text>
                </g>
              );
            })}
          </>
        )}
      </svg>
    </div>
  );
}
