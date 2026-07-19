// ── Freemium gate — the single source of truth ───────────────────────────────
// Every PRO lock in the app resolves through this module, wired to the same
// tips.ts-style `premium` data flags. There is still no real billing or
// entitlement backend: `hasProAccess()` is the ONE seam where a subscription
// check gets swapped in later — components must never test `premium` flags
// against anything else.
//
// Free tier (premium flag absent/false on the data):
//   · the basic 3-minute breathing session (warm-up preset `relax`)
//   · one CO₂ table and one O₂ table (the `easy` calculated presets)
//   · the free static trainer
// Everything else — presets, programs, custom builders, and their guided
// cards — carries `premium: true` and renders as a blurred teaser when locked.

export function hasProAccess(): boolean {
  return false;
}

export function isLocked(item: { premium?: boolean }): boolean {
  return !!item.premium && !hasProAccess();
}
