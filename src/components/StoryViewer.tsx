import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";
import type { CommunityStory } from "@/lib/stories";
import type { SocialProfile } from "@/lib/profiles";

// ── Story viewer ─────────────────────────────────────────────────────────────
// Fullscreen story playback (Facebook/Instagram style). Tap the right half for
// the next story, the left half for the previous; past the last one it closes.
// The author can delete their own story. `startIndex` seeds the position when
// the viewer opens; `null` startIndex means closed.
export function StoryViewer({
  stories,
  startIndex,
  profileByUser,
  fallbackName,
  currentUserId,
  onClose,
  onDelete,
}: {
  stories: CommunityStory[];
  startIndex: number | null;
  profileByUser: Map<string, SocialProfile>;
  fallbackName: string;
  currentUserId?: string;
  onClose: () => void;
  onDelete: (story: CommunityStory) => void;
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (startIndex != null) setIndex(startIndex);
  }, [startIndex]);

  if (startIndex == null) return null;
  const story = stories[index];
  if (!story) return null;

  const author = profileByUser.get(story.user_id);
  const name = author?.display_name || fallbackName;
  const color = athleteColor(story.user_id);
  const isOwn = currentUserId === story.user_id;

  const next = () => (index + 1 < stories.length ? setIndex(index + 1) : onClose());
  const prev = () => (index > 0 ? setIndex(index - 1) : onClose());

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#02101d" }}>
      {/* progress segments */}
      <div className="flex gap-1 p-2">
        {stories.map((_, i) => (
          <span
            key={i}
            className="h-0.5 flex-1 rounded-full"
            style={{ background: i <= index ? "#fff" : "rgba(255,255,255,0.3)" }}
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
          <button
            type="button"
            onClick={() => {
              onDelete(story);
              next();
            }}
            aria-label={t("common.delete")}
            className="flex size-9 items-center justify-center rounded-full text-white/80"
          >
            <Trash2 className="size-4" />
          </button>
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
        {/* left / right tap zones for prev / next */}
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

        {/* caption */}
        {story.caption && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 p-5"
            style={{ background: "linear-gradient(0deg, rgba(2,10,19,0.85), transparent)" }}
          >
            <p className="text-sm leading-snug text-white">{story.caption}</p>
          </div>
        )}
      </div>
    </div>
  );
}
