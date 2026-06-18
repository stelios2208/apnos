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

interface Item {
  id: string;
  label: string;
  checked: boolean;
  custom?: boolean;
}

const defaultsEl = ["Μάσκα", "Πτερύγια / Μονοπέδιλο", "Στολή", "Κλιπ μύτης", "Βαρίδια / Ζώνη", "Snorkel", "Λάστιχο λαιμού (lanyard)", "Νερό", "Πετσέτα"];
const defaultsEn = ["Mask", "Fins / Monofin", "Wetsuit", "Noseclip", "Weights / Belt", "Snorkel", "Lanyard", "Water", "Towel"];

function buildDefaults(lang: "el" | "en"): Item[] {
  const labels = lang === "el" ? defaultsEl : defaultsEn;
  return labels.map((label, i) => ({ id: `d${i}`, label, checked: false }));
}

function Equipment() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        setItems(JSON.parse(raw));
      } else {
        setItems(buildDefaults(lang));
      }
    } catch {
      setItems(buildDefaults(lang));
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE, JSON.stringify(items));
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
