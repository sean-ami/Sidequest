// The Side Quest Maidens gem, from the round 2 gem lockup (140×140 artboard).
// Facet shades are the accent mixed toward white (light) or black (mid, dark).

export const GEM = {
  accent: "#FF3E8A",
  light: "#FF8BB9", // accent → white 40%
  mid: "#DB3577", // accent → black 14%
  dark: "#9E2656", // accent → black 38%
  teal: "#3DD6C8",
};

const OUTLINE = "40,30 100,30 120,52 70,120 20,52";
const SPARKLE = "M110 6 Q112 29 134 31 Q112 33 110 56 Q108 33 86 31 Q108 29 110 6 Z";
const SPARKLE_SMALL = "M126 60 Q127 67 133 68 Q127 69 126 76 Q125 69 119 68 Q125 67 126 60 Z";

function Facets() {
  const { accent, light, mid, dark } = GEM;
  return (
    <g>
      <polygon points="40,30 20,52 45,52" fill={mid} />
      <polygon points="40,30 45,52 70,30" fill={light} />
      <polygon points="70,30 45,52 95,52" fill={accent} />
      <polygon points="70,30 95,52 100,30" fill={light} />
      <polygon points="100,30 95,52 120,52" fill={mid} />
      <polygon points="20,52 45,52 70,120" fill={dark} />
      <polygon points="45,52 70,52 70,120" fill={accent} />
      <polygon points="70,52 95,52 70,120" fill={mid} />
      <polygon points="95,52 120,52 70,120" fill={dark} />
    </g>
  );
}

function FacetLines({ color, width, center = true }: { color: string; width: number; center?: boolean }) {
  return (
    <g fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round">
      <polyline points="20,52 120,52" />
      <polyline points="40,30 45,52 70,30 95,52 100,30" />
      <polyline points="45,52 70,120 95,52" />
      {center && <polyline points="70,52 70,120" />}
    </g>
  );
}

type Variant = "dark" | "light" | "mono" | "icon";

/** `ground` is the colour behind the mark; the sparkle's knock-out stroke uses it. */
export function GemMark({ variant = "dark", ground = "#10141F", size = 40, className }: { variant?: Variant; ground?: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" className={className} aria-hidden="true">
      {variant === "mono" ? (
        <>
          <FacetLines color="#fff" width={3} />
          <polygon points={OUTLINE} fill="none" stroke="#fff" strokeWidth={4.5} strokeLinejoin="round" />
          <path d={SPARKLE} fill="#fff" style={{ stroke: ground }} strokeWidth={6} paintOrder="stroke" />
        </>
      ) : variant === "light" ? (
        <>
          <Facets />
          <FacetLines color="#fff" width={2.4} />
          <polygon points={OUTLINE} fill="none" stroke="#0B0E16" strokeWidth={4} strokeLinejoin="round" />
          <path d={SPARKLE} fill="#0B0E16" style={{ stroke: ground }} strokeWidth={5} paintOrder="stroke" strokeLinejoin="round" />
        </>
      ) : variant === "icon" ? (
        // heavier strokes and no centre line, for 64 px and below
        <>
          <Facets />
          <FacetLines color="#fff" width={2.6} center={false} />
          <polygon points={OUTLINE} fill="none" stroke="#fff" strokeWidth={4.5} strokeLinejoin="round" />
          <path d={SPARKLE} fill="#fff" style={{ stroke: ground }} strokeWidth={6} paintOrder="stroke" />
        </>
      ) : (
        <>
          <Facets />
          <polygon points="47,34 54,34 48,47" fill="#fff" opacity={0.55} />
          <FacetLines color="#fff" width={2.2} />
          <polygon points={OUTLINE} fill="none" stroke="#fff" strokeWidth={3.5} strokeLinejoin="round" />
          <path d={SPARKLE} fill="#fff" style={{ stroke: ground }} strokeWidth={5} paintOrder="stroke" strokeLinejoin="round" />
          <path d={SPARKLE_SMALL} fill={GEM.teal} />
        </>
      )}
    </svg>
  );
}

/** Gem + two-line wordmark. Proportions follow the lockup: the second line is 0.29× the SIDEQUEST size. */
export function Lockup({ size = "sm", variant = "dark" }: { size?: "sm" | "md" | "lg"; variant?: Variant }) {
  return (
    <span className={`lockup lockup--${size} lockup--${variant}`} aria-label="Side Quest Maidens" role="img">
      <GemMark variant={size === "sm" ? "icon" : variant} ground="var(--ground)" className="lockup__mark" />
      <span className="lockup__words" aria-hidden="true">
        <span className="lockup__name">SIDEQUEST</span>
        <span className="lockup__sub">MAIDENS</span>
      </span>
    </span>
  );
}
