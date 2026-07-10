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
  // Why you'd pick this preset (shown as the card chip instead of a bare
  // difficulty level) — e.g. "focus", "deep relaxation", "CO₂ tolerance".
  purpose_el?: string;
  purpose_en?: string;
  // For flattened repeating patterns (box, 4-7-8, …): how many steps one
  // cycle spans, so the player can show "Round x/y".
  cycleLen?: number;
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
    desc_el:
      "3 λεπτά ήρεμης αναπνοής — ενεργοποιεί το παρασυμπαθητικό σύστημα και ρίχνει τους παλμούς πριν ξεκινήσεις.",
    desc_en:
      "3 minutes of calm breathing — activates the parasympathetic system and lowers your heart rate before you begin.",
    level: "beginner",
    purpose_el: "Χαλάρωση",
    purpose_en: "Wind-down",
    accent: "#9FE1CB",
    steps: [b(180)],
  },
  {
    id: "coherent",
    name_el: "Συνεκτική Αναπνοή",
    name_en: "Coherent Breathing",
    desc_el:
      "Εισπνοή 5″ / Εκπνοή 5″ — περίπου 6 αναπνοές το λεπτό, ο ρυθμός που μεγιστοποιεί το HRV και ηρεμεί το νευρικό σύστημα.",
    desc_en:
      "Inhale 5s / Exhale 5s — about 6 breaths per minute, the rate shown to maximise HRV and settle the nervous system.",
    level: "beginner",
    purpose_el: "Ρύθμιση παλμών (HRV)",
    purpose_en: "Heart-rate balance",
    cycleLen: 2,
    accent: "#4FA8E0",
    steps: cycle(15, inh(5), exh(5)),
  },
  {
    id: "box",
    name_el: "Τετράγωνη Αναπνοή",
    name_en: "Box Breathing",
    desc_el:
      "Εισπνοή 4″ / Κράτα 4″ / Εκπνοή 4″ / Κράτα 4″ — το «τετράγωνο» κρατά τον νου αγκυρωμένο στο μέτρημα και επαναφέρει τον έλεγχο του στρες.",
    desc_en:
      "Inhale 4s / Hold 4s / Exhale 4s / Hold 4s — the square anchors the mind on the count and resets the stress response.",
    level: "beginner",
    purpose_el: "Συγκέντρωση & έλεγχος",
    purpose_en: "Focus & control",
    cycleLen: 4,
    accent: "#5DCAA5",
    steps: cycle(12, inh(4), h(4), exh(4), r(4)),
  },
  {
    id: "478",
    name_el: "Αναπνοή 4-7-8",
    name_en: "4-7-8 Breath",
    desc_el:
      "Εισπνοή 4″ / Κράτα 7″ / Εκπνοή 8″ — οι ασκήσεις αναπνοής 4-7-8 διεγείρουν το παρασυμπαθητικό νευρικό σύστημα· ιδανική για ύπνο ή αποφόρτιση.",
    desc_en:
      "Inhale 4s / Hold 7s / Exhale 8s — 4-7-8 breathing stimulates the parasympathetic nervous system; ideal for sleep or downshifting.",
    level: "beginner",
    purpose_el: "Βαθιά χαλάρωση",
    purpose_en: "Deep relaxation",
    cycleLen: 3,
    accent: "#B58BE8",
    steps: cycle(10, inh(4), h(7), exh(8)),
  },
  {
    id: "freediving-prep",
    name_el: "Προετοιμασία Ελεύθερης",
    name_en: "Freediving Prep",
    desc_el:
      "Εισπνοή 4″ / Εκπνοή 8″ — εκπνοή διπλάσια της εισπνοής: ρίχνει τους παλμούς και σε «κατεβάζει» πριν τις κρατήσεις.",
    desc_en:
      "Inhale 4s / Exhale 8s — exhaling twice as long as you inhale lowers the pulse and settles you before your holds.",
    level: "beginner",
    purpose_el: "Πριν την άπνοια",
    purpose_en: "Pre-apnea settling",
    cycleLen: 2,
    accent: "#EF9F27",
    steps: cycle(12, inh(4), exh(8)),
  },
  {
    id: "pre-max",
    name_el: "Προθέρμανση Max",
    name_en: "Pre-Max Static",
    desc_el:
      "Δύο ανεβαίνουσες κρατήσεις που «ξυπνούν» το mammalian dive reflex πριν από μια μέγιστη προσπάθεια.",
    desc_en: "Two building holds that wake up the dive reflex before a maximal attempt.",
    level: "intermediate",
    purpose_el: "Πριν από max",
    purpose_en: "Before a max",
    accent: "#1D9E75",
    steps: [b(120), h(60), r(120), b(120), h(120), r(180)],
  },
  {
    id: "co2",
    name_el: "CO₂ Ανοχή",
    name_en: "CO₂ Tolerance",
    desc_el:
      "Για αρχάριους. Σταθερές κρατήσεις 0:45 με μειούμενη ξεκούραση — μαθαίνει το σώμα να ανέχεται το ανεβασμένο CO₂, την πρώτη αιτία του «θέλω να αναπνεύσω».",
    desc_en:
      "Beginner-friendly. Fixed 0:45 holds with shrinking rest — teaches the body to tolerate rising CO₂, the main source of the urge to breathe.",
    level: "beginner",
    purpose_el: "Ανοχή στο CO₂",
    purpose_en: "CO₂ tolerance",
    accent: "#EF9F27",
    steps: [b(120), h(45), r(105), h(45), r(90), h(45), r(75), h(45), r(60), h(45)],
  },
  {
    id: "o2",
    name_el: "O₂ Πρόοδος",
    name_en: "O₂ Progressive",
    desc_el:
      "Για αρχάριους. Σταθερή ξεκούραση 2:00 με κρατήσεις 0:45→1:30 — προσαρμογή του σώματος στη λειτουργία με λιγότερο οξυγόνο.",
    desc_en:
      "Beginner-friendly. Fixed 2:00 rest with 0:45→1:30 holds — adapts the body to functioning on less oxygen.",
    level: "beginner",
    purpose_el: "Αντοχή σε χαμηλό O₂",
    purpose_en: "Low-O₂ endurance",
    accent: "#5DCAA5",
    steps: [b(120), h(45), r(120), h(60), r(120), h(75), r(120), h(90)],
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

/** Longest single hold in the preset, 0 if it has none — used to log a
 * completed run as an STA dive result (a max hold is a safer "result" than
 * summing every hold, since these are pre-set targets, not a max attempt). */
export function maxHoldSecs(p: WarmupPreset): number {
  const holds = p.steps.filter((s) => s.kind === "hold").map((s) => s.secs);
  return holds.length > 0 ? Math.max(...holds) : 0;
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
