export type DisciplineCode = "STA" | "DYN" | "DYNB" | "DNF" | "CWT" | "CWTB" | "CNF" | "FIM";

export type DisciplineUnit = "time" | "distance";

export type Federation = "AIDA" | "CMAS";

export const FEDERATIONS: Federation[] = ["AIDA", "CMAS"];

export interface Discipline {
  code: DisciplineCode;
  name: string;
  name_el: string;
  unit: DisciplineUnit;
  group: "Pool" | "Depth";
}

export const DISCIPLINES: Discipline[] = [
  { code: "STA", name: "Static Apnea", name_el: "Στατική Άπνοια", unit: "time", group: "Pool" },
  {
    code: "DYN",
    name: "Dynamic Mono-fin",
    name_el: "Δυναμική με Μονοπέδιλο",
    unit: "distance",
    group: "Pool",
  },
  {
    code: "DYNB",
    name: "Dynamic Bi-fins",
    name_el: "Δυναμική με Πτερύγια",
    unit: "distance",
    group: "Pool",
  },
  {
    code: "DNF",
    name: "Dynamic No-fins",
    name_el: "Δυναμική χωρίς Πτερύγια",
    unit: "distance",
    group: "Pool",
  },
  {
    code: "CWT",
    name: "Constant Weight Mono-fin",
    name_el: "Σταθερό Βάρος με Μονοπέδιλο",
    unit: "distance",
    group: "Depth",
  },
  {
    code: "CWTB",
    name: "Constant Weight Bi-fins",
    name_el: "Σταθερό Βάρος με Πτερύγια",
    unit: "distance",
    group: "Depth",
  },
  {
    code: "CNF",
    name: "Constant Weight No-fins",
    name_el: "Σταθερό Βάρος χωρίς Πτερύγια",
    unit: "distance",
    group: "Depth",
  },
  {
    code: "FIM",
    name: "Free Immersion",
    name_el: "Ελεύθερη Κατάδυση",
    unit: "distance",
    group: "Depth",
  },
];

export const DISCIPLINE_MAP: Record<DisciplineCode, Discipline> = Object.fromEntries(
  DISCIPLINES.map((d) => [d.code, d]),
) as Record<DisciplineCode, Discipline>;

export function disciplineName(code: DisciplineCode, lang: "el" | "en"): string {
  const d = DISCIPLINE_MAP[code];
  if (!d) return code;
  return lang === "el" ? d.name_el : d.name;
}

export type SessionType = "training" | "competition";

// STA-specific session conditions, stored in the dives.conditions JSONB column.
export type StaPosture = "" | "supine" | "seated" | "float" | "prone";
export type StaEnvironment = "" | "dry" | "wet";
/** @deprecated superseded by faceCover + noseclip, which allow combos */
export type StaFace = "" | "noseclip" | "mask" | "goggles";
export type StaFaceCover = "" | "mask" | "goggles";

export interface StaConditions {
  posture?: StaPosture;
  environment?: StaEnvironment;
  /** @deprecated superseded by faceCover + noseclip, which allow combos */
  face?: StaFace;
  faceCover?: StaFaceCover; // mask XOR goggles (or none) — independent of noseclip
  noseclip?: boolean; // can be combined with either face cover, or alone
  roomTemp?: number | null; // °C, for dry training
  breatheInSec?: number | null; // breathe-up inhale seconds (e.g. 3)
  breatheOutSec?: number | null; // breathe-up exhale seconds (e.g. 3)
  warmupName?: string; // warm-up used before the dive (any discipline)
  warmupId?: string;
}

export interface Dive {
  id: string;
  user_id: string;
  discipline: DisciplineCode;
  result: number;
  session_type: SessionType;
  federation: Federation | null;
  dive_date: string;
  dive_time: string | null;
  sleep_hours: number | null;
  food_notes: string | null;
  mental_state: number | null;
  notes: string | null;
  neck_weight: number | null;
  belt_weight: number | null;
  wetsuit_mm: number | null;
  buoyancy: string | null;
  fins_type: string | null;
  fins_brand: string | null;
  fins_model: string | null;
  foot_pocket: string | null;
  water_temp: number | null;
  conditions: StaConditions | null;
  is_personal_best: boolean;
  created_at: string;
  /** Optional shareable photo (public `catch-photos` bucket, EXIF stripped). */
  photo_url?: string | null;
  /**
   * Per-dive community opt-in, default OFF (false/undefined = private).
   * When true the dive appears in the community feed — but ONLY through the
   * sanitized `feed_dives` view (result data only; never notes, wellness,
   * gear or conditions).
   */
  shared_to_feed?: boolean;
}

export function isTimeDiscipline(code: DisciplineCode): boolean {
  return DISCIPLINE_MAP[code]?.unit === "time";
}

export function formatResult(discipline: DisciplineCode, result: number): string {
  const unit = DISCIPLINE_MAP[discipline]?.unit;
  if (unit === "time") {
    const total = Math.round(result);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  return `${result} m`;
}

/** Convert minutes + seconds into total seconds. */
export function toSeconds(minutes: number, seconds: number): number {
  return minutes * 60 + seconds;
}

/** Split total seconds into { minutes, seconds }. */
export function fromSeconds(total: number): { minutes: number; seconds: number } {
  const t = Math.round(total);
  return { minutes: Math.floor(t / 60), seconds: t % 60 };
}
