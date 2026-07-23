import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { nativeVibrate } from "@/lib/native";

// ── Post reactions (Facebook-style) ──────────────────────────────────────────
// A lightweight reaction bar for a feed post: a "heart" (like) and an "I'm OK"
// safety signal (the 👌 divers use in the water). Reactions are stored
// DEVICE-LOCAL in localStorage for now — there is no reactions table yet, so
// this keeps the familiar tap-to-react feel working offline and across reloads
// without a backend. When a shared reactions table lands, swap the storage
// helpers below for a data-layer call; the component API stays the same.
//
// SSR-safe: localStorage is only touched inside effects / event handlers, and
// the initial render is the neutral (un-reacted) state so server and client
// markup match.

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
  onDark = true,
}: {
  targetType: "dive" | "catch" | "post";
  targetId: string;
  /** true when the bar sits over a dark photo/gradient (feed cards). */
  onDark?: boolean;
}) {
  const { t } = useI18n();
  const [heart, setHeart] = useState(false);
  const [ok, setOk] = useState(false);

  // Hydrate from localStorage after mount (keeps SSR markup neutral).
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

  const base = onDark
    ? "text-white/80 hover:text-white"
    : "text-foreground/60 hover:text-foreground";
  const idle = onDark ? "rgba(255,255,255,0.08)" : "rgba(var(--ink),0.04)";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => toggle("heart")}
        aria-pressed={heart}
        aria-label={t("react.heart")}
        className={`pressable flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${base}`}
        style={{
          background: heart ? "rgba(240,80,90,0.18)" : idle,
          color: heart ? "#ff6b76" : undefined,
        }}
      >
        <Heart className="size-4" fill={heart ? "currentColor" : "none"} />
        {t("react.heart")}
      </button>

      <button
        type="button"
        onClick={() => toggle("ok")}
        aria-pressed={ok}
        aria-label={t("react.ok")}
        className={`pressable flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${base}`}
        style={{
          background: ok ? "rgba(29,158,117,0.2)" : idle,
          color: ok ? "#5DCAA5" : undefined,
        }}
      >
        <span className="text-sm leading-none">👌</span>
        {t("react.ok")}
      </button>
    </div>
  );
}
