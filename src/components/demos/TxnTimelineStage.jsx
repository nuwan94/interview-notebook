// Timeline picture for concurrent transactions: T1 on the left, T2 on the right, the database in the middle, and
// time running down the page. Each row is one step: a box in the lane of the transaction that acts, the row
// values in the database after the step, and an arrow for a read (database to transaction) or a write
// (transaction to database). Arrows stay inside their own row, so they never cross another box.
//
// Frame: { line, result: { text, tone }, events: [{ id, lane: 1 | 2, text: [line1, line2?],
//          kind: 'read' | 'write' | 'wait' | 'fail' | 'note', tone, db, dbTone }], note }
import './TxnTimelineStage.css';

const W = 724;
const HEAD = 10; // arrowhead length
const LANE = { 1: { x: 30, w: 200 }, 2: { x: 494, w: 200 } };
const DB = { x: 290, w: 144, cellX: 298, cellW: 128 };
const ROW = { y0: 52, gap: 44, h: 36 };
const TONE = { ok: 'var(--color-ok)', bad: 'var(--color-bad)', warn: 'var(--color-warn)', new: 'var(--color-pen)' };
const KIND = {
  read: { tone: 'new', label: 'read' },
  write: { tone: 'new', label: 'write' },
  wait: { tone: 'warn', label: 'waits', dash: '5 4' },
  fail: { tone: 'bad', label: 'rejected' },
};

export function TxnTimelineStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { events: [] };
  const rows = Math.max(...frames.map((x) => x.events.length));
  const H = ROW.y0 + rows * ROW.gap + 8;
  const seen = new Set(prev.events.map((e) => e.id));
  const fresh = new Set(f.events.filter((e) => !seen.has(e.id)).map((e) => e.id));

  return (
    <div className="g-stage txn-stage">
      <div className="txn-bar">
        <code className="txn-line">{f.line}</code>
        {f.result && (
          <span className="txn-result" style={{ background: TONE[f.result.tone] || TONE.new }}>
            {f.result.text}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          {Object.entries(TONE).map(([k, c]) => (
            <marker key={k} id={`txn-arrow-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0 1L10 5L0 9z" fill={c} />
            </marker>
          ))}
        </defs>

        {/* headings, lifelines and the time axis */}
        <text x={LANE[1].x + LANE[1].w / 2} y="28" textAnchor="middle" className="txn-head">Transaction T1</text>
        <text x={DB.x + DB.w / 2} y="28" textAnchor="middle" className="txn-head">Database</text>
        <text x={LANE[2].x + LANE[2].w / 2} y="28" textAnchor="middle" className="txn-head">Transaction T2</text>
        <line x1={LANE[1].x + LANE[1].w / 2} y1="40" x2={LANE[1].x + LANE[1].w / 2} y2={H - 6} className="txn-life" />
        <line x1={LANE[2].x + LANE[2].w / 2} y1="40" x2={LANE[2].x + LANE[2].w / 2} y2={H - 6} className="txn-life" />
        <rect x={DB.x} y="40" width={DB.w} height={H - 46} rx="10" className="txn-db" />
        <line x1="14" y1="44" x2="14" y2={H - 20} className="txn-time-line" markerEnd="url(#txn-arrow-new)" />
        <text x="10" y="38" className="txn-time">time</text>

        {f.events.map((e, i) => {
          const y = ROW.y0 + i * ROW.gap;
          const ln = LANE[e.lane];
          const isNew = fresh.has(e.id);
          const dim = fresh.size > 0 && !isNew;
          const k = KIND[e.kind];
          const cy = y + ROW.h / 2;
          // arrow between the box and the database cell, in this row only
          let path = null;
          if (k) {
            const boxEdge = e.lane === 1 ? ln.x + ln.w : ln.x;
            const cellEdge = e.lane === 1 ? DB.cellX : DB.cellX + DB.cellW;
            const toDb = e.kind !== 'read';
            const from = toDb ? boxEdge : cellEdge;
            const to = toDb ? cellEdge : boxEdge;
            const end = to + (to > from ? -1 - HEAD : 1 + HEAD);
            path = { d: `M${from} ${cy} L${end} ${cy}`, mid: (from + to) / 2 };
          }
          return (
            <g key={e.id} opacity={dim ? 0.5 : 1}>
              <g className={isNew ? 'g-pop' : ''}>
                <rect x={ln.x} y={y} width={ln.w} height={ROW.h} rx="6" className={`txn-box is-${e.tone || 'none'}`} />
                {e.text.length === 1 ? (
                  <text x={ln.x + 10} y={y + 22} className="txn-text is-strong">{e.text[0]}</text>
                ) : (
                  <>
                    <text x={ln.x + 10} y={y + 15} className="txn-text is-strong">{e.text[0]}</text>
                    <text x={ln.x + 10} y={y + 29} className="txn-text">{e.text[1]}</text>
                  </>
                )}
              </g>
              {e.db && (
                <g className={isNew ? 'g-pop' : ''}>
                  <rect x={DB.cellX} y={y + 3} width={DB.cellW} height={ROW.h - 6} rx="5" className={`txn-cell is-${e.dbTone || 'none'}`} />
                  <text x={DB.cellX + DB.cellW / 2} y={y + 23} textAnchor="middle" className="txn-cell-text">{e.db}</text>
                </g>
              )}
              {path && (
                <g className={`g-edge ${isNew && !k.dash ? 'is-new' : ''}`}>
                  <path d={path.d} pathLength="1" className="g-edge-line" stroke={TONE[k.tone]} strokeWidth="2.25" strokeDasharray={k.dash} fill="none" markerEnd={`url(#txn-arrow-${k.tone})`} />
                  <text x={path.mid} y={cy - 7} textAnchor="middle" className="txn-arrow-label" fill={TONE[k.tone]}>{k.label}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
