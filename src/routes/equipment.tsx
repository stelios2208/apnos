import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Plus, Trash2, RotateCcw, Check, Backpack,
  Glasses, Footprints, Shirt, Wind, Weight, Cable, Eye, Droplet, Droplets, GlassWater, CircleDot,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ITEM_ICON: Record<string, LucideIcon> = {
  mask: Glasses,
  fins: Footprints,
  wetsuit: Shirt,
  noseclip: Wind,
  weights: Weight,
  snorkel: Wind,
  lanyard: Cable,
  swimgoggles: Glasses,
  depthgoggles: Eye,
  slippers: Footprints,
  shampoo: Droplet,
  water: GlassWater,
  towel: Droplets,
};

export const Route = createFileRoute("/equipment")({
  head: () => ({ meta: [{ title: "Equipment — Apnos" }] }),
  component: () => (
    <AppLayout>
      <Equipment />
    </AppLayout>
  ),
});

const STORAGE = "apnos.equipment";
const VERSION = 2;

interface Item {
  id: string;
  label: string;
  checked: boolean;
  custom?: boolean;
  hint?: string;
}

// Stable ids so newly-added standard items can be merged into lists that
// existing users already saved. "Lanyard" stays English on purpose.
const DEFAULTS: { id: string; el: string; en: string; hint_el?: string; hint_en?: string }[] = [
  { id: "mask",         el: "Μάσκα",                 en: "Mask" },
  { id: "fins",         el: "Πτερύγια / Μονοπέδιλο", en: "Fins / Monofin" },
  { id: "wetsuit",      el: "Στολή",                 en: "Wetsuit" },
  { id: "noseclip",     el: "Κλιπ μύτης",            en: "Noseclip" },
  { id: "weights",      el: "Βαρίδια / Ζώνη",        en: "Weights / Belt" },
  { id: "snorkel",      el: "Snorkel",               en: "Snorkel" },
  { id: "lanyard",      el: "Lanyard",               en: "Lanyard" },
  { id: "swimgoggles",  el: "Γυαλάκια κολύμβησης",   en: "Swim goggles" },
  { id: "depthgoggles", el: "Γυαλάκια βάθους (fluid)", en: "Depth goggles (fluid)" },
  { id: "slippers",     el: "Παντόφλες",             en: "Slippers" },
  { id: "shampoo",      el: "Σαμπουάν",              en: "Shampoo", hint_el: "βοηθά να φορέσεις τη στολή", hint_en: "helps slide the wetsuit on" },
  { id: "water",        el: "Νερό",                  en: "Water" },
  { id: "towel",        el: "Πετσέτα",               en: "Towel" },
];

// Ids removed from the checklist over time — filtered out of saved lists too.
const REMOVED_IDS = new Set(["soap"]);

function buildDefaults(lang: "el" | "en"): Item[] {
  return DEFAULTS.map((d) => ({
    id: d.id,
    label: lang === "el" ? d.el : d.en,
    hint: lang === "el" ? d.hint_el : d.hint_en,
    checked: false,
  }));
}

// Load saved list, migrating legacy shapes and merging any newly-added defaults.
function loadItems(lang: "el" | "en"): Item[] {
  const defaults = buildDefaults(lang);
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    // legacy v1: a raw array with generated ids d0.. — rebuild, keep customs
    if (Array.isArray(parsed)) {
      const customs = (parsed as Item[]).filter((it) => it.custom);
      return [...defaults, ...customs];
    }
    if (parsed && Array.isArray(parsed.items)) {
      const items = (parsed.items as Item[]).filter((it) => !REMOVED_IDS.has(it.id));
      const have = new Set(items.map((i) => i.id));
      const missing = defaults.filter((d) => !have.has(d.id));
      // refresh hints on existing default items (labels stay as saved)
      const withHints = items.map((it) => {
        const d = DEFAULTS.find((x) => x.id === it.id);
        return d ? { ...it, hint: lang === "el" ? d.hint_el : d.hint_en } : it;
      });
      return [...withHints, ...missing];
    }
    return defaults;
  } catch {
    return defaults;
  }
}

function Equipment() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(loadItems(lang));
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE, JSON.stringify({ version: VERSION, items }));
  }, [items, loaded]);

  const toggle = (id: string) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it)));
  const remove = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));
  const add = () => {
    const label = draft.trim();
    if (!label) return;
    setItems((prev) => [...prev, { id: `c${Date.now()}`, label, checked: false, custom: true }]);
    setDraft("");
  };
  const resetChecks = () => setItems((prev) => prev.map((it) => ({ ...it, checked: false })));

  const done = items.filter((it) => it.checked).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const allDone = items.length > 0 && done === items.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "rgba(239,159,39,0.14)", color: "#EF9F27" }}>
          <Backpack className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{t("equip.title")}</h1>
          <p className="text-xs text-white/35">{t("equip.sub")}</p>
        </div>
      </div>

      {/* progress */}
      <div className="rounded-2xl p-4" style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold" style={{ color: allDone ? "#5DCAA5" : "#EF9F27" }}>
            {allDone ? (lang === "el" ? "Έτοιμος! 🎒" : "All packed! 🎒") : `${done}/${items.length}`}
          </span>
          <button onClick={resetChecks} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.7rem] font-semibold text-white/45 hover:text-white/70" style={{ background: "rgba(255,255,255,0.04)" }}>
            <RotateCcw className="size-3.5" /> {t("equip.reset")}
          </button>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: allDone ? "#5DCAA5" : "#EF9F27" }} />
        </div>
      </div>

      {/* items */}
      <div className="space-y-2">
        {items.map((it) => {
          const Icon = ITEM_ICON[it.id] ?? CircleDot;
          return (
            <div
              key={it.id}
              onClick={() => toggle(it.id)}
              className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-3 transition-all active:scale-[0.99]"
              style={{ background: "#0d1320", border: `1px solid ${it.checked ? "rgba(29,158,117,0.3)" : "rgba(255,255,255,0.05)"}` }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: it.checked ? "rgba(29,158,117,0.15)" : "rgba(255,255,255,0.04)", color: it.checked ? "#5DCAA5" : "rgba(255,255,255,0.35)" }}>
                <Icon className="size-4" />
              </div>
              <div className={cn("min-w-0 flex-1", it.checked && "opacity-50")}>
                <p className={cn("text-sm text-white", it.checked && "line-through")}>{it.label}</p>
                {it.hint && <p className="mt-0.5 text-[0.65rem] text-white/35">{it.hint}</p>}
              </div>
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all" style={{ background: it.checked ? "#1D9E75" : "transparent", border: it.checked ? "none" : "1.5px solid rgba(255,255,255,0.15)" }}>
                {it.checked && <Check className="size-3.5 text-white" />}
              </div>
              {it.custom && (
                <button onClick={(e) => { e.stopPropagation(); remove(it.id); }} className="rounded-lg p-1.5 text-white/20 hover:text-red-400/70" aria-label={t("common.delete")}>
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* add custom */}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("equip.addPlaceholder")}
          className="flex-1 rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-[#1D9E75] placeholder:text-white/30"
        />
        <button onClick={add} aria-label={t("common.add")} className="flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "#1D9E75", color: "#fff" }}>
          <Plus className="size-5" />
        </button>
      </div>
    </div>
  );
}
