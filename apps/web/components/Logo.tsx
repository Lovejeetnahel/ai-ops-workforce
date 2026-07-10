/**
 * Sofilic brand mark. Three offset layers forming an abstract "S" —
 * the layered stack reads as "operating system", the diagonal flow as
 * automation in motion. Geometric, no mascots.
 */
export function SofilicMark({ size = 34, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={animated ? 'sofilic-mark animated' : 'sofilic-mark'}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sofilic-g1" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffc629" />
          <stop offset="0.55" stopColor="#e8a317" />
          <stop offset="1" stopColor="#ffe066" />
        </linearGradient>
        <linearGradient id="sofilic-g2" x1="48" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset="1" stopColor="#ffc629" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#sofilic-g1)" fillOpacity="0.13" />
      <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="12.25" stroke="url(#sofilic-g1)" strokeOpacity="0.35" strokeWidth="1.5" />
      {/* layer 1 — top, flows right */}
      <rect className="s-bar s-bar-1" x="17" y="11" width="21" height="7" rx="3.5" fill="url(#sofilic-g1)" />
      {/* layer 2 — middle, full span */}
      <rect className="s-bar s-bar-2" x="10" y="20.5" width="28" height="7" rx="3.5" fill="url(#sofilic-g2)" />
      {/* layer 3 — bottom, flows left */}
      <rect className="s-bar s-bar-3" x="10" y="30" width="21" height="7" rx="3.5" fill="url(#sofilic-g1)" />
    </svg>
  );
}

/** Full lockup: mark + wordmark. `sub` renders the small descriptor line. */
export function SofilicLogo({
  size = 34,
  sub,
  animated = false,
}: {
  size?: number;
  sub?: string;
  animated?: boolean;
}) {
  return (
    <span className="sofilic-logo">
      <SofilicMark size={size} animated={animated} />
      <span className="sofilic-word">
        <span className="sofilic-name">SOFILIC</span>
        {sub && <span className="sofilic-sub">{sub}</span>}
      </span>
    </span>
  );
}
