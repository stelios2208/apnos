export type Level = "beginner" | "intermediate" | "advanced" | "competitive";
export type DisciplineCode = "STA" | "DYN" | "DYNB" | "DNF" | "CWT" | "CWTB" | "CNF" | "FIM";

export interface Athlete {
  id: string;
  name: string;
  level: Level;
  disciplines: DisciplineCode[];
  program?: string;
}

export const LEVELS: { value: Level; label_el: string; label_en: string; color: string }[] = [
  { value: "beginner",     label_el: "Αρχάριος",     label_en: "Beginner",     color: "#9FE1CB" },
  { value: "intermediate", label_el: "Μέσος",        label_en: "Intermediate", color: "#5DCAA5" },
  { value: "advanced",     label_el: "Προχωρημένος", label_en: "Advanced",     color: "#1D9E75" },
  { value: "competitive",  label_el: "Αγωνιστικός",  label_en: "Competitive",  color: "#EF9F27" },
];

export const ALL_DISCIPLINES: DisciplineCode[] = [
  "STA", "DYN", "DYNB", "DNF", "CWT", "CWTB", "CNF", "FIM",
];

export function levelLabel(level: Level, lang: string) {
  const l = LEVELS.find((x) => x.value === level);
  return l ? (lang === "el" ? l.label_el : l.label_en) : level;
}

export function levelColor(level: Level) {
  return LEVELS.find((x) => x.value === level)?.color ?? "#5DCAA5";
}

const STORAGE_KEY = "apnos.coach.athletes";

export function loadAthletes(): Athlete[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Athlete[]) : [];
  } catch {
    return [];
  }
}

export function saveAthletes(athletes: Athlete[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(athletes));
}
