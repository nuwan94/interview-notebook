// Frame data for the garbage-collector walk-through demo.
// young: drawn by GcHeapStage (eden, survivor spaces and the old generation as slots).
// reach: drawn by GcReachStage (roots, objects and references).
// Cell states: new (just created), live, marked (found reachable by the collector), dead (unreachable).

import { GcHeapStage } from './GcHeapStage.jsx';
import { GcReachStage } from './GcReachStage.jsx';

const c = (id, state = 'live', age) => ({ id, state, age });
const RUN = { text: 'Program running', tone: 'ok' };
const PAUSE = { text: 'Stop-the-world pause: young collection', tone: 'bad' };

export const GC_SCENES = [
  {
    id: 'young',
    label: 'Young collection',
    title: 'A young collection copies the survivors and leaves the garbage behind',
    stage: GcHeapStage,
    frames: [
      {
        phase: RUN,
        note: 'The program creates objects. Each new object goes into eden, the next free slot. This is very fast, because the JVM just moves a pointer forward. There are six objects so far, A to F.',
        regions: { eden: [c('A', 'new'), c('B', 'new'), c('C', 'new'), c('D', 'new'), c('E', 'new'), c('F', 'new')] },
      },
      {
        phase: RUN,
        note: 'The program keeps running. Nothing refers to B, D and F any more, so they are garbage. But nothing has freed them yet.',
        regions: { eden: [c('A'), c('B', 'dead'), c('C'), c('D', 'dead'), c('E'), c('F', 'dead')] },
      },
      {
        phase: PAUSE,
        note: 'G and H fill eden, so a young collection starts. The program stops for a short pause. The collector marks every object it can reach from the GC roots: A, C, E and G.',
        regions: { eden: [c('A', 'marked'), c('B', 'dead'), c('C', 'marked'), c('D', 'dead'), c('E', 'marked'), c('F', 'dead'), c('G', 'marked'), c('H', 'dead')] },
      },
      {
        phase: PAUSE,
        note: 'The marked objects are copied into Survivor 0 with age 1, and eden is emptied in one step. The collector never touches the dead objects. So the cost depends on how much is alive, not on how much garbage there was.',
        regions: { eden: [], s0: [c('A', 'live', 1), c('C', 'live', 1), c('E', 'live', 1), c('G', 'live', 1)] },
        moves: [{ from: 'eden', to: 's0', label: 'copy live objects' }],
      },
      {
        phase: RUN,
        note: 'The program runs again and creates I to L. Meanwhile C and L lose their last references, so they are garbage now.',
        regions: { eden: [c('I', 'new'), c('J', 'new'), c('K', 'new'), c('L', 'dead')], s0: [c('A', 'live', 1), c('C', 'dead', 1), c('E', 'live', 1), c('G', 'live', 1)] },
      },
      {
        phase: PAUSE,
        note: 'The second young collection copies the live objects from eden and from Survivor 0 into Survivor 1, and their age goes up by one. The two survivor spaces swap roles every time. C and L are simply left behind.',
        regions: { s1: [c('A', 'live', 2), c('E', 'live', 2), c('G', 'live', 2), c('I', 'live', 1), c('J', 'live', 1), c('K', 'live', 1)] },
        moves: [
          { from: 'eden', to: 's1', label: 'copy live objects' },
          { from: 's0', to: 's1', label: '' },
        ],
      },
      {
        phase: PAUSE,
        note: 'At a later collection, objects whose age reaches the tenuring threshold are promoted to the old generation. The threshold is 2 in this demo. The JVM picks it as it runs, up to 15. The younger objects I, J and K are copied back to Survivor 0.',
        regions: { s0: [c('I', 'live', 2), c('J', 'live', 2), c('K', 'live', 2)], old: [c('A'), c('E'), c('G')] },
        moves: [
          { from: 's1', to: 'old', label: 'promote: age 2' },
          { from: 's1', to: 's0', label: 'copy' },
        ],
      },
      {
        phase: RUN,
        note: 'The old generation fills slowly, and garbage builds up there too (M and N). When it gets full, the collector runs a more expensive collection of it: a mixed or a full collection, depending on the collector. The main goal of generations is to keep short-lived objects out of the old generation.',
        regions: { old: [c('A'), c('E'), c('G'), c('I'), c('J'), c('K'), c('M', 'dead'), c('N', 'dead')] },
      },
    ],
  },
  {
    id: 'reach',
    label: 'Reachability',
    title: 'Garbage is whatever no GC root can reach',
    stage: GcReachStage,
    frames: (() => {
      const order = { id: 'order', name: 'order', kind: 'local variable (stack)', row: 0, to: 'A' };
      const cache = { id: 'cache', name: 'CACHE', kind: 'static field', row: 1, to: 'D' };
      const cell = (id, refs, state) => ({ id, refs, state });
      return [
        {
          phase: RUN,
          note: 'There are two GC roots. The local variable order, on a thread\'s stack, points to A. The static field CACHE points to D. The objects point to each other: A to B to C, and D to E. X and Y point only to each other.',
          roots: [order, cache],
          cells: [cell('A', ['B']), cell('B', ['C']), cell('C', []), cell('D', ['E']), cell('E', []), cell('X', ['Y']), cell('Y', ['X'])],
        },
        {
          phase: { text: 'Mark: follow every reference from the roots', tone: 'new' },
          note: 'The mark phase. Starting from each root, the collector follows the references and marks everything it reaches: A, B and C from order, and D and E from CACHE.',
          roots: [order, cache],
          cells: [cell('A', ['B'], 'marked'), cell('B', ['C'], 'marked'), cell('C', [], 'marked'), cell('D', ['E'], 'marked'), cell('E', [], 'marked'), cell('X', ['Y']), cell('Y', ['X'])],
        },
        {
          phase: { text: 'Mark finished: X and Y were never reached', tone: 'warn' },
          note: 'X and Y were never reached. They point to each other, but that does not keep them alive. Java collectors use reachability, not reference counting, so a cycle with no root is garbage.',
          roots: [order, cache],
          cells: [cell('A', ['B'], 'marked'), cell('B', ['C'], 'marked'), cell('C', [], 'marked'), cell('D', ['E'], 'marked'), cell('E', [], 'marked'), cell('X', ['Y'], 'dead'), cell('Y', ['X'], 'dead')],
        },
        {
          phase: { text: 'Reclaim: free the unmarked objects', tone: 'ok' },
          note: 'The collector frees the memory of X and Y, by sweeping it or by copying the live objects away. The marks on the survivors are cleared, ready for the next cycle.',
          roots: [order, cache],
          cells: [cell('A', ['B']), cell('B', ['C']), cell('C', []), cell('D', ['E']), cell('E', [])],
        },
        {
          phase: RUN,
          note: 'The method returns, so its stack frame is popped and the root order disappears. Now no root reaches A, B and C, even though they still point to each other. They are garbage.',
          roots: [cache],
          cells: [cell('A', ['B'], 'dead'), cell('B', ['C'], 'dead'), cell('C', [], 'dead'), cell('D', ['E']), cell('E', [])],
        },
        {
          phase: { text: 'Next collection', tone: 'new' },
          note: 'The next collection frees A, B and C. D and E stay for as long as the static CACHE holds them. This is how a "memory leak" happens in a language with a garbage collector.',
          roots: [cache],
          cells: [cell('D', ['E'], 'marked'), cell('E', [], 'marked')],
        },
      ];
    })(),
  },
];
