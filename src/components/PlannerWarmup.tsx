import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipForward, X, ChevronDown, Flame } from "lucide-react";
import { type WarmupPreset, type WarmupStep, type WarmupStepKind, fmtClock } from "@/lib/warmups";
import { useSessionFx } from "@/hooks/use-session-fx";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { UnderwaterScene } from "@/components/UnderwaterScene";
import { LogoBreathPacer } from "@/components/LogoBreathPacer";

// ── PlannerWarmup ────────────────────────────────────────────────────────────
// A warm-up runner mounted inside the dive planner, above the TOP countdown,
// so the athlete can breathe through their warm-up without leaving the
// pre-dive flow. Two things make it "smooth" per the athlete's ask:
//   1. It stays mounted while running (owned by the planner page, not the
//      countdown sheet) — minimizing to a floating chip and reopening never
//      restarts the sequence.
//   2. Timing is wall-clock based (elapsed = now − start − paused), so it
//      self-corrects even after the screen locks or the tab is backgrounded,
//      when setInterval throttles.

const STEP_COLOR: Record<WarmupStepKind, string> = {
  breathe: "#5DCAA5",
  inhale: "#4FA8E0",
  exhale: "#EF9F27",
  hold: "#1D9E75",
  rest: "#9FE1CB",
};

// Voice cues only make sense on steps long enough to talk over.
const VOICE_MIN_STEP_SECS = 15;

function stepLabel(kind: WarmupStepKind, lang: string): string {
  const el = lang === "el";
  if (kind === "breathe") return el ? "Αναπνοή" : "Breathe";
  if (kind === "inhale") return el ? "Εισπνοή" : "Inhale";
  if (kind === "exhale") return el ? "Εκπνοή" : "Exhale";
  if (kind === "hold") return el ? "Κράτα" : "Hold";
  return el ? "Ξεκούραση" : "Rest";
}

function cuePhase(kind: WarmupStepKind): "breathe" | "hold" | "recovery" {
  if (kind === "hold") return "hold";
  if (kind === "exhale" || kind === "rest") return "recovery";
  return "breathe";
}

function sweepDuration(step: WarmupStep): number {
  if (step.kind === "inhale" || step.kind === "exhale") return Math.max(step.secs, 3);
  if (step.kind === "hold") return 14;
  if (step.kind === "rest") return 10;
  return 8;
}

export function PlannerWarmup({
  preset,
  minimized,
  onMinimize,
  onExpand,
  onStop,
  lang,
}: {
  preset: WarmupPreset;
  minimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
  onStop: () => void;
  lang: string;
}) {
  const el = lang === "el";
  const sfx = useSessionFx();
  const sfxRef = useRef(sfx);
  sfxRef.current = sfx;
  useWakeLock(true); // keep screen on so the timer + cues survive right up to TOP

  const steps = preset.steps;
  const bounds = useMemo(() => {
    let acc = 0;
    return steps.map((s) => (acc += s.secs));
  }, [steps]);
  const total = bounds[bounds.length - 1] ?? 0;

  const startedRef = useRef(Date.now());
  const pausedAccumRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const lastIdxRef = useRef(-1);

  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const computeElapsed = useCallback(() => {
    const extra = pausedAtRef.current != null ? Date.now() - pausedAtRef.current : 0;
    return Math.max(
      0,
      Math.floor((Date.now() - startedRef.current - pausedAccumRef.current - extra) / 1000),
    );
  }, []);

  const applyStepFx = useCallback((step: WarmupStep) => {
    const s = sfxRef.current;
    s.buzz(step.kind === "hold" ? [40, 60, 40] : step.kind === "rest" ? [120, 80, 120] : 60);
    const phase = cuePhase(step.kind);
    s.setEnginePhase(phase);
    if (step.secs >= VOICE_MIN_STEP_SECS) s.cue(phase);
    if (step.kind === "hold") s.resetHoldAlerts();
  }, []);

  // first step FX on mount
  useEffect(() => {
    lastIdxRef.current = 0;
    if (steps[0]) applyStepFx(steps[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // stop all audio when the runner unmounts
  useEffect(() => () => sfxRef.current.stopAudio(), []);

  useEffect(() => {
    if (paused || done) return;
    const id = setInterval(() => {
      const elp = computeElapsed();
      if (elp >= total) {
        setElapsed(total);
        setDone(true);
        const s = sfxRef.current;
        s.stopEngine();
        s.buzz([200, 100, 200, 100, 200]);
        s.cue("recovery");
        return;
      }
      let idx = bounds.findIndex((b) => elp < b);
      if (idx < 0) idx = steps.length - 1;
      if (idx !== lastIdxRef.current) {
        lastIdxRef.current = idx;
        if (steps[idx]) applyStepFx(steps[idx]);
      }
      const step = steps[idx];
      if (step?.kind === "hold") {
        const stepStart = idx === 0 ? 0 : bounds[idx - 1]!;
        sfxRef.current.holdTick(elp - stepStart, step.secs);
      }
      setElapsed(elp);
    }, 1000);
    return () => clearInterval(id);
  }, [paused, done, total, bounds, steps, computeElapsed, applyStepFx]);

  const idx = (() => {
    const i = bounds.findIndex((b) => elapsed < b);
    return i === -1 ? steps.length - 1 : i;
  })();
  const step = steps[idx]!;
  const remaining = Math.max(0, (bounds[idx] ?? 0) - elapsed);
  const color = STEP_COLOR[step.kind];

  const togglePause = () => {
    setPaused((prev) => {
      const next = !prev;
      if (next) {
        pausedAtRef.current = Date.now();
        sfxRef.current.stopEngine();
      } else if (pausedAtRef.current != null) {
        pausedAccumRef.current += Date.now() - pausedAtRef.current;
        pausedAtRef.current = null;
        sfxRef.current.setEnginePhase(cuePhase(step.kind));
      }
      return next;
    });
  };

  const skip = () => {
    // shift the clock so elapsed jumps to the end of the current step
    startedRef.current -= ((bounds[idx] ?? 0) - elapsed) * 1000;
    setElapsed(bounds[idx] ?? 0);
  };

  // ── MINIMIZED — floating chip over the countdown ──────────────────────────
  if (minimized) {
    return (
      <button
        onClick={onExpand}
        className="fixed bottom-24 right-3 z-[70] flex items-center gap-2.5 rounded-full py-2 pl-2.5 pr-4"
        style={{
          background: "#0d1320",
          border: `1px solid ${color}66`,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: `${color}22`, color }}
        >
          <Flame className="size-4" />
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[0.55rem] font-bold tracking-wider" style={{ color }}>
            {done ? (el ? "ΟΛΟΚΛΗΡΩΘΗΚΕ" : "DONE") : stepLabel(step.kind, lang).toUpperCase()}
          </span>
          <span className="font-mono text-sm font-bold tabular-nums text-white">
            {done ? "✓" : fmtClock(remaining)}
          </span>
        </span>
      </button>
    );
  }

  // ── FULL PLAYER ───────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col select-none"
      style={{ background: "#020a13" }}
    >
      {sfx.fx.scene && <UnderwaterScene />}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-700"
        style={{ background: `${color}10` }}
      />

      {/* top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4">
        <button
          onClick={onStop}
          aria-label={el ? "Τερματισμός" : "Stop"}
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
        >
          <X className="size-4" />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-xs font-bold tracking-[0.2em] text-white/40">
            {el ? preset.name_el : preset.name_en}
          </span>
          <span className="mt-0.5 text-[0.55rem] font-semibold tracking-widest text-[#5DCAA5]">
            {el ? "ΖΕΣΤΑΜΑ ΠΡΙΝ ΤΗ ΒΟΥΤΙΑ" : "PRE-DIVE WARM-UP"}
          </span>
        </div>
        <button
          onClick={onMinimize}
          aria-label={el ? "Ελαχιστοποίηση" : "Minimize"}
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
        >
          <ChevronDown className="size-4" />
        </button>
      </div>

      {done ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-6">
          <LogoBreathPacer size={150} color="#5DCAA5" duration={10} />
          <p className="text-lg font-bold text-white">
            {el ? "Έτοιμος για τη βουτιά 🌊" : "Ready to dive 🌊"}
          </p>
          <button
            onClick={onStop}
            className="rounded-xl px-8 py-3.5 text-sm font-bold"
            style={{ background: "#1D9E75", color: "#fff" }}
          >
            {el ? "Κλείσιμο" : "Close"}
          </button>
        </div>
      ) : (
        <>
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5">
            <LogoBreathPacer
              key={idx}
              size={220}
              color={color}
              duration={sweepDuration(step)}
              paused={paused}
            />
            <div className="flex flex-col items-center">
              <span className="mb-1 text-xs font-bold tracking-[0.3em]" style={{ color }}>
                {stepLabel(step.kind, lang).toUpperCase()}
              </span>
              <span
                className="font-mono text-[2.75rem] font-light leading-none tabular-nums"
                style={{ color }}
              >
                {fmtClock(remaining)}
              </span>
              {paused && (
                <span
                  className="mt-1 text-[0.6rem] font-bold tracking-[0.3em]"
                  style={{ color: "#EF9F27" }}
                >
                  {el ? "ΠΑΥΣΗ" : "PAUSED"}
                </span>
              )}
            </div>
            <span className="text-[0.6rem] tracking-widest text-white/25">
              {el ? "Βήμα" : "Step"} {idx + 1}/{steps.length}
            </span>
          </div>

          <div className="relative z-10 flex items-center justify-center gap-4 px-4 pb-10">
            <button
              onClick={togglePause}
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: color, color: "#062018" }}
            >
              {paused ? <Play className="size-6" /> : <Pause className="size-6" />}
            </button>
            <button
              onClick={skip}
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }}
            >
              <SkipForward className="size-5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
