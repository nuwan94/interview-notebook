// Maven multi-module build: the parent pom with its <modules> list on the left, and on the right the modules in
// the order the reactor builds them, with "needs" arrows between modules and the result of each one.
//
// Frame: { line, result, note, hl: [pom line indices], order: bool,
//          modules: [{ id, slot, sub, status, tone, state }], needs: [[fromId, toId]] (adjacent slots only) }

import { Stage, Panel, Card, Arrow, Pill, HEAD, CodeLines } from './BuildStageKit.jsx';

const W = 640;
const H = 300;
const POM = [
  '<packaging>pom</packaging>',
  '<modules>',
  '  <module>app</module>',
  '  <module>service</module>',
  '  <module>api</module>',
  '  <module>reports</module>',
  '</modules>',
  '<dependencyManagement>',
  '  ...shared versions',
];
const SLOT = { y0: 54, step: 60, h: 38, x: 322, w: 188 };
const slotY = (i) => SLOT.y0 + i * SLOT.step;

export function ReactorStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { modules: [], needs: [] };
  const by = Object.fromEntries(f.modules.map((m) => [m.id, m]));
  const moved = (m) => {
    const p = prev.modules.find((x) => x.id === m.id);
    return !p || p.slot !== m.slot;
  };

  return (
    <Stage name="rx" line={f.line} result={f.result} W={W} H={H} label={label}>
      <Panel x={12} y={12} w={244} h={H - 24} title="Parent pom.xml" />
      <CodeLines x={26} y={64} w={222} lines={POM} hl={f.hl} step={24} />

      <Panel x={268} y={12} w={360} h={H - 24} title={f.order ? 'Reactor: build order' : 'Modules, in list order'} />

      {f.needs.map(([a, b]) => {
        const from = by[a];
        const to = by[b];
        const x = SLOT.x + 70;
        return (
          <Arrow
            key={`${a}-${b}`}
            stage="rx"
            d={`M${x} ${slotY(from.slot)} V${slotY(to.slot) + SLOT.h + 1 + HEAD}`}
            tone={from.state === 'dim' ? 'none' : 'new'}
            isNew={!prev.needs.some(([x1, y1]) => x1 === a && y1 === b)}
            label="needs"
            lx={x + 8}
            ly={slotY(to.slot) + SLOT.h + 15}
          />
        );
      })}

      {f.modules.map((m) => {
        const y = slotY(m.slot);
        return (
          <g key={m.id} opacity={m.state === 'dim' ? 0.4 : 1}>
            {f.order && (
              <g>
                <circle cx={SLOT.x - 22} cy={y + SLOT.h / 2} r="12" fill="var(--color-pen)" />
                <text x={SLOT.x - 22} y={y + SLOT.h / 2 + 4.5} textAnchor="middle" className="bst-num">
                  {m.slot + 1}
                </text>
              </g>
            )}
            <Card x={SLOT.x} y={y} w={SLOT.w} h={SLOT.h} title={m.id} sub={m.sub} tone={m.tone} state={m.state === 'dim' ? undefined : m.state} isNew={moved(m)} />
            {m.status && <Pill x={SLOT.x + SLOT.w + 12} y={y + 10} text={m.status} tone={m.tone === 'none' ? 'none' : m.tone} />}
          </g>
        );
      })}
    </Stage>
  );
}
