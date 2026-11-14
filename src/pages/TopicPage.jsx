import { Link, useParams } from 'react-router-dom';
import { findTopic, topicLessonCount, topicLessons, topicPath, topicQuestionCount, topicTree } from '../lib/content.js';
import { topicBlurb, topicIcon } from '../lib/topics.js';
import { Holes } from '../components/Holes.jsx';
import { QuizButton } from '../components/Quiz.jsx';
import { TopicCard } from '../components/TopicCard.jsx';
import { NotFound } from './LessonPage.jsx';

/** Breadcrumb trail Home › Java › Collections, built from the topic path. */
function Crumbs({ node }) {
  const trail = [];
  let cur = topicTree;
  for (const part of node.slug.split('/')) {
    cur = cur.children.find((c) => c.slug.split('/').pop() === part);
    trail.push(cur);
  }
  return (
    <nav aria-label="Breadcrumb" className="text-sm mb-2 text-soft" data-noread>
      <Link to="/">Home</Link>
      {trail.map((t, i) => (
        <span key={t.path}>
          {' › '}
          {i === trail.length - 1 ? <span aria-current="page">{t.name}</span> : <Link to={topicPath(t)}>{t.name}</Link>}
        </span>
      ))}
    </nav>
  );
}

/** A topic or sub-topic page: its sub-topic cards, its lessons, and a quiz over everything inside it. */
export function TopicPage() {
  const { '*': splat } = useParams();
  const node = findTopic(splat);
  if (!node || !node.slug) return <NotFound />;
  const Icon = topicIcon(node);
  const all = topicLessons(node);
  const blurb = topicBlurb(node);
  return (
    <div className="paper prose-nb">
      <Holes />
      <Crumbs node={node} />
      <h1 className="font-hand font-bold text-[2.2rem] m-0" style={{ lineHeight: 'calc(var(--lh) * 2)' }}>
        <Icon aria-hidden="true" className="inline-icon" /> {node.name}
      </h1>
      {blurb && <p>{blurb}</p>}
      <p className="text-sm font-bold text-pen">
        {topicLessonCount(node)} {topicLessonCount(node) === 1 ? 'lesson' : 'lessons'} · {topicQuestionCount(node)} questions
      </p>
      <p>
        <QuizButton
          slugs={all.map((l) => l.slug)}
          title={`${node.name} quiz`}
          scoreKey={`topic:${node.slug}`}
          label={`Test my ${node.name} knowledge`}
        />
      </p>

      {node.children.length > 0 && (
        <>
          <h2>Sub-topics</h2>
          <div className="topic-grid">
            {node.children.map((c) => (
              <TopicCard key={c.path} node={c} />
            ))}
          </div>
        </>
      )}

      {node.lessons.length > 0 && (
        <>
          <h2>{node.children.length > 0 ? `Lessons in ${node.name}` : 'Lessons'}</h2>
          <ul className="!list-none !p-0">
            {node.lessons.map((l) => (
              <li key={l.slug} className="mb-[var(--lh)]">
                <Link to={`/lessons/${l.slug}`} className="font-hand font-bold text-xl no-underline">
                  {l.title}
                </Link>
                <br />
                <span className="text-soft">{l.summary}</span>
                <br />
                <span className="text-sm font-bold text-pen">
                  {l.questions.length} questions · {l.tags.join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
