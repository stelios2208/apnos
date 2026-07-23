import { Plus } from "lucide-react";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";
import { nativeVibrate } from "@/lib/native";
import type { SocialProfile } from "@/lib/profiles";
import type { StoryGroup } from "@/lib/stories";

// ── Community "stories" row (Instagram style) ────────────────────────────────
// A horizontally scrolling strip of TALL portrait cards. Our own "Create" card
// comes FIRST (upload a photo → it becomes a story), then ONE card per author
// (their latest story as the cover) — exactly like Instagram, where a person's
// 2-3 stories collapse into a single tray entry. Tapping opens the fullscreen
// viewer at that author's group.
//
// NOTE: the small round ringed avatars (AvatarBubble) are the PROFILE affordance
// used elsewhere (the friends row) — stories are their own tall-card shape.
export function StoriesRow({
  groups,
  profileByUser,
  fallbackName,
  onCreate,
  onView,
}: {
  groups: StoryGroup[];
  profileByUser: Map<string, SocialProfile>;
  fallbackName: string;
  /** Opens the story composer (upload a photo). */
  onCreate: () => void;
  /** Opens the fullscreen viewer at the given author-group index. */
  onView: (groupIndex: number) => void;
}) {
  const { t } = useI18n();

  return (
    // full-bleed horizontal scroller; scrollbar hidden so a swipe never shows a
    // bottom line.
    <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
      <CreateStoryCard label={t("stories.create")} onCreate={onCreate} />
      {groups.map((g, i) => (
        <StoryCard
          key={g.user_id}
          // cover = the author's most recent story
          coverUrl={g.stories[g.stories.length - 1].photo_url}
          userId={g.user_id}
          author={profileByUser.get(g.user_id)}
          fallbackName={fallbackName}
          count={g.stories.length}
          onClick={() => onView(i)}
        />
      ))}
    </div>
  );
}

// Shared tall-card frame (FB story aspect).
const CARD_CLS =
  "relative block h-44 w-[6.6rem] shrink-0 overflow-hidden rounded-2xl surface-1 pressable";

function CreateStoryCard({ label, onCreate }: { label: string; onCreate: () => void }) {
  return (
    <button
      type="button"
      className={CARD_CLS}
      onClick={() => {
        nativeVibrate(10);
        onCreate();
      }}
    >
      {/* top: brand photo-stand-in */}
      <div
        className="h-[62%] w-full"
        style={{ background: "linear-gradient(160deg, #1a3a5c 0%, #10293f 45%, #0a1622 100%)" }}
      />
      {/* bottom: solid footer with the label */}
      <div className="flex h-[38%] w-full items-end justify-center bg-card pb-2">
        <span className="px-1 text-center text-[0.62rem] font-semibold leading-tight text-foreground/80">
          {label}
        </span>
      </div>
      {/* + circle straddling the divider */}
      <span
        className="absolute left-1/2 top-[62%] flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-card"
        style={{ background: "#1D9E75" }}
      >
        <Plus className="size-4 text-white" />
      </span>
    </button>
  );
}

function StoryCard({
  coverUrl,
  userId,
  author,
  fallbackName,
  count,
  onClick,
}: {
  coverUrl: string;
  userId: string;
  author?: SocialProfile;
  fallbackName: string;
  count: number;
  onClick: () => void;
}) {
  const name = author?.display_name || fallbackName;
  const color = athleteColor(userId);
  return (
    <button
      type="button"
      onClick={() => {
        nativeVibrate(10);
        onClick();
      }}
      className={CARD_CLS}
    >
      {/* the author's latest story photo */}
      <img src={coverUrl} alt="" className="h-full w-full object-cover" />
      {/* multi-story hint — segmented bar like Instagram */}
      {count > 1 && (
        <div className="absolute inset-x-1.5 top-1.5 z-10 flex gap-0.5">
          {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
            <span
              key={i}
              className="h-[3px] flex-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.9)" }}
            />
          ))}
        </div>
      )}
      {/* readability gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(2,10,19,0.3) 0%, rgba(2,10,19,0) 40%, rgba(2,10,19,0.85) 100%)",
        }}
      />
      {/* small ringed avatar of the author top-left */}
      <span
        className="absolute left-2 top-2 flex size-9 items-center justify-center rounded-full p-[2px]"
        style={{ background: "conic-gradient(from 210deg, #1D9E75, #5DCAA5, #9FE1CB, #1D9E75)" }}
      >
        <span
          className="flex size-full items-center justify-center overflow-hidden rounded-full"
          style={{ background: "var(--background)" }}
        >
          {author?.avatar_url ? (
            <img src={author.avatar_url} alt="" className="size-full rounded-full object-cover" />
          ) : (
            <span className="text-[0.6rem] font-bold" style={{ color }}>
              {athleteInitials(name)}
            </span>
          )}
        </span>
      </span>
      {/* author name */}
      <span
        className="absolute inset-x-0 bottom-0 line-clamp-2 p-2 text-left text-[0.7rem] font-bold leading-tight text-white"
        style={{ textShadow: "0 1px 6px rgba(2,10,19,0.8)" }}
      >
        {name.split(" ")[0]}
      </span>
    </button>
  );
}
