import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipForward,
  X,
  AlarmClock,
  Check,
  Volume2,
  VolumeX,
  Vibrate,
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
import { useI18n } from "@/lib/i18n";
import {
  type WarmupPreset,
  type WarmupStep,
  type WarmupStepKind,
  type WarmupRound,
  WARMUP_PRESETS,
  WARMUP_ACCENTS,
  presetTotalSecs,
  holdCount,
  fmtClock,
  loadAlarms,
  saveAlarms,
  loadCustomWarmups,
  upsertCustomWarmup,
  deleteCustomWarmup,
  newCustomWarmup,
  roundsFromSteps,
  stepsFromRounds,
  newRound,
} from "@/lib/warmups";
import {
  type FxSettings,
  loadFxSettings,
  saveFxSettings,
  vibrate,
  hapticsSupported,
  SoundscapeEngine,
} from "@/lib/trainer-fx";
import { UnderwaterScene } from "@/components/UnderwaterScene";
import { LogoBreathPacer } from "@/components/LogoBreathPacer";

export const Route = createFileRoute("/warmup")({
  head: () => ({ meta: [{ title: "Warm-up — Apnos" }] }),
  component: Warmup,
});

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

// realistic marks for warm-up-length holds (seconds)
const ALARM_QUICK = [30, 60, 90, 120];

// ── audio alert (works cross-platform — vibration alone doesn't on iOS) ─────

function alertBeep() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.start();
    o.stop(ctx.currentTime + 0.4);
    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        /* ignore */
      }
    }, 500);
  } catch {
    /* audio not available */
  }
}

// ── breath pacer sweep speed per step kind ───────────────────────────────────
// Inhale/exhale: the comet completes exactly one lap over the whole step (like
// an ∞ breath pacer). Tidal breathing keeps a calm 8s lap; holds crawl slower.

function sweepDuration(step: WarmupStep): number {
  if (step.kind === "inhale" || step.kind === "exhale") return Math.max(step.secs, 3);
  if (step.kind === "hold") return 14;
  if (step.kind === "rest") return 10;
  return 8;
}

// ── component ────────────────────────────────────────────────────────────────

function Warmup() {
  const { lang } = useI18n();
  const navigate = useNavigate();

  const [preset, setPreset] = useState<WarmupPreset | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);

  const [customs, setCustoms] = useState<WarmupPreset[]>(() => loadCustomWarmups());
  const [builder, setBuilder] = useState<WarmupPreset | null>(null);

  const [alarms, setAlarms] = useState<number[]>(() => loadAlarms());
  const [alarmDraft, setAlarmDraft] = useState("");
  const [fx, setFx] = useState<FxSettings>(() => loadFxSettings());
  const fxRef = useRef(fx);
  fxRef.current = fx;

  const engineRef = useRef<SoundscapeEngine | null>(null);
  const stepIndexRef = useRef(0);
  const remainingRef = useRef(0);
  const presetRef = useRef<WarmupPreset | null>(null);
  const firedAlarms = useRef<Set<number>>(new Set());

  const canHaptics = hapticsSupported();

  // ── FX helpers ──────────────────────────────────────────────────────────
  const buzz = useCallback((p: number | number[]) => {
    if (fxRef.current.haptics) vibrate(p);
  }, []);

  const applyStepFx = useCallback(
    (step: WarmupStep) => {
      buzz(step.kind === "hold" ? [40, 60, 40] : step.kind === "rest" ? [120, 80, 120] : 60);
      if (!fxRef.current.sound) return;
      const eng = engineRef.current;
      if (!eng) return;
      const phase =
        step.kind === "hold"
          ? "hold"
          : step.kind === "exhale" || step.kind === "rest"
            ? "recovery"
            : "breathe";
      if (!eng.isRunning) eng.start().then(() => eng.setPhase(phase));
      else eng.setPhase(phase);
    },
    [buzz],
  );

  // ── controls ──────────────────────────────────────────────────────────────
  const startPreset = (p: WarmupPreset) => {
    presetRef.current = p;
    stepIndexRef.current = 0;
    remainingRef.current = p.steps[0]!.secs;
    firedAlarms.current = new Set();
    setPreset(p);
    setStepIndex(0);
    setRemaining(p.steps[0]!.secs);
    setPaused(false);
    setDone(false);
    if (fxRef.current.sound) {
      if (!engineRef.current) engineRef.current = new SoundscapeEngine();
    }
    applyStepFx(p.steps[0]!);
  };

  const finish = useCallback(() => {
    engineRef.current?.stop();
    buzz([200, 100, 200, 100, 200]);
    setDone(true);
    setPreset(null);
  }, [buzz]);

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
    firedAlarms.current = new Set();
    setStepIndex(next);
    setRemaining(p.steps[next]!.secs);
    applyStepFx(p.steps[next]!);
  }, [finish, applyStepFx]);

  const skip = () => {
    remainingRef.current = 0;
    advance();
  };

  const stop = useCallback(() => {
    engineRef.current?.stop();
    presetRef.current = null;
    setPreset(null);
    setDone(false);
  }, []);

  const togglePause = () => {
    setPaused((prev) => {
      const nextPaused = !prev;
      const eng = engineRef.current;
      if (eng) {
        if (nextPaused) eng.stop();
        else if (fxRef.current.sound) {
          const step = presetRef.current?.steps[stepIndexRef.current];
          if (step) {
            const phase =
              step.kind === "hold"
                ? "hold"
                : step.kind === "exhale" || step.kind === "rest"
                  ? "recovery"
                  : "breathe";
            eng.start().then(() => eng.setPhase(phase));
          }
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

      // alerts fire during a hold (absolute hold time) — audio + haptics
      if (step.kind === "hold") {
        const elapsed = step.secs - remainingRef.current;
        for (const m of alarms) {
          if (m < step.secs && elapsed >= m && !firedAlarms.current.has(m)) {
            firedAlarms.current.add(m);
            if (fxRef.current.sound) alertBeep();
            buzz([300, 120, 300]);
          }
        }
      }

      if (remainingRef.current <= 0) advance();
      else setRemaining(remainingRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [preset, paused, done, alarms, advance, buzz]);

  // cleanup on unmount
  useEffect(
    () => () => {
      engineRef.current?.stop();
    },
    [],
  );

  // ── alarm editing ─────────────────────────────────────────────────────────
  const toggleAlarm = (secs: number) => {
    setAlarms((prev) => {
      const next = prev.includes(secs)
        ? prev.filter((x) => x !== secs)
        : [...prev, secs].sort((a, b) => a - b);
      saveAlarms(next);
      return next;
    });
  };
  const addCustomAlarm = () => {
    const secs = parseInt(alarmDraft.replace(/\D/g, ""), 10);
    if (!secs || secs <= 0) return;
    toggleAlarm(secs);
    setAlarmDraft("");
  };

  const toggleFx = (key: keyof FxSettings) => {
    setFx((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveFxSettings(next);
      if (key === "sound" && !next.sound) engineRef.current?.stop();
      return next;
    });
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
    const showDots = preset.steps.length <= 16;

    return (
      <div className="fixed inset-0 flex flex-col select-none" style={{ background: "#020a13" }}>
        {fx.scene && <UnderwaterScene />}
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
              {lang === "el" ? "Βήμα" : "Step"} {stepIndex + 1} / {preset.steps.length}
            </span>
          </div>
          <div className="w-10" />
        </div>

        {/* center */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5">
          <LogoBreathPacer
            key={stepIndex}
            size={220}
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

          {step.kind === "hold" && holdCount(preset) > 0 && (
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

        {/* controls */}
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
      </div>
    );
  }

  // ── SETUP / DONE SCREEN ─────────────────────────────────────────────────
  const beginnerPresets = WARMUP_PRESETS.filter((p) => p.level === "beginner");
  const otherPresets = WARMUP_PRESETS.filter((p) => p.level !== "beginner");

  return (
    <div className="relative min-h-screen px-4 pb-24 pt-6" style={{ background: "#020a13" }}>
      {fx.scene && (
        <div className="fixed inset-0">
          <UnderwaterScene dim />
        </div>
      )}
      <div className="relative z-10">
        {/* header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/dashboard" })}
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
            className="mt-5 flex items-center gap-3 rounded-2xl px-4 py-4"
            style={{ background: "rgba(29,158,117,0.1)", border: "1px solid rgba(29,158,117,0.3)" }}
          >
            <Check className="size-5 shrink-0" style={{ color: "#1D9E75" }} />
            <span className="text-sm font-semibold text-white/80">
              {lang === "el"
                ? "Το ζέσταμα ολοκληρώθηκε — καλή προπόνηση!"
                : "Warm-up complete — enjoy your session!"}
            </span>
          </div>
        )}

        {/* alarms */}
        <div
          className="mt-6 rounded-2xl p-4"
          style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <AlarmClock className="size-4" style={{ color: "#EF9F27" }} />
            <span className="text-sm font-semibold text-white/80">
              {lang === "el" ? "Ειδοποιήσεις σε κράτηση" : "Hold alerts"}
            </span>
          </div>
          <p className="mb-3 text-[0.7rem] leading-relaxed text-white/35">
            {lang === "el"
              ? "Ήχος + δόνηση στις ώρες που ορίζεις μέσα σε κάθε κράτηση (π.χ. 0:30, 1:00)."
              : "Sound + buzz at the times you set during each hold (e.g. 0:30, 1:00)."}
          </p>
          <div className="flex flex-wrap gap-2">
            {ALARM_QUICK.map((secs) => {
              const on = alarms.includes(secs);
              return (
                <button
                  key={secs}
                  onClick={() => toggleAlarm(secs)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all"
                  style={
                    on
                      ? {
                          background: "rgba(239,159,39,0.18)",
                          color: "#EF9F27",
                          border: "1px solid rgba(239,159,39,0.4)",
                        }
                      : {
                          background: "rgba(255,255,255,0.03)",
                          color: "rgba(255,255,255,0.4)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }
                  }
                >
                  {on && <Check className="size-3" />}
                  {fmtClock(secs)}
                </button>
              );
            })}
            {alarms
              .filter((a) => !ALARM_QUICK.includes(a))
              .map((secs) => (
                <button
                  key={secs}
                  onClick={() => toggleAlarm(secs)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold"
                  style={{
                    background: "rgba(239,159,39,0.18)",
                    color: "#EF9F27",
                    border: "1px solid rgba(239,159,39,0.4)",
                  }}
                >
                  <Check className="size-3" /> {fmtClock(secs)}
                </button>
              ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              inputMode="numeric"
              value={alarmDraft}
              onChange={(e) => setAlarmDraft(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustomAlarm();
              }}
              placeholder={lang === "el" ? "δευτ. π.χ. 75" : "secs e.g. 75"}
              className="w-32 rounded-lg bg-white/5 px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-[#EF9F27]"
            />
            <button
              onClick={addCustomAlarm}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)" }}
            >
              <Plus className="size-3.5" /> {lang === "el" ? "Προσθήκη" : "Add"}
            </button>
          </div>
        </div>

        {/* FX toggles */}
        <div className="mt-4 flex gap-2">
          <FxChip
            active={fx.sound}
            onClick={() => toggleFx("sound")}
            on={<Volume2 className="size-3.5" />}
            off={<VolumeX className="size-3.5" />}
            label={lang === "el" ? "Ήχος" : "Sound"}
          />
          <FxChip
            active={fx.scene}
            onClick={() => toggleFx("scene")}
            on={<Waves className="size-3.5" />}
            off={<Waves className="size-3.5" />}
            label={lang === "el" ? "Βυθός" : "Scene"}
          />
          <FxChip
            active={fx.haptics && canHaptics}
            onClick={() => toggleFx("haptics")}
            on={<Vibrate className="size-3.5" />}
            off={<Vibrate className="size-3.5" />}
            label={lang === "el" ? "Δόνηση" : "Haptics"}
            disabled={!canHaptics}
          />
        </div>

        {/* beginner presets */}
        <PresetSection
          title={lang === "el" ? "ΓΙΑ ΑΡΧΑΡΙΟΥΣ" : "FOR BEGINNERS"}
          presets={beginnerPresets}
          lang={lang}
          onStart={startPreset}
        />

        {/* intermediate/advanced presets */}
        <PresetSection
          title={lang === "el" ? "CO₂ / O₂ ΠΙΝΑΚΕΣ" : "CO₂ / O₂ TABLES"}
          presets={otherPresets}
          lang={lang}
          onStart={startPreset}
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
}: {
  title: string;
  presets: WarmupPreset[];
  lang: string;
  onStart: (p: WarmupPreset) => void;
}) {
  if (presets.length === 0) return null;
  return (
    <div className="mt-7">
      <p className="mb-3 text-[0.6rem] font-bold tracking-[0.25em] text-white/30">{title}</p>
      <div className="space-y-3">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => onStart(p)}
            className="flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition-all active:scale-[0.99]"
            style={{
              background: "#0d1320",
              border: "1px solid rgba(255,255,255,0.06)",
              borderLeft: `3px solid ${p.accent}`,
            }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {lang === "el" ? p.name_el : p.name_en}
                </span>
                <span
                  className="rounded px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-wider"
                  style={{ background: `${p.accent}20`, color: p.accent }}
                >
                  {lang === "el" ? LEVEL_LABEL[p.level].el : LEVEL_LABEL[p.level].en}
                </span>
              </div>
              <p className="mt-1 text-[0.72rem] leading-relaxed text-white/40">
                {lang === "el" ? p.desc_el : p.desc_en}
              </p>
              <div className="mt-2 flex items-center gap-3 text-[0.65rem] text-white/30">
                <span>⏱ {fmtClock(presetTotalSecs(p))}</span>
                {holdCount(p) > 0 && (
                  <span>
                    · {holdCount(p)} {lang === "el" ? "κρατήσεις" : "holds"}
                  </span>
                )}
              </div>
            </div>
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ background: `${p.accent}18`, color: p.accent }}
            >
              <Play className="size-5" />
            </div>
          </button>
        ))}
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

// ── FxChip ───────────────────────────────────────────────────────────────────

function FxChip({
  active,
  onClick,
  on,
  off,
  label,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  on: React.ReactNode;
  off: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all"
      style={{
        background: active ? "rgba(29,158,117,0.15)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? "rgba(29,158,117,0.4)" : "rgba(255,255,255,0.08)"}`,
        color: active ? "#5DCAA5" : "rgba(255,255,255,0.35)",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {active ? on : off}
      {label}
    </button>
  );
}
