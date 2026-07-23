import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trophy, Waves, ClipboardList, CalendarDays, History, Users } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { StoriesRow } from "@/components/StoriesRow";
import { PromoBanner } from "@/components/PromoBanner";
import { PostReactions } from "@/components/PostReactions";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";
import { useAuth } from "@/hooks/use-auth";
import {
  listPublicProfiles,
  listFeedDives,
  type SocialProfile,
  type FeedDive,
} from "@/lib/profiles";
import { listFeedPosts, deletePost, type CommunityPost } from "@/lib/posts";
import { deleteCatchPhoto } from "@/lib/spearo-photos";
import { disciplineName, formatResult, type DisciplineCode } from "@/lib/diving";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { nativeVibrate } from "@/lib/native";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Apnos" }] }),
  component: () => (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  ),
});

// Gold medal chip surface — identical to the records/feed PB medal.
const MEDAL_GOLD = "linear-gradient(135deg, #F7CE73 0%, #EF9F27 55%, #C97F16 100%)";

// Discipline-themed underwater gradients: dives carry no photos, so each feed
// card gets a deep-water backdrop whose hue tracks the discipline — pool
// disciplines sit in the teal/cyan band, depth disciplines sink toward
// indigo/navy. Derived from the shared underwater palette; no new assets.
const DISCIPLINE_HUE: Record<DisciplineCode, number> = {
  STA: 168,
  DYN: 188,
  DYNB: 200,
  DNF: 210,
  CWT: 220,
  CWTB: 232,
  CNF: 244,
  FIM: 256,
};

function disciplineGradient(code: DisciplineCode): string {
  const h = DISCIPLINE_HUE[code] ?? 210;
  return `linear-gradient(180deg, hsl(${h},55%,24%) 0%, hsl(${h + 10},60%,12%) 60%, #02101d 100%)`;
}

// ── Dashboard = the Apnos community feed ──────────────────────────────────────
// The freediving home mirrors the Spearo one: public-athlete avatars row (same
// AvatarBubble component), a quick-chips row into the training hubs, and the
// shared-dive feed from the sanitized feed_dives view (result data only — no
// notes, wellness, gear or conditions exist in the payload). Author identity is
// stitched CLIENT-SIDE from profiles (two queries + a map, no embedding).
// Logging stays on the bottom-nav "+" (→ /log).

function Dashboard() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const el = lang === "el";
  const qc = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["public-profiles"],
    queryFn: () => listPublicProfiles(50),
    enabled: !!user,
  });

  const { data: feed = [], isLoading: feedLoading } = useQuery({
    queryKey: ["feed-dives"],
    queryFn: () => listFeedDives({ limit: 30 }),
    enabled: !!user,
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["feed-posts"],
    queryFn: () => listFeedPosts({ limit: 30 }),
    enabled: !!user,
  });

  const profileByUser = useMemo(() => new Map(profiles.map((p) => [p.user_id, p])), [profiles]);
  const isLoading = profilesLoading || feedLoading || postsLoading;

  // Delete own post — best-effort photo cleanup, then refresh the feed.
  const deletePostMutation = useMutation({
    mutationFn: async (p: CommunityPost) => {
      await deletePost(p.id);
      if (p.photo_url) await deleteCatchPhoto(p.photo_url).catch(() => {});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed-posts"] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error"),
  });

  // Interleave free-form posts with shared dives, newest first — the real feed.
  const items = useMemo(() => {
    const merged: (
      | { kind: "post"; date: number; post: CommunityPost }
      | { kind: "dive"; date: number; dive: FeedDive }
    )[] = [
      ...posts.map((p) => ({ kind: "post" as const, date: +new Date(p.created_at), post: p })),
      ...feed.map((d) => ({ kind: "dive" as const, date: +new Date(d.created_at), dive: d })),
    ];
    return merged.sort((a, b) => b.date - a.date);
  }, [posts, feed]);

  // Quick access into the existing training hubs — routes unchanged.
  const chips = [
    { to: "/train", icon: Waves, label: el ? "Προπόνηση" : "Train" },
    { to: "/planner", icon: ClipboardList, label: el ? "Πλάνο" : "Plan" },
    { to: "/calendar", icon: CalendarDays, label: el ? "Ημερολόγιο" : "Calendar" },
    { to: "/history", icon: History, label: el ? "Ιστορικό" : "History" },
  ] as const;

  return (
    <div className="space-y-4 pb-24">
      {/* our promo / tips slot (replaces the old oversized community hero) */}
      <PromoBanner variant="apnos" />

      {/* Facebook-style stories row — the (+) tile opens the post composer */}
      <StoriesRow
        profiles={profiles}
        fallbackName={el ? "Αθλητής" : "Athlete"}
        mode="apnos"
        onCreate={() => setComposerOpen(true)}
      />

      {/* quick chips into the training hubs (train · plan · calendar · history) */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {chips.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            onClick={() => nativeVibrate(10)}
            className="pressable surface-1 flex shrink-0 items-center gap-2 rounded-full py-2 pl-2 pr-4"
            style={{
              background: "rgba(29,158,117,0.08)",
              border: "1px solid rgba(93,202,165,0.2)",
            }}
          >
            <span
              className="flex size-7 items-center justify-center rounded-full"
              style={{ background: "rgba(29,158,117,0.16)" }}
            >
              <Icon className="size-3.5" style={{ color: "#5DCAA5" }} />
            </span>
            <span className="text-xs font-semibold text-foreground/80">{label}</span>
          </Link>
        ))}
      </div>

      {/* free-form post composer ("what's on your mind?") */}
      <PostComposer open={composerOpen} onOpenChange={setComposerOpen} />

      {/* community feed — free-form posts interleaved with shared dives */}
      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div
          className="surface-2 relative overflow-hidden rounded-2xl p-10 text-center"
          style={{
            background:
              "linear-gradient(180deg, #0d4a63 0%, #0a3852 30%, #072a42 55%, #041a2e 80%, #02101d 100%)",
          }}
        >
          <div className="relative z-10 flex flex-col items-center">
            <div
              className="surface-1 flex size-16 items-center justify-center rounded-full"
              style={{ background: "rgba(29,158,117,0.18)" }}
            >
              <Users className="size-8" style={{ color: "#5DCAA5" }} />
            </div>
            <p className="mt-4 max-w-xs font-semibold text-white">
              {el
                ? "Η κοινότητα ξεκινάει εδώ — κοινοποίησε μια προσπάθεια."
                : "The community starts here — share an effort."}
            </p>
          </div>
        </div>
      ) : (
        // full-bleed on phones (edge-to-edge like Facebook), rounded card on wide
        <ul className="-mx-4 space-y-2.5 sm:mx-0">
          {items.map((it) =>
            it.kind === "post" ? (
              <PostCard
                key={`post-${it.post.id}`}
                post={it.post}
                author={profileByUser.get(it.post.user_id)}
                fallbackName={el ? "Αθλητής" : "Athlete"}
                currentUserId={user?.id}
                onDelete={(p) => deletePostMutation.mutate(p)}
              />
            ) : (
              <FeedDiveCard
                key={`dive-${it.dive.id}`}
                dive={it.dive}
                author={profileByUser.get(it.dive.user_id)}
                fallbackName={el ? "Αθλητής" : "Athlete"}
                lang={el ? "el" : "en"}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

// One shared dive in the community feed. No photos exist for dives, so the
// card leans on the discipline-themed underwater gradient; the RESULT is the
// hero (formatResult), with a gold PB medal when the dive is a personal best.
// Renders ONLY sanitized feed_dives columns. Taps through to the athlete page.
function FeedDiveCard({
  dive: d,
  author,
  fallbackName,
  lang,
}: {
  dive: FeedDive;
  author?: SocialProfile;
  fallbackName: string;
  lang: "el" | "en";
}) {
  const code = d.discipline as DisciplineCode;
  const name = author?.display_name || fallbackName;
  const color = athleteColor(d.user_id);
  const dateStr = new Date(d.dive_date).toLocaleDateString(lang === "el" ? "el-GR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <li className="surface-2 overflow-hidden border-y border-border/50 sm:rounded-2xl sm:border">
      {/* post header — author identity, taps through to the athlete page */}
      <Link
        to="/athlete/$id"
        params={{ id: d.user_id }}
        onClick={() => nativeVibrate(10)}
        className="pressable flex items-center gap-2.5 p-3"
      >
        {author?.avatar_url ? (
          <img
            src={author.avatar_url}
            alt=""
            className="size-9 shrink-0 rounded-full object-cover"
            style={{ border: `1.5px solid ${color}77` }}
          />
        ) : (
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
            style={{ background: `${color}33`, color: "#fff", border: `1.5px solid ${color}77` }}
          >
            {athleteInitials(name)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
          <span className="block text-[0.65rem] text-foreground/45">{dateStr}</span>
        </span>
      </Link>

      {/* post body — the dive result on its discipline-themed underwater panel */}
      <div
        className="relative w-full overflow-hidden"
        style={{ background: disciplineGradient(code) }}
      >
        <div className="relative flex min-h-[9rem] flex-col justify-between p-4">
          <div className="flex items-center gap-2">
            <span
              className="rounded-md px-2 py-0.5 text-[0.6rem] font-bold tracking-wider"
              style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}
            >
              {code}
            </span>
            {d.is_personal_best && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6rem] font-black tracking-[0.14em]"
                style={{
                  background: MEDAL_GOLD,
                  color: "#3A2503",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 10px rgba(239,159,39,0.45)",
                }}
              >
                <Trophy className="size-3" /> PB
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-white/85">{disciplineName(code, lang)}</p>
            <p
              className="mt-0.5 text-4xl font-black tabular-nums text-white"
              style={{
                fontFamily: "'Outfit', sans-serif",
                textShadow: "0 2px 12px rgba(2,10,19,0.6)",
              }}
            >
              {formatResult(code, d.result)}
            </p>
          </div>
        </div>
      </div>

      {/* action bar — heart / I'm OK */}
      <div className="px-3 py-2">
        <PostReactions targetType="dive" targetId={d.id} onDark={false} />
      </div>
    </li>
  );
}
