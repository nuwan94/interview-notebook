import { useEffect, useMemo, useRef, useState } from 'react';
import { LEVELS } from '../lib/content.js';
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
export function QuestionList({ slug, questions, focusId, onToast }) {
  const [level, setLevel] = useState('all');
  const [text, setText] = useState('');
  const box = useRef(null);
  const reader = useReaderCtx();

  const counts = useMemo(() => Object.fromEntries(LEVELS.map((l) => [l, questions.filter((q) => q.level === l).length])), [questions]);
  const shown = useMemo(() => {
    const t = text.trim().toLowerCase();
    return questions.filter((q) => (level === 'all' || q.level === level) && (!t || `${q.title} ${q.md}`.toLowerCase().includes(t)));
  }, [questions, level, text]);

  // deep link: make sure the target question is visible, open it, scroll to it
  useEffect(() => {
    if (!focusId || !focusId.startsWith('q-')) return;
    if (!shown.some((q) => q.id === focusId)) {
      setLevel('all');
      setText('');
      return;
    }
    const el = document.getElementById(focusId);
    if (!el) return;
    el.open = true;
    el.scrollIntoView({ block: 'start' });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }, [focusId, shown]);

  const setAll = (open) => box.current?.querySelectorAll('details.q-item').forEach((d) => (d.open = open));

  return (
    <div id="question-list">
      <div className="bg-white border border-slate-300 rounded-md p-3 mb-4 sticky top-0 md:top-[4.25rem] z-10 shadow-sm" data-noread>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="q-filter">
            Filter questions
          </label>
          <input
            id="q-filter"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
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
          <span className="text-xs text-soft ml-auto" aria-live="polite">
            showing {shown.length}
          </span>
        </div>
      </div>

      <div ref={box}>
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
                🔗
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
