import type { CSSProperties } from "react";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { fmtClock, type WarmupStepKind } from "@/lib/warmups";
import type { BreathingGuide } from "@/lib/breathing-guides";

// ── phase → look & motion ────────────────────────────────────────────────────
// The colour moment that breaks the monotone underwater blue: cool blue while
// breathing/inhaling, deep indigo-into-teal on the hold, warm amber on the
// exhale and on true passive rest. Animations scale the whole card with the
// breath (grow on inhale, subtle pulse on hold, shrink on exhale).

const PHASE_LOOK: Record<WarmupStepKind, { color: string; grad: string; anim: string }> = {
  breathe: {
    color: "#4FA8E0",
    grad: "linear-gradient(165deg, rgba(79,168,224,0.17), rgba(79,168,224,0.04))",
    anim: "guided-anim-breathe",
  },
  inhale: {
    color: "#4FA8E0",
    grad: "linear-gradient(165deg, rgba(79,168,224,0.17), rgba(79,168,224,0.04))",
    anim: "guided-anim-inhale",
  },
  hold: {
    color: "#8B9AF0",
    grad: "linear-gradient(165deg, rgba(99,102,241,0.20), rgba(29,158,117,0.08))",
    anim: "guided-anim-hold",
  },
  exhale: {
    color: "#EF9F27",
    grad: "linear-gradient(165deg, rgba(239,159,39,0.16), rgba(239,159,39,0.04))",
    anim: "guided-anim-exhale",
  },
  rest: {
    color: "#EFB27A",
    grad: "linear-gradient(165deg, rgba(239,178,122,0.14), rgba(239,178,122,0.04))",
    anim: "guided-anim-breathe",
  },
};

/**
 * Premium interactive card layered under the countdown numerals of the guided
 * breathwork player. Purely presentational: every prop (active step, remaining
 * seconds, pause state) comes from the player's own countdown state, so there
 * is no second timer to drift.
 */
export function GuidedBreathingCard({
  guide,
  stepIndex,
  activeIndex,
  stepKind,
  stepSecs,
  remaining,
  paused,
}: {
  guide: BreathingGuide;
  /** Absolute step index in the running preset — keys the per-step animation restart. */
  stepIndex: number;
  /** Index into guide.steps (cycle-relative for cyclic presets). */
  activeIndex: number;
  stepKind: WarmupStepKind;
  stepSecs: number;
  remaining: number;
  paused: boolean;
}) {
  const { lang, t } = useI18n();
  const el = lang === "el";
  const look = PHASE_LOOK[stepKind];

  const animStyle = {
    "--guided-dur": `${Math.max(stepSecs, 1)}s`,
    animationPlayState: paused ? "paused" : "running",
    background: look.grad,
    border: `1px solid ${look.color}33`,
    boxShadow: `0 0 34px ${look.color}14`,
    transition: "border-color 0.7s, box-shadow 0.7s",
  } as CSSProperties;

  return (
    <div className="w-full max-w-sm px-6">
      {/* Small phones (~640px tall) can't fit the whole card under the pacer +
          countdown — the card body scrolls internally (dvh-capped) so the
          safety note stays reachable while the countdown never leaves view. */}
      <div
        key={stepIndex}
        className={`guided-card max-h-[34dvh] overflow-y-auto rounded-2xl px-4 py-3.5 ${look.anim}`}
        style={animStyle}
      >
        {/* header */}
        <div className="flex items-center gap-2">
          <span className="text-[0.55rem] font-bold tracking-[0.25em] text-white/40">
            {t("guided.title").toUpperCase()}
          </span>
          {guide.premium && (
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[0.5rem] font-bold"
              style={{ background: "rgba(239,159,39,0.18)", color: "#EF9F27" }}
            >
              {t("guided.badge")}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs font-bold text-white/85">
          {el ? guide.name_el : guide.name_en}
        </p>
        {(el ? guide.prep_el : guide.prep_en) && (
          <p className="mt-1 text-[0.62rem] leading-snug text-white/45">
            {el ? guide.prep_el : guide.prep_en}
          </p>
        )}

        {/* steps — all shown, only the live one highlighted */}
        <div className="mt-2.5 space-y-1.5">
          {guide.steps.map((s, i) => {
            const isActive = i === activeIndex;
            const stepColor = PHASE_LOOK[s.kind].color;
            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-all duration-500"
                style={
                  isActive
                    ? { background: `${stepColor}1e`, border: `1px solid ${stepColor}55` }
                    : { background: "transparent", border: "1px solid transparent", opacity: 0.42 }
                }
              >
                {/* duration-less steps (table rounds vary) still get the live
                    clock while active */}
                {(s.secs != null || isActive) && (
                  <span
                    className="w-9 shrink-0 text-center font-mono text-[0.68rem] font-bold tabular-nums"
                    style={{ color: isActive ? stepColor : "rgba(255,255,255,0.5)" }}
                  >
                    {isActive ? fmtClock(Math.max(0, remaining)) : `${s.secs}″`}
                  </span>
                )}
                <span
                  className="min-w-0 flex-1 text-[0.66rem] leading-snug"
                  style={{ color: isActive ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.65)" }}
                >
                  {el ? s.text_el : s.text_en}
                </span>
              </div>
            );
          })}
        </div>

        {/* safety — discreet but always on the guided cards */}
        <div
          className="mt-2.5 flex gap-2 border-t pt-2"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <ShieldCheck className="mt-0.5 size-3 shrink-0" style={{ color: "#EF6B5E" }} />
          <div className="space-y-0.5 text-[0.55rem] leading-snug text-white/40">
            <p>{t("guided.safetyCalm")}</p>
            <p>{t("guided.safetyBuddy")}</p>
            <p>{t("guided.safetyDry")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
