// Class-diagram picture for the SOLID and design-pattern scenes. Every card and arrow has a fixed position set in
// the scene data, so the layout is planned by hand and no arrow crosses a card.
//
// Frame: { line, result: { text, tone }, h, bands: [{ label, y, h }], focus: ['id'],
//          cards: [{ id, x, y, w, h?, title, kind: 'class' | 'interface' | 'actor' | 'code' | 'wrap',
//                    lines: ['text' | { t, mark }], tone, badge, sepW }],
//          arrows: [{ id?, from, fs, ff, to, ts, tf, points?, straight?, kind: 'uses' | 'implements', tone,
//                     label, labelAt, dim }],
//          note }
// Sides: fs / ts are 'l' | 'r' | 't' | 'b'; ff / tf place the point along that side (0 to 1, default 0.5).

import './UmlStage.css';

const W = 640;
const HEAD = 10; // arrowhead length
const STEREO = 14; // room for the «interface» line
const LINE = 17;
const TONE = {
  ok: 'var(--color-ok)',
  bad: 'var(--color-bad)',
  warn: 'var(--color-warn)',
  new: 'var(--color-pen)',
  none: '#6b7788',
};

const lineText = (l) => (typeof l === 'string' ? l : l.t);

export function cardHeight(c) {
  if (c.h) return c.h;
  const n = (c.lines || []).length;
  const top = c.kind === 'interface' ? STEREO : 0;
  return top + 28 + (n ? n * LINE + 6 : 0);
}

function side(c, s, f = 0.5) {
  const h = cardHeight(c);
  if (s === 'l') return [c.x, c.y + h * f];
  if (s === 'r') return [c.x + c.w, c.y + h * f];
  if (s === 't') return [c.x + c.w * f, c.y];
  return [c.x + c.w * f, c.y + h];
}

function route(a, byId) {
  if (a.points) return a.points;
  const from = byId[a.from];
  const to = byId[a.to];
  if (!from || !to) return null;
  const p1 = side(from, a.fs || 'r', a.ff);
  const p2 = side(to, a.ts || 'l', a.tf);
  if (a.straight) return [p1, p2];
  const hz = (s) => s === 'l' || s === 'r';
  const fs = a.fs || 'r';
  const ts = a.ts || 'l';
  if (hz(fs) && hz(ts)) {
    if (Math.abs(p1[1] - p2[1]) < 1) return [p1, p2];
    const mx = (p1[0] + p2[0]) / 2;
    return [p1, [mx, p1[1]], [mx, p2[1]], p2];
  }
  if (!hz(fs) && !hz(ts)) {
    if (Math.abs(p1[0] - p2[0]) < 1) return [p1, p2];
    const my = (p1[1] + p2[1]) / 2;
    return [p1, [p1[0], my], [p2[0], my], p2];
  }
  return hz(fs) ? [p1, [p2[0], p1[1]], p2] : [p1, [p1[0], p2[1]], p2];
}

// the line stops one head-length short of the card, so the fixed-size head fills the gap and its tip touches the edge
function shorten(pts) {
  const out = pts.map((p) => [...p]);
  const n = out.length;
  const [x1, y1] = out[n - 2];
  const [x2, y2] = out[n - 1];
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  out[n - 1] = [x2 - ((x2 - x1) / len) * (HEAD + 1), y2 - ((y2 - y1) / len) * (HEAD + 1)];
  return out;
}

function labelPos(pts) {
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  }
  const [x1, y1] = pts[best];
  const [x2, y2] = pts[best + 1];
  const vertical = Math.abs(x2 - x1) < 1;
  return vertical ? { x: x1 + 8, y: (y1 + y2) / 2 + 4, anchor: 'start' } : { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 7, anchor: 'middle' };
}

const arrowKey = (a) => a.id || `${a.from}>${a.to}:${a.kind || 'uses'}`;

function Card({ c, isNew, dim }) {
  const h = cardHeight(c);
  const top = c.kind === 'interface' ? STEREO : 0;
  const lines = c.lines || [];
  const sepW = c.sepW || c.w;
  const tone = c.tone || 'none';
  return (
    <g className={isNew ? 'g-pop' : ''} opacity={dim ? 0.35 : 1}>
      <rect x={c.x} y={c.y} width={c.w} height={h} rx={c.kind === 'actor' ? 16 : 7} className={`uml-card uml-${c.kind || 'class'} is-${tone}`} />
      {c.kind === 'interface' && (
        <text x={c.x + 12} y={c.y + 15} className="uml-stereo">«interface»</text>
      )}
      <text x={c.x + 12} y={c.y + top + 19} className={c.kind === 'actor' ? 'uml-actor-title' : 'uml-title'}>{c.title}</text>
      {lines.length > 0 && c.kind !== 'actor' && (
        <line x1={c.x} x2={c.x + sepW} y1={c.y + top + 27} y2={c.y + top + 27} className="uml-sep" />
      )}
      {lines.map((l, i) => {
        const y = c.y + top + 28 + i * LINE;
        const mark = typeof l === 'string' ? null : l.mark;
        return (
          <g key={i}>
            {mark && <rect x={c.x + 3} y={y + 2} width={sepW - 6} height={LINE - 1} rx="3" className={`uml-mark is-${mark}`} />}
            <text x={c.x + 12} y={y + 14.5} xmlSpace="preserve" className={`${c.kind === 'actor' ? 'uml-actor-line' : 'uml-line'} ${mark ? 'is-marked' : ''}`}>
              {lineText(l)}
            </text>
          </g>
        );
      })}
      {c.badge && (
        <g>
          <rect x={c.x + c.w - c.badge.length * 6.4 - 22} y={c.y - 10} width={c.badge.length * 6.4 + 16} height="19" rx="9.5" fill={TONE[tone]} />
          <text x={c.x + c.w - c.badge.length * 3.2 - 14} y={c.y + 3.5} textAnchor="middle" className="uml-badge">{c.badge}</text>
        </g>
      )}
    </g>
  );
}

export function UmlStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { cards: [], arrows: [] };
  const H = Math.max(...frames.map((x) => x.h || 300)); // one height for the whole scene, so the picture does not jump
  const byId = Object.fromEntries(f.cards.map((c) => [c.id, c]));
  const prevCards = new Set(prev.cards.map((c) => c.id));
  const prevArrows = new Set((prev.arrows || []).map(arrowKey));
  const focus = new Set(f.focus || []);
  const hasFocus = focus.size > 0;

  return (
    <div className="g-stage uml-stage">
      {(f.line || f.result) && (
        <div className="uml-bar">
          {f.line && <code className="uml-bar-code">{f.line}</code>}
          {f.result && (
            <span className="uml-result" style={{ background: TONE[f.result.tone] || TONE.new }}>
              {f.result.text}
            </span>
          )}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          {Object.entries(TONE).map(([k, c]) => (
            <g key={k}>
              <marker id={`uml-head-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
                <path d="M0 1L10 5L0 9z" fill={c} />
              </marker>
              <marker id={`uml-tri-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
                <path d="M0.8 0.8L9.4 5L0.8 9.2z" fill="#fff" stroke={c} strokeWidth="1.4" strokeLinejoin="round" />
              </marker>
            </g>
          ))}
        </defs>

        {(f.bands || []).map((b) => (
          <g key={b.label}>
            <rect x="8" y={b.y} width={W - 16} height={b.h} rx="10" className="uml-band" />
            <text x="20" y={b.y + 18} className="uml-band-title">{b.label}</text>
          </g>
        ))}

        {f.cards.map((c) => (
          <Card key={c.id} c={c} isNew={!prevCards.has(c.id)} dim={hasFocus && !focus.has(c.id)} />
        ))}

        {(f.arrows || []).map((a) => {
          const pts = route(a, byId);
          if (!pts) return null;
          const tone = a.tone || 'none';
          const isNew = !prevArrows.has(arrowKey(a));
          const impl = a.kind === 'implements';
          const dim = a.dim || (hasFocus && !(focus.has(arrowKey(a)) || (focus.has(a.from) && focus.has(a.to))));
          const d = shorten(pts)
            .map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
            .join(' ');
          const lp = a.labelAt ? { x: a.labelAt[0], y: a.labelAt[1], anchor: a.labelAnchor || 'middle' } : labelPos(pts);
          return (
            <g key={arrowKey(a)} className={impl ? (isNew ? 'uml-fade' : '') : `g-edge ${isNew ? 'is-new' : ''}`} opacity={dim ? 0.25 : 1}>
              <path
                d={d}
                pathLength={impl ? undefined : 1}
                className={impl ? 'uml-impl' : 'g-edge-line'}
                stroke={TONE[tone]}
                fill="none"
                markerEnd={`url(#uml-${impl ? 'tri' : 'head'}-${tone})`}
              />
              {a.label && (
                <text x={lp.x} y={lp.y} textAnchor={lp.anchor} className="g-edge-label uml-arrow-label" fill={TONE[tone]}>
                  {a.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
