import { useEffect, useMemo, useRef, useState } from 'react';
import { LuSearch } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import { GROUPS, loadQuizIndex, search } from '../lib/search.js';

const TYPE_LABEL = { lesson: 'Lesson', lab: 'Lab', section: 'Section', question: 'Question', quiz: 'Quiz', term: 'Term' };
const PREVIEW = 5; // results per group in the "All" view

export function SearchPalette({ open, onClose }) {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [sel, setSel] = useState(0);
  const [quizReady, setQuizReady] = useState(false);
  const input = useRef(null);
  const nav = useNavigate();

  // quiz questions are fetched the first time search opens and then searched like everything else
  useEffect(() => {
    if (!open) return;
    let live = true;
    loadQuizIndex().then(() => live && setQuizReady(true));
    return () => {
      live = false;
    };
  }, [open]);

  const results = useMemo(() => search(q), [q, quizReady]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = GROUPS.map((g) => results[g.id].length);
  const total = counts.reduce((a, b) => a + b, 0);

  // what is on screen, as one flat list for the keyboard: grouped previews for "All", one full group for a tab
  const shown = useMemo(() => {
    if (tab === 'all') return GROUPS.map((g) => ({ ...g, items: results[g.id].slice(0, PREVIEW), more: Math.max(0, results[g.id].length - PREVIEW) })).filter((g) => g.items.length);
    const g = GROUPS.find((x) => x.id === tab);
    return [{ ...g, items: results[tab], more: 0 }];
  }, [results, tab]);
  const flat = shown.flatMap((g) => g.items);

  useEffect(() => {
    if (open) {
      setQ('');
      setTab('all');
      setSel(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);
  useEffect(() => setSel(0), [q, tab]);
  useEffect(() => {
    document.getElementById(`sr-${sel}`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;
  const go = (r) => {
    onClose();
    nav(r.url);
  };
  const tabs = [{ id: 'all', label: 'All', n: total }, ...GROUPS.map((g, i) => ({ id: g.id, label: g.label, n: counts[i] }))];
  const cycle = (d) => {
    const i = tabs.findIndex((t) => t.id === tab);
    setTab(tabs[(i + d + tabs.length) % tabs.length].id);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      cycle(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Enter' && flat[sel]) go(flat[sel]);
  };
  const loadingQuiz = !quizReady && (tab === 'all' || tab === 'quiz');
  let index = -1;

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-start justify-center p-3 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search notes"
        className="w-full max-w-2xl bg-paper rounded-xl shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <div className="p-3 border-b border-rule">
          <div className="palette-field flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
            <LuSearch aria-hidden="true" />
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              role="combobox"
              aria-expanded="true"
              aria-controls="search-results"
              aria-activedescendant={flat[sel] ? `sr-${sel}` : undefined}
              placeholder="Search lessons, labs, quiz questions, terms…"
              className="palette-input flex-1 min-w-0 py-2.5 bg-transparent text-lg"
            />
            <span className="kbd">Esc</span>
          </div>
          <div role="tablist" aria-label="Filter results" className="flex gap-1 mt-2 overflow-x-auto pb-0.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                tabIndex={-1}
                onClick={() => {
                  setTab(t.id);
                  input.current?.focus();
                }}
                className={`shrink-0 rounded-full border px-3 py-1 text-sm cursor-pointer ${
                  tab === t.id ? 'bg-pen text-white border-pen font-bold' : 'bg-white border-slate-300 hover:bg-pen-soft'
                }`}
              >
                {t.label}
                {q.trim() && <span className={`ml-1.5 text-xs ${tab === t.id ? 'text-white/80' : 'text-soft'}`}>{t.n >= 60 ? '60+' : t.n}</span>}
              </button>
            ))}
          </div>
        </div>
        <ul id="search-results" role="listbox" className="max-h-[60vh] overflow-y-auto list-none m-0 p-1">
          {q && !flat.length && !loadingQuiz && <li className="px-4 py-6 text-soft">Nothing found for “{q}”{tab !== 'all' ? ' in this section' : ''}.</li>}
          {!q && <li className="px-4 py-6 text-soft">Try “treeify”, “load factor”, “readiness probe”, “circuit breaker”… Press Tab to switch section.</li>}
          {shown.map((g) =>
            g.items.length ? (
              <li key={g.id} role="presentation">
                {tab === 'all' && (
                  <div className="flex items-baseline justify-between px-3 pt-2 pb-0.5">
                    <span className="font-hand font-bold text-pen">{g.label}</span>
                    {g.more > 0 && (
                      <button type="button" tabIndex={-1} className="text-xs text-pen underline cursor-pointer" onClick={() => setTab(g.id)}>
                        show all {g.more + PREVIEW >= 60 ? '60+' : g.more + PREVIEW}
                      </button>
                    )}
                  </div>
                )}
                <ul role="presentation" className="list-none m-0 p-0">
                  {g.items.map((r) => {
                    const i = ++index;
                    return (
                      <li
                        key={r.id}
                        id={`sr-${i}`}
                        role="option"
                        aria-selected={i === sel}
                        className={`px-3 py-2 rounded-lg cursor-pointer ${i === sel ? 'bg-pen-soft' : ''}`}
                        onMouseEnter={() => setSel(i)}
                        onClick={() => go(r)}
                      >
                        <div className="flex items-baseline gap-2">
                          <span className={`badge ${r.type === 'question' ? `level-${r.level}` : 'level-intermediate'}`}>
                            {r.type === 'question' ? r.level : TYPE_LABEL[r.type]}
                          </span>
                          <span className="font-bold min-w-0">{r.title}</span>
                          {r.type !== 'lesson' && <span className="text-xs text-soft ml-auto max-w-[40%] shrink-0 truncate">{r.lessonTitle}</span>}
                        </div>
                        {r.type !== 'lesson' && <div className="text-sm text-soft line-clamp-2 mt-0.5">{r.excerpt}</div>}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ) : null,
          )}
          {q && loadingQuiz && <li className="px-4 py-2 text-sm text-soft">Loading quiz questions…</li>}
        </ul>
      </div>
    </div>
  );
}
