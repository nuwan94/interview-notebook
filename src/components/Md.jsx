import { Children, isValidElement, memo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import bash from 'highlight.js/lib/languages/bash';
import { rehypeGlossary } from '../lib/glossary.js';
import { resolveLessonLink, slugify } from '../lib/content.js';
import { Term } from './Term.jsx';
import { DemoFrame } from './demos/index.jsx';
import { useReaderCtx } from '../lib/reader.jsx';
import { copyText, lessonUrl } from '../lib/share.js';

const textOf = (n) =>
  typeof n === 'string'
    ? n
    : Array.isArray(n)
      ? n.map(textOf).join('')
      : isValidElement(n)
        ? textOf(n.props.children)
        : '';

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const code = Children.toArray(children).find(isValidElement);
  const cls = code?.props?.className || '';
  if (cls.includes('language-demo')) {
    const name = /name:\s*([\w-]+)/.exec(textOf(code.props.children))?.[1];
    return <DemoFrame name={name} />;
  }
  const lang = /language-(\w+)/.exec(cls)?.[1];
  return (
    <div className="relative" data-noread>
      <pre>{children}</pre>
      <button
        type="button"
        className="absolute top-1 right-2 text-xs font-bold text-soft bg-white/90 border border-slate-300 rounded px-2 py-0.5 hover:bg-pen-soft"
        onClick={async () => {
          if (await copyText(textOf(code?.props?.children).replace(/\n$/, ''))) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }
        }}
        aria-label={`Copy ${lang || 'code'} to clipboard`}
      >
        {copied ? 'Copied' : lang ? `${lang} · Copy` : 'Copy'}
      </button>
    </div>
  );
}

const ID_MARK = /\s*\{#([a-z0-9-]+)\}\s*$/;

/** Cross-lesson link: [text](lesson:slug#anchor). If the target lesson does not exist yet it shows as a "coming soon" word. */
function LessonLink({ spec, children }) {
  const r = resolveLessonLink(spec);
  if (r.pending) {
    return (
      <span className="pending-link" title={`Linked lesson “${r.slug}” is not written yet`}>
        {children}
      </span>
    );
  }
  return <Link to={r.to}>{children}</Link>;
}

function Heading({ level, children }) {
  const reader = useReaderCtx();
  const Tag = `h${level}`;
  // "### Java 8 {#java-8}" gives the heading a stable id for share links and cross-lesson links
  const mark = ID_MARK.exec(textOf(children));
  const id = mark ? mark[1] : slugify(textOf(children));
  if (mark) {
    const kids = Children.toArray(children);
    const last = kids.length - 1;
    if (typeof kids[last] === 'string') kids[last] = kids[last].replace(ID_MARK, '');
    children = kids;
  }
  const { slug } = useParams();
  const outlet = useOutletContext();
  return (
    <Tag id={id} className="group">
      {children}
      {mark && slug && (
        <button
          type="button"
          data-noread
          className="ml-2 align-middle text-sm text-soft opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-pen"
          aria-label="Copy link to this heading"
          title="Copy link to this heading"
          onClick={async () => outlet?.toast?.((await copyText(lessonUrl(slug, id))) ? 'Link copied to clipboard' : 'Could not copy the link')}
        >
          🔗
        </button>
      )}
      {reader?.supported && (
        <button
          type="button"
          data-noread
          className="ml-2 align-middle text-sm text-soft opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-pen"
          aria-label="Read aloud from this heading"
          title="Read aloud from here"
          onClick={(e) => reader.playFrom(e.currentTarget.parentElement)}
        >
          ▶ read from here
        </button>
      )}
    </Tag>
  );
}

const components = {
  span: ({ node, children, ...props }) =>
    node?.properties?.dataTerm ? (
      <Term termId={node.properties.dataTerm} tabStop={node.properties.dataFirst === 'yes'}>
        {children}
      </Term>
    ) : (
      <span {...props}>{children}</span>
    ),
  pre: CodeBlock,
  h3: (p) => <Heading level={3} {...p} />,
  h4: (p) => <Heading level={4} {...p} />,
  a: ({ href, children }) =>
    href?.startsWith('lesson:') ? (
      <LessonLink spec={href.slice('lesson:'.length)}>{children}</LessonLink>
    ) : (
      <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer noopener">
        {children}
      </a>
    ),
  table: ({ children }) => (
    // outer = the taped card (can draw outside its box); inner = the horizontal scroller
    <div className="table-wrap">
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Table, scrollable">
        <table>{children}</table>
      </div>
    </div>
  ),
};

const rehypePlugins = [
  [
    rehypeHighlight,
    { languages: { java, javascript, bash }, aliases: { javascript: ['js'] }, detect: false, plainText: ['demo', 'text', 'txt', 'console'] },
  ],
  rehypeGlossary,
];
const remarkPlugins = [remarkGfm];
// react-markdown drops unknown URL schemes; let our lesson: links through
const urlTransform = (url) => (url.startsWith('lesson:') ? url : defaultUrlTransform(url));

/** Renders lesson markdown: GFM, syntax highlighting, glossary tooltips, ```demo fences. */
export const Md = memo(function Md({ children }) {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components} urlTransform={urlTransform}>
      {children}
    </ReactMarkdown>
  );
});
