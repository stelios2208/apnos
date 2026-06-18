import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { TimeInput } from "@/components/TimeInput";
import { createDive, fetchDives, unitLabel, updateDive, type NewDiveInput } from "@/lib/dives";
import {
  DISCIPLINES,
  DISCIPLINE_MAP,
  FEDERATIONS,
  disciplineName,
  isTimeDiscipline,
  type DisciplineCode,
  type Federation,
} from "@/lib/diving";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const searchSchema = z.object({
  edit: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/log")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "New Dive — Apnos" }] }),
  component: () => (
    <AppLayout>
      <LogDive />
    </AppLayout>
  ),
});

const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

function LogDive() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { edit: editId } = Route.useSearch();

  const { data: dives = [] } = useQuery({
    queryKey: ["dives", user?.id],
    queryFn: () => fetchDives(user!.id),
    enabled: !!user,
  });
  const editing = editId ? dives.find((d) => d.id === editId) : undefined;

  const [discipline, setDiscipline] = useState<DisciplineCode>("STA");
  const [result, setResult] = useState(0);
  const [diveDate, setDiveDate] = useState(today());
  const [diveTime, setDiveTime] = useState(nowTime());
  const [sessionType, setSessionType] = useState<"training" | "competition">("training");
  const [federation, setFederation] = useState<Federation>("AIDA");
  const [sleepHours, setSleepHours] = useState("");
  const [foodNotes, setFoodNotes] = useState("");
  const [mentalState, setMentalState] = useState(3);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!editing) return;
    setDiscipline(editing.discipline);
    setResult(editing.result);
    setDiveDate(editing.dive_date);
    setDiveTime(editing.dive_time ?? nowTime());
    setSessionType(editing.session_type);
    setFederation(editing.federation ?? "AIDA");
    setSleepHours(editing.sleep_hours != null ? String(editing.sleep_hours) : "");
    setFoodNotes(editing.food_notes ?? "");
    setMentalState(editing.mental_state ?? 3);
    setNotes(editing.notes ?? "");
  }, [editing]);

  const mutation = useMutation({
    mutationFn: (input: NewDiveInput) =>
      editId ? updateDive(user!.id, editId, input) : createDive(user!.id, input),
    onSuccess: (dive) => {
      queryClient.invalidateQueries({ queryKey: ["dives", user?.id] });
      if (editId) {
        toast.success(t("log.updated"));
      } else if (dive.is_personal_best) {
        toast.success(t("log.newPB"), { description: disciplineName(dive.discipline, lang) });
      } else {
        toast.success(t("log.logged"));
      }
      navigate({ to: "/history" });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t("log.couldNotSave")),
  });

  const isTime = isTimeDiscipline(discipline);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!result || result <= 0) {
      toast.error(t("log.enterValid"));
      return;
    }
    mutation.mutate({
      discipline,
      result,
      dive_date: diveDate,
      dive_time: diveTime || null,
      session_type: sessionType,
      federation: sessionType === "competition" ? federation : null,
      sleep_hours: sleepHours ? Number(sleepHours) : null,
      food_notes: foodNotes || null,
      mental_state: mentalState,
      notes: notes || null,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{editId ? t("log.titleEdit") : t("log.titleNew")}</h1>
        <p className="text-sm text-muted-foreground">{editId ? t("log.subEdit") : t("log.subNew")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="glass-card space-y-4 rounded-2xl p-5">
          <div className="space-y-1.5">
            <Label>{t("log.discipline")}</Label>
            <Select value={discipline} onValueChange={(v) => setDiscipline(v as DisciplineCode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISCIPLINES.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.code} — {disciplineName(d.code, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="result">{isTime ? t("log.resultTime") : t("log.resultDistance")}</Label>
            {isTime ? (
              <TimeInput value={result} onChange={setResult} />
            ) : (
              <Input
                id="result"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={result || ""}
                onChange={(e) => setResult(Number(e.target.value))}
                placeholder="e.g. 75"
                required
              />
            )}
            {!isTime && (
              <p className="text-[0.7rem] text-muted-foreground">{t("common.meters")} — {unitLabel(discipline)}.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">{t("log.date")}</Label>
              <Input id="date" type="date" value={diveDate} onChange={(e) => setDiveDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time">{t("log.time")}</Label>
              <Input id="time" type="time" value={diveTime} onChange={(e) => setDiveTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("log.sessionType")}</Label>
            <Select value={sessionType} onValueChange={(v) => setSessionType(v as "training" | "competition")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="training">{t("common.training")}</SelectItem>
                <SelectItem value="competition">{t("common.competition")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sessionType === "competition" && (
            <div className="space-y-1.5 animate-fade-in">
              <Label>{t("log.federation")}</Label>
              <Select value={federation} onValueChange={(v) => setFederation(v as Federation)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEDERATIONS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="glass-card space-y-4 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">{t("log.condition")}</h2>

          <div className="space-y-1.5">
            <Label htmlFor="sleep">{t("log.sleep")}</Label>
            <Input
              id="sleep"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              max="24"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              placeholder="e.g. 7.5"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="food">{t("log.food")}</Label>
            <Textarea
              id="food"
              value={foodNotes}
              onChange={(e) => setFoodNotes(e.target.value)}
              placeholder={t("log.foodPlaceholder")}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("log.mental")}</Label>
              <span className="text-sm font-semibold text-primary">
                {mentalState} · {t(`mental.${mentalState}`)}
              </span>
            </div>
            <Slider min={1} max={5} step={1} value={[mentalState]} onValueChange={(v) => setMentalState(v[0])} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("log.notes")}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("log.notesPlaceholder")}
              rows={3}
            />
          </div>
        </div>

        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? t("common.saving") : editId ? t("log.update") : t("log.save")}
        </Button>
      </form>
    </div>
  );
}
