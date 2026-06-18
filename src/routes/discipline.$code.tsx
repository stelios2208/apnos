import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trophy } from "lucide-react";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { fetchDives } from "@/lib/dives";
import { DISCIPLINE_MAP, disciplineName, formatResult, type Dive, type DisciplineCode } from "@/lib/diving";
import { useI18n } from "@/lib/i18n";
import { PBChart } from "@/components/PBChart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/discipline/$code")({
  head: () => ({ meta: [{ title: "Discipline — Apnos" }] }),
  component: () => (
    <AppLayout>
      <DisciplineDetail />
    </AppLayout>
  ),
});

function DiveRow({ dive, lang }: { dive: Dive; lang: "el" | "en" }) {
  return (
    <li className="glass-card flex items-center justify-between rounded-xl px-4 py-3">
      <div>
        <p className="text-lg font-bold tabular-nums">{formatResult(dive.discipline, dive.result)}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(`${dive.dive_date}T00:00`), "d MMM yyyy")}
          {dive.federation ? ` · ${dive.federation}` : ""}
        </p>
      </div>
      {dive.is_personal_best && <Trophy className="size-4 text-primary" />}
    </li>
  );
}

function DisciplineDetail() {
  const { code } = Route.useParams();
  const discipline = code as DisciplineCode;
  const { user } = useAuth();
  const { t, lang } = useI18n();

  const { data: all = [] } = useQuery({
    queryKey: ["dives", user?.id],
    queryFn: () => fetchDives(user!.id),
    enabled: !!user,
  });

  const dives = all.filter((d) => d.discipline === discipline);
  const training = dives.filter((d) => d.session_type === "training");
  const competition = dives.filter((d) => d.session_type === "competition");
  const aida = competition.filter((d) => d.federation === "AIDA");
  const cmas = competition.filter((d) => d.federation === "CMAS");
  const otherComp = competition.filter((d) => d.federation !== "AIDA" && d.federation !== "CMAS");

  const valid = DISCIPLINE_MAP[discipline];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label={t("common.back")}>
          <Link to="/dashboard">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{valid ? discipline : "—"}</h1>
          <p className="text-sm text-muted-foreground">{valid ? disciplineName(discipline, lang) : ""}</p>
        </div>
      </div>

      {dives.length >= 2 ? (
        <section className="glass-card space-y-3 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">{t("disc.progress")}</h2>
          <PBChart dives={dives} discipline={discipline} />
        </section>
      ) : (
        <section className="glass-card rounded-2xl p-5">
          <p className="text-sm text-muted-foreground">{dives.length === 0 ? t("disc.noDives") : t("disc.noData")}</p>
        </section>
      )}

      {dives.length > 0 && (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">{t("disc.tabAll")}</TabsTrigger>
            <TabsTrigger value="training">{t("common.training")}</TabsTrigger>
            <TabsTrigger value="competition">{t("common.competition")}</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <ul className="space-y-2">
              {dives.map((d) => (
                <DiveRow key={d.id} dive={d} lang={lang} />
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="training" className="mt-4">
            <ul className="space-y-2">
              {training.map((d) => (
                <DiveRow key={d.id} dive={d} lang={lang} />
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="competition" className="mt-4 space-y-5">
            {aida.length > 0 && (
              <div className="space-y-2">
                <Badge variant="outline">AIDA</Badge>
                <ul className="space-y-2">
                  {aida.map((d) => (
                    <DiveRow key={d.id} dive={d} lang={lang} />
                  ))}
                </ul>
              </div>
            )}
            {cmas.length > 0 && (
              <div className="space-y-2">
                <Badge variant="outline">CMAS</Badge>
                <ul className="space-y-2">
                  {cmas.map((d) => (
                    <DiveRow key={d.id} dive={d} lang={lang} />
                  ))}
                </ul>
              </div>
            )}
            {otherComp.length > 0 && (
              <ul className="space-y-2">
                {otherComp.map((d) => (
                  <DiveRow key={d.id} dive={d} lang={lang} />
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
