import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Fish, Ruler, Weight, ArrowDownToLine, Anchor } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { Bubbles } from "@/components/Bubbles";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import {
  MED_SPECIES,
  speciesLabel,
  formatCatchSize,
  formatCatchWeight,
  formatDepth,
  type SpearoCatch,
} from "@/lib/spearo";
import {
  listCatches,
  createCatch,
  personalBestsSpearo,
  type NewSpearoCatchInput,
} from "@/lib/spearo-catches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Route ──────────────────────────────────────────────────────────────────────
// The first user-facing Apnos Spearo screen: log a spearfishing catch and see the
// catch list. Wrapped in <AppLayout> like every other route so it inherits the
// app chrome + the auth gate (AppLayout redirects to /auth when signed out — we
// deliberately do NOT invent a separate auth pattern here). Not yet linked from
// the global nav; reachable by URL only until the screen is approved.
export const Route = createFileRoute("/spearo")({
  head: () => ({ meta: [{ title: "Catch log — Apnos Spearo" }] }),
  component: () => (
    <AppLayout>
      <Spearo />
    </AppLayout>
  ),
});

// Sentinel value for the "Other…" option in the species <Select> — kept distinct
// from any real species slug so it can never collide with MED_SPECIES codes.
const OTHER = "__other__";

const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

// Brand palette (matches log.tsx / history.tsx exactly): green for the log,
// amber for a personal best.
const GREEN = "#1D9E75";
const GREEN_LIGHT = "#5DCAA5";
const AMBER = "#EF9F27";

function Spearo() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();

  // ── form state ────────────────────────────────────────────────────────────
  // `species` holds either a MED_SPECIES code, the OTHER sentinel, or "" (unset).
  const [species, setSpecies] = useState("");
  const [speciesCustom, setSpeciesCustom] = useState("");
  const [sizeCm, setSizeCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [maxDepthM, setMaxDepthM] = useState("");
  const [caughtDate, setCaughtDate] = useState(today());
  const [caughtTime, setCaughtTime] = useState(nowTime());
  const [notes, setNotes] = useState("");

  // ── catch list ────────────────────────────────────────────────────────────
  // Keyed on the authenticated user id, exactly like fetchDives in the other
  // routes. `enabled: !!user` mirrors log.tsx / history.tsx.
  const {
    data: catches = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["spearo-catches", user?.id],
    queryFn: () => listCatches(user!.id),
    enabled: !!user,
  });

  // Best catch per species (largest size, tie-broken by weight) — computed
  // client-side, the same way dives derive PBs. Maps id → true for O(1) lookup.
  const pbIds = useMemo(() => {
    const best = personalBestsSpearo(catches);
    return new Set(Object.values(best).map((c) => c.id));
  }, [catches]);

  const resetForm = () => {
    setSpecies("");
    setSpeciesCustom("");
    setSizeCm("");
    setWeightKg("");
    setMaxDepthM("");
    setCaughtDate(today());
    setCaughtTime(nowTime());
    setNotes("");
  };

  const mutation = useMutation({
    mutationFn: (input: NewSpearoCatchInput) => createCatch(input),
    onSuccess: (created) => {
      // Same invalidate-then-toast pattern the dive-logging flow uses.
      queryClient.invalidateQueries({ queryKey: ["spearo-catches", user?.id] });
      // Recompute PBs including the fresh row so a record-breaker toasts as a PB.
      const best = personalBestsSpearo([created, ...catches]);
      const isPB = Object.values(best).some((c) => c.id === created.id);
      toast.success(isPB ? t("spearo.newPB") : t("spearo.logged"));
      resetForm();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t("spearo.couldNotSave")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!species) {
      toast.error(t("spearo.pickSpecies"));
      return;
    }
    if (species === OTHER && !speciesCustom.trim()) {
      toast.error(t("spearo.enterCustom"));
      return;
    }

    // Combine the date + time inputs into a single ISO `caught_at` timestamp.
    // Reuses the same date/time input pattern as log.tsx (two <Input> controls).
    const caughtAt = new Date(`${caughtDate}T${caughtTime || "00:00"}`).toISOString();

    // Build the payload with only the fields the user actually filled in — empty
    // optional measurements are omitted rather than sent as 0/NaN. `user_id` is
    // intentionally NOT passed: it defaults to auth.uid() on the table (see
    // spearo-catches.ts), matching the RLS insert check.
    const input: NewSpearoCatchInput = {
      caught_at: caughtAt,
      ...(species === OTHER ? { species_custom: speciesCustom.trim() } : { species_code: species }),
      ...(sizeCm ? { size_cm: Number(sizeCm) } : {}),
      ...(weightKg ? { weight_kg: Number(weightKg) } : {}),
      ...(maxDepthM ? { max_depth_m: Number(maxDepthM) } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    mutation.mutate(input);
  };

  return (
    <div className="space-y-6 pb-4">
      {/* ── premium hero header ── */}
      <div
        className="relative overflow-hidden rounded-2xl p-6"
        style={{
          background: "linear-gradient(160deg, #0d4a63 0%, #072a42 55%, #041a2e 100%)",
          border: "1px solid rgba(93,202,165,0.18)",
          boxShadow: "0 8px 32px rgba(4,26,46,0.45)",
        }}
      >
        {/* drifting bubbles for the underwater feel (decorative, aria-hidden) */}
        <Bubbles />
        <div className="relative z-10">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6rem] font-bold tracking-[0.18em]"
            style={{ background: "rgba(93,202,165,0.15)", color: GREEN_LIGHT }}
          >
            <Fish className="size-3" />
            {t("spearo.badge")}
          </span>
          <h1
            className="mt-3 text-2xl font-bold text-white"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            {t("spearo.heroTitle")}
          </h1>
          <p className="mt-1 max-w-sm text-sm text-white/55">{t("spearo.heroSub")}</p>
        </div>
      </div>

      {/* ── log-a-catch form ── */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="glass-card space-y-4 rounded-2xl p-5">
          <h2
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: GREEN_LIGHT }}
          >
            <Anchor className="size-4" /> {t("spearo.logTitle")}
          </h2>
          <p className="-mt-2 text-xs text-muted-foreground">{t("spearo.logSub")}</p>

          {/* species — localized names are the whole point (σαργός / συναγρίδα) */}
          <div className="space-y-1.5">
            <Label>{t("spearo.species")}</Label>
            <Select value={species} onValueChange={setSpecies}>
              <SelectTrigger>
                <SelectValue placeholder={t("spearo.speciesPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {MED_SPECIES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    <span className="capitalize">{speciesLabel(s.code, lang)}</span>
                  </SelectItem>
                ))}
                <SelectItem value={OTHER}>{t("spearo.speciesOther")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* free-text species — revealed only for "Other…", maps to species_custom */}
          {species === OTHER && (
            <div className="space-y-1.5 animate-fade-in">
              <Label htmlFor="species-custom">{t("spearo.speciesCustom")}</Label>
              <Input
                id="species-custom"
                type="text"
                value={speciesCustom}
                onChange={(e) => setSpeciesCustom(e.target.value)}
                placeholder={t("spearo.speciesCustomPlaceholder")}
                autoFocus
              />
            </div>
          )}

          {/* size | weight */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="size">{t("spearo.size")}</Label>
              <Input
                id="size"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={sizeCm}
                onChange={(e) => setSizeCm(e.target.value)}
                placeholder="e.g. 32"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight">{t("spearo.weight")}</Label>
              <Input
                id="weight"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="e.g. 1.4"
              />
            </div>
          </div>

          {/* max depth */}
          <div className="space-y-1.5">
            <Label htmlFor="depth">{t("spearo.maxDepth")}</Label>
            <Input
              id="depth"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              value={maxDepthM}
              onChange={(e) => setMaxDepthM(e.target.value)}
              placeholder="e.g. 12"
            />
          </div>

          {/* date | time — identical inputs to log.tsx, default to now */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="caught-date">{t("log.date")}</Label>
              <Input
                id="caught-date"
                type="date"
                value={caughtDate}
                onChange={(e) => setCaughtDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="caught-time">{t("log.time")}</Label>
              <Input
                id="caught-time"
                type="time"
                value={caughtTime}
                onChange={(e) => setCaughtTime(e.target.value)}
              />
            </div>
          </div>

          {/* notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("log.notes")}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("spearo.notesPlaceholder")}
              rows={3}
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="hero"
          size="lg"
          className="w-full"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? t("common.saving") : t("spearo.save")}
        </Button>
      </form>

      {/* ── catch list ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">{t("spearo.listTitle")}</h2>
          {catches.length > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[0.6rem] font-bold"
              style={{ background: "rgba(29,158,117,0.15)", color: GREEN_LIGHT }}
            >
              {t("spearo.catchesCount", { n: catches.length })}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : isError ? (
          <div
            className="rounded-2xl border border-red-400/20 p-6 text-center"
            style={{ background: "var(--card)" }}
          >
            <p className="text-sm font-semibold text-red-400/80">{t("spearo.errorTitle")}</p>
            <p className="mt-1 text-xs text-foreground/40">
              {error instanceof Error ? error.message : ""}
            </p>
          </div>
        ) : catches.length === 0 ? (
          <SpearoEmpty t={t} />
        ) : (
          <ul className="space-y-3">
            {catches.map((c) => (
              <CatchCard key={c.id} catch={c} isPB={pbIds.has(c.id)} lang={lang} t={t} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── CatchCard ──────────────────────────────────────────────────────────────────
// One logged catch. Mirrors the visual language of DiveCard / dive.$id.tsx: a
// glass card with a coloured left border (amber for a PB, green otherwise), a
// species pill, an optional PB badge, the localized species name in the display
// font, a strip of measurement chips (hidden when unset) and the catch date.
function CatchCard({
  catch: c,
  isPB,
  lang,
  t,
}: {
  catch: SpearoCatch;
  isPB: boolean;
  lang: "el" | "en";
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const border = isPB ? AMBER : GREEN;
  // Resolve the display name: known species get their localized label, otherwise
  // fall back to the free-text `species_custom`.
  const name = c.species_code ? speciesLabel(c.species_code, lang) : (c.species_custom ?? "—");

  const dateStr = format(new Date(c.caught_at), "d MMM yyyy · HH:mm");

  // Measurement chips — only rendered when the value is present.
  const chips: { icon: typeof Ruler; value: string }[] = [];
  if (c.size_cm != null) chips.push({ icon: Ruler, value: formatCatchSize(c.size_cm) });
  if (c.weight_kg != null) chips.push({ icon: Weight, value: formatCatchWeight(c.weight_kg) });
  if (c.max_depth_m != null)
    chips.push({ icon: ArrowDownToLine, value: formatDepth(c.max_depth_m) });

  return (
    <li
      className="glass-card overflow-hidden rounded-2xl"
      style={{ borderLeft: `3px solid ${border}` }}
    >
      <div className="space-y-3 p-4">
        {/* top row: species pill + PB badge + date */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.6rem] font-bold tracking-wider"
            style={{ background: "rgba(29,158,117,0.15)", color: GREEN_LIGHT }}
          >
            <Fish className="size-3" />
            {t("spearo.species").toUpperCase()}
          </span>
          {isPB && (
            <span
              className="rounded-md px-1.5 py-0.5 text-[0.6rem] font-bold"
              style={{ background: "rgba(239,159,39,0.15)", color: AMBER }}
            >
              🏆 {t("spearo.pb")}
            </span>
          )}
          <span className="ml-auto text-[0.65rem] text-foreground/35">{dateStr}</span>
        </div>

        {/* species name — display font, capitalized */}
        <p
          className="text-xl font-bold capitalize text-foreground"
          style={{ fontFamily: "'Outfit', sans-serif", lineHeight: 1.1 }}
        >
          {name}
        </p>

        {/* measurement chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map(({ icon: Icon, value }, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums"
                style={{
                  background: "rgba(var(--ink),0.04)",
                  border: "1px solid rgba(var(--ink),0.06)",
                  color: "rgba(var(--ink),0.7)",
                }}
              >
                <Icon className="size-3.5" style={{ color: GREEN_LIGHT }} />
                {value}
              </span>
            ))}
          </div>
        )}

        {/* notes */}
        {c.notes && <p className="text-xs leading-relaxed text-foreground/45">{c.notes}</p>}
      </div>
    </li>
  );
}

// ── empty state ──────────────────────────────────────────────────────────────
// Inviting, on-brand empty state (not a bare "no data") for a fresh log.
function SpearoEmpty({ t }: { t: (k: string) => string }) {
  return (
    <div
      className="flex flex-col items-center rounded-2xl border border-foreground/08 p-10 text-center"
      style={{ background: "var(--card)" }}
    >
      <div
        className="flex size-16 items-center justify-center rounded-full"
        style={{ background: "rgba(29,158,117,0.1)" }}
      >
        <Fish className="size-8" style={{ color: GREEN_LIGHT }} />
      </div>
      <p className="mt-4 font-semibold text-foreground">{t("spearo.empty")}</p>
      <p className="mt-1 max-w-xs text-sm text-foreground/40">{t("spearo.emptySub")}</p>
    </div>
  );
}
