import { Walk } from './DesignWalk.jsx';
import { SCENES } from './memoryScenes.js';

/** Replayable walk through stack frames, heap objects and the string pool, one line of code at a time (drawn by MemoryStage). */
export function MemoryWalk() {
  return <Walk scenes={SCENES} ariaLabel="Stack, heap and string pool walk-through" />;
}
