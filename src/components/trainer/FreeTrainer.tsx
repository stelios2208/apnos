import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  X,
  Check,
  Trophy,
  Target,
  Mic,
  MicOff,
  Music,
  VolumeX,
  Vibrate,
  SlidersHorizontal,
  Waves,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionFx } from "@/hooks/use-session-fx";
import { VoiceCuesModal } from "@/components/VoiceCuesModal";
import { UnderwaterScene } from "@/components/UnderwaterScene";
import { LogoBreathPacer } from "@/components/LogoBreathPacer";
import { FxToggle } from "@/components/trainer/FxControls";

// ── types ──────────────────────────────────────────────────────────────────

type Phase = "idle" | "breathe" | "hold" | "recovery";

interface Round {
  breatheSecs: number;
  holdSecs: number;
  recoverySecs: number;
  contractions: number;
  firstContractionSecs: number; // 0 = none recorded
}

// ── constants ──────────────────────────────────────────────────────────────

const PHASE_COLOR: Record<Phase, string> = {
  idle: "#5DCAA5",
  breathe: "#5DCAA5",
  hold: "#1D9E75",
  recovery: "#9FE1CB",
};

const PHASE_BG: Record<Phase, string> = {
  idle: "rgba(93,202,165,0.06)",
  breathe: "rgba(93,202,165,0.08)",
  hold: "rgba(29,158,117,0.12)",
  recovery: "rgba(159,225,203,0.07)",
};

const LONG_PRESS_MS = 800;

// comet lap time on the logo pacer, per phase — breathe paces a calm 8s breath
const PACER_DUR: Record<Phase, number> = {
  idle: 16,
  breathe: 8,
  hold: 14,
  recovery: 6,
};

// ── helpers ────────────────────────────────────────────────────────────────

function fmt(secs: number) {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function sessionStats(rounds: Round[]) {
  if (rounds.length === 0) return { best: 0, avg: 0, total: 0 };
  const holds = rounds.map((r) => r.holdSecs);
  const best = Math.max(...holds);
  const avg = Math.round(holds.reduce((a, b) => a + b, 0) / holds.length);
  const total = holds.reduce((a, b) => a + b, 0);
  return { best, avg, total };
}

// ── component ──────────────────────────────────────────────────────────────

export function FreeTrainer({ onExit }: { onExit: () => void }) {
  const sfx = useSessionFx();
  const {
    lang,
    user,
    canHaptics,
    cue,
    buzz,
    setEnginePhase,
    stopAudio,
    holdTick,
    resetHoldAlerts,
  } = sfx;
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [contractions, setContractions] = useState(0);
  const [firstContraction, setFirstContraction] = useState(0); // secs into hold, 0 = none
  const [rounds, setRounds] = useState<Round[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [showVoice, setShowVoice] = useState(false);

  const phaseStart = useRef<number>(Date.now());
  const breatheStart = useRef<number>(0);
  const holdStart = useRef<number>(0);
  const recoveryStart = useRef<number>(0);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  // ── tick ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase === "idle") return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - phaseStart.current) / 1000));
    }, 200);
    return () => clearInterval(id);
  }, [phase]);

  // ── milestone cues + hold alerts during a hold ─────────────────────────────
  useEffect(() => {
    if (phase !== "hold") return;
    holdTick(elapsed);
  }, [elapsed, phase, holdTick]);

  // ── phase transitions ──────────────────────────────────────────────────

  const startBreathe = useCallback(() => {
    breatheStart.current = Date.now();
    phaseStart.current = Date.now();
    setPhase("breathe");
    setElapsed(0);
    setContractions(0);
    setFirstContraction(0);
    buzz(60);
    cue("breathe");
    setEnginePhase("breathe");
  }, [buzz, cue, setEnginePhase]);

  const startHold = useCallback(() => {
    holdStart.current = Date.now();
    phaseStart.current = Date.now();
    setPhase("hold");
    setElapsed(0);
    resetHoldAlerts();
    buzz([40, 60, 40]);
    cue("hold");
    setEnginePhase("hold");
  }, [buzz, cue, setEnginePhase, resetHoldAlerts]);

  const startRecovery = useCallback(() => {
    recoveryStart.current = Date.now();
    phaseStart.current = Date.now();
    setPhase("recovery");
    setElapsed(0);
    buzz([120, 80, 120]);
    cue("recovery");
    setEnginePhase("recovery");
  }, [buzz, cue, setEnginePhase]);

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
      const at = Math.round((Date.now() - holdStart.current) / 1000);
      setContractions((c) => c + 1);
      setFirstContraction((f) => (f === 0 ? Math.max(1, at) : f));
      buzz(25);
    } else if (phase === "recovery") {
      const breatheSecs = Math.round((holdStart.current - breatheStart.current) / 1000);
      const holdSecs = Math.round((recoveryStart.current - holdStart.current) / 1000);
      const recoverySecs = Math.round((Date.now() - recoveryStart.current) / 1000);
      setRounds((prev) => [
        {
          breatheSecs,
          holdSecs,
          recoverySecs,
          contractions,
          firstContractionSecs: firstContraction,
        },
        ...prev,
      ]);
      startBreathe();
    }
  }, [phase, contractions, firstContraction, startBreathe, startHold, buzz]);

  // ── end session (opens modal, captures in-progress recovery if any) ────

  const handleEndSession = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      // if currently in recovery, flush the round
      if (phase === "recovery") {
        const breatheSecs = Math.round((holdStart.current - breatheStart.current) / 1000);
        const holdSecs = Math.round((recoveryStart.current - holdStart.current) / 1000);
        const recoverySecs = Math.round((Date.now() - recoveryStart.current) / 1000);
        setRounds((prev) => [
          {
            breatheSecs,
            holdSecs,
            recoverySecs,
            contractions,
            firstContractionSecs: firstContraction,
          },
          ...prev,
        ]);
      }
      stopAudio();
      setSaved(false);
      setShowModal(true);
    },
    [phase, contractions, firstContraction, stopAudio],
  );

  // ── exit trainer (back) — protect an in-progress session ──────────────────
  const handleExit = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      const hasData = rounds.length > 0 || phase === "recovery";
      if (hasData) {
        // route to the summary so the athlete can save (or discard) first
        handleEndSession(e);
        return;
      }
      if (phase !== "idle") {
        const msg =
          lang === "el"
            ? "Έξοδος; Η τρέχουσα κράτηση θα χαθεί."
            : "Exit? Your current hold will be lost.";
        if (!confirm(msg)) return;
      }
      stopAudio();
      onExit();
    },
    [rounds.length, phase, lang, onExit, handleEndSession, stopAudio],
  );

  // ── save ───────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!user || saving) return;
    setSaving(true);

    const chronological = [...rounds].reverse();
    const { best, avg } = sessionStats(rounds);
    const date = todayISO();

    const notesLines = [
      `STA Session — ${chronological.length} rounds`,
      `Best: ${fmt(best)} | Avg: ${fmt(avg)}`,
      `Rounds: ${JSON.stringify(
        chronological.map((r) => ({
          breathe: fmt(r.breatheSecs),
          hold: fmt(r.holdSecs),
          recovery: fmt(r.recoverySecs),
          contractions: r.contractions,
          firstContraction: r.firstContractionSecs ? fmt(r.firstContractionSecs) : null,
        })),
      )}`,
    ];

    const [diveRes, sessionRes] = await Promise.all([
      supabase.from("dives").insert({
        user_id: user.id,
        discipline: "STA",
        session_type: "training",
        dive_date: date,
        result: best,
        notes: notesLines.join("\n"),
      }),
      supabase.from("sta_sessions").insert({
        user_id: user.id,
        date,
        rounds: chronological,
        best_hold: best,
        avg_hold: avg,
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
    idle: lang === "el" ? "Πάτα για έναρξη" : "TAP TO START",
    breathe: lang === "el" ? "Αναπνοή" : "BREATHE",
    hold: lang === "el" ? "Κράτα" : "HOLD",
    recovery: lang === "el" ? "Ανάκαμψη" : "RECOVERY",
  };

  const subLabel: Record<Phase, string> = {
    idle: "",
    breathe: lang === "el" ? "Πάτα για HOLD" : "TAP to start HOLD",
    hold:
      lang === "el" ? "Πάτα = σύσπαση · Κράτα = ανάκαμψη" : "TAP = contraction · HOLD = recovery",
    recovery: lang === "el" ? "Πάτα για νέο γύρο" : "TAP to start next round",
  };

  const color = PHASE_COLOR[phase];
  const stats = sessionStats(rounds);
  const canEnd = rounds.length > 0 || phase === "recovery";

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{ background: "#020a13" }}
    >
      {sfx.fx.scene && <UnderwaterScene />}
      {/* phase background wash */}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-700"
        style={{ background: PHASE_BG[phase] }}
      />

      {/* back / exit */}
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={handleExit}
        aria-label={lang === "el" ? "Έξοδος" : "Exit"}
        className="absolute left-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full transition-all"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        <ArrowLeft className="size-4" />
      </button>

      {/* guided-session controls */}
      <div
        className="absolute right-3 top-3 z-20 flex gap-2"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <FxToggle
          active={sfx.fx.scene}
          onClick={() => sfx.toggleFx("scene")}
          on={<Waves className="size-4" />}
          off={<Waves className="size-4" />}
          label={lang === "el" ? "Βυθός" : "Scene"}
        />
        <FxToggle
          active={sfx.fx.voice}
          onClick={() => sfx.toggleFx("voice")}
          on={<Mic className="size-4" />}
          off={<MicOff className="size-4" />}
          label={lang === "el" ? "Φωνή" : "Voice"}
        />
        <FxToggle
          active={sfx.fx.sound}
          onClick={() => sfx.toggleFx("sound")}
          on={<Music className="size-4" />}
          off={<VolumeX className="size-4" />}
          label={lang === "el" ? "Ήχος" : "Sound"}
        />
        <FxToggle
          active={canHaptics && sfx.fx.haptics}
          disabled={!canHaptics}
          onClick={() => sfx.toggleFx("haptics")}
          on={<Vibrate className="size-4" />}
          off={<Vibrate className="size-4" />}
          label={
            canHaptics
              ? lang === "el"
                ? "Δόνηση"
                : "Haptics"
              : lang === "el"
                ? "Η δόνηση δεν υποστηρίζεται σε iPhone"
                : "Haptics not supported on iPhone"
          }
        />
        <button
          onClick={() => setShowVoice(true)}
          aria-label={lang === "el" ? "Η φωνή μου" : "My voice cues"}
          title={lang === "el" ? "Η φωνή μου" : "My voice cues"}
          className="relative flex h-11 w-11 items-center justify-center rounded-full transition-all"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          <SlidersHorizontal className="size-4" />
          {sfx.hasCues && (
            <span
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full"
              style={{ background: "#1D9E75", boxShadow: "0 0 6px #1D9E7580" }}
            />
          )}
        </button>
      </div>

      {/* tap zone */}
      <div
        className="relative flex flex-1 flex-col items-center justify-center gap-6 cursor-pointer"
        onMouseDown={onPressStart}
        onMouseUp={onPressEnd}
        onMouseLeave={() => {
          if (pressTimer.current) clearTimeout(pressTimer.current);
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          onPressStart();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          onPressEnd();
        }}
      >
        <LogoBreathPacer
          key={phase}
          size={170}
          color={phase === "idle" ? "rgba(93,202,165,0.45)" : color}
          duration={PACER_DUR[phase]}
        />

        <span
          className="text-xs font-bold tracking-[0.3em] transition-colors duration-500"
          style={{ color }}
        >
          {phaseLabel[phase]}
        </span>

        <span
          className="font-mono text-[2.75rem] font-light leading-none tabular-nums transition-colors duration-500"
          style={{ color: phase === "idle" ? "#4a6a80" : color }}
        >
          {phase === "idle" ? "00:00" : fmt(elapsed)}
        </span>

        {phase === "hold" && (
          <div className="flex flex-col items-center gap-2">
            {contractions === 0 ? (
              <span className="text-[0.6rem] tracking-widest" style={{ color: "#EF9F2760" }}>
                {lang === "el" ? "χωρίς συσπάσεις" : "no contractions yet"}
              </span>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-mono text-4xl font-bold tabular-nums leading-none"
                    style={{ color: "#EF9F27" }}
                  >
                    {contractions}
                  </span>
                  <span
                    className="text-[0.55rem] font-bold tracking-widest"
                    style={{ color: "#EF9F2790" }}
                  >
                    {lang === "el" ? "ΣΥΣΠΑΣΕΙΣ" : "CONTRACTIONS"}
                  </span>
                </div>
                <div className="flex max-w-[220px] flex-wrap justify-center gap-1.5">
                  {Array.from({ length: Math.min(contractions, 20) }).map((_, i) => (
                    <span
                      key={i}
                      className="h-2 w-2 rounded-full"
                      style={{ background: "#EF9F27", boxShadow: "0 0 5px #EF9F2770" }}
                    />
                  ))}
                </div>
                {firstContraction > 0 && (
                  <span className="text-[0.6rem] tracking-widest" style={{ color: "#EF9F2775" }}>
                    {lang === "el" ? "1η σύσπαση" : "1st contraction"} · {fmt(firstContraction)}
                  </span>
                )}
              </>
            )}
          </div>
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
          style={{ borderColor: `${color}30`, background: "rgba(7,10,16,0.95)", maxHeight: "30vh" }}
        >
          <div className="px-4 py-3">
            <p className="mb-2 text-[0.6rem] font-bold tracking-[0.25em] text-white/30">
              {lang === "el" ? "ΓΥΡΟΙ" : "ROUNDS"}
            </p>
            <div className="space-y-2">
              {rounds.map((r, i) => (
                <RoundRow
                  key={i}
                  round={r}
                  index={rounds.length - i}
                  lang={lang}
                  isBest={r.holdSecs === stats.best}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Τέλος Session button — always visible when session has started */}
      {canEnd && (
        <div
          className="relative z-10 border-t px-4 py-3"
          style={{ borderColor: "rgba(239,80,80,0.15)", background: "rgba(7,10,16,0.98)" }}
        >
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={handleEndSession}
            className="w-full rounded-xl py-3.5 text-sm font-bold tracking-wider transition-all"
            style={{
              border: "1.5px solid rgba(239,80,80,0.4)",
              color: "#ef5050",
              background: "rgba(239,80,80,0.06)",
            }}
          >
            {lang === "el" ? "Τέλος Session" : "End Session"}
          </button>
        </div>
      )}

      {/* ── Session Summary Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "rgba(0,0,0,0.85)" }}
        >
          <div className="flex flex-1 flex-col overflow-y-auto" style={{ background: "#0a0f1a" }}>
            {saved ? (
              /* success */
              <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 py-12">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full"
                  style={{
                    background: "rgba(29,158,117,0.15)",
                    border: "1.5px solid rgba(29,158,117,0.3)",
                  }}
                >
                  <Check className="size-10" style={{ color: "#1D9E75" }} />
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">
                    {lang === "el" ? "Αποθηκεύτηκε!" : "Saved!"}
                  </p>
                  <p className="mt-1 text-sm text-white/40">
                    {lang === "el"
                      ? `${rounds.length} γύροι · Best ${fmt(stats.best)}`
                      : `${rounds.length} rounds · Best ${fmt(stats.best)}`}
                  </p>
                </div>
                <div className="flex w-full max-w-xs flex-col gap-3">
                  <button
                    onClick={() => navigate({ to: "/dashboard" })}
                    className="w-full rounded-xl py-4 text-sm font-bold transition-colors"
                    style={{ background: "#1D9E75", color: "#fff" }}
                  >
                    {lang === "el" ? "Αποθήκευση & Έξοδος" : "Save & Exit"}
                  </button>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setSaved(false);
                      setRounds([]);
                      setPhase("idle");
                      setElapsed(0);
                    }}
                    className="w-full rounded-xl py-4 text-sm font-semibold transition-colors"
                    style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)" }}
                  >
                    {lang === "el" ? "Νέα Προπόνηση" : "Save & Continue"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* modal header */}
                <div
                  className="flex items-center justify-between border-b px-5 py-4"
                  style={{ borderColor: "rgba(255,255,255,0.06)" }}
                >
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {lang === "el" ? "Session Ολοκληρώθηκε 🎯" : "Session Complete 🎯"}
                    </h2>
                    <p className="mt-0.5 text-xs text-white/30">
                      {new Date().toLocaleDateString(lang === "el" ? "el-GR" : "en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="rounded-lg p-2 text-white/30 hover:text-white transition-colors"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* stat cards */}
                <div className="grid grid-cols-3 gap-3 px-5 py-4">
                  <StatCard
                    label={lang === "el" ? "Καλύτερο Hold" : "Best Hold"}
                    value={fmt(stats.best)}
                    color="#EF9F27"
                    icon={<Trophy className="size-4" style={{ color: "#EF9F27" }} />}
                  />
                  <StatCard
                    label={lang === "el" ? "Μέσος Όρος" : "Average"}
                    value={fmt(stats.avg)}
                    color="#5DCAA5"
                    icon={<Target className="size-4" style={{ color: "#5DCAA5" }} />}
                  />
                  <StatCard
                    label={lang === "el" ? "Γύροι" : "Rounds"}
                    value={String(rounds.length)}
                    color="#9FE1CB"
                  />
                </div>

                {/* rounds table */}
                <div className="px-5 pb-4">
                  <p className="mb-2 text-[0.6rem] font-bold tracking-[0.2em] text-white/25">
                    {lang === "el" ? "ΑΝΑΛΥΣΗ ΓΥΡΩΝ" : "ROUND BREAKDOWN"}
                  </p>

                  {/* table header */}
                  <div
                    className="grid gap-1 rounded-t-lg px-3 py-2"
                    style={{
                      gridTemplateColumns: "2rem 1fr 1fr 1fr 2rem",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    {[
                      "#",
                      lang === "el" ? "Αναπνοή" : "Breathe",
                      lang === "el" ? "Hold" : "Hold",
                      lang === "el" ? "Ανάκαμψη" : "Recovery",
                      lang === "el" ? "Συσπ." : "Con.",
                    ].map((h, i) => (
                      <span
                        key={i}
                        className="text-center text-[0.55rem] font-bold tracking-wider text-white/25"
                      >
                        {h}
                      </span>
                    ))}
                  </div>

                  {/* rows — chronological order */}
                  {[...rounds].reverse().map((r, i) => {
                    const isBest = r.holdSecs === stats.best;
                    return (
                      <div
                        key={i}
                        className="grid items-center gap-1 border-t px-3 py-2.5"
                        style={{
                          gridTemplateColumns: "2rem 1fr 1fr 1fr 2rem",
                          borderColor: "rgba(255,255,255,0.04)",
                          background: isBest ? "rgba(239,159,39,0.04)" : "transparent",
                        }}
                      >
                        <span className="text-center text-xs font-bold text-white/20">{i + 1}</span>
                        <span
                          className="text-center font-mono text-xs"
                          style={{ color: "#5DCAA5" }}
                        >
                          {fmt(r.breatheSecs)}
                        </span>
                        <div className="flex flex-col items-center">
                          <span
                            className="font-mono text-xs font-bold"
                            style={{ color: isBest ? "#EF9F27" : "#1D9E75" }}
                          >
                            {fmt(r.holdSecs)}
                          </span>
                          {isBest && (
                            <span
                              className="text-[0.45rem] font-bold tracking-widest"
                              style={{ color: "#EF9F2780" }}
                            >
                              BEST
                            </span>
                          )}
                        </div>
                        <span
                          className="text-center font-mono text-xs"
                          style={{ color: "#9FE1CB" }}
                        >
                          {fmt(r.recoverySecs)}
                        </span>
                        <span className="text-center text-xs text-white/30">
                          {r.contractions > 0 ? r.contractions : "—"}
                        </span>
                      </div>
                    );
                  })}

                  {/* totals row */}
                  <div
                    className="grid items-center gap-1 rounded-b-lg border-t px-3 py-2.5"
                    style={{
                      gridTemplateColumns: "2rem 1fr 1fr 1fr 2rem",
                      borderColor: "rgba(29,158,117,0.2)",
                      background: "rgba(29,158,117,0.05)",
                    }}
                  >
                    <span className="text-center text-[0.55rem] font-bold tracking-wider text-white/25">
                      {lang === "el" ? "ΣΥΝ" : "TOT"}
                    </span>
                    <span />
                    <span
                      className="text-center font-mono text-xs font-bold"
                      style={{ color: "#1D9E75" }}
                    >
                      {fmt(stats.total)}
                    </span>
                    <span />
                    <span />
                  </div>
                </div>

                {/* action buttons */}
                <div className="mt-auto space-y-3 px-5 py-5">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full rounded-xl py-4 text-sm font-bold tracking-wider transition-all"
                    style={{
                      background: saving ? "rgba(29,158,117,0.4)" : "#1D9E75",
                      color: "#fff",
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving
                      ? lang === "el"
                        ? "Αποθήκευση…"
                        : "Saving…"
                      : lang === "el"
                        ? "Αποθήκευση"
                        : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setRounds([]);
                      setPhase("idle");
                      setElapsed(0);
                    }}
                    className="w-full py-3 text-sm text-white/35 transition-colors hover:text-white/60"
                  >
                    {lang === "el" ? "Χωρίς αποθήκευση" : "Discard session"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── My Voice Cues manager ──────────────────────────────────────────── */}
      {showVoice && user && (
        <VoiceCuesModal
          uid={user.id}
          lang={lang}
          onClose={() => setShowVoice(false)}
          onChanged={() => {
            void sfx.reloadCues();
          }}
        />
      )}
    </div>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color = "#fff",
  icon,
}: {
  label: string;
  value: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 rounded-xl py-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      {icon && <div>{icon}</div>}
      <span className="font-mono text-lg font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-center text-[0.55rem] font-medium tracking-wider text-white/30">
        {label}
      </span>
    </div>
  );
}

// ── RoundRow ───────────────────────────────────────────────────────────────

function RoundRow({
  round,
  index,
  lang,
  isBest,
}: {
  round: Round;
  index: number;
  lang: string;
  isBest: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{ background: isBest ? "rgba(239,159,39,0.06)" : "rgba(255,255,255,0.03)" }}
    >
      <span className="w-5 text-right text-xs font-bold text-white/20">{index}</span>
      <Cell label={lang === "el" ? "ΑΝΠ" : "BRE"} value={fmt(round.breatheSecs)} color="#5DCAA5" />
      <Cell
        label={lang === "el" ? "ΚΡΤ" : "HLD"}
        value={fmt(round.holdSecs)}
        color={isBest ? "#EF9F27" : "#1D9E75"}
      />
      <Cell label={lang === "el" ? "ΑΝΚ" : "REC"} value={fmt(round.recoverySecs)} color="#9FE1CB" />
      {round.contractions > 0 && (
        <div className="ml-auto flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold" style={{ color: "#EF9F27" }}>
              {round.contractions}
            </span>
            <span
              className="text-[0.5rem] font-bold tracking-widest"
              style={{ color: "#EF9F2780" }}
            >
              {lang === "el" ? "ΣΥΣΠ" : "CON"}
            </span>
          </div>
          {round.firstContractionSecs > 0 && (
            <span className="text-[0.5rem] tracking-wider" style={{ color: "#EF9F2770" }}>
              {lang === "el" ? "1η" : "1st"} {fmt(round.firstContractionSecs)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[0.5rem] font-bold tracking-widest" style={{ color: `${color}80` }}>
        {label}
      </span>
      <span className="font-mono text-xs font-medium tabular-nums" style={{ color }}>
        {value}
      </span>
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
