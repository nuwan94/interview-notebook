/** A rubber-stamp style "open to work" seal that links to the portfolio site. */
export function OpenToWorkSeal() {
  return (
    <a
      className="seal"
      href="https://nuwan.dev"
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Open to work. Visit my portfolio at nuwan.dev"
      title="Open to work: see my portfolio at nuwan.dev"
    >
      <svg viewBox="0 0 200 200" role="img" aria-hidden="true">
        <defs>
          <path id="seal-top" d="M 28,100 A 72,72 0 0 1 172,100" />
          <path id="seal-bottom" d="M 14,100 A 86,86 0 0 0 186,100" />
        </defs>
        <circle cx="100" cy="100" r="96" className="seal-bg" />
        <circle cx="100" cy="100" r="94" className="seal-ring" />
        <circle cx="100" cy="100" r="64" className="seal-ring seal-thin" />
        <text className="seal-text" fontSize="22" letterSpacing="3">
          <textPath href="#seal-top" startOffset="50%" textAnchor="middle">
            OPEN TO WORK
          </textPath>
        </text>
        <text className="seal-text seal-mono" fontSize="17" letterSpacing="2">
          <textPath href="#seal-bottom" startOffset="50%" textAnchor="middle">
            nuwan.dev
          </textPath>
        </text>
        <path d="M 74 102 L 94 122 L 128 80" className="seal-check" />
      </svg>
    </a>
  );
}
