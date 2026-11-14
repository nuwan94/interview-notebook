import { useCallback, useEffect, useRef, useState } from 'react';

const BASE_MS = 1150;

/** Frame-by-frame player: play / pause / step / seek / replay, with per-frame dwell times. */
export function usePlayer(frames, { speed: initialSpeed = 1 } = {}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);
  const last = frames.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const fr = frames[index];
    // frames with a written note stay long enough to read it; others use the short base time
    const ms = typeof fr?.note === 'string' ? Math.min(10000, Math.max(4000, 2000 + fr.note.length * 38)) : BASE_MS * (fr?.dwell ?? 1);
    const t = setTimeout(() => setIndex((i) => Math.min(i + 1, last)), ms / speed);
    return () => clearTimeout(t);
  }, [playing, index, speed, last, frames]);

  const seek = useCallback((i) => setIndex(Math.max(0, Math.min(i, last))), [last]);
  return {
    index: Math.min(index, last),
    playing,
    speed,
    setSpeed,
    last,
    play: () => {
      if (index >= last) setIndex(0);
      setPlaying(true);
    },
    pause: () => setPlaying(false),
    replay: () => {
      setIndex(0);
      setPlaying(true);
    },
    replayFrom: (i) => {
      setIndex(i);
      setPlaying(true);
    },
    step: (d) => {
      setPlaying(false);
      seek(index + d);
    },
    seek: (i) => {
      setPlaying(false);
      seek(i);
    },
  };
}

/** Calls cb once the element has stayed mostly on screen for a moment (not while merely scrolling past). */
export function useOnceVisible(ref, cb, enabled = true, dwellMs = 900) {
  const done = useRef(false);
  useEffect(() => {
    if (!enabled || !ref.current || typeof IntersectionObserver === 'undefined') return;
    let timer;
    const io = new IntersectionObserver(
      (entries) => {
        const on = entries.some((e) => e.isIntersecting);
        clearTimeout(timer);
        if (on && !done.current) {
          timer = setTimeout(() => {
            done.current = true;
            cb();
            io.disconnect();
          }, dwellMs);
        }
      },
      { threshold: 0.5 },
    );
    io.observe(ref.current);
    return () => {
      clearTimeout(timer);
      io.disconnect();
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
