import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuRotateCcw } from 'react-icons/lu';
import { PlayLabel } from '../PlayLabel.jsx';
import { defaultKeyFns, opLabel, runScenario, stringHash } from '../../sim/hashmap.js';
import { useReducedMotion } from '../../lib/prefs.jsx';
import { Glossed } from '../Term.jsx';
import { BucketTable } from './BucketTable.jsx';
import { CalcPanel } from './CalcPanel.jsx';
import { useOnceVisible, usePlayer } from './usePlayer.js';

const SPEEDS = [0.5, 1, 2, 4];

/**
 * A replayable HashMap animation. `variants` lets one figure host several scenarios (tabs).
 * Each variant: { id, label, blurb, ops, kf?, capacity?, brief?, speed?, input? }
 */
export function Playground({ title, variants }) {
  const reduced = useReducedMotion();
  const uid = useId();
  const [vi, setVi] = useState(0);
  const v = variants[vi];
  const [userOps, setUserOps] = useState([]);
  const [text, setText] = useState('');
  const rootRef = useRef(null);
  const kf = v.kf || defaultKeyFns;

  useEffect(() => setUserOps([]), [vi]);

  // makeOps builds fresh key objects each run, so replaying never sees keys mutated by a previous run
  const { frames, opStarts, ops, baseCount } = useMemo(() => {
    const base = v.makeOps ? v.makeOps() : v.ops;
    const ops = [...base, ...userOps];
    return { ...runScenario({ kf, capacity: v.capacity || 16, ops, brief: v.brief, intro: v.intro }), ops, baseCount: base.length };
  }, [v, userOps, kf]);

  const p = usePlayer(frames, { speed: v.speed || 1 });
  const frame = frames[p.index];
  const opIdx = frame.op;

  // restart the animation whenever the scenario (tab) changes
  const prevVi = useRef(vi);
  useEffect(() => {
    if (prevVi.current === vi) return; // initial mount (also under StrictMode's double effect run)
    prevVi.current = vi;
    p.seek(0);
    if (!reduced) p.play();
  }, [vi]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep the ruled lines of the page registered with the text that follows the figure:
  // pad the bottom margin so (height + margin) is always a whole number of ruled lines
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const fit = () => {
      const lh = parseFloat(getComputedStyle(document.documentElement).fontSize) * 2;
      el.style.marginBottom = '0px';
      const h = el.getBoundingClientRect().height;
      el.style.marginBottom = `${lh + Math.ceil(h / lh) * lh - h}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // autoplay once when scrolled into view (never under reduced-motion)
  useOnceVisible(rootRef, () => p.play(), !reduced);

  const addOp = (type) => {
    if (!v.input || !text.trim()) return;
    const raw = text.trim();
    let key = raw;
    if (v.input.kind === 'int') {
      key = parseInt(raw, 10);
      if (Number.isNaN(key)) return;
    }
    const at = frames.length;
    const next = [...userOps, { type, key, value: type === 'put' ? baseCount + userOps.length + 1 : undefined }];
    setUserOps(next);
    setText('');
    // jump to the new operation once the frames have been rebuilt
    setTimeout(() => p.replayFrom(at), 0);
  };

  return (
    <figure ref={rootRef} className="demo" data-noread aria-label={title}>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
        <span className="font-hand font-bold text-xl text-pen leading-tight">{title}</span>
        <span className="text-xs font-bold uppercase tracking-wide text-ok bg-ok-soft rounded-full px-2">replayable animation</span>
      </figcaption>

      {variants.length > 1 && (
        <div role="group" aria-label="Scenarios" className="flex flex-wrap gap-1.5 mb-2">
          {variants.map((x, i) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={i === vi}
              className="chip"
              onClick={() => setVi(i)}
            >
              {x.label}
            </button>
          ))}
        </div>
      )}
      {v.blurb && (
        <p className="text-sm text-soft mb-2 max-w-prose">
          <Glossed text={v.blurb} />
        </p>
      )}

      {/* transport controls */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button type="button" className="btn primary" onClick={() => (p.playing ? p.pause() : p.play())}>
          <PlayLabel p={p} />
        </button>
        <button type="button" className="btn" onClick={p.replay} title="Start over from the beginning">
          <LuRotateCcw aria-hidden="true" className="btn-icon" /> Replay
        </button>
        <button type="button" className="btn" onClick={() => p.step(-1)} disabled={p.index === 0} aria-label="Previous step">
          ◀
        </button>
        <button type="button" className="btn" onClick={() => p.step(1)} disabled={p.index >= p.last} aria-label="Next step">
          ▶
        </button>
        <label className="text-xs font-bold text-soft flex items-center gap-1 ml-auto">
          Speed
          <select
            className="border border-slate-300 rounded px-1 py-0.5 bg-white text-sm"
            value={p.speed}
            onChange={(e) => p.setSpeed(Number(e.target.value))}
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <input
          type="range"
          min={0}
          max={p.last}
          value={p.index}
          onChange={(e) => p.seek(Number(e.target.value))}
          className="w-full accent-[var(--color-pen)]"
          aria-label="Animation progress"
        />
        <span className="text-xs font-mono text-soft whitespace-nowrap tabular-nums">
          {p.index + 1}/{frames.length}
        </span>
      </div>

      {/* what is happening now */}
      <div
        className="rounded-md border border-pen/30 bg-pen-soft/60 px-3 py-2 mb-3 min-h-[4.2rem] flex items-center gap-3"
        role="status"
        aria-live="polite"
      >
        <p className="m-0 text-[0.95rem] leading-snug flex-1">
          <Glossed text={frame.caption} />
        </p>
        {frame.result && (
          <span
            className={`font-mono text-sm font-bold px-2 py-0.5 rounded ${frame.result.kind === 'null' ? 'bg-bad-soft text-bad' : 'bg-ok-soft text-ok'}`}
          >
            {frame.result.text}
          </span>
        )}
      </div>

      <div className="grid gap-3">
        <div className="rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2 min-h-[10.5rem]">
          <CalcPanel calc={frame.calc} snap={frame.snap} tags={frame.tags} />
        </div>
        <div className="min-w-0 max-h-[24rem] overflow-y-auto pr-1">
          <BucketTable snap={frame.snap} active={frame.active} tags={frame.tags} />
        </div>
      </div>

      {/* jump to an operation */}
      {ops.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-soft mr-1">Jump to</span>
          {ops.map((op, i) => (
            <button
              key={i}
              type="button"
              className="chip mono"
              aria-current={opIdx === i}
              onClick={() => p.replayFrom(opStarts[i])}
              title="Replay this operation"
            >
              {opLabel(op, kf)}
            </button>
          ))}
        </div>
      )}

      {v.input && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-slate-300 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            addOp('put');
          }}
        >
          <label className="text-sm font-bold" htmlFor={`${uid}-in`}>
            Try your own key
          </label>
          <input
            id={`${uid}-in`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            inputMode={v.input.kind === 'int' ? 'numeric' : 'text'}
            placeholder={v.input.placeholder}
            className="border border-slate-300 rounded px-2 py-1 font-mono text-sm w-40 bg-white"
            maxLength={24}
          />
          <button type="submit" className="btn" disabled={!text.trim() || userOps.length >= 12}>
            put
          </button>
          <button type="button" className="btn" onClick={() => addOp('get')} disabled={!text.trim() || userOps.length >= 12}>
            get
          </button>
          <button type="button" className="btn" onClick={() => addOp('remove')} disabled={!text.trim() || userOps.length >= 12}>
            remove
          </button>
          {userOps.length > 0 && (
            <button type="button" className="btn" onClick={() => setUserOps([])}>
              Reset my keys
            </button>
          )}
          <span className="text-xs text-soft w-full">
            {v.input.kind === 'string' ? (
              <>
                Tip: try <code>Aa</code> and <code>BB</code> — different strings, identical <code>hashCode()</code> ({stringHash('Aa')}).
              </>
            ) : (
              <>Tip: in a 16-bucket table, keys 1, 17, 33 … all land in bucket 1.</>
            )}
          </span>
        </form>
      )}
    </figure>
  );
}
