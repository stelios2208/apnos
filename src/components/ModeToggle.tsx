import { Waves, Fish } from "lucide-react";
import { useMode, type Mode } from "@/hooks/use-mode";
import { useI18n } from "@/lib/i18n";
import { nativeVibrate } from "@/lib/native";
import { cn } from "@/lib/utils";

// ── ModeToggle ────────────────────────────────────────────────────────────────
// Premium segmented Apnos ⇄ Spearo switch. This is the cross-discovery hook: a
// freediver finds it on their profile and can try Spearo in one tap. It only
// calls setMode — it never touches theme/colors/fonts, and switching modes never
// hides or gates a route.
//
// Visual language: a "debossed" track (darker than the card, inner shadow) with
// a "raised" brand-green pill that slides between the two segments. The pill is
// an absolutely-positioned layer under the buttons, so switching never causes a
// layout shift; framer-motion isn't in the bundle, so the slide is a plain CSS
// transform transition with a slightly overshooting ease-out for a spring feel.
// All colors come from the existing palette: theme tokens (var(--background),
// var(--ink)) plus the brand green already used by the bottom-nav "+" button
// (same rgba(29,158,117,…) glow), and neutral black/white shading alphas.

const GREEN = "#1D9E75";
const GREEN_LIGHT = "#5DCAA5";

interface Option {
  value: Mode;
  label: string;
  desc: string;
  Icon: typeof Waves;
}

export function ModeToggle() {
  const { mode, setMode } = useMode();
  const { t } = useI18n();

  // Brand names stay literal; only the descriptor localizes.
  const options: Option[] = [
    { value: "apnos", label: "Apnos", desc: t("mode.apnosDesc"), Icon: Waves },
    { value: "spearo", label: "Spearo", desc: t("mode.spearoDesc"), Icon: Fish },
  ];

  const select = (value: Mode) => {
    // Haptic tick only on an actual switch, not on re-tapping the active side.
    if (value !== mode) nativeVibrate(10);
    setMode(value);
  };

  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: "var(--card)", border: "1px solid rgba(var(--ink),0.06)" }}
    >
      <div className="mb-3">
        <p className="text-sm font-bold text-foreground">{t("mode.title")}</p>
        <p className="mt-0.5 text-[0.72rem] text-foreground/40">{t("mode.subtitle")}</p>
      </div>

      {/* Track — debossed groove: page background (a step darker than the card
          in both themes) recessed with an inner shadow and a hairline border. */}
      <div
        role="tablist"
        aria-label={t("mode.title")}
        className="relative grid grid-cols-2 rounded-2xl p-1.5"
        style={{
          background: "var(--background)",
          border: "1px solid rgba(var(--ink),0.07)",
          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.22), inset 0 1px 2px rgba(0,0,0,0.14)",
        }}
      >
        {/* Selected pill — raised: brand-green gradient (light top → deep
            bottom), a hairline white highlight along the top edge, a soft drop
            shadow underneath and the same green ambient glow as the bottom-nav
            "+" button. Slides via translateX(100%) — exactly one segment width
            thanks to the symmetric p-1.5 inset — so there is no layout shift. */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 rounded-xl transition-transform duration-200 motion-reduce:transition-none"
          style={{
            width: "calc(50% - 0.375rem)",
            transform: mode === "spearo" ? "translateX(100%)" : "translateX(0)",
            transitionTimingFunction: "cubic-bezier(0.3, 1.35, 0.5, 1)", // spring-ish ease-out
            background: `linear-gradient(180deg, ${GREEN_LIGHT} 0%, ${GREEN} 100%)`,
            boxShadow: [
              "inset 0 1px 0 rgba(255,255,255,0.32)",
              "0 2px 6px rgba(0,0,0,0.25)",
              "0 4px 16px rgba(29,158,117,0.45)",
            ].join(", "),
          }}
        />

        {options.map(({ value, label, desc, Icon }) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => select(value)}
              className={cn(
                // z-[1] keeps label/icon above the sliding pill layer.
                "relative z-[1] flex flex-col items-center gap-1.5 rounded-xl px-3 py-3.5 text-center transition-colors duration-200 active:scale-[0.98]",
                active ? "text-white" : "text-foreground/45 hover:text-foreground/70",
              )}
            >
              <Icon
                className={cn("size-5", active && "drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]")}
              />
              <span className="text-sm font-bold leading-none">{label}</span>
              <span
                className={cn(
                  "text-[0.65rem] leading-tight transition-colors duration-200",
                  active ? "text-white/80" : "text-foreground/35",
                )}
              >
                {desc}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
