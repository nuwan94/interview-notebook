// Hash table picture: a key goes through the hash function, which picks one cell of the bucket array.
// Entries hang below their bucket as a chain. A resize frame shows the old array of 8 buckets above the new
// array of 16 (drawn as two rows of 8), with arrows for the entries that are being moved.
//
// Frame: { line, result, buckets: 8, key: { text, calc, to, tone }, items: [{ k, v, b, tone, tag }],
//          resize: { old: [{ k, b, tone }], items: [{ k, b, tone }], moves: [{ k, from, to }] }, note }
import { Arrow, ArrowDefs, HEAD, StageBar, TONE } from './DsStageParts.jsx';

const W = 640;
const H = 320;
const P = 'dsh-arrow';
const COL = { x0: 40, step: 70, w: 62 };
const BY = 150; // bucket row
const BH = 32;
const CARD = { w: 62, h: 40, y0: BY + BH + 22, step: 60 };
const KEY = { x: 24, y: 34, w: 120, h: 44 };
const FN = { x: 190, y: 34, w: 250, h: 44 };
// resize layout
const OLD = { y: 50, h: 64 };
const NEW1 = { y: 164, h: 40 };
const NEW2 = { y: 236, h: 40 };

const colX = (i) => COL.x0 + (i % 8) * COL.step;
const colC = (i) => colX(i) + COL.w / 2;

export function DsHashStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { items: [] };
  return (
    <div className="g-stage">
      <StageBar line={f.line} result={f.result} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <ArrowDefs prefix={P} />
        {f.resize ? <Resize f={f} /> : <Table f={f} prev={prev} />}
      </svg>
    </div>
  );
}

function Table({ f, prev }) {
  const k = f.key;
  const items = f.items || [];
  const isNewItem = (it) => !(prev.items || []).some((p) => p.k === it.k);
  return (
    <>
      {/* key and hash function */}
      {k && (
        <g key={k.text} className="g-pop">
          <rect x={KEY.x} y={KEY.y} width={KEY.w} height={KEY.h} rx="6" className={`ds-box tone-${k.tone || 'new'}`} />
          <text x={KEY.x + KEY.w / 2} y={KEY.y + 19} textAnchor="middle" className="ds-text">{k.text}</text>
          <text x={KEY.x + KEY.w / 2} y={KEY.y + 35} textAnchor="middle" className="ds-small">key</text>
          <rect x={FN.x} y={FN.y} width={FN.w} height={FN.h} rx="6" className="ds-box tone-none" />
          <text x={FN.x + FN.w / 2} y={FN.y + 19} textAnchor="middle" className="ds-small">hash function</text>
          <text x={FN.x + FN.w / 2} y={FN.y + 36} textAnchor="middle" className="ds-text-sm">{k.calc}</text>
          <Arrow d={`M${KEY.x + KEY.w + 2} ${KEY.y + KEY.h / 2} L${FN.x - 1 - HEAD} ${FN.y + FN.h / 2}`} prefix={P} tone="new" />
          <Arrow d={`M${colC(k.to)} ${FN.y + FN.h + 2} L${colC(k.to)} ${BY - 1 - HEAD}`} prefix={P} tone="new" isNew={!prev.key || prev.key.text !== k.text} />
        </g>
      )}

      {/* the bucket array */}
      <text x={COL.x0} y={BY - 12} className="ds-caption">bucket array ({f.buckets} slots)</text>
      {Array.from({ length: f.buckets }, (_, i) => (
        <g key={i}>
          <rect x={colX(i)} y={BY} width={COL.w} height={BH} rx="4" className={`ds-cell ${k && k.to === i ? 'is-focus' : ''}`} />
          <text x={colC(i)} y={BY + 21} textAnchor="middle" className="ds-text-sm">{i}</text>
        </g>
      ))}

      {/* chains: entries hang below their bucket */}
      {items.map((it) => {
        const pos = items.filter((o) => o.b === it.b).indexOf(it);
        const x = colX(it.b);
        const y = CARD.y0 + pos * CARD.step;
        const tone = it.tone || 'none';
        const fromY = pos === 0 ? BY + BH + 1 : y - CARD.step + CARD.h + 1;
        return (
          <g key={it.k}>
            <Arrow d={`M${colC(it.b)} ${fromY} L${colC(it.b)} ${y - 1 - HEAD}`} prefix={P} tone={tone === 'new' ? 'new' : 'none'} isNew={isNewItem(it)} />
            <g className={isNewItem(it) ? 'g-pop' : ''}>
              <rect x={x} y={y} width={CARD.w} height={CARD.h} rx="5" className={`ds-box tone-${tone}`} />
              <text x={x + CARD.w / 2} y={y + 17} textAnchor="middle" className="ds-text-sm">{it.k}</text>
              <text x={x + CARD.w / 2} y={y + 32} textAnchor="middle" className="ds-small">{it.v}</text>
            </g>
            {it.tag && (
              <text x={x + CARD.w + 8} y={y + 25} className="ds-tag" style={{ fill: TONE[tone] || TONE.none }}>{it.tag}</text>
            )}
          </g>
        );
      })}
    </>
  );
}

function Chip({ x, y, k, tone = 'none' }) {
  return (
    <g>
      <rect x={x + 4} y={y} width={COL.w - 8} height="22" rx="4" className={`ds-box tone-${tone}`} />
      <text x={x + COL.w / 2} y={y + 15} textAnchor="middle" className="ds-text-sm">{k}</text>
    </g>
  );
}

function Resize({ f }) {
  const r = f.resize;
  const newRow = (b) => (b < 8 ? NEW1 : NEW2);
  return (
    <>
      <text x={COL.x0} y={OLD.y - 12} className="ds-caption">Old table: 8 buckets, 6 entries (75% full)</text>
      {Array.from({ length: 8 }, (_, i) => (
        <g key={`o${i}`}>
          <rect x={colX(i)} y={OLD.y} width={COL.w} height={OLD.h} rx="4" className="ds-cell" />
          <text x={colX(i) + 4} y={OLD.y + 11} className="ds-small">{i}</text>
          {r.old.filter((o) => o.b === i).map((o, n) => (
            <Chip key={o.k} x={colX(i)} y={OLD.y + 14 + n * 24} k={o.k} tone={o.tone} />
          ))}
        </g>
      ))}

      <text x={COL.x0} y={NEW1.y - 12} className="ds-caption">New table: 16 buckets</text>
      {Array.from({ length: 16 }, (_, i) => {
        const row = newRow(i);
        return (
          <g key={`n${i}`} className="g-pop">
            <rect x={colX(i)} y={row.y} width={COL.w} height={row.h} rx="4" className="ds-cell" />
            <text x={colX(i) + 4} y={row.y + 11} className="ds-small">{i}</text>
            {r.items.filter((o) => o.b === i).map((o) => (
              <Chip key={o.k} x={colX(i)} y={row.y + 14} k={o.k} tone={o.tone} />
            ))}
          </g>
        );
      })}

      {/* moves: straight down into the first row, or down the gap beside the column into the second row */}
      {r.moves.map((m, n) => {
        const start = OLD.y + OLD.h + 1;
        let d;
        if (m.to < 8) {
          const x = colC(m.from) - 12;
          d = `M${x} ${start} L${colC(m.to) - 12} ${NEW1.y - 1 - HEAD}`;
        } else {
          const x = colC(m.from) + 14;
          const gap = colX(m.from) + COL.w + 4;
          const midY = NEW1.y + NEW1.h + 14;
          const tx = colC(m.to) + 14;
          d = `M${x} ${start} L${x} ${start + 14} L${gap} ${start + 14} L${gap} ${midY} L${tx} ${midY} L${tx} ${NEW2.y - 1 - HEAD}`;
        }
        return <Arrow key={`${m.k}-${n}`} d={d} prefix={P} tone="new" isNew />;
      })}
    </>
  );
}
