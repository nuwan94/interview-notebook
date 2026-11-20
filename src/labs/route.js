// How a link between two nodes bends, shared by the lab player and `pnpm check:labs`.
//
// The scene is isometric, so a link runs along the two grid axes (down-right and down-left on screen), like a pipe laid on
// the floor. Two nodes that sit on one axis are joined by a straight line. Any other pair is joined by two legs with one
// bend (a V or an inverted V on screen), the way the reference lessons draw their arrows.

const gridToScreen = (g) => [(g[0] - g[1]) * 64, (g[0] + g[1]) * 32];

/** Points of a polyline sampled every few pixels, to test it against an ellipse. */
function touches(pts, cx, cy, rx, ry) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 8));
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n;
      const y = ay + ((by - ay) * k) / n;
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1) return true;
    }
  }
  return false;
}

/**
 * The grid point where the link from `a` to `b` bends, or null when it is straight.
 * `others` are the other nodes on stage as { at: [gx, gy], pill: boolean }: the bend that keeps clear of them is chosen,
 * and otherwise the lower one (the V shape).
 */
export function bendOf(a, b, others = []) {
  const dgx = b[0] - a[0];
  const dgy = b[1] - a[1];
  if (Math.abs(dgx) < 0.2 || Math.abs(dgy) < 0.2) return null;   // on an axis: a straight line
  const A = gridToScreen(a);
  const B = gridToScreen(b);
  // a direct line is the default; it bends only to go around a node that would otherwise sit on it
  const hits = (pts) => {
    let c = 0;
    for (const o of others) {
      const [ox, oy] = gridToScreen(o.at);
      if (touches(pts, ox, oy, 70, 56)) c += 100;
      if (o.pill && touches(pts, ox, oy + 82, 80, 24)) c += 60;
    }
    return c;
  };
  const direct = hits([A, B]);
  if (direct === 0) return null;
  let best = null;
  for (const corner of [[b[0], a[1]], [a[0], b[1]]]) {
    const C = gridToScreen(corner);
    const pts = [A, C, B];
    const cost = hits(pts) - C[1] * 0.01;                          // prefer the lower bend
    if (!best || cost < best.cost) best = { cost, corner };
  }
  if (best.cost >= direct) return null;                             // no better than the direct line
  const C = gridToScreen(best.corner);
  // a bend that bulges too far from the straight line (a steep link) is not drawn: it would swing wide of both nodes
  const chord = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
  const bulge = Math.abs((B[0] - A[0]) * (A[1] - C[1]) - (A[0] - C[0]) * (B[1] - A[1])) / chord;
  if (bulge > 0.34 * chord) return null;
  // a bend that is only a few pixels deep is not worth drawing
  if (Math.hypot(C[0] - A[0], C[1] - A[1]) < 34 || Math.hypot(C[0] - B[0], C[1] - B[1]) < 34) return null;
  return best.corner;
}
