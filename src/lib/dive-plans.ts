// ── Dive Plans ───────────────────────────────────────────────────────────────
// "Plan your dive" — schedule competition/target dives. Multiple per day
// (e.g. STA then DYN), each with a target, official top time, an optional
// loaded warm-up, and desired conditions. Stored locally (no migration);
// Supabase sync can be layered on later.

import type { DisciplineCode } from "./diving";

export interface DivePlan {
  id: string;
  date: string;          // YYYY-MM-DD
  discipline: DisciplineCode;
  topTime: string;       // "HH:MM" official top (empty = not timed)
  target: string;        // display string: "5:30", "150", "-40"
  warmupId: string | null;
  warmupName: string;    // denormalised for display
  warmupMins: number;    // minutes before top that the warm-up starts
  programName?: string;  // optional loaded coach programme (reference)
  sleepGoal: string;     // e.g. "8" (hours) — desired
  notes: string;
  wetStatic: boolean;    // STA only: wet (face-down) vs dry
  createdAt: number;
}

const STORE_KEY = "apnos.diveplans";

export function loadPlans(): DivePlan[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return (arr as DivePlan[]).filter((p) => p && p.id && p.date);
  } catch {
    return [];
  }
}

export function savePlans(list: DivePlan[]): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export function upsertPlan(p: DivePlan): DivePlan[] {
  const list = loadPlans();
  const idx = list.findIndex((x) => x.id === p.id);
  if (idx >= 0) list[idx] = p;
  else list.push(p);
  savePlans(list);
  return list;
}

export function deletePlan(id: string): DivePlan[] {
  const list = loadPlans().filter((x) => x.id !== id);
  savePlans(list);
  return list;
}

export function newPlan(dateISO: string, discipline: DisciplineCode = "STA"): DivePlan {
  return {
    id: crypto.randomUUID(),
    date: dateISO,
    discipline,
    topTime: "",
    target: "",
    warmupId: null,
    warmupName: "",
    warmupMins: 45,
    sleepGoal: "",
    notes: "",
    wetStatic: true,
    createdAt: Date.now(),
  };
}

// Sort by date then by top time (untimed last).
export function sortPlans(list: DivePlan[]): DivePlan[] {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const at = a.topTime || "99:99";
    const bt = b.topTime || "99:99";
    return at < bt ? -1 : at > bt ? 1 : 0;
  });
}

export function groupByDate(list: DivePlan[]): { date: string; plans: DivePlan[] }[] {
  const map = new Map<string, DivePlan[]>();
  for (const p of sortPlans(list)) {
    if (!map.has(p.date)) map.set(p.date, []);
    map.get(p.date)!.push(p);
  }
  return [...map.entries()].map(([date, plans]) => ({ date, plans }));
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
