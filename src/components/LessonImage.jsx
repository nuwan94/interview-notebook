import { useLayoutEffect, useRef } from 'react';

// Markdown: ![alt text](images/file.svg "Caption | Author, licence | https://source-page")
// Local files live in public/images/. The credit and source link are shown under the figure.
const BASE = import.meta.env.BASE_URL || './';

export function LessonImage({ src = '', alt = '', title = '' }) {
  const ref = useRef(null);
  const [caption, credit, source] = String(title).split('|').map((s) => s.trim());
  const url = /^(https?:)?\/\//.test(src) ? src : `${BASE}${src.replace(/^\.?\//, '')}`;

  // keep the ruled lines of the page registered with the text after the figure
  useLayoutEffect(() => {
    const el = ref.current;
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
    <figure ref={ref} className="demo lesson-fig" data-noread>
      <img src={url} alt={alt} loading="lazy" decoding="async" />
      {(caption || credit) && (
        <figcaption>
          {caption}
          {credit && (
            <span className="fig-credit">
              {' '}
              {source ? (
                <a href={source} target="_blank" rel="noreferrer noopener">
                  {credit}
                </a>
              ) : (
                credit
              )}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
