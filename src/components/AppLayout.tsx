import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Plus, History, LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/log", label: "New Dive", icon: Plus },
  { to: "/history", label: "History", icon: History },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 pb-28 pt-6">
      <header className="flex items-center justify-between">
        <Logo />
        <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label="Sign out">
          <LogOut className="size-5" />
        </Button>
      </header>

      <main className="flex-1 pt-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-4 py-2">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "drop-shadow-[0_0_8px_var(--color-primary)]")} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
