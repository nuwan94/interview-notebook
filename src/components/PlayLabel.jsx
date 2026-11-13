import { LuPause, LuPlay, LuRotateCcw } from 'react-icons/lu';

/** Label of the play button of an animation player: pause while playing, replay at the end, otherwise play. */
export function PlayLabel({ p }) {
  const Icon = p.playing ? LuPause : p.index >= p.last ? LuRotateCcw : LuPlay;
  return (
    <>
      <Icon aria-hidden="true" className="btn-icon" /> {p.playing ? 'Pause' : p.index >= p.last ? 'Play again' : 'Play'}
    </>
  );
}
