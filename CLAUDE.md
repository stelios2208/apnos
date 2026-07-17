# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Apnos is a freediving training log (dives, personal bests, warm-ups, trainers, coach tools) built on TanStack Start (SSR) + React 19 + Supabase + Tailwind CSS v4 + shadcn/ui. The UI is bilingual (Greek/English).

This project is connected to [Lovable](https://lovable.dev) (see `AGENTS.md`): **never rewrite published git history** (no force-push, rebase, amend, or squash of pushed commits), and keep the connected branch in a working state — pushed commits sync back into the Lovable editor.

## Commands

```sh
npm run dev        # dev server on port 3000
npm run build      # production build (Nitro; NITRO_PRESET=node-server for Render)
npm run lint       # ESLint (flat config, includes Prettier as a rule)
npm run format     # prettier --write .
npx tsc --noEmit   # typecheck (no dedicated script)
```

There is no test suite. Both `bun.lock` and `package-lock.json` exist; `bunfig.toml` enforces a 24-hour supply-chain guard on new package versions — confirm with the user before adding any package to its exclude list.

## Architecture

### Routing (TanStack Start, file-based)

Every `.tsx` file in `src/routes/` is a route — see `src/routes/README.md` for the naming conventions (`$id` for dynamic params, `__root.tsx` as the only root layout). Do **not** create `src/pages/` or Next.js/Remix-style directories. `src/routeTree.gen.ts` is auto-generated; never edit it.

- `src/routes/__root.tsx` — app shell: global providers (QueryClient, `I18nProvider`, `AuthProvider`, sonner `Toaster`), SEO meta/fonts, 404 and error boundaries. Preserve `<Outlet />`.
- Routes set their own page title via `head: () => ({ meta: [{ title: "… — Apnos" }] })` and wrap their content in `<AppLayout>` (`src/components/AppLayout.tsx`).
- `vite.config.ts` uses `@lovable.dev/vite-tanstack-config`, which already bundles tanstackStart, React, Tailwind, tsconfig paths, Nitro, etc. — do not add those plugins manually or the build breaks with duplicates.

### Data layer (Supabase, client-side)

There is no custom backend/API layer. All data access goes through the Supabase JS client (`src/integrations/supabase/client.ts` — hardcoded URL + anon key, SSR-aware session options) and is authorized by per-user RLS policies (`auth.uid() = user_id`).

- `src/lib/*.ts` holds plain async functions wrapping Supabase queries (`dives.ts`, `athletes.ts`, `competitions.ts`, `dive-plans.ts`, `warmups.ts`, `profile.ts`, …). Routes consume them with TanStack Query (`useQuery`), keyed on the authenticated user's id from `useAuth()` (`src/hooks/use-auth.tsx`).
- Domain model lives in `src/lib/diving.ts`: the 8 discipline codes (STA/DYN/DYNB/DNF pool, CWT/CWTB/CNF/FIM depth), each with a `time` or `distance` unit, plus `formatResult` and Greek/English names.
- Migrations are plain SQL files in `supabase/migrations/` applied to the hosted project manually — there is no local Supabase config. Because the deployed DB may lag behind the code, the data layer degrades gracefully when a column is missing: see the PGRST204 drop-and-retry pattern in `src/lib/dives.ts` and follow it when adding new columns.

### i18n

`src/lib/i18n.tsx` is a hand-rolled dictionary (`en` and `el`) with a `useI18n()` hook. Every user-facing string needs an entry in **both** dictionaries; domain data carries paired fields (`name`/`name_el`, `title_en`/`title_el`).

### SSR error handling

A deliberate chain keeps SSR crashes from rendering raw h3 500s: `src/start.ts` (request middleware) → `src/server.ts` (custom server entry, wired in `vite.config.ts`, detects h3-swallowed errors) → `src/lib/error-capture.ts` / `error-page.ts`, with client-side boundary reporting via `src/lib/lovable-error-reporting.ts`. Keep this wiring intact when touching server entry or root error components.

### Deployment

Render is the primary target (`render.yaml`: `NITRO_PRESET=node-server npm run build`, serves `.output/server/index.mjs`); `render-server.mjs` is a fallback Node server supporting both old and new build layouts. `vercel.json` only rewrites everything to `/`.

### Native app (Capacitor)

Phones run a Capacitor shell (`capacitor.config.ts`) that loads the live deployment via `server.url` in a native WebView — see `CAPACITOR.md`. Native access goes through `src/lib/native.ts` (`isNativeApp()`, `nativeVibrate()`), which `src/lib/trainer-fx.ts` `vibrate()` delegates to, so haptics use the native Haptics plugin in the app and fall back to `navigator.vibrate` in a browser. Keep all Capacitor usage guarded so it's SSR-safe. `/android` and `/ios` are git-ignored (generated with `npx cap add …`).

## Conventions

- Path alias `@/*` → `src/*`.
- shadcn/ui primitives live in `src/components/ui/` (config in `components.json`); shared app components in `src/components/`.
- Prettier: 100-char width, double quotes, semicolons, trailing commas. ESLint has `@typescript-eslint/no-unused-vars` off and forbids importing `server-only` (use `*.server.ts` naming instead).
- Dark theme is the default (`<html class="dark">` in the root shell).

## Context Snapshot

Condensed handoff (see `HANDOFF.md` for the full reference brief).

**Stack / infra**
- TanStack Start (SSR, file-based routing) + React 19 + TypeScript strict; Nitro server.
- Supabase (Postgres + Auth + Storage) is the entire backend — no custom API tier; authz = RLS `auth.uid() = user_id`.
- Tailwind v4 + shadcn/ui; Web Audio API (zero audio assets); Capacitor 7 native shell (WebView loads live site, native Haptics).
- Hosting: Render (primary, `NITRO_PRESET=node-server`) + Vercel (rewrite-all). Connected to Lovable → `main` auto-deploys, **never rewrite pushed history**.
- Tooling: ESLint (Prettier-as-rule) + `tsc --noEmit`. **No tests** — verify via typecheck + lint + build.

**Folder structure**
- `src/routes/*.tsx` — pages (`__root.tsx` shell; `$id` dynamic; `routeTree.gen.ts` auto-gen, never edit).
- `src/components/` — app components + `trainer/` + `ui/` (shadcn); `src/lib/*.ts` — data layer + domain logic (the real "backend").
- `src/hooks/` — `use-auth`, `use-theme`, `use-session-fx`, `use-wake-lock`; `src/integrations/supabase/client.ts`; `supabase/migrations/` (manual SQL).

**Completed features**
- Dive log (8 disciplines) + client-computed personal bests + CSV export; dive detail with structured STA "session breakdown".
- Warm-ups / breathwork, CO₂/O₂ tables (builder + runner), guided free-static trainer (voice + haptic + soundscape cues), stopwatch→STA.
- Dive planner (localStorage), calendar (logged + planned), coach tool (athletes + programs), competition results + public rankings.
- Bilingual EL/EN, light/dark themes, profile, equipment, public SEO pages (landing, CO₂/O₂ tables), sitemap, share cards, native haptics.

**Design system**
- Fonts: `Outfit` (display/headings, `--font-display`), `Inter` (body, `--font-sans`).
- Palette (OKLCH): deep-navy background `0.16 0.025 255`; teal primary/accent/ring `0.66 0.115 168` (glow `0.74 0.13 172`); cards `0.21 0.03 258`; destructive red `0.62 0.2 18`.
- Signature: `--gradient-ocean`, `--shadow-glow`, underwater visual language (`UnderwaterScene`, `Bubbles`, `LogoBreathPacer`). Dark is default; training screens stay hard-coded dark even in light theme.

**Known issues / debt**
- No test suite. Dive **plans** + custom **warm-ups** + FX settings live only in `localStorage` (no cross-device sync).
- Profile stored in auth `user_metadata` (not queryable) — no `profiles` table yet. PBs recomputed client-side each view.
- Supabase URL + anon key hardcoded (not env-based). `capacitor.config.ts` `server.url` must be set to prod domain before native build.
- Deployed DB can lag code → data layer uses PGRST204/205/42P01 drop-and-retry; i18n dictionary is hand-rolled (easy to miss one language).

**Roadmap priorities**
1. Promote `localStorage` data (plans, warm-ups) to Supabase tables with RLS.
2. Real `profiles` table for public profiles + rankings joins.
3. Add tests (start with `lib/` domain math). 4. Env-based Supabase config. 5. Monetization is greenfield — `premium` flag in `tips.ts` is cosmetic scaffolding only.

**Conventions** (see `## Conventions` above for full list)
- `@/*` → `src/*`; Prettier 100-col / double-quotes / semicolons / trailing commas.
- Every user-facing string in **both** `el` + `en`; domain data carries paired fields (`name`/`name_el`).
- Round-based sessions log as `dives` rows with a `Rounds: [JSON]` block in `notes` to reuse the detail-view breakdown. New Supabase columns follow the drop-and-retry degradation pattern.
