import './CpuStage.css';

// Busy-thread picture: the real terminal output of each step, stacked top to bottom, with an arrow carrying
// the clue from one step to the next: the busy thread id from top, the same id in hexadecimal, the matching
// thread in the dump, and the code its stack names.
//
// Frame: { step: 1..4, note }. Steps before the current one stay visible but dimmed; later ones are hidden.

const W = 640;
const H = 478;
const HEAD = 10;
const X = 24;
const PW = W - 48;

const PANELS = [
  { y: 12, h: 112, cmd: '$ top -H -p 4212' },
  { y: 150, h: 62, cmd: "$ printf '%x\\n' 4377" },
  { y: 238, h: 118, cmd: "$ jcmd 4212 Thread.print | grep -A 4 'nid=0x1119'" },
  { y: 382, h: 84, cmd: 'The cause, in ReferenceCheck.java line 27' },
];

const TOP_ROWS = [
  ['4377', '97.0', 'payment-worker-3', true],
  ['4213', '1.3', 'http-nio-exec-1'],
  ['4290', '0.7', 'G1 Conc#0'],
  ['4402', '0.3', 'http-nio-exec-2'],
];

const DUMP = [
  ['"payment-worker-3" #41 cpu=91234ms nid=0x1119 runnable', 'hit'],
  ['   java.lang.Thread.State: RUNNABLE', ''],
  ['     at java.util.regex.Pattern$Loop.match(Pattern.java:5048)', ''],
  ['     at com.bank.payments.ReferenceCheck.isValid(ReferenceCheck.java:27)', 'code'],
];

function Panel({ i, step, children }) {
  const p = PANELS[i];
  if (step < i + 1) return null;
  const current = step === i + 1;
  return (
    <g className={current ? 'g-pop' : ''} opacity={current ? 1 : 0.5}>
      <rect x={X} y={p.y} width={PW} height={p.h} rx="8" className={`cpu-term ${current ? 'is-current' : ''}`} />
      <text x={X + 12} y={p.y + 20} className="cpu-cmd">{p.cmd}</text>
      {children}
    </g>
  );
}

function Link({ from, label, step }) {
  if (step < from + 2) return null;
  const a = PANELS[from];
  const b = PANELS[from + 1];
  const x = 70;
  return (
    <g className={`g-edge ${step === from + 2 ? 'is-new' : ''}`}>
      <path d={`M${x} ${a.y + a.h + 2} L${x} ${b.y - 1 - HEAD}`} pathLength="1" className="g-edge-line" stroke="var(--color-pen)" strokeWidth="2.5" fill="none" markerEnd="url(#cpu-arrow)" />
      <text x={x + 12} y={(a.y + a.h + b.y) / 2 + 4} className="g-edge-label" fill="var(--color-pen)">{label}</text>
    </g>
  );
}

export function CpuStage({ frames, index, label }) {
  const { step } = frames[index];
  return (
    <div className="g-stage cpu-stage">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="cpu-arrow" viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0 1L10 5L0 9z" fill="var(--color-pen)" />
          </marker>
        </defs>

        <Panel i={0} step={step}>
          <text x={X + 12} y={PANELS[0].y + 40} className="cpu-head">{'  TID   %CPU  THREAD NAME'}</text>
          {TOP_ROWS.map(([tid, cpu, name, hot], r) => {
            const y = PANELS[0].y + 58 + r * 14;
            return (
              <g key={tid}>
                {hot && <rect x={X + 8} y={y - 11} width="300" height="14" rx="3" className="cpu-hit" />}
                <text x={X + 12} y={y} className={`cpu-out ${hot ? 'is-hot' : ''}`}>{`  ${tid}   ${cpu.padStart(4)}  ${name}`}</text>
              </g>
            );
          })}
          <text x={X + PW - 12} y={PANELS[0].y + 58} textAnchor="end" className="cpu-tag">decimal id 4377: 97% CPU</text>
        </Panel>
        <Link from={0} step={step} label="convert the id" />

        <Panel i={1} step={step}>
          <rect x={X + 8} y={PANELS[1].y + 30} width="44" height="18" rx="3" className="cpu-hit" />
          <text x={X + 12} y={PANELS[1].y + 44} className="cpu-out is-hot">1119</text>
          <text x={X + 70} y={PANELS[1].y + 44} className="cpu-tag-left">{'4377 = 1×4096 + 1×256 + 1×16 + 9, so the dump calls it nid=0x1119'}</text>
        </Panel>
        <Link from={1} step={step} label="search the dump" />

        <Panel i={2} step={step}>
          {DUMP.map(([text, kind], r) => {
            const y = PANELS[2].y + 44 + r * 19;
            return (
              <g key={r}>
                {kind && <rect x={X + 8} y={y - 13} width={kind === 'hit' ? 430 : 520} height="18" rx="3" className={kind === 'hit' ? 'cpu-hit' : 'cpu-code'} />}
                <text x={X + 12} y={y} className={`cpu-out ${kind ? 'is-hot' : ''}`}>{text}</text>
              </g>
            );
          })}
        </Panel>
        <Link from={2} step={step} label="read the stack" />

        <Panel i={3} step={step}>
          <text x={X + 12} y={PANELS[3].y + 42} className="cpu-out">{'Pattern.compile("(a+)+$").matcher(reference)'}</text>
          <text x={X + 12} y={PANELS[3].y + 62} className="cpu-tag-left">Nested repetition: each extra character can double the work, so a long input pins a core.</text>
          <text x={X + 12} y={PANELS[3].y + 77} className="cpu-fix">Fix: a simpler pattern and a limit on the input length.</text>
        </Panel>
      </svg>
    </div>
  );
}
