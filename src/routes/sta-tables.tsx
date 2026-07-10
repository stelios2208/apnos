import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipForward,
  X,
  Plus,
  Minus,
  Trash2,
  Save,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { fetchDives, personalBests } from "@/lib/dives";
import {
  type StaTableType,
  type BreathingMode,
  type PresetLevel,
  type TableRound,
  type StaTable,
  PRESET_LEVELS,
  LEVEL_LABEL,
  MODE_LABEL,
  presetRounds,
  tableTotalSecs,
  fetchStaTables,
  saveStaTable,
  deleteStaTable,
} from "@/lib/sta-tables";
import { fmtClock } from "@/lib/warmups";
import { loadFxSettings, vibrate, beep } from "@/lib/trainer-fx";
import { TableCard } from "@/components/TableCard";
import { UnderwaterScene } from "@/components/UnderwaterScene";
import { LogoBreathPacer } from "@/components/LogoBreathPacer";

export const Route = createFileRoute("/sta-tables")({
  head: () => ({ meta: [{ title: "STA Tables — Apnos" }] }),
  component: StaTables,
});

const TEAL = "#1D9E75";
const TEAL_SOFT = "#5DCAA5";
const ORANGE = "#EF9F27";

const MANUAL_PB_KEY = "apnos.sta.manualPb";

function loadManualPb(): number | null {
  if (typeof localStorage === "undefined") return null;
  const v = parseInt(localStorage.getItem(MANUAL_PB_KEY) ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : null;
}

// ── page ─────────────────────────────────────────────────────────────────────

function StaTables() {
  const { lang } = useI18n();
  const el = lang === "el";
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: dives = [] } = useQuery({
    queryKey: ["dives", user?.id],
    queryFn: () => fetchDives(user!.id),
    enabled: !!user,
  });
  const { data: library = [], refetch: refetchLibrary } = useQuery({
    queryKey: ["sta_tables", user?.id],
    queryFn: () => fetchStaTables(user!.id),
    enabled: !!user,
  });

  const pbFromDives = personalBests(dives)["STA"]?.result ?? null;
  const [manualPb, setManualPb] = useState<number | null>(() => loadManualPb());
  const pb = pbFromDives ?? manualPb;

  const [type, setType] = useState<StaTableType>("co2");
  const [mode, setMode] = useState<BreathingMode>("normal");
  const [level, setLevel] = useState<PresetLevel>("medium");
  const [custom, setCustom] = useState(false);
  const [rounds, setRounds] = useState<TableRound[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [rvWarn, setRvWarn] = useState<null | { rounds: TableRound[] }>(null);
  const [running, setRunning] = useState<null | { rounds: TableRound[] }>(null);

  const rvMode = mode === "rv";

  // keep the preview in sync with the selected preset
  useEffect(() => {
    if (!custom && !rvMode && pb) setRounds(presetRounds(type, level, pb));
  }, [type, level, pb, custom, rvMode]);

  const autoName = rvMode
    ? `${type.toUpperCase()} RV`
    : `${type.toUpperCase()} ${el ? LEVEL_LABEL[level].el : LEVEL_LABEL[level].en}`;

  const selectMode = (m: BreathingMode) => {
    setMode(m);
    if (m === "rv") {
      // RV is custom-only: never offer calculated presets at residual volume
      setCustom(true);
      if (rounds.length === 0)
        setRounds(Array.from({ length: 6 }, () => ({ breatheSecs: 120, holdSecs: 60 })));
    }
  };

  const startTable = (r: TableRound[], breathingMode: BreathingMode) => {
    if (r.length === 0) return;
    if (breathingMode === "rv") setRvWarn({ rounds: r });
    else setRunning({ rounds: r });
  };

  const handleSave = async () => {
    if (!user || rounds.length === 0 || saving) return;
    setSaving(true);
    try {
      await saveStaTable(user.id, {
        name: (name || autoName).trim(),
        type,
        breathing_mode: mode,
        rounds,
      });
      toast.success(el ? "Αποθηκεύτηκε στη βιβλιοθήκη" : "Saved to library");
      setName("");
      refetchLibrary();
    } catch (e) {
      console.error(e);
      toast.error(el ? "Σφάλμα αποθήκευσης" : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const removeSaved = async (t: StaTable) => {
    if (!confirm(el ? `Διαγραφή «${t.name}»;` : `Delete “${t.name}”?`)) return;
    try {
      await deleteStaTable(t.id);
      refetchLibrary();
    } catch (e) {
      console.error(e);
      toast.error(el ? "Σφάλμα διαγραφής" : "Delete failed");
    }
  };

  const loadSaved = (t: StaTable) => {
    setType(t.type);
    setMode(t.breathing_mode);
    setCustom(true);
    setRounds(t.rounds);
    setName(t.name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── RUNNER ────────────────────────────────────────────────────────────────
  if (running) {
    return <TableRunner rounds={running.rounds} lang={lang} onExit={() => setRunning(null)} />;
  }

  // ── BUILDER ───────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen px-4 pb-24 pt-6" style={{ background: "#020a13" }}>
      <div className="relative z-10 mx-auto max-w-md">
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
            <h1 className="text-2xl font-bold text-white">{el ? "Πίνακες STA" : "STA Tables"}</h1>
            <p className="text-xs text-white/35">
              {el ? "CO₂ / O₂ tables από το PB σου" : "CO₂ / O₂ tables built from your PB"}
            </p>
          </div>
        </div>

        {/* 1. table type — segmented control */}
        <div
          className="mt-6 grid grid-cols-2 gap-1 rounded-xl p-1"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          {(["co2", "o2"] as StaTableType[]).map((tp) => (
            <button
              key={tp}
              onClick={() => setType(tp)}
              className="rounded-lg py-2.5 text-sm font-bold tracking-wide transition-all"
              style={
                type === tp
                  ? { background: TEAL, color: "#fff" }
                  : { color: "rgba(255,255,255,0.45)" }
              }
            >
              {tp === "co2" ? "CO₂" : "O₂"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[0.68rem] leading-relaxed text-white/35">
          {type === "co2"
            ? el
              ? "Σταθερό hold, όλο και λιγότερη ανάπαυλα — ανοχή στο CO₂."
              : "Fixed hold, shrinking rest — CO₂ tolerance."
            : el
              ? "Σταθερή αναπνοή, όλο και μεγαλύτερο hold — προσαρμογή στο χαμηλό O₂."
              : "Fixed breathe-up, growing hold — low-O₂ adaptation."}
        </p>

        {/* 2. breathing mode pills */}
        <div className="mt-4 flex gap-2">
          {(["normal", "frc", "rv"] as BreathingMode[]).map((m) => {
            const active = mode === m;
            const danger = m === "rv";
            return (
              <button
                key={m}
                onClick={() => selectMode(m)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-bold transition-all"
                style={
                  active
                    ? danger
                      ? {
                          background: "rgba(239,159,39,0.18)",
                          color: ORANGE,
                          border: `1px solid ${ORANGE}66`,
                        }
                      : {
                          background: "rgba(29,158,117,0.2)",
                          color: TEAL_SOFT,
                          border: `1px solid ${TEAL}66`,
                        }
                    : {
                        background: "rgba(255,255,255,0.03)",
                        color: "rgba(255,255,255,0.4)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }
                }
              >
                {danger && <AlertTriangle className="size-3" />}
                {MODE_LABEL[m]}
              </button>
            );
          })}
        </div>
        {rvMode && (
          <p
            className="mt-2 flex items-start gap-1.5 text-[0.68rem] leading-relaxed"
            style={{ color: `${ORANGE}cc` }}
          >
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            {el
              ? "Το RV είναι μόνο custom — χωρίς υπολογισμένα presets."
              : "RV is custom-only — no calculated presets."}
          </p>
        )}

        {/* 3. presets (hidden for RV) */}
        {!rvMode && (
          <>
            {pb ? (
              <>
                <div className="mt-5 flex items-center justify-between">
                  <p className="text-[0.6rem] font-bold tracking-[0.25em] text-white/30">
                    {el ? "PRESETS ΑΠΟ ΤΟ PB ΣΟΥ" : "PRESETS FROM YOUR PB"} · {fmtClock(pb)}
                  </p>
                  {!pbFromDives && (
                    <button
                      onClick={() => setManualPb(null)}
                      className="text-[0.6rem] font-semibold text-white/30 underline"
                    >
                      {el ? "αλλαγή" : "change"}
                    </button>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  {PRESET_LEVELS.map((lv) => {
                    const active = !custom && level === lv;
                    return (
                      <button
                        key={lv}
                        onClick={() => {
                          setLevel(lv);
                          setCustom(false);
                        }}
                        className="flex-1 rounded-lg py-2.5 text-xs font-bold transition-all"
                        style={
                          active
                            ? {
                                background: "rgba(29,158,117,0.2)",
                                color: TEAL_SOFT,
                                border: `1px solid ${TEAL}66`,
                              }
                            : {
                                background: "rgba(255,255,255,0.03)",
                                color: "rgba(255,255,255,0.4)",
                                border: "1px solid rgba(255,255,255,0.08)",
                              }
                        }
                      >
                        {el ? LEVEL_LABEL[lv].el : LEVEL_LABEL[lv].en}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <PbPrompt
                el={el}
                onSet={(secs) => {
                  try {
                    localStorage.setItem(MANUAL_PB_KEY, String(secs));
                  } catch {
                    /* ignore */
                  }
                  setManualPb(secs);
                }}
              />
            )}
          </>
        )}

        {/* 4. custom toggle */}
        <button
          onClick={() => {
            const next = rvMode ? true : !custom;
            setCustom(next);
            // no PB yet → start editing from a sensible default table
            if (next && rounds.length === 0)
              setRounds(Array.from({ length: 6 }, () => ({ breatheSecs: 120, holdSecs: 60 })));
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all"
          style={
            custom
              ? {
                  background: "rgba(29,158,117,0.14)",
                  color: TEAL_SOFT,
                  border: `1px solid ${TEAL}55`,
                }
              : {
                  background: "rgba(255,255,255,0.03)",
                  color: "rgba(255,255,255,0.45)",
                  border: "1px dashed rgba(255,255,255,0.15)",
                }
          }
        >
          <Pencil className="size-3.5" />
          {custom
            ? el
              ? "Custom — επεξεργασία γύρων"
              : "Custom — editing rounds"
            : el
              ? "Custom"
              : "Custom"}
        </button>

        {/* 5. rounds */}
        {rounds.length > 0 && (
          <div className="mt-4">
            {custom ? (
              <RoundsEditor rounds={rounds} onChange={setRounds} el={el} />
            ) : (
              <TableCard rounds={rounds} lang={lang} />
            )}
            <p className="mt-2 text-center text-[0.65rem] text-white/30">
              {rounds.length} {el ? "γύροι" : "rounds"} · {el ? "σύνολο" : "total"}{" "}
              {fmtClock(tableTotalSecs(rounds))}
            </p>
          </div>
        )}

        {/* 6. save + start */}
        {rounds.length > 0 && (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={autoName}
              className="mt-4 w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:ring-1 focus:ring-[#1D9E75]"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !user}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <Save className="size-4" />
                {el ? "Στη βιβλιοθήκη" : "Save to library"}
              </button>
              <button
                onClick={() => startTable(rounds, mode)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold"
                style={{ background: TEAL, color: "#fff" }}
              >
                <Play className="size-4" />
                {el ? "Έναρξη" : "Start"}
              </button>
            </div>
          </>
        )}

        {/* 7. library */}
        {library.length > 0 && (
          <div className="mt-8">
            <p className="mb-3 text-[0.6rem] font-bold tracking-[0.25em] text-white/30">
              {el ? "Η ΒΙΒΛΙΟΘΗΚΗ ΣΟΥ" : "YOUR LIBRARY"}
            </p>
            <div className="space-y-2.5">
              {library.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
                  style={{
                    background: "#0d1320",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderLeft: `3px solid ${t.breathing_mode === "rv" ? ORANGE : TEAL}`,
                  }}
                >
                  <button onClick={() => loadSaved(t)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-bold text-white">{t.name}</span>
                    <span className="text-[0.65rem] text-white/30">
                      {t.type === "co2" ? "CO₂" : "O₂"} · {MODE_LABEL[t.breathing_mode]} ·{" "}
                      {t.rounds.length} {el ? "γύροι" : "rounds"} ·{" "}
                      {fmtClock(tableTotalSecs(t.rounds))}
                    </span>
                  </button>
                  <button
                    onClick={() => startTable(t.rounds, t.breathing_mode)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "rgba(29,158,117,0.15)", color: TEAL_SOFT }}
                  >
                    <Play className="size-4" />
                  </button>
                  <button
                    onClick={() => removeSaved(t)}
                    className="rounded-lg p-2 text-white/20 hover:text-red-400/70"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RV warning modal */}
      {rvWarn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setRvWarn(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5"
            style={{ background: "#0a0f1a", border: `1px solid ${ORANGE}55` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2" style={{ color: ORANGE }}>
              <AlertTriangle className="size-5" />
              <h2 className="text-base font-bold">{el ? "Προσοχή — RV" : "Warning — RV"}</h2>
            </div>
            <p className="text-sm leading-relaxed text-white/75">
              {el
                ? "Το RV training φτάνει σε residual volume. Απαιτεί εμπειρία και επίβλεψη. Μην το κάνεις μόνος σου."
                : "RV training reaches residual volume. It requires experience and supervision. Never do it alone."}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setRvWarn(null)}
                className="flex-1 rounded-xl py-3 text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }}
              >
                {el ? "Άκυρο" : "Cancel"}
              </button>
              <button
                onClick={() => {
                  setRunning({ rounds: rvWarn.rounds });
                  setRvWarn(null);
                }}
                className="flex-1 rounded-xl py-3 text-sm font-bold"
                style={{ background: ORANGE, color: "#3a2200" }}
              >
                {el ? "Κατάλαβα, συνέχεια" : "I understand, continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PB prompt (no STA PB on record) ──────────────────────────────────────────

function PbPrompt({ el, onSet }: { el: boolean; onSet: (secs: number) => void }) {
  const [secs, setSecs] = useState(120);
  const bump = (d: number) => setSecs((s) => Math.max(30, s + d));
  return (
    <div
      className="mt-5 rounded-2xl p-4"
      style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <p className="text-sm font-bold text-white">
        {el ? "Ποιο είναι το STA PB σου;" : "What’s your STA PB?"}
      </p>
      <p className="mt-1 text-[0.68rem] leading-relaxed text-white/35">
        {el
          ? "Τα presets υπολογίζονται από το PB σου. Δεν βρήκαμε καταγεγραμμένο STA — όρισέ το προσωρινά εδώ."
          : "Presets are calculated from your PB. No logged STA found — set it here for now."}
      </p>
      <div className="mt-3 flex items-center justify-center gap-2">
        <Stepper onClick={() => bump(-30)} label="−30″" />
        <Stepper onClick={() => bump(-5)} label="−5″" />
        <span className="w-24 text-center font-mono text-3xl font-light tabular-nums text-white">
          {fmtClock(secs)}
        </span>
        <Stepper onClick={() => bump(5)} label="+5″" />
        <Stepper onClick={() => bump(30)} label="+30″" />
      </div>
      <button
        onClick={() => onSet(secs)}
        className="mt-4 w-full rounded-xl py-3 text-sm font-bold"
        style={{ background: TEAL, color: "#fff" }}
      >
        {el ? "Δείξε μου τα presets" : "Show presets"}
      </button>
    </div>
  );
}

function Stepper({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl px-2.5 py-3 text-xs font-bold"
      style={{
        background: "rgba(255,255,255,0.05)",
        color: "rgba(255,255,255,0.6)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {label}
    </button>
  );
}

// ── rounds editor (+/- only, big wet-hands targets) ──────────────────────────

function RoundsEditor({
  rounds,
  onChange,
  el,
}: {
  rounds: TableRound[];
  onChange: (r: TableRound[]) => void;
  el: boolean;
}) {
  const patch = (i: number, p: Partial<TableRound>) =>
    onChange(rounds.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const remove = (i: number) => onChange(rounds.filter((_, j) => j !== i));
  const add = () => onChange([...rounds, rounds.at(-1) ?? { breatheSecs: 120, holdSecs: 60 }]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1.5rem_1fr_1fr_2rem] gap-2 px-1">
        <span />
        <span className="text-center text-[0.55rem] font-bold tracking-[0.15em] text-white/30">
          {el ? "ΑΝΑΠΝΟΗ" : "BREATHE"}
        </span>
        <span className="text-center text-[0.55rem] font-bold tracking-[0.15em] text-white/30">
          {el ? "ΚΡΑΤΗΣΗ" : "HOLD"}
        </span>
        <span />
      </div>
      {rounds.map((r, i) => (
        <div
          key={i}
          className="grid grid-cols-[1.5rem_1fr_1fr_2rem] items-center gap-2 rounded-xl p-2"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span className="text-center text-xs font-bold text-white/25">{i + 1}</span>
          <SecsStepper
            secs={r.breatheSecs}
            color={TEAL_SOFT}
            onChange={(secs) => patch(i, { breatheSecs: secs })}
          />
          <SecsStepper
            secs={r.holdSecs}
            color={ORANGE}
            onChange={(secs) => patch(i, { holdSecs: secs })}
          />
          <button
            onClick={() => remove(i)}
            disabled={rounds.length <= 1}
            className="flex h-11 items-center justify-center rounded-lg text-white/20 hover:text-red-400/70 disabled:opacity-20"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px dashed rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        <Plus className="size-3.5" /> {el ? "Προσθήκη γύρου" : "Add round"}
      </button>
    </div>
  );
}

function SecsStepper({
  secs,
  color,
  onChange,
}: {
  secs: number;
  color: string;
  onChange: (secs: number) => void;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-lg"
      style={{ background: `${color}12`, border: `1px solid ${color}30` }}
    >
      <button
        onClick={() => onChange(Math.max(5, secs - 5))}
        className="flex h-11 w-11 items-center justify-center"
        style={{ color }}
        aria-label="-5s"
      >
        <Minus className="size-4" />
      </button>
      <span className="font-mono text-sm font-bold tabular-nums" style={{ color }}>
        {fmtClock(secs)}
      </span>
      <button
        onClick={() => onChange(secs + 5)}
        className="flex h-11 w-11 items-center justify-center"
        style={{ color }}
        aria-label="+5s"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

// ── live runner ──────────────────────────────────────────────────────────────

type RunPhase = "breathe" | "hold";

function TableRunner({
  rounds,
  lang,
  onExit,
}: {
  rounds: TableRound[];
  lang: string;
  onExit: () => void;
}) {
  const el = lang === "el";
  const [fx] = useState(() => loadFxSettings());

  const [ri, setRi] = useState(0);
  const [phase, setPhase] = useState<RunPhase>("breathe");
  const [remaining, setRemaining] = useState(rounds[0]?.breatheSecs ?? 0);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);

  const riRef = useRef(0);
  const phaseRef = useRef<RunPhase>("breathe");
  const remainingRef = useRef(rounds[0]?.breatheSecs ?? 0);

  const fxCue = useCallback(
    (p: RunPhase | "done") => {
      if (fx.haptics) vibrate(p === "hold" ? [40, 60, 40] : p === "done" ? [200, 100, 200] : 60);
      if (fx.sound) beep(p === "hold" ? 880 : p === "done" ? 520 : 660);
    },
    [fx],
  );

  const advance = useCallback(() => {
    if (phaseRef.current === "breathe") {
      phaseRef.current = "hold";
      remainingRef.current = rounds[riRef.current]!.holdSecs;
      setPhase("hold");
      setRemaining(remainingRef.current);
      fxCue("hold");
      return;
    }
    const next = riRef.current + 1;
    if (next >= rounds.length) {
      setDone(true);
      fxCue("done");
      return;
    }
    riRef.current = next;
    phaseRef.current = "breathe";
    remainingRef.current = rounds[next]!.breatheSecs;
    setRi(next);
    setPhase("breathe");
    setRemaining(remainingRef.current);
    fxCue("breathe");
  }, [rounds, fxCue]);

  useEffect(() => {
    if (paused || done) return;
    const id = setInterval(() => {
      remainingRef.current -= 1;
      if (remainingRef.current <= 0) advance();
      else setRemaining(remainingRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [paused, done, advance]);

  const round = rounds[ri]!;
  const color = phase === "hold" ? ORANGE : TEAL_SOFT;
  const roundTotal = round.breatheSecs + round.holdSecs;
  const elapsedInRound =
    phase === "breathe"
      ? round.breatheSecs - remaining
      : round.breatheSecs + (round.holdSecs - remaining);
  const roundProgress = roundTotal > 0 ? elapsedInRound / roundTotal : 0;

  return (
    <div className="fixed inset-0 flex flex-col select-none" style={{ background: "#020a13" }}>
      {fx.scene && <UnderwaterScene />}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-700"
        style={{ background: `${color}10` }}
      />

      {/* top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4">
        <button
          onClick={onExit}
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
        >
          <X className="size-4" />
        </button>
        <span className="text-xs font-bold tracking-[0.2em] text-white/40">
          {el ? "ΓΥΡΟΣ" : "ROUND"} {ri + 1} / {rounds.length}
        </span>
        <div className="w-10" />
      </div>

      {done ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-6">
          <LogoBreathPacer size={150} color={TEAL_SOFT} duration={10} />
          <p className="text-lg font-bold text-white">
            {el ? "Ο πίνακας ολοκληρώθηκε 🎯" : "Table complete 🎯"}
          </p>
          <button
            onClick={onExit}
            className="rounded-xl px-8 py-3.5 text-sm font-bold"
            style={{ background: TEAL, color: "#fff" }}
          >
            {el ? "Τέλος" : "Done"}
          </button>
        </div>
      ) : (
        <>
          {/* center */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4">
            <LogoBreathPacer
              key={`${ri}-${phase}`}
              size={150}
              color={color}
              duration={phase === "breathe" ? 8 : 14}
              paused={paused}
            />
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold tracking-[0.3em]" style={{ color }}>
                {phase === "breathe" ? (el ? "ΑΝΑΠΝΟΗ" : "BREATHE") : el ? "ΚΡΑΤΑ" : "HOLD"}
              </span>
              <span
                className="font-mono text-[3.2rem] font-light leading-none tabular-nums"
                style={{ color }}
              >
                {fmtClock(Math.max(0, remaining))}
              </span>
              {paused && (
                <span
                  className="mt-1 text-[0.6rem] font-bold tracking-[0.3em]"
                  style={{ color: ORANGE }}
                >
                  {el ? "ΠΑΥΣΗ" : "PAUSED"}
                </span>
              )}
            </div>
          </div>

          {/* table */}
          <div className="relative z-10 max-h-[38vh] overflow-y-auto px-4">
            <TableCard
              rounds={rounds}
              activeRoundIndex={ri}
              activeProgress={roundProgress}
              activePhase={phase}
              lang={lang}
            />
          </div>

          {/* controls */}
          <div className="relative z-10 flex items-center justify-center gap-4 px-4 py-5">
            <button
              onClick={() => setPaused((p) => !p)}
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: phase === "hold" ? ORANGE : TEAL, color: "#03130d" }}
            >
              {paused ? <Play className="size-6" /> : <Pause className="size-6" />}
            </button>
            <button
              onClick={advance}
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }}
            >
              <SkipForward className="size-5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
