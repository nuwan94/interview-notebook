import { useVoices } from '../lib/reader.jsx';
import { LuPause, LuPlay, LuSkipBack, LuSkipForward, LuSquare } from 'react-icons/lu';
import { usePrefs } from '../lib/prefs.jsx';

const RATES = [0.75, 1, 1.25, 1.5, 2];

/** Floating read-aloud controls. Appears once the reader is started. */
export function ReaderBar({ reader }) {
  const { prefs, set } = usePrefs();
  const voices = useVoices();
  if (!reader.supported || reader.status === 'idle') return null;
  const playing = reader.status === 'playing';
  return (
    <div
      role="region"
      aria-label="Read aloud controls"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[min(52rem,calc(100vw-1rem))] bg-ink text-white rounded-xl shadow-2xl px-3 py-2 flex flex-wrap items-center gap-2"
    >
      <button type="button" className="btn !bg-white" onClick={reader.prev} aria-label="Previous paragraph">
        <LuSkipBack aria-hidden="true" />
      </button>
      <button type="button" className="btn !bg-hi !border-hi !text-ink" onClick={playing ? reader.pause : reader.resume} aria-label={playing ? 'Pause reading' : 'Resume reading'}>
        {playing ? <><LuPause aria-hidden="true" className="btn-icon" /> Pause</> : <><LuPlay aria-hidden="true" className="btn-icon" /> Resume</>}
      </button>
      <button type="button" className="btn !bg-white" onClick={reader.next} aria-label="Next paragraph">
        <LuSkipForward aria-hidden="true" />
      </button>
      <button type="button" className="btn !bg-white" onClick={reader.stop}>
        <LuSquare aria-hidden="true" className="btn-icon" /> Stop
      </button>
      <span className="text-xs text-slate-300 tabular-nums" aria-live="off">
        {reader.block + 1} / {reader.total}
      </span>
      <label className="text-xs flex items-center gap-1 ml-auto">
        Speed
        <select className="bg-white text-ink rounded px-1 py-0.5" value={prefs.rate} onChange={(e) => set({ rate: Number(e.target.value) })}>
          {RATES.map((r) => (
            <option key={r} value={r}>
              {r}×
            </option>
          ))}
        </select>
      </label>
      {voices.length > 0 && (
        <label className="text-xs flex items-center gap-1 min-w-0">
          Voice
          <select
            className="bg-white text-ink rounded px-1 py-0.5 max-w-[11rem]"
            value={prefs.voiceURI}
            onChange={(e) => set({ voiceURI: e.target.value })}
          >
            <option value="">Auto</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="text-xs flex items-center gap-1">
        <input type="checkbox" checked={prefs.follow} onChange={(e) => set({ follow: e.target.checked })} />
        Follow along
      </label>
    </div>
  );
}
