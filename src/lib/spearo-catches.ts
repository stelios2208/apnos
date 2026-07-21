import { supabase } from "@/integrations/supabase/client";
import type { SpearoCatch } from "@/lib/spearo";

// ── Spearfishing catch persistence (Apnos Spearo) ────────────────────────────
//
// Thin data layer over the `spearo_catches` table, mirroring `dives.ts`:
// Supabase is the only backend, per-user RLS is the SOLE authorization layer,
// and every write degrades gracefully so the code can ship before the migration
// (supabase/migrations/20260720_spearo_catches.sql) is applied by hand.
//
// SPOT SECRECY: rows here carry private `spot` coordinates. This file only ever
// reads/writes the owner's own RLS-scoped rows — there is deliberately NO
// public/cross-user fetch. Do not add one; a community/feed feature must serve a
// separate payload that omits `spot` (see the migration's security note).

/**
 * Fields a caller may set when creating/updating a catch.
 *
 * Server-owned columns (`id`, `user_id`, `created_at`) are excluded — `user_id`
 * is filled in by the table's `default auth.uid()`, matching the RLS insert
 * check, so callers never pass it.
 */
export type NewSpearoCatchInput = Omit<SpearoCatch, "id" | "user_id" | "created_at">;

// ── graceful degradation ─────────────────────────────────────────────────────
// The deployed DB may lag behind the code. Two failure modes, same handling as
// the rest of the app:
//
//   1. The whole table is missing (migration not applied): PostgREST reports
//      PGRST205 / 42P01. Reads degrade to an empty list; writes surface a clear,
//      actionable error naming the migration file.
//   2. A single column is missing (partial migration): PostgREST reports
//      PGRST204 with a message like "Could not find the 'gear' column of
//      'spearo_catches' in the schema cache". We strip that field and retry —
//      the same drop-and-retry pattern as `dives.ts`, generalised because this
//      table introduces several new columns (conditions, gear, spot, photo_url…)
//      at once instead of just one.

type PgErrorLike = { code?: string; message?: string } | null;

/** True when the error means the `spearo_catches` relation itself is absent. */
function isMissingTable(err: PgErrorLike): boolean {
  if (!err) return false;
  return (
    err.code === "PGRST205" || err.code === "42P01" || /spearo_catches/i.test(err.message ?? "")
  );
}

/**
 * If the error is a PGRST204 "unknown column" error, return the offending column
 * name so the caller can drop it and retry; otherwise return `null`.
 */
function missingColumn(err: PgErrorLike): string | null {
  if (!err || err.code !== "PGRST204") return null;
  const m = /'([^']+)' column/.exec(err.message ?? "");
  return m ? m[1] : null;
}

interface WriteResult {
  data: unknown;
  error: PgErrorLike;
}

/**
 * Run an insert/update with the drop-and-retry degradation described above.
 *
 * `run` is invoked with the (possibly reduced) payload; on a PGRST204 for a
 * column present in the payload, that column is stripped and `run` is called
 * again. The loop is bounded by the payload size (each retry removes exactly one
 * column). A missing table throws a clear error; any other error propagates.
 */
async function writeWithDegradation(
  payload: Record<string, unknown>,
  run: (payload: Record<string, unknown>) => PromiseLike<WriteResult>,
): Promise<SpearoCatch> {
  const current: Record<string, unknown> = { ...payload };
  // At most one column is dropped per iteration, so the payload size + 1 is a
  // safe upper bound on the number of attempts.
  for (let attempt = 0; attempt <= Object.keys(payload).length; attempt++) {
    const { data, error } = await run(current);
    if (!error) return data as SpearoCatch;
    if (isMissingTable(error)) {
      throw new Error(
        "spearo_catches table is missing — apply " +
          "supabase/migrations/20260720_spearo_catches.sql in the Supabase SQL editor.",
      );
    }
    const col = missingColumn(error);
    if (col && col in current) {
      delete current[col];
      continue;
    }
    throw error;
  }
  // Reached only if every column was stripped and the write still failed.
  throw new Error("spearo_catches write failed after dropping all unknown columns.");
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/** The owner's catches, most recent first (rows with no `caught_at` sort last). */
export async function listCatches(userId: string): Promise<SpearoCatch[]> {
  const { data, error } = await supabase
    .from("spearo_catches")
    .select("*")
    .eq("user_id", userId)
    .order("caught_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    // Table not migrated yet → behave as an empty log rather than crashing.
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as SpearoCatch[];
}

/** Insert a catch for the current user (user_id defaults to auth.uid()). */
export async function createCatch(input: NewSpearoCatchInput): Promise<SpearoCatch> {
  const payload: Record<string, unknown> = {
    ...input,
    is_personal_best: input.is_personal_best ?? false,
  };
  return writeWithDegradation(payload, (p) =>
    supabase.from("spearo_catches").insert(p).select("*").single(),
  );
}

/** Update an existing catch by id (owner enforced by RLS). */
export async function updateCatch(
  id: string,
  patch: Partial<NewSpearoCatchInput>,
): Promise<SpearoCatch> {
  const payload: Record<string, unknown> = { ...patch };
  return writeWithDegradation(payload, (p) =>
    supabase.from("spearo_catches").update(p).eq("id", id).select("*").single(),
  );
}

/** Delete a catch by id (owner enforced by RLS). */
export async function deleteCatch(id: string): Promise<void> {
  const { error } = await supabase.from("spearo_catches").delete().eq("id", id);
  if (error) throw error;
}

// ── personal bests (pure, client-side) ───────────────────────────────────────

/**
 * Best catch per species — the spearfishing analogue of `personalBests()` in
 * `dives.ts`. Pure: no DB call.
 *
 * Grouped by `species_code` (falling back to `species_custom`); catches with
 * neither are skipped. The "best" is the largest `size_cm`, tie-broken by the
 * larger `weight_kg`. Missing measurements are treated as 0.
 */
export function personalBestsSpearo(catches: SpearoCatch[]): Record<string, SpearoCatch> {
  const best: Record<string, SpearoCatch> = {};
  for (const c of catches) {
    const key = c.species_code ?? c.species_custom;
    if (!key) continue;
    const current = best[key];
    if (!current) {
      best[key] = c;
      continue;
    }
    const size = c.size_cm ?? 0;
    const curSize = current.size_cm ?? 0;
    const better =
      size > curSize || (size === curSize && (c.weight_kg ?? 0) > (current.weight_kg ?? 0));
    if (better) best[key] = c;
  }
  return best;
}

/**
 * One personal-best row per species, ready for a "records" list.
 *
 * `species` is the grouping key — a `species_code` (resolve display names via
 * `speciesLabel()`), or the raw `species_custom` text when the catch isn't in
 * the reference set (`isCustomSpecies` tells the two apart).
 */
export interface SpeciesPersonalBest {
  species: string;
  isCustomSpecies: boolean;
  weight?: number; // kg — undefined when the record catch has no weight
  size?: number; // cm — undefined when the record catch has no size
  date: string; // ISO `caught_at` of the record catch
  photoUrl?: string;
  /** The full record catch, for anything the summary fields don't cover. */
  record: SpearoCatch;
}

/**
 * Weight-first personal bests per species — the "records" view's counterpart
 * to `personalBestsSpearo()` (which is size-first for the dashboard). Pure:
 * no DB call; feed it the already-fetched `["spearo-catches", userId]` data.
 *
 * Grouping matches `personalBestsSpearo`: by `species_code`, falling back to
 * `species_custom`; catches with neither are skipped. Within a species, the
 * record is the catch with the largest `weight_kg`; if NO catch of that
 * species has a weight, it falls back to the largest `size_cm`. Species where
 * every catch lacks both measurements are dropped rather than shown empty.
 *
 * Returned sorted by weight desc (weightless fallback rows last, by size
 * desc), so the heaviest record leads the list.
 */
export function personalBestsBySpecies(catches: SpearoCatch[]): SpeciesPersonalBest[] {
  // Pick each species' record: any weighted catch beats every weightless one;
  // among weighted catches the heavier wins; among weightless, the longer wins.
  const best: Record<string, SpearoCatch> = {};
  for (const c of catches) {
    const key = c.species_code ?? c.species_custom;
    if (!key) continue;
    if (c.weight_kg == null && c.size_cm == null) continue; // nothing to rank by
    const current = best[key];
    if (!current) {
      best[key] = c;
      continue;
    }
    let better: boolean;
    if (c.weight_kg != null || current.weight_kg != null) {
      better = (c.weight_kg ?? 0) > (current.weight_kg ?? 0);
    } else {
      better = (c.size_cm ?? 0) > (current.size_cm ?? 0);
    }
    if (better) best[key] = c;
  }

  return Object.entries(best)
    .map(
      ([species, record]): SpeciesPersonalBest => ({
        species,
        isCustomSpecies: record.species_code == null,
        weight: record.weight_kg,
        size: record.size_cm,
        date: record.caught_at,
        photoUrl: record.photo_url,
        record,
      }),
    )
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || (b.size ?? 0) - (a.size ?? 0));
}
