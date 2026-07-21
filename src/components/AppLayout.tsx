import React, { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Plus, History, LogOut, Waves, UserRound, Home } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { useMode, useModeAutoDefault } from "@/hooks/use-mode";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  // App mode drives ONLY which bottom-nav tab set renders (below). `mode` is
  // always a concrete value; the smart default resolves once for new users.
  const { mode } = useMode();
  useModeAutoDefault();

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
    { to: "/you", label: lang === "el" ? "Εσύ" : "You", icon: UserRound, active: youActive },
  ] as const;

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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut()}
          aria-label={t("common.signOut")}
        >
          <LogOut className="size-5" />
        </Button>
      </header>

      <main className="flex-1 pt-8">{children}</main>

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
              <NavLink to="/spearo" label={t("nav.spearoHome")} icon={Home} active={spearoActive} />

              {/* central log button — identical treatment to the Apnos "+" */}
              <Link
                to="/spearo"
                aria-label={t("nav.spearoLog")}
                className="flex flex-1 items-center justify-center"
                style={{ height: 56 }}
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full transition-transform active:scale-95"
                  style={{
                    background: "#1D9E75",
                    boxShadow: spearoActive
                      ? "0 0 0 4px rgba(29,158,117,0.25), 0 4px 16px rgba(29,158,117,0.5)"
                      : "0 4px 16px rgba(29,158,117,0.45)",
                  }}
                >
                  <Plus className="size-6 text-white" />
                </span>
              </Link>

              <NavLink to="/you" label={t("nav.spearoYou")} icon={UserRound} active={youActive} />
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
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full transition-transform active:scale-95"
                  style={{
                    background: "#1D9E75",
                    boxShadow: logActive
                      ? "0 0 0 4px rgba(29,158,117,0.25), 0 4px 16px rgba(29,158,117,0.5)"
                      : "0 4px 16px rgba(29,158,117,0.45)",
                  }}
                >
                  <Plus className="size-6 text-white" />
                </span>
              </Link>

              {endItems.map((item) => (
                <NavLink key={item.to} {...item} />
              ))}
            </>
          )}
        </div>
      </nav>
    </div>
  );
}
