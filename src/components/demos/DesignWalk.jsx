import { useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../lib/prefs.jsx';
import { Glossed } from '../Term.jsx';
import { usePlayer, useOnceVisible } from './usePlayer.js';
import { SOLID_SCENES, PATTERN_SCENES } from './designScenes.js';
import { CRYPTO_SCENES } from './cryptoScenes.js';

const TONE = {
  ok: { border: '2px solid var(--color-ok)', background: 'var(--color-ok-soft)', badge: 'var(--color-ok)' },
  bad: { border: '2px solid var(--color-bad)', background: 'var(--color-bad-soft)', badge: 'var(--color-bad)' },
  warn: { border: '2px solid var(--color-warn)', background: 'var(--color-warn-soft)', badge: 'var(--color-warn)' },
  new: { border: '2px solid var(--color-pen)', background: 'var(--color-pen-soft)', badge: 'var(--color-pen)' },
  none: { border: '2px solid #b9c7d9', background: '#fff', badge: '#556070' },
};
const DEP_COLOR = { ok: 'var(--color-ok)', bad: 'var(--color-bad)', none: 'var(--color-soft)' };

export function Walk({ scenes, ariaLabel }) {
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
    <figure ref={rootRef} className="demo" data-noread aria-label={ariaLabel}>
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

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {f.boxes.map((bx) => {
          const t = TONE[bx.tone || 'none'];
          return (
            <div key={bx.id} className="rounded-md px-2 py-1.5" style={{ border: t.border, background: t.background }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold">{bx.title}</span>
                {bx.badge && (
                  <span className="rounded-full px-2 text-[0.62rem] font-bold tracking-wide text-white" style={{ background: t.badge }}>
                    {bx.badge}
                  </span>
                )}
              </div>
              {bx.lines.map((ln) => (
                <div key={ln} className="text-xs font-mono text-soft">
                  {ln}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-2 min-h-[1.5rem] flex flex-col gap-1" aria-label="Dependencies">
        {f.deps.map((dp) => (
          <div key={`${dp.from}-${dp.to}-${dp.label}`} className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <span className="font-bold">{dp.from}</span>
            <span className="font-bold" style={{ color: DEP_COLOR[dp.tone || 'none'] }}>
              ──{dp.label}──▶
            </span>
            <span className="font-bold">{dp.to}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 rounded-md border border-pen/30 bg-pen-soft/60 px-3 py-2 min-h-[5rem] text-[0.95rem] leading-snug" role="status" aria-live="polite">
        <Glossed text={f.note} />
      </div>
    </figure>
  );
}

export const SolidWalk = () => <Walk scenes={SOLID_SCENES} ariaLabel="SOLID principles walk-through" />;
export const PatternsWalk = () => <Walk scenes={PATTERN_SCENES} ariaLabel="Design patterns walk-through" />;
export const CryptoWalk = () => <Walk scenes={CRYPTO_SCENES} ariaLabel="Encryption walk-through" />;
