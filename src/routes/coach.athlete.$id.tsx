import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Save } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/lib/i18n";
import {
  type Athlete,
  levelLabel,
  levelColor,
  loadAthletes,
  saveAthletes,
} from "@/lib/athletes";

export const Route = createFileRoute("/coach/athlete/$id")({
  head: () => ({ meta: [{ title: "Αθλητής — Apnos" }] }),
  component: () => (
    <AppLayout>
      <AthletePage />
    </AppLayout>
  ),
});

// ── types ──────────────────────────────────────────────────────────────────

type Tab = "program" | "history";

interface ProgramSections {
  warmup:  string;
  mainset: string;
  cooldown: string;
  notes:   string;
}

const EMPTY_PROGRAM: ProgramSections = { warmup: "", mainset: "", cooldown: "", notes: "" };

// ── component ──────────────────────────────────────────────────────────────

function AthletePage() {
  const { lang } = useI18n();
  const { id }   = Route.useParams();

  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [tab, setTab]         = useState<Tab>("program");
  const [sections, setSections] = useState<ProgramSections>(EMPTY_PROGRAM);
  const [openSections, setOpenSections] = useState<Set<keyof ProgramSections>>(
    new Set(["warmup", "mainset", "cooldown", "notes"])
  );
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const all = loadAthletes();
    const found = all.find((a) => a.id === id) ?? null;
    setAthlete(found);
    if (found?.program) {
      try {
        const parsed = JSON.parse(found.program);
        if (parsed && typeof parsed === "object") {
          setSections({ ...EMPTY_PROGRAM, ...parsed });
          return;
        }
      } catch { /* legacy plain text */ }
      setSections({ ...EMPTY_PROGRAM, mainset: found.program ?? "" });
    }
  }, [id]);

  const persist = (updated: ProgramSections) => {
    const all = loadAthletes();
    const next = all.map((a) => a.id === id ? { ...a, program: JSON.stringify(updated) } : a);
    saveAthletes(next);
    setSavedAt(new Date());
  };

  const handleChange = (key: keyof ProgramSections, value: string) => {
    const next = { ...sections, [key]: value };
    setSections(next);
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => persist(next), 1500);
  };

  const handleBlur = (key: keyof ProgramSections) => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    persist(sections);
  };

  const toggleSection = (key: keyof ProgramSections) =>
    setOpenSections((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });

  if (!athlete) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/40">{lang === "el" ? "Ο αθλητής δεν βρέθηκε." : "Athlete not found."}</p>
        <Link to="/coach" className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="size-4" />
          {lang === "el" ? "Πίσω" : "Back"}
        </Link>
      </div>
    );
  }

  const color = levelColor(athlete.level);

  const SECTION_DEFS: { key: keyof ProgramSections; label_el: string; label_en: string; placeholder_el: string; placeholder_en: string }[] = [
    {
      key: "warmup",
      label_el: "Προθέρμανση",   label_en: "Warm-up",
      placeholder_el: "π.χ. 5' ελαφρά STA, αναπνευστικές ασκήσεις…",
      placeholder_en: "e.g. 5' light STA, breathing exercises…",
    },
    {
      key: "mainset",
      label_el: "Κύριο Σετ",     label_en: "Main Set",
      placeholder_el: "π.χ. STA tables 2+2×6, DYN 50m×4 rest 3'…",
      placeholder_en: "e.g. STA tables 2+2×6, DYN 50m×4 rest 3'…",
    },
    {
      key: "cooldown",
      label_el: "Αποθεραπεία",   label_en: "Cool-down",
      placeholder_el: "π.χ. 5' ελεύθερη κολύμβηση, stretching…",
      placeholder_en: "e.g. 5' easy swim, stretching…",
    },
    {
      key: "notes",
      label_el: "Σημειώσεις",    label_en: "Notes",
      placeholder_el: "Τεχνικές παρατηρήσεις, επόμενοι στόχοι…",
      placeholder_en: "Technical notes, next goals…",
    },
  ];

  return (
    <div className="space-y-5">
      {/* back */}
      <Link
        to="/coach"
        className="flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        <ArrowLeft className="size-4" />
        {lang === "el" ? "Πίσω στην ομάδα" : "Back to team"}
      </Link>

      {/* athlete header */}
      <div
        className="flex items-center gap-4 rounded-2xl px-5 py-4"
        style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold"
          style={{ background: `${color}18`, color }}
        >
          {athlete.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">{athlete.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className="rounded-md px-2 py-0.5 text-[0.6rem] font-bold tracking-wider"
              style={{ background: `${color}18`, color }}
            >
              {levelLabel(athlete.level, lang)}
            </span>
            {athlete.disciplines.map((d) => (
              <span
                key={d}
                className="rounded px-1.5 py-0.5 text-[0.55rem] font-bold tracking-wider"
                style={{ background: "rgba(93,202,165,0.1)", color: "#5DCAA5" }}
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="flex rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)" }}>
        {(["program", "history"] as Tab[]).map((t) => {
          const label = t === "program"
            ? (lang === "el" ? "Τρέχον Πρόγραμμα" : "Current Programme")
            : (lang === "el" ? "Ιστορικό" : "History");
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all"
              style={{ background: active ? "#1D9E75" : "transparent", color: active ? "#fff" : "rgba(255,255,255,0.35)" }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* program tab */}
      {tab === "program" && (
        <div className="space-y-3">
          {/* save status */}
          <div className="flex items-center justify-between">
            <p className="text-[0.65rem] font-bold tracking-[0.2em] text-white/25">
              {lang === "el" ? "ΠΡΟΓΡΑΜΜΑ ΠΡΟΠΟΝΗΣΗΣ" : "TRAINING PROGRAMME"}
            </p>
            {savedAt && (
              <span className="text-[0.6rem] text-white/20">
                {lang === "el" ? "Αποθηκεύτηκε" : "Saved"} {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          {/* expandable sections */}
          {SECTION_DEFS.map(({ key, label_el, label_en, placeholder_el, placeholder_en }) => {
            const isOpen = openSections.has(key);
            const label = lang === "el" ? label_el : label_en;
            const placeholder = lang === "el" ? placeholder_el : placeholder_en;
            const filled = sections[key].trim().length > 0;
            return (
              <div
                key={key}
                className="overflow-hidden rounded-xl"
                style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <button
                  onClick={() => toggleSection(key)}
                  className="flex w-full items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{label}</span>
                    {filled && (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: "#1D9E75" }}
                      />
                    )}
                  </div>
                  {isOpen
                    ? <ChevronDown className="size-4 text-white/30" />
                    : <ChevronRight className="size-4 text-white/30" />
                  }
                </button>
                {isOpen && (
                  <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <textarea
                      value={sections[key]}
                      onChange={(e) => handleChange(key, e.target.value)}
                      onBlur={() => handleBlur(key)}
                      placeholder={placeholder}
                      rows={4}
                      className="w-full resize-none bg-transparent text-sm leading-relaxed text-white/75 placeholder-white/15 outline-none"
                    />
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={() => persist(sections)}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all"
            style={{ background: "#1D9E75", color: "#fff" }}
          >
            <Save className="size-4" />
            {lang === "el" ? "Αποθήκευση" : "Save"}
          </button>
        </div>
      )}

      {tab === "history" && (
        <div
          className="flex flex-col items-center gap-4 rounded-2xl py-14 text-center"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.06)" }}
        >
          <p className="text-sm text-white/25">
            {lang === "el"
              ? "Το ιστορικό προπονήσεων θα εμφανιστεί εδώ σύντομα."
              : "Training history will appear here soon."}
          </p>
        </div>
      )}
    </div>
  );
}
