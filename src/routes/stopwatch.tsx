import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, Pause, Flag, RotateCcw, Waves, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { vibrate, hapticsSupported, loadFxSettings } from "@/lib/trainer-fx";
import { UnderwaterScene } from "@/components/UnderwaterScene";

export const Route = createFileRoute("/stopwatch")({
  head: () => ({ meta: [{ title: "Χρονόμετρο — Apnos" }] }),
  component: Stopwatch,
});

// Pool lengths turn laps into distance → a loggable DYN-family dive.
const POOL_LENGTHS = [0, 25, 50] as const;
type PoolDiscipline = "DYN" | "DYNB" | "DNF";
const POOL_DISCIPLINES: PoolDiscipline[] = ["DYN", "DYNB", "DNF"];
const MAX_LAPS = 300; // SEIKO-style memory cap

function fmt(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Stopwatch() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [laps, setLaps] = useState<number[]>([]); // cumulative split times (ms)
  const [poolLen, setPoolLen] = useState<number>(25);
  const [customLen, setCustomLen] = useState("");
  const [discipline, setDiscipline] = useState<PoolDiscipline>("DYN");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const runningRef = useRef(false);
  const baseRef = useRef(0); // accumulated ms before the current run
  const startRef = useRef(0); // performance.now() at the current run's start

  const canHaptics = hapticsSupported();
  const buzz = (p: number | number[]) => {
    if (canHaptics) vibrate(p);
  };
  const [showScene] = useState(() => loadFxSettings().scene);

  // Live elapsed derived from refs + performance.now — only <LiveTimer> polls it,
  // so laps/stats/table don't re-render on every tick.
  const getElapsed = useCallback(
    () => baseRef.current + (runningRef.current ? performance.now() - startRef.current : 0),
    [],
  );

  const start = () => {
    if (runningRef.current) return;
    runningRef.current = true;
    startRef.current = performance.now();
    setRunning(true);
    setStarted(true);
    setSaved(false);
    buzz(40);
  };

  const pause = () => {
    if (!runningRef.current) return;
    baseRef.current = getElapsed();
    runningRef.current = false;
    setRunning(false);
    buzz(40);
  };

  const lap = () => {
    if (!runningRef.current) return;
    setLaps((prev) => (prev.length >= MAX_LAPS ? prev : [...prev, getElapsed()]));
    buzz(25);
  };

  const reset = () => {
    runningRef.current = false;
    baseRef.current = 0;
    setRunning(false);
    setStarted(false);
    setLaps([]);
    setSaved(false);
  };

  // ── derived ────────────────────────────────────────────────────────────────
  const lapTimes = laps.map((split, i) => split - (i === 0 ? 0 : laps[i - 1]!));
  const bestLap = lapTimes.length ? Math.min(...lapTimes) : 0;
  const worstLap = lapTimes.length ? Math.max(...lapTimes) : 0;
  const avgLap = lapTimes.length ? lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length : 0;
  const distance = poolLen > 0 ? laps.length * poolLen : 0;
  const canSave = poolLen > 0 && laps.length > 0 && !!user;

  // ── save as DYN-family dive ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    const notesLines = [
      `Pool session — ${laps.length} × ${poolLen}m = ${distance}m`,
      `Total ${fmt(getElapsed())} · best lap ${fmt(bestLap)} · avg ${fmt(avgLap)}`,
      `Laps: ${JSON.stringify(lapTimes.map((t) => fmt(t)))}`,
    ];
    const { error } = await supabase.from("dives").insert({
      user_id: user!.id,
      discipline,
      session_type: "training",
      dive_date: todayISO(),
      result: distance,
      notes: notesLines.join("\n"),
    });
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error(`${lang === "el" ? "Σφάλμα αποθήκευσης" : "Save failed"}: ${error.message}`);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["dives", user!.id] });
    setSaved(true);
    toast.success(
      lang === "el"
        ? `Καταγράφηκε ${distance}m ${discipline}`
        : `Logged ${distance}m ${discipline}`,
    );
  };

  const activeLen = poolLen;

  return (
    <div className="relative min-h-screen px-4 pb-24 pt-6" style={{ background: "#020a13" }}>
      {showScene && (
        <div className="fixed inset-0">
          <UnderwaterScene dim />
        </div>
      )}
      <div className="relative z-10">
        {/* header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/train" })}
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {lang === "el" ? "Χρονόμετρο" : "Stopwatch"}
            </h1>
            <p className="text-xs text-white/35">
              {lang === "el"
                ? "Lap chrono για πισίνα — γίνεται βουτιά"
                : "Lap chrono for the pool — becomes a dive"}
            </p>
          </div>
        </div>

        {/* big timer */}
        <div
          className="mt-6 flex flex-col items-center rounded-3xl py-8"
          style={{
            background: "linear-gradient(160deg, #10233a 0%, #0b1728 55%, #070a10 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <LiveTimer running={running} getElapsed={getElapsed} />
          {poolLen > 0 && (
            <span
              className="mt-3 flex items-center gap-1.5 text-sm font-bold"
              style={{ color: "#5DCAA5" }}
            >
              <Waves className="size-4" /> {distance}m · {laps.length}{" "}
              {lang === "el" ? "μήκη" : "lengths"}
            </span>
          )}
        </div>

        {/* controls */}
        <div className="mt-5 flex items-center justify-center gap-4">
          {!running ? (
            <button
              onClick={start}
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "#1D9E75", color: "#fff" }}
            >
              <Play className="size-7" />
            </button>
          ) : (
            <button
              onClick={pause}
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "#EF9F27", color: "#062018" }}
            >
              <Pause className="size-7" />
            </button>
          )}
          <button
            onClick={lap}
            disabled={!running}
            className="flex h-14 w-14 items-center justify-center rounded-full transition-all disabled:opacity-30"
            style={{
              background: "rgba(93,202,165,0.15)",
              color: "#5DCAA5",
              border: "1px solid rgba(93,202,165,0.35)",
            }}
          >
            <Flag className="size-6" />
          </button>
          <button
            onClick={reset}
            disabled={!started && laps.length === 0}
            className="flex h-14 w-14 items-center justify-center rounded-full transition-all disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)" }}
          >
            <RotateCcw className="size-5" />
          </button>
        </div>

        {/* pool length */}
        <div
          className="mt-6 rounded-2xl p-4"
          style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="mb-2.5 text-[0.65rem] font-bold tracking-wider text-white/40">
            {lang === "el" ? "ΜΗΚΟΣ ΠΙΣΙΝΑΣ" : "POOL LENGTH"}
          </p>
          <div className="flex flex-wrap gap-2">
            {POOL_LENGTHS.map((len) => (
              <button
                key={len}
                onClick={() => {
                  setPoolLen(len);
                  setCustomLen("");
                }}
                className="rounded-lg px-3.5 py-2 text-xs font-bold transition-all"
                style={
                  activeLen === len && !customLen
                    ? {
                        background: "rgba(29,158,117,0.2)",
                        color: "#5DCAA5",
                        border: "1px solid rgba(29,158,117,0.4)",
                      }
                    : {
                        background: "rgba(255,255,255,0.03)",
                        color: "rgba(255,255,255,0.4)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }
                }
              >
                {len === 0 ? (lang === "el" ? "Χωρίς" : "Off") : `${len}m`}
              </button>
            ))}
            <input
              inputMode="numeric"
              value={customLen}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                setCustomLen(v);
                setPoolLen(v ? parseInt(v, 10) : 0);
              }}
              placeholder={lang === "el" ? "άλλο m" : "custom m"}
              className="w-24 rounded-lg bg-white/5 px-3 py-2 text-center text-xs text-white outline-none focus:ring-1 focus:ring-[#1D9E75]"
            />
          </div>
        </div>

        {/* stats */}
        {laps.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat
              label={lang === "el" ? "Μήκη" : "Lengths"}
              value={String(laps.length)}
              color="#9FE1CB"
            />
            <Stat
              label={lang === "el" ? "Καλύτερο" : "Best lap"}
              value={fmt(bestLap)}
              color="#5DCAA5"
            />
            <Stat label={lang === "el" ? "Μ.Ο." : "Avg lap"} value={fmt(avgLap)} color="#1D9E75" />
          </div>
        )}

        {/* laps table */}
        {laps.length > 0 && (
          <div
            className="mt-4 overflow-hidden rounded-2xl"
            style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div
              className="grid grid-cols-[2.5rem_1fr_1fr_1fr] gap-1 px-3 py-2"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <span className="text-center text-[0.55rem] font-bold tracking-wider text-white/30">
                #
              </span>
              <span className="text-center text-[0.55rem] font-bold tracking-wider text-white/30">
                {lang === "el" ? "ΓΥΡΟΣ" : "LAP"}
              </span>
              <span className="text-center text-[0.55rem] font-bold tracking-wider text-white/30">
                {lang === "el" ? "ΣΥΝΟΛΟ" : "SPLIT"}
              </span>
              <span className="text-center text-[0.55rem] font-bold tracking-wider text-white/30">
                {poolLen > 0 ? (lang === "el" ? "ΑΠΟΣΤ." : "DIST") : ""}
              </span>
            </div>
            {[...lapTimes]
              .map((lt, idx) => idx)
              .reverse()
              .map((i) => {
                const isBest = lapTimes.length > 1 && lapTimes[i] === bestLap;
                const isWorst =
                  lapTimes.length > 1 && lapTimes[i] === worstLap && bestLap !== worstLap;
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[2.5rem_1fr_1fr_1fr] items-center gap-1 border-t px-3 py-2.5"
                    style={{ borderColor: "rgba(255,255,255,0.04)" }}
                  >
                    <span className="text-center text-xs font-bold text-white/25">{i + 1}</span>
                    <span
                      className="text-center font-mono text-xs font-bold"
                      style={{ color: isBest ? "#5DCAA5" : isWorst ? "#EF9F27" : "#fff" }}
                    >
                      {fmt(lapTimes[i]!)}
                    </span>
                    <span className="text-center font-mono text-xs text-white/45">
                      {fmt(laps[i]!)}
                    </span>
                    <span className="text-center font-mono text-xs text-white/45">
                      {poolLen > 0 ? `${(i + 1) * poolLen}m` : "—"}
                    </span>
                  </div>
                );
              })}
          </div>
        )}

        {/* save as dive */}
        {poolLen > 0 && laps.length > 0 && (
          <div
            className="mt-4 rounded-2xl p-4"
            style={{
              background: "rgba(29,158,117,0.06)",
              border: "1px solid rgba(29,158,117,0.25)",
            }}
          >
            <p className="mb-2.5 text-[0.65rem] font-bold tracking-wider text-white/50">
              {lang === "el" ? "ΚΑΤΑΓΡΑΦΗ ΩΣ ΒΟΥΤΙΑ" : "LOG AS DIVE"}
            </p>
            <div className="mb-3 flex gap-2">
              {POOL_DISCIPLINES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDiscipline(d)}
                  className="flex-1 rounded-lg py-2 text-xs font-bold transition-all"
                  style={
                    d === discipline
                      ? {
                          background: "rgba(29,158,117,0.2)",
                          color: "#5DCAA5",
                          border: "1px solid rgba(29,158,117,0.4)",
                        }
                      : {
                          background: "rgba(255,255,255,0.03)",
                          color: "rgba(255,255,255,0.4)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }
                  }
                >
                  {d}
                </button>
              ))}
            </div>
            <button
              onClick={handleSave}
              disabled={!canSave || saving || saved}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all"
              style={{
                background: saved ? "rgba(29,158,117,0.15)" : "#1D9E75",
                color: saved ? "#5DCAA5" : "#fff",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : saved ? (
                <Check className="size-4" />
              ) : (
                <Waves className="size-4" />
              )}
              {saved
                ? lang === "el"
                  ? "Καταγράφηκε ✓"
                  : "Logged ✓"
                : lang === "el"
                  ? `Καταγραφή ${distance}m ${discipline}`
                  : `Log ${distance}m ${discipline}`}
            </button>
            {!user && (
              <p className="mt-2 text-center text-[0.65rem] text-white/30">
                {lang === "el" ? "Συνδέσου για αποθήκευση" : "Sign in to save"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Isolated so only this node re-renders on tick (not the laps table).
function LiveTimer({ running, getElapsed }: { running: boolean; getElapsed: () => number }) {
  const [ms, setMs] = useState(() => getElapsed());
  useEffect(() => {
    setMs(getElapsed());
    if (!running) return;
    const id = setInterval(() => setMs(getElapsed()), 50);
    return () => clearInterval(id);
  }, [running, getElapsed]);
  return (
    <span className="font-mono text-[2.75rem] font-light leading-none tabular-nums text-white sm:text-[3.4rem]">
      {fmt(ms)}
    </span>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-xl py-3"
      style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <span className="font-mono text-sm font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-[0.55rem] font-bold tracking-wider text-white/30">{label}</span>
    </div>
  );
}
