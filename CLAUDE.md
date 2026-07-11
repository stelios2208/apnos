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
