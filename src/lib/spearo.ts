// Spearfishing (Apnos Spearo) domain model.
//
// This is the spearfishing equivalent of `diving.ts`: pure TypeScript types,
// reference tables, and formatters. It has NO Supabase imports, NO React, and
// NO side effects — the data layer (CRUD + migrations) lands in a later commit.
//
// Design notes for the next commit (kept in mind here so the types slot in
// cleanly, mirroring `dives.ts`):
//   - `SpearoConditions` and `SpearoGear` are shaped to live in JSONB columns
//     (one JSONB blob instead of many sparse columns), the same pattern used by
//     `dives.conditions` (see `StaConditions`).
//   - Nothing here assumes a column exists yet; the write path will use the
//     PGRST204/PGRST205/42P01 drop-and-retry graceful-degradation pattern from
//     `dives.ts` when persisting these.

/**
 * Dive/session conditions for a spearfishing outing.
 *
 * Shaped to be stored as a single JSONB column later (one blob instead of many
 * sparse columns), matching the `dives.conditions` JSONB pattern. Every field
 * is optional so partial logs are always valid.
 */
export interface SpearoConditions {
  visibility_m?: number; // horizontal underwater visibility, in metres
  water_temp?: number; // °C
  swell_m?: number; // significant swell/wave height, in metres
  current?: "none" | "light" | "moderate" | "strong";
  wind?: string; // free-text wind description (e.g. "NW 4 Bft")
  bottom_type?: "rock" | "sand" | "posidonia" | "reef" | "wreck" | "mixed";
  technique?: "aspetto" | "midwater" | "hole" | "drift" | "flasher";
}

/**
 * Gear used on a spearfishing outing.
 *
 * Field names follow the existing `dives` gear conventions where they overlap
 * (`wetsuit_mm`, `fins_type`), so the two logs feel consistent. Also intended
 * to live in a JSONB column later.
 */
export interface SpearoGear {
  gun_type?: "railgun" | "pneumatic" | "polespear" | "sling";
  gun_brand?: string;
  gun_model?: string;
  gun_length_cm?: number;
  wetsuit_mm?: number; // wetsuit thickness in mm (matches dives.wetsuit_mm)
  fins_type?: string; // matches dives.fins_type
  weight_kg?: number; // total ballast worn, in kg
}

/**
 * A Mediterranean species reference entry.
 *
 * The paired Greek/English names are the app's localization moat and follow the
 * `name`/`name_el` convention used across the codebase (see i18n.tsx and
 * `diving.ts`). `code` is a stable slug used as the reference key from
 * `SpearoCatch.species_code`.
 */
export interface SpearoSpecies {
  code: string; // stable slug, referenced by SpearoCatch.species_code
  name_en: string;
  name_el: string;
  scientific: string; // binomial (Latin) name
  /**
   * Legal minimum landing size, in cm.
   *
   * IMPORTANT: intentionally left `undefined` for every species below. Do NOT
   * invent legal sizes here — real minimum-size values must be sourced from
   * current Greek/EU regulations before the regulations feature ships. Wrong
   * legal sizes could mislead users into keeping undersized catch and cause
   * fines.
   */
  min_size_cm?: number;
}

/**
 * Starter reference set of common Mediterranean spearfishing target species.
 *
 * `min_size_cm` is deliberately omitted (undefined) on every entry — see the
 * warning on `SpearoSpecies.min_size_cm`.
 */
export const MED_SPECIES: SpearoSpecies[] = [
  { code: "dentex", name_en: "dentex", name_el: "συναγρίδα", scientific: "Dentex dentex" },
  {
    code: "white-seabream",
    name_en: "white seabream",
    name_el: "σαργός",
    scientific: "Diplodus sargus",
  },
  {
    code: "gilthead-seabream",
    name_en: "gilthead seabream",
    name_el: "τσιπούρα",
    scientific: "Sparus aurata",
  },
  {
    code: "dusky-grouper",
    name_en: "dusky grouper",
    name_el: "ροφός",
    scientific: "Epinephelus marginatus",
  },
  {
    code: "greater-amberjack",
    name_en: "greater amberjack",
    name_el: "μαγιάτικο",
    scientific: "Seriola dumerili",
  },
  {
    code: "european-seabass",
    name_en: "european seabass",
    name_el: "λαβράκι",
    scientific: "Dicentrarchus labrax",
  },
  {
    code: "saddled-bream",
    name_en: "saddled bream",
    name_el: "μελανούρι",
    scientific: "Oblada melanura",
  },
  { code: "bogue", name_en: "bogue", name_el: "γόπα", scientific: "Boops boops" },
  { code: "salema", name_en: "salema", name_el: "σάλπα", scientific: "Sarpa salpa" },
  { code: "bluefish", name_en: "bluefish", name_el: "γοφάρι", scientific: "Pomatomus saltatrix" },
  {
    code: "european-barracuda",
    name_en: "european barracuda",
    name_el: "λούτσος",
    scientific: "Sphyraena sphyraena",
  },
  { code: "grey-mullet", name_en: "grey mullet", name_el: "κέφαλος", scientific: "Mugil cephalus" },
  {
    code: "red-scorpionfish",
    name_en: "red scorpionfish",
    name_el: "σκορπίνα",
    scientific: "Scorpaena scrofa",
  },
  {
    code: "common-octopus",
    name_en: "common octopus",
    name_el: "χταπόδι",
    scientific: "Octopus vulgaris",
  },
  { code: "meagre", name_en: "meagre", name_el: "μυλοκόπι", scientific: "Argyrosomus regius" },
];

/** Fast lookup of a species entry by its stable slug. */
export const MED_SPECIES_MAP: Record<string, SpearoSpecies> = Object.fromEntries(
  MED_SPECIES.map((s) => [s.code, s]),
);

/**
 * A single logged spearfishing catch — the core entity of the catch log.
 *
 * Mirrors the shape/lifecycle of `Dive`: server-owned `id`/`user_id`/timestamps,
 * an optional species reference (or free-text fallback), measurements, and the
 * two JSONB blobs (`conditions`, `gear`). `is_personal_best` is computed
 * client-side later, exactly like `Dive.is_personal_best`.
 */
export interface SpearoCatch {
  id: string;
  user_id: string;
  caught_at: string; // ISO timestamp of the catch
  created_at: string; // ISO timestamp the row was inserted

  species_code?: string; // reference into MED_SPECIES (MED_SPECIES_MAP[code])
  species_custom?: string; // free-text fallback when not in the reference set

  size_cm?: number;
  weight_kg?: number;
  quantity?: number; // number of fish in this entry; defaults to 1 when unset
  max_depth_m?: number;

  conditions?: SpearoConditions; // JSONB blob (see SpearoConditions)
  gear?: SpearoGear; // JSONB blob (see SpearoGear)

  photo_url?: string; // Supabase Storage reference, used by a later commit
  notes?: string;
  is_personal_best?: boolean; // computed client-side later, mirroring dives

  /**
   * Catch location.
   *
   * PRIVATE / OWNER-ONLY. Spot coordinates must NEVER be exposed to other
   * users: spot secrecy is a hard requirement in spearfishing. This will be
   * enforced by RLS later, and these coordinates must never be included in any
   * shared, public, or exported payload visible to anyone but the owner.
   */
  spot?: { lat: number; lng: number; name?: string };
}

/**
 * Resolve a species display name from its code, falling back to the raw code
 * when it is unknown. Safe with any string input.
 */
export function speciesLabel(code: string, lang: "el" | "en"): string {
  const s = MED_SPECIES_MAP[code];
  if (!s) return code;
  return lang === "el" ? s.name_el : s.name_en;
}

/** Format a catch size in cm, or an em dash when unset. Safe with undefined. */
export function formatCatchSize(cm?: number): string {
  if (cm == null) return "—";
  return `${cm} cm`;
}

/** Format a catch weight in kg, or an em dash when unset. Safe with undefined. */
export function formatCatchWeight(kg?: number): string {
  if (kg == null) return "—";
  return `${kg} kg`;
}

/** Format a depth in metres, or an em dash when unset. Safe with undefined. */
export function formatDepth(m?: number): string {
  if (m == null) return "—";
  return `${m} m`;
}
