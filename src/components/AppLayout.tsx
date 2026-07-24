import React, { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Plus,
  History,
  LogOut,
  Waves,
  UserRound,
  Home,
  MessageCircle,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { useMode, useModeAutoDefault } from "@/hooks/use-mode";
import { getMyProfile } from "@/lib/profiles";
import { nativeVibrate } from "@/lib/native";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Short haptic tick for primary taps — nativeVibrate carries all the SSR /
// no-native guards, so this is safe to call from any click handler.
const hapticTick = () => nativeVibrate(10);

const NAV_ITEM_STYLE: React.CSSProperties = {
  height: 56,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  flex: 1,
  gap: 4,
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Only /spearo consumes a search param (log: true = the catch-log view); read
  // it here so the Spearo "+" can glow exactly when the log view is open.
  const spearoLogOpen = useRouterState({
    select: (s) => (s.location.search as { log?: boolean }).log === true,
  });

  // App mode drives ONLY which bottom-nav tab set renders (below). `mode` is
  // always a concrete value; the smart default resolves once for new users.
  const { mode, setMode } = useMode();
  useModeAutoDefault();

  // My profile — drives the Instagram-style avatar on the profile tab.
  const { data: myProfile } = useQuery({
    queryKey: ["profile-avatar", user?.id],
    queryFn: () => getMyProfile(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const matches = (paths: string[]) =>
    paths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // 5 hubs: Home · Train · (+) · Progress · You
  const homeActive = matches(["/dashboard"]);
  const trainActive = matches([
    "/train",
    "/sta-trainer",
    "/warmup",
    "/planner",
    "/coach",
    "/calendar",
  ]);
  const logActive = matches(["/log"]);
  const progressActive = matches(["/history"]);
  const youActive = matches(["/you", "/profile", "/equipment", "/rules", "/settings"]);
  // The avatar tab lights up on your OWN public profile page or the hub.
  const meActive = youActive || pathname === `/athlete/${user.id}`;
  // Spearo mode: the catch feed + log both live at /spearo.
  const spearoActive = matches(["/spearo"]);

  const sideItems = [
    {
      to: "/dashboard",
      label: lang === "el" ? "Αρχική" : "Home",
      icon: LayoutDashboard,
      active: homeActive,
    },
    {
      to: "/train",
      label: lang === "el" ? "Προπόνηση" : "Train",
      icon: Waves,
      active: trainActive,
    },
  ] as const;

  const endItems = [
    {
      to: "/history",
      label: lang === "el" ? "Πρόοδος" : "Progress",
      icon: History,
      active: progressActive,
    },
  ] as const;

  // The profile tab, Instagram-style: just your round photo (no label), opening
  // YOUR public profile. Settings live behind the header gear.
  const MeTab = ({ active }: { active: boolean }) => (
    <Link
      to="/athlete/$id"
      params={{ id: user.id }}
      aria-label={lang === "el" ? "Το προφίλ μου" : "My profile"}
      style={NAV_ITEM_STYLE}
    >
      <span
        className="flex size-8 items-center justify-center overflow-hidden rounded-full text-muted-foreground"
        style={{
          boxShadow: active
            ? "0 0 0 2px var(--color-primary)"
            : "0 0 0 1.5px rgba(var(--ink),0.25)",
        }}
      >
        {myProfile?.avatar_url ? (
          <img src={myProfile.avatar_url} alt="" className="size-full object-cover" />
        ) : (
          <UserRound className="size-4" />
        )}
      </span>
    </Link>
  );

  const NavLink = ({
    to,
    label,
    icon: Icon,
    active,
  }: {
    to: string;
    label: string;
    icon: typeof History;
    active: boolean;
  }) => (
    <Link
      to={to}
      style={NAV_ITEM_STYLE}
      className={cn(
        "rounded-lg text-[0.65rem] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="flex h-5 w-5 items-center justify-center">
        <Icon className={cn("size-5", active && "drop-shadow-[0_0_8px_var(--color-primary)]")} />
      </span>
      {label}
    </Link>
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 pb-28 pt-6">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1">
          {/* mode toggle — tapping switches Apnos ↔ Spearo directly (no page) */}
          <button
            type="button"
            onClick={() => {
              nativeVibrate(10);
              setMode(mode === "spearo" ? "apnos" : "spearo");
            }}
            aria-label={lang === "el" ? "Αλλαγή mode" : "Switch mode"}
            className="pressable flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{
              background: "rgba(29,158,117,0.1)",
              border: "1px solid rgba(93,202,165,0.3)",
              color: "#5DCAA5",
            }}
          >
            {mode === "spearo" ? "🎣 Spearo" : "🌊 Apnos"}
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut()}
            aria-label={t("common.signOut")}
          >
            <LogOut className="size-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 pt-8">{children}</main>

      {/* floating chat bubble — direct line to the admin (Messenger-style).
          Hidden on the chat screen itself. */}
      {!pathname.startsWith("/messages") && (
        <Link
          to="/messages"
          aria-label={lang === "el" ? "Μηνύματα" : "Messages"}
          onClick={hapticTick}
          className="pressable glow-brand fixed bottom-24 right-4 z-40 flex size-12 items-center justify-center rounded-full"
          style={{ background: "#1D9E75" }}
        >
          <MessageCircle className="size-6 text-white" />
        </Link>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2">
          {/* Mode switches ONLY the tab set inside this shared <nav> shell.
              DEFENSIVE: only an exact "spearo" renders the Spearo tabs; any other
              value — undefined, unresolved, a future/unknown mode — falls through
              to the existing Apnos nav, so a bug degrades to today's behaviour,
              never a blank shell. The Apnos branch below is byte-for-byte the
              original nav, only relocated inside this conditional. */}
          {mode === "spearo" ? (
            <>
              {/* Spearo: Αρχική (feed) · (+) Log · Εσύ — same structure, 3 tabs.
                  "Εσύ" points to the SAME /you route the Apnos nav uses. */}
              <NavLink
                to="/spearo"
                label={t("nav.spearoHome")}
                icon={Home}
                active={spearoActive && !spearoLogOpen}
              />

              {/* central log button — identical treatment to the Apnos "+".
                  Opens the catch-log view (/spearo?log=true); the bare /spearo
                  home is the community feed. */}
              <Link
                to="/spearo"
                search={{ log: true }}
                aria-label={t("nav.spearoLog")}
                className="flex flex-1 items-center justify-center"
                style={{ height: 56 }}
                onClick={hapticTick}
              >
                <span
                  className="pressable glow-brand flex h-12 w-12 items-center justify-center rounded-full"
                  style={
                    {
                      background: "#1D9E75",
                      "--glow-ring":
                        spearoActive && spearoLogOpen
                          ? "0 0 0 4px rgba(29,158,117,0.25)"
                          : undefined,
                    } as React.CSSProperties
                  }
                >
                  <Plus className="size-6 text-white" />
                </span>
              </Link>

              <MeTab active={meActive} />
            </>
          ) : (
            <>
              {sideItems.map((item) => (
                <NavLink key={item.to} {...item} />
              ))}

              {/* central record / log button */}
              <Link
                to="/log"
                aria-label={lang === "el" ? "Καταγραφή" : "Log"}
                className="flex flex-1 items-center justify-center"
                style={{ height: 56 }}
                onClick={hapticTick}
              >
                <span
                  className="pressable glow-brand flex h-12 w-12 items-center justify-center rounded-full"
                  style={
                    {
                      background: "#1D9E75",
                      "--glow-ring": logActive ? "0 0 0 4px rgba(29,158,117,0.25)" : undefined,
                    } as React.CSSProperties
                  }
                >
                  <Plus className="size-6 text-white" />
                </span>
              </Link>

              {endItems.map((item) => (
                <NavLink key={item.to} {...item} />
              ))}
              <MeTab active={meActive} />
            </>
          )}
        </div>
      </nav>
    </div>
  );
}
