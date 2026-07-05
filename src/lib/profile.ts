import { supabase } from "@/integrations/supabase/client";

// Stored in Supabase auth user_metadata.profile — no migration needed. Public
// profiles + rankings will later move to a dedicated queryable table.

export type Gender = "" | "male" | "female" | "other";

export interface AthleteProfile {
  displayName: string;
  birthdate: string; // ISO "YYYY-MM-DD" or ""
  gender: Gender;
  heightCm: number | null;
  weightKg: number | null;
  country: string;
  city: string;
  bio: string;
  isPublic: boolean;
}

export function emptyProfile(): AthleteProfile {
  return {
    displayName: "",
    birthdate: "",
    gender: "",
    heightCm: null,
    weightKg: null,
    country: "",
    city: "",
    bio: "",
    isPublic: false,
  };
}

export function ageFromBirthdate(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

function coerce(meta: Record<string, unknown> | undefined): AthleteProfile {
  const base = emptyProfile();
  const p = (meta?.profile ?? {}) as Partial<AthleteProfile>;
  return {
    displayName:
      typeof p.displayName === "string"
        ? p.displayName
        : typeof meta?.name === "string"
          ? (meta.name as string)
          : "",
    birthdate: typeof p.birthdate === "string" ? p.birthdate : base.birthdate,
    gender: (p.gender as Gender) ?? base.gender,
    heightCm: typeof p.heightCm === "number" ? p.heightCm : base.heightCm,
    weightKg: typeof p.weightKg === "number" ? p.weightKg : base.weightKg,
    country: typeof p.country === "string" ? p.country : base.country,
    city: typeof p.city === "string" ? p.city : base.city,
    bio: typeof p.bio === "string" ? p.bio : base.bio,
    isPublic: typeof p.isPublic === "boolean" ? p.isPublic : base.isPublic,
  };
}

export async function fetchProfile(): Promise<AthleteProfile> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return coerce(data.user?.user_metadata as Record<string, unknown> | undefined);
}

export async function saveProfile(p: AthleteProfile): Promise<void> {
  const { error } = await supabase.auth.updateUser({ data: { profile: p } });
  if (error) throw error;
}
