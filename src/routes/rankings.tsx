import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trophy, Plus, X, Pencil, Trash2, Medal, Globe, Lock, Loader2, Award } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { fetchProfile } from "@/lib/profile";
import {
  type CompResult, type NewCompResult, type RankingEntry,
  MissingTableError, disciplineGroup,
  fetchMyResults, fetchRanking, createResult, updateResult, deleteResult,
} from "@/lib/competitions";
import {
  DISCIPLINES, DISCIPLINE_MAP, FEDERATIONS,
  disciplineName, formatResult, isTimeDiscipline,
  type DisciplineCode, type Federation,
} from "@/lib/diving";

export const Route = createFileRoute("/rankings")({
  head: () => ({ meta: [{ title: "Κατατάξεις — Apnos" }] }),
  component: () => (
    <AppLayout>
      <RankingsPage />
    </AppLayout>
  ),
});

type Tab = "ranking" | "mine";
type Group = "Pool" | "Depth";

const POOL_DISC:  DisciplineCode[] = ["STA", "DYN", "DYNB", "DNF"];
const DEPTH_DISC: DisciplineCode[] = ["CWT", "CWTB", "CNF", "FIM"];

// ── time/number parsing for the result field ────────────────────────────────

function parseMMSS(s: string): number {
  const t = s.trim();
  if (t.includes(":")) {
    const [m, sec = "0"] = t.split(":");
    return (parseInt(m || "0", 10) || 0) * 60 + (parseInt(sec, 10) || 0);
  }
  const d = t.replace(/\D/g, "");
  if (!d) return 0;
  const ss = parseInt(d.slice(-2), 10) || 0;
  const mm = parseInt(d.slice(0, -2) || "0", 10) || 0;
  return mm * 60 + ss;
}

// ── main ─────────────────────────────────────────────────────────────────────

function RankingsPage() {
  const { lang } = useI18n();
  const [tab, setTab] = useState<Tab>("ranking");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "rgba(239,159,39,0.14)", color: "#EF9F27" }}>
          <Trophy className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{lang === "el" ? "Κατατάξεις" : "Rankings"}</h1>
          <p className="text-xs text-white/35">{lang === "el" ? "Αγωνιστικές επιδόσεις · CMAS / AIDA" : "Competition results · CMAS / AIDA"}</p>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-2">
        <TabBtn active={tab === "ranking"} onClick={() => setTab("ranking")}>{lang === "el" ? "Κατάταξη" : "Leaderboard"}</TabBtn>
        <TabBtn active={tab === "mine"} onClick={() => setTab("mine")}>{lang === "el" ? "Οι επιδόσεις μου" : "My results"}</TabBtn>
      </div>

      {tab === "ranking" ? <RankingTab /> : <MyResultsTab />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-all"
      style={active
        ? { background: "#1D9E75", color: "#fff" }
        : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {children}
    </button>
  );
}

// ── setup / error states ─────────────────────────────────────────────────────

function SetupNotice({ lang }: { lang: string }) {
  return (
    <div className="rounded-2xl p-5 text-center" style={{ background: "rgba(239,159,39,0.06)", border: "1px dashed rgba(239,159,39,0.3)" }}>
      <Award className="mx-auto size-7" style={{ color: "#EF9F27" }} />
      <p className="mt-2 text-sm font-semibold text-white/70">{lang === "el" ? "Οι κατατάξεις δεν είναι ενεργές ακόμα" : "Rankings not enabled yet"}</p>
      <p className="mt-1 text-xs text-white/40">
        {lang === "el"
          ? "Χρειάζεται να εφαρμοστεί το migration competition_results στο Supabase."
          : "The competition_results migration needs to be applied in Supabase."}
      </p>
    </div>
  );
}

// ── ranking tab ──────────────────────────────────────────────────────────────

function RankingTab() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group>("Pool");
  const [discipline, setDiscipline] = useState<DisciplineCode>("STA");
  const [fed, setFed] = useState<Federation | "all">("all");

  const disciplines = group === "Pool" ? POOL_DISC : DEPTH_DISC;

  const { data, isLoading, error } = useQuery({
    queryKey: ["ranking", discipline, fed],
    queryFn: () => fetchRanking(discipline, fed),
  });

  const switchGroup = (g: Group) => {
    setGroup(g);
    setDiscipline(g === "Pool" ? "STA" : "CWT");
  };

  if (error instanceof MissingTableError) return <SetupNotice lang={lang} />;

  return (
    <div className="space-y-3">
      {/* pool / depth */}
      <div className="flex gap-2">
        <SegBtn active={group === "Pool"} onClick={() => switchGroup("Pool")}>{lang === "el" ? "Πισίνα" : "Pool"}</SegBtn>
        <SegBtn active={group === "Depth"} onClick={() => switchGroup("Depth")}>{lang === "el" ? "Θάλασσα" : "Depth"}</SegBtn>
      </div>

      {/* discipline chips */}
      <div className="flex flex-wrap gap-2">
        {disciplines.map((d) => (
          <button
            key={d}
            onClick={() => setDiscipline(d)}
            className="rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
            style={d === discipline
              ? { background: "rgba(29,158,117,0.2)", color: "#5DCAA5", border: "1px solid rgba(29,158,117,0.4)" }
              : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {d}
          </button>
        ))}
      </div>

      {/* federation */}
      <div className="flex gap-2">
        {(["all", "AIDA", "CMAS"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFed(f)}
            className="flex-1 rounded-lg py-2 text-xs font-bold transition-all"
            style={f === fed
              ? { background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }
              : { background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            {f === "all" ? (lang === "el" ? "Όλες" : "All") : f}
          </button>
        ))}
      </div>

      <p className="pt-1 text-center text-[0.65rem] font-semibold text-white/40">
        {disciplineName(discipline, lang)}
      </p>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-white/20" /></div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-2xl py-10 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.07)" }}>
          <p className="text-sm text-white/30">{lang === "el" ? "Καμία δημόσια επίδοση ακόμα" : "No public results yet"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((e, i) => (
            <RankingRow key={e.user_id} entry={e} rank={i + 1} discipline={discipline} isMe={e.user_id === user?.id} lang={lang} />
          ))}
        </div>
      )}
    </div>
  );
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-lg py-2 text-xs font-bold transition-all"
      style={active
        ? { background: "rgba(93,202,165,0.15)", color: "#5DCAA5", border: "1px solid rgba(93,202,165,0.35)" }
        : { background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      {children}
    </button>
  );
}

function RankingRow({ entry, rank, discipline, isMe, lang }: {
  entry: RankingEntry; rank: number; discipline: DisciplineCode; isMe: boolean; lang: string;
}) {
  const medal = rank === 1 ? "#EF9F27" : rank === 2 ? "#C0C6CF" : rank === 3 ? "#CD8544" : null;
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-3"
      style={{
        background: isMe ? "rgba(29,158,117,0.08)" : "#0d1320",
        border: `1px solid ${isMe ? "rgba(29,158,117,0.35)" : "rgba(255,255,255,0.05)"}`,
      }}
    >
      <div className="flex w-7 shrink-0 justify-center">
        {medal ? <Medal className="size-5" style={{ color: medal }} /> : <span className="text-sm font-bold text-white/30">{rank}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-white">
            {entry.athlete_name || (lang === "el" ? "Αθλητής" : "Athlete")}
          </span>
          {isMe && <span className="shrink-0 rounded px-1.5 py-0.5 text-[0.5rem] font-bold" style={{ background: "rgba(29,158,117,0.2)", color: "#5DCAA5" }}>{lang === "el" ? "ΕΣΥ" : "YOU"}</span>}
          {entry.is_national_record && <span className="shrink-0 rounded px-1.5 py-0.5 text-[0.5rem] font-bold" style={{ background: "rgba(239,159,39,0.18)", color: "#EF9F27" }}>NR</span>}
        </div>
        {(entry.competition_name || entry.location) && (
          <p className="mt-0.5 truncate text-[0.65rem] text-white/35">
            {[entry.competition_name, entry.location].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <span className="shrink-0 font-mono text-base font-bold tabular-nums" style={{ color: "#5DCAA5" }}>
        {formatResult(discipline, entry.best)}
      </span>
    </div>
  );
}

// ── my results tab ───────────────────────────────────────────────────────────

function MyResultsTab() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<CompResult | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: results = [], isLoading, error } = useQuery({
    queryKey: ["my_results", user?.id],
    queryFn: () => fetchMyResults(user!.id),
    enabled: !!user,
  });

  const delMutation = useMutation({
    mutationFn: deleteResult,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my_results", user?.id] }),
    onError: () => toast.error(lang === "el" ? "Σφάλμα διαγραφής" : "Delete failed"),
  });

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (r: CompResult) => { setEditing(r); setShowForm(true); };

  if (error instanceof MissingTableError) return <SetupNotice lang={lang} />;

  return (
    <div className="space-y-3">
      <button
        onClick={openNew}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold"
        style={{ background: "#1D9E75", color: "#fff" }}
      >
        <Plus className="size-4" />
        {lang === "el" ? "Νέα Επίδοση" : "New Result"}
      </button>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-white/20" /></div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl py-10 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.07)" }}>
          <p className="text-sm text-white/30">{lang === "el" ? "Δεν έχεις καταχωρίσει επιδόσεις" : "No results logged yet"}</p>
          <p className="mt-1 text-xs text-white/20">{lang === "el" ? "Πρόσθεσε τα αγωνιστικά σου αποτελέσματα" : "Add your competition results"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((r) => (
            <MyResultRow key={r.id} r={r} lang={lang} onEdit={() => openEdit(r)} onDelete={() => {
              if (confirm(lang === "el" ? "Διαγραφή επίδοσης;" : "Delete result?")) delMutation.mutate(r.id);
            }} />
          ))}
        </div>
      )}

      {showForm && (
        <ResultFormModal
          existing={editing}
          lang={lang}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["my_results", user?.id] }); qc.invalidateQueries({ queryKey: ["ranking"] }); }}
        />
      )}
    </div>
  );
}

function MyResultRow({ r, lang, onEdit, onDelete }: { r: CompResult; lang: string; onEdit: () => void; onDelete: () => void }) {
  const accent = disciplineGroup(r.discipline) === "Pool" ? "#1D9E75" : "#EF9F27";
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3" style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex flex-col items-center">
        <span className="rounded px-1.5 py-0.5 text-[0.55rem] font-bold" style={{ background: `${accent}18`, color: accent }}>{r.discipline}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold" style={{ color: "#5DCAA5" }}>{formatResult(r.discipline, r.result)}</span>
          <span className="text-[0.6rem] font-semibold text-white/40">{r.federation}</span>
          {r.is_national_record && <span className="rounded px-1 py-0.5 text-[0.5rem] font-bold" style={{ background: "rgba(239,159,39,0.18)", color: "#EF9F27" }}>NR</span>}
          {r.is_public
            ? <Globe className="size-3 text-white/25" />
            : <Lock className="size-3 text-white/25" />}
        </div>
        {(r.competition_name || r.location || r.competition_date) && (
          <p className="mt-0.5 truncate text-[0.65rem] text-white/35">
            {[r.competition_name, r.location, r.competition_date].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <button onClick={onEdit} className="rounded-lg p-2 text-white/25 hover:text-white/60"><Pencil className="size-3.5" /></button>
      <button onClick={onDelete} className="rounded-lg p-2 text-white/20 hover:text-red-400/70"><Trash2 className="size-3.5" /></button>
    </div>
  );
}

// ── result form modal ────────────────────────────────────────────────────────

function ResultFormModal({ existing, lang, onClose, onSaved }: {
  existing: CompResult | null; lang: string; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const [discipline, setDiscipline] = useState<DisciplineCode>(existing?.discipline ?? "STA");
  const [resultStr, setResultStr] = useState(existing ? formatValue(existing.discipline, existing.result) : "");
  const [federation, setFederation] = useState<Federation>(existing?.federation ?? "AIDA");
  const [compName, setCompName] = useState(existing?.competition_name ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [date, setDate] = useState(existing?.competition_date ?? "");
  const [isNR, setIsNR] = useState(existing?.is_national_record ?? false);
  const [isPublic, setIsPublic] = useState(existing?.is_public ?? true);
  const [saving, setSaving] = useState(false);

  const time = isTimeDiscipline(discipline);

  const save = async () => {
    if (!user || saving) return;
    const result = time ? parseMMSS(resultStr) : (parseInt(resultStr.replace(/\D/g, ""), 10) || 0);
    if (result <= 0) {
      toast.error(lang === "el" ? "Βάλε έγκυρη επίδοση" : "Enter a valid result");
      return;
    }
    setSaving(true);
    try {
      const profile = await fetchProfile();
      const payload: NewCompResult = {
        athlete_name: profile.displayName || (lang === "el" ? "Αθλητής" : "Athlete"),
        gender: profile.gender,
        discipline,
        federation,
        result,
        competition_name: compName.trim(),
        location: location.trim(),
        country: profile.country || "Greece",
        competition_date: date || null,
        is_national_record: isNR,
        is_public: isPublic,
      };
      if (existing) await updateResult(existing.id, payload);
      else await createResult(user.id, payload);
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error(lang === "el" ? "Σφάλμα αποθήκευσης" : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="max-h-[92vh] overflow-y-auto rounded-t-3xl p-5" style={{ background: "#0a0f1a" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">{existing ? (lang === "el" ? "Επεξεργασία" : "Edit result") : (lang === "el" ? "Νέα Επίδοση" : "New result")}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/40"><X className="size-5" /></button>
        </div>

        {/* discipline */}
        <label className="mb-1.5 block text-[0.6rem] font-bold tracking-wider text-white/35">{lang === "el" ? "ΠΕΙΘΑΡΧΙΑ" : "DISCIPLINE"}</label>
        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {DISCIPLINES.map((d) => (
            <button
              key={d.code}
              onClick={() => setDiscipline(d.code)}
              className="rounded-lg py-2 text-[0.65rem] font-bold transition-all"
              style={d.code === discipline
                ? { background: "rgba(29,158,117,0.2)", color: "#5DCAA5", border: "1px solid rgba(29,158,117,0.4)" }
                : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {d.code}
            </button>
          ))}
        </div>

        {/* result + federation */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[0.6rem] font-bold tracking-wider text-white/35">
              {time ? (lang === "el" ? "ΧΡΟΝΟΣ (Μ:ΔΔ)" : "TIME (M:SS)") : (lang === "el" ? "ΑΠΟΣΤΑΣΗ (m)" : "DISTANCE (m)")}
            </label>
            <input
              inputMode="numeric"
              value={resultStr}
              onChange={(e) => setResultStr(e.target.value.replace(time ? /[^0-9:]/g : /[^0-9]/g, ""))}
              placeholder={time ? "5:30" : "150"}
              className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-center text-lg font-bold text-white outline-none focus:ring-1 focus:ring-[#1D9E75]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[0.6rem] font-bold tracking-wider text-white/35">{lang === "el" ? "ΟΜΟΣΠΟΝΔΙΑ" : "FEDERATION"}</label>
            <div className="flex gap-1.5">
              {FEDERATIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFederation(f)}
                  className="flex-1 rounded-xl py-2.5 text-xs font-bold transition-all"
                  style={f === federation
                    ? { background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }
                    : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* competition + location */}
        <label className="mb-1.5 block text-[0.6rem] font-bold tracking-wider text-white/35">{lang === "el" ? "ΑΓΩΝΑΣ" : "COMPETITION"}</label>
        <input value={compName} onChange={(e) => setCompName(e.target.value)} placeholder={lang === "el" ? "π.χ. Πανελλήνιο Πρωτάθλημα" : "e.g. National Championship"} className="mb-3 w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-[#1D9E75]" />

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[0.6rem] font-bold tracking-wider text-white/35">{lang === "el" ? "ΤΟΠΟΘΕΣΙΑ" : "LOCATION"}</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={lang === "el" ? "Πόλη" : "City"} className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-[#1D9E75]" />
          </div>
          <div>
            <label className="mb-1.5 block text-[0.6rem] font-bold tracking-wider text-white/35">{lang === "el" ? "ΗΜΕΡΟΜΗΝΙΑ" : "DATE"}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white/70 outline-none focus:ring-1 focus:ring-[#1D9E75]" style={{ colorScheme: "dark" }} />
          </div>
        </div>

        {/* toggles */}
        <button onClick={() => setIsNR(!isNR)} className="mb-2 flex w-full items-center justify-between rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="flex items-center gap-2 text-sm text-white/70"><Award className="size-4" style={{ color: "#EF9F27" }} />{lang === "el" ? "Εθνικό ρεκόρ" : "National record"}</span>
          <Toggle on={isNR} />
        </button>
        <button onClick={() => setIsPublic(!isPublic)} className="mb-4 flex w-full items-center justify-between rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="flex items-center gap-2 text-sm text-white/70">
            {isPublic ? <Globe className="size-4 text-[#5DCAA5]" /> : <Lock className="size-4 text-white/40" />}
            {lang === "el" ? "Εμφάνιση στην κατάταξη" : "Show in rankings"}
          </span>
          <Toggle on={isPublic} />
        </button>

        <button onClick={save} disabled={saving} className="w-full rounded-xl py-3.5 text-sm font-bold" style={{ background: saving ? "rgba(29,158,117,0.4)" : "#1D9E75", color: "#fff" }}>
          {saving ? (lang === "el" ? "Αποθήκευση…" : "Saving…") : (lang === "el" ? "Αποθήκευση" : "Save")}
        </button>
      </div>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span className="relative inline-flex h-5 w-9 items-center rounded-full transition-all" style={{ background: on ? "#1D9E75" : "rgba(255,255,255,0.12)" }}>
      <span className="absolute h-4 w-4 rounded-full bg-white transition-all" style={{ left: on ? "18px" : "2px" }} />
    </span>
  );
}

function formatValue(discipline: DisciplineCode, result: number): string {
  if (DISCIPLINE_MAP[discipline]?.unit === "time") {
    const m = Math.floor(result / 60);
    const s = Math.round(result % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  return String(result);
}
