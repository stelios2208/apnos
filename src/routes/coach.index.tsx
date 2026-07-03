import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Lock, ChevronRight, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { BreathMark } from "@/components/Logo";
import { AthleteFormModal } from "@/components/AthleteFormModal";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import {
  type Athlete,
  type Level,
  type DisciplineCode,
  levelLabel,
  athleteInitials,
  athleteColor,
  fetchAthletes,
  createAthlete,
  deleteAthlete,
} from "@/lib/athletes";

export const Route = createFileRoute("/coach/")({
  head: () => ({ meta: [{ title: "Coach — Apnos" }] }),
  component: () => (
    <AppLayout>
      <CoachPage />
    </AppLayout>
  ),
});

// ── component ──────────────────────────────────────────────────────────────

function CoachPage() {
  const { lang }    = useI18n();
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const qc          = useQueryClient();

  const [teamName, setTeamName]       = useState(lang === "el" ? "Η Ομάδα μου" : "My Team");
  const [editingName, setEditingName] = useState(false);
  const [showModal, setShowModal]     = useState(false);

  const { data: athletes = [], isLoading } = useQuery({
    queryKey: ["coach_athletes", user?.id],
    queryFn:  () => fetchAthletes(user!.id),
    enabled:  !!user,
  });

  const addMutation = useMutation({
    mutationFn: (values: { name: string; level: Level; disciplines: DisciplineCode[] }) =>
      createAthlete(user!.id, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach_athletes", user?.id] });
      setShowModal(false);
    },
    onError: () => toast.error(lang === "el" ? "Σφάλμα κατά την προσθήκη" : "Failed to add athlete"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAthlete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach_athletes", user?.id] }),
    onError: () => toast.error(lang === "el" ? "Σφάλμα διαγραφής" : "Failed to delete"),
  });

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => { if (e.key === "Enter") setEditingName(false); }}
                className="flex-1 rounded-lg bg-white/5 px-3 py-1.5 text-xl font-bold text-white outline-none focus:ring-1 focus:ring-[#1D9E75]"
              />
              <button
                onClick={() => setEditingName(false)}
                className="rounded-lg p-1.5"
                style={{ background: "rgba(29,158,117,0.2)", color: "#1D9E75" }}
              >
                <Check className="size-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditingName(true)} className="group flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{teamName}</h1>
              <span className="text-[0.6rem] text-white/20 transition-colors group-hover:text-white/50">
                {lang === "el" ? "επεξεργασία" : "edit"}
              </span>
            </button>
          )}
          <p className="mt-1 text-xs text-white/30">
            {isLoading
              ? "..."
              : athletes.length === 0
                ? (lang === "el" ? "Κανένας αθλητής ακόμα" : "No athletes yet")
                : `${athletes.length} ${lang === "el" ? "αθλητές" : "athletes"}`}
          </p>
        </div>

        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{ background: "rgba(239,159,39,0.1)", border: "1px solid rgba(239,159,39,0.25)" }}
        >
          <Lock className="size-3" style={{ color: "#EF9F27" }} />
          <span className="text-[0.6rem] font-bold tracking-wider" style={{ color: "#EF9F27" }}>
            Coach Pro
          </span>
        </div>
      </div>

      {/* loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-white/20" />
        </div>
      )}

      {/* empty state */}
      {!isLoading && athletes.length === 0 && (
        <div
          className="flex flex-col items-center gap-5 rounded-2xl py-14 text-center"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.07)" }}
        >
          <div style={{ opacity: 0.25 }}>
            <BreathMark size={64} />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-white/60">
              {lang === "el" ? "Πρόσθεσε τον πρώτο σου αθλητή" : "Add your first athlete"}
            </p>
            <p className="max-w-[240px] text-xs leading-relaxed text-white/25">
              {lang === "el"
                ? "Δημιούργησε προσωπικά προγράμματα για κάθε αθλητή σου"
                : "Create personalised training programmes for each athlete"}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors"
            style={{ background: "#1D9E75", color: "#fff" }}
          >
            <Plus className="size-4" />
            {lang === "el" ? "Νέος Αθλητής" : "New Athlete"}
          </button>
        </div>
      )}

      {/* athlete list */}
      {!isLoading && athletes.length > 0 && (
        <div className="space-y-3">
          {athletes.map((a) => (
            <AthleteCard
              key={a.id}
              athlete={a}
              lang={lang}
              onProgram={() => navigate({ to: "/coach/athlete/$id", params: { id: a.id } })}
              onDelete={() => deleteMutation.mutate(a.id)}
            />
          ))}
        </div>
      )}

      {/* FAB */}
      {!isLoading && athletes.length > 0 && (
        <button
          onClick={() => setShowModal(true)}
          className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full transition-all active:scale-95"
          style={{ background: "#1D9E75", boxShadow: "0 4px 24px rgba(29,158,117,0.45)" }}
          aria-label={lang === "el" ? "Νέος αθλητής" : "New athlete"}
        >
          <Plus className="size-6 text-white" />
        </button>
      )}

      {showModal && (
        <AthleteFormModal
          lang={lang}
          isPending={addMutation.isPending}
          onSubmit={(values) => addMutation.mutate(values)}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// ── AthleteCard ────────────────────────────────────────────────────────────

function AthleteCard({ athlete, lang, onProgram, onDelete }: {
  athlete: Athlete;
  lang: string;
  onProgram: () => void;
  onDelete: () => void;
}) {
  const color = athleteColor(athlete.id || athlete.name);
  return (
    <div
      className="flex items-center gap-4 rounded-2xl px-4 py-4"
      style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold"
        style={{ background: `${color}22`, color, border: `1px solid ${color}45` }}
      >
        {athleteInitials(athlete.name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-white">{athlete.name}</span>
          <span
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[0.55rem] font-bold tracking-wider"
            style={{ background: `${color}18`, color }}
          >
            {levelLabel(athlete.level, lang)}
          </span>
        </div>
        {athlete.disciplines.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {athlete.disciplines.map((d) => (
              <span
                key={d}
                className="rounded px-1.5 py-0.5 text-[0.55rem] font-bold tracking-wider"
                style={{ background: "rgba(93,202,165,0.1)", color: "#5DCAA5" }}
              >
                {d}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onProgram}
          className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
          style={{ background: "rgba(29,158,117,0.1)", color: "#5DCAA5" }}
        >
          {lang === "el" ? "Πρόγραμμα" : "Programme"}
          <ChevronRight className="size-3.5" />
        </button>
        <button
          onClick={() => {
            if (confirm(lang === "el" ? `Διαγραφή ${athlete.name};` : `Delete ${athlete.name}?`)) onDelete();
          }}
          className="rounded-lg p-2 text-white/15 transition-colors hover:text-red-400/60"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
