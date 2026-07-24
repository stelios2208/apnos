import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { nativeVibrate } from "@/lib/native";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { CommentsSheet } from "@/components/CommentsSheet";
import { LikersDialog } from "@/components/LikersDialog";
import { listLikes, toggleLike, type LikeInfo, type ReactionTarget } from "@/lib/reactions";

// ── Post reactions ───────────────────────────────────────────────────────────
// Icon row (heart · comment · share) plus a tappable "liked by" line with the
// actual people's avatars. Likes are shared/server-backed (feed_reactions) and
// the comment icon opens comments on THIS item (feed_comments) — not a DM.
// Tapping the likes line opens the "liked by" sheet. Degrades to a plain heart
// if the tables are missing.

const HEART_RED = "#ED4956";

export function PostReactions({
  targetType,
  targetId,
  shareData,
  onDark = false,
}: {
  targetType: ReactionTarget;
  targetId: string;
  shareData?: { title?: string; text?: string; url?: string };
  /** Deprecated: the author id used to open a DM. Comments replaced that. */
  authorId?: string;
  onDark?: boolean;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const iconColor = onDark ? "#fff" : "var(--foreground)";
  const key = ["likes", targetType, targetId];
  const [likersOpen, setLikersOpen] = useState(false);

  const { data: likes } = useQuery({
    queryKey: key,
    queryFn: () => listLikes(targetType, targetId, user?.id),
    enabled: !!targetId,
  });
  const liked = likes?.likedByMe ?? false;
  const count = likes?.count ?? 0;

  const toggle = useMutation({
    mutationFn: () => toggleLike(targetType, targetId, !liked),
    onMutate: async () => {
      nativeVibrate(10);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<LikeInfo>(key);
      // optimistic flip
      qc.setQueryData<LikeInfo>(key, (old) => {
        const base = old ?? { count: 0, likedByMe: false, likers: [] };
        return {
          ...base,
          likedByMe: !liked,
          count: Math.max(0, base.count + (liked ? -1 : 1)),
        };
      });
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error(err instanceof Error ? err.message : "Error");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const share = async () => {
    nativeVibrate(10);
    const data = {
      title: shareData?.title || "Apnos",
      text: shareData?.text || "",
      url: shareData?.url || (typeof window !== "undefined" ? window.location.origin : ""),
    };
    try {
      if (typeof navigator !== "undefined" && navigator.share) await navigator.share(data);
      else if (typeof navigator !== "undefined" && navigator.clipboard)
        await navigator.clipboard.writeText(`${data.text} ${data.url}`.trim());
    } catch {
      /* dismissed */
    }
  };

  const likers = likes?.likers ?? [];
  const likesLabel = `${count} ${count === 1 ? t("react.likeOne") : t("react.likeMany")}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={() => toggle.mutate()}
          aria-pressed={liked}
          aria-label={t("react.heart")}
          className="pressable -m-1 p-1"
          style={{ color: liked ? HEART_RED : iconColor }}
        >
          <Heart
            style={{ width: 25, height: 25 }}
            fill={liked ? "currentColor" : "none"}
            strokeWidth={1.8}
          />
        </button>

        {/* comment on THIS item (opens the comments sheet) */}
        <CommentsSheet targetType={targetType} targetId={targetId} iconColor={iconColor} />

        <button
          type="button"
          onClick={share}
          aria-label={t("react.share")}
          className="pressable -m-1 p-1"
          style={{ color: iconColor }}
        >
          <Send style={{ width: 23, height: 23 }} className="-rotate-12" strokeWidth={1.8} />
        </button>
      </div>

      {/* who liked — little avatars + count; tap to open the full "liked by" list */}
      {count > 0 && (
        <button
          type="button"
          onClick={() => {
            nativeVibrate(10);
            setLikersOpen(true);
          }}
          className="pressable -ml-0.5 flex items-center gap-2"
        >
          {likers.length > 0 && (
            <div className="flex items-center">
              {likers.slice(0, 3).map((l, i) => {
                const c = athleteColor(l.user_id);
                return (
                  <span
                    key={l.user_id}
                    className="flex size-5 items-center justify-center overflow-hidden rounded-full text-[0.5rem] font-bold"
                    style={{
                      marginLeft: i === 0 ? 0 : -7,
                      background: `${c}44`,
                      color: "#fff",
                      border: `1.5px solid ${onDark ? "#02101d" : "var(--background)"}`,
                    }}
                  >
                    {l.avatar_url ? (
                      <img src={l.avatar_url} alt="" className="size-full object-cover" />
                    ) : (
                      athleteInitials(l.display_name || "")
                    )}
                  </span>
                );
              })}
            </div>
          )}
          <span
            className="text-xs font-semibold"
            style={{ color: onDark ? "rgba(255,255,255,0.85)" : "var(--foreground)" }}
          >
            {likesLabel}
          </span>
        </button>
      )}

      <LikersDialog
        targetType={targetType}
        targetId={targetId}
        open={likersOpen}
        onOpenChange={setLikersOpen}
      />
    </div>
  );
}
