import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { X, Check, Trophy, BarChart2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/sta-trainer")({
  head: () => ({ meta: [{ title: "STA Trainer — Apnos" }] }),
  component: STATrainer,
});

// ── types ──────────────────────────────────────────────────────────────────

type Phase = "idle" | "breathe" | "hold" | "recovery";

interface Round {
  breatheSecs: number;
  holdSecs: number;
  recoverySecs: number;
  contractions: number;
}

// ── constants ──────────────────────────────────────────────────────────────

const PHASE_COLOR: Record<Phase, string> = {
  idle:     "#5DCAA5",
  breathe:  "#5DCAA5",
  hold:     "#1D9E75",
  recovery: "#9FE1CB",
};

const PHASE_BG: Record<Phase, string> = {
  idle:     "rgba(93,202,165,0.06)",
  breathe:  "rgba(93,202,165,0.08)",
  hold:     "rgba(29,158,117,0.12)",
  recovery: "rgba(159,225,203,0.07)",
};

const LONG_PRESS_MS = 800;

// ── helpers ────────────────────────────────────────────────────────────────

function fmt(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function sessionStats(rounds: Round[]) {
  if (rounds.length === 0) return { best: 0, avg: 0, total: 0 };
  const holds = rounds.map((r) => r.holdSecs);
  const best  = Math.max(...holds);
  const avg   = Math.round(holds.reduce((a, b) => a + b, 0) / holds.length);
  const total = holds.reduce((a, b) => a + b, 0);
  return { best, avg, total };
}

// ── component ──────────────────────────────────────────────────────────────

function STATrainer() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase]               = useState<Phase>("idle");
  const [elapsed, setElapsed]           = useState(0);
  const [contractions, setContractions] = useState(0);
  const [rounds, setRounds]             = useState<Round[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  // per-phase start timestamps
  const phaseStart    = useRef<number>(Date.now());
  const breatheStart  = useRef<number>(0);
  const holdStart     = useRef<number>(0);
  const recoveryStart = useRef<number>(0);

  // long-press tracking
  const pressTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  // ── tick ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase === "idle") return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - phaseStart.current) / 1000));
    }, 200);
    return () => clearInterval(id);
  }, [phase]);

  // ── phase transitions ──────────────────────────────────────────────────

  const startBreathe = useCallback(() => {
    breatheStart.current = Date.now();
    phaseStart.current   = Date.now();
    setPhase("breathe");
    setElapsed(0);
    setContractions(0);
  }, []);

  const startHold = useCallback(() => {
    holdStart.current  = Date.now();
    phaseStart.current = Date.now();
    setPhase("hold");
    setElapsed(0);
  }, []);

  const startRecovery = useCallback(() => {
    recoveryStart.current = Date.now();
    phaseStart.current    = Date.now();
    setPhase("recovery");
    setElapsed(0);
  }, []);

  // ── press handlers ─────────────────────────────────────────────────────

  const onPressStart = useCallback(() => {
    didLongPress.current = false;
    if (phase === "hold") {
      pressTimer.current = setTimeout(() => {
        didLongPress.current = true;
        startRecovery();
      }, LONG_PRESS_MS);
    }
  }, [phase, startRecovery]);

  const onPressEnd = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (didLongPress.current) return;

    if (phase === "idle") {
      startBreathe();
    } else if (phase === "breathe") {
      startHold();
    } else if (phase === "hold") {
      setContractions((c) => c + 1);
    } else if (phase === "recovery") {
      const breatheSecs  = Math.round((holdStart.current     - breatheStart.current)  / 1000);
      const holdSecs     = Math.round((recoveryStart.current - holdStart.current)     / 1000);
      const recoverySecs = Math.round((Date.now()            - recoveryStart.current) / 1000);
      setRounds((prev) => [
        { breatheSecs, holdSecs, recoverySecs, contractions },
        ...prev,
      ]);
      startBreathe();
    }
  }, [phase, contractions, startBreathe, startHold]);

  // ── save ───────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!user || saving) return;
    setSaving(true);

    // rounds are stored newest-first in state; reverse to chronological
    const chronological = [...rounds].reverse();
    const { best, avg } = sessionStats(rounds);
    const date = todayISO();

    const notesLines = [
      `Rounds: ${JSON.stringify(
        chronological.map((r) => ({
          breathe: fmt(r.breatheSecs),
          hold: fmt(r.holdSecs),
          recovery: fmt(r.recoverySecs),
          contractions: r.contractions,
        }))
      )}`,
      `Best: ${fmt(best)} | Avg: ${fmt(avg)} | Total rounds: ${chronological.length}`,
    ];

    const [diveRes, sessionRes] = await Promise.all([
      supabase.from("dives").insert({
        user_id:      user.id,
        discipline:   "STA",
        session_type: "training",
        dive_date:    date,
        result:       best,
        notes:        notesLines.join("\n"),
      }),
      supabase.from("sta_sessions").insert({
        user_id:      user.id,
        date,
        rounds:       chronological,
        best_hold:    best,
        avg_hold:     avg,
        total_rounds: chronological.length,
      }),
    ]);

    setSaving(false);

    if (diveRes.error || sessionRes.error) {
      console.error(diveRes.error ?? sessionRes.error);
      return;
    }

    setSaved(true);
  }, [user, saving, rounds]);

  // ── labels ─────────────────────────────────────────────────────────────

  const phaseLabel: Record<Phase, string> = {
    idle:     lang === "el" ? "Πάτα για έναρξη" : "TAP TO START",
    breathe:  lang === "el" ? "Αναπνοή"          : "BREATHE",
    hold:     lang === "el" ? "Κράτα"             : "HOLD",
    recovery: lang === "el" ? "Ανάκαμψη"          : "RECOVERY",
  };

  const subLabel: Record<Phase, string> = {
    idle:     "",
    breathe:  lang === "el" ? "Πάτα για HOLD" : "TAP to start HOLD",
    hold:     lang === "el" ? "Πάτα = σύσπαση · Κράτα = ανάκαμψη" : "TAP = contraction · HOLD = recovery",
    recovery: lang === "el" ? "Πάτα για νέο γύρο" : "TAP to start next round",
  };

  const color = PHASE_COLOR[phase];
  const stats = sessionStats(rounds);

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{ background: "#070a10", transition: "background 0.6s" }}
    >
      {/* subtle phase background wash */}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-700"
        style={{ background: PHASE_BG[phase] }}
      />

      {/* tap zone */}
      <div
        className="relative flex flex-1 flex-col items-center justify-center gap-6 cursor-pointer"
        onMouseDown={onPressStart}
        onMouseUp={onPressEnd}
        onMouseLeave={() => {
          if (pressTimer.current) clearTimeout(pressTimer.current);
        }}
        onTouchStart={(e) => { e.preventDefault(); onPressStart(); }}
        onTouchEnd={(e) => { e.preventDefault(); onPressEnd(); }}
      >
        <span
          className="text-xs font-bold tracking-[0.3em] transition-colors duration-500"
          style={{ color }}
        >
          {phaseLabel[phase]}
        </span>

        <span
          className="font-mono text-[5rem] font-light leading-none tabular-nums transition-colors duration-500"
          style={{ color: phase === "idle" ? "#2a3a35" : color }}
        >
          {phase === "idle" ? "00:00" : fmt(elapsed)}
        </span>

        {phase === "hold" && (
          <div className="flex gap-2">
            {Array.from({ length: Math.max(contractions, 0) }).map((_, i) => (
              <span
                key={i}
                className="h-3 w-3 rounded-full"
                style={{ background: "#EF9F27", boxShadow: "0 0 6px #EF9F2780" }}
              />
            ))}
            {contractions === 0 && (
              <span className="text-[0.6rem] tracking-widest" style={{ color: "#EF9F2760" }}>
                {lang === "el" ? "χωρίς συσπάσεις" : "no contractions yet"}
              </span>
            )}
          </div>
        )}

        {phase === "hold" && contractions > 0 && (
          <span className="text-xs font-medium" style={{ color: "#EF9F27" }}>
            ×{contractions}
          </span>
        )}

        {subLabel[phase] && (
          <span className="text-[0.6rem] font-medium tracking-widest text-white/30">
            {subLabel[phase]}
          </span>
        )}

        {phase === "hold" && <LongPressHint color={color} />}
      </div>

      {/* round log panel */}
      {rounds.length > 0 && (
        <div
          className="relative z-10 w-full overflow-y-auto border-t"
          style={{
            borderColor: `${color}30`,
            background: "rgba(7,10,16,0.95)",
            maxHeight: "35vh",
          }}
        >
          <div className="px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[0.6rem] font-bold tracking-[0.25em] text-white/30">
                {lang === "el" ? "ΓΥΡΟΙ" : "ROUNDS"}
              </p>
              {/* Save session button — only visible when not in an active hold */}
              {phase !== "hold" && (
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.65rem] font-semibold tracking-wider transition-colors"
                  style={{ background: "rgba(29,158,117,0.2)", color: "#5DCAA5" }}
                >
                  <BarChart2 className="size-3.5" />
                  {lang === "el" ? "Αποθήκευση Session" : "Save Session"}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {rounds.map((r, i) => (
                <RoundRow key={i} round={r} index={rounds.length - i} lang={lang} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Save Modal ──────────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,0.75)" }}
        >
          <div
            className="w-full overflow-y-auto rounded-t-2xl px-4 pb-8 pt-5"
            style={{ background: "#0d1320", maxHeight: "85vh" }}
          >
            {/* header */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-white">
                {lang === "el" ? "Σύνοψη Session" : "Session Summary"}
              </h2>
              <button
                onClick={() => { setShowModal(false); setSaved(false); }}
                className="rounded-lg p-1.5 text-white/30 hover:text-white transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {saved ? (
              /* ── success state ─────────────────────────────────────── */
              <div className="flex flex-col items-center gap-6 py-8">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full"
                  style={{ background: "rgba(29,158,117,0.15)" }}
                >
                  <Check className="size-8" style={{ color: "#1D9E75" }} />
                </div>
                <p className="text-sm font-semibold text-white">
                  {lang === "el" ? "Αποθηκεύτηκε!" : "Saved!"}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate({ to: "/dashboard" })}
                    className="rounded-xl px-5 py-3 text-sm font-semibold transition-colors"
                    style={{ background: "#1D9E75", color: "#fff" }}
                  >
                    {lang === "el" ? "Πίνακας" : "Dashboard"}
                  </button>
                  <button
                    onClick={() => { setShowModal(false); setSaved(false); setRounds([]); setPhase("idle"); }}
                    className="rounded-xl px-5 py-3 text-sm font-semibold transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }}
                  >
                    {lang === "el" ? "Νέο Session" : "New Session"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* stats strip */}
                <div
                  className="mb-4 grid grid-cols-3 gap-2 rounded-xl p-3"
                  style={{ background: "rgba(29,158,117,0.08)" }}
                >
                  <StatChip
                    label={lang === "el" ? "Καλύτερο" : "Best"}
                    value={fmt(stats.best)}
                    icon={<Trophy className="size-3.5" style={{ color: "#EF9F27" }} />}
                  />
                  <StatChip
                    label={lang === "el" ? "Μέσος" : "Avg"}
                    value={fmt(stats.avg)}
                    color="#5DCAA5"
                  />
                  <StatChip
                    label={lang === "el" ? "Γύροι" : "Rounds"}
                    value={String(rounds.length)}
                    color="#9FE1CB"
                  />
                </div>

                {/* rounds table */}
                <div className="mb-5 space-y-1.5">
                  {/* header row */}
                  <div className="grid grid-cols-5 gap-1 px-2 pb-1">
                    {["#", lang === "el" ? "ΑΝΠ" : "BRE", lang === "el" ? "ΚΡΤ" : "HLD", lang === "el" ? "ΑΝΚ" : "REC", lang === "el" ? "ΣΥΣ" : "CON"].map((h) => (
                      <span key={h} className="text-center text-[0.55rem] font-bold tracking-wider text-white/25">{h}</span>
                    ))}
                  </div>

                  {[...rounds].reverse().map((r, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-5 gap-1 rounded-lg px-2 py-2"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <span className="text-center text-xs text-white/30">{i + 1}</span>
                      <span className="text-center font-mono text-xs" style={{ color: "#5DCAA5" }}>{fmt(r.breatheSecs)}</span>
                      <span
                        className="text-center font-mono text-xs font-bold"
                        style={{ color: r.holdSecs === stats.best ? "#EF9F27" : "#1D9E75" }}
                      >
                        {fmt(r.holdSecs)}
                      </span>
                      <span className="text-center font-mono text-xs" style={{ color: "#9FE1CB" }}>{fmt(r.recoverySecs)}</span>
                      <span className="text-center text-xs text-white/40">{r.contractions > 0 ? r.contractions : "—"}</span>
                    </div>
                  ))}

                  {/* total row */}
                  <div
                    className="grid grid-cols-5 gap-1 rounded-lg border px-2 py-2"
                    style={{ borderColor: "rgba(29,158,117,0.2)", background: "rgba(29,158,117,0.06)" }}
                  >
                    <span className="text-center text-[0.6rem] font-bold tracking-wider text-white/30">
                      {lang === "el" ? "ΣΥΝ" : "TOT"}
                    </span>
                    <span className="col-span-1" />
                    <span className="text-center font-mono text-xs font-bold" style={{ color: "#1D9E75" }}>
                      {fmt(stats.total)}
                    </span>
                    <span className="col-span-2" />
                  </div>
                </div>

                {/* save button */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full rounded-xl py-4 text-sm font-bold tracking-wider transition-all"
                  style={{
                    background: saving ? "rgba(29,158,117,0.3)" : "#1D9E75",
                    color: "#fff",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving
                    ? (lang === "el" ? "Αποθήκευση…" : "Saving…")
                    : (lang === "el" ? "Αποθήκευση" : "Save")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── StatChip ───────────────────────────────────────────────────────────────

function StatChip({ label, value, color = "#fff", icon }: { label: string; value: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1">
        {icon}
        <span className="font-mono text-sm font-bold" style={{ color }}>{value}</span>
      </div>
      <span className="text-[0.55rem] tracking-wider text-white/30">{label}</span>
    </div>
  );
}

// ── RoundRow ───────────────────────────────────────────────────────────────

function RoundRow({ round, index, lang }: { round: Round; index: number; lang: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{ background: "rgba(255,255,255,0.03)" }}
    >
      <span className="w-5 text-right text-xs font-bold text-white/20">{index}</span>

      <Cell label={lang === "el" ? "ΑΝΠ" : "BRE"} value={fmt(round.breatheSecs)} color="#5DCAA5" />
      <Cell label={lang === "el" ? "ΚΡΤ" : "HLD"} value={fmt(round.holdSecs)}    color="#1D9E75" />
      <Cell label={lang === "el" ? "ΑΝΚ" : "REC"} value={fmt(round.recoverySecs)} color="#9FE1CB" />

      {round.contractions > 0 && (
        <div className="ml-auto flex items-center gap-1">
          {Array.from({ length: Math.min(round.contractions, 8) }).map((_, j) => (
            <span key={j} className="h-1.5 w-1.5 rounded-full" style={{ background: "#EF9F27" }} />
          ))}
          {round.contractions > 8 && (
            <span className="text-[0.55rem]" style={{ color: "#EF9F27" }}>+{round.contractions - 8}</span>
          )}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[0.5rem] font-bold tracking-widest" style={{ color: `${color}80` }}>{label}</span>
      <span className="font-mono text-xs font-medium tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}

// ── LongPressHint ──────────────────────────────────────────────────────────

function LongPressHint({ color }: { color: string }) {
  return (
    <div className="absolute bottom-8 flex items-center gap-1.5 opacity-40">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="5" stroke={color} strokeWidth="1.2" strokeDasharray="3 2" />
      </svg>
      <span className="text-[0.55rem] tracking-widest" style={{ color }}>
        hold 0.8s → recovery
      </span>
    </div>
  );
}
