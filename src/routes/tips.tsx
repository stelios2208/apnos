import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Brain, Ear, Wind, Waves, ShieldAlert, X, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/lib/i18n";
import {
  TIPS, TIP_CATEGORIES, categoryColor, categoryLabel,
  type Tip, type TipCategory,
} from "@/lib/tips";

export const Route = createFileRoute("/tips")({
  head: () => ({ meta: [{ title: "Συμβουλές & Νους — Apnos" }] }),
  component: () => (
    <AppLayout>
      <TipsPage />
    </AppLayout>
  ),
});

const CAT_ICON: Record<TipCategory, LucideIcon> = {
  safety: ShieldAlert,
  eq: Ear,
  mental: Brain,
  relax: Wind,
  technique: Waves,
};

function TipsPage() {
  const { lang } = useI18n();
  const [filter, setFilter] = useState<TipCategory | "all">("all");
  const [open, setOpen] = useState<Tip | null>(null);

  const shown = filter === "all" ? TIPS : TIPS.filter((t) => t.category === filter);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">{lang === "el" ? "Συμβουλές & Νους" : "Tips & Mind"}</h1>
        <p className="text-xs text-white/35">
          {lang === "el" ? "Εξίσωση, νοητική προετοιμασία, χαλάρωση, τεχνική & ασφάλεια" : "Equalization, mental prep, relaxation, technique & safety"}
        </p>
      </div>

      {/* category filter */}
      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} color="#9FE1CB" onClick={() => setFilter("all")}>
          {lang === "el" ? "Όλα" : "All"}
        </FilterChip>
        {TIP_CATEGORIES.map((c) => (
          <FilterChip key={c.id} active={filter === c.id} color={c.color} onClick={() => setFilter(c.id)}>
            {lang === "el" ? c.el : c.en}
          </FilterChip>
        ))}
      </div>

      {/* cards */}
      <div className="space-y-2.5">
        {shown.map((tip) => {
          const color = categoryColor(tip.category);
          const Icon = CAT_ICON[tip.category];
          return (
            <button
              key={tip.id}
              onClick={() => setOpen(tip)}
              className="flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left transition-all active:scale-[0.99]"
              style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.06)", borderLeft: `3px solid ${color}` }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `${color}18`, color }}>
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-white">{lang === "el" ? tip.title_el : tip.title_en}</p>
                  {tip.premium && (
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[0.5rem] font-bold" style={{ background: "rgba(239,159,39,0.18)", color: "#EF9F27" }}>
                      {lang === "el" ? "ΠΡΟΧ." : "ADV"}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider" style={{ color: `${color}cc` }}>
                  {categoryLabel(tip.category, lang)}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-white/20" />
            </button>
          );
        })}
      </div>

      {open && <TipSheet tip={open} lang={lang} onClose={() => setOpen(null)} />}
    </div>
  );
}

function FilterChip({ active, color, onClick, children }: {
  active: boolean; color: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
      style={active
        ? { background: `${color}22`, color, border: `1px solid ${color}55` }
        : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {children}
    </button>
  );
}

function TipSheet({ tip, lang, onClose }: { tip: Tip; lang: string; onClose: () => void }) {
  const color = categoryColor(tip.category);
  const Icon = CAT_ICON[tip.category];
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="max-h-[85vh] overflow-y-auto rounded-t-3xl p-6" style={{ background: "#0a0f1a" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `${color}18`, color }}>
              <Icon className="size-5" />
            </div>
            <div>
              <p className="text-[0.6rem] font-bold uppercase tracking-widest" style={{ color: `${color}cc` }}>
                {categoryLabel(tip.category, lang)}
              </p>
              <h2 className="text-lg font-bold leading-tight text-white">{lang === "el" ? tip.title_el : tip.title_en}</h2>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-white/40"><X className="size-5" /></button>
        </div>
        <p className="text-sm leading-relaxed text-white/70">{lang === "el" ? tip.body_el : tip.body_en}</p>

        {tip.category === "safety" && (
          <p className="mt-4 rounded-xl px-3 py-2 text-[0.7rem]" style={{ background: "rgba(239,107,94,0.08)", border: "1px solid rgba(239,107,94,0.25)", color: "#EF6B5E" }}>
            {lang === "el" ? "Η ασφάλεια είναι πάνω από κάθε επίδοση." : "Safety comes before any performance."}
          </p>
        )}
      </div>
    </div>
  );
}
