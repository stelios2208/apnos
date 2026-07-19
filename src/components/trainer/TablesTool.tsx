import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Check,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { fetchDives, personalBests, logStaHold } from "@/lib/dives";
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
  RV_SCAFFOLD_HOLD,
  LEVEL_PREMIUM,
  MODE_PREMIUM,
} from "@/lib/sta-tables";
import { fmtClock } from "@/lib/warmups";
import { STA_TABLE_GUIDE } from "@/lib/breathing-guides";
import { hasProAccess } from "@/lib/premium";
import { useI18n } from "@/lib/i18n";
import { useSessionFx, type SessionFx } from "@/hooks/use-session-fx";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { TableCard } from "@/components/TableCard";
import { UnderwaterScene } from "@/components/UnderwaterScene";
import { LogoBreathPacer } from "@/components/LogoBreathPacer";
import { GuidedBreathingCard } from "@/components/trainer/GuidedBreathingCard";
import { HoldAlertsCard } from "@/components/trainer/HoldAlertsCard";
import { FxChipsRow } from "@/components/trainer/FxControls";
import { ProBadge, ProLockOverlay } from "@/components/trainer/ProGate";

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

export function TablesTool({ onBack }: { onBack: () => void }) {
  const sfx = useSessionFx();
  const { lang, user } = sfx;
  const el = lang === "el";
  const { t } = useI18n();
  const pro = hasProAccess();

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
  // PRO gate (single source of truth in lib/premium.ts): the free tier gets
  // exactly the easy CO₂ and easy O₂ presets in normal breathing. A locked
  // selection still renders — as a blurred, unstartable teaser.
  const lockedSel = !custom && !rvMode && LEVEL_PREMIUM[level] && !pro;
  const proHint = () => toast.info(t("pro.unlockHint"));

  // keep the preview in sync with the selected preset
  useEffect(() => {
    if (!custom && !rvMode && pb) setRounds(presetRounds(type, level, pb, mode));
  }, [type, level, pb, mode, custom, rvMode]);

  const autoName = rvMode
    ? `${type.toUpperCase()} RV`
    : `${type.toUpperCase()} ${el ? LEVEL_LABEL[level].el : LEVEL_LABEL[level].en}`;

  const selectMode = (m: BreathingMode) => {
    if (MODE_PREMIUM[m] && !pro) {
      proHint();
      return;
    }
    setMode(m);
    if (m === "rv") {
      // RV is custom-only: never offer calculated presets at residual volume
      setCustom(true);
      if (rounds.length === 0) {
        const hold = RV_SCAFFOLD_HOLD[type];
        setRounds(Array.from({ length: 6 }, () => ({ breatheSecs: 120, holdSecs: hold })));
      }
    }
  };

  // Fire the first phase's FX inside the click (user gesture) so the audio
  // engine unlocks on iOS before the runner takes over.
  const beginRun = (r: TableRound[]) => {
    sfx.setEnginePhase("breathe");
    sfx.cue("breathe");
    sfx.buzz(60);
    setRunning({ rounds: r });
  };

  const startTable = (r: TableRound[], breathingMode: BreathingMode) => {
    if (r.length === 0) return;
    if (breathingMode === "rv") setRvWarn({ rounds: r });
    else beginRun(r);
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

  // Saved tables are custom programs — PRO content; loading one into the
  // editor would reveal its rounds, so it teases instead when locked.
  const loadSaved = (t: StaTable) => {
    if (!pro) {
      proHint();
      return;
    }
    setType(t.type);
    setMode(t.breathing_mode);
    setCustom(true);
    setRounds(t.rounds);
    setName(t.name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── RUNNER ────────────────────────────────────────────────────────────────
  if (running) {
    return (
      <TableRunner
        rounds={running.rounds}
        sfx={sfx}
        onExit={() => {
          sfx.stopAudio();
          setRunning(null);
        }}
      />
    );
  }

  // ── BUILDER ───────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen px-4 pb-24 pt-6" style={{ background: "#020a13" }}>
      <div className="relative z-10 mx-auto max-w-md">
        {/* header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {el ? "Πίνακες CO₂ / O₂" : "CO₂ / O₂ Tables"}
            </h1>
            <p className="text-xs text-white/35">
              {el ? "Tables από το PB σου ή δικά σου custom" : "Tables from your PB or your own"}
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
                {MODE_PREMIUM[m] && !pro && <ProBadge />}
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
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-all"
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
                        {LEVEL_PREMIUM[lv] && !pro && <ProBadge />}
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

        {/* 4. custom toggle — custom tables are PRO */}
        <button
          onClick={() => {
            if (!pro) {
              proHint();
              return;
            }
            const next = rvMode ? true : !custom;
            setCustom(next);
            // no PB yet → start editing from a sensible default table
            if (next && rounds.length === 0) {
              const hold = rvMode ? RV_SCAFFOLD_HOLD[type] : 60;
              setRounds(Array.from({ length: 6 }, () => ({ breatheSecs: 120, holdSecs: hold })));
            }
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
          {pro ? <Pencil className="size-3.5" /> : <Lock className="size-3.5" />}
          {custom ? (el ? "Custom — επεξεργασία γύρων" : "Custom — editing rounds") : "Custom"}
          {!pro && <ProBadge />}
        </button>

        {/* 5. rounds — a locked level renders as a blurred teaser, not a plan */}
        {rounds.length > 0 && (
          <div className="mt-4">
            {custom ? (
              <RoundsEditor rounds={rounds} onChange={setRounds} el={el} />
            ) : lockedSel ? (
              <div className="relative">
                <div className="pro-blur" aria-hidden="true">
                  <TableCard rounds={rounds} lang={lang} />
                </div>
                <ProLockOverlay />
              </div>
            ) : (
              <TableCard rounds={rounds} lang={lang} />
            )}
            <p className="mt-2 text-center text-[0.65rem] text-white/30">
              {rounds.length} {el ? "γύροι" : "rounds"} · {el ? "σύνολο" : "total"}{" "}
              {fmtClock(tableTotalSecs(rounds))}
            </p>
          </div>
        )}

        {/* 6. save + start (locked selections can do neither — teaser only) */}
        {rounds.length > 0 &&
          (lockedSel ? (
            <button
              onClick={proHint}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold"
              style={{
                background: "rgba(239,159,39,0.14)",
                color: "#EF9F27",
                border: "1px solid rgba(239,159,39,0.4)",
              }}
            >
              <Lock className="size-4" />
              {el ? "Έναρξη" : "Start"}
              <ProBadge />
            </button>
          ) : (
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
          ))}

        {/* 7. alerts + FX — same settings as warm-up & free static */}
        <div className="mt-6">
          <HoldAlertsCard alarms={sfx.alarms} onToggle={sfx.toggleAlarm} lang={lang} />
        </div>
        <div className="mt-4">
          <FxChipsRow sfx={sfx} />
        </div>

        {/* 8. library */}
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
                    <span className="flex items-center gap-2 text-sm font-bold text-white">
                      <span className="truncate">{t.name}</span>
                      {!pro && <ProBadge />}
                    </span>
                    <span className={`text-[0.65rem] text-white/30 ${pro ? "" : "pro-blur"}`}>
                      {t.type === "co2" ? "CO₂" : "O₂"} · {MODE_LABEL[t.breathing_mode]} ·{" "}
                      {t.rounds.length} {el ? "γύροι" : "rounds"} ·{" "}
                      {fmtClock(tableTotalSecs(t.rounds))}
                    </span>
                  </button>
                  <button
                    onClick={() => (pro ? startTable(t.rounds, t.breathing_mode) : proHint())}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "rgba(29,158,117,0.15)", color: TEAL_SOFT }}
                  >
                    {pro ? <Play className="size-4" /> : <Lock className="size-4" />}
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
                  const r = rvWarn.rounds;
                  setRvWarn(null);
                  beginRun(r);
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
  sfx,
  onExit,
}: {
  rounds: TableRound[];
  sfx: SessionFx;
  onExit: () => void;
}) {
  const {
    lang,
    user,
    buzz,
    chime,
    cue,
    setEnginePhase,
    stopEngine,
    stopAudio,
    holdTick,
    resetHoldAlerts,
  } = sfx;
  const el = lang === "el";
  const queryClient = useQueryClient();
  useWakeLock(true); // mounted only while a table is running → keep screen awake

  const [ri, setRi] = useState(0);
  const [phase, setPhase] = useState<RunPhase>("breathe");
  const [remaining, setRemaining] = useState(rounds[0]?.breatheSecs ?? 0);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const riRef = useRef(0);
  const phaseRef = useRef<RunPhase>("breathe");
  const remainingRef = useRef(rounds[0]?.breatheSecs ?? 0);

  // guided FX per phase — voice + soundscape + chime + haptics, all shared
  const fxCue = useCallback(
    (p: RunPhase | "done") => {
      if (p === "done") {
        buzz([200, 100, 200]);
        chime(520);
        cue("recovery");
        stopEngine();
        return;
      }
      if (p === "hold") {
        buzz([40, 60, 40]);
        chime(880);
        cue("hold");
        setEnginePhase("hold");
        resetHoldAlerts();
      } else {
        buzz(60);
        chime(660);
        cue("breathe");
        setEnginePhase("breathe");
      }
    },
    [buzz, chime, cue, setEnginePhase, stopEngine, resetHoldAlerts],
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
      // alerts + voice milestones during the hold (absolute hold time)
      if (phaseRef.current === "hold") {
        const total = rounds[riRef.current]!.holdSecs;
        holdTick(total - remainingRef.current, total);
      }
      if (remainingRef.current <= 0) advance();
      else setRemaining(remainingRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [paused, done, advance, holdTick, rounds]);

  const togglePause = () => {
    setPaused((prev) => {
      const nextPaused = !prev;
      if (nextPaused) stopEngine();
      else setEnginePhase(phaseRef.current);
      return nextPaused;
    });
  };

  const handleLogDive = useCallback(async () => {
    if (!user || saving) return;
    setSaving(true);
    const holds = rounds.map((r) => r.holdSecs);
    const best = Math.max(...holds);
    const avg = Math.round(holds.reduce((a, b) => a + b, 0) / holds.length);
    // Same notes shape FreeTrainer writes, so the dive page renders every round
    // in its structured "session breakdown" (not just the best hold). Tables have
    // no recovery/contractions, so those are logged as zero.
    const notes = [
      `STA Table — ${rounds.length} rounds`,
      `Best: ${fmtClock(best)} | Avg: ${fmtClock(avg)}`,
      `Rounds: ${JSON.stringify(
        rounds.map((r) => ({
          breathe: fmtClock(r.breatheSecs),
          hold: fmtClock(r.holdSecs),
          recovery: "0:00",
          contractions: 0,
        })),
      )}`,
    ].join("\n");
    try {
      await logStaHold(user.id, best, notes);
      queryClient.invalidateQueries({ queryKey: ["dives", user.id] });
      setSaved(true);
      toast.success(el ? "Καταγράφηκε ως βουτιά STA" : "Logged as an STA dive");
    } catch (e) {
      console.error(e);
      toast.error(el ? "Σφάλμα καταγραφής" : "Log failed");
    } finally {
      setSaving(false);
    }
  }, [user, saving, rounds, queryClient, el]);

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
      {sfx.fx.scene && <UnderwaterScene />}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-700"
        style={{ background: `${color}10` }}
      />

      {/* top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4">
        <button
          onClick={() => {
            stopAudio();
            onExit();
          }}
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
          <p className="text-sm text-white/40">
            {el ? "Καλύτερο hold" : "Best hold"}{" "}
            {fmtClock(Math.max(...rounds.map((r) => r.holdSecs)))}
          </p>
          <div className="flex w-full max-w-xs flex-col gap-3">
            {user && (
              <button
                onClick={handleLogDive}
                disabled={saving || saved}
                className="flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all"
                style={{
                  background: saved ? "rgba(29,158,117,0.15)" : "rgba(255,255,255,0.06)",
                  color: saved ? TEAL_SOFT : "rgba(255,255,255,0.75)",
                  border: `1px solid ${saved ? "rgba(29,158,117,0.4)" : "rgba(255,255,255,0.1)"}`,
                }}
              >
                {saved ? <Check className="size-4" /> : null}
                {saved
                  ? el
                    ? "Καταγράφηκε ✓"
                    : "Logged ✓"
                  : saving
                    ? el
                      ? "Καταγραφή…"
                      : "Logging…"
                    : el
                      ? "Καταγραφή ως βουτιά STA"
                      : "Log as STA dive"}
              </button>
            )}
            <button
              onClick={onExit}
              className="rounded-xl px-8 py-3.5 text-sm font-bold"
              style={{ background: TEAL, color: "#fff" }}
            >
              {el ? "Τέλος" : "Done"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* center — scrollable (m-auto centring) so the guided card never
              clips the countdown or safety text on short viewports */}
          <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="m-auto flex w-full flex-col items-center gap-3 py-3">
              <LogoBreathPacer
                key={`${ri}-${phase}`}
                size={120}
                color={color}
                duration={phase === "breathe" ? 8 : 14}
                paused={paused}
              />
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold tracking-[0.3em]" style={{ color }}>
                  {phase === "breathe" ? (el ? "ΑΝΑΠΝΟΗ" : "BREATHE") : el ? "ΚΡΑΤΑ" : "HOLD"}
                </span>
                <span
                  className="font-mono text-[2.6rem] font-light leading-none tabular-nums"
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

              {/* guided breathing card — same phase/remaining state as the
                  countdown, no second timer */}
              <GuidedBreathingCard
                guide={STA_TABLE_GUIDE}
                stepIndex={ri * 2 + (phase === "hold" ? 1 : 0)}
                activeIndex={phase === "hold" ? 1 : 0}
                stepKind={phase}
                stepSecs={phase === "hold" ? round.holdSecs : round.breatheSecs}
                remaining={remaining}
                paused={paused}
              />
            </div>
          </div>

          {/* table — trimmed so the guided card keeps room on short screens */}
          <div className="relative z-10 max-h-[24vh] overflow-y-auto px-4">
            <TableCard
              rounds={rounds}
              activeRoundIndex={ri}
              activeProgress={roundProgress}
              activePhase={phase}
              lang={lang}
            />
          </div>

          {/* controls — safe-area padding for home-bar devices */}
          <div className="relative z-10 flex items-center justify-center gap-4 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <button
              onClick={togglePause}
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
