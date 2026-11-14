import { useLayoutEffect, useRef, useState } from 'react';
import { DemoControls, DemoHeader } from './DemoShell.jsx';
import { useReducedMotion } from '../../lib/prefs.jsx';
import { Glossed } from '../Term.jsx';
import { usePlayer, useOnceVisible } from './usePlayer.js';
import { CONCURRENCY_SCENES } from './concurrencyScenes.js';

const STATE = {
  running: { label: 'RUNNING', bg: 'var(--color-ok-soft)', fg: 'var(--color-ok)' },
  blocked: { label: 'BLOCKED', bg: 'var(--color-bad-soft)', fg: 'var(--color-bad)' },
  waiting: { label: 'WAITING', bg: 'var(--color-warn-soft)', fg: 'var(--color-warn)' },
  idle: { label: 'IDLE', bg: '#eef0f3', fg: '#556070' },
  done: { label: 'DONE', bg: 'var(--color-pen-soft)', fg: 'var(--color-pen)' },
};
const TONE = {
  ok: { background: 'var(--color-ok-soft)', border: '2px solid var(--color-ok)', color: 'var(--color-ok)' },
  bad: { background: 'var(--color-bad-soft)', border: '2px solid var(--color-bad)', color: 'var(--color-bad)' },
  warn: { background: 'var(--color-warn-soft)', border: '2px solid var(--color-warn)', color: 'var(--color-warn)' },
  none: { background: '#fff', border: '2px solid #b9c7d9', color: 'var(--color-ink)' },
};

/** Replayable thread scenes: a race, the same code with a lock, a deadlock, and a thread pool. */
export function ConcurrencyWalk() {
  const reduced = useReducedMotion();
  const rootRef = useRef(null);
  const [sceneId, setSceneId] = useState(CONCURRENCY_SCENES[0].id);
  const scene = CONCURRENCY_SCENES.find((x) => x.id === sceneId);
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
    <figure ref={rootRef} className="demo" data-noread aria-label="Concurrency walk-through">
      <DemoHeader title={scene.title} scenes={CONCURRENCY_SCENES} sceneId={sceneId} onPick={pick} />

      <div className="grid gap-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-1.5">
          {f.threads.map((t) => {
            const st = STATE[t.state];
            return (
              <div key={t.name} className="rounded-md border border-slate-300 bg-white/70 px-2 py-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-hand font-bold text-lg text-pen leading-tight">{t.name}</span>
                  <span className="rounded-full px-2 text-[0.65rem] font-bold tracking-wide" style={{ background: st.bg, color: st.fg }}>
                    {st.label}
                  </span>
                  {t.locals && <span className="ml-auto font-mono text-xs text-soft">{t.locals}</span>}
                </div>
                <div className="text-sm font-mono">{t.doing}</div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-1.5">
          {f.boxes.map((b) => (
            <div key={b.title} className="rounded-md border border-slate-300 bg-white/70 px-2 py-1.5">
              <div className="font-hand font-bold text-lg text-pen leading-tight">{b.title}</div>
              <div className="mt-1 flex flex-wrap gap-1.5 min-h-[2rem]">
                {b.items.map((it) => (
                  <span key={it.label} className="rounded px-2 py-0.5 font-mono text-sm font-bold" style={TONE[it.tone || 'none']}>
                    {it.label}
                  </span>
                ))}
                {b.items.length === 0 && <span className="text-xs text-soft self-center">empty</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 rounded-md border border-pen/30 bg-pen-soft/60 px-3 py-2 min-h-[5rem] text-[0.95rem] leading-snug" role="status" aria-live="polite">
        <Glossed text={f.note} />
      </div>
      <DemoControls p={p} />
    </figure>
  );
}
