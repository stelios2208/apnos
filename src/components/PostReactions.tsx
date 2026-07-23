import { useEffect, useState } from "react";
import { Heart, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { nativeVibrate } from "@/lib/native";

// ── Post reactions (Instagram-style) ─────────────────────────────────────────
// Icon-only action row, no pill backgrounds: a heart (like), the "I'm OK" 👌
// safety signal divers use, and a share button. Reactions are stored
// DEVICE-LOCAL in localStorage (no reactions table yet) so the tap-to-react feel
// works offline and across reloads. Swap the storage helpers for a data-layer
// call when a shared table lands; the component API stays the same.

type Kind = "heart" | "ok";

function storageKey(targetType: string, targetId: string, kind: Kind): string {
  return `apnos:react:${targetType}:${targetId}:${kind}`;
}

function readReaction(targetType: string, targetId: string, kind: Kind): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey(targetType, targetId, kind)) === "1";
  } catch {
    return false;
  }
}

function writeReaction(targetType: string, targetId: string, kind: Kind, on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const key = storageKey(targetType, targetId, kind);
    if (on) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    /* private mode / quota — the reaction just won't persist, no crash */
  }
}

export function PostReactions({
  targetType,
  targetId,
  shareData,
}: {
  targetType: "dive" | "catch" | "post";
  targetId: string;
  /** Enables the share button; passed to the native share sheet. */
  shareData?: { title?: string; text?: string; url?: string };
}) {
  const { t } = useI18n();
  const [heart, setHeart] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setHeart(readReaction(targetType, targetId, "heart"));
    setOk(readReaction(targetType, targetId, "ok"));
  }, [targetType, targetId]);

  const toggle = (kind: Kind) => {
    nativeVibrate(10);
    if (kind === "heart") {
      const next = !heart;
      setHeart(next);
      writeReaction(targetType, targetId, "heart", next);
    } else {
      const next = !ok;
      setOk(next);
      writeReaction(targetType, targetId, "ok", next);
    }
  };

  const share = async () => {
    nativeVibrate(10);
    const data = {
      title: shareData?.title || "Apnos",
      text: shareData?.text || "",
      url: shareData?.url || (typeof window !== "undefined" ? window.location.origin : ""),
    };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(data);
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(`${data.text} ${data.url}`.trim());
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  return (
    // icon-only, larger, transparent — sits on the card background like Instagram
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => toggle("heart")}
        aria-pressed={heart}
        aria-label={t("react.heart")}
        className="pressable -m-1 p-1"
        style={{ color: heart ? "#ff3b5c" : "var(--foreground)" }}
      >
        <Heart className="size-7" fill={heart ? "currentColor" : "none"} strokeWidth={1.8} />
      </button>

      <button
        type="button"
        onClick={() => toggle("ok")}
        aria-pressed={ok}
        aria-label={t("react.ok")}
        className="pressable -m-1 p-1 text-2xl leading-none"
        style={{ opacity: ok ? 1 : 0.85, filter: ok ? "none" : "grayscale(0.15)" }}
      >
        <span aria-hidden>👌</span>
      </button>

      <button
        type="button"
        onClick={share}
        aria-label={t("react.share")}
        className="pressable -m-1 p-1"
        style={{ color: "var(--foreground)" }}
      >
        <Send className="size-6 -rotate-12" strokeWidth={1.8} />
      </button>
    </div>
  );
}
