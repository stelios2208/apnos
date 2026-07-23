import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";
import { nativeVibrate } from "@/lib/native";
import type { SocialProfile } from "@/lib/profiles";

// ── Community "stories" row (Facebook style) ─────────────────────────────────
// A horizontally scrolling strip of TALL portrait cards, exactly like Facebook
// stories: our own "Create" card comes FIRST (so we can always post / drop a
// promoted card there), then one card per public athlete — their photo as the
// background, a small ringed avatar top-left, their name at the bottom.
//
// NOTE: the small round ringed avatars (AvatarBubble) are the PROFILE affordance
// used elsewhere (e.g. the friends row) — deliberately NOT reused here; stories
// are their own tall-card shape.
//
// `mode` picks where the + card points when no composer callback is wired: the
// Apnos "+" opens the dive log, the Spearo "+" the catch log.
export function StoriesRow({
  profiles,
  fallbackName,
  mode,
  onCreate,
}: {
  profiles: SocialProfile[];
  fallbackName: string;
  mode: "apnos" | "spearo";
  /** When set, the Create card opens the post composer instead of the log. */
  onCreate?: () => void;
}) {
  const { t } = useI18n();

  return (
    // full-bleed horizontal scroller; scrollbar hidden so a swipe never shows a
    // bottom line.
    <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
      <CreateStoryCard mode={mode} label={t("stories.create")} onCreate={onCreate} />
      {profiles.map((p) => (
        <StoryCard key={p.user_id} profile={p} fallbackName={fallbackName} />
      ))}
    </div>
  );
}

// Shared tall-card frame (FB story aspect).
const CARD_CLS =
  "relative block h-44 w-[6.6rem] shrink-0 overflow-hidden rounded-2xl surface-1 pressable";

function CreateStoryCard({
  mode,
  label,
  onCreate,
}: {
  mode: "apnos" | "spearo";
  label: string;
  onCreate?: () => void;
}) {
  const inner = (
    <>
      {/* top: brand photo-stand-in */}
      <div
        className="h-[62%] w-full"
        style={{ background: "linear-gradient(160deg, #1a3a5c 0%, #10293f 45%, #0a1622 100%)" }}
      />
      {/* bottom: solid footer with the label */}
      <div className="flex h-[38%] w-full items-end justify-center bg-card pb-2">
        <span className="px-1 text-center text-[0.62rem] font-semibold leading-tight text-foreground/80">
          {label}
        </span>
      </div>
      {/* + circle straddling the divider */}
      <span
        className="absolute left-1/2 top-[62%] flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-card"
        style={{ background: "#1D9E75" }}
      >
        <Plus className="size-4 text-white" />
      </span>
    </>
  );

  if (onCreate) {
    return (
      <button
        type="button"
        className={CARD_CLS}
        onClick={() => {
          nativeVibrate(10);
          onCreate();
        }}
      >
        {inner}
      </button>
    );
  }

  // Fallback destinations (fully typed TanStack Links).
  return mode === "spearo" ? (
    <Link
      to="/spearo"
      search={{ log: true }}
      onClick={() => nativeVibrate(10)}
      className={CARD_CLS}
    >
      {inner}
    </Link>
  ) : (
    <Link to="/log" onClick={() => nativeVibrate(10)} className={CARD_CLS}>
      {inner}
    </Link>
  );
}

function StoryCard({ profile, fallbackName }: { profile: SocialProfile; fallbackName: string }) {
  const name = profile.display_name || fallbackName;
  const color = athleteColor(profile.user_id);
  return (
    <Link
      to="/athlete/$id"
      params={{ id: profile.user_id }}
      onClick={() => nativeVibrate(10)}
      className={CARD_CLS}
    >
      {/* background: their photo, or a tinted gradient with a big initial */}
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ background: `linear-gradient(160deg, ${color}66 0%, #0a1622 100%)` }}
        >
          <span className="text-2xl font-black text-white/70">{athleteInitials(name)}</span>
        </div>
      )}
      {/* readability gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(2,10,19,0.25) 0%, rgba(2,10,19,0) 40%, rgba(2,10,19,0.85) 100%)",
        }}
      />
      {/* small ringed avatar top-left (the profile affordance, in miniature) */}
      <span
        className="absolute left-2 top-2 flex size-9 items-center justify-center rounded-full p-[2px]"
        style={{ background: "conic-gradient(from 210deg, #1D9E75, #5DCAA5, #9FE1CB, #1D9E75)" }}
      >
        <span
          className="flex size-full items-center justify-center overflow-hidden rounded-full"
          style={{ background: "var(--background)" }}
        >
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="size-full rounded-full object-cover" />
          ) : (
            <span className="text-[0.6rem] font-bold" style={{ color }}>
              {athleteInitials(name)}
            </span>
          )}
        </span>
      </span>
      {/* name */}
      <span
        className="absolute inset-x-0 bottom-0 line-clamp-2 p-2 text-[0.7rem] font-bold leading-tight text-white"
        style={{ textShadow: "0 1px 6px rgba(2,10,19,0.8)" }}
      >
        {name}
      </span>
    </Link>
  );
}
