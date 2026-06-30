import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { BreathMark } from "@/components/Logo";
import {
  type DisciplineCode, type Level,
  ALL_DISCIPLINES, LEVELS,
} from "@/lib/athletes";

interface Props {
  lang: string;
  initial?: { name: string; level: Level; disciplines: DisciplineCode[] };
  isPending: boolean;
  onSubmit: (values: { name: string; level: Level; disciplines: DisciplineCode[] }) => void;
  onClose: () => void;
}

export function AthleteFormModal({ lang, initial, isPending, onSubmit, onClose }: Props) {
  const [name, setName]               = useState(initial?.name ?? "");
  const [level, setLevel]             = useState<Level>(initial?.level ?? "beginner");
  const [disciplines, setDisciplines] = useState<DisciplineCode[]>(initial?.disciplines ?? []);

  const isEdit = !!initial;

  const toggle = (d: DisciplineCode) =>
    setDisciplines((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), level, disciplines });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full rounded-t-2xl px-5 pb-10 pt-5" style={{ background: "#0d1320" }}>
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/10" />

        <div className="mb-5 flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div style={{ opacity: 0.35 }}>
              <BreathMark size={80} />
            </div>
            <h2 className="text-base font-bold text-white">
              {isEdit
                ? (lang === "el" ? "Επεξεργασία Αθλητή" : "Edit Athlete")
                : (lang === "el" ? "Νέος Αθλητής" : "New Athlete")}
            </h2>
          </div>
          <button onClick={onClose} className="mt-1 text-white/30 transition-colors hover:text-white">
            <X className="size-5" />
          </button>
        </div>

        {/* name */}
        <div className="mb-4 space-y-1.5">
          <label className="text-[0.65rem] font-bold tracking-wider text-white/40">
            {lang === "el" ? "ΟΝΟΜΑ" : "NAME"}
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) handleSubmit(); }}
            placeholder={lang === "el" ? "π.χ. Νίκος Παπαδόπουλος" : "e.g. John Smith"}
            className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-[#1D9E75]"
          />
        </div>

        {/* level */}
        <div className="mb-4 space-y-2">
          <label className="text-[0.65rem] font-bold tracking-wider text-white/40">
            {lang === "el" ? "ΕΠΙΠΕΔΟ" : "LEVEL"}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                onClick={() => setLevel(l.value)}
                className="rounded-xl py-2.5 text-xs font-semibold transition-all"
                style={{
                  background: level === l.value ? `${l.color}25` : "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${level === l.value ? l.color : "transparent"}`,
                  color: level === l.value ? l.color : "rgba(255,255,255,0.4)",
                }}
              >
                {lang === "el" ? l.label_el : l.label_en}
              </button>
            ))}
          </div>
        </div>

        {/* disciplines */}
        <div className="mb-6 space-y-2">
          <label className="text-[0.65rem] font-bold tracking-wider text-white/40">
            {lang === "el" ? "ΚΛΑΔΟΙ (προαιρετικό)" : "DISCIPLINES (optional)"}
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_DISCIPLINES.map((d) => {
              const active = disciplines.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => toggle(d)}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
                  style={{
                    background: active ? "rgba(29,158,117,0.2)" : "rgba(255,255,255,0.04)",
                    border: `1.5px solid ${active ? "#1D9E75" : "transparent"}`,
                    color: active ? "#5DCAA5" : "rgba(255,255,255,0.35)",
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!name.trim() || isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold transition-all"
          style={{
            background: name.trim() ? "#1D9E75" : "rgba(255,255,255,0.05)",
            color: name.trim() ? "#fff" : "rgba(255,255,255,0.25)",
          }}
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isEdit
            ? (lang === "el" ? "Αποθήκευση" : "Save")
            : (lang === "el" ? "Προσθήκη Αθλητή" : "Add Athlete")}
        </button>
      </div>
    </div>
  );
}
