import type { TableRound } from "@/lib/sta-tables";
import { fmtClock } from "@/lib/warmups";

// ── TableCard ────────────────────────────────────────────────────────────────
// Rounds list for STA tables. Reused by the table builder, the live timer and
// breathing patterns. Always dark — it lives on training screens.
//
//   activeRoundIndex  null/undefined → nothing running (builder preview)
//   activeProgress    0..1 of the active round, drawn as a ring around its #
//   activePhase       highlights the cell of the running phase

const TEAL = "#1D9E75";
const TEAL_SOFT = "#5DCAA5";
const ORANGE = "#EF9F27";

export function TableCard({
  rounds,
  activeRoundIndex = null,
  activeProgress = 0,
  activePhase,
  lang = "en",
}: {
  rounds: TableRound[];
  activeRoundIndex?: number | null;
  activeProgress?: number;
  activePhase?: "breathe" | "hold";
  lang?: string;
}) {
  const el = lang === "el";
  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div
        className="grid grid-cols-[3rem_1fr_1fr] gap-1 px-3 py-2"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        {[el ? "ΓΥΡΟΣ" : "ROUND", el ? "ΑΝΑΠΝΟΗ" : "BREATHE", el ? "ΚΡΑΤΗΣΗ" : "HOLD"].map((h) => (
          <span
            key={h}
            className="text-center text-[0.55rem] font-bold tracking-[0.15em] text-white/30"
          >
            {h}
          </span>
        ))}
      </div>

      {rounds.map((r, i) => {
        const state =
          activeRoundIndex == null
            ? "idle"
            : i < activeRoundIndex
              ? "done"
              : i === activeRoundIndex
                ? "active"
                : "next";
        const active = state === "active";
        return (
          <div
            key={i}
            className="grid grid-cols-[3rem_1fr_1fr] items-center gap-1 border-t px-3 py-2.5 transition-all duration-300"
            style={{
              borderColor: "rgba(255,255,255,0.04)",
              background: active ? "rgba(29,158,117,0.16)" : "transparent",
              boxShadow: active ? `inset 3px 0 0 ${TEAL}` : "none",
              opacity: state === "done" ? 0.4 : 1,
            }}
          >
            <span className="flex items-center justify-center">
              {active ? (
                <ProgressRing progress={activeProgress} label={i + 1} />
              ) : (
                <span className="text-xs font-bold text-white/25">{i + 1}</span>
              )}
            </span>
            <PhaseCell
              secs={r.breatheSecs}
              color={TEAL_SOFT}
              running={active && activePhase === "breathe"}
            />
            <PhaseCell
              secs={r.holdSecs}
              color={ORANGE}
              running={active && activePhase === "hold"}
            />
          </div>
        );
      })}
    </div>
  );
}

function PhaseCell({ secs, color, running }: { secs: number; color: string; running: boolean }) {
  return (
    <span
      className="mx-auto rounded-full px-3 py-0.5 text-center font-mono text-sm font-bold tabular-nums transition-all"
      style={{
        color,
        background: running ? `${color}22` : "transparent",
        boxShadow: running ? `0 0 0 1px ${color}55` : "none",
      }}
    >
      {fmtClock(secs)}
    </span>
  );
}

function ProgressRing({ progress, label }: { progress: number; label: number }) {
  const size = 26;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <span className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TEAL}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span className="absolute text-[0.6rem] font-bold" style={{ color: TEAL_SOFT }}>
        {label}
      </span>
    </span>
  );
}
