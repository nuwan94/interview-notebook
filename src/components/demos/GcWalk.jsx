import { Walk } from './DesignWalk.jsx';
import { GC_SCENES } from './gcScenes.js';

/** Replayable walk through a young collection (GcHeapStage) and reachability from the GC roots (GcReachStage). */
export function GcWalk() {
  return <Walk scenes={GC_SCENES} ariaLabel="Garbage collection walk-through" />;
}
