# Apnos Community Redesign — Brief (copy)

A running brief of the Facebook/Instagram-style community redesign, so we can
keep building without re-deriving context. Audience: the freediving/spearfishing
crew (30+), used to FB/Instagram — but with **our own branding**, not a clone.

## ✅ Done so far

- **Feed & profile as a social wall** — full-width photos, Instagram-style cards.
- **Stories** — tall FB-style cards grouped per author; a "Create (+)" card with a
  rotating tip; fullscreen grouped viewer with segmented progress bar (segments
  only appear once opened).
- **Green ring avatars** (brand green, not IG red) around profiles.
- **General posts** (title + text + optional photo, no fish/dive required):
  composer + `PostCard` with ⋯ menu (edit / share / delete) + caption more/less.
- **Reactions** — server-backed shared likes (`feed_reactions`): heart (deep IG
  red) + share, with little liker avatars + count. Works across post/dive/catch/story.
- **Dive photos** — attach a photo to an Apnos dive (STA/DYN…), shown in the feed.
- **Friends stack** — overlapping avatars + label, expands to the crew.
- **Direct messages** between members (profile ↔ profile) at `/messages`.
- **Profile** — cover header, Edit + Share actions, own composer, friends, posts.
- **Bottom nav** — mode-aware; central "+"; profile tab is a round avatar → own profile.
- **Mode** — Apnos ⇄ Spearo, persisted (`useMode`).
- Admin seeded: `techfollow.eshop@gmail.com`, `steliosmarkis@hotmail.com`.

## 🎯 This round (priority order)

1. **Header mode toggle** — bring back the compact "old" switch look (a horizontal
   track with a sliding round knob, text-only Apnos/Spearo — NOT the wave/fish
   card). Lives in the shared header, so it shows on both feed and profile. Remove
   the separate sliders button from the profile.
2. **Menu in the bottom nav** — the old `/you` page becomes a labelled **"Μενού" /
   "Menu"** tab in the bottom navigation (no longer hidden behind a profile gear).
3. **Comments on posts** (not DMs) — the icon under each post opens **comments on
   that post**, not a direct message. New `feed_comments` table + `comments.ts` +
   a comments sheet. Reused across post/dive/catch/story like likes.
4. **Who liked** — tapping the likes row opens a "liked by" list (avatars + names).
   Distinctive, our branding — not a pixel-clone of FB/Insta. Privacy-safe: only
   public profiles are listed.

## 🔜 Still pending / parked

- Tap a post/photo → open & scroll through posts (IG-style post viewer).
- Dive-as-post: editable dive + title/text caption (likes already done).
- Push reminders/notifications (needs push infra).
- Existing avatars are 512px — re-upload for a crisp 1280px image.

## 🛠 SQL to run in Supabase (in order, if not yet applied)

```
supabase/migrations/20260724_feed_reactions.sql   -- shared likes
supabase/migrations/20260724_direct_messages.sql  -- member DMs
supabase/migrations/20260724_feed_comments.sql    -- NEW: post comments
```

## Conventions / gotchas

- Render auto-deploys from `main` → **merge the branch to main** to ship.
- Lovable-connected: never force-push / rebase / amend pushed commits.
- Data layer degrades gracefully: missing table (PGRST205/42P01) → empty; missing
  column (PGRST204) → drop-and-retry.
- Brand green `#1D9E75` (light `#5DCAA5`); heart red `#ED4956`.
</content>
</invoke>
