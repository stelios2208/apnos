import React, { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Plus, History, LogOut, Timer, MoreHorizontal, Backpack, BookOpen, Settings, Waves, CalendarDays } from "lucide-react";

const NAV_ITEM_STYLE: React.CSSProperties = {
  height: 56,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  flex: 1,
  gap: 4,
};
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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

  const nav = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: "/calendar",  label: t("nav.calendar"),  icon: CalendarDays },
    { to: "/log",       label: t("nav.log"),        icon: Plus },
    { to: "/history",   label: t("nav.history"),    icon: History },
  ] as const;

  const moreItems = [
    { to: "/planner",     label: t("nav.planner"),   icon: Timer },
    { to: "/sta-trainer", label: t("nav.trainer"),   icon: Waves },
    { to: "/equipment",   label: t("nav.equipment"), icon: Backpack },
    { to: "/rules",       label: t("nav.rules"),     icon: BookOpen },
    { to: "/settings",    label: t("nav.settings"),  icon: Settings },
  ] as const;

  const moreActive = moreItems.some((m) => pathname === m.to);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 pb-28 pt-6">
      <header className="flex items-center justify-between">
        <Logo />
        <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label={t("common.signOut")}>
          <LogOut className="size-5" />
        </Button>
      </header>

      <main className="flex-1 pt-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-2xl justify-around px-2">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
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
          })}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                style={NAV_ITEM_STYLE}
                className={cn(
                  "rounded-lg text-[0.65rem] font-medium transition-colors",
                  moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center">
                  <MoreHorizontal className="size-5" />
                </span>
                {t("nav.more")}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="mb-2">
              {moreItems.map(({ to, label, icon: Icon }) => (
                <DropdownMenuItem key={to} asChild>
                  <Link to={to} className="cursor-pointer gap-2">
                    <Icon className="size-4" /> {label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </div>
  );
}
