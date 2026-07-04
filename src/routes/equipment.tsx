import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

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
  { id: "soap",         el: "Σαπούνι",               en: "Soap",    hint_el: "βοηθά να φορέσεις τη στολή", hint_en: "helps slide the wetsuit on" },
  { id: "water",        el: "Νερό",                  en: "Water" },
  { id: "towel",        el: "Πετσέτα",               en: "Towel" },
];

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
      const items = parsed.items as Item[];
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("equip.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("equip.sub")}</p>
      </div>

      <div className="glass-card space-y-3 rounded-2xl p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-primary">{t("equip.progress", { done, total: items.length })}</span>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={resetChecks}>
            <RotateCcw className="size-3.5" /> {t("equip.reset")}
          </Button>
        </div>
        <Progress value={pct} />
      </div>

      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="glass-card flex items-center gap-3 rounded-xl px-4 py-3">
            <Checkbox id={it.id} checked={it.checked} onCheckedChange={() => toggle(it.id)} />
            <label
              htmlFor={it.id}
              className={cn(
                "flex-1 cursor-pointer text-sm",
                it.checked && "text-muted-foreground line-through",
              )}
            >
              {it.label}
              {it.hint && (
                <span className="mt-0.5 block text-[0.68rem] font-normal text-muted-foreground no-underline">
                  {it.hint}
                </span>
              )}
            </label>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => remove(it.id)} aria-label={t("common.delete")}>
              <Trash2 className="size-3.5 text-muted-foreground" />
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("equip.addPlaceholder")}
        />
        <Button variant="hero" size="icon" onClick={add} aria-label={t("common.add")}>
          <Plus className="size-5" />
        </Button>
      </div>
    </div>
  );
}
