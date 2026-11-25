// Columns of small cards ("chips") for data that moves between steps: a stream pipeline, collectors grouping
// elements, an Optional passing through map, a Class object and its members, annotations surviving compilation.
// Each column is a panel; chips can sit in labelled groups; arrows join chips (or groups) in neighbouring columns.
//
// Frame: { line, result: { text, tone }, note,
//          columns: [{ id, title, sub, flex, empty, groups: { key: label },
//                      items: [{ id, text, sub, tone, group, strike }] }],
//          flow: true,                               // a plain arrow between every pair of neighbouring columns
//          links: [{ from, to, tone, label }],       // chip or group ids, always in neighbouring columns
//          focus: ['id', ...] }                      // chips or groups the step is about; the rest is dimmed
//
// tone: ok | bad | warn | new | none | off (off = dashed and grey: skipped, erased or already used)

import './ChipColumnsStage.css';

export const TONE = {
  ok: 'var(--color-ok)',
  bad: 'var(--color-bad)',
  warn: 'var(--color-warn)',
  new: 'var(--color-pen)',
  none: '#8d9bb0',
  off: '#a3adbb',
};
export const SOFT = {
  ok: 'var(--color-ok-soft)',
  bad: 'var(--color-bad-soft)',
  warn: 'var(--color-warn-soft)',
  new: 'var(--color-pen-soft)',
  none: '#ffffff',
  off: '#f5f6f8',
};
export const HEAD = 9; // arrowhead length, fixed in user space
const CHAR = 0.6; // width of one monospace character, as a share of the font size

/** Font size that makes `text` fit in `width`, from `base` down to 11 (never smaller). */
export function fitSize(text, width, base = 12.5, char = CHAR) {
  const len = String(text || '').length || 1;
  return Math.max(11, Math.min(base, width / (len * char)));
}

/** The code line and the result pill shown above every custom stage of these lessons. */
export function StageBar({ line, result }) {
  if (!line && !result) return null;
  return (
    <div className="chipcol-bar">
      {line && <code className="chipcol-line">{line}</code>}
      {result && (
        <span className="chipcol-result" style={{ background: TONE[result.tone] || TONE.new }}>
          {result.text}
        </span>
      )}
    </div>
  );
}

/** One fixed-size arrowhead per tone; `prefix` keeps the ids unique per stage. */
export function ArrowDefs({ prefix }) {
  return (
    <defs>
      {Object.entries(TONE).map(([k, c]) => (
        <marker key={k} id={`${prefix}-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
          <path d="M0 1L10 5L0 9z" fill={c} />
        </marker>
      ))}
    </defs>
  );
}

const W = 680;
const PAD = 12;
const GAP = 40; // room between panels for the arrows
const TOP = 66; // first chip, under the column title and sub title
const ITEM_H = 30;
const ITEM_H2 = 44; // a chip with a second line
const ITEM_GAP = 7;
const GROUP_HEAD = 22;
const GROUP_PAD = 6;
const GROUP_GAP = 10;

function columnsX(cols) {
  const total = W - 2 * PAD - GAP * (cols.length - 1);
  const sum = cols.reduce((s, c) => s + (c.flex || 1), 0);
  let x = PAD;
  return cols.map((c) => {
    const w = (total * (c.flex || 1)) / sum;
    const out = { x, w };
    x += w + GAP;
    return out;
  });
}

function layoutColumn(col, x, w) {
  const items = {};
  const groups = {};
  const list = col.items || [];
  let y = TOP;
  let i = 0;
  while (i < list.length) {
    const g = list[i].group;
    if (g) {
      const gx = x + 8;
      const gw = w - 16;
      const gy = y;
      let iy = gy + GROUP_HEAD;
      while (i < list.length && list[i].group === g) {
        const it = list[i];
        const h = it.sub ? ITEM_H2 : ITEM_H;
        items[it.id] = { x: gx + GROUP_PAD, y: iy, w: gw - 2 * GROUP_PAD, h };
        iy += h + ITEM_GAP;
        i += 1;
      }
      const gh = iy - ITEM_GAP + GROUP_PAD - gy;
      groups[g] = { x: gx, y: gy, w: gw, h: gh, label: (col.groups && col.groups[g]) || g };
      y = gy + gh + GROUP_GAP;
    } else {
      const it = list[i];
      const h = it.sub ? ITEM_H2 : ITEM_H;
      items[it.id] = { x: x + 10, y, w: w - 20, h };
      y += h + ITEM_GAP;
      i += 1;
    }
  }
  return { itemBox: items, groupBox: groups, bottom: y };
}

function layoutFrame(f) {
  const xs = columnsX(f.columns);
  const cols = f.columns.map((c, i) => ({ ...c, ...xs[i], ...layoutColumn(c, xs[i].x, xs[i].w) }));
  const boxes = {};
  cols.forEach((c, ci) => {
    Object.entries(c.groupBox).forEach(([k, g]) => (boxes[k] = { ...g, col: ci }));
    Object.entries(c.itemBox).forEach(([k, g]) => (boxes[k] = { ...g, col: ci }));
  });
  return { cols, boxes, bottom: Math.max(...cols.map((c) => c.bottom)) };
}

export function ChipColumnsStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : null;
  // one height for the whole scene, so the picture does not jump between steps
  const H = Math.max(200, ...frames.map((fr) => layoutFrame(fr).bottom + 16));
  const { cols, boxes } = layoutFrame(f);
  const focus = new Set(f.focus || []);
  const hasFocus = focus.size > 0;

  const prevKeys = new Set();
  if (prev) prev.columns.forEach((c) => (c.items || []).forEach((it) => prevKeys.add(`${c.id}/${it.id}/${it.text}`)));
  const prevLinks = new Set(prev ? (prev.links || []).map((l) => `${l.from}>${l.to}`) : []);
  const prevCols = new Set(prev ? prev.columns.map((c) => c.id) : []);

  // a chip is lit when it, or the group it sits in, is in focus
  const lit = (id, group) => !hasFocus || focus.has(id) || (group && focus.has(group));

  return (
    <div className="g-stage chipcol-stage">
      <StageBar line={f.line} result={f.result} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <ArrowDefs prefix="chipcol-arrow" />

        {cols.map((c) => {
          const ts = fitSize(c.title, c.w - 24, 15, 0.52);
          const ss = fitSize(c.sub, c.w - 24, 12);
          return (
            <g key={c.id} className={prevCols.has(c.id) ? '' : 'g-pop'}>
              <rect x={c.x} y={12} width={c.w} height={H - 24} rx="10" className="chipcol-panel" />
              <text x={c.x + 12} y={34} className="chipcol-title" style={{ fontSize: ts }}>
                {c.title}
              </text>
              {c.sub && (
                <text x={c.x + 12} y={52} className="chipcol-sub" style={{ fontSize: ss }}>
                  {c.sub}
                </text>
              )}
              {!(c.items || []).length && c.empty && (
                <text x={c.x + 12} y={TOP + 18} className="chipcol-empty" style={{ fontSize: fitSize(c.empty, c.w - 24, 12) }}>
                  {c.empty}
                </text>
              )}

              {Object.entries(c.groupBox).map(([k, g]) => (
                <g key={k} opacity={lit(k) || (c.items || []).some((it) => it.group === k && lit(it.id)) ? 1 : 0.4}>
                  <rect x={g.x} y={g.y} width={g.w} height={g.h} rx="8" className={`chipcol-group ${focus.has(k) ? 'is-focus' : ''}`} />
                  <text x={g.x + 9} y={g.y + 15} className="chipcol-group-label" style={{ fontSize: fitSize(g.label, g.w - 18, 12) }}>
                    {g.label}
                  </text>
                </g>
              ))}

              {(c.items || []).map((it) => {
                const b = c.itemBox[it.id];
                const tone = it.tone || 'none';
                const key = `${c.id}/${it.id}/${it.text}`;
                const size = fitSize(it.text, b.w - 18);
                return (
                  <g key={key} className={prevKeys.has(key) ? '' : 'g-pop'} opacity={lit(it.id, it.group) ? 1 : 0.35}>
                    <rect
                      x={b.x}
                      y={b.y}
                      width={b.w}
                      height={b.h}
                      rx="6"
                      fill={SOFT[tone]}
                      stroke={TONE[tone]}
                      strokeWidth={focus.has(it.id) ? 3 : 1.75}
                      strokeDasharray={tone === 'off' ? '5 4' : undefined}
                    />
                    <text x={b.x + 9} y={b.y + 19} className={`chipcol-text ${tone === 'off' ? 'is-off' : ''}`} style={{ fontSize: size }}>
                      {it.text}
                    </text>
                    {it.strike && <line x1={b.x + 8} x2={b.x + 9 + it.text.length * size * CHAR} y1={b.y + 15} y2={b.y + 15} className="chipcol-strike" />}
                    {it.sub && (
                      <text x={b.x + 9} y={b.y + 35} className="chipcol-subtext" style={{ fontSize: fitSize(it.sub, b.w - 18, 11.5) }}>
                        {it.sub}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* plain arrows between neighbouring panels, at the height of the titles where no chip sits */}
        {f.flow &&
          cols.slice(1).map((c, i) => {
            const a = cols[i];
            const x1 = a.x + a.w + 4;
            const x2 = c.x - 4 - HEAD;
            const tone = f.flowTone || 'new';
            return (
              <path key={`flow-${a.id}-${c.id}`} d={`M${x1} 40 L${x2} 40`} stroke={TONE[tone]} strokeWidth="2.25" fill="none" markerEnd={`url(#chipcol-arrow-${tone})`} />
            );
          })}

        {/* arrows from one chip or group to another in the next column */}
        {(f.links || []).map((l, li, all) => {
          const a = boxes[l.from];
          const b = boxes[l.to];
          if (!a || !b) return null;
          const x1 = a.x + a.w + 3;
          const y1 = a.y + Math.min(a.h / 2, 22);
          const x2 = b.x - 3 - HEAD;
          // several arrows into one chip enter at different heights, so the heads do not pile up
          const into = all.filter((o) => o.to === l.to);
          const k = into.indexOf(l);
          const y2 = into.length > 1 ? b.y + (b.h * (k + 1)) / (into.length + 1) : b.y + Math.min(b.h / 2, 22);
          const dx = Math.max(16, (x2 - x1) / 2);
          const tone = l.tone || 'ok';
          const on = !hasFocus || focus.has(l.from) || focus.has(l.to);
          const isNew = !prevLinks.has(`${l.from}>${l.to}`);
          return (
            <g key={`${l.from}>${l.to}`} className={`g-edge ${isNew ? 'is-new' : ''}`} opacity={on ? 1 : 0.25}>
              <path
                d={`M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`}
                pathLength="1"
                className="g-edge-line"
                stroke={TONE[tone]}
                fill="none"
                markerEnd={`url(#chipcol-arrow-${tone})`}
              />
              {l.label && (
                <text x={(x1 + x2 + HEAD) / 2} y={(y1 + y2) / 2 - 7} textAnchor="middle" className="chipcol-link-label" fill={TONE[tone]}>
                  {l.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
