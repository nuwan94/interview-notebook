import { Link } from 'react-router-dom';
import { LuLink } from 'react-icons/lu';
import { lessons, topicTree } from '../lib/content.js';
import { glossary } from '../lib/glossary.js';
import { Holes } from '../components/Holes.jsx';
import { OpenToWorkSeal } from '../components/OpenToWorkSeal.jsx';

/** Lessons grouped under their (nested) topic headings. */
function TopicContents({ node, depth }) {
  return (
    <>
      {node.lessons.length > 0 && (
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
      )}
      {node.children.map((c) => {
        const H = depth === 0 ? 'h3' : 'h4';
        return (
          <section key={c.path} aria-label={c.path.replace(/\//g, ' › ')}>
            <H>{c.name}</H>
            <TopicContents node={c} depth={depth + 1} />
          </section>
        );
      })}
    </>
  );
}

export function Home() {
  const totalQ = lessons.reduce((n, l) => n + l.questions.length, 0);
  return (
    <div className="paper prose-nb">
      <Holes />
      <OpenToWorkSeal />
      <h1 className="font-hand font-bold text-[2.4rem] m-0" style={{ lineHeight: 'calc(var(--lh) * 2)' }}>
        Interview Notebook
      </h1>
      <p>
        My preparation notes, one lesson per topic. Each lesson has a plain-English walkthrough, animations you can replay, and
        interview questions with model answers — from the 60-second version to the follow-ups that dig deeper.
      </p>

      <h2>Contents</h2>
      <TopicContents node={topicTree} depth={0} />

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
          <b>Animations replay</b>: press Play, step with ◀ ▶, drag the slider, or jump to any operation.
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
