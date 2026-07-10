import { supabase } from "@/integrations/supabase/client";

// ── STA training tables (CO2 / O2) ───────────────────────────────────────────
// Preset generation from the athlete's STA PB + persistence in `sta_tables`.

export type StaTableType = "co2" | "o2";
export type BreathingMode = "normal" | "frc" | "rv";
export type PresetLevel = "easy" | "medium" | "hard";

export interface TableRound {
  breatheSecs: number;
  holdSecs: number;
}

export interface StaTable {
  id: string;
  user_id: string;
  name: string;
  type: StaTableType;
  breathing_mode: BreathingMode;
  rounds: TableRound[];
  created_at: string;
}

export const TABLE_ROUNDS = 6;

// CO2: hold is fixed (% of PB), breathe shrinks 2:00 → 0:45 across the rounds.
// Percentages are deliberately conservative — training tables should feel
// repeatable, not like max attempts.
export const CO2_BREATHE_START = 120;
export const CO2_BREATHE_END = 45;
const CO2_HOLD_PCT: Record<PresetLevel, number> = { easy: 0.35, medium: 0.45, hard: 0.55 };

// O2: breathe is fixed at 2:00, hold climbs start% → end% of PB.
export const O2_BREATHE = 120;
const O2_HOLD_PCT: Record<PresetLevel, [start: number, end: number]> = {
  easy: [0.25, 0.45],
  medium: [0.35, 0.55],
  hard: [0.45, 0.65],
};

// Every generated duration snaps to 5s — matches the +/- 5s editing step, so
// switching a preset to custom never shows odd values like 1:47.
const snap5 = (secs: number) => Math.max(5, Math.round(secs / 5) * 5);

/** Linear interpolation from `from` to `to` across TABLE_ROUNDS points. */
function ladder(from: number, to: number): number[] {
  const step = (to - from) / (TABLE_ROUNDS - 1);
  return Array.from({ length: TABLE_ROUNDS }, (_, i) => snap5(from + step * i));
}

export function co2Preset(level: PresetLevel, pbSecs: number): TableRound[] {
  const hold = snap5(pbSecs * CO2_HOLD_PCT[level]);
  const breathes = ladder(CO2_BREATHE_START, CO2_BREATHE_END);
  return breathes.map((breatheSecs) => ({ breatheSecs, holdSecs: hold }));
}

export function o2Preset(level: PresetLevel, pbSecs: number): TableRound[] {
  const [start, end] = O2_HOLD_PCT[level];
  const holds = ladder(pbSecs * start, pbSecs * end);
  return holds.map((holdSecs) => ({ breatheSecs: O2_BREATHE, holdSecs }));
}

export function presetRounds(type: StaTableType, level: PresetLevel, pbSecs: number): TableRound[] {
  return type === "co2" ? co2Preset(level, pbSecs) : o2Preset(level, pbSecs);
}

export function tableTotalSecs(rounds: TableRound[]): number {
  return rounds.reduce((s, r) => s + r.breatheSecs + r.holdSecs, 0);
}

export const PRESET_LEVELS: PresetLevel[] = ["easy", "medium", "hard"];

export const LEVEL_LABEL: Record<PresetLevel, { el: string; en: string }> = {
  easy: { el: "Εύκολο", en: "Easy" },
  medium: { el: "Μέτριο", en: "Medium" },
  hard: { el: "Δύσκολο", en: "Hard" },
};

export const MODE_LABEL: Record<BreathingMode, string> = {
  normal: "Normal",
  frc: "FRC",
  rv: "RV",
};

// ── persistence ──────────────────────────────────────────────────────────────
// The deployed DB may not have the sta_tables migration yet; PostgREST then
// reports a missing relation (PGRST205 / 42P01). Reads degrade to an empty
// library so the page keeps working; writes surface the error to the caller.

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === "PGRST205" || err.code === "42P01" || /sta_tables/i.test(err.message ?? "");
}

export async function fetchStaTables(userId: string): Promise<StaTable[]> {
  const { data, error } = await supabase
    .from("sta_tables")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as StaTable[];
}

export interface NewStaTableInput {
  name: string;
  type: StaTableType;
  breathing_mode: BreathingMode;
  rounds: TableRound[];
}

export async function saveStaTable(userId: string, input: NewStaTableInput): Promise<StaTable> {
  const { data, error } = await supabase
    .from("sta_tables")
    .insert({ user_id: userId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data as StaTable;
}

export async function deleteStaTable(id: string): Promise<void> {
  const { error } = await supabase.from("sta_tables").delete().eq("id", id);
  if (error) throw error;
}
