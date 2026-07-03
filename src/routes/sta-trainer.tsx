import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { X, Check, Trophy, Target, Mic, MicOff, Music, VolumeX, Vibrate } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  type FxSettings, type CueKey, loadFxSettings, saveFxSettings,
  vibrate, hapticsSupported,
  HOLD_MILESTONES, SoundscapeEngine, CuePlayer,
} from "@/lib/trainer-fx";

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
  const navigate  = useNavigate();

  const [phase, setPhase]               = useState<Phase>("idle");
  const [elapsed, setElapsed]           = useState(0);
  const [contractions, setContractions] = useState(0);
  const [rounds, setRounds]             = useState<Round[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  // ── guided-session FX (voice / soundscape / haptics) ──────────────────────
  const canHaptics  = hapticsSupported();
  const [fx, setFx] = useState<FxSettings>(() => loadFxSettings());
  const fxRef       = useRef(fx);
  fxRef.current     = fx;
  const engineRef   = useRef<SoundscapeEngine | null>(null);
  const cueRef      = useRef<CuePlayer | null>(null);
  const nextMsRef   = useRef(0); // index of next hold milestone to announce

  const phaseStart    = useRef<number>(Date.now());
  const breatheStart  = useRef<number>(0);
  const holdStart     = useRef<number>(0);
  const recoveryStart = useRef<number>(0);

  const pressTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  // ── FX helpers ────────────────────────────────────────────────────────────
  const ensureEngine = useCallback(() => {
    if (!engineRef.current) engineRef.current = new SoundscapeEngine();
    return engineRef.current;
  }, []);

  const guideVoice = useCallback((key: CueKey) => {
    if (!fxRef.current.voice) return;
    if (!cueRef.current) cueRef.current = new CuePlayer();
    cueRef.current.play(key, lang);
  }, [lang]);

  const guideHaptic = useCallback((pattern: number | number[]) => {
    if (fxRef.current.haptics) vibrate(pattern);
  }, []);

  const enginePhase = useCallback((p: "breathe" | "hold" | "recovery") => {
    if (!fxRef.current.sound) return;
    const eng = ensureEngine();
    if (!eng.isRunning) eng.start().then(() => eng.setPhase(p));
    else eng.setPhase(p);
  }, [ensureEngine]);

  const toggleFx = useCallback((key: keyof FxSettings) => {
    setFx((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveFxSettings(next);
      if (key === "sound" && !next.sound) engineRef.current?.stop();
      if (key === "voice" && !next.voice) cueRef.current?.stop();
      return next;
    });
  }, []);

  // stop audio + cues on unmount
  useEffect(() => () => { engineRef.current?.stop(); cueRef.current?.stop(); }, []);

  // ── tick ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase === "idle") return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - phaseStart.current) / 1000));
    }, 200);
    return () => clearInterval(id);
  }, [phase]);

  // ── milestone cues during a hold ──────────────────────────────────────────
  useEffect(() => {
    if (phase !== "hold") return;
    const idx = nextMsRef.current;
    if (idx >= HOLD_MILESTONES.length) return;
    const ms = HOLD_MILESTONES[idx]!;
    if (elapsed >= ms.at) {
      nextMsRef.current = idx + 1;
      if (fxRef.current.voice) {
        if (!cueRef.current) cueRef.current = new CuePlayer();
        cueRef.current.play(ms.key, lang);
      }
      if (fxRef.current.haptics) vibrate(20);
    }
  }, [elapsed, phase, lang]);

  // ── phase transitions ──────────────────────────────────────────────────

  const startBreathe = useCallback(() => {
    breatheStart.current = Date.now();
    phaseStart.current   = Date.now();
    setPhase("breathe");
    setElapsed(0);
    setContractions(0);
    guideHaptic(60);
    guideVoice("breathe");
    enginePhase("breathe");
  }, [guideHaptic, guideVoice, enginePhase]);

  const startHold = useCallback(() => {
    holdStart.current  = Date.now();
    phaseStart.current = Date.now();
    setPhase("hold");
    setElapsed(0);
    nextMsRef.current = 0;
    guideHaptic([40, 60, 40]);
    guideVoice("hold");
    enginePhase("hold");
  }, [guideHaptic, guideVoice, enginePhase]);

  const startRecovery = useCallback(() => {
    recoveryStart.current = Date.now();
    phaseStart.current    = Date.now();
    setPhase("recovery");
    setElapsed(0);
    guideHaptic([120, 80, 120]);
    guideVoice("recovery");
    enginePhase("recovery");
  }, [guideHaptic, guideVoice, enginePhase]);

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
      guideHaptic(25);
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
  }, [phase, contractions, startBreathe, startHold, guideHaptic]);

  // ── end session (opens modal, captures in-progress recovery if any) ────

  const handleEndSession = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    // if currently in recovery, flush the round
    if (phase === "recovery") {
      const breatheSecs  = Math.round((holdStart.current     - breatheStart.current)  / 1000);
      const holdSecs     = Math.round((recoveryStart.current - holdStart.current)     / 1000);
      const recoverySecs = Math.round((Date.now()            - recoveryStart.current) / 1000);
      setRounds((prev) => [{ breatheSecs, holdSecs, recoverySecs, contractions }, ...prev]);
    }
    engineRef.current?.stop();
    cueRef.current?.stop();
    setSaved(false);
    setShowModal(true);
  }, [phase, contractions]);

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
        }))
      )}`,
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
  const canEnd = rounds.length > 0 || phase === "recovery";

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden select-none"
      style={{ background: "#070a10" }}
    >
      {/* phase background wash */}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-700"
        style={{ background: PHASE_BG[phase] }}
      />

      {/* guided-session controls */}
      <div
        className="absolute right-3 top-3 z-20 flex gap-2"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <FxToggle
          active={fx.voice}
          onClick={() => toggleFx("voice")}
          on={<Mic className="size-4" />}
          off={<MicOff className="size-4" />}
          label={lang === "el" ? "Φωνή" : "Voice"}
        />
        <FxToggle
          active={fx.sound}
          onClick={() => toggleFx("sound")}
          on={<Music className="size-4" />}
          off={<VolumeX className="size-4" />}
          label={lang === "el" ? "Ήχος" : "Sound"}
        />
        <FxToggle
          active={canHaptics && fx.haptics}
          disabled={!canHaptics}
          onClick={() => toggleFx("haptics")}
          on={<Vibrate className="size-4" />}
          off={<Vibrate className="size-4" />}
          label={canHaptics ? (lang === "el" ? "Δόνηση" : "Haptics") : (lang === "el" ? "Η δόνηση δεν υποστηρίζεται σε iPhone" : "Haptics not supported on iPhone")}
        />
      </div>

      {/* tap zone */}
      <div
        className="relative flex flex-1 flex-col items-center justify-center gap-6 cursor-pointer"
        onMouseDown={onPressStart}
        onMouseUp={onPressEnd}
        onMouseLeave={() => { if (pressTimer.current) clearTimeout(pressTimer.current); }}
        onTouchStart={(e) => { e.preventDefault(); onPressStart(); }}
        onTouchEnd={(e) => { e.preventDefault(); onPressEnd(); }}
      >
        <span className="text-xs font-bold tracking-[0.3em] transition-colors duration-500" style={{ color }}>
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
              <span key={i} className="h-3 w-3 rounded-full" style={{ background: "#EF9F27", boxShadow: "0 0 6px #EF9F2780" }} />
            ))}
            {contractions === 0 && (
              <span className="text-[0.6rem] tracking-widest" style={{ color: "#EF9F2760" }}>
                {lang === "el" ? "χωρίς συσπάσεις" : "no contractions yet"}
              </span>
            )}
          </div>
        )}

        {phase === "hold" && contractions > 0 && (
          <span className="text-xs font-medium" style={{ color: "#EF9F27" }}>×{contractions}</span>
        )}

        {subLabel[phase] && (
          <span className="text-[0.6rem] font-medium tracking-widest text-white/30">{subLabel[phase]}</span>
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
                <RoundRow key={i} round={r} index={rounds.length - i} lang={lang} isBest={r.holdSecs === stats.best} />
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
            style={{ border: "1.5px solid rgba(239,80,80,0.4)", color: "#ef5050", background: "rgba(239,80,80,0.06)" }}
          >
            {lang === "el" ? "Τέλος Session" : "End Session"}
          </button>
        </div>
      )}

      {/* ── Session Summary Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.85)" }}>
          <div
            className="flex flex-1 flex-col overflow-y-auto"
            style={{ background: "#0a0f1a" }}
          >
            {saved ? (
              /* success */
              <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 py-12">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full"
                  style={{ background: "rgba(29,158,117,0.15)", border: "1.5px solid rgba(29,158,117,0.3)" }}
                >
                  <Check className="size-10" style={{ color: "#1D9E75" }} />
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{lang === "el" ? "Αποθηκεύτηκε!" : "Saved!"}</p>
                  <p className="mt-1 text-sm text-white/40">
                    {lang === "el" ? `${rounds.length} γύροι · Best ${fmt(stats.best)}` : `${rounds.length} rounds · Best ${fmt(stats.best)}`}
                  </p>
                </div>
                <div className="flex w-full max-w-xs flex-col gap-3">
                  <button
                    onClick={() => navigate({ to: "/dashboard" })}
                    className="w-full rounded-xl py-4 text-sm font-bold transition-colors"
                    style={{ background: "#1D9E75", color: "#fff" }}
                  >
                    {lang === "el" ? "Πίνακας" : "Dashboard"}
                  </button>
                  <button
                    onClick={() => { setShowModal(false); setSaved(false); setRounds([]); setPhase("idle"); setElapsed(0); }}
                    className="w-full rounded-xl py-4 text-sm font-semibold transition-colors"
                    style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)" }}
                  >
                    {lang === "el" ? "Νέο Session" : "New Session"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* modal header */}
                <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {lang === "el" ? "Session Ολοκληρώθηκε 🎯" : "Session Complete 🎯"}
                    </h2>
                    <p className="mt-0.5 text-xs text-white/30">
                      {new Date().toLocaleDateString(lang === "el" ? "el-GR" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}
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
                    style={{ gridTemplateColumns: "2rem 1fr 1fr 1fr 2rem", background: "rgba(255,255,255,0.03)" }}
                  >
                    {["#", lang === "el" ? "Αναπνοή" : "Breathe", lang === "el" ? "Hold" : "Hold", lang === "el" ? "Ανάκαμψη" : "Recovery", lang === "el" ? "Συσπ." : "Con."].map((h, i) => (
                      <span
                        key={i}
                        className={`text-[0.55rem] font-bold tracking-wider text-white/25 ${i === 0 ? "text-center" : i === 4 ? "text-center" : "text-center"}`}
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
                        <span className="text-center font-mono text-xs" style={{ color: "#5DCAA5" }}>{fmt(r.breatheSecs)}</span>
                        <div className="flex flex-col items-center">
                          <span
                            className="font-mono text-xs font-bold"
                            style={{ color: isBest ? "#EF9F27" : "#1D9E75" }}
                          >
                            {fmt(r.holdSecs)}
                          </span>
                          {isBest && <span className="text-[0.45rem] font-bold tracking-widest" style={{ color: "#EF9F2780" }}>BEST</span>}
                        </div>
                        <span className="text-center font-mono text-xs" style={{ color: "#9FE1CB" }}>{fmt(r.recoverySecs)}</span>
                        <span className="text-center text-xs text-white/30">{r.contractions > 0 ? r.contractions : "—"}</span>
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
                    <span className="text-center font-mono text-xs font-bold" style={{ color: "#1D9E75" }}>
                      {fmt(stats.total)}
                    </span>
                    <span /><span />
                  </div>
                </div>

                {/* action buttons */}
                <div className="mt-auto space-y-3 px-5 py-5">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full rounded-xl py-4 text-sm font-bold tracking-wider transition-all"
                    style={{ background: saving ? "rgba(29,158,117,0.4)" : "#1D9E75", color: "#fff", opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? (lang === "el" ? "Αποθήκευση…" : "Saving…") : (lang === "el" ? "Αποθήκευση" : "Save")}
                  </button>
                  <button
                    onClick={() => { setShowModal(false); setRounds([]); setPhase("idle"); setElapsed(0); }}
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
    </div>
  );
}

// ── FxToggle ───────────────────────────────────────────────────────────────

function FxToggle({ active, onClick, on, off, label, disabled = false }: {
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
      title={label}
      aria-label={label}
      aria-pressed={active}
      className="relative flex h-11 w-11 items-center justify-center rounded-full transition-all"
      style={{
        background: active ? "rgba(29,158,117,0.18)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? "rgba(29,158,117,0.45)" : "rgba(255,255,255,0.08)"}`,
        color: active ? "#5DCAA5" : "rgba(255,255,255,0.28)",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {active ? on : off}
      {disabled && (
        <span
          className="pointer-events-none absolute h-[1.5px] w-6 rotate-45 rounded-full"
          style={{ background: "rgba(255,255,255,0.4)" }}
        />
      )}
    </button>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────

function StatCard({ label, value, color = "#fff", icon }: { label: string; value: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 rounded-xl py-3"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      {icon && <div>{icon}</div>}
      <span className="font-mono text-lg font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="text-center text-[0.55rem] font-medium tracking-wider text-white/30">{label}</span>
    </div>
  );
}

// ── RoundRow ───────────────────────────────────────────────────────────────

function RoundRow({ round, index, lang, isBest }: { round: Round; index: number; lang: string; isBest: boolean }) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{ background: isBest ? "rgba(239,159,39,0.06)" : "rgba(255,255,255,0.03)" }}
    >
      <span className="w-5 text-right text-xs font-bold text-white/20">{index}</span>
      <Cell label={lang === "el" ? "ΑΝΠ" : "BRE"} value={fmt(round.breatheSecs)} color="#5DCAA5" />
      <Cell label={lang === "el" ? "ΚΡΤ" : "HLD"} value={fmt(round.holdSecs)}    color={isBest ? "#EF9F27" : "#1D9E75"} />
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
      <span className="text-[0.55rem] tracking-widest" style={{ color }}>hold 0.8s → recovery</span>
    </div>
  );
}
