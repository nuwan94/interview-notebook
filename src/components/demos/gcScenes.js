// Frame data for the garbage-collector walk-through demo.
// Cell states: new (just allocated), live, dead (unreachable), marked (found reachable by the collector), free.
// A "regions" scene shows heap areas as rows of slots; a "graph" scene shows roots and objects with their references.

const c = (id, state = 'live', age) => ({ id, state, age });
const R = (name, sub, slots, cells) => ({ name, sub, slots, cells });

const eden = (cells) => R('Eden', 'new objects start here', 8, cells);
const s0 = (cells = []) => R('Survivor 0', 'survived a collection', 4, cells);
const s1 = (cells = []) => R('Survivor 1', 'the other survivor space', 4, cells);
const old = (cells = []) => R('Old generation', 'long-lived objects', 8, cells);

export const GC_SCENES = [
  {
    id: 'young',
    type: 'regions',
    label: 'Young collection',
    title: 'How a young collection copies survivors',
    frames: [
      {
        note: 'The program allocates objects. Each one is placed in eden by bumping a pointer, which is very fast. Six objects (A to F) so far.',
        regions: [eden([c('A', 'new'), c('B', 'new'), c('C', 'new'), c('D', 'new'), c('E', 'new'), c('F', 'new')]), s0(), s1(), old()],
      },
      {
        note: 'The program keeps running. B, D and F are no longer referenced by anything: they are garbage, but nothing has freed them yet.',
        regions: [eden([c('A'), c('B', 'dead'), c('C'), c('D', 'dead'), c('E'), c('F', 'dead')]), s0(), s1(), old()],
      },
      {
        note: 'More allocation fills eden (G and H), so a young collection starts. The program is paused briefly (a stop-the-world pause) while the collector marks everything reachable from the roots: A, C, E and G.',
        regions: [eden([c('A', 'marked'), c('B', 'dead'), c('C', 'marked'), c('D', 'dead'), c('E', 'marked'), c('F', 'dead'), c('G', 'marked'), c('H', 'dead')]), s0(), s1(), old()],
      },
      {
        note: 'Survivors are copied into Survivor 0 with age 1, and eden is emptied in one step. Dead objects are not touched: the cost of a young collection depends on the live data, not on how much garbage there was.',
        regions: [eden([]), s0([c('A', 'live', 1), c('C', 'live', 1), c('E', 'live', 1), c('G', 'live', 1)]), s1(), old()],
      },
      {
        note: 'The program allocates again (I to L) and C and L lose their last references.',
        regions: [eden([c('I', 'new'), c('J', 'new'), c('K', 'new'), c('L', 'dead')]), s0([c('A', 'live', 1), c('C', 'dead', 1), c('E', 'live', 1), c('G', 'live', 1)]), s1(), old()],
      },
      {
        note: 'Second young collection: live objects from eden and from Survivor 0 are copied to Survivor 1 and their age goes up. The two survivor spaces swap roles every time. C and L are simply left behind.',
        regions: [eden([]), s0(), s1([c('A', 'live', 2), c('E', 'live', 2), c('G', 'live', 2), c('I', 'live', 1), c('J', 'live', 1), c('K', 'live', 1)]), old()],
      },
      {
        note: 'On a later collection, objects whose age reaches the tenuring threshold (2 in this demo; the JVM picks it adaptively, up to 15) are promoted to the old generation.',
        regions: [eden([]), s0([c('I', 'live', 2), c('J', 'live', 2), c('K', 'live', 2)]), s1(), old([c('A', 'live'), c('E', 'live'), c('G', 'live')])],
      },
      {
        note: 'The old generation fills slowly. When it gets crowded the collector runs a more expensive collection of it (a mixed or full collection, depending on the collector). Keeping short-lived objects out of the old generation is the main goal of generational collection.',
        regions: [eden([]), s0(), s1(), old([c('A', 'live'), c('E', 'live'), c('G', 'live'), c('I', 'live'), c('J', 'live'), c('K', 'live'), c('M', 'dead'), c('N', 'dead')])],
      },
    ],
  },
  {
    id: 'reach',
    type: 'graph',
    label: 'Reachability',
    title: 'Garbage is what no root can reach',
    frames: [
      {
        note: 'Two GC roots: the local variable order on a thread stack points to A, and the static field CACHE points to D. Objects point to each other: A to B to C, D to E. X and Y point only to each other.',
        roots: [
          { n: 'order (stack)', ref: 'A' },
          { n: 'CACHE (static)', ref: 'D' },
        ],
        cells: [
          { id: 'A', refs: ['B'] },
          { id: 'B', refs: ['C'] },
          { id: 'C', refs: [] },
          { id: 'D', refs: ['E'] },
          { id: 'E', refs: [] },
          { id: 'X', refs: ['Y'] },
          { id: 'Y', refs: ['X'] },
        ],
      },
      {
        note: 'Mark phase: starting from each root, the collector follows references and marks everything it can reach: A, B, C, D and E.',
        roots: [
          { n: 'order (stack)', ref: 'A' },
          { n: 'CACHE (static)', ref: 'D' },
        ],
        cells: [
          { id: 'A', refs: ['B'], state: 'marked' },
          { id: 'B', refs: ['C'], state: 'marked' },
          { id: 'C', refs: [], state: 'marked' },
          { id: 'D', refs: ['E'], state: 'marked' },
          { id: 'E', refs: [], state: 'marked' },
          { id: 'X', refs: ['Y'] },
          { id: 'Y', refs: ['X'] },
        ],
      },
      {
        note: 'X and Y were never reached. They reference each other, but that does not keep them alive: Java collectors use reachability, not reference counting, so cycles are collected.',
        roots: [
          { n: 'order (stack)', ref: 'A' },
          { n: 'CACHE (static)', ref: 'D' },
        ],
        cells: [
          { id: 'A', refs: ['B'], state: 'marked' },
          { id: 'B', refs: ['C'], state: 'marked' },
          { id: 'C', refs: [], state: 'marked' },
          { id: 'D', refs: ['E'], state: 'marked' },
          { id: 'E', refs: [], state: 'marked' },
          { id: 'X', refs: ['Y'], state: 'dead' },
          { id: 'Y', refs: ['X'], state: 'dead' },
        ],
      },
      {
        note: 'Sweep or copy: the space of X and Y is reclaimed, and the survivors keep their marks cleared for the next cycle.',
        roots: [
          { n: 'order (stack)', ref: 'A' },
          { n: 'CACHE (static)', ref: 'D' },
        ],
        cells: [
          { id: 'A', refs: ['B'] },
          { id: 'B', refs: ['C'] },
          { id: 'C', refs: [] },
          { id: 'D', refs: ['E'] },
          { id: 'E', refs: [] },
        ],
      },
      {
        note: 'The method returns: the stack frame holding order is popped, so that root disappears. A, B and C are now unreachable, even though they still point at each other.',
        roots: [{ n: 'CACHE (static)', ref: 'D' }],
        cells: [
          { id: 'A', refs: ['B'], state: 'dead' },
          { id: 'B', refs: ['C'], state: 'dead' },
          { id: 'C', refs: [], state: 'dead' },
          { id: 'D', refs: ['E'] },
          { id: 'E', refs: [] },
        ],
      },
      {
        note: 'The next collection frees A, B and C. D and E stay for as long as the static CACHE holds them: this is how a "memory leak" happens in a garbage-collected language.',
        roots: [{ n: 'CACHE (static)', ref: 'D' }],
        cells: [
          { id: 'D', refs: ['E'], state: 'marked' },
          { id: 'E', refs: [], state: 'marked' },
        ],
      },
    ],
  },
];
