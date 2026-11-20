import { useEffect } from 'react';
import { LuArrowRight, LuBookOpen, LuFlaskConical } from 'react-icons/lu';
import { Link, useParams } from 'react-router-dom';
import { getLesson, topicAncestors, topicNodeOf, topicPath } from '../lib/content.js';
import { getLab } from '../labs/index.js';
import { Lab } from '../components/lab/Lab.jsx';
import { NotFound } from './LessonPage.jsx';

/** #/lab/<slug>/<step>: a lab on its own page, listed in the "Labs" group of its sub-topic. */
export default function LabPage() {
  const { slug } = useParams();
  const lab = getLab(slug);

  useEffect(() => {
    if (!lab) return undefined;
    document.title = `${lab.title} · Lab · Interview Notebook`;
    return () => {
      document.title = 'Interview Notebook';
    };
  }, [lab]);

  if (!lab) return <NotFound />;
  const trail = topicAncestors(lab.topic).map((_, i) => topicNodeOf(lab.topic.slice(0, i + 1))).filter(Boolean);
  const node = trail.at(-1);
  const lesson = lab.lesson ? getLesson(lab.lesson) : undefined;
  const others = (node?.labs ?? []).filter((x) => x.slug !== lab.slug);

  return (
    <div className="lab-page">
      <Lab key={lab.slug} lab={lab} />

      {(lesson || others.length > 0) && (
        <div className="lab-related">
          {lesson && (
            <Link to={`/lessons/${lesson.slug}`} className="lab-related-card">
              <LuBookOpen aria-hidden="true" className="lab-related-icon" />
              <span>
                <span className="lab-related-kind">Read the lesson</span>
                <span className="lab-related-title">{lesson.title}</span>
              </span>
              <LuArrowRight aria-hidden="true" />
            </Link>
          )}
          {others.map((x) => (
            <Link key={x.slug} to={`/lab/${x.slug}`} className="lab-related-card">
              <LuFlaskConical aria-hidden="true" className="lab-related-icon" />
              <span>
                <span className="lab-related-kind">Another {node.name} lab</span>
                <span className="lab-related-title">{x.title}</span>
              </span>
              <LuArrowRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
