import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Plus,
  Waves,
  Flame,
  Timer,
  TimerReset,
  Users,
  CalendarDays,
  Brain,
  ChevronRight,
  Table,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/train")({
  head: () => ({ meta: [{ title: "Train — Apnos" }] }),
  component: () => (
    <AppLayout>
      <TrainHub />
    </AppLayout>
  ),
});

interface HubItem {
  to: string;
  icon: LucideIcon;
  accent: string;
  title_el: string;
  title_en: string;
  sub_el: string;
  sub_en: string;
}

const ITEMS: HubItem[] = [
  {
    to: "/log",
    icon: Plus,
    accent: "#1D9E75",
    title_el: "Καταγραφή βουτιάς",
    title_en: "Log a dive",
    sub_el: "Γρήγορη καταχώρηση επίδοσης",
    sub_en: "Quick record a performance",
  },
  {
    to: "/sta-trainer",
    icon: Waves,
    accent: "#5DCAA5",
    title_el: "Στατική Trainer",
    title_en: "Static Trainer",
    sub_el: "Καθοδηγούμενη στατική με ήχο",
    sub_en: "Guided static with soundscape",
  },
  {
    to: "/sta-tables",
    icon: Table,
    accent: "#1D9E75",
    title_el: "Πίνακες STA",
    title_en: "STA Tables",
    sub_el: "CO₂ / O₂ tables από το PB σου",
    sub_en: "CO₂ / O₂ tables from your PB",
  },
  {
    to: "/stopwatch",
    icon: TimerReset,
    accent: "#4FA8E0",
    title_el: "Χρονόμετρο",
    title_en: "Stopwatch",
    sub_el: "Lap chrono πισίνας — γίνεται βουτιά",
    sub_en: "Pool lap chrono — becomes a dive",
  },
  {
    to: "/warmup",
    icon: Flame,
    accent: "#EF9F27",
    title_el: "Ζέσταμα",
    title_en: "Warm-up",
    sub_el: "Έτοιμα ζεστάματα + ειδοποιήσεις",
    sub_en: "Ready warm-ups + hold alerts",
  },
  {
    to: "/planner",
    icon: Timer,
    accent: "#4FA8E0",
    title_el: "Σχεδίασε τη βουτιά σου",
    title_en: "Plan your dive",
    sub_el: "Στόχος, top time, ζέσταμα & συνθήκες",
    sub_en: "Target, top time, warm-up & conditions",
  },
  {
    to: "/tips",
    icon: Brain,
    accent: "#B58BE8",
    title_el: "Συμβουλές & Νους",
    title_en: "Tips & Mind",
    sub_el: "Εξίσωση, νους, χαλάρωση, ασφάλεια",
    sub_en: "EQ, mind, relaxation, safety",
  },
  {
    to: "/coach",
    icon: Users,
    accent: "#7ED9C3",
    title_el: "Coach Programs",
    title_en: "Coach Programs",
    sub_el: "Η ομάδα & τα προγράμματά σου",
    sub_en: "Your team & programmes",
  },
  {
    to: "/calendar",
    icon: CalendarDays,
    accent: "#7ED9C3",
    title_el: "Ημερολόγιο",
    title_en: "Calendar",
    sub_el: "Οι προπονήσεις σου στο χρόνο",
    sub_en: "Your sessions over time",
  },
];

function TrainHub() {
  const { lang } = useI18n();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {lang === "el" ? "Προπόνηση" : "Train"}
        </h1>
        <p className="text-xs text-foreground/35">
          {lang === "el"
            ? "Όλα τα εργαλεία προπόνησης σε ένα σημείο"
            : "All your training tools in one place"}
        </p>
      </div>

      <div className="space-y-3">
        {ITEMS.map(({ to, icon: Icon, accent, title_el, title_en, sub_el, sub_en }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-4 rounded-2xl px-4 py-4 transition-all active:scale-[0.99]"
            style={{
              background: "var(--card)",
              border: "1px solid rgba(var(--ink),0.06)",
              borderLeft: `3px solid ${accent}`,
            }}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ background: `${accent}18`, color: accent }}
            >
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">
                {lang === "el" ? title_el : title_en}
              </p>
              <p className="mt-0.5 text-[0.72rem] text-foreground/40">
                {lang === "el" ? sub_el : sub_en}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-foreground/20" />
          </Link>
        ))}
      </div>
    </div>
  );
}
