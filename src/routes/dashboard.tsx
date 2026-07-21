import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Waves, ClipboardList, CalendarDays, History, Users } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { AvatarBubble } from "@/components/AvatarBubble";
import { useAuth } from "@/hooks/use-auth";
import {
  listPublicProfiles,
  listFeedDives,
  type SocialProfile,
  type FeedDive,
} from "@/lib/profiles";
import { disciplineName, formatResult, type DisciplineCode } from "@/lib/diving";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { nativeVibrate } from "@/lib/native";
import { useI18n } from "@/lib/i18n";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Apnos" }] }),
  component: () => (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  ),
});

// Gold medal chip surface — identical to the records/feed PB medal.
const MEDAL_GOLD = "linear-gradient(135deg, #F7CE73 0%, #EF9F27 55%, #C97F16 100%)";

// Discipline-themed underwater gradients: dives carry no photos, so each feed
// card gets a deep-water backdrop whose hue tracks the discipline — pool
// disciplines sit in the teal/cyan band, depth disciplines sink toward
// indigo/navy. Derived from the shared underwater palette; no new assets.
const DISCIPLINE_HUE: Record<DisciplineCode, number> = {
  STA: 168,
  DYN: 188,
  DYNB: 200,
  DNF: 210,
  CWT: 220,
  CWTB: 232,
  CNF: 244,
  FIM: 256,
};

function disciplineGradient(code: DisciplineCode): string {
  const h = DISCIPLINE_HUE[code] ?? 210;
  return `linear-gradient(180deg, hsl(${h},55%,24%) 0%, hsl(${h + 10},60%,12%) 60%, #02101d 100%)`;
}

// ── BubbleHero ─────────────────────────────────────────────────────────────────
// The animated underwater hero shell (rising bubbles + light shafts), unchanged.

function BubbleHero({ children }: { children: React.ReactNode }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ns = "http://www.w3.org/2000/svg";
    const bubbles: SVGCircleElement[] = [];
    for (let i = 0; i < 22; i++) {
      const c = document.createElementNS(ns, "circle");
      const x = 5 + Math.random() * 90;
      const r = 0.5 + Math.random() * 2.5;
      const dur = (5 + Math.random() * 7).toFixed(1);
      const delay = -(Math.random() * 9).toFixed(1);
      c.setAttribute("cx", x + "%");
      c.setAttribute("cy", "105%");
      c.setAttribute("r", r + "%");
      c.setAttribute("fill", "#9FE1CB");
      c.style.opacity = (0.15 + Math.random() * 0.45).toFixed(2);
      c.style.animation = `bubble-rise ${dur}s ${delay}s linear infinite`;
      svg.appendChild(c);
      bubbles.push(c);
    }
    return () => bubbles.forEach((b) => b.remove());
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10"
      style={{
        background: "linear-gradient(160deg, #1a3a5c 0%, #10293f 40%, #0a1622 100%)",
        minHeight: 120,
      }}
    >
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="sun-hero" cx="50%" cy="-10%" r="75%">
            <stop offset="0%" stopColor="#5DCAA5" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#1D9E75" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#sun-hero)" />
        <line x1="20%" y1="0" x2="28%" y2="100%" stroke="#5DCAA5" strokeWidth="1" opacity="0.07" />
        <line x1="50%" y1="0" x2="46%" y2="100%" stroke="#5DCAA5" strokeWidth="1" opacity="0.07" />
        <line x1="78%" y1="0" x2="70%" y2="100%" stroke="#5DCAA5" strokeWidth="1" opacity="0.07" />
      </svg>
      <svg
        ref={svgRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
      <div className="relative z-10 p-5">{children}</div>
    </div>
  );
}

// ── Dashboard = the Apnos community feed ──────────────────────────────────────
// The freediving home mirrors the Spearo one: public-athlete avatars row (same
// AvatarBubble component), a quick-chips row into the training hubs, and the
// shared-dive feed from the sanitized feed_dives view (result data only — no
// notes, wellness, gear or conditions exist in the payload). Author identity is
// stitched CLIENT-SIDE from profiles (two queries + a map, no embedding).
// Logging stays on the bottom-nav "+" (→ /log).

function Dashboard() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const el = lang === "el";

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["public-profiles"],
    queryFn: () => listPublicProfiles(50),
    enabled: !!user,
  });

  const { data: feed = [], isLoading: feedLoading } = useQuery({
    queryKey: ["feed-dives"],
    queryFn: () => listFeedDives({ limit: 30 }),
    enabled: !!user,
  });

  const profileByUser = useMemo(() => new Map(profiles.map((p) => [p.user_id, p])), [profiles]);
  const isLoading = profilesLoading || feedLoading;

  // Quick access into the existing training hubs — routes unchanged.
  const chips = [
    { to: "/train", icon: Waves, label: el ? "Προπόνηση" : "Train" },
    { to: "/planner", icon: ClipboardList, label: el ? "Πλάνο" : "Plan" },
    { to: "/calendar", icon: CalendarDays, label: el ? "Ημερολόγιο" : "Calendar" },
    { to: "/history", icon: History, label: el ? "Ιστορικό" : "History" },
  ] as const;

  return (
    <div className="space-y-5 pb-24">
      {/* hero */}
      <BubbleHero>
        <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-[#5DCAA5]">
          Apnos
        </p>
        <p className="text-2xl font-light text-white">{el ? "Κοινότητα" : "Community"}</p>
        <p className="mt-1 text-xs text-white/55">
          {el
            ? "Οι προσπάθειες που μοιράζεται η ομάδα — ποτέ σημειώσεις και wellness."
            : "The efforts the crew is sharing — never notes or wellness."}
        </p>
      </BubbleHero>

      {/* public athletes row — same component as the Spearo feed */}
      {profiles.length > 0 && (
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
          {profiles.map((p) => (
            <AvatarBubble key={p.user_id} profile={p} fallbackName={el ? "Αθλητής" : "Athlete"} />
          ))}
        </div>
      )}

      {/* quick chips into the training hubs */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {chips.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            onClick={() => nativeVibrate(10)}
            className="pressable surface-1 flex shrink-0 items-center gap-2 rounded-full py-2 pl-2 pr-4"
            style={{
              background: "rgba(29,158,117,0.08)",
              border: "1px solid rgba(93,202,165,0.2)",
            }}
          >
            <span
              className="flex size-7 items-center justify-center rounded-full"
              style={{ background: "rgba(29,158,117,0.16)" }}
            >
              <Icon className="size-3.5" style={{ color: "#5DCAA5" }} />
            </span>
            <span className="text-xs font-semibold text-foreground/80">{label}</span>
          </Link>
        ))}
      </div>

      {/* shared-dive feed */}
      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : feed.length === 0 ? (
        <div
          className="surface-2 relative overflow-hidden rounded-2xl p-10 text-center"
          style={{
            background:
              "linear-gradient(180deg, #0d4a63 0%, #0a3852 30%, #072a42 55%, #041a2e 80%, #02101d 100%)",
          }}
        >
          <div className="relative z-10 flex flex-col items-center">
            <div
              className="surface-1 flex size-16 items-center justify-center rounded-full"
              style={{ background: "rgba(29,158,117,0.18)" }}
            >
              <Users className="size-8" style={{ color: "#5DCAA5" }} />
            </div>
            <p className="mt-4 max-w-xs font-semibold text-white">
              {el
                ? "Η κοινότητα ξεκινάει εδώ — κοινοποίησε μια προσπάθεια."
                : "The community starts here — share an effort."}
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {feed.map((d) => (
            <FeedDiveCard
              key={d.id}
              dive={d}
              author={profileByUser.get(d.user_id)}
              fallbackName={el ? "Αθλητής" : "Athlete"}
              lang={el ? "el" : "en"}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// One shared dive in the community feed. No photos exist for dives, so the
// card leans on the discipline-themed underwater gradient; the RESULT is the
// hero (formatResult), with a gold PB medal when the dive is a personal best.
// Renders ONLY sanitized feed_dives columns. Taps through to the athlete page.
function FeedDiveCard({
  dive: d,
  author,
  fallbackName,
  lang,
}: {
  dive: FeedDive;
  author?: SocialProfile;
  fallbackName: string;
  lang: "el" | "en";
}) {
  const code = d.discipline as DisciplineCode;
  const name = author?.display_name || fallbackName;
  const color = athleteColor(d.user_id);
  const dateStr = new Date(d.dive_date).toLocaleDateString(lang === "el" ? "el-GR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <li className="surface-2 pressable relative block overflow-hidden rounded-2xl">
      <Link
        to="/athlete/$id"
        params={{ id: d.user_id }}
        onClick={() => nativeVibrate(10)}
        className="block"
      >
        <div className="absolute inset-0" style={{ background: disciplineGradient(code) }} />

        <div className="relative flex min-h-[10rem] flex-col justify-between p-4">
          <div className="flex items-center gap-2">
            <span
              className="rounded-md px-2 py-0.5 text-[0.6rem] font-bold tracking-wider"
              style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}
            >
              {code}
            </span>
            {d.is_personal_best && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6rem] font-black tracking-[0.14em]"
                style={{
                  background: MEDAL_GOLD,
                  color: "#3A2503",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 10px rgba(239,159,39,0.45)",
                }}
              >
                <Trophy className="size-3" /> PB
              </span>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-white/85">{disciplineName(code, lang)}</p>
            <p
              className="mt-0.5 text-4xl font-black tabular-nums text-white"
              style={{
                fontFamily: "'Outfit', sans-serif",
                textShadow: "0 2px 12px rgba(2,10,19,0.6)",
              }}
            >
              {formatResult(code, d.result)}
            </p>

            {/* author + date row */}
            <div className="mt-3 flex items-center gap-2">
              {author?.avatar_url ? (
                <img
                  src={author.avatar_url}
                  alt=""
                  className="size-7 shrink-0 rounded-full object-cover"
                  style={{ border: `1px solid ${color}66` }}
                />
              ) : (
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold"
                  style={{
                    background: `${color}33`,
                    color: "#fff",
                    border: `1px solid ${color}66`,
                  }}
                >
                  {athleteInitials(name)}
                </span>
              )}
              <span className="min-w-0 truncate text-xs font-semibold text-white/85">{name}</span>
              <span className="ml-auto shrink-0 text-[0.65rem] text-white/50">{dateStr}</span>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}
