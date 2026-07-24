import { supabase } from "@/integrations/supabase/client";
import type { ReactionTarget } from "@/lib/reactions";

// ── Feed comments ─────────────────────────────────────────────────────────────
//
// Comments over any feed target (post / dive / catch / story). Table:
// supabase/migrations/20260724_feed_comments.sql. Degrades gracefully when the
// table is missing (reads → empty; posting → an actionable error).

export interface FeedComment {
  id: string;
  target_type: ReactionTarget;
  target_id: string;
  user_id: string;
  body: string;
  created_at: string;
  // joined from profiles (public only)
  display_name: string | null;
  avatar_url: string | null;
}

const MIGRATION_HINT =
  "feed_comments table is missing — apply " +
  "supabase/migrations/20260724_feed_comments.sql in the Supabase SQL editor.";

type PgErrorLike = { code?: string; message?: string } | null;
function isMissingTable(err: PgErrorLike): boolean {
  return !!err && (err.code === "PGRST205" || err.code === "42P01");
}

/** All comments on a target, oldest → newest, with the author's public profile. */
export async function listComments(
  targetType: ReactionTarget,
  targetId: string,
): Promise<FeedComment[]> {
  const { data, error } = await supabase
    .from("feed_comments")
    .select("id, target_type, target_id, user_id, body, created_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Attach author profiles (public only — privacy-safe).
  const ids = Array.from(new Set(rows.map((r) => r.user_id as string)));
  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", ids)
    .eq("is_public", true);
  const byId = new Map(
    (profs ?? []).map((p) => [
      p.user_id as string,
      p as { display_name: string | null; avatar_url: string | null },
    ]),
  );
  return rows.map((r) => ({
    ...(r as Omit<FeedComment, "display_name" | "avatar_url">),
    display_name: byId.get(r.user_id as string)?.display_name ?? null,
    avatar_url: byId.get(r.user_id as string)?.avatar_url ?? null,
  }));
}

/** Just the count — cheap, for the icon badge. */
export async function countComments(targetType: ReactionTarget, targetId: string): Promise<number> {
  const { count, error } = await supabase
    .from("feed_comments")
    .select("id", { count: "exact", head: true })
    .eq("target_type", targetType)
    .eq("target_id", targetId);
  if (error) {
    if (isMissingTable(error)) return 0;
    throw error;
  }
  return count ?? 0;
}

/** Post a comment as the current user. */
export async function addComment(
  targetType: ReactionTarget,
  targetId: string,
  body: string,
): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;
  const { error } = await supabase
    .from("feed_comments")
    .insert({ target_type: targetType, target_id: targetId, body: trimmed });
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_HINT);
    throw error;
  }
}

/** Delete one of my own comments (RLS enforces ownership). */
export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from("feed_comments").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_HINT);
    throw error;
  }
}
