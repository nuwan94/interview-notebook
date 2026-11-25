// Maven lifecycle as an ordered list: the seven phases of the default lifecycle top to bottom, each with the plugin
// goal bound to it, a rail on the left that shows which phases run for the command, the separate clean lifecycle,
// and where the result ends up (target/, the local repository, Nexus).
//
// Frame: { line, upTo: index of the asked phase (-1 for none), clean: bool, result: { text, tone }, note }

import { Stage, Panel, Card, Arrow, HEAD, hCurve } from './BuildStageKit.jsx';

const W = 640;
const H = 334;
const ROW = { x: 52, y0: 54, step: 38, w: 298, h: 30 };
const PHASES = [
  { name: 'validate', goal: 'no goal by default' },
  { name: 'compile', goal: 'compiler:compile' },
  { name: 'test', goal: 'surefire:test' },
  { name: 'package', goal: 'jar:jar' },
  { name: 'verify', goal: 'failsafe:verify' },
  { name: 'install', goal: 'install:install' },
  { name: 'deploy', goal: 'deploy:deploy' },
];
const OUT = { x: 392, w: 224, h: 40 };
// where each result lands, and the phase that puts it there
const OUTPUTS = [
  { phase: 3, y: 140, title: 'target/', sub: 'payments-service.jar' },
  { phase: 5, y: 202, title: '~/.m2/repository', sub: 'local: this machine only' },
  { phase: 6, y: 264, title: 'Nexus', sub: 'remote: shared with the team' },
];
const rowY = (i) => ROW.y0 + i * ROW.step;

export function LifecycleStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { upTo: -1, clean: false };
  const ran = (i) => f.upTo >= 0 && i <= f.upTo;

  return (
    <Stage name="lc" line={f.line} result={f.result} W={W} H={H} label={label}>
      <Panel x={12} y={12} w={354} h={H - 24} title="Default lifecycle: phases in order" />

      {/* the rail: everything from the first phase down to the asked one runs, in order */}
      {f.upTo >= 0 && (
        <Arrow
          key={`rail-${f.upTo}`}
          stage="lc"
          d={`M34 ${rowY(0) + ROW.h / 2} V${rowY(f.upTo) + ROW.h / 2 - HEAD}`}
          tone="ok"
          bold
          isNew={prev.upTo !== f.upTo}
        />
      )}
      {PHASES.map((p, i) =>
        f.upTo > i ? <circle key={`dot${i}`} cx="34" cy={rowY(i) + ROW.h / 2} r="4.5" fill="var(--color-ok)" /> : null,
      )}

      {PHASES.map((p, i) => {
        const asked = i === f.upTo;
        const tone = f.upTo < 0 ? 'none' : asked ? 'new' : ran(i) ? 'ok' : 'none';
        const state = f.upTo < 0 ? undefined : asked ? 'focus' : ran(i) ? undefined : 'dim';
        const y = rowY(i);
        return (
          <g key={p.name}>
            <Card x={ROW.x} y={y} w={ROW.w} h={ROW.h} title={p.name} tone={tone} state={state} badge={asked ? 'asked' : null} />
            <text x={ROW.x + 112} y={y + 20} className="bst-code" opacity={state === 'dim' ? 0.35 : 1}>
              {p.goal}
            </text>
          </g>
        );
      })}

      <Panel x={378} y={12} w={250} h={H - 24} />
      <text x={392} y={36} className="bst-section">Separate clean lifecycle</text>
      <Card x={OUT.x} y={46} w={OUT.w} h={40} title="clean" sub="deletes target/" tone={f.clean ? 'ok' : 'none'} state={f.clean ? 'focus' : 'dim'} badge={f.clean ? 'ran first' : null} isNew={f.clean && !prev.clean} />
      <text x={392} y={124} className="bst-section">Where the result goes</text>
      {OUTPUTS.map((o) => {
        const reached = ran(o.phase);
        const isNew = reached && !(prev.upTo >= o.phase);
        return (
          <g key={o.title}>
            {reached && (
              <Arrow stage="lc" d={hCurve(ROW.x + ROW.w + 2, rowY(o.phase) + ROW.h / 2, OUT.x, o.y + OUT.h / 2)} tone="ok" isNew={isNew} />
            )}
            <Card x={OUT.x} y={o.y} w={OUT.w} h={OUT.h} title={o.title} sub={o.sub} tone={reached ? 'ok' : 'none'} state={reached ? (o.phase === f.upTo ? 'focus' : undefined) : 'dim'} isNew={isNew} />
          </g>
        );
      })}
    </Stage>
  );
}
