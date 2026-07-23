import { Link } from "@tanstack/react-router";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { nativeVibrate } from "@/lib/native";
import type { SocialProfile } from "@/lib/profiles";

// One public athlete in a horizontal community "stories" row — taps through to
// their public athlete page (/athlete/$id). Shared by the Spearo feed and the
// Apnos feed so both homes render the exact same identity affordance.
//
// The avatar sits inside an Instagram-style gradient RING — ours is in the
// brand green (the logo colour) rather than Instagram's red/orange. The ring is
// a gradient-filled circle with the avatar floated on top of a small inset, so
// there is a crisp coloured halo around every profile.
export function AvatarBubble({
  profile: p,
  fallbackName,
}: {
  profile: SocialProfile;
  fallbackName: string;
}) {
  const name = p.display_name || fallbackName;
  const color = athleteColor(p.user_id);
  return (
    <Link
      to="/athlete/$id"
      params={{ id: p.user_id }}
      onClick={() => nativeVibrate(10)}
      className="pressable flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5"
    >
      {/* green Instagram-style gradient ring */}
      <span
        className="flex size-16 items-center justify-center rounded-full p-[2.5px]"
        style={{
          background: "conic-gradient(from 210deg, #1D9E75, #5DCAA5, #9FE1CB, #1D9E75)",
        }}
      >
        {/* inner gap so the ring reads as a halo, not a border */}
        <span
          className="flex size-full items-center justify-center rounded-full p-[2px]"
          style={{ background: "var(--background)" }}
        >
          {p.avatar_url ? (
            <img src={p.avatar_url} alt={name} className="size-full rounded-full object-cover" />
          ) : (
            <span
              className="flex size-full items-center justify-center rounded-full text-sm font-bold"
              style={{ background: `${color}22`, color }}
            >
              {athleteInitials(name)}
            </span>
          )}
        </span>
      </span>
      <span className="w-full truncate text-center text-[0.65rem] font-medium text-foreground/60">
        {name.split(" ")[0]}
      </span>
    </Link>
  );
}
