// A ThreadPoolExecutor as a picture: the caller's tasks on the left, the pool in the middle (worker threads
// and the queue), the rejected tasks below it, and the four rules on the right with the one that applied lit.
// An arrow shows where each new task went.
//
// Frame: { line, result, submitted, current: [n], workers: [{ state: 'off' | 'running' | 'idle', task }],
//          queue: [text], rejected: [text], rule: 1..4 | null, arrows: [{ n, to: 'w0' | 'w1' | 'w2' | 'q0' | 'q1' | 'rej' }],
//          note }
import { Bar, Markers, Arrow, StatePill, HEAD, TONE, SOFT } from './ConcStageKit.jsx';
import './ThreadPoolStage.css';

const W = 640;
const H = 330;
const TASKS = 6;
const CHIP = { x: 26, y0: 50, step: 40, w: 120, h: 30 };
const POOL = { x: 186, y: 12, w: 260, h: 260 };
const WK = { x: 204, y0: 60, step: 42, w: 224, h: 34 };
const Q = { y: 210, h: 34, xs: [204, 318], w: 104 };
const REJ = { x: 186, y: 282, w: 260, h: 40 };
const RULES = [
  ['1. Fewer than 2 core', 'threads? Start one.'],
  ['2. Otherwise, put the', 'task in the queue.'],
  ['3. Queue full and fewer', 'than 3 threads? Start', 'an extra thread.'],
  ['4. Otherwise, reject it', '(rejection policy).'],
];
const RX = 466;
const RW = 154;

const chipY = (n) => CHIP.y0 + (n - 1) * CHIP.step;

// where an arrow ends: the path stops one head-length before the box
function target(to) {
  if (to[0] === 'w') {
    const i = Number(to[1]);
    return { x: WK.x - 1 - HEAD, y: WK.y0 + i * WK.step + WK.h / 2 };
  }
  if (to === 'q0') return { x: Q.xs[0] - 1 - HEAD, y: Q.y + Q.h / 2 };
  if (to === 'q1') return { x: Q.xs[1] + Q.w / 2, y: Q.y + Q.h + 1 + HEAD, below: true };
  return { x: REJ.x - 1 - HEAD, y: REJ.y + REJ.h / 2 };
}

export function ThreadPoolStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : null;
  const current = new Set(f.current || []);

  let ry = 48;
  const rules = RULES.map((lines, i) => {
    const h = lines.length * 15 + 12;
    const y = ry;
    ry += h + 8;
    const on = f.rule === i + 1;
    return (
      <g key={i} className={on ? 'tp-rule-on' : ''}>
        <rect x={RX} y={y} width={RW} height={h} rx="6" className="tp-rule" />
        {lines.map((ln, j) => (
          <text key={j} x={RX + 8} y={y + 18 + j * 15} className="ck-small tp-rule-text">{ln}</text>
        ))}
      </g>
    );
  });

  return (
    <div className="g-stage tp-stage">
      <Bar line={f.line} result={f.result} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <Markers id="tp-arrow" />

        {/* the caller and its tasks */}
        <rect x="12" y="12" width="156" height={H - 24} rx="10" className="ck-panel" />
        <text x="24" y="34" className="ck-panel-title">Caller</text>
        {Array.from({ length: TASKS }, (_, k) => {
          const n = k + 1;
          const y = chipY(n);
          const cls = current.has(n) ? 'is-current' : n <= f.submitted ? 'is-sent' : 'is-waiting';
          return (
            <g key={n}>
              <rect x={CHIP.x} y={y} width={CHIP.w} height={CHIP.h} rx="6" className={`tp-chip ${cls}`} />
              <text x={CHIP.x + 12} y={y + 20} className="ck-mono-s">task {n}</text>
              <text x={CHIP.x + CHIP.w - 10} y={y + 20} textAnchor="end" className="ck-small">
                {current.has(n) ? 'execute()' : n <= f.submitted ? 'sent' : 'later'}
              </text>
            </g>
          );
        })}

        {/* the pool: worker threads and the queue */}
        <rect x={POOL.x} y={POOL.y} width={POOL.w} height={POOL.h} rx="10" className="ck-panel" />
        <text x={POOL.x + 14} y="34" className="ck-panel-title">ThreadPoolExecutor</text>
        <text x={WK.x} y="52" className="ck-small">threads: core 2, maximum 3</text>
        {f.workers.map((w, i) => {
          const y = WK.y0 + i * WK.step;
          const before = prev && prev.workers[i];
          const changed = !before || before.task !== w.task || before.state !== w.state;
          return (
            <g key={i} className={changed && w.state !== 'off' ? 'g-pop' : ''}>
              <rect x={WK.x} y={y} width={WK.w} height={WK.h} rx="6" className={`tp-worker is-${w.state} ${i === 2 ? 'is-extra' : ''}`} />
              <text x={WK.x + 10} y={y + 22} className="ck-mono-s">worker {i + 1}</text>
              <text x={WK.x + 82} y={y + 22} className={w.state === 'running' ? 'ck-mono-s' : 'ck-small'}>
                {w.state === 'off' ? (i === 2 ? 'extra, not started' : 'not started') : w.task}
              </text>
              {w.state !== 'off' && <StatePill x={WK.x + WK.w - 8} y={y + 8} state={w.state} anchor="end" />}
            </g>
          );
        })}
        <text x={WK.x} y={Q.y - 8} className="ck-small">queue: ArrayBlockingQueue, capacity 2</text>
        {Q.xs.map((x, i) => {
          const item = f.queue[i];
          const isNew = item && !(prev && prev.queue[i] === item);
          return (
            <g key={i}>
              <rect x={x} y={Q.y} width={Q.w} height={Q.h} rx="6" className="tp-slot" />
              {item ? (
                <g className={isNew ? 'g-pop' : ''}>
                  <rect x={x + 6} y={Q.y + 5} width={Q.w - 12} height={Q.h - 10} rx="4" style={{ fill: SOFT.warn, stroke: TONE.warn, strokeWidth: 1.5 }} />
                  <text x={x + Q.w / 2} y={Q.y + 22} textAnchor="middle" className="ck-mono-s">{item}</text>
                </g>
              ) : (
                <text x={x + Q.w / 2} y={Q.y + 22} textAnchor="middle" className="ck-small tp-empty">empty</text>
              )}
            </g>
          );
        })}

        {/* rejected tasks, outside the pool */}
        <rect x={REJ.x} y={REJ.y} width={REJ.w} height={REJ.h} rx="8" className={`tp-rej ${f.rejected.length ? 'is-full' : ''}`} />
        <text x={REJ.x + 12} y={REJ.y + 25} className="ck-sub">Rejected</text>
        {f.rejected.map((t, i) => (
          <g key={t} className={prev && prev.rejected.includes(t) ? '' : 'g-pop'}>
            <rect x={REJ.x + 84 + i * 80} y={REJ.y + 8} width="70" height="24" rx="4" style={{ fill: SOFT.bad, stroke: TONE.bad, strokeWidth: 1.5 }} />
            <text x={REJ.x + 119 + i * 80} y={REJ.y + 24} textAnchor="middle" className="ck-mono-s">{t}</text>
          </g>
        ))}

        {/* the rules */}
        <rect x="458" y="12" width="170" height={POOL.h} rx="10" className="ck-panel" />
        <text x="470" y="34" className="ck-panel-title">Rules, in order</text>
        {rules}

        {/* where each new task went */}
        {(f.arrows || []).map((a) => {
          const x1 = CHIP.x + CHIP.w + 2;
          const y1 = chipY(a.n) + CHIP.h / 2;
          const t = target(a.to);
          // the second queue slot is entered from below, so the arrow passes under the first slot
          const d = t.below
            ? `M${x1} ${y1} C${x1 + 42} ${y1 + 105} ${t.x} ${y1 + 95} ${t.x} ${t.y}`
            : `M${x1} ${y1} C${x1 + 30} ${y1} ${t.x - 30} ${t.y} ${t.x} ${t.y}`;
          const tone = a.to === 'rej' ? 'bad' : a.to[0] === 'q' ? 'warn' : 'ok';
          return <Arrow key={`${a.n}-${a.to}`} id="tp-arrow" d={d} tone={tone} isNew />;
        })}
      </svg>
    </div>
  );
}
