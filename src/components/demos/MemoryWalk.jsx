import { useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../lib/prefs.jsx';
import { Glossed } from '../Term.jsx';
import { usePlayer, useOnceVisible } from './usePlayer.js';
import { SCENES } from './memoryScenes.js';

// one colour per object id, so a reference chip and the object it points to match at a glance
const HUES = { P1: 210, P2: 270, H1: 24, H2: 150, H3: 340 };
const color = (id) => `hsl(${HUES[id] ?? 190} 60% 38%)`;
const tint = (id) => `hsl(${HUES[id] ?? 190} 70% 94%)`;

function Obj({ o }) {
  return (
    <div
      className="rounded border-2 px-2 py-1 text-sm font-mono"
      style={{ borderColor: color(o.id), background: tint(o.id), opacity: o.dim ? 0.45 : 1, borderStyle: o.dim ? 'dashed' : 'solid' }}
    >
      <b style={{ color: color(o.id) }}>{o.id}</b> {o.type}
      <div className={o.changed ? 'font-bold' : ''}>{o.body}</div>
      {o.dim && <div className="text-xs font-sans text-soft">unreachable: eligible for GC</div>}
    </div>
  );
}

function Panel({ title, sub, children, className = '' }) {
  return (
    <div className={`rounded-md border border-slate-300 bg-white/70 px-2 py-1.5 ${className}`}>
      <div className="font-hand font-bold text-lg text-pen leading-tight">{title}</div>
      {sub && <div className="text-xs text-soft mb-1">{sub}</div>}
      {children}
    </div>
  );
}

/** Replayable walk through stack frames, heap objects and the string pool, one line of code at a time. */
export function MemoryWalk() {
  const reduced = useReducedMotion();
  const rootRef = useRef(null);
  const [sceneId, setSceneId] = useState(SCENES[0].id);
  const scene = SCENES.find((x) => x.id === sceneId);
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
    <figure ref={rootRef} className="demo" data-noread aria-label="Stack, heap and string pool walk-through">
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
        <span className="font-hand font-bold text-xl text-pen leading-tight">{scene.title}</span>
        <span className="text-xs font-bold uppercase tracking-wide text-ok bg-ok-soft rounded-full px-2">replayable animation</span>
      </figcaption>

      <div role="group" aria-label="Choose an example" className="flex flex-wrap gap-1.5 mb-2">
        {SCENES.map((x) => (
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

      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="Stack" sub="one per thread · frames push and pop">
          {f.stack.length === 0 && <div className="text-sm text-soft">empty</div>}
          <div className="flex flex-col-reverse gap-1.5">
            {f.stack.map((fr, i) => (
              <div key={`${fr.name}-${i}`} className="rounded border border-slate-400 bg-paper px-2 py-1">
                <div className="text-xs font-bold text-soft">{fr.name}()</div>
                {fr.vars.length === 0 && <div className="text-xs text-soft">no locals yet</div>}
                {fr.vars.map((x) => (
                  <div key={x.n} className="flex items-center gap-2 text-sm font-mono">
                    <span>{x.n}</span>
                    {x.ref ? (
                      <span className="rounded px-1.5 text-xs font-bold text-white" style={{ background: color(x.ref) }}>
                        → {x.ref}
                      </span>
                    ) : (
                      <span className="font-bold">{x.v}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Heap" sub="shared by all threads · objects live here, until garbage-collected">
          <div className="flex flex-wrap gap-2 mb-2">
            {f.heap.map((x) => (
              <Obj key={x.id} o={x} />
            ))}
            {f.heap.length === 0 && f.pool.length === 0 && <div className="text-sm text-soft">empty</div>}
          </div>
          <div className="rounded border border-dashed border-slate-400 px-2 py-1">
            <div className="text-xs font-bold text-soft">String pool (inside the heap)</div>
            <div className="flex flex-wrap gap-2 mt-1 min-h-[1.5rem]">
              {f.pool.map((x) => (
                <Obj key={x.id} o={x} />
              ))}
              {f.pool.length === 0 && <span className="text-xs text-soft">no strings yet</span>}
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-2 rounded-md border border-pen/30 bg-pen-soft/60 px-3 py-2 min-h-[4rem] text-[0.95rem] leading-snug" role="status" aria-live="polite">
        <Glossed text={f.note} />
      </div>
    </figure>
  );
}
