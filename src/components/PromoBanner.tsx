import { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// ── Promo / tips banner ──────────────────────────────────────────────────────
// The top-of-feed slot the brief asks for: a place we can later drop a promoted
// card or our own advertisement. Until there's an ad to show it stays useful by
// rotating a short freediving / spearfishing tip, so the space is never dead.
// Dismissible for the day (remembered in localStorage) so it never nags.
//
// SSR-safe: the dismissed flag is read in an effect, so the first render always
// includes the banner and server/client markup match.

const TIPS: Record<"apnos" | "spearo", { el: string; en: string }[]> = {
  apnos: [
    {
      el: "Ζέστανε πάντα με χαλαρές αναπνοές πριν από στατική — μην βιάζεσαι.",
      en: "Always warm up with relaxed breathing before a static — never rush it.",
    },
    {
      el: "Κοινοποίησε μια προσπάθεια σήμερα — η παρέα σε βλέπει και σε σπρώχνει.",
      en: "Share an effort today — the crew sees it and pushes you on.",
    },
    {
      el: "Μικρά, σταθερά PBs κρατούν περισσότερο από τα μεγάλα άλματα.",
      en: "Small, steady PBs last longer than big jumps.",
    },
  ],
  spearo: [
    {
      el: "Καλή αναπνοή στην επιφάνεια = καθαρό μυαλό στον πάτο. Ποτέ μόνος.",
      en: "Good surface breathing = a clear head on the bottom. Never alone.",
    },
    {
      el: "Μοιράσου την ψαριά σου — το spot σου μένει πάντα κρυφό.",
      en: "Share your catch — your spot always stays hidden.",
    },
    {
      el: "Σεβάσου τα μεγέθη· άφησε τα μικρά να μεγαλώσουν.",
      en: "Respect the sizes — let the small ones grow.",
    },
  ],
};

export function PromoBanner({ variant }: { variant: "apnos" | "spearo" }) {
  const { lang } = useI18n();
  const [dismissed, setDismissed] = useState(false);

  const dayKey = `apnos:promo-dismissed:${variant}:${new Date().toISOString().slice(0, 10)}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(dayKey) === "1") setDismissed(true);
    } catch {
      /* ignore */
    }
  }, [dayKey]);

  if (dismissed) return null;

  const tips = TIPS[variant];
  // Deterministic "tip of the day" so it doesn't flip on every render.
  const tip = tips[new Date().getDate() % tips.length];

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(dayKey, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="relative flex items-start gap-3 rounded-2xl p-4"
      style={{
        background: "linear-gradient(135deg, rgba(29,158,117,0.14), rgba(83,74,183,0.1))",
        border: "1px solid rgba(93,202,165,0.25)",
      }}
    >
      <span
        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: "rgba(29,158,117,0.18)" }}
      >
        <Lightbulb className="size-4" style={{ color: "#5DCAA5" }} />
      </span>
      <div className="min-w-0 flex-1 pr-5">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#5DCAA5]">
          {lang === "el" ? "Συμβουλή Apnos" : "Apnos tip"}
        </p>
        <p className="mt-1 text-sm leading-snug text-foreground/80">
          {lang === "el" ? tip.el : tip.en}
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={lang === "el" ? "Κλείσιμο" : "Dismiss"}
        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-foreground/40 transition-colors hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
