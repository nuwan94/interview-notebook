import { Link } from 'react-router-dom';
import { topicLessonCount, topicLessons, topicPath, topicQuestionCount } from '../lib/content.js';
import { topicBlurb, topicIcon } from '../lib/topics.js';
import { QuizButton } from './Quiz.jsx';

/** One topic or sub-topic as a card: link to its page, counts, sub-topic links, and a quiz over everything inside it. */
export function TopicCard({ node }) {
  const Icon = topicIcon(node);
  const lessons = topicLessons(node);
  const blurb = topicBlurb(node) || lessons.slice(0, 4).map((l) => l.nav).join(', ') + (lessons.length > 4 ? '…' : '');
  return (
    <article className="topic-card" aria-label={node.name}>
      <h3 className="topic-card-title">
        <Link to={topicPath(node)} className="no-underline">
          <Icon aria-hidden="true" className="topic-card-icon" />
          {node.name}
        </Link>
      </h3>
      <p className="topic-card-meta">
        {topicLessonCount(node)} {topicLessonCount(node) === 1 ? 'lesson' : 'lessons'} · {topicQuestionCount(node)} questions
      </p>
      {blurb && <p className="topic-card-blurb">{blurb}</p>}
      {node.children.length > 0 && (
        <ul className="topic-card-subs" aria-label={`${node.name} sub-topics`}>
          {node.children.map((c) => (
            <li key={c.path}>
              <Link to={topicPath(c)} className="chip no-underline">
                {c.name} <span className="text-soft">{topicLessonCount(c)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="topic-card-actions">
        <Link to={topicPath(node)} className="btn">
          Open
        </Link>
        <QuizButton slugs={lessons.map((l) => l.slug)} title={`${node.name} quiz`} scoreKey={`topic:${node.slug}`} className="btn primary" label="Quiz me" />
      </div>
    </article>
  );
}
