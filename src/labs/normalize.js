// Lab authoring helpers shared by the app and `pnpm check:labs`.
//
// A node can be placed in two ways:
//   at: [gx, gy]      a tile of the isometric grid (full control)
//   col, row          screen cells: col runs left to right, row runs top to bottom (half steps allowed).
//                     This is the easy way: three rows and five columns fit a scene.
// Screen x = (gx - gy) * 64 and screen y = (gx + gy) * 32, so one column is 204.8 px and one row is 128 px.
const COL = 3.2;   // gx - gy per column
const ROW = 4;     // gx + gy per row

export function placeOf(n) {
  if (Array.isArray(n.at)) return n.at;
  const x = (n.col ?? 0) * COL;
  const y = (n.row ?? 0) * ROW;
  return [(x + y) / 2, (y - x) / 2];
}

/** Gives every node an `at` and every step flow `path` its default tone, so the player only deals with one shape. */
export function normalizeLab(lab) {
  const nodes = Object.fromEntries(Object.entries(lab.nodes ?? {}).map(([id, n]) => [id, { ...n, at: placeOf(n) }]));
  return { ...lab, nodes };
}
