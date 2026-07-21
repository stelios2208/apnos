import { supabase } from "@/integrations/supabase/client";
import { DISCIPLINE_MAP, type DisciplineCode, type Federation } from "./diving";

// ── types ────────────────────────────────────────────────────────────────────

export interface CompResult {
  id: string;
  user_id: string;
  athlete_name: string;
  gender: string;
  discipline: DisciplineCode;
  federation: Federation;
  result: number;
  competition_name: string;
  location: string;
  country: string;
  competition_date: string | null;
  is_national_record: boolean;
  is_public: boolean;
  created_at: string;
}

export type NewCompResult = Omit<CompResult, "id" | "user_id" | "created_at">;

export interface RankingEntry {
  user_id: string;
  athlete_name: string;
  best: number;
  federation: Federation;
  competition_name: string;
  location: string;
  competition_date: string | null;
  is_national_record: boolean;
}

// Distinguishes "table not created yet" from real failures so the UI can show
// a friendly setup message instead of a crash.
export class MissingTableError extends Error {}

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === "42P01" ||
    /relation .*competition_results.* does not exist/i.test(err.message ?? "")
  );
}

// ── group helper (Pool vs Depth = πισίνα vs θάλασσα) ─────────────────────────

export function disciplineGroup(code: DisciplineCode): "Pool" | "Depth" {
  return DISCIPLINE_MAP[code]?.group ?? "Pool";
}

// ── CRUD (own results) ───────────────────────────────────────────────────────

export async function fetchMyResults(userId: string): Promise<CompResult[]> {
  const { data, error } = await supabase
    .from("competition_results")
    .select("*")
    .eq("user_id", userId)
    .order("competition_date", { ascending: false, nullsFirst: false });
  if (error) {
    if (isMissingTable(error)) throw new MissingTableError();
    throw error;
  }
  return (data ?? []) as CompResult[];
}

export async function createResult(userId: string, input: NewCompResult): Promise<void> {
  const { error } = await supabase
    .from("competition_results")
    .insert({ user_id: userId, ...input });
  if (error) {
    if (isMissingTable(error)) throw new MissingTableError();
    throw error;
  }
}

export async function updateResult(id: string, input: NewCompResult): Promise<void> {
  const { error } = await supabase.from("competition_results").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteResult(id: string): Promise<void> {
  const { error } = await supabase.from("competition_results").delete().eq("id", id);
  if (error) throw error;
}

// ── public athlete page ──────────────────────────────────────────────────────

/**
 * One athlete's PUBLIC competition results, newest first — the freediving
 * section of the shared /athlete/$id page. Reads only `is_public = true` rows
 * (competition_results' existing cross-user read surface, public by design).
 * Missing table degrades to an empty list instead of crashing.
 */
export async function fetchPublicResultsByUser(userId: string): Promise<CompResult[]> {
  const { data, error } = await supabase
    .from("competition_results")
    .select("*")
    .eq("user_id", userId)
    .eq("is_public", true)
    .order("competition_date", { ascending: false, nullsFirst: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as CompResult[];
}

// ── rankings (best public result per athlete) ────────────────────────────────

export async function fetchRanking(
  discipline: DisciplineCode,
  federation: Federation | "all",
): Promise<RankingEntry[]> {
  let q = supabase
    .from("competition_results")
    .select("*")
    .eq("discipline", discipline)
    .eq("is_public", true);
  if (federation !== "all") q = q.eq("federation", federation);

  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error)) throw new MissingTableError();
    throw error;
  }

  // best result per athlete (higher is better for both time & distance)
  const bestByUser = new Map<string, RankingEntry>();
  for (const r of (data ?? []) as CompResult[]) {
    const prev = bestByUser.get(r.user_id);
    if (!prev || r.result > prev.best) {
      bestByUser.set(r.user_id, {
        user_id: r.user_id,
        athlete_name: r.athlete_name || (prev?.athlete_name ?? ""),
        best: r.result,
        federation: r.federation,
        competition_name: r.competition_name,
        location: r.location,
        competition_date: r.competition_date,
        is_national_record: r.is_national_record,
      });
    }
  }
  return [...bestByUser.values()].sort((a, b) => b.best - a.best);
}
