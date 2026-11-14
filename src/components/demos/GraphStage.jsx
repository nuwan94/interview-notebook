import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { iconComponent } from './icons.jsx';
import { layoutScene, wrap } from './graphLayout.js';

// Diagram stage for the walk-throughs: icons with labels, and arrows that draw and flow.
// Each frame lists boxes (nodes) and deps (arrows between box titles); nodes glide to their new place when the
// frame changes, new arrows draw themselves in, and the arrows of the current frame carry moving dots.

const R = 30; // icon circle radius
const TONE = {
  ok: { color: 'var(--color-ok)', soft: 'var(--color-ok-soft)' },
  bad: { color: 'var(--color-bad)', soft: 'var(--color-bad-soft)' },
  warn: { color: 'var(--color-warn)', soft: 'var(--color-warn-soft)' },
  new: { color: 'var(--color-pen)', soft: 'var(--color-pen-soft)' },
  none: { color: '#556070', soft: '#eef2f7' },
};
const tone = (t) => TONE[t] || TONE.none;

function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.getBoundingClientRect().width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** Positions that ease from where they are to `target` (an object title -> {x, y}) whenever the target changes. */
function useTween(target, reduced) {
  const [cur, setCur] = useState(target);
  const curRef = useRef(target);
  useEffect(() => {
    if (reduced) {
      curRef.current = target;
      setCur(target);
      return undefined;
    }
    const from = curRef.current;
    const start = performance.now();
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - start) / 480);
      const e = 1 - (1 - t) ** 3;
      const next = {};
      for (const k of Object.keys(target)) {
        const a = from[k] || target[k];
        next[k] = { x: a.x + (target[k].x - a.x) * e, y: a.y + (target[k].y - a.y) * e };
      }
      curRef.current = next;
      setCur(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return cur;
}

/** Arrow between two node centres, trimmed to the icon circles; bends to the side to avoid other nodes or a reverse arrow. */
function edgeGeometry(a, b, others, reverseExists, fromFirst) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  let bend = reverseExists ? (fromFirst ? 30 : -30) : 0;
  if (!bend) {
    for (const o of others) {
      const t = Math.max(0, Math.min(1, ((o.x - a.x) * ux + (o.y - a.y) * uy) / len));
      const px = a.x + ux * t * len;
      const py = a.y + uy * t * len;
      const dist = Math.hypot(o.x - px, o.y - py);
      if (dist < R + 22 && t > 0.05 && t < 0.95) {
        const side = (o.x - px) * nx + (o.y - py) * ny > 0 ? -1 : 1;
        bend = side * Math.min(len * 0.35, R + 50);
        break;
      }
    }
  }
  const sx = a.x + ux * (R + 4);
  const sy = a.y + uy * (R + 4);
  const ex = b.x - ux * (R + 10);
  const ey = b.y - uy * (R + 10);
  const cx = (sx + ex) / 2 + nx * bend;
  const cy = (sy + ey) / 2 + ny * bend;
  // label at the middle of the curve, nudged to the upper side of the line
  const mx = 0.25 * sx + 0.5 * cx + 0.25 * ex;
  const my = 0.25 * sy + 0.5 * cy + 0.25 * ey;
  const up = ny > 0 ? -1 : 1;
  return { d: `M${sx.toFixed(1)} ${sy.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`, lx: mx + nx * up * 11, ly: my + ny * up * 11 };
}

function Node({ box, p, visible, isNew }) {
  const t = tone(box.tone);
  const Icon = iconComponent(box.title);
  const title = wrap(box.title, 17, 2);
  const lines = (box.lines || []).flatMap((l) => wrap(l, 22, 2)).slice(0, 4);
  const badgeW = box.badge ? box.badge.length * 5.9 + 14 : 0;
  const initials = box.title
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const titleY = R + 19;
  return (
    <g transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`} className={`g-node ${visible ? '' : 'is-hidden'}`} aria-hidden="true">
      <g className={isNew && visible ? 'g-pop' : ''}>
        <circle r={R} fill={t.soft} stroke={t.color} strokeWidth="2.5" />
        {Icon ? (
          <Icon x={-15} y={-15} size={30} color={t.color} aria-hidden="true" focusable="false" />
        ) : (
          <text className="g-initials" textAnchor="middle" dy="0.35em" fill={t.color}>
            {initials}
          </text>
        )}
        {box.badge && (
          <g transform={`translate(${(-badgeW / 2).toFixed(1)} ${-R - 20})`}>
            <rect width={badgeW} height="17" rx="8.5" fill={t.color} />
            <text className="g-badge" x={badgeW / 2} y="12" textAnchor="middle">
              {box.badge}
            </text>
          </g>
        )}
        <text className="g-title" y={titleY} textAnchor="middle">
          {title.map((ln, i) => (
            <tspan key={i} x="0" dy={i ? 15 : 0}>
              {ln}
            </tspan>
          ))}
        </text>
        <text className="g-sub" y={titleY + (title.length - 1) * 15 + 16} textAnchor="middle">
          {lines.map((ln, i) => (
            <tspan key={i} x="0" dy={i ? 13 : 0}>
              {ln}
            </tspan>
          ))}
        </text>
      </g>
    </g>
  );
}

export function GraphStage({ frames, index, reduced, label }) {
  const uid = useId().replace(/:/g, '');
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const lr = useMemo(() => layoutScene(frames, 'LR'), [frames]);
  const tb = useMemo(() => layoutScene(frames, 'TB'), [frames]);
  // left to right while the text stays readable; top to bottom when the picture would shrink too much
  const vertical = width > 0 && width / lr.width < 0.66;
  const lay = vertical ? tb : lr;

  // every node of the scene, so nodes that leave can fade out where they stood
  const union = useMemo(() => {
    const m = new Map();
    frames.forEach((f) => f.boxes.forEach((b) => !m.has(b.title) && m.set(b.title, b)));
    return [...m.keys()];
  }, [frames]);

  const target = useMemo(() => {
    const out = {};
    for (const t of union) {
      let p = lay.frames[index].get(t);
      for (let i = index - 1; !p && i >= 0; i--) p = lay.frames[i].get(t);
      for (let i = index + 1; !p && i < frames.length; i++) p = lay.frames[i].get(t);
      out[t] = p;
    }
    return out;
  }, [union, lay, index, frames.length]);
  const pos = useTween(target, reduced);

  const frame = frames[index];
  const visible = new Set(frame.boxes.map((b) => b.title));
  const boxByTitle = new Map(frame.boxes.map((b) => [b.title, b]));
  const deps = (frame.deps || []).filter((d) => visible.has(d.from) && visible.has(d.to) && d.from !== d.to);

  // what is new in this frame (animations replay only for those)
  const lastIdx = useRef(-1);
  const prev = useRef({ nodes: new Set(), edges: new Set() });
  const cur = useRef({ nodes: new Set(), edges: new Set() });
  if (lastIdx.current !== index) {
    prev.current = cur.current;
    cur.current = { nodes: new Set(visible), edges: new Set(deps.map((d) => `${d.from}>${d.to}`)) };
    lastIdx.current = index;
  }

  const stageProps = { viewBox: `0 0 ${lay.width} ${lay.height}`, role: 'img', 'aria-label': label };
  return (
    <div ref={wrapRef} className="g-stage">
      <svg {...stageProps} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          {Object.entries(TONE).map(([k, v]) => (
            <marker key={k} id={`${uid}-${k}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0L10 5L0 10z" fill={v.color} />
            </marker>
          ))}
        </defs>

        <g>
          {deps.map((d) => {
            const a = pos[d.from];
            const b = pos[d.to];
            if (!a || !b) return null;
            const key = `${d.from}>${d.to}`;
            const t = tone(d.tone);
            const others = [...visible].filter((x) => x !== d.from && x !== d.to).map((x) => pos[x]).filter(Boolean);
            const reverse = deps.some((o) => o.from === d.to && o.to === d.from);
            const g = edgeGeometry(a, b, others, reverse, d.from < d.to);
            const isNew = !prev.current.edges.has(key);
            return (
              <g key={key} className={`g-edge ${isNew ? 'is-new' : ''}`} aria-hidden="true">
                <path d={g.d} pathLength="1" className="g-edge-line" stroke={t.color} markerEnd={`url(#${uid}-${d.tone && TONE[d.tone] ? d.tone : 'none'})`} fill="none" />
                <path d={g.d} className="g-flow" stroke={t.color} fill="none" />
                {d.label && (
                  <text className="g-edge-label" x={g.lx} y={g.ly} textAnchor="middle" fill={t.color}>
                    {d.label.length > 26 ? `${d.label.slice(0, 25)}…` : d.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        <g>
          {union.map((title) => {
            const p = pos[title];
            if (!p) return null;
            const box = boxByTitle.get(title) || { title, lines: [] };
            return <Node key={title} box={box} p={p} visible={visible.has(title)} isNew={!prev.current.nodes.has(title)} />;
          })}
        </g>
      </svg>

      {/* the same information as text for screen readers */}
      <ul className="sr-only">
        {frame.boxes.map((b) => (
          <li key={b.title}>
            {b.title}
            {b.badge ? ` (${b.badge})` : ''}
            {b.lines?.length ? `: ${b.lines.join(', ')}` : ''}
          </li>
        ))}
        {deps.map((d) => (
          <li key={`${d.from}-${d.to}`}>
            {d.from} to {d.to}
            {d.label ? `: ${d.label}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
