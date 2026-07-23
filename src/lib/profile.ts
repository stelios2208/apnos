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
  countryCode: string; // ISO alpha-2 ("GR") — drives the flag on leaderboards
  city: string;
  bio: string;
  isPublic: boolean;
  avatarUrl: string; // public URL in the `avatars` bucket, "" if none
}

export function emptyProfile(): AthleteProfile {
  return {
    displayName: "",
    birthdate: "",
    gender: "",
    heightCm: null,
    weightKg: null,
    country: "",
    countryCode: "",
    city: "",
    bio: "",
    // Public by default: the community is small and members kept forgetting to
    // opt in, leaving an empty feed. A profile only ever exposes name/avatar/bio
    // and what the member explicitly shares — never spots — so public-first is
    // safe. Anyone who wants to hide can still flip the toggle off.
    isPublic: true,
    avatarUrl: "",
  };
}

/** ISO alpha-2 country code → flag emoji ("GR" → 🇬🇷); "" if invalid. */
export function flagEmoji(code: string): string {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "";
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/** Upload a profile photo to the owner's folder in `avatars`; returns its
 *  public URL (cache-busted so a re-upload shows immediately). */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  const base = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  return `${base}?v=${Date.now()}`;
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
    countryCode: typeof p.countryCode === "string" ? p.countryCode : base.countryCode,
    city: typeof p.city === "string" ? p.city : base.city,
    bio: typeof p.bio === "string" ? p.bio : base.bio,
    isPublic: typeof p.isPublic === "boolean" ? p.isPublic : base.isPublic,
    avatarUrl: typeof p.avatarUrl === "string" ? p.avatarUrl : base.avatarUrl,
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
