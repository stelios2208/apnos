import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import {
  type FxSettings,
  type CueKey,
  FX_DEFAULTS,
  loadFxSettings,
  saveFxSettings,
  vibrate,
  hapticsSupported,
  beep,
  testHapticPulse,
  HOLD_MILESTONES,
  HOLD_PHASE_CUES,
  SoundscapeEngine,
  CuePlayer,
} from "@/lib/trainer-fx";
import { listCueUrls } from "@/lib/voice-cues";
import { loadAlarms, saveAlarms } from "@/lib/warmups";

// ── useSessionFx ─────────────────────────────────────────────────────────────
// One hook for everything that makes a guided session "alive": voice cues,
// soundscape, haptics, audio chimes and the user's hold alerts. The free
// trainer, the CO₂/O₂ table runner and the warm-up player all share it, so
// alerts and voice guidance behave identically everywhere and every setting
// (FX toggles, alarm marks, recorded cues) is configured once.

export type SessionEnginePhase = "breathe" | "hold" | "recovery";

export function useSessionFx() {
  const { user } = useAuth();
  const { lang } = useI18n();

  // Start from SSR-stable values and read the real browser state after mount —
  // localStorage / navigator don't exist on the server and initializing from
  // them directly causes React hydration mismatches.
  const [canHaptics, setCanHaptics] = useState(false);
  const [fx, setFx] = useState<FxSettings>({ ...FX_DEFAULTS });
  const fxRef = useRef(fx);
  fxRef.current = fx;

  const engineRef = useRef<SoundscapeEngine | null>(null);
  const cueRef = useRef<CuePlayer | null>(null);
  const [hasCues, setHasCues] = useState(false);

  const [alarms, setAlarms] = useState<number[]>([]);
  const alarmsRef = useRef(alarms);
  alarmsRef.current = alarms;

  useEffect(() => {
    setCanHaptics(hapticsSupported());
    setFx(loadFxSettings());
    setAlarms(loadAlarms());
  }, []);

  // ── recorded voice cues ────────────────────────────────────────────────────
  const reloadCues = useCallback(async () => {
    if (!user) return;
    if (!cueRef.current) cueRef.current = new CuePlayer();
    const map = await listCueUrls(user.id, lang);
    cueRef.current.setSources(map);
    setHasCues(map.size > 0);
  }, [user, lang]);

  useEffect(() => {
    void reloadCues();
  }, [reloadCues]);

  const cue = useCallback((key: CueKey) => {
    // Voice cues are strictly scoped to the hold phase. Every guided runner
    // (free trainer, tables, warm-ups, planner) calls cue() on its phase
    // transitions, including breathe-up and recovery — drop any non-hold cue
    // here so recorded guidance never speaks over those phases, regardless of
    // the call site. (Hold milestones fire via holdTick, which only ticks
    // during a hold; beep/vibrate/soundscape are unaffected.)
    if (!HOLD_PHASE_CUES.has(key)) return;
    if (fxRef.current.voice) cueRef.current?.play(key);
  }, []);

  // ── haptics / chime / soundscape ──────────────────────────────────────────
  const buzz = useCallback((pattern: number | number[]) => {
    if (fxRef.current.haptics) vibrate(pattern);
  }, []);

  const chime = useCallback((freq?: number) => {
    if (fxRef.current.sound) beep(freq);
  }, []);

  const setEnginePhase = useCallback((p: SessionEnginePhase) => {
    if (!fxRef.current.sound) return;
    if (!engineRef.current) engineRef.current = new SoundscapeEngine();
    const eng = engineRef.current;
    if (!eng.isRunning) void eng.start().then(() => eng.setPhase(p));
    else eng.setPhase(p);
  }, []);

  const stopEngine = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  const stopAudio = useCallback(() => {
    engineRef.current?.stop();
    cueRef.current?.stop();
  }, []);

  // ── settings ──────────────────────────────────────────────────────────────
  const toggleFx = useCallback((key: keyof FxSettings) => {
    // Fire the haptics test buzz synchronously here (inside the tap handler,
    // before setState) rather than from the state updater — the browser's
    // user-activation gate only lets navigator.vibrate through when it's on
    // the direct gesture call stack.
    if (key === "haptics" && !fxRef.current.haptics) testHapticPulse();
    setFx((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveFxSettings(next);
      if (key === "sound" && !next.sound) engineRef.current?.stop();
      if (key === "voice" && !next.voice) cueRef.current?.stop();
      return next;
    });
  }, []);

  const toggleAlarm = useCallback((secs: number) => {
    setAlarms((prev) => {
      const next = prev.includes(secs)
        ? prev.filter((x) => x !== secs)
        : [...prev, secs].sort((a, z) => a - z);
      saveAlarms(next);
      return next;
    });
  }, []);

  // ── per-hold alert tracking (alarm marks + voice milestones) ──────────────
  const firedAlarms = useRef<Set<number>>(new Set());
  const nextMilestone = useRef(0);

  /** Call when a new hold starts so alarms & milestones re-arm. */
  const resetHoldAlerts = useCallback(() => {
    firedAlarms.current = new Set();
    nextMilestone.current = 0;
  }, []);

  /**
   * Call roughly once per second during a hold with the elapsed hold seconds.
   * Fires the user's alarm marks (sound + buzz) and voice milestones exactly
   * once each per hold. Pass holdTotal for timed holds so alarms at or past
   * the hold's end don't fire pointlessly; omit for open-ended holds.
   */
  const holdTick = useCallback((elapsed: number, holdTotal?: number) => {
    for (const m of alarmsRef.current) {
      if ((holdTotal == null || m < holdTotal) && elapsed >= m && !firedAlarms.current.has(m)) {
        firedAlarms.current.add(m);
        if (fxRef.current.sound) beep(660);
        if (fxRef.current.haptics) vibrate([300, 120, 300]);
      }
    }
    const idx = nextMilestone.current;
    if (idx < HOLD_MILESTONES.length) {
      const ms = HOLD_MILESTONES[idx]!;
      if (elapsed >= ms.at) {
        nextMilestone.current = idx + 1;
        if (fxRef.current.voice) cueRef.current?.play(ms.key);
        if (fxRef.current.haptics) vibrate(20);
      }
    }
  }, []);

  // stop all audio when the consuming screen unmounts
  useEffect(
    () => () => {
      engineRef.current?.stop();
      cueRef.current?.stop();
    },
    [],
  );

  return {
    user,
    lang,
    canHaptics,
    fx,
    toggleFx,
    hasCues,
    reloadCues,
    cue,
    buzz,
    chime,
    setEnginePhase,
    stopEngine,
    stopAudio,
    alarms,
    toggleAlarm,
    resetHoldAlerts,
    holdTick,
  };
}

export type SessionFx = ReturnType<typeof useSessionFx>;
