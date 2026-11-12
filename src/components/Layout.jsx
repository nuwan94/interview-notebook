import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { SCALES, usePrefs } from '../lib/prefs.jsx';
import { getLesson } from '../lib/content.js';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { SearchPalette } from './SearchPalette.jsx';
import { Sidebar } from './Sidebar.jsx';

export function Layout() {
  const { prefs, set } = usePrefs();
  const loc = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');

  const slug = /^\/lessons\/([^/]+)/.exec(loc.pathname)?.[1];
  const lesson = slug ? getLesson(slug) : undefined;

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // plain page navigations (not in-lesson anchors) start at the top
  useEffect(() => {
    if (!/^\/lessons\/[^/]+\/./.test(loc.pathname)) window.scrollTo({ top: 0, behavior: 'auto' });
  }, [loc.pathname]);

  const scaleBtn = 'btn !min-h-9 !px-2.5';
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="md:sticky top-0 z-30 bg-desk/95 backdrop-blur border-b border-slate-300">
        <div className="max-w-[88rem] mx-auto flex flex-wrap items-center gap-2 px-3 py-2">
          <button type="button" className="btn lg:hidden" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-controls="sidebar">
            ☰ Contents
          </button>
          <Link to="/" className="font-hand font-bold text-xl text-pen no-underline mr-2 flex items-center gap-2">
            <img src="./favicon.svg" alt="" width="24" height="24" />
            Interview Notebook
          </Link>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex-1 min-w-[10rem] max-w-md text-left bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-soft hover:border-pen flex items-center gap-2"
            aria-label="Search notes (shortcut: slash or Control K)"
          >
            <span aria-hidden="true">🔎</span>
            <span className="flex-1 truncate">Search notes, questions, terms…</span>
            <span className="kbd hidden sm:inline">/</span>
          </button>
          <div className="flex items-center gap-1.5 ml-auto" role="group" aria-label="Reading settings">
            <button
              type="button"
              className={scaleBtn}
              onClick={() => set({ scaleIdx: Math.max(0, prefs.scaleIdx - 1) })}
              disabled={prefs.scaleIdx === 0}
              aria-label="Smaller text"
            >
              <span className="text-sm">A−</span>
            </button>
            <span className="text-xs font-bold text-soft w-10 text-center tabular-nums" aria-live="polite">
              {SCALES[prefs.scaleIdx]}%
            </span>
            <button
              type="button"
              className={scaleBtn}
              onClick={() => set({ scaleIdx: Math.min(SCALES.length - 1, prefs.scaleIdx + 1) })}
              disabled={prefs.scaleIdx === SCALES.length - 1}
              aria-label="Larger text"
            >
              <span className="text-lg leading-none">A+</span>
            </button>
            <button
              type="button"
              className={scaleBtn}
              aria-pressed={prefs.tooltips}
              onClick={() => set({ tooltips: !prefs.tooltips })}
              title="Turn the dotted-underline term explanations on or off"
            >
              Term tips: {prefs.tooltips ? 'on' : 'off'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[88rem] mx-auto px-3 py-5 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6">
        <aside
          id="sidebar"
          className={`${menuOpen ? 'block' : 'hidden'} lg:block mb-4 lg:mb-0 lg:sticky lg:top-[4.6rem] lg:self-start lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto pr-1`}
        >
          <Sidebar lesson={lesson} onNavigate={() => setMenuOpen(false)} />
        </aside>
        <main id="main" className="min-w-0 max-w-[56rem] w-full mx-auto lg:mx-0">
          <ErrorBoundary resetKey={loc.pathname}>
            <Outlet context={{ toast: showToast }} />
          </ErrorBoundary>
        </main>
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <div
        role="status"
        aria-live="polite"
        className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-ink text-white px-4 py-2 rounded-lg shadow-lg transition-opacity ${toast ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {toast}
      </div>
    </>
  );
}
