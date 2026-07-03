import { supabase } from "@/integrations/supabase/client";
import type { CueKey } from "@/lib/trainer-fx";

// Per-user recorded voice cues, stored in the `voice-cues` Storage bucket at
// path  <uid>/<lang>/<key>  (no extension — the content-type is stored with the
// object and the browser decodes by header, not by URL).

const BUCKET = "voice-cues";

export type CueLang = "el" | "en";

function normLang(lang: string): CueLang {
  return lang === "el" ? "el" : "en";
}

function cuePath(uid: string, lang: string, key: CueKey): string {
  return `${uid}/${normLang(lang)}/${key}`;
}

export async function uploadCue(uid: string, lang: string, key: CueKey, blob: Blob): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(cuePath(uid, lang, key), blob, {
    upsert: true,
    contentType: blob.type || "audio/mpeg",
  });
  if (error) throw error;
}

export async function deleteCue(uid: string, lang: string, key: CueKey): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([cuePath(uid, lang, key)]);
  if (error) throw error;
}

// Returns a map of the cues the user has recorded for a language → playable URL.
// A cache-busting param keyed on updated_at forces fresh audio after re-record.
export async function listCueUrls(uid: string, lang: string): Promise<Map<CueKey, string>> {
  const map = new Map<CueKey, string>();
  const { data, error } = await supabase.storage.from(BUCKET).list(`${uid}/${normLang(lang)}`, { limit: 100 });
  if (error || !data) return map;
  for (const f of data) {
    const key = f.name as CueKey;
    const base = supabase.storage.from(BUCKET).getPublicUrl(cuePath(uid, lang, key)).data.publicUrl;
    const stamp = (f.updated_at ?? f.created_at ?? "") as string;
    const ver = stamp ? `?v=${encodeURIComponent(stamp)}` : "";
    map.set(key, base + ver);
  }
  return map;
}
