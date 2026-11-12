import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { byId, splitByGlossary } from '../lib/glossary.js';
import { usePrefs } from '../lib/prefs.jsx';

function Tooltip({ id, anchor, entry }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: -999, top: -999 });
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const t = ref.current.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), window.innerWidth - t.width - 8);
    const below = r.bottom + 8 + t.height <= window.innerHeight || r.top - 8 - t.height < 0;
    setPos({ left, top: below ? r.bottom + 8 : r.top - 8 - t.height });
  }, [anchor]);
  return createPortal(
    <div ref={ref} id={id} role="tooltip" className="tooltip" data-noread style={pos}>
      <b>{entry.term}</b>
      <div>{entry.short}</div>
      {entry.more && <span className="more">{entry.more}</span>}
    </div>,
    document.body,
  );
}

/** A glossary word inside lesson text: hover, focus or tap to see the explanation. */
export function Term({ termId, tabStop = false, children }) {
  const { prefs } = usePrefs();
  const entry = byId.get(termId);
  const ref = useRef(null);
  const tid = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const key = (e) => e.key === 'Escape' && close();
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('scroll', close);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  if (!entry || !prefs.tooltips) return <span>{children}</span>;
  return (
    <>
      <span
        ref={ref}
        className="term"
        tabIndex={tabStop ? 0 : -1}
        aria-describedby={open ? tid : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
      >
        {children}
      </span>
      {open && <Tooltip id={tid} anchor={ref.current} entry={entry} />}
    </>
  );
}

/** Plain string with glossary tooltips (used for captions inside the animated demos). */
export function Glossed({ text }) {
  const parts = text.split('`');
  return parts.map((seg, i) =>
    i % 2 === 1 ? (
      <code key={i} className="font-mono text-[0.9em] bg-slate-100 px-1 rounded">
        {seg}
      </code>
    ) : (
      splitByGlossary(seg).map((p, j) =>
        p.entry ? (
          <Term key={`${i}-${j}`} termId={p.entry.id}>
            {p.text}
          </Term>
        ) : (
          <span key={`${i}-${j}`}>{p.text}</span>
        ),
      )
    ),
  );
}
