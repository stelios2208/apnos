import { supabase } from "@/integrations/supabase/client";

// ── Admin chat (Messenger-style) ─────────────────────────────────────────────
//
// Thin data layer over `admin_messages`
// (supabase/migrations/20260723_admin_chat.sql). Each row is one message in the
// thread between a MEMBER (user_id) and the admin; `sender` says who wrote it.
// A member only ever sees their own thread; an admin sees every thread and can
// reply. Same graceful-degradation conventions as the rest of the app.

export type Sender = "user" | "admin";

export interface AdminMessage {
  id: string;
  user_id: string;
  sender: Sender;
  body: string;
  created_at: string;
}

/** One member's thread, summarised for the admin inbox. */
export interface AdminThread {
  user_id: string;
  last_body: string;
  last_at: string;
  last_sender: Sender;
  count: number;
}

const MIGRATION_HINT =
  "admin_messages table is missing — apply " +
  "supabase/migrations/20260723_admin_chat.sql in the Supabase SQL editor.";

type PgErrorLike = { code?: string; message?: string } | null;

function isMissingTable(err: PgErrorLike): boolean {
  if (!err) return false;
  return err.code === "PGRST205" || err.code === "42P01";
}

/** True when the current user is an admin (via the SECURITY DEFINER helper). */
export async function amIAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) return false; // function/migration missing → treat as non-admin
  return data === true;
}

/** All messages in one member's thread, oldest first. */
export async function listThread(userId: string): Promise<AdminMessage[]> {
  const { data, error } = await supabase
    .from("admin_messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as AdminMessage[];
}

/**
 * Send a message. A member calls this with their own id + sender "user"; the
 * admin calls it with the member's id + sender "admin". RLS enforces both.
 */
export async function sendMessage(input: {
  userId: string;
  sender: Sender;
  body: string;
}): Promise<AdminMessage> {
  const { data, error } = await supabase
    .from("admin_messages")
    .insert({ user_id: input.userId, sender: input.sender, body: input.body })
    .select("*")
    .single();
  if (error) {
    if (isMissingTable(error)) throw new Error(MIGRATION_HINT);
    throw error;
  }
  return data as AdminMessage;
}

/**
 * Admin inbox: every thread, newest activity first. Built client-side by
 * folding the message list down to one summary row per member. Missing table →
 * empty list.
 */
export async function listAdminThreads(): Promise<AdminThread[]> {
  const { data, error } = await supabase
    .from("admin_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  const rows = (data ?? []) as AdminMessage[];
  const byUser = new Map<string, AdminThread>();
  for (const m of rows) {
    // rows are newest-first, so the first time we see a user is their latest.
    const cur = byUser.get(m.user_id);
    if (!cur) {
      byUser.set(m.user_id, {
        user_id: m.user_id,
        last_body: m.body,
        last_at: m.created_at,
        last_sender: m.sender,
        count: 1,
      });
    } else {
      cur.count += 1;
    }
  }
  return [...byUser.values()];
}
