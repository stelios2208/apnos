import { X, Lightbulb } from "lucide-react";
import { categoryColor, categoryLabel, type TipCategory } from "@/lib/tips";

// Accepts both the hardcoded lib/tips Tip and the Supabase admin-content Tip.
type TipLike = {
  category: TipCategory;
  title_el: string;
  title_en: string;
  body_el: string;
  body_en: string;
  premium?: boolean;
};

export function TipModal({
  tip,
  lang,
  onClose,
}: {
  tip: TipLike;
  lang: string;
  onClose: () => void;
}) {
  const color = categoryColor(tip.category);
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="rounded-t-3xl p-5"
        style={{ background: "var(--popover)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ background: `${color}18`, color }}
            >
              <Lightbulb className="size-5" />
            </div>
            <div>
              <p
                className="text-[0.58rem] font-bold uppercase tracking-wider"
                style={{ color: `${color}cc` }}
              >
                {categoryLabel(tip.category, lang)} ·{" "}
                {lang === "el" ? "Συμβουλή της ημέρας" : "Tip of the day"}
              </p>
              <h2 className="mt-0.5 text-base font-bold leading-snug text-foreground">
                {lang === "el" ? tip.title_el : tip.title_en}
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-foreground/40">
            <X className="size-5" />
          </button>
        </div>

        {tip.premium && (
          <span
            className="mb-3 inline-block rounded-full px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider"
            style={{ background: `${color}18`, color }}
          >
            {lang === "el" ? "ΠΡΟΧ." : "ADV"}
          </span>
        )}

        <p className="text-sm leading-relaxed text-foreground/80">
          {lang === "el" ? tip.body_el : tip.body_en}
        </p>
      </div>
    </div>
  );
}
