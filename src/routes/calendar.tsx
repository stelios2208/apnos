import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Droplet, Clock, Target, Flame } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { fetchDives } from "@/lib/dives";
import { disciplineName, formatResult } from "@/lib/diving";
import { useI18n } from "@/lib/i18n";
import type { Dive, DisciplineCode } from "@/lib/diving";
import { loadPlans, sortPlans } from "@/lib/dive-plans";
import type { DivePlan } from "@/lib/dive-plans";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "Ημερολόγιο — Apnos" }] }),
  component: () => (
    <AppLayout>
      <Calendar />
    </AppLayout>
  ),
});

// ── helpers ────────────────────────────────────────────────────────────────────

function toYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekday(year: number, month: number) {
  // 0=Sun, make Mon=0
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

const WEEKDAYS_EL = ["Δε", "Τρ", "Τε", "Πε", "Πα", "Σα", "Κυ"];
const WEEKDAYS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const MONTHS_EL = [
  "Ιανουάριος",
  "Φεβρουάριος",
  "Μάρτιος",
  "Απρίλιος",
  "Μάιος",
  "Ιούνιος",
  "Ιούλιος",
  "Αύγουστος",
  "Σεπτέμβριος",
  "Οκτώβριος",
  "Νοέμβριος",
  "Δεκέμβριος",
];
const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Discipline accent colours for the planned-dive chip — mirrors the palette
// used on the /planner page so the same discipline reads the same colour
// everywhere.
const PLAN_DISC_COLOR: Record<string, string> = {
  STA: "#9FE1CB",
  DYN: "#1D9E75",
  DYNB: "#1D9E75",
  DNF: "#5DCAA5",
  CWT: "#EF9F27",
  CWTB: "#EF9F27",
  CNF: "#e8a020",
  FIM: "#d4912a",
};
const planDiscColor = (d: DisciplineCode) => PLAN_DISC_COLOR[d] ?? "#5DCAA5";

// ── component ──────────────────────────────────────────────────────────────────

function Calendar() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const today = new Date();
  const todayStr = toYMD(today);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string | null>(toYMD(today));
  const [plans, setPlans] = useState<DivePlan[]>([]);

  useEffect(() => {
    setPlans(loadPlans());
  }, []);

  const { data: dives = [] } = useQuery({
    queryKey: ["dives", user?.id],
    queryFn: () => fetchDives(user!.id),
    enabled: !!user,
  });

  // index dives by date string
  const byDate = dives.reduce<Record<string, Dive[]>>((acc, d) => {
    (acc[d.dive_date] ??= []).push(d);
    return acc;
  }, {});

  // planned (not-yet-passed) dive-plan dates — plans have no "completed" flag
  // of their own, so "planned" here just means today or in the future.
  const plannedDates = new Set(plans.filter((p) => p.date >= todayStr).map((p) => p.date));

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  };

  const days = daysInMonth(viewYear, viewMonth);
  const offset = firstWeekday(viewYear, viewMonth);
  const weekdays = lang === "el" ? WEEKDAYS_EL : WEEKDAYS_EN;
  const monthName = (lang === "el" ? MONTHS_EL : MONTHS_EN)[viewMonth];

  const selectedDives = selected ? (byDate[selected] ?? []) : [];
  const selectedPlans = selected ? sortPlans(plans.filter((p) => p.date === selected)) : [];

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{lang === "el" ? "Ημερολόγιο" : "Calendar"}</h1>
        <Link
          to="/log"
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
          style={{ background: "#1D9E75" }}
          aria-label={lang === "el" ? "Νέα βουτιά" : "New dive"}
        >
          <Plus className="size-5 text-foreground" />
        </Link>
      </div>

      {/* calendar card */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        {/* month nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="rounded-lg p-1.5 text-foreground/40 hover:text-foreground transition-colors"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="text-sm font-semibold text-foreground">
            {monthName} {viewYear}
          </span>
          <button
            onClick={nextMonth}
            className="rounded-lg p-1.5 text-foreground/40 hover:text-foreground transition-colors"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {/* weekday labels */}
        <div className="grid grid-cols-7 gap-0.5">
          {weekdays.map((d) => (
            <div
              key={d}
              className="py-1 text-center text-[0.6rem] font-bold tracking-wider text-foreground/25"
            >
              {d}
            </div>
          ))}
        </div>

        {/* day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {/* leading empty cells */}
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`e${i}`} />
          ))}

          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const ymd = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayDives = byDate[ymd] ?? [];
            const isToday = ymd === todayStr;
            const isSelected = ymd === selected;
            const isFuture = ymd > todayStr;
            const hasComp = dayDives.some((d) => d.session_type === "competition");
            const hasTraining = dayDives.some((d) => d.session_type !== "competition");
            const hasPlanned = plannedDates.has(ymd);

            return (
              <button
                key={ymd}
                onClick={() => setSelected(isSelected ? null : ymd)}
                className="relative flex flex-col items-center rounded-lg py-1.5 transition-colors"
                style={{
                  background: isSelected
                    ? "rgba(29,158,117,0.25)"
                    : isToday
                      ? "rgba(93,202,165,0.1)"
                      : "transparent",
                }}
              >
                <span
                  className="text-xs font-medium"
                  style={{
                    color: isSelected
                      ? "#5DCAA5"
                      : isToday
                        ? "#5DCAA5"
                        : isFuture
                          ? "rgba(var(--ink),0.3)"
                          : "rgba(var(--ink),0.7)",
                  }}
                >
                  {day}
                </span>

                {/* dot indicators */}
                {(dayDives.length > 0 || hasPlanned) && (
                  <div className="mt-0.5 flex items-center gap-0.5">
                    {hasTraining && (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: "#5DCAA5" }}
                      />
                    )}
                    {hasComp && (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: "#EF9F27" }}
                      />
                    )}
                    {hasPlanned && (
                      <Droplet className="size-2" style={{ color: "#4FA8E0" }} fill="#4FA8E0" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* legend */}
        <div className="flex items-center gap-4 pt-1">
          <span className="flex items-center gap-1.5 text-[0.6rem] text-foreground/30">
            <span className="h-2 w-2 rounded-full bg-[#5DCAA5]" />
            {lang === "el" ? "Προπόνηση" : "Training"}
          </span>
          <span className="flex items-center gap-1.5 text-[0.6rem] text-foreground/30">
            <span className="h-2 w-2 rounded-full bg-[#EF9F27]" />
            {lang === "el" ? "Αγώνας" : "Competition"}
          </span>
          <span className="flex items-center gap-1.5 text-[0.6rem] text-foreground/30">
            <Droplet className="size-2.5" style={{ color: "#4FA8E0" }} fill="#4FA8E0" />
            {lang === "el" ? "Προγραμματισμένη" : "Planned"}
          </span>
        </div>
      </div>

      {/* selected day panel */}
      {selected && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-[0.18em] text-foreground/30">{selected}</p>
            <Link
              to="/log"
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ background: "rgba(29,158,117,0.15)", color: "#5DCAA5" }}
            >
              <Plus className="size-3.5" />
              {lang === "el" ? "Νέα βουτιά" : "New dive"}
            </Link>
          </div>

          {selectedPlans.length === 0 && selectedDives.length === 0 ? (
            <p className="text-sm text-foreground/25">
              {lang === "el" ? "Καμία βουτιά αυτή την ημέρα." : "No dives logged this day."}
            </p>
          ) : (
            <div className="space-y-2">
              {selectedPlans.map((plan) => (
                <PlannedDiveRow key={plan.id} plan={plan} lang={lang as "el" | "en"} />
              ))}
              {selectedDives.map((dive) => (
                <DayDiveRow key={dive.id} dive={dive} lang={lang as "el" | "en"} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DayDiveRow ─────────────────────────────────────────────────────────────────

function parseSTANotes(notes: string | null): { best: string; rounds: number } | null {
  if (!notes) return null;
  const roundsMatch =
    notes.match(/Total rounds:\s*(\d+)/i) ?? notes.match(/"total_rounds":\s*(\d+)/);
  const bestMatch = notes.match(/Best:\s*([\d:]+)/i);
  if (!bestMatch) return null;
  return {
    best: bestMatch[1],
    rounds: roundsMatch ? Number(roundsMatch[1]) : 0,
  };
}

function DayDiveRow({ dive, lang }: { dive: Dive; lang: "el" | "en" }) {
  const border = dive.session_type === "competition" ? "#EF9F27" : "#1D9E75";

  // STA training: show structured summary instead of raw result
  const isSTATraining = dive.discipline === "STA" && dive.session_type === "training";
  const staParsed = isSTATraining ? parseSTANotes(dive.notes) : null;

  return (
    <Link
      to="/dive/$id"
      params={{ id: dive.id }}
      className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors"
      style={{ background: "var(--card)", borderLeft: `3px solid ${border}` }}
    >
      <span
        className="shrink-0 rounded-md px-2 py-0.5 text-[0.6rem] font-bold tracking-wider"
        style={{ background: "rgba(29,158,117,0.15)", color: "#5DCAA5" }}
      >
        {dive.discipline}
      </span>

      {isSTATraining && staParsed ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-foreground/80">
            {lang === "el" ? "STA Προπόνηση" : "STA Training"}
          </span>
          <span className="text-[0.6rem] text-foreground/35">
            {lang === "el"
              ? `Best hold: ${staParsed.best} · ${staParsed.rounds} γύροι`
              : `Best hold: ${staParsed.best} · ${staParsed.rounds} rounds`}
          </span>
        </div>
      ) : (
        <>
          <span className="text-xs text-foreground/40">
            {disciplineName(dive.discipline, lang)}
          </span>
          <span className="ml-auto font-mono text-sm font-bold text-foreground">
            {formatResult(dive.discipline, dive.result)}
          </span>
        </>
      )}

      {isSTATraining && staParsed && (
        <span className="ml-auto font-mono text-sm font-bold" style={{ color: "#5DCAA5" }}>
          {staParsed.best}
        </span>
      )}

      {dive.is_personal_best && (
        <span className="text-[0.6rem]" style={{ color: "#EF9F27" }}>
          🏆
        </span>
      )}
    </Link>
  );
}

// ── PlannedDiveRow ───────────────────────────────────────────────────────────
// Planned dives live in localStorage (src/lib/dive-plans.ts), not Supabase —
// this renders the full detail (discipline, target, top time, linked warm-up
// protocol, notes) tapping a day exposes, mirroring the /planner page's card.

function PlannedDiveRow({ plan, lang }: { plan: DivePlan; lang: "el" | "en" }) {
  const color = planDiscColor(plan.discipline);
  return (
    <Link
      to="/planner"
      className="flex flex-col gap-1.5 rounded-xl px-4 py-3 transition-colors"
      style={{
        background: "var(--card)",
        borderLeft: `3px solid ${color}`,
        border: "1px dashed rgba(79,168,224,0.3)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="shrink-0 rounded-md px-2 py-0.5 text-[0.6rem] font-bold tracking-wider"
          style={{ background: `${color}22`, color }}
        >
          {plan.discipline}
        </span>
        <span className="text-xs font-semibold text-foreground/80">
          {disciplineName(plan.discipline, lang)}
        </span>
        <Droplet className="ml-auto size-3.5" style={{ color: "#4FA8E0" }} fill="#4FA8E0" />
        <span className="text-[0.6rem] font-bold tracking-wider" style={{ color: "#4FA8E0" }}>
          {lang === "el" ? "ΠΡΟΓΡΑΜΜΑΤΙΣΜΕΝΗ" : "PLANNED"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.68rem] text-foreground/45">
        {plan.topTime && (
          <span className="flex items-center gap-1">
            <Clock className="size-3" /> {plan.topTime}
          </span>
        )}
        {plan.target && (
          <span className="flex items-center gap-1">
            <Target className="size-3" /> {plan.target}
          </span>
        )}
        {plan.warmupName && (
          <span className="flex items-center gap-1">
            <Flame className="size-3" style={{ color: "#EF9F27" }} /> {plan.warmupName}
          </span>
        )}
      </div>

      {plan.notes && <p className="text-xs text-foreground/40">{plan.notes}</p>}
    </Link>
  );
}
