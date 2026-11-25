// Gradle dependency configurations, drawn as the classpaths they fill.
// mode 'modules': the service module and the app module side by side, each with its compile and runtime
//   classpath, so you can see whether Jackson reaches the app's compile classpath (api) or not (implementation).
// mode 'classpaths': the compile, runtime and test classpaths of one module, with the jar each configuration adds.
// mode 'catalog': gradle/libs.versions.toml and two build files that read the same version from it.
//
// Frame: { mode, line, result, note, ...mode fields (see the scene data in gradleScenes.js) }

import { Stage, Panel, Card, Arrow, CodeLines, hCurve } from './BuildStageKit.jsx';

const W = 640;
const H = 296;

function Modules({ f, prev }) {
  const shared = f.exposed; // true with api: Jackson is on the app's compile classpath too
  const box = (x, y, w, title) => (
    <g>
      <rect x={x} y={y} width={w} height={70} rx="8" className="bst-panel is-dashed" />
      <text x={x + 10} y={y + 18} className="bst-section">{title}</text>
    </g>
  );
  return (
    <g>
      <Panel x={12} y={12} w={296} h={H - 24} title="service module" />
      <rect x={22} y={48} width={276} height={28} rx="5" className="bst-hl" />
      <text x={30} y={67} className="bst-code">{f.decl}</text>
      <text x={30} y={98} className="bst-sub">{f.why}</text>
      {box(22, 116, 276, 'Compile classpath')}
      <Card x={34} y={142} w={136} h={32} title="jackson-databind" tone="ok" titleSize={12} />
      {box(22, 200, 276, 'Runtime classpath')}
      <Card x={34} y={226} w={136} h={32} title="jackson-databind" tone="ok" titleSize={12} />

      <Panel x={332} y={12} w={296} h={H - 24} title="app module" />
      <rect x={342} y={48} width={276} height={28} rx="5" className="bst-hl" />
      <text x={350} y={67} className="bst-code">implementation(project(":service"))</text>
      <text x={350} y={98} className="bst-sub">The app uses the service module.</text>
      {box(342, 116, 276, 'Compile classpath')}
      <Card
        key={shared ? 'on' : 'off'}
        x={354}
        y={142}
        w={136}
        h={32}
        title={shared ? 'jackson-databind' : 'no Jackson'}
        tone={shared ? 'new' : 'bad'}
        state={shared ? 'focus' : 'ghost'}
        titleSize={12}
        isNew={!!prev.mode}
      />
      <Card x={502} y={142} w={104} h={32} title=":service" titleSize={12} />
      {box(342, 200, 276, 'Runtime classpath')}
      <Card x={354} y={226} w={136} h={32} title="jackson-databind" tone="ok" titleSize={12} />
      <Card x={502} y={226} w={104} h={32} title=":service" titleSize={12} />

      {/* Jackson always ships at run time; it reaches the app's compile classpath only with api */}
      {shared && <Arrow stage="cp" d={hCurve(170, 158, 354, 158)} tone="new" bold isNew label="api" lx={262} ly={152} anchor="middle" />}
      <Arrow stage="cp" d={hCurve(170, 242, 354, 242)} tone="ok" label="ships" lx={262} ly={236} anchor="middle" />
    </g>
  );
}

const COLS = [
  { x: 12, title: 'Compile classpath', foot: 'Used to compile main code.' },
  { x: 220, title: 'Runtime classpath', foot: 'Ships in the jar.' },
  { x: 428, title: 'Test classpath', foot: 'Main classpaths, plus this.' },
];

function Classpaths({ f }) {
  return (
    <g>
      {COLS.map((c, ci) => (
        <g key={c.title}>
          <Panel x={c.x} y={12} w={200} h={H - 24} title={c.title} />
          {f.cols[ci].map((j, i) => (
            <Card key={j.name} x={c.x + 12} y={56 + i * 58} w={176} h={44} title={j.name} sub={j.config} tone={j.tone} state={j.state} isNew />
          ))}
          <text x={c.x + 12} y={H - 26} className="bst-empty">{c.foot}</text>
        </g>
      ))}
    </g>
  );
}

const TOML = ['[versions]', 'jackson = "2.17.1"', '', '[libraries]', 'jackson-databind = {', '  module = "com.fasterxml…",', '  version.ref = "jackson" }'];

function Catalog() {
  return (
    <g>
      <Panel x={12} y={12} w={268} h={H - 24} title="gradle/libs.versions.toml" />
      <CodeLines x={28} y={70} w={240} lines={TOML} hl={[1]} step={24} />
      <text x={28} y={H - 28} className="bst-empty">One file holds the version.</text>

      <Card x={332} y={46} w={296} h={70} title="app/build.gradle.kts" tone="ok" titleTop titleSize={12} />
      <text x={342} y={98} className="bst-code">implementation(libs.jackson.databind)</text>
      <Card x={332} y={176} w={296} h={70} title="service/build.gradle.kts" tone="ok" titleTop titleSize={12} />
      <text x={342} y={228} className="bst-code">implementation(libs.jackson.databind)</text>

      {/* both build files read the same version line; the arrows enter the file panel from the right */}
      <Arrow stage="cp" d={`M332 81 C310 81 312 84 ${280 + 11} 84`} tone="ok" isNew />
      <Arrow stage="cp" d={`M332 211 C300 211 314 96 ${280 + 11} 96`} tone="ok" isNew />
    </g>
  );
}

export function ClasspathStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : {};
  return (
    <Stage name="cp" line={f.line} result={f.result} W={W} H={H} label={label}>
      {f.mode === 'modules' && <Modules f={f} prev={prev} />}
      {f.mode === 'classpaths' && <Classpaths f={f} />}
      {f.mode === 'catalog' && <Catalog />}
    </Stage>
  );
}
