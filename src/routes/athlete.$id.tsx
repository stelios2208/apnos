import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Lock,
  Trophy,
  Waves,
  Pencil,
  Share2,
  Users,
  ClipboardList,
  CalendarDays,
  History,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { AvatarBubble } from "@/components/AvatarBubble";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";
import { Bubbles } from "@/components/Bubbles";
import { useAuth } from "@/hooks/use-auth";
import { useMode } from "@/hooks/use-mode";
import { useI18n } from "@/lib/i18n";
import {
  getPublicProfile,
  listPublicProfiles,
  listFeedCatches,
  listFeedDives,
  type FeedCatch,
} from "@/lib/profiles";
import { listFeedPosts, deletePost, type CommunityPost } from "@/lib/posts";
import { deleteCatchPhoto } from "@/lib/spearo-photos";
import { personalBestsBySpecies } from "@/lib/spearo-catches";
import { speciesLabel, formatCatchSize, formatCatchWeight, type SpearoCatch } from "@/lib/spearo";
import { fetchPublicResultsByUser } from "@/lib/competitions";
import { disciplineName, formatResult, type DisciplineCode } from "@/lib/diving";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { SITE_URL } from "@/lib/site";

// ── Route ──────────────────────────────────────────────────────────────────────
// The PUBLIC athlete page, shared by both modes: header (avatar/name/bio), a
// Spearo "Record Wall" built ONLY from the athlete's shared catches (sanitized
// feed_catches view — no spot, no notes by construction), and their public
// freediving competition results (competition_results is public-by-design via
// is_public). Inside <AppLayout>, so it inherits the auth gate: signed-in users
// only, matching the REVOKE-from-anon on the social surfaces. A private or
// unknown id renders a friendly "private profile" state — never an error.
export const Route = createFileRoute("/athlete/$id")({
  head: () => ({ meta: [{ title: "Athlete — Apnos" }] }),
  component: () => (
    <AppLayout>
      <AthletePage />
    </AppLayout>
  ),
});

// Visual language shared with the records Trophy Wall (performances.tsx).
const UNDERWATER_GRADIENT =
  "linear-gradient(180deg, #0d4a63 0%, #0a3852 30%, #072a42 55%, #041a2e 80%, #02101d 100%)";
const MEDAL_GOLD = "linear-gradient(135deg, #F7CE73 0%, #EF9F27 55%, #C97F16 100%)";
const GREEN_LIGHT = "#5DCAA5";

// Discipline-themed underwater gradient — same hue map as the Apnos feed
// cards (dashboard.tsx), so a discipline reads identically everywhere.
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

/**
 * One row of the athlete's Apnos performance wall: the best result per
 * discipline across BOTH their shared training dives (sanitized feed_dives)
 * and their public competition results — competition entries are badged.
 */
interface ApnosBest {
  discipline: DisciplineCode;
  result: number;
  date: string | null;
  fromCompetition: boolean;
  competitionName?: string;
}

/**
 * Adapt sanitized feed rows to the SpearoCatch shape personalBestsBySpecies
 * expects. Only safe columns exist on FeedCatch, so the resulting "catches"
 * can never carry a spot or notes.
 */
function toCatches(rows: FeedCatch[]): SpearoCatch[] {
  return rows.map((f) => ({
    id: f.id,
    user_id: f.user_id,
    caught_at: f.caught_at ?? f.created_at,
    created_at: f.created_at,
    species_code: f.species_code ?? undefined,
    species_custom: f.species_custom ?? undefined,
    size_cm: f.size_cm ?? undefined,
    weight_kg: f.weight_kg ?? undefined,
    max_depth_m: f.max_depth_m ?? undefined,
    photo_url: f.photo_url ?? undefined,
  }));
}

function AthletePage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  // Back returns to whichever community feed the viewer lives in.
  const { mode } = useMode();
  const homeTo = mode === "spearo" ? "/spearo" : "/dashboard";

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["public-profile", id],
    queryFn: () => getPublicProfile(id),
    enabled: !!user,
  });

  // The athlete's shared catches (sanitized view, scoped to them) → record wall.
  const { data: shared = [], isLoading: sharedLoading } = useQuery({
    queryKey: ["feed-catches", id],
    queryFn: () => listFeedCatches({ userId: id, limit: 100 }),
    enabled: !!user && !!profile,
  });

  // Their shared freediving dives (sanitized view, scoped to them).
  const { data: sharedDives = [], isLoading: sharedDivesLoading } = useQuery({
    queryKey: ["feed-dives", id],
    queryFn: () => listFeedDives({ userId: id, limit: 200 }),
    enabled: !!user && !!profile,
  });

  // Their public freediving competition results.
  const { data: results = [], isLoading: resultsLoading } = useQuery({
    queryKey: ["public-comp-results", id],
    queryFn: () => fetchPublicResultsByUser(id),
    enabled: !!user && !!profile,
  });

  // "Friends" — the crew. Until a real interaction/friend graph is persisted,
  // this is the other public athletes in the community (self + the profile being
  // viewed excluded). Stacked Instagram-style, tap to expand the full row.
  const { data: allPublic = [] } = useQuery({
    queryKey: ["public-profiles"],
    queryFn: () => listPublicProfiles(50),
    enabled: !!user && !!profile,
  });
  const friends = useMemo(
    () => allPublic.filter((p) => p.user_id !== id && p.user_id !== user?.id),
    [allPublic, id, user?.id],
  );
  const [friendsOpen, setFriendsOpen] = useState(false);

  // This athlete's free-form community posts (their own wall).
  const { data: posts = [] } = useQuery({
    queryKey: ["feed-posts", id],
    queryFn: () => listFeedPosts({ userId: id, limit: 30 }),
    enabled: !!user && !!profile,
  });

  const queryClient = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);

  // Is the viewer looking at their own public profile?
  const isOwn = user?.id === id;

  // Delete own post — best-effort photo cleanup, then refresh.
  const deletePostMutation = useMutation({
    mutationFn: async (p: CommunityPost) => {
      await deletePost(p.id);
      if (p.photo_url) await deleteCatchPhoto(p.photo_url).catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-posts", id] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error"),
  });

  // Share the profile: native share sheet where available, clipboard fallback.
  const shareProfile = async () => {
    const url = `${SITE_URL}/athlete/${id}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: name, text: t("athlete.shareText"), url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast.success(t("athlete.shareCopied"));
      }
    } catch {
      /* user cancelled the share sheet — nothing to do */
    }
  };

  const records = useMemo(() => personalBestsBySpecies(toCatches(shared)), [shared]);

  // Best per discipline across shared dives AND public competition results —
  // higher is better for both time (s) and distance/depth (m); when the record
  // comes from a competition it carries the «Αγώνας» badge.
  const bestPerDiscipline = useMemo(() => {
    const best = new Map<string, ApnosBest>();
    for (const d of sharedDives) {
      const code = d.discipline as DisciplineCode;
      const cur = best.get(code);
      if (!cur || d.result > cur.result) {
        best.set(code, {
          discipline: code,
          result: d.result,
          date: d.dive_date,
          fromCompetition: false,
        });
      }
    }
    for (const r of results) {
      const cur = best.get(r.discipline);
      if (!cur || r.result > cur.result) {
        best.set(r.discipline, {
          discipline: r.discipline,
          result: r.result,
          date: r.competition_date,
          fromCompetition: true,
          competitionName: r.competition_name,
        });
      }
    }
    return [...best.values()].sort((a, b) => b.result - a.result);
  }, [sharedDives, results]);

  const color = athleteColor(id);
  const name = profile?.display_name || t("spearo.feedAthlete");

  if (profileLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-foreground/25" />
      </div>
    );
  }

  // Not public / doesn't exist → friendly private state, never an error.
  if (!profile) {
    return (
      <div className="space-y-5 pb-4">
        <BackButton onClick={() => navigate({ to: homeTo })} />
        <div
          className="surface-2 relative overflow-hidden rounded-2xl p-10 text-center"
          style={{ background: UNDERWATER_GRADIENT }}
        >
          <Bubbles />
          <div className="relative z-10 flex flex-col items-center">
            <div
              className="surface-1 flex size-16 items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <Lock className="size-7 text-white/70" />
            </div>
            <p className="mt-4 font-semibold text-white">{t("athlete.private")}</p>
            <p className="mt-1 max-w-xs text-sm text-white/55">{t("athlete.privateSub")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      {/* ── full-bleed cover header: the profile photo runs the FULL WIDTH and
          is pulled up under the app header so there's no empty gap at the top.
          Back button + identity are overlaid on the image (Facebook-style). ── */}
      <div className="relative -mx-4 -mt-8 overflow-hidden">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={name} className="h-64 w-full object-cover" />
        ) : (
          <div
            className="h-48 w-full"
            style={{ background: "linear-gradient(160deg, #0d4a63 0%, #072a42 55%, #041a2e 100%)" }}
          />
        )}
        {/* readability gradient (top for the back button, bottom for the name) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(2,10,19,0.55) 0%, rgba(2,10,19,0.05) 30%, rgba(2,10,19,0.35) 58%, rgba(2,10,19,0.92) 100%)",
          }}
        />

        {/* back button overlaid top-left */}
        <button
          onClick={() => navigate({ to: homeTo })}
          aria-label={t("common.back")}
          className="pressable absolute left-4 top-4 flex size-10 items-center justify-center rounded-full text-white"
          style={{ background: "rgba(2,10,19,0.45)", backdropFilter: "blur(4px)" }}
        >
          <ArrowLeft className="size-5" />
        </button>

        {/* identity overlaid at the bottom */}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-5">
          {!profile.avatar_url && (
            <span
              className="flex size-14 shrink-0 items-center justify-center rounded-full text-xl font-bold"
              style={{ background: `${color}44`, color: "#fff", border: `2px solid ${color}88` }}
            >
              {athleteInitials(name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1
              className="truncate text-2xl font-bold text-white"
              style={{
                fontFamily: "'Outfit', sans-serif",
                textShadow: "0 2px 12px rgba(2,10,19,0.7)",
              }}
            >
              {name}
            </h1>
            {profile.country && <p className="mt-0.5 text-xs text-white/70">{profile.country}</p>}
            {profile.bio && (
              <p className="mt-1 line-clamp-2 text-sm leading-snug text-white/80">{profile.bio}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Instagram-style action row: Edit (own) + Share ── */}
      <div className="flex items-center gap-2">
        {isOwn && (
          <button
            onClick={() => navigate({ to: "/profile" })}
            className="pressable flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
            style={{
              background: "rgba(29,158,117,0.12)",
              border: "1px solid rgba(93,202,165,0.3)",
              color: "#5DCAA5",
            }}
          >
            <Pencil className="size-4" />
            {t("athlete.edit")}
          </button>
        )}
        <button
          onClick={shareProfile}
          className="pressable flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
          style={{
            background: "rgba(var(--ink),0.05)",
            border: "1px solid rgba(var(--ink),0.1)",
            color: "rgba(var(--ink),0.75)",
          }}
        >
          <Share2 className="size-4" />
          {t("athlete.share")}
        </button>
      </div>

      {/* ── post from your own profile (the "option to post" on profiles) ── */}
      {isOwn && <PostComposer open={composerOpen} onOpenChange={setComposerOpen} />}

      {/* ── Friends — stacked avatars, tap to expand the full row ── */}
      {friends.length > 0 && (
        <section className="space-y-3">
          <button
            onClick={() => setFriendsOpen((v) => !v)}
            className="pressable flex w-full items-center gap-3 text-left"
          >
            {/* overlapping avatar stack */}
            <div className="flex items-center">
              {friends.slice(0, 5).map((f, i) => {
                const fc = athleteColor(f.user_id);
                const fn = f.display_name || t("spearo.feedAthlete");
                return (
                  <span
                    key={f.user_id}
                    className="flex size-9 items-center justify-center overflow-hidden rounded-full text-[0.6rem] font-bold"
                    style={{
                      marginLeft: i === 0 ? 0 : -12,
                      background: `${fc}33`,
                      color: "#fff",
                      border: "2px solid var(--background)",
                      zIndex: 5 - i,
                    }}
                  >
                    {f.avatar_url ? (
                      <img src={f.avatar_url} alt="" className="size-full object-cover" />
                    ) : (
                      athleteInitials(fn)
                    )}
                  </span>
                );
              })}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Users className="size-4" style={{ color: GREEN_LIGHT }} />
                {t("athlete.friends")}
                <span className="text-foreground/40">· {friends.length}</span>
              </p>
              <p className="text-xs text-foreground/45">{t("athlete.friendsSub")}</p>
            </div>
          </button>

          {friendsOpen && (
            <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
              {friends.map((f) => (
                <AvatarBubble key={f.user_id} profile={f} fallbackName={t("spearo.feedAthlete")} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── training hubs (own profile only) — train · plan · calendar · history ── */}
      {isOwn && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[
            { to: "/train", icon: Waves, label: lang === "el" ? "Προπόνηση" : "Train" },
            { to: "/planner", icon: ClipboardList, label: lang === "el" ? "Πλάνο" : "Plan" },
            {
              to: "/calendar",
              icon: CalendarDays,
              label: lang === "el" ? "Ημερολόγιο" : "Calendar",
            },
            { to: "/history", icon: History, label: lang === "el" ? "Ιστορικό" : "History" },
          ].map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
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
                <Icon className="size-3.5" style={{ color: GREEN_LIGHT }} />
              </span>
              <span className="text-xs font-semibold text-foreground/80">{label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* ── Spearo: record wall from SHARED catches only ── */}
      {!sharedLoading && records.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            icon={<Trophy className="size-5" style={{ color: "#EF9F27" }} />}
            title={t("athlete.recordWall")}
            sub={t("athlete.recordWallSub")}
          />
          <div className="no-scrollbar -mx-4 space-y-2.5 sm:mx-0">
            {records.map((r) => {
              const speciesName = r.isCustomSpecies ? r.species : speciesLabel(r.species, lang);
              const primary =
                r.weight != null ? formatCatchWeight(r.weight) : formatCatchSize(r.size);
              const secondary = r.weight != null && r.size != null ? formatCatchSize(r.size) : null;
              return (
                <div
                  key={r.species}
                  className="surface-2 relative overflow-hidden border-y border-border/50 sm:rounded-2xl sm:border"
                >
                  {r.photoUrl ? (
                    <img
                      src={r.photoUrl}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0" style={{ background: UNDERWATER_GRADIENT }} />
                  )}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(2,10,19,0.3) 0%, rgba(2,10,19,0.15) 35%, rgba(2,10,19,0.55) 65%, rgba(2,10,19,0.88) 100%)",
                    }}
                  />
                  <div className="relative flex min-h-[14rem] flex-col justify-between p-4">
                    <span
                      className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[0.6rem] font-black tracking-[0.14em]"
                      style={{
                        background: MEDAL_GOLD,
                        color: "#3A2503",
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 10px rgba(239,159,39,0.45)",
                      }}
                    >
                      <Trophy className="size-3" /> PB
                    </span>
                    <div>
                      <p className="text-sm font-semibold capitalize text-white/85">
                        {speciesName}
                      </p>
                      <p
                        className="mt-0.5 text-4xl font-black tabular-nums text-white"
                        style={{
                          fontFamily: "'Outfit', sans-serif",
                          textShadow: "0 2px 12px rgba(2,10,19,0.6)",
                        }}
                      >
                        {primary}
                      </p>
                      <p className="mt-1 text-xs text-white/55">
                        {secondary && <span className="tabular-nums">{secondary} · </span>}
                        {new Date(r.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Apnos: best shared/competition result per discipline ── */}
      {!resultsLoading && !sharedDivesLoading && bestPerDiscipline.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            icon={<Waves className="size-5" style={{ color: GREEN_LIGHT }} />}
            title={t("athlete.compResults")}
            sub={t("athlete.compResultsSub")}
          />
          <div className="-mx-4 space-y-2.5 sm:mx-0">
            {bestPerDiscipline.map((r) => (
              <div
                key={r.discipline}
                className="surface-2 relative overflow-hidden border-y border-border/50 sm:rounded-2xl sm:border"
              >
                <div
                  className="absolute inset-0"
                  style={{ background: disciplineGradient(r.discipline) }}
                />
                <div className="relative flex min-h-[9rem] flex-col justify-between p-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-md px-2 py-0.5 text-[0.6rem] font-bold tracking-wider"
                      style={{
                        background: "rgba(255,255,255,0.12)",
                        color: "rgba(255,255,255,0.85)",
                      }}
                    >
                      {r.discipline}
                    </span>
                    {/* gold PB medal — this IS the athlete's best per discipline */}
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
                    {r.fromCompetition && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6rem] font-bold tracking-wider"
                        style={{
                          background: "rgba(79,168,224,0.22)",
                          color: "#9CCFF2",
                          border: "1px solid rgba(79,168,224,0.4)",
                        }}
                      >
                        {t("athlete.compBadge")}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/85">
                      {disciplineName(r.discipline, lang)}
                    </p>
                    <p
                      className="mt-0.5 text-4xl font-black tabular-nums text-white"
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        textShadow: "0 2px 12px rgba(2,10,19,0.6)",
                      }}
                    >
                      {formatResult(r.discipline, r.result)}
                    </p>
                    <p className="mt-1 truncate text-xs text-white/55">
                      {[r.competitionName, r.date ? new Date(r.date).toLocaleDateString() : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── this athlete's free-form community posts ── */}
      {posts.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            icon={<MessageSquare className="size-5" style={{ color: GREEN_LIGHT }} />}
            title={t("athlete.posts")}
            sub={t("athlete.postsSub")}
          />
          <ul className="-mx-4 space-y-2.5 sm:mx-0">
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                author={profile}
                fallbackName={name}
                currentUserId={user?.id}
                onDelete={(x) => deletePostMutation.mutate(x)}
              />
            ))}
          </ul>
        </section>
      )}

      {(sharedLoading || sharedDivesLoading || resultsLoading) && (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-foreground/25" />
        </div>
      )}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="pressable flex h-10 w-10 items-center justify-center rounded-full"
      style={{ background: "rgba(var(--ink),0.05)", color: "rgba(var(--ink),0.5)" }}
    >
      <ArrowLeft className="size-4" />
    </button>
  );
}

function SectionHeader({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <p className="mt-0.5 text-xs text-foreground/45">{sub}</p>
    </div>
  );
}
