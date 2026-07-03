import { createFileRoute, Link } from "@tanstack/react-router";
import { Backpack, BookOpen, Settings, ChevronRight, UserCircle, Trophy, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/you")({
  head: () => ({ meta: [{ title: "You — Apnos" }] }),
  component: () => (
    <AppLayout>
      <YouHub />
    </AppLayout>
  ),
});

interface HubItem {
  to: string;
  icon: LucideIcon;
  accent: string;
  title_el: string; title_en: string;
  sub_el: string;   sub_en: string;
}

const ITEMS: HubItem[] = [
  { to: "/equipment", icon: Backpack, accent: "#EF9F27", title_el: "Εξοπλισμός",  title_en: "Equipment", sub_el: "Στολές, πτερύγια, βαρίδια, checklist", sub_en: "Suits, fins, weights, checklist" },
  { to: "/rules",     icon: BookOpen, accent: "#5DCAA5", title_el: "Κανόνες",     title_en: "Rules",     sub_el: "Πειθαρχίες & κανονισμοί αγώνων",       sub_en: "Disciplines & competition rules" },
  { to: "/settings",  icon: Settings, accent: "#9FE1CB", title_el: "Ρυθμίσεις",   title_en: "Settings",  sub_el: "Γλώσσα, λογαριασμός, προτιμήσεις",     sub_en: "Language, account, preferences" },
];

const SOON: { icon: LucideIcon; title_el: string; title_en: string; sub_el: string; sub_en: string }[] = [
  { icon: UserCircle, title_el: "Προφίλ Αθλητή", title_en: "Athlete Profile", sub_el: "Δημόσιο/ιδιωτικό, στοιχεία, φωτό",  sub_en: "Public/private, stats, photo" },
  { icon: Trophy,     title_el: "Ρεκόρ & Κατατάξεις", title_en: "Records & Rankings", sub_el: "CMAS/AIDA, πανελλήνια, θάλασσα & πισίνα", sub_en: "CMAS/AIDA, national, sea & pool" },
  { icon: Store,      title_el: "Directory", title_en: "Directory", sub_el: "Εκπαιδευτές & εξοπλισμός",         sub_en: "Instructors & gear" },
];

function YouHub() {
  const { lang } = useI18n();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">{lang === "el" ? "Εσύ" : "You"}</h1>
        <p className="text-xs text-white/35">{lang === "el" ? "Το προφίλ, ο εξοπλισμός και οι ρυθμίσεις σου" : "Your profile, gear and settings"}</p>
      </div>

      <div className="space-y-3">
        {ITEMS.map(({ to, icon: Icon, accent, title_el, title_en, sub_el, sub_en }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-4 rounded-2xl px-4 py-4 transition-all active:scale-[0.99]"
            style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.06)", borderLeft: `3px solid ${accent}` }}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `${accent}18`, color: accent }}>
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">{lang === "el" ? title_el : title_en}</p>
              <p className="mt-0.5 text-[0.72rem] text-white/40">{lang === "el" ? sub_el : sub_en}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-white/20" />
          </Link>
        ))}
      </div>

      {/* roadmap teasers */}
      <p className="pt-2 text-[0.6rem] font-bold tracking-[0.25em] text-white/25">
        {lang === "el" ? "ΕΡΧΟΝΤΑΙ ΣΥΝΤΟΜΑ" : "COMING SOON"}
      </p>
      <div className="space-y-3">
        {SOON.map(({ icon: Icon, title_el, title_en, sub_el, sub_en }, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-2xl px-4 py-4"
            style={{ background: "rgba(255,255,255,0.015)", border: "1px dashed rgba(255,255,255,0.08)" }}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.25)" }}>
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white/45">{lang === "el" ? title_el : title_en}</p>
              <p className="mt-0.5 text-[0.72rem] text-white/25">{lang === "el" ? sub_el : sub_en}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
