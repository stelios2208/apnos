import { useId } from "react";
import type { CSSProperties } from "react";

// Same geometry as the BreathMark logo (src/components/Logo.tsx).
const ARC = "M25.47 4.96 A16 16 0 1 1 14.53 4.96";

/**
 * The Apnos breath mark as a breathing pacer: a glowing comet segment travels
 * around the logo arc once per `duration` seconds (like an ∞ breath-pacer),
 * while the diver dot gently pulses in the same rhythm.
 * Remount (change `key`) to restart the sweep from the top of a phase.
 */
export function LogoBreathPacer({
  size = 230,
  color,
  duration = 8,
  paused = false,
  className,
}: {
  size?: number;
  color: string;
  duration?: number;
  paused?: boolean;
  className?: string;
}) {
  const glowId = useId();
  const sweepStyle = {
    "--sweep-dur": `${duration}s`,
    animationPlayState: paused ? "paused" : "running",
  } as CSSProperties;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      style={{ filter: `drop-shadow(0 0 ${size / 16}px ${color}40)` }}
      aria-hidden="true"
    >
      <defs>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>

      {/* dim track — the full logo arc */}
      <path d={ARC} stroke="rgba(255,255,255,0.13)" strokeWidth="2.6" strokeLinecap="round" />

      {/* soft halo of the comet (blurred copy underneath) */}
      <path
        d={ARC}
        pathLength={100}
        className="pacer-sweep"
        stroke={color}
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeDasharray="30 70"
        opacity="0.55"
        filter={`url(#${glowId})`}
        style={sweepStyle}
      />

      {/* crisp comet segment */}
      <path
        d={ARC}
        pathLength={100}
        className="pacer-sweep"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeDasharray="30 70"
        style={sweepStyle}
      />

      {/* diver dot — breathes with the sweep */}
      <circle cx="20" cy="25" r="4.2" fill={color} className="pacer-core" style={sweepStyle} />
      <circle cx="20" cy="15.5" r="1.05" fill="rgba(255,255,255,0.45)" />
      <circle cx="20" cy="19.2" r="1.5" fill="rgba(255,255,255,0.6)" />
    </svg>
  );
}
