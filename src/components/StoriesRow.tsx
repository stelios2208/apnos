import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AvatarBubble } from "@/components/AvatarBubble";
import { useI18n } from "@/lib/i18n";
import { nativeVibrate } from "@/lib/native";
import type { SocialProfile } from "@/lib/profiles";

// ── Community "stories" row (Facebook / Instagram style) ─────────────────────
// A horizontally scrolling strip that always leads with a "Create" (+) tile —
// the entry point for a new post, and the slot we later reuse for a promoted /
// sponsored card — followed by the public athletes, each wearing the green
// gradient ring (see AvatarBubble). Shared by both community homes.
//
// `mode` picks where the + tile points: the Apnos "+" opens the dive log, the
// Spearo "+" opens the catch log (the same destinations the bottom-nav "+"
// uses), so the create affordance is consistent everywhere.
export function StoriesRow({
  profiles,
  fallbackName,
  mode,
}: {
  profiles: SocialProfile[];
  fallbackName: string;
  mode: "apnos" | "spearo";
}) {
  const { t } = useI18n();

  return (
    // full-bleed horizontal scroller; fixed item widths keep the row height
    // stable so tapping a bubble never reflows the feed below it.
    <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* leading Create / + tile (also the future promoted-post slot) */}
      <CreateTile mode={mode} label={t("stories.create")} />

      {profiles.map((p) => (
        <AvatarBubble key={p.user_id} profile={p} fallbackName={fallbackName} />
      ))}
    </div>
  );
}

function CreateTile({ mode, label }: { mode: "apnos" | "spearo"; label: string }) {
  const inner = (
    <>
      <span
        className="flex size-16 items-center justify-center rounded-full"
        style={{
          background: "rgba(29,158,117,0.1)",
          border: "2px dashed rgba(93,202,165,0.5)",
        }}
      >
        <span
          className="flex size-8 items-center justify-center rounded-full"
          style={{ background: "#1D9E75" }}
        >
          <Plus className="size-5 text-white" />
        </span>
      </span>
      <span className="w-full truncate text-center text-[0.65rem] font-semibold text-foreground/70">
        {label}
      </span>
    </>
  );

  const cls = "pressable flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5";

  // Two fixed destinations so the TanStack Link stays fully typed.
  return mode === "spearo" ? (
    <Link to="/spearo" search={{ log: true }} onClick={() => nativeVibrate(10)} className={cls}>
      {inner}
    </Link>
  ) : (
    <Link to="/log" onClick={() => nativeVibrate(10)} className={cls}>
      {inner}
    </Link>
  );
}
