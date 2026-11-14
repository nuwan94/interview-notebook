import { useEffect, useMemo, useRef, useState } from 'react';
import { LuLink } from 'react-icons/lu';
import { LEVELS, plainText } from '../lib/content.js';
import { copyText, lessonUrl } from '../lib/share.js';
import { Md } from './Md.jsx';
import { useReaderCtx } from '../lib/reader.jsx';

const LEVEL_HELP = {
  basic: 'Screening-round questions',
  intermediate: 'Typical technical-round depth',
  deep: 'Senior / "why" questions',
  coding: 'Write it on the whiteboard',
};

/** Filterable, searchable interview Q&A. Answers are native <details>, so find-in-page and keyboard work. */
export function QuestionList({ slug, questions, focusId, navKey, onToast }) {
  const [level, setLevel] = useState('all');
  const [text, setText] = useState('');
  const box = useRef(null);
  const bar = useRef(null);
  const reader = useReaderCtx();

  const counts = useMemo(() => Object.fromEntries(LEVELS.map((l) => [l, questions.filter((q) => q.level === l).length])), [questions]);
  // searchable text per question (title + answer without markdown markup), lower-cased once
  const haystacks = useMemo(() => new Map(questions.map((q) => [q.id, `${q.title} ${plainText(q.md)}`.toLowerCase()])), [questions]);
  const shown = useMemo(() => {
    const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
    // every word must appear somewhere (any order), so "factor load" finds the load factor questions too
    return questions.filter((q) => (level === 'all' || q.level === level) && tokens.every((t) => haystacks.get(q.id).includes(t)));
  }, [questions, haystacks, level, text]);
  const filtered = level !== 'all' || text.trim() !== '';

  // Deep link / sidebar / search click: reveal the question once, open it, scroll to it.
  // `pending` makes this run once per navigation, so later typing or filtering never re-triggers it.
  const pending = useRef(null);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  useEffect(() => {
    if (!focusId?.startsWith('q-') || !questions.some((q) => q.id === focusId)) return;
    pending.current = focusId;
    if (!shownRef.current.some((q) => q.id === focusId)) {
      setLevel('all'); // the target is hidden by the current filter: clear it
      setText('');
    }
  }, [focusId, navKey, questions]);
  useEffect(() => {
    if (!pending.current) return;
    const el = document.getElementById(pending.current);
    if (!el) return;
    pending.current = null;
    el.open = true;
    el.scrollIntoView({ block: 'start' });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }, [shown, focusId, navKey]);

  // Expand/collapse every answer without losing the reader's place: remember which question sits just under
  // the sticky filter bar, and after the layout changes scroll so that same question is at the same height.
  const setAll = (open) => {
    const items = [...(box.current?.querySelectorAll('details.q-item') ?? [])];
    if (!items.length) return;
    const barBottom = bar.current?.getBoundingClientRect().bottom ?? 0;
    const rects = items.map((d) => d.getBoundingClientRect());
    // the list is still below the screen: nothing above it changes, so there is nothing to compensate
    const anchorIndex = rects[0].top > window.innerHeight ? -1 : rects.findIndex((r) => r.bottom > barBottom);
    const anchor = anchorIndex >= 0 ? items[anchorIndex] : null;
    const before = anchor ? rects[anchorIndex].top : 0;
    items.forEach((d) => (d.open = open));
    if (anchor) window.scrollBy({ top: anchor.getBoundingClientRect().top - before, behavior: 'instant' });
  };

  return (
    <div id="question-list">
      <div ref={bar} className="bg-white border border-slate-300 rounded-md p-3 mb-4 sticky top-0 md:top-[4.25rem] z-10 shadow-sm" data-noread>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="q-filter">
            Filter questions
          </label>
          <input
            id="q-filter"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setText('')}
            placeholder={`Filter ${questions.length} questions…`}
            className="flex-1 min-w-[12rem] border border-slate-300 rounded px-2 py-1.5 bg-white"
          />
          <button type="button" className="btn" onClick={() => setAll(true)}>
            Expand all
          </button>
          <button type="button" className="btn" onClick={() => setAll(false)}>
            Collapse all
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-2" role="group" aria-label="Filter by level">
          <button type="button" className="chip" aria-pressed={level === 'all'} onClick={() => setLevel('all')}>
            All {questions.length}
          </button>
          {LEVELS.filter((l) => counts[l]).map((l) => (
            <button key={l} type="button" className="chip" aria-pressed={level === l} onClick={() => setLevel(l)} title={LEVEL_HELP[l]}>
              {l} {counts[l]}
            </button>
          ))}
          <span className="text-xs text-soft ml-auto flex items-center gap-2" aria-live="polite">
            showing {shown.length} of {questions.length}
            {filtered && (
              <button
                type="button"
                className="underline text-pen font-bold"
                onClick={() => {
                  setLevel('all');
                  setText('');
                }}
              >
                clear
              </button>
            )}
          </span>
        </div>
      </div>

      <div ref={box} style={{ overflowAnchor: 'none' }}>
        {shown.map((q) => (
          <details key={q.id} id={q.id} className={`q-item level-${q.level}`}>
            <summary>
              <span className="badge" data-noread>
                {q.level}
              </span>
              <span className="flex-1">{q.title}</span>
              <button
                type="button"
                data-noread
                className="text-xs font-bold text-soft hover:text-pen px-1"
                aria-label={`Copy link to: ${q.title}`}
                title="Copy link to this question"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToast((await copyText(lessonUrl(slug, q.id))) ? 'Link to question copied' : 'Could not copy — copy the address bar instead');
                }}
              >
                <LuLink aria-hidden="true" />
              </button>
            </summary>
            <div className="answer prose-nb">
              <Md>{q.md}</Md>
              {reader?.supported && (
                <button
                  type="button"
                  data-noread
                  className="btn mt-3"
                  onClick={(e) => reader.playFrom(e.currentTarget.closest('details').querySelector('summary'))}
                >
                  ▶ Read this question aloud
                </button>
              )}
            </div>
          </details>
        ))}
        {!shown.length && <p className="text-soft">No question matches. Clear the filter to see all {questions.length}.</p>}
      </div>
    </div>
  );
}
