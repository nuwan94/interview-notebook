// Code before and after: one or two panels of code side by side, for what the compiler does to your code
// (erasure, inserted casts) and how a lambda replaces an anonymous class. Each line can be marked and can carry
// a short tag under it that says what happens to that line.
//
// Frame: { line, result: { text, tone }, note, arrow: 'label',
//          panels: [{ title, lines: [{ t, mark, tag }] }] }
// mark: ok | bad | warn | new (added or changed) | gone (removed: struck through and grey)

import './CodePanelStage.css';
import { StageBar, ArrowDefs, SOFT, TONE, HEAD, fitSize } from './ChipColumnsStage.jsx';

const W = 680;
const PAD = 12;
const GAP = 52;
const TOP = 60;
const LINE = 22;
const TAG = 17;
const CHAR = 0.6;

const linesHeight = (lines) => lines.reduce((h, l) => h + LINE + (l.tag ? TAG : 0), 0);

export function CodePanelStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : null;
  const H = Math.max(180, ...frames.map((fr) => TOP + Math.max(...fr.panels.map((p) => linesHeight(p.lines))) + 22));
  const n = f.panels.length;
  const pw = (W - 2 * PAD - GAP * (n - 1)) / n;
  const prevLines = new Set(prev ? prev.panels.flatMap((p, i) => p.lines.map((l) => `${i}/${l.t}/${l.mark}/${l.tag}`)) : []);

  return (
    <div className="g-stage cpanel-stage">
      <StageBar line={f.line} result={f.result} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <ArrowDefs prefix="cpanel-arrow" />
        {f.panels.map((p, pi) => {
          const x = PAD + pi * (pw + GAP);
          // one font size per panel, so the indentation lines up
          const longest = Math.max(...p.lines.map((l) => l.t.length), 1);
          const size = Math.max(11, Math.min(12.5, (pw - 34) / (longest * CHAR)));
          let y = TOP;
          return (
            <g key={pi}>
              <rect x={x} y="12" width={pw} height={H - 24} rx="10" className="cpanel-panel" />
              <text x={x + 14} y="36" className="cpanel-title" style={{ fontSize: fitSize(p.title, pw - 28, 15, 0.52) }}>
                {p.title}
              </text>
              {p.lines.map((l, li) => {
                const ly = y;
                y += LINE + (l.tag ? TAG : 0);
                const indent = (l.t.match(/^ */) || [''])[0].length;
                const text = l.t.trimStart();
                const tx = x + 20 + indent * size * CHAR;
                const tone = l.mark === 'gone' ? 'off' : l.mark;
                const key = `${pi}/${l.t}/${l.mark}/${l.tag}`;
                return (
                  <g key={`${li}-${key}`} className={prevLines.has(key) ? '' : 'g-pop'}>
                    {l.mark && (
                      <>
                        <rect x={x + 8} y={ly} width={pw - 16} height={LINE - 3 + (l.tag ? TAG : 0)} rx="4" fill={SOFT[tone]} />
                        <rect x={x + 8} y={ly} width="4" height={LINE - 3 + (l.tag ? TAG : 0)} rx="2" fill={TONE[tone]} />
                      </>
                    )}
                    <text x={tx} y={ly + 14} className={`cpanel-code ${l.mark === 'gone' ? 'is-gone' : ''}`} style={{ fontSize: size }}>
                      {text}
                    </text>
                    {l.mark === 'gone' && <line x1={tx - 2} x2={tx + text.length * size * CHAR + 2} y1={ly + 10} y2={ly + 10} className="cpanel-strike" />}
                    {l.tag && (
                      <text x={tx} y={ly + 14 + TAG - 1} className="cpanel-tag" fill={TONE[tone] || TONE.new} style={{ fontSize: fitSize(l.tag, pw - (tx - x) - 12, 11.5, 0.55) }}>
                        {l.tag}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
        {f.arrow &&
          f.panels.slice(1).map((_, i) => {
            const x1 = PAD + (i + 1) * pw + i * GAP + 4;
            const x2 = x1 + GAP - 8 - HEAD;
            const y = 12 + (H - 24) / 2;
            return (
              <g key={i} className="g-edge is-new">
                <path d={`M${x1} ${y} L${x2} ${y}`} pathLength="1" className="g-edge-line" stroke={TONE.new} fill="none" markerEnd="url(#cpanel-arrow-new)" />
                <text x={(x1 + x2 + HEAD) / 2} y={y - 9} textAnchor="middle" className="cpanel-arrow-label">{f.arrow}</text>
              </g>
            );
          })}
      </svg>
    </div>
  );
}
