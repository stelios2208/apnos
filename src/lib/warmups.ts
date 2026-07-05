// ── STA warm-ups ─────────────────────────────────────────────────────────────
// Ready-made static warm-up sequences. Each preset expands to a flat list of
// timed steps (breathe-up / hold / rest, or inhale/exhale for breathing-pattern
// presets) that the guided player auto-advances through, reusing the trainer's
// "alive" soundscape + haptics.

export type WarmupStepKind = "breathe" | "inhale" | "exhale" | "hold" | "rest";

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
const inh = (secs: number): WarmupStep => ({ kind: "inhale", secs });
const exh = (secs: number): WarmupStep => ({ kind: "exhale", secs });

// Repeats a breathing cycle (e.g. inhale/hold/exhale/hold) N times, flattened
// into a plain step list — the player has no separate "repeat" concept.
function cycle(times: number, ...pattern: WarmupStep[]): WarmupStep[] {
  return Array.from({ length: times }, () => pattern).flat();
}

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
    id: "coherent",
    name_el: "Συνεκτική Αναπνοή",
    name_en: "Coherent Breathing",
    desc_el: "Εισπνοή 5″ / Εκπνοή 5″ — καλή γενική ρύθμιση κάθε μέρα.",
    desc_en: "Inhale 5s / Exhale 5s — best general daily regulation.",
    level: "beginner",
    accent: "#4FA8E0",
    steps: cycle(15, inh(5), exh(5)),
  },
  {
    id: "box",
    name_el: "Τετράγωνη Αναπνοή",
    name_en: "Box Breathing",
    desc_el: "Εισπνοή 4″ / Κράτα 4″ / Εκπνοή 4″ / Κράτα 4″ — ιδανικό για συγκέντρωση.",
    desc_en: "Inhale 4s / Hold 4s / Exhale 4s / Hold 4s — best for focus.",
    level: "beginner",
    accent: "#5DCAA5",
    steps: cycle(12, inh(4), h(4), exh(4), r(4)),
  },
  {
    id: "478",
    name_el: "Αναπνοή 4-7-8",
    name_en: "4-7-8 Breath",
    desc_el: "Εισπνοή 4″ / Κράτα 7″ / Εκπνοή 8″ — ιδανικό πριν τον ύπνο ή για βαθιά χαλάρωση.",
    desc_en: "Inhale 4s / Hold 7s / Exhale 8s — best for sleep/downshifting.",
    level: "beginner",
    accent: "#B58BE8",
    steps: cycle(10, inh(4), h(7), exh(8)),
  },
  {
    id: "freediving-prep",
    name_el: "Προετοιμασία Ελεύθερης",
    name_en: "Freediving Prep",
    desc_el: "Εισπνοή 4″ / Εκπνοή 8″ — μεγαλύτερες εκπνοές για να καθίσεις πριν την άπνοια.",
    desc_en: "Inhale 4s / Exhale 8s — longer exhales to settle before apnea.",
    level: "beginner",
    accent: "#EF9F27",
    steps: cycle(12, inh(4), exh(8)),
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
  try {
    localStorage.setItem(CUSTOM_STORE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
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
    steps: [
      { kind: "breathe", secs: 120 },
      { kind: "hold", secs: 60 },
      { kind: "rest", secs: 90 },
    ],
    custom: true,
  };
}

export function presetTotalSecs(p: WarmupPreset): number {
  return p.steps.reduce((sum, s) => sum + s.secs, 0);
}

export function holdCount(p: WarmupPreset): number {
  return p.steps.filter((s) => s.kind === "hold").length;
}

// ── Rounds view ──────────────────────────────────────────────────────────────
// CO2/O2-style tables are really "Round N: breathe X, hold Y" pairs. Builtin
// presets already follow breathe,(hold,rest)* — detect that shape so the
// builder can show/edit them as a friendly numbered rounds list instead of a
// flat, arbitrary step sequence. Anything that doesn't fit (breathing-pattern
// presets, single-step relax, hand-built free sequences) falls back to the
// generic step editor.

export interface WarmupRound {
  breatheSecs: number;
  holdSecs: number;
}

export function roundsFromSteps(steps: WarmupStep[]): WarmupRound[] | null {
  if (steps.length === 0 || steps[0]!.kind !== "breathe") return null;
  const rounds: WarmupRound[] = [];
  let pendingBreathe = steps[0]!.secs;
  let i = 1;
  while (i < steps.length) {
    const holdStep = steps[i];
    if (!holdStep || holdStep.kind !== "hold") return null;
    rounds.push({ breatheSecs: pendingBreathe, holdSecs: holdStep.secs });
    i++;
    if (i < steps.length) {
      const restStep = steps[i];
      if (!restStep || (restStep.kind !== "rest" && restStep.kind !== "breathe")) return null;
      pendingBreathe = restStep.secs;
      i++;
    }
  }
  return rounds.length > 0 ? rounds : null;
}

export function stepsFromRounds(rounds: WarmupRound[]): WarmupStep[] {
  const steps: WarmupStep[] = [];
  rounds.forEach((round, i) => {
    steps.push({ kind: i === 0 ? "breathe" : "rest", secs: Math.max(1, round.breatheSecs) });
    steps.push({ kind: "hold", secs: Math.max(1, round.holdSecs) });
  });
  return steps;
}

export function newRound(): WarmupRound {
  return { breatheSecs: 120, holdSecs: 60 };
}

// ── Accent picker ────────────────────────────────────────────────────────────
// Premium icon + fixed-colour pairs (instead of a bare colour swatch). The
// icon component mapping lives in warmup.tsx (keeps lucide-react out of this
// data module); this just fixes the id → colour so both stay in sync.

export const WARMUP_ACCENTS: { id: string; color: string }[] = [
  { id: "waves", color: "#4FA8E0" },
  { id: "wind", color: "#5DCAA5" },
  { id: "flame", color: "#EF9F27" },
  { id: "droplet", color: "#1D9E75" },
  { id: "moon", color: "#B58BE8" },
  { id: "sparkle", color: "#E87DA8" },
];

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
  } catch {
    /* ignore */
  }
}
