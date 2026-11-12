import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { glossary } from '../lib/glossary.js';
import { Holes } from '../components/Holes.jsx';

export function GlossaryPage() {
  const { termId } = useParams();
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return glossary.filter((g) => !t || `${g.term} ${(g.aliases || []).join(' ')} ${g.short} ${g.more || ''}`.toLowerCase().includes(t));
  }, [q]);

  useEffect(() => {
    document.title = 'Glossary · Interview Notebook';
    if (!termId) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`term-${termId}`);
      el?.scrollIntoView({ block: 'center' });
      el?.classList.add('flash');
    }, 80);
    return () => clearTimeout(t);
  }, [termId]);

  return (
    <div className="paper prose-nb">
      <Holes />
      <h1 className="font-hand font-bold text-[2.4rem] m-0" style={{ lineHeight: 'calc(var(--lh) * 2)' }}>
        Glossary
      </h1>
      <p>Every dotted-underline word in the lessons, in one place.</p>
      <p>
        <label htmlFor="g-filter" className="sr-only">
          Filter terms
        </label>
        <input
          id="g-filter"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Filter ${glossary.length} terms…`}
          className="w-full max-w-md border border-slate-300 rounded px-2 py-1.5 bg-white"
        />
      </p>
      <dl className="m-0">
        {shown.map((g) => (
          <div key={g.id} id={`term-${g.id}`} className="mb-[var(--lh)] scroll-mt-24 rounded">
            <dt className="font-hand font-bold text-xl text-pen">
              {g.term}
              {g.aliases?.length > 0 && <span className="ml-2 text-sm font-body font-normal text-soft">also: {g.aliases.join(', ')}</span>}
            </dt>
            <dd className="m-0">
              {g.short}
              {g.more && <span className="block text-soft text-[0.95rem]">{g.more}</span>}
            </dd>
          </div>
        ))}
        {!shown.length && <p>No term matches “{q}”.</p>}
      </dl>
    </div>
  );
}
