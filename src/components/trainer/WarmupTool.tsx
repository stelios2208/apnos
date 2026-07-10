import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipForward,
  X,
  Check,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Square,
  Wind,
  Waves,
  Flame,
  Droplet,
  Moon,
  Sparkles,
  ListOrdered,
  SlidersHorizontal,
} from "lucide-react";
import {
  type WarmupPreset,
  type WarmupStep,
  type WarmupStepKind,
  type WarmupRound,
  WARMUP_PRESETS,
  WARMUP_ACCENTS,
  presetTotalSecs,
  holdCount,
  maxHoldSecs,
  fmtClock,
  loadCustomWarmups,
  upsertCustomWarmup,
  deleteCustomWarmup,
  newCustomWarmup,
  roundsFromSteps,
  stepsFromRounds,
  newRound,
} from "@/lib/warmups";
import { logStaHold } from "@/lib/dives";
import { useSessionFx } from "@/hooks/use-session-fx";
import { UnderwaterScene } from "@/components/UnderwaterScene";
import { LogoBreathPacer } from "@/components/LogoBreathPacer";
import { TableCard } from "@/components/TableCard";
import { HoldAlertsCard } from "@/components/trainer/HoldAlertsCard";
import { FxChipsRow } from "@/components/trainer/FxControls";

// ── step visuals ─────────────────────────────────────────────────────────────

const STEP_COLOR: Record<WarmupStepKind, string> = {
  breathe: "#5DCAA5",
  inhale: "#4FA8E0",
  exhale: "#EF9F27",
  hold: "#1D9E75",
  rest: "#9FE1CB",
};

const STEP_ICON: Record<WarmupStepKind, LucideIcon> = {
  breathe: Wind,
  inhale: ArrowUp,
  exhale: ArrowDown,
  hold: Square,
  rest: Wind,
};

function stepLabel(kind: WarmupStepKind, lang: string): string {
  if (kind === "breathe") return lang === "el" ? "Αναπνοή" : "Breathe";
  if (kind === "inhale") return lang === "el" ? "Εισπνοή" : "Inhale";
  if (kind === "exhale") return lang === "el" ? "Εκπνοή" : "Exhale";
  if (kind === "hold") return lang === "el" ? "Κράτα" : "Hold";
  return lang === "el" ? "Ξεκούραση" : "Rest";
}

const LEVEL_LABEL: Record<WarmupPreset["level"], { el: string; en: string }> = {
  beginner: { el: "Αρχάριος", en: "Beginner" },
  intermediate: { el: "Μέσος", en: "Intermediate" },
  advanced: { el: "Προχωρημένος", en: "Advanced" },
};

// Voice cues only make sense on steps long enough to talk over — short
// pattern steps (4s box sides) would turn guidance into spam.
const VOICE_MIN_STEP_SECS = 15;

// ── breath pacer sweep speed per step kind ───────────────────────────────────

function sweepDuration(step: WarmupStep): number {
  if (step.kind === "inhale" || step.kind === "exhale") return Math.max(step.secs, 3);
  if (step.kind === "hold") return 14;
  if (step.kind === "rest") return 10;
  return 8;
}

// ── component ────────────────────────────────────────────────────────────────

export function WarmupTool({ onBack }: { onBack: () => void }) {
  const sfx = useSessionFx();
  const {
    lang,
    user,
    buzz,
    cue,
    setEnginePhase,
    stopEngine,
    stopAudio,
    holdTick,
    resetHoldAlerts,
  } = sfx;
  const queryClient = useQueryClient();

  const [preset, setPreset] = useState<WarmupPreset | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [completedPreset, setCompletedPreset] = useState<WarmupPreset | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [customs, setCustoms] = useState<WarmupPreset[]>(() => loadCustomWarmups());
  const [builder, setBuilder] = useState<WarmupPreset | null>(null);

  const stepIndexRef = useRef(0);
  const remainingRef = useRef(0);
  const presetRef = useRef<WarmupPreset | null>(null);

  // ── FX per step ───────────────────────────────────────────────────────────
  const applyStepFx = useCallback(
    (step: WarmupStep) => {
      buzz(step.kind === "hold" ? [40, 60, 40] : step.kind === "rest" ? [120, 80, 120] : 60);
      const phase =
        step.kind === "hold"
          ? "hold"
          : step.kind === "exhale" || step.kind === "rest"
            ? "recovery"
            : "breathe";
      setEnginePhase(phase);
      if (step.secs >= VOICE_MIN_STEP_SECS) {
        if (step.kind === "hold") cue("hold");
        else if (step.kind === "breathe") cue("breathe");
        else if (step.kind === "rest") cue("recovery");
      }
      if (step.kind === "hold") resetHoldAlerts();
    },
    [buzz, cue, setEnginePhase, resetHoldAlerts],
  );

  // ── controls ──────────────────────────────────────────────────────────────
  const startPreset = (p: WarmupPreset) => {
    presetRef.current = p;
    stepIndexRef.current = 0;
    remainingRef.current = p.steps[0]!.secs;
    setPreset(p);
    setStepIndex(0);
    setRemaining(p.steps[0]!.secs);
    setPaused(false);
    setDone(false);
    setSaved(false);
    applyStepFx(p.steps[0]!);
  };

  const finish = useCallback(() => {
    stopAudio();
    buzz([200, 100, 200, 100, 200]);
    setCompletedPreset(presetRef.current);
    setDone(true);
    setPreset(null);
  }, [stopAudio, buzz]);

  const handleLogDive = useCallback(async () => {
    if (!user || !completedPreset || saving) return;
    setSaving(true);
    const best = maxHoldSecs(completedPreset);
    const name = lang === "el" ? completedPreset.name_el : completedPreset.name_en;
    const notes = `Warm-up — ${name}\nBest hold: ${fmtClock(best)}`;
    try {
      await logStaHold(user.id, best, notes);
      queryClient.invalidateQueries({ queryKey: ["dives", user.id] });
      setSaved(true);
      toast.success(lang === "el" ? "Καταγράφηκε ως βουτιά STA" : "Logged as an STA dive");
    } catch (e) {
      console.error(e);
      toast.error(lang === "el" ? "Σφάλμα καταγραφής" : "Log failed");
    } finally {
      setSaving(false);
    }
  }, [user, completedPreset, saving, lang, queryClient]);

  const advance = useCallback(() => {
    const p = presetRef.current;
    if (!p) return;
    const next = stepIndexRef.current + 1;
    if (next >= p.steps.length) {
      finish();
      return;
    }
    stepIndexRef.current = next;
    remainingRef.current = p.steps[next]!.secs;
    setStepIndex(next);
    setRemaining(p.steps[next]!.secs);
    applyStepFx(p.steps[next]!);
  }, [finish, applyStepFx]);

  const skip = () => {
    remainingRef.current = 0;
    advance();
  };

  const stop = useCallback(() => {
    stopAudio();
    presetRef.current = null;
    setPreset(null);
    setDone(false);
  }, [stopAudio]);

  const togglePause = () => {
    setPaused((prev) => {
      const nextPaused = !prev;
      if (nextPaused) stopEngine();
      else {
        const step = presetRef.current?.steps[stepIndexRef.current];
        if (step) {
          const phase =
            step.kind === "hold"
              ? "hold"
              : step.kind === "exhale" || step.kind === "rest"
                ? "recovery"
                : "breathe";
          setEnginePhase(phase);
        }
      }
      return nextPaused;
    });
  };

  // ── ticking countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!preset || paused || done) return;
    const id = setInterval(() => {
      const step = presetRef.current?.steps[stepIndexRef.current];
      if (!step) return;
      remainingRef.current -= 1;

      // alerts + voice milestones fire during a hold (absolute hold time)
      if (step.kind === "hold") {
        const elapsed = step.secs - remainingRef.current;
        holdTick(elapsed, step.secs);
      }

      if (remainingRef.current <= 0) advance();
      else setRemaining(remainingRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [preset, paused, done, advance, holdTick]);

  // Opens the builder pre-filled with a copy of a built-in preset — saving
  // creates the user's own editable variant, the original stays untouched.
  const handleEditPreset = (p: WarmupPreset) => {
    setBuilder({ ...p, id: crypto.randomUUID(), custom: true });
  };

  // ── custom warm-up builder ──────────────────────────────────────────────────
  const saveBuilder = (p: WarmupPreset) => {
    const name = (p.name_el || p.name_en || (lang === "el" ? "Ζέσταμα" : "Warm-up")).trim();
    const clean: WarmupPreset = { ...p, name_el: name, name_en: name, custom: true };
    setCustoms(upsertCustomWarmup(clean));
    setBuilder(null);
  };
  const removeCustom = (id: string) => {
    if (confirm(lang === "el" ? "Διαγραφή ζεστάματος;" : "Delete warm-up?"))
      setCustoms(deleteCustomWarmup(id));
  };

  // ── PLAYER SCREEN ───────────────────────────────────────────────────────
  if (preset) {
    const step = preset.steps[stepIndex]!;
    const color = STEP_COLOR[step.kind];
    const StepIcon = STEP_ICON[step.kind];
    const holdsBefore = preset.steps.slice(0, stepIndex).filter((s) => s.kind === "hold").length;

    // rounds view: breathe/hold tables map 1:1 onto TableCard rows; repeating
    // breathing patterns get a "round x/y" counter from their cycle length.
    const playRounds: WarmupRound[] | null = preset.cycleLen
      ? null
      : (() => {
          const r = roundsFromSteps(preset.steps);
          return r && r.length * 2 === preset.steps.length ? r : null;
        })();
    const roundIdx = playRounds ? Math.floor(stepIndex / 2) : 0;
    const cycleTotal = preset.cycleLen ? Math.floor(preset.steps.length / preset.cycleLen) : 0;
    const cycleIdx = preset.cycleLen ? Math.floor(stepIndex / preset.cycleLen) : 0;

    let roundProgress = 0;
    if (playRounds) {
      const r = playRounds[roundIdx]!;
      const roundTotal = r.breatheSecs + r.holdSecs;
      const elapsedInRound =
        step.kind === "hold" ? r.breatheSecs + (r.holdSecs - remaining) : r.breatheSecs - remaining;
      roundProgress = roundTotal > 0 ? Math.min(1, Math.max(0, elapsedInRound / roundTotal)) : 0;
    }

    const showDots = !playRounds && preset.steps.length <= 16;

    return (
      <div className="fixed inset-0 flex flex-col select-none" style={{ background: "#020a13" }}>
        {sfx.fx.scene && <UnderwaterScene />}
        <div
          className="pointer-events-none absolute inset-0 transition-all duration-700"
          style={{ background: `${color}10` }}
        />

        {/* top bar */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-4">
          <button
            onClick={stop}
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
          >
            <X className="size-4" />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold tracking-[0.2em] text-white/40">
              {lang === "el" ? preset.name_el : preset.name_en}
            </span>
            <span className="mt-0.5 text-[0.6rem] font-semibold tracking-widest text-white/25">
              {playRounds
                ? `${lang === "el" ? "Γύρος" : "Round"} ${roundIdx + 1} / ${playRounds.length}`
                : preset.cycleLen
                  ? `${lang === "el" ? "Γύρος" : "Round"} ${cycleIdx + 1} / ${cycleTotal}`
                  : `${lang === "el" ? "Βήμα" : "Step"} ${stepIndex + 1} / ${preset.steps.length}`}
            </span>
          </div>
          <div className="w-10" />
        </div>

        {/* center */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5">
          <LogoBreathPacer
            key={stepIndex}
            size={playRounds ? 170 : 220}
            color={color}
            duration={sweepDuration(step)}
            paused={paused}
          />
          <div className="flex flex-col items-center">
            <span
              className="mb-1 flex items-center gap-1.5 text-xs font-bold tracking-[0.3em]"
              style={{ color }}
            >
              <StepIcon className="size-3.5" />
              {stepLabel(step.kind, lang).toUpperCase()}
            </span>
            <span
              className="font-mono text-[2.75rem] font-light leading-none tabular-nums"
              style={{ color }}
            >
              {fmtClock(Math.max(0, remaining))}
            </span>
          </div>

          {showDots && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 px-8">
              {preset.steps.map((s, i) => (
                <span
                  key={i}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === stepIndex ? 20 : 6,
                    background:
                      i === stepIndex
                        ? color
                        : i < stepIndex
                          ? "rgba(255,255,255,0.35)"
                          : "rgba(255,255,255,0.12)",
                  }}
                />
              ))}
            </div>
          )}

          {!playRounds && step.kind === "hold" && holdCount(preset) > 0 && (
            <span className="text-[0.65rem] tracking-widest text-white/30">
              {lang === "el" ? "Κράτηση" : "Hold"} {holdsBefore + 1}/{holdCount(preset)}
            </span>
          )}
          {paused && (
            <span className="text-[0.6rem] font-bold tracking-[0.3em]" style={{ color: "#EF9F27" }}>
              {lang === "el" ? "ΠΑΥΣΗ" : "PAUSED"}
            </span>
          )}
        </div>

        {/* rounds table — same live card as the CO₂/O₂ tables */}
        {playRounds && (
          <div className="relative z-10 max-h-[32vh] overflow-y-auto px-4">
            <TableCard
              rounds={playRounds}
              activeRoundIndex={roundIdx}
              activeProgress={roundProgress}
              activePhase={step.kind === "hold" ? "hold" : "breathe"}
              lang={lang}
            />
          </div>
        )}

        {/* controls */}
        <div className="relative z-10 flex items-center justify-center gap-4 px-4 py-6">
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
      </div>
    );
  }

  // ── SETUP / DONE SCREEN ─────────────────────────────────────────────────
  const beginnerPresets = WARMUP_PRESETS.filter((p) => p.level === "beginner");
  const otherPresets = WARMUP_PRESETS.filter((p) => p.level !== "beginner");

  return (
    <div className="relative min-h-screen px-4 pb-24 pt-6" style={{ background: "#020a13" }}>
      {sfx.fx.scene && (
        <div className="fixed inset-0">
          <UnderwaterScene dim />
        </div>
      )}
      <div className="relative z-10 mx-auto max-w-md">
        {/* header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {lang === "el" ? "Ζέσταμα" : "Warm-up"}
            </h1>
            <p className="text-xs text-white/35">
              {lang === "el" ? "Καθοδηγούμενα ζεστάματα στατικής" : "Guided static warm-ups"}
            </p>
          </div>
        </div>

        {done && (
          <div
            className="mt-5 flex flex-col gap-3 rounded-2xl px-4 py-4"
            style={{ background: "rgba(29,158,117,0.1)", border: "1px solid rgba(29,158,117,0.3)" }}
          >
            <div className="flex items-center gap-3">
              <Check className="size-5 shrink-0" style={{ color: "#1D9E75" }} />
              <span className="text-sm font-semibold text-white/80">
                {lang === "el"
                  ? "Το ζέσταμα ολοκληρώθηκε — καλή προπόνηση!"
                  : "Warm-up complete — enjoy your session!"}
              </span>
            </div>
            {user && completedPreset && holdCount(completedPreset) > 0 && (
              <button
                onClick={handleLogDive}
                disabled={saving || saved}
                className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all"
                style={{
                  background: saved ? "rgba(29,158,117,0.2)" : "rgba(255,255,255,0.06)",
                  color: saved ? "#5DCAA5" : "rgba(255,255,255,0.75)",
                  border: `1px solid ${saved ? "rgba(29,158,117,0.4)" : "rgba(255,255,255,0.1)"}`,
                }}
              >
                {saved ? <Check className="size-4" /> : null}
                {saved
                  ? lang === "el"
                    ? "Καταγράφηκε ✓"
                    : "Logged ✓"
                  : saving
                    ? lang === "el"
                      ? "Καταγραφή…"
                      : "Logging…"
                    : lang === "el"
                      ? `Καταγραφή ως βουτιά STA (${fmtClock(maxHoldSecs(completedPreset))})`
                      : `Log as STA dive (${fmtClock(maxHoldSecs(completedPreset))})`}
              </button>
            )}
          </div>
        )}

        {/* alerts — shared with tables & free static */}
        <div className="mt-6">
          <HoldAlertsCard alarms={sfx.alarms} onToggle={sfx.toggleAlarm} lang={lang} />
        </div>

        {/* FX toggles + voice cue manager */}
        <div className="mt-4">
          <FxChipsRow sfx={sfx} />
        </div>

        {/* beginner presets */}
        <PresetSection
          title={lang === "el" ? "ΓΙΑ ΑΡΧΑΡΙΟΥΣ — ΤΕΧΝΙΚΕΣ ΑΝΑΠΝΟΗΣ" : "BEGINNERS — BREATHING"}
          presets={beginnerPresets}
          lang={lang}
          onStart={startPreset}
          onEdit={handleEditPreset}
        />

        {/* hold warm-ups */}
        <PresetSection
          title={lang === "el" ? "ΠΡΟΘΕΡΜΑΝΣΕΙΣ ΜΕ ΚΡΑΤΗΣΕΙΣ" : "HOLD WARM-UPS"}
          presets={otherPresets}
          lang={lang}
          onStart={startPreset}
          onEdit={handleEditPreset}
        />

        {/* custom warm-ups */}
        <div className="mt-7">
          <p className="mb-3 text-[0.6rem] font-bold tracking-[0.25em] text-white/30">
            {lang === "el" ? "ΔΙΚΑ ΣΟΥ ΖΕΣΤΑΜΑΤΑ" : "YOUR WARM-UPS"}
          </p>
          <div className="space-y-3">
            {customs.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-2xl px-4 py-4"
                style={{
                  background: "#0d1320",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderLeft: `3px solid ${p.accent}`,
                }}
              >
                <button
                  onClick={() => startPreset(p)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `${p.accent}18`, color: p.accent }}
                  >
                    <Play className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-bold text-white">
                      {p.name_el || p.name_en}
                    </span>
                    <span className="text-[0.65rem] text-white/30">
                      ⏱ {fmtClock(presetTotalSecs(p))} · {holdCount(p)}{" "}
                      {lang === "el" ? "κρατήσεις" : "holds"}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => setBuilder(p)}
                  className="rounded-lg p-2 text-white/25 hover:text-white/60"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() => removeCustom(p.id)}
                  className="rounded-lg p-2 text-white/20 hover:text-red-400/70"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}

            <button
              onClick={() => setBuilder(newCustomWarmup())}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold transition-all"
              style={{
                background: "rgba(255,255,255,0.015)",
                border: "1px dashed rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              <Plus className="size-4" />
              {lang === "el" ? "Δημιούργησε ζέσταμα" : "Create warm-up"}
            </button>
          </div>
        </div>

        {builder && (
          <WarmupBuilder
            initial={builder}
            lang={lang}
            onCancel={() => setBuilder(null)}
            onSave={saveBuilder}
          />
        )}
      </div>
    </div>
  );
}

// ── PresetSection ────────────────────────────────────────────────────────────

function PresetSection({
  title,
  presets,
  lang,
  onStart,
  onEdit,
}: {
  title: string;
  presets: WarmupPreset[];
  lang: string;
  onStart: (p: WarmupPreset) => void;
  onEdit: (p: WarmupPreset) => void;
}) {
  if (presets.length === 0) return null;
  return (
    <div className="mt-7">
      <p className="mb-3 text-[0.6rem] font-bold tracking-[0.25em] text-white/30">{title}</p>
      <div className="space-y-3">
        {presets.map((p) => {
          // the chip says *why* you'd run this (focus, deep relaxation, CO₂
          // tolerance…) — far more useful than a bare difficulty level
          const chip =
            lang === "el"
              ? (p.purpose_el ?? LEVEL_LABEL[p.level].el)
              : (p.purpose_en ?? LEVEL_LABEL[p.level].en);
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-2xl px-4 py-4"
              style={{
                background: "#0d1320",
                border: "1px solid rgba(255,255,255,0.06)",
                borderLeft: `3px solid ${p.accent}`,
              }}
            >
              <button
                onClick={() => onStart(p)}
                className="flex min-w-0 flex-1 items-center gap-4 text-left transition-all active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {lang === "el" ? p.name_el : p.name_en}
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-wider"
                      style={{ background: `${p.accent}20`, color: p.accent }}
                    >
                      {chip}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-white/40">
                    {lang === "el" ? p.desc_el : p.desc_en}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[0.65rem] text-white/30">
                    <span>⏱ {fmtClock(presetTotalSecs(p))}</span>
                    {p.cycleLen ? (
                      <span>
                        · {Math.floor(p.steps.length / p.cycleLen)}{" "}
                        {lang === "el" ? "γύροι" : "rounds"}
                      </span>
                    ) : holdCount(p) > 0 ? (
                      <span>
                        · {holdCount(p)} {lang === "el" ? "κρατήσεις" : "holds"}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `${p.accent}18`, color: p.accent }}
                >
                  <Play className="size-5" />
                </div>
              </button>
              <button
                onClick={() => onEdit(p)}
                aria-label={lang === "el" ? "Επεξεργασία αντιγράφου" : "Edit a copy"}
                className="shrink-0 rounded-lg p-2 text-white/25 hover:text-white/60"
              >
                <Pencil className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── WarmupBuilder ────────────────────────────────────────────────────────────

const KIND_META: Record<
  WarmupStepKind,
  { color: string; el: string; en: string; icon: LucideIcon }
> = {
  breathe: { color: "#5DCAA5", el: "Αναπνοή", en: "Breathe", icon: Wind },
  inhale: { color: "#4FA8E0", el: "Εισπνοή", en: "Inhale", icon: ArrowUp },
  exhale: { color: "#EF9F27", el: "Εκπνοή", en: "Exhale", icon: ArrowDown },
  hold: { color: "#1D9E75", el: "Κράτα", en: "Hold", icon: Square },
  rest: { color: "#9FE1CB", el: "Ξεκούραση", en: "Rest", icon: Wind },
};

const ACCENT_ICON: Record<string, LucideIcon> = {
  waves: Waves,
  wind: Wind,
  flame: Flame,
  droplet: Droplet,
  moon: Moon,
  sparkle: Sparkles,
};

function accentIdForColor(color: string): string {
  return WARMUP_ACCENTS.find((a) => a.color === color)?.id ?? WARMUP_ACCENTS[0]!.id;
}

type BuilderMode = "rounds" | "free";

function WarmupBuilder({
  initial,
  lang,
  onCancel,
  onSave,
}: {
  initial: WarmupPreset;
  lang: string;
  onCancel: () => void;
  onSave: (p: WarmupPreset) => void;
}) {
  const [name, setName] = useState(initial.name_el || initial.name_en);
  const [accent, setAccent] = useState(initial.accent);
  const [steps, setSteps] = useState<WarmupStep[]>(initial.steps);

  const detected = roundsFromSteps(initial.steps);
  const [mode, setMode] = useState<BuilderMode>(detected ? "rounds" : "free");
  const [rounds, setRounds] = useState<WarmupRound[]>(detected ?? [newRound()]);

  const total =
    mode === "rounds"
      ? rounds.reduce((s, r) => s + r.breatheSecs + r.holdSecs, 0)
      : steps.reduce((s, x) => s + x.secs, 0);

  // ── free-mode step editing ────────────────────────────────────────────────
  const setStep = (i: number, patch: Partial<WarmupStep>) =>
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addStep = () => setSteps((prev) => [...prev, { kind: "hold", secs: 60 }]);
  const delStep = (i: number) => setSteps((prev) => prev.filter((_, j) => j !== i));
  const moveStep = (i: number, dir: -1 | 1) =>
    setSteps((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  // ── rounds-mode editing ───────────────────────────────────────────────────
  const setRound = (i: number, patch: Partial<WarmupRound>) =>
    setRounds((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRound = () =>
    setRounds((prev) => [
      ...prev,
      { breatheSecs: prev.at(-1)?.breatheSecs ?? 120, holdSecs: prev.at(-1)?.holdSecs ?? 60 },
    ]);
  const delRound = (i: number) => setRounds((prev) => prev.filter((_, j) => j !== i));

  const switchMode = (next: BuilderMode) => {
    if (next === mode) return;
    if (next === "free") {
      setSteps(stepsFromRounds(rounds));
    } else {
      const fromSteps = roundsFromSteps(steps);
      setRounds(fromSteps ?? [newRound()]);
    }
    setMode(next);
  };

  const save = () => {
    const finalSteps = mode === "rounds" ? stepsFromRounds(rounds) : steps;
    if (finalSteps.length === 0) return;
    onSave({ ...initial, name_el: name, name_en: name, accent, steps: finalSteps });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onCancel}
    >
      <div
        className="max-h-[92vh] overflow-y-auto rounded-t-3xl p-5"
        style={{ background: "#0a0f1a" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">
            {lang === "el" ? "Ζέσταμα" : "Warm-up"}
          </h2>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-white/40">
            <X className="size-5" />
          </button>
        </div>

        {/* name */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={lang === "el" ? "Όνομα ζεστάματος" : "Warm-up name"}
          className="mb-3 w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:ring-1 focus:ring-[#1D9E75]"
        />

        {/* accent — premium icons, fixed colours, instead of bare swatches */}
        <p className="mb-2 text-[0.6rem] font-bold tracking-wider text-white/35">
          {lang === "el" ? "ΕΙΚΟΝΙΔΙΟ" : "ICON"}
        </p>
        <div className="mb-4 flex gap-2">
          {WARMUP_ACCENTS.map((a) => {
            const Icon = ACCENT_ICON[a.id] ?? Waves;
            const active = accentIdForColor(accent) === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setAccent(a.color)}
                className="flex h-10 w-10 items-center justify-center rounded-full transition-all"
                style={{
                  background: active ? `${a.color}28` : "rgba(255,255,255,0.04)",
                  color: a.color,
                  border: `1.5px solid ${active ? a.color : "transparent"}`,
                }}
              >
                <Icon className="size-[18px]" />
              </button>
            );
          })}
        </div>

        {/* mode toggle */}
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => switchMode("rounds")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all"
            style={
              mode === "rounds"
                ? {
                    background: "rgba(29,158,117,0.2)",
                    color: "#5DCAA5",
                    border: "1px solid rgba(29,158,117,0.4)",
                  }
                : {
                    background: "rgba(255,255,255,0.03)",
                    color: "rgba(255,255,255,0.4)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }
            }
          >
            <ListOrdered className="size-3.5" /> {lang === "el" ? "Γύροι" : "Rounds"}
          </button>
          <button
            onClick={() => switchMode("free")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all"
            style={
              mode === "free"
                ? {
                    background: "rgba(29,158,117,0.2)",
                    color: "#5DCAA5",
                    border: "1px solid rgba(29,158,117,0.4)",
                  }
                : {
                    background: "rgba(255,255,255,0.03)",
                    color: "rgba(255,255,255,0.4)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }
            }
          >
            <SlidersHorizontal className="size-3.5" /> {lang === "el" ? "Ελεύθερο" : "Free"}
          </button>
        </div>

        {mode === "rounds" ? (
          <>
            <p className="mb-2 text-[0.6rem] font-bold tracking-wider text-white/35">
              {lang === "el" ? "ΓΥΡΟΙ" : "ROUNDS"} · {fmtClock(total)}
            </p>
            <div className="space-y-2">
              {rounds.map((rnd, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-xl p-2.5"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-white/25">
                    {i + 1}
                  </span>
                  <RoundPill
                    label={
                      i === 0
                        ? lang === "el"
                          ? "Αναπνοή"
                          : "Breathe"
                        : lang === "el"
                          ? "Ξεκούρ."
                          : "Rest"
                    }
                    color="#5DCAA5"
                    secs={rnd.breatheSecs}
                    onChange={(secs) => setRound(i, { breatheSecs: secs })}
                  />
                  <RoundPill
                    label={lang === "el" ? "Κράτα" : "Hold"}
                    color="#1D9E75"
                    secs={rnd.holdSecs}
                    onChange={(secs) => setRound(i, { holdSecs: secs })}
                  />
                  <button
                    onClick={() => delRound(i)}
                    disabled={rounds.length <= 1}
                    className="shrink-0 rounded-lg p-1.5 text-white/20 hover:text-red-400/70 disabled:opacity-20"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addRound}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              <Plus className="size-3.5" /> {lang === "el" ? "Προσθήκη γύρου" : "Add round"}
            </button>
          </>
        ) : (
          <>
            <p className="mb-2 text-[0.6rem] font-bold tracking-wider text-white/35">
              {lang === "el" ? "ΒΗΜΑΤΑ" : "PHASES"} · {fmtClock(total)}
            </p>
            <div className="space-y-2">
              {steps.map((s, i) => {
                const meta = KIND_META[s.kind];
                return (
                  <div
                    key={i}
                    className="rounded-xl p-2.5"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${meta.color}30`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-center text-xs font-bold text-white/25">
                        {i + 1}
                      </span>
                      {/* kind icon pills */}
                      <div className="flex flex-1 gap-1">
                        {(Object.keys(KIND_META) as WarmupStepKind[]).map((k) => {
                          const KIcon = KIND_META[k].icon;
                          return (
                            <button
                              key={k}
                              title={lang === "el" ? KIND_META[k].el : KIND_META[k].en}
                              onClick={() => setStep(i, { kind: k })}
                              className="flex flex-1 items-center justify-center rounded-lg py-1.5 transition-all"
                              style={
                                s.kind === k
                                  ? {
                                      background: `${KIND_META[k].color}22`,
                                      color: KIND_META[k].color,
                                      border: `1px solid ${KIND_META[k].color}55`,
                                    }
                                  : {
                                      background: "transparent",
                                      color: "rgba(255,255,255,0.3)",
                                      border: "1px solid rgba(255,255,255,0.06)",
                                    }
                              }
                            >
                              <KIcon className="size-3.5" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex flex-1 items-center justify-between rounded-lg bg-white/5 px-2 py-1.5">
                        <button
                          onClick={() => setStep(i, { secs: Math.max(5, s.secs - 5) })}
                          className="px-2 text-lg text-white/50"
                        >
                          −
                        </button>
                        <span className="font-mono text-sm font-bold text-white">
                          {fmtClock(s.secs)}
                        </span>
                        <button
                          onClick={() => setStep(i, { secs: s.secs + 5 })}
                          className="px-2 text-lg text-white/50"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => moveStep(i, -1)}
                        disabled={i === 0}
                        className="rounded-lg p-1.5 text-white/30 disabled:opacity-20"
                      >
                        <ChevronUp className="size-4" />
                      </button>
                      <button
                        onClick={() => moveStep(i, 1)}
                        disabled={i === steps.length - 1}
                        className="rounded-lg p-1.5 text-white/30 disabled:opacity-20"
                      >
                        <ChevronDown className="size-4" />
                      </button>
                      <button
                        onClick={() => delStep(i)}
                        disabled={steps.length <= 1}
                        className="rounded-lg p-1.5 text-white/20 hover:text-red-400/70 disabled:opacity-20"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={addStep}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              <Plus className="size-3.5" />
              {lang === "el" ? "Προσθήκη βήματος" : "Add phase"}
            </button>
          </>
        )}

        <button
          onClick={save}
          className="mt-4 w-full rounded-xl py-3.5 text-sm font-bold"
          style={{ background: "#1D9E75", color: "#fff" }}
        >
          {lang === "el" ? "Αποθήκευση" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── RoundPill — tap-to-edit time pill (Breathe/Hold) for the rounds table ────

function RoundPill({
  label,
  color,
  secs,
  onChange,
}: {
  label: string;
  color: string;
  secs: number;
  onChange: (secs: number) => void;
}) {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <div
        className="flex flex-1 items-center justify-between rounded-full px-2 py-1"
        style={{ background: `${color}18`, border: `1px solid ${color}55` }}
      >
        <button
          onClick={() => onChange(Math.max(5, secs - 5))}
          className="px-1.5 text-sm font-bold"
          style={{ color }}
        >
          −
        </button>
        <span className="font-mono text-xs font-bold" style={{ color }}>
          {fmtClock(secs)}
        </span>
        <button
          onClick={() => onChange(secs + 5)}
          className="px-1.5 text-sm font-bold"
          style={{ color }}
        >
          +
        </button>
        <button
          onClick={() => setOpen(false)}
          className="ml-1 rounded-full px-1.5 text-[0.6rem] font-bold"
          style={{ color }}
        >
          ✓
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => setOpen(true)}
      className="flex flex-1 flex-col items-center rounded-full px-2 py-1.5 transition-all"
      style={{ background: `${color}15`, border: `1px solid ${color}35` }}
    >
      <span className="text-[0.5rem] font-bold tracking-wider" style={{ color: `${color}bb` }}>
        {label.toUpperCase()}
      </span>
      <span className="font-mono text-xs font-bold" style={{ color }}>
        {fmtClock(secs)}
      </span>
    </button>
  );
}
