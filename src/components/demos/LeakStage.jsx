import './LeakStage.css';

// Memory-leak picture: on top, heap use over time as the GC log reports it (a saw-tooth whose low points,
// the heap after each GC, either climb or stay flat); below, what the heap dump shows at this step.
//
// Frame: { chart: 'leak' | 'fixed', dump: 'none' | 'file' | 'tree' | 'path' | 'fixed', note }

const W = 640;
const H = 380;
const HEAD = 10;
const CHART = { x: 70, y: 52, w: 540, h: 112, max: 4 }; // GB on the y axis
const TONE = { ok: 'var(--color-ok)', bad: 'var(--color-bad)', warn: 'var(--color-warn)', new: 'var(--color-pen)' };

// heap after each GC (the low points) and the peak before it, in GB
const SERIES = {
  leak: { floors: [0.9, 1.5, 2.1, 2.7, 3.3, 3.8], peak: (fl) => Math.min(3.95, fl + 1.6) },
  fixed: { floors: [0.9, 0.95, 0.9, 0.95, 0.9, 0.95], peak: () => 2.5 },
};
const gx = (t) => CHART.x + 14 + t * ((CHART.w - 28) / 6);
const gy = (gb) => CHART.y + CHART.h - (gb / CHART.max) * CHART.h;

function Chart({ kind }) {
  const s = SERIES[kind];
  const pts = [];
  s.floors.forEach((fl, i) => {
    const start = i === 0 ? 0.2 : s.floors[i - 1];
    pts.push([gx(i), gy(start)], [gx(i + 0.92), gy(s.peak(fl))], [gx(i + 1), gy(fl)]);
  });
  const bad = kind === 'leak';
  const floorLine = s.floors.map((fl, i) => `${gx(i + 1)},${gy(fl)}`).join(' ');
  return (
    <g>
      <line x1={CHART.x} y1={CHART.y} x2={CHART.x} y2={CHART.y + CHART.h} className="lk-axis" />
      <line x1={CHART.x} y1={CHART.y + CHART.h} x2={CHART.x + CHART.w} y2={CHART.y + CHART.h} className="lk-axis" />
      <line x1={CHART.x} y1={gy(4)} x2={CHART.x + CHART.w} y2={gy(4)} className="lk-max" />
      <text x={CHART.x - 8} y={gy(4) + 4} textAnchor="end" className="lk-tick">4 GB</text>
      <text x={CHART.x - 8} y={gy(2) + 4} textAnchor="end" className="lk-tick">2 GB</text>
      <text x={CHART.x - 8} y={gy(0) + 4} textAnchor="end" className="lk-tick">0</text>
      <text x={CHART.x + 6} y={gy(4) - 5} className="lk-tick">-Xmx: the heap limit</text>
      <text x={CHART.x + CHART.w} y={CHART.y + CHART.h + 15} textAnchor="end" className="lk-tick">time: one drop = one GC</text>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} className="lk-line" />
      <polyline points={floorLine} className={`lk-floor ${bad ? 'is-bad' : 'is-ok'}`} />
      {s.floors.map((fl, i) => (
        <circle key={i} cx={gx(i + 1)} cy={gy(fl)} r="4.5" className={`lk-dot ${bad ? 'is-bad' : 'is-ok'}`} />
      ))}
      <text x={gx(3.2)} y={bad ? gy(1.1) : gy(0.35)} className={`lk-floor-label ${bad ? 'is-bad' : 'is-ok'}`}>
        {bad ? 'heap after each GC keeps rising: a leak' : 'heap after each GC stays flat: fixed'}
      </text>
    </g>
  );
}

function Card({ x, y, w, title, sub, tone = 'new', isNew }) {
  return (
    <g className={isNew ? 'g-pop' : ''}>
      <rect x={x} y={y} width={w} height="50" rx="7" className={`lk-card tone-${tone}`} />
      <text x={x + 12} y={y + 21} className="lk-card-title">{title}</text>
      <text x={x + 12} y={y + 39} className="lk-card-sub">{sub}</text>
    </g>
  );
}

function Arrow({ x1, x2, y, tone = 'new', label }) {
  return (
    <g className="g-edge is-new">
      <path d={`M${x1} ${y} L${x2 - 1 - HEAD} ${y}`} pathLength="1" className="g-edge-line" stroke={TONE[tone]} strokeWidth="2.25" fill="none" markerEnd={`url(#lk-arrow-${tone})`} />
      {label && <text x={(x1 + x2) / 2} y={y - 8} textAnchor="middle" className="g-edge-label" fill={TONE[tone]}>{label}</text>}
    </g>
  );
}

const TREE = [
  ['PaymentCache.ALL (ConcurrentHashMap)', '3.1 GB', 0.82],
  ['org.apache.tomcat buffers (byte[])', '96 MB', 0.025],
  ['HikariPool connections', '41 MB', 0.011],
  ['Spring application context', '28 MB', 0.008],
];

function Dump({ step }) {
  const top = 222;
  if (step === 'none') {
    return <text x="30" y={top + 30} className="lk-empty">No heap dump yet. The GC log is the first clue.</text>;
  }
  if (step === 'file') {
    return (
      <g>
        <Card x={30} y={top + 10} w={230} title="jcmd 4212 GC.heap_dump" sub="asks the running JVM" isNew />
        <Arrow x1={260} x2={350} y={top + 35} label="writes" />
        <Card x={350} y={top + 10} w={250} title="payments.hprof" sub="every object and reference, 4 GB" tone="ok" isNew />
        <text x="30" y={top + 96} className="lk-hint">Or start the JVM with -XX:+HeapDumpOnOutOfMemoryError.</text>
      </g>
    );
  }
  if (step === 'tree') {
    return (
      <g>
        <text x="30" y={top + 14} className="lk-col">Dominator tree in Eclipse MAT: sorted by retained heap</text>
        {TREE.map(([name, size, share], i) => {
          const y = top + 26 + i * 26;
          return (
            <g key={name} className="g-pop" opacity={i === 0 ? 1 : 0.6}>
              <rect x="30" y={y} width="580" height="22" rx="4" className={`lk-row ${i === 0 ? 'is-top' : ''}`} />
              <rect x="30" y={y} width={Math.max(4, 580 * share)} height="22" rx="4" className={`lk-bar ${i === 0 ? 'is-top' : ''}`} />
              <text x="40" y={y + 16} className="lk-row-text">{name}</text>
              <text x="600" y={y + 16} textAnchor="end" className="lk-row-text">{size}</text>
            </g>
          );
        })}
      </g>
    );
  }
  if (step === 'path') {
    return (
      <g>
        <text x="30" y={top + 14} className="lk-col">Path to GC roots: who keeps the memory alive?</text>
        <Card x={30} y={top + 30} w={170} title="GC root" sub="static PaymentCache.ALL" tone="warn" isNew />
        <Arrow x1={200} x2={240} y={top + 55} tone="warn" />
        <Card x={240} y={top + 30} w={170} title="ConcurrentHashMap" sub="1.2 M entries, no limit" tone="bad" isNew />
        <Arrow x1={410} x2={450} y={top + 55} tone="bad" />
        <Card x={450} y={top + 30} w={160} title="PaymentEvent" sub="1.2 M objects, 3.1 GB" tone="bad" isNew />
      </g>
    );
  }
  return (
    <g>
      <text x="30" y={top + 14} className="lk-col">After the fix: a cache with a size limit and an expiry</text>
      <Card x={30} y={top + 30} w={170} title="PaymentCache bean" sub="no static field" tone="ok" isNew />
      <Arrow x1={200} x2={250} y={top + 55} tone="ok" />
      <Card x={250} y={top + 30} w={210} title="Caffeine cache" sub="max 10 000, expire 10 min" tone="ok" isNew />
      <text x="474" y={top + 52} className="lk-hint">old entries</text>
      <text x="474" y={top + 68} className="lk-hint">are removed</text>
    </g>
  );
}

export function LeakStage({ frames, index, label }) {
  const f = frames[index];
  return (
    <div className="g-stage lk-stage">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          {Object.entries(TONE).map(([k, c]) => (
            <marker key={k} id={`lk-arrow-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0 1L10 5L0 9z" fill={c} />
            </marker>
          ))}
        </defs>
        <rect x="12" y="12" width={W - 24} height="178" rx="10" className="lk-panel" />
        <text x="26" y="36" className="lk-panel-title">GC log: heap used over time</text>
        <Chart key={`chart-${f.chart}`} kind={f.chart} />
        <rect x="12" y="198" width={W - 24} height={H - 210} rx="10" className="lk-panel" />
        <text x="26" y="220" className="lk-panel-title">Heap dump</text>
        <Dump key={`dump-${f.dump}`} step={f.dump} />
      </svg>
    </div>
  );
}
