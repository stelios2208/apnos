import { useQuery } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { Heart, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { nativeVibrate } from "@/lib/native";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { listLikers } from "@/lib/reactions";
import type { ReactionTarget } from "@/lib/reactions";

// ── "Liked by" sheet ─────────────────────────────────────────────────────────
// Tapping the likes row opens this. We show WHO liked (public profiles only —
// privacy-safe), each a link to their profile. Our own branding: a brand-green
// heart header and rounded rows, not a pixel-clone of Instagram's list.

export function LikersDialog({
  targetType,
  targetId,
  open,
  onOpenChange,
}: {
  targetType: ReactionTarget;
  targetId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const { data: likers = [], isLoading } = useQuery({
    queryKey: ["likers", targetType, targetId],
    queryFn: () => listLikers(targetType, targetId),
    enabled: open && !!targetId,
  });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-2xl flex-col rounded-t-2xl border-t border-border/60 bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
          style={{ maxHeight: "70dvh" }}
        >
          <div className="flex items-center justify-between px-4 pb-1 pt-3">
            <DialogPrimitive.Title className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Heart className="size-4" fill="#1D9E75" style={{ color: "#1D9E75" }} />
              {t("likers.title")}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label={t("common.close")}
              className="pressable flex size-8 items-center justify-center rounded-full text-foreground/50"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>

          <div
            className="flex-1 space-y-1 overflow-y-auto px-2 py-2"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
          >
            {isLoading ? (
              <p className="py-6 text-center text-xs text-foreground/40">{t("common.loading")}</p>
            ) : likers.length === 0 ? (
              <p className="py-8 text-center text-xs text-foreground/40">{t("likers.empty")}</p>
            ) : (
              likers.map((l) => {
                const color = athleteColor(l.user_id);
                const name = l.display_name || t("spearo.feedAthlete");
                return (
                  <Link
                    key={l.user_id}
                    to="/athlete/$id"
                    params={{ id: l.user_id }}
                    onClick={() => {
                      nativeVibrate(10);
                      onOpenChange(false);
                    }}
                    className="pressable flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[rgba(var(--ink),0.04)]"
                  >
                    <span
                      className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
                      style={{ background: `${color}44` }}
                    >
                      {l.avatar_url ? (
                        <img src={l.avatar_url} alt="" className="size-full object-cover" />
                      ) : (
                        athleteInitials(name)
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {name}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
