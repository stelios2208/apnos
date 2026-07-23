import { supabase } from "@/integrations/supabase/client";

// ── Community posts (Apnos) ──────────────────────────────────────────────────
//
// Thin data layer over the `community_posts` table
// (supabase/migrations/20260723_community_posts.sql). These are the free-form,
// Facebook-style posts — a title + body + optional photo, NOT tied to a catch
// or a dive. Same conventions as the rest of the app: Supabase is the only
// backend, per-user RLS is the sole authorization layer, and everything
// degrades gracefully so the UI can ship before the migration is applied.
//
// Photos reuse the generic `catch-photos` bucket via uploadCatchPhoto (the
// image is re-encoded through a canvas first, stripping all EXIF/GPS) — there
// is nothing catch-specific about that upload path.

/** A row in the `community_posts` table. `is_public` defaults to true. */
export interface CommunityPost {
  id: string;
  user_id: string;
  title: string | null;
  body: string | null;
  photo_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at?: string;
}

/** Fields a caller may set when creating a post. */
export interface NewCommunityPostInput {
  title?: string | null;
  body?: string | null;
  photo_url?: string | null;
  is_public?: boolean;
}

const MIGRATION_HINT =
  "community_posts table is missing — apply " +
  "supabase/migrations/20260723_community_posts.sql in the Supabase SQL editor.";

// ── graceful degradation (same shape as profiles.ts) ─────────────────────────

type PgErrorLike = { code?: string; message?: string } | null;

function isMissingTable(err: PgErrorLike): boolean {
  if (!err) return false;
  return err.code === "PGRST205" || err.code === "42P01";
}

function missingColumn(err: PgErrorLike): string | null {
  if (!err || err.code !== "PGRST204") return null;
  const m = /'([^']+)' column/.exec(err.message ?? "");
  return m ? m[1] : null;
}

/**
 * Community posts, newest first. Optionally scoped to one user (their profile).
 * RLS already restricts rows to public posts plus the caller's own. Missing
 * table (migration not applied) → empty list, not a crash.
 */
export async function listFeedPosts(opts?: {
  userId?: string;
  limit?: number;
}): Promise<CommunityPost[]> {
  let query = supabase
    .from("community_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 30);
  if (opts?.userId) query = query.eq("user_id", opts.userId);
  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as CommunityPost[];
}

/**
 * Create a post (owner enforced by RLS; `user_id` defaults to auth.uid() on the
 * table). Uses the PGRST204 drop-and-retry pattern for individual missing
 * columns; a missing table throws an actionable error naming the migration.
 */
export async function createPost(input: NewCommunityPostInput): Promise<CommunityPost> {
  const payload: Record<string, unknown> = { ...input };
  for (let attempt = 0; attempt <= Object.keys(payload).length; attempt++) {
    const { data, error } = await supabase
      .from("community_posts")
      .insert(payload)
      .select("*")
      .single();
    if (!error) return data as CommunityPost;
    if (isMissingTable(error)) throw new Error(MIGRATION_HINT);
    const col = missingColumn(error);
    if (col && col in payload) {
      delete payload[col];
      continue;
    }
    throw error;
  }
  throw new Error("community_posts insert failed after dropping all unknown columns.");
}

/**
 * Update a post's editable fields (owner enforced by RLS). Uses the PGRST204
 * drop-and-retry pattern for individual missing columns.
 */
export async function updatePost(
  id: string,
  patch: Partial<Pick<CommunityPost, "title" | "body" | "photo_url">>,
): Promise<CommunityPost> {
  const payload: Record<string, unknown> = { ...patch };
  for (let attempt = 0; attempt <= Object.keys(payload).length; attempt++) {
    const { data, error } = await supabase
      .from("community_posts")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (!error) return data as CommunityPost;
    if (isMissingTable(error)) throw new Error(MIGRATION_HINT);
    const col = missingColumn(error);
    if (col && col in payload) {
      delete payload[col];
      continue;
    }
    throw error;
  }
  throw new Error("community_posts update failed after dropping all unknown columns.");
}

/**
 * Delete a post (owner enforced by RLS). Best-effort photo cleanup is the
 * caller's job (it holds the deleteCatchPhoto import), so this only removes the
 * row.
 */
export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from("community_posts").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_HINT);
    throw error;
  }
}
