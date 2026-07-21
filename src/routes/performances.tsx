import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Trophy,
  Plus,
  X,
  Trash2,
  Globe,
  Lock,
  Loader2,
  BadgeCheck,
  Clock3,
  ShieldCheck,
  Camera,
  Check,
  Ban,
  CalendarPlus,
  Ruler,
  Weight,
  ArrowDownToLine,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Bubbles } from "@/components/Bubbles";
import { useAuth } from "@/hooks/use-auth";
import { useMode } from "@/hooks/use-mode";
import { useI18n } from "@/lib/i18n";
import { nativeVibrate } from "@/lib/native";
import {
  listCatches,
  personalBestsBySpecies,
  type SpeciesPersonalBest,
} from "@/lib/spearo-catches";
import { speciesLabel, formatCatchSize, formatCatchWeight, formatDepth } from "@/lib/spearo";
import {
  DISCIPLINES,
  FEDERATIONS,
  disciplineName,
  formatResult,
  isTimeDiscipline,
  type DisciplineCode,
  type Federation,
} from "@/lib/diving";
import {
  type Competition,
  type Performance,
  type PerformanceStatus,
  isAdminUser,
  fetchCompetitions,
  fetchMyPerformances,
  fetchLeaderboard,
  fetchPendingPerformances,
  createPerformance,
  deletePerformance,
  setPerformancePublic,
  reviewPerformance,
  uploadProof,
  createCompetition,
  deleteCompetition,
} from "@/lib/performances";
import { fetchProfile } from "@/lib/profile";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { Flag } from "@/components/Flag";

export const Route = createFileRoute("/performances")({
  head: () => ({ meta: [{ title: "Επιδόσεις & Verified — Apnos" }] }),
  component: () => (
    <AppLayout>
      <RecordsPage />
    </AppLayout>
  ),
});

// ── mode branch ──────────────────────────────────────────────────────────────
// In Spearo mode this route shows PRIVATE personal bests per species instead of
// the freediving verified-performances flow. There is deliberately no spearo
// leaderboard: catches carry secret spot data and there is no verification
// authority for recreational spearfishing, so records stay owner-only. The
// Apnos path (<PerformancesPage />) is untouched.
function RecordsPage() {
  const { mode } = useMode();
  return mode === "spearo" ? <SpearoRecordsPage /> : <PerformancesPage />;
}

// ── Spearo records (private PBs per species) ────────────────────────────────

// The deep-water gradient used as the photo stand-in on records without a
// photo — same palette as the underwater scene (.uw-depth), no new assets.
const UNDERWATER_GRADIENT =
  "linear-gradient(180deg, #0d4a63 0%, #0a3852 30%, #072a42 55%, #041a2e 80%, #02101d 100%)";

// Gold medal chip surface — warm metallic gradient with an inner highlight so
// the "PB" reads like a Best Efforts medal, not a flat tag.
const MEDAL_GOLD = "linear-gradient(135deg, #F7CE73 0%, #EF9F27 55%, #C97F16 100%)";

function SpearoRecordsPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const el = lang === "el";
  // The record catch currently open in the detail sheet (null = closed).
  const [detail, setDetail] = useState<SpeciesPersonalBest | null>(null);

  // Same query key + fn as the spearo dashboard (src/routes/spearo.tsx), so
  // React Query shares one cache entry — no separate data path or refetch.
  const { data: catches = [], isLoading } = useQuery({
    queryKey: ["spearo-catches", user?.id],
    queryFn: () => listCatches(user!.id),
    enabled: !!user,
  });

  const records = personalBestsBySpecies(catches);
  const speciesName = (r: SpeciesPersonalBest) =>
    r.isCustomSpecies ? r.species : speciesLabel(r.species, el ? "el" : "en");

  return (
    <div className="space-y-4">
      {/* header with a subtle underwater flourish behind it — low-opacity
          gradient + the existing Bubbles (already prefers-reduced-motion
          guarded in styles.css), zero new assets */}
      <div className="relative overflow-hidden rounded-2xl p-4">
        <div className="pointer-events-none absolute inset-0 opacity-35" aria-hidden="true">
          <div className="absolute inset-0" style={{ background: UNDERWATER_GRADIENT }} />
          <Bubbles />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <Trophy className="size-6" style={{ color: "#EF9F27" }} />
            <h1 className="text-2xl font-bold">{el ? "Τα ρεκόρ μου" : "My records"}</h1>
          </div>
          <p className="mt-1 text-xs text-foreground/45">
            {el
              ? "Η καλύτερη ψαριά σου ανά είδος — ιδιωτικά, μόνο για σένα."
              : "Your best catch per species — private, just for you."}
          </p>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : records.length === 0 ? (
        <Empty
          text={
            el
              ? "Ακόμα κανένα ρεκόρ — λόγκαρε την πρώτη σου ψαριά."
              : "No records yet — log your first catch."
          }
        />
      ) : (
        <div className="space-y-3">
          {records.map((r) => {
            // Weightless fallback records lead with size instead; when both
            // measurements exist the size rides along as secondary info.
            const primary =
              r.weight != null ? formatCatchWeight(r.weight) : formatCatchSize(r.size);
            const secondary = r.weight != null && r.size != null ? formatCatchSize(r.size) : null;
            return (
              <button
                key={r.species}
                type="button"
                onClick={() => {
                  nativeVibrate(10);
                  setDetail(r);
                }}
                className="pressable surface-2 relative block w-full overflow-hidden rounded-2xl text-left"
              >
                {/* trophy-wall backdrop: the record catch photo full-bleed, or
                    the deep underwater gradient when the catch has no photo */}
                {r.photoUrl ? (
                  <img
                    src={r.photoUrl}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0" style={{ background: UNDERWATER_GRADIENT }} />
                )}
                {/* dark gradient overlay keeps the text readable on any photo */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(2,10,19,0.3) 0%, rgba(2,10,19,0.15) 35%, rgba(2,10,19,0.55) 65%, rgba(2,10,19,0.88) 100%)",
                  }}
                />

                <div className="relative flex min-h-[10rem] flex-col justify-between p-4">
                  {/* gold PB medal chip */}
                  <span
                    className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[0.6rem] font-black tracking-[0.14em]"
                    style={{
                      background: MEDAL_GOLD,
                      color: "#3A2503",
                      boxShadow:
                        "inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 10px rgba(239,159,39,0.45)",
                    }}
                  >
                    <Trophy className="size-3" /> PB
                  </span>

                  <div>
                    <p className="text-sm font-semibold capitalize text-white/85">
                      {speciesName(r)}
                    </p>
                    {/* the record itself is the hero: big, heavy, tabular */}
                    <p
                      className="mt-0.5 text-4xl font-black tabular-nums text-white"
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        textShadow: "0 2px 12px rgba(2,10,19,0.6)",
                      }}
                    >
                      {primary}
                    </p>
                    <p className="mt-1 text-xs text-white/55">
                      {secondary && <span className="tabular-nums">{secondary} · </span>}
                      {new Date(r.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {detail && (
        <RecordDetailSheet
          record={detail}
          name={speciesName(detail)}
          el={el}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

// ── record detail sheet ──────────────────────────────────────────────────────
// Bottom sheet with the full record catch — same overlay pattern as
// DeclareModal below. Pure presentation over data already on the client; the
// private spot is deliberately NOT shown here (it stays on the catch card).
function RecordDetailSheet({
  record: r,
  name,
  el,
  onClose,
}: {
  record: SpeciesPersonalBest;
  name: string;
  el: boolean;
  onClose: () => void;
}) {
  const c = r.record;
  const chips: { icon: typeof Ruler; label: string; value: string }[] = [];
  if (c.weight_kg != null)
    chips.push({
      icon: Weight,
      label: el ? "Βάρος" : "Weight",
      value: formatCatchWeight(c.weight_kg),
    });
  if (c.size_cm != null)
    chips.push({ icon: Ruler, label: el ? "Μέγεθος" : "Size", value: formatCatchSize(c.size_cm) });
  if (c.max_depth_m != null)
    chips.push({
      icon: ArrowDownToLine,
      label: el ? "Βάθος" : "Depth",
      value: formatDepth(c.max_depth_m),
    });

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="surface-3 max-h-[92vh] overflow-y-auto rounded-t-3xl"
        style={{ background: "var(--popover)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* photo header — full-bleed with the same readability overlay */}
        <div className="relative h-56 w-full overflow-hidden">
          {r.photoUrl ? (
            <img
              src={r.photoUrl}
              alt={name}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0" style={{ background: UNDERWATER_GRADIENT }} />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(2,10,19,0.35) 0%, rgba(2,10,19,0.05) 40%, rgba(2,10,19,0.8) 100%)",
            }}
          />
          <span
            className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6rem] font-black tracking-[0.14em]"
            style={{
              background: MEDAL_GOLD,
              color: "#3A2503",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 10px rgba(239,159,39,0.45)",
            }}
          >
            <Trophy className="size-3" /> PB
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={el ? "Κλείσιμο" : "Close"}
            className="pressable absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-white"
            style={{ background: "rgba(4,26,46,0.6)", backdropFilter: "blur(2px)" }}
          >
            <X className="size-4" />
          </button>
          <div className="absolute bottom-3 left-4 right-4">
            <p className="text-lg font-bold capitalize text-white" style={{ lineHeight: 1.1 }}>
              {name}
            </p>
            <p className="mt-0.5 text-[0.65rem] text-white/55">
              {new Date(c.caught_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {chips.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {chips.map(({ icon: Icon, label, value }, i) => (
                <div
                  key={i}
                  className="surface-1 rounded-xl px-3 py-2.5 text-center"
                  style={{
                    background: "rgba(29,158,117,0.08)",
                    border: "1px solid rgba(93,202,165,0.18)",
                  }}
                >
                  <Icon className="mx-auto size-4" style={{ color: "#5DCAA5" }} />
                  <p className="mt-1 text-sm font-bold tabular-nums text-foreground">{value}</p>
                  <p className="text-[0.6rem] text-foreground/40">{label}</p>
                </div>
              ))}
            </div>
          )}

          {c.notes && <p className="text-xs leading-relaxed text-foreground/50">{c.notes}</p>}
        </div>
      </div>
    </div>
  );
}

type Tab = "leaderboard" | "mine" | "verify" | "events";

// Small athlete identity block: photo (or initials), flag, name.
function AthleteChip({
  name,
  countryCode,
  avatarUrl,
  seed,
}: {
  name: string;
  countryCode: string;
  avatarUrl: string | null | undefined;
  seed: string;
}) {
  const display = name || "—";
  const color = athleteColor(seed || display);
  return (
    <span className="flex min-w-0 items-center gap-2">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
      ) : (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold"
          style={{ background: `${color}22`, color }}
        >
          {athleteInitials(display)}
        </span>
      )}
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground/80">
        <Flag code={countryCode} />
        <span className="truncate">{display}</span>
      </span>
    </span>
  );
}

// ── value parse/format ───────────────────────────────────────────────────────

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

// ── status badge ─────────────────────────────────────────────────────────────

const STATUS_META: Record<
  PerformanceStatus,
  { el: string; en: string; color: string; icon: typeof BadgeCheck }
> = {
  verified: { el: "Επιβεβαιωμένη", en: "Verified", color: "#1D9E75", icon: BadgeCheck },
  pending: { el: "Σε αναμονή", en: "Pending", color: "#EF9F27", icon: Clock3 },
  self_reported: { el: "Δηλωμένη", en: "Self-reported", color: "#4FA8E0", icon: Globe },
  rejected: { el: "Απορρίφθηκε", en: "Rejected", color: "#EF6B5E", icon: Ban },
};

function StatusBadge({ status, lang }: { status: PerformanceStatus; lang: "el" | "en" }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.55rem] font-bold tracking-wider"
      style={{ background: `${m.color}1c`, color: m.color }}
    >
      <Icon className="size-3" />
      {lang === "el" ? m.el : m.en}
    </span>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

function PerformancesPage() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const admin = isAdminUser(user);
  const [tab, setTab] = useState<Tab>("leaderboard");

  const tabs: { id: Tab; el: string; en: string; show: boolean; adminTab?: boolean }[] = [
    { id: "leaderboard", el: "Κατάταξη", en: "Leaderboard", show: true },
    { id: "mine", el: "Οι επιδόσεις μου", en: "My results", show: true },
    { id: "verify", el: "Έλεγχος", en: "Verify", show: admin, adminTab: true },
    { id: "events", el: "Αγώνες", en: "Events", show: admin, adminTab: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="size-6" style={{ color: "#EF9F27" }} />
        <h1 className="text-2xl font-bold">{lang === "el" ? "Επιδόσεις" : "Performances"}</h1>
        {admin && (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.6rem] font-bold"
            style={{ background: "rgba(29,158,117,0.15)", color: "#1D9E75" }}
          >
            <ShieldCheck className="size-3.5" /> ADMIN
          </span>
        )}
      </div>

      {/* tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(var(--ink),0.04)" }}>
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold transition-colors"
              style={
                tab === t.id
                  ? {
                      background: "var(--card)",
                      color: t.adminTab ? "#1D9E75" : "var(--foreground)",
                    }
                  : { color: t.adminTab ? "rgba(29,158,117,0.55)" : "rgba(var(--ink),0.4)" }
              }
            >
              {t.adminTab && <ShieldCheck className="size-3.5" />}
              {lang === "el" ? t.el : t.en}
            </button>
          ))}
      </div>

      {tab === "leaderboard" && <LeaderboardTab lang={lang as "el" | "en"} />}
      {tab === "mine" && <MineTab lang={lang as "el" | "en"} />}
      {tab === "verify" && admin && <VerifyTab lang={lang as "el" | "en"} />}
      {tab === "events" && admin && <EventsTab lang={lang as "el" | "en"} />}
    </div>
  );
}

// ── Leaderboard tab ──────────────────────────────────────────────────────────

function LeaderboardTab({ lang }: { lang: "el" | "en" }) {
  const [discipline, setDiscipline] = useState<DisciplineCode>("STA");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["leaderboard", discipline],
    queryFn: () => fetchLeaderboard(discipline),
  });

  return (
    <div className="space-y-3">
      {/* how it works */}
      <div
        className="rounded-xl px-4 py-3 text-[0.7rem] leading-relaxed text-foreground/45"
        style={{ background: "rgba(79,168,224,0.07)", border: "1px solid rgba(79,168,224,0.18)" }}
      >
        {lang === "el" ? (
          <>
            <b className="text-foreground/70">Πώς λειτουργεί:</b> Δηλώνεις επίδοση στο «Οι επιδόσεις
            μου». Χωρίς αγώνα μπαίνει ως <b style={{ color: "#4FA8E0" }}>Δηλωμένη</b>. Με αγώνα +
            φωτό-απόδειξη πάει για έλεγχο και, αν εγκριθεί, γίνεται{" "}
            <b style={{ color: "#1D9E75" }}>Επιβεβαιωμένη ✓</b>. Εδώ βλέπεις την καλύτερη δημόσια
            επίδοση κάθε αθλητή.
          </>
        ) : (
          <>
            <b className="text-foreground/70">How it works:</b> Declare a result in "My results".
            Without a competition it's listed as <b style={{ color: "#4FA8E0" }}>Self-reported</b>.
            With a competition + proof photo it goes for review and, if approved, becomes{" "}
            <b style={{ color: "#1D9E75" }}>Verified ✓</b>. This tab shows each athlete's best
            public result.
          </>
        )}
      </div>

      <DisciplinePicker value={discipline} onChange={setDiscipline} />

      {isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Empty text={lang === "el" ? "Καμία δημόσια επίδοση ακόμα." : "No public results yet."} />
      ) : (
        <div className="space-y-2">
          {rows.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{
                background: "var(--card)",
                border: "1px solid rgba(var(--ink),0.05)",
                borderLeft: `3px solid ${i === 0 ? "#EF9F27" : "rgba(var(--ink),0.1)"}`,
              }}
            >
              <span
                className="w-6 shrink-0 text-center font-mono text-sm font-bold"
                style={{ color: i === 0 ? "#EF9F27" : "rgba(var(--ink),0.4)" }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <AthleteChip
                  name={p.athlete_name ?? ""}
                  countryCode={p.country_code ?? ""}
                  avatarUrl={p.avatar_url}
                  seed={p.user_id}
                />
                <div className="mt-1">
                  <StatusBadge status={p.status} lang={lang} />
                </div>
              </div>
              <p className="shrink-0 font-mono text-base font-bold text-foreground">
                {formatResult(p.discipline, p.value)}
              </p>
              {p.proof_photo_url && (
                <a
                  href={p.proof_photo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg p-1.5 text-foreground/30 hover:text-foreground/60"
                >
                  <Camera className="size-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mine tab ─────────────────────────────────────────────────────────────────

function MineTab({ lang }: { lang: "el" | "en" }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-performances", user?.id],
    queryFn: () => fetchMyPerformances(user!.id),
    enabled: !!user,
  });

  const del = useMutation({
    mutationFn: (id: string) => deletePerformance(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-performances", user?.id] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      toast.success(lang === "el" ? "Διαγράφηκε" : "Deleted");
    },
    onError: () => toast.error(lang === "el" ? "Σφάλμα" : "Error"),
  });

  const togglePublic = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      setPerformancePublic(id, isPublic),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-performances", user?.id] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: () => toast.error(lang === "el" ? "Σφάλμα" : "Error"),
  });

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowForm(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold"
        style={{ background: "#1D9E75", color: "#fff" }}
      >
        <Plus className="size-4" />
        {lang === "el" ? "Δήλωσε επίδοση" : "Declare a result"}
      </button>

      {isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Empty text={lang === "el" ? "Δεν έχεις δηλώσει επιδόσεις." : "No results declared yet."} />
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "var(--card)", border: "1px solid rgba(var(--ink),0.05)" }}
            >
              <span
                className="shrink-0 rounded-md px-2 py-0.5 text-[0.6rem] font-bold tracking-wider"
                style={{ background: "rgba(29,158,117,0.15)", color: "#5DCAA5" }}
              >
                {p.discipline}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-bold text-foreground">
                  {formatResult(p.discipline, p.value)}
                </p>
                <div className="mt-0.5">
                  <StatusBadge status={p.status} lang={lang} />
                </div>
              </div>
              <button
                onClick={() => togglePublic.mutate({ id: p.id, isPublic: !p.is_public })}
                title={p.is_public ? "public" : "private"}
                className="rounded-lg p-1.5"
                style={{ color: p.is_public ? "#4FA8E0" : "rgba(var(--ink),0.3)" }}
              >
                {p.is_public ? <Globe className="size-4" /> : <Lock className="size-4" />}
              </button>
              <button
                onClick={() => {
                  if (confirm(lang === "el" ? "Διαγραφή;" : "Delete?")) del.mutate(p.id);
                }}
                className="rounded-lg p-1.5 text-foreground/20 hover:text-red-400/70"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && <DeclareModal lang={lang} onClose={() => setShowForm(false)} />}
    </div>
  );
}

// ── Verify tab (admin) ───────────────────────────────────────────────────────

function VerifyTab({ lang }: { lang: "el" | "en" }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pending-performances"],
    queryFn: fetchPendingPerformances,
  });

  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "verified" | "rejected" }) =>
      reviewPerformance(id, decision),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["pending-performances"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      toast.success(
        v.decision === "verified"
          ? lang === "el"
            ? "Επιβεβαιώθηκε ✓"
            : "Verified ✓"
          : lang === "el"
            ? "Απορρίφθηκε"
            : "Rejected",
      );
    },
    onError: () => toast.error(lang === "el" ? "Σφάλμα" : "Error"),
  });

  if (isLoading) return <Spinner />;
  if (rows.length === 0)
    return <Empty text={lang === "el" ? "Καμία επίδοση σε αναμονή." : "Nothing pending."} />;

  return (
    <div className="space-y-2">
      {rows.map((p) => (
        <div
          key={p.id}
          className="rounded-xl p-4"
          style={{ background: "var(--card)", border: "1px solid rgba(239,159,39,0.25)" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="shrink-0 rounded-md px-2 py-0.5 text-[0.6rem] font-bold tracking-wider"
              style={{ background: "rgba(29,158,117,0.15)", color: "#5DCAA5" }}
            >
              {p.discipline}
            </span>
            <p className="font-mono text-base font-bold text-foreground">
              {formatResult(p.discipline, p.value)}
            </p>
            {p.proof_photo_url && (
              <a
                href={p.proof_photo_url}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.65rem] font-medium"
                style={{ background: "rgba(79,168,224,0.15)", color: "#4FA8E0" }}
              >
                <Camera className="size-3.5" /> {lang === "el" ? "Απόδειξη" : "Proof"}
              </a>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <AthleteChip
              name={p.athlete_name ?? ""}
              countryCode={p.country_code ?? ""}
              avatarUrl={p.avatar_url}
              seed={p.user_id}
            />
            <span className="ml-auto shrink-0 text-[0.6rem] text-foreground/30">
              {new Date(p.created_at).toLocaleDateString()}
            </span>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => review.mutate({ id: p.id, decision: "verified" })}
              disabled={review.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold"
              style={{ background: "rgba(29,158,117,0.15)", color: "#1D9E75" }}
            >
              <Check className="size-4" /> {lang === "el" ? "Επιβεβαίωση" : "Verify"}
            </button>
            <button
              onClick={() => review.mutate({ id: p.id, decision: "rejected" })}
              disabled={review.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold"
              style={{ background: "rgba(239,107,94,0.12)", color: "#EF6B5E" }}
            >
              <Ban className="size-4" /> {lang === "el" ? "Απόρριψη" : "Reject"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Events tab (admin: manage official competitions) ────────────────────────

function EventsTab({ lang }: { lang: "el" | "en" }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [countryCode, setCountryCode] = useState("GR");
  const [federation, setFederation] = useState<Federation>("AIDA");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: competitions = [], isLoading } = useQuery({
    queryKey: ["competitions"],
    queryFn: fetchCompetitions,
  });

  const add = async () => {
    if (!name.trim() || saving) {
      if (!name.trim()) toast.error(lang === "el" ? "Βάλε όνομα αγώνα" : "Enter an event name");
      return;
    }
    setSaving(true);
    try {
      await createCompetition({
        name: name.trim(),
        location: location.trim(),
        country_code: countryCode.trim().toUpperCase(),
        federation,
        date: date || null,
      });
      qc.invalidateQueries({ queryKey: ["competitions"] });
      setName("");
      setLocation("");
      setDate("");
      toast.success(lang === "el" ? "Ο αγώνας προστέθηκε" : "Event added");
    } catch (e) {
      console.error(e);
      toast.error(lang === "el" ? "Σφάλμα (είσαι admin;)" : "Failed (are you admin?)");
    } finally {
      setSaving(false);
    }
  };

  const del = useMutation({
    mutationFn: (id: string) => deleteCompetition(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitions"] });
      toast.success(lang === "el" ? "Διαγράφηκε" : "Deleted");
    },
    onError: () => toast.error(lang === "el" ? "Σφάλμα" : "Error"),
  });

  const labelCls = "mb-1.5 block text-[0.6rem] font-bold tracking-wider text-foreground/35";
  const inputCls =
    "w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-[#1D9E75]";

  return (
    <div className="space-y-4">
      {/* add form */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "var(--card)", border: "1px solid rgba(var(--ink),0.06)" }}
      >
        <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-foreground/70">
          <CalendarPlus className="size-4" style={{ color: "#1D9E75" }} />
          {lang === "el" ? "Νέος επίσημος αγώνας" : "New official event"}
        </p>

        <label className={labelCls}>{lang === "el" ? "ΟΝΟΜΑ" : "NAME"}</label>
        <input
          className={`${inputCls} mb-3`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={lang === "el" ? "Πανελλήνιο Πρωτάθλημα 2026" : "National Championship 2026"}
        />

        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <label className={labelCls}>{lang === "el" ? "ΤΟΠΟΘΕΣΙΑ" : "LOCATION"}</label>
            <input
              className={inputCls}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={lang === "el" ? "Αθήνα" : "Athens"}
            />
          </div>
          <div className="w-20 shrink-0">
            <label className={`${labelCls} flex items-center gap-1`}>
              <Flag code={countryCode} className="inline-block h-2.5 w-auto rounded-[2px]" />
              {lang === "el" ? "ΚΩΔ." : "CODE"}
            </label>
            <input
              className={`${inputCls} text-center uppercase`}
              value={countryCode}
              maxLength={2}
              onChange={(e) =>
                setCountryCode(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())
              }
              placeholder="GR"
            />
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          <div className="flex-1">
            <label className={labelCls}>{lang === "el" ? "ΗΜΕΡΟΜΗΝΙΑ" : "DATE"}</label>
            <input
              type="date"
              className={inputCls}
              style={{ colorScheme: "dark" }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="w-32 shrink-0">
            <label className={labelCls}>{lang === "el" ? "ΟΜΟΣΠΟΝΔΙΑ" : "FEDERATION"}</label>
            <div className="flex gap-1">
              {FEDERATIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFederation(f)}
                  className="flex-1 rounded-lg py-2.5 text-[0.65rem] font-bold"
                  style={
                    federation === f
                      ? {
                          background: "rgba(29,158,117,0.18)",
                          color: "#1D9E75",
                          border: "1px solid rgba(29,158,117,0.4)",
                        }
                      : {
                          background: "rgba(var(--ink),0.03)",
                          color: "rgba(var(--ink),0.4)",
                          border: "1px solid rgba(var(--ink),0.06)",
                        }
                  }
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={add}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold"
          style={{ background: "#1D9E75", color: "#fff" }}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {lang === "el" ? "Προσθήκη αγώνα" : "Add event"}
        </button>
      </div>

      {/* list */}
      {isLoading ? (
        <Spinner />
      ) : competitions.length === 0 ? (
        <Empty text={lang === "el" ? "Κανένας αγώνας ακόμα." : "No events yet."} />
      ) : (
        <div className="space-y-2">
          {competitions.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "var(--card)", border: "1px solid rgba(var(--ink),0.05)" }}
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Flag code={c.country_code} />
                  <span className="truncate">{c.name}</span>
                </p>
                <p className="mt-0.5 text-[0.65rem] text-foreground/40">
                  {[c.location, c.date, c.federation].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm(lang === "el" ? "Διαγραφή αγώνα;" : "Delete event?"))
                    del.mutate(c.id);
                }}
                className="rounded-lg p-1.5 text-foreground/20 hover:text-red-400/70"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Declare modal ────────────────────────────────────────────────────────────

function DeclareModal({ lang, onClose }: { lang: "el" | "en"; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [discipline, setDiscipline] = useState<DisciplineCode>("STA");
  const [value, setValue] = useState("");
  const [competitionId, setCompetitionId] = useState<string>("");
  const [isPublic, setIsPublic] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const time = isTimeDiscipline(discipline);
  const { data: competitions = [] } = useQuery({
    queryKey: ["competitions"],
    queryFn: fetchCompetitions,
  });
  // athlete identity (name / flag / photo) rides along on the row, since
  // profiles aren't queryable across users
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });

  const submit = async () => {
    if (!user || saving) return;
    const numeric = time ? parseMMSS(value) : parseInt(value.replace(/\D/g, ""), 10) || 0;
    if (numeric <= 0) {
      toast.error(lang === "el" ? "Βάλε έγκυρη επίδοση" : "Enter a valid result");
      return;
    }
    setSaving(true);
    try {
      let proofUrl: string | null = null;
      if (file) proofUrl = await uploadProof(user.id, file);
      await createPerformance(user.id, {
        discipline,
        value: numeric,
        competition_id: competitionId || null,
        proof_photo_url: proofUrl,
        is_public: isPublic,
        athlete_name: profile?.displayName ?? "",
        country_code: profile?.countryCode ?? "",
        avatar_url: profile?.avatarUrl || null,
      });
      qc.invalidateQueries({ queryKey: ["my-performances", user.id] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      toast.success(
        competitionId
          ? lang === "el"
            ? "Στάλθηκε για έλεγχο"
            : "Sent for review"
          : lang === "el"
            ? "Δηλώθηκε"
            : "Declared",
      );
      onClose();
    } catch (e) {
      console.error(e);
      toast.error(lang === "el" ? "Σφάλμα καταγραφής" : "Save failed");
    } finally {
      setSaving(false);
    }
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
            {lang === "el" ? "Δήλωση επίδοσης" : "Declare a result"}
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
              onClick={() => setDiscipline(d.code)}
              className="rounded-lg py-2 text-[0.65rem] font-bold transition-all"
              style={
                d.code === discipline
                  ? {
                      background: "rgba(29,158,117,0.18)",
                      color: "#1D9E75",
                      border: "1px solid rgba(29,158,117,0.4)",
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

        {/* value */}
        <label className={labelCls}>
          {time
            ? lang === "el"
              ? "ΕΠΙΔΟΣΗ (Λ:ΔΔ)"
              : "RESULT (M:SS)"
            : lang === "el"
              ? "ΕΠΙΔΟΣΗ (m)"
              : "RESULT (m)"}
        </label>
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(time ? /[^0-9:]/g : /[^0-9]/g, ""))}
          placeholder={time ? "5:30" : "75"}
          className={`${inputCls} mb-3 text-center text-lg font-bold`}
        />

        {/* competition (optional) */}
        <label className={labelCls}>
          {lang === "el" ? "ΑΓΩΝΑΣ (προαιρετικά)" : "COMPETITION (optional)"}
        </label>
        <select
          value={competitionId}
          onChange={(e) => setCompetitionId(e.target.value)}
          className="mb-1 w-full rounded-xl px-3 py-3 text-sm font-medium outline-none focus:ring-1 focus:ring-[#1D9E75]"
          style={{
            background: "var(--card)",
            color: "var(--foreground)",
            border: "1px solid rgba(var(--ink),0.15)",
          }}
        >
          <option value="" style={{ background: "var(--card)", color: "var(--foreground)" }}>
            {lang === "el"
              ? "— Χωρίς αγώνα (self-reported) —"
              : "— No competition (self-reported) —"}
          </option>
          {competitions.map((c: Competition) => (
            <option
              key={c.id}
              value={c.id}
              style={{ background: "var(--card)", color: "var(--foreground)" }}
            >
              {c.name}
              {c.date ? ` · ${c.date}` : ""} · {c.federation}
            </option>
          ))}
        </select>
        <p className="mb-3 text-[0.6rem] text-foreground/30">
          {competitionId
            ? lang === "el"
              ? "Θα σταλεί για έλεγχο από admin (ανέβασε απόδειξη)."
              : "Will be sent for admin review (attach proof)."
            : lang === "el"
              ? "Χωρίς αγώνα → μένει «δηλωμένη» (self-reported)."
              : "No competition → stays self-reported."}
        </p>

        {/* proof photo (only meaningful with a competition) */}
        {competitionId && (
          <>
            <label className={labelCls}>
              {lang === "el" ? "ΑΠΟΔΕΙΞΗ (φωτό)" : "PROOF (photo)"}
            </label>
            <label
              className="mb-3 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-3"
              style={{
                background: "rgba(var(--ink),0.03)",
                border: "1px dashed rgba(79,168,224,0.4)",
              }}
            >
              <Camera className="size-4" style={{ color: "#4FA8E0" }} />
              <span className="text-sm text-foreground/70">
                {file ? file.name : lang === "el" ? "Επίλεξε φωτογραφία…" : "Choose a photo…"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </>
        )}

        {/* public toggle */}
        <button
          onClick={() => setIsPublic((v) => !v)}
          className="mb-4 flex w-full items-center justify-between rounded-xl px-3 py-3"
          style={{ background: "rgba(var(--ink),0.03)", border: "1px solid rgba(var(--ink),0.06)" }}
        >
          <span className="flex items-center gap-2 text-sm text-foreground/80">
            {isPublic ? (
              <Globe className="size-4" style={{ color: "#4FA8E0" }} />
            ) : (
              <Lock className="size-4 text-foreground/40" />
            )}
            {isPublic
              ? lang === "el"
                ? "Δημόσια (στην κατάταξη)"
                : "Public (on leaderboard)"
              : lang === "el"
                ? "Ιδιωτική"
                : "Private"}
          </span>
        </button>

        <button
          onClick={submit}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold"
          style={{ background: "#1D9E75", color: "#fff" }}
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {lang === "el" ? "Αποθήκευση" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── shared bits ──────────────────────────────────────────────────────────────

function DisciplinePicker({
  value,
  onChange,
}: {
  value: DisciplineCode;
  onChange: (d: DisciplineCode) => void;
}) {
  const { lang } = useI18n();
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {DISCIPLINES.map((d) => (
        <button
          key={d.code}
          onClick={() => onChange(d.code)}
          title={disciplineName(d.code, lang === "el" ? "el" : "en")}
          className="rounded-lg py-2 text-[0.65rem] font-bold transition-all"
          style={
            d.code === value
              ? {
                  background: "rgba(239,159,39,0.18)",
                  color: "#EF9F27",
                  border: "1px solid rgba(239,159,39,0.4)",
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
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <Loader2 className="size-6 animate-spin text-foreground/30" />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div
      className="rounded-2xl py-10 text-center"
      style={{ background: "rgba(var(--ink),0.02)", border: "1px dashed rgba(var(--ink),0.07)" }}
    >
      <p className="text-sm text-foreground/30">{text}</p>
    </div>
  );
}
