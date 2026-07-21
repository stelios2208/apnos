import { useEffect, useRef, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { fetchDives } from "@/lib/dives";

// ── App mode (Apnos ↔ Spearo) ────────────────────────────────────────────────
//
// "Mode" changes ONLY which bottom-nav tab set renders + the toggle UI. It does
// NOT gate/hide/redirect any route and does NOT touch theme/colors/fonts.
//
// Persistence + SSR-safety mirror use-theme.tsx (localStorage key, try/catch
// guards, a safe default that never throws on the server). The one thing theme
// gets "for free" — going app-wide via a document class + CSS — has no analogue
// here, because the nav must re-render from a JS value. So this adds the minimal
// extra: a module-level subscribe store (via useSyncExternalStore) so the toggle
// and the bottom nav share one value and update immediately, everywhere.

export type Mode = "apnos" | "spearo";

const STORAGE_KEY = "apnos-mode";

function parse(v: string | null): Mode | null {
  return v === "apnos" || v === "spearo" ? v : null;
}

/**
 * The stored mode preference, or `null` when none is set / it's invalid / we're
 * on the server. `null` is meaningful: it's the signal that the SMART default
 * (see `useModeAutoDefault`) hasn't resolved yet. SSR-safe — never throws.
 */
export function getStoredMode(): Mode | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

// Module-level cache + subscribers: one shared value, immediate updates for all
// consumers. Defaults to "apnos" — the safe, visible base every existing user
// already sees (so there's never a flash of the wrong nav for them).
let current: Mode = getStoredMode() ?? "apnos";
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

// Keep in sync across tabs, like any well-behaved localStorage-backed store.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      current = parse(e.newValue) ?? "apnos";
      emit();
    }
  });
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// getSnapshot returns the cached primitive (referentially stable between emits,
// as useSyncExternalStore requires). The server snapshot is always the safe
// base, so SSR/first paint render the Apnos nav and never a broken shell.
function getSnapshot(): Mode {
  return current;
}
function getServerSnapshot(): Mode {
  return "apnos";
}

/** Persist a new mode and broadcast it to every consumer immediately. */
export function setStoredMode(m: Mode): void {
  current = m;
  try {
    localStorage.setItem(STORAGE_KEY, m);
  } catch {
    /* ignore — persistence is best-effort, exactly like use-theme */
  }
  emit();
}

/**
 * Current app mode + a setter that persists and updates all consumers at once.
 * Always returns a concrete "apnos" | "spearo" (never undefined), so callers can
 * safely default anything that isn't exactly "spearo" to the Apnos path.
 */
export function useMode(): { mode: Mode; setMode: (m: Mode) => void } {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { mode, setMode: setStoredMode };
}

/**
 * One-time SMART default resolution. Call it ONCE from the shared shell.
 *
 *   - A valid stored preference already exists → does nothing (pure localStorage).
 *   - No stored preference + a user is logged in → check their dives ONCE:
 *       zero dives (brand-new) → "spearo";  has dives → "apnos". Either way it
 *       persists, so the decision becomes pure localStorage from then on.
 *   - Logged-out, or the dives check errors / is still loading → stays "apnos"
 *     (the safe base). Never blocks, never throws.
 *
 * The dives read reuses the SAME `["dives", userId]` query history/dashboard
 * already cache — `enabled` is gated on "still unresolved", so it fetches at
 * most once per new user and never for anyone with a stored preference.
 */
export function useModeAutoDefault(): void {
  const { user } = useAuth();
  const resolvedFor = useRef<string | null>(null);

  const unresolved = !!user && getStoredMode() === null;

  const { data: dives, isSuccess } = useQuery({
    queryKey: ["dives", user?.id],
    queryFn: () => fetchDives(user!.id),
    enabled: unresolved,
  });

  useEffect(() => {
    if (!user) return;
    if (resolvedFor.current === user.id) return; // already resolved this session
    if (getStoredMode() !== null) return; // a preference already exists
    if (!isSuccess) return; // wait for a successful check; errors → stay "apnos"
    resolvedFor.current = user.id;
    setStoredMode(dives.length > 0 ? "apnos" : "spearo");
  }, [user, isSuccess, dives]);
}
