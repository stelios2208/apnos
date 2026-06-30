import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ChevronDown, ChevronRight, ChevronUp,
  Copy, Loader2, Plus, Trash2, X, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import {
  type Athlete, type ProgramSet, type TrainingProgram,
  estimatedMinutes, intensityLabel, levelColor, levelLabel,
  fetchAthletes, updateAthletePrograms, newSet, nextSetType,
  setTypeColor, setTypeLabel, todayISO, totalMetres,
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

function defaultProgramName(lang: string): string {
  const d = new Date();
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  return d.toLocaleDateString(lang === "el" ? "el-GR" : "en-GB", opts);
}

// ── AthletePage ────────────────────────────────────────────────────────────

function AthletePage() {
  const { lang }  = useI18n();
  const { user }  = useAuth();
  const { id }    = Route.useParams();
  const qc        = useQueryClient();

  const [tab, setTab]           = useState<Tab>("program");
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCopy, setShowCopy] = useState(false);
  const [saved, setSaved]       = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: athletes = [], isLoading } = useQuery({
    queryKey: ["coach_athletes", user?.id],
    queryFn:  () => fetchAthletes(user!.id),
    enabled:  !!user,
    staleTime: 5 * 60 * 1000, // keep cached data for 5 min so transient auth flicker doesn't clear it
  });

  console.log("[AthletePage] URL id param:", JSON.stringify(id), typeof id);
  console.log("[AthletePage] athletes from Supabase:", athletes.map((a) => ({ id: a.id, name: a.name, match: a.id === id })));
  const athlete: Athlete | undefined = athletes.find((a) => a.id === id);

  // sync programs from server data into local state once loaded
  useEffect(() => {
    if (athlete) {
      setPrograms(athlete.programs ?? []);
      setActiveId((prev) => prev ?? (athlete.programs?.[0]?.id ?? null));
    }
  }, [athlete?.id, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = programs.find((p) => p.id === activeId) ?? null;

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

  const addProgram = () => {
    const prog: TrainingProgram = {
      id: crypto.randomUUID(),
      name: defaultProgramName(lang),
      date: todayISO(),
      sets: [newSet()],
    };
    const updated = [prog, ...programs];
    setActiveId(prog.id);
    scheduleFlush(updated);
  };

  const updateProgram = (prog: TrainingProgram) => {
    scheduleFlush(programs.map((p) => p.id === prog.id ? prog : p));
  };

  const deleteProgram = (progId: string) => {
    const updated = programs.filter((p) => p.id !== progId);
    setPrograms(updated);
    setActiveId(updated[0]?.id ?? null);
    flush(updated);
  };

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
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold"
          style={{ background: `${color}18`, color }}
        >
          {athlete.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">{athlete.name}</h1>
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
          {programs.length === 0 ? (
            <div
              className="flex flex-col items-center gap-4 rounded-2xl py-12 text-center"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.07)" }}
            >
              <Zap className="size-8 text-white/10" />
              <p className="text-sm text-white/30">
                {lang === "el" ? "Κανένα πρόγραμμα ακόμα" : "No programme yet"}
              </p>
              <button
                onClick={addProgram}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
                style={{ background: "#1D9E75", color: "#fff" }}
              >
                <Plus className="size-4" />
                {lang === "el" ? "Νέο Πρόγραμμα" : "New Programme"}
              </button>
            </div>
          ) : (
            <>
              {/* program selector */}
              <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-2 overflow-x-auto pb-0.5">
                  {programs.map((p) => (
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
                  onClick={addProgram}
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
                />
              )}
            </>
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
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                      style={{ background: `${levelColor(a.level)}18`, color: levelColor(a.level) }}
                    >
                      {a.name.charAt(0).toUpperCase()}
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

function ProgramBuilder({ program, lang, saved, onChange, onSave, onDelete, onCopy }: {
  program: TrainingProgram;
  lang: string;
  saved: boolean;
  onChange: (p: TrainingProgram) => void;
  onSave: () => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const update = (partial: Partial<TrainingProgram>) => onChange({ ...program, ...partial });

  const updateSet = (set: ProgramSet) =>
    update({ sets: program.sets.map((s) => s.id === set.id ? set : s) });

  const addSet = () => update({ sets: [...program.sets, newSet()] });

  const deleteSet = (id: string) =>
    update({ sets: program.sets.filter((s) => s.id !== id) });

  const moveSet = (id: string, dir: -1 | 1) => {
    const sets = [...program.sets];
    const i = sets.findIndex((s) => s.id === id);
    if (i + dir < 0 || i + dir >= sets.length) return;
    [sets[i], sets[i + dir]] = [sets[i + dir], sets[i]];
    update({ sets });
  };

  const dist  = totalMetres(program.sets);
  const mins  = estimatedMinutes(program.sets);
  const inten = intensityLabel(program.sets, lang);

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
          onChange={(e) => update({ date: e.target.value })}
          className="rounded-xl bg-white/5 px-3 py-2.5 text-xs text-white/60 outline-none focus:ring-1 focus:ring-[#1D9E75]"
          style={{ colorScheme: "dark" }}
        />
      </div>

      {/* summary card */}
      <div
        className="grid grid-cols-3 gap-2 rounded-xl px-1 py-3"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
      >
        <SummaryChip label={lang === "el" ? "Απόσταση" : "Distance"} value={dist > 0 ? `${dist}m` : "—"} color="#5DCAA5" />
        <SummaryChip label={lang === "el" ? "Χρόνος" : "Duration"} value={mins > 0 ? `~${mins}'` : "—"} color="#9FE1CB" />
        <SummaryChip label={lang === "el" ? "Ένταση" : "Intensity"} value={inten} color={inten === (lang === "el" ? "Υψηλή" : "High") ? "#EF9F27" : "#5DCAA5"} />
      </div>

      {/* column headers */}
      {program.sets.length > 0 && (
        <div
          className="grid items-center gap-1 px-3 py-1.5 text-[0.55rem] font-bold tracking-widest text-white/20"
          style={{ gridTemplateColumns: "80px 32px 1fr 60px 1fr 56px" }}
        >
          <span>{lang === "el" ? "ΤΥΠΟΣ" : "TYPE"}</span>
          <span className="text-center">{lang === "el" ? "ΕΠΑ" : "REP"}</span>
          <span className="text-center">{lang === "el" ? "ΤΙΜΗ" : "VALUE"}</span>
          <span className="text-center">REST</span>
          <span>{lang === "el" ? "ΣΗΜΕΙΩΣΕΙΣ" : "NOTES"}</span>
          <span />
        </div>
      )}

      {/* set rows */}
      <div className="space-y-2">
        {program.sets.map((set, i) => (
          <SetRow
            key={set.id}
            set={set}
            lang={lang}
            isFirst={i === 0}
            isLast={i === program.sets.length - 1}
            onChange={updateSet}
            onDelete={() => deleteSet(set.id)}
            onMove={(dir) => moveSet(set.id, dir)}
          />
        ))}
      </div>

      {/* add set */}
      <button
        onClick={addSet}
        className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all hover:border-[#1D9E75]/40"
        style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}
      >
        <Plus className="size-4" />
        {lang === "el" ? "Νέο Σετ" : "Add Set"}
      </button>

      {/* total */}
      {dist > 0 && (
        <div className="flex items-center justify-end gap-2 px-1">
          <span className="text-[0.65rem] text-white/25">{lang === "el" ? "Σύνολο:" : "Total:"}</span>
          <span className="font-mono text-sm font-bold" style={{ color: "#5DCAA5" }}>{dist}m</span>
        </div>
      )}

      {/* actions */}
      <div className="flex gap-2">
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 rounded-xl px-4 py-3 text-xs font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
        >
          <Copy className="size-3.5" />
          {lang === "el" ? "Αντιγραφή" : "Copy"}
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

// ── SetRow ─────────────────────────────────────────────────────────────────

function SetRow({ set, lang, isFirst, isLast, onChange, onDelete, onMove }: {
  set: ProgramSet;
  lang: string;
  isFirst: boolean;
  isLast: boolean;
  onChange: (s: ProgramSet) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [showCombined, setShowCombined] = useState(set.combined);
  const typeColor = setTypeColor(set.type);
  const typeLabel = setTypeLabel(set.type, lang);
  const update = (partial: Partial<ProgramSet>) => onChange({ ...set, ...partial });

  const toggleCombined = () => {
    const next = !showCombined;
    setShowCombined(next);
    update({ combined: next });
  };

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.05)", borderLeft: `3px solid ${typeColor}` }}
    >
      <div
        className="grid items-center gap-1.5 px-3 py-2.5"
        style={{ gridTemplateColumns: "76px 32px 1fr 60px 1fr 56px" }}
      >
        {/* type — tap to cycle */}
        <button
          onClick={() => update({ type: nextSetType(set.type) })}
          className="rounded-lg px-2 py-1 text-[0.6rem] font-bold tracking-wider text-left transition-all"
          style={{ background: `${typeColor}18`, color: typeColor }}
        >
          {typeLabel}
        </button>

        {/* reps */}
        <input
          type="number"
          min={1}
          value={set.reps}
          onChange={(e) => update({ reps: Math.max(1, parseInt(e.target.value) || 1) })}
          className="w-full rounded-lg bg-white/5 px-1.5 py-1 text-center text-xs font-bold text-white outline-none focus:ring-1 focus:ring-[#1D9E75]"
        />

        {/* value */}
        <div className="flex items-center gap-1">
          <span className="text-[0.6rem] text-white/20">×</span>
          <input
            value={set.value}
            onChange={(e) => update({ value: e.target.value })}
            className="w-full rounded-lg bg-white/5 px-1.5 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-[#1D9E75]"
            placeholder="75m"
          />
        </div>

        {/* rest */}
        <input
          value={set.rest}
          onChange={(e) => update({ rest: e.target.value })}
          className="w-full rounded-lg bg-white/5 px-1.5 py-1 text-center text-xs text-white outline-none focus:ring-1 focus:ring-[#1D9E75]"
          placeholder="2:00"
        />

        {/* notes */}
        <input
          value={set.notes}
          onChange={(e) => update({ notes: e.target.value })}
          className="w-full rounded-lg bg-white/5 px-1.5 py-1 text-xs text-white/60 outline-none focus:ring-1 focus:ring-[#1D9E75]"
          placeholder={lang === "el" ? "σημειώσεις" : "notes"}
        />

        {/* controls */}
        <div className="flex items-center justify-end gap-0.5">
          <button onClick={() => onMove(-1)} disabled={isFirst} className="rounded p-1 text-white/20 hover:text-white/60 disabled:opacity-20">
            <ChevronUp className="size-3.5" />
          </button>
          <button onClick={() => onMove(1)} disabled={isLast} className="rounded p-1 text-white/20 hover:text-white/60 disabled:opacity-20">
            <ChevronDown className="size-3.5" />
          </button>
          <button onClick={onDelete} className="rounded p-1 text-white/20 hover:text-red-400/70">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* combined toggle */}
      <div className="flex items-start gap-3 border-t px-3 py-1.5" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        <button
          onClick={toggleCombined}
          className="flex items-center gap-1 text-[0.55rem] font-semibold tracking-wider transition-colors"
          style={{ color: showCombined ? "#5DCAA5" : "rgba(255,255,255,0.2)" }}
        >
          {showCombined ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          {lang === "el" ? "Συνδυασμός STA+DYN" : "Combined STA+DYN"}
        </button>
        {showCombined && (
          <div className="flex flex-1 items-center gap-2">
            <input
              value={set.staTime}
              onChange={(e) => update({ staTime: e.target.value })}
              className="w-20 rounded-lg bg-white/5 px-1.5 py-1 text-center text-xs text-white outline-none focus:ring-1 focus:ring-[#1D9E75]"
              placeholder="1:30 STA"
            />
            <span className="text-[0.6rem] text-white/20">+</span>
            <input
              value={set.dynDist}
              onChange={(e) => update({ dynDist: e.target.value })}
              className="w-20 rounded-lg bg-white/5 px-1.5 py-1 text-center text-xs text-white outline-none focus:ring-1 focus:ring-[#1D9E75]"
              placeholder="100m DYN"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── SummaryChip ────────────────────────────────────────────────────────────

function SummaryChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-sm font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="text-[0.5rem] font-bold tracking-widest text-white/25">{label}</span>
    </div>
  );
}

// ── ProgramHistoryRow ──────────────────────────────────────────────────────

function ProgramHistoryRow({ program, lang, onOpen }: {
  program: TrainingProgram; lang: string; onOpen: () => void;
}) {
  const dist = totalMetres(program.sets);
  const mins = estimatedMinutes(program.sets);
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all"
      style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div>
        <p className="text-sm font-semibold text-white">{program.name}</p>
        <p className="mt-0.5 text-[0.6rem] text-white/30">
          {program.date} · {program.sets.length} {lang === "el" ? "σετ" : "sets"}
          {dist > 0 ? ` · ${dist}m` : ""}
          {mins > 0 ? ` · ~${mins}'` : ""}
        </p>
      </div>
      <ChevronRight className="size-4 text-white/25" />
    </button>
  );
}
