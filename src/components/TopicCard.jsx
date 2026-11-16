import { LuArrowRight } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import { topicLessonCount, topicLessons, topicPath, topicQuestionCount } from '../lib/content.js';
import { topicBlurb, topicIcon, topicImage } from '../lib/topics.js';
import { QuizButton } from './Quiz.jsx';

const BASE = import.meta.env.BASE_URL || './';

/** One topic or sub-topic as a card: an arrow to its page, counts, and a quiz over everything inside it (overlaid on the picture when there is one). */
export function TopicCard({ node }) {
  const Icon = topicIcon(node);
  const lessons = topicLessons(node);
  const image = topicImage(node);
  const blurb = topicBlurb(node) || lessons.slice(0, 4).map((l) => l.nav).join(', ') + (lessons.length > 4 ? '…' : '');
  const quiz = <QuizButton slugs={lessons.map((l) => l.slug)} title={`${node.name} quiz`} scoreKey={`topic:${node.slug}`} className="btn primary !min-h-9" label="Quiz me" />;
  return (
    <article className="topic-card" aria-label={node.name}>
      {image && (
        <div className="topic-card-media">
          <img className="topic-card-img" src={`${BASE}images/topics/${image}.svg`} alt="" width="320" height="110" loading="lazy" decoding="async" />
          <div className="topic-card-quiz">{quiz}</div>
        </div>
      )}
      <div className="topic-card-head">
        <h3 className="topic-card-title">
          <Link to={topicPath(node)} className="no-underline">
            <Icon aria-hidden="true" className="topic-card-icon" />
            {node.name}
          </Link>
        </h3>
        {!image && quiz}
        <Link to={topicPath(node)} className="btn !min-h-9 !px-2 no-underline" aria-label={`Open ${node.name}`} data-tip={`Open ${node.name}`}>
          <LuArrowRight aria-hidden="true" size="1.2em" />
        </Link>
      </div>
      <p className="topic-card-meta">
        {topicLessonCount(node)} {topicLessonCount(node) === 1 ? 'lesson' : 'lessons'} · {topicQuestionCount(node)} questions
      </p>
      {blurb && <p className="topic-card-blurb">{blurb}</p>}
    </article>
  );
}
