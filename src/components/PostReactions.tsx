import { useEffect, useState } from "react";
import { Heart, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { nativeVibrate } from "@/lib/native";

// ── Post reactions (Instagram-style) ─────────────────────────────────────────
// Icon-only action row, no pill backgrounds, premium line-icons: a heart (deep
// Instagram red when liked), the "I'm OK" 👌 dive signal drawn as a matching
// white outline hand, and a share button. Reactions are stored DEVICE-LOCAL in
// localStorage (no reactions table yet). Swap the storage helpers for a
// data-layer call when a shared table lands; the API stays the same.

const HEART_RED = "#ED4956"; // Instagram's deep like-red
const OK_GREEN = "#1D9E75"; // brand green for the OK signal

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
    /* private mode / quota — no persistence, no crash */
  }
}

// The diver's "I'm OK" 👌 as a clean outline that matches the heart: a pinch
// loop + three raised fingers. Fills softly when active.
function OkHand({ active, size = 25 }: { active: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle
        cx="7.5"
        cy="15.5"
        r="4"
        fill={active ? "currentColor" : "none"}
        opacity={active ? 0.18 : 1}
      />
      <circle cx="7.5" cy="15.5" r="4" />
      <path d="M11 13.2 V6.6" />
      <path d="M13.6 13.6 V7.6" />
      <path d="M16.2 14 V9.2" />
    </svg>
  );
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
        onClick={() => toggle("heart")}
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
        onClick={() => toggle("ok")}
        aria-pressed={ok}
        aria-label={t("react.ok")}
        className="pressable -m-1 p-1"
        style={{ color: ok ? OK_GREEN : "var(--foreground)" }}
      >
        <OkHand active={ok} />
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
