// Graph traversal picture: the graph on the left, the queue (BFS) or the call stack (DFS) on the right,
// and the order of visits along the bottom. Node colours: current (blue), waiting in the queue or still on
// the stack (amber), finished (green), not seen yet (white).
//
// Frame: { line, result, graph: { pos: { name: [x, y] }, edges: [[from, to]] }, mode: 'queue' | 'stack',
//          nodes: { name: [tone, tag] }, list: [names], order: [names], used: [[from, to]], active: [[from, to]], note }
import { Arrow, ArrowDefs, StageBar, TONE, boxToBox } from './DsStageParts.jsx';

const W = 640;
const H = 316;
const P = 'dsg-arrow';
const NODE = { hw: 36, hh: 22 };
const PANEL = { x: 444, y: 40, w: 184, h: 214 };
const ORDER = { x: 112, y: 272, w: 70, step: 76, h: 30 };
const LEGEND = [['new', 'current'], ['warn', 'waiting'], ['ok', 'finished']];

const has = (list, a, b) => (list || []).some(([x, y]) => x === a && y === b);

export function DsGraphStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : {};
  const { pos, edges } = f.graph;
  const box = (n) => ({ cx: pos[n][0], cy: pos[n][1], ...NODE });

  return (
    <div className="g-stage">
      <StageBar line={f.line} result={f.result} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <ArrowDefs prefix={P} />

        {/* legend */}
        {LEGEND.map(([tone, text], i) => (
          <g key={tone} transform={`translate(${12 + i * 104}, 12)`}>
            <rect width="14" height="14" rx="3" className={`ds-box tone-${tone}`} />
            <text x="20" y="12" className="ds-small">{text}</text>
          </g>
        ))}

        {/* edges */}
        {edges.map(([a, b]) => {
          const s = boxToBox(box(a), box(b));
          const active = has(f.active, a, b);
          const used = has(f.used, a, b);
          const tone = active ? 'new' : used ? 'ok' : 'none';
          const isNew = (active && !has(prev.active, a, b)) || (used && !has(prev.used, a, b) && !has(prev.active, a, b));
          return (
            <Arrow key={`${a}-${b}`} d={`M${s.x1} ${s.y1} L${s.x2} ${s.y2}`} prefix={P} tone={tone} isNew={isNew} width={active ? 2.75 : 2} opacity={tone === 'none' ? 0.7 : 1} />
          );
        })}

        {/* nodes */}
        {Object.keys(pos).map((n) => {
          const [tone, tag] = f.nodes[n] || ['none', 'not seen'];
          const [x, y] = pos[n];
          return (
            <g key={n}>
              <rect x={x - NODE.hw} y={y - NODE.hh} width={NODE.hw * 2} height={NODE.hh * 2} rx="8" className={`ds-box tone-${tone}`} />
              <text x={x} y={y - 3} textAnchor="middle" className="ds-text-sm">{n}</text>
              <text x={x} y={y + 13} textAnchor="middle" className="ds-small">{tag}</text>
            </g>
          );
        })}

        {/* the queue or the call stack */}
        <rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx="10" className="ds-panel" />
        <text x={PANEL.x + 12} y={PANEL.y + 24} className="ds-panel-title">{f.mode === 'queue' ? 'Queue' : 'Call stack'}</text>
        <text x={PANEL.x + 12} y={PANEL.y + 42} className="ds-small">{f.mode === 'queue' ? 'take from the front' : 'work on the top'}</text>
        {f.list.length === 0 && <text x={PANEL.x + PANEL.w / 2} y={PANEL.y + 120} textAnchor="middle" className="ds-empty">(empty)</text>}
        {f.mode === 'queue'
          ? f.list.map((n, i) => {
              const x = PANEL.x + 12 + i * 56;
              const y = PANEL.y + 96;
              const isNew = !(prev.list || []).includes(n);
              return (
                <g key={n} className={isNew ? 'g-pop' : ''}>
                  <rect x={x} y={y} width="52" height="34" rx="5" className={`ds-box tone-${i === 0 ? 'warn' : 'none'}`} />
                  <text x={x + 26} y={y + 22} textAnchor="middle" className="ds-text-sm">{n}</text>
                  {i === 0 && <text x={x + 26} y={y + 52} textAnchor="middle" className="ds-small">front</text>}
                  {i === f.list.length - 1 && i > 0 && <text x={x + 26} y={y + 52} textAnchor="middle" className="ds-small">back</text>}
                </g>
              );
            })
          : f.list.map((n, i) => {
              // the stack grows upwards from the bottom of the panel
              const x = PANEL.x + 50;
              const y = PANEL.y + PANEL.h - 42 - i * 36;
              const top = i === f.list.length - 1;
              const isNew = (prev.list || [])[i] !== n;
              return (
                <g key={`${i}-${n}`} className={isNew ? 'g-pop' : ''}>
                  <rect x={x} y={y} width="120" height="30" rx="5" className={`ds-box tone-${top ? 'new' : 'warn'}`} />
                  <text x={x + 60} y={y + 20} textAnchor="middle" className="ds-text-sm">{`dfs(${n})`}</text>
                  {top && <text x={x - 8} y={y + 20} textAnchor="end" className="ds-small">top</text>}
                </g>
              );
            })}

        {/* order of visits */}
        <text x="12" y={ORDER.y + 20} className="ds-caption">Visit order</text>
        {f.order.map((n, i) => (
          <g key={n} className={(prev.order || []).includes(n) ? '' : 'g-pop'}>
            <rect x={ORDER.x + i * ORDER.step} y={ORDER.y} width={ORDER.w} height={ORDER.h} rx="5" className="ds-box tone-ok" />
            <text x={ORDER.x + i * ORDER.step + ORDER.w / 2} y={ORDER.y + 20} textAnchor="middle" className="ds-text-sm">{`${i + 1}. ${n}`}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
