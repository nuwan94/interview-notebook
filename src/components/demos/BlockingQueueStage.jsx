// A bounded BlockingQueue between a producer and its consumers: the queue is a row of fixed slots, items go in
// on the left and come out on the right. A solid arrow is a put or take that happened; a dashed arrow is a
// thread that is waiting (put on a full queue, take on an empty one).
//
// Frame: { line, result, producer: { name, call, status, state, arrow: 'put' | 'wait' | null, label },
//          queue: { title, cap, items: [{ id, text, tone }] },
//          consumers: [{ name, call, status, state, arrow: 'take' | 'wait' | null, label }], note }
import { Bar, Markers, Arrow, StatePill, HEAD, TONE, SOFT } from './ConcStageKit.jsx';
import './BlockingQueueStage.css';

const W = 640;
const H = 210;
const PROD = { x: 12, y: 80, w: 156, h: 70 };
const SLOT = { x0: 214, w: 46, step: 48, y: 95, h: 40 };
const CONS = { x: 466, w: 162, h: 66, ys: { 1: [82], 2: [36, 124] } };
const MID = SLOT.y + SLOT.h / 2;

function Card({ x, y, w, h, t }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="8" className="ck-card" />
      <text x={x + 10} y={y + 20} className="ck-panel-title">{t.name}</text>
      <StatePill x={x + w - 8} y={y + 7} state={t.state} anchor="end" />
      <text x={x + 10} y={y + 40} className="ck-mono-s">{t.call}</text>
      {t.status && <text x={x + 10} y={y + 56} className="ck-small">{t.status}</text>}
    </g>
  );
}

export function BlockingQueueStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : null;
  const q = f.queue;
  const qRight = SLOT.x0 + (q.cap - 1) * SLOT.step + SLOT.w;
  const full = q.items.length >= q.cap;
  const had = (id) => prev && prev.queue.items.some((p) => p.id === id);
  const cys = CONS.ys[f.consumers.length] || CONS.ys[1];
  const same = (a, b) => a && b && a.arrow === b.arrow && a.call === b.call;

  return (
    <div className="g-stage bq-stage">
      <Bar line={f.line} result={f.result} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <Markers id="bq-arrow" />

        <Card x={PROD.x} y={PROD.y} w={PROD.w} h={PROD.h} t={f.producer} />

        {/* the queue: fixed slots, the head (next out) on the right */}
        <text x={SLOT.x0} y={SLOT.y - 12} className="ck-sub">{q.title}</text>
        {Array.from({ length: q.cap }, (_, i) => (
          <rect key={i} x={SLOT.x0 + i * SLOT.step} y={SLOT.y} width={SLOT.w} height={SLOT.h} rx="5" className={`bq-slot ${full ? 'is-full' : ''}`} />
        ))}
        {q.items.map((it, k) => {
          const slot = q.cap - 1 - k; // the oldest item sits at the head, on the right
          const x = SLOT.x0 + slot * SLOT.step;
          const tone = it.tone || 'warn';
          return (
            <g key={it.id} className={had(it.id) ? '' : 'g-pop'}>
              <rect x={x + 4} y={SLOT.y + 6} width={SLOT.w - 8} height={SLOT.h - 12} rx="4" style={{ fill: SOFT[tone], stroke: TONE[tone], strokeWidth: 1.5 }} />
              <text x={x + SLOT.w / 2} y={SLOT.y + 25} textAnchor="middle" className="ck-mono-s">{it.text}</text>
            </g>
          );
        })}
        <text x={SLOT.x0} y={SLOT.y + SLOT.h + 16} className="ck-small">in (tail)</text>
        <text x={qRight} y={SLOT.y + SLOT.h + 16} textAnchor="end" className="ck-small">out (head)</text>
        <text x={(SLOT.x0 + qRight) / 2} y={SLOT.y + SLOT.h + 36} textAnchor="middle" className="ck-sub" style={{ fill: full ? TONE.bad : q.items.length === 0 ? TONE.warn : '#3d4a5c' }}>
          {q.items.length} of {q.cap} slots used{full ? ': full' : q.items.length === 0 ? ': empty' : ''}
        </text>

        {f.consumers.map((c, i) => (
          <Card key={c.name} x={CONS.x} y={cys[i]} w={CONS.w} h={CONS.h} t={c} />
        ))}

        {/* producer to the tail of the queue */}
        {f.producer.arrow && (() => {
          const x1 = PROD.x + PROD.w + 2;
          const x2 = SLOT.x0 - 1 - HEAD;
          const wait = f.producer.arrow === 'wait';
          return (
            <Arrow
              key={`p-${f.producer.arrow}-${f.producer.call}`}
              id="bq-arrow"
              d={`M${x1} ${MID} L${x2} ${MID}`}
              tone={wait ? 'bad' : 'ok'}
              dashed={wait}
              isNew={!same(prev && prev.producer, f.producer)}
              label={{ x: (x1 + x2) / 2, y: MID - 8, text: f.producer.label || (wait ? 'waits' : 'put') }}
            />
          );
        })()}

        {/* head of the queue to each consumer, or a waiting consumer back to the queue */}
        {f.consumers.map((c, i) => {
          if (!c.arrow) return null;
          const cy = cys[i] + CONS.h / 2;
          const wait = c.arrow === 'wait';
          const before = prev && prev.consumers.find((p) => p.name === c.name);
          const d = wait
            ? `M${CONS.x - 2} ${cy} C${CONS.x - 20} ${cy} ${qRight + 1 + HEAD + 18} ${MID} ${qRight + 1 + HEAD} ${MID}`
            : `M${qRight + 2} ${MID} C${qRight + 20} ${MID} ${CONS.x - 1 - HEAD - 18} ${cy} ${CONS.x - 1 - HEAD} ${cy}`;
          return (
            <Arrow
              key={`c-${c.name}-${c.arrow}-${c.call}`}
              id="bq-arrow"
              d={d}
              tone={wait ? 'warn' : 'ok'}
              dashed={wait}
              isNew={!same(before, c)}
              label={{ x: (qRight + CONS.x) / 2, y: (MID + cy) / 2 - 8, text: c.label || (wait ? 'waits' : 'take') }}
            />
          );
        })}
      </svg>
    </div>
  );
}
