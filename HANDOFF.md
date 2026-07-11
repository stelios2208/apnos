# Apnos — Engineering Handoff

A practical brief for an assistant/engineer picking up a **related** project (e.g. a
spearfishing companion app). It documents how Apnos is actually built today, what
to reuse, and where the sharp edges are. No secrets, keys, or passwords are
included.

> **What Apnos is:** a bilingual (Greek/English) freediving training log —
> dives & personal bests, warm-ups and CO₂/O₂ training tables, a guided static
> (STA) trainer with voice/haptic/soundscape cues, a dive planner, a coach tool,
> competition results, and public rankings. Mobile-first PWA, wrapped as a native
> app via Capacitor.

---

## 1. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| **Framework** | [TanStack Start](https://tanstack.com/start) (SSR) + React 19 | File-based routing via TanStack Router; SSR through Nitro. |
| **Language** | TypeScript (strict) | Path alias `@/*` → `src/*`. |
| **Styling** | Tailwind CSS v4 + shadcn/ui | Dark theme is the default (`<html class="dark">`); a light theme + theme toggle exist. Primitives in `src/components/ui/`. |
| **Backend** | **None of our own** | No custom API/server layer. The browser talks to Supabase directly. |
| **Database** | Supabase (Postgres) | Row-Level Security (`auth.uid() = user_id`) is the *only* authorization layer. |
| **Auth** | Supabase Auth | Email/password (`signInWithPassword` / `signUp`). No OAuth wired yet. Session persisted in `localStorage`, SSR-aware. |
| **File storage** | Supabase Storage | Public bucket `voice-cues` for per-user recorded voice cues. |
| **Hosting** | Render (primary) + Vercel | Render: `NITRO_PRESET=node-server npm run build`, serves `.output/server/index.mjs` (`render.yaml`). `vercel.json` rewrites all to `/`. |
| **Native app** | Capacitor 7 | Thin WebView shell that loads the live deployment via `server.url`; injects the native bridge so the **Haptics** plugin works. See `CAPACITOR.md`. |
| **Payments** | **None implemented** | See §4. |
| **Audio** | Web Audio API (hand-rolled) | Zero external audio assets — beeps, ambience, and cue playback are synthesized/streamed. |
| **Tooling** | ESLint (flat config, Prettier-as-rule), `tsc --noEmit` | **No test suite exists.** Verification = typecheck + lint + production build (+ manual/Playwright screenshots). |
| **Package manager** | npm (and bun) | Both `package-lock.json` and `bun.lock` are committed; `bunfig.toml` enforces a 24h supply-chain guard. |

### Connected services / build gotchas
- The repo is connected to **Lovable** (see `AGENTS.md`): **never rewrite pushed
  git history** (no force-push / rebase / amend / squash of pushed commits). Pushed
  commits sync back into the Lovable editor and trigger deploys.
- `vite.config.ts` uses `@lovable.dev/vite-tanstack-config`, which already bundles
  tanstackStart, React, Tailwind, tsconfig paths, Nitro, and a custom server entry.
  **Do not** add those Vite plugins manually — duplicates break the build.
- `src/routeTree.gen.ts` is auto-generated. Never edit it.

---

## 2. Architecture & folder structure

```
src/
  routes/                 # File-based routes — every .tsx here is a page
    __root.tsx            # App shell: QueryClient, I18nProvider, AuthProvider,
                          #   sonner Toaster, SEO meta, 404 + error boundaries
                          #   (theme is applied via hooks/use-theme.tsx, not a root provider)
    index.tsx             # Landing / dashboard entry
    auth.tsx              # Sign in / sign up
    log.tsx               # Log a dive (create/edit)
    history.tsx           # Dive history list
    dive.$id.tsx          # Dive detail (incl. structured STA "session breakdown")
    calendar.tsx          # Month calendar; dive dots + planned-dive water-drop indicator
    planner.tsx           # "Plan your dive": target, top time, warm-up, live countdown
    train.tsx             # Training hub
    sta-trainer.tsx       # Unified "Static Trainer" hub (Breathwork / Tables / Free static)
    sta-tables.tsx        # CO₂/O₂ table builder + runner
    warmup.tsx            # Warm-up / breathwork programs
    stopwatch.tsx         # Plain stopwatch → log as STA
    coach.tsx / coach.index.tsx / coach.athlete.$id.tsx   # Coach tool (athletes + programs)
    rankings.tsx          # Public competition rankings
    profile.tsx / you.tsx / settings.tsx / equipment.tsx / rules.tsx / tips.tsx
    discipline.$code.tsx  # Per-discipline PB view
    sitemap[.]xml.ts      # Generated sitemap

  components/
    AppLayout.tsx         # Page chrome / nav
    trainer/              # FreeTrainer, WarmupTool, TablesTool, FxControls, HoldAlertsCard
    PlannerWarmup.tsx     # Inline warm-up runner embedded in the planner
    TableCard.tsx, LogoBreathPacer.tsx, UnderwaterScene.tsx, Bubbles.tsx,
    ShareCard.tsx, VoiceCuesModal.tsx, PBChart.tsx, TimeInput.tsx, Logo.tsx
    ui/                   # shadcn/ui primitives (config in components.json)

  lib/                    # Plain async fns + domain logic (the real "backend")
    diving.ts             # Domain model: 8 disciplines, StaConditions, Dive type, formatters
    dives.ts              # dives CRUD, personalBests(), CSV export, logStaHold()
    dive-plans.ts         # Dive planner — localStorage only (no DB)
    warmups.ts            # Warm-up presets + custom (localStorage), rounds<->steps
    sta-tables.ts         # CO₂/O₂/FRC/RV preset math + sta_tables persistence
    athletes.ts           # Coach athletes + training programs (Supabase)
    competitions.ts       # Competition results + rankings (Supabase)
    profile.ts            # Athlete profile — stored in Supabase auth user_metadata
    trainer-fx.ts         # beep(), vibrate(), CuePlayer, SoundscapeEngine, FxSettings
    voice-cues.ts         # Upload/list/delete recorded cues in Supabase Storage
    native.ts             # Capacitor bridge: isNativeApp(), nativeVibrate()
    i18n.tsx              # Hand-rolled el/en dictionary + useI18n()
    share-card.ts         # SVG→PNG share-card generator (result & program cards)
    tips.ts               # Static knowledge cards (has a `premium` flag scaffold)
    error-capture.ts / error-page.ts / lovable-error-reporting.ts   # SSR error chain
    utils.ts              # cn() classnames helper

  hooks/
    use-auth.tsx          # AuthProvider + useAuth() (Supabase session)
    use-theme.tsx         # Light/dark theme
    use-session-fx.ts     # Aggregates voice + haptics + soundscape for trainers
    use-wake-lock.ts      # navigator.wakeLock wrapper (keeps timers/haptics alive)
    use-mobile.tsx

  integrations/supabase/client.ts   # Hardcoded URL + anon key, SSR-aware session opts

supabase/migrations/      # Plain SQL, applied manually to the hosted project
```

### Key architectural decisions
- **No backend tier.** All data access is Supabase-client calls wrapped in
  `src/lib/*.ts`, consumed by routes via TanStack Query (`useQuery`), keyed on the
  authenticated user id from `useAuth()`. Authorization is 100% Postgres RLS.
- **Graceful schema degradation.** The deployed DB can lag the code. Writes catch
  PostgREST "missing column/relation" errors (`PGRST204` / `PGRST205` / `42P01`),
  drop the offending field, and retry — so features keep working before a migration
  is applied. Follow this pattern (see `dives.ts`, `sta-tables.ts`) for new columns.
- **SSR error chain** (keep intact when touching server entry): `src/start.ts`
  (request middleware) → `src/server.ts` (custom server entry, detects h3-swallowed
  errors) → `error-capture.ts` / `error-page.ts`, plus client boundary reporting via
  `lovable-error-reporting.ts`. This prevents raw h3 500s from reaching users.
- **Zero-asset audio.** No mp3s. `beep()`, the `SoundscapeEngine` (filtered-noise
  water/wind bed + pentatonic "kalimba" plucks + bird chirps), and cue playback are
  all Web Audio. Keeps the bundle tiny and avoids asset licensing.
- **Native-safe guards.** Anything touching Capacitor or browser-only APIs
  (`navigator.vibrate`, `wakeLock`, `window`, `localStorage`) is guarded so SSR and
  unsupported browsers degrade instead of crashing.

---

## 3. Data model

Two persistence tiers coexist:
- **Supabase (Postgres, synced, RLS-protected):** dives, sta_sessions, sta_tables,
  coach_athletes, competition_results, plus profile in auth metadata and voice cues
  in Storage.
- **localStorage (device-only, not synced):** dive plans, custom warm-ups, FX
  settings, theme. *These do not roam across devices* — a known limitation (§5).

### Core entities

**`auth.users`** (Supabase-managed) — the account. `user_metadata.profile` holds the
`AthleteProfile` (display name, birthdate, gender, height/weight, country/city, bio,
`isPublic`). No separate `profiles` table yet.

**`dives`** — the central log. One row per logged attempt.
- Identity/result: `user_id`, `discipline` (one of 8 codes), `result` (seconds for
  time disciplines, metres for distance), `session_type` (`training`|`competition`),
  `federation`, `dive_date`, `dive_time`, `is_personal_best`, `created_at`.
- Wellness/context: `sleep_hours`, `food_notes`, `mental_state`, `notes`.
- Gear (migration `..._dives_gear_conditions`): `neck_weight`, `belt_weight`,
  `wetsuit_mm`, `buoyancy`, `fins_type`, `fins_brand`, `fins_model`, `foot_pocket`,
  `water_temp`.
- `conditions` **jsonb** (migration `..._dives_conditions`): STA-specific
  `StaConditions` (posture, dry/wet, face cover + noseclip, room temp, breathe-up
  rhythm, warm-up used). One JSONB column instead of many sparse columns.
- **Convention:** completed STA training sessions (warm-ups, tables, free static)
  are logged as `dives` rows whose `notes` embed a `Rounds: [JSON]` block
  (`{breathe, hold, recovery, contractions}` per round). `dive.$id.tsx` detects that
  marker and renders a structured "session breakdown" table. Reuse this shape for any
  round-based session so it renders for free.

**`sta_sessions`** — richer structured record of a guided free-static session
(`rounds` jsonb, `best_hold`, `avg_hold`, `total_rounds`). Written alongside a `dives`
row by the free trainer. RLS owner-only.

**`sta_tables`** — user's saved CO₂/O₂ training tables (`name`, `type` co2|o2,
`breathing_mode` normal|frc|rv, `rounds` jsonb). RLS owner-only.

**`coach_athletes`** — a coach's roster. `name`, `level`, `disciplines` text[],
`programs` jsonb (array of `TrainingProgram`, each holding `ProgramRow`s that are
`STARound` | `DynSet` | `DepthDive`). RLS owner-only (a coach sees only their own
athletes).

**`competition_results`** — feeds public rankings. `athlete_name`, `gender`,
`discipline`, `federation`, `result`, `competition_name`, `location`, `country`,
`competition_date`, `is_national_record`, `is_public`. **RLS differs here:** SELECT is
allowed for `is_public = true` **or** own rows (so rankings are cross-user readable);
writes remain owner-only. Indexed on `(discipline, federation, result desc)`.

**Storage bucket `voice-cues`** — per-user recorded cue audio at
`<uid>/<lang>/<key>`. Public read (so `<audio>` can stream), owner-only
write/delete.

### Relationships (all user-scoped)
```
auth.users 1─┬─* dives
             ├─* sta_sessions
             ├─* sta_tables
             ├─* coach_athletes ──* TrainingProgram ──* ProgramRow (jsonb)
             ├─* competition_results   (public-readable)
             └─* voice-cues objects (Storage)
   user_metadata.profile   (AthleteProfile, inline)
   localStorage: DivePlan[], custom WarmupPreset[], FxSettings, theme
```
Everything hangs off `user_id`; there are no cross-user foreign keys. "Personal
bests" are **computed in the client** (`personalBests()` in `dives.ts`), not stored.

---

## 4. Business / monetization model (as implemented in code)

**There is no monetization implemented.** No Stripe/PayPal/IAP, no subscription,
paywall, billing, entitlement check, or price anywhere in the codebase. Every
feature is free.

What exists is **scaffolding for a future paid tier**, deliberately non-functional:
- `Tip.premium?: boolean` in `lib/tips.ts` — a few knowledge cards are flagged
  `premium: true` and render an "ADV"/"ΠΡΟΧ." badge (`routes/tips.tsx`), but nothing
  gates access; the flag is cosmetic today. The comment states the intent: "*All free
  for now; the `premium` flag lets a paid tier be layered in later without
  restructuring.*"
- "Premium" elsewhere in the code refers to **visual polish** (premium accent icons,
  the shareable result card), not a paywall.

Implication for a related app: monetization is greenfield. If you add it, the natural
seams are (a) an entitlement column/table in Supabase + an RLS/`useQuery` gate, and
(b) reusing the existing `premium` flag pattern to mark gated content. Native IAP
would go through Capacitor plugins; web billing would need a real server function
(there is none today — you'd add the first backend endpoint).

---

## 5. What worked well · what was hard · technical debt

### Worked well
- **Supabase + RLS as the whole backend.** Shipping CRUD features with zero server
  code was fast; per-user isolation is enforced in one place (the policy).
- **`lib/` as a thin data layer.** Plain async functions + TanStack Query gave clean,
  cache-keyed data access without a state-management framework.
- **Zero-asset Web Audio.** Beeps, ambience, and cue playback with no bundled media —
  small bundle, no licensing, fully offline-capable audio.
- **Graceful schema degradation.** The PGRST drop-and-retry pattern let code ship
  ahead of manually-applied migrations without breaking logging.
- **Structured-notes convention** (`Rounds: [JSON]` inside `dives.notes`) let three
  different session types (free static, warm-ups, tables) all render in one detail UI
  with no schema change.

### Hard / painful
- **Vibration.** The web Vibration API is a silent no-op on iOS and unreliable on
  Android/Samsung (ignored when backgrounded/locked, gated behind a user gesture).
  This drove the whole Capacitor adoption so native **Haptics** could bypass it.
  `use-wake-lock.ts` was added to stop the OS throttling timers mid-hold.
- **Background-safe timers.** Naive `setInterval` counters drift when a tab is
  backgrounded. Timers were rewritten to **wall-clock math**
  (`elapsed = Date.now() - startedAt - pausedAccum`) so they self-correct.
- **SSR vs browser-only APIs.** Constant guarding of `window`, `navigator`,
  `localStorage`, `wakeLock`, and Capacitor to keep SSR from crashing.
- **h3 swallowing SSR errors** into raw 500s — required the bespoke server-entry
  error-capture chain.
- **Manual migrations + a DB that lags the code** — no local Supabase; migrations are
  pasted into the hosted SQL editor by hand, so "did the column ship?" is a real
  question the code has to tolerate.

### Technical debt / watch-outs
- **No test suite at all.** Verification is typecheck + lint + build + manual checks.
  A related app should add tests early.
- **Two persistence tiers.** Dive **plans** and **custom warm-ups** live only in
  `localStorage` → they don't sync across devices and vanish if storage is cleared.
  Promoting these to Supabase tables (with RLS) is the obvious next step.
- **Profile in auth `user_metadata`.** Fine for now, but not queryable/joinable;
  public profiles + rankings will need a real `profiles` table.
- **PBs computed client-side** — fine at current scale, but every PB view refetches
  and recomputes.
- **Hardcoded Supabase URL + anon key** in `integrations/supabase/client.ts` (the
  anon key is a public client key by design, but it's committed rather than env-based;
  the key is intentionally **not reproduced in this document**). Env-based config would
  be cleaner for multi-environment work.
- **`capacitor.config.ts` `server.url` is a placeholder** — must be set to the real
  production domain before building the native app.
- **i18n is a hand-rolled dictionary.** Every user-facing string needs an entry in
  **both** `el` and `en`; easy to forget one. Domain data carries paired fields
  (`name`/`name_el`, `title_en`/`title_el`).
- **No PR-preview gate on `main`** — `main` is the Lovable-connected, auto-deploying
  branch, so commits there go live immediately.

---

## 6. Reusable pieces for a future spearfishing feature / app

A spearfishing app shares a lot with freediving (depth, breath-hold, gear, sessions,
conditions, safety). These modules are close to drop-in:

**Directly reusable (little/no change):**
- **`lib/native.ts`** — `isNativeApp()` + `nativeVibrate()`. Capacitor haptics with
  browser fallback. Copy as-is.
- **`hooks/use-wake-lock.ts`** — keep the screen/timer alive during a dive or a
  surface-interval countdown. Copy as-is.
- **`lib/trainer-fx.ts`** — `beep()`, `vibrate()`, `SoundscapeEngine` (zero-asset
  ambience), `CuePlayer`, `FxSettings` persistence, `testHapticPulse()`. A
  spearfishing "dive timer / surface-interval" screen wants exactly these cues.
- **`hooks/use-session-fx.ts`** — bundles voice+haptics+soundscape for any guided
  timed session (e.g. breathe-up before a spearfishing drop).
- **`lib/voice-cues.ts` + `components/VoiceCuesModal.tsx`** — record/store/play
  per-user voice cues via Supabase Storage. Reusable for any spoken prompts.
- **`lib/share-card.ts` + `components/ShareCard.tsx`** — SVG→PNG social share cards
  (`buildShareSvg`, `svgToPngBlob`, `shareOrDownload`). Swap the layout, keep the
  pipeline — great for "my catch / my dive" cards.
- **`lib/i18n.tsx`** — the `el`/`en` dictionary + `useI18n()` hook pattern.
- **SSR error chain** (`start.ts` / `server.ts` / `error-capture.ts` /
  `error-page.ts`) and the **`__root.tsx` provider stack** — lift wholesale for a new
  TanStack Start app.
- **Auth**: `hooks/use-auth.tsx` + `integrations/supabase/client.ts` pattern (point at
  a new project, keep the SSR-aware session options).
- **UI kit**: `components/ui/*` (shadcn), `UnderwaterScene`, `Bubbles`,
  `LogoBreathPacer` — the whole "underwater" visual language.
- **Capacitor shell** (`capacitor.config.ts` + `CAPACITOR.md`) — same WebView-loads-
  live-site approach.

**Reusable with adaptation:**
- **Domain model (`lib/diving.ts`)** — the discipline/unit/`formatResult` shape and
  especially the **`conditions` JSONB pattern** map cleanly onto spearfishing
  (visibility, current, water temp, depth zone, weight, gun/gear, buoyancy).
- **`lib/dives.ts` + the `dives` schema + `Rounds:[JSON]` structured-notes
  convention** — a "dive log" is a "spearfishing dive/drop log" with different fields;
  keep the RLS + graceful-degradation + client-side-PB patterns.
- **Gear model** (the `dives` gear columns / `equipment.tsx`) — rename freediving gear
  to spearfishing gear (gun, spear, float line, wetsuit, weight).
- **Planner** (`planner.tsx` + `PlannerWarmup.tsx` + inline wall-clock countdown) — a
  strong base for a "plan a spearfishing session" screen (spot, tide/top time,
  warm-up, safety buddy, surface intervals).
- **Calendar** (`calendar.tsx`) — the month grid with per-day indicators and a
  tap-to-detail panel; already handles both logged and planned entries.

**Shared-infra opportunity:** because there's no backend, a spearfishing app could
share the **same Supabase project** (add spearfishing tables with the same
`auth.uid() = user_id` RLS), reuse the same auth users, and share the `lib/` data-
layer conventions — turning "two apps" into "two front-ends over one data layer."

---

## Quick start for the next assistant

```sh
npm install
npm run dev          # port 3000
npm run lint         # ESLint (+ Prettier as a rule)
npx tsc --noEmit     # typecheck (no dedicated script)
NITRO_PRESET=node-server npm run build   # production build (Render target)
```
No tests to run. Verify changes with typecheck + lint + build (+ manual/Playwright
screenshots for UI). Respect the Lovable constraint: **never rewrite pushed history**,
keep `main` deployable. Read `CLAUDE.md`, `AGENTS.md`, and `CAPACITOR.md` for the
finer rules.
