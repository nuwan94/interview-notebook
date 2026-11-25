// Gradle build phases: the three phases as a strip across the top (initialization, configuration, execution),
// settings.gradle.kts and the daemon on the left, and the task graph of the :app project on the right. Arrows in the
// graph point in run order.
//
// Frame: { line, result, note, phases: ['active' | 'done' | 'todo' | 'skipped' x3], settings: state,
//          graph: null | { compileJava: { tone, state, badge }, processResources, classes, test, jar },
//          daemon: { sub, tone, state }, cache: { sub, tone, state } }

import { Stage, Panel, Card, Arrow, hCurve } from './BuildStageKit.jsx';

const W = 640;
const H = 336;
const PHASE_BOX = [
  { x: 16, title: '1 Initialization', sub: 'reads settings' },
  { x: 230, title: '2 Configuration', sub: 'runs build scripts' },
  { x: 444, title: '3 Execution', sub: 'runs needed tasks' },
];
const PW = 180;
const PHASE_TONE = { active: 'new', done: 'ok', todo: 'none', skipped: 'warn' };
const TASKS = {
  compileJava: { x: 226, y: 136, w: 128, sub: 'compiles sources' },
  processResources: { x: 226, y: 240, w: 128, sub: 'copies resources' },
  classes: { x: 386, y: 188, w: 96, sub: 'groups both' },
  test: { x: 514, y: 136, w: 100, sub: 'runs JUnit' },
  jar: { x: 514, y: 240, w: 100, sub: 'makes the jar' },
};
const TH = 46;
const LINKS = [
  ['compileJava', 'classes'],
  ['processResources', 'classes'],
  ['classes', 'test'],
  ['classes', 'jar'],
];

export function GradlePhaseStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { graph: null };

  return (
    <Stage name="gp" line={f.line} result={f.result} W={W} H={H} label={label}>
      {/* the three phases, always in this order */}
      {PHASE_BOX.map((p, i) => {
        const s = f.phases[i];
        return (
          <g key={p.title}>
            {i > 0 && <Arrow stage="gp" d={hCurve(PHASE_BOX[i - 1].x + PW, 39, p.x, 39)} tone="none" />}
            <Card
              x={p.x}
              y={16}
              w={PW}
              h={46}
              title={p.title}
              sub={s === 'skipped' ? 'skipped: from the cache' : p.sub}
              tone={PHASE_TONE[s]}
              state={s === 'active' ? 'focus' : s === 'todo' ? 'dim' : undefined}
            />
          </g>
        );
      })}

      <Panel x={12} y={78} w={190} h={H - 90} />
      <Card x={22} y={88} w={170} h={110} title="settings.gradle.kts" tone={f.settings === 'focus' ? 'new' : 'none'} state={f.settings} titleSize={12} titleTop />
      <text x={31} y={132} className="bst-code">include("api", "app")</text>
      <Card x={31} y={150} w={66} h={30} title=":api" tone={f.settings === 'focus' ? 'new' : 'none'} isNew={index === 0} />
      <Card x={109} y={150} w={66} h={30} title=":app" tone={f.settings === 'focus' ? 'new' : 'none'} isNew={index === 0} />
      <Card x={22} y={210} w={170} h={50} title="Gradle daemon" sub={f.daemon.sub} tone={f.daemon.tone} state={f.daemon.state} />
      <Card x={22} y={270} w={170} h={50} title="Config cache" sub={f.cache.sub} tone={f.cache.tone} state={f.cache.state} />

      <Panel x={210} y={78} w={418} h={H - 90} title="Task graph of :app" />
      <text x={614} y={102} textAnchor="end" className="bst-sub">arrows show run order</text>
      {!f.graph ? (
        <text x={419} y={210} textAnchor="middle" className="bst-empty">
          No tasks yet: so far Gradle only knows the projects.
        </text>
      ) : (
        <g>
          {LINKS.map(([a, b]) => {
            const s = TASKS[a];
            const t = TASKS[b];
            const g = f.graph[b];
            return (
              <Arrow
                key={`${a}-${b}`}
                stage="gp"
                d={hCurve(s.x + s.w, s.y + TH / 2, t.x, t.y + TH / 2)}
                tone={g.tone === 'none' ? 'none' : f.graph[a].tone}
                isNew={!prev.graph}
                dim={g.state === 'dim'}
              />
            );
          })}
          {Object.entries(TASKS).map(([name, t]) => {
            const g = f.graph[name];
            return <Card key={name} x={t.x} y={t.y} w={t.w} h={TH} title={name} sub={t.sub} tone={g.tone} state={g.state} badge={g.badge} titleSize={12} isNew={!prev.graph} />;
          })}
        </g>
      )}
    </Stage>
  );
}
