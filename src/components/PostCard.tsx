import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PostReactions } from "@/components/PostReactions";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { nativeVibrate } from "@/lib/native";
import { useI18n } from "@/lib/i18n";
import { updatePost, type CommunityPost } from "@/lib/posts";
import type { SocialProfile } from "@/lib/profiles";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const qc = useQueryClient();
  const name = author?.display_name || fallbackName;
  const color = athleteColor(post.user_id);
  const dateStr = format(new Date(post.created_at), "d MMM yyyy · HH:mm");
  const isOwn = currentUserId === post.user_id;

  // ── inline edit (own post) ──
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(post.title ?? "");
  const [bodyDraft, setBodyDraft] = useState(post.body ?? "");

  const editMutation = useMutation({
    mutationFn: () =>
      updatePost(post.id, {
        title: titleDraft.trim() || null,
        body: bodyDraft.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success(t("post.updated"));
      setEditing(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t("post.couldNotPost")),
  });

  const startEdit = () => {
    setTitleDraft(post.title ?? "");
    setBodyDraft(post.body ?? "");
    setEditing(true);
  };

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

        {isOwn && !editing && (
          <button
            type="button"
            onClick={startEdit}
            aria-label={t("post.edit")}
            className="pressable flex size-8 shrink-0 items-center justify-center rounded-full text-foreground/40 hover:text-foreground"
          >
            <Pencil className="size-4" />
          </button>
        )}

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

      {/* title + body — editable inline for the author */}
      {editing ? (
        <div className="space-y-2 px-3 pb-3">
          <Input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            placeholder={t("post.titlePlaceholder")}
          />
          <Textarea
            value={bodyDraft}
            onChange={(e) => setBodyDraft(e.target.value)}
            placeholder={t("post.bodyPlaceholder")}
            rows={3}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending}
              className="pressable flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "#1D9E75" }}
            >
              <Check className="size-4" />
              {t("post.save")}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="pressable flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: "rgba(var(--ink),0.05)", color: "rgba(var(--ink),0.7)" }}
            >
              <X className="size-4" />
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        (post.title || post.body) && (
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
        )
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
