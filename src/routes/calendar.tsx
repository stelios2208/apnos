import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { fetchDives } from "@/lib/dives";
import { disciplineName, formatResult } from "@/lib/diving";
import { useI18n } from "@/lib/i18n";
import type { Dive } from "@/lib/diving";

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
  "Ιανουάριος","Φεβρουάριος","Μάρτιος","Απρίλιος","Μάιος","Ιούνιος",
  "Ιούλιος","Αύγουστος","Σεπτέμβριος","Οκτώβριος","Νοέμβριος","Δεκέμβριος",
];
const MONTHS_EN = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── component ──────────────────────────────────────────────────────────────────

function Calendar() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const today = new Date();

  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected]   = useState<string | null>(toYMD(today));

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

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const days   = daysInMonth(viewYear, viewMonth);
  const offset = firstWeekday(viewYear, viewMonth);
  const todayStr = toYMD(today);
  const weekdays = lang === "el" ? WEEKDAYS_EL : WEEKDAYS_EN;
  const monthName = (lang === "el" ? MONTHS_EL : MONTHS_EN)[viewMonth];

  const selectedDives = selected ? (byDate[selected] ?? []) : [];

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {lang === "el" ? "Ημερολόγιο" : "Calendar"}
        </h1>
        <Link
          to="/log"
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
          style={{ background: "#1D9E75" }}
          aria-label={lang === "el" ? "Νέα βουτιά" : "New dive"}
        >
          <Plus className="size-5 text-white" />
        </Link>
      </div>

      {/* calendar card */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        {/* month nav */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="rounded-lg p-1.5 text-white/40 hover:text-white transition-colors">
            <ChevronLeft className="size-5" />
          </button>
          <span className="text-sm font-semibold text-white">
            {monthName} {viewYear}
          </span>
          <button onClick={nextMonth} className="rounded-lg p-1.5 text-white/40 hover:text-white transition-colors">
            <ChevronRight className="size-5" />
          </button>
        </div>

        {/* weekday labels */}
        <div className="grid grid-cols-7 gap-0.5">
          {weekdays.map(d => (
            <div key={d} className="py-1 text-center text-[0.6rem] font-bold tracking-wider text-white/25">
              {d}
            </div>
          ))}
        </div>

        {/* day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {/* leading empty cells */}
          {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}

          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const ymd = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayDives = byDate[ymd] ?? [];
            const isToday   = ymd === todayStr;
            const isSelected = ymd === selected;
            const isFuture  = ymd > todayStr;
            const hasComp   = dayDives.some(d => d.session_type === "competition");
            const hasTraining = dayDives.some(d => d.session_type !== "competition");

            return (
              <button
                key={ymd}
                onClick={() => setSelected(isSelected ? null : ymd)}
                className="relative flex flex-col items-center rounded-lg py-1.5 transition-colors"
                style={{
                  background: isSelected ? "rgba(29,158,117,0.25)" : isToday ? "rgba(93,202,165,0.1)" : "transparent",
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
                      ? "rgba(255,255,255,0.3)"
                      : "rgba(255,255,255,0.7)",
                  }}
                >
                  {day}
                </span>

                {/* dot indicators */}
                {dayDives.length > 0 && (
                  <div className="mt-0.5 flex gap-0.5">
                    {hasTraining && (
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#5DCAA5" }} />
                    )}
                    {hasComp && (
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#EF9F27" }} />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* legend */}
        <div className="flex items-center gap-4 pt-1">
          <span className="flex items-center gap-1.5 text-[0.6rem] text-white/30">
            <span className="h-2 w-2 rounded-full bg-[#5DCAA5]" />
            {lang === "el" ? "Προπόνηση" : "Training"}
          </span>
          <span className="flex items-center gap-1.5 text-[0.6rem] text-white/30">
            <span className="h-2 w-2 rounded-full bg-[#EF9F27]" />
            {lang === "el" ? "Αγώνας" : "Competition"}
          </span>
        </div>
      </div>

      {/* selected day panel */}
      {selected && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-[0.18em] text-white/30">
              {selected}
            </p>
            <Link
              to="/log"
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ background: "rgba(29,158,117,0.15)", color: "#5DCAA5" }}
            >
              <Plus className="size-3.5" />
              {lang === "el" ? "Νέα βουτιά" : "New dive"}
            </Link>
          </div>

          {selectedDives.length === 0 ? (
            <p className="text-sm text-white/25">
              {lang === "el" ? "Καμία βουτιά αυτή την ημέρα." : "No dives logged this day."}
            </p>
          ) : (
            <div className="space-y-2">
              {selectedDives.map(dive => (
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

function DayDiveRow({ dive, lang }: { dive: Dive; lang: "el" | "en" }) {
  const border = dive.session_type === "competition" ? "#EF9F27" : "#1D9E75";
  return (
    <Link
      to="/dive/$id"
      params={{ id: dive.id }}
      className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors"
      style={{ background: "#0d1320", borderLeft: `3px solid ${border}` }}
    >
      <span
        className="shrink-0 rounded-md px-2 py-0.5 text-[0.6rem] font-bold tracking-wider"
        style={{ background: "rgba(29,158,117,0.15)", color: "#5DCAA5" }}
      >
        {dive.discipline}
      </span>
      <span className="text-xs text-white/40">{disciplineName(dive.discipline, lang)}</span>
      <span className="ml-auto font-mono text-sm font-bold text-white">
        {formatResult(dive.discipline, dive.result)}
      </span>
      {dive.is_personal_best && (
        <span className="text-[0.6rem]" style={{ color: "#EF9F27" }}>🏆</span>
      )}
    </Link>
  );
}
