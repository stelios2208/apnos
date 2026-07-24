import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Backpack,
  BookOpen,
  Settings,
  UserCircle,
  Trophy,
  Store,
  LayoutDashboard,
  Waves,
  History,
  CalendarDays,
  ClipboardList,
  Wind,
  Timer,
  LayoutGrid,
  Gauge,
  Target,
  Menu,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/lib/i18n";
import { useMode } from "@/hooks/use-mode";
import { nativeVibrate } from "@/lib/native";

export const Route = createFileRoute("/you")({
  head: () => ({ meta: [{ title: "You — Apnos" }] }),
  component: () => (
    <AppLayout>
      <YouHub />
    </AppLayout>
  ),
});

interface Tile {
  to: string;
  icon: LucideIcon;
  accent: string;
  title_el: string;
  title_en: string;
  sub_el: string;
  sub_en: string;
  soon?: boolean;
}

interface Section {
  label_el: string;
  label_en: string;
  tiles: Tile[];
}

// Everything reachable from the app lives here, grouped so a diver can scan it
// at a glance — this is the "menu grid" the bottom-nav "Μενού" button opens.
// `Αρχική` is patched in per-mode below (dashboard for Apnos, the feed for
// Spearo) so Home stays one tap away now that it left the bottom bar.
const SECTIONS: Section[] = [
  {
    label_el: "Πλοήγηση",
    label_en: "Navigation",
    tiles: [
      // to for "Αρχική" is filled in at render time (mode-aware).
      {
        to: "",
        icon: LayoutDashboard,
        accent: "#1D9E75",
        title_el: "Αρχική",
        title_en: "Home",
        sub_el: "Η ροή σου",
        sub_en: "Your feed",
      },
      {
        to: "/train",
        icon: Waves,
        accent: "#5DCAA5",
        title_el: "Προπόνηση",
        title_en: "Train",
        sub_el: "Ασκήσεις & σετ",
        sub_en: "Drills & sets",
      },
      {
        to: "/history",
        icon: History,
        accent: "#4FA8E0",
        title_el: "Πρόοδος",
        title_en: "Progress",
        sub_el: "Ιστορικό βουτιών",
        sub_en: "Dive history",
      },
    ],
  },
  {
    label_el: "Προφίλ",
    label_en: "Profile",
    tiles: [
      {
        to: "/profile",
        icon: UserCircle,
        accent: "#1D9E75",
        title_el: "Προφίλ Αθλητή",
        title_en: "Athlete Profile",
        sub_el: "Στοιχεία, δημόσιο",
        sub_en: "Details, public",
      },
      {
        to: "/equipment",
        icon: Backpack,
        accent: "#EF9F27",
        title_el: "Εξοπλισμός",
        title_en: "Equipment",
        sub_el: "Στολές, πτερύγια",
        sub_en: "Suits, fins",
      },
      {
        to: "/settings",
        icon: Settings,
        accent: "#9FE1CB",
        title_el: "Ρυθμίσεις",
        title_en: "Settings",
        sub_el: "Γλώσσα, λογαριασμός",
        sub_en: "Language, account",
      },
    ],
  },
  {
    label_el: "Αγώνες & Ρεκόρ",
    label_en: "Compete & Records",
    tiles: [
      {
        to: "/performances",
        icon: Trophy,
        accent: "#EF9F27",
        title_el: "Ρεκόρ & Κατατάξεις",
        title_en: "Records & Rankings",
        sub_el: "Verified επιδόσεις",
        sub_en: "Verified results",
      },
      {
        to: "/rules",
        icon: BookOpen,
        accent: "#5DCAA5",
        title_el: "Κανόνες",
        title_en: "Rules",
        sub_el: "Κανονισμοί αγώνων",
        sub_en: "Competition rules",
      },
      {
        to: "/calendar",
        icon: CalendarDays,
        accent: "#4FA8E0",
        title_el: "Ημερολόγιο",
        title_en: "Calendar",
        sub_el: "Πρόγραμμα",
        sub_en: "Schedule",
      },
    ],
  },
  {
    label_el: "Προπόνηση & Εργαλεία",
    label_en: "Training & Tools",
    tiles: [
      {
        to: "/planner",
        icon: ClipboardList,
        accent: "#1D9E75",
        title_el: "Πλάνο",
        title_en: "Plan",
        sub_el: "Σετ & στόχοι",
        sub_en: "Sets & goals",
      },
      {
        to: "/warmup",
        icon: Wind,
        accent: "#5DCAA5",
        title_el: "Προθέρμανση",
        title_en: "Warm-up",
        sub_el: "Πριν τη βουτιά",
        sub_en: "Before diving",
      },
      {
        to: "/stopwatch",
        icon: Timer,
        accent: "#4FA8E0",
        title_el: "Χρονόμετρο",
        title_en: "Stopwatch",
        sub_el: "Χρόνοι άπνοιας",
        sub_en: "Apnea timing",
      },
      {
        to: "/sta-tables",
        icon: LayoutGrid,
        accent: "#9FE1CB",
        title_el: "STA Πίνακες",
        title_en: "STA Tables",
        sub_el: "Στατική άπνοια",
        sub_en: "Static apnea",
      },
      {
        to: "/tools/co2-o2-tables",
        icon: Gauge,
        accent: "#EF9F27",
        title_el: "CO₂ / O₂",
        title_en: "CO₂ / O₂",
        sub_el: "Πίνακες ανοχής",
        sub_en: "Tolerance tables",
      },
      {
        to: "/coach",
        icon: Target,
        accent: "#5DCAA5",
        title_el: "Coach",
        title_en: "Coach",
        sub_el: "Αθλητές & πλάνα",
        sub_en: "Athletes & plans",
      },
    ],
  },
  {
    label_el: "Περισσότερα",
    label_en: "More",
    tiles: [
      {
        to: "",
        icon: Store,
        accent: "#9FE1CB",
        title_el: "Directory",
        title_en: "Directory",
        sub_el: "Εκπαιδευτές & εξοπλισμός",
        sub_en: "Instructors & gear",
        soon: true,
      },
    ],
  },
];

function YouHub() {
  const { lang } = useI18n();
  const { mode } = useMode();
  const el = lang === "el";
  const homeTo = mode === "spearo" ? "/spearo" : "/dashboard";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <Menu className="size-7 text-[#5DCAA5]" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{el ? "Μενού" : "Menu"}</h1>
          <p className="text-xs text-foreground/35">
            {el ? "Όλα όσα χρειάζεσαι — οργανωμένα" : "Everything you need — organised"}
          </p>
        </div>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.label_en}>
          <p className="flex items-center gap-3 pb-2.5 pt-3 text-[0.6rem] font-bold tracking-[0.24em] text-foreground/35">
            {el ? section.label_el : section.label_en}
            <span className="h-px flex-1 bg-border/60" />
          </p>

          <div className="grid grid-cols-3 gap-2.5">
            {section.tiles.map((tile) => {
              const to = tile.title_en === "Home" ? homeTo : tile.to;
              return <MenuTile key={tile.title_en} tile={tile} to={to} el={el} />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function MenuTile({ tile, to, el }: { tile: Tile; to: string; el: boolean }) {
  const { icon: Icon, accent } = tile;
  const title = el ? tile.title_el : tile.title_en;
  const sub = el ? tile.sub_el : tile.sub_en;

  const inner = (
    <>
      {tile.soon && (
        <span
          className="absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[0.42rem] font-black tracking-[0.1em]"
          style={{ background: `${accent}33`, color: accent }}
        >
          {el ? "ΣΥΝΤΟΜΑ" : "SOON"}
        </span>
      )}
      <span
        className="flex size-10 items-center justify-center rounded-[13px]"
        style={{
          background: `${accent}26`,
          color: accent,
          boxShadow: `inset 0 0 0 1px ${accent}38`,
        }}
      >
        <Icon className="size-5" />
      </span>
      <span className="block">
        <span className="block text-[0.82rem] font-bold leading-tight text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block text-[0.6rem] leading-tight text-foreground/40">{sub}</span>
      </span>
    </>
  );

  const cls =
    "surface-2 relative flex flex-col gap-2.5 overflow-hidden rounded-[20px] px-3 pb-3 pt-3.5";
  const style = {
    background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))",
    border: "1px solid rgba(var(--ink),0.07)",
  };

  if (tile.soon) {
    return (
      <div className={cls} style={{ ...style, opacity: 0.55, borderStyle: "dashed" }}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      to={to}
      onClick={() => nativeVibrate(10)}
      className={`pressable ${cls}`}
      style={style}
    >
      {inner}
    </Link>
  );
}
