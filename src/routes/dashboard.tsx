import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trophy, Waves } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { fetchDives, personalBests } from "@/lib/dives";
import { DISCIPLINES, disciplineName, formatResult } from "@/lib/diving";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Apnos" }] }),
  component: () => (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  ),
});

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("dash.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading ? t("dash.loadingDives") : t("dash.summary", { dives: totalDives, disc: bestCount })}
        </p>
      </div>

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
                best ? "ring-1 ring-primary/30" : "opacity-70",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">{d.code}</span>
                {best ? (
                  <Trophy className="size-3.5 text-primary" />
                ) : (
                  <Waves className="size-3.5 text-muted-foreground" />
                )}
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {best ? formatResult(d.code, best.result) : "—"}
              </p>
              <p className="mt-0.5 truncate text-[0.7rem] text-muted-foreground">{disciplineName(d.code, lang)}</p>
            </Link>
          );
        })}
      </div>

      <Button asChild variant="hero" size="lg" className="w-full">
        <Link to="/log">
          <Plus className="size-5" /> {t("dash.logNew")}
        </Link>
      </Button>
    </div>
  );
}
