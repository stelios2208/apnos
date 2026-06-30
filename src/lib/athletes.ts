export type Level = "beginner" | "intermediate" | "advanced" | "competitive";
export type DisciplineCode = "STA" | "DYN" | "DYNB" | "DNF" | "CWT" | "CWTB" | "CNF" | "FIM";
export type SetType = "warmup" | "mainset" | "strength" | "surface" | "custom";

// ── Program types ──────────────────────────────────────────────────────────

export interface ProgramSet {
  id: string;
  type: SetType;
  reps: number;
  value: string;    // "75m" | "1:30" | "1:00 STA + 100m DYN"
  rest: string;     // "3:00"
  notes: string;
  combined: boolean;
  staTime: string;  // used when combined=true
  dynDist: string;  // used when combined=true
}

export interface TrainingProgram {
  id: string;
  name: string;
  date: string;   // ISO date
  sets: ProgramSet[];
}

// ── Athlete ────────────────────────────────────────────────────────────────

export interface Athlete {
  id: string;
  name: string;
  level: Level;
  disciplines: DisciplineCode[];
  programs?: TrainingProgram[];
  program?: string; // legacy single-program field
}

// ── Constants ──────────────────────────────────────────────────────────────

export const LEVELS: { value: Level; label_el: string; label_en: string; color: string }[] = [
  { value: "beginner",     label_el: "Αρχάριος",     label_en: "Beginner",     color: "#9FE1CB" },
  { value: "intermediate", label_el: "Μέσος",        label_en: "Intermediate", color: "#5DCAA5" },
  { value: "advanced",     label_el: "Προχωρημένος", label_en: "Advanced",     color: "#1D9E75" },
  { value: "competitive",  label_el: "Αγωνιστικός",  label_en: "Competitive",  color: "#EF9F27" },
];

export const ALL_DISCIPLINES: DisciplineCode[] = [
  "STA", "DYN", "DYNB", "DNF", "CWT", "CWTB", "CNF", "FIM",
];

export const SET_TYPES: { value: SetType; label_el: string; label_en: string; color: string }[] = [
  { value: "warmup",   label_el: "Θέρμανση",   label_en: "Warm-up",  color: "#9FE1CB" },
  { value: "mainset",  label_el: "Κύριο",       label_en: "Main",     color: "#1D9E75" },
  { value: "strength", label_el: "Δύναμη",      label_en: "Strength", color: "#EF9F27" },
  { value: "surface",  label_el: "Επιφάνεια",   label_en: "Surface",  color: "#5DCAA5" },
  { value: "custom",   label_el: "Άλλο",         label_en: "Custom",   color: "rgba(255,255,255,0.3)" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

export function levelLabel(level: Level, lang: string) {
  const l = LEVELS.find((x) => x.value === level);
  return l ? (lang === "el" ? l.label_el : l.label_en) : level;
}

export function levelColor(level: Level) {
  return LEVELS.find((x) => x.value === level)?.color ?? "#5DCAA5";
}

export function setTypeLabel(type: SetType, lang: string): string {
  const t = SET_TYPES.find((x) => x.value === type);
  return t ? (lang === "el" ? t.label_el : t.label_en) : type;
}

export function setTypeColor(type: SetType): string {
  return SET_TYPES.find((x) => x.value === type)?.color ?? "#5DCAA5";
}

export function nextSetType(type: SetType): SetType {
  const order: SetType[] = ["warmup", "mainset", "strength", "surface", "custom"];
  const i = order.indexOf(type);
  return order[(i + 1) % order.length];
}

/** Parse a value string and return metres (0 if time-based). */
export function parseMetres(value: string): number {
  const m = value.match(/(\d+)\s*m/i);
  return m ? parseInt(m[1], 10) : 0;
}

/** Parse "MM:SS" or "SS" → seconds. */
export function parseSeconds(mmss: string): number {
  const parts = mmss.trim().split(":").map(Number);
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  return parseInt(mmss, 10) || 0;
}

/** Auto-detect whether a value is time-based. */
export function isTimeValue(value: string): boolean {
  return /^\d+:\d{2}/.test(value.trim()) || /^STA/i.test(value.trim());
}

/** Total metres in a program. */
export function totalMetres(sets: ProgramSet[]): number {
  return sets.reduce((sum, s) => {
    if (s.combined) return sum + s.reps * (parseMetres(s.dynDist) || 0);
    return sum + s.reps * parseMetres(s.value);
  }, 0);
}

/** Rough estimated session minutes. */
export function estimatedMinutes(sets: ProgramSet[]): number {
  const secs = sets.reduce((sum, s) => {
    const workSecs = isTimeValue(s.value) ? parseSeconds(s.value) : 60;
    const restSecs = parseSeconds(s.rest);
    return sum + s.reps * (workSecs + restSecs);
  }, 0);
  return Math.round(secs / 60);
}

/** Auto intensity label from set type composition. */
export function intensityLabel(sets: ProgramSet[], lang: string): string {
  if (sets.length === 0) return lang === "el" ? "—" : "—";
  const counts = sets.reduce<Record<SetType, number>>(
    (acc, s) => { acc[s.type] = (acc[s.type] ?? 0) + 1; return acc; },
    {} as Record<SetType, number>
  );
  const total   = sets.length;
  const heavy   = (counts.mainset ?? 0) + (counts.strength ?? 0);
  const light   = counts.warmup ?? 0;
  if (heavy / total > 0.55) return lang === "el" ? "Υψηλή"   : "High";
  if (light / total > 0.55) return lang === "el" ? "Χαμηλή"  : "Low";
  return lang === "el" ? "Μέτρια" : "Moderate";
}

export function newSet(): ProgramSet {
  return { id: crypto.randomUUID(), type: "mainset", reps: 4, value: "50m", rest: "2:00", notes: "", combined: false, staTime: "", dynDist: "" };
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Storage ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "apnos.coach.athletes";

export function loadAthletes(): Athlete[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Athlete[]) : [];
  } catch { return []; }
}

export function saveAthletes(athletes: Athlete[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(athletes));
}
