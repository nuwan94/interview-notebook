import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuArrowLeft, LuArrowRight, LuCheck, LuClock, LuExpand, LuLightbulb, LuLink, LuListChecks, LuMaximize, LuMinimize, LuPause, LuPlay,
  LuZoomIn, LuZoomOut,
  LuRotateCcw, LuSignal, LuSparkles, LuTriangleAlert,
} from 'react-icons/lu';
import { useLocation } from 'react-router-dom';
import { Glossed } from '../Term.jsx';
import { useReducedMotion } from '../../lib/prefs.jsx';
import { copyText } from '../../lib/share.js';
import { buildStates, allPlacedNodes } from './model.js';
import { IsoScene, iso, sceneBox } from './IsoScene.jsx';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/800.css';
import './lab.css';

const KIND_LABEL = { setup: 'Setup', problem: 'Problem', technique: 'Technique', case: 'Case', recap: 'Recap', try: 'Try it' };
const BOX_ICON = { idea: LuSparkles, tip: LuLightbulb, warn: LuTriangleAlert };
const BOX_TITLE = { idea: 'Key idea', tip: 'Good to know', warn: 'Watch out' };
const SCENE_MIN = 544; // px, matches .lab-scene svg min-width (34rem)
const FLOW_LEGEND ={ req: 'request', res: 'response', bad: 'failure', msg: 'message', data: 'data' };

/** Inline text: **bold**, `code` and glossary terms. */
function Inline({ text }) {
  return String(text)
    .split('**')
    .map((seg, i) => (i % 2 ? <strong key={i}><Glossed text={seg} /></strong> : <Glossed key={i} text={seg} />));
}
const paras = (t) => (Array.isArray(t) ? t : String(t ?? '').split(/\n\n+/)).filter(Boolean);

// --- progress, kept per browser: the furthest step reached and whether the lab was finished ---
const PROGRESS_KEY = 'nb-lab-progress';
function readProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  } catch {
    return {};
  }
}
function saveProgress(slug, index, done) {
  try {
    const all = readProgress();
    const cur = all[slug] ?? { max: 0, done: false };
    all[slug] = { max: Math.max(cur.max, index), done: cur.done || done };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable: progress is a convenience only */
  }
}

// --- deep links: #/lab/<slug>/<n> opens step n ---
function stepFromHash(slug) {
  const page = /^#\/lab\/([\w-]+)\/(\d+)/.exec(window.location.hash);
  return page && page[1] === slug ? Number(page[2]) - 1 : null;
}
const hashForStep = (slug, n) => `#/lab/${slug}/${n}`;

/** Measures the scene area (width and height) so the labels keep a readable size whatever the window. */
function useSize(ref) {
  const [size, setSize] = useState({ w: 800, h: 500 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

const FIT_MEDIA = '(min-width: 1200px) and (min-height: 540px)';

/** The part of the scene to show for the blocks on stage: their bounds with room around, in the shape of the whole scene. */
function frameOf(nodes, box) {
  if (!nodes.length) return box;
  const b = sceneBox(nodes);
  let w = b.w + 40;
  let h = b.h + 60;
  const ratio = box.w / box.h;
  if (w / h < ratio) w = h * ratio;
  else h = w / ratio;
  w = Math.min(box.w, Math.max(w, box.w * 0.42));
  h = w / ratio;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return {
    x: Math.min(box.x + box.w - w, Math.max(box.x, cx - w / 2)),
    y: Math.min(box.y + box.h - h, Math.max(box.y, cy - h / 2)),
    w,
    h,
  };
}

/**
 * An interactive lab: one isometric scene that changes step by step, with metrics, a step panel,
 * a "what changed" list, a learning checklist, a timeline, keyboard control, step links and a focus mode.
 */
export function Lab({ lab }) {
  const states = useMemo(() => buildStates(lab), [lab]);
  const box = useMemo(() => sceneBox(allPlacedNodes(lab)), [lab]);
  const last = states.length - 1;
  const clamp = (i) => Math.max(0, Math.min(last, i));

  const [index, setIndex] = useState(() => clamp(stepFromHash(lab.slug) ?? 0));
  const [paused, setPaused] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [focus, setFocusState] = useState(false);
  const [hold, setHold] = useState(0);
  const [copied, setCopied] = useState(false);
  const reduced = useReducedMotion();
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const sceneRef = useRef(null);
  const timelineRef = useRef(null);
  const touched = useRef(false);
  const { w: width, h: height } = useSize(sceneRef);

  // the camera frames the blocks on stage: close on the first few, pulling back as more arrive (only where the lab fits the window)
  const [fits, setFits] = useState(() => window.matchMedia(FIT_MEDIA).matches);
  useEffect(() => {
    const mq = window.matchMedia(FIT_MEDIA);
    const on = () => setFits(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const target = useMemo(() => (fits ? frameOf(states[clamp(index)].nodes, box) : box), [fits, states, index, box]); // eslint-disable-line react-hooks/exhaustive-deps
  const [frame, setFrame] = useState(target);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  // zoom and move inside the scene: the camera is a zoom level k and an offset of its centre from the frame's centre
  const [cam, setCam] = useState({ k: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const camRef = useRef(cam);
  camRef.current = cam;
  useEffect(() => {
    setCam({ k: 1, x: 0, y: 0 });
    const from = frameRef.current;
    if (reduced) {
      setFrame(target);
      return undefined;
    }
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 550);
      const e = 1 - (1 - p) ** 3;
      setFrame({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  const clampCam = useCallback((c) => {
    const f = frameRef.current;
    const k = Math.min(4, Math.max(1, c.k));
    const mx = (f.w / 2) * (1 - 1 / k) + f.w * 0.04;
    const my = (f.h / 2) * (1 - 1 / k) + f.h * 0.04;
    return { k, x: k === 1 ? 0 : Math.min(mx, Math.max(-mx, c.x)), y: k === 1 ? 0 : Math.min(my, Math.max(-my, c.y)) };
  }, []);
  /** Zoom by a factor, keeping the point under (clientX, clientY) where it is. Without a point it zooms about the centre. */
  const zoomBy = useCallback(
    (factor, clientX, clientY) => {
      const svg = sceneRef.current?.querySelector('svg');
      const cur = camRef.current;
      const f = frameRef.current;
      const k2 = Math.min(4, Math.max(1, cur.k * factor));
      if (k2 === cur.k) return;
      if (!svg || clientX === undefined) {
        setCam(clampCam({ ...cur, k: k2 }));
        return;
      }
      const ctm = svg.getScreenCTM();
      const rect = svg.getBoundingClientRect();
      const sc = ctm.a;
      const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);
      const s2 = (sc * k2) / cur.k;
      setCam(clampCam({ k: k2, x: pt.x - dx / s2 - (f.x + f.w / 2), y: pt.y - dy / s2 - (f.y + f.h / 2) }));
    },
    [clampCam],
  );
  const resetCam = useCallback(() => setCam({ k: 1, x: 0, y: 0 }), []);
  const view = useMemo(
    () => ({ w: frame.w / cam.k, h: frame.h / cam.k, x: frame.x + frame.w / 2 + cam.x - frame.w / (2 * cam.k), y: frame.y + frame.h / 2 + cam.y - frame.h / (2 * cam.k) }),
    [frame, cam],
  );

  // the mouse wheel zooms (in a window that fits the lab; otherwise Ctrl + wheel, so the page can still scroll) and dragging moves
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!window.matchMedia(FIT_MEDIA).matches && !e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.0016), e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);
  const drag = useRef(null);
  const onPointerDown = (e) => {
    if (e.pointerType === 'touch' || e.button !== 0 || camRef.current.k === 1) return;
    const svg = sceneRef.current?.querySelector('svg');
    if (!svg) return;
    drag.current = { x: e.clientX, y: e.clientY, cam: camRef.current, s: svg.getScreenCTM().a };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    setCam(clampCam({ k: d.cam.k, x: d.cam.x - (e.clientX - d.x) / d.s, y: d.cam.y - (e.clientY - d.y) / d.s }));
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };

  const st = states[index];
  const step = st.step;
  const next = states[index + 1]?.step;

  // scene units per screen pixel decide the label size: about 11px on screen at least.
  // Below SCENE_MIN pixels the scene keeps that width and scrolls sideways instead of shrinking.
  // The scene fits its area: whichever of width and height is tighter decides the scale.
  const perPx = Math.max(box.w / Math.max(width, SCENE_MIN), box.h / Math.max(height, 120));
  const fs = Math.min(26, Math.max(12, 11 * perPx));
  const compact = width < 560;

  // Entering focus mode takes the figure out of the page flow. A placeholder of the same height keeps the
  // page from getting shorter, otherwise the browser shifts the scroll under the overlay and can paint nothing.
  const setFocus = useCallback(
    (next) => {
      const el = rootRef.current;
      const on = typeof next === 'function' ? next(el?.classList.contains('lab-focus')) : next;
      if (on && el && !el.classList.contains('lab-focus')) {
        setHold(el.getBoundingClientRect().height + parseFloat(getComputedStyle(el).marginBottom || '0'));
      }
      setFocusState(on);
    },
    [],
  );

  const go = useCallback(
    (i) => {
      touched.current = true;
      setIndex(clamp(i));
      setPaused(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [last],
  );

  // a link to a step (on load or after an in-app navigation) opens that step
  const location = useLocation();
  useEffect(() => {
    const s = stepFromHash(lab.slug);
    if (s !== null) setIndex(clamp(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, lab.slug]);

  // remember progress and keep the address pointing at this step (only after the reader moved)
  useEffect(() => {
    saveProgress(lab.slug, index, index === last);
    if (!touched.current) return;
    window.history.replaceState(window.history.state, '', hashForStep(lab.slug, index + 1));
  }, [index, lab.slug, last]);

  // focus mode locks the page scroll behind the overlay
  useEffect(() => {
    if (!focus) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    rootRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, [focus]);

  // keyboard: arrows step, R replays the step, Space pauses, F toggles focus, Escape leaves focus.
  // The lab is the page, so keys work unless another control (a sidebar link, the search box) has focus.
  const live = useRef({});
  live.current = { index, go, focus, setFocus };
  useEffect(() => {
    const el = rootRef.current;
    let hovered = false;
    const enter = () => (hovered = true);
    const leave = () => (hovered = false);
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    const onKey = (e) => {
      const q = live.current;
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const active = document.activeElement;
      if (!q.focus && !hovered && !el.contains(active) && active && active !== document.body) return;
      const t = e.target;
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowright') q.go(q.index + 1);
      else if (k === 'arrowleft') q.go(q.index - 1);
      else if (k === 'r') setReplayKey((x) => x + 1);
      else if (k === ' ' && t.tagName !== 'BUTTON') setPaused((p) => !p);
      else if (k === 'f') q.setFocus((f) => !f);
      else if (k === 'escape' && q.focus) q.setFocus(false);
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // on narrow screens the scene and the timeline scroll sideways: bring this step's action into view
  useEffect(() => {
    const scene = sceneRef.current;
    if (scene && scene.scrollWidth > scene.clientWidth + 1) {
      const ids = st.changedNodes.size ? [...st.changedNodes] : (step.flows ?? []).flatMap((f) => f.path);
      const xs = ids.map((id) => st.nodes.find((n) => n.id === id)).filter(Boolean).map((n) => iso(...n.at)[0]);
      if (xs.length) {
        const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
        const px = ((mid - box.x) / box.w) * scene.scrollWidth;
        scene.scrollTo({ left: px - scene.clientWidth / 2, behavior: 'auto' });
      }
    }
    const ol = timelineRef.current;
    const li = ol?.children[index];
    if (ol && li && ol.scrollWidth > ol.clientWidth + 1) {
      ol.scrollTo({ left: li.offsetLeft - ol.clientWidth / 2 + li.offsetWidth / 2, behavior: 'auto' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}${hashForStep(lab.slug, index + 1)}`;
    if (await copyText(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };

  const flowTones = [...new Set((step.flows ?? []).map((f) => f.tone ?? 'req'))];
  const BoxIcon = step.box ? BOX_ICON[step.box.kind ?? 'idea'] ?? LuSparkles : null;
  const sceneLabel = `${step.title}. Shown: ${st.nodes.map((n) => n.label ?? n.id).join(', ')}.`;

  return (
    <>
    {focus && hold > 0 && <div className="lab-hold" aria-hidden="true" style={{ height: hold }} />}
    <figure
      ref={rootRef}
      className={`demo lab ${focus ? 'lab-focus' : ''}`}
      data-noread
      tabIndex={-1}
      aria-label={`Interactive lab: ${lab.title}`}
      aria-keyshortcuts="ArrowLeft ArrowRight R Space F Escape"
    >
      <header className="lab-head">
        <figcaption className="lab-title" title={lab.title}>{lab.nav ?? lab.title}</figcaption>
        <div className="lab-tags">
          {lab.minutes && (
            <span className="lab-tag">
              <LuClock aria-hidden="true" /> {lab.minutes} min
            </span>
          )}
          {lab.level && (
            <span className="lab-tag is-level">
              <LuSignal aria-hidden="true" /> {lab.level}
            </span>
          )}
          <span className="lab-tag is-steps">
            <LuListChecks aria-hidden="true" /> {states.length} steps
          </span>
          <button type="button" className="lab-iconbtn" onClick={copyLink} aria-label="Copy a link to this step" data-tip={copied ? 'Copied' : 'Copy link to this step'}>
            {copied ? <LuCheck aria-hidden="true" /> : <LuLink aria-hidden="true" />}
          </button>
          <button type="button" className="lab-iconbtn" onClick={() => setFocus((f) => !f)} aria-pressed={focus} aria-label={focus ? 'Leave focus mode' : 'Open in focus mode'} data-tip={focus ? 'Leave focus (Esc)' : 'Focus mode (F)'}>
            {focus ? <LuMinimize aria-hidden="true" /> : <LuExpand aria-hidden="true" />}
          </button>
        </div>
      </header>

      <div className="lab-body">
        <div className="lab-main">
          {lab.metrics?.length > 0 && (
            <div className="lab-metrics" role="group" aria-label="Metrics">
              {lab.metrics.map((m) => {
                const v = st.metrics[m.id] ?? '—';
                const tone = st.metricTone[m.id];
                return (
                  <div key={m.id} className={`lab-metric ${tone ? `is-${tone}` : ''} ${m.total ? 'is-total' : ''}`}>
                    <span className="lab-metric-label">{m.label}</span>
                    <span key={`${index}-${v}`} className={`lab-metric-value ${st.changedMetrics.has(m.id) ? 'is-changed' : ''}`}>
                      {v}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div ref={stageRef} className="lab-stage">
            <div
              className={`lab-scene ${cam.k > 1 ? 'is-zoomed' : ''} ${dragging ? 'is-dragging' : ''}`}
              ref={sceneRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDoubleClick={resetCam}
            >
              <IsoScene state={st} box={box} bounds={target} view={view} fs={fs} paused={paused} reduced={reduced} replayKey={replayKey} compact={compact} label={sceneLabel} />
            </div>
            {step.table && (
              <div className="lab-table">
                {step.table.title && <div className="lab-table-title">{step.table.title}</div>}
                <table>
                  <tbody>
                    {step.table.rows.map(([k, v], i) => (
                      <tr key={k} className={step.table.total && i === step.table.rows.length - 1 ? 'is-total' : undefined}>
                        <th scope="row">{k}</th>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {step.table.foot && <div className="lab-table-foot">{step.table.foot}</div>}
              </div>
            )}
            <div className="lab-stage-foot">
              <div className="lab-legend" aria-label="Legend">
                {flowTones.map((t) => (
                  <span key={t} className={`lab-legend-item is-${t}`}>{FLOW_LEGEND[t] ?? t}</span>
                ))}
              </div>
              <div className="flex gap-1">
                <button type="button" className="lab-iconbtn" onClick={() => zoomBy(1 / 1.35)} disabled={cam.k <= 1} aria-label="Zoom out" data-tip="Zoom out (wheel)">
                  <LuZoomOut aria-hidden="true" />
                </button>
                <button type="button" className="lab-iconbtn" onClick={() => zoomBy(1.35)} disabled={cam.k >= 4} aria-label="Zoom in" data-tip="Zoom in (wheel)">
                  <LuZoomIn aria-hidden="true" />
                </button>
                <button type="button" className="lab-iconbtn" onClick={resetCam} disabled={cam.k === 1} aria-label="Fit the whole scene" data-tip="Fit (double-click)">
                  <LuMaximize aria-hidden="true" />
                </button>
                <button type="button" className="lab-iconbtn" onClick={() => setReplayKey((x) => x + 1)} aria-label="Replay this step" data-tip="Replay (R)">
                  <LuRotateCcw aria-hidden="true" />
                </button>
                <button type="button" className="lab-iconbtn" onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-label={paused ? 'Resume the animation' : 'Pause the animation'} data-tip={paused ? 'Play (Space)' : 'Pause (Space)'}>
                  {paused ? <LuPlay aria-hidden="true" /> : <LuPause aria-hidden="true" />}
                </button>
              </div>
            </div>
          </div>

          <nav className="lab-timeline" aria-label="Steps in this lab">
            <div className="lab-timeline-head">
              <span>In this lab</span>
              <span>
                Step {index + 1} of {states.length}
              </span>
            </div>
            <ol ref={timelineRef}>
              {states.map((s, i) => (
                <li key={i} className={i < index ? 'is-done' : i === index ? 'is-current' : undefined}>
                  <button type="button" onClick={() => go(i)} aria-current={i === index ? 'step' : undefined} aria-label={`Step ${i + 1}: ${s.step.label ?? s.step.title}`}>
                    <span className="lab-dot">{i + 1}</span>
                    <span className="lab-dot-label">{s.step.label ?? s.step.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        <aside className="lab-side">
          <section className="lab-panel" aria-live="polite">
            <div className="lab-panel-scroll" key={index}>
              <div className="lab-panel-top">
                <span className="lab-stepno">
                  Step {index + 1} / {states.length}
                </span>
                <span className={`lab-kind is-${step.kind ?? 'technique'}`}>{KIND_LABEL[step.kind] ?? step.kind ?? 'Step'}</span>
              </div>
              <h3 className="lab-step-title">{step.title}</h3>
              {paras(step.text).map((p, i) => (
                <p key={i} className="lab-text">
                  <Inline text={p} />
                </p>
              ))}
              {step.box && (
                <div className={`lab-box is-${step.box.kind ?? 'idea'}`}>
                  <BoxIcon aria-hidden="true" className="lab-box-icon" />
                  <div>
                    <div className="lab-box-title">{step.box.title ?? BOX_TITLE[step.box.kind ?? 'idea']}</div>
                    <Inline text={step.box.text} />
                  </div>
                </div>
              )}
              {st.changes.length > 0 && (
                <div className="lab-changes">
                  <div className="lab-section-title">What changed</div>
                  <ul>
                    {st.changes.map((c, i) => (
                      <li key={i} className={`is-${c.sign === '+' ? 'add' : c.sign === '-' ? 'del' : 'mod'}`}>
                        <span aria-hidden="true">{c.sign === '-' ? '−' : c.sign}</span> {c.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="lab-nav">
              <button type="button" className="btn" onClick={() => go(index - 1)} disabled={index === 0}>
                <LuArrowLeft aria-hidden="true" className="btn-icon" /> Back
              </button>
              {next ? (
                <button type="button" className="btn primary lab-next" onClick={() => go(index + 1)}>
                  Next: {next.label ?? next.title} <LuArrowRight aria-hidden="true" className="btn-icon" />
                </button>
              ) : (
                <button type="button" className="btn primary lab-next" onClick={() => go(0)}>
                  <LuRotateCcw aria-hidden="true" className="btn-icon" /> Start again
                </button>
              )}
            </div>
            <div className="lab-keys" aria-hidden="true">
              <kbd>←</kbd> <kbd>→</kbd> step · <kbd>R</kbd> replay · <kbd>Space</kbd> pause · <kbd>F</kbd> focus · wheel zoom · drag move
            </div>
          </section>

          {lab.learn?.length > 0 && (
            <section className="lab-learn" aria-label="What you will learn">
              <div className="lab-section-title">You'll learn</div>
              <ul>
                {lab.learn.map((item, i) => (
                  <li key={item} className={st.learned.has(i) ? 'is-done' : undefined}>
                    <span className="lab-check" aria-hidden="true">{st.learned.has(i) && <LuCheck />}</span>
                    <span>
                      {item}
                      <span className="sr-only">{st.learned.has(i) ? ' (covered)' : ''}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </figure>
    </>
  );
}
