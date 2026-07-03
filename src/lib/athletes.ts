import { supabase } from "@/integrations/supabase/client";

export type Level = "beginner" | "intermediate" | "advanced" | "competitive";
export type DisciplineCode = "STA" | "DYN" | "DYNB" | "DNF" | "CWT" | "CWTB" | "CNF" | "FIM";
export type TemplateKind = "sta" | "dyn" | "depth";
export type TableType = "CO2" | "O2" | "FRC" | "RV" | "Classic";
export type DynSetType = "warmup" | "mainset" | "sprint" | "resistance";
export type BreathingMode = "normal" | "FRC" | "RV";

// ── Program row types ──────────────────────────────────────────────────────

export interface STARound {
  id: string;
  kind: "sta";
  breathUp: string;
  holdTime: string;
  recovery: string;
  tableType: TableType;
  notes: string;
}

export interface DynSet {
  id: string;
  kind: "dyn";
  reps: number;
  distance: number;
  rest: string;
  setType: DynSetType;
  breathingMode: BreathingMode;
  notes: string;
}

export interface DepthDive {
  id: string;
  kind: "depth";
  targetDepth: number;
  totalTime: string;
  surfaceInterval: string;
  notes: string;
}

export type ProgramRow = STARound | DynSet | DepthDive;

export interface TrainingProgram {
  id: string;
  name: string;
  date: string;
  discipline?: DisciplineCode;
  sets: ProgramRow[];
}

// ── Athlete ────────────────────────────────────────────────────────────────

export interface Athlete {
  id: string;
  name: string;
  level: Level;
  disciplines: DisciplineCode[];
  programs: TrainingProgram[];
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

export const TABLE_TYPES: TableType[] = ["CO2", "O2", "FRC", "RV", "Classic"];
export const DYN_SET_TYPES: { value: DynSetType; label: string; color: string }[] = [
  { value: "warmup",     label: "Warm-up",    color: "#1D9E75" },
  { value: "mainset",    label: "Main Set",   color: "#1D9E75" },
  { value: "resistance", label: "Resistance", color: "#EF9F27" },
  { value: "sprint",     label: "Sprint",     color: "#ef4444" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

export function levelLabel(level: Level, lang: string) {
  const l = LEVELS.find((x) => x.value === level);
  return l ? (lang === "el" ? l.label_el : l.label_en) : level;
}

export function levelColor(level: Level) {
  return LEVELS.find((x) => x.value === level)?.color ?? "#5DCAA5";
}

// Up to two initials (first + last word) so athletes with the same first
// letter stay distinguishable, e.g. "Giorgos Markis" → "GM".
export function athleteInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// Distinct, deterministic avatar colour per athlete so cards don't all share
// the level colour. Stable across renders (hash of the athlete id/name).
const ATHLETE_PALETTE = [
  "#5DCAA5", "#1D9E75", "#EF9F27", "#4FA8E0", "#B58BE8",
  "#E87DA8", "#7ED9C3", "#E0C04F", "#6FB1F5", "#F2846B",
];

export function athleteColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return ATHLETE_PALETTE[Math.abs(hash) % ATHLETE_PALETTE.length]!;
}

export function templateKind(discipline: DisciplineCode): TemplateKind {
  if (discipline === "STA") return "sta";
  if (["CWT", "CWTB", "CNF", "FIM"].includes(discipline)) return "depth";
  return "dyn";
}

export function parseSeconds(mmss: string): number {
  const parts = mmss.trim().split(":").map(Number);
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  return parseInt(mmss, 10) || 0;
}

export function fmtSeconds(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Template row factories ─────────────────────────────────────────────────

export function newSTARound(): STARound {
  return { id: crypto.randomUUID(), kind: "sta", breathUp: "2:00", holdTime: "1:30", recovery: "2:00", tableType: "CO2", notes: "" };
}

export function newDynSet(): DynSet {
  return { id: crypto.randomUUID(), kind: "dyn", reps: 4, distance: 50, rest: "2:00", setType: "mainset", breathingMode: "normal", notes: "" };
}

export type DynIntensity = "easy" | "intermediate" | "high" | "advanced";

export function dynSetColor(setType: DynSetType): string {
  return DYN_SET_TYPES.find((s) => s.value === setType)?.color ?? "#5DCAA5";
}

export function dynSetLabel(setType: DynSetType): string {
  return DYN_SET_TYPES.find((s) => s.value === setType)?.label ?? setType;
}

export function dynIntensityTag(rows: ProgramRow[]): DynIntensity {
  const ds = rows.filter((r): r is DynSet => r.kind === "dyn");
  if (ds.length === 0) return "easy";

  // Advanced: 100m+ with resistance or FRC, OR >2 reps with resistance
  if (ds.some((r) => r.distance >= 100 && (r.setType === "resistance" || r.breathingMode === "FRC"))) return "advanced";
  if (ds.some((r) => r.reps > 2 && r.setType === "resistance")) return "advanced";

  // High: resistance at any distance, OR (>2 reps AND rest <45s), OR 100m+ sets
  if (ds.some((r) => r.setType === "resistance")) return "high";
  if (ds.some((r) => r.reps > 2 && parseSeconds(r.rest) < 45)) return "high";
  if (ds.some((r) => r.distance >= 100)) return "high";

  // Intermediate: 50m with rest ≤45s, OR 75m sets, OR FRC
  if (ds.some((r) => r.breathingMode === "FRC")) return "intermediate";
  if (ds.some((r) => r.distance >= 75)) return "intermediate";
  if (ds.some((r) => r.distance === 50 && parseSeconds(r.rest) <= 45)) return "intermediate";

  return "easy";
}

export function newDepthDive(): DepthDive {
  return { id: crypto.randomUUID(), kind: "depth", targetDepth: 20, totalTime: "1:30", surfaceInterval: "3:00", notes: "" };
}

export function newRow(discipline: DisciplineCode): ProgramRow {
  const k = templateKind(discipline);
  if (k === "sta") return newSTARound();
  if (k === "depth") return newDepthDive();
  return newDynSet();
}

// ── Summary helpers ────────────────────────────────────────────────────────

export function totalSTAHoldSecs(rows: ProgramRow[]): number {
  return rows
    .filter((r): r is STARound => r.kind === "sta")
    .reduce((sum, r) => sum + parseSeconds(r.holdTime), 0);
}

export function totalDynMetres(rows: ProgramRow[]): number {
  return rows
    .filter((r): r is DynSet => r.kind === "dyn")
    .reduce((sum, s) => sum + s.reps * s.distance, 0);
}

export function maxDepthMetres(rows: ProgramRow[]): number {
  return rows
    .filter((r): r is DepthDive => r.kind === "depth")
    .reduce((max, d) => Math.max(max, d.targetDepth), 0);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Supabase CRUD ──────────────────────────────────────────────────────────

type Row = {
  id: string;
  name: string;
  level: string;
  disciplines: string[];
  programs: unknown;
};

function rowToAthlete(r: Row): Athlete {
  return {
    id: r.id,
    name: r.name,
    level: r.level as Level,
    disciplines: (r.disciplines ?? []) as DisciplineCode[],
    programs: (r.programs ?? []) as TrainingProgram[],
  };
}

export async function fetchAthletes(userId: string): Promise<Athlete[]> {
  const { data, error } = await supabase
    .from("coach_athletes")
    .select("id, name, level, disciplines, programs")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => rowToAthlete(r as Row));
}

export async function createAthlete(
  userId: string,
  input: { name: string; level: Level; disciplines: DisciplineCode[] }
): Promise<Athlete> {
  const { data, error } = await supabase
    .from("coach_athletes")
    .insert({ user_id: userId, ...input, programs: [] })
    .select("id, name, level, disciplines, programs")
    .single();
  if (error) throw error;
  return rowToAthlete(data as Row);
}

export async function updateAthlete(
  athleteId: string,
  input: { name: string; level: Level; disciplines: DisciplineCode[] }
): Promise<void> {
  const { error } = await supabase
    .from("coach_athletes")
    .update(input)
    .eq("id", athleteId);
  if (error) throw error;
}

export async function updateAthletePrograms(
  athleteId: string,
  programs: TrainingProgram[]
): Promise<void> {
  const { error } = await supabase
    .from("coach_athletes")
    .update({ programs })
    .eq("id", athleteId);
  if (error) throw error;
}

export async function deleteAthlete(athleteId: string): Promise<void> {
  const { error } = await supabase
    .from("coach_athletes")
    .delete()
    .eq("id", athleteId);
  if (error) throw error;
}
