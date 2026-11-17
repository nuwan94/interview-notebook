import { useLayoutEffect, useRef, useState } from 'react';
import { DemoHeader } from './DemoShell.jsx';
import { AWS_MAP } from './awsMapData.js';

const BASE = import.meta.env.BASE_URL || './';

/** One picture of the AWS catalogue: a card per category, with the official icon, name and one-line job of each service. */
export function AwsServiceMap() {
  const rootRef = useRef(null);
  const [cat, setCat] = useState('all');
  const shown = AWS_MAP.filter((c) => cat === 'all' || c.id === cat);

  // keep the ruled lines of the page registered with the text after the figure
  useLayoutEffect(() => {
    const el = rootRef.current;
    const fit = () => {
      const lh = parseFloat(getComputedStyle(document.documentElement).fontSize) * 2;
      el.style.marginBottom = '0px';
      const h = el.getBoundingClientRect().height;
      el.style.marginBottom = `${lh + Math.ceil(h / lh) * lh - h}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <figure ref={rootRef} className="demo" data-noread aria-label="AWS service map">
      <DemoHeader title="The AWS services that matter, by category" />
      <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="Show a category">
        {[{ id: 'all', title: 'All' }, ...AWS_MAP].map((c) => (
          <button key={c.id} type="button" className={`btn !min-h-8 !px-2.5 text-sm ${cat === c.id ? 'primary' : ''}`} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
            {c.title}
          </button>
        ))}
      </div>
      <div className="aws-map">
        {shown.map((c) => (
          <section key={c.id} className="aws-map-cat" style={{ '--cat': c.color }}>
            <h4 className="aws-map-title">{c.title}</h4>
            <ul className="aws-map-list">
              {c.services.map((s) => (
                <li key={s.slug} className="aws-map-item">
                  <img src={`${BASE}images/aws/${s.slug}.svg`} alt="" width="36" height="36" loading="lazy" decoding="async" />
                  <span className="min-w-0">
                    <b>{s.name}</b>
                    <span>{s.role}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <figcaption className="text-xs text-soft mt-2">
        Service icons: official AWS Architecture Icons, shown unmodified. The layout and descriptions are this site's own. Not affiliated with or endorsed by AWS.
      </figcaption>
    </figure>
  );
}
