import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

// Mermaid is large, so it is loaded only when a lesson actually contains a diagram.
let mermaidPromise;
function loadMermaid() {
  mermaidPromise ??= import('mermaid').then(({ default: mermaid }) => {
    const css = getComputedStyle(document.documentElement);
    const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      look: 'handDrawn',
      handDrawnSeed: 7,
      fontFamily: "'Atkinson Hyperlegible', ui-sans-serif, system-ui, sans-serif",
      themeVariables: {
        fontSize: '14px',
        primaryColor: v('--color-pen-soft', '#e3eafa'),
        primaryBorderColor: v('--color-pen', '#23408f'),
        primaryTextColor: v('--color-ink', '#1b2433'),
        lineColor: v('--color-soft', '#4a5568'),
        secondaryColor: v('--color-warn-soft', '#fdeccd'),
        tertiaryColor: v('--color-ok-soft', '#dff3e6'),
        noteBkgColor: v('--color-hi', '#ffe45c'),
        noteTextColor: v('--color-ink', '#1b2433'),
        actorBkg: v('--color-pen-soft', '#e3eafa'),
        actorBorder: v('--color-pen', '#23408f'),
        actorTextColor: v('--color-ink', '#1b2433'),
        signalColor: v('--color-ink', '#1b2433'),
        signalTextColor: v('--color-ink', '#1b2433'),
        sequenceNumberColor: '#ffffff',
      },
      flowchart: { curve: 'basis', htmlLabels: true, padding: 10, nodeSpacing: 36, rankSpacing: 30, wrappingWidth: 420, useMaxWidth: true },
      sequence: { mirrorActors: false, showSequenceNumbers: false, actorMargin: 40, messageMargin: 28, wrap: true },
    });
    return mermaid;
  });
  return mermaidPromise;
}

/** A ```mermaid fence, drawn as an SVG inside the same taped card as the animations. */
export function MermaidDiagram({ code }) {
  const ref = useRef(null);
  const id = 'mmd' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    loadMermaid()
      .then((m) => m.render(id, code))
      .then(({ svg: out }) => live && setSvg(out))
      .catch((e) => live && setError(String(e?.message || e)));
    return () => {
      live = false;
    };
  }, [code, id]);

  // keep the ruled lines of the page registered with the text after the figure
  useLayoutEffect(() => {
    const el = ref.current;
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

  return (
    <figure ref={ref} className="demo mermaid-fig" data-noread aria-label="Diagram">
      {error ? (
        <pre role="alert">{error}</pre>
      ) : svg ? (
        <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <p className="text-soft text-sm">Drawing diagram…</p>
      )}
    </figure>
  );
}
