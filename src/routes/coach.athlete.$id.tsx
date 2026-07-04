import { createFileRoute, Link } from "@tanstack/react-router";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Copy, CopyPlus, LayoutList, Loader2, Pencil, Plus, Share2, Trash2, X, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { AthleteFormModal } from "@/components/AthleteFormModal";
import { ProgramShareModal } from "@/components/ShareCard";
import { disciplineName } from "@/lib/diving";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import {
  type Athlete, type DisciplineCode, type ProgramRow,
  type STARound, type DynSet, type DepthDive, type DynIntensity,
  type TrainingProgram, type TableType, type DynSetType, type BreathingMode,
  templateKind, newRow, levelColor, levelLabel, athleteInitials, athleteColor,
  fetchAthletes, updateAthlete, updateAthletePrograms,
  totalSTAHoldSecs, totalDynMetres, maxDepthMetres,
  dynSetColor, dynSetLabel, dynIntensityTag,
  fmtSeconds, todayISO,
  TABLE_TYPES, DYN_SET_TYPES,
} from "@/lib/athletes";

export const Route = createFileRoute("/coach/athlete/$id")({
  head: () => ({ meta: [{ title: "Αθλητής — Apnos" }] }),
  component: () => (
    <AppLayout>
      <AthletePage />
    </AppLayout>
  ),
});

type Tab = "program" | "history";

function defaultProgramName(lang: string, dateISO: string): string {
  // noon avoids off-by-one from UTC timezone conversions
  const d = new Date(`${dateISO}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  return d.toLocaleDateString(lang === "el" ? "el-GR" : "en-GB", opts);
}

// ── AthletePage ────────────────────────────────────────────────────────────

function AthletePage() {
  const { lang }  = useI18n();
  const { user }  = useAuth();
  const { id }    = Route.useParams();
  const qc        = useQueryClient();

  const [tab, setTab]                       = useState<Tab>("program");
  const [view, setView]                     = useState<"list" | "week">("list");
  const [weekOffset, setWeekOffset]         = useState(0);
  const [programs, setPrograms]             = useState<TrainingProgram[]>([]);
  const [activeId, setActiveId]             = useState<string | null>(null);
  const [activeDiscipline, setActiveDiscipline] = useState<DisciplineCode | null>(null);
  const [selectedDate, setSelectedDate]     = useState(todayISO());
  const [showCopy, setShowCopy]             = useState(false);
  const [showShareCard, setShowShareCard]   = useState(false);
  const [showEdit, setShowEdit]             = useState(false);
  const [saved, setSaved]                   = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: athletes = [], isLoading } = useQuery({
    queryKey: ["coach_athletes", user?.id],
    queryFn:  () => fetchAthletes(user!.id),
    enabled:  !!user,
    staleTime: 5 * 60 * 1000,
  });

  const athlete: Athlete | undefined = athletes.find((a) => a.id === id);

  useEffect(() => {
    if (!athlete) return;
    setPrograms(athlete.programs ?? []);
    setActiveDiscipline((prev) => prev ?? (athlete.disciplines[0] ?? null));
    // initialise activeId to first program of first discipline
    setActiveId((prev) => {
      if (prev) return prev;
      const firstDisc = athlete.disciplines[0];
      return athlete.programs?.find((p) => p.discipline === firstDisc)?.id ?? null;
    });
  }, [athlete?.id, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // programs visible in the current discipline tab
  const disciplinePrograms = activeDiscipline
    ? programs.filter((p) => p.discipline === activeDiscipline)
    : programs;

  const active = disciplinePrograms.find((p) => p.id === activeId) ?? null;

  // ── persist ───────────────────────────────────────────────────────────────

  const flush = async (updated: TrainingProgram[]) => {
    try {
      await updateAthletePrograms(id, updated);
      qc.invalidateQueries({ queryKey: ["coach_athletes", user?.id] });
      setSaved(true);
    } catch {
      toast.error(lang === "el" ? "Σφάλμα αποθήκευσης" : "Save failed");
    }
  };

  const scheduleFlush = (updated: TrainingProgram[]) => {
    setPrograms(updated);
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flush(updated), 1500);
  };

  const manualSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    flush(programs).then(() => toast.success(lang === "el" ? "Αποθηκεύτηκε" : "Saved"));
  };

  // ── program CRUD ──────────────────────────────────────────────────────────

  const createProgramForDate = (dateISO: string) => {
    if (!activeDiscipline) return;
    const prog: TrainingProgram = {
      id: crypto.randomUUID(),
      name: defaultProgramName(lang, dateISO),
      date: dateISO,
      discipline: activeDiscipline,
      sets: [newRow(activeDiscipline)],
    };
    setActiveId(prog.id);
    setSelectedDate(dateISO);
    scheduleFlush([prog, ...programs]);
  };

  const createProgram = () => createProgramForDate(selectedDate);

  const duplicateProgram = (src: TrainingProgram) => {
    const suffix = lang === "el" ? " (αντίγραφο)" : " (copy)";
    const copy: TrainingProgram = {
      ...src,
      id: crypto.randomUUID(),
      name: src.name + suffix,
      sets: src.sets.map((s) => ({ ...s, id: crypto.randomUUID() })),
    };
    setActiveId(copy.id);
    scheduleFlush([copy, ...programs]);
    toast.success(lang === "el" ? "Δημιουργήθηκε αντίγραφο" : "Duplicate created");
  };

  const updateProgram = (prog: TrainingProgram) => {
    scheduleFlush(programs.map((p) => p.id === prog.id ? prog : p));
  };

  const deleteProgram = (progId: string) => {
    const updated = programs.filter((p) => p.id !== progId);
    setPrograms(updated);
    const nextInDisc = updated.find((p) => p.discipline === activeDiscipline);
    setActiveId(nextInDisc?.id ?? null);
    flush(updated);
  };

  const switchDiscipline = (d: DisciplineCode) => {
    setActiveDiscipline(d);
    const first = programs.find((p) => p.discipline === d);
    setActiveId(first?.id ?? null);
  };

  // ── edit athlete ──────────────────────────────────────────────────────────

  const editMutation = useMutation({
    mutationFn: (values: { name: string; level: Athlete["level"]; disciplines: Athlete["disciplines"] }) =>
      updateAthlete(id, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach_athletes", user?.id] });
      setShowEdit(false);
      toast.success(lang === "el" ? "Αποθηκεύτηκε" : "Saved");
    },
    onError: () => toast.error(lang === "el" ? "Σφάλμα αποθήκευσης" : "Save failed"),
  });

  // ── copy to athlete ───────────────────────────────────────────────────────

  const copyToAthlete = async (targetId: string) => {
    if (!active) return;
    const target = athletes.find((a) => a.id === targetId);
    if (!target) return;
    const copy: TrainingProgram = { ...active, id: crypto.randomUUID(), date: todayISO() };
    try {
      await updateAthletePrograms(targetId, [copy, ...(target.programs ?? [])]);
      qc.invalidateQueries({ queryKey: ["coach_athletes", user?.id] });
      setShowCopy(false);
      toast.success(lang === "el" ? "Αντιγράφηκε!" : "Copied!");
    } catch {
      toast.error(lang === "el" ? "Σφάλμα αντιγραφής" : "Copy failed");
    }
  };

  // ── loading / not found ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-white/20" />
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/40">{lang === "el" ? "Ο αθλητής δεν βρέθηκε." : "Athlete not found."}</p>
        <Link to="/coach" className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="size-4" />
          {lang === "el" ? "Πίσω" : "Back"}
        </Link>
      </div>
    );
  }

  const color = levelColor(athlete.level);
  const otherAthletes = athletes.filter((a) => a.id !== id);
  const tabs = athlete.disciplines.length > 0 ? athlete.disciplines : (["DYN"] as DisciplineCode[]);

  return (
    <div className="space-y-5">

      {/* back */}
      <Link to="/coach" className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors">
        <ArrowLeft className="size-4" />
        {lang === "el" ? "Πίσω στην ομάδα" : "Back to team"}
      </Link>

      {/* athlete header */}
      <div
        className="flex items-center gap-4 rounded-2xl px-5 py-4"
        style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold"
          style={{ background: `${athleteColor(athlete.id || athlete.name)}22`, color: athleteColor(athlete.id || athlete.name), border: `1px solid ${athleteColor(athlete.id || athlete.name)}45` }}
        >
          {athleteInitials(athlete.name)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-white">{athlete.name}</h1>
            <button
              onClick={() => setShowEdit(true)}
              className="rounded-lg p-1.5 text-white/25 transition-colors hover:text-white/60"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-md px-2 py-0.5 text-[0.6rem] font-bold tracking-wider" style={{ background: `${color}18`, color }}>
              {levelLabel(athlete.level, lang)}
            </span>
            {athlete.disciplines.map((d) => (
              <span key={d} className="rounded px-1.5 py-0.5 text-[0.55rem] font-bold tracking-wider" style={{ background: "rgba(93,202,165,0.1)", color: "#5DCAA5" }}>
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="flex rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)" }}>
        {(["program", "history"] as Tab[]).map((t) => {
          const label = t === "program"
            ? (lang === "el" ? "Πρόγραμμα" : "Programme")
            : (lang === "el" ? "Ιστορικό" : "History");
          const isActive = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all"
              style={{ background: isActive ? "#1D9E75" : "transparent", color: isActive ? "#fff" : "rgba(255,255,255,0.35)" }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── PROGRAM TAB ── */}
      {tab === "program" && (
        <div className="space-y-4">

          {/* discipline tabs + view toggle */}
          <div className="flex items-center gap-2">
            {tabs.length > 1 && (
              <div className="flex flex-1 gap-2 overflow-x-auto pb-0.5">
              {tabs.map((d) => {
                const isActive = d === activeDiscipline;
                const c = DISCIPLINE_COLORS[d] ?? "#5DCAA5";
                const count = programs.filter((p) => p.discipline === d).length;
                return (
                  <button
                    key={d}
                    onClick={() => switchDiscipline(d)}
                    className="shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold tracking-wide transition-all"
                    style={
                      isActive
                        ? { background: `${c}20`, color: c, border: `1.5px solid ${c}60` }
                        : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.3)", border: "1.5px solid rgba(255,255,255,0.07)" }
                    }
                  >
                    {d}
                    {count > 0 && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[0.55rem] font-black"
                        style={{ background: isActive ? `${c}30` : "rgba(255,255,255,0.06)", color: isActive ? c : "rgba(255,255,255,0.25)" }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
              </div>
            )}
            {/* view toggle */}
            <div className="shrink-0 flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <button
                onClick={() => setView("list")}
                className="flex items-center justify-center px-2.5 py-2 transition-colors"
                style={{ background: view === "list" ? "rgba(29,158,117,0.2)" : "transparent", color: view === "list" ? "#1D9E75" : "rgba(255,255,255,0.3)" }}
              >
                <LayoutList className="size-3.5" />
              </button>
              <button
                onClick={() => setView("week")}
                className="flex items-center justify-center px-2.5 py-2 transition-colors"
                style={{ background: view === "week" ? "rgba(29,158,117,0.2)" : "transparent", color: view === "week" ? "#1D9E75" : "rgba(255,255,255,0.3)" }}
              >
                <CalendarDays className="size-3.5" />
              </button>
            </div>
          </div>

          {/* ── LIST VIEW ── */}
          {view === "list" && (disciplinePrograms.length === 0 ? (
            <div
              className="flex flex-col items-center gap-4 rounded-2xl py-12 text-center"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.07)" }}
            >
              <Zap className="size-8 text-white/10" />
              <p className="text-sm text-white/30">
                {lang === "el" ? "Κανένα πρόγραμμα ακόμα" : "No programme yet"}
                {activeDiscipline ? ` · ${activeDiscipline}` : ""}
              </p>
              <button
                onClick={createProgram}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
                style={{ background: "#1D9E75", color: "#fff" }}
              >
                <Plus className="size-4" />
                {lang === "el" ? "Νέο Πρόγραμμα" : "New Programme"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-2 overflow-x-auto pb-0.5">
                  {disciplinePrograms.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActiveId(p.id)}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all"
                      style={
                        p.id === activeId
                          ? { background: "#1D9E75", color: "#fff" }
                          : { background: "#0d1320", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.07)" }
                      }
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                <button
                  onClick={createProgram}
                  className="shrink-0 flex size-8 items-center justify-center rounded-lg text-white/40 hover:text-white transition-colors"
                  style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <Plus className="size-4" />
                </button>
              </div>

              {active && (
                <ProgramBuilder
                  key={active.id}
                  program={active}
                  lang={lang}
                  saved={saved}
                  onChange={updateProgram}
                  onSave={manualSave}
                  onDelete={() => deleteProgram(active.id)}
                  onCopy={() => setShowCopy(true)}
                  onDuplicate={() => duplicateProgram(active)}
                  onShare={() => setShowShareCard(true)}
                  onDateChange={setSelectedDate}
                />
              )}
            </>
          ))}

          {/* ── WEEK VIEW ── */}
          {view === "week" && (
            <WeekView
              programs={disciplinePrograms}
              activeDiscipline={activeDiscipline}
              lang={lang}
              weekOffset={weekOffset}
              onWeekChange={setWeekOffset}
              onCreateDay={(dateISO) => { createProgramForDate(dateISO); setView("list"); }}
              onOpenProgram={(prog) => { setActiveId(prog.id); setView("list"); }}
            />
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <div className="space-y-3">
          {programs.length === 0 ? (
            <p className="text-sm text-white/25 text-center py-8">
              {lang === "el" ? "Κανένα αποθηκευμένο πρόγραμμα." : "No saved programmes yet."}
            </p>
          ) : (
            programs.map((p) => (
              <ProgramHistoryRow
                key={p.id}
                program={p}
                lang={lang}
                onOpen={() => { setActiveId(p.id); setTab("program"); }}
              />
            ))
          )}
        </div>
      )}

      {/* edit modal */}
      {showEdit && (
        <AthleteFormModal
          lang={lang}
          initial={{ name: athlete.name, level: athlete.level, disciplines: athlete.disciplines }}
          isPending={editMutation.isPending}
          onSubmit={(values) => editMutation.mutate(values)}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* programme share card */}
      {showShareCard && active && athlete && (
        <ProgramShareModal
          data={{
            title: active.name,
            disciplineCode: active.discipline ?? "—",
            disciplineLabel: active.discipline ? disciplineName(active.discipline, lang === "el" ? "el" : "en") : "",
            accent: DISCIPLINE_COLORS[active.discipline ?? ""] ?? "#5DCAA5",
            lines: active.sets.map((r) => programRowLine(r, lang)),
            footerName: athlete.name,
            lang,
          }}
          onClose={() => setShowShareCard(false)}
        />
      )}

      {/* copy modal */}
      {showCopy && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCopy(false); }}
        >
          <div className="w-full rounded-t-2xl px-5 pb-10 pt-5" style={{ background: "#0d1320" }}>
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/10" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">
                {lang === "el" ? "Αντιγραφή σε αθλητή" : "Copy to athlete"}
              </h2>
              <button onClick={() => setShowCopy(false)} className="text-white/30 hover:text-white transition-colors">
                <X className="size-5" />
              </button>
            </div>
            {otherAthletes.length === 0 ? (
              <p className="text-sm text-white/30">{lang === "el" ? "Δεν υπάρχουν άλλοι αθλητές." : "No other athletes."}</p>
            ) : (
              <div className="space-y-2">
                {otherAthletes.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => copyToAthlete(a.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: `${athleteColor(a.id || a.name)}22`, color: athleteColor(a.id || a.name), border: `1px solid ${athleteColor(a.id || a.name)}45` }}
                    >
                      {athleteInitials(a.name)}
                    </div>
                    <span className="text-sm font-medium text-white/80">{a.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ProgramBuilder ─────────────────────────────────────────────────────────

const DISCIPLINE_COLORS: Record<string, string> = {
  STA: "#9FE1CB",
  DYN: "#1D9E75", DYNB: "#1D9E75", DNF: "#5DCAA5",
  CWT: "#EF9F27", CWTB: "#EF9F27", CNF: "#e8a020", FIM: "#d4912a",
};

// One readable line per set/round, for the shareable programme card.
function programRowLine(row: ProgramRow, lang: string): string {
  if (row.kind === "sta") {
    return `${row.tableType} · ${lang === "el" ? "κράτ." : "hold"} ${row.holdTime} · rec ${row.recovery}`;
  }
  if (row.kind === "dyn") {
    const bm = row.breathingMode !== "normal" ? ` · ${row.breathingMode}` : "";
    return `${row.reps}×${row.distance}m · rest ${row.rest} · ${dynSetLabel(row.setType)}${bm}`;
  }
  return `${row.targetDepth}m · ${row.totalTime} · SI ${row.surfaceInterval}`;
}

// ── Week View helpers ──────────────────────────────────────────────────────

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDays(weekOffset: number): Date[] {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dow + 6) % 7) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function DayCard({ day, programs, lang, onCreateDay, onOpenProgram }: {
  day: Date;
  programs: TrainingProgram[];
  lang: string;
  onCreateDay: (dateISO: string) => void;
  onOpenProgram: (prog: TrainingProgram) => void;
}) {
  const iso = localISO(day);
  const todayStr = todayISO();
  const isToday = iso === todayStr;
  const dayProgs = programs.filter((p) => p.date === iso);
  const dayName = day.toLocaleDateString(lang === "el" ? "el-GR" : "en-GB", { weekday: "short" });
  const dayNum = day.getDate();

  return (
    <div
      className="flex shrink-0 flex-col gap-2 rounded-xl p-2"
      style={{
        width: 88,
        minHeight: 88,
        background: isToday ? "rgba(29,158,117,0.08)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isToday ? "rgba(29,158,117,0.3)" : "rgba(255,255,255,0.06)"}`,
      }}
    >
      {/* day header: abbrev + number left, + right */}
      <div className="flex items-start justify-between gap-1">
        <div className="flex flex-col leading-none">
          <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: isToday ? "#1D9E75" : "rgba(255,255,255,0.35)" }}>
            {dayName}
          </span>
          <span className="mt-0.5 text-base font-bold leading-none" style={{ color: isToday ? "#1D9E75" : "rgba(255,255,255,0.75)" }}>
            {dayNum}
          </span>
        </div>
        <button
          onClick={() => onCreateDay(iso)}
          className="flex size-5 shrink-0 items-center justify-center rounded-md transition-colors"
          style={{ color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.04)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#1D9E75")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
        >
          <Plus className="size-3" />
        </button>
      </div>

      {/* programme chips */}
      <div className="flex flex-col gap-1">
        {dayProgs.map((p) => {
          const color = DISCIPLINE_COLORS[p.discipline ?? ""] ?? "#5DCAA5";
          return (
            <button
              key={p.id}
              onClick={() => onOpenProgram(p)}
              className="w-full rounded-md px-1.5 py-1 text-left"
              style={{ background: `${color}18`, border: `1px solid ${color}40` }}
            >
              <div className="text-[9px] font-bold leading-none" style={{ color }}>
                {p.discipline ?? "—"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ programs, activeDiscipline, lang, weekOffset, onWeekChange, onCreateDay, onOpenProgram }: {
  programs: TrainingProgram[];
  activeDiscipline: DisciplineCode | null;
  lang: string;
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  onCreateDay: (dateISO: string) => void;
  onOpenProgram: (prog: TrainingProgram) => void;
}) {
  const days = getWeekDays(weekOffset);
  const rangeLabel = (() => {
    const first = days[0]!;
    const last = days[6]!;
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
    const loc = lang === "el" ? "el-GR" : "en-GB";
    return `${first.toLocaleDateString(loc, opts)} – ${last.toLocaleDateString(loc, opts)}`;
  })();

  return (
    <div className="flex flex-col gap-3">
      {/* week navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onWeekChange(weekOffset - 1)}
          className="flex size-8 items-center justify-center rounded-lg text-white/40 hover:text-white transition-colors"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs font-medium text-white/60">{rangeLabel}</span>
          {weekOffset !== 0 && (
            <button
              onClick={() => onWeekChange(0)}
              className="text-[10px] font-semibold"
              style={{ color: "#1D9E75" }}
            >
              {lang === "el" ? "Σήμερα" : "Today"}
            </button>
          )}
        </div>
        <button
          onClick={() => onWeekChange(weekOffset + 1)}
          className="flex size-8 items-center justify-center rounded-lg text-white/40 hover:text-white transition-colors"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* 7-day scroll row */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {days.map((day) => (
          <DayCard
            key={localISO(day)}
            day={day}
            programs={programs}
            lang={lang}
            onCreateDay={onCreateDay}
            onOpenProgram={onOpenProgram}
          />
        ))}
      </div>
    </div>
  );
}

function ProgramBuilder({ program, lang, saved, onChange, onSave, onDelete, onCopy, onDuplicate, onShare, onDateChange }: {
  program: TrainingProgram;
  lang: string;
  saved: boolean;
  onChange: (p: TrainingProgram) => void;
  onSave: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onDateChange: (date: string) => void;
}) {
  const update = (partial: Partial<TrainingProgram>) => onChange({ ...program, ...partial });

  const updateRow = (row: ProgramRow) =>
    update({ sets: program.sets.map((s) => s.id === row.id ? row : s) });

  const addRow = () => {
    if (!program.discipline) return;
    update({ sets: [...program.sets, newRow(program.discipline)] });
  };

  const deleteRow = (rowId: string) =>
    update({ sets: program.sets.filter((s) => s.id !== rowId) });

  const moveRow = (rowId: string, dir: -1 | 1) => {
    const sets = [...program.sets];
    const i = sets.findIndex((s) => s.id === rowId);
    if (i + dir < 0 || i + dir >= sets.length) return;
    [sets[i], sets[i + dir]] = [sets[i + dir]!, sets[i]!];
    update({ sets });
  };

  const kind = program.discipline ? templateKind(program.discipline) : null;

  // summary stats
  const summary = (() => {
    if (kind === "sta") {
      const secs = totalSTAHoldSecs(program.sets);
      return [
        { label: lang === "el" ? "Rounds" : "Rounds", value: String(program.sets.length), color: "#9FE1CB" },
        { label: lang === "el" ? "Σύν. Hold" : "Total Hold", value: secs > 0 ? fmtSeconds(secs) : "—", color: "#5DCAA5" },
        { label: "Discipline", value: program.discipline ?? "—", color: "#1D9E75" },
      ];
    }
    if (kind === "depth") {
      const maxD = maxDepthMetres(program.sets);
      return [
        { label: lang === "el" ? "Dives" : "Dives", value: String(program.sets.length), color: "#EF9F27" },
        { label: lang === "el" ? "Μέγ. Βάθος" : "Max Depth", value: maxD > 0 ? `${maxD}m` : "—", color: "#EF9F27" },
        { label: "Discipline", value: program.discipline ?? "—", color: "#e8a020" },
      ];
    }
    if (kind === "dyn") {
      const metres = totalDynMetres(program.sets);
      const tag: DynIntensity = dynIntensityTag(program.sets);
      const INTENSITY: Record<DynIntensity, { label_el: string; label_en: string; color: string }> = {
        easy:         { label_el: "Εύκολο",     label_en: "Easy",         color: "#1D9E75" },
        intermediate: { label_el: "Μέτριο",     label_en: "Intermediate", color: "#5DCAA5" },
        high:         { label_el: "Υψηλό",      label_en: "High",         color: "#EF9F27" },
        advanced:     { label_el: "Advanced",   label_en: "Advanced",     color: "#ef4444" },
      };
      const { color: iColor } = INTENSITY[tag];
      const iLabel = lang === "el" ? INTENSITY[tag].label_el : INTENSITY[tag].label_en;
      return [
        { label: "Sets", value: String(program.sets.length), color: "#5DCAA5" },
        { label: lang === "el" ? "Απόσταση" : "Distance", value: metres > 0 ? `${metres}m` : "—", color: "#1D9E75" },
        { label: lang === "el" ? "Ένταση" : "Intensity", value: iLabel, color: iColor },
      ];
    }
    return [];
  })();

  const addLabel = kind === "sta"
    ? (lang === "el" ? "+ Νέο Round" : "+ Add Round")
    : kind === "depth"
    ? (lang === "el" ? "+ Νέο Dive" : "+ Add Dive")
    : (lang === "el" ? "+ Νέο Set" : "+ Add Set");

  return (
    <div className="space-y-4">

      {/* program name + date */}
      <div className="flex items-center gap-3">
        <input
          value={program.name}
          onChange={(e) => update({ name: e.target.value })}
          className="flex-1 rounded-xl bg-white/5 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:ring-1 focus:ring-[#1D9E75]"
          placeholder={lang === "el" ? "Όνομα προγράμματος" : "Programme name"}
        />
        <input
          type="date"
          value={program.date}
          onChange={(e) => {
            if (!e.target.value) return;
            update({ date: e.target.value });
            onDateChange(e.target.value);
          }}
          className="rounded-xl bg-white/5 px-3 py-2.5 text-xs text-white/60 outline-none focus:ring-1 focus:ring-[#1D9E75]"
          style={{ colorScheme: "dark" }}
        />
      </div>

      {/* summary card */}
      {summary.length > 0 && (
        <div
          className="grid grid-cols-3 gap-2 rounded-xl px-1 py-3"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          {summary.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className="font-mono text-sm font-bold tabular-nums" style={{ color: s.color }}>{s.value}</span>
              <span className="text-[0.5rem] font-bold tracking-widest text-white/25">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* rows */}
      <div className="space-y-2">
        {program.sets.map((row, i) => {
          const isFirst = i === 0;
          const isLast  = i === program.sets.length - 1;
          const common  = { lang, isFirst, isLast, onDelete: () => deleteRow(row.id), onMove: (dir: -1 | 1) => moveRow(row.id, dir) };
          if (row.kind === "sta")    return <STARow    key={row.id} row={row}    {...common} onChange={updateRow} />;
          if (row.kind === "dyn")    return <DynRow    key={row.id} row={row}    {...common} onChange={updateRow} />;
          if (row.kind === "depth")  return <DepthRow  key={row.id} row={row}    {...common} onChange={updateRow} />;
          return null;
        })}
      </div>

      {/* add row */}
      {program.discipline && (
        <button
          onClick={addRow}
          className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all hover:border-[#1D9E75]/40"
          style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}
        >
          <Plus className="size-4" />
          {addLabel}
        </button>
      )}

      {/* actions */}
      <div className="flex gap-2">
        <button
          onClick={onDuplicate}
          title={lang === "el" ? "Διπλότυπο" : "Duplicate"}
          className="flex items-center justify-center rounded-xl px-3.5 py-3 transition-all"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
        >
          <CopyPlus className="size-3.5" />
        </button>
        <button
          onClick={onCopy}
          title={lang === "el" ? "Αντιγραφή σε αθλητή" : "Copy to athlete"}
          className="flex items-center justify-center rounded-xl px-3.5 py-3 transition-all"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
        >
          <Copy className="size-3.5" />
        </button>
        <button
          onClick={onShare}
          title={lang === "el" ? "Κάρτα προγράμματος" : "Programme card"}
          className="flex items-center justify-center rounded-xl px-3.5 py-3 transition-all"
          style={{ background: "rgba(29,158,117,0.1)", border: "1px solid rgba(29,158,117,0.3)", color: "#5DCAA5" }}
        >
          <Share2 className="size-3.5" />
        </button>
        <button
          onClick={onSave}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all"
          style={{ background: saved ? "rgba(29,158,117,0.15)" : "#1D9E75", color: saved ? "#5DCAA5" : "#fff" }}
        >
          {saved
            ? (lang === "el" ? "Αποθηκεύτηκε ✓" : "Saved ✓")
            : (lang === "el" ? "Αποθήκευση" : "Save")}
        </button>
        <button
          onClick={() => {
            if (confirm(lang === "el" ? "Διαγραφή προγράμματος;" : "Delete programme?")) onDelete();
          }}
          className="flex items-center gap-1.5 rounded-xl px-4 py-3 text-xs font-semibold transition-all"
          style={{ background: "rgba(239,80,80,0.06)", border: "1px solid rgba(239,80,80,0.15)", color: "rgba(239,80,80,0.7)" }}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Shared row header (up/down/delete) ─────────────────────────────────────

function RowControls({ accentColor, isFirst, isLast, onMove, onDelete }: {
  accentColor: string;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-end gap-0.5">
      <button onClick={() => onMove(-1)} disabled={isFirst} className="rounded p-1.5 text-white/20 hover:text-white/60 disabled:opacity-20">
        <ChevronUp className="size-3.5" />
      </button>
      <button onClick={() => onMove(1)} disabled={isLast} className="rounded p-1.5 text-white/20 hover:text-white/60 disabled:opacity-20">
        <ChevronDown className="size-3.5" />
      </button>
      <button onClick={onDelete} className="rounded p-1.5 text-white/20 hover:text-red-400/70">
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

const inputCls = "rounded-lg bg-white/5 px-2 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#1D9E75]";
const labelCls = "text-[0.55rem] font-bold tracking-wider text-white/30";

// Normalise a free-typed time into M:SS — the colon is inserted automatically,
// so "230" → "2:30", "45" → "0:45", empty stays empty (no forced 00:00).
function normalizeMMSS(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return "";
  if (trimmed.includes(":")) {
    const [m, sec = ""] = trimmed.split(":");
    const mm = parseInt(m || "0", 10) || 0;
    const ss = Math.min(59, parseInt(sec || "0", 10) || 0);
    return `${mm}:${String(ss).padStart(2, "0")}`;
  }
  const d = trimmed.replace(/\D/g, "");
  if (!d) return "";
  const ss = d.slice(-2).padStart(2, "0");
  const mm = d.slice(0, -2) || "0";
  return `${parseInt(mm, 10)}:${ss}`;
}

/** MM:SS text input that auto-formats the colon on blur; clearable to empty. */
function TimeField({ value, onChange, className, style, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
}) {
  const [display, setDisplay] = useState(value);
  useEffect(() => { setDisplay(value); }, [value]);
  return (
    <input
      inputMode="numeric"
      value={display}
      onChange={(e) => setDisplay(e.target.value.replace(/[^0-9:]/g, ""))}
      onBlur={() => { const n = normalizeMMSS(display); setDisplay(n); onChange(n); }}
      className={className}
      style={style}
      placeholder={placeholder}
    />
  );
}

// Numeric input that allows temporary empty state during editing, commits on blur
function NumericInput({ value, onChange, min = 1, defaultVal, className }: {
  value: number; onChange: (n: number) => void;
  min?: number; defaultVal: number; className?: string;
}) {
  const [display, setDisplay] = useState(String(value));
  useEffect(() => { setDisplay(String(value)); }, [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) => setDisplay(e.target.value.replace(/[^0-9]/g, ""))}
      onBlur={() => {
        const n = Math.max(min, parseInt(display, 10) || defaultVal);
        setDisplay(String(n));
        onChange(n);
      }}
      className={className ?? `${inputCls} text-center font-bold`}
    />
  );
}

// ── STARow ─────────────────────────────────────────────────────────────────

function STARow({ row, lang, isFirst, isLast, onChange, onDelete, onMove }: {
  row: STARound; lang: string; isFirst: boolean; isLast: boolean;
  onChange: (r: ProgramRow) => void; onDelete: () => void; onMove: (d: -1 | 1) => void;
}) {
  const upd = (p: Partial<STARound>) => onChange({ ...row, ...p });
  const accent = "#9FE1CB";

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.05)", borderLeft: `3px solid ${accent}` }}
    >
      {/* header */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <span className="rounded-lg px-3 py-1 text-[0.65rem] font-black tracking-wider" style={{ background: `${accent}18`, color: accent }}>
          STA
        </span>
        <select
          value={row.tableType}
          onChange={(e) => upd({ tableType: e.target.value as TableType })}
          className="rounded-lg bg-white/5 px-2 py-1 text-[0.65rem] font-bold text-white/70 outline-none focus:ring-1 focus:ring-[#1D9E75]"
          style={{ colorScheme: "dark" }}
        >
          {TABLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <RowControls accentColor={accent} isFirst={isFirst} isLast={isLast} onMove={onMove} onDelete={onDelete} />
      </div>

      {/* fields */}
      <div className="grid grid-cols-3 gap-2 px-3 pb-2.5">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>{lang === "el" ? "BREATH-UP" : "BREATH-UP"}</label>
          <TimeField
            value={row.breathUp}
            onChange={(v) => upd({ breathUp: v })}
            className={`${inputCls} text-center`}
            placeholder="2:00"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>{lang === "el" ? "HOLD" : "HOLD"}</label>
          <TimeField
            value={row.holdTime}
            onChange={(v) => upd({ holdTime: v })}
            className={`${inputCls} text-center font-bold`}
            style={{ color: accent }}
            placeholder="1:30"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>{lang === "el" ? "RECOVERY" : "RECOVERY"}</label>
          <TimeField
            value={row.recovery}
            onChange={(v) => upd({ recovery: v })}
            className={`${inputCls} text-center`}
            placeholder="2:00"
          />
        </div>
      </div>

      {/* notes */}
      <div className="px-3 pb-3">
        <input
          value={row.notes}
          onChange={(e) => upd({ notes: e.target.value })}
          className={`${inputCls} w-full text-xs text-white/40`}
          placeholder={lang === "el" ? "σημειώσεις…" : "notes…"}
        />
      </div>
    </div>
  );
}

// ── DynRow ─────────────────────────────────────────────────────────────────

const BREATHING_MODES: BreathingMode[] = ["normal", "FRC", "RV"];
const DYN_CYCLE: DynSetType[] = ["warmup", "mainset", "resistance", "sprint"];

function DynRow({ row, lang, isFirst, isLast, onChange, onDelete, onMove }: {
  row: DynSet; lang: string; isFirst: boolean; isLast: boolean;
  onChange: (r: ProgramRow) => void; onDelete: () => void; onMove: (d: -1 | 1) => void;
}) {
  const upd = (p: Partial<DynSet>) => onChange({ ...row, ...p });
  const accent = dynSetColor(row.setType);
  const showBreathing = row.setType !== "warmup";

  const cycleBreathing = () => {
    const i = BREATHING_MODES.indexOf(row.breathingMode ?? "normal");
    upd({ breathingMode: BREATHING_MODES[(i + 1) % BREATHING_MODES.length] });
  };

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.05)", borderLeft: `3px solid ${accent}` }}
    >
      {/* header: type badge cycle + breathing pill + controls */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <button
          onClick={() => {
            const i = DYN_CYCLE.indexOf(row.setType);
            upd({ setType: DYN_CYCLE[(i + 1) % DYN_CYCLE.length]!, breathingMode: "normal" });
          }}
          className="rounded-lg px-3 py-1 text-[0.65rem] font-black tracking-wider transition-all"
          style={{ background: `${accent}18`, color: accent }}
        >
          {dynSetLabel(row.setType)}
        </button>

        {showBreathing && (
          <button
            onClick={cycleBreathing}
            className="rounded-full px-2.5 py-0.5 text-[0.6rem] font-bold tracking-wider transition-all"
            style={
              row.breathingMode !== "normal"
                ? { background: "rgba(239,159,39,0.2)", color: "#EF9F27", border: "1px solid rgba(239,159,39,0.4)" }
                : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.2)", border: "1px solid transparent" }
            }
          >
            {row.breathingMode === "normal" ? (lang === "el" ? "κανονική" : "normal") : row.breathingMode}
          </button>
        )}

        <RowControls accentColor={accent} isFirst={isFirst} isLast={isLast} onMove={onMove} onDelete={onDelete} />
      </div>

      {/* fields: reps | distance | rest */}
      <div className="grid grid-cols-3 gap-2 px-3 pb-2.5">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>REPS</label>
          <NumericInput value={row.reps} onChange={(n) => upd({ reps: n })} defaultVal={1} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>{lang === "el" ? "ΑΠΌΣΤΑΣΗ" : "DISTANCE"}</label>
          <div className="relative">
            <NumericInput
              value={row.distance}
              onChange={(n) => upd({ distance: n })}
              defaultVal={50}
              className={`${inputCls} w-full text-center font-bold pr-6`}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[0.6rem] text-white/30">m</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>REST</label>
          <TimeField
            value={row.rest}
            onChange={(v) => upd({ rest: v })}
            className={`${inputCls} text-center`}
            placeholder="2:00"
          />
        </div>
      </div>

      {/* notes */}
      <div className="px-3 pb-3">
        <input
          value={row.notes}
          onChange={(e) => upd({ notes: e.target.value })}
          className={`${inputCls} w-full text-xs text-white/40`}
          placeholder={lang === "el" ? "σημειώσεις…" : "notes…"}
        />
      </div>
    </div>
  );
}

// ── DepthRow ───────────────────────────────────────────────────────────────

function DepthRow({ row, lang, isFirst, isLast, onChange, onDelete, onMove }: {
  row: DepthDive; lang: string; isFirst: boolean; isLast: boolean;
  onChange: (r: ProgramRow) => void; onDelete: () => void; onMove: (d: -1 | 1) => void;
}) {
  const upd = (p: Partial<DepthDive>) => onChange({ ...row, ...p });
  const accent = "#EF9F27";

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.05)", borderLeft: `3px solid ${accent}` }}
    >
      {/* header */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
        <span className="rounded-lg px-3 py-1 text-[0.65rem] font-black tracking-wider" style={{ background: `${accent}18`, color: accent }}>
          DEPTH
        </span>
        <RowControls accentColor={accent} isFirst={isFirst} isLast={isLast} onMove={onMove} onDelete={onDelete} />
      </div>

      {/* fields */}
      <div className="grid grid-cols-3 gap-2 px-3 pb-2.5">
        <div className="flex flex-col gap-1">
          <label className={labelCls}>{lang === "el" ? "ΒΆΘΟΣ" : "DEPTH"}</label>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={row.targetDepth}
              onChange={(e) => upd({ targetDepth: Math.max(1, parseInt(e.target.value) || 1) })}
              className={`${inputCls} w-full text-center font-bold pr-6`}
              style={{ color: accent }}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[0.6rem] text-white/30">m</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>{lang === "el" ? "ΣΥΝΟΛ. ΧΡΌΝΟΣ" : "TOTAL TIME"}</label>
          <TimeField
            value={row.totalTime}
            onChange={(v) => upd({ totalTime: v })}
            className={`${inputCls} text-center`}
            placeholder="1:30"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>SURFACE INT.</label>
          <TimeField
            value={row.surfaceInterval}
            onChange={(v) => upd({ surfaceInterval: v })}
            className={`${inputCls} text-center`}
            placeholder="3:00"
          />
        </div>
      </div>

      {/* surface interval hint */}
      <div className="px-3 pb-1 -mt-1">
        <span className="text-[0.55rem] text-white/20">
          {lang === "el" ? "min 2× χρόνος κατάδυσης" : "min 2× dive time"}
        </span>
      </div>

      {/* notes */}
      <div className="px-3 pb-3">
        <input
          value={row.notes}
          onChange={(e) => upd({ notes: e.target.value })}
          className={`${inputCls} w-full text-xs text-white/40`}
          placeholder={lang === "el" ? "σημειώσεις…" : "notes…"}
        />
      </div>
    </div>
  );
}

// ── ProgramHistoryRow ──────────────────────────────────────────────────────

function ProgramHistoryRow({ program, lang, onOpen }: {
  program: TrainingProgram; lang: string; onOpen: () => void;
}) {
  const kind = program.discipline ? templateKind(program.discipline) : null;
  const stat = (() => {
    if (kind === "sta") {
      const secs = totalSTAHoldSecs(program.sets);
      return secs > 0 ? `${fmtSeconds(secs)} hold` : "";
    }
    if (kind === "dyn") {
      const m = totalDynMetres(program.sets);
      return m > 0 ? `${m}m` : "";
    }
    if (kind === "depth") {
      const d = maxDepthMetres(program.sets);
      return d > 0 ? `↓${d}m` : "";
    }
    return "";
  })();

  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all"
      style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div>
        <p className="text-sm font-semibold text-white">{program.name}</p>
        <p className="mt-0.5 text-[0.6rem] text-white/30">
          {program.date}
          {program.discipline ? ` · ${program.discipline}` : ""}
          {` · ${program.sets.length} ${kind === "sta" ? "rounds" : kind === "depth" ? "dives" : "sets"}`}
          {stat ? ` · ${stat}` : ""}
        </p>
      </div>
      <ChevronRight className="size-4 text-white/25" />
    </button>
  );
}
