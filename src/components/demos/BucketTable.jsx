// Draws the HashMap table: one row per bucket, nodes chained left→right, tree bins drawn as small trees.
// Long runs of empty buckets are folded so a 64-bucket table stays readable.

function NodeChip({ n, state, tag }) {
  return (
    <span className="node" data-state={state} data-tag={tag} title={`stored hash ${n.hash}`}>
      <span>
        <b>{n.label}</b> <span aria-hidden="true">→</span> {n.value}
      </span>
      <small>h={n.hash}</small>
    </span>
  );
}

// schematic balanced tree: sorted by (hash, label), middle element becomes the root
function layoutTree(nodes) {
  const sorted = [...nodes].sort((a, b) => a.hash - b.hash || a.label.localeCompare(b.label));
  const placed = [];
  const edges = [];
  const rec = (lo, hi, depth, parent) => {
    if (lo > hi) return;
    const mid = (lo + hi) >> 1;
    const item = { n: sorted[mid], x: mid, y: depth };
    placed.push(item);
    if (parent) edges.push([parent, item]);
    rec(lo, mid - 1, depth + 1, item);
    rec(mid + 1, hi, depth + 1, item);
  };
  rec(0, sorted.length - 1, 0, null);
  return { placed, edges, depth: Math.max(...placed.map((p) => p.y)) + 1, count: sorted.length };
}

function TreeBin({ nodes, active, tags }) {
  const { placed, edges, depth, count } = layoutTree(nodes);
  const DX = 3.1;
  const DY = 2.4;
  const w = Math.max(count * DX, DX);
  return (
    <div className="tree-wrap" style={{ width: `${w + 1}rem`, height: `${depth * DY + 0.4}rem` }} role="img" aria-label={`Red-black tree of ${count} nodes`}>
      <svg width="100%" height="100%" className="absolute inset-0" aria-hidden="true">
        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={`${(a.x + 0.5) * DX}rem`}
            y1={`${a.y * DY + 1}rem`}
            x2={`${(b.x + 0.5) * DX}rem`}
            y2={`${b.y * DY + 1}rem`}
            stroke="#8ea3bd"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      {placed.map(({ n, x, y }) => (
        <span
          key={n.id}
          className="tree-node node !min-w-0 !px-1.5 !items-center"
          data-state={active?.nodeId === n.id ? active.state : undefined}
          data-tag={tags?.[n.id]}
          style={{ left: `${(x + 0.5) * DX}rem`, top: `${y * DY}rem` }}
          title={`${n.label} → ${n.value} (hash ${n.hash})`}
        >
          <b>{n.label.replace(/"/g, '')}</b>
        </span>
      ))}
    </div>
  );
}

export function BucketTable({ snap, active, tags }) {
  const rows = [];
  let run = null;
  snap.table.forEach((b, i) => {
    const isActive = active?.bucket === i;
    if (!b && !isActive) {
      if (!run) run = { from: i, to: i };
      else run.to = i;
      return;
    }
    if (run) {
      rows.push({ empty: run });
      run = null;
    }
    rows.push({ i, b });
  });
  if (run) rows.push({ empty: run });

  return (
    <ol className="list-none m-0 p-0 overflow-x-auto" aria-label={`HashMap with ${snap.cap} buckets`}>
      {rows.map((r) =>
        r.empty ? (
          <li key={`e${r.empty.from}`} className="brow text-xs text-soft" aria-label={`buckets ${r.empty.from} to ${r.empty.to} are empty`}>
            <span className="idx">{r.empty.from === r.empty.to ? r.empty.from : `${r.empty.from}–${r.empty.to}`}</span>
            <span className="font-mono">
              ⋮ {r.empty.to - r.empty.from + 1} empty
            </span>
          </li>
        ) : (
          <li key={r.i} className="brow" data-active={active?.bucket === r.i && !active.nodeId ? active.state : undefined}>
            <span className="idx">[{r.i}]</span>
            {!r.b ? (
              <span className="slot" aria-label="empty" />
            ) : r.b.tree ? (
              <>
                <span className="slot" aria-hidden="true" />
                <span className="arrow">→</span>
                <TreeBin nodes={r.b.nodes} active={active?.bucket === r.i ? active : null} tags={tags} />
              </>
            ) : (
              <>
                <span className="slot" aria-hidden="true" />
                {r.b.nodes.map((n) => {
                  const state = active?.bucket === r.i && active.nodeId === n.id ? active.state : undefined;
                  return (
                    <span key={`${n.id}:${state}`} className="contents">
                      <span className="arrow">→</span>
                      <NodeChip n={n} state={state} tag={tags?.[n.id]} />
                    </span>
                  );
                })}
                <span className="arrow text-xs">→ null</span>
              </>
            )}
            {active?.bucket === r.i && active.state === 'treeify' && (
              <span className="badge level-deep ml-2" style={{ background: 'var(--lv-soft)' }}>
                treeified
              </span>
            )}
          </li>
        ),
      )}
    </ol>
  );
}
