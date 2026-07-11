import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Square,
  Bell,
  Volume2,
  VolumeX,
  Plus,
  Pencil,
  Trash2,
  X,
  Clock,
  Target,
  Flame,
  Moon,
  Waves,
  Calendar,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/lib/i18n";
import {
  DISCIPLINES,
  DISCIPLINE_MAP,
  disciplineName,
  isTimeDiscipline,
  type DisciplineCode,
} from "@/lib/diving";
import {
  type DivePlan,
  loadPlans,
  upsertPlan,
  deletePlan,
  newPlan,
  groupByDate,
  todayISO,
} from "@/lib/dive-plans";
import {
  type WarmupPreset,
  WARMUP_PRESETS,
  loadCustomWarmups,
  presetTotalSecs,
  fmtClock,
} from "@/lib/warmups";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { PlannerWarmup } from "@/components/PlannerWarmup";

// Resolve a plan's stored warm-up id back to the full preset (custom first,
// then built-ins). Custom warm-ups live in localStorage; built-ins are code.
function resolveWarmup(id: string | null): WarmupPreset | null {
  if (!id) return null;
  return [...loadCustomWarmups(), ...WARMUP_PRESETS].find((w) => w.id === id) ?? null;
}

export const Route = createFileRoute("/planner")({
  head: () => ({ meta: [{ title: "Σχεδίασε τη βουτιά σου — Apnos" }] }),
  component: () => (
    <AppLayout>
      <DivePlanPage />
    </AppLayout>
  ),
});

const DISC_COLOR: Record<string, string> = {
  STA: "#9FE1CB",
  DYN: "#1D9E75",
  DYNB: "#1D9E75",
  DNF: "#5DCAA5",
  CWT: "#EF9F27",
  CWTB: "#EF9F27",
  CNF: "#e8a020",
  FIM: "#d4912a",
};
const discColor = (d: DisciplineCode) => DISC_COLOR[d] ?? "#5DCAA5";

// ── time helpers ─────────────────────────────────────────────────────────────

function beep() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

// Combines the plan's own date with its top time — using "today" here was the
// bug behind "Plan your dive" always showing every milestone as passed for
// dives planned on a future date.
function dateTimeAt(dateISO: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = dateISO ? new Date(`${dateISO}T00:00:00`) : new Date();
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

function parseMMSS(s: string): number {
  const t = s.trim();
  if (t.includes(":")) {
    const [m, sec = "0"] = t.split(":");
    return (parseInt(m || "0", 10) || 0) * 60 + (parseInt(sec, 10) || 0);
  }
  const d = t.replace(/\D/g, "");
  if (!d) return 0;
  return (parseInt(d.slice(0, -2) || "0", 10) || 0) * 60 + (parseInt(d.slice(-2), 10) || 0);
}
function fmtMMSS(secs: number): string {
  return `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`;
}

function fmtDayLabel(iso: string, lang: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(lang === "el" ? "el-GR" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ── page ─────────────────────────────────────────────────────────────────────

function DivePlanPage() {
  const { lang } = useI18n();
  const [plans, setPlans] = useState<DivePlan[]>([]);
  const [editing, setEditing] = useState<DivePlan | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [running, setRunning] = useState<DivePlan | null>(null);
  // Warm-up runner lives at page level (not inside the countdown sheet) so it
  // keeps running even if the athlete closes the countdown, and reopening never
  // restarts it. `warmupMin` toggles the floating-chip vs. full-screen view.
  const [warmupPreset, setWarmupPreset] = useState<WarmupPreset | null>(null);
  const [warmupMin, setWarmupMin] = useState(false);

  const startWarmup = () => {
    if (warmupPreset) {
      setWarmupMin(false); // already running → just bring it back up
      return;
    }
    const w = resolveWarmup(running?.warmupId ?? null);
    if (!w) {
      toast(lang === "el" ? "Δεν έχει φορτωθεί ζέσταμα" : "No warm-up loaded");
      return;
    }
    setWarmupPreset(w);
    setWarmupMin(false);
  };

  useEffect(() => {
    setPlans(loadPlans());
  }, []);

  const grouped = useMemo(() => groupByDate(plans), [plans]);

  const openNew = () => {
    setEditing(newPlan(todayISO()));
    setShowForm(true);
  };
  const openEdit = (p: DivePlan) => {
    setEditing({ ...p });
    setShowForm(true);
  };
  const remove = (id: string) => {
    setPlans(deletePlan(id));
  };
  const onSaved = (p: DivePlan) => {
    setPlans(upsertPlan(p));
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {lang === "el" ? "Σχεδίασε τη βουτιά σου" : "Plan your dive"}
        </h1>
        <p className="text-xs text-foreground/35">
          {lang === "el"
            ? "Στόχος, ώρα top, ζέσταμα & συνθήκες αγώνα"
            : "Target, top time, warm-up & competition conditions"}
        </p>
      </div>

      <button
        onClick={openNew}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold"
        style={{ background: "#1D9E75", color: "#fff" }}
      >
        <Plus className="size-4" />
        {lang === "el" ? "Νέα προγραμματισμένη βουτιά" : "New planned dive"}
      </button>

      {plans.length === 0 ? (
        <div
          className="rounded-2xl py-12 text-center"
          style={{
            background: "rgba(var(--ink),0.02)",
            border: "1px dashed rgba(var(--ink),0.07)",
          }}
        >
          <Waves className="mx-auto size-8 text-foreground/10" />
          <p className="mt-3 text-sm text-foreground/30">
            {lang === "el" ? "Καμία βουτιά σχεδιασμένη ακόμα" : "No dives planned yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ date, plans: dayPlans }) => (
            <div key={date} className="space-y-2">
              <p className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-foreground/40">
                <Calendar className="size-3.5" /> {fmtDayLabel(date, lang)}
              </p>
              {dayPlans.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  lang={lang}
                  onEdit={() => openEdit(p)}
                  onDelete={() => remove(p.id)}
                  onStart={() => setRunning(p)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {showForm && editing && (
        <PlanFormModal
          plan={editing}
          lang={lang}
          onClose={() => setShowForm(false)}
          onSaved={onSaved}
        />
      )}
      {running && (
        <CountdownPanel
          plan={running}
          lang={lang}
          onClose={() => setRunning(null)}
          onStartWarmup={startWarmup}
          warmupActive={!!warmupPreset}
        />
      )}
      {warmupPreset && (
        <PlannerWarmup
          preset={warmupPreset}
          minimized={warmupMin}
          onMinimize={() => setWarmupMin(true)}
          onExpand={() => setWarmupMin(false)}
          onStop={() => {
            setWarmupPreset(null);
            setWarmupMin(false);
          }}
          lang={lang}
        />
      )}
    </div>
  );
}

// ── plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  lang,
  onEdit,
  onDelete,
  onStart,
}: {
  plan: DivePlan;
  lang: string;
  onEdit: () => void;
  onDelete: () => void;
  onStart: () => void;
}) {
  const color = discColor(plan.discipline);
  return (
    <div
      className="rounded-2xl p-3.5"
      style={{
        background: "var(--card)",
        border: "1px solid rgba(var(--ink),0.05)",
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="shrink-0 rounded-md px-2 py-1 text-xs font-bold"
          style={{ background: `${color}18`, color }}
        >
          {plan.discipline}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {disciplineName(plan.discipline, lang === "el" ? "el" : "en")}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.68rem] text-foreground/45">
            {plan.topTime && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" /> {plan.topTime}
              </span>
            )}
            {plan.target && (
              <span className="flex items-center gap-1">
                <Target className="size-3" /> {plan.target}
              </span>
            )}
            {plan.warmupName && (
              <span className="flex items-center gap-1">
                <Flame className="size-3" style={{ color: "#EF9F27" }} /> {plan.warmupName}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onEdit}
          className="rounded-lg p-2 text-foreground/25 hover:text-foreground/60"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          onClick={() => {
            if (confirm(lang === "el" ? "Διαγραφή;" : "Delete?")) onDelete();
          }}
          className="rounded-lg p-2 text-foreground/20 hover:text-red-400/70"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {plan.topTime && (
        <button
          onClick={onStart}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold"
          style={{
            background: "rgba(29,158,117,0.12)",
            border: "1px solid rgba(29,158,117,0.3)",
            color: "#5DCAA5",
          }}
        >
          <Play className="size-3.5" />{" "}
          {lang === "el" ? "Έναρξη αντίστροφης μέτρησης" : "Start countdown"}
        </button>
      )}
    </div>
  );
}

// ── form ─────────────────────────────────────────────────────────────────────

function PlanFormModal({
  plan,
  lang,
  onClose,
  onSaved,
}: {
  plan: DivePlan;
  lang: string;
  onClose: () => void;
  onSaved: (p: DivePlan) => void;
}) {
  const [p, setP] = useState<DivePlan>(plan);
  const [showWarmups, setShowWarmups] = useState(false);
  const set = (patch: Partial<DivePlan>) => setP((prev) => ({ ...prev, ...patch }));

  const time = isTimeDiscipline(p.discipline);
  const isDepth = DISCIPLINE_MAP[p.discipline]?.group === "Depth";
  const targetLabel = time
    ? lang === "el"
      ? "ΣΤΟΧΟΣ (Μ:ΔΔ)"
      : "TARGET (M:SS)"
    : isDepth
      ? lang === "el"
        ? "ΣΤΟΧΟΣ ΒΑΘΟΣ (m)"
        : "TARGET DEPTH (m)"
      : lang === "el"
        ? "ΣΤΟΧΟΣ (m)"
        : "TARGET (m)";

  const custom = loadCustomWarmups();
  const pickWarmup = (w: WarmupPreset) => {
    set({
      warmupId: w.id,
      warmupName: lang === "el" ? w.name_el : w.name_en,
      warmupMins: Math.max(5, Math.ceil(presetTotalSecs(w) / 60)),
    });
    setShowWarmups(false);
  };

  const save = () => {
    const clean: DivePlan = {
      ...p,
      target: time
        ? p.target
          ? fmtMMSS(parseMMSS(p.target))
          : ""
        : p.target.replace(/[^0-9]/g, ""),
    };
    onSaved(clean);
  };

  const labelCls = "mb-1.5 block text-[0.6rem] font-bold tracking-wider text-foreground/35";
  const inputCls =
    "w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-[#1D9E75]";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] overflow-y-auto rounded-t-3xl p-5"
        style={{ background: "var(--popover)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">
            {lang === "el" ? "Προγραμματισμένη βουτιά" : "Planned dive"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-foreground/40">
            <X className="size-5" />
          </button>
        </div>

        {/* discipline */}
        <label className={labelCls}>{lang === "el" ? "ΑΓΩΝΙΣΜΑ" : "DISCIPLINE"}</label>
        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {DISCIPLINES.map((d) => (
            <button
              key={d.code}
              onClick={() => set({ discipline: d.code })}
              className="rounded-lg py-2 text-[0.65rem] font-bold transition-all"
              style={
                d.code === p.discipline
                  ? {
                      background: `${discColor(d.code)}22`,
                      color: discColor(d.code),
                      border: `1px solid ${discColor(d.code)}55`,
                    }
                  : {
                      background: "rgba(var(--ink),0.03)",
                      color: "rgba(var(--ink),0.4)",
                      border: "1px solid rgba(var(--ink),0.06)",
                    }
              }
            >
              {d.code}
            </button>
          ))}
        </div>

        {/* date + top time */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{lang === "el" ? "ΗΜΕΡΟΜΗΝΙΑ" : "DATE"}</label>
            <input
              type="date"
              value={p.date}
              onChange={(e) => e.target.value && set({ date: e.target.value })}
              className={`${inputCls} text-foreground/70`}
              style={{ colorScheme: "dark" }}
            />
          </div>
          <div>
            <label className={labelCls}>{lang === "el" ? "ΩΡΑ TOP" : "TOP TIME"}</label>
            <input
              type="time"
              value={p.topTime}
              onChange={(e) => set({ topTime: e.target.value })}
              className={`${inputCls} text-foreground/70`}
              style={{ colorScheme: "dark" }}
            />
          </div>
        </div>

        {/* target */}
        <label className={labelCls}>{targetLabel}</label>
        <input
          inputMode="numeric"
          value={p.target}
          onChange={(e) =>
            set({ target: e.target.value.replace(time ? /[^0-9:]/g : /[^0-9]/g, "") })
          }
          onBlur={() => {
            if (time && p.target) set({ target: fmtMMSS(parseMMSS(p.target)) });
          }}
          placeholder={time ? "5:30" : isDepth ? "40" : "150"}
          className={`${inputCls} mb-3 text-center text-lg font-bold`}
        />

        {/* warm-up loader */}
        <label className={labelCls}>{lang === "el" ? "ΖΕΣΤΑΜΑ" : "WARM-UP"}</label>
        <button
          onClick={() => setShowWarmups(true)}
          className="mb-1 flex w-full items-center justify-between rounded-xl px-3 py-3"
          style={{ background: "rgba(var(--ink),0.03)", border: "1px solid rgba(var(--ink),0.06)" }}
        >
          <span className="flex items-center gap-2 text-sm">
            <Flame className="size-4" style={{ color: "#EF9F27" }} />
            <span className={p.warmupName ? "text-foreground/80" : "text-foreground/35"}>
              {p.warmupName || (lang === "el" ? "Φόρτωσε ζέσταμα…" : "Load a warm-up…")}
            </span>
          </span>
          {p.warmupId && <Check className="size-4" style={{ color: "#5DCAA5" }} />}
        </button>
        {p.warmupId && (
          <div className="mb-3 flex items-center gap-2">
            <label className="text-[0.65rem] text-foreground/40">
              {lang === "el" ? "λεπτά πριν το top" : "min before top"}
            </label>
            <input
              inputMode="numeric"
              value={String(p.warmupMins)}
              onChange={(e) =>
                set({
                  warmupMins: Math.max(0, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0),
                })
              }
              className="w-16 rounded-lg bg-foreground/5 px-2 py-1.5 text-center text-sm text-foreground outline-none"
            />
            <button
              onClick={() => set({ warmupId: null, warmupName: "" })}
              className="ml-auto text-[0.65rem] text-foreground/30 hover:text-red-400/70"
            >
              {lang === "el" ? "αφαίρεση" : "remove"}
            </button>
          </div>
        )}
        {!p.warmupId && <div className="mb-3" />}

        {/* STA wet + sleep */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          {p.discipline === "STA" ? (
            <button
              onClick={() => set({ wetStatic: !p.wetStatic })}
              className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{
                background: "rgba(var(--ink),0.03)",
                border: "1px solid rgba(var(--ink),0.06)",
              }}
            >
              <span className="flex items-center gap-1.5 text-xs text-foreground/70">
                <Waves className="size-3.5 text-[#5DCAA5]" />
                {p.wetStatic ? (lang === "el" ? "Υγρή" : "Wet") : lang === "el" ? "Ξηρή" : "Dry"}
              </span>
            </button>
          ) : (
            <div />
          )}
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{
              background: "rgba(var(--ink),0.03)",
              border: "1px solid rgba(var(--ink),0.06)",
            }}
          >
            <Moon className="size-3.5 text-[#B58BE8]" />
            <input
              inputMode="numeric"
              value={p.sleepGoal}
              onChange={(e) => set({ sleepGoal: e.target.value.replace(/[^0-9]/g, "") })}
              placeholder={lang === "el" ? "ύπνος h" : "sleep h"}
              className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-foreground/30"
            />
          </div>
        </div>

        {/* notes */}
        <label className={labelCls}>{lang === "el" ? "ΣΗΜΕΙΩΣΕΙΣ" : "NOTES"}</label>
        <textarea
          value={p.notes}
          onChange={(e) => set({ notes: e.target.value })}
          rows={2}
          placeholder={lang === "el" ? "νοητική προετοιμασία, εξοπλισμός…" : "mental prep, gear…"}
          className={`${inputCls} mb-4 resize-none`}
        />

        <button
          onClick={save}
          className="w-full rounded-xl py-3.5 text-sm font-bold"
          style={{ background: "#1D9E75", color: "#fff" }}
        >
          {lang === "el" ? "Αποθήκευση" : "Save"}
        </button>

        {showWarmups && (
          <WarmupPicker
            presets={WARMUP_PRESETS}
            custom={custom}
            lang={lang}
            onPick={pickWarmup}
            onClose={() => setShowWarmups(false)}
          />
        )}
      </div>
    </div>
  );
}

function WarmupPicker({
  presets,
  custom,
  lang,
  onPick,
  onClose,
}: {
  presets: WarmupPreset[];
  custom: WarmupPreset[];
  lang: string;
  onPick: (w: WarmupPreset) => void;
  onClose: () => void;
}) {
  const all = [...custom, ...presets];
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="max-h-[75vh] overflow-y-auto rounded-t-3xl p-5"
        style={{ background: "var(--popover)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">
            {lang === "el" ? "Διάλεξε ζέσταμα" : "Choose a warm-up"}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-foreground/40">
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-2">
          {all.map((w) => (
            <button
              key={w.id}
              onClick={() => onPick(w)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left"
              style={{
                background: "var(--card)",
                border: "1px solid rgba(var(--ink),0.05)",
                borderLeft: `3px solid ${w.accent}`,
              }}
            >
              <Flame className="size-4 shrink-0" style={{ color: w.accent }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {lang === "el" ? w.name_el : w.name_en}
                  {w.custom && (
                    <span className="ml-1.5 text-[0.55rem] text-foreground/30">custom</span>
                  )}
                </p>
                <p className="text-[0.65rem] text-foreground/40">
                  {fmtClock(presetTotalSecs(w))} {lang === "el" ? "συνολικά" : "total"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── countdown runner ─────────────────────────────────────────────────────────

interface Milestone {
  key: string;
  label: string;
  at: Date;
}

function CountdownPanel({
  plan,
  lang,
  onClose,
  onStartWarmup,
  warmupActive,
}: {
  plan: DivePlan;
  lang: string;
  onClose: () => void;
  onStartWarmup: () => void;
  warmupActive: boolean;
}) {
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const fired = useRef<Set<string>>(new Set());
  const onStartWarmupRef = useRef(onStartWarmup);
  onStartWarmupRef.current = onStartWarmup;
  useWakeLock(running); // keep the screen on while counting down to TOP

  const milestones = useMemo<Milestone[]>(() => {
    const tt = dateTimeAt(plan.date, plan.topTime);
    const ms: Milestone[] = [];
    if (plan.warmupMins > 0)
      ms.push({
        key: "warmup",
        label: lang === "el" ? "Έναρξη ζεστάματος" : "Warm-up start",
        at: new Date(tt.getTime() - plan.warmupMins * 60000),
      });
    ms.push({
      key: "countdown",
      label: lang === "el" ? "Αντίστροφη 3′" : "Countdown 3′",
      at: new Date(tt.getTime() - 3 * 60000),
    });
    ms.push({ key: "top", label: lang === "el" ? "Επίσημο TOP" : "Official TOP", at: tt });
    return ms;
  }, [plan.date, plan.topTime, plan.warmupMins, lang]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const cur = new Date();
      setNow(cur);
      for (const m of milestones) {
        if (
          !fired.current.has(m.key) &&
          cur.getTime() >= m.at.getTime() &&
          cur.getTime() - m.at.getTime() < 2000
        ) {
          fired.current.add(m.key);
          if (sound) beep();
          // the warm-up milestone gets a one-tap "Start" action so the athlete
          // can launch the breathing sequence without hunting for a button
          if (m.key === "warmup" && plan.warmupId) {
            toast(`🔔 ${m.label}`, {
              duration: 12000,
              action: {
                label: lang === "el" ? "Έναρξη" : "Start",
                onClick: () => onStartWarmupRef.current(),
              },
            });
          } else {
            toast(`🔔 ${m.label}`, { duration: 8000 });
          }
        }
      }
      if (milestones.every((m) => fired.current.has(m.key))) setRunning(false);
    }, 1000);
    return () => clearInterval(id);
  }, [running, milestones, sound, plan.warmupId, lang]);

  const start = () => {
    fired.current = new Set();
    const cur = new Date();
    for (const m of milestones) if (cur.getTime() >= m.at.getTime()) fired.current.add(m.key);
    setRunning(true);
  };

  const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const color = discColor(plan.discipline);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="rounded-t-3xl p-5"
        style={{ background: "var(--popover)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="rounded-md px-2 py-1 text-xs font-bold"
              style={{ background: `${color}18`, color }}
            >
              {plan.discipline}
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">
                {lang === "el" ? "TOP στις" : "TOP at"} {plan.topTime}
              </p>
              {plan.target && (
                <p className="text-[0.65rem] text-foreground/40">
                  {lang === "el" ? "στόχος" : "target"} {plan.target}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-foreground/40">
            <X className="size-5" />
          </button>
        </div>

        <div className="mb-4 space-y-2">
          {milestones.map((m) => {
            const diff = m.at.getTime() - now.getTime();
            const passed = diff <= 0;
            const isFired = fired.current.has(m.key);
            return (
              <div
                key={m.key}
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{
                  background: "rgba(var(--ink),0.03)",
                  border:
                    running && !passed && diff < 60000
                      ? "1px solid rgba(29,158,117,0.5)"
                      : "1px solid rgba(var(--ink),0.05)",
                }}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{m.label}</p>
                  <p className="text-[0.65rem] text-foreground/40">{fmtTime(m.at)}</p>
                </div>
                <p
                  className="font-mono text-base font-bold tabular-nums"
                  style={{ color: passed ? "rgba(var(--ink),0.3)" : "#5DCAA5" }}
                >
                  {passed
                    ? isFired && running
                      ? "🔔"
                      : lang === "el"
                        ? "πέρασε"
                        : "passed"
                    : fmtCountdown(diff)}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {running ? (
            <button
              onClick={() => setRunning(false)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold"
              style={{ background: "rgba(var(--ink),0.06)", color: "rgba(var(--ink),0.7)" }}
            >
              <Square className="size-4" /> {lang === "el" ? "Διακοπή" : "Stop"}
            </button>
          ) : (
            <button
              onClick={start}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold"
              style={{ background: "#1D9E75", color: "#fff" }}
            >
              <Play className="size-4" /> {lang === "el" ? "Έναρξη" : "Start"}
            </button>
          )}
          <button
            onClick={() => setSound((s) => !s)}
            className="flex size-11 items-center justify-center rounded-xl"
            style={{
              background: "rgba(var(--ink),0.04)",
              color: sound ? "#5DCAA5" : "rgba(var(--ink),0.3)",
            }}
          >
            {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>
        </div>

        {/* run the loaded warm-up inline — stays live over this countdown */}
        {plan.warmupId && (
          <button
            onClick={onStartWarmup}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold"
            style={{
              background: "rgba(239,159,39,0.14)",
              border: "1px solid rgba(239,159,39,0.4)",
              color: "#EF9F27",
            }}
          >
            <Flame className="size-4" />
            {warmupActive
              ? lang === "el"
                ? "Συνέχισε το ζέσταμα"
                : "Resume warm-up"
              : lang === "el"
                ? `Ξεκίνα ζέσταμα · ${plan.warmupName}`
                : `Start warm-up · ${plan.warmupName}`}
          </button>
        )}

        {running && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[0.65rem] text-[#5DCAA5]">
            <Bell className="size-3" />{" "}
            {lang === "el"
              ? "Οι ειδοποιήσεις είναι ενεργές — κράτα την οθόνη ανοιχτή"
              : "Alerts armed — keep the screen on"}
          </p>
        )}
      </div>
    </div>
  );
}
