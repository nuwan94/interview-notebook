import { useLayoutEffect, useRef, useState } from 'react';
import { DemoHeader } from './DemoShell.jsx';
import { AWS_MAP } from './awsMapData.js';

const BASE = import.meta.env.BASE_URL || './';


function Services({ list }) {
  return (
    <ul className="aws-map-list">
      {list.map((s) => (
        <li key={s.slug} className="aws-map-item">
          <img src={`${BASE}images/aws/${s.slug}.svg`} alt="" width="36" height="36" loading="lazy" decoding="async" />
          <span className="min-w-0">
            <b>{s.name}</b>
            <span>{s.role}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** One picture of the AWS catalogue: a card per category, with the official icon, name and one-line job of each service. */
export function AwsServiceMap({ only }) {
  const rootRef = useRef(null);
  const [cat, setCat] = useState(only || 'all');
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
      <DemoHeader title={only ? `AWS ${AWS_MAP.find((c) => c.id === only)?.title.toLowerCase()} services` : 'The AWS services that matter, by category'} />
      {!only && (
      <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="Show a category">
        {[{ id: 'all', title: 'All' }, ...AWS_MAP].map((c) => (
          <button key={c.id} type="button" className={`btn !min-h-8 !px-2.5 text-sm ${cat === c.id ? 'primary' : ''}`} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
            {c.title}
          </button>
        ))}
      </div>
      )}
      {only ? (
        // a single category: its groups side by side as columns
        <div className="aws-map-groups" style={{ '--cat': shown[0]?.color }}>
          {shown[0]?.groups.map((g) => (
            <section key={g.title} className="aws-map-group">
              <h4 className="aws-map-title">{g.title}</h4>
              <Services list={g.services} />
            </section>
          ))}
        </div>
      ) : (
        <div className="aws-map">
          {shown.map((c) => (
            <section key={c.id} className="aws-map-cat" style={{ '--cat': c.color }}>
              <h4 className="aws-map-title">{c.title}</h4>
              {c.groups.map((g) => (
                <div key={g.title} className="aws-map-sub">
                  <h5>{g.title}</h5>
                  <Services list={g.services} />
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
      <figcaption className="text-xs text-soft mt-2">
        Service icons: official AWS Architecture Icons, shown unmodified. The layout and descriptions are this site's own. Not affiliated with or endorsed by AWS.
      </figcaption>
    </figure>
  );
}

/** One category of the map, for the lesson about that category. */
export const awsMapOf = (id) => () => <AwsServiceMap only={id} />;
