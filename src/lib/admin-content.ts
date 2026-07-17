import { supabase } from "@/integrations/supabase/client";

// Admin data layer for content that used to be hardcoded in src/lib/tips.ts
// and src/routes/rules.tsx, now stored in Supabase. Plain async functions
// wrapping the Supabase client; RLS authorizes writes to admins.

// The single admin's user id. This is the exact UID the RLS policies on
// tips / rule_sections / rule_points check auth.uid() against, so the UI gate
// and the database's real security boundary share one source of truth — they
// can't silently disagree.
export const ADMIN_UID = "968b47dc-297a-4290-808f-ed022366b3e4";

export function isAdmin(userId: string | null | undefined): boolean {
  return userId === ADMIN_UID;
}

// Kebab-case slug from an English title, used to seed a tip / rule-section id
// (both are text primary keys) — e.g. "Never alone" → "never-alone".
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type TipCategory = "safety" | "eq" | "mental" | "relax" | "technique";

export interface Tip {
  id: string;
  category: TipCategory;
  title_el: string;
  title_en: string;
  body_el: string;
  body_en: string;
  premium: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleSection {
  id: string;
  icon: string;
  title_el: string;
  title_en: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RulePoint {
  id: string;
  section_id: string;
  content_el: string;
  content_en: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Tips ────────────────────────────────────────────────────────────────────

export interface TipInput {
  id: string;
  category: TipCategory;
  title_el: string;
  title_en: string;
  body_el: string;
  body_en: string;
  premium: boolean;
  sort_order: number;
  is_active: boolean;
}

export async function fetchTips(): Promise<Tip[]> {
  const { data, error } = await supabase
    .from("tips")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Tip[];
}

export async function createTip(input: TipInput): Promise<Tip> {
  const { data, error } = await supabase.from("tips").insert(input).select("*").single();
  if (error) throw error;
  return data as Tip;
}

export async function updateTip(id: string, input: Partial<TipInput>): Promise<Tip> {
  const { data, error } = await supabase
    .from("tips")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Tip;
}

export async function deleteTip(id: string): Promise<void> {
  const { error } = await supabase.from("tips").delete().eq("id", id);
  if (error) throw error;
}

// ── Rule sections ────────────────────────────────────────────────────────────

export interface RuleSectionInput {
  id: string;
  icon: string;
  title_el: string;
  title_en: string;
  sort_order: number;
  is_active: boolean;
}

export async function fetchRuleSections(): Promise<RuleSection[]> {
  const { data, error } = await supabase
    .from("rule_sections")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RuleSection[];
}

export async function createRuleSection(input: RuleSectionInput): Promise<RuleSection> {
  const { data, error } = await supabase.from("rule_sections").insert(input).select("*").single();
  if (error) throw error;
  return data as RuleSection;
}

export async function updateRuleSection(
  id: string,
  input: Partial<RuleSectionInput>,
): Promise<RuleSection> {
  const { data, error } = await supabase
    .from("rule_sections")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as RuleSection;
}

export async function deleteRuleSection(id: string): Promise<void> {
  const { error } = await supabase.from("rule_sections").delete().eq("id", id);
  if (error) throw error;
}

// ── Rule points ──────────────────────────────────────────────────────────────

export interface RulePointInput {
  section_id: string;
  content_el: string;
  content_en: string;
  sort_order: number;
  is_active: boolean;
}

export async function fetchRulePoints(sectionId?: string): Promise<RulePoint[]> {
  let query = supabase.from("rule_points").select("*");
  if (sectionId) query = query.eq("section_id", sectionId);
  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RulePoint[];
}

export async function createRulePoint(input: RulePointInput): Promise<RulePoint> {
  const { data, error } = await supabase.from("rule_points").insert(input).select("*").single();
  if (error) throw error;
  return data as RulePoint;
}

export async function updateRulePoint(
  id: string,
  input: Partial<RulePointInput>,
): Promise<RulePoint> {
  const { data, error } = await supabase
    .from("rule_points")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as RulePoint;
}

export async function deleteRulePoint(id: string): Promise<void> {
  const { error } = await supabase.from("rule_points").delete().eq("id", id);
  if (error) throw error;
}
