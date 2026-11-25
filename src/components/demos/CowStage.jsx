// CopyOnWriteArrayList as memory: the list holds one volatile reference to an array that is never changed in
// place. A reader iterates the array it saw when it started (its snapshot). A writer copies the array, changes
// the copy, then swings the list's reference to the copy. Order of the cards (reader, list, writer) keeps the
// arrows from crossing.
//
// Frame: { line, result, list: 'v1' | 'v2', reader: { state, status, on, at }, writer: { state, call, status, to },
//          arrays: { v1: { cells, garbage }, v2: { cells, fresh } | null }, copy, note }
import { Bar, Markers, Arrow, StatePill, HEAD, TONE } from './ConcStageKit.jsx';
import './CowStage.css';

const W = 640;
const H = 300;
const CARD = { x: 24, w: 190, h: 70 };
const READER_Y = 22;
const LIST_Y = 116;
const WRITER_Y = 210;
const ARR = { x: 306, cw: 60, h: 40, y: { v1: 52, v2: 222 } };

export function CowStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : null;
  const toArr = (v, dy) => ({ x: ARR.x - 1 - HEAD, y: ARR.y[v] + ARR.h / 2 + dy });
  const x1 = CARD.x + CARD.w + 2;

  const arrow = (key, y1, v, dy, tone, text, changed) => {
    const t = toArr(v, dy);
    return (
      <Arrow
        key={key}
        id="cw-arrow"
        d={`M${x1} ${y1} C${x1 + 36} ${y1} ${t.x - 36} ${t.y} ${t.x} ${t.y}`}
        tone={tone}
        isNew={changed}
        width={2.5}
        label={{ x: (x1 + t.x) / 2, y: (y1 + t.y) / 2 - 7, text }}
      />
    );
  };

  return (
    <div className="g-stage cw-stage">
      <Bar line={f.line} result={f.result} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <Markers id="cw-arrow" />

        {/* reader thread */}
        <rect x={CARD.x} y={READER_Y} width={CARD.w} height={CARD.h} rx="8" className="ck-card" />
        <text x={CARD.x + 10} y={READER_Y + 20} className="ck-panel-title">Reader thread</text>
        <StatePill x={CARD.x + CARD.w - 8} y={READER_Y + 7} state={f.reader.state} anchor="end" />
        <text x={CARD.x + 10} y={READER_Y + 40} className="ck-mono-s">for (L l : listeners)</text>
        <text x={CARD.x + 10} y={READER_Y + 57} className="ck-small">{f.reader.status}</text>

        {/* the list object: one volatile field */}
        <rect x={CARD.x} y={LIST_Y} width={CARD.w} height={CARD.h} rx="8" className="ck-card cw-list" />
        <text x={CARD.x + 10} y={LIST_Y + 20} className="ck-panel-title">listeners</text>
        <text x={CARD.x + 10} y={LIST_Y + 38} className="ck-small">CopyOnWriteArrayList</text>
        <text x={CARD.x + 10} y={LIST_Y + 57} className="ck-mono-s">volatile Object[] array</text>

        {/* writer thread */}
        <rect x={CARD.x} y={WRITER_Y} width={CARD.w} height={CARD.h} rx="8" className="ck-card" />
        <text x={CARD.x + 10} y={WRITER_Y + 20} className="ck-panel-title">Writer thread</text>
        <StatePill x={CARD.x + CARD.w - 8} y={WRITER_Y + 7} state={f.writer.state} anchor="end" />
        <text x={CARD.x + 10} y={WRITER_Y + 40} className="ck-mono-s">{f.writer.call}</text>
        <text x={CARD.x + 10} y={WRITER_Y + 57} className="ck-small">{f.writer.status}</text>

        {/* the arrays */}
        {['v1', 'v2'].map((v) => {
          const a = f.arrays[v];
          if (!a) return null;
          const y = ARR.y[v];
          const current = f.list === v;
          const isNewArr = !prev || !prev.arrays[v];
          return (
            <g key={v} className={`${isNewArr ? 'g-pop' : ''} ${a.garbage ? 'cw-garbage' : ''}`}>
              <text x={ARR.x} y={y - 9} className="ck-sub">
                array {v}{current ? ' (current)' : ''}{a.garbage ? ': no references left, so garbage' : ''}
              </text>
              {a.cells.map((c, i) => {
                const reading = f.reader.on === v && f.reader.at === i;
                const fresh = a.fresh === i;
                return (
                  <g key={i}>
                    <rect x={ARR.x + i * ARR.cw} y={y} width={ARR.cw} height={ARR.h} className={`cw-cell ${reading ? 'is-reading' : ''} ${fresh ? 'is-fresh' : ''}`} />
                    <text x={ARR.x + i * ARR.cw + ARR.cw / 2} y={y + 25} textAnchor="middle" className="ck-mono">{c}</text>
                  </g>
                );
              })}
              {f.reader.on === v && f.reader.at != null && (
                <text x={ARR.x + f.reader.at * ARR.cw + ARR.cw / 2} y={y + ARR.h + 15} textAnchor="middle" className="ck-sub" style={{ fill: TONE.new }}>
                  reader is here
                </text>
              )}
            </g>
          );
        })}

        {/* the copy: each element goes into the new array */}
        {f.copy && f.arrays.v2 && (
          <g className="g-pop">
            {f.arrays.v1.cells.map((_, i) => {
              const x = ARR.x + i * ARR.cw + ARR.cw / 2;
              return <line key={i} x1={x + 12} y1={ARR.y.v1 + ARR.h + 22} x2={x + 12} y2={ARR.y.v2 - 24 - HEAD} className="cw-copy" markerEnd="url(#cw-arrow-warn)" />;
            })}
            <text x={ARR.x + f.arrays.v1.cells.length * ARR.cw + 14} y={(ARR.y.v1 + ARR.y.v2 + ARR.h) / 2 + 4} className="ck-sub" style={{ fill: TONE.warn }}>
              copy every element
            </text>
          </g>
        )}

        {/* references */}
        {f.reader.on && arrow('reader', READER_Y + CARD.h / 2, f.reader.on, -8, 'new', 'snapshot', !prev || prev.reader.on !== f.reader.on)}
        {arrow('list', LIST_Y + CARD.h - 13, f.list, f.list === 'v1' ? 8 : -8, 'ok', 'array', !prev || prev.list !== f.list)}
        {f.writer.to && arrow('writer', WRITER_Y + CARD.h / 2, f.writer.to, 8, 'warn', 'writes', !prev || prev.writer.to !== f.writer.to)}
      </svg>
    </div>
  );
}
