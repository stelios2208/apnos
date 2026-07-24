import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Heart, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { nativeVibrate } from "@/lib/native";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { listLikes, toggleLike, type LikeInfo, type ReactionTarget } from "@/lib/reactions";

// ── Post reactions (Instagram-style) ─────────────────────────────────────────
// Icon row (heart · message · share) plus a "liked by" line with the actual
// people's avatars. Likes are shared/server-backed (feed_reactions), so you see
// WHO liked and a real count. Degrades to a plain heart if the table is missing.

const HEART_RED = "#ED4956";

export function PostReactions({
  targetType,
  targetId,
  shareData,
  authorId,
  onDark = false,
}: {
  targetType: ReactionTarget;
  targetId: string;
  shareData?: { title?: string; text?: string; url?: string };
  /** When set, the message icon opens a DM with this user (the post author). */
  authorId?: string;
  onDark?: boolean;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const iconColor = onDark ? "#fff" : "var(--foreground)";
  const key = ["likes", targetType, targetId];

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
  const likesLabel =
    count === 1
      ? lang === "el"
        ? "1 like"
        : "1 like"
      : `${count} ${lang === "el" ? "likes" : "likes"}`;

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

        <button
          type="button"
          onClick={() => {
            nativeVibrate(10);
            navigate(
              authorId && authorId !== user?.id
                ? { to: "/messages", search: { to: authorId } }
                : { to: "/messages" },
            );
          }}
          aria-label={t("react.message")}
          className="pressable -m-1 p-1"
          style={{ color: iconColor }}
        >
          <MessageCircle style={{ width: 24, height: 24 }} strokeWidth={1.8} />
        </button>

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

      {/* who liked — little avatars + count */}
      {count > 0 && (
        <div className="flex items-center gap-2">
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
        </div>
      )}
    </div>
  );
}
