// Keeps every animated demo (figure.demo) inside one screen: when a demo is taller than the window
// it is scaled down with CSS zoom, never below MIN, so the picture, note and controls show without scrolling.
// The tallest size seen for a figure is remembered, so the scale does not jump between steps.

const MIN = 0.6;
const CHROME = 96; // px kept for the site header and a little breathing room

export function fitDemos() {
  const seen = new WeakMap();
  const watched = new WeakSet(); // per call, so a StrictMode remount observes again

  const fit = (fig) => {
    if (fig.classList.contains('lab') || fig.classList.contains('mermaid-fig')) return; // static diagrams keep their size
    const z = Number(fig.dataset.fit || 1);
    const natural = fig.getBoundingClientRect().height / z;
    if (!natural) return;
    const max = Math.max(seen.get(fig) || 0, natural);
    seen.set(fig, max);
    const next = Math.round(Math.min(1, Math.max(MIN, (window.innerHeight - CHROME) / max)) * 100) / 100;
    if (Math.abs(next - z) < 0.01) return;
    fig.dataset.fit = String(next);
    fig.style.zoom = next === 1 ? '' : String(next);
  };

  const ro = new ResizeObserver((entries) => entries.forEach((e) => fit(e.target)));
  const watch = (root) => {
    const figs = root.matches?.('figure.demo') ? [root] : root.querySelectorAll?.('figure.demo') || [];
    figs.forEach((f) => { if (!watched.has(f)) { watched.add(f); ro.observe(f); } });
  };
  const mo = new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && watch(n))));
  mo.observe(document.body, { childList: true, subtree: true });
  watch(document.body);

  const onResize = () => {
    document.querySelectorAll('figure.demo').forEach((f) => { seen.delete(f); fit(f); });
  };
  window.addEventListener('resize', onResize);

  return () => {
    ro.disconnect();
    mo.disconnect();
    window.removeEventListener('resize', onResize);
  };
}
