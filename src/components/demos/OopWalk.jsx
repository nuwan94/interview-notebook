import { useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../lib/prefs.jsx';
import { Glossed } from '../Term.jsx';
import { usePlayer, useOnceVisible } from './usePlayer.js';
import { OOP_SCENES } from './oopScenes.js';

const METHOD = {
  checked: { background: 'var(--color-warn-soft)', border: '2px solid var(--color-warn)', color: 'var(--color-warn)' },
  found: { background: 'var(--color-ok-soft)', border: '2px solid var(--color-ok)', color: 'var(--color-ok)' },
  miss: { background: '#eef0f3', border: '2px dashed #8b97a8', color: '#6b7788', textDecoration: 'line-through' },
  none: { background: '#fff', border: '2px solid #b9c7d9', color: 'var(--color-ink)' },
};
const CLASS_BORDER = {
  active: '2px solid var(--color-pen)',
  searching: '2px dashed var(--color-warn)',
  found: '2px solid var(--color-ok)',
  done: '2px solid var(--color-ok)',
};

function ClassBox({ c, depth }) {
  return (
    <div style={{ marginLeft: `${depth * 1.25}rem` }}>
      {c.parent && (
        <div className="text-xs text-soft leading-none pb-0.5" aria-hidden="true">
          ↑ extends {c.parent}
        </div>
      )}
      <div className="rounded-md bg-white/80 px-2 py-1.5" style={{ border: CLASS_BORDER[c.state] || '1px solid #b9c7d9' }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-hand font-bold text-lg text-pen leading-tight">{c.name}</span>
          {c.state === 'searching' && <span className="text-[0.65rem] font-bold text-warn">SEARCHING HERE</span>}
          {c.state === 'active' && <span className="text-[0.65rem] font-bold text-pen">RUNNING</span>}
          {c.state === 'done' && <span className="text-[0.65rem] font-bold text-ok">DONE</span>}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {c.methods.map((mm) => (
            <span key={mm.sig} className="rounded px-2 py-0.5 font-mono text-sm font-bold" style={METHOD[mm.state || 'none']}>
              {mm.sig}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Replayable walk through method lookup, overload resolution and constructor order. */
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

  // depth = how many parents above the class
  const depthOf = (c) => {
    let d = 0;
    let cur = c;
    while (cur?.parent) {
      cur = f.classes.find((x) => x.name === cur.parent);
      d++;
    }
    return d;
  };

  return (
    <figure ref={rootRef} className="demo" data-noread aria-label="Object-oriented programming walk-through">
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
        <span className="font-hand font-bold text-xl text-pen leading-tight">{scene.title}</span>
        <span className="text-xs font-bold uppercase tracking-wide text-ok bg-ok-soft rounded-full px-2">replayable animation</span>
      </figcaption>

      <div role="group" aria-label="Choose an example" className="flex flex-wrap gap-1.5 mb-2">
        {OOP_SCENES.map((x) => (
          <button key={x.id} type="button" className="chip" aria-pressed={x.id === sceneId} onClick={() => pick(x.id)}>
            {x.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button type="button" className="btn primary" onClick={() => (p.playing ? p.pause() : p.play())}>
          {p.playing ? '⏸ Pause' : p.index >= p.last ? '▶ Play again' : '▶ Play'}
        </button>
        <button type="button" className="btn" onClick={p.replay}>
          ↺ Replay
        </button>
        <button type="button" className="btn" onClick={() => p.step(-1)} disabled={p.index === 0} aria-label="Previous step">
          ◀
        </button>
        <button type="button" className="btn" onClick={() => p.step(1)} disabled={p.index >= p.last} aria-label="Next step">
          ▶
        </button>
        <span className="text-xs text-soft">
          Step {p.index + 1} of {p.last + 1}
        </span>
      </div>

      <pre className="m-0 mb-2 rounded border border-slate-300 bg-slate-50 py-1 text-sm leading-6 overflow-x-auto" aria-label="Code">
        {scene.code.map((ln, i) => (
          <div key={i} className="px-2" style={i === f.line ? { background: 'var(--color-hi, #fff3a3)', fontWeight: 700 } : undefined}>
            <span className="inline-block w-5 text-soft select-none">{i + 1}</span>
            {ln}
            {i === f.line && f.result && <span className="ml-2 font-sans text-xs text-ok">→ {f.result}</span>}
          </div>
        ))}
      </pre>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-1.5">
          {f.classes.map((c) => (
            <ClassBox key={c.name} c={c} depth={depthOf(c)} />
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          {f.vars && (
            <div className="rounded-md border border-slate-300 bg-white/70 px-2 py-1.5">
              <div className="font-hand font-bold text-lg text-pen leading-tight">Variable and object</div>
              {f.vars.length === 0 && <div className="text-sm text-soft">no variable yet</div>}
              {f.vars.map((v) => (
                <div key={v.n} className="mt-1 text-sm font-mono">
                  <b>{v.n}</b>
                  <div className="text-xs text-soft font-sans">
                    declared type: <b className="font-mono text-warn">{v.declared}</b>
                  </div>
                  <div className="text-xs text-soft font-sans">
                    actual object: <b className="font-mono text-ok">{v.actual}</b>
                  </div>
                </div>
              ))}
            </div>
          )}
          {f.log && (
            <div className="rounded-md border border-slate-300 bg-white/70 px-2 py-1.5">
              <div className="font-hand font-bold text-lg text-pen leading-tight">Order of execution</div>
              {f.log.length === 0 && <div className="text-sm text-soft">nothing has run yet</div>}
              <ol className="m-0 mt-1 list-decimal pl-5 text-sm font-mono" style={{ listStyle: 'decimal' }}>
                {f.log.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 rounded-md border border-pen/30 bg-pen-soft/60 px-3 py-2 min-h-[5rem] text-[0.95rem] leading-snug" role="status" aria-live="polite">
        <Glossed text={f.note} />
      </div>
    </figure>
  );
}
