import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Waves, Timer, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Apnos — Freediving Training Log" },
      {
        name: "description",
        content:
          "Log every freediving session, track personal bests across STA, DYN, CWT and more. Breathe · dive · repeat.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-8">
      <header>
        <Logo />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-6 flex size-20 items-center justify-center rounded-3xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
          <Waves className="size-10 text-primary-foreground" />
        </div>
        <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
          Your freedive, <span className="text-gradient">measured</span>.
        </h1>
        <p className="mt-4 max-w-md text-base text-muted-foreground">
          Track dives, recovery and personal bests across every discipline — from static apnea to
          constant weight. Quiet, focused, made for the deep.
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <Button asChild variant="hero" size="lg">
            <Link to="/auth">Start logging</Link>
          </Button>
        </div>

        <div className="mt-14 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          <Feature icon={Timer} title="Every discipline" text="STA, DYN, DNF, CWT, CNF, FIM & more." />
          <Feature icon={TrendingUp} title="Personal bests" text="Auto-detected the moment you beat one." />
          <Feature icon={Waves} title="Recovery aware" text="Log sleep, food & mental state." />
        </div>
      </main>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Waves;
  title: string;
  text: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 text-left">
      <Icon className="size-6 text-primary" />
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
