import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { DisciplineCode, Federation } from "./diving";

// ── Verified rankings data layer ─────────────────────────────────────────────
// Two tables (see supabase/migrations/20260712_verified_rankings.sql):
//   • competitions  — admin-curated official events (public read)
//   • performances  — athlete-declared results; status is set by a DB trigger
//     (self_reported / pending) and only an admin may verify/reject.
// Proof photos live in the public `performance-proofs` bucket, owner-scoped.

export type PerformanceStatus = "self_reported" | "pending" | "verified" | "rejected";

export interface Competition {
  id: string;
  name: string;
  location: string;
  country_code: string;
  federation: Federation;
  date: string | null;
  created_at: string;
}

export interface Performance {
  id: string;
  user_id: string;
  discipline: DisciplineCode;
  value: number; // seconds for STA, metres for the rest
  competition_id: string | null;
  proof_photo_url: string | null;
  status: PerformanceStatus;
  is_public: boolean;
  // athlete identity, denormalised from the profile at declare time (profiles
  // live in auth user_metadata and can't be joined across users)
  athlete_name?: string;
  country_code?: string;
  avatar_url?: string | null;
  created_at: string;
}

export interface NewPerformanceInput {
  discipline: DisciplineCode;
  value: number;
  competition_id: string | null;
  proof_photo_url: string | null;
  is_public: boolean;
  athlete_name?: string;
  country_code?: string;
  avatar_url?: string | null;
}

export interface NewCompetitionInput {
  name: string;
  location: string;
  country_code: string;
  federation: Federation;
  date: string | null;
}

const PROOFS_BUCKET = "performance-proofs";

// The admin flag lives in the user's app_metadata (set server-side, surfaced in
// the JWT). Reflects the token at login time — a freshly-promoted admin must
// sign out/in before this returns true.
export function isAdminUser(user: User | null): boolean {
  return user?.app_metadata?.is_admin === true;
}

// "Table not created yet" vs a real error, so reads can degrade to empty.
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    /(competitions|performances).* does not exist/i.test(err.message ?? "")
  );
}

// ── competitions ─────────────────────────────────────────────────────────────

export async function fetchCompetitions(): Promise<Competition[]> {
  const { data, error } = await supabase
    .from("competitions")
    .select("*")
    .order("date", { ascending: false, nullsFirst: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as Competition[];
}

// ── competitions: admin CRUD ─────────────────────────────────────────────────

export async function createCompetition(input: NewCompetitionInput): Promise<void> {
  const { error } = await supabase.from("competitions").insert(input);
  if (error) throw error;
}

export async function deleteCompetition(id: string): Promise<void> {
  const { error } = await supabase.from("competitions").delete().eq("id", id);
  if (error) throw error;
}

// ── performances: athlete ────────────────────────────────────────────────────

export async function fetchMyPerformances(userId: string): Promise<Performance[]> {
  const { data, error } = await supabase
    .from("performances")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as Performance[];
}

/** Public performances for a discipline, best value per athlete (higher = better
 *  for both time & distance), verified first then self-reported. */
export async function fetchLeaderboard(discipline: DisciplineCode): Promise<Performance[]> {
  const { data, error } = await supabase
    .from("performances")
    .select("*")
    .eq("discipline", discipline)
    .eq("is_public", true)
    .in("status", ["verified", "self_reported"])
    .order("value", { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  const rows = (data ?? []) as Performance[];
  const bestByUser = new Map<string, Performance>();
  for (const p of rows) {
    const prev = bestByUser.get(p.user_id);
    // keep the athlete's single best; prefer a verified row on ties/among equals
    if (
      !prev ||
      p.value > prev.value ||
      (p.value === prev.value && p.status === "verified" && prev.status !== "verified")
    ) {
      bestByUser.set(p.user_id, p);
    }
  }
  return [...bestByUser.values()].sort((a, b) => b.value - a.value);
}

/**
 * One athlete's PUBLIC results for the shared /athlete/$id profile — the
 * canonical source for the profile's "records per discipline" now that the
 * profile reads the verified `performances` system (not the legacy
 * competition_results table). Only rows the athlete chose to make public and
 * that are visible on the leaderboard (verified or self-reported) are returned;
 * pending and rejected declarations stay off the public profile. Missing table
 * degrades to an empty list instead of crashing.
 */
export async function fetchPublicPerformancesByUser(userId: string): Promise<Performance[]> {
  const { data, error } = await supabase
    .from("performances")
    .select("*")
    .eq("user_id", userId)
    .eq("is_public", true)
    .in("status", ["verified", "self_reported"])
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as Performance[];
}

/** Upload a proof photo to the owner-scoped folder; returns its public URL. */
export async function uploadProof(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(PROOFS_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return supabase.storage.from(PROOFS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function createPerformance(userId: string, input: NewPerformanceInput): Promise<void> {
  // status is intentionally omitted — the DB trigger derives it.
  const { error } = await supabase.from("performances").insert({ user_id: userId, ...input });
  if (error) {
    // athlete-info columns may not be migrated yet (PGRST204 = unknown column):
    // drop them and retry so declaring keeps working.
    if (error.code === "PGRST204") {
      const { athlete_name: _n, country_code: _c, avatar_url: _a, ...bare } = input;
      const retry = await supabase.from("performances").insert({ user_id: userId, ...bare });
      if (retry.error) throw retry.error;
      return;
    }
    throw error;
  }
}

export async function deletePerformance(id: string): Promise<void> {
  const { error } = await supabase.from("performances").delete().eq("id", id);
  if (error) throw error;
}

/** Toggle public/private on an own performance (status is preserved by the
 *  trigger when only is_public changes). */
export async function setPerformancePublic(id: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase
    .from("performances")
    .update({ is_public: isPublic })
    .eq("id", id);
  if (error) throw error;
}

// ── performances: admin ──────────────────────────────────────────────────────

export async function fetchPendingPerformances(): Promise<Performance[]> {
  const { data, error } = await supabase
    .from("performances")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as Performance[];
}

/** Admin verify/reject. Allowed by RLS + the status trigger only for admins. */
export async function reviewPerformance(
  id: string,
  decision: "verified" | "rejected",
): Promise<void> {
  const { error } = await supabase.from("performances").update({ status: decision }).eq("id", id);
  if (error) throw error;
}
