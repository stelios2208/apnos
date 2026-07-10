import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Flame, Table, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSessionFx } from "@/hooks/use-session-fx";
import { UnderwaterScene } from "@/components/UnderwaterScene";
import { FreeTrainer } from "@/components/trainer/FreeTrainer";
import { TablesTool } from "@/components/trainer/TablesTool";
import { WarmupTool } from "@/components/trainer/WarmupTool";
import { HoldAlertsCard } from "@/components/trainer/HoldAlertsCard";
import { FxChipsRow } from "@/components/trainer/FxControls";

// ── Static Trainer hub ───────────────────────────────────────────────────────
// One entry point for the whole static workflow: warm-up → CO₂/O₂ tables →
// free static. The three tools share the same FX settings, hold alerts and
// recorded voice cues, configured once right here.

type Tool = "warmup" | "tables" | "free";

export const Route = createFileRoute("/sta-trainer")({
  validateSearch: (search: Record<string, unknown>): { tool?: Tool } => {
    const t = search.tool;
    return t === "warmup" || t === "tables" || t === "free" ? { tool: t } : {};
  },
  head: () => ({ meta: [{ title: "Static Trainer — Apnos" }] }),
  component: StaticTrainerHub,
});

const TOOLS: {
  tool: Tool;
  icon: LucideIcon;
  accent: string;
  title_el: string;
  title_en: string;
  sub_el: string;
  sub_en: string;
}[] = [
  {
    tool: "warmup",
    icon: Flame,
    accent: "#EF9F27",
    title_el: "Ζέσταμα",
    title_en: "Warm-up",
    sub_el: "Τεχνικές αναπνοής & έτοιμες προθερμάνσεις με γύρους",
    sub_en: "Breathing techniques & ready warm-ups with rounds",
  },
  {
    tool: "tables",
    icon: Table,
    accent: "#1D9E75",
    title_el: "Πίνακες CO₂ / O₂",
    title_en: "CO₂ / O₂ Tables",
    sub_el: "Presets από το PB σου ή δικοί σου custom γύροι",
    sub_en: "Presets from your PB or your own custom rounds",
  },
  {
    tool: "free",
    icon: Waves,
    accent: "#5DCAA5",
    title_el: "Ελεύθερη Στατική",
    title_en: "Free Static",
    sub_el: "Καθοδηγούμενη στατική με γύρους & συσπάσεις",
    sub_en: "Guided static with rounds & contractions",
  },
];

function StaticTrainerHub() {
  const { tool } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const openTool = (t: Tool) => navigate({ search: { tool: t } });
  const backToHub = () => navigate({ search: {} });

  if (tool === "warmup") return <WarmupTool onBack={backToHub} />;
  if (tool === "tables") return <TablesTool onBack={backToHub} />;
  if (tool === "free") return <FreeTrainer onExit={backToHub} />;

  return <HubLanding onOpen={openTool} />;
}

function HubLanding({ onOpen }: { onOpen: (t: Tool) => void }) {
  const sfx = useSessionFx();
  const { lang } = sfx;
  const el = lang === "el";
  const navigate = useNavigate();

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
            onClick={() => navigate({ to: "/train" })}
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {el ? "Στατική Trainer" : "Static Trainer"}
            </h1>
            <p className="text-xs text-white/35">
              {el
                ? "Ζέσταμα → Πίνακες → Στατική, όλα σε ένα"
                : "Warm-up → Tables → Static, all in one"}
            </p>
          </div>
        </div>

        {/* tools — in training order */}
        <div className="mt-6 space-y-3">
          {TOOLS.map(({ tool, icon: Icon, accent, title_el, title_en, sub_el, sub_en }) => (
            <button
              key={tool}
              onClick={() => onOpen(tool)}
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition-all active:scale-[0.99]"
              style={{
                background: "#0d1320",
                border: "1px solid rgba(255,255,255,0.06)",
                borderLeft: `3px solid ${accent}`,
              }}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: `${accent}18`, color: accent }}
              >
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">{el ? title_el : title_en}</p>
                <p className="mt-0.5 text-[0.72rem] text-white/40">{el ? sub_el : sub_en}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-white/20" />
            </button>
          ))}
        </div>

        {/* shared settings — apply to all three tools */}
        <p className="mt-7 mb-3 text-[0.6rem] font-bold tracking-[0.25em] text-white/30">
          {el ? "ΚΟΙΝΕΣ ΡΥΘΜΙΣΕΙΣ — ΙΣΧΥΟΥΝ ΠΑΝΤΟΥ" : "SHARED SETTINGS — APPLY EVERYWHERE"}
        </p>
        <HoldAlertsCard alarms={sfx.alarms} onToggle={sfx.toggleAlarm} lang={lang} />
        <div className="mt-4">
          <FxChipsRow sfx={sfx} />
        </div>
      </div>
    </div>
  );
}
