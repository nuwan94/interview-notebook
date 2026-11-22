import { useEffect, useId, useMemo, useRef } from 'react';
import {
  LuCog, LuDatabase, LuDoorOpen, LuGlobe, LuHardDrive, LuInbox, LuLaptop, LuNetwork, LuServer, LuShield, LuSmartphone, LuUsers, LuZap,
} from 'react-icons/lu';
import { iconComponent } from '../demos/icons.jsx';
import { bendOf } from '../../labs/route.js';

// The look follows the "designed to scale" lessons: soft rounded isometric blocks with an ink outline and a gradient,
// a blurred shadow on the floor, the name printed on the front of the block, ink arrows, white pills with a hard shadow,
// and request / response packets with an ink outline.

// Isometric grid: a tile is TW wide and TH high on screen (2:1).
const TW = 128;
const TH = 64;

/** Grid position (gx, gy) to screen position of the tile centre. */
export const iso = (gx, gy) => [(gx - gy) * (TW / 2), (gx + gy) * (TH / 2)];

const INK = '#14171c';
const PAPER = '#ffffff';

// gradient pairs for the top face and the side faces, plus the outline / icon colour of each family
const PALETTE = {
  orange: { top: ['#ffe3d6', '#fdd0bc'], side: ['#f2a98f', '#e48a6d'], ink: '#8f2f17' },
  green:  { top: ['#e3f3d3', '#d2e9ba'], side: ['#a9d68a', '#8cc468'], ink: '#2c5a14' },
  blue:   { top: ['#dbe6fb', '#c4d5f7'], side: ['#8fadea', '#6f93dd'], ink: '#1d3c85' },
  yellow: { top: ['#fff0c7', '#fde5a3'], side: ['#f0c15f', '#e0a93a'], ink: '#6e4500' },
  purple: { top: ['#ebe4fb', '#dcd0f6'], side: ['#b9a5ec', '#9c82dc'], ink: '#46308f' },
  teal:   { top: ['#d4f0ec', '#bce6e0'], side: ['#85cfc6', '#62bbb0'], ink: '#0d5c63' },
  red:    { top: ['#fbd9d6', '#f7c2bd'], side: ['#ee9a93', '#e0766e'], ink: '#8f1f19' },
  slab:   { top: ['#f6f8fa', '#eef1f5'], side: ['#d3d9e1', '#bcc4cf'], ink: '#46505e' },
};

// Each kind has a shape, a colour and a height. The shape list is read by `pnpm check:labs`.
const KINDS = {
  client:   { shape: 'crowd',    people: 1, h: 6,  icon: LuLaptop },
  mobile:   { shape: 'crowd',    people: 1, h: 6,  icon: LuSmartphone },
  users:    { shape: 'crowd',    people: 3, h: 6,  icon: LuUsers },
  service:  { shape: 'prism',    color: 'blue',   h: 46, icon: LuServer },
  worker:   { shape: 'prism',    color: 'blue',   h: 42, icon: LuCog },
  database: { shape: 'cylinder', color: 'purple', h: 40, icon: LuDatabase },
  storage:  { shape: 'cylinder', color: 'purple', h: 30, icon: LuHardDrive },
  cache:    { shape: 'prism',    color: 'orange', h: 38, icon: LuZap },
  queue:    { shape: 'stack',    color: 'yellow', h: 40, icon: LuInbox },
  lb:       { shape: 'prism',    color: 'teal',   h: 36, icon: LuNetwork },
  gateway:  { shape: 'prism',    color: 'teal',   h: 42, icon: LuDoorOpen },
  security: { shape: 'prism',    color: 'teal',   h: 42, icon: LuShield },
  external: { shape: 'prism',    color: 'green',  h: 42, icon: LuGlobe, dashed: true },
};
export const KIND_NAMES = Object.keys(KINDS);
export const COLOR_NAMES = Object.keys(PALETTE).filter((c) => c !== 'slab');

// pill tints for tones; the border is always ink
export const TONES = {
  ok:   { fill: '#dff3e6', line: '#1b6b3a' },
  bad:  { fill: '#fbe0de', line: '#a8271f' },
  warn: { fill: '#fdeccd', line: '#8a4b00' },
  new:  { fill: '#d8eeee', line: '#0d5c63' },
  none: { fill: PAPER, line: INK },
};
// packet looks: circle or square, fill, outline
const PACKET = {
  req:  { shape: 'circle', fill: '#f0a24a', stroke: INK, sw: 1.4 },
  res:  { shape: 'circle', fill: '#6cc48a', stroke: INK, sw: 1.4 },
  bad:  { shape: 'circle', fill: '#fbe0de', stroke: '#a8271f', sw: 2.1 },
  msg:  { shape: 'square', fill: '#9a82dc', stroke: INK, sw: 1.4 },
  data: { shape: 'square', fill: '#4f8fd6', stroke: INK, sw: 1.4 },
};
const LINK_COLOR = { none: '#3a414c', ok: '#1b6b3a', bad: '#a8271f', warn: '#8a4b00', new: '#0d5c63', faint: '#9aa6b6' };
const SPEED = 230;      // packet speed, px per second
const GAP = 650;        // pause after the last flow of a cycle, ms

const kindOf = (n) => KINDS[n.kind] ?? KINDS.service;
const colorOf = (n) => n.color ?? kindOf(n).color ?? 'blue';
const inkOf = (n) => PALETTE[colorOf(n)]?.ink ?? INK;

/** Approximate text width in the mono font. */
const textW = (s, fs) => String(s).length * fs * 0.6;

/** Footprint of a node: half width a, half height b of its floor diamond, its height h, and how far it reaches above and below the tile centre. */
function geomOf(n) {
  const k = kindOf(n);
  if (k.shape === 'crowd') return { a: 74, b: 37, h: k.h, top: 44, bottom: 37, pill: true };
  if (k.shape === 'cylinder') {
    const rx = 56 * 0.67;
    const ry = rx / 2;
    return { a: 56, b: ry, h: k.h, top: k.h + ry, bottom: ry, pill: true, rx, ry };
  }
  if (k.shape === 'stack') return { a: 56, b: 28, h: 10, top: 28 + 28 + 10, bottom: 28, pill: true };
  // a block: wide enough for its name, which is printed on the front; tall enough that the text stays inside the front faces
  const t = blockText(n);
  const a = t.width / 2;
  const b = a / 2;
  const h = Math.max(k.h, t.need);
  return { a, b, h, top: h + b, bottom: b, pill: false, text: t };
}
/** Font sizes and the height a block needs for its name (and second line). Text is level, the faces slope, so wider text needs more height. */
function blockText(n) {
  const label = String(n.label ?? n.id);
  const sub = n.sub ? String(n.sub) : '';
  const width = Math.min(168, Math.max(112, textW(label, 14.5) + 26, sub ? textW(sub, 10.5) + 26 : 0));
  const room = width - 18;
  const nameFs = Math.min(13.5, room / (label.length * 0.6));
  const subFs = sub ? Math.min(9.8, room / (sub.length * 0.6)) : 0;
  const nameW = textW(label, nameFs);
  const subW = sub ? textW(sub, subFs) : 0;
  const textH = nameFs * 1.2 + (sub ? subFs * 1.45 : 0);
  // the lowest line must clear the bottom edge, which rises by a quarter of the line's width towards both ends
  const need = Math.ceil(10 + textH + (sub ? subW : nameW) / 4);
  return { width, nameFs, subFs, textH, need };
}
/** The point lines attach to: the middle of the node's drawn body. */
const anchor = (n) => {
  const [x, y] = iso(...n.at);
  const g = geomOf(n);
  return [x, y - (g.top - g.bottom) / 2];
};

/** A closed path through the points with rounded corners (quadratic curves with the corner as control point). */
function roundedPoly(pts, r) {
  const n = pts.length;
  const out = [];
  pts.forEach((v, i) => {
    const p = pts[(i + n - 1) % n];
    const q = pts[(i + 1) % n];
    const d1 = [p[0] - v[0], p[1] - v[1]];
    const d2 = [q[0] - v[0], q[1] - v[1]];
    const l1 = Math.hypot(...d1) || 1;
    const l2 = Math.hypot(...d2) || 1;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = [v[0] + (d1[0] / l1) * rr, v[1] + (d1[1] / l1) * rr];
    const b = [v[0] + (d2[0] / l2) * rr, v[1] + (d2[1] / l2) * rr];
    out.push(`${i ? 'L' : 'M'}${a[0].toFixed(2)},${a[1].toFixed(2)} Q${v[0].toFixed(2)},${v[1].toFixed(2)} ${b[0].toFixed(2)},${b[1].toFixed(2)}`);
  });
  return `${out.join(' ')} Z`;
}

/** Pill: a white rounded label with an ink border and a hard shadow. */
function Pill({ x, y, text, fs, tone = 'none', icon: Icon, bold = true, sub }) {
  const t = TONES[tone] ?? TONES.none;
  const h = fs * 2;
  const w = textW(text, fs) + (Icon ? fs * 2.5 : fs * 1.7);
  return (
    <g className="lab-pill">
      <rect x={x - w / 2} y={y - h / 2 + fs * 0.2} width={w} height={h} rx={h / 2} fill={INK} />
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={h / 2} fill={t.fill} stroke={INK} strokeWidth={fs * 0.125} />
      {Icon && (
        <g transform={`translate(${x - w / 2 + fs * 0.85},${y - fs * 0.55})`}>
          <Icon size={fs * 1.1} color={INK} aria-hidden="true" focusable="false" />
        </g>
      )}
      <text x={x + (Icon ? fs * 0.85 : 0)} y={y + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight={bold ? 700 : 600} fill={INK}>
        {text}
      </text>
      {sub && (
        <text x={x} y={y + h / 2 + fs * 1.15} textAnchor="middle" fontSize={fs * 0.8} fill="#4a515c">
          {sub}
        </text>
      )}
    </g>
  );
}

/** The rounded isometric block (also the thin slabs of a stack and a crowd's floor). */
function Prism({ x, y, a, h, color, ink = INK, uid, dash, sheen = true }) {
  const b = a / 2;
  const T = [x, y - h - b];
  const R = [x + a, y - h];
  const C = [x, y - h + b];
  const L = [x - a, y - h];
  const R2 = [x + a, y];
  const B2 = [x, y + b];
  const L2 = [x - a, y];
  const sil = roundedPoly([T, R, R2, B2, L2, L], 9);
  const top = roundedPoly([T, R, C, L], 9);
  const right = roundedPoly([C, R, R2, B2], 6);
  const glow = roundedPoly([[x, y - h - b + 5], [x + a - 12, y - h], [x, y - h + b - 5], [x - a + 12, y - h]], 6);
  const edge = `M${L[0]},${L[1]} L${C[0]},${C[1]} L${R[0]},${R[1]}`;
  return (
    <g>
      <path d={sil} transform="translate(0 9)" fill="#2a2f38" opacity="0.2" filter={`url(#lab-blur-lg-${uid})`} />
      <path d={sil} fill={`url(#lab-${color}-side-${uid})`} />
      {h > 12 && <path d={right} fill="#14171c" opacity="0.05" />}
      <path d={top} fill={`url(#lab-${color}-top-${uid})`} />
      {sheen && <path d={glow} fill="#fff" opacity="0.22" filter={`url(#lab-blur-sm-${uid})`} />}
      <path d={edge} transform="translate(0 1.4)" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={edge} transform="translate(0 3.4)" fill="none" stroke="#14171c" strokeOpacity="0.07" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d={sil} fill="none" stroke={ink} strokeWidth="1.9" strokeLinejoin="round" strokeDasharray={dash} />
    </g>
  );
}

/** A little person standing on a crowd slab. */
function Person({ x, y, fill }) {
  return (
    <g transform={`translate(${x} ${y}) scale(1.3)`}>
      <ellipse cx="0" cy="0" rx="5.6" ry="2.8" fill="#2a2f38" opacity="0.16" />
      <path d="M-5.2,0 V-9 A5.2,5.2 0 0 1 5.2,-9 V0 A5.2,2.4 0 0 1 -5.2,0 Z" fill={fill} stroke={INK} strokeWidth="1.25" />
      <circle cx="0" cy="-17.6" r="4.3" fill="#fff" stroke={INK} strokeWidth="1.25" />
    </g>
  );
}
const PEOPLE = [['#b3d79f', -14, 3], ['#f3b47f', 4, -5], ['#a9c5e8', 18, 7]];

function Body({ n, uid, compact }) {
  const k = kindOf(n);
  const g = geomOf(n);
  const [x, y] = iso(...n.at);
  const color = colorOf(n);
  const ink = inkOf(n);
  const dash = k.dashed ? '5 4' : undefined;
  const Icon = (n.icon && iconComponent(n.icon)) || iconComponent(n.label ?? '') || k.icon;

  if (k.shape === 'cylinder') {
    const { rx, ry, h } = g;
    const side = `M${x - rx},${y - h} V${y} A${rx},${ry} 0 0 0 ${x + rx},${y} V${y - h} Z`;
    return (
      <g>
        <ellipse cx={x} cy={y + 4} rx={rx * 1.08} ry={ry * 1.05} fill="#2a2f38" opacity="0.2" filter={`url(#lab-blur-md-${uid})`} />
        <path d={side} fill={`url(#lab-${color}-side-${uid})`} />
        <path d={side} fill={`url(#lab-sheen-${uid})`} />
        <ellipse cx={x} cy={y - h} rx={rx} ry={ry} fill={`url(#lab-${color}-top-${uid})`} />
        <path d={`M${x - rx + 3},${y - h + 2.5} A${rx - 3},${ry - 2} 0 0 0 ${x + rx - 3},${y - h + 2.5}`} fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.4" />
        <path d={`M${x - rx},${y - h} V${y} A${rx},${ry} 0 0 0 ${x + rx},${y} V${y - h}`} fill="none" stroke={ink} strokeWidth="1.9" strokeLinejoin="round" />
        <ellipse cx={x} cy={y - h} rx={rx} ry={ry} fill="none" stroke={ink} strokeWidth="1.9" />
        <g transform={`translate(${x - 9.5},${y - h * 0.5 - 8})`}>
          <Icon size={19} color={ink} aria-hidden="true" focusable="false" />
        </g>
      </g>
    );
  }

  if (k.shape === 'stack') {
    return (
      <g>
        {[0, 1, 2].map((i) => (
          <Prism key={i} x={x} y={y - i * 14} a={g.a} h={10} color={color} ink={ink} uid={uid} dash={dash} sheen={i === 2} />
        ))}
        <g transform={`translate(${x - 11},${y - 2 * 14 - 10 - 13})`}>
          <Icon size={22} color={ink} aria-hidden="true" focusable="false" />
        </g>
      </g>
    );
  }

  if (k.shape === 'crowd') {
    const people = k.people === 1 ? [['#a9c5e8', 0, 2]] : PEOPLE.slice(0, k.people);
    const cy = y - g.h;
    return (
      <g>
        <Prism x={x} y={y} a={g.a} h={g.h} color="slab" ink={PALETTE.slab.ink} uid={uid} />
        {people.map(([fill, dx, dy], i) => (
          <Person key={i} x={x + dx} y={cy + dy} fill={fill} />
        ))}
      </g>
    );
  }

  // block: icon on the top face, the name on the front, inside the faces
  const label = String(n.label ?? n.id);
  const { nameFs, subFs, textH } = g.text;
  const top = y - g.h + g.b + 4;                       // below the front edge at the middle of the block
  const nameY = top + nameFs * 0.95;
  return (
    <g>
      <Prism x={x} y={y} a={g.a} h={g.h} color={color} ink={ink} uid={uid} dash={dash} />
      <g transform={`translate(${x - 11},${y - g.h - 12})`}>
        <Icon size={22} color={ink} aria-hidden="true" focusable="false" />
      </g>
      <text x={x} y={nameY} textAnchor="middle" fontSize={nameFs} fontWeight="800" fill={INK}>
        {label}
      </text>
      {n.sub && !compact && (
        <text x={x} y={top + textH - subFs * 0.2} textAnchor="middle" fontSize={subFs} fontWeight="600" fill="#3a414c">
          {n.sub}
        </text>
      )}
    </g>
  );
}

/** A tinted dashed diamond on the floor under a node (used for a node's tone). */
function Pad({ n }) {
  const t = TONES[n.tone];
  if (!t) return null;
  const [x, y] = iso(...n.at);
  const g = geomOf(n);
  const a = g.a + 20;
  const b = a / 2;
  return <path d={roundedPoly([[x, y - b], [x + a, y], [x, y + b], [x - a, y]], 10)} fill={t.fill} fillOpacity="0.55" stroke={INK} strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="6 5" />;
}

/**
 * Points along a polyline of node anchors, trimmed at both ends. `trim` is a number of pixels, or 'edge' to stop at the
 * edge of each node's body (used for links, so the arrowhead is not hidden behind the box).
 */
function routeOf(ids, byId, trim = 36, fs = 12) {
  const nodes = ids.map((id) => byId.get(id)).filter(Boolean);
  if (nodes.length < 2) return null;
  // every leg runs along the grid axes, with one bend unless the two nodes are on one axis
  const pts = [anchor(nodes[0])];
  for (let i = 1; i < nodes.length; i++) {
    const na = nodes[i - 1];
    const nb = nodes[i];
    const others = [...byId.values()].filter((o) => o !== na && o !== nb).map((o) => ({ at: o.at, pill: geomOf(o).pill }));
    const bend = bendOf(na.at, nb.at, others);
    const A = anchor(na);
    const B = anchor(nb);
    if (bend) {
      const [cx, cy] = iso(...bend);
      const lift = (A[1] - iso(...na.at)[1] + (B[1] - iso(...nb.at)[1])) / 2;   // the bend sits at the height of the bodies
      pts.push([cx, cy + lift]);
    }
    pts.push(B);
  }
  const cut = (p, q, d) => {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    return [p[0] + ((q[0] - p[0]) * d) / len, p[1] + ((q[1] - p[1]) * d) / len];
  };
  const dist = (node, p, q) => {
    if (trim !== 'edge') return trim;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    const ux = (q[0] - p[0]) / len;
    const uy = (q[1] - p[1]) / len;
    const g = geomOf(node);
    const rx = g.a + 6;
    const ry = (g.top + g.bottom) / 2 + 6;
    const edge = 1 / Math.sqrt((ux / rx) ** 2 + (uy / ry) ** 2);
    // a line leaving straight down would end behind the node's name pill: stop below the pill instead
    if (g.pill && uy > 0.5 && Math.abs(ux) < 0.4) {
      const below = g.bottom + fs * 3.6 + (g.top - g.bottom) / 2;
      return Math.max(edge, below / uy);
    }
    return edge;
  };
  const last = pts.length - 1;
  const a = cut(pts[0], pts[1], dist(nodes[0], pts[0], pts[1]));
  const z = cut(pts[last], pts[last - 1], dist(nodes[nodes.length - 1], pts[last], pts[last - 1]));
  pts[0] = a;
  pts[last] = z;
  let total = 0;
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push({ from: pts[i - 1], to: pts[i], start: total, len });
    total += len;
  }
  return { pts, segs, total };
}

/** A path through the points with softly rounded corners. */
function roundedPath(pts, radius = 18) {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const q = pts[i + 1];
    const l1 = Math.hypot(c[0] - p[0], c[1] - p[1]) || 1;
    const l2 = Math.hypot(q[0] - c[0], q[1] - c[1]) || 1;
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const a = [c[0] + ((p[0] - c[0]) / l1) * r, c[1] + ((p[1] - c[1]) / l1) * r];
    const b = [c[0] + ((q[0] - c[0]) / l2) * r, c[1] + ((q[1] - c[1]) / l2) * r];
    d += ` L${a[0].toFixed(1)},${a[1].toFixed(1)} Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
  }
  const z = pts[pts.length - 1];
  return `${d} L${z[0].toFixed(1)},${z[1].toFixed(1)}`;
}
const segAt = (route, d) => route.segs.find((g) => d <= g.start + g.len) ?? route.segs[route.segs.length - 1];
const pointAt = (route, d) => {
  const s = segAt(route, d);
  const f = s.len ? Math.min(1, Math.max(0, (d - s.start) / s.len)) : 0;
  return [s.from[0] + (s.to[0] - s.from[0]) * f, s.from[1] + (s.to[1] - s.from[1]) * f];
};

/* ---------- label placement: pick a spot for each link label that covers nothing ---------- */
const rectOf = (cx, cy, w, h) => ({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });
const grow = (r, d) => ({ x0: r.x0 - d, y0: r.y0 - d, x1: r.x1 + d, y1: r.y1 + d });
const overlap = (r, s) => Math.max(0, Math.min(r.x1, s.x1) - Math.max(r.x0, s.x0)) * Math.max(0, Math.min(r.y1, s.y1) - Math.max(r.y0, s.y0));
const lineHits = (r, a, b) => {
  const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5));
  let c = 0;
  for (let i = 0; i <= n; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / n;
    const y = a[1] + ((b[1] - a[1]) * i) / n;
    if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) c++;
  }
  return c;
};

/** Where a note pill goes (also used as an obstacle for link labels). */
function noteSpot(note, n, nf, box) {
  const [x, y] = iso(...n.at);
  const g = geomOf(n);
  const side = note.side ?? 'right';
  const w = textW(note.text, nf) + nf * 1.7;
  const nx = side === 'left' ? x - g.a - 14 - w / 2 : side === 'right' ? x + g.a + 14 + w / 2 : x;
  const ny = side === 'top' ? y - g.top - nf * 4.4 : side === 'bottom' ? y + g.bottom + nf * 3.2 : y - (g.top - g.bottom) / 2;
  const cx = Math.min(box.x + box.w - w / 2 - 6, Math.max(box.x + w / 2 + 6, nx + (note.dx ?? 0)));
  return { x: cx, y: ny + (note.dy ?? 0), w, h: nf * 2 };
}

/** Routes for every link, plus a collision-free spot for each link label. */
function layoutLinks(state, byId, pf, box, compact) {
  const routes = new Map();
  for (const l of state.links) {
    const r = routeOf([l.from, l.to], byId, 'edge', pf);
    if (r) routes.set(l.key, r);
  }
  const labels = [];
  if (compact) return { routes, labels };

  // things a label must stay clear of
  const solid = [];
  for (const n of state.nodes) {
    const [x, y] = iso(...n.at);
    const g = geomOf(n);
    solid.push(rectOf(x, y - (g.top - g.bottom) / 2, g.a * 1.7, g.top + g.bottom));
    if (g.pill) {
      const pw = textW(n.label ?? n.id, pf) + pf * 2.5;
      const py = y + g.bottom + pf * 1.7;
      solid.push(rectOf(x, py, pw, pf * 2.2));
      if (n.sub) solid.push(rectOf(x, py + pf * 1.9, textW(n.sub, pf * 0.8), pf));
    }
    if (n.badge) {
      const bf = pf * 0.95;
      solid.push(rectOf(x, y - g.top - pf * 1.5, textW(n.badge, bf) + bf * 1.7, bf * 2.2));
    }
  }
  for (const [i, note] of (state.step.notes ?? []).entries()) {
    const n = byId.get(note.at);
    if (!n) continue;
    const sp = noteSpot(note, n, pf * 0.95, box);
    solid.push(rectOf(sp.x, sp.y, sp.w, sp.h * 1.1));
  }
  const lines = [...routes.values()].flatMap((r) => r.segs.map((g) => [g.from, g.to]));

  const lf = pf * 0.9;
  for (const l of state.links) {
    if (!l.label) continue;
    const r = routes.get(l.key);
    if (!r) continue;
    const w = textW(l.label, lf) + lf * 1.7;
    const h = lf * 2.1;
    // candidate spots: beside the line at several places, and under or over each bend
    const cands = [];
    const fracs = [...new Set([l.at ?? 0.5, 0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82])];
    for (const [fi, f] of fracs.entries()) {
      const d = r.total * f;
      const sg = segAt(r, d);
      const [px, py] = pointAt(r, d);
      const ux = (sg.to[0] - sg.from[0]) / (sg.len || 1);
      const uy = (sg.to[1] - sg.from[1]) / (sg.len || 1);
      let nx = -uy;
      let ny = ux;
      if (ny > 0.001 || (Math.abs(ny) <= 0.001 && nx < 0)) { nx = -nx; ny = -ny; }   // the side that points up (or right for a vertical line)
      const gap = (Math.abs(nx) * w) / 2 + (Math.abs(ny) * h) / 2 + 4;
      for (const [si, side] of [1, -1].entries()) {
        for (const extra of [0, 9, 20, 32]) {
          cands.push({ cx: px + nx * (gap + extra) * side, cy: py + ny * (gap + extra) * side, pri: fi * 2 + si * 3 + extra * 0.3 });
        }
      }
    }
    for (const [i, [bx, by]] of r.pts.slice(1, -1).entries()) {
      for (const [si, side] of [1, -1].entries()) {
        for (const extra of [0, 10, 22]) cands.push({ cx: bx, cy: by + side * (h / 2 + 8 + extra), pri: -2 + i + si * 2 + extra * 0.3 });
      }
    }
    let best = null;
    for (const c of cands) {
      const cx = c.cx + (l.labelDx ?? 0);
      const cy = c.cy + (l.labelDy ?? 0);
      const rect = rectOf(cx, cy, w, h);
      let cost = c.pri;
      for (const o of solid) cost += overlap(grow(o, 2), rect) > 0 ? 200 + overlap(o, rect) / 20 : 0;
      for (const ln of lines) cost += lineHits(grow(rect, 2), ln[0], ln[1]) * 14;
      for (const p of labels) cost += overlap(grow(p.rect, 3), rect) > 0 ? 200 : 0;
      if (rect.x0 < box.x + 4 || rect.x1 > box.x + box.w - 4 || rect.y0 < box.y + 4 || rect.y1 > box.y + box.h - 4) cost += 150;
      if (!best || cost < best.cost) best = { cost, cx, cy, rect };
    }
    labels.push({ key: l.key, text: l.label, tone: l.tone ?? 'none', x: best.cx, y: best.cy, rect: best.rect, lf });
  }
  return { routes, labels };
}

/** The scene's fixed size: the bounds of every node of the lab, so the layout never moves between steps. */
export function sceneBox(allNodes) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const n of allNodes) {
    const [x, y] = iso(...n.at);
    const g = geomOf(n);
    x0 = Math.min(x0, x - Math.max(g.a, 70) - 96);
    x1 = Math.max(x1, x + Math.max(g.a, 70) + 96);
    y0 = Math.min(y0, y - g.top - 62);
    y1 = Math.max(y1, y + g.bottom + 70);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function Defs({ uid, box }) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return (
    <defs>
      {Object.entries(PALETTE).flatMap(([name, p]) => [
        <linearGradient key={`${name}-t`} id={`lab-${name}-top-${uid}`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor={p.top[0]} />
          <stop offset="1" stopColor={p.top[1]} />
        </linearGradient>,
        <linearGradient key={`${name}-s`} id={`lab-${name}-side-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.side[0]} />
          <stop offset="1" stopColor={p.side[1]} />
        </linearGradient>,
      ])}
      <linearGradient id={`lab-sheen-${uid}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.3" stopColor="#fff" stopOpacity="0.35" />
        <stop offset="0.55" stopColor="#fff" stopOpacity="0.05" />
        <stop offset="1" stopColor="#14171c" stopOpacity="0.07" />
      </linearGradient>
      <filter id={`lab-blur-sm-${uid}`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" /></filter>
      <filter id={`lab-blur-md-${uid}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" /></filter>
      <filter id={`lab-blur-lg-${uid}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6.5" /></filter>
      {Object.entries(LINK_COLOR).map(([name, color]) => (
        <marker key={name} id={`lab-arrow-${uid}-${name}`} viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="5.2" markerHeight="5.2" orient="auto-start-reverse" markerUnits="strokeWidth">
          <path d="M1,1.2 L9,5 L1,8.8 Z" fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round" />
        </marker>
      ))}
      <pattern id={`lab-grid-${uid}`} patternUnits="userSpaceOnUse" x="0" y="-8" width="32" height="16">
        <path d="M0 8 L16 0 L32 8 L16 16 Z" fill="none" stroke="#8a97ab" strokeOpacity="0.28" strokeWidth="0.8" />
      </pattern>
      <radialGradient id={`lab-fade-${uid}`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={Math.max(box.w, box.h * 1.6) * 0.62} gradientTransform={`translate(${cx} ${cy}) scale(1 0.6) translate(${-cx} ${-cy})`}>
        <stop offset="0" stopColor="#fff" />
        <stop offset="0.42" stopColor="#fff" stopOpacity="0.92" />
        <stop offset="0.78" stopColor="#fff" stopOpacity="0.35" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <mask id={`lab-mask-${uid}`} maskUnits="userSpaceOnUse" x={box.x - 200} y={box.y - 200} width={box.w + 400} height={box.h + 400}>
        <rect x={box.x - 200} y={box.y - 200} width={box.w + 400} height={box.h + 400} fill={`url(#lab-fade-${uid})`} />
      </mask>
    </defs>
  );
}

/**
 * The isometric stage: floor, links, packets, nodes, pills and notes.
 * `fs` is the label size in scene units (bigger on narrow screens so text stays readable).
 */
export function IsoScene({ state, box, bounds, view, fs = 12, paused = false, reduced = false, replayKey = 0, compact = false, label }) {
  const byId = useMemo(() => new Map(state.nodes.map((n) => [n.id, n])), [state.nodes]);
  const order = useMemo(() => [...state.nodes].sort((p, q) => p.at[0] + p.at[1] - (q.at[0] + q.at[1])), [state.nodes]);
  const pf = Math.min(16, Math.max(11.5, fs * 0.92));          // pill font in scene units
  
  const layout = useMemo(() => layoutLinks(state, byId, pf, bounds ?? box, compact), [state, byId, pf, bounds, box, compact]);

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
          el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
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
  const arrow = (tone) => `url(#lab-arrow-${uid}-${tone ?? 'none'})`;
  let dotIndex = 0;

  return (
    <svg className="lab-svg" viewBox={`${(view ?? box).x} ${(view ?? box).y} ${(view ?? box).w} ${(view ?? box).h}`} role="img" aria-label={label} style={{ fontFamily: 'var(--font-mono)' }}>
      <Defs uid={uid} box={box} />
      <g className="lab-grid" mask={`url(#lab-mask-${uid})`}>
        <rect x={box.x - 200} y={box.y - 200} width={box.w + 400} height={box.h + 400} fill={`url(#lab-grid-${uid})`} />
      </g>

      {order.map((n) => (
        <g key={`pad-${n.id}`} className={state.changedNodes.has(n.id) ? 'lab-fade' : undefined} opacity={n.dim ? 0.4 : 1}>
          <Pad n={n} />
        </g>
      ))}

      {state.links.map((l) => {
        const r = layout.routes.get(l.key);
        if (!r) return null;
        const tone = l.faint ? 'faint' : l.tone ?? 'none';
        const fresh = state.newLinks.has(l.key);
        return (
          <path
            key={l.key}
            d={roundedPath(r.pts)}
            fill="none"
            stroke={LINK_COLOR[tone] ?? INK}
            strokeWidth={l.faint ? 1.6 : fresh ? 2.3 : 1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={l.faint ? '4 5' : l.dashed ? '5 4.5' : undefined}
            markerEnd={l.arrow === false ? undefined : arrow(tone)}
            markerStart={l.both ? arrow(tone) : undefined}
          />
        );
      })}

      {flows.map((f) =>
        Array.from({ length: f.dots }, (_, d) => {
          const i = dotIndex++;
          const p = PACKET[f.tone ?? 'req'] ?? PACKET.req;
          return (
            <g key={`${f.path.join('-')}-${i}`} ref={(el) => { dotRefs.current[i] = el; }} opacity="0">
              {p.shape === 'circle' ? (
                <circle r="4.6" fill={p.fill} stroke={p.stroke} strokeWidth={p.sw} />
              ) : (
                <rect x="-4.4" y="-4.4" width="8.8" height="8.8" rx="2" fill={p.fill} stroke={p.stroke} strokeWidth={p.sw} />
              )}
            </g>
          );
        }),
      )}

      {order.map((n) => (
        <g key={n.id} className={state.changedNodes.has(n.id) ? 'lab-pop' : undefined} opacity={n.dim ? 0.45 : 1}>
          <Body n={n} uid={uid} compact={compact} />
        </g>
      ))}

      {layout.labels.map((p) => (
        <Pill key={`lbl-${p.key}`} x={p.x} y={p.y} text={p.text} fs={p.lf} tone={p.tone} bold={false} />
      ))}

      {state.nodes.map((n) => {
        const [x, y] = iso(...n.at);
        const g = geomOf(n);
        const k = kindOf(n);
        const Icon = (n.icon && iconComponent(n.icon)) || iconComponent(n.label ?? '') || k.icon;
        return (
          <g key={`lab-${n.id}`} opacity={n.dim ? 0.5 : 1}>
            {g.pill && <Pill x={x} y={y + g.bottom + pf * 1.7} text={n.label ?? n.id} sub={compact ? undefined : n.sub} icon={Icon} fs={pf} />}
            {n.badge && <Pill x={x} y={y - g.top - pf * 1.5} text={n.badge} fs={pf * 0.95} tone={n.tone ?? 'new'} />}
          </g>
        );
      })}

      {(state.step.notes ?? []).map((note, i) => {
        const n = byId.get(note.at);
        if (!n) return null;
        const sp = noteSpot(note, n, pf * 0.95, bounds ?? box);
        return <Pill key={`note-${i}`} x={sp.x} y={sp.y} text={note.text} fs={pf * 0.95} tone={note.tone ?? 'warn'} />;
      })}
    </svg>
  );
}
