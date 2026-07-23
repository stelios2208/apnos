import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Heart, MessageCircle, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { nativeVibrate } from "@/lib/native";

// ── Post reactions (Instagram-style) ─────────────────────────────────────────
// Icon-only action row, no pill backgrounds, premium line-icons: heart (deep
// Instagram red when liked) · message · share — exactly the Instagram trio. The
// like is stored DEVICE-LOCAL in localStorage (no reactions table yet); swap the
// storage helpers for a data-layer call when a shared table lands.

const HEART_RED = "#ED4956"; // Instagram's deep like-red

function heartKey(targetType: string, targetId: string): string {
  return `apnos:react:${targetType}:${targetId}:heart`;
}
function readHeart(targetType: string, targetId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(heartKey(targetType, targetId)) === "1";
  } catch {
    return false;
  }
}
function writeHeart(targetType: string, targetId: string, on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const key = heartKey(targetType, targetId);
    if (on) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    /* private mode / quota — no persistence, no crash */
  }
}

export function PostReactions({
  targetType,
  targetId,
  shareData,
}: {
  targetType: "dive" | "catch" | "post";
  targetId: string;
  shareData?: { title?: string; text?: string; url?: string };
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [heart, setHeart] = useState(false);

  useEffect(() => {
    setHeart(readHeart(targetType, targetId));
  }, [targetType, targetId]);

  const toggleHeart = () => {
    nativeVibrate(10);
    const next = !heart;
    setHeart(next);
    writeHeart(targetType, targetId, next);
  };

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

  return (
    <div className="flex items-center gap-5">
      <button
        type="button"
        onClick={toggleHeart}
        aria-pressed={heart}
        aria-label={t("react.heart")}
        className="pressable -m-1 p-1"
        style={{ color: heart ? HEART_RED : "var(--foreground)" }}
      >
        <Heart
          style={{ width: 25, height: 25 }}
          fill={heart ? "currentColor" : "none"}
          strokeWidth={1.8}
        />
      </button>

      <button
        type="button"
        onClick={() => {
          nativeVibrate(10);
          navigate({ to: "/messages" });
        }}
        aria-label={t("react.message")}
        className="pressable -m-1 p-1"
        style={{ color: "var(--foreground)" }}
      >
        <MessageCircle style={{ width: 24, height: 24 }} strokeWidth={1.8} />
      </button>

      <button
        type="button"
        onClick={share}
        aria-label={t("react.share")}
        className="pressable -m-1 p-1"
        style={{ color: "var(--foreground)" }}
      >
        <Send style={{ width: 23, height: 23 }} className="-rotate-12" strokeWidth={1.8} />
      </button>
    </div>
  );
}
