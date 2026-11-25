// Binary tree picture: nodes are circles placed by their path from the root ('' is the root, 'L' its left
// child, 'LR' the right child of that, and so on), so a left child is always drawn lower and to the left.
// Lines join each node to its parent. A tag next to a node says what happened there (compare, found, new).
//
// Frame: { line, result, nodes: [{ id, v, path, tone, tag }], note }
import { StageBar, TONE } from './DsStageParts.jsx';

const W = 640;
const H = 300;
const R = 21; // node radius
const TOP = 44;
const DY = 72;
const X0 = 40;
const XW = 560;

function place(path) {
  let x = 0.5;
  let step = 0.25;
  for (const c of path) {
    x += c === 'L' ? -step : step;
    step /= 2;
  }
  return { x: X0 + x * XW, y: TOP + path.length * DY };
}

export function DsTreeStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { nodes: [] };
  const byPath = Object.fromEntries(f.nodes.map((n) => [n.path, n]));
  const before = (n) => prev.nodes.find((p) => p.id === n.id);

  return (
    <div className="g-stage">
      <StageBar line={f.line} result={f.result} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        {/* edges first, so the circles sit on top of them */}
        {f.nodes.map((n) => {
          if (n.path === '') return null;
          const parent = byPath[n.path.slice(0, -1)];
          if (!parent) return null;
          const a = place(parent.path);
          const b = place(n.path);
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          const ux = (b.x - a.x) / len;
          const uy = (b.y - a.y) / len;
          const onPath = n.edge; // the edge a search or insert went down
          const old = before(n);
          const isNew = !old || old.path !== n.path;
          return (
            <g key={`e-${n.id}`} className={`g-edge ${isNew ? 'is-new' : ''}`}>
              <path
                d={`M${a.x + ux * (R + 1)} ${a.y + uy * (R + 1)} L${b.x - ux * (R + 1)} ${b.y - uy * (R + 1)}`}
                pathLength="1"
                className="g-edge-line"
                stroke={onPath ? TONE[onPath] : '#9aa6b7'}
                strokeWidth={onPath ? 3 : 2}
                fill="none"
              />
            </g>
          );
        })}

        {f.nodes.map((n) => {
          const p = place(n.path);
          const old = before(n);
          const tone = n.tone || 'none';
          // tags go on the outer side of the node, away from its sibling
          const right = !n.path.endsWith('L');
          return (
            <g key={n.id} className="ds-move" style={{ transform: `translate(${p.x}px, ${p.y}px)` }}>
              <g className={!old ? 'g-pop' : ''}>
                <circle r={R} className={`ds-box tone-${tone}`} />
                <text y="5" textAnchor="middle" className="ds-text">{n.v}</text>
              </g>
              {n.tag && (
                <text x={right ? R + 8 : -R - 8} y="5" textAnchor={right ? 'start' : 'end'} className="ds-tag" style={{ fill: TONE[tone] || TONE.none }}>
                  {n.tag}
                </text>
              )}
            </g>
          );
        })}
        <text x="12" y="20" className="ds-small">smaller values go left, larger go right</text>
      </svg>
    </div>
  );
}
