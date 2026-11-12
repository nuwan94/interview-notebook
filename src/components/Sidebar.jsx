import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { LEVELS, lessons } from '../lib/content.js';

/** Index tabs: all lessons, plus "on this page" navigation (sections and questions) for the open lesson. */
export function Sidebar({ lesson, onNavigate }) {
  const [active, setActive] = useState('');

  useEffect(() => {
    if (!lesson) return;
    const els = [...document.querySelectorAll('[data-spy]')];
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: '-90px 0px -65% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [lesson]);

  const link = 'block rounded px-2 py-1 text-[0.95rem] hover:bg-white/70';
  return (
    <nav aria-label="Notebook navigation" className="text-sm">
      <p className="font-hand font-bold text-lg text-pen m-0 mb-1">Lessons</p>
      <ul className="list-none m-0 p-0 mb-4">
        {lessons.map((l) => (
          <li key={l.slug}>
            <NavLink
              to={`/lessons/${l.slug}`}
              onClick={onNavigate}
              end
              className={({ isActive }) => `${link} font-bold ${isActive || lesson?.slug === l.slug ? 'bg-white text-pen shadow-sm' : ''}`}
            >
              {l.title}
            </NavLink>
          </li>
        ))}
        <li>
          <NavLink to="/glossary" onClick={onNavigate} className={({ isActive }) => `${link} ${isActive ? 'bg-white text-pen font-bold shadow-sm' : ''}`}>
            Glossary
          </NavLink>
        </li>
      </ul>

      {lesson && (
        <>
          <p className="font-hand font-bold text-lg text-pen m-0 mb-1">On this page</p>
          <ul className="list-none m-0 p-0 border-l-2 border-slate-300">
            {lesson.sections.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/lessons/${lesson.slug}/${s.id}`}
                  onClick={onNavigate}
                  aria-current={active === s.id ? 'location' : undefined}
                  className={`${link} -ml-0.5 border-l-2 ${active === s.id ? 'border-pen font-bold text-pen' : 'border-transparent'}`}
                >
                  {s.title}
                </Link>
                {lesson.subnav && s.subs?.length > 0 && !s.isQuestions && (
                  <ul className="list-none m-0 pl-3 mb-1">
                    {s.subs.map((sub) => (
                      <li key={sub.id}>
                        <Link
                          to={`/lessons/${lesson.slug}/${sub.id}`}
                          onClick={onNavigate}
                          className="block px-2 py-0.5 text-[0.85rem] leading-snug hover:bg-white/70 rounded"
                        >
                          {sub.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {s.isQuestions && (
                  <ul className="list-none m-0 pl-3">
                    {LEVELS.map((lv) => {
                      const qs = lesson.questions.filter((q) => q.level === lv);
                      if (!qs.length) return null;
                      return (
                        <li key={lv}>
                          <details>
                            <summary className={`cursor-pointer py-0.5 px-2 level-${lv}`}>
                              <span className="badge">{lv}</span> <span className="text-soft">{qs.length}</span>
                            </summary>
                            <ul className="list-none m-0 pl-1">
                              {qs.map((q) => (
                                <li key={q.id}>
                                  <Link to={`/lessons/${lesson.slug}/${q.id}`} onClick={onNavigate} className="block px-2 py-0.5 text-[0.85rem] leading-snug hover:bg-white/70 rounded">
                                    {q.title}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </nav>
  );
}
