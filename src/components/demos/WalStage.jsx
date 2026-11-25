// Picture for the atomicity and durability scene: the transaction's steps on the left, the data pages in memory
// in the middle, and the disk on the right, holding the write-ahead log (written first) and the data file
// (written later). A crash wipes memory; recovery reads the log and undoes or redoes work in the data file.
//
// Frame: { line, result: { text, tone }, tx: 'T1', steps: ['done' | 'run' | 'todo' | 'skip' | 'undone', x4],
//          mem: { A: [value, tone], B: [value, tone] } | null (crashed), log: [{ id, text, tone }],
//          disk: { A: [value, tone], B: [value, tone] }, arrows: ['A' | 'B'], recover: { kind: 'undo' | 'redo', to: ['A', 'B'] },
//          note }
import './WalStage.css';

const W = 720;
const H = 330;
const HEAD = 10; // arrowhead length
const STEPS = ['BEGIN', 'debit A by 100', 'credit B by 100', 'COMMIT'];
const STEP = { x: 26, y0: 56, gap: 44, w: 182, h: 32 };
const MEM = { x: 286, w: 116, h: 32, y: { A: 100, B: 144 } }; // level with the step that changes it
const LOG = { x: 444, y: 48, w: 250, h: 144, rx: 456, ry0: 76, rgap: 22, rw: 226, rh: 19 };
const DATA = { y: 226, h: 86, cardY: 246, cardH: 32, cardW: 104, x: { A: 460, B: 576 } };
const TONE = { ok: 'var(--color-ok)', bad: 'var(--color-bad)', warn: 'var(--color-warn)', new: 'var(--color-pen)' };

export function WalStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { log: [], arrows: [] };
  const crashed = !f.mem;
  const arrowsBefore = new Set(prev.arrows || []);
  const recoverBefore = prev.recover ? prev.recover.kind : null;
  const recTone = f.recover && f.recover.kind === 'undo' ? 'warn' : 'ok';

  return (
    <div className="g-stage wal-stage">
      <div className="wal-bar">
        <code className="wal-line">{f.line}</code>
        {f.result && (
          <span className="wal-result" style={{ background: TONE[f.result.tone] || TONE.new }}>
            {f.result.text}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          {Object.entries(TONE).map(([k, c]) => (
            <marker key={k} id={`wal-arrow-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0 1L10 5L0 9z" fill={c} />
            </marker>
          ))}
        </defs>

        {/* the transaction and its steps */}
        <rect x="12" y="12" width="210" height={H - 24} rx="10" className="wal-panel" />
        <text x="26" y="36" className="wal-panel-title">Transaction {f.tx}</text>
        {STEPS.map((s, i) => {
          const y = STEP.y0 + i * STEP.gap;
          const st = f.steps[i];
          return (
            <g key={s}>
              <rect x={STEP.x} y={y} width={STEP.w} height={STEP.h} rx="6" className={`wal-step is-${st}`} />
              <text x={STEP.x + 12} y={y + 21} className={`wal-step-text ${st === 'todo' || st === 'skip' ? 'is-dim' : ''}`}>{s}</text>
              {st === 'undone' && <line x1={STEP.x + 10} y1={y + 16} x2={STEP.x + STEP.w - 10} y2={y + 16} className="wal-strike" />}
            </g>
          );
        })}
        <text x="26" y={H - 44} className="wal-sub">Green: done. Struck through: undone.</text>
        <text x="26" y={H - 26} className="wal-sub">Dashed red: never ran.</text>

        {/* memory: fast, but lost on a crash */}
        <rect x="236" y="12" width="180" height={H - 24} rx="10" className={`wal-panel ${crashed ? 'is-crash' : ''}`} />
        <text x="250" y="36" className="wal-panel-title">Memory</text>
        <text x="250" y="56" className="wal-sub">Lost if the server crashes.</text>
        {crashed ? (
          <g className="g-pop">
            <text x="326" y="150" textAnchor="middle" className="wal-crash">CRASH</text>
            <text x="326" y="172" textAnchor="middle" className="wal-crash-sub">Memory is wiped.</text>
          </g>
        ) : (
          ['A', 'B'].map((k) => {
            const [v, tone] = f.mem[k];
            return (
              <g key={k}>
                <rect x={MEM.x} y={MEM.y[k]} width={MEM.w} height={MEM.h} rx="6" className={`wal-card is-${tone || 'none'}`} />
                <text x={MEM.x + MEM.w / 2} y={MEM.y[k] + 21} textAnchor="middle" className="wal-card-text">{k} = {v}</text>
              </g>
            );
          })
        )}
        {/* a step that changes a balance points at that balance in memory */}
        {!crashed &&
          (f.arrows || []).map((k) => {
            const y = MEM.y[k] + MEM.h / 2;
            return (
              <g key={k} className={`g-edge ${arrowsBefore.has(k) ? '' : 'is-new'}`}>
                <path d={`M${STEP.x + STEP.w} ${y} L${MEM.x - 1 - HEAD} ${y}`} pathLength="1" className="g-edge-line" stroke={TONE.new} strokeWidth="2.5" fill="none" markerEnd="url(#wal-arrow-new)" />
              </g>
            );
          })}

        {/* disk: the log and the data file */}
        <rect x="430" y="12" width="278" height={H - 24} rx="10" className="wal-panel" />
        <text x="444" y="36" className="wal-panel-title">Disk</text>
        <rect x={LOG.x} y={LOG.y} width={LOG.w} height={LOG.h} rx="8" className="wal-region" />
        <text x={LOG.rx} y={LOG.y + 18} className="wal-region-title">Write-ahead log: written first</text>
        {f.log.length === 0 && <text x={LOG.rx} y={LOG.ry0 + 14} className="wal-sub">(empty)</text>}
        {f.log.map((r, i) => {
          const y = LOG.ry0 + i * LOG.rgap;
          const isNew = !prev.log.some((p) => p.id === r.id);
          return (
            <g key={r.id} className={isNew ? 'g-pop' : ''}>
              <rect x={LOG.rx} y={y} width={LOG.rw} height={LOG.rh} rx="4" className={`wal-rec is-${r.tone || 'none'}`} />
              <text x={LOG.rx + 8} y={y + 14} className="wal-rec-text">{r.text}</text>
            </g>
          );
        })}

        <rect x={LOG.x} y={DATA.y} width={LOG.w} height={DATA.h} rx="8" className="wal-region" />
        {['A', 'B'].map((k) => {
          const [v, tone] = f.disk[k];
          return (
            <g key={k}>
              <rect x={DATA.x[k]} y={DATA.cardY} width={DATA.cardW} height={DATA.cardH} rx="6" className={`wal-card is-${tone || 'none'}`} />
              <text x={DATA.x[k] + DATA.cardW / 2} y={DATA.cardY + 21} textAnchor="middle" className="wal-card-text">{k} = {v}</text>
            </g>
          );
        })}
        <text x={LOG.rx} y={DATA.y + DATA.h - 12} className="wal-region-title">Data file: pages are written later</text>

        {/* recovery: the log drives the data file, entering each card from above */}
        {f.recover &&
          f.recover.to.map((k) => {
            const x = DATA.x[k] + DATA.cardW / 2;
            return (
              <g key={`${f.recover.kind}-${k}`} className={`g-edge ${recoverBefore === f.recover.kind ? '' : 'is-new'}`}>
                <path d={`M${x} ${LOG.y + LOG.h + 1} L${x} ${DATA.cardY - 1 - HEAD}`} pathLength="1" className="g-edge-line" stroke={TONE[recTone]} strokeWidth="2.5" fill="none" markerEnd={`url(#wal-arrow-${recTone})`} />
              </g>
            );
          })}
        {f.recover && (
          <text x={DATA.x.A + DATA.cardW / 2 + 10} y={LOG.y + LOG.h + 22} className="wal-label" fill={TONE[recTone]}>
            {f.recover.kind}
          </text>
        )}
      </svg>
    </div>
  );
}
