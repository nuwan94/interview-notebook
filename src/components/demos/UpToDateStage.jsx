// Gradle up-to-date checks: the compileJava task with its input files (each with a hash) on the left and its output
// files on the right, the hashes Gradle saved from the last run below, and the build cache. Shows a first build, a
// build with no change, a build after one edit, and a cache hit.
//
// Frame: { line, result, note,
//          inputs: [{ name, hash, tone }], outputs: [{ name, tone }], outputsState,
//          compile: { outcome, tone }, test: null | { outcome, tone },
//          record: null | { inputs, outputs, state }, cache: { key, by, tone, state }, cacheHit: bool }

import { Stage, Panel, Card, Arrow, Pill, HEAD, hCurve } from './BuildStageKit.jsx';

const W = 640;
const H = 340;
const IN = { x: 16, w: 176, y: 20, h: 186 };
const TASK = { x: 220, y: 78, w: 132, h: 66 };
const OUTP = { x: 380, w: 124, y: 20, h: 186 };
const TEST = { x: 532, y: 78, w: 96, h: 66 };
const MID = TASK.y + 30;

export function UpToDateStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : { inputs: [], outputs: [], record: null, test: null };
  const changed = (i) => prev.inputs[i] && prev.inputs[i].hash !== f.inputs[i].hash;

  return (
    <Stage name="ud" line={f.line} result={f.result} W={W} H={H} label={label}>
      {/* inputs, each with its hash */}
      <Panel x={IN.x} y={IN.y} w={IN.w} h={IN.h} />
      <text x={IN.x + 12} y={IN.y + 22} className="bst-section">Inputs</text>
      {f.inputs.map((it, i) => {
        const y = IN.y + 34 + i * 36;
        return (
          <g key={it.name}>
            <Card x={IN.x + 8} y={y} w={IN.w - 16} h={28} title={it.name} tone={it.tone} titleSize={12} isNew={changed(i)} />
            <Pill x={IN.x + IN.w - 14} y={y + 5} text={it.hash} tone={it.tone === 'none' ? 'none' : it.tone} anchor="end" />
          </g>
        );
      })}

      <Arrow stage="ud" d={hCurve(IN.x + IN.w, MID, TASK.x, MID)} tone="none" />
      <Card x={TASK.x} y={TASK.y} w={TASK.w} h={TASK.h} title="compileJava" tone={f.compile.tone} state="focus" titleTop />
      <Pill key={`c-${f.compile.outcome}`} x={TASK.x + TASK.w / 2} y={TASK.y + 34} text={f.compile.outcome} tone={f.compile.tone} anchor="middle" />
      <Arrow stage="ud" d={hCurve(TASK.x + TASK.w, MID, OUTP.x, MID)} tone="none" />

      {/* outputs */}
      <g opacity={f.outputsState === 'dim' ? 0.4 : 1}>
        <Panel x={OUTP.x} y={OUTP.y} w={OUTP.w} h={OUTP.h} />
        <text x={OUTP.x + 12} y={OUTP.y + 22} className="bst-section">Outputs</text>
        {f.outputs.map((o, i) => (
          <Card key={o.name} x={OUTP.x + 8} y={OUTP.y + 34 + i * 36} w={OUTP.w - 16} h={28} title={o.name} tone={o.tone} state={f.outputsState === 'dim' ? 'ghost' : undefined} titleSize={12} />
        ))}
      </g>

      {f.test && (
        <g>
          <Arrow stage="ud" d={hCurve(OUTP.x + OUTP.w, MID, TEST.x, MID)} tone={f.test.tone} isNew={!prev.test} />
          <Card x={TEST.x} y={TEST.y} w={TEST.w} h={TEST.h} title="test" tone={f.test.tone} titleTop isNew={!prev.test} />
          <Pill x={TEST.x + TEST.w / 2} y={TEST.y + 34} text={f.test.outcome} tone={f.test.tone} anchor="middle" />
        </g>
      )}

      {/* what Gradle remembers */}
      <g opacity={f.record && f.record.state === 'dim' ? 0.4 : 1}>
        <rect x={16} y={222} width={336} height={104} rx="10" className={`bst-card tone-${f.record ? f.record.tone || 'none' : 'none'} ${f.record && f.record.state === 'focus' ? 'is-focus' : ''}`} />
        <text x={28} y={244} className="bst-section">Hashes saved from the last run</text>
        {f.record ? (
          <g key={f.record.inputs} className={prev.record && prev.record.inputs === f.record.inputs ? '' : 'g-pop'}>
            <text x={28} y={272} className="bst-code">inputs:  {f.record.inputs}</text>
            <text x={28} y={298} className="bst-code">outputs: {f.record.outputs}</text>
          </g>
        ) : (
          <text x={28} y={276} className="bst-empty">{f.recordEmpty || 'Nothing saved yet: this is the first build.'}</text>
        )}
      </g>

      <g opacity={f.cache.state === 'dim' ? 0.4 : 1}>
        <rect x={368} y={222} width={260} height={104} rx="10" className={`bst-card tone-${f.cache.tone} ${f.cache.state === 'focus' ? 'is-focus' : ''}`} />
        <text x={380} y={244} className="bst-section">Build cache (local or shared)</text>
        <text x={380} y={272} className="bst-code">{f.cache.key}</text>
        <text x={380} y={298} className="bst-sub">{f.cache.by}</text>
      </g>
      {f.cacheHit && (
        // leaves the cache box at its left end and stays left of the outputs panel, so it crosses nothing
        <Arrow stage="ud" d={`M376 222 C376 188 336 190 336 ${TASK.y + TASK.h + 1 + HEAD}`} tone="ok" bold isNew label="copy outputs" lx={344} ly={204} anchor="end" />
      )}
    </Stage>
  );
}
