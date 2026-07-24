import { supabase } from "@/integrations/supabase/client";

// ── Direct messages (profile ↔ profile) ──────────────────────────────────────
//
// General 1:1 messaging over `direct_messages`
// (supabase/migrations/20260724_direct_messages.sql). Any member can message any
// other member (and the coach, who is just a user). Degrades gracefully when
// the table is missing.

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
}

/** One conversation summarised for the inbox. */
export interface Conversation {
  other_id: string;
  last_body: string;
  last_at: string;
  last_from_me: boolean;
}

const MIGRATION_HINT =
  "direct_messages table is missing — apply " +
  "supabase/migrations/20260724_direct_messages.sql in the Supabase SQL editor.";

type PgErrorLike = { code?: string; message?: string } | null;
function isMissingTable(err: PgErrorLike): boolean {
  return !!err && (err.code === "PGRST205" || err.code === "42P01");
}

/** The coach's user id (first admin), for the "Message the coach" shortcut. */
export async function getAdminId(): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_admin_id");
  if (error) return null;
  return (data as string) ?? null;
}

/** All my messages, folded into one row per conversation partner (newest first). */
export async function listConversations(myId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("direct_messages")
    .select("*")
    .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  const rows = (data ?? []) as DirectMessage[];
  const byOther = new Map<string, Conversation>();
  for (const m of rows) {
    const other = m.sender_id === myId ? m.recipient_id : m.sender_id;
    if (!byOther.has(other)) {
      byOther.set(other, {
        other_id: other,
        last_body: m.body,
        last_at: m.created_at,
        last_from_me: m.sender_id === myId,
      });
    }
  }
  return [...byOther.values()];
}

/** The message thread between me and one other user, oldest first. */
export async function listDMThread(myId: string, otherId: string): Promise<DirectMessage[]> {
  const { data, error } = await supabase
    .from("direct_messages")
    .select("*")
    .or(
      `and(sender_id.eq.${myId},recipient_id.eq.${otherId}),` +
        `and(sender_id.eq.${otherId},recipient_id.eq.${myId})`,
    )
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as DirectMessage[];
}

/** Send a DM to `recipientId` (sender defaults to auth.uid() on the table). */
export async function sendDM(recipientId: string, body: string): Promise<DirectMessage> {
  const { data, error } = await supabase
    .from("direct_messages")
    .insert({ recipient_id: recipientId, body })
    .select("*")
    .single();
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_HINT);
    throw error;
  }
  return data as DirectMessage;
}
