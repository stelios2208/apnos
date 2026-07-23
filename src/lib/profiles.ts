import { supabase } from "@/integrations/supabase/client";
import { fetchProfile } from "@/lib/profile";
import { reencodeToJpeg } from "@/lib/spearo-photos";

// ── Social profiles (Apnos Spearo community) ─────────────────────────────────
//
// Thin data layer over the dedicated `profiles` table
// (supabase/migrations/20260721_social_foundation.sql), mirroring the shape of
// `spearo-catches.ts`: Supabase is the only backend, per-user RLS is the sole
// authorization layer, and everything degrades gracefully so the code can ship
// before the migration is applied by hand.
//
// Relationship to `profile.ts` (freediving athlete profile in user_metadata):
// that file stays the source of truth for the freediving side and is NOT
// replaced. Social features read ONLY this table; the profile screen dual-writes
// to both. `getMyProfile` falls back to user_metadata so the edit screen is
// pre-filled even before the table exists / has a row.
//
// SPOT SECRECY: nothing in this module touches catches. Avatars are re-encoded
// client-side (reusing the catch-photo canvas pipeline) before upload, so no
// EXIF/GPS metadata from the original photo ever reaches the public bucket.

/** A row in the `profiles` table. `is_public` defaults to false (opt-in). */
export interface SocialProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country: string | null;
  is_public: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Fields a caller may set when upserting their own profile. */
export type SocialProfileInput = Partial<
  Pick<SocialProfile, "display_name" | "avatar_url" | "bio" | "country" | "is_public">
>;

const BUCKET = "avatars";
const MIGRATION_HINT =
  "profiles table is missing — apply " +
  "supabase/migrations/20260721_social_foundation.sql in the Supabase SQL editor.";

// ── graceful degradation ─────────────────────────────────────────────────────
// Same two failure modes as spearo-catches.ts: the whole table missing
// (PGRST205 / 42P01 → reads return empty, writes throw an actionable error
// naming the migration) or a single column missing (PGRST204 → drop the field
// and retry).

type PgErrorLike = { code?: string; message?: string } | null;

/** True when the error means the `profiles` relation itself is absent. */
function isMissingTable(err: PgErrorLike): boolean {
  if (!err) return false;
  return err.code === "PGRST205" || err.code === "42P01";
}

/**
 * If the error is a PGRST204 "unknown column" error, return the offending
 * column name so the caller can drop it and retry; otherwise return `null`.
 */
function missingColumn(err: PgErrorLike): string | null {
  if (!err || err.code !== "PGRST204") return null;
  const m = /'([^']+)' column/.exec(err.message ?? "");
  return m ? m[1] : null;
}

// ── my profile ───────────────────────────────────────────────────────────────

/**
 * Build a `SocialProfile` from the freediving user_metadata profile, for use
 * when the `profiles` table has no row (or doesn't exist yet). `is_public` is
 * forced to false: opting into the social layer only counts once it is actually
 * persisted in the table the other users read from.
 */
async function profileFromMetadata(userId: string): Promise<SocialProfile> {
  const meta = await fetchProfile();
  return {
    user_id: userId,
    display_name: meta.displayName || null,
    avatar_url: meta.avatarUrl || null,
    bio: meta.bio || null,
    country: meta.country || null,
    is_public: false,
  };
}

/**
 * The current user's own profile row, falling back to their user_metadata
 * profile when the table is missing or has no row yet (so the edit screen is
 * pre-filled either way). Never returns null and never crashes on a lagging DB.
 */
export async function getMyProfile(userId: string): Promise<SocialProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return profileFromMetadata(userId);
    throw error;
  }
  if (!data) return profileFromMetadata(userId);
  return data as SocialProfile;
}

/**
 * Insert-or-update the current user's profile row (owner enforced by RLS;
 * `user_id` is the primary key, so `upsert` targets it directly).
 *
 * Uses the PGRST204 drop-and-retry pattern for individual missing columns; a
 * missing table throws an actionable error naming the migration file, which
 * callers doing a metadata + table dual-write should catch so the metadata
 * write (the freediving source of truth) still succeeds on a lagging DB.
 */
export async function upsertMyProfile(
  userId: string,
  input: SocialProfileInput,
): Promise<SocialProfile> {
  const payload: Record<string, unknown> = {
    ...input,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  // At most one column is dropped per iteration (see spearo-catches.ts).
  for (let attempt = 0; attempt <= Object.keys(payload).length; attempt++) {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();
    if (!error) return data as SocialProfile;
    if (isMissingTable(error)) throw new Error(MIGRATION_HINT);
    const col = missingColumn(error);
    if (col && col in payload && col !== "user_id") {
      delete payload[col];
      continue;
    }
    throw error;
  }
  throw new Error("profiles upsert failed after dropping all unknown columns.");
}

// ── public profiles ──────────────────────────────────────────────────────────

/**
 * Public (opted-in) profiles, newest first — the community avatar row.
 * RLS already restricts the result to `is_public = true` rows plus the caller's
 * own; the explicit filter keeps the caller's private row out of the list too.
 * Missing table → empty list, not a crash.
 */
export async function listPublicProfiles(limit = 50): Promise<SocialProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as SocialProfile[];
}

/**
 * A single user's public profile, or `null` when it doesn't exist, isn't
 * public (RLS filters it out), or the table is missing — callers show the
 * friendly "private profile" state for null.
 */
export async function getPublicProfile(userId: string): Promise<SocialProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("is_public", true)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
  return (data as SocialProfile) ?? null;
}

// ── avatar upload ────────────────────────────────────────────────────────────

// Avatars render small; a 512px longest edge keeps uploads tiny and sharp.
const AVATAR_MAX_EDGE = 512;

/**
 * Upload the current user's avatar and return its public URL (cache-busted so a
 * re-upload shows immediately).
 *
 * Reuses the catch-photo canvas pipeline (`reencodeToJpeg`), so the stored
 * image is a fresh JPEG with NO EXIF/GPS metadata from the original file, then
 * uploads to `avatars` at the fixed per-uid path the bucket's owner-only RLS
 * policies key on.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const jpeg = await reencodeToJpeg(file, AVATAR_MAX_EDGE);
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, jpeg, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) {
    if (/bucket|not found/i.test(error.message ?? "")) {
      throw new Error(
        "avatars storage bucket is missing — apply " +
          "supabase/migrations/20260721_social_foundation.sql in the Supabase SQL editor.",
      );
    }
    throw error;
  }
  const base = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return `${base}?v=${Date.now()}`;
}

// ── feed (safe view over shared catches) ─────────────────────────────────────

/**
 * A row of the `feed_catches` view — the ONLY cross-user surface over catches.
 * By construction it has no `spot` and no `notes`; do not widen this type
 * without widening the view's security review first.
 */
export interface FeedCatch {
  id: string;
  user_id: string;
  species_code: string | null;
  species_custom: string | null;
  weight_kg: number | null;
  size_cm: number | null;
  max_depth_m: number | null;
  photo_url: string | null;
  caught_at: string | null;
  created_at: string;
}

/**
 * Shared catches, newest first. Optionally scoped to one user (public athlete
 * page). Missing view (migration not applied) → empty feed, not a crash.
 */
export async function listFeedCatches(opts?: {
  userId?: string;
  limit?: number;
}): Promise<FeedCatch[]> {
  let query = supabase
    .from("feed_catches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 30);
  if (opts?.userId) query = query.eq("user_id", opts.userId);
  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as FeedCatch[];
}

/**
 * A row of the `feed_dives` view — the ONLY cross-user surface over dives
 * (see supabase/migrations/20260721_apnos_feed.sql). By construction it has no
 * notes, no wellness fields, no gear/conditions; do not widen this type
 * without widening the view's security review first.
 */
export interface FeedDive {
  id: string;
  user_id: string;
  discipline: string;
  result: number;
  dive_date: string;
  is_personal_best: boolean;
  photo_url?: string | null;
  created_at: string;
}

/**
 * Shared dives, newest first. Optionally scoped to one user (public athlete
 * page). Missing view (migration not applied) → empty feed, not a crash.
 */
export async function listFeedDives(opts?: {
  userId?: string;
  limit?: number;
}): Promise<FeedDive[]> {
  let query = supabase
    .from("feed_dives")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 30);
  if (opts?.userId) query = query.eq("user_id", opts.userId);
  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as FeedDive[];
}
