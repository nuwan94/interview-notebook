// Maven dependency resolution: the dependency tree drawn in depth columns (depth 0 is your project), and below it
// the repositories Maven downloads from (local ~/.m2, the company Nexus mirror, Maven Central). In the last step the
// bottom row shows the managed versions from a BOM instead.
//
// Frame: { line, result, note,
//          nodes: [{ id, name, sub, d, row, tone, state, badge }], edges: [[fromId, toId, tone]],
//          repos: { local: { sub, tone, state }, nexus: {...}, central: {...} }, lookup: bool, ask: bool,
//          managed: [{ name, sub }] (replaces the repositories row when present) }

import { Stage, Panel, Card, Arrow, HEAD, hCurve } from './BuildStageKit.jsx';

const W = 640;
const H = 352;
const COL = { x0: 24, step: 150, w: 118 };
const ROW = { y0: 70, step: 44, h: 36 };
const REPO = { y: 292, h: 40 };
const REPOS = [
  { id: 'local', x: 152, w: 128, title: '~/.m2' },
  { id: 'nexus', x: 316, w: 128, title: 'Nexus' },
  { id: 'central', x: 480, w: 136, title: 'Maven Central' },
];
const pos = (n) => ({ x: COL.x0 + n.d * COL.step, y: ROW.y0 + n.row * ROW.step });

export function DepTreeStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { nodes: [], edges: [] };
  const by = Object.fromEntries(f.nodes.map((n) => [n.id, n]));
  const depth = Math.max(...f.nodes.map((n) => n.d));
  const had = (id) => prev.nodes.some((n) => n.id === id);
  const hadEdge = (a, b) => prev.edges.some(([x, y]) => x === a && y === b);

  return (
    <Stage name="dt" line={f.line} result={f.result} W={W} H={H} label={label}>
      <Panel x={12} y={12} w={616} h={H - 24} title="Dependency tree" />
      {Array.from({ length: depth + 1 }, (_, d) => (
        <text key={d} x={COL.x0 + d * COL.step + COL.w / 2} y={52} textAnchor="middle" className="bst-section">
          {d === 0 ? 'depth 0: you' : `depth ${d}`}
        </text>
      ))}

      {f.edges.map(([a, b, tone]) => {
        const p = pos(by[a]);
        const q = pos(by[b]);
        return (
          <Arrow
            key={`${a}-${b}`}
            stage="dt"
            d={hCurve(p.x + COL.w, p.y + ROW.h / 2, q.x, q.y + ROW.h / 2)}
            tone={tone || 'none'}
            isNew={!hadEdge(a, b)}
            dim={by[b].state === 'dim'}
          />
        );
      })}
      {f.nodes.map((n) => {
        const p = pos(n);
        return (
          <Card key={n.id} x={p.x} y={p.y} w={COL.w} h={ROW.h} title={n.name} sub={n.sub} tone={n.tone} state={n.state} badge={n.badge} isNew={!had(n.id)} />
        );
      })}

      <line x1="24" x2="616" y1="254" y2="254" className="bst-rail" strokeDasharray="4 5" />
      {f.managed ? (
        <g>
          <text x={24} y={278} className="bst-section">dependencyManagement, imported from the Spring Boot BOM</text>
          {f.managed.map((m, i) => (
            <Card key={m.name} x={24 + i * 200} y={REPO.y} w={184} h={REPO.h} title={m.name} sub={m.sub} tone="ok" isNew />
          ))}
        </g>
      ) : (
        <g>
          <text x={24} y={278} className="bst-section">Repositories</text>
          {/* Maven looks for the declared jar in the local repository first */}
          {f.lookup && (
            <Arrow stage="dt" d={`M233 ${ROW.y0 + ROW.h + 2} V${REPO.y - 1 - HEAD}`} tone="new" isNew={!prev.lookup} label="look here first" lx={241} ly={200} />
          )}
          {f.ask && (
            <>
              <Arrow stage="dt" d={hCurve(280, REPO.y + REPO.h / 2, 316, REPO.y + REPO.h / 2)} tone="warn" isNew={!prev.ask} />
              <Arrow stage="dt" d={hCurve(444, REPO.y + REPO.h / 2, 480, REPO.y + REPO.h / 2)} tone="warn" isNew={!prev.ask} />
            </>
          )}
          {REPOS.map((r) => {
            const s = (f.repos && f.repos[r.id]) || { sub: '', tone: 'none', state: 'dim' };
            return <Card key={r.id} x={r.x} y={REPO.y} w={r.w} h={REPO.h} title={r.title} sub={s.sub} tone={s.tone} state={s.state} />;
          })}
        </g>
      )}
    </Stage>
  );
}
