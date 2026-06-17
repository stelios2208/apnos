export type DisciplineCode =
  | "STA"
  | "DYN"
  | "DYNB"
  | "DNF"
  | "CWT"
  | "CWTB"
  | "CNF"
  | "FIM";

export type DisciplineUnit = "time" | "distance";

export interface Discipline {
  code: DisciplineCode;
  name: string;
  unit: DisciplineUnit;
  group: "Pool" | "Depth";
}

export const DISCIPLINES: Discipline[] = [
  { code: "STA", name: "Static Apnea", unit: "time", group: "Pool" },
  { code: "DYN", name: "Dynamic Bi-fins", unit: "distance", group: "Pool" },
  { code: "DYNB", name: "Dynamic Mono-fin", unit: "distance", group: "Pool" },
  { code: "DNF", name: "Dynamic No-fins", unit: "distance", group: "Pool" },
  { code: "CWT", name: "Constant Weight Bi-fins", unit: "distance", group: "Depth" },
  { code: "CWTB", name: "Constant Weight Mono-fin", unit: "distance", group: "Depth" },
  { code: "CNF", name: "Constant Weight No-fins", unit: "distance", group: "Depth" },
  { code: "FIM", name: "Free Immersion", unit: "distance", group: "Depth" },
];

export const DISCIPLINE_MAP: Record<DisciplineCode, Discipline> = Object.fromEntries(
  DISCIPLINES.map((d) => [d.code, d]),
) as Record<DisciplineCode, Discipline>;

export type SessionType = "training" | "competition";

export interface Dive {
  id: string;
  user_id: string;
  discipline: DisciplineCode;
  result: number;
  session_type: SessionType;
  dive_date: string;
  dive_time: string | null;
  sleep_hours: number | null;
  food_notes: string | null;
  mental_state: number | null;
  notes: string | null;
  is_personal_best: boolean;
  created_at: string;
}

export function formatResult(discipline: DisciplineCode, result: number): string {
  const unit = DISCIPLINE_MAP[discipline]?.unit;
  if (unit === "time") {
    const total = Math.round(result);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  return `${result} m`;
}
