import { Children, isValidElement, memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import bash from 'highlight.js/lib/languages/bash';
import { rehypeGlossary } from '../lib/glossary.js';
import { slugify } from '../lib/content.js';
import { Term } from './Term.jsx';
import { DemoFrame } from './demos/index.jsx';
import { useReaderCtx } from '../lib/reader.jsx';
import { copyText } from '../lib/share.js';

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

function Heading({ level, children }) {
  const reader = useReaderCtx();
  const Tag = `h${level}`;
  const id = slugify(textOf(children));
  return (
    <Tag id={id} className="group">
      {children}
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
  a: ({ href, children }) => (
    <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer noopener">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Table, scrollable">
      <table>{children}</table>
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

/** Renders lesson markdown: GFM, syntax highlighting, glossary tooltips, ```demo fences. */
export const Md = memo(function Md({ children }) {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
      {children}
    </ReactMarkdown>
  );
});
