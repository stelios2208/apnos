// Guided breathing pattern cards — the interactive overlay shown on top of the
// breathwork player's countdown for guided beginner sessions. Each guide is
// keyed to a WARMUP_PRESETS id and describes ONE cycle of the pattern (or the
// full step list for non-cyclic presets), so the card can render every step
// and highlight the active one straight from the player's stepIndex/remaining
// state — no second timer.
//
// Premium gating uses the same non-functional scaffold as lib/tips.ts: a
// `premium` flag plus the ADV/ΠΡΟΧ. badge. There is no real entitlement check
// yet — `hasPremiumAccess()` is the single seam where one gets layered in
// later without restructuring.

import type { WarmupStepKind } from "@/lib/warmups";

export interface GuideStep {
  // Mirrors the preset's step kind at the same position so highlight + colour
  // stay in lockstep with the countdown. Phase taxonomy: breathe/inhale/exhale
  // are Αναπνοή-family, hold is Κράτημα, rest is true passive Ξεκούραση only.
  kind: WarmupStepKind;
  // Nominal duration shown on the step chip; omit for instruction-only steps.
  secs?: number;
  text_el: string;
  text_en: string;
}

export interface BreathingGuide {
  id: string;
  /** WARMUP_PRESETS id this guide overlays. */
  presetId: string;
  premium?: boolean;
  name_el: string;
  name_en: string;
  /** One-line setup shown above the steps (e.g. "hand on the belly"). */
  prep_el?: string;
  prep_en?: string;
  /**
   * Steps of ONE cycle for cyclic presets (length === preset.cycleLen), or
   * the full step list for non-cyclic presets (length === preset.steps.length).
   */
  steps: GuideStep[];
}

// The entitlement check lives in lib/premium.ts (hasProAccess / isLocked) —
// the single seam for a future subscription lookup.

export function guideForPreset(presetId: string): BreathingGuide | undefined {
  return BREATHING_GUIDES.find((g) => g.presetId === presetId);
}

// Generic guide overlaid on the CO₂/O₂ table runner: two phase cards (active
// breathe-up / hold) whose durations vary per round, so steps carry no fixed
// seconds — the live countdown fills them in. Free `easy` tables run it too,
// hence premium: false (free-tier items never show a PRO badge).
export const STA_TABLE_GUIDE: BreathingGuide = {
  id: "guide-sta-table",
  presetId: "sta-table",
  name_el: "Πίνακας Αναπνοής & Κρατήματος",
  name_en: "Breathe & Hold Table",
  prep_el: "Ήρεμος ρυθμός σε όλο τον πίνακα — χωρίς βιασύνη ανάμεσα στους γύρους.",
  prep_en: "A calm rhythm through the whole table — no rushing between rounds.",
  steps: [
    {
      kind: "breathe",
      text_el: "Ήρεμη διαφραγματική αναπνοή — φουσκώνει η κοιλιά, μεγάλες χαλαρές εκπνοές",
      text_en: "Calm diaphragmatic breathing — belly rises, long relaxed exhales",
    },
    {
      kind: "hold",
      text_el: "Κράτημα — χαλάρωσε πρόσωπο και ώμους, άσε το σώμα βαρύ",
      text_en: "Hold — relax face and shoulders, let the body go heavy",
    },
  ],
};

export const BREATHING_GUIDES: BreathingGuide[] = [
  {
    id: "guide-478",
    presetId: "478",
    premium: true,
    name_el: "Χαλάρωση 4-7-8",
    name_en: "4-7-8 Relaxation",
    prep_el: "Πρώτα άδειασε τελείως τους πνεύμονες από το στόμα (whoosh) — μετά 4 κύκλοι.",
    prep_en: "First empty the lungs fully through the mouth (whoosh) — then 4 cycles.",
    steps: [
      {
        kind: "inhale",
        secs: 4,
        text_el: "Ήσυχη εισπνοή από τη μύτη",
        text_en: "Inhale quietly through the nose",
      },
      {
        kind: "hold",
        secs: 7,
        text_el: "Κράτημα με γεμάτους πνεύμονες",
        text_en: "Hold with full lungs",
      },
      {
        kind: "exhale",
        secs: 8,
        text_el: "Εκπνοή από το στόμα με «whoosh»",
        text_en: "Exhale through the mouth — whoosh",
      },
    ],
  },
  {
    id: "guide-diaphragm",
    presetId: "diaphragm",
    premium: true,
    name_el: "Διαφραγματικό Breathe-Up",
    name_en: "Diaphragmatic Breathe-Up",
    prep_el: "Χέρι στην κοιλιά. Ήρεμα και αβίαστα, για 2–3 λεπτά.",
    prep_en: "Hand on the belly. Calm and effortless, for 2–3 minutes.",
    steps: [
      {
        kind: "inhale",
        secs: 5,
        text_el: "Αργή εισπνοή από τη μύτη — φουσκώνει η κοιλιά, όχι το στήθος",
        text_en: "Slow inhale through the nose — the belly rises, not the chest",
      },
      {
        kind: "hold",
        secs: 2,
        text_el: "Μικρή παύση",
        text_en: "Small pause",
      },
      {
        kind: "exhale",
        secs: 6,
        text_el: "Αργή εκπνοή με μισόκλειστα χείλη",
        text_en: "Slow exhale through pursed lips",
      },
    ],
  },
  {
    id: "guide-box",
    presetId: "box",
    premium: true,
    name_el: "Τετράγωνη Αναπνοή 4-4-4-4",
    name_en: "Box Breathing 4-4-4-4",
    steps: [
      { kind: "inhale", secs: 4, text_el: "Εισπνοή", text_en: "Inhale" },
      {
        kind: "hold",
        secs: 4,
        text_el: "Κράτημα με γεμάτους πνεύμονες",
        text_en: "Hold — full lungs",
      },
      { kind: "exhale", secs: 4, text_el: "Εκπνοή", text_en: "Exhale" },
      {
        kind: "hold",
        secs: 4,
        text_el: "Κράτημα με άδειους πνεύμονες",
        text_en: "Hold — empty lungs",
      },
    ],
  },
  {
    id: "guide-last-breath",
    presetId: "last-breath",
    premium: true,
    name_el: "Τελευταία Αναπνοή",
    name_en: "Last Breath",
    prep_el: "Χαλάρωσε πρόσωπο και ώμους — ξεκίνα το κράτημα ήρεμα.",
    prep_en: "Relax the face and shoulders — begin the hold calm.",
    steps: [
      {
        kind: "breathe",
        secs: 120,
        text_el: "Ήρεμο breathe-up — αργές, χαλαρές αναπνοές",
        text_en: "Calm breathe-up — slow, relaxed breaths",
      },
      {
        kind: "inhale",
        secs: 10,
        text_el:
          "ΜΙΑ αργή βαθιά εισπνοή — πρώτα κοιλιά, μετά στήθος — στο 100% χωρίς packing ή σφίξιμο",
        text_en:
          "ONE slow deep inhale — belly first, then chest — to 100% without packing or straining",
      },
    ],
  },
  {
    id: "guide-recovery",
    presetId: "recovery",
    premium: true,
    name_el: "Αναπνοές Αποκατάστασης",
    name_en: "Recovery Breathing",
    prep_el: "Μετά από κάθε ανάδυση: 3–4 αναπνοές αποκατάστασης — όσες χρειαστείς.",
    prep_en: "After every surfacing: 3–4 recovery breaths — as many as you need.",
    steps: [
      { kind: "inhale", secs: 2, text_el: "Γρήγορη εισπνοή", text_en: "Quick inhale" },
      { kind: "hold", secs: 2, text_el: "Κράτημα 1–2″", text_en: "Hold 1–2s" },
      { kind: "exhale", secs: 3, text_el: "Παθητική εκπνοή", text_en: "Passive exhale" },
    ],
  },
];
