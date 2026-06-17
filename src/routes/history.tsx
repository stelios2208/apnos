import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Trash2, Moon, Brain, Waves, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { deleteDive, fetchDives } from "@/lib/dives";
import { DISCIPLINE_MAP, formatResult } from "@/lib/diving";
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
  const queryClient = useQueryClient();
  const { data: dives = [], isLoading } = useQuery({
    queryKey: ["dives", user?.id],
    queryFn: () => fetchDives(user!.id),
    enabled: !!user,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dives", user?.id] });
      toast.success("Dive deleted");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not delete"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dive history</h1>
        <p className="text-sm text-muted-foreground">Every session you've logged.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : dives.length === 0 ? (
        <div className="glass-card flex flex-col items-center rounded-2xl p-10 text-center">
          <Waves className="size-8 text-primary" />
          <p className="mt-3 font-semibold">No dives yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Log your first session to get started.</p>
          <Button asChild variant="hero" className="mt-5">
            <Link to="/log">
              <Plus className="size-4" /> New dive
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {dives.map((dive) => {
            const d = DISCIPLINE_MAP[dive.discipline];
            return (
              <li key={dive.id} className="glass-card rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {dive.discipline}
                      </span>
                      <Badge variant="secondary" className="text-[0.65rem] capitalize">
                        {dive.session_type}
                      </Badge>
                      {dive.is_personal_best && (
                        <Badge className="gap-1 bg-[image:var(--gradient-primary)] text-[0.65rem] text-primary-foreground">
                          <Trophy className="size-3" /> PB
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-2xl font-bold tabular-nums">
                      {formatResult(dive.discipline, dive.result)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d?.name} ·{" "}
                      {format(new Date(`${dive.dive_date}T${dive.dive_time ?? "00:00"}`), "d MMM yyyy")}
                      {dive.dive_time ? ` · ${dive.dive_time}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove.mutate(dive.id)}
                    aria-label="Delete dive"
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>

                {(dive.sleep_hours != null || dive.mental_state != null || dive.food_notes || dive.notes) && (
                  <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {dive.sleep_hours != null && (
                        <span className="inline-flex items-center gap-1">
                          <Moon className="size-3.5" /> {dive.sleep_hours}h sleep
                        </span>
                      )}
                      {dive.mental_state != null && (
                        <span className="inline-flex items-center gap-1">
                          <Brain className="size-3.5" /> Mind {dive.mental_state}/5
                        </span>
                      )}
                    </div>
                    {dive.food_notes && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Food:</span> {dive.food_notes}
                      </p>
                    )}
                    {dive.notes && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Notes:</span> {dive.notes}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
