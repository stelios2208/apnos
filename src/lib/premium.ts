// ── Freemium gate — the single source of truth ───────────────────────────────
// Every PRO decision in the app resolves through this module, wired to the
// same tips.ts-style `premium` data flags. There is still no real billing or
// entitlement backend: `hasProAccess()` is the ONE seam where a subscription
// check gets swapped in later — components must never test `premium` flags
// against anything else.
//
// Free tier (premium flag absent/false on the data):
//   · the basic 3-minute breathing session (warm-up preset `relax`)
//   · one CO₂ table and one O₂ table (the `easy` calculated presets)
//   · the free static trainer
//
// FREE TRIAL: while `FREE_TRIAL_MODE` is on, PRO items keep the "behind
// glass" premium look while browsing (badge + blur teaser via `isTeased`)
// but OPEN normally when tapped (`isLocked` is false), with a discreet
// "open for a limited time" notice. Flipping the flag off restores the hard
// lock — tap → blurred, unstartable preview — with no other code changes.

export const FREE_TRIAL_MODE = true;

export function hasProAccess(): boolean {
  return false;
}

/** Browsing-surface premium feel: PRO badge + .pro-blur teaser. Stays on
 * during the free trial so premium content still reads as premium. */
export function isTeased(item: { premium?: boolean }): boolean {
  return !!item.premium && !hasProAccess();
}

/** Hard lock: tapping shows the unstartable blurred preview instead of a
 * session. Suspended while the free trial is on. */
export function isLocked(item: { premium?: boolean }): boolean {
  return isTeased(item) && !FREE_TRIAL_MODE;
}

/** Gate for PRO features that aren't a single flagged item — custom
 * builders, FRC/RV modes, the saved-table library. */
export function canUseProFeatures(): boolean {
  return hasProAccess() || FREE_TRIAL_MODE;
}

/** The slim trial banner / overlay copy is shown only while the trial is on
 * and the user isn't already entitled. */
export function showTrialNotice(): boolean {
  return FREE_TRIAL_MODE && !hasProAccess();
}
