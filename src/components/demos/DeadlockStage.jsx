// Deadlock as a picture: Thread 1 on the left, Thread 2 on the right, the lock of account A at the top and
// the lock of account B at the bottom. A solid arrow means "holds", a dashed arrow means "waits for".
// When the four arrows form a circle, nobody can move.
//
// Frame: { line, result, threads: [{ name, state, doing, doing2 }], locks: { A: owner, B: owner } (1, 2 or null),
//          edges: [{ t: 1 | 2, lock: 'A' | 'B', kind: 'hold' | 'wait', tone }], cycle, note }
import { Bar, Markers, Arrow, StatePill, Padlock, HEAD, TONE, SOFT } from './ConcStageKit.jsx';
import './DeadlockStage.css';

const W = 640;
const H = 300;
const TH = [{ x: 16, y: 115 }, { x: 464, y: 115 }];
const TW = 160;
const THH = 70;
const LK = { A: { x: 255, y: 18 }, B: { x: 255, y: 222 } };
const LW = 130;
const LH = 60;
const T_TONE = ['new', 'warn'];

export function DeadlockStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : null;
  const had = (e) => prev && prev.edges.some((p) => p.t === e.t && p.lock === e.lock && p.kind === e.kind);

  return (
    <div className="g-stage dl-stage">
      <Bar line={f.line} result={f.result} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <Markers id="dl-arrow" />

        {/* the two account locks */}
        {['A', 'B'].map((k) => {
          const p = LK[k];
          const owner = f.locks[k];
          const tone = owner == null ? 'none' : T_TONE[owner - 1];
          return (
            <g key={k}>
              <rect x={p.x} y={p.y} width={LW} height={LH} rx="8" className="dl-lock" style={{ fill: SOFT[tone], stroke: TONE[tone] }} />
              <Padlock x={p.x + 12} y={p.y + 14} tone={tone} open={owner == null} />
              <text x={p.x + 44} y={p.y + 26} className="ck-sub">account {k}</text>
              <text x={p.x + 12} y={p.y + 49} className="ck-small" style={{ fill: TONE[tone] }}>
                {owner == null ? 'lock is free' : `held by Thread ${owner}`}
              </text>
            </g>
          );
        })}

        {/* the two threads */}
        {f.threads.map((t, i) => {
          const p = TH[i];
          return (
            <g key={t.name}>
              <rect x={p.x} y={p.y} width={TW} height={THH} rx="8" className="ck-card" style={{ stroke: TONE[T_TONE[i]], strokeWidth: 2 }} />
              <text x={p.x + 10} y={p.y + 21} className="ck-panel-title" style={{ fill: TONE[T_TONE[i]] }}>{t.name}</text>
              <StatePill x={p.x + TW - 8} y={p.y + 8} state={t.state} anchor="end" />
              <text x={p.x + 10} y={p.y + 44} className="ck-mono-s">{t.doing}</text>
              {t.doing2 && <text x={p.x + 10} y={p.y + 60} className="ck-small">{t.doing2}</text>}
            </g>
          );
        })}

        {/* holds and waits-for arrows; left thread to the left side of each lock, right thread to the right side */}
        {f.edges.map((e) => {
          const left = e.t === 1;
          const th = TH[e.t - 1];
          const lk = LK[e.lock];
          const x1 = left ? th.x + TW + 2 : th.x - 2;
          const y1 = th.y + (e.lock === 'A' ? 18 : THH - 18);
          const x2 = left ? lk.x - 1 - HEAD : lk.x + LW + 1 + HEAD;
          const y2 = lk.y + LH / 2;
          const dx = left ? 36 : -36;
          const d = `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
          const wait = e.kind === 'wait';
          const tone = e.tone || (wait ? 'bad' : T_TONE[e.t - 1]);
          return (
            <Arrow
              key={`${e.t}-${e.lock}-${e.kind}`}
              id="dl-arrow"
              d={d}
              tone={tone}
              dashed={wait}
              isNew={!had(e)}
              width={wait ? 2 : 2.75}
              label={{ x: (x1 + x2) / 2, y: (y1 + y2) / 2 + (e.lock === 'A' ? -4 : 12), text: wait ? 'waits for' : 'holds' }}
            />
          );
        })}

        {f.cycle && (
          <g className="g-pop">
            {/* a circular arrow in the middle of the four arrows */}
            <path d="M320 120 A20 20 0 1 1 302.7 130" fill="none" stroke={TONE.bad} strokeWidth="2.5" markerEnd="url(#dl-arrow-bad)" />
            <text x="320" y="184" textAnchor="middle" className="ck-sub" style={{ fill: TONE.bad }}>circular wait</text>
            <text x="320" y="200" textAnchor="middle" className="ck-small" style={{ fill: TONE.bad }}>nobody can move</text>
          </g>
        )}
      </svg>
    </div>
  );
}
