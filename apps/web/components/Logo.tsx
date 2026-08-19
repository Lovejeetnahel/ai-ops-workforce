/**
 * Sofilic brand mark — the founder's "$ofilic" identity, adapted to fit
 * the product's black/gold system. The mark is a horned "$" (the artwork's
 * devil-horn dollar) drawn as vectors so it scales cleanly and recolors per
 * theme: gold glyph on the app's dark tile instead of the artwork's
 * print-black, horns in the artwork's red.
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
        <linearGradient id="sofilic-gold" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffc629" />
          <stop offset="0.55" stopColor="#e8a317" />
          <stop offset="1" stopColor="#ffe066" />
        </linearGradient>
        <linearGradient id="sofilic-horn" x1="12" y1="2" x2="36" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#c1121f" />
          <stop offset="1" stopColor="#e63946" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#sofilic-gold)" fillOpacity="0.13" />
      <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="12.25" stroke="url(#sofilic-gold)" strokeOpacity="0.35" strokeWidth="1.5" />
      {/* horns — behind the glyph, flanking the bar */}
      <path
        className="s-horn"
        d="M12.6 3.2 C16.6 4.5 19.6 7.4 20.9 11.6 C19.1 12.2 17.5 13.1 16.1 14.3 C14.7 10.5 13.6 6.9 12.6 3.2 Z"
        fill="url(#sofilic-horn)"
      />
      <path
        className="s-horn"
        d="M35.4 3.2 C31.4 4.5 28.4 7.4 27.1 11.6 C28.9 12.2 30.5 13.1 31.9 14.3 C33.3 10.5 34.4 6.9 35.4 3.2 Z"
        fill="url(#sofilic-horn)"
      />
      {/* the $ — S curve + bar */}
      <path
        d="M32.2 18.2 C32.2 14.9 28.7 12.9 24 12.9 C19.3 12.9 15.8 15 15.8 18.4 C15.8 22 19.5 23.1 24 23.9 C28.8 24.7 32.2 26.2 32.2 29.9 C32.2 33.6 28.7 35.6 24 35.6 C19.3 35.6 15.8 33.5 15.8 30.3"
        stroke="url(#sofilic-gold)"
        strokeWidth="4.4"
        strokeLinecap="round"
      />
      <path d="M24 9.4 V39.2" stroke="url(#sofilic-gold)" strokeWidth="3.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Full lockup: horned-$ mark + the "$ofilic" wordmark. Letter colors follow
 * the founder's artwork — body letters in the theme text color (black in
 * light mode, exactly as drawn; light in dark mode so it fits), "li" in the
 * red gradient, "c" in gold. `sub` renders the small descriptor line.
 */
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
        <span className="sofilic-name">
          <span className="brand-s">$</span>ofi<span className="brand-li">li</span>
          <span className="brand-c">c</span>
        </span>
        {sub && <span className="sofilic-sub">{sub}</span>}
      </span>
    </span>
  );
}
