import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Share2, Trophy, Waves, Lightbulb, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { fetchDives, personalBests } from "@/lib/dives";
import { disciplineName, formatResult, type DisciplineCode } from "@/lib/diving";
import { fetchProfile } from "@/lib/profile";
import { TIPS, categoryColor, categoryLabel } from "@/lib/tips";
import { fetchTips } from "@/lib/admin-content";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { ShareCardModal } from "@/components/ShareCard";
import { TipModal } from "@/components/TipModal";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Apnos" }] }),
  component: () => (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  ),
});

// ── discipline display order ───────────────────────────────────────────────────
const POOL_ORDER: DisciplineCode[] = ["STA", "DYN", "DYNB", "DNF"];
const DEPTH_ORDER: DisciplineCode[] = ["CWT", "CWTB", "CNF", "FIM"];

// ── helpers ───────────────────────────────────────────────────────────────────

function startOfWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Mon = start
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

function fmtTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── BubbleHero ─────────────────────────────────────────────────────────────────

function BubbleHero({ children }: { children: React.ReactNode }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ns = "http://www.w3.org/2000/svg";
    const bubbles: SVGCircleElement[] = [];
    for (let i = 0; i < 22; i++) {
      const c = document.createElementNS(ns, "circle");
      const x = 5 + Math.random() * 90;
      const r = 0.5 + Math.random() * 2.5;
      const dur = (5 + Math.random() * 7).toFixed(1);
      const delay = -(Math.random() * 9).toFixed(1);
      c.setAttribute("cx", x + "%");
      c.setAttribute("cy", "105%");
      c.setAttribute("r", r + "%");
      c.setAttribute("fill", "#9FE1CB");
      c.style.opacity = (0.15 + Math.random() * 0.45).toFixed(2);
      c.style.animation = `bubble-rise ${dur}s ${delay}s linear infinite`;
      svg.appendChild(c);
      bubbles.push(c);
    }
    return () => bubbles.forEach((b) => b.remove());
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10"
      style={{
        background: "linear-gradient(160deg, #1a3a5c 0%, #10293f 40%, #0a1622 100%)",
        minHeight: 160,
      }}
    >
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="sun-hero" cx="50%" cy="-10%" r="75%">
            <stop offset="0%" stopColor="#5DCAA5" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#1D9E75" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#sun-hero)" />
        <line x1="20%" y1="0" x2="28%" y2="100%" stroke="#5DCAA5" strokeWidth="1" opacity="0.07" />
        <line x1="50%" y1="0" x2="46%" y2="100%" stroke="#5DCAA5" strokeWidth="1" opacity="0.07" />
        <line x1="78%" y1="0" x2="70%" y2="100%" stroke="#5DCAA5" strokeWidth="1" opacity="0.07" />
      </svg>
      <svg
        ref={svgRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
      <div className="relative z-10 p-5">{children}</div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const navigate = useNavigate();

  const { data: dives = [], isLoading } = useQuery({
    queryKey: ["dives", user?.id],
    queryFn: () => fetchDives(user!.id),
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: fetchProfile,
    enabled: !!user,
  });

  const { data: dbTips = [] } = useQuery({
    queryKey: ["tips"],
    queryFn: fetchTips,
  });

  const [showShare, setShowShare] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);

  const bests = personalBests(dives);
  const bestCount = Object.keys(bests).length;
  const bestDive = dives.length > 0 ? dives.reduce((a, b) => (a.result > b.result ? a : b)) : null;

  // rotating tip of the day (stable within a calendar day), preferring the
  // Supabase-managed tips so newly created admin cards appear, with a safe
  // fallback to the hardcoded TIPS array.
  const activeDbTips = dbTips.filter((t) => t.is_active !== false);
  const tipPool = activeDbTips.length > 0 ? activeDbTips : TIPS;
  const tipOfDay = tipPool[Math.floor(Date.now() / 86400000) % tipPool.length]!;

  // weekly stats
  const weekStart = startOfWeek();
  const weekDives = dives.filter((d) => new Date(d.dive_date) >= weekStart);
  const weekSTA = weekDives.filter((d) => d.discipline === "STA");
  const totalHold = weekSTA.reduce((s, d) => s + d.result, 0);
  const weekDist = weekDives
    .filter((d) => !["STA"].includes(d.discipline))
    .reduce((s, d) => s + d.result, 0);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* HERO */}
      <BubbleHero>
        {bestDive ? (
          <>
            <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-[#5DCAA5]">
              {lang === "el" ? "Καλύτερη βουτιά" : "Best dive"}
            </p>
            <p className="text-5xl font-light leading-none tracking-tight text-white">
              {formatResult(bestDive.discipline as DisciplineCode, bestDive.result)}
            </p>
            <p className="mt-2 text-xs text-white/60">
              {disciplineName(bestDive.discipline as DisciplineCode, lang)} ·{" "}
              {new Date(bestDive.dive_date).toLocaleDateString(lang === "el" ? "el-GR" : "en-GB", {
                day: "numeric",
                month: "long",
              })}
            </p>
            <button
              onClick={() => setShowShare(true)}
              className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.65rem] font-bold transition-all active:scale-95"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
              }}
            >
              <Share2 className="size-3.5" />
              {lang === "el" ? "Κοινοποίηση" : "Share"}
            </button>
          </>
        ) : (
          <>
            <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-[#5DCAA5]">
              {lang === "el" ? "Καλωσήρθες στο Apnos" : "Welcome to Apnos"}
            </p>
            <p className="text-2xl font-light text-white">
              {lang === "el" ? "Κατέγραψε την πρώτη σου βουτιά" : "Log your first dive"}
            </p>
          </>
        )}
      </BubbleHero>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-xl p-3">
          <p className="text-2xl font-bold text-foreground">{dives.length}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {lang === "el" ? "Βουτιές φέτος" : "Dives this year"}
          </p>
        </div>
        <div className="glass-card rounded-xl p-3">
          <p className="text-2xl font-bold text-[#5DCAA5]">{bestCount}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {lang === "el" ? "Αγωνίσματα με PB" : "Disciplines with PB"}
          </p>
        </div>
      </div>

      {/* WEEKLY SUMMARY */}
      {weekDives.length > 0 && (
        <div
          className="rounded-2xl px-4 py-3"
          style={{ background: "rgba(29,158,117,0.07)", border: "1px solid rgba(29,158,117,0.15)" }}
        >
          <p className="mb-2 text-[0.6rem] font-bold tracking-[0.2em] text-foreground/30">
            {lang === "el" ? "ΑΥΤΗ ΤΗΝ ΕΒΔΟΜΑΔΑ" : "THIS WEEK"}
          </p>
          <div className="flex items-center gap-5">
            <div>
              <span className="text-xl font-bold text-foreground">{weekDives.length}</span>
              <span className="ml-1.5 text-xs text-foreground/40">
                {lang === "el" ? "βουτιές" : "dives"}
              </span>
            </div>
            {totalHold > 0 && (
              <div>
                <span className="text-xl font-bold" style={{ color: "#5DCAA5" }}>
                  {fmtTime(Math.round(totalHold))}
                </span>
                <span className="ml-1.5 text-xs text-foreground/40">
                  {lang === "el" ? "συνολικό hold" : "total hold"}
                </span>
              </div>
            )}
            {weekDist > 0 && (
              <div>
                <span className="text-xl font-bold" style={{ color: "#9FE1CB" }}>
                  {weekDist}m
                </span>
                <span className="ml-1.5 text-xs text-foreground/40">
                  {lang === "el" ? "απόσταση" : "distance"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PERSONAL BESTS */}
      {dives.length > 0 && (
        <div className="space-y-3">
          <PBGroup
            label={lang === "el" ? "ΠΙΣΙΝΑ" : "POOL"}
            codes={POOL_ORDER}
            bests={bests}
            lang={lang}
            onTap={(code) => navigate({ to: "/history", search: { disc: code } })}
          />
          <PBGroup
            label={lang === "el" ? "ΘΑΛΑΣΣΑ" : "DEPTH"}
            codes={DEPTH_ORDER}
            bests={bests}
            lang={lang}
            onTap={(code) => navigate({ to: "/history", search: { disc: code } })}
          />
        </div>
      )}

      {/* TIP OF THE DAY */}
      <button
        type="button"
        onClick={() => setTipOpen(true)}
        className="block rounded-2xl p-4 transition-all active:scale-[0.99]"
        style={{
          background: "var(--card)",
          border: "1px solid rgba(var(--ink),0.06)",
          borderLeft: `3px solid ${categoryColor(tipOfDay.category)}`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `${categoryColor(tipOfDay.category)}18`,
              color: categoryColor(tipOfDay.category),
            }}
          >
            <Lightbulb className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-[0.58rem] font-bold uppercase tracking-wider"
              style={{ color: `${categoryColor(tipOfDay.category)}cc` }}
            >
              {categoryLabel(tipOfDay.category, lang)} ·{" "}
              {lang === "el" ? "Συμβουλή της ημέρας" : "Tip of the day"}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
              {lang === "el" ? tipOfDay.title_el : tipOfDay.title_en}
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-foreground/20" />
        </div>
      </button>

      {/* LOG NEW */}
      <Button
        asChild
        size="lg"
        className="w-full font-semibold text-white"
        style={{ background: "#1D9E75" }}
      >
        <Link to="/log">
          <Plus className="size-5" />
          {lang === "el" ? "Νέα Βουτιά" : "New Dive"}
        </Link>
      </Button>

      {showShare && bestDive && (
        <ShareCardModal
          data={{
            athleteName: profile?.displayName || (lang === "el" ? "Ελεύθερος Δύτης" : "Freediver"),
            disciplineLabel: disciplineName(bestDive.discipline as DisciplineCode, lang),
            resultLabel: formatResult(bestDive.discipline as DisciplineCode, bestDive.result),
            dateLabel: new Date(bestDive.dive_date).toLocaleDateString(
              lang === "el" ? "el-GR" : "en-GB",
              { day: "numeric", month: "long", year: "numeric" },
            ),
            isPB: true,
            lang,
          }}
          onClose={() => setShowShare(false)}
        />
      )}

      {tipOpen && <TipModal tip={tipOfDay} lang={lang} onClose={() => setTipOpen(false)} />}
    </div>
  );
}

// ── PBGroup ───────────────────────────────────────────────────────────────────

function PBGroup({
  label,
  codes,
  bests,
  lang,
  onTap,
}: {
  label: string;
  codes: DisciplineCode[];
  bests: Record<string, { result: number }>;
  lang: string;
  onTap: (code: DisciplineCode) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[0.6rem] font-bold tracking-[0.2em] text-foreground/25">{label}</p>
      <div className="grid grid-cols-4 gap-2">
        {codes.map((code) => {
          const best = bests[code];
          return (
            <button
              key={code}
              onClick={() => onTap(code)}
              className="flex flex-col items-center gap-1 rounded-2xl px-2 py-3 transition-all active:scale-95"
              style={{
                background: best ? "rgba(29,158,117,0.1)" : "rgba(var(--ink),0.02)",
                border: best ? "1px solid rgba(29,158,117,0.2)" : "1px solid rgba(var(--ink),0.05)",
              }}
            >
              <span
                className="text-[0.55rem] font-bold tracking-wider"
                style={{ color: best ? "#5DCAA5" : "rgba(var(--ink),0.2)" }}
              >
                {code}
              </span>
              <span
                className="font-mono text-sm font-bold tabular-nums"
                style={{ color: best ? "#fff" : "rgba(var(--ink),0.15)" }}
              >
                {best ? formatResult(code, best.result) : "—"}
              </span>
              {best && <Trophy className="size-2.5" style={{ color: "#EF9F27" }} />}
              {!best && <Waves className="size-2.5 opacity-20" style={{ color: "#5DCAA5" }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
