import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Trash2, Moon, Brain, Waves, Plus, Pencil, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { deleteDive, divesToCsv, downloadCsv, fetchDives } from "@/lib/dives";
import { disciplineName, formatResult } from "@/lib/diving";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Dive History — Apnos" }] }),
  component: () => (
    <AppLayout>
      <History />
    </AppLayout>
  ),
});

function History() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const { data: dives = [], isLoading } = useQuery({
    queryKey: ["dives", user?.id],
    queryFn: () => fetchDives(user!.id),
    enabled: !!user,
  });

  const remove = useMutation({
    mutationFn: (dive: { id: string; discipline: typeof dives[number]["discipline"] }) =>
      deleteDive(dive.id, user?.id, dive.discipline),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dives", user?.id] });
      toast.success(t("hist.deleted"));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error"),
  });

  const handleExport = () => {
    downloadCsv(`apnos-dives-${new Date().toISOString().slice(0, 10)}.csv`, divesToCsv(dives));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("hist.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("hist.sub")}</p>
        </div>
        {dives.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0 gap-1.5">
            <Download className="size-4" /> {t("common.export")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : dives.length === 0 ? (
        <div className="glass-card flex flex-col items-center rounded-2xl p-10 text-center">
          <Waves className="size-8 text-primary" />
          <p className="mt-3 font-semibold">{t("hist.empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("hist.emptySub")}</p>
          <Button asChild variant="hero" className="mt-5">
            <Link to="/log">
              <Plus className="size-4" /> {t("hist.newDive")}
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {dives.map((dive) => (
            <li key={dive.id} className="glass-card rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {dive.discipline}
                    </span>
                    <Badge variant="secondary" className="text-[0.65rem]">
                      {dive.session_type === "competition" ? t("common.competition") : t("common.training")}
                    </Badge>
                    {dive.federation && (
                      <Badge variant="outline" className="text-[0.65rem]">
                        {dive.federation}
                      </Badge>
                    )}
                    {dive.is_personal_best && (
                      <Badge className="gap-1 bg-[image:var(--gradient-primary)] text-[0.65rem] text-primary-foreground">
                        <Trophy className="size-3" /> PB
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{formatResult(dive.discipline, dive.result)}</p>
                  <p className="text-xs text-muted-foreground">
                    {disciplineName(dive.discipline, lang)} ·{" "}
                    {format(new Date(`${dive.dive_date}T${dive.dive_time ?? "00:00"}`), "d MMM yyyy")}
                    {dive.dive_time ? ` · ${dive.dive_time}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button asChild variant="ghost" size="icon" aria-label={t("common.edit")}>
                    <Link to="/log" search={{ edit: dive.id }}>
                      <Pencil className="size-4 text-muted-foreground" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove.mutate({ id: dive.id, discipline: dive.discipline })}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              {(dive.sleep_hours != null || dive.mental_state != null || dive.food_notes || dive.notes) && (
                <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {dive.sleep_hours != null && (
                      <span className="inline-flex items-center gap-1">
                        <Moon className="size-3.5" /> {t("hist.sleepShort", { h: dive.sleep_hours })}
                      </span>
                    )}
                    {dive.mental_state != null && (
                      <span className="inline-flex items-center gap-1">
                        <Brain className="size-3.5" /> {t("hist.mind", { n: dive.mental_state })}
                      </span>
                    )}
                  </div>
                  {dive.food_notes && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{t("hist.foodLabel")}</span> {dive.food_notes}
                    </p>
                  )}
                  {dive.notes && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{t("hist.notesLabel")}</span> {dive.notes}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
