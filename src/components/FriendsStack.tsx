import { useState } from "react";
import { Users } from "lucide-react";
import { AvatarBubble } from "@/components/AvatarBubble";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";
import type { SocialProfile } from "@/lib/profiles";

// Overlapping avatar stack + "Friends · N" label (Instagram/profile style).
// Tapping expands the full crew as a horizontal row of ringed avatars — the
// exact same affordance on the profile and in the feed, so they read the same.
export function FriendsStack({
  profiles,
  fallbackName,
}: {
  profiles: SocialProfile[];
  fallbackName: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  if (profiles.length === 0) return null;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="pressable flex w-full items-center gap-3 text-left"
      >
        <div className="flex items-center">
          {profiles.slice(0, 5).map((f, i) => {
            const fc = athleteColor(f.user_id);
            const fn = f.display_name || fallbackName;
            return (
              <span
                key={f.user_id}
                className="flex size-9 items-center justify-center overflow-hidden rounded-full text-[0.6rem] font-bold"
                style={{
                  marginLeft: i === 0 ? 0 : -12,
                  background: `${fc}33`,
                  color: "#fff",
                  border: "2px solid var(--background)",
                  zIndex: 5 - i,
                }}
              >
                {f.avatar_url ? (
                  <img src={f.avatar_url} alt="" className="size-full object-cover" />
                ) : (
                  athleteInitials(fn)
                )}
              </span>
            );
          })}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Users className="size-4" style={{ color: "#5DCAA5" }} />
            {t("feed.friends")}
            <span className="text-foreground/40">· {profiles.length}</span>
          </p>
          <p className="text-xs text-foreground/45">{t("feed.friendsSub")}</p>
        </div>
      </button>

      {open && (
        <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
          {profiles.map((f) => (
            <AvatarBubble key={f.user_id} profile={f} fallbackName={fallbackName} />
          ))}
        </div>
      )}
    </div>
  );
}
