import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { createStory } from "@/lib/stories";
import { uploadCatchPhoto, deleteCatchPhoto } from "@/lib/spearo-photos";

// ── Story composer ───────────────────────────────────────────────────────────
// A fullscreen overlay for creating a story: pick a photo (the file dialog opens
// immediately), preview it tall, add an optional caption, and share. The photo
// goes through the metadata-stripping catch-photos upload. Controlled by the
// parent feed via `open`.
const GREEN = "#1D9E75";

export function StoryComposer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();

  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setCaption("");
    setPreview(null);
    setPhotoUrl(null);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // When the overlay opens with nothing chosen yet, pop the picker immediately.
  useEffect(() => {
    if (open && !preview) fileInputRef.current?.click();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setPhotoUrl(null);
    setUploading(true);
    try {
      const url = await uploadCatchPhoto(file, user.id);
      setPhotoUrl(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("story.photoError"));
      reset();
    } finally {
      setUploading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: () => createStory({ photo_url: photoUrl!, caption: caption.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stories"] });
      toast.success(t("story.shared"));
      reset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t("story.couldNotShare")),
  });

  const cancel = () => {
    if (photoUrl) void deleteCatchPhoto(photoUrl).catch(() => {});
    reset();
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(2,10,19,0.96)" }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSelect}
      />

      {/* top bar */}
      <div className="flex items-center justify-between p-4">
        <button
          type="button"
          onClick={cancel}
          aria-label={t("common.cancel")}
          className="flex size-10 items-center justify-center rounded-full text-white"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          <X className="size-5" />
        </button>
        <span className="text-sm font-semibold text-white/80">{t("story.newTitle")}</span>
        <span className="size-10" />
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5">
        {preview ? (
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl">
            <img src={preview} alt="" className="max-h-[55vh] w-full object-contain" />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 text-sm font-semibold text-white">
                <Loader2 className="size-4 animate-spin" />
                {t("story.uploading")}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-3 rounded-2xl px-8 py-12"
            style={{
              border: "1px dashed rgba(93,202,165,0.4)",
              background: "rgba(29,158,117,0.08)",
            }}
          >
            <ImagePlus className="size-8" style={{ color: "#5DCAA5" }} />
            <span className="text-sm font-semibold text-white/80">{t("story.pick")}</span>
          </button>
        )}

        {preview && (
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={t("story.captionPlaceholder")}
            className="w-full max-w-sm rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/40"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />
        )}
      </div>

      {/* share */}
      {preview && (
        <div className="p-5">
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || uploading || !photoUrl}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: GREEN }}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {t("story.share")}
          </button>
        </div>
      )}
    </div>
  );
}
