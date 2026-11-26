// Small shared preferences for the animated demos (kept in localStorage, shared by every demo on the page).
import { useSyncExternalStore } from 'react';

const KEY = 'demo-prefs';
const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
};
let state = read();
const subs = new Set();

// focus: highlight what changed in a step. compact: show the note as one line until it is clicked.
const DEFAULTS = {
  focus: () => true,
  compact: () => typeof window !== 'undefined' && window.innerHeight < 640,
};

export function setDemoPref(key, value) {
  state = { ...state, [key]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage can be blocked */
  }
  subs.forEach((f) => f());
}

export function useDemoPref(key) {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => (key in state ? state[key] : DEFAULTS[key]()),
    () => DEFAULTS[key](),
  );
}
