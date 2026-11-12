/** Punched binder holes down the left edge of the page (decoration only). */
export function Holes() {
  return (
    <>
      {['12%', '50%', '88%'].map((top) => (
        <span key={top} className="hole" style={{ top }} aria-hidden="true" />
      ))}
    </>
  );
}
