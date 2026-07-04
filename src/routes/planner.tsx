import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Play, Square, Bell, Volume2, VolumeX, Plus, Pencil, Trash2, X,
  Clock, Target, Flame, Moon, Waves, Calendar, Check, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { fetchAthletes } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";
import {
  DISCIPLINES, DISCIPLINE_MAP, disciplineName, isTimeDiscipline,
  type DisciplineCode,
} from "@/lib/diving";
import {
  type DivePlan, loadPlans, upsertPlan, deletePlan, newPlan, groupByDate, todayISO,
} from "@/lib/dive-plans";
import {
  type WarmupPreset, WARMUP_PRESETS, loadCustomWarmups, presetTotalSecs, fmtClock,
} from "@/lib/warmups";

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
  DYN: "#1D9E75", DYNB: "#1D9E75", DNF: "#5DCAA5",
  CWT: "#EF9F27", CWTB: "#EF9F27", CNF: "#e8a020", FIM: "#d4912a",
};
const discColor = (d: DisciplineCode) => DISC_COLOR[d] ?? "#5DCAA5";

// ── time helpers ─────────────────────────────────────────────────────────────

function beep() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
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
      else { o.stop(ctx.currentTime + 0.2); setTimeout(() => ctx.close(), 400); }
    };
    setTimeout(pulse, 160);
  } catch { /* audio not available */ }
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
  return d.toLocaleDateString(lang === "el" ? "el-GR" : "en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// ── page ─────────────────────────────────────────────────────────────────────

function DivePlanPage() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [plans, setPlans] = useState<DivePlan[]>([]);
  const [editing, setEditing] = useState<DivePlan | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [running, setRunning] = useState<DivePlan | null>(null);

  const { data: athletes = [] } = useQuery({
    queryKey: ["coach_athletes", user?.id],
    queryFn: () => fetchAthletes(user!.id),
    enabled: !!user,
  });
  const programmes = useMemo(
    () => athletes.flatMap((a) => (a.programs ?? []).map((p) => ({ name: p.name, athleteName: a.name }))),
    [athletes],
  );

  useEffect(() => { setPlans(loadPlans()); }, []);

  const grouped = useMemo(() => groupByDate(plans), [plans]);

  const openNew = () => { setEditing(newPlan(todayISO())); setShowForm(true); };
  const openEdit = (p: DivePlan) => { setEditing({ ...p }); setShowForm(true); };
  const remove = (id: string) => { setPlans(deletePlan(id)); };
  const onSaved = (p: DivePlan) => { setPlans(upsertPlan(p)); setShowForm(false); };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">{lang === "el" ? "Σχεδίασε τη βουτιά σου" : "Plan your dive"}</h1>
        <p className="text-xs text-white/35">{lang === "el" ? "Στόχος, ώρα top, ζέσταμα & συνθήκες αγώνα" : "Target, top time, warm-up & competition conditions"}</p>
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
        <div className="rounded-2xl py-12 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.07)" }}>
          <Waves className="mx-auto size-8 text-white/10" />
          <p className="mt-3 text-sm text-white/30">{lang === "el" ? "Καμία βουτιά σχεδιασμένη ακόμα" : "No dives planned yet"}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ date, plans: dayPlans }) => (
            <div key={date} className="space-y-2">
              <p className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-white/40">
                <Calendar className="size-3.5" /> {fmtDayLabel(date, lang)}
              </p>
              {dayPlans.map((p) => (
                <PlanCard key={p.id} plan={p} lang={lang} onEdit={() => openEdit(p)} onDelete={() => remove(p.id)} onStart={() => setRunning(p)} />
              ))}
            </div>
          ))}
        </div>
      )}

      {showForm && editing && (
        <PlanFormModal plan={editing} lang={lang} programmes={programmes} onClose={() => setShowForm(false)} onSaved={onSaved} />
      )}
      {running && (
        <CountdownPanel plan={running} lang={lang} onClose={() => setRunning(null)} />
      )}
    </div>
  );
}

// ── plan card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, lang, onEdit, onDelete, onStart }: {
  plan: DivePlan; lang: string; onEdit: () => void; onDelete: () => void; onStart: () => void;
}) {
  const color = discColor(plan.discipline);
  return (
    <div className="rounded-2xl p-3.5" style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.05)", borderLeft: `3px solid ${color}` }}>
      <div className="flex items-center gap-3">
        <span className="shrink-0 rounded-md px-2 py-1 text-xs font-bold" style={{ background: `${color}18`, color }}>{plan.discipline}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{disciplineName(plan.discipline, lang === "el" ? "el" : "en")}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.68rem] text-white/45">
            {plan.topTime && <span className="flex items-center gap-1"><Clock className="size-3" /> {plan.topTime}</span>}
            {plan.target && <span className="flex items-center gap-1"><Target className="size-3" /> {plan.target}</span>}
            {plan.warmupName && <span className="flex items-center gap-1"><Flame className="size-3" style={{ color: "#EF9F27" }} /> {plan.warmupName}</span>}
            {plan.programName && <span className="flex items-center gap-1"><ClipboardList className="size-3" style={{ color: "#B58BE8" }} /> {plan.programName}</span>}
          </div>
        </div>
        <button onClick={onEdit} className="rounded-lg p-2 text-white/25 hover:text-white/60"><Pencil className="size-3.5" /></button>
        <button onClick={() => { if (confirm(lang === "el" ? "Διαγραφή;" : "Delete?")) onDelete(); }} className="rounded-lg p-2 text-white/20 hover:text-red-400/70"><Trash2 className="size-3.5" /></button>
      </div>
      {plan.topTime && (
        <button onClick={onStart} className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold" style={{ background: "rgba(29,158,117,0.12)", border: "1px solid rgba(29,158,117,0.3)", color: "#5DCAA5" }}>
          <Play className="size-3.5" /> {lang === "el" ? "Έναρξη αντίστροφης μέτρησης" : "Start countdown"}
        </button>
      )}
    </div>
  );
}

// ── form ─────────────────────────────────────────────────────────────────────

function PlanFormModal({ plan, lang, programmes, onClose, onSaved }: {
  plan: DivePlan; lang: string; programmes: { name: string; athleteName: string }[];
  onClose: () => void; onSaved: (p: DivePlan) => void;
}) {
  const [p, setP] = useState<DivePlan>(plan);
  const [showWarmups, setShowWarmups] = useState(false);
  const [showProgrammes, setShowProgrammes] = useState(false);
  const set = (patch: Partial<DivePlan>) => setP((prev) => ({ ...prev, ...patch }));

  const time = isTimeDiscipline(p.discipline);
  const isDepth = DISCIPLINE_MAP[p.discipline]?.group === "Depth";
  const targetLabel = time
    ? (lang === "el" ? "ΣΤΟΧΟΣ (Μ:ΔΔ)" : "TARGET (M:SS)")
    : isDepth ? (lang === "el" ? "ΣΤΟΧΟΣ ΒΑΘΟΣ (m)" : "TARGET DEPTH (m)")
    : (lang === "el" ? "ΣΤΟΧΟΣ (m)" : "TARGET (m)");

  const custom = loadCustomWarmups();
  const pickWarmup = (w: WarmupPreset) => {
    set({ warmupId: w.id, warmupName: lang === "el" ? w.name_el : w.name_en, warmupMins: Math.max(5, Math.ceil(presetTotalSecs(w) / 60)) });
    setShowWarmups(false);
  };

  const save = () => {
    const clean: DivePlan = {
      ...p,
      target: time ? (p.target ? fmtMMSS(parseMMSS(p.target)) : "") : p.target.replace(/[^0-9]/g, ""),
    };
    onSaved(clean);
  };

  const labelCls = "mb-1.5 block text-[0.6rem] font-bold tracking-wider text-white/35";
  const inputCls = "w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-[#1D9E75]";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="max-h-[92vh] overflow-y-auto rounded-t-3xl p-5" style={{ background: "#0a0f1a" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">{lang === "el" ? "Προγραμματισμένη βουτιά" : "Planned dive"}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40"><X className="size-5" /></button>
        </div>

        {/* discipline */}
        <label className={labelCls}>{lang === "el" ? "ΑΓΩΝΙΣΜΑ" : "DISCIPLINE"}</label>
        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {DISCIPLINES.map((d) => (
            <button key={d.code} onClick={() => set({ discipline: d.code })}
              className="rounded-lg py-2 text-[0.65rem] font-bold transition-all"
              style={d.code === p.discipline
                ? { background: `${discColor(d.code)}22`, color: discColor(d.code), border: `1px solid ${discColor(d.code)}55` }
                : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {d.code}
            </button>
          ))}
        </div>

        {/* date + top time */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{lang === "el" ? "ΗΜΕΡΟΜΗΝΙΑ" : "DATE"}</label>
            <input type="date" value={p.date} onChange={(e) => e.target.value && set({ date: e.target.value })} className={`${inputCls} text-white/70`} style={{ colorScheme: "dark" }} />
          </div>
          <div>
            <label className={labelCls}>{lang === "el" ? "ΩΡΑ TOP" : "TOP TIME"}</label>
            <input type="time" value={p.topTime} onChange={(e) => set({ topTime: e.target.value })} className={`${inputCls} text-white/70`} style={{ colorScheme: "dark" }} />
          </div>
        </div>

        {/* target */}
        <label className={labelCls}>{targetLabel}</label>
        <input
          inputMode="numeric"
          value={p.target}
          onChange={(e) => set({ target: e.target.value.replace(time ? /[^0-9:]/g : /[^0-9]/g, "") })}
          onBlur={() => { if (time && p.target) set({ target: fmtMMSS(parseMMSS(p.target)) }); }}
          placeholder={time ? "5:30" : isDepth ? "40" : "150"}
          className={`${inputCls} mb-3 text-center text-lg font-bold`}
        />

        {/* warm-up loader */}
        <label className={labelCls}>{lang === "el" ? "ΖΕΣΤΑΜΑ" : "WARM-UP"}</label>
        <button onClick={() => setShowWarmups(true)} className="mb-1 flex w-full items-center justify-between rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="flex items-center gap-2 text-sm">
            <Flame className="size-4" style={{ color: "#EF9F27" }} />
            <span className={p.warmupName ? "text-white/80" : "text-white/35"}>{p.warmupName || (lang === "el" ? "Φόρτωσε ζέσταμα…" : "Load a warm-up…")}</span>
          </span>
          {p.warmupId && <Check className="size-4" style={{ color: "#5DCAA5" }} />}
        </button>
        {p.warmupId && (
          <div className="mb-3 flex items-center gap-2">
            <label className="text-[0.65rem] text-white/40">{lang === "el" ? "λεπτά πριν το top" : "min before top"}</label>
            <input inputMode="numeric" value={String(p.warmupMins)} onChange={(e) => set({ warmupMins: Math.max(0, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0) })} className="w-16 rounded-lg bg-white/5 px-2 py-1.5 text-center text-sm text-white outline-none" />
            <button onClick={() => set({ warmupId: null, warmupName: "" })} className="ml-auto text-[0.65rem] text-white/30 hover:text-red-400/70">{lang === "el" ? "αφαίρεση" : "remove"}</button>
          </div>
        )}
        {!p.warmupId && <div className="mb-3" />}

        {/* programme loader (from your coach programmes) */}
        {programmes.length > 0 && (
          <>
            <label className={labelCls}>{lang === "el" ? "ΠΡΟΓΡΑΜΜΑ" : "PROGRAMME"}</label>
            <button onClick={() => setShowProgrammes(true)} className="mb-3 flex w-full items-center justify-between rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="flex items-center gap-2 text-sm">
                <ClipboardList className="size-4" style={{ color: "#B58BE8" }} />
                <span className={p.programName ? "text-white/80" : "text-white/35"}>{p.programName || (lang === "el" ? "Φόρτωσε πρόγραμμα…" : "Load a programme…")}</span>
              </span>
              {p.programName
                ? <button onClick={(e) => { e.stopPropagation(); set({ programName: "" }); }} className="text-[0.65rem] text-white/30 hover:text-red-400/70">{lang === "el" ? "αφαίρεση" : "remove"}</button>
                : null}
            </button>
          </>
        )}

        {/* STA wet + sleep */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          {p.discipline === "STA" ? (
            <button onClick={() => set({ wetStatic: !p.wetStatic })} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="flex items-center gap-1.5 text-xs text-white/70"><Waves className="size-3.5 text-[#5DCAA5]" />{p.wetStatic ? (lang === "el" ? "Υγρή" : "Wet") : (lang === "el" ? "Ξηρή" : "Dry")}</span>
            </button>
          ) : <div />}
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Moon className="size-3.5 text-[#B58BE8]" />
            <input inputMode="numeric" value={p.sleepGoal} onChange={(e) => set({ sleepGoal: e.target.value.replace(/[^0-9]/g, "") })} placeholder={lang === "el" ? "ύπνος h" : "sleep h"} className="w-full bg-transparent text-xs text-white outline-none placeholder:text-white/30" />
          </div>
        </div>

        {/* notes */}
        <label className={labelCls}>{lang === "el" ? "ΣΗΜΕΙΩΣΕΙΣ" : "NOTES"}</label>
        <textarea value={p.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} placeholder={lang === "el" ? "νοητική προετοιμασία, εξοπλισμός…" : "mental prep, gear…"} className={`${inputCls} mb-4 resize-none`} />

        <button onClick={save} className="w-full rounded-xl py-3.5 text-sm font-bold" style={{ background: "#1D9E75", color: "#fff" }}>
          {lang === "el" ? "Αποθήκευση" : "Save"}
        </button>

        {showWarmups && (
          <WarmupPicker presets={WARMUP_PRESETS} custom={custom} lang={lang} onPick={pickWarmup} onClose={() => setShowWarmups(false)} />
        )}
        {showProgrammes && (
          <ProgrammePicker programmes={programmes} lang={lang} onPick={(name) => { set({ programName: name }); setShowProgrammes(false); }} onClose={() => setShowProgrammes(false)} />
        )}
      </div>
    </div>
  );
}

function ProgrammePicker({ programmes, lang, onPick, onClose }: {
  programmes: { name: string; athleteName: string }[]; lang: string; onPick: (name: string) => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="max-h-[75vh] overflow-y-auto rounded-t-3xl p-5" style={{ background: "#0a0f1a" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{lang === "el" ? "Διάλεξε πρόγραμμα" : "Choose a programme"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40"><X className="size-5" /></button>
        </div>
        <div className="space-y-2">
          {programmes.map((pr, i) => (
            <button key={i} onClick={() => onPick(pr.name)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left" style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.05)", borderLeft: "3px solid #B58BE8" }}>
              <ClipboardList className="size-4 shrink-0" style={{ color: "#B58BE8" }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{pr.name}</p>
                <p className="text-[0.65rem] text-white/40">{pr.athleteName}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function WarmupPicker({ presets, custom, lang, onPick, onClose }: {
  presets: WarmupPreset[]; custom: WarmupPreset[]; lang: string; onPick: (w: WarmupPreset) => void; onClose: () => void;
}) {
  const all = [...custom, ...presets];
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="max-h-[75vh] overflow-y-auto rounded-t-3xl p-5" style={{ background: "#0a0f1a" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{lang === "el" ? "Διάλεξε ζέσταμα" : "Choose a warm-up"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40"><X className="size-5" /></button>
        </div>
        <div className="space-y-2">
          {all.map((w) => (
            <button key={w.id} onClick={() => onPick(w)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left" style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.05)", borderLeft: `3px solid ${w.accent}` }}>
              <Flame className="size-4 shrink-0" style={{ color: w.accent }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{lang === "el" ? w.name_el : w.name_en}{w.custom && <span className="ml-1.5 text-[0.55rem] text-white/30">custom</span>}</p>
                <p className="text-[0.65rem] text-white/40">{fmtClock(presetTotalSecs(w))} {lang === "el" ? "συνολικά" : "total"}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── countdown runner ─────────────────────────────────────────────────────────

interface Milestone { key: string; label: string; at: Date; }

function CountdownPanel({ plan, lang, onClose }: { plan: DivePlan; lang: string; onClose: () => void }) {
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const fired = useRef<Set<string>>(new Set());

  const milestones = useMemo<Milestone[]>(() => {
    const tt = todayAt(plan.topTime);
    const ms: Milestone[] = [];
    if (plan.warmupMins > 0) ms.push({ key: "warmup", label: lang === "el" ? "Έναρξη ζεστάματος" : "Warm-up start", at: new Date(tt.getTime() - plan.warmupMins * 60000) });
    ms.push({ key: "countdown", label: lang === "el" ? "Αντίστροφη 3′" : "Countdown 3′", at: new Date(tt.getTime() - 3 * 60000) });
    ms.push({ key: "top", label: lang === "el" ? "Επίσημο TOP" : "Official TOP", at: tt });
    return ms;
  }, [plan.topTime, plan.warmupMins, lang]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const cur = new Date();
      setNow(cur);
      for (const m of milestones) {
        if (!fired.current.has(m.key) && cur.getTime() >= m.at.getTime() && cur.getTime() - m.at.getTime() < 2000) {
          fired.current.add(m.key);
          if (sound) beep();
          toast(`🔔 ${m.label}`, { duration: 8000 });
        }
      }
      if (milestones.every((m) => fired.current.has(m.key))) setRunning(false);
    }, 1000);
    return () => clearInterval(id);
  }, [running, milestones, sound]);

  const start = () => {
    fired.current = new Set();
    const cur = new Date();
    for (const m of milestones) if (cur.getTime() >= m.at.getTime()) fired.current.add(m.key);
    setRunning(true);
  };

  const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const color = discColor(plan.discipline);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="rounded-t-3xl p-5" style={{ background: "#0a0f1a" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-md px-2 py-1 text-xs font-bold" style={{ background: `${color}18`, color }}>{plan.discipline}</span>
            <div>
              <p className="text-sm font-bold text-white">{lang === "el" ? "TOP στις" : "TOP at"} {plan.topTime}</p>
              {plan.target && <p className="text-[0.65rem] text-white/40">{lang === "el" ? "στόχος" : "target"} {plan.target}</p>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40"><X className="size-5" /></button>
        </div>

        <div className="mb-4 space-y-2">
          {milestones.map((m) => {
            const diff = m.at.getTime() - now.getTime();
            const passed = diff <= 0;
            const isFired = fired.current.has(m.key);
            return (
              <div key={m.key} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", border: running && !passed && diff < 60000 ? "1px solid rgba(29,158,117,0.5)" : "1px solid rgba(255,255,255,0.05)" }}>
                <div>
                  <p className="text-sm font-semibold text-white">{m.label}</p>
                  <p className="text-[0.65rem] text-white/40">{fmtTime(m.at)}</p>
                </div>
                <p className="font-mono text-base font-bold tabular-nums" style={{ color: passed ? "rgba(255,255,255,0.3)" : "#5DCAA5" }}>
                  {passed ? (isFired && running ? "🔔" : (lang === "el" ? "πέρασε" : "passed")) : fmtCountdown(diff)}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {running ? (
            <button onClick={() => setRunning(false)} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
              <Square className="size-4" /> {lang === "el" ? "Διακοπή" : "Stop"}
            </button>
          ) : (
            <button onClick={start} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold" style={{ background: "#1D9E75", color: "#fff" }}>
              <Play className="size-4" /> {lang === "el" ? "Έναρξη" : "Start"}
            </button>
          )}
          <button onClick={() => setSound((s) => !s)} className="flex size-11 items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,0.04)", color: sound ? "#5DCAA5" : "rgba(255,255,255,0.3)" }}>
            {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>
        </div>
        {running && <p className="mt-2 flex items-center justify-center gap-1.5 text-[0.65rem] text-[#5DCAA5]"><Bell className="size-3" /> {lang === "el" ? "Οι ειδοποιήσεις είναι ενεργές — κράτα την οθόνη ανοιχτή" : "Alerts armed — keep the screen on"}</p>}
      </div>
    </div>
  );
}
