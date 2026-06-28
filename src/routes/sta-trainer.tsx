import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

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

// ── component ──────────────────────────────────────────────────────────────

function STATrainer() {
  const { lang } = useI18n();

  const [phase, setPhase]               = useState<Phase>("idle");
  const [elapsed, setElapsed]           = useState(0);
  const [contractions, setContractions] = useState(0);
  const [rounds, setRounds]             = useState<Round[]>([]);

  // per-phase start timestamps
  const phaseStart    = useRef<number>(Date.now());
  const breatheStart  = useRef<number>(0);
  const holdStart     = useRef<number>(0);
  const recoveryStart = useRef<number>(0);

  // long-press tracking
  const pressTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      // save round
      const breatheSecs  = Math.round((holdStart.current   - breatheStart.current)  / 1000);
      const holdSecs     = Math.round((recoveryStart.current - holdStart.current)    / 1000);
      const recoverySecs = Math.round((Date.now()           - recoveryStart.current) / 1000);
      setRounds((prev) => [
        { breatheSecs, holdSecs, recoverySecs, contractions },
        ...prev,
      ]);
      startBreathe();
    }
  }, [phase, contractions, startBreathe, startHold]);

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

      {/* tap zone — fills most of screen */}
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
        {/* phase label */}
        <span
          className="text-xs font-bold tracking-[0.3em] transition-colors duration-500"
          style={{ color }}
        >
          {phaseLabel[phase]}
        </span>

        {/* big timer */}
        <span
          className="font-mono text-[5rem] font-light leading-none tabular-nums transition-colors duration-500"
          style={{ color: phase === "idle" ? "#2a3a35" : color }}
        >
          {phase === "idle" ? "00:00" : fmt(elapsed)}
        </span>

        {/* contraction dots */}
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

        {/* contraction count label during hold */}
        {phase === "hold" && contractions > 0 && (
          <span className="text-xs font-medium" style={{ color: "#EF9F27" }}>
            ×{contractions}
          </span>
        )}

        {/* sub label */}
        {subLabel[phase] && (
          <span className="text-[0.6rem] font-medium tracking-widest text-white/30">
            {subLabel[phase]}
          </span>
        )}

        {/* long-press progress ring — only shown during hold */}
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
            <p className="mb-2 text-[0.6rem] font-bold tracking-[0.25em] text-white/30">
              {lang === "el" ? "ΓΥΡΟΙ" : "ROUNDS"}
            </p>
            <div className="space-y-2">
              {rounds.map((r, i) => (
                <RoundRow key={i} round={r} index={rounds.length - i} lang={lang} />
              ))}
            </div>
          </div>
        </div>
      )}
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
// Small text hint; an actual animated ring would need CSS keyframes

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
