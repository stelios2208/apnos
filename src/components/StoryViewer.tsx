import { useEffect, useState } from "react";
import { MoreHorizontal, Trash2, X } from "lucide-react";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { PostReactions } from "@/components/PostReactions";
import { useI18n } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import type { CommunityStory, StoryGroup } from "@/lib/stories";
import type { SocialProfile } from "@/lib/profiles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Story viewer ─────────────────────────────────────────────────────────────
// Fullscreen playback grouped by author (Instagram). Segmented bar plays the
// current author's stories then continues to the next author. Bottom bar has
// the heart · message · share actions; the ⋯ menu (own stories) can delete.
// The overlay uses 100dvh so it always covers the screen — no page peeking
// through at the bottom.
export function StoryViewer({
  groups,
  startGroup,
  profileByUser,
  fallbackName,
  currentUserId,
  onClose,
  onDelete,
}: {
  groups: StoryGroup[];
  startGroup: number | null;
  profileByUser: Map<string, SocialProfile>;
  fallbackName: string;
  currentUserId?: string;
  onClose: () => void;
  onDelete: (story: CommunityStory) => void;
}) {
  const { t } = useI18n();
  const [groupIdx, setGroupIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);

  useEffect(() => {
    if (startGroup != null) {
      setGroupIdx(startGroup);
      setItemIdx(0);
    }
  }, [startGroup]);

  if (startGroup == null) return null;
  const group = groups[groupIdx];
  if (!group) return null;
  const story = group.stories[itemIdx];
  if (!story) return null;

  const author = profileByUser.get(group.user_id);
  const name = author?.display_name || fallbackName;
  const color = athleteColor(group.user_id);
  const isOwn = currentUserId === group.user_id;

  const next = () => {
    if (itemIdx + 1 < group.stories.length) setItemIdx(itemIdx + 1);
    else if (groupIdx + 1 < groups.length) {
      setGroupIdx(groupIdx + 1);
      setItemIdx(0);
    } else onClose();
  };
  const prev = () => {
    if (itemIdx > 0) setItemIdx(itemIdx - 1);
    else if (groupIdx > 0) {
      setGroupIdx(groupIdx - 1);
      setItemIdx(0);
    } else onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "#02101d", height: "100dvh" }}
    >
      {/* segmented progress — one segment per story in THIS author's group */}
      <div className="flex gap-1 p-2 pt-3">
        {group.stories.map((_, i) => (
          <span
            key={i}
            className="h-0.5 flex-1 rounded-full"
            style={{ background: i <= itemIdx ? "#fff" : "rgba(255,255,255,0.3)" }}
          />
        ))}
      </div>

      {/* header */}
      <div className="flex items-center gap-2.5 px-3 pb-2">
        <span
          className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full"
          style={{ background: `${color}44`, border: "1.5px solid rgba(255,255,255,0.5)" }}
        >
          {author?.avatar_url ? (
            <img src={author.avatar_url} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-[0.6rem] font-bold text-white">{athleteInitials(name)}</span>
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{name}</span>
        {isOwn && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="•••"
                className="flex size-9 items-center justify-center rounded-full text-white/90"
              >
                <MoreHorizontal className="size-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => {
                  onDelete(story);
                  next();
                }}
                className="text-red-500 focus:text-red-500"
              >
                <Trash2 className="mr-2 size-4" />
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.back")}
          className="flex size-9 items-center justify-center rounded-full text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* image + tap zones */}
      <div className="relative flex-1">
        <img
          src={story.photo_url}
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
        />
        <button
          type="button"
          aria-label="previous"
          onClick={prev}
          className="absolute inset-y-0 left-0 w-1/3"
        />
        <button
          type="button"
          aria-label="next"
          onClick={next}
          className="absolute inset-y-0 right-0 w-2/3"
        />

        {story.caption && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 p-5"
            style={{ background: "linear-gradient(0deg, rgba(2,10,19,0.85), transparent)" }}
          >
            <p className="text-sm leading-snug text-white">{story.caption}</p>
          </div>
        )}
      </div>

      {/* bottom action bar — heart · message · share (solid, covers the bottom) */}
      <div
        className="px-4 pt-3"
        style={{ background: "#02101d", paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <PostReactions
          targetType="story"
          targetId={story.id}
          onDark
          shareData={{
            title: name,
            text: story.caption || "",
            url: `${SITE_URL}/athlete/${group.user_id}`,
          }}
        />
      </div>
    </div>
  );
}
