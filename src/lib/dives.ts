import { supabase } from "@/integrations/supabase/client";
import type { Dive, DisciplineCode, Federation, SessionType, StaConditions } from "./diving";
import { DISCIPLINE_MAP, formatResult } from "./diving";

export interface NewDiveInput {
  discipline: DisciplineCode;
  result: number;
  dive_date: string;
  dive_time: string | null;
  session_type: SessionType;
  federation: Federation | null;
  sleep_hours: number | null;
  food_notes: string | null;
  mental_state: number | null;
  notes: string | null;
  neck_weight: number | null;
  belt_weight: number | null;
  wetsuit_mm: number | null;
  buoyancy: string | null;
  fins_type: string | null;
  fins_brand: string | null;
  fins_model: string | null;
  foot_pocket: string | null;
  water_temp: number | null;
  conditions?: StaConditions | null;
  /** Community opt-in (default false). See Dive.shared_to_feed. */
  shared_to_feed?: boolean;
}

// PostgREST reports an unknown column with code PGRST204. The deployed DB may
// lag behind the code (conditions and shared_to_feed each shipped ahead of
// their migrations), so writes drop the offending column and retry — the same
// generalized pattern as spearo-catches.ts.
function missingColumn(err: { code?: string; message?: string } | null): string | null {
  if (!err || err.code !== "PGRST204") return null;
  const m = /'([^']+)' column/.exec(err.message ?? "");
  return m ? m[1] : null;
}

export async function fetchDives(userId: string): Promise<Dive[]> {
  const { data, error } = await supabase
    .from("dives")
    .select("*")
    .eq("user_id", userId)
    .order("dive_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Dive[];
}

/** Log a completed Warm-up/STA Table hold as an STA training dive. */
export async function logStaHold(userId: string, resultSecs: number, notes: string): Promise<Dive> {
  const today = new Date().toISOString().slice(0, 10);
  return createDive(userId, {
    discipline: "STA",
    result: resultSecs,
    dive_date: today,
    dive_time: null,
    session_type: "training",
    federation: null,
    sleep_hours: null,
    food_notes: null,
    mental_state: null,
    notes,
    neck_weight: null,
    belt_weight: null,
    wetsuit_mm: null,
    buoyancy: null,
    fins_type: null,
    fins_brand: null,
    fins_model: null,
    foot_pocket: null,
    water_temp: null,
  });
}

/** Best (max) result per discipline. */
export function personalBests(dives: Dive[]): Record<string, Dive> {
  const best: Record<string, Dive> = {};
  for (const dive of dives) {
    const current = best[dive.discipline];
    if (!current || dive.result > current.result) {
      best[dive.discipline] = dive;
    }
  }
  return best;
}

/** Recompute the is_personal_best flag for a whole discipline of a user. */
async function recomputePersonalBest(userId: string, discipline: DisciplineCode): Promise<void> {
  const { data, error } = await supabase
    .from("dives")
    .select("id, result")
    .eq("user_id", userId)
    .eq("discipline", discipline)
    .order("result", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as { id: string; result: number }[];
  if (rows.length === 0) return;
  const bestId = rows[0].id;
  await Promise.all(
    rows.map((r) =>
      supabase
        .from("dives")
        .update({ is_personal_best: r.id === bestId })
        .eq("id", r.id),
    ),
  );
}

export async function createDive(userId: string, input: NewDiveInput): Promise<Dive> {
  const payload: Record<string, unknown> = { ...input, user_id: userId, is_personal_best: false };
  let { data, error } = await supabase.from("dives").insert(payload).select("*").single();
  // Drop-and-retry any column the deployed schema doesn't know yet (bounded:
  // one column removed per attempt).
  for (let col = missingColumn(error); error && col && col in payload; col = missingColumn(error)) {
    delete payload[col];
    ({ data, error } = await supabase.from("dives").insert(payload).select("*").single());
  }
  if (error) throw error;

  await recomputePersonalBest(userId, input.discipline);

  const dive = data as Dive;
  // Re-read this dive's flag after recompute so the toast is accurate.
  const { data: refreshed } = await supabase
    .from("dives")
    .select("is_personal_best")
    .eq("id", dive.id)
    .single();
  return { ...dive, is_personal_best: refreshed?.is_personal_best ?? dive.is_personal_best };
}

export async function updateDive(userId: string, id: string, input: NewDiveInput): Promise<Dive> {
  const payload: Record<string, unknown> = { ...input };
  let { data, error } = await supabase
    .from("dives")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  for (let col = missingColumn(error); error && col && col in payload; col = missingColumn(error)) {
    delete payload[col];
    ({ data, error } = await supabase
      .from("dives")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single());
  }
  if (error) throw error;
  await recomputePersonalBest(userId, input.discipline);
  return data as Dive;
}

/**
 * Flip a single dive's community opt-in (owner enforced by RLS) — used by the
 * dive-detail share toggle without resending the whole record. A missing
 * column means the migration hasn't been applied; surface that actionably.
 */
export async function setDiveShared(id: string, shared: boolean): Promise<void> {
  const { error } = await supabase.from("dives").update({ shared_to_feed: shared }).eq("id", id);
  if (error) {
    if (missingColumn(error) === "shared_to_feed") {
      throw new Error(
        "dives.shared_to_feed is missing — apply " +
          "supabase/migrations/20260721_apnos_feed.sql in the Supabase SQL editor.",
      );
    }
    throw error;
  }
}

export async function deleteDive(
  id: string,
  userId?: string,
  discipline?: DisciplineCode,
): Promise<void> {
  const { error } = await supabase.from("dives").delete().eq("id", id);
  if (error) throw error;
  if (userId && discipline) await recomputePersonalBest(userId, discipline);
}

export function unitLabel(discipline: DisciplineCode): string {
  return DISCIPLINE_MAP[discipline]?.unit === "time" ? "seconds" : "meters";
}

/** Build a CSV string from a list of dives. */
export function divesToCsv(dives: Dive[]): string {
  const headers = [
    "date",
    "time",
    "discipline",
    "result",
    "formatted",
    "session_type",
    "federation",
    "sleep_hours",
    "mental_state",
    "personal_best",
    "food_notes",
    "notes",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = dives.map((d) =>
    [
      d.dive_date,
      d.dive_time ?? "",
      d.discipline,
      d.result,
      formatResult(d.discipline, d.result),
      d.session_type,
      d.federation ?? "",
      d.sleep_hours ?? "",
      d.mental_state ?? "",
      d.is_personal_best ? "yes" : "no",
      d.food_notes ?? "",
      d.notes ?? "",
    ]
      .map(escape)
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
