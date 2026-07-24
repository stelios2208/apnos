import React, { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  X,
  LogOut,
  Waves,
  UserRound,
  Menu,
  Search,
  ClipboardList,
  Target,
  Fish,
  MessageCircle,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ModeSwitch } from "@/components/ModeSwitch";
import { SearchSheet } from "@/components/SearchSheet";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { useMode, useModeAutoDefault } from "@/hooks/use-mode";
import { getMyProfile } from "@/lib/profiles";
import { nativeVibrate } from "@/lib/native";
import { Button } from "@/components/ui/button";

// Short haptic tick for primary taps — nativeVibrate carries all the SSR /
// no-native guards, so this is safe to call from any click handler.
const hapticTick = () => nativeVibrate(10);

// One "add" action in the central "+" sheet.
interface AddItem {
  to: "/log" | "/planner" | "/coach" | "/spearo";
  search?: { log: true };
  icon: typeof Waves;
  label: string;
  sub: string;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { t, lang } = useI18n();
  const el = lang === "el";
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // App mode drives ONLY the central "+" action set (below). `mode` is always a
  // concrete value; the smart default resolves once for new users.
  const { mode } = useMode();
  useModeAutoDefault();

  // The "+" action sheet and the search overlay — both are light client-side
  // overlays, so they carry no route and reset on navigation via their onClick.
  const [addOpen, setAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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

  // Bottom nav (4 zones): Μενού · (+) · Αναζήτηση · Εσύ(avatar).
  const menuActive = matches(["/you"]);
  // The avatar tab lights up on your OWN public profile page.
  const meActive = pathname === `/athlete/${user.id}`;

  // Central "+" opens a small action sheet instead of jumping to one screen.
  // Contents are mode-aware; Spearo logs a catch, Apnos logs a dive.
  const addItems: AddItem[] =
    mode === "spearo"
      ? [
          {
            to: "/spearo",
            search: { log: true },
            icon: Fish,
            label: el ? "Ψαριά" : "Catch",
            sub: el ? "Καταγραφή ψαριάς" : "Log a catch",
          },
          {
            to: "/planner",
            icon: ClipboardList,
            label: el ? "Πλάνο" : "Plan",
            sub: el ? "Σετ & στόχοι" : "Sets & goals",
          },
        ]
      : [
          {
            to: "/log",
            icon: Waves,
            label: el ? "Βουτιά" : "Dive",
            sub: el ? "Καταγραφή κατάδυσης" : "Log a dive",
          },
          {
            to: "/planner",
            icon: ClipboardList,
            label: el ? "Πλάνο" : "Plan",
            sub: el ? "Σετ & στόχοι" : "Sets & goals",
          },
          {
            to: "/coach",
            icon: Target,
            label: el ? "Πρόγραμμα Coach" : "Coach program",
            sub: el ? "Ανάθεση σε αθλητή" : "Assign to an athlete",
          },
        ];

  // The profile tab, Instagram-style: just your round photo (no label), opening
  // YOUR public profile. Settings live inside the Menu grid.
  const MeTab = ({ active }: { active: boolean }) => (
    <Link
      to="/athlete/$id"
      params={{ id: user.id }}
      aria-label={el ? "Το προφίλ μου" : "My profile"}
      className="flex flex-col items-center gap-1"
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
      <span
        className="text-[0.58rem] font-medium"
        style={{ color: active ? "var(--color-primary)" : "rgba(var(--ink),0.4)" }}
      >
        {el ? "Εσύ" : "You"}
      </span>
    </Link>
  );

  const NavIcon = ({
    to,
    label,
    icon: Icon,
    active,
    onClick,
  }: {
    to: string;
    label: string;
    icon: typeof Menu;
    active: boolean;
    onClick?: () => void;
  }) => (
    <Link
      to={to}
      onClick={onClick}
      className="flex flex-col items-center gap-1 text-[0.58rem] font-medium transition-colors"
      style={{ color: active ? "var(--color-primary)" : "rgba(var(--ink),0.4)" }}
    >
      <Icon
        className="size-6"
        style={active ? { filter: "drop-shadow(0 0 8px var(--color-primary))" } : undefined}
      />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 pb-28 pt-6">
      <header className="flex items-center justify-between gap-2">
        <Logo className="min-w-0 shrink" />
        <div className="flex shrink-0 items-center gap-1.5">
          {/* mode switch — sliding pill, tapping a side switches Apnos ↔ Spearo */}
          <ModeSwitch />
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
          Hidden on the chat screen itself and while an overlay is open. */}
      {!pathname.startsWith("/messages") && !addOpen && !searchOpen && (
        <Link
          to="/messages"
          aria-label={el ? "Μηνύματα" : "Messages"}
          onClick={hapticTick}
          className="pressable glow-brand fixed bottom-28 right-4 z-30 flex size-12 items-center justify-center rounded-full"
          style={{ background: "#1D9E75" }}
        >
          <MessageCircle className="size-6 text-white" />
        </Link>
      )}

      {/* ── central "+" action sheet (Piraeus-style stack) ── */}
      {addOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setAddOpen(false)}
          role="presentation"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 60% at 50% 100%, rgba(2,10,20,0.55), rgba(2,10,20,0.86))",
              backdropFilter: "blur(2px)",
            }}
          />
          <div
            className="absolute inset-x-0 bottom-28 z-10 flex flex-col items-center gap-3 px-6"
            onClick={(e) => e.stopPropagation()}
          >
            {addItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                search={item.search as never}
                onClick={() => {
                  hapticTick();
                  setAddOpen(false);
                }}
                className="pressable flex w-full max-w-xs items-center gap-3 rounded-full py-3 pl-3 pr-5"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(29,158,117,0.18), rgba(255,255,255,0.05))",
                  border: "1px solid rgba(93,202,165,0.28)",
                  boxShadow: "0 10px 24px -12px rgba(0,0,0,0.7)",
                }}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{
                    background: "linear-gradient(180deg, #5DCAA5, #1D9E75)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
                  }}
                >
                  <item.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-foreground">{item.label}</span>
                  <span className="block text-[0.6rem] text-foreground/45">{item.sub}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── search overlay ── */}
      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* ── bottom nav: Μενού · (+) · Αναζήτηση · Εσύ ── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/80 backdrop-blur-lg">
        <div
          className="relative mx-auto flex max-w-2xl items-center justify-between px-8"
          style={{ height: 68 }}
        >
          <NavIcon
            to="/you"
            label={el ? "Μενού" : "Menu"}
            icon={Menu}
            active={menuActive}
            onClick={hapticTick}
          />

          <div className="flex items-center gap-7">
            <button
              type="button"
              onClick={() => {
                hapticTick();
                setSearchOpen(true);
              }}
              aria-label={el ? "Αναζήτηση" : "Search"}
              className="flex flex-col items-center gap-1 text-[0.58rem] font-medium"
              style={{ color: searchOpen ? "var(--color-primary)" : "rgba(var(--ink),0.4)" }}
            >
              <Search className="size-6" />
              <span className="whitespace-nowrap">{el ? "Αναζήτηση" : "Search"}</span>
            </button>
            <MeTab active={meActive} />
          </div>

          {/* central "+" — raised, toggles the action sheet (becomes ✕ open) */}
          <button
            type="button"
            onClick={() => {
              hapticTick();
              setAddOpen((o) => !o);
            }}
            aria-label={el ? "Προσθήκη" : "Add"}
            aria-expanded={addOpen}
            className="pressable glow-brand absolute left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full"
            style={{
              bottom: 16,
              background: addOpen
                ? "linear-gradient(180deg, #48566380, #2b3742)"
                : "#1D9E75",
            }}
          >
            {addOpen ? (
              <X className="size-6 text-white" />
            ) : (
              <Plus className="size-6 text-white" />
            )}
          </button>
        </div>
      </nav>
    </div>
  );
}
