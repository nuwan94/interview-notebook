import { useEffect, useRef, useState } from 'react';
import { LuEllipsis, LuGripVertical, LuMaximize2, LuMinimize2, LuPause, LuPlay, LuRotateCcw, LuSkipBack, LuSkipForward } from 'react-icons/lu';
import { setDemoPref, useDemoPref } from './demoPrefs.js';

const SPEEDS = [0.5, 1, 2, 4];
const POS_KEY = 'demo-bar-pos';

const readPos = () => {
  try {
    const v = JSON.parse(localStorage.getItem(POS_KEY));
    if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) return v;
  } catch {
    /* storage can be blocked */
  }
  return { x: 0, y: 0 };
};

const KEYS = [
  ['Space or K', 'Play or pause'],
  ['← or J', 'Previous step'],
  ['→ or L', 'Next step'],
  ['Home', 'Start again'],
  ['F', 'Full screen'],
  ['Esc', 'Leave full screen or close this menu'],
];

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
 * A small floating pill, pinned to the bottom of the screen while the demo is visible and draggable by its grip:
 * previous, play/pause, next, a clickable progress track, the step counter, full screen and a menu with
 * speed, replay, the view options and the keyboard shortcuts.
 * `caption` is a one-line takeaway for the current step. `features` turns on the options a demo supports
 * (focus: highlight what changed, notes: collapse the note under the picture).
 * The demo also pauses by itself when it scrolls out of view or the tab is hidden.
 */
export function DemoControls({ p, unit = 'step', speeds = false, caption, features = {} }) {
  const total = p.last + 1;
  const atEnd = p.index >= p.last;
  const PlayIcon = p.playing ? LuPause : atEnd ? LuRotateCcw : LuPlay;
  const label = p.playing ? 'Pause' : atEnd ? 'Play again' : 'Play';
  const focus = useDemoPref('focus');
  const compact = useDemoPref('compact');
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);

  const bar = useRef(null);
  const pos = useRef(readPos());
  const live = useRef(p);
  live.current = p;
  const toggleFull = useRef(() => {});
  toggleFull.current = () => setFull((v) => !v);

  const place = (x, y) => {
    pos.current = { x, y };
    bar.current?.style.setProperty('--bar-x', `${x}px`);
    bar.current?.style.setProperty('--bar-y', `${y}px`);
  };

  // drag by the grip: the pill moves freely over the page (kept on screen), double-click the grip to put it back
  const onGripDown = (e) => {
    const el = bar.current;
    if (!el || e.button > 0) return;
    e.preventDefault();
    const grip = e.currentTarget;
    grip.setPointerCapture(e.pointerId);
    el.classList.add('is-dragging');
    const z = Number(el.closest('figure')?.dataset.fit || 1); // the figure may be scaled by CSS zoom
    const start = { px: e.clientX, py: e.clientY, ...pos.current, rect: el.getBoundingClientRect() };
    const move = (ev) => {
      let dx = (ev.clientX - start.px) / z;
      let dy = (ev.clientY - start.py) / z;
      // keep the whole pill inside the window
      dx = Math.min(Math.max(dx, (4 - start.rect.left) / z), (window.innerWidth - 4 - start.rect.right) / z);
      dy = Math.min(Math.max(dy, (4 - start.rect.top) / z), (window.innerHeight - 4 - start.rect.bottom) / z);
      place(start.x + dx, start.y + dy);
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      el.classList.remove('is-dragging');
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos.current));
      } catch {
        /* ignore */
      }
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  };
  const resetPos = () => {
    place(0, 0);
    try {
      localStorage.removeItem(POS_KEY);
    } catch {
      /* ignore */
    }
  };

  // full screen: the figure becomes an overlay (a CSS class, so it works for every demo)
  useEffect(() => {
    const fig = bar.current?.closest('figure');
    if (!fig) return undefined;
    fig.classList.toggle('is-full', full);
    document.documentElement.classList.toggle('demo-full-open', full);
    if (!full) return undefined;
    const onEsc = (e) => {
      if (e.key === 'Escape' && !open) setFull(false);
    };
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('keydown', onEsc);
      fig.classList.remove('is-full');
      document.documentElement.classList.remove('demo-full-open');
    };
  }, [full, open]);

  // the menu closes on an outside click or Escape
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (!bar.current?.querySelector('.demo-menu-wrap')?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  // Keyboard shortcuts for the animation the pointer is over or that holds focus:
  // Space / K play or pause, Left / J previous, Right / L next, Home restart, F full screen.
  // Also: pause when the demo scrolls out of view or the tab is hidden, so it never plays unseen.
  useEffect(() => {
    place(pos.current.x, pos.current.y);
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
      else if (k === 'f') toggleFull.current();
      else if ((k === ' ' || k === 'k') && !(t.tagName === 'BUTTON' && k === ' ')) {
        if (q.playing) q.pause();
        else if (q.index >= q.last) q.replay();
        else q.play();
      } else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            ([en]) => {
              if (!en.isIntersecting && live.current.playing) live.current.pause();
            },
            { threshold: 0.1 },
          );
    io?.observe(fig);
    const onHidden = () => document.hidden && live.current.playing && live.current.pause();
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      fig.removeEventListener('pointerenter', enter);
      fig.removeEventListener('pointerleave', leave);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHidden);
      io?.disconnect();
    };
  }, []);

  return (
    <div ref={bar} className={`demo-bar ${caption ? 'has-caption' : ''}`} role="group" aria-label="Animation controls" aria-keyshortcuts="Space ArrowLeft ArrowRight F">
      {caption && (
        <div className="demo-caption" title={caption}>
          {caption}
        </div>
      )}
      <span className="demo-grip" role="separator" aria-orientation="vertical" aria-label="Drag to move the controls, double-click to reset" data-tip="Drag to move (double-click to reset)" onPointerDown={onGripDown} onDoubleClick={resetPos}>
        <LuGripVertical aria-hidden="true" />
      </span>
      <button type="button" className="demo-icon-btn" onClick={() => p.step(-1)} disabled={p.index === 0} aria-label={`Previous ${unit}`} data-tip={`Previous ${unit} (←)`}>
        <LuSkipBack aria-hidden="true" />
      </button>
      <button type="button" className="btn primary demo-play" data-tip={`${label} (Space)`} onClick={() => (p.playing ? p.pause() : p.play())}>
        <PlayIcon aria-hidden="true" className="btn-icon" />
        <span className="sr-only">{label}</span>
      </button>
      <button type="button" className="demo-icon-btn" onClick={() => p.step(1)} disabled={atEnd} aria-label={`Next ${unit}`} data-tip={`Next ${unit} (→)`}>
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
              data-tip={`${unit} ${i + 1}`}
              onClick={() => p.seek(i)}
            />
          ))}
        </div>
      ) : (
        <input type="range" className="demo-range" min={0} max={p.last} value={p.index} aria-label={`${unit} position`} onChange={(e) => p.seek(Number(e.target.value))} />
      )}

      <span className="demo-count" aria-live="off">
        {p.index + 1} / {total}
      </span>
      <button type="button" className="demo-icon-btn" onClick={() => setFull((v) => !v)} aria-pressed={full} aria-label={full ? 'Leave full screen' : 'Full screen'} data-tip={full ? 'Leave full screen (Esc)' : 'Full screen (F)'}>
        {full ? <LuMinimize2 aria-hidden="true" /> : <LuMaximize2 aria-hidden="true" />}
      </button>
      <div className="demo-menu-wrap">
        <button type="button" className="demo-icon-btn" onClick={() => setOpen((v) => !v)} aria-haspopup="true" aria-expanded={open} aria-label="More options" data-tip="Speed, view options, shortcuts">
          <LuEllipsis aria-hidden="true" />
        </button>
        {open && (
          <div className="demo-menu" role="group" aria-label="More options">
            {speeds && (
              <label className="demo-menu-row">
                <span>Speed</span>
                <select value={p.speed} onChange={(e) => p.setSpeed(Number(e.target.value))}>
                  {SPEEDS.map((s) => (
                    <option key={s} value={s}>
                      {s}×
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              className="demo-menu-row"
              onClick={() => {
                p.replay();
                setOpen(false);
              }}
            >
              <span>Replay from the start</span>
              <LuRotateCcw aria-hidden="true" />
            </button>
            {features.focus && (
              <label className="demo-menu-row">
                <span>Highlight what changed</span>
                <input type="checkbox" checked={focus} onChange={(e) => setDemoPref('focus', e.target.checked)} />
              </label>
            )}
            {features.notes && (
              <label className="demo-menu-row">
                <span>Short notes (click to read)</span>
                <input type="checkbox" checked={compact} onChange={(e) => setDemoPref('compact', e.target.checked)} />
              </label>
            )}
            <dl className="demo-keys" aria-label="Keyboard shortcuts">
              {KEYS.map(([k, d]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
