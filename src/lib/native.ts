import { Capacitor } from "@capacitor/core";
import { Haptics } from "@capacitor/haptics";

// ── Native bridge helpers ────────────────────────────────────────────────────
// When Apnos runs inside its Capacitor shell we route haptics through the
// native Haptics plugin, which actually fires on Android/iOS regardless of the
// browser's Vibration-API quirks. In a plain browser these fall back to
// navigator.vibrate (or no-op). All Capacitor access is guarded so nothing
// touches native APIs during SSR or in an unsupported browser.

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Vibrate with a web-style pattern ([on, off, on, …] ms) or a single duration.
 * Native Haptics.vibrate takes one duration, so a pattern's "on" segments are
 * summed into a single buzz — close enough for the short cues we use.
 */
export function nativeVibrate(pattern: number | number[]): void {
  if (isNativeApp()) {
    const duration = Array.isArray(pattern)
      ? pattern.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0)
      : pattern;
    void Haptics.vibrate({ duration: Math.max(1, Math.round(duration)) }).catch(() => {
      /* plugin unavailable — nothing to do */
    });
    return;
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}
