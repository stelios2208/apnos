import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { PostReactions } from "@/components/PostReactions";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { nativeVibrate } from "@/lib/native";
import { useI18n } from "@/lib/i18n";
import type { CommunityPost } from "@/lib/posts";
import type { SocialProfile } from "@/lib/profiles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// One free-form community post in the feed — the Facebook-style card: author
// header, an optional bold title, the body text, an optional full-width photo,
// then the reaction bar. The author can delete their own post (confirmed via
// the shared AlertDialog). Author identity is stitched CLIENT-SIDE from the
// profiles list, exactly like the dive/catch feed cards.
export function PostCard({
  post,
  author,
  fallbackName,
  currentUserId,
  onDelete,
}: {
  post: CommunityPost;
  author?: SocialProfile;
  fallbackName: string;
  currentUserId?: string;
  onDelete: (post: CommunityPost) => void;
}) {
  const { t } = useI18n();
  const name = author?.display_name || fallbackName;
  const color = athleteColor(post.user_id);
  const dateStr = format(new Date(post.created_at), "d MMM yyyy · HH:mm");
  const isOwn = currentUserId === post.user_id;

  return (
    <li className="surface-2 overflow-hidden border-y border-border/50 sm:rounded-2xl sm:border">
      {/* post header — author identity, taps through to the athlete page */}
      <div className="flex items-center gap-2.5 p-3">
        <Link
          to="/athlete/$id"
          params={{ id: post.user_id }}
          onClick={() => nativeVibrate(10)}
          className="pressable flex min-w-0 flex-1 items-center gap-2.5"
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

        {isOwn && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                aria-label={t("common.delete")}
                className="pressable flex size-8 shrink-0 items-center justify-center rounded-full text-red-400/60 hover:text-red-400"
              >
                <Trash2 className="size-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("post.deleteTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("post.deleteDesc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(post)}
                  className="bg-red-600 text-white hover:bg-red-600/90"
                >
                  {t("common.delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* title + body */}
      {(post.title || post.body) && (
        <div className="space-y-1 px-3 pb-2.5">
          {post.title && (
            <p className="text-base font-bold leading-snug text-foreground">{post.title}</p>
          )}
          {post.body && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/75">
              {post.body}
            </p>
          )}
        </div>
      )}

      {/* optional full-width photo at natural aspect */}
      {post.photo_url && (
        <img
          src={post.photo_url}
          alt=""
          loading="lazy"
          className="w-full"
          style={{ maxHeight: "36rem", objectFit: "cover", background: "#02101d" }}
        />
      )}

      {/* action bar — heart / I'm OK */}
      <div className="px-3 py-2">
        <PostReactions targetType="post" targetId={post.id} onDark={false} />
      </div>
    </li>
  );
}
