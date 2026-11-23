import { useEffect, useState } from 'react';
import { LuFlaskConical } from 'react-icons/lu';
import { Link, NavLink } from 'react-router-dom';
import { LEVELS, getLesson, topicAncestors, topicContains, topicLabs, topicLessonCount, topicTree } from '../lib/content.js';

// paths of every topic (at any depth) that contains the lesson
const ancestorsOf = (node, slug, out = []) => {
  for (const c of node.children) {
    if (topicContains(c, slug)) {
      out.push(c.path);
      ancestorsOf(c, slug, out);
    }
  }
  return out;
};

/** Labs grouped by their lesson (in lab order). A lone group needs no heading. */
export function labGroups(list) {
  const groups = [];
  for (const x of list) {
    let g = groups.find((y) => y.lesson === (x.lesson ?? null));
    if (!g) groups.push((g = { lesson: x.lesson ?? null, heading: x.lesson ? getLesson(x.lesson)?.nav : '', labs: [] }));
    g.labs.push(x);
  }
  if (groups.length === 1) groups[0].heading = '';
  return groups;
}

/**
 * One level of the topic tree. In "lessons" mode it lists the lessons of the topic and its sub-topics; in "labs" mode the same tree lists only labs,
 * grouped by lesson. Keeping them apart keeps the lesson order clean, and the labs tree is collapsed until asked for.
 */
function TopicBranch({ node, mode, lesson, lab, onNavigate, link, expanded, toggle }) {
  const labsMode = mode === 'labs';
  const children = node.children.filter((c) => (labsMode ? topicLabs(c).length : topicLessonCount(c)) > 0);
  return (
    <>
      {!labsMode &&
        node.lessons.map((l) => (
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
      {labsMode && node.labs?.length > 0 && (
        <li className="nav-labs">
          {labGroups(node.labs).map((g) => (
            <div key={g.lesson ?? 'other'}>
              {g.heading && <span className="nav-labs-lesson">{g.heading}</span>}
              <ul className="list-none m-0 p-0">
                {g.labs.map((x) => (
                  <li key={x.slug}>
                    <NavLink
                      to={`/lab/${x.slug}`}
                      onClick={onNavigate}
                      className={({ isActive }) => `${link} ${isActive || lab?.slug === x.slug ? 'bg-white text-pen font-bold shadow-sm' : ''}`}
                    >
                      {x.nav ?? x.title}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </li>
      )}
      {children.map((c) => {
        const open = expanded.has(c.path);
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
              <span className="text-xs font-sans font-normal text-soft">{labsMode ? topicLabs(c).length : topicLessonCount(c)}</span>
            </button>
            {open && (
              <ul className="list-none m-0 ml-2 pl-2 border-l-2 border-slate-300">
                <TopicBranch node={c} mode={mode} lesson={lesson} lab={lab} onNavigate={onNavigate} link={link} expanded={expanded} toggle={toggle} />
              </ul>
            )}
          </li>
        );
      })}
    </>
  );
}

// accordion toggle for a set of open topic paths: opening a topic closes its siblings (and everything inside them), except the ones in `keep`
const parentOf = (p) => p.slice(0, Math.max(p.lastIndexOf('/'), 0));
const inside = (p, root) => p === root || p.startsWith(root + '/');
const toggled = (s, path, keep) => {
  if (s.has(path)) return new Set([...s].filter((p) => !inside(p, path)));
  const siblings = [...s].filter((p) => p !== path && parentOf(p) === parentOf(path) && !keep.includes(p));
  return new Set([...s].filter((p) => !siblings.some((x) => inside(p, x))).concat(path));
};
const samePath = (s, path) => s.size === path.length && path.every((p) => s.has(p));

/** Index tabs: all lessons grouped by topic, plus "on this page" navigation (sections and questions) for the open lesson. */
export function Sidebar({ lesson, lab, onNavigate }) {
  const [active, setActive] = useState('');
  const [expanded, setExpanded] = useState(() => new Set()); // lesson topics the reader opened; everything starts collapsed
  const [labsOpen, setLabsOpen] = useState(() => Boolean(lab)); // the Labs section is collapsed until asked for (or a lab is open)
  const [labExpanded, setLabExpanded] = useState(() => new Set());
  const toggle = (path) => setExpanded((s) => toggled(s, path, lesson ? ancestorsOf(topicTree, lesson.slug) : []));
  const toggleLab = (path) => setLabExpanded((s) => toggled(s, path, lab ? topicAncestors(lab.topic) : []));

  // opening a lesson (link, search, deep link) shows only the path to it and closes the rest
  useEffect(() => {
    if (!lesson) return;
    const path = ancestorsOf(topicTree, lesson.slug);
    setExpanded((s) => (samePath(s, path) ? s : new Set(path)));
  }, [lesson]);

  // a lab page opens the Labs section on the sub-topic that holds the lab
  useEffect(() => {
    if (!lab) return;
    setLabsOpen(true);
    setExpanded((s) => (s.size ? new Set() : s)); // fold the lesson tree so the Labs section is in view
    const path = topicAncestors(lab.topic);
    setLabExpanded((s) => (samePath(s, path) ? s : new Set(path)));
    const t = setTimeout(() => document.querySelector('nav[aria-label="Notebook navigation"] a[aria-current="page"]')?.scrollIntoView({ block: 'nearest' }), 50);
    return () => clearTimeout(t);
  }, [lab]);

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
        <TopicBranch node={topicTree} mode="lessons" lesson={lesson} lab={lab} onNavigate={onNavigate} link={link} expanded={expanded} toggle={toggle} />
        <li>
          <NavLink to="/glossary" onClick={onNavigate} className={({ isActive }) => `${link} ${isActive ? 'bg-white text-pen font-bold shadow-sm' : ''}`}>
            Glossary
          </NavLink>
        </li>
        <li className="nav-labs-section">
          <button
            type="button"
            onClick={() => setLabsOpen((o) => !o)}
            aria-expanded={labsOpen}
            className="flex w-full items-center gap-1 rounded px-1 py-1 text-left font-hand font-bold text-[1.05rem] text-pen hover:bg-white/70 cursor-pointer"
          >
            <span aria-hidden="true" className="inline-block w-4 text-xs transition-transform" style={{ transform: labsOpen ? 'rotate(90deg)' : 'none' }}>
              ▶
            </span>
            <LuFlaskConical aria-hidden="true" className="text-base" />
            <span className="flex-1">Labs</span>
            <span className="text-xs font-sans font-normal text-soft">{topicLabs(topicTree).length}</span>
          </button>
          {labsOpen && (
            <ul className="list-none m-0 ml-2 pl-2 border-l-2 border-slate-300">
              <TopicBranch node={topicTree} mode="labs" lesson={lesson} lab={lab} onNavigate={onNavigate} link={link} expanded={labExpanded} toggle={toggleLab} />
            </ul>
          )}
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
