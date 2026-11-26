// A general picture for walk-throughs where every card and arrow is placed by hand, so arrows never cross cards.
//
// Frame: {
//   line?, result?: { text, tone }, h?: viewBox height (default 300), note,
//   regions?: [{ x, y, w, h, title?, sub?, tone?, solid? }]                 dashed areas with a title
//   cards:    [{ id, x, y, w, h?, title, lines?: [string | { t, mono, strike }], tone?, badge?, badgeTone?,
//                dashed?, focus?, ghost?, dim?, mono? }]
//   wraps?:   [{ around: cardId, label, tone?, pad? }]                       a dashed wrapper, such as a proxy
//   arrows?:  [{ from, to, label?, tone?, dash?, fs?, ts?, fo?, toff?, lx?, ly?, cross?, bend? }]
//             fs / ts: side of the from / to card ('l' | 'r' | 't' | 'b'); fo / toff: offset along that side.
//             An id 'wrap:<cardId>' targets a wrapper. lx / ly move the label.
//   texts?:   [{ x, y, t, big?, anchor? }]
//   steps?:   { items: [label], at: index, y? }                               a numbered timeline along the bottom
// }
import './BoardStage.css';

const W = 640;
const HEAD = 10;
const TONE = { ok: 'var(--color-ok)', bad: 'var(--color-bad)', warn: 'var(--color-warn)', new: 'var(--color-pen)', none: '#7b8697' };
const NORMAL = { l: [-1, 0], r: [1, 0], t: [0, -1], b: [0, 1] };

const cardH = (c) => c.h ?? 26 + 16 * (c.lines?.length || 0);

function sidePoint(r, side, off = 0) {
  if (side === 'l') return [r.x, r.y + r.h / 2 + off];
  if (side === 'r') return [r.x + r.w, r.y + r.h / 2 + off];
  if (side === 't') return [r.x + r.w / 2 + off, r.y];
  return [r.x + r.w / 2 + off, r.y + r.h];
}

function autoSides(a, b) {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  // prefer horizontal when the boxes do not overlap horizontally
  const hGap = dx > 0 ? b.x - (a.x + a.w) : a.x - (b.x + b.w);
  const vGap = dy > 0 ? b.y - (a.y + a.h) : a.y - (b.y + b.h);
  if (hGap >= vGap) return dx > 0 ? ['r', 'l'] : ['l', 'r'];
  return dy > 0 ? ['b', 't'] : ['t', 'b'];
}

function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
}

function Edge({ a, rects, isNew }) {
  const A = rects[a.from];
  const B = rects[a.to];
  if (!A || !B) return null;
  const [fs0, ts0] = autoSides(A, B);
  const fs = a.fs || fs0;
  const ts = a.ts || ts0;
  const p1 = sidePoint(A, fs, a.fo);
  const tip = sidePoint(B, ts, a.toff);
  const n1 = NORMAL[fs];
  const into = NORMAL[ts].map((v) => -v); // direction of travel when entering the target side
  const end = [tip[0] - into[0] * HEAD, tip[1] - into[1] * HEAD];
  const dist = Math.hypot(end[0] - p1[0], end[1] - p1[1]);
  const k = a.bend ?? Math.max(24, dist / 3);
  const c1 = [p1[0] + n1[0] * k, p1[1] + n1[1] * k];
  const c2 = [end[0] - into[0] * k, end[1] - into[1] * k];
  const tone = a.tone || 'ok';
  const mid = bez(p1, c1, c2, end, 0.5);
  return (
    <g className={`g-edge ${isNew ? 'is-new' : ''}`}>
      <path
        d={`M${p1[0]} ${p1[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${end[0]} ${end[1]}`}
        pathLength="1"
        className={`g-edge-line ${a.dash ? 'bd-edge-dash' : ''}`}
        stroke={TONE[tone]}
        strokeWidth={a.width || 2.25}
        fill="none"
        markerEnd={`url(#bd-arrow-${tone})`}
      />
      {a.cross && (
        <g transform={`translate(${mid[0]} ${mid[1]})`}>
          <line x1="-7" y1="-7" x2="7" y2="7" className="bd-cross" />
          <line x1="-7" y1="7" x2="7" y2="-7" className="bd-cross" />
        </g>
      )}
      {a.label && (
        <text x={mid[0] + (a.lx || 0)} y={mid[1] - 6 + (a.ly || 0)} textAnchor="middle" className="bd-edge-label">
          {a.label}
        </text>
      )}
    </g>
  );
}

function Card({ c, isNew, state }) {
  const h = cardH(c);
  const tone = c.ghost ? '' : `t-${c.tone || 'none'}`;
  const badgeW = c.badge ? c.badge.length * 6.2 + 14 : 0;
  return (
    <g className={`${isNew ? 'g-pop' : ''} ${state ? `bd-${state}` : ''}`} opacity={c.dim ? 0.4 : 1}>
      <rect x={c.x} y={c.y} width={c.w} height={h} rx="7" className={`bd-card ${tone} ${c.dashed ? 'is-dashed' : ''} ${c.focus ? 'is-focus' : ''} ${c.ghost ? 'is-ghost' : ''}`} />
      {c.title && (
        <text x={c.x + 10} y={c.y + 18} className="bd-card-title">
          {c.title}
        </text>
      )}
      {(c.lines || []).map((ln, i) => {
        const o = typeof ln === 'string' ? { t: ln } : ln;
        return (
          <text key={i} x={c.x + 10} y={c.y + 35 + i * 16} className={`bd-card-line ${o.mono || c.mono ? 'is-mono' : ''} ${o.strike ? 'is-strike' : ''}`}>
            {o.t}
          </text>
        );
      })}
      {c.badge && (
        <g>
          <rect x={c.x + c.w - badgeW - 6} y={c.y - 9} width={badgeW} height="17" rx="8.5" fill={TONE[c.badgeTone || c.tone || 'new'] || TONE.new} />
          <text x={c.x + c.w - 6 - badgeW / 2} y={c.y + 3.5} textAnchor="middle" className="bd-badge-text">
            {c.badge}
          </text>
        </g>
      )}
    </g>
  );
}

function Steps({ s, h }) {
  const n = s.items.length;
  const y = s.y ?? h - 30;
  const x0 = 40;
  const x1 = W - 40;
  const gap = (x1 - x0) / Math.max(1, n - 1);
  return (
    <g>
      <line x1={x0} y1={y} x2={x1} y2={y} className="bd-steps-rail" />
      {s.items.map((label, i) => {
        const x = x0 + i * gap;
        const st = i < s.at ? 'is-done' : i === s.at ? 'is-now' : 'is-todo';
        return (
          <g key={label}>
            <circle cx={x} cy={y} r="10" className={`bd-steps-dot ${st}`} />
            <text x={x} y={y + 4} textAnchor="middle" className={`bd-steps-num ${st === 'is-now' ? 'is-now' : ''}`}>
              {i + 1}
            </text>
            <text x={x} y={y + 24} textAnchor="middle" className={`bd-steps-label ${st === 'is-now' ? 'is-now' : ''}`}>
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

const sig = (c) => JSON.stringify([c.x, c.y, c.w, c.title, c.lines, c.tone, c.badge, c.dim, c.ghost]);

export function BoardStage({ frames, index, label, focus = false }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : null;
  // with focus on, cards that are new or changed since the last step stand out and the rest fade back
  const prevSig = new Map((prev?.cards || []).map((c) => [c.id, sig(c)]));
  const changedIds = new Set((f.cards || []).filter((c) => prevSig.get(c.id) !== sig(c)).map((c) => c.id));
  const focusOn = focus && !!prev && changedIds.size > 0 && changedIds.size < (f.cards || []).length;
  const H = f.h || 300;
  const prevCards = new Set((prev?.cards || []).map((c) => c.id));
  const prevArrows = new Set((prev?.arrows || []).map((a) => `${a.from}>${a.to}>${a.label || ''}`));
  const prevWraps = new Set((prev?.wraps || []).map((w) => w.around));

  const rects = {};
  for (const c of f.cards || []) rects[c.id] = { x: c.x, y: c.y, w: c.w, h: cardH(c) };
  for (const w of f.wraps || []) {
    const r = rects[w.around];
    if (!r) continue;
    const p = w.pad ?? 8;
    rects[`wrap:${w.around}`] = { x: r.x - p, y: r.y - p - 12, w: r.w + 2 * p, h: r.h + 2 * p + 12 };
  }

  return (
    <div className="g-stage bd-stage">
      {(f.line || f.result) && (
        <div className="bd-bar">
          {f.line && <code className="bd-line">{f.line}</code>}
          {f.result && (
            <span className="bd-result" style={{ background: TONE[f.result.tone] || TONE.new }}>
              {f.result.text}
            </span>
          )}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="g-svg" role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
        <defs>
          {Object.entries(TONE).map(([k, c]) => (
            <marker key={k} id={`bd-arrow-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0 1L10 5L0 9z" fill={c} />
            </marker>
          ))}
        </defs>
        {(f.regions || []).map((r, i) => (
          <g key={`r${i}`}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="10" className={`bd-region t-${r.tone || 'none'} ${r.solid ? 'is-solid' : ''}`} />
            {r.title && (
              <text x={r.x + 12} y={r.y + 20} className="bd-region-title">
                {r.title}
              </text>
            )}
            {r.sub && (
              <text x={r.x + 12} y={r.y + 36} className="bd-region-sub">
                {r.sub}
              </text>
            )}
          </g>
        ))}
        {(f.texts || []).map((t, i) => (
          <text key={`t${i}`} x={t.x} y={t.y} textAnchor={t.anchor || 'start'} className={`bd-text ${t.big ? 'is-big' : ''}`}>
            {t.t}
          </text>
        ))}
        {(f.cards || []).map((c) => (
          <Card key={c.id} c={c} isNew={!!prev && !prevCards.has(c.id)} state={focusOn ? (changedIds.has(c.id) ? 'changed' : 'quiet') : ''} />
        ))}
        {(f.wraps || []).map((w) => {
          const r = rects[`wrap:${w.around}`];
          if (!r) return null;
          const col = TONE[w.tone || 'warn'];
          return (
            <g key={`w-${w.around}`} className={prev && !prevWraps.has(w.around) ? 'g-pop' : ''}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="9" className="bd-wrap" stroke={col} />
              <text x={r.x + r.w - 8} y={r.y + 12} textAnchor="end" className="bd-wrap-text" fill={col}>
                {w.label}
              </text>
            </g>
          );
        })}
        {(f.arrows || []).map((a) => {
          const key = `${a.from}>${a.to}>${a.label || ''}`;
          return <Edge key={key} a={a} rects={rects} isNew={!prev || !prevArrows.has(key)} />;
        })}
        {f.steps && <Steps s={f.steps} h={H} />}
      </svg>
    </div>
  );
}
