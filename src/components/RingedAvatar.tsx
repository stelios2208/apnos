import { athleteInitials, athleteColor } from "@/lib/athletes";

// The green Instagram-style gradient ring around a circular avatar, reused in
// every feed-card header and story header so the profile picture reads the same
// everywhere. `size` is the outer diameter in px.
export function RingedAvatar({
  avatarUrl,
  name,
  userId,
  size = 38,
}: {
  avatarUrl?: string | null;
  name: string;
  userId: string;
  size?: number;
}) {
  const color = athleteColor(userId);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full p-[2px]"
      style={{
        width: size,
        height: size,
        background: "conic-gradient(from 210deg, #1D9E75, #5DCAA5, #9FE1CB, #1D9E75)",
      }}
    >
      <span
        className="flex size-full items-center justify-center overflow-hidden rounded-full p-[1.5px]"
        style={{ background: "var(--background)" }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="size-full rounded-full object-cover" />
        ) : (
          <span
            className="flex size-full items-center justify-center rounded-full text-xs font-bold"
            style={{ background: `${color}22`, color }}
          >
            {athleteInitials(name)}
          </span>
        )}
      </span>
    </span>
  );
}
