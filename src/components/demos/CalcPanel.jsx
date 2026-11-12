import { bits32 } from '../../sim/hashmap.js';

function Bits({ value, usedLow = 0, dim }) {
  const s = bits32(value);
  const groups = s.match(/.{8}/g);
  return (
    <span className="bits" aria-label={`binary ${s}`} style={dim ? { opacity: 0.55 } : undefined}>
      {groups.map((g, gi) => (
        <span className="grp" key={gi}>
          {[...g].map((c, ci) => {
            const pos = 31 - (gi * 8 + ci);
            return (
              <span key={ci} className={`b ${c === '1' ? 'on' : ''} ${pos < usedLow ? 'used' : ''}`}>
                {c}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

const Row = ({ label, children, value }) => (
  <div className="grid sm:grid-cols-[6.4rem_7.2rem_minmax(0,1fr)] items-center gap-x-2 py-1 border-b border-dashed border-slate-200 last:border-0">
    <div className="text-xs font-bold text-soft leading-tight">{label}</div>
    <div className="font-mono text-[0.78rem] font-bold break-all">{value}</div>
    <div className="min-w-0 overflow-x-auto pb-0.5">{children}</div>
  </div>
);

/** The "key → hashCode → spread → mask → bucket" arithmetic, revealed stage by stage. */
export function CalcPanel({ calc, snap, tags }) {
  if (tags) {
    return (
      <div className="text-sm" aria-hidden="true">
        <div className="font-hand font-bold text-lg text-pen leading-tight">Resizing the table</div>
        <div className="font-mono text-sm my-1">
          capacity {snap.cap} · size {snap.size} · threshold {snap.threshold}
        </div>
        <div className="flex flex-col gap-1 mt-2 text-xs">
          <span>
            <span className="inline-block w-3 h-3 align-middle mr-1 rounded-sm" style={{ background: 'var(--color-lo)' }} />
            <b>lo</b>: <code>hash &amp; oldCap == 0</code> → stays at the same index
          </span>
          <span>
            <span className="inline-block w-3 h-3 align-middle mr-1 rounded-sm" style={{ background: 'var(--color-hi-move)' }} />
            <b>hi</b>: <code>hash &amp; oldCap != 0</code> → moves to index + oldCap
          </span>
        </div>
      </div>
    );
  }
  if (!calc) {
    return (
      <div className="text-sm text-soft">
        <div className="font-hand font-bold text-lg text-pen leading-tight">Hash → bucket</div>
        <p className="mt-1">
          HashMap size <b>{snap.size}</b> · capacity <b>{snap.cap}</b> · resize at <b>{snap.threshold}</b>.
          {snap.size === 0 && (
            <>
              <br />
              Press <b>Play</b> and watch how each key finds its bucket.
            </>
          )}
        </p>
      </div>
    );
  }
  const k = Math.log2(calc.cap);
  const s = calc.stage;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-hand font-bold text-lg text-pen leading-tight">Hash → bucket</div>
        <div className="text-xs text-soft font-mono">
          size {snap.size} · cap {snap.cap} · resize at {snap.threshold}
        </div>
      </div>
      <Row label="key" value={calc.label} />
      <Row label="hashCode()" value={calc.raw}>
        <Bits value={calc.raw} />
      </Row>
      {s >= 2 && (
        <>
          <Row label="h >>> 16" value={calc.high}>
            <Bits value={calc.high} dim />
          </Row>
          <Row label="h ^ (h >>> 16)" value={calc.spread}>
            <Bits value={calc.spread} usedLow={s >= 3 ? k : 0} />
          </Row>
        </>
      )}
      {s >= 3 && (
        <Row label={`& (n-1) = ${calc.cap - 1}`} value={<span className="text-pen">→ bucket {calc.idx}</span>}>
          <Bits value={calc.cap - 1} usedLow={k} />
        </Row>
      )}
    </div>
  );
}
