import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trophy, Waves } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { fetchDives, personalBests } from "@/lib/dives";
import { DISCIPLINES, disciplineName, formatResult, DisciplineCode } from "@/lib/diving";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Apnos" }] }),
  component: () => (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  ),
});

/* Animated bubble canvas */
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
    <div className="relative overflow-hidden rounded-2xl border border-white/10" style={{
      background: "linear-gradient(160deg, #1a3a5c 0%, #10293f 40%, #070a10 100%)",
      minHeight: 160,
    }}>
      {/* light rays */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" aria-hidden="true">
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
      {/* bubbles */}
      <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />
      {/* content */}
      <div className="relative z-10 p-5">{children}</div>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const { data: dives = [], isLoading } = useQuery({
    queryKey: ["dives", user?.id],
    queryFn: () => fetchDives(user!.id),
    enabled: !!user,
  });

  const bests = personalBests(dives);
  const totalDives = dives.length;
  const bestCount = Object.keys(bests).length;

  // Best dive of the year (deepest/longest)
  const bestDive = dives.length > 0 ? dives.reduce((a, b) => (a.result > b.result ? a : b)) : null;

  return (
    <div className="space-y-5">

      {/* HERO */}
      <BubbleHero>
        {bestDive ? (
          <>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-[#5DCAA5] mb-2">
              {lang === "el" ? "Καλύτερη βουτιά φέτος" : "Best dive this year"}
            </p>
            <p className="text-5xl font-light tracking-tight text-white leading-none">
              {formatResult(bestDive.discipline as DisciplineCode, bestDive.result)}
            </p>
            <p className="mt-2 text-xs text-white/50">
              {disciplineName(bestDive.discipline as DisciplineCode, lang)} ·{" "}
              {new Date(bestDive.dive_date).toLocaleDateString(lang === "el" ? "el-GR" : "en-GB", {
                day: "numeric", month: "long",
              })}
            </p>
          </>
        ) : (
          <>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-[#5DCAA5] mb-2">
              {lang === "el" ? "Καλωσήρθες στο Apnos" : "Welcome to Apnos"}
            </p>
            <p className="text-2xl font-light text-white">
              {lang === "el" ? "Κατέγραψε την πρώτη σου βουτιά" : "Log your first dive"}
            </p>
          </>
        )}
      </BubbleHero>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card rounded-xl p-3">
          <p className="text-2xl font-bold text-white">{totalDives}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lang === "el" ? "Βουτιές φέτος" : "Dives this year"}
          </p>
        </div>
        <div className="glass-card rounded-xl p-3">
          <p className="text-2xl font-bold text-[#5DCAA5]">{bestCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lang === "el" ? "Αγωνίσματα με PB" : "Disciplines with PB"}
          </p>
        </div>
      </div>

      {/* PB GRID */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Personal bests
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {DISCIPLINES.map((d) => {
            const best = bests[d.code];
            return (
              <Link
                key={d.code}
                to="/discipline/$code"
                params={{ code: d.code }}
                className={cn(
                  "glass-card rounded-2xl p-4 transition-transform hover:scale-[1.02]",
                  best ? "ring-1 ring-[#1D9E75]/40" : "opacity-60",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#5DCAA5]">{d.code}</span>
                  {best ? (
                    <Trophy className="size-3.5 text-[#EF9F27]" />
                  ) : (
                    <Waves className="size-3.5 text-muted-foreground" />
                  )}
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-white">
                  {best ? formatResult(d.code, best.result) : "—"}
                </p>
                {best && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[0.6rem] font-medium uppercase tracking-wide bg-[#EF9F27]/15 text-[#EF9F27] px-2 py-0.5 rounded-full">
                    PB
                  </span>
                )}
                <p className="mt-0.5 truncate text-[0.7rem] text-muted-foreground">{disciplineName(d.code, lang)}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* LOG NEW */}
      <Button asChild size="lg" className="w-full bg-[#1D9E75] hover:bg-[#5DCAA5] text-white font-semibold">
        <Link to="/log">
          <Plus className="size-5" /> {t("dash.logNew")}
        </Link>
      </Button>

    </div>
  );
}