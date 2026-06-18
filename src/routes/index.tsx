import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Waves, Timer, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo, RopeMark } from "@/components/Logo";
import { Bubbles } from "@/components/Bubbles";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Underwater scene */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% -20%, oklch(0.3 0.09 280 / 0.45), transparent 70%)," +
            "radial-gradient(ellipse 80% 60% at 70% 120%, oklch(0.45 0.11 190 / 0.3), transparent 70%)",
        }}
      />
      <Bubbles />

      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-8">
        <header>
          <Logo />
        </header>

        <main className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-7 flex size-24 items-center justify-center rounded-3xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <RopeMark className="h-12 w-auto" />
          </div>
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
            {t("landing.headline1")} <span className="text-gradient">{t("landing.headline2")}</span>.
          </h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground">{t("landing.sub")}</p>

          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
            <Button asChild variant="hero" size="lg">
              <Link to="/auth">{t("landing.cta")}</Link>
            </Button>
          </div>

          <div className="mt-14 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
            <Feature icon={Timer} title={t("landing.f1.title")} text={t("landing.f1.text")} />
            <Feature icon={TrendingUp} title={t("landing.f2.title")} text={t("landing.f2.text")} />
            <Feature icon={Waves} title={t("landing.f3.title")} text={t("landing.f3.text")} />
          </div>
        </main>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: typeof Waves; title: string; text: string }) {
  return (
    <div className="glass-card rounded-2xl p-5 text-left">
      <Icon className="size-6 text-primary" />
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
