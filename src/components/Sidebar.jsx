import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { LEVELS, topicContains, topicLessonCount, topicTree } from '../lib/content.js';

const findTopic = (node, path) => {
  for (const c of node.children) {
    if (c.path === path) return c;
    const hit = findTopic(c, path);
    if (hit) return hit;
  }
  return null;
};

/** One level of the topic tree: its lessons first, then collapsible sub-topics (which nest the same way). */
function TopicBranch({ node, lesson, onNavigate, link, closed, toggle }) {
  return (
    <>
      {node.lessons.map((l) => (
        <li key={l.slug}>
          <NavLink
            to={`/lessons/${l.slug}`}
            onClick={onNavigate}
            end
            className={({ isActive }) => `${link} font-bold ${isActive || lesson?.slug === l.slug ? 'bg-white text-pen shadow-sm' : ''}`}
          >
            {l.nav}
          </NavLink>
        </li>
      ))}
      {node.children.map((c) => {
        const open = !closed.has(c.path);
        return (
          <li key={c.path}>
            <button
              type="button"
              onClick={() => toggle(c.path)}
              aria-expanded={open}
              className="flex w-full items-center gap-1 rounded px-1 py-1 text-left font-hand font-bold text-[1.05rem] text-pen hover:bg-white/70 cursor-pointer"
            >
              <span aria-hidden="true" className="inline-block w-4 text-xs transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>
                ▶
              </span>
              <span className="flex-1">{c.name}</span>
              <span className="text-xs font-sans font-normal text-soft">{topicLessonCount(c)}</span>
            </button>
            {open && (
              <ul className="list-none m-0 ml-2 pl-2 border-l-2 border-slate-300">
                <TopicBranch node={c} lesson={lesson} onNavigate={onNavigate} link={link} closed={closed} toggle={toggle} />
              </ul>
            )}
          </li>
        );
      })}
    </>
  );
}

/** Index tabs: all lessons grouped by topic, plus "on this page" navigation (sections and questions) for the open lesson. */
export function Sidebar({ lesson, onNavigate }) {
  const [active, setActive] = useState('');
  const [closed, setClosed] = useState(() => new Set()); // topic paths the reader collapsed
  const toggle = (path) =>
    setClosed((s) => {
      const n = new Set(s);
      n.has(path) ? n.delete(path) : n.add(path);
      return n;
    });

  // opening a lesson (link, search, deep link) expands the topics that contain it
  useEffect(() => {
    if (!lesson) return;
    setClosed((s) => {
      const n = new Set([...s].filter((p) => !topicContains(findTopic(topicTree, p) ?? { lessons: [], children: [] }, lesson.slug)));
      return n.size === s.size ? s : n;
    });
  }, [lesson]);

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
        <li className="lg:hidden">
          <NavLink to="/" end onClick={onNavigate} className={({ isActive }) => `${link} ${isActive ? 'bg-white text-pen font-bold shadow-sm' : ''}`}>
            Home
          </NavLink>
        </li>
        <TopicBranch node={topicTree} lesson={lesson} onNavigate={onNavigate} link={link} closed={closed} toggle={toggle} />
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
