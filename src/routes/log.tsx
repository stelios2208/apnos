import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { createDive, unitLabel, type NewDiveInput } from "@/lib/dives";
import { DISCIPLINES, DISCIPLINE_MAP, type DisciplineCode } from "@/lib/diving";
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

export const Route = createFileRoute("/log")({
  head: () => ({ meta: [{ title: "New Dive — Apnos" }] }),
  component: () => (
    <AppLayout>
      <LogDive />
    </AppLayout>
  ),
});

const MENTAL_LABELS = ["Drained", "Low", "Okay", "Good", "Peak"];
const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

function LogDive() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [discipline, setDiscipline] = useState<DisciplineCode>("STA");
  const [result, setResult] = useState("");
  const [diveDate, setDiveDate] = useState(today());
  const [diveTime, setDiveTime] = useState(nowTime());
  const [sessionType, setSessionType] = useState<"training" | "competition">("training");
  const [sleepHours, setSleepHours] = useState("");
  const [foodNotes, setFoodNotes] = useState("");
  const [mentalState, setMentalState] = useState(3);
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (input: NewDiveInput) => createDive(user!.id, input),
    onSuccess: (dive) => {
      queryClient.invalidateQueries({ queryKey: ["dives", user?.id] });
      if (dive.is_personal_best) {
        toast.success("🏆 New personal best!", {
          description: `${DISCIPLINE_MAP[dive.discipline].name}`,
        });
      } else {
        toast.success("Dive logged");
      }
      navigate({ to: "/history" });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save dive"),
  });

  const isTime = DISCIPLINE_MAP[discipline].unit === "time";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(result);
    if (!parsed || parsed <= 0) {
      toast.error("Enter a valid result");
      return;
    }
    mutation.mutate({
      discipline,
      result: parsed,
      dive_date: diveDate,
      dive_time: diveTime || null,
      session_type: sessionType,
      sleep_hours: sleepHours ? Number(sleepHours) : null,
      food_notes: foodNotes || null,
      mental_state: mentalState,
      notes: notes || null,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New dive</h1>
        <p className="text-sm text-muted-foreground">Log a session and beat your best.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="glass-card space-y-4 rounded-2xl p-5">
          <div className="space-y-1.5">
            <Label>Discipline</Label>
            <Select value={discipline} onValueChange={(v) => setDiscipline(v as DisciplineCode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISCIPLINES.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.code} — {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="result">
              Result ({isTime ? "seconds" : "meters"})
            </Label>
            <Input
              id="result"
              type="number"
              inputMode="decimal"
              step={isTime ? "1" : "0.1"}
              min="0"
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder={isTime ? "e.g. 245" : "e.g. 75"}
              required
            />
            <p className="text-[0.7rem] text-muted-foreground">
              Enter your {unitLabel(discipline)}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={diveDate} onChange={(e) => setDiveDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time">Time</Label>
              <Input id="time" type="time" value={diveTime} onChange={(e) => setDiveTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Session type</Label>
            <Select value={sessionType} onValueChange={(v) => setSessionType(v as "training" | "competition")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="competition">Competition</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="glass-card space-y-4 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">Condition & recovery</h2>

          <div className="space-y-1.5">
            <Label htmlFor="sleep">Sleep (hours)</Label>
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
            <Label htmlFor="food">Food notes</Label>
            <Textarea
              id="food"
              value={foodNotes}
              onChange={(e) => setFoodNotes(e.target.value)}
              placeholder="What & when you last ate…"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Mental state</Label>
              <span className="text-sm font-semibold text-primary">
                {mentalState} · {MENTAL_LABELS[mentalState - 1]}
              </span>
            </div>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[mentalState]}
              onValueChange={(v) => setMentalState(v[0])}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">General notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Technique, contractions, conditions…"
              rows={3}
            />
          </div>
        </div>

        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save dive"}
        </Button>
      </form>
    </div>
  );
}
