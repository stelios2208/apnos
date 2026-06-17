import { supabase } from "@/integrations/supabase/client";
import type { Dive, DisciplineCode, SessionType } from "./diving";
import { DISCIPLINE_MAP } from "./diving";

export interface NewDiveInput {
  discipline: DisciplineCode;
  result: number;
  dive_date: string;
  dive_time: string | null;
  session_type: SessionType;
  sleep_hours: number | null;
  food_notes: string | null;
  mental_state: number | null;
  notes: string | null;
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

export async function createDive(userId: string, input: NewDiveInput): Promise<Dive> {
  // Determine if this dive is a new personal best for the discipline.
  const { data: prev, error: prevErr } = await supabase
    .from("dives")
    .select("result")
    .eq("user_id", userId)
    .eq("discipline", input.discipline)
    .order("result", { ascending: false })
    .limit(1);
  if (prevErr) throw prevErr;

  const previousBest = prev && prev.length > 0 ? Number(prev[0].result) : null;
  const isPersonalBest = previousBest === null || input.result > previousBest;

  const { data, error } = await supabase
    .from("dives")
    .insert({ ...input, user_id: userId, is_personal_best: isPersonalBest })
    .select("*")
    .single();
  if (error) throw error;

  // If this is the new best, clear the flag on the old record(s).
  if (isPersonalBest) {
    await supabase
      .from("dives")
      .update({ is_personal_best: false })
      .eq("user_id", userId)
      .eq("discipline", input.discipline)
      .neq("id", (data as Dive).id);
  }

  return data as Dive;
}

export async function deleteDive(id: string): Promise<void> {
  const { error } = await supabase.from("dives").delete().eq("id", id);
  if (error) throw error;
}

export function unitLabel(discipline: DisciplineCode): string {
  return DISCIPLINE_MAP[discipline]?.unit === "time" ? "seconds" : "meters";
}
