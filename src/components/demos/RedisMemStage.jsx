// Memory picture for the Redis expiry and eviction scene: a gauge for used memory against maxmemory, the
// eviction policy, and the keys in memory as cards. Each card shows the key, its value and what Redis knows
// about it (TTL, last use, number of reads). A card can be live, new, expired, evicted or rejected, so the
// picture shows which key leaves and why. Optional counters (INFO stats) sit under the cards.
//
// Frame: { line, result: { text, tone }, used, max, usedText, policy, focus: ['k1'],
//          keys: [{ id, name, value, meta: [line1, line2?], state: 'live' | 'new' | 'expired' | 'evicted' | 'rejected', tag }],
//          stats: [{ label, value, tone }], note }
import './RedisMemStage.css';

const W = 680;
const GAUGE = { x: 24, y: 46, w: 632, h: 22 };
const GRID = { x0: 24, y0: 112, cw: 146, ch: 84, gapX: 16, gapY: 16, cols: 4 };
const TONE = { ok: 'var(--color-ok)', bad: 'var(--color-bad)', warn: 'var(--color-warn)', new: 'var(--color-pen)' };
const TAG_TONE = { new: 'new', expired: 'warn', evicted: 'bad', rejected: 'bad', live: 'ok' };

const cellPos = (i) => ({
  x: GRID.x0 + (i % GRID.cols) * (GRID.cw + GRID.gapX),
  y: GRID.y0 + Math.floor(i / GRID.cols) * (GRID.ch + GRID.gapY),
});

export function RedisMemStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { keys: [] };
  const rows = Math.max(...frames.map((x) => Math.ceil(x.keys.length / GRID.cols)));
  const hasStats = frames.some((x) => x.stats && x.stats.length);
  const gridBottom = GRID.y0 + rows * (GRID.ch + GRID.gapY) - GRID.gapY;
  const H = gridBottom + (hasStats ? 70 : 20);
  const focus = new Set(f.focus || []);
  const ratio = Math.min(1, f.used / f.max);
  const full = ratio >= 1;

  return (
    <div className="g-stage rmem-stage">
      <div className="rmem-bar">
        <code className="rmem-line">{f.line}</code>
        {f.result && (
          <span className="rmem-result" style={{ background: TONE[f.result.tone] || TONE.new }}>
            {f.result.text}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <rect x="10" y="8" width={W - 20} height={H - 16} rx="10" className="rmem-panel" />
        <text x="24" y="34" className="rmem-title">Redis memory</text>
        <text x={W - 24} y="34" textAnchor="end" className="rmem-policy">maxmemory-policy: {f.policy}</text>

        {/* gauge: used memory against maxmemory */}
        <rect x={GAUGE.x} y={GAUGE.y} width={GAUGE.w} height={GAUGE.h} rx="6" className="rmem-gauge" />
        <rect x={GAUGE.x} y={GAUGE.y} width={Math.max(8, GAUGE.w * ratio)} height={GAUGE.h} rx="6" className={`rmem-fill ${full ? 'is-full' : ratio > 0.8 ? 'is-high' : ''}`} />
        <text x={GAUGE.x + 10} y={GAUGE.y + 15} className="rmem-gauge-text">{f.usedText}</text>
        <text x={GAUGE.x + GAUGE.w} y={GAUGE.y + GAUGE.h + 16} textAnchor="end" className="rmem-max">maxmemory</text>
        <text x={GAUGE.x} y={GAUGE.y + GAUGE.h + 16} className="rmem-max">0</text>

        {/* the keys */}
        {f.keys.map((k, i) => {
          const p = cellPos(i);
          const before = prev.keys.find((x) => x.id === k.id);
          const changed = !before || before.state !== k.state;
          const dim = focus.size > 0 && !focus.has(k.id);
          const gone = k.state === 'expired' || k.state === 'evicted' || k.state === 'rejected';
          const tag = k.tag;
          const tagTone = TONE[TAG_TONE[k.state] || 'ok'];
          return (
            <g key={k.id} className={changed ? 'g-pop' : ''} opacity={dim ? 0.4 : 1}>
              <rect x={p.x} y={p.y} width={GRID.cw} height={GRID.ch} rx="7" className={`rmem-key is-${k.state} ${focus.has(k.id) ? 'is-focus' : ''}`} />
              <text x={p.x + 10} y={p.y + 20} className={`rmem-key-name ${gone ? 'is-gone' : ''}`}>{k.name}</text>
              <text x={p.x + 10} y={p.y + 38} className="rmem-key-value">{k.value}</text>
              {(k.meta || []).slice(0, 2).map((m, j) => (
                <text key={m} x={p.x + 10} y={p.y + 55 + j * 14} className="rmem-key-meta">{m}</text>
              ))}
              {tag && (
                <g>
                  <rect x={p.x + GRID.cw - 8 - tag.length * 6.6 - 12} y={p.y - 9} width={tag.length * 6.6 + 12} height="18" rx="9" fill={tagTone} />
                  <text x={p.x + GRID.cw - 8 - (tag.length * 6.6 + 12) / 2} y={p.y + 4} textAnchor="middle" className="rmem-tag">{tag}</text>
                </g>
              )}
            </g>
          );
        })}

        {/* counters */}
        {(f.stats || []).map((s, i) => {
          const w = 196;
          const x = GRID.x0 + i * (w + 22);
          const y = gridBottom + 18;
          return (
            <g key={s.label} className="g-pop">
              <rect x={x} y={y} width={w} height="36" rx="7" className={`rmem-stat is-${s.tone || 'none'}`} />
              <text x={x + 10} y={y + 23} className="rmem-stat-label">{s.label}</text>
              <text x={x + w - 10} y={y + 23} textAnchor="end" className="rmem-stat-value">{s.value}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
