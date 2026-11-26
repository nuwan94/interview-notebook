import { useCallback, useEffect, useRef, useState } from 'react';
import { LuGithub, LuMenu, LuSearch } from 'react-icons/lu';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { fitDemos } from '../lib/fitDemos.js';
import { usePrefs } from '../lib/prefs.jsx';
import { AccessMenu } from './AccessMenu.jsx';
import { getLesson } from '../lib/content.js';
import { getLab } from '../labs/index.js';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { SearchPalette } from './SearchPalette.jsx';
import { TipHost } from './Tip.jsx';
import { Sidebar } from './Sidebar.jsx';

export function Layout() {
  useEffect(() => fitDemos(), []); // scale tall demos so each fits on one screen
  const { zoom } = usePrefs();
  const loc = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');

  const slug = /^\/lessons\/([^/]+)/.exec(loc.pathname)?.[1];
  const lesson = slug ? getLesson(slug) : undefined;
  const labSlug = /^\/lab\/([^/]+)/.exec(loc.pathname)?.[1];
  const lab = labSlug ? getLab(labSlug) : undefined;

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
        return;
      }
      // + / - / 0 change the text size (plain keys only, so the browser's own Ctrl +/- zoom keeps working)
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '+' || e.key === '=') zoom(1);
      else if (e.key === '-' || e.key === '_') zoom(-1);
      else if (e.key === '0') zoom(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  // plain page navigations (not in-lesson anchors) start at the top
  // (inside a lab, moving between steps keeps the scroll, but opening another lab starts at the top)
  const lastLab = useRef(null);
  useEffect(() => {
    const lab = loc.pathname.match(/^\/lab\/([^/]+)/)?.[1] ?? null;
    const sameLab = lab !== null && lab === lastLab.current;
    lastLab.current = lab;
    if (sameLab) return;
    if (lab || !/^\/lessons\/[^/]+\/./.test(loc.pathname)) window.scrollTo({ top: 0, behavior: lab ? 'instant' : 'auto' });
  }, [loc.pathname]);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 bg-desk/95 backdrop-blur border-b border-slate-300">
        <div className="mx-auto flex items-center gap-2 px-3 py-2">
          {/* narrow screens: the title is the menu button (the sidebar has a Home link); wide screens: the title is the home link */}
          <button
            type="button"
            className="btn lg:!hidden !px-2.5 mr-2 font-hand font-bold text-xl text-pen flex items-center gap-2"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="sidebar"
            aria-label="Interview Notebook: open the contents menu"
          >
            <LuMenu aria-hidden="true" size="1.2em" />
            <img src="./favicon.svg" alt="" width="24" height="24" />
            <span className="hidden sm:inline">Interview Notebook</span>
          </button>
          <Link to="/" className="hidden lg:flex font-hand font-bold text-xl text-pen no-underline mr-2 items-center gap-2">
            <img src="./favicon.svg" alt="" width="24" height="24" />
            Interview Notebook
          </Link>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex-1 min-w-0 text-left bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-soft hover:border-pen flex items-center gap-2"
            aria-label="Search notes (shortcut: slash or Control K)"
          >
            <LuSearch aria-hidden="true" />
            <span className="flex-1 truncate">Search notes, questions, terms…</span>
            <span className="kbd hidden sm:inline">/</span>
          </button>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/nuwan94/interview-notebook"
              target="_blank"
              rel="noopener noreferrer"
              className="btn !min-h-10 !px-2.5 no-underline"
              aria-label="Source code on GitHub (opens in a new tab)"
              data-tip="Source code on GitHub"
            >
              <LuGithub aria-hidden="true" size="1.25em" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <AccessMenu />
          </div>
        </div>
      </header>

      <div className={`mx-auto px-3 ${labSlug ? 'py-2.5' : 'py-5'} lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6`}>
        <aside
          id="sidebar"
          className={`${menuOpen ? 'block' : 'hidden'} lg:block mb-4 lg:mb-0 lg:sticky lg:top-[4.6rem] lg:self-start lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto rounded-lg border border-slate-300 bg-sidebar p-3 shadow-sm`}
        >
          <Sidebar lesson={lesson} lab={lab} onNavigate={() => setMenuOpen(false)} />
        </aside>
        {/* a lab page uses the full width so its scene and step panel sit side by side */}
        <main id="main" className="min-w-0 w-full">
          <ErrorBoundary resetKey={loc.pathname}>
            <Outlet context={{ toast: showToast }} />
          </ErrorBoundary>
        </main>
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <TipHost />
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
