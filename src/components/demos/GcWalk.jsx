import { useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../lib/prefs.jsx';
import { Glossed } from '../Term.jsx';
import { usePlayer, useOnceVisible } from './usePlayer.js';
import { GC_SCENES } from './gcScenes.js';

const STATE_STYLE = {
  new: { background: '#ffffff', border: '2px solid var(--color-pen)', color: 'var(--color-pen)' },
  live: { background: 'var(--color-pen-soft)', border: '2px solid var(--color-pen)', color: 'var(--color-pen)' },
  marked: { background: 'var(--color-ok-soft)', border: '2px solid var(--color-ok)', color: 'var(--color-ok)' },
  dead: { background: '#eef0f3', border: '2px dashed #8b97a8', color: '#6b7788', textDecoration: 'line-through' },
};

function Cell({ cell }) {
  const st = STATE_STYLE[cell.state || 'live'];
  return (
    <span
      className="relative inline-flex h-9 w-9 items-center justify-center rounded font-mono text-sm font-bold transition-colors"
      style={st}
      title={`${cell.id}${cell.state === 'dead' ? ' (unreachable)' : ''}${cell.age ? `, age ${cell.age}` : ''}`}
    >
      {cell.id}
      {cell.age != null && <sup className="absolute -top-1 -right-1 rounded-full bg-white px-1 text-[0.6rem] font-sans text-soft border border-slate-300">{cell.age}</sup>}
    </span>
  );
}

function Slot() {
  return <span className="inline-block h-9 w-9 rounded border-2 border-dashed border-slate-300" aria-hidden="true" />;
}

function Region({ r }) {
  const slots = Array.from({ length: r.slots }, (_, i) => r.cells[i]);
  return (
    <div className="rounded-md border border-slate-300 bg-white/70 px-2 py-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-hand font-bold text-lg text-pen leading-tight">{r.name}</span>
        <span className="text-xs text-soft">{r.sub}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">{slots.map((cell, i) => (cell ? <Cell key={cell.id} cell={cell} /> : <Slot key={`s${i}`} />))}</div>
    </div>
  );
}

function Graph({ f }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="rounded-md border border-slate-300 bg-white/70 px-2 py-1.5">
        <div className="font-hand font-bold text-lg text-pen leading-tight">GC roots</div>
        <div className="text-xs text-soft mb-1">stack variables, static fields, live threads</div>
        {f.roots.map((root) => (
          <div key={root.n} className="flex items-center gap-2 text-sm font-mono py-0.5">
            <span>{root.n}</span>
            <span className="rounded bg-pen px-1.5 text-xs font-bold text-white">→ {root.ref}</span>
          </div>
        ))}
        {f.roots.length === 0 && <div className="text-sm text-soft">none</div>}
      </div>
      <div className="rounded-md border border-slate-300 bg-white/70 px-2 py-1.5">
        <div className="font-hand font-bold text-lg text-pen leading-tight">Heap objects</div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
          {f.cells.map((cell) => (
            <div key={cell.id} className="flex items-center gap-1.5">
              <Cell cell={cell} />
              <span className="text-xs font-mono text-soft">{cell.refs.length ? `→ ${cell.refs.join(', ')}` : 'no references'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const LEGEND = [
  ['new', 'just allocated'],
  ['live', 'in use'],
  ['marked', 'found reachable'],
  ['dead', 'unreachable garbage'],
];

/** Replayable walk through how a generational collector copies survivors, and how reachability decides what is garbage. */
export function GcWalk() {
  const reduced = useReducedMotion();
  const rootRef = useRef(null);
  const [sceneId, setSceneId] = useState(GC_SCENES[0].id);
  const scene = GC_SCENES.find((x) => x.id === sceneId);
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
    <figure ref={rootRef} className="demo" data-noread aria-label="Garbage collection walk-through">
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
        <span className="font-hand font-bold text-xl text-pen leading-tight">{scene.title}</span>
        <span className="text-xs font-bold uppercase tracking-wide text-ok bg-ok-soft rounded-full px-2">replayable animation</span>
      </figcaption>

      <div role="group" aria-label="Choose an example" className="flex flex-wrap gap-1.5 mb-2">
        {GC_SCENES.map((x) => (
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

      {scene.type === 'regions' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {f.regions.map((r) => (
            <Region key={r.name} r={r} />
          ))}
        </div>
      ) : (
        <Graph f={f} />
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-soft" aria-label="Legend">
        {LEGEND.map(([state, label]) => (
          <span key={state} className="inline-flex items-center gap-1">
            <span className="inline-block h-3.5 w-3.5 rounded-sm" style={STATE_STYLE[state]} />
            {label}
          </span>
        ))}
        {scene.type === 'regions' && <span>small number = age (collections survived)</span>}
      </div>

      <div className="mt-2 rounded-md border border-pen/30 bg-pen-soft/60 px-3 py-2 min-h-[5rem] text-[0.95rem] leading-snug" role="status" aria-live="polite">
        <Glossed text={f.note} />
      </div>
    </figure>
  );
}
