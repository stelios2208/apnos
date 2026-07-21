import { Link } from "@tanstack/react-router";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { nativeVibrate } from "@/lib/native";
import type { SocialProfile } from "@/lib/profiles";

// One public athlete in a horizontal community row — taps through to their
// public athlete page (/athlete/$id). Shared by the Spearo feed and the Apnos
// feed so both homes render the exact same identity affordance.
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
      className="pressable flex w-16 shrink-0 flex-col items-center gap-1.5"
    >
      {p.avatar_url ? (
        <img
          src={p.avatar_url}
          alt={name}
          className="size-14 rounded-full object-cover"
          style={{ border: `2px solid ${color}55` }}
        />
      ) : (
        <span
          className="flex size-14 items-center justify-center rounded-full text-sm font-bold"
          style={{ background: `${color}22`, color, border: `2px solid ${color}55` }}
        >
          {athleteInitials(name)}
        </span>
      )}
      <span className="w-full truncate text-center text-[0.65rem] font-medium text-foreground/60">
        {name.split(" ")[0]}
      </span>
    </Link>
  );
}
