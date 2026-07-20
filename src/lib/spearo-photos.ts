import { supabase } from "@/integrations/supabase/client";

// ── Spearo catch photo storage (Apnos Spearo) ────────────────────────────────
//
// One shareable photo per catch, stored in the public-read `catch-photos`
// Storage bucket at path  <uid>/<random-id>.jpg. Mirrors the upload/delete shape
// of `voice-cues.ts` (same client reference, same per-uid folder convention that
// the bucket's owner-only RLS policies key on).
//
// SPOT SECRECY — THE WHOLE POINT OF THIS FILE:
// A catch's `spot` coordinates are private. Camera photos routinely embed the
// shooting location in EXIF/GPS metadata, so uploading the ORIGINAL File would
// publish the secret spot inside a public image. To prevent that, every photo is
// re-encoded client-side through a <canvas> before it is ever uploaded: drawing
// the decoded pixels onto a canvas and re-exporting as JPEG produces a brand-new
// image with NO metadata at all (no GPS, no EXIF). The re-encode also downscales
// + compresses for fast mobile uploads and low storage cost. The original File is
// never sent to Storage.

const BUCKET = "catch-photos";

// Re-encode tuning. Longest side is capped so the stored image is share-card
// sized (not a multi-megapixel camera original), and JPEG quality trades a little
// fidelity for a much smaller, faster upload.
const MAX_EDGE = 1600; // px — longest side of the re-encoded image
const JPEG_QUALITY = 0.8; // 0..1 — JPEG export quality

/** True only in a browser, where canvas + object URLs exist (SSR-safe guard). */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/**
 * Decode a File into an HTMLImageElement via an object URL.
 *
 * The object URL is always revoked (success or failure) so we don't leak it.
 */
function decodeImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the selected image."));
    };
    img.src = url;
  });
}

/**
 * Re-encode an image File into a fresh, metadata-free JPEG Blob.
 *
 * Draws the decoded pixels onto a canvas scaled so the longest side is at most
 * `MAX_EDGE`, then exports as JPEG. Because the output is painted pixel-by-pixel
 * onto a new canvas, it carries NONE of the original file's metadata — this is
 * what strips any embedded GPS/EXIF (and therefore the catch's spot).
 */
async function reencodeToJpeg(file: File): Promise<Blob> {
  const img = await decodeImage(file);

  // Scale so the longest edge is <= MAX_EDGE; never upscale small images.
  const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const scale = Math.min(1, MAX_EDGE / longest);
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image (no 2D canvas support).");
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("Could not encode the image.");
  return blob;
}

/**
 * Upload a catch photo for the current user and return its public URL.
 *
 * CRITICAL ORDER OF OPERATIONS (do not reorder — see the spot-secrecy note):
 *   1. Re-encode the image client-side to strip GPS/EXIF and compress.
 *   2. Upload the re-encoded blob (never the original File) to `catch-photos`
 *      at  <userId>/<crypto-random-id>.jpg, matching the bucket's per-uid RLS.
 *   3. Return the bucket's public URL for storage on the catch row.
 */
export async function uploadCatchPhoto(file: File, userId: string): Promise<string> {
  if (!isBrowser()) {
    // Photos are only ever picked from the browser; guard the browser-only
    // canvas/crypto APIs so this module stays SSR-safe like the rest of the app.
    throw new Error("Photo upload is only available in the browser.");
  }

  // 1 — strip metadata + compress before anything leaves the device.
  const jpeg = await reencodeToJpeg(file);

  // 2 — per-uid path with a random object id (crypto.randomUUID is available in
  //     every browser Apnos targets); the <uid> prefix is what the bucket's
  //     owner-only INSERT policy checks.
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, jpeg, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) {
    // Surface the "bucket missing → apply the migration" case with the same
    // actionable phrasing as spearo-catches.ts's missing-table error.
    if (/bucket|not found/i.test(error.message ?? "")) {
      throw new Error(
        "catch-photos storage bucket is missing — apply " +
          "supabase/migrations/20260720_catch_photos_bucket.sql in the Supabase SQL editor.",
      );
    }
    throw error;
  }

  // 3 — public URL (getPublicUrl bypasses RLS for a public bucket).
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Delete a catch photo given its public URL (owner enforced by the bucket RLS).
 *
 * A public URL looks like
 *   https://<project>.supabase.co/storage/v1/object/public/catch-photos/<uid>/<id>.jpg
 * so we split on the bucket segment to recover the `<uid>/<id>.jpg` object path.
 */
export async function deleteCatchPhoto(url: string): Promise<void> {
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) {
    throw new Error("Not a catch-photos URL; refusing to delete.");
  }
  // Everything after the bucket segment is the object path (drop any query
  // string such as a cache-busting ?v=… param).
  const path = url.slice(idx + marker.length).split("?")[0];

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    if (/bucket|not found/i.test(error.message ?? "")) {
      throw new Error(
        "catch-photos storage bucket is missing — apply " +
          "supabase/migrations/20260720_catch_photos_bucket.sql in the Supabase SQL editor.",
      );
    }
    throw error;
  }
}
