// A type hierarchy for the generics lesson: classes and interfaces drawn as a small UML tree on the left
// (child below, a hollow triangle on the parent), and on the right the lines of code the compiler allows or rejects.
// The types a wildcard or a bound accepts are coloured; the rest are dimmed.
//
// Frame: { line, result: { text, tone }, note, treeTitle, caption,
//          nodes: [{ id, text, sub, col, row, iface, tone, dim, tag }],   // col 0..2, row 0..3
//          edges: [{ from, to, iface }],                                  // child to parent; iface = implements (dashed)
//          opsTitle, ops: [{ code, verdict, tone }] }                     // code may hold several lines split by \n

import './TypeTreeStage.css';
import { StageBar, SOFT, TONE, fitSize } from './ChipColumnsStage.jsx';

const W = 680;
const TREE = { x: 12, w: 396 };
const OPS = { x: 420, w: 248 };
const NODE = { w: 118, h: 44 };
const ROW0 = 78;
const ROW_STEP = 80;
const TRI = 11; // hollow triangle size

const nodeX = (col) => TREE.x + (TREE.w * (col + 0.5)) / 3 - NODE.w / 2;
const nodeY = (row) => ROW0 + row * ROW_STEP;

function opsHeight(ops) {
  return (ops || []).reduce((h, o) => h + 16 * o.code.split('\n').length + 24, 0);
}

export function TypeTreeStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : null;
  const rows = Math.max(...frames.map((fr) => Math.max(...fr.nodes.map((n) => n.row)))) + 1;
  const H = Math.max(ROW0 + rows * ROW_STEP - 8, ...frames.map((fr) => 70 + opsHeight(fr.ops) + 14));
  const at = Object.fromEntries(f.nodes.map((n) => [n.id, n]));
  const prevNodes = new Set(prev ? prev.nodes.map((n) => `${n.id}/${n.tone}/${n.tag}`) : []);
  const prevOps = new Set(prev ? (prev.ops || []).map((o) => o.code) : []);

  let oy = 74;
  return (
    <div className="g-stage ttree-stage">
      <StageBar line={f.line} result={f.result} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="ttree-tri" viewBox="0 0 12 12" refX="0" refY="6" markerWidth={TRI} markerHeight={TRI} markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0.8 0.8L11.2 6L0.8 11.2z" fill="#fff" stroke="#556070" strokeWidth="1.4" />
          </marker>
        </defs>

        <rect x={TREE.x} y="12" width={TREE.w} height={H - 24} rx="10" className="ttree-panel" />
        <text x={TREE.x + 14} y="36" className="ttree-title">{f.treeTitle || 'Types'}</text>
        {f.caption && (
          <text x={TREE.x + 14} y="56" className="ttree-caption" style={{ fontSize: fitSize(f.caption, TREE.w - 28, 12.5, 0.58) }}>
            {f.caption}
          </text>
        )}

        {/* child to parent: the line ends one triangle-length below the parent, the triangle fills the gap */}
        {(f.edges || []).map((e) => {
          const c = at[e.from];
          const p = at[e.to];
          if (!c || !p) return null;
          const x1 = nodeX(c.col) + NODE.w / 2;
          const y1 = nodeY(c.row);
          const x2 = nodeX(p.col) + NODE.w / 2;
          const y2 = nodeY(p.row) + NODE.h + 1 + TRI;
          const dim = c.dim || p.dim;
          return (
            <path
              key={`${e.from}>${e.to}`}
              d={`M${x1} ${y1} L${x2} ${y2}`}
              stroke="#556070"
              strokeWidth="1.6"
              strokeDasharray={e.iface ? '6 4' : undefined}
              fill="none"
              markerEnd="url(#ttree-tri)"
              opacity={dim ? 0.45 : 1}
            />
          );
        })}

        {f.nodes.map((n) => {
          const x = nodeX(n.col);
          const y = nodeY(n.row);
          const tone = n.tone || 'none';
          const key = `${n.id}/${n.tone}/${n.tag}`;
          return (
            <g key={key} className={prevNodes.has(key) ? '' : 'g-pop'} opacity={n.dim ? 0.4 : 1}>
              <rect x={x} y={y} width={NODE.w} height={NODE.h} rx={n.iface ? 14 : 5} fill={SOFT[tone]} stroke={TONE[tone]} strokeWidth={n.tone ? 2.5 : 1.5} />
              <text x={x + NODE.w / 2} y={y + (n.sub ? 19 : 27)} textAnchor="middle" className="ttree-name" style={{ fontSize: fitSize(n.text, NODE.w - 14, 13) }}>
                {n.text}
              </text>
              {n.sub && (
                <text x={x + NODE.w / 2} y={y + 35} textAnchor="middle" className="ttree-sub" style={{ fontSize: fitSize(n.sub, NODE.w - 12, 11.5) }}>
                  {n.sub}
                </text>
              )}
              {n.tag && (
                <g>
                  <rect x={x + NODE.w - 44} y={y - 9} width="48" height="17" rx="8.5" fill={TONE[tone]} />
                  <text x={x + NODE.w - 20} y={y + 3.5} textAnchor="middle" className="ttree-tag">{n.tag}</text>
                </g>
              )}
            </g>
          );
        })}

        <rect x={OPS.x} y="12" width={OPS.w} height={H - 24} rx="10" className="ttree-panel" />
        <text x={OPS.x + 14} y="36" className="ttree-title">{f.opsTitle || 'What the compiler says'}</text>
        {(f.ops || []).map((o) => {
          const lines = o.code.split('\n');
          const y = oy;
          oy += 16 * lines.length + 24;
          const tone = o.tone || 'none';
          const size = Math.min(...lines.map((l) => fitSize(l, OPS.w - 34, 12.5)));
          return (
            <g key={o.code} className={prevOps.has(o.code) ? '' : 'g-pop'}>
              <rect x={OPS.x + 10} y={y - 14} width="4" height={16 * lines.length + 16} rx="2" fill={TONE[tone]} />
              {lines.map((l, i) => (
                <text key={i} x={OPS.x + 22} y={y + i * 16} className="ttree-code" style={{ fontSize: size, whiteSpace: 'pre' }}>
                  {l}
                </text>
              ))}
              <text x={OPS.x + 22} y={y + 16 * lines.length} className="ttree-verdict" fill={TONE[tone]} style={{ fontSize: fitSize(o.verdict, OPS.w - 34, 12, 0.55) }}>
                {o.verdict}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
