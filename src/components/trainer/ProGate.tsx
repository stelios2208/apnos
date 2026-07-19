import { Lock, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// ── PRO gate presentation kit ────────────────────────────────────────────────
// Shared visuals for the freemium blur-teaser: locked content stays visible in
// lists (title + PRO badge) but its instructional text is blurred (.pro-blur —
// pure CSS, non-selectable) under a lock + unlock hint. The lock DECISION
// always comes from lib/premium.ts; these components only present it.

const PRO_AMBER = "#EF9F27";

export function ProBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[0.5rem] font-bold ${className}`}
      style={{ background: "rgba(239,159,39,0.18)", color: PRO_AMBER }}
    >
      PRO
    </span>
  );
}

/** Centred lock + unlock hint, laid over blurred content (parent: relative). */
export function ProLockOverlay() {
  const { t } = useI18n();
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 px-6 text-center">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full"
        style={{ background: "rgba(239,159,39,0.16)", border: `1px solid ${PRO_AMBER}55` }}
      >
        <Lock className="size-4" style={{ color: PRO_AMBER }} />
      </span>
      <span className="text-[0.65rem] font-semibold leading-snug text-white/70">
        {t("pro.unlockHint")}
      </span>
    </div>
  );
}

/**
 * Blurred preview shown when a locked item is tapped: name + PRO badge render
 * normally, the content lines are blurred and unreadable, the lock overlay
 * carries the unlock hint. Never renders a usable session.
 */
export function ProPreviewModal({
  title,
  lines,
  accent = "#5DCAA5",
  onClose,
}: {
  title: string;
  lines: string[];
  accent?: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="rounded-t-3xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        style={{ background: "#0a0f1a", borderTop: `2px solid ${accent}44` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-bold text-white">{title}</h2>
            <ProBadge />
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40">
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-0.5 text-[0.62rem] font-semibold tracking-wider text-white/35">
          {t("pro.preview").toUpperCase()}
        </p>

        <div className="relative mt-4">
          <div className="pro-blur space-y-2" aria-hidden="true">
            {lines.map((line, i) => (
              <div
                key={i}
                className="rounded-lg px-3 py-2 text-[0.72rem] leading-snug text-white/70"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                {line}
              </div>
            ))}
          </div>
          <ProLockOverlay />
        </div>
      </div>
    </div>
  );
}
