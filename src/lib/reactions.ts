import { supabase } from "@/integrations/supabase/client";

// ── Feed reactions (shared likes) ────────────────────────────────────────────
//
// Server-backed likes over any feed target (post / dive / catch / story), so we
// can show a count and WHO liked it. Table:
// supabase/migrations/20260724_feed_reactions.sql. Degrades gracefully when the
// table is missing (reads → empty; toggle → actionable error).

export type ReactionTarget = "post" | "dive" | "catch" | "story";

export interface Liker {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface LikeInfo {
  count: number;
  likedByMe: boolean;
  /** Up to a handful of PUBLIC likers, for the little avatars. */
  likers: Liker[];
}

const MIGRATION_HINT =
  "feed_reactions table is missing — apply " +
  "supabase/migrations/20260724_feed_reactions.sql in the Supabase SQL editor.";

type PgErrorLike = { code?: string; message?: string } | null;
function isMissingTable(err: PgErrorLike): boolean {
  return !!err && (err.code === "PGRST205" || err.code === "42P01");
}

/** Count + whether I liked + a few public liker profiles for one target. */
export async function listLikes(
  targetType: ReactionTarget,
  targetId: string,
  myId?: string,
): Promise<LikeInfo> {
  const { data, error } = await supabase
    .from("feed_reactions")
    .select("user_id")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("kind", "heart");
  if (error) {
    if (isMissingTable(error)) return { count: 0, likedByMe: false, likers: [] };
    throw error;
  }
  const ids = (data ?? []).map((r) => r.user_id as string);
  const count = ids.length;
  const likedByMe = !!myId && ids.includes(myId);

  let likers: Liker[] = [];
  if (ids.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", ids.slice(0, 12))
      .eq("is_public", true);
    likers = (profs ?? []) as Liker[];
  }
  return { count, likedByMe, likers };
}

/** The full list of PUBLIC people who liked a target (for the "liked by" sheet). */
export async function listLikers(targetType: ReactionTarget, targetId: string): Promise<Liker[]> {
  const { data, error } = await supabase
    .from("feed_reactions")
    .select("user_id")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("kind", "heart");
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  const ids = Array.from(new Set((data ?? []).map((r) => r.user_id as string)));
  if (ids.length === 0) return [];
  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", ids)
    .eq("is_public", true);
  return (profs ?? []) as Liker[];
}

/** Add or remove my like on a target (owner enforced by RLS). */
export async function toggleLike(
  targetType: ReactionTarget,
  targetId: string,
  on: boolean,
): Promise<void> {
  if (on) {
    const { error } = await supabase
      .from("feed_reactions")
      .insert({ target_type: targetType, target_id: targetId, kind: "heart" });
    // ignore duplicate (already liked); surface a missing-table hint
    if (error && !/duplicate key|23505/.test(error.message ?? "")) {
      if (isMissingTable(error)) throw new Error(MIGRATION_HINT);
      throw error;
    }
  } else {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const { error } = await supabase
      .from("feed_reactions")
      .delete()
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .eq("user_id", uid)
      .eq("kind", "heart");
    if (error) {
      if (isMissingTable(error)) throw new Error(MIGRATION_HINT);
      throw error;
    }
  }
}
