import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

export function Logo({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <Link to="/" className={className} aria-label="Apnos">
      <span className="flex items-center gap-2.5">
        <RopeMark />
        <span className="block">
          <span className="block text-2xl font-extrabold lowercase leading-none tracking-tight text-white">
            apnos
          </span>
          <span className="mt-1 block text-[0.55rem] font-medium uppercase tracking-[0.3em] text-[#5DCAA5]">
            {t("tagline")}
          </span>
        </span>
      </span>
    </Link>
  );
}

/** Vertical dive rope with three progressively larger dots. */
export function RopeMark({ className }: { className?: string }) {
  return (
    <svg
      width="22"
      height="40"
      viewBox="0 0 22 40"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <line x1="11" y1="2" x2="11" y2="38" stroke="url(#rope)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="11" cy="9" r="2.4" fill="#9FE1CB" />
      <circle cx="11" cy="21" r="3.4" fill="#5DCAA5" />
      <circle cx="11" cy="34" r="4.6" fill="#1D9E75" />
      <defs>
        <linearGradient id="rope" x1="11" y1="2" x2="11" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9FE1CB" stopOpacity="0.6" />
          <stop offset="1" stopColor="#1D9E75" />
        </linearGradient>
      </defs>
    </svg>
  );
}
