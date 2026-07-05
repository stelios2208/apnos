import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Globe, User, Download, Moon, Sun, Waves } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme, type Theme } from "@/hooks/use-theme";
import { loadFxSettings, saveFxSettings } from "@/lib/trainer-fx";
import { divesToCsv, downloadCsv, fetchDives } from "@/lib/dives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Apnos" }] }),
  component: () => (
    <AppLayout>
      <Settings />
    </AppLayout>
  ),
});

function Settings() {
  const { user } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [scene, setScene] = useState(() => loadFxSettings().scene);

  const toggleScene = () => {
    const fx = loadFxSettings();
    const next = !fx.scene;
    saveFxSettings({ ...fx, scene: next });
    setScene(next);
  };
  const { data: dives = [] } = useQuery({
    queryKey: ["dives", user?.id],
    queryFn: () => fetchDives(user!.id),
    enabled: !!user,
  });

  const langs: { code: Lang; label: string }[] = [
    { code: "el", label: t("set.greek") },
    { code: "en", label: t("set.english") },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("set.title")}</h1>

      <section className="glass-card space-y-3 rounded-2xl p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Globe className="size-4 text-primary" /> {t("set.language")}
        </div>
        <p className="text-xs text-muted-foreground">{t("set.languageDesc")}</p>
        <div className="grid grid-cols-2 gap-3 pt-1">
          {langs.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={cn(
                "flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                lang === l.code
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label}
              {lang === l.code && <Check className="size-4 text-primary" />}
            </button>
          ))}
        </div>
      </section>

      <section className="glass-card space-y-3 rounded-2xl p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sun className="size-4 text-primary" /> {t("set.appearance")}
        </div>
        <p className="text-xs text-muted-foreground">{t("set.appearanceDesc")}</p>
        <div className="grid grid-cols-2 gap-3 pt-1">
          {(
            [
              { code: "dark", label: t("set.dark"), icon: Moon },
              { code: "light", label: t("set.light"), icon: Sun },
            ] as { code: Theme; label: string; icon: typeof Sun }[]
          ).map(({ code, label, icon: Icon }) => (
            <button
              key={code}
              onClick={() => setTheme(code)}
              className={cn(
                "flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                theme === code
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-2">
                <Icon className="size-4" /> {label}
              </span>
              {theme === code && <Check className="size-4 text-primary" />}
            </button>
          ))}
        </div>
        <button
          onClick={toggleScene}
          className={cn(
            "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
            scene
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="flex items-center gap-2">
            <Waves className="size-4" /> {t("set.scene")}
          </span>
          {scene && <Check className="size-4 text-primary" />}
        </button>
        <p className="text-xs text-muted-foreground">{t("set.sceneDesc")}</p>
      </section>

      <section className="glass-card space-y-3 rounded-2xl p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <User className="size-4 text-primary" /> {t("set.account")}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("set.signedInAs")} <span className="text-foreground">{user?.email}</span>
        </p>
      </section>

      <section className="glass-card space-y-3 rounded-2xl p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Download className="size-4 text-primary" /> {t("set.data")}
        </div>
        <p className="text-xs text-muted-foreground">{t("set.exportDesc")}</p>
        <Button
          variant="outline"
          className="gap-1.5"
          disabled={dives.length === 0}
          onClick={() =>
            downloadCsv(
              `apnos-dives-${new Date().toISOString().slice(0, 10)}.csv`,
              divesToCsv(dives),
            )
          }
        >
          <Download className="size-4" /> {t("common.export")}
        </Button>
      </section>
    </div>
  );
}
