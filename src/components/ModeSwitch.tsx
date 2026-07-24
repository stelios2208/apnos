import { useMode } from "@/hooks/use-mode";
import { nativeVibrate } from "@/lib/native";
import { cn } from "@/lib/utils";

// ── ModeSwitch (header) ──────────────────────────────────────────────────────
// Compact, text-only Apnos ⇄ Spearo switch for the header: a debossed track with
// a raised brand-green pill that slides under the active label. Tapping a side
// switches mode directly — no page, no pop-up. This is the "old toggle" look:
// a horizontal track with a rounded sliding knob (no wave/fish artwork).

const GREEN = "#1D9E75";
const GREEN_LIGHT = "#5DCAA5";

export function ModeSwitch() {
  const { mode, setMode } = useMode();

  const select = (value: "apnos" | "spearo") => {
    if (value !== mode) nativeVibrate(10);
    setMode(value);
  };

  const options = [
    { value: "apnos" as const, label: "Apnos" },
    { value: "spearo" as const, label: "Spearo" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Apnos / Spearo"
      className="relative grid grid-cols-2 rounded-full p-0.5"
      style={{
        background: "var(--background)",
        border: "1px solid rgba(var(--ink),0.08)",
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.25)",
      }}
    >
      {/* sliding pill — one segment wide, no layout shift */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0.5 left-0.5 top-0.5 rounded-full transition-transform duration-200 motion-reduce:transition-none"
        style={{
          width: "calc(50% - 0.125rem)",
          transform: mode === "spearo" ? "translateX(100%)" : "translateX(0)",
          transitionTimingFunction: "cubic-bezier(0.3, 1.35, 0.5, 1)",
          background: `linear-gradient(180deg, ${GREEN_LIGHT} 0%, ${GREEN} 100%)`,
          boxShadow: ["inset 0 1px 0 rgba(255,255,255,0.3)", "0 1px 4px rgba(29,158,117,0.5)"].join(
            ", ",
          ),
        }}
      />
      {options.map(({ value, label }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => select(value)}
            className={cn(
              "relative z-[1] rounded-full px-3 py-1 text-xs font-bold transition-colors duration-200 active:scale-[0.97]",
              active ? "text-white" : "text-foreground/45 hover:text-foreground/70",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
