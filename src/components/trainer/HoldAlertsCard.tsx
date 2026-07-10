import { useState } from "react";
import { AlarmClock, Check, Plus } from "lucide-react";
import { fmtClock } from "@/lib/warmups";

// ── HoldAlertsCard ───────────────────────────────────────────────────────────
// Editor for the shared hold-alert marks (sound + buzz at e.g. 0:30, 1:00 into
// every hold). The marks live in localStorage via lib/warmups and fire in the
// warm-up player, the CO₂/O₂ table runner and the free static trainer alike.

const ORANGE = "#EF9F27";

// realistic marks for training-length holds (seconds)
const ALARM_QUICK = [30, 60, 90, 120];

export function HoldAlertsCard({
  alarms,
  onToggle,
  lang,
}: {
  alarms: number[];
  onToggle: (secs: number) => void;
  lang: string;
}) {
  const el = lang === "el";
  const [draft, setDraft] = useState("");

  const addCustom = () => {
    const secs = parseInt(draft.replace(/\D/g, ""), 10);
    if (!secs || secs <= 0) return;
    onToggle(secs);
    setDraft("");
  };

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <AlarmClock className="size-4" style={{ color: ORANGE }} />
        <span className="text-sm font-semibold text-white/80">
          {el ? "Ειδοποιήσεις σε κράτηση" : "Hold alerts"}
        </span>
      </div>
      <p className="mb-3 text-[0.7rem] leading-relaxed text-white/35">
        {el
          ? "Ήχος + δόνηση στις ώρες που ορίζεις μέσα σε κάθε κράτηση (π.χ. 0:30, 1:00) — ισχύουν σε ζέσταμα, πίνακες και ελεύθερη στατική."
          : "Sound + buzz at the times you set during each hold (e.g. 0:30, 1:00) — they apply to warm-ups, tables and free static alike."}
      </p>
      <div className="flex flex-wrap gap-2">
        {ALARM_QUICK.map((secs) => {
          const on = alarms.includes(secs);
          return (
            <button
              key={secs}
              onClick={() => onToggle(secs)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all"
              style={
                on
                  ? {
                      background: "rgba(239,159,39,0.18)",
                      color: ORANGE,
                      border: "1px solid rgba(239,159,39,0.4)",
                    }
                  : {
                      background: "rgba(255,255,255,0.03)",
                      color: "rgba(255,255,255,0.4)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }
              }
            >
              {on && <Check className="size-3" />}
              {fmtClock(secs)}
            </button>
          );
        })}
        {alarms
          .filter((a) => !ALARM_QUICK.includes(a))
          .map((secs) => (
            <button
              key={secs}
              onClick={() => onToggle(secs)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold"
              style={{
                background: "rgba(239,159,39,0.18)",
                color: ORANGE,
                border: "1px solid rgba(239,159,39,0.4)",
              }}
            >
              <Check className="size-3" /> {fmtClock(secs)}
            </button>
          ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") addCustom();
          }}
          placeholder={el ? "δευτ. π.χ. 75" : "secs e.g. 75"}
          className="w-32 rounded-lg bg-white/5 px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-[#EF9F27]"
        />
        <button
          onClick={addCustom}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold"
          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)" }}
        >
          <Plus className="size-3.5" /> {el ? "Προσθήκη" : "Add"}
        </button>
      </div>
    </div>
  );
}
