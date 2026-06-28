import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

export function Logo({ className, size = 40 }: { className?: string; size?: number }) {
  const { t } = useI18n();
  return (
    <Link to="/" className={className} aria-label="Apnos — breathe, dive, repeat">
      <span className="flex items-center gap-2.5">
        <BreathMark size={size} />
        <span className="block">
          <span className="block text-2xl font-semibold lowercase leading-none tracking-tight text-white">
            apnos
          </span>
          <span className="mt-1 block text-[0.55rem] font-medium lowercase tracking-[0.28em] text-[#5DCAA5]">
            {t("tagline")}
          </span>
        </span>
      </span>
    </Link>
  );
}

export function BreathMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="apnos-breath" x1="6" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5DCAA5" />
          <stop offset="1" stopColor="#1D9E75" />
        </linearGradient>
        <radialGradient id="apnos-fall" cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#7BD9B8" />
          <stop offset="100%" stopColor="#1D9E75" />
        </radialGradient>
      </defs>
      <path
        d="M25.47 4.96 A16 16 0 1 1 14.53 4.96"
        stroke="url(#apnos-breath)"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="20" cy="25" r="4.2" fill="url(#apnos-fall)" />
      <circle cx="20" cy="15.5" r="1.05" fill="#5DCAA5" opacity="0.55" />
      <circle cx="20" cy="19.2" r="1.5" fill="#5DCAA5" opacity="0.8" />
    </svg>
  );
}

export function ApnosHeroLogo({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div className={`flex flex-col items-center text-center ${className ?? ""}`}>
      <BreathMark size={132} />
      <span className="mt-5 text-5xl font-light lowercase tracking-[0.22em] text-white">
        apnos
      </span>
      <span className="mt-3 text-xs font-medium lowercase tracking-[0.3em] text-[#5DCAA5]">
        {t("tagline")}
      </span>
    </div>
  );
}
