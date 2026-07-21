import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Lock,
  Pencil,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { deleteDive, fetchDives, setDiveShared } from "@/lib/dives";
import { disciplineName, formatResult } from "@/lib/diving";
import { fetchProfile } from "@/lib/profile";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { ShareCardModal } from "@/components/ShareCard";

export const Route = createFileRoute("/dive/$id")({
  head: () => ({ meta: [{ title: "Dive — Apnos" }] }),
  component: () => (
    <AppLayout>
      <DiveDetail />
    </AppLayout>
  ),
});

// ── helpers ────────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-foreground/5 last:border-0">
      <span className="text-xs text-foreground/40">{label}</span>
      <span className="text-xs font-medium text-foreground/80 text-right">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-1">
      <p className="text-[0.65rem] font-bold tracking-[0.2em] text-foreground/30 mb-2">{title}</p>
      {children}
    </div>
  );
}

// ── STASessionNotes ────────────────────────────────────────────────────────────

interface STARound {
  breathe: string;
  hold: string;
  recovery: string;
  contractions: number;
}

function fmtSecs(mmss: string): string {
  // already formatted as MM:SS, strip leading zero from minutes
  const [m, s] = mmss.split(":");
  return `${parseInt(m, 10)}:${s ?? "00"}`;
}

function parseHMS(mmss: string): number {
  const [m, s] = mmss.split(":").map(Number);
  return (m ?? 0) * 60 + (s ?? 0);
}

function STASessionNotes({ notes, lang }: { notes: string; lang: string }) {
  // extract JSON array after "Rounds:"
  const match = notes.match(/Rounds:\s*(\[[\s\S]*?\])/);
  if (!match) {
    return (
      <Section title={lang === "el" ? "ΣΗΜΕΙΩΣΕΙΣ" : "NOTES"}>
        <p className="text-sm text-foreground/60 leading-relaxed whitespace-pre-line">{notes}</p>
      </Section>
    );
  }

  let rounds: STARound[] = [];
  try {
    rounds = JSON.parse(match[1]);
  } catch {
    /* ignore */
  }

  if (rounds.length === 0) {
    return (
      <Section title={lang === "el" ? "ΣΗΜΕΙΩΣΕΙΣ" : "NOTES"}>
        <p className="text-sm text-foreground/60 leading-relaxed whitespace-pre-line">{notes}</p>
      </Section>
    );
  }

  const holds = rounds.map((r) => parseHMS(r.hold));
  const best = Math.max(...holds);
  const avg = Math.round(holds.reduce((a, b) => a + b, 0) / holds.length);
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <p className="text-[0.65rem] font-bold tracking-[0.2em] text-foreground/30">
        {lang === "el" ? "ΑΝΑΛΥΣΗ SESSION" : "SESSION BREAKDOWN"}
      </p>

      {/* stat strip */}
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: lang === "el" ? "Καλύτερο Hold" : "Best Hold",
            value: fmtTime(best),
            color: "#EF9F27",
          },
          {
            label: lang === "el" ? "Μέσος Όρος" : "Average",
            value: fmtTime(avg),
            color: "#5DCAA5",
          },
          {
            label: lang === "el" ? "Γύροι" : "Rounds",
            value: String(rounds.length),
            color: "#9FE1CB",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1 rounded-xl py-2.5"
            style={{
              background: "rgba(var(--ink),0.03)",
              border: "1px solid rgba(var(--ink),0.05)",
            }}
          >
            <span className="font-mono text-sm font-bold tabular-nums" style={{ color }}>
              {value}
            </span>
            <span className="text-center text-[0.5rem] font-medium tracking-wider text-foreground/25">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* table header */}
      <div>
        <div
          className="grid gap-1 rounded-t-lg px-3 py-2"
          style={{
            gridTemplateColumns: "1.5rem 1fr 1fr 1fr 1.5rem",
            background: "rgba(var(--ink),0.03)",
          }}
        >
          {[
            "#",
            lang === "el" ? "Αναπνοή" : "Breathe",
            "Hold",
            lang === "el" ? "Ανάκαμψη" : "Recovery",
            lang === "el" ? "Σ" : "C",
          ].map((h, i) => (
            <span
              key={i}
              className="text-center text-[0.55rem] font-bold tracking-wider text-foreground/25"
            >
              {h}
            </span>
          ))}
        </div>

        {rounds.map((r, i) => {
          const isBest = parseHMS(r.hold) === best;
          return (
            <div
              key={i}
              className="grid items-center gap-1 border-t px-3 py-2.5"
              style={{
                gridTemplateColumns: "1.5rem 1fr 1fr 1fr 1.5rem",
                borderColor: "rgba(var(--ink),0.04)",
                background: isBest ? "rgba(239,159,39,0.04)" : "transparent",
              }}
            >
              <span className="text-center text-xs font-bold text-foreground/20">{i + 1}</span>
              <span className="text-center font-mono text-xs" style={{ color: "#5DCAA5" }}>
                {fmtSecs(r.breathe)}
              </span>
              <div className="flex flex-col items-center">
                <span
                  className="font-mono text-xs font-bold"
                  style={{ color: isBest ? "#EF9F27" : "#1D9E75" }}
                >
                  {fmtSecs(r.hold)}
                </span>
                {isBest && (
                  <span
                    className="text-[0.45rem] font-bold tracking-widest"
                    style={{ color: "#EF9F2770" }}
                  >
                    BEST
                  </span>
                )}
              </div>
              <span className="text-center font-mono text-xs" style={{ color: "#9FE1CB" }}>
                {fmtSecs(r.recovery)}
              </span>
              <span className="text-center text-xs text-foreground/30">
                {r.contractions > 0 ? r.contractions : "—"}
              </span>
            </div>
          );
        })}

        {/* totals */}
        <div
          className="grid items-center gap-1 rounded-b-lg border-t px-3 py-2.5"
          style={{
            gridTemplateColumns: "1.5rem 1fr 1fr 1fr 1.5rem",
            borderColor: "rgba(29,158,117,0.2)",
            background: "rgba(29,158,117,0.05)",
          }}
        >
          <span className="text-center text-[0.55rem] font-bold tracking-wider text-foreground/25">
            {lang === "el" ? "ΣΥΝ" : "TOT"}
          </span>
          <span />
          <span className="text-center font-mono text-xs font-bold" style={{ color: "#1D9E75" }}>
            {fmtTime(holds.reduce((a, b) => a + b, 0))}
          </span>
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

// ── component ──────────────────────────────────────────────────────────────────

function DiveDetail() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = Route.useParams();

  const { data: dives = [], isLoading } = useQuery({
    queryKey: ["dives", user?.id],
    queryFn: () => fetchDives(user!.id),
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: fetchProfile,
    enabled: !!user,
  });

  const [showShare, setShowShare] = useState(false);

  const dive = dives.find((d) => d.id === id);
  // prev/next in chronological order (dives array is newest-first from fetchDives)
  const idx = dives.findIndex((d) => d.id === id);
  const prevId = idx < dives.length - 1 ? dives[idx + 1].id : null;
  const nextId = idx > 0 ? dives[idx - 1].id : null;

  const remove = useMutation({
    mutationFn: () => deleteDive(id, user!.id, dive!.discipline),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dives", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["feed-dives"] });
      toast.success(lang === "el" ? "Η βουτιά διαγράφηκε" : "Dive deleted");
      navigate({ to: "/history" });
    },
    onError: () => toast.error(lang === "el" ? "Σφάλμα διαγραφής" : "Could not delete"),
  });

  // Community opt-in toggle — flips ONLY shared_to_feed on this dive (RLS
  // enforces ownership). The feed reads the sanitized feed_dives view, so a
  // shared dive exposes result data only, never notes/wellness/gear.
  const shareToFeed = useMutation({
    mutationFn: (shared: boolean) => setDiveShared(id, shared),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dives", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["feed-dives"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : lang === "el" ? "Σφάλμα" : "Error"),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!dive) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {lang === "el" ? "Η βουτιά δεν βρέθηκε." : "Dive not found."}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/history">
            <ArrowLeft className="size-4 mr-1" />
            {t("common.back")}
          </Link>
        </Button>
      </div>
    );
  }

  const border = dive.is_personal_best ? "#EF9F27" : "#1D9E75";
  const dateStr = format(new Date(`${dive.dive_date}T${dive.dive_time ?? "00:00"}`), "d MMM yyyy");

  const hasGear =
    dive.neck_weight != null ||
    dive.belt_weight != null ||
    dive.wetsuit_mm != null ||
    dive.fins_brand ||
    dive.fins_model ||
    dive.foot_pocket ||
    dive.water_temp != null ||
    dive.buoyancy;

  const wetsuitLabel = dive.wetsuit_mm
    ? `${dive.wetsuit_mm} mm`
    : lang === "el"
      ? "Χωρίς στολή"
      : "No wetsuit";

  const buoyancyLabel: Record<string, string> =
    lang === "el"
      ? { negative: "Αρνητική", neutral: "Ουδέτερη", positive: "Θετική" }
      : { negative: "Negative", neutral: "Neutral", positive: "Positive" };

  const c = dive.conditions ?? null;
  const hasSta =
    !!c &&
    (!!c.posture ||
      !!c.environment ||
      !!c.faceCover ||
      !!c.noseclip ||
      !!c.face ||
      c.roomTemp != null ||
      c.breatheInSec != null ||
      c.breatheOutSec != null);
  const postureLabel: Record<string, string> =
    lang === "el"
      ? { supine: "Ανάσκελα", seated: "Καθιστή", float: "Επίπλευση", prone: "Μπρούμυτα" }
      : { supine: "Supine", seated: "Seated", float: "Float", prone: "Face down" };
  const envLabel: Record<string, string> =
    lang === "el" ? { dry: "Ξηρή", wet: "Υγρή" } : { dry: "Dry", wet: "Wet" };
  const faceCoverLabel: Record<string, string> =
    lang === "el" ? { mask: "Μάσκα", goggles: "Γυαλάκια" } : { mask: "Mask", goggles: "Goggles" };
  // legacy single-select data
  const faceLabel: Record<string, string> =
    lang === "el"
      ? { noseclip: "Κλιπ μύτης", mask: "Μάσκα", goggles: "Γυαλάκια" }
      : { noseclip: "Noseclip", mask: "Mask", goggles: "Goggles" };

  return (
    <div className="space-y-5">
      {/* back + prev/next */}
      <div className="flex items-center justify-between">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5 text-foreground/50 hover:text-foreground"
        >
          <Link to="/history">
            <ArrowLeft className="size-4" />
            {t("common.back")}
          </Link>
        </Button>
        <div className="flex items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="size-8 p-0 text-foreground/40 hover:text-foreground disabled:opacity-20"
            disabled={!prevId}
          >
            {prevId ? (
              <Link to="/dive/$id" params={{ id: prevId }}>
                <ChevronLeft className="size-4" />
              </Link>
            ) : (
              <span>
                <ChevronLeft className="size-4" />
              </span>
            )}
          </Button>
          <span className="text-[0.6rem] text-foreground/20">
            {idx + 1} / {dives.length}
          </span>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="size-8 p-0 text-foreground/40 hover:text-foreground disabled:opacity-20"
            disabled={!nextId}
          >
            {nextId ? (
              <Link to="/dive/$id" params={{ id: nextId }}>
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span>
                <ChevronRight className="size-4" />
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* header card */}
      <div
        className="glass-card rounded-2xl p-5 space-y-3"
        style={{ borderLeft: `3px solid ${border}` }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-md px-2.5 py-1 text-xs font-bold tracking-wider"
            style={{ background: "rgba(29,158,117,0.15)", color: "#5DCAA5" }}
          >
            {dive.discipline}
          </span>
          <span className="text-xs text-foreground/40">
            {disciplineName(dive.discipline, lang)}
          </span>
          {dive.is_personal_best && (
            <span
              className="rounded-md px-2 py-0.5 text-[0.6rem] font-bold"
              style={{ background: "rgba(239,159,39,0.15)", color: "#EF9F27" }}
            >
              🏆 PB
            </span>
          )}
          {dive.federation && (
            <span
              className="rounded-md px-2 py-0.5 text-[0.6rem] font-semibold"
              style={{ background: "rgba(var(--ink),0.06)", color: "rgba(var(--ink),0.45)" }}
            >
              {dive.federation}
            </span>
          )}
          <span className="ml-auto text-xs text-foreground/30">
            {dateStr}
            {dive.dive_time ? ` · ${dive.dive_time}` : ""}
          </span>
        </div>

        {/* big result */}
        <p
          className="font-bold tabular-nums text-foreground"
          style={{ fontFamily: "'Outfit', sans-serif", fontSize: "3.5rem", lineHeight: 1 }}
        >
          {formatResult(dive.discipline, dive.result)}
        </p>

        <p className="text-xs text-foreground/30 capitalize">
          {dive.session_type === "competition"
            ? lang === "el"
              ? "Αγώνας"
              : "Competition"
            : lang === "el"
              ? "Προπόνηση"
              : "Training"}
        </p>
      </div>

      {/* condition */}
      {(dive.sleep_hours != null || dive.mental_state != null || dive.food_notes) && (
        <Section title={lang === "el" ? "ΚΑΤΑΣΤΑΣΗ" : "CONDITION"}>
          {dive.sleep_hours != null && (
            <Row label={t("log.sleep")} value={`${dive.sleep_hours}h`} />
          )}
          {dive.mental_state != null && (
            <Row label={t("log.mental")} value={`${dive.mental_state} / 5`} />
          )}
          {dive.food_notes && <Row label={t("log.food")} value={dive.food_notes} />}
        </Section>
      )}

      {/* equipment */}
      {hasGear && (
        <Section title={lang === "el" ? "ΕΞΟΠΛΙΣΜΟΣ & ΣΥΝΘΗΚΕΣ" : "EQUIPMENT & CONDITIONS"}>
          {dive.neck_weight != null && (
            <Row label={t("log.neckWeight")} value={`${dive.neck_weight} kg`} />
          )}
          {dive.belt_weight != null && (
            <Row label={t("log.beltWeight")} value={`${dive.belt_weight} kg`} />
          )}
          {dive.wetsuit_mm !== undefined && <Row label={t("log.wetsuit")} value={wetsuitLabel} />}
          {dive.water_temp != null && (
            <Row label={t("log.waterTemp")} value={`${dive.water_temp} °C`} />
          )}
          {dive.buoyancy && (
            <Row label={t("log.buoyancy")} value={buoyancyLabel[dive.buoyancy] ?? dive.buoyancy} />
          )}
          {dive.fins_brand && <Row label={t("log.finsBrand")} value={dive.fins_brand} />}
          {dive.fins_model && <Row label={t("log.finsModel")} value={dive.fins_model} />}
          {dive.foot_pocket && <Row label={t("log.footPocket")} value={dive.foot_pocket} />}
        </Section>
      )}

      {/* STA session conditions */}
      {hasSta && c && (
        <Section title={lang === "el" ? "ΣΥΝΘΗΚΕΣ ΣΤΑΤΙΚΗΣ" : "STATIC CONDITIONS"}>
          {c.environment && (
            <Row
              label={lang === "el" ? "Περιβάλλον" : "Environment"}
              value={envLabel[c.environment] ?? c.environment}
            />
          )}
          {c.posture && (
            <Row
              label={lang === "el" ? "Στάση" : "Posture"}
              value={postureLabel[c.posture] ?? c.posture}
            />
          )}
          {(c.faceCover || c.noseclip) && (
            <Row
              label={lang === "el" ? "Πρόσωπο" : "Face"}
              value={
                [
                  c.faceCover ? (faceCoverLabel[c.faceCover] ?? c.faceCover) : null,
                  c.noseclip ? (lang === "el" ? "Κλιπ μύτης" : "Noseclip") : null,
                ]
                  .filter(Boolean)
                  .join(" + ") || "—"
              }
            />
          )}
          {!c.faceCover && !c.noseclip && c.face && (
            <Row label={lang === "el" ? "Πρόσωπο" : "Face"} value={faceLabel[c.face] ?? c.face} />
          )}
          {c.roomTemp != null && (
            <Row
              label={lang === "el" ? "Θερμοκρασία χώρου" : "Room temp"}
              value={`${c.roomTemp} °C`}
            />
          )}
          {(c.breatheInSec != null || c.breatheOutSec != null) && (
            <Row
              label={lang === "el" ? "Ρυθμός breathe-up" : "Breathe-up"}
              value={`${c.breatheInSec ?? "–"}s / ${c.breatheOutSec ?? "–"}s`}
            />
          )}
        </Section>
      )}

      {/* warm-up used — any discipline */}
      {c?.warmupName && (
        <Section title={lang === "el" ? "ΖΕΣΤΑΜΑ" : "WARM-UP"}>
          <Row label={lang === "el" ? "Ζέσταμα που έγινε" : "Warm-up used"} value={c.warmupName} />
        </Section>
      )}

      {/* notes — STA sessions get structured display; plain text is shown as-is */}
      {dive.notes &&
        (dive.discipline === "STA" && dive.notes.includes("Rounds:") ? (
          <STASessionNotes notes={dive.notes} lang={lang} />
        ) : (
          <Section title={lang === "el" ? "ΣΗΜΕΙΩΣΕΙΣ" : "NOTES"}>
            <p className="text-sm text-foreground/60 leading-relaxed whitespace-pre-line">
              {dive.notes}
            </p>
          </Section>
        ))}

      {/* share */}
      {/* share-to-feed — per-dive community opt-in (default OFF), same control
          as the log form's. Only sanitized result data can ever reach the feed. */}
      <button
        type="button"
        onClick={() => shareToFeed.mutate(!(dive.shared_to_feed ?? false))}
        disabled={shareToFeed.isPending}
        className="pressable flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left disabled:opacity-60"
        style={{
          background: dive.shared_to_feed ? "rgba(29,158,117,0.08)" : "rgba(var(--ink),0.03)",
          border: dive.shared_to_feed
            ? "1px solid rgba(93,202,165,0.3)"
            : "1px solid rgba(var(--ink),0.08)",
        }}
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full"
          style={{
            background: dive.shared_to_feed ? "rgba(29,158,117,0.16)" : "rgba(var(--ink),0.05)",
          }}
        >
          <Users
            className="size-4"
            style={{ color: dive.shared_to_feed ? "#5DCAA5" : "rgba(var(--ink),0.4)" }}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            {t("dive.shareToFeed")}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[0.7rem] leading-snug text-foreground/40">
            <Lock className="size-3 shrink-0" />
            {t("dive.shareToFeedHint")}
          </span>
        </span>
        <span
          className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
          style={{ background: dive.shared_to_feed ? "#1D9E75" : "rgba(var(--ink),0.12)" }}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
            style={{ left: dive.shared_to_feed ? 22 : 2 }}
          />
        </span>
      </button>

      <button
        onClick={() => setShowShare(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-all active:scale-[0.99]"
        style={{
          background: "rgba(29,158,117,0.12)",
          border: "1px solid rgba(29,158,117,0.35)",
          color: "#5DCAA5",
        }}
      >
        <Share2 className="size-4" />
        {lang === "el" ? "Κοινοποίηση επίδοσης" : "Share result"}
      </button>

      {/* actions */}
      <div className="flex gap-3 pt-2">
        <Button asChild variant="outline" className="flex-1 gap-2">
          <Link to="/log" search={{ edit: dive.id }}>
            <Pencil className="size-4" /> {t("common.edit")}
          </Link>
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-2 border-red-400/30 text-red-400/70 hover:border-red-400 hover:text-red-400"
          onClick={() => {
            if (confirm(lang === "el" ? "Διαγραφή βουτιάς;" : "Delete this dive?")) {
              remove.mutate();
            }
          }}
          disabled={remove.isPending}
        >
          <Trash2 className="size-4" /> {t("common.delete")}
        </Button>
      </div>

      {showShare && (
        <ShareCardModal
          data={{
            athleteName: profile?.displayName || (lang === "el" ? "Ελεύθερος Δύτης" : "Freediver"),
            disciplineLabel: disciplineName(dive.discipline, lang),
            resultLabel: formatResult(dive.discipline, dive.result),
            dateLabel: dateStr,
            isPB: dive.is_personal_best,
            lang,
          }}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
