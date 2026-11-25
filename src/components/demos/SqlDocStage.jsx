// Picture for the SQL vs NoSQL data model scene: on the left, customer 7 spread over four tables linked by
// foreign keys; on the right, the same customer as one JSON document. The current statement and its result sit
// in a bar above the picture.
//
// Frame: { line, result: { text, tone }, focus: 'sql' | 'doc' | 'both', links: bool,
//          hit: { customer: [row], branch: [row], address: [row], phone: [row] }, hitTone: 'hit' | 'ok',
//          branchName, docHit: bool, docBranch, docMark: bool, docMore: bool, note }
import './SqlDocStage.css';

const W = 740;
const H = 342;
const HEAD = 10; // arrowhead length
const ROW = 20;
const TONE = { ok: 'var(--color-ok)', bad: 'var(--color-bad)', warn: 'var(--color-warn)', new: 'var(--color-pen)' };

// the four tables, placed so every foreign key arrow has a clear path
const TABLES = [
  { id: 'customer', x: 48, y: 64, cols: [['id', 40], ['name', 70], ['branch_id', 84]], rows: [[7, 'Alice', 1], [8, 'Bob', 1]] },
  { id: 'branch', x: 296, y: 74, cols: [['id', 40], ['name', 108]], rows: [[1, null]] },
  { id: 'address', x: 48, y: 200, cols: [['customer_id', 96], ['city', 90]], rows: [[7, 'Singapore'], [7, 'Penang']] },
  { id: 'phone', x: 268, y: 200, cols: [['customer_id', 96], ['number', 80]], rows: [[7, '6123 4567'], [7, '9123 4567']] },
];
const width = (t) => t.cols.reduce((s, c) => s + c[1], 0);

function Table({ t, hit, tone, branchName, branchTone }) {
  const w = width(t);
  const rows = t.id === 'branch' ? [[1, branchName]] : t.rows;
  return (
    <g>
      <text x={t.x} y={t.y - 7} className="sqldoc-tname">{t.id}</text>
      {t.cols.reduce(
        (acc, [name, cw]) => {
          acc.out.push(
            <g key={name}>
              <rect x={acc.x} y={t.y} width={cw} height={ROW} className="sqldoc-head" />
              <text x={acc.x + 6} y={t.y + 14} className="sqldoc-htext">{name}</text>
            </g>,
          );
          acc.x += cw;
          return acc;
        },
        { x: t.x, out: [] },
      ).out}
      {rows.map((r, ri) => {
        let x = t.x;
        const y = t.y + ROW * (ri + 1);
        const isHit = (hit || []).includes(ri);
        const rowTone = t.id === 'branch' && branchTone ? branchTone : isHit ? tone : '';
        return (
          <g key={ri}>
            {r.map((v, ci) => {
              const cw = t.cols[ci][1];
              const cell = (
                <g key={ci}>
                  <rect x={x} y={y} width={cw} height={ROW} className={`sqldoc-cell ${rowTone ? `is-${rowTone}` : ''}`} />
                  <text x={x + 6} y={y + 14.5} className="sqldoc-ctext">{String(v)}</text>
                </g>
              );
              x += cw;
              return cell;
            })}
          </g>
        );
      })}
      {(hit || []).length > 0 && (
        <rect x={t.x - 1} y={t.y + ROW * (Math.min(...hit) + 1) - 1} width={w + 2} height={ROW * hit.length + 2} rx="2" className="sqldoc-frame" />
      )}
    </g>
  );
}

// JSON lines of customer 7's document; line 2 holds the copied branch name
const docLines = (branch) => [
  '{ _id: 7,',
  '  name: "Alice",',
  `  branch: "${branch}",`,
  '  addresses: [',
  '    { city: "Singapore" },',
  '    { city: "Penang" } ],',
  '  phones: [',
  '    "6123 4567",',
  '    "9123 4567" ] }',
];

export function SqlDocStage({ frames, index, label }) {
  const f = frames[index];
  const prev = index > 0 ? frames[index - 1] : {};
  const focus = f.focus || 'both';
  const dimSql = focus === 'doc';
  const dimDoc = focus === 'sql';
  const hit = f.hit || {};
  const hitTone = f.hitTone || 'hit';
  const linkColor = f.links ? TONE.new : '#8d9bb0';
  const linkClass = `g-edge ${f.links && !prev.links ? 'is-new' : ''}`;
  const docBranch = f.docBranch || 'Orchard';
  const lines = docLines(docBranch);
  const DOC = { x: 486, y: 50, w: 228, lh: 17 };

  // foreign key arrows: each ends one head-length before the key it points to
  const arrows = [
    { id: 'branch', d: `M242 104 L${296 - 1 - HEAD} 104`, lx: 252, ly: 97 },
    { id: 'address', d: `M140 198 L140 ${124 + 1 + HEAD}`, lx: 147, ly: 172 },
    { id: 'phone', d: `M350 198 C350 160 200 176 200 ${124 + 1 + HEAD}`, lx: 330, ly: 170 },
  ];

  return (
    <div className="g-stage sqldoc-stage">
      <div className="sqldoc-bar">
        <code className="sqldoc-line">{f.line}</code>
        {f.result && (
          <span className="sqldoc-result" style={{ background: TONE[f.result.tone] || TONE.new }}>
            {f.result.text}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="g-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          {[['link', TONE.new], ['grey', '#8d9bb0']].map(([k, c]) => (
            <marker key={k} id={`sqldoc-arrow-${k}`} viewBox="0 0 10 10" refX="0" refY="5" markerWidth={HEAD} markerHeight={HEAD} markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0 1L10 5L0 9z" fill={c} />
            </marker>
          ))}
        </defs>

        {/* relational side */}
        <g opacity={dimSql ? 0.35 : 1}>
          <rect x="12" y="12" width="448" height={H - 24} rx="10" className="sqldoc-panel" />
          <text x="26" y="36" className="sqldoc-panel-title">Relational: four tables linked by keys</text>
          {TABLES.map((t) => (
            <Table key={t.id} t={t} hit={hit[t.id]} tone={hitTone} branchName={f.branchName || 'Orchard'} branchTone={f.branchTone} />
          ))}
          {arrows.map((a) => (
            <g key={a.id} className={linkClass}>
              <path d={a.d} pathLength="1" className="g-edge-line" stroke={linkColor} strokeWidth={f.links ? 2.5 : 1.75} fill="none" markerEnd={`url(#sqldoc-arrow-${f.links ? 'link' : 'grey'})`} />
              <text x={a.lx} y={a.ly} className="sqldoc-fk">FK</text>
            </g>
          ))}
          <text x="26" y={H - 26} className="sqldoc-fk">An FK (foreign key) is a column that points at a row in another table.</text>
        </g>

        {/* document side */}
        <g opacity={dimDoc ? 0.35 : 1}>
          <rect x="472" y="12" width="256" height={H - 24} rx="10" className="sqldoc-panel" />
          <text x="486" y="36" className="sqldoc-panel-title">Document store: one document</text>
          <rect x={DOC.x} y={DOC.y} width={DOC.w} height={lines.length * DOC.lh + 22} rx="8" className={`sqldoc-doc ${f.docHit ? 'is-hit' : ''}`} />
          {f.docMark && <rect x={DOC.x + 6} y={DOC.y + 11 + 2 * DOC.lh} width={DOC.w - 12} height={DOC.lh} rx="3" className="sqldoc-mark" />}
          {lines.map((ln, i) => (
            <text key={i} x={DOC.x + 10} y={DOC.y + 24 + i * DOC.lh} className={`sqldoc-json ${f.docMark && i === 2 ? 'is-mark' : ''}`}>
              {ln}
            </text>
          ))}
          <rect x={DOC.x} y="240" width={DOC.w} height="42" rx="8" className={`sqldoc-doc ${f.docMark ? 'is-warn' : ''}`} />
          <text x={DOC.x + 10} y="257" className="sqldoc-json">{'{ _id: 8, name: "Bob",'}</text>
          <text x={DOC.x + 10} y="274" className={`sqldoc-json ${f.docMark ? 'is-mark' : ''}`}>{`  branch: "${docBranch}", ... }`}</text>
          {f.docMore && (
            <g className="g-pop">
              <rect x={DOC.x} y="290" width={DOC.w} height="38" rx="8" className="sqldoc-doc is-warn" />
              <text x={DOC.x + 10} y="306" className="sqldoc-json">... 49,998 more documents,</text>
              <text x={DOC.x + 10} y="322" className="sqldoc-json is-mark">{`  each a copy of "${docBranch}"`}</text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
