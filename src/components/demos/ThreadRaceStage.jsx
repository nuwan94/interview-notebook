// Two threads and one shared field: each thread panel shows its code with the current line, its own local
// variable tmp (on its own stack), the heap in the middle holds the shared count (and the lock, when there is
// one), arrows show a read or a write, and a strip at the bottom lists the steps in the order they happened.
//
// Frame: { line, result, code: [..], threads: [{ name, state, at, tmp }], count: { value, tone },
//          lock: { owner: 0 | 1 | null, waiting: 0 | 1 | null } | undefined,
//          arrow: { thread: 0 | 1, dir: 'read' | 'write', label } | null, steps: [{ t: 0 | 1, text }], note }
import { Bar, Markers, Arrow, StatePill, Padlock, HEAD, TONE, SOFT } from './ConcStageKit.jsx';
import './ThreadRaceStage.css';

const W = 640;
const H = 300;
const PANEL = [{ x: 12, w: 200 }, { x: 428, w: 200 }];
const HEAP = { x: 228, w: 184 };
const TMP = { w: 150, y: 164, h: 34 };
const COUNT = { x: 270, w: 100, y: 164, h: 34 };
const LOCK = { x: 290, y: 64, w: 60, h: 40 };
const CODE = { y: 50, lh: 22 };
const T_TONE = ['new', 'warn']; // Thread A is teal, Thread B is amber

const tmpX = (t) => (t === 0 ? PANEL[0].x + 12 : PANEL[1].x + PANEL[1].w - 12 - TMP.w);

export function ThreadRaceStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : null;
  const midY = TMP.y + TMP.h / 2;

  // the read or write arrow between a thread's tmp and the shared count
  let arrow = null;
  if (f.arrow) {
    const t = f.arrow.thread;
    const left = t === 0;
    const tmpEdge = left ? tmpX(0) + TMP.w : tmpX(1);
    const countEdge = left ? COUNT.x : COUNT.x + COUNT.w;
    const read = f.arrow.dir === 'read';
    // the path stops one head-length before the box it points at
    const from = read ? countEdge + (left ? -2 : 2) : tmpEdge + (left ? 2 : -2);
    const to = read ? tmpEdge + (left ? 1 + HEAD : -1 - HEAD) : countEdge + (left ? -1 - HEAD : 1 + HEAD);
    const isNew = !prev || JSON.stringify(prev.arrow) !== JSON.stringify(f.arrow);
    arrow = (
      <Arrow
        id="tr-arrow"
        d={`M${from} ${midY} L${to} ${midY}`}
        tone={read ? 'ok' : T_TONE[t]}
        isNew={isNew}
        width={2.5}
        label={{ x: (from + to) / 2, y: midY - 9, text: f.arrow.label }}
      />
    );
  }

  // chips for the steps so far
  let cx = 24;
  const chips = (f.steps || []).map((s, i) => {
    const w = s.text.length * 6.6 + 30;
    const x = cx;
    cx += w + 6;
    const isNew = !prev || i >= (prev.steps || []).length;
    return (
      <g key={i} className={isNew ? 'g-pop' : ''}>
        <rect x={x} y={262} width={w} height={24} rx="6" fill={SOFT[T_TONE[s.t]]} stroke={TONE[T_TONE[s.t]]} strokeWidth="1.5" />
        <text x={x + 8} y={278} className="ck-mono-s" fill={TONE[T_TONE[s.t]]}>{s.t === 0 ? 'A' : 'B'}</text>
        <text x={x + 20} y={278} className="ck-mono-s">{s.text}</text>
      </g>
    );
  });

  return (
    <div className="g-stage tr-stage">
      <Bar line={f.line} result={f.result} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <Markers id="tr-arrow" />

        {/* the two threads, each with its own stack */}
        {f.threads.map((t, i) => {
          const p = PANEL[i];
          return (
            <g key={t.name}>
              <rect x={p.x} y="12" width={p.w} height="214" rx="10" className="ck-panel" style={{ stroke: TONE[T_TONE[i]] }} />
              <text x={p.x + 12} y="34" className="ck-panel-title" fill={TONE[T_TONE[i]]}>{t.name}</text>
              <StatePill x={p.x + p.w - 10} y={21} state={t.state} anchor="end" />
              {f.code.map((ln, j) => {
                const y = CODE.y + j * CODE.lh;
                const here = t.at === j;
                return (
                  <g key={j}>
                    {here && <rect x={p.x + 8} y={y} width={p.w - 16} height={CODE.lh - 2} rx="4" className="tr-here" />}
                    {here && <path d={`M${p.x + 2} ${y + 4} l7 6 l-7 6z`} fill={TONE[T_TONE[i]]} />}
                    <text x={p.x + 14} y={y + 15} className={`ck-mono-s ${here ? '' : 'tr-code-dim'}`} xmlSpace="preserve">{ln}</text>
                  </g>
                );
              })}
              <text x={tmpX(i)} y={TMP.y - 7} className="ck-small">local variable, own stack</text>
              <rect x={tmpX(i)} y={TMP.y} width={TMP.w} height={TMP.h} rx="6" className="ck-card" />
              <text x={tmpX(i) + 12} y={TMP.y + 22} className="ck-mono">int tmp = {t.tmp ?? '?'}</text>
            </g>
          );
        })}

        {/* the heap: the shared count, and the lock when the scene has one */}
        <rect x={HEAP.x} y="12" width={HEAP.w} height="214" rx="10" className="ck-panel" />
        <text x={HEAP.x + 12} y="34" className="ck-panel-title">Heap: shared</text>
        {f.lock && (() => {
          const o = f.lock.owner;
          const tone = o == null ? 'none' : T_TONE[o];
          return (
            <g>
              <rect x={LOCK.x} y={LOCK.y} width={LOCK.w} height={LOCK.h} rx="8" fill={SOFT[tone]} stroke={TONE[tone]} strokeWidth="2" className="tr-lock" />
              <Padlock x={LOCK.x + 19} y={LOCK.y + 16} tone={tone} open={o == null} />
              <text x={HEAP.x + HEAP.w / 2} y={LOCK.y - 8} textAnchor="middle" className="ck-sub">lock</text>
              <text x={HEAP.x + HEAP.w / 2} y={LOCK.y + LOCK.h + 16} textAnchor="middle" className="ck-sub" fill={TONE[tone]}>
                {o == null ? 'free' : `held by ${o === 0 ? 'A' : 'B'}`}
              </text>
              {f.lock.waiting != null && (() => {
                const w = f.lock.waiting;
                const left = w === 0;
                const x1 = left ? PANEL[0].x + PANEL[0].w - 4 : PANEL[1].x + 4;
                const x2 = left ? LOCK.x - 1 - HEAD : LOCK.x + LOCK.w + 1 + HEAD;
                const y = LOCK.y + LOCK.h / 2;
                return (
                  <Arrow id="tr-arrow" d={`M${x1} ${y} L${x2} ${y}`} tone="bad" dashed width={2} label={{ x: (x1 + x2) / 2, y: y - 8, text: 'waits' }} />
                );
              })()}
            </g>
          );
        })()}
        <text x={COUNT.x + COUNT.w / 2} y={COUNT.y - 7} textAnchor="middle" className="ck-small">shared field</text>
        <rect
          key={`c-${f.count.value}`}
          x={COUNT.x}
          y={COUNT.y}
          width={COUNT.w}
          height={COUNT.h}
          rx="6"
          className={`ck-card ${prev && prev.count.value !== f.count.value ? 'g-pop' : ''}`}
          style={f.count.tone ? { fill: SOFT[f.count.tone], stroke: TONE[f.count.tone], strokeWidth: 2.5 } : undefined}
        />
        <text x={COUNT.x + COUNT.w / 2} y={COUNT.y + 22} textAnchor="middle" className="ck-mono">count = {f.count.value}</text>

        {arrow}

        {/* the order in which the steps happened */}
        <text x="24" y="252" className="ck-sub">Steps, in the order they ran:</text>
        {chips.length === 0 && <text x="24" y="278" className="ck-small tr-none">(nothing has run yet)</text>}
        {chips}
      </svg>
    </div>
  );
}
