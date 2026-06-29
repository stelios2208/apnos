import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, Bell, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planner")({
  head: () => ({ meta: [{ title: "Dive Planner — Apnos" }] }),
  component: () => (
    <AppLayout>
      <Planner />
    </AppLayout>
  ),
});

const STORAGE = "apnos.planner";
const COUNTDOWN_MIN = 3;

interface Milestone {
  key: string;
  label: string;
  at: Date;
}

function beep() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    o.start();
    let i = 0;
    const pulse = () => {
      i++;
      g.gain.exponentialRampToValueAtTime(i % 2 ? 0.0001 : 0.3, ctx.currentTime + 0.15);
      if (i < 6) setTimeout(pulse, 160);
      else {
        o.stop(ctx.currentTime + 0.2);
        setTimeout(() => ctx.close(), 400);
      }
    };
    setTimeout(pulse, 160);
  } catch {
    /* audio not available */
  }
}

function todayAt(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function Planner() {
  const { t } = useI18n();
  const [topTime, setTopTime] = useState("12:00");
  const [warmup, setWarmup] = useState(45);
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.topTime) setTopTime(p.topTime);
        if (typeof p.warmup === "number") setWarmup(p.warmup);
        if (typeof p.sound === "boolean") setSound(p.sound);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify({ topTime, warmup, sound }));
  }, [topTime, warmup, sound]);

  const milestones = useMemo<Milestone[]>(() => {
    const tt = todayAt(topTime);
    return [
      { key: "warmup", label: t("plan.warmupStart"), at: new Date(tt.getTime() - warmup * 60000) },
      { key: "countdown", label: t("plan.countdown"), at: new Date(tt.getTime() - COUNTDOWN_MIN * 60000) },
      { key: "top", label: t("plan.officialTop"), at: tt },
    ];
  }, [topTime, warmup, t]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const current = new Date();
      setNow(current);
      for (const m of milestones) {
        if (!fired.current.has(m.key) && current.getTime() >= m.at.getTime() && current.getTime() - m.at.getTime() < 2000) {
          fired.current.add(m.key);
          if (sound) beep();
          toast(t("plan.alarm", { label: m.label }), { icon: "🔔", duration: 8000 });
        }
      }
      if (milestones.every((m) => fired.current.has(m.key))) setRunning(false);
    }, 1000);
    return () => clearInterval(id);
  }, [running, milestones, sound, t]);

  const start = () => {
    fired.current = new Set();
    const current = new Date();
    // Mark already-passed milestones so they don't fire retroactively.
    for (const m of milestones) if (current.getTime() >= m.at.getTime()) fired.current.add(m.key);
    setRunning(true);
  };

  const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("plan.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("plan.sub")}</p>
      </div>

      <div className="glass-card space-y-4 rounded-2xl p-5">
        <div className="grid grid-cols-2 items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="tt">{t("plan.topTime")}</Label>
            <Input id="tt" type="time" value={topTime} onChange={(e) => setTopTime(e.target.value)} disabled={running} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wu">{t("plan.warmupOffset")}</Label>
            <Input
              id="wu"
              type="number"
              min="0"
              max="180"
              value={warmup}
              onChange={(e) => setWarmup(Math.max(0, Number(e.target.value)))}
              disabled={running}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {running ? (
            <Button variant="outline" className="flex-1 gap-1.5" onClick={() => setRunning(false)}>
              <Square className="size-4" /> {t("plan.stop")}
            </Button>
          ) : (
            <Button variant="hero" className="flex-1 gap-1.5" onClick={start}>
              <Play className="size-4" /> {t("plan.start")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSound((s) => !s)}
            aria-label={t("plan.soundOn")}
            className={cn(sound ? "text-primary" : "text-muted-foreground")}
          >
            {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </Button>
        </div>

        {running && (
          <p className="flex items-center gap-1.5 text-xs text-primary">
            <Bell className="size-3.5" /> {t("plan.running")}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("plan.milestones")}</h2>
        {milestones.map((m) => {
          const diff = m.at.getTime() - now.getTime();
          const passed = diff <= 0;
          const isFired = fired.current.has(m.key);
          return (
            <div
              key={m.key}
              className={cn(
                "glass-card flex items-center justify-between rounded-2xl p-4",
                running && !passed && diff < 60000 && "ring-1 ring-primary/50",
              )}
            >
              <div>
                <p className="font-semibold">{m.label}</p>
                <p className="text-xs text-muted-foreground">{fmtTime(m.at)}</p>
              </div>
              <div className="text-right">
                <p className={cn("text-lg font-bold tabular-nums", passed ? "text-muted-foreground" : "text-primary")}>
                  {passed ? (isFired && running ? "🔔" : t("plan.passed")) : t("plan.until", { t: fmtCountdown(diff) })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
