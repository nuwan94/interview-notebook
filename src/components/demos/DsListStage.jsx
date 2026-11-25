// Linked list picture: a head variable on the left, then nodes in a row. Each node is a box with two parts,
// the value (with a made-up memory address, to show the nodes are separate objects) and the next pointer.
// Arrows go from each next pointer to the node it points to; the last node's next is null.
//
// Frame: { line, result, head: id, nodes: [{ id, v, addr, slot, next, tone, tag, low }], cursor: id, note }
// slot is the column (0 to 3); low drops a node below the row (a node that was unlinked).
import { Arrow, ArrowDefs, HEAD, StageBar, TONE } from './DsStageParts.jsx';

const W = 640;
const H = 240;
const ROW = 96; // top of the node row
const N = { x0: 112, step: 132, w: 92, vw: 54, h: 46 }; // vw: width of the value part
const LOW = 178; // top of a node that was unlinked
const HEADBOX = { x: 12, y: ROW + 6, w: 72, h: 34 };
const P = 'dsl-arrow';

const nodeX = (n) => N.x0 + n.slot * N.step;
const nodeY = (n) => (n.low ? LOW : ROW);

export function DsListStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { nodes: [] };
  const byId = Object.fromEntries(f.nodes.map((n) => [n.id, n]));
  const had = (from, to) => prev.nodes.some((p) => p.id === from && p.next === to);

  // the head arrow: straight into the first column, otherwise over the top of the row so it never crosses a node
  const h = byId[f.head];
  let headPath = null;
  if (h) {
    const x1 = HEADBOX.x + HEADBOX.w;
    const y1 = HEADBOX.y + HEADBOX.h / 2;
    const hx = nodeX(h);
    headPath = h.slot === 0
      ? `M${x1 + 2} ${y1} L${hx - 1 - HEAD} ${y1}`
      : `M${HEADBOX.x + HEADBOX.w / 2} ${HEADBOX.y - 2} C${HEADBOX.x + HEADBOX.w / 2} ${ROW - 60} ${hx + N.vw / 2} ${ROW - 60} ${hx + N.vw / 2} ${ROW - 1 - HEAD}`;
  }

  return (
    <div className="g-stage">
      <StageBar line={f.line} result={f.result} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <ArrowDefs prefix={P} />
        <text x="12" y="24" className="ds-caption">Each node is a separate object in memory. Only the head is known.</text>

        {/* the head variable */}
        <rect x={HEADBOX.x} y={HEADBOX.y} width={HEADBOX.w} height={HEADBOX.h} rx="6" className="ds-box tone-none" />
        <text x={HEADBOX.x + HEADBOX.w / 2} y={HEADBOX.y + 22} textAnchor="middle" className="ds-text">head</text>
        {headPath && <Arrow d={headPath} prefix={P} tone={prev.head !== f.head ? 'new' : 'none'} isNew={prev.head !== f.head} width={2.25} />}

        {/* next pointers */}
        {f.nodes.map((n) => {
          if (!n.next || !byId[n.next]) return null;
          const t = byId[n.next];
          const x1 = nodeX(n) + N.vw + (N.w - N.vw) / 2;
          const y1 = nodeY(n) + N.h / 2;
          let d;
          if (n.low) {
            // an unlinked node still points on, from below the row: enter the target from underneath
            const tx = nodeX(t) + N.vw / 2;
            const ty = ROW + N.h + 1 + HEAD;
            d = `M${x1} ${y1} C${x1 + 40} ${y1} ${tx} ${y1} ${tx} ${ty}`;
          } else {
            d = `M${x1} ${y1} L${nodeX(t) - 1 - HEAD} ${ROW + N.h / 2}`;
          }
          const isNew = !had(n.id, n.next);
          const tone = n.low ? 'none' : n.edgeTone || (isNew ? 'new' : 'none');
          return <Arrow key={`${n.id}-${n.next}`} d={d} prefix={P} tone={tone} isNew={isNew} dashed={n.low} opacity={n.low ? 0.45 : 1} />;
        })}

        {/* nodes */}
        {f.nodes.map((n) => {
          const isNew = !prev.nodes.some((p) => p.id === n.id);
          const tone = n.tone || 'none';
          return (
            <g key={n.id} className={`ds-move ${isNew ? 'g-pop' : ''}`} style={{ transform: `translate(${nodeX(n)}px, ${nodeY(n)}px)` }} opacity={n.low ? 0.7 : 1}>
              {n.tag && (
                <text x={N.vw / 2} y={-10} textAnchor="middle" className="ds-tag" fill={TONE[tone] || TONE.none}>{n.tag}</text>
              )}
              <rect width={N.w} height={N.h} rx="6" className={`ds-box tone-${tone}`} />
              <line x1={N.vw} y1="0" x2={N.vw} y2={N.h} className="ds-divider" />
              <text x={N.vw / 2} y="20" textAnchor="middle" className="ds-text">{n.v}</text>
              <text x={N.vw / 2} y="37" textAnchor="middle" className="ds-small">{n.addr}</text>
              {n.next ? (
                <circle cx={N.vw + (N.w - N.vw) / 2} cy={N.h / 2} r="4" className="ds-dot" />
              ) : (
                <text x={N.vw + (N.w - N.vw) / 2} y={N.h / 2 + 4} textAnchor="middle" className="ds-small">null</text>
              )}
            </g>
          );
        })}

        {/* a cursor walking the list */}
        {f.cursor && byId[f.cursor] && (
          <g className="ds-move" style={{ transform: `translate(${nodeX(byId[f.cursor]) + N.vw / 2}px, 0px)` }}>
            <line x1="0" y1={H - 40} x2="0" y2={ROW + N.h + 1 + HEAD} stroke={TONE.warn} strokeWidth="2.25" markerEnd={`url(#${P}-warn)`} />
            <text x="0" y={H - 22} textAnchor="middle" className="ds-text" style={{ fill: TONE.warn }}>current</text>
          </g>
        )}
      </svg>
    </div>
  );
}
