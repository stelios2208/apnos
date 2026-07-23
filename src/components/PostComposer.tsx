import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Loader2, Send, X, PenLine } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { createPost } from "@/lib/posts";
import { uploadCatchPhoto, deleteCatchPhoto } from "@/lib/spearo-photos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ── Facebook-style "what's on your mind?" composer ───────────────────────────
// A free-form community post: an optional title, the body text, and an optional
// photo — NO fish/dive fields, so members can post anything (adventures,
// questions, shout-outs). Collapsed it's a one-line trigger; expanded it's the
// full form. `open` is controlled by the parent feed so the stories "+" tile
// can open it too. Posts default to public (the community-post table's default).
//
// Photos reuse the generic catch-photos upload (canvas re-encode strips EXIF).
const GREEN_LIGHT = "#5DCAA5";

export function PostComposer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhotoUrl(null);
    setPhotoUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const reset = () => {
    setTitle("");
    setBody("");
    clearPhoto();
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoUrl(null);
    setPhotoUploading(true);
    try {
      const url = await uploadCatchPhoto(file, user.id);
      setPhotoUrl(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("post.photoError"));
      clearPhoto();
    } finally {
      setPhotoUploading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: () =>
      createPost({
        title: title.trim() || null,
        body: body.trim() || null,
        photo_url: photoUrl,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success(t("post.posted"));
      reset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t("post.couldNotPost")),
  });

  const submit = () => {
    if (!body.trim() && !title.trim() && !photoUrl) {
      toast.error(t("post.empty"));
      return;
    }
    mutation.mutate();
  };

  const cancel = () => {
    // Best-effort cleanup of an uploaded-but-unsaved photo.
    if (photoUrl) void deleteCatchPhoto(photoUrl).catch(() => {});
    reset();
    onOpenChange(false);
  };

  // ── collapsed trigger ──
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="pressable surface-1 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
        style={{ border: "1px solid rgba(93,202,165,0.2)" }}
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: "rgba(29,158,117,0.16)" }}
        >
          <PenLine className="size-4" style={{ color: GREEN_LIGHT }} />
        </span>
        <span className="text-sm text-foreground/50">{t("post.placeholder")}</span>
      </button>
    );
  }

  // ── expanded form ──
  return (
    <div
      className="space-y-3 rounded-2xl p-4"
      style={{ background: "var(--card)", border: "1px solid rgba(93,202,165,0.25)" }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">{t("post.newTitle")}</p>
        <button
          type="button"
          onClick={cancel}
          aria-label={t("common.cancel")}
          className="flex size-7 items-center justify-center rounded-full text-foreground/40 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("post.titlePlaceholder")}
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("post.bodyPlaceholder")}
        rows={4}
        autoFocus
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoSelect}
      />

      {photoPreview ? (
        <div
          className="relative overflow-hidden rounded-xl"
          style={{ border: "1px solid rgba(93,202,165,0.25)" }}
        >
          <img src={photoPreview} alt="" className="max-h-64 w-full object-cover" />
          {photoUploading && (
            <div
              className="absolute inset-0 flex items-center justify-center gap-2 text-xs font-semibold text-white"
              style={{ background: "rgba(4,26,46,0.55)", backdropFilter: "blur(2px)" }}
            >
              <Loader2 className="size-4 animate-spin" />
              {t("post.photoUploading")}
            </div>
          )}
          <button
            type="button"
            onClick={clearPhoto}
            aria-label={t("post.photoRemove")}
            className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-white"
            style={{ background: "rgba(4,26,46,0.6)", backdropFilter: "blur(2px)" }}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors"
          style={{
            border: "1px dashed rgba(93,202,165,0.35)",
            background: "rgba(29,158,117,0.06)",
            color: GREEN_LIGHT,
          }}
        >
          <ImagePlus className="size-4" />
          {t("post.addPhoto")}
        </button>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="hero"
          className="flex-1 gap-2"
          onClick={submit}
          disabled={mutation.isPending || photoUploading}
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {t("post.publish")}
        </Button>
        <Button type="button" variant="outline" onClick={cancel} disabled={mutation.isPending}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
