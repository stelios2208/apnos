import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { formatDistanceToNowStrict } from "date-fns";
import { el as elLocale } from "date-fns/locale";
import { MessageCircle, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { nativeVibrate } from "@/lib/native";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { addComment, countComments, deleteComment, listComments } from "@/lib/comments";
import type { ReactionTarget } from "@/lib/reactions";

// ── Comments ─────────────────────────────────────────────────────────────────
// The icon-only trigger (a speech bubble + count) that opens a bottom sheet with
// the thread and a composer. Works over any feed target (post/dive/catch/story)
// — this is the "comment on the post" action that replaced the old DM icon.

export function CommentsSheet({
  targetType,
  targetId,
  iconColor = "var(--foreground)",
}: {
  targetType: ReactionTarget;
  targetId: string;
  iconColor?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const countKey = ["comments-count", targetType, targetId];

  const { data: count = 0 } = useQuery({
    queryKey: countKey,
    queryFn: () => countComments(targetType, targetId),
    enabled: !!targetId,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          nativeVibrate(10);
          setOpen(true);
        }}
        aria-label={t("comment.open")}
        className="pressable -m-1 flex items-center gap-1 p-1"
        style={{ color: iconColor }}
      >
        <MessageCircle style={{ width: 24, height: 24 }} strokeWidth={1.8} />
        {count > 0 && <span className="text-xs font-semibold">{count}</span>}
      </button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <CommentsPanel
          targetType={targetType}
          targetId={targetId}
          onClose={() => setOpen(false)}
          countKey={countKey}
          open={open}
        />
      </DialogPrimitive.Root>
    </>
  );
}

function CommentsPanel({
  targetType,
  targetId,
  onClose,
  countKey,
  open,
}: {
  targetType: ReactionTarget;
  targetId: string;
  onClose: () => void;
  countKey: (string | undefined)[];
  open: boolean;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const listKey = ["comments", targetType, targetId];

  const { data: comments = [], isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => listComments(targetType, targetId),
    enabled: open && !!targetId,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: listKey });
    qc.invalidateQueries({ queryKey: countKey });
  };

  const post = useMutation({
    mutationFn: () => addComment(targetType, targetId, draft),
    onSuccess: () => {
      setDraft("");
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: refresh,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error"),
  });

  const submit = () => {
    if (!draft.trim() || post.isPending) return;
    nativeVibrate(10);
    post.mutate();
  };

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl flex-col rounded-t-2xl border-t border-border/60 bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
        style={{ maxHeight: "80dvh" }}
      >
        {/* grabber + title */}
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <DialogPrimitive.Title className="text-sm font-bold text-foreground">
            {t("comment.title")}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label={t("common.close")}
            className="pressable flex size-8 items-center justify-center rounded-full text-foreground/50"
          >
            <X className="size-5" />
          </DialogPrimitive.Close>
        </div>

        {/* thread */}
        <div className="min-h-[6rem] flex-1 space-y-3.5 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <p className="py-6 text-center text-xs text-foreground/40">{t("common.loading")}</p>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-xs text-foreground/40">{t("comment.empty")}</p>
          ) : (
            comments.map((c) => {
              const color = athleteColor(c.user_id);
              const name = c.display_name || t("spearo.feedAthlete");
              const mine = c.user_id === user?.id;
              return (
                <div key={c.id} className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[0.6rem] font-bold text-white"
                    style={{ background: `${color}44` }}
                  >
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" className="size-full object-cover" />
                    ) : (
                      athleteInitials(name)
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="rounded-2xl rounded-tl-sm bg-[rgba(var(--ink),0.05)] px-3 py-2">
                      <p className="text-[0.7rem] font-semibold text-foreground">{name}</p>
                      <p className="whitespace-pre-wrap break-words text-[0.8rem] leading-snug text-foreground/90">
                        {c.body}
                      </p>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 pl-1">
                      <span className="text-[0.6rem] text-foreground/40">
                        {formatDistanceToNowStrict(new Date(c.created_at), {
                          addSuffix: true,
                          locale: lang === "el" ? elLocale : undefined,
                        })}
                      </span>
                      {mine && (
                        <button
                          type="button"
                          onClick={() => remove.mutate(c.id)}
                          className="pressable flex items-center gap-1 text-[0.6rem] text-foreground/40 hover:text-red-500"
                        >
                          <Trash2 className="size-3" />
                          {t("common.delete")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* composer */}
        <div
          className="flex items-end gap-2 border-t border-border/60 px-3 pt-2"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={t("comment.placeholder")}
            className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-2xl bg-[rgba(var(--ink),0.05)] px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground/35"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim() || post.isPending}
            aria-label={t("comment.send")}
            className="pressable flex size-10 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
            style={{ background: "#1D9E75" }}
          >
            <Send className="size-4 -rotate-12" />
          </button>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
