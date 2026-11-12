import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const SCALES = [87.5, 100, 112.5, 125, 150, 175];
const KEY = 'interview-notebook:prefs:v1';
const DEFAULTS = { scaleIdx: 1, tooltips: true, follow: true, voiceURI: '', rate: 1 };

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

const Ctx = createContext(null);

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(load);
  useEffect(() => {
    document.documentElement.style.fontSize = `${SCALES[prefs.scaleIdx] ?? 100}%`;
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable (private mode): preferences just won't persist */
    }
  }, [prefs]);
  const set = useCallback((patch) => setPrefs((p) => ({ ...p, ...patch })), []);
  // delta: +1 / -1 steps through SCALES; 0 resets to 100%
  const zoom = useCallback(
    (delta) =>
      setPrefs((p) => ({
        ...p,
        scaleIdx: delta === 0 ? DEFAULTS.scaleIdx : Math.min(SCALES.length - 1, Math.max(0, p.scaleIdx + delta)),
      })),
    [],
  );
  const value = useMemo(() => ({ prefs, set, zoom }), [prefs, set, zoom]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePrefs = () => useContext(Ctx);

export function useReducedMotion() {
  const [r, setR] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const h = () => setR(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return r;
}
