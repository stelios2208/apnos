import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PostReactions } from "@/components/PostReactions";
import { RingedAvatar } from "@/components/RingedAvatar";
import { nativeVibrate } from "@/lib/native";
import { useI18n } from "@/lib/i18n";
import { updatePost, type CommunityPost } from "@/lib/posts";
import type { SocialProfile } from "@/lib/profiles";
import { SITE_URL } from "@/lib/site";
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

// A free-form community post, Instagram-style: header (ringed avatar + name),
// the full-width photo, an icon-only action row, then the caption below with a
// "more/less" expander for long text. Author can edit/delete their own post.
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
  const dateStr = format(new Date(post.created_at), "d MMM yyyy · HH:mm");
  const isOwn = currentUserId === post.user_id;

  // caption expand/collapse (Instagram "…more")
  const [expanded, setExpanded] = useState(false);
  const longBody = !!post.body && (post.body.length > 120 || post.body.includes("\n"));

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

  const shareData = {
    title: post.title || name,
    text: [post.title, post.body].filter(Boolean).join(" — "),
    url: `${SITE_URL}/athlete/${post.user_id}`,
  };

  return (
    <li className="surface-2 overflow-hidden sm:rounded-2xl">
      {/* header — ringed avatar + name, taps through to the athlete page */}
      <div className="flex items-center gap-2.5 p-3">
        <Link
          to="/athlete/$id"
          params={{ id: post.user_id }}
          onClick={() => nativeVibrate(10)}
          className="pressable flex min-w-0 flex-1 items-center gap-2.5"
        >
          <RingedAvatar avatarUrl={author?.avatar_url} name={name} userId={post.user_id} />
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
            className="pressable flex size-8 shrink-0 items-center justify-center rounded-full text-foreground/45 hover:text-foreground"
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

      {/* editing form (own) */}
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
        <>
          {/* full-width photo */}
          {post.photo_url && (
            <img
              src={post.photo_url}
              alt=""
              loading="lazy"
              className="w-full"
              style={{ maxHeight: "38rem", objectFit: "cover", background: "#02101d" }}
            />
          )}

          {/* icon-only action row */}
          <div className="px-3 pb-1 pt-2.5">
            <PostReactions targetType="post" targetId={post.id} shareData={shareData} />
          </div>

          {/* caption below (Instagram) — white text, more/less for long bodies */}
          {(post.title || post.body) && (
            <div className="px-3 pb-3 pt-1 text-sm leading-relaxed text-foreground">
              {post.title && <span className="font-bold">{post.title} </span>}
              {post.body && (
                <span className={!expanded && longBody ? "line-clamp-2" : undefined}>
                  {post.body}
                </span>
              )}
              {longBody && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-0.5 block text-xs font-medium text-foreground/50"
                >
                  {expanded ? t("react.less") : t("react.more")}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </li>
  );
}
