import { useEffect, useId, useMemo, useRef } from 'react';
import {
  LuCog, LuDatabase, LuDoorOpen, LuGlobe, LuHardDrive, LuInbox, LuLaptop, LuNetwork, LuServer, LuShield, LuSmartphone, LuUsers, LuZap,
} from 'react-icons/lu';
import { iconComponent } from '../demos/icons.jsx';

// Isometric grid: a tile is TW wide and TH high on screen (2:1).
const TW = 128;
const TH = 64;
const FOOT = 0.74; // share of a tile a node covers

/** Grid position (gx, gy) to screen position of the tile centre. */
export const iso = (gx, gy) => [(gx - gy) * (TW / 2), (gx + gy) * (TH / 2)];

// Each kind has a shape, a height and three face colours (top, left, right) plus an ink colour.
const KINDS = {
  client:   { shape: 'device',   h: 12, c: ['#eef1f5', '#d3d9e1', '#bcc4cf'], ink: '#46505e', icon: LuLaptop },
  mobile:   { shape: 'device',   h: 12, c: ['#eef1f5', '#d3d9e1', '#bcc4cf'], ink: '#46505e', icon: LuSmartphone },
  users:    { shape: 'pad',      h: 6,  c: ['#eef1f5', '#d3d9e1', '#bcc4cf'], ink: '#46505e', icon: LuUsers },
  service:  { shape: 'block',    h: 42, c: ['#dbe6fb', '#aec3ee', '#8ea9df'], ink: '#2c4f99', icon: LuServer },
  worker:   { shape: 'block',    h: 34, c: ['#dbe6fb', '#aec3ee', '#8ea9df'], ink: '#2c4f99', icon: LuCog },
  database: { shape: 'cylinder', h: 44, c: ['#ebe5fb', '#c8b9ef', '#ab97e0'], ink: '#5a43a8', icon: LuDatabase },
  storage:  { shape: 'block',    h: 30, c: ['#ebe5fb', '#c8b9ef', '#ab97e0'], ink: '#5a43a8', icon: LuHardDrive },
  cache:    { shape: 'block',    h: 26, c: ['#fde3dc', '#f4b7a6', '#e79a86'], ink: '#a3402a', icon: LuZap },
  queue:    { shape: 'stack',    h: 36, c: ['#fdefd3', '#f3d08e', '#e4b866'], ink: '#8a5a07', icon: LuInbox },
  lb:       { shape: 'block',    h: 20, c: ['#d7f1ee', '#a3dbd4', '#82c8bf'], ink: '#1d6d64', icon: LuNetwork },
  gateway:  { shape: 'block',    h: 24, c: ['#d7f1ee', '#a3dbd4', '#82c8bf'], ink: '#1d6d64', icon: LuDoorOpen },
  security: { shape: 'block',    h: 24, c: ['#d7f1ee', '#a3dbd4', '#82c8bf'], ink: '#1d6d64', icon: LuShield },
  external: { shape: 'block',    h: 32, c: ['#e5f3dc', '#c3e3ae', '#a6cf8c'], ink: '#3d6e22', icon: LuGlobe, dashed: true },
};
export const KIND_NAMES = Object.keys(KINDS);

export const TONES = {
  ok:   { line: 'var(--color-ok)',   soft: 'var(--color-ok-soft)' },
  bad:  { line: 'var(--color-bad)',  soft: 'var(--color-bad-soft)' },
  warn: { line: 'var(--color-warn)', soft: 'var(--color-warn-soft)' },
  new:  { line: 'var(--color-pen)',  soft: 'var(--color-pen-soft)' },
  none: { line: '#5b6676',           soft: '#ffffff' },
};
const FLOW_COLOR = { req: '#d9822b', res: '#2f9e5a', bad: '#c0392b', msg: '#7b5cc4', data: '#2b6cb0' };
const SPEED = 230;      // flow dot speed, px per second
const GAP = 650;        // pause after the last flow of a cycle, ms

const kindOf = (n) => KINDS[n.kind] ?? KINDS.service;
const A = (TW / 2) * FOOT;
const B = (TH / 2) * FOOT;

/** Height of the top surface above the ground point, used for anchors and badges. */
const topOf = (n) => {
  const k = kindOf(n);
  return k.shape === 'cylinder' ? k.h + B * 0.55 : k.h;
};
const anchor = (n) => {
  const [x, y] = iso(...n.at);
  return [x, y - topOf(n) * 0.45];
};

/** Approximate text width in the mono font. */
const textW = (s, fs) => String(s).length * fs * 0.61;

function Pill({ x, y, text, fs, tone = 'none', bold = true, sub, fill }) {
  const t = TONES[tone] ?? TONES.none;
  const w = Math.max(textW(text, fs), sub ? textW(sub, fs * 0.85) : 0) + fs * 1.3;
  const h = sub ? fs * 2.65 : fs * 1.75;
  return (
    <g className="lab-pill">
      <rect x={x - w / 2 + 2} y={y - h / 2 + 2.5} width={w} height={h} rx={h / 2.6} fill="rgba(27,36,51,0.18)" />
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2.6} fill={fill ?? (tone === 'none' ? '#fff' : t.soft)} stroke={t.line} strokeWidth={1.3} />
      <text x={x} y={sub ? y - fs * 0.32 : y + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight={bold ? 700 : 500} fill={tone === 'none' ? 'var(--color-ink)' : t.line}>
        {text}
      </text>
      {sub && (
        <text x={x} y={y + fs * 0.92} textAnchor="middle" fontSize={fs * 0.85} fill="var(--color-soft)">
          {sub}
        </text>
      )}
    </g>
  );
}

function Body({ n }) {
  const k = kindOf(n);
  const [x, y] = iso(...n.at);
  const [top, left, right] = k.c;
  const stroke = k.ink;
  const dash = k.dashed ? '5 4' : undefined;
  const sw = 1.4;
  const block = (h, a = A, b = B, oy = 0) => (
    <>
      <path d={`M${x - a},${y - h - oy} L${x},${y - h + b - oy} L${x},${y + b - oy} L${x - a},${y - oy} Z`} fill={left} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} strokeLinejoin="round" />
      <path d={`M${x},${y - h + b - oy} L${x + a},${y - h - oy} L${x + a},${y - oy} L${x},${y + b - oy} Z`} fill={right} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} strokeLinejoin="round" />
      <path d={`M${x},${y - h - b - oy} L${x + a},${y - h - oy} L${x},${y - h + b - oy} L${x - a},${y - h - oy} Z`} fill={top} stroke={stroke} strokeWidth={sw} strokeDasharray={dash} strokeLinejoin="round" />
    </>
  );

  let shape;
  if (k.shape === 'cylinder') {
    const rx = A * 0.8;
    const ry = rx * 0.5;
    const h = k.h;
    shape = (
      <>
        <path d={`M${x - rx},${y - h} L${x - rx},${y} A${rx},${ry} 0 0 0 ${x + rx},${y} L${x + rx},${y - h} Z`} fill={left} stroke={stroke} strokeWidth={sw} />
        <path d={`M${x},${y + ry} A${rx},${ry} 0 0 0 ${x + rx},${y} L${x + rx},${y - h} L${x},${y - h + ry} Z`} fill={right} opacity={0.55} />
        {[0.36, 0.7].map((f) => (
          <path key={f} d={`M${x - rx},${y - h * f} A${rx},${ry} 0 0 0 ${x + rx},${y - h * f}`} fill="none" stroke={stroke} strokeWidth={1} opacity={0.45} />
        ))}
        <ellipse cx={x} cy={y - h} rx={rx} ry={ry} fill={top} stroke={stroke} strokeWidth={sw} />
      </>
    );
  } else if (k.shape === 'stack') {
    shape = <>{[0, 1, 2].map((i) => <g key={i}>{block(9, A, B, i * 13)}</g>)}</>;
  } else if (k.shape === 'pad' || k.shape === 'device') {
    shape = block(k.h, A * 1.05, B * 1.05);
  } else {
    shape = block(k.h);
  }

  // the icon: from the node's own icon name, its label, or the kind default
  const Icon = (n.icon && iconComponent(n.icon)) || iconComponent(n.label ?? '') || k.icon;
  const tall = k.shape === 'pad' || k.shape === 'device';
  const size = tall ? 34 : 26;
  const iy = tall ? y - k.h - size - 2 : k.shape === 'cylinder' ? y - k.h - size / 2 : k.shape === 'stack' ? y - 26 - 9 - size / 2 : y - k.h - size / 2;
  return (
    <g>
      {shape}
      <g transform={`translate(${x - size / 2},${iy})`}>
        <Icon size={size} color={stroke} aria-hidden="true" focusable="false" />
      </g>
    </g>
  );
}

function Pad({ n }) {
  const [x, y] = iso(...n.at);
  const t = TONES[n.tone] ?? null;
  const a = (TW / 2) * 0.98;
  const b = (TH / 2) * 0.98;
  return (
    <path
      d={`M${x},${y - b} L${x + a},${y} L${x},${y + b} L${x - a},${y} Z`}
      fill={t ? t.soft : 'rgba(27,36,51,0.05)'}
      stroke={t ? t.line : 'rgba(27,36,51,0.12)'}
      strokeWidth={t ? 2 : 1}
      strokeDasharray={t ? '7 5' : undefined}
      opacity={t ? 0.9 : 1}
    />
  );
}

/** Points along a polyline of node anchors, trimmed so lines start and end at the node edges. */
function routeOf(ids, byId, trim = 36) {
  const pts = ids.map((id) => byId.get(id)).filter(Boolean).map(anchor);
  if (pts.length < 2) return null;
  const cut = (p, q, d) => {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    return [p[0] + ((q[0] - p[0]) * d) / len, p[1] + ((q[1] - p[1]) * d) / len];
  };
  pts[0] = cut(pts[0], pts[1], trim);
  pts[pts.length - 1] = cut(pts[pts.length - 1], pts[pts.length - 2], trim);
  let total = 0;
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push({ from: pts[i - 1], to: pts[i], start: total, len });
    total += len;
  }
  return { pts, segs, total };
}
const pointAt = (route, d) => {
  const s = route.segs.find((g) => d <= g.start + g.len) ?? route.segs[route.segs.length - 1];
  const f = s.len ? Math.min(1, Math.max(0, (d - s.start) / s.len)) : 0;
  return [s.from[0] + (s.to[0] - s.from[0]) * f, s.from[1] + (s.to[1] - s.from[1]) * f];
};

/** The scene's fixed size: the bounds of every node of the lab, so the layout never moves between steps. */
export function sceneBox(allNodes) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const n of allNodes) {
    const [x, y] = iso(...n.at);
    const k = kindOf(n);
    x0 = Math.min(x0, x - TW * 0.75);
    x1 = Math.max(x1, x + TW * 0.75);
    y0 = Math.min(y0, y - k.h - 78);
    y1 = Math.max(y1, y + TH / 2 + 62);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function Grid({ box, clip }) {
  // a faint diamond lattice behind the scene
  const lines = [];
  const span = 14;
  for (let i = -span; i <= span; i++) {
    const [ax, ay] = iso(i, -span);
    const [bx, by] = iso(i, span);
    const [cx, cy] = iso(-span, i);
    const [dx, dy] = iso(span, i);
    lines.push(<line key={`a${i}`} x1={ax} y1={ay} x2={bx} y2={by} />, <line key={`b${i}`} x1={cx} y1={cy} x2={dx} y2={dy} />);
  }
  return (
    <g className="lab-grid" clipPath={`url(#${clip})`} stroke="#d6dfe9" strokeWidth={1}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="none" stroke="none" />
      {lines}
    </g>
  );
}

/**
 * The isometric stage: pads, links, nodes, labels, badges, notes and animated flow dots.
 * `fs` is the label font size in scene units (bigger on narrow screens so text stays readable).
 */
export function IsoScene({ state, box, fs = 12, paused = false, reduced = false, replayKey = 0, compact = false, label }) {
  const byId = useMemo(() => new Map(state.nodes.map((n) => [n.id, n])), [state.nodes]);
  const order = useMemo(() => [...state.nodes].sort((p, q) => p.at[0] + p.at[1] - (q.at[0] + q.at[1])), [state.nodes]);

  // flows run one after another (or together with `with: true`) in a repeating cycle
  const flows = useMemo(() => {
    let t = 0;
    let prevStart = 0;
    return (state.step.flows ?? [])
      .map((f) => {
        const route = routeOf(f.path, byId, 34);
        if (!route) return null;
        const dur = (route.total / SPEED) * 1000 * (f.slow ?? 1);
        const start = f.with ? prevStart : t;
        prevStart = start;
        t = Math.max(t, start + dur);
        return { ...f, route, start, dur, dots: f.dots ?? 1 };
      })
      .filter(Boolean)
      .map((f, _, all) => ({ ...f, cycle: Math.max(...all.map((g) => g.start + g.dur)) + GAP }));
  }, [state.step, byId]);

  const dotRefs = useRef([]);
  const clock = useRef({ t0: 0, pausedAt: 0 });

  useEffect(() => {
    clock.current = { t0: performance.now(), pausedAt: 0 };
  }, [replayKey, state.step]);

  useEffect(() => {
    const els = dotRefs.current;
    const place = (now) => {
      let k = 0;
      for (const f of flows) {
        for (let d = 0; d < f.dots; d++, k++) {
          const el = els[k];
          if (!el) continue;
          let dist;
          if (reduced) dist = f.route.total * ((d + 1) / (f.dots + 1));
          else {
            const t = (now - clock.current.t0) % f.cycle;
            const local = t - f.start - d * 160;
            if (local < 0 || local > f.dur) {
              el.setAttribute('opacity', '0');
              continue;
            }
            dist = (local / f.dur) * f.route.total;
          }
          const [x, y] = pointAt(f.route, dist);
          el.setAttribute('cx', x.toFixed(1));
          el.setAttribute('cy', y.toFixed(1));
          el.setAttribute('opacity', '1');
        }
      }
    };
    if (reduced) {
      place(0);
      return undefined;
    }
    if (paused) {
      clock.current.pausedAt = performance.now();
      place(clock.current.pausedAt);
      return () => {
        clock.current.t0 += performance.now() - clock.current.pausedAt;   // resume where it stopped
      };
    }
    let raf = requestAnimationFrame(function tick(now) {
      place(now);
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [flows, paused, reduced]);

  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const clip = `lab-clip-${uid}`;
  const arrow = (tone) => `url(#lab-arrow-${uid}-${tone ?? 'none'})`;
  const markers = Object.entries(TONES);
  let dotIndex = 0;

  return (
    <svg className="lab-svg" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} role="img" aria-label={label} style={{ fontFamily: 'var(--font-mono)' }}>
      <defs>
        <clipPath id={clip}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} />
        </clipPath>
        {markers.map(([name, t]) => (
          <marker key={name} id={`lab-arrow-${uid}-${name}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={t.line} />
          </marker>
        ))}
      </defs>
      <Grid box={box} clip={clip} />

      {order.map((n) => (
        <g key={`pad-${n.id}`} className={state.changedNodes.has(n.id) ? 'lab-fade' : undefined} opacity={n.dim ? 0.35 : 1}>
          <Pad n={n} />
        </g>
      ))}

      {state.links.map((l) => {
        const r = routeOf([l.from, l.to], byId, 40);
        if (!r) return null;
        const t = TONES[l.tone] ?? TONES.none;
        const fresh = state.newLinks.has(l.key);
        const [a, b] = r.pts;
        return (
          <line
            key={l.key}
            x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
            stroke={t.line}
            strokeWidth={fresh ? 2.6 : 1.8}
            strokeDasharray={l.dashed ? '6 5' : undefined}
            opacity={l.faint ? 0.4 : 1}
            markerEnd={l.arrow === false ? undefined : arrow(l.tone)}
            markerStart={l.both ? arrow(l.tone) : undefined}
          />
        );
      })}

      {flows.map((f) =>
        Array.from({ length: f.dots }, (_, d) => {
          const i = dotIndex++;
          return (
            <circle
              key={`${f.path.join('-')}-${i}`}
              ref={(el) => { dotRefs.current[i] = el; }}
              r={6.5}
              fill={FLOW_COLOR[f.tone ?? 'req'] ?? FLOW_COLOR.req}
              stroke="#fff"
              strokeWidth={2}
              opacity={0}
            />
          );
        }),
      )}

      {order.map((n) => (
        <g key={n.id} className={state.changedNodes.has(n.id) ? 'lab-pop' : undefined} opacity={n.dim ? 0.35 : 1}>
          <Body n={n} />
        </g>
      ))}

      {!compact &&
        state.links.map((l) => {
          if (!l.label) return null;
          const r = routeOf([l.from, l.to], byId, 40);
          if (!r) return null;
          const [a, b] = r.pts;
          return <Pill key={`lbl-${l.key}`} x={(a[0] + b[0]) / 2} y={(a[1] + b[1]) / 2 + (l.labelDy ?? 0)} text={l.label} fs={fs * 0.9} tone={l.tone ?? 'none'} bold={false} />;
        })}

      {state.nodes.map((n) => {
        const [x, y] = iso(...n.at);
        const k = kindOf(n);
        return (
          <g key={`lab-${n.id}`} opacity={n.dim ? 0.45 : 1}>
            <Pill x={x} y={y + TH / 2 * FOOT + fs * 1.6} text={n.label ?? n.id} sub={compact ? undefined : n.sub} fs={fs} />
            {n.badge && <Pill x={x} y={y - topOf(n) - B - fs * 1.4 - (k.shape === 'pad' || k.shape === 'device' ? 30 : 0)} text={n.badge} fs={fs * 0.92} tone={n.tone ?? 'new'} />}
          </g>
        );
      })}

      {(state.step.notes ?? []).map((note, i) => {
        const n = byId.get(note.at);
        if (!n) return null;
        const [x, y] = iso(...n.at);
        const side = note.side ?? 'right';
        const w = textW(note.text, fs * 0.9) + fs * 1.3;
        const nx = side === 'left' ? x - A - 14 - w / 2 : side === 'right' ? x + A + 14 + w / 2 : x;
        const ny = side === 'top' ? y - topOf(n) - B - fs * 3.4 : side === 'bottom' ? y + fs * 4.6 : y - topOf(n) * 0.5;
        // keep the note inside the scene
        const cx = Math.min(box.x + box.w - w / 2 - 6, Math.max(box.x + w / 2 + 6, nx + (note.dx ?? 0)));
        return <Pill key={`note-${i}`} x={cx} y={ny + (note.dy ?? 0)} text={note.text} fs={fs * 0.9} tone={note.tone ?? 'warn'} />;
      })}
    </svg>
  );
}
