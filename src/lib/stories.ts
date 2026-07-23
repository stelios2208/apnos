import { supabase } from "@/integrations/supabase/client";

// ── Community stories (Apnos) ────────────────────────────────────────────────
//
// Thin data layer over `community_stories`
// (supabase/migrations/20260723_community_stories.sql). Stories are the tall,
// image-first cards at the top of the feed — they live for 24h. Same
// graceful-degradation conventions as posts.ts.

export interface CommunityStory {
  id: string;
  user_id: string;
  photo_url: string;
  caption: string | null;
  is_public: boolean;
  created_at: string;
}

export interface NewStoryInput {
  photo_url: string;
  caption?: string | null;
}

/** One author's stories, oldest → newest for playback. */
export interface StoryGroup {
  user_id: string;
  stories: CommunityStory[];
}

/**
 * Group a newest-first story list by author (Instagram tray): one entry per
 * author, authors ordered by most-recent activity, each author's stories put
 * back in oldest→newest order so the viewer plays them forward.
 */
export function groupStoriesByAuthor(stories: CommunityStory[]): StoryGroup[] {
  const order: string[] = [];
  const map = new Map<string, CommunityStory[]>();
  for (const s of stories) {
    if (!map.has(s.user_id)) {
      map.set(s.user_id, []);
      order.push(s.user_id);
    }
    map.get(s.user_id)!.push(s);
  }
  return order.map((uid) => ({ user_id: uid, stories: [...map.get(uid)!].reverse() }));
}

const MIGRATION_HINT =
  "community_stories table is missing — apply " +
  "supabase/migrations/20260723_community_stories.sql in the Supabase SQL editor.";

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

/** Active stories (last 24h), newest first. Missing table → empty. */
export async function listStories(limit = 40): Promise<CommunityStory[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("community_stories")
    .select("*")
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as CommunityStory[];
}

/** Create a story (owner enforced by RLS). */
export async function createStory(input: NewStoryInput): Promise<CommunityStory> {
  const payload: Record<string, unknown> = { ...input };
  for (let attempt = 0; attempt <= Object.keys(payload).length; attempt++) {
    const { data, error } = await supabase
      .from("community_stories")
      .insert(payload)
      .select("*")
      .single();
    if (!error) return data as CommunityStory;
    if (isMissingTable(error)) throw new Error(MIGRATION_HINT);
    const col = missingColumn(error);
    if (col && col in payload) {
      delete payload[col];
      continue;
    }
    throw error;
  }
  throw new Error("community_stories insert failed after dropping all unknown columns.");
}

/** Delete a story (owner enforced by RLS). */
export async function deleteStory(id: string): Promise<void> {
  const { error } = await supabase.from("community_stories").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_HINT);
    throw error;
  }
}
