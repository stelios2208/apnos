import { useEffect, useRef } from "react";

// ── useWakeLock ──────────────────────────────────────────────────────────────
// Holds a screen wake lock while `active` is true so the phone doesn't sleep
// mid-session. Besides keeping the timer visible, this is what actually lets
// phase-change haptics/beeps fire during a long hold — a locked/backgrounded
// page has navigator.vibrate silently dropped and its setInterval throttled.
// Re-acquires the lock when the tab becomes visible again (the OS releases it
// on blur). No-ops gracefully where the Wake Lock API is unavailable.

type WakeLockSentinelLike = { release: () => Promise<void>; released: boolean };

export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined") return;
    const wl = (
      navigator as unknown as {
        wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> };
      }
    ).wakeLock;
    if (!wl) return;

    let cancelled = false;

    const acquire = async () => {
      try {
        const sentinel = await wl.request("screen");
        if (cancelled) {
          void sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
      } catch {
        /* denied (e.g. battery saver) — nothing we can do */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinelRef.current?.released) {
        // sentinel may have been released while hidden — re-acquire
        if (!sentinelRef.current || sentinelRef.current.released) void acquire();
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const s = sentinelRef.current;
      sentinelRef.current = null;
      if (s && !s.released) void s.release();
    };
  }, [active]);
}
