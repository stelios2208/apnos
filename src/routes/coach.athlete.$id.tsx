import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Save, Clock } from "lucide-react";
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

type Tab = "program" | "history";

function AthletePage() {
  const { lang } = useI18n();
  const { id }   = Route.useParams();

  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [tab, setTab]         = useState<Tab>("program");
  const [program, setProgram] = useState("");
  const [saved, setSaved]     = useState(true);
  const autoSaveTimer         = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const all = loadAthletes();
    const found = all.find((a) => a.id === id) ?? null;
    setAthlete(found);
    setProgram(found?.program ?? "");
  }, [id]);

  const persist = (text: string) => {
    const all = loadAthletes();
    const updated = all.map((a) => a.id === id ? { ...a, program: text } : a);
    saveAthletes(updated);
    setSaved(true);
  };

  const handleChange = (text: string) => {
    setProgram(text);
    setSaved(false);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => persist(text), 1500);
  };

  const handleSave = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    persist(program);
  };

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
      <div
        className="flex rounded-xl p-1"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
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
              style={{
                background: active ? "#1D9E75" : "transparent",
                color: active ? "#fff" : "rgba(255,255,255,0.35)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* tab content */}
      {tab === "program" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[0.65rem] font-bold tracking-[0.2em] text-white/30">
              {lang === "el" ? "ΠΡΟΓΡΑΜΜΑ ΠΡΟΠΟΝΗΣΗΣ" : "TRAINING PROGRAMME"}
            </p>
            <div className="flex items-center gap-2">
              {!saved && (
                <span className="flex items-center gap-1 text-[0.6rem] text-white/25">
                  <Clock className="size-3" />
                  {lang === "el" ? "αποθήκευση…" : "saving…"}
                </span>
              )}
              {saved && program.length > 0 && (
                <span className="text-[0.6rem] text-white/20">
                  {lang === "el" ? "αποθηκεύτηκε" : "saved"}
                </span>
              )}
            </div>
          </div>

          <textarea
            value={program}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={
              lang === "el"
                ? "Γράψε το πρόγραμμα προπόνησης για αυτόν τον αθλητή…\n\nΠαράδειγμα:\nΔευτέρα: STA tables 2+2\nΤετάρτη: DYN 50m × 4\nΠαρασκευή: Στατική με συσπάσεις"
                : "Write the training programme for this athlete…\n\nExample:\nMonday: STA tables 2+2\nWednesday: DYN 50m × 4\nFriday: Static with contractions"
            }
            rows={12}
            className="w-full resize-none rounded-2xl bg-white/[0.03] px-4 py-4 text-sm leading-relaxed text-white/80 placeholder-white/15 outline-none transition-all focus:bg-white/[0.05] focus:ring-1 focus:ring-[#1D9E75]"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          />

          <button
            onClick={handleSave}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all"
            style={{ background: saved ? "rgba(29,158,117,0.15)" : "#1D9E75", color: saved ? "#5DCAA5" : "#fff" }}
          >
            <Save className="size-4" />
            {saved
              ? (lang === "el" ? "Αποθηκεύτηκε" : "Saved")
              : (lang === "el" ? "Αποθήκευση" : "Save")}
          </button>
        </div>
      )}

      {tab === "history" && (
        <div
          className="flex flex-col items-center gap-4 rounded-2xl py-14 text-center"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.06)" }}
        >
          <Clock className="size-8 text-white/10" />
          <p className="text-sm text-white/30">
            {lang === "el"
              ? "Το ιστορικό προπονήσεων θα εμφανιστεί εδώ σύντομα."
              : "Training history will appear here soon."}
          </p>
        </div>
      )}
    </div>
  );
}
