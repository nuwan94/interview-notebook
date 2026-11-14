import { useLayoutEffect, useRef, useState } from 'react';
import { DemoControls, DemoHeader } from './DemoShell.jsx';
import { Link } from 'react-router-dom';
import { useReducedMotion } from '../../lib/prefs.jsx';
import { Glossed } from '../Term.jsx';
import { usePlayer, useOnceVisible } from './usePlayer.js';
import { RELEASES, TAGS } from './javaReleases.js';

const SLUG = 'java-version-history';

/** Replayable time-lapse of Java releases. Filter by theme to see only the releases that touched it. */
export function JavaTimeline() {
  const reduced = useReducedMotion();
  const rootRef = useRef(null);
  const [tag, setTag] = useState('all');
  const p = usePlayer(RELEASES, { speed: 1 });
  const cur = RELEASES[p.index];
  const hit = (r) => tag === 'all' || r.tags.includes(tag);

  // keep the ruled lines of the page registered with the text after the figure
  useLayoutEffect(() => {
    const el = rootRef.current;
    const fit = () => {
      const lh = parseFloat(getComputedStyle(document.documentElement).fontSize) * 2;
      el.style.marginBottom = '0px';
      const h = el.getBoundingClientRect().height;
      el.style.marginBottom = `${lh + Math.ceil(h / lh) * lh - h}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useOnceVisible(rootRef, () => p.play(), !reduced);

  return (
    <figure ref={rootRef} className="demo" data-noread aria-label="Java releases timeline">
      <DemoHeader title="Java releases, 1996 to today" />

      <div role="group" aria-label="Highlight releases by theme" className="flex flex-wrap gap-1.5 mb-3">
        <button type="button" className="chip" aria-pressed={tag === 'all'} onClick={() => setTag('all')}>
          Everything
        </button>
        {TAGS.map((t) => (
          <button key={t.id} type="button" className="chip" aria-pressed={tag === t.id} onClick={() => setTag(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <ol className="jt-grid" aria-label="Releases">
        {RELEASES.map((r, i) => (
          <li key={r.v}>
            <button
              type="button"
              className="jt-tile"
              data-state={i === p.index ? 'current' : i < p.index ? 'past' : 'future'}
              data-lts={r.lts ? 'yes' : undefined}
              data-dim={hit(r) ? undefined : 'yes'}
              aria-current={i === p.index}
              onClick={() => p.seek(i)}
              title={`Java ${r.v} · ${r.date}`}
            >
              <b>{r.v}</b>
              <small>{r.date.split(' ')[1]}</small>
              {r.lts && <span className="jt-lts">LTS</span>}
            </button>
          </li>
        ))}
      </ol>
      <p className="text-xs text-soft mt-1 mb-3">
        Until Java 8 releases arrived every few years. Since Java 10 a new version ships every March and September; a long-term-support (LTS)
        release comes every two years.
      </p>

      <div className="rounded-md border border-pen/30 bg-pen-soft/60 px-3 py-2 min-h-[7.5rem]" role="status" aria-live="polite">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-hand font-bold text-xl text-pen">Java {cur.v}</span>
          <span className="text-sm text-soft">{cur.date}</span>
          {cur.lts && <span className="badge level-coding">LTS</span>}
        </div>
        <p className="m-0 mt-1 text-[0.95rem] leading-snug">
          <Glossed text={cur.headline} />
        </p>
        <ul className="m-0 mt-1 pl-5 text-sm text-soft list-disc">
          {cur.bullets.map((b) => (
            <li key={b}>
              <Glossed text={b} />
            </li>
          ))}
        </ul>
        <Link to={`/lessons/${SLUG}/${cur.anchor}`} className="inline-block mt-2 text-sm font-bold text-pen underline">
          Details for Java {cur.v} →
        </Link>
      </div>
      <DemoControls p={p} unit="release" speeds />
    </figure>
  );
}
