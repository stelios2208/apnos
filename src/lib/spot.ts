// ── Private spot geolocation (Apnos Spearo) ──────────────────────────────────
//
// Tiny, dependency-free helpers for the OPTIONAL, OWNER-ONLY catch "spot"
// (SpearoCatch.spot). Spot secrecy is the app's hard-line differentiator: a
// captured location is for the owner's eyes ONLY and must NEVER leak into any
// shared, public, or exported surface. These helpers only *capture* a location
// (getCurrentSpot) and *hand it off* to the device's own maps app for the owner
// (mapsLink) — they never transmit coordinates anywhere.
//
// All browser-only API access (navigator.geolocation) is SSR-guarded in the
// same style as native.ts / use-wake-lock.ts: nothing touches `navigator`
// unless it exists at runtime.

/**
 * Typed reasons `getCurrentSpot` can reject with, so the UI can show a friendly,
 * localized message instead of a raw DOMException string.
 *
 *   - "unsupported": geolocation isn't available (SSR, or a browser without it)
 *   - "denied": the user declined the permission prompt
 *   - "unavailable": the position could not be determined (no fix / GPS off)
 *   - "timeout": the location request took too long
 */
export type SpotErrorReason = "unsupported" | "denied" | "unavailable" | "timeout";

/** Error thrown by `getCurrentSpot`, carrying a typed `reason` for the UI. */
export class SpotError extends Error {
  reason: SpotErrorReason;
  constructor(reason: SpotErrorReason, message?: string) {
    super(message ?? reason);
    this.name = "SpotError";
    this.reason = reason;
  }
}

/**
 * Capture the device's current location with high accuracy on.
 *
 * SSR/unsupported-guarded: rejects with a `SpotError("unsupported")` when
 * `navigator.geolocation` is absent (e.g. during server rendering). On a real
 * denial/failure it maps the browser's `GeolocationPositionError` code to a
 * typed `SpotError` so the caller can render a clean message and keep the form
 * usable.
 *
 * Only `{ lat, lng }` is returned; the optional human `name` is added by the UI.
 */
export function getCurrentSpot(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    // Guard for SSR and browsers without the Geolocation API.
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new SpotError("unsupported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        // Map the browser error code to our typed reason. The numeric codes are
        // the GeolocationPositionError constants (PERMISSION_DENIED = 1,
        // POSITION_UNAVAILABLE = 2, TIMEOUT = 3).
        const reason: SpotErrorReason =
          err.code === err.PERMISSION_DENIED
            ? "denied"
            : err.code === err.TIMEOUT
              ? "timeout"
              : "unavailable";
        reject(new SpotError(reason, err.message));
      },
      // High-accuracy on for a precise spot; bounded timeout so the UI can't
      // hang forever; never serve a stale cached fix for a fresh capture.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

/**
 * Build a deep link that opens the device's native maps app at the pinned spot.
 *
 * Uses the universal `geo:` URI with a `q=lat,lng` query so BOTH iOS and Android
 * hand off to their default maps app (Apple Maps / Google Maps) dropping a pin
 * at the coordinates. No map library and no third-party request is involved —
 * the OS resolves the link locally.
 *
 * PRIVATE: only ever called from the owner's own view of their own catch. The
 * link stays on-device; the coordinates are never sent to Apnos or anyone else.
 */
export function mapsLink(lat: number, lng: number): string {
  const pin = `${lat},${lng}`;
  return `geo:${pin}?q=${pin}`;
}
