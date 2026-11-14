import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuDices, LuLink } from 'react-icons/lu';
import { lessons, topicLessons, topicTree } from '../lib/content.js';
import { glossary } from '../lib/glossary.js';
import { hasQuiz } from '../lib/quiz.js';
import { Holes } from '../components/Holes.jsx';
import { OpenToWorkSeal } from '../components/OpenToWorkSeal.jsx';
import { QuizOverlay } from '../components/Quiz.jsx';
import { TopicCard } from '../components/TopicCard.jsx';

const sample = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

/** Mixed quiz builder: pick topics (or none for everything) and start, or let it choose three at random. */
function MixedQuiz() {
  const topics = useMemo(() => topicTree.children.filter((t) => topicLessons(t).some((l) => hasQuiz(l.slug))), []);
  const [picked, setPicked] = useState([]); // topic slugs
  const [run, setRun] = useState(null); // { ids, title }

  const toggle = (slug) => setPicked((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));
  const start = (slugs) => {
    const chosen = topics.filter((t) => slugs.includes(t.slug));
    const use = chosen.length ? chosen : topics;
    setRun({
      ids: use.flatMap(topicLessons).map((l) => l.slug),
      title: chosen.length ? `Mixed quiz: ${chosen.map((t) => t.name).join(', ')}` : 'Mixed quiz: all topics',
    });
  };
  const surprise = () => {
    const three = sample(topics, 3).map((t) => t.slug);
    setPicked(three);
    start(three);
  };

  return (
    <section aria-labelledby="mix-h" className="mix-panel">
      <h2 id="mix-h">Test yourself</h2>
      <p>
        Pick one or more topics for a mixed quiz of random questions, or start without picking to be tested on everything. Every
        topic card below also has its own <b>Quiz me</b> button.
      </p>
      <div className="flex flex-wrap items-center gap-1.5 mb-3" role="group" aria-label="Topics for the mixed quiz">
        {topics.map((t) => (
          <button key={t.slug} type="button" className="chip" aria-pressed={picked.includes(t.slug)} onClick={() => toggle(t.slug)}>
            {t.name}
          </button>
        ))}
        {picked.length > 0 && (
          <button type="button" className="underline text-pen font-bold text-sm ml-1" onClick={() => setPicked([])}>
            clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn primary" onClick={() => start(picked)}>
          {picked.length ? `Start mixed quiz (${picked.length} ${picked.length === 1 ? 'topic' : 'topics'})` : 'Start mixed quiz (all topics)'}
        </button>
        <button type="button" className="btn" onClick={surprise}>
          <LuDices aria-hidden="true" className="quiz-icon" /> Surprise me
        </button>
      </div>
      {run && <QuizOverlay ids={run.ids} title={run.title} scoreKey="mix" onClose={() => setRun(null)} />}
    </section>
  );
}

export function Home() {
  const totalQ = lessons.reduce((n, l) => n + l.questions.length, 0);
  const rootLessons = topicTree.lessons;
  return (
    <div className="paper prose-nb">
      <Holes />
      <OpenToWorkSeal />
      <h1 className="font-hand font-bold text-[2.4rem] m-0" style={{ lineHeight: 'calc(var(--lh) * 2)' }}>
        Interview Notebook
      </h1>
      <p>
        My preparation notes, {lessons.length} lessons in {topicTree.children.length} topics. Each lesson has a plain-English
        walkthrough, animations you can replay, and interview questions with model answers: from the 60-second version to the
        follow-ups that dig deeper.
      </p>

      <h2>Topics</h2>
      <div className="topic-grid">
        {topicTree.children.map((t) => (
          <TopicCard key={t.path} node={t} />
        ))}
      </div>

      {rootLessons.length > 0 && (
        <>
          <h2>More lessons</h2>
          <ul>
            {rootLessons.map((l) => (
              <li key={l.slug}>
                <Link to={`/lessons/${l.slug}`}>{l.title}</Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <MixedQuiz />

      <h2>How to use this notebook</h2>
      <ul>
        <li>
          <b>Search everything</b> with <span className="kbd">/</span> or <span className="kbd">Ctrl</span>+<span className="kbd">K</span>:{' '}
          lessons, sections, all {totalQ} questions and {glossary.length} glossary terms.
        </li>
        <li>
          <b>Dotted-underline words</b> explain themselves on hover, focus or tap.
        </li>
        <li>
          <b>Animations replay</b>: press Play, or with the pointer over one use <span className="kbd">Space</span> to pause and <span className="kbd">←</span> <span className="kbd">→</span> to step.
        </li>
        <li>
          <b>Read aloud</b> highlights each word and scrolls along. <b>A− / A+</b> in the header resize all text.
        </li>
        <li>
          <b>Share</b> any lesson, section or single question with its <LuLink aria-hidden="true" className="inline-icon" /> link.
        </li>
      </ul>
    </div>
  );
}
