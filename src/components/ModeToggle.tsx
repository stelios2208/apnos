import { Waves, Fish } from "lucide-react";
import { useMode, type Mode } from "@/hooks/use-mode";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// ── ModeToggle ────────────────────────────────────────────────────────────────
// Premium segmented Apnos ⇄ Spearo switch. This is the cross-discovery hook: a
// freediver finds it on their profile and can try Spearo in one tap. It only
// calls setMode — it never touches theme/colors/fonts, and switching modes never
// hides or gates a route. Uses the existing theme tokens (var(--card), --ink,
// brand green) so it sits natively in the app's glass language.

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

  return (
    <section
      className="rounded-2xl p-4"
      style={{ background: "var(--card)", border: "1px solid rgba(var(--ink),0.06)" }}
    >
      <div className="mb-3">
        <p className="text-sm font-bold text-foreground">{t("mode.title")}</p>
        <p className="mt-0.5 text-[0.72rem] text-foreground/40">{t("mode.subtitle")}</p>
      </div>

      {/* segmented control — same track/segment structure for both options */}
      <div
        role="tablist"
        aria-label={t("mode.title")}
        className="grid grid-cols-2 gap-1.5 rounded-2xl p-1.5"
        style={{ background: "rgba(var(--ink),0.04)", border: "1px solid rgba(var(--ink),0.05)" }}
      >
        {options.map(({ value, label, desc, Icon }) => {
          const active = mode === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl px-3 py-3.5 text-center transition-all active:scale-[0.98]",
                active ? "text-white" : "text-foreground/50 hover:text-foreground/80",
              )}
              style={
                active
                  ? {
                      background: `linear-gradient(135deg, ${GREEN_LIGHT} 0%, ${GREEN} 100%)`,
                      boxShadow: "0 4px 16px rgba(29,158,117,0.35)",
                    }
                  : { background: "transparent" }
              }
            >
              <Icon className={cn("size-5", !active && "text-foreground/45")} />
              <span className="text-sm font-bold leading-none">{label}</span>
              <span
                className={cn(
                  "text-[0.65rem] leading-tight",
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
