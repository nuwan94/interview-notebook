import { useLayoutEffect, useRef, useState } from 'react';
import { DemoControls, DemoHeader } from './DemoShell.jsx';
import { useReducedMotion } from '../../lib/prefs.jsx';
import { Glossed } from '../Term.jsx';
import { usePlayer, useOnceVisible } from './usePlayer.js';
import { OOP_SCENES } from './oopScenes.js';
import { OopStage } from './OopStage.jsx';

const RESULT = { ok: 'var(--color-ok)', warn: 'var(--color-warn)', bad: 'var(--color-bad)', new: 'var(--color-pen)' };

/** Replayable walk through method lookup, overload resolution and constructor order, drawn by OopStage. */
export function OopWalk() {
  const reduced = useReducedMotion();
  const rootRef = useRef(null);
  const [sceneId, setSceneId] = useState(OOP_SCENES[0].id);
  const scene = OOP_SCENES.find((x) => x.id === sceneId);
  const p = usePlayer(scene.frames, { speed: 1 });
  const f = scene.frames[p.index];

  // keep the ruled lines of the page registered with the text after the figure
  useLayoutEffect(() => {
    const el = rootRef.current;
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

  useOnceVisible(rootRef, () => p.play(), !reduced);

  const pick = (id) => {
    setSceneId(id);
    p.seek(0);
  };

  return (
    <figure ref={rootRef} className="demo" data-noread aria-label="Object-oriented programming walk-through">
      <DemoHeader title={scene.title} scenes={OOP_SCENES} sceneId={sceneId} onPick={pick} />

      <pre className="m-0 mb-2 rounded border border-slate-300 bg-slate-50 py-1 text-sm leading-6 overflow-x-auto" aria-label="Code">
        {scene.code.map((ln, i) => (
          <div key={i} className="px-2" style={i === f.line ? { background: 'var(--color-hi, #fff3a3)', fontWeight: 700 } : undefined}>
            <span className="inline-block w-5 text-soft select-none">{i + 1}</span>
            {ln}
            {i === f.line && f.result && (
              <span className="ml-2 rounded-full px-2 py-0.5 font-sans text-xs font-bold text-white" style={{ background: RESULT[f.result.tone] || RESULT.new }}>
                {f.result.text}
              </span>
            )}
          </div>
        ))}
      </pre>

      <OopStage key={scene.id} frames={scene.frames} index={p.index} label="Object-oriented programming walk-through" />

      <div className="mt-2 rounded-md border border-pen/30 bg-pen-soft/60 px-3 py-2 min-h-[5rem] text-[0.95rem] leading-snug" role="status" aria-live="polite">
        <Glossed text={f.note} />
      </div>
      <DemoControls p={p} />
    </figure>
  );
}
