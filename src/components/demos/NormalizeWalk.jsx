import { useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../lib/prefs.jsx';
import { Glossed } from '../Term.jsx';
import { usePlayer, useOnceVisible } from './usePlayer.js';
import { NORMALIZE_SCENES } from './normalizeScenes.js';

const TONE = {
  ok: { border: 'var(--color-ok)', bg: 'var(--color-ok-soft)' },
  bad: { border: 'var(--color-bad)', bg: 'var(--color-bad-soft)' },
  warn: { border: 'var(--color-warn)', bg: 'var(--color-warn-soft)' },
  new: { border: 'var(--color-pen)', bg: 'var(--color-pen-soft)' },
};

/** Animated table views: rows keep their keys between frames, so new rows slide in and changed cells flash. */
export function NormalizeWalk({ scenes = NORMALIZE_SCENES }) {
  const reduced = useReducedMotion();
  const rootRef = useRef(null);
  const [sceneId, setSceneId] = useState(scenes[0].id);
  const scene = scenes.find((x) => x.id === sceneId);
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
    <figure ref={rootRef} className="demo" data-noread aria-label="Normalisation walk-through with table views">
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
        <span className="font-hand font-bold text-xl text-pen leading-tight">{scene.title}</span>
        <span className="text-xs font-bold uppercase tracking-wide text-ok bg-ok-soft rounded-full px-2">replayable animation</span>
      </figcaption>

      <div role="group" aria-label="Choose an example" className="flex flex-wrap gap-1.5 mb-2">
        {scenes.map((x) => (
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

      <div className="flex flex-wrap gap-3 items-start min-h-[8rem]">
        {f.tables.map((tb) => {
          const tone = TONE[tb.tone];
          return (
            <div key={`${scene.id}-${tb.id}`} className="ntbl-card min-w-0 max-w-full">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-mono text-sm font-bold">{tb.name}</span>
                {tb.badge && (
                  <span className="rounded-full px-2 text-[0.62rem] font-bold tracking-wide text-white" style={{ background: tone ? tone.border : '#556070' }}>
                    {tb.badge}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto max-w-full">
                <table className="ntbl">
                  <thead>
                    <tr>
                      {tb.cols.map((c, ci) => (
                        <th key={c} className={tb.pk.includes(ci) ? 'ntbl-pk' : ''}>
                          {c}
                          {tb.pk.includes(ci) && <sup>PK</sup>}
                          {tb.fk.includes(ci) && <sup>FK</sup>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tb.rows.map((row) => {
                      const rt = row.tone ? TONE[row.tone] : null;
                      return (
                        <tr key={row.key} className="ntbl-row" style={rt ? { background: rt.bg } : undefined}>
                          {row.cells.map((v, ci) => {
                            const hl = row.hl?.includes(ci);
                            return (
                              <td
                                key={hl ? `${p.index}-${ci}` : ci}
                                className={hl ? 'ntbl-hl' : ''}
                                style={hl && rt ? { outline: `2px solid ${rt.border}`, outlineOffset: '-2px' } : undefined}
                              >
                                {v === null ? <span className="text-soft">NULL</span> : String(v)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 rounded-md border border-pen/30 bg-pen-soft/60 px-3 py-2 min-h-[5rem] text-[0.95rem] leading-snug" role="status" aria-live="polite">
        <Glossed text={f.note} />
      </div>
    </figure>
  );
}
