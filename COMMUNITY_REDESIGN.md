# Apnos Community — Brief (copy / continue)

Ζωντανό brief για τον κοινωνικό ανασχεδιασμό (FB/Instagram feel) — ώστε να
συνεχίζουμε **χωρίς να ξαναχτίζουμε context** και **χωρίς να σπαταλάμε tokens**.
Κοινό: η παρέα freediving/spearfishing (30+), συνηθισμένη σε FB/Instagram.

## 🎯 Αρχές (να τις κρατάμε σε ΚΑΘΕ αλλαγή)

1. **Premium αίσθηση** — καθαρό, «ακριβό», minimal. Λεπτομέρεια στο spacing,
   στα avatars, στις κινήσεις (slide/scale), στα χρώματα.
2. **Πάντα λειτουργικό** — τίποτα μισοτελειωμένο. Αν κάτι χρειάζεται SQL, το
   λέμε καθαρά και ο κώδικας **degrade-άρει ευγενικά** μέχρι να τρέξει.
3. **Κοντά σε FB/Instagram, ΟΧΙ copy** — γνώριμα μοτίβα (feed, stories, likes,
   σχόλια) αλλά **δικός μας χαρακτήρας**: brand πράσινο, δικά μας σχήματα/λέξεις.
4. **Δεν χαλάμε φτιάχνοντας** — κάθε αλλαγή περνά `tsc + lint + build` πριν το
   commit· δεν αγγίζουμε άσχετα σημεία· κρατάμε το υπάρχον σε λειτουργία.
5. **Token-efficient** — στοχευμένες αλλαγές, όχι μαζικά re-reads/rewrites.

## ✅ Έτοιμα

- **Feed & προφίλ ως social wall** — full-width φωτό, Instagram-style κάρτες.
- **Stories** — ψηλές κάρτες ανά συγγραφέα· κάρτα «Δημιουργία (+)» με tip·
  fullscreen viewer με segmented bar (γραμμές μόνο όταν ανοίξει).
- **Πράσινο ring** (brand, όχι IG κόκκινο) γύρω από τα avatars.
- **Γενικά posts** (τίτλος + κείμενο + προαιρετική φωτό): composer + `PostCard`
  με ⋯ μενού (edit / share / delete) + caption more/less.
- **Likes** shared/server-backed (`feed_reactions`): καρδιά (IG κόκκινο) +
  μικρά avatars + πλήθος. **Ποιος έκανε like** → tap στη γραμμή ανοίγει
  λίστα «Άρεσε σε» (μόνο δημόσια προφίλ, privacy-safe).
- **Σχόλια** στα posts (όχι DM): `feed_comments` + bottom-sheet thread με
  composer· δουλεύει σε post/βουτιά/ψαριά/ιστορία.
- **Φωτό σε βουτιά** (STA/DYN…) — φαίνεται στο feed.
- **Friends stack** — επικαλυπτόμενα avatars + label, ανοίγει η παρέα.
- **Direct messages** μεταξύ μελών στο `/messages`.
- **Header mode switch** — μικρό sliding πράσινο pill Apnos ⇄ Spearo (text-only,
  χωρίς κύμα/ψάρι)· άμεσο switch, χωρίς σελίδα/pop-up. Σε feed & προφίλ.
- **Μενού** στο bottom nav → `/you` (το avatar tab πάει στο δικό σου προφίλ).
- Admin seeded: `techfollow.eshop@gmail.com`, `steliosmarkis@hotmail.com`.

## 🔜 Επόμενα (σειρά προτεραιότητας)

1. **Tap σε post/φωτό → άνοιγμα & scroll στα posts** (IG-style viewer): από το
   feed → scroll στο feed· από προφίλ → scroll στα posts του προφίλ.
2. **Βουτιά ως post** — editable βουτιά + τίτλος/κείμενο (shareable caption)·
   ⋯ edit/delete στην κάρτα βουτιάς (τα likes/σχόλια υπάρχουν ήδη).
3. **Ειδοποιήσεις** (like/σχόλιο/μήνυμα/υπενθύμιση προπόνησης) — θέλει push infra.
4. **Καθαρό avatar** — τα υπάρχοντα είναι 512px· re-upload για 1280px.

## 🛠 SQL στο Supabase (SQL editor — επικόλλησε το ΠΕΡΙΕΧΟΜΕΝΟ των αρχείων)

Με τη σειρά, αν δεν έχουν τρέξει ήδη (όλα idempotent):

```
supabase/migrations/20260724_feed_reactions.sql   -- likes (ποιος έκανε like)
supabase/migrations/20260724_direct_messages.sql  -- μηνύματα μελών
supabase/migrations/20260724_feed_comments.sql    -- σχόλια στα posts
```

## Σύμβαση / παγίδες

- Το Render κάνει auto-deploy από **`main`** → για να ανέβει, **merge το branch
  στο main**.
- Lovable-connected: **ποτέ** force-push / rebase / amend / squash σε pushed
  commits.
- Το data layer degrade-άρει: λείπει table (PGRST205/42P01) → άδειο· λείπει
  column (PGRST204) → drop-and-retry.
- Χρώματα: brand πράσινο `#1D9E75` (light `#5DCAA5`)· καρδιά `#ED4956`.
- Reusable: `PostReactions` (καρδιά·σχόλιο·share + likers), `CommentsSheet`,
  `LikersDialog`, `RingedAvatar`, `FriendsStack`, `StoriesRow`/`StoryViewer`.
- i18n: **κάθε** string μπαίνει και στο `en` και στο `el` (`src/lib/i18n.tsx`).
