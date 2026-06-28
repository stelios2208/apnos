import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

/**
 * Apnos logo — concept: "the grid pun".
 *
 * The word "apnos" is stacked into a tight 2-row grid:
 *   row 1: a p p
 *   row 2: n o s
 * The letters "pp" and "o" are highlighted in teal, so reading across spells
 * "apnos" (freediving) while the highlighted letters spell "app" — a hidden
 * visual pun. To the right runs a dive rope with depth markers (10–40m),
 * the dots growing as the rope descends: the app's core purpose, depth + time.
 */

const TEAL = "bg-gradient-to-br from-[#5DCAA5] to-[#1D9E75] bg-clip-text text-transparent";

/** The stacked letter grid. `size` = cap height of a single row in px. */
export function LetterGrid({ size = 18, className }: { size?: number; className?: string }) {
  // column width keeps a/n, p/o, p/s perfectly aligned; rows overlap slightly.
  const col = size * 0.78;
  const rowGap = -size * 0.18; // negative => rows tuck together for compactness
  const cell = (ch: string, teal: boolean) => (
    <span
      style={{ width: col, lineHeight: 1 }}
      className={`inline-block text-center ${teal ? TEAL : "text-white"}`}
    >
      {ch}
    </span>
  );
  return (
    <span
      className={`inline-flex flex-col ${className ?? ""}`}
      style={{
        fontFamily: "'Nunito', sans-serif",
        fontWeight: 900,
        fontSize: size,
        letterSpacing: "-0.01em",
      }}
      aria-hidden="true"
    >
      <span className="flex" style={{ marginBottom: rowGap }}>
        {cell("a", false)}
        {cell("p", true)}
        {cell("p", true)}
      </span>
      <span className="flex">
        {cell("n", false)}
        {cell("o", true)}
        {cell("s", false)}
      </span>
    </span>
  );
}

/** Vertical dive rope with progressively larger depth markers. */
export function DepthRope({ height = 36, className }: { height?: number; className?: string }) {
  const marks = [
    { label: "10m", r: 0.9 },
    { label: "20m", r: 1.4 },
    { label: "30m", r: 2.0 },
    { label: "40m", r: 2.8 },
  ];
  const w = 32;
  const top = 3;
  const bottom = height - 3;
  const showLabels = height >= 64;
  return (
    <svg
      width={showLabels ? w : 6}
      height={height}
      viewBox={`0 0 ${showLabels ? w : 6} ${height}`}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="apnos-rope" x1="0" y1="0" x2="0" y2={height} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1D9E75" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#1D9E75" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id="apnos-mark" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#7BD9B8" />
          <stop offset="100%" stopColor="#1D9E75" />
        </radialGradient>
      </defs>

      <line x1="3" y1={top} x2="3" y2={bottom} stroke="url(#apnos-rope)" strokeWidth="1.4" strokeLinecap="round" />

      {marks.map((m, i) => {
        const cy = top + ((bottom - top) * (i + 0.6)) / marks.length;
        return (
          <g key={m.label}>
            <circle cx="3" cy={cy} r={m.r} fill="url(#apnos-mark)" />
            {showLabels && (
              <text
                x="11"
                y={cy + m.r / 2 + 0.5}
                fill="#FFFFFF"
                fillOpacity="0.55"
                style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 300 }}
                fontSize="6.5"
                letterSpacing="0.05em"
              >
                {m.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Tagline lockup. */
function Tagline({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={`block uppercase text-[#5DCAA5] ${className ?? ""}`}
      style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 300, letterSpacing: "0.3em" }}
    >
      {t("tagline")}
    </span>
  );
}

/** Header logo — horizontal lockup with the rope visible. ~40px tall. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={className} aria-label="Apnos — breathe, dive, repeat">
      <span className="flex items-center gap-2.5">
        <LetterGrid size={17} />
        <DepthRope height={38} />
      </span>
    </Link>
  );
}

/** Large centered lockup for the landing hero — rope prominent + tagline. */
export function ApnosHeroLogo({ className }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center text-center ${className ?? ""}`}>
      <span className="flex items-center gap-5">
        <LetterGrid size={56} />
        <DepthRope height={150} />
      </span>
      <Tagline className="mt-7 text-[0.7rem]" />
    </div>
  );
}

/** App-icon mark — just the letter grid, centered. For favicons / store icons. */
export function ApnosIcon({ size = 512, className }: { size?: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center ${className ?? ""}`}
      style={{ width: size, height: size, background: "#070a10", borderRadius: size * 0.22 }}
    >
      <LetterGrid size={size * 0.3} />
    </div>
  );
}
