import { useEffect, useId, useRef, useState } from 'react';
import { LuAccessibility } from 'react-icons/lu';
import { SCALES, usePrefs } from '../lib/prefs.jsx';

/** Reading settings (text size, term tips) in a popup opened from one header button, on every screen size. */
export function AccessMenu() {
  const { prefs, set, zoom } = usePrefs();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const button = useRef(null);
  const panel = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (refocus) => {
      setOpen(false);
      if (refocus) button.current?.focus();
    };
    const onKey = (e) => e.key === 'Escape' && close(true);
    const onDown = (e) => !box.current?.contains(e.target) && close(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    panel.current?.querySelector('button:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const sizeBtn = 'btn !min-h-10 !px-3';
  return (
    <div ref={box} className="relative">
      <button
        ref={button}
        type="button"
        className="btn !min-h-10 !px-2.5"
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        aria-label="Accessibility and reading settings"
        title="Accessibility and reading settings"
        onClick={() => setOpen((o) => !o)}
      >
        <LuAccessibility aria-hidden="true" size="1.25em" />
        <span className="hidden sm:inline">Reading</span>
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label="Accessibility and reading settings"
          className="absolute right-0 top-full mt-2 z-40 w-[min(19rem,calc(100vw-1.5rem))] rounded-lg border border-slate-300 bg-white p-4 shadow-xl"
        >
          <p className="m-0 mb-1 text-sm font-bold text-ink">Text size</p>
          <div className="flex items-center gap-2" role="group" aria-label="Text size">
            <button
              type="button"
              className={sizeBtn}
              onClick={() => set({ scaleIdx: Math.max(0, prefs.scaleIdx - 1) })}
              disabled={prefs.scaleIdx === 0}
              aria-label="Smaller text"
              title="Smaller text: press -"
            >
              <span className="text-sm">A−</span>
            </button>
            <span className="flex-1 text-center text-sm font-bold text-soft tabular-nums" aria-live="polite">
              {SCALES[prefs.scaleIdx]}%
            </span>
            <button
              type="button"
              className={sizeBtn}
              onClick={() => set({ scaleIdx: Math.min(SCALES.length - 1, prefs.scaleIdx + 1) })}
              disabled={prefs.scaleIdx === SCALES.length - 1}
              aria-label="Larger text"
              title="Larger text: press +"
            >
              <span className="text-lg leading-none">A+</span>
            </button>
          </div>
          <button type="button" className="btn !min-h-9 mt-2 w-full justify-center" onClick={() => zoom(0)} disabled={prefs.scaleIdx === 1}>
            Reset to 100%
          </button>

          <p className="m-0 mt-4 mb-1 text-sm font-bold text-ink">Term tips</p>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.tooltips}
            className="btn !min-h-10 w-full justify-between"
            onClick={() => set({ tooltips: !prefs.tooltips })}
          >
            <span>Dotted-underline explanations</span>
            <span className="font-bold">{prefs.tooltips ? 'On' : 'Off'}</span>
          </button>

          <p className="m-0 mt-3 text-xs text-soft">
            Keys: <span className="kbd">+</span> <span className="kbd">-</span> <span className="kbd">0</span> change the text size, <span className="kbd">/</span> opens search.
          </p>
        </div>
      )}
    </div>
  );
}
