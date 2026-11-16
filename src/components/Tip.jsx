import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// One tooltip for the whole app, replacing the browser's own `title` tooltip.
// Mark any element with data-tip="text" and mount <TipHost /> once (in Layout). It shows on mouse hover (after a short
// delay) and on keyboard focus, hides on click, scroll, Escape or leaving the element, and never on touch screens.

const DELAY = 350;
const find = (target) => (target instanceof Element ? target.closest('[data-tip]') : null);

export function TipHost() {
  const [tip, setTip] = useState(null); // { el, text }
  const [pos, setPos] = useState({ left: -999, top: -999 });
  const box = useRef(null);
  const current = useRef(null);
  const id = useId();

  useEffect(() => {
    let timer = 0;
    const hide = () => {
      clearTimeout(timer);
      current.current = null;
      setTip(null);
    };
    const show = (el, delay) => {
      if (current.current === el) return;
      clearTimeout(timer);
      if (!el.getAttribute('data-tip')) return hide();
      current.current = el;
      timer = setTimeout(() => setTip({ el, text: el.getAttribute('data-tip') }), delay);
    };
    const over = (e) => {
      if (e.pointerType === 'touch') return;
      const el = find(e.target);
      if (el) show(el, DELAY);
      else hide();
    };
    const focus = (e) => {
      const el = find(e.target);
      if (el && e.target.matches?.(':focus-visible')) show(el, 0);
    };
    const key = (e) => e.key === 'Escape' && hide();
    const leaveWindow = (e) => !e.relatedTarget && hide();

    document.addEventListener('pointerover', over);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide);
    document.addEventListener('keydown', key);
    document.addEventListener('scroll', hide, { capture: true, passive: true });
    document.addEventListener('pointerout', leaveWindow);
    window.addEventListener('blur', hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerover', over);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide);
      document.removeEventListener('keydown', key);
      document.removeEventListener('scroll', hide, { capture: true });
      document.removeEventListener('pointerout', leaveWindow);
      window.removeEventListener('blur', hide);
    };
  }, []);

  // while open: follow text changes (for example Play/Pause), close if the element disappears, and describe it for screen readers
  useEffect(() => {
    if (!tip) return;
    const { el } = tip;
    el.setAttribute('aria-describedby', id);
    const t = setInterval(() => {
      if (!el.isConnected || !el.getAttribute('data-tip')) {
        current.current = null;
        setTip(null);
      } else if (el.getAttribute('data-tip') !== tip.text) {
        setTip({ el, text: el.getAttribute('data-tip') });
      }
    }, 300);
    return () => {
      clearInterval(t);
      el.removeAttribute('aria-describedby');
    };
  }, [tip, id]);

  useLayoutEffect(() => {
    if (!tip || !box.current) return;
    const r = tip.el.getBoundingClientRect();
    const t = box.current.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), window.innerWidth - t.width - 8);
    const below = r.bottom + 8 + t.height <= window.innerHeight || r.top - 8 - t.height < 0;
    setPos({ left, top: below ? r.bottom + 8 : r.top - 8 - t.height });
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div ref={box} id={id} role="tooltip" className="tooltip tip-simple" data-noread style={pos}>
      {tip.text}
    </div>,
    document.body,
  );
}
