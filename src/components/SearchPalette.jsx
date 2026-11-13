import { useEffect, useMemo, useRef, useState } from 'react';
import { LuSearch } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import { search } from '../lib/search.js';

const TYPE_LABEL = { lesson: 'Lesson', section: 'Section', question: 'Question', term: 'Term' };

export function SearchPalette({ open, onClose }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef(null);
  const nav = useNavigate();
  const results = useMemo(() => search(q), [q]);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);
  useEffect(() => setSel(0), [q]);

  if (!open) return null;
  const go = (r) => {
    onClose();
    nav(r.url);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && results[sel]) go(results[sel]);
  };

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
              aria-activedescendant={results[sel] ? `sr-${sel}` : undefined}
              placeholder="Search lessons, interview questions, terms…"
              className="palette-input flex-1 min-w-0 py-2.5 bg-transparent text-lg"
            />
            <span className="kbd">Esc</span>
          </div>
        </div>
        <ul id="search-results" role="listbox" className="max-h-[60vh] overflow-y-auto list-none m-0 p-1">
          {q && !results.length && <li className="px-4 py-6 text-soft">Nothing found for “{q}”.</li>}
          {!q && <li className="px-4 py-6 text-soft">Try “treeify”, “load factor”, “thread safe”, “equals”…</li>}
          {results.map((r, i) => (
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
                <span className="font-bold">{r.title}</span>
                <span className="text-xs text-soft ml-auto whitespace-nowrap">{r.lessonTitle}</span>
              </div>
              {r.type !== 'lesson' && <div className="text-sm text-soft line-clamp-2 mt-0.5">{r.excerpt}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
