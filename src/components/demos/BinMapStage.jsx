// A hash map as it really is: an array of 8 bins, each bin pointing to a short chain of nodes. Threads sit
// above the table, and an arrow shows which bin each one reads or writes. A lock can cover one bin
// (ConcurrentHashMap) or the whole table (synchronizedMap). An iterator can walk the bins from left to right.
//
// Frame: { line, result, kind, globalLock: { owner } | null, locks: { [bin]: owner },
//          threads: [{ name, call, status, state, slot, to, how: 'read' | 'cas' | 'write' | 'lock' | 'wait' | 'fail', label }],
//          bins: { [bin]: [{ k, v, tone: 'new' | 'ok' | 'lost' | 'bad' }] }, cursor, note }
import { Bar, Markers, Arrow, StatePill, Padlock, HEAD, TONE, SOFT } from './ConcStageKit.jsx';
import './BinMapStage.css';

const W = 640;
const H = 330;
const N = 8;
const CARD = { xs: [24, 230, 436], y: 12, w: 180, h: 64 };
const TABLE = { x: 12, y: 120, w: 616, h: 198 };
const BIN = { x0: 36, step: 72, y: 150, w: 64, h: 32 };
const NODE = { y0: 200, step: 42, h: 32 };
const HOW = {
  read: { tone: 'ok', width: 2 },
  cas: { tone: 'ok', width: 2.75 },
  write: { tone: 'new', width: 2.75 },
  lock: { tone: 'warn', width: 2.75 },
  wait: { tone: 'bad', width: 2, dashed: true },
  fail: { tone: 'bad', width: 2.25 },
};

const binX = (i) => BIN.x0 + i * BIN.step;

export function BinMapStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : null;
  const locks = f.locks || {};
  const hadNode = (b, n) => prev && (prev.bins[b] || []).some((p) => p.k === n.k && p.v === n.v && p.tone === n.tone);
  const g = f.globalLock;

  return (
    <div className="g-stage bm-stage">
      <Bar line={f.line} result={f.result} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <Markers id="bm-arrow" />

        {/* the table */}
        <rect x={TABLE.x} y={TABLE.y} width={TABLE.w} height={TABLE.h} rx="10" className={`ck-panel ${g ? 'bm-global' : ''}`} />
        <text x={TABLE.x + TABLE.w - 14} y={TABLE.y + TABLE.h - 12} textAnchor="end" className="ck-panel-title">{f.kind}</text>
        {g && (
          <g className="g-pop">
            <Padlock x={TABLE.x + 14} y={TABLE.y + TABLE.h - 28} tone="warn" />
            <text x={TABLE.x + 44} y={TABLE.y + TABLE.h - 14} className="ck-sub" style={{ fill: TONE.warn }}>
              one lock for the whole map: held by {g.owner}
            </text>
          </g>
        )}

        {Array.from({ length: N }, (_, i) => {
          const x = binX(i);
          const nodes = f.bins[i] || [];
          const owner = locks[i];
          const visited = f.cursor != null && i < f.cursor;
          const live = nodes.filter((n) => n.tone !== 'lost');
          return (
            <g key={i} className={visited ? 'bm-visited' : ''}>
              <rect x={x} y={BIN.y} width={BIN.w} height={BIN.h} rx="5" className={`bm-bin ${owner ? 'is-locked' : ''} ${f.cursor === i ? 'is-cursor' : ''}`} />
              <text x={x + 6} y={BIN.y + 13} className="bm-index">{i}</text>
              {owner ? (
                <g className="g-pop">
                  <Padlock x={x + 18} y={BIN.y + 13} w={16} h={12} tone="warn" />
                  <text x={x + 40} y={BIN.y + 24} className="ck-mono-s" style={{ fill: TONE.warn }}>{owner}</text>
                </g>
              ) : (
                live.length === 0 && <text x={x + BIN.w / 2} y={BIN.y + 24} textAnchor="middle" className="ck-small bm-empty">empty</text>
              )}
              {live.length > 0 && <line x1={x + BIN.w / 2} y1={BIN.y + BIN.h - 4} x2={x + BIN.w / 2} y2={NODE.y0} className="bm-link" />}
              {live.length > 0 && <circle cx={x + BIN.w / 2} cy={BIN.y + BIN.h - 4} r="3" className="bm-dot" />}
              {nodes.map((n, j) => {
                const y = NODE.y0 + j * NODE.step;
                const lost = n.tone === 'lost';
                const linked = !lost && j + 1 < nodes.length && nodes[j + 1].tone !== 'lost';
                return (
                  <g key={`${n.k}-${n.v}-${j}`} className={hadNode(i, n) ? '' : 'g-pop'} opacity={lost ? 0.75 : 1}>
                    <rect x={x} y={y} width={BIN.w} height={NODE.h} rx="5" className={`bm-node is-${n.tone || 'none'}`} />
                    <text x={x + BIN.w / 2} y={y + 20} textAnchor="middle" className={`ck-mono-s ${lost ? 'bm-strike' : ''}`}>{n.k}={n.v}</text>
                    {lost && <text x={x + BIN.w / 2} y={y + NODE.h + 13} textAnchor="middle" className="ck-sub" style={{ fill: TONE.bad }}>lost</text>}
                    {linked && <line x1={x + BIN.w / 2} y1={y + NODE.h} x2={x + BIN.w / 2} y2={y + NODE.step} className="bm-link" />}
                  </g>
                );
              })}
            </g>
          );
        })}

        {f.cursor != null && (
          <g className="bm-cursor">
            <path d={`M${binX(f.cursor) + BIN.w / 2} ${TABLE.y + TABLE.h - 40} l-8 12 h16z`} fill={TONE.new} />
            <text x={binX(f.cursor) + BIN.w / 2} y={TABLE.y + TABLE.h - 12} textAnchor="middle" className="ck-sub" style={{ fill: TONE.new }}>iterator is here</text>
          </g>
        )}

        {/* the threads */}
        {f.threads.map((t) => {
          const x = CARD.xs[t.slot];
          return (
            <g key={t.name}>
              <rect x={x} y={CARD.y} width={CARD.w} height={CARD.h} rx="8" className="ck-card" />
              <text x={x + 10} y={CARD.y + 20} className="ck-panel-title">{t.name}</text>
              <StatePill x={x + CARD.w - 8} y={CARD.y + 7} state={t.state} anchor="end" />
              <text x={x + 10} y={CARD.y + 40} className="ck-mono-s">{t.call}</text>
              {t.status && <text x={x + 10} y={CARD.y + 56} className="ck-small">{t.status}</text>}
            </g>
          );
        })}

        {/* thread to bin arrows */}
        {f.threads.filter((t) => t.to != null).map((t) => {
          const x1 = CARD.xs[t.slot] + CARD.w / 2;
          const y1 = CARD.y + CARD.h + 2;
          const x2 = binX(t.to) + BIN.w / 2;
          const y2 = BIN.y - 1 - HEAD;
          const h = HOW[t.how] || HOW.write;
          const before = prev && prev.threads.find((p) => p.name === t.name);
          const isNew = !before || before.to !== t.to || before.how !== t.how;
          return (
            <Arrow
              key={`${t.name}-${t.to}-${t.how}`}
              id="bm-arrow"
              d={`M${x1} ${y1} C${x1} ${y1 + 34} ${x2} ${y2 - 34} ${x2} ${y2}`}
              tone={h.tone}
              dashed={h.dashed}
              width={h.width}
              isNew={isNew}
              label={t.label ? { x: (x1 + x2) / 2, y: (y1 + y2) / 2 + 4, text: t.label } : undefined}
            />
          );
        })}
      </svg>
    </div>
  );
}
