import { useEffect, useRef } from 'react';
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { getLesson } from '../lib/content.js';
import { copyText, lessonUrl } from '../lib/share.js';
import { ReaderProvider, useReader } from '../lib/reader.jsx';
import { Md } from '../components/Md.jsx';
import { QuestionList } from '../components/QuestionList.jsx';
import { ReaderBar } from '../components/ReaderBar.jsx';
import { Holes } from '../components/Holes.jsx';
import { QuizButton } from '../components/Quiz.jsx';

export function LessonPage() {
  const { slug, anchor } = useParams();
  const lesson = getLesson(slug);
  if (!lesson) return <NotFound slug={slug} />;
  return <LessonView key={slug} lesson={lesson} anchor={anchor} />;
}

export function NotFound({ slug }) {
  return (
    <div className="paper prose-nb">
      <Holes />
      <h2>Page not found</h2>
      <p>{slug ? `There is no lesson called “${slug}”.` : 'That page does not exist.'}</p>
      <p>
        <Link to="/">Back to the contents page</Link>
      </p>
    </div>
  );
}

function ShareButton({ slug, anchor, label, toast, className = 'btn' }) {
  return (
    <button
      type="button"
      data-noread
      className={className}
      title="Copy a link that opens this exact place"
      onClick={async () => {
        const url = lessonUrl(slug, anchor);
        if (!anchor && navigator.share) {
          try {
            await navigator.share({ title: document.title, url });
            return;
          } catch {
            /* dismissed: fall through to copy */
          }
        }
        toast((await copyText(url)) ? 'Link copied to clipboard' : 'Could not copy — copy the address bar instead');
      }}
    >
      🔗 {label}
    </button>
  );
}

function LessonView({ lesson, anchor }) {
  const { toast } = useOutletContext();
  const { key: navKey } = useLocation(); // changes on every navigation, even to the same link
  const articleRef = useRef(null);
  const reader = useReader(articleRef);

  useEffect(() => {
    document.title = `${lesson.title} · Interview Notebook`;
    return () => {
      document.title = 'Interview Notebook';
    };
  }, [lesson]);

  // open at a deep link (section anchors; question anchors are handled by QuestionList)
  useEffect(() => {
    if (!anchor || anchor.startsWith('q-')) return;
    const t = setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }), 80);
    return () => clearTimeout(t);
  }, [anchor, lesson, navKey]);

  return (
    <ReaderProvider value={reader}>
      <article ref={articleRef} className="paper prose-nb" aria-labelledby="lesson-title">
        <Holes />
        <header data-spy id="top">
          <p className="m-0 text-sm font-bold text-soft uppercase tracking-wider" data-noread>
            {lesson.tags.join(' · ')}
          </p>
          <h1 id="lesson-title" className="font-hand font-bold text-[2.4rem] text-ink m-0" style={{ lineHeight: 'calc(var(--lh) * 2)' }}>
            {lesson.title}
          </h1>
          <p>{lesson.summary}</p>
          <div className="flex flex-wrap gap-2 mb-[var(--lh)]" data-noread>
            {reader.supported && (
              <button type="button" className="btn primary" onClick={reader.status === 'idle' ? reader.play : reader.stop}>
                {reader.status === 'idle' ? '🔊 Read aloud' : '⏹ Stop reading'}
              </button>
            )}
            <QuizButton slug={lesson.slug} />
            <ShareButton slug={lesson.slug} label="Share this lesson" toast={toast} />
            <span className="text-sm text-soft self-center">
              {lesson.questions.length} interview questions · {lesson.sections.length} sections
              {lesson.updated && ` · updated ${lesson.updated}`}
            </span>
          </div>
        </header>

        {lesson.intro && <Md>{lesson.intro}</Md>}

        {lesson.sections.map((s) => (
          <section key={s.id} id={s.id} data-spy className="scroll-mt-24">
            <h2 className="group">
              {s.title}
              <span data-noread className="ml-3 align-middle inline-flex gap-1 text-sm opacity-0 group-hover:opacity-100 focus-within:opacity-100 font-body">
                <ShareButton slug={lesson.slug} anchor={s.id} label="Link" toast={toast} className="btn !min-h-7 !text-xs !px-2" />
                {reader.supported && (
                  <button
                    type="button"
                    className="btn !min-h-7 !text-xs !px-2"
                    onClick={(e) => reader.playFrom(e.currentTarget.closest('h2'))}
                    title="Read aloud from this section"
                  >
                    ▶ Read from here
                  </button>
                )}
              </span>
            </h2>
            {s.md && <Md>{s.md}</Md>}
            {s.isQuestions && <QuestionList slug={lesson.slug} questions={lesson.questions} focusId={anchor} navKey={navKey} onToast={toast} />}
          </section>
        ))}
        <aside data-noread className="quiz-cta">
          <QuizButton slug={lesson.slug} label="📝 Check what you learned: take the quiz" />
        </aside>
      </article>
      <ReaderBar reader={reader} />
      <div className="h-24" aria-hidden="true" />
    </ReaderProvider>
  );
}
