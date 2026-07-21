// ── "My catch" share card (Apnos Spearo) ─────────────────────────────────────
//
// The vanity object that drives the growth loop: a premium, Instagram-friendly
// image of a single catch, carrying Apnos Spearo branding, that users post to
// their stories. It REUSES the app's existing SVG→PNG share pipeline — the card
// is a self-contained SVG string that `svgToPngBlob` (from share-card.ts)
// rasterises and `shareOrDownload` hands to the native share sheet / download.
// Same 1080×1350 portrait canvas as the dive/programme cards, so those helpers
// work unchanged.
//
// ⚠️ PRIVACY — NON-NEGOTIABLE: this card is a PUBLIC artifact (it ends up on
// Instagram in front of a sponsored athlete's audience). It MUST NEVER contain
// `catch.spot`, coordinates, the spot name, or any location data — none of it,
// ever. Spot secrecy is the app's hard-line differentiator. The builder below
// reads ONLY non-location fields (species, size, weight, depth, date, photo).
// The embedded photo was already EXIF/GPS-stripped on upload (see
// spearo-photos.ts), so it is safe to embed. Do NOT add any location here.

import { format } from "date-fns";
import {
  speciesLabel,
  formatCatchSize,
  formatCatchWeight,
  formatDepth,
  type SpearoCatch,
} from "@/lib/spearo";
import { svgToPngBlob, shareOrDownload } from "@/lib/share-card";

// Same portrait canvas as share-card.ts so the reused svgToPngBlob (which
// rasterises at its own 1080×1350) renders this SVG 1:1 with no scaling.
const W = 1080;
const H = 1350;

const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";

/** Escape text for safe inclusion in SVG/XML attribute + element content. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Capitalise the first character (locale-aware, so Greek names work too). */
function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}

/** Truncate to `max` chars with an ellipsis so long names never overflow. */
function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// The Apnos breath mark (same path/gradients as Logo.tsx / share-card.ts),
// emitted as an SVG group at an arbitrary transform. Kept self-contained here so
// the card has no external asset dependencies and rasterises cleanly.
function breathMark(transform: string, opacity = 1): string {
  return `<g transform="${transform}" opacity="${opacity}">
    <path d="M25.47 4.96 A16 16 0 1 1 14.53 4.96" stroke="url(#csc-breath)" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <circle cx="20" cy="25" r="4.2" fill="url(#csc-fall)"/>
    <circle cx="20" cy="15.5" r="1.05" fill="#5DCAA5" opacity="0.55"/>
    <circle cx="20" cy="19.2" r="1.5" fill="#5DCAA5" opacity="0.8"/>
  </g>`;
}

// Decorative drifting bubbles for the underwater feel (used on the no-photo
// fallback background). Deterministic positions so the card is stable.
function bubbles(): string {
  const spec: [number, number, number][] = [
    [140, 470, 10],
    [230, 560, 6],
    [330, 360, 14],
    [180, 250, 5],
    [860, 500, 12],
    [780, 300, 7],
    [940, 560, 9],
    [700, 610, 5],
    [520, 430, 8],
    [610, 320, 6],
    [420, 560, 7],
    [90, 360, 6],
  ];
  return spec
    .map(
      ([cx, cy, r], i) =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#9FE1CB" opacity="${(0.1 + (i % 4) * 0.05).toFixed(2)}"/>`,
    )
    .join("");
}

/**
 * Build the "my catch" share card as a self-contained SVG string.
 *
 * @param c        the catch to render (LOCATION FIELDS ARE INTENTIONALLY UNUSED)
 * @param lang     current UI language for the localized species name + labels
 * @param photoHref optional, ALREADY-SAFE image data URL to embed as the hero.
 *                 When provided → full-bleed photo layout; when omitted (no
 *                 photo, or the CORS load failed) → premium branded fallback.
 *                 It must be a `data:` URL (produced by `loadCatchPhotoDataUrl`)
 *                 so the SVG stays self-contained and the canvas is not tainted.
 *
 * The signature matches share-card.ts's convention: a pure, synchronous SVG
 * builder. All async/CORS photo loading lives in `shareCatchCard` below.
 */
export function buildCatchShareSvg(c: SpearoCatch, lang: "el" | "en", photoHref?: string): string {
  // ── text content (NON-LOCATION ONLY) ──────────────────────────────────────
  const rawName = c.species_code ? speciesLabel(c.species_code, lang) : (c.species_custom ?? "");
  const name = trunc(capitalize(rawName || (lang === "el" ? "Αλίευμα" : "Catch")), 18);
  const dateLabel = c.caught_at ? format(new Date(c.caught_at), "d MMM yyyy") : "";

  // Stats row — only fields the user actually recorded; undefined ones are
  // omitted entirely (never a blank label).
  const stats: { value: string; label: string }[] = [];
  if (c.size_cm != null)
    stats.push({ value: formatCatchSize(c.size_cm), label: lang === "el" ? "ΜΕΓΕΘΟΣ" : "SIZE" });
  if (c.weight_kg != null)
    stats.push({
      value: formatCatchWeight(c.weight_kg),
      label: lang === "el" ? "ΒΑΡΟΣ" : "WEIGHT",
    });
  if (c.max_depth_m != null)
    stats.push({ value: formatDepth(c.max_depth_m), label: lang === "el" ? "ΒΑΘΟΣ" : "DEPTH" });

  const statsEls = stats
    .map((s, i) => {
      const x = 72 + i * 250;
      return (
        `<text x="${x}" y="1238" font-family="${FONT}" font-size="50" font-weight="700" fill="#ffffff">${esc(s.value)}</text>` +
        `<text x="${x}" y="1278" font-family="${FONT}" font-size="22" font-weight="600" letter-spacing="3" fill="#5DCAA5">${esc(s.label)}</text>`
      );
    })
    .join("");

  // ── hero (photo, or branded fallback) ─────────────────────────────────────
  // With a photo: full-bleed cover-cropped image + top/bottom dark scrims for
  // legibility. Without: underwater gradient + light rays + bubbles + a large
  // centred brand mark, so a share NEVER breaks or shows a broken image.
  const hero = photoHref
    ? `<image href="${photoHref}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect width="${W}" height="${H}" fill="url(#csc-bg)"/>
       <rect width="${W}" height="${H}" fill="url(#csc-sun)"/>
       <g stroke="#5DCAA5" stroke-width="2" opacity="0.06">
         <line x1="240" y1="0" x2="320" y2="760"/>
         <line x1="540" y1="0" x2="500" y2="760"/>
         <line x1="840" y1="0" x2="760" y2="760"/>
       </g>
       ${bubbles()}
       ${breathMark(`translate(320 250) scale(11)`, 0.92)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="csc-bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#1a3a5c"/>
      <stop offset="0.45" stop-color="#10293f"/>
      <stop offset="1" stop-color="#070a10"/>
    </linearGradient>
    <radialGradient id="csc-sun" cx="0.5" cy="-0.05" r="0.75">
      <stop offset="0" stop-color="#5DCAA5" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#1D9E75" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="csc-top" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#040a10" stop-opacity="0.72"/>
      <stop offset="1" stop-color="#040a10" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="csc-bottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#040a10" stop-opacity="0"/>
      <stop offset="0.55" stop-color="#040a10" stop-opacity="0.62"/>
      <stop offset="1" stop-color="#040a10" stop-opacity="0.97"/>
    </linearGradient>
    <linearGradient id="csc-breath" x1="6" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
      <stop stop-color="#5DCAA5"/><stop offset="1" stop-color="#1D9E75"/>
    </linearGradient>
    <radialGradient id="csc-fall" cx="50%" cy="38%" r="65%">
      <stop offset="0" stop-color="#7BD9B8"/><stop offset="1" stop-color="#1D9E75"/>
    </radialGradient>
  </defs>

  <!-- hero background -->
  ${hero}

  <!-- legibility scrims (top for the brand lockup, bottom for the stats block) -->
  <rect x="0" y="0" width="${W}" height="300" fill="url(#csc-top)"/>
  <rect x="0" y="600" width="${W}" height="750" fill="url(#csc-bottom)"/>

  <!-- brand lockup (top-left): mark + APNOS SPEARO wordmark — the marketing hook -->
  ${breathMark("translate(72 54) scale(1.25)")}
  <text x="140" y="92" font-family="${FONT}" font-size="30" font-weight="800" letter-spacing="5" fill="#9FE1CB">APNOS SPEARO</text>

  <!-- site handle (top-right), balancing the lockup -->
  <text x="1008" y="90" text-anchor="end" font-family="${FONT}" font-size="28" font-weight="600" letter-spacing="1" fill="#5DCAA5">apnos.app</text>

  <!-- species name (prominent) -->
  <text x="72" y="1098" font-family="${FONT}" font-size="82" font-weight="800" fill="#ffffff">${esc(name)}</text>

  <!-- date (subtle) -->
  ${dateLabel ? `<text x="74" y="1148" font-family="${FONT}" font-size="30" font-weight="500" fill="#ffffff" opacity="0.55">${esc(dateLabel)}</text>` : ""}

  <!-- stats row (only recorded fields) -->
  ${statsEls}
</svg>`;
}

/**
 * Load a public catch photo into a clean `data:` URL for safe embedding.
 *
 * Loads via an `Image` with `crossOrigin = "anonymous"` (the catch-photos
 * bucket is public + CORS-enabled) BEFORE drawing to a canvas, so the canvas is
 * NOT tainted and PNG export later works. Downscaled to a bounded width to keep
 * the embedded data URL reasonable while staying crisp on the hero.
 *
 * Returns `null` on any failure (missing/blocked/CORS-tainted) so the caller
 * falls back to the branded no-photo card instead of throwing. SSR-guarded:
 * returns `null` when `document`/`Image` are unavailable.
 */
export async function loadCatchPhotoDataUrl(url: string): Promise<string | null> {
  if (typeof document === "undefined" || typeof Image === "undefined") return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const maxW = 1080;
        const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
        const w = Math.max(1, Math.round((img.naturalWidth || maxW) * scale));
        const h = Math.max(1, Math.round((img.naturalHeight || maxW) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        // toDataURL throws (SecurityError) if the canvas was tainted — treated
        // as a failure so we degrade to the branded fallback.
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Generate the catch card and share/download it, composing the pieces:
 * load photo (if any) → build SVG → reuse `svgToPngBlob` → reuse
 * `shareOrDownload` (native share sheet on mobile, download on desktop).
 *
 * Never includes any location data (see the privacy note at the top). Throws
 * only if rasterisation itself fails, so the caller can show a friendly toast.
 */
export async function shareCatchCard(
  c: SpearoCatch,
  lang: "el" | "en",
): Promise<"shared" | "downloaded"> {
  // Only attempt a photo when one exists; a failed/blocked load returns null
  // and we render the branded fallback instead.
  const photoHref = c.photo_url ? await loadCatchPhotoDataUrl(c.photo_url) : null;
  const svg = buildCatchShareSvg(c, lang, photoHref ?? undefined);
  const png = await svgToPngBlob(svg);
  const shareText =
    lang === "el" ? "Το αλίευμά μου 🐟 — Apnos Spearo" : "My catch 🐟 — Apnos Spearo";
  return shareOrDownload(png, "apnos-spearo-catch.png", shareText);
}
