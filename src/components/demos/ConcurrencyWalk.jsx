import { Walk } from './DesignWalk.jsx';
import { CONCURRENCY_SCENES } from './concurrencyScenes.js';

/**
 * Replayable thread scenes: a lost update, the same code with a lock, a deadlock, and a thread pool.
 * Each scene draws its own picture (see concurrencyScenes.js); the shared player handles scenes and controls.
 */
export function ConcurrencyWalk() {
  return <Walk scenes={CONCURRENCY_SCENES} ariaLabel="Concurrency walk-through" />;
}
