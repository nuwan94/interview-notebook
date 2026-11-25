// Sequence picture for the Redis invalidation scene: the parts (readers, writers, Redis, the database, a broker)
// are columns with a dashed lifeline, and time runs down the page. Each step is one row: a numbered arrow from
// the part that acts to the part it calls, a label above the arrow, and a chip on the target lifeline with the
// value that part holds after the step. The label sits higher than the chip, so the two never overlap. Arrows stay in their own row, and chips are drawn only on the two ends
// of a row's arrow, so an arrow passes other columns only over their bare lifeline, never over a card.
//
// Frame: { line, result: { text, tone }, cols: [{ id, title, tone }],
//          steps: [{ id, from, to, text, chip, tone }], note }
//   from === to draws a step inside one part (for example "TTL ends"): just the chip and its label.
import './RedisSeqStage.css';

const W = 720;
const X0 = 40; // room on the left for the time axis
const HEAD = 10; // arrowhead length
const ROW = { y0: 90, gap: 52 }; // the label sits above the chip height, so it never covers a chip
const CHIP = { w: 92, h: 24 };
const TONE = { ok: 'var(--color-ok)', bad: 'var(--color-bad)', warn: 'var(--color-warn)', new: 'var(--color-pen)' };

export function RedisSeqStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { steps: [] };
  const rows = Math.max(...frames.map((x) => x.steps.length));
  const H = ROW.y0 + rows * ROW.gap - 16;
  const colW = (W - X0 - 12) / f.cols.length;
  const cx = {};
  f.cols.forEach((c, i) => (cx[c.id] = X0 + colW * (i + 0.5)));
  const seen = new Set(prev.steps.map((s) => s.id));
  const fresh = new Set(f.steps.filter((s) => !seen.has(s.id)).map((s) => s.id));
  const headW = Math.min(colW - 14, 150);

  return (
    <div className="g-stage rseq-stage">
      <div className="rseq-bar">
        <code className="rseq-line">{f.line}</code>
        {f.result && (
          <span className="rseq-result" style={{ background: TONE[f.result.tone] || TONE.new }}>
            {f.result.text}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          {Object.entries(TONE).map(([k, c]) => (
            <marker key={k} id={`rseq-arrow-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0 1L10 5L0 9z" fill={c} />
            </marker>
          ))}
        </defs>

        {/* time axis */}
        <line x1="18" y1="56" x2="18" y2={H - 14 - HEAD} className="rseq-time-line" markerEnd="url(#rseq-arrow-new)" />
        <text x="8" y="48" className="rseq-time">time</text>

        {/* the parts: a heading card and a lifeline each */}
        {f.cols.map((c) => (
          <g key={c.id}>
            <line x1={cx[c.id]} y1="50" x2={cx[c.id]} y2={H - 8} className="rseq-life" />
            <rect x={cx[c.id] - headW / 2} y="12" width={headW} height="36" rx="8" className={`rseq-head is-${c.tone || 'none'}`} />
            <text x={cx[c.id]} y="35" textAnchor="middle" className="rseq-head-text">{c.title}</text>
          </g>
        ))}

        {f.steps.map((s, i) => {
          const y = ROW.y0 + i * ROW.gap;
          const isNew = fresh.has(s.id);
          const dim = fresh.size > 0 && !isNew;
          const tone = s.tone || 'new';
          const a = cx[s.from];
          const b = cx[s.to];
          const self = s.from === s.to;
          const dir = b > a ? 1 : -1;
          // the arrow leaves the number circle and stops one head-length before the chip (or the lifeline)
          const start = a + dir * 11;
          const stop = b - dir * ((s.chip ? CHIP.w / 2 : 0) + 1 + HEAD);
          const mid = (start + stop) / 2; // centre the label on the drawn part of the arrow
          return (
            <g key={s.id} opacity={dim ? 0.45 : 1}>
              {!self && (
                <g className={`g-edge ${isNew ? 'is-new' : ''}`}>
                  <path d={`M${start} ${y} L${stop} ${y}`} pathLength="1" className="g-edge-line" stroke={TONE[tone]} strokeWidth="2.25" fill="none" markerEnd={`url(#rseq-arrow-${tone})`} />
                  <text x={mid} y={y - 17} textAnchor="middle" className="rseq-label" fill={TONE[tone]}>{s.text}</text>
                </g>
              )}
              <g className={isNew ? 'g-pop' : ''}>
                <circle cx={a} cy={y} r="10" className="rseq-num" style={{ stroke: TONE[tone] }} />
                <text x={a} y={y + 4} textAnchor="middle" className="rseq-num-text">{i + 1}</text>
              </g>
              {s.chip && (
                <g className={isNew ? 'g-pop' : ''}>
                  <rect x={b - CHIP.w / 2 + (self ? 18 + CHIP.w / 2 : 0)} y={y - CHIP.h / 2} width={CHIP.w} height={CHIP.h} rx="6" className={`rseq-chip is-${tone}`} />
                  <text x={b + (self ? 18 + CHIP.w / 2 : 0)} y={y + 4.5} textAnchor="middle" className="rseq-chip-text">{s.chip}</text>
                </g>
              )}
              {self && (
                <text x={b + 26 + CHIP.w} y={y + 4.5} className="rseq-label" fill={TONE[tone]}>{s.text}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
