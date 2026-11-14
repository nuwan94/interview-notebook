import { useEffect, useRef } from 'react';
import { LuPause, LuPlay, LuRotateCcw, LuSkipBack, LuSkipForward } from 'react-icons/lu';

const SPEEDS = [0.5, 1, 2, 4];

/**
 * Top of every animation: a scrollable tab strip to pick the example, then its title.
 * `scenes` are { id, label }; with one scene (or none) the strip is left out.
 */
export function DemoHeader({ title, scenes, sceneId, onPick }) {
  const tabs = scenes && scenes.length > 1;
  return (
    <>
      {tabs && (
        <div role="group" aria-label="Choose an example" className="demo-tabs">
          {scenes.map((x) => (
            <button key={x.id} type="button" className="chip demo-tab" aria-pressed={x.id === sceneId} onClick={() => onPick(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
      )}
      {/* with tabs the selected tab names the example, so the title stays for screen readers only */}
      <figcaption className={tabs ? 'sr-only' : 'demo-head'}>
        <span className="demo-title">{title}</span>
      </figcaption>
    </>
  );
}

/**
 * Transport bar, pinned to the bottom of the figure while it is on screen: previous, play/pause, next,
 * a clickable progress track (one segment per step, or a slider when there are many), the step counter,
 * replay and an optional speed control. Keyboard shortcuts work while the pointer is over the animation or focus is inside it.
 */
export function DemoControls({ p, unit = 'step', speeds = false }) {
  const total = p.last + 1;
  const atEnd = p.index >= p.last;
  const PlayIcon = p.playing ? LuPause : atEnd ? LuRotateCcw : LuPlay;
  const label = p.playing ? 'Pause' : atEnd ? 'Play again' : 'Play';

  // Keyboard shortcuts for the animation the pointer is over or that holds focus:
  // Space / K play or pause, Left / J previous, Right / L next, Home restart.
  const bar = useRef(null);
  const live = useRef(p);
  live.current = p;
  useEffect(() => {
    const fig = bar.current?.closest('figure');
    if (!fig) return undefined;
    let hovered = false;
    const enter = () => (hovered = true);
    const leave = () => (hovered = false);
    fig.addEventListener('pointerenter', enter);
    fig.addEventListener('pointerleave', leave);
    const onKey = (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!hovered && !fig.contains(document.activeElement)) return;
      const t = e.target;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const q = live.current;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'j') q.step(-1);
      else if (k === 'arrowright' || k === 'l') q.step(1);
      else if (k === 'home') q.replay();
      else if ((k === ' ' || k === 'k') && !(t.tagName === 'BUTTON' && k === ' ')) {
        if (q.playing) q.pause();
        else if (q.index >= q.last) q.replay();
        else q.play();
      } else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      fig.removeEventListener('pointerenter', enter);
      fig.removeEventListener('pointerleave', leave);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div ref={bar} className="demo-bar" role="group" aria-label="Animation controls" aria-keyshortcuts="Space ArrowLeft ArrowRight">
      <button type="button" className="demo-icon-btn" onClick={() => p.step(-1)} disabled={p.index === 0} aria-label={`Previous ${unit}`} title={`Previous ${unit} (←)`}>
        <LuSkipBack aria-hidden="true" />
      </button>
      <button type="button" className="btn primary demo-play" title={`${label} (Space)`} onClick={() => (p.playing ? p.pause() : p.play())}>
        <PlayIcon aria-hidden="true" className="btn-icon" /> {label}
      </button>
      <button type="button" className="demo-icon-btn" onClick={() => p.step(1)} disabled={atEnd} aria-label={`Next ${unit}`} title={`Next ${unit} (→)`}>
        <LuSkipForward aria-hidden="true" />
      </button>

      {total <= 14 ? (
        <div className="demo-track" role="group" aria-label={`Jump to a ${unit}`}>
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`demo-seg ${i < p.index ? 'is-done' : ''}`}
              aria-current={i === p.index ? 'step' : undefined}
              aria-label={`${unit} ${i + 1} of ${total}`}
              title={`${unit} ${i + 1}`}
              onClick={() => p.seek(i)}
            />
          ))}
        </div>
      ) : (
        <input
          type="range"
          className="demo-range"
          min={0}
          max={p.last}
          value={p.index}
          aria-label={`${unit} position`}
          onChange={(e) => p.seek(Number(e.target.value))}
        />
      )}

      <span className="demo-count" aria-live="off">
        {p.index + 1} / {total}
      </span>
      <button type="button" className="demo-icon-btn demo-replay" onClick={p.replay} aria-label="Replay from the start" title="Replay from the start">
        <LuRotateCcw aria-hidden="true" />
      </button>
      {speeds && (
        <label className="demo-speed">
          <span className="sr-only">Speed</span>
          <select value={p.speed} onChange={(e) => p.setSpeed(Number(e.target.value))} title="Playback speed">
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
