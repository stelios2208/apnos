import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { deleteDive, fetchDives } from "@/lib/dives";
import { disciplineName, formatResult } from "@/lib/diving";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dive/$id")({
  head: () => ({ meta: [{ title: "Dive — Apnos" }] }),
  component: () => (
    <AppLayout>
      <DiveDetail />
    </AppLayout>
  ),
});

// ── helpers ────────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-xs font-medium text-white/80 text-right">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-1">
      <p className="text-[0.65rem] font-bold tracking-[0.2em] text-white/30 mb-2">{title}</p>
      {children}
    </div>
  );
}

// ── component ──────────────────────────────────────────────────────────────────

function DiveDetail() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = Route.useParams();

  const { data: dives = [], isLoading } = useQuery({
    queryKey: ["dives", user?.id],
    queryFn: () => fetchDives(user!.id),
    enabled: !!user,
  });

  const dive = dives.find((d) => d.id === id);

  const remove = useMutation({
    mutationFn: () => deleteDive(id, user!.id, dive!.discipline),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dives", user?.id] });
      toast.success(lang === "el" ? "Η βουτιά διαγράφηκε" : "Dive deleted");
      navigate({ to: "/history" });
    },
    onError: () => toast.error(lang === "el" ? "Σφάλμα διαγραφής" : "Could not delete"),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!dive) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{lang === "el" ? "Η βουτιά δεν βρέθηκε." : "Dive not found."}</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/history"><ArrowLeft className="size-4 mr-1" />{t("common.back")}</Link>
        </Button>
      </div>
    );
  }

  const border = dive.is_personal_best ? "#EF9F27" : "#1D9E75";
  const dateStr = format(new Date(`${dive.dive_date}T${dive.dive_time ?? "00:00"}`), "d MMM yyyy");

  const hasGear = dive.neck_weight != null || dive.belt_weight != null ||
    dive.wetsuit_mm != null || dive.fins_brand || dive.fins_model ||
    dive.foot_pocket || dive.water_temp != null || dive.buoyancy;

  const wetsuitLabel = dive.wetsuit_mm ? `${dive.wetsuit_mm} mm` : (lang === "el" ? "Χωρίς στολή" : "No wetsuit");

  const buoyancyLabel: Record<string, string> = lang === "el"
    ? { negative: "Αρνητική", neutral: "Ουδέτερη", positive: "Θετική" }
    : { negative: "Negative", neutral: "Neutral", positive: "Positive" };

  return (
    <div className="space-y-5">
      {/* back */}
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5 text-white/50 hover:text-white">
        <Link to="/history"><ArrowLeft className="size-4" />{t("common.back")}</Link>
      </Button>

      {/* header card */}
      <div
        className="glass-card rounded-2xl p-5 space-y-3"
        style={{ borderLeft: `3px solid ${border}` }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-md px-2.5 py-1 text-xs font-bold tracking-wider"
            style={{ background: "rgba(29,158,117,0.15)", color: "#5DCAA5" }}
          >
            {dive.discipline}
          </span>
          <span className="text-xs text-white/40">{disciplineName(dive.discipline, lang)}</span>
          {dive.is_personal_best && (
            <span
              className="rounded-md px-2 py-0.5 text-[0.6rem] font-bold"
              style={{ background: "rgba(239,159,39,0.15)", color: "#EF9F27" }}
            >
              🏆 PB
            </span>
          )}
          {dive.federation && (
            <span
              className="rounded-md px-2 py-0.5 text-[0.6rem] font-semibold"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}
            >
              {dive.federation}
            </span>
          )}
          <span className="ml-auto text-xs text-white/30">
            {dateStr}{dive.dive_time ? ` · ${dive.dive_time}` : ""}
          </span>
        </div>

        {/* big result */}
        <p
          className="font-bold tabular-nums text-white"
          style={{ fontFamily: "'Outfit', sans-serif", fontSize: "3.5rem", lineHeight: 1 }}
        >
          {formatResult(dive.discipline, dive.result)}
        </p>

        <p className="text-xs text-white/30 capitalize">
          {dive.session_type === "competition"
            ? (lang === "el" ? "Αγώνας" : "Competition")
            : (lang === "el" ? "Προπόνηση" : "Training")}
        </p>
      </div>

      {/* condition */}
      {(dive.sleep_hours != null || dive.mental_state != null || dive.food_notes) && (
        <Section title={lang === "el" ? "ΚΑΤΑΣΤΑΣΗ" : "CONDITION"}>
          {dive.sleep_hours != null && <Row label={t("log.sleep")} value={`${dive.sleep_hours}h`} />}
          {dive.mental_state != null && <Row label={t("log.mental")} value={`${dive.mental_state} / 5`} />}
          {dive.food_notes && <Row label={t("log.food")} value={dive.food_notes} />}
        </Section>
      )}

      {/* equipment */}
      {hasGear && (
        <Section title={lang === "el" ? "ΕΞΟΠΛΙΣΜΟΣ & ΣΥΝΘΗΚΕΣ" : "EQUIPMENT & CONDITIONS"}>
          {dive.neck_weight != null && <Row label={t("log.neckWeight")} value={`${dive.neck_weight} kg`} />}
          {dive.belt_weight != null && <Row label={t("log.beltWeight")} value={`${dive.belt_weight} kg`} />}
          {dive.wetsuit_mm !== undefined && <Row label={t("log.wetsuit")} value={wetsuitLabel} />}
          {dive.water_temp != null && <Row label={t("log.waterTemp")} value={`${dive.water_temp} °C`} />}
          {dive.buoyancy && <Row label={t("log.buoyancy")} value={buoyancyLabel[dive.buoyancy] ?? dive.buoyancy} />}
          {dive.fins_brand && <Row label={t("log.finsBrand")} value={dive.fins_brand} />}
          {dive.fins_model && <Row label={t("log.finsModel")} value={dive.fins_model} />}
          {dive.foot_pocket && <Row label={t("log.footPocket")} value={dive.foot_pocket} />}
        </Section>
      )}

      {/* notes */}
      {dive.notes && (
        <Section title={lang === "el" ? "ΣΗΜΕΙΩΣΕΙΣ" : "NOTES"}>
          <p className="text-sm text-white/60 leading-relaxed">{dive.notes}</p>
        </Section>
      )}

      {/* actions */}
      <div className="flex gap-3 pt-2">
        <Button asChild variant="outline" className="flex-1 gap-2">
          <Link to="/log" search={{ edit: dive.id }}>
            <Pencil className="size-4" /> {t("common.edit")}
          </Link>
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-2 border-red-400/30 text-red-400/70 hover:border-red-400 hover:text-red-400"
          onClick={() => {
            if (confirm(lang === "el" ? "Διαγραφή βουτιάς;" : "Delete this dive?")) {
              remove.mutate();
            }
          }}
          disabled={remove.isPending}
        >
          <Trash2 className="size-4" /> {t("common.delete")}
        </Button>
      </div>
    </div>
  );
}
