// ── STA warm-ups ─────────────────────────────────────────────────────────────
// Ready-made static warm-up sequences. Each preset expands to a flat list of
// timed steps (breathe-up / hold / rest) that the guided player auto-advances
// through, reusing the trainer's "alive" soundscape + haptics.

export type WarmupStepKind = "breathe" | "hold" | "rest";

export interface WarmupStep {
  kind: WarmupStepKind;
  secs: number;
}

export interface WarmupPreset {
  id: string;
  name_el: string;
  name_en: string;
  desc_el: string;
  desc_en: string;
  level: "beginner" | "intermediate" | "advanced";
  accent: string;
  steps: WarmupStep[];
  custom?: boolean;
}

const b = (secs: number): WarmupStep => ({ kind: "breathe", secs });
const h = (secs: number): WarmupStep => ({ kind: "hold", secs });
const r = (secs: number): WarmupStep => ({ kind: "rest", secs });

export const WARMUP_PRESETS: WarmupPreset[] = [
  {
    id: "relax",
    name_el: "Ήρεμη Αναπνοή",
    name_en: "Relax & Breathe",
    desc_el: "3 λεπτά καθοδηγούμενης χαλαρωτικής αναπνοής πριν ξεκινήσεις.",
    desc_en: "3 minutes of guided relaxation breathing before you begin.",
    level: "beginner",
    accent: "#9FE1CB",
    steps: [b(180)],
  },
  {
    id: "pre-max",
    name_el: "Προθέρμανση Max",
    name_en: "Pre-Max Static",
    desc_el: "Δύο ανεβαίνουσες κρατήσεις για να ετοιμαστείς για μέγιστη προσπάθεια.",
    desc_en: "Two building holds to prime you for a maximal attempt.",
    level: "intermediate",
    accent: "#1D9E75",
    steps: [b(120), h(60), r(120), b(120), h(120), r(180)],
  },
  {
    id: "co2",
    name_el: "CO₂ Ανοχή",
    name_en: "CO₂ Tolerance",
    desc_el: "Σταθερές κρατήσεις 1:00 με μειούμενη ξεκούραση — χτίζει ανοχή στο CO₂.",
    desc_en: "Fixed 1:00 holds with shrinking rest — builds CO₂ tolerance.",
    level: "intermediate",
    accent: "#EF9F27",
    steps: [b(120), h(60), r(105), h(60), r(90), h(60), r(75), h(60), r(60), h(60)],
  },
  {
    id: "o2",
    name_el: "O₂ Πρόοδος",
    name_en: "O₂ Progressive",
    desc_el: "Σταθερή ξεκούραση 2:00 με ανεβαίνουσες κρατήσεις — χτίζει αντοχή σε O₂.",
    desc_en: "Fixed 2:00 rest with increasing holds — builds O₂ endurance.",
    level: "advanced",
    accent: "#5DCAA5",
    steps: [b(120), h(60), r(120), h(90), r(120), h(120), r(120), h(150)],
  },
];

// ── Custom warm-ups (user-built, stored locally — no migration needed) ───────

export const CUSTOM_STORE_KEY = "apnos.warmup.custom";

export function loadCustomWarmups(): WarmupPreset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return (arr as WarmupPreset[])
      .filter((p) => p && Array.isArray(p.steps) && p.steps.length > 0)
      .map((p) => ({ ...p, custom: true }));
  } catch {
    return [];
  }
}

export function saveCustomWarmups(list: WarmupPreset[]): void {
  try { localStorage.setItem(CUSTOM_STORE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export function upsertCustomWarmup(p: WarmupPreset): WarmupPreset[] {
  const list = loadCustomWarmups();
  const idx = list.findIndex((x) => x.id === p.id);
  if (idx >= 0) list[idx] = p;
  else list.unshift(p);
  saveCustomWarmups(list);
  return list;
}

export function deleteCustomWarmup(id: string): WarmupPreset[] {
  const list = loadCustomWarmups().filter((x) => x.id !== id);
  saveCustomWarmups(list);
  return list;
}

export function newCustomWarmup(): WarmupPreset {
  return {
    id: crypto.randomUUID(),
    name_el: "",
    name_en: "",
    desc_el: "",
    desc_en: "",
    level: "intermediate",
    accent: "#4FA8E0",
    steps: [{ kind: "breathe", secs: 120 }, { kind: "hold", secs: 60 }, { kind: "rest", secs: 90 }],
    custom: true,
  };
}

export function presetTotalSecs(p: WarmupPreset): number {
  return p.steps.reduce((sum, s) => sum + s.secs, 0);
}

export function holdCount(p: WarmupPreset): number {
  return p.steps.filter((s) => s.kind === "hold").length;
}

export function fmtClock(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Alarms ───────────────────────────────────────────────────────────────────
// Alert marks (in seconds) that fire during hold steps — e.g. 180 = buzz at 3:00.

export const ALARM_STORE_KEY = "apnos.warmup.alarms";

export function loadAlarms(): number[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(ALARM_STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((n): n is number => typeof n === "number" && n > 0).sort((a, b2) => a - b2);
  } catch {
    return [];
  }
}

export function saveAlarms(marks: number[]): void {
  try {
    const clean = Array.from(new Set(marks.filter((n) => n > 0))).sort((a, b2) => a - b2);
    localStorage.setItem(ALARM_STORE_KEY, JSON.stringify(clean));
  } catch { /* ignore */ }
}
