import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Fish,
  Ruler,
  Weight,
  ArrowDownToLine,
  Anchor,
  Camera,
  X,
  Loader2,
  MapPin,
  Lock,
  Share2,
  Pencil,
  Trash2,
} from "lucide-react";
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
  updateCatch,
  deleteCatch,
  personalBestsSpearo,
  type NewSpearoCatchInput,
} from "@/lib/spearo-catches";
import { uploadCatchPhoto, deleteCatchPhoto } from "@/lib/spearo-photos";
import { getCurrentSpot, mapsLink, SpotError } from "@/lib/spot";
import { nativeVibrate } from "@/lib/native";
import { shareCatchCard } from "@/lib/catch-share-card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

  // ── edit mode ───────────────────────────────────────────────────────────────
  // Mirrors log.tsx's edit-mode pattern (derive the record → prefill via effect →
  // switch the submit action → cancel). `editingId` is the id of the catch being
  // edited, or null in the normal create flow. `formRef` lets us bring the form
  // into view when the user taps edit on a card further down the list.
  const [editingId, setEditingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

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

  // ── photo state ─────────────────────────────────────────────────────────────
  // The photo is OPTIONAL. `photoPreview` is a local object URL shown instantly
  // on select (before the upload finishes); `photoUrl` is the public Storage URL
  // returned by uploadCatchPhoto (the value actually persisted on the catch);
  // `photoUploading` drives the subtle uploading state on the tile. The hidden
  // <input type="file"> is triggered by the on-brand picker tile below.
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── spot state ────────────────────────────────────────────────────────────
  // The spot is OPTIONAL and PRIVATE (owner-only). `spot` holds the captured
  // coordinates (or null when none); `spotName` is an optional human label
  // mapped to spot.name; `spotCapturing` drives the subtle "getting location"
  // state on the button; `spotError` is a friendly inline message shown when
  // geolocation is denied/unavailable (the form stays fully usable either way).
  const [spot, setSpot] = useState<{ lat: number; lng: number } | null>(null);
  const [spotName, setSpotName] = useState("");
  const [spotCapturing, setSpotCapturing] = useState(false);
  const [spotError, setSpotError] = useState<string | null>(null);

  // Forget the captured spot, its name, and any error message.
  const clearSpot = () => {
    setSpot(null);
    setSpotName("");
    setSpotError(null);
  };

  // Capture the device location (high-accuracy). On denial/failure we map the
  // typed SpotError reason to a friendly localized message and leave the form
  // untouched — a catch with no spot saves exactly as before.
  const handleCaptureSpot = async () => {
    setSpotError(null);
    setSpotCapturing(true);
    try {
      const coords = await getCurrentSpot();
      setSpot(coords);
    } catch (err) {
      const reason = err instanceof SpotError ? err.reason : "unavailable";
      setSpotError(
        reason === "denied"
          ? t("spearo.spotDenied")
          : reason === "unsupported"
            ? t("spearo.spotUnsupported")
            : t("spearo.spotUnavailable"),
      );
    } finally {
      setSpotCapturing(false);
    }
  };

  // Revoke a local preview object URL (if any) so we don't leak it, then forget
  // both the preview and the uploaded URL.
  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhotoUrl(null);
    setPhotoUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // On select: show a local preview immediately, then re-encode + upload (which
  // strips GPS/EXIF — see spearo-photos.ts) and hold the returned public URL.
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Replace any previously chosen photo (revoke its preview first).
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    setPhotoUrl(null);
    setPhotoUploading(true);

    try {
      const url = await uploadCatchPhoto(file, user!.id);
      setPhotoUrl(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("spearo.photoError"));
      clearPhoto();
    } finally {
      setPhotoUploading(false);
    }
  };

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

  // The catch currently being edited, resolved from the live list (like log.tsx
  // resolves `editing` from `dives`). Undefined in the create flow.
  const editing = editingId ? catches.find((c) => c.id === editingId) : undefined;

  // Pre-fill EVERY form field from the record being edited — the direct analogue
  // of log.tsx's edit effect. Runs whenever the edited record changes.
  useEffect(() => {
    if (!editing) return;
    // species: a known code fills the select; free-text uses the OTHER sentinel.
    if (editing.species_code) {
      setSpecies(editing.species_code);
      setSpeciesCustom("");
    } else if (editing.species_custom) {
      setSpecies(OTHER);
      setSpeciesCustom(editing.species_custom);
    } else {
      setSpecies("");
      setSpeciesCustom("");
    }
    setSizeCm(editing.size_cm != null ? String(editing.size_cm) : "");
    setWeightKg(editing.weight_kg != null ? String(editing.weight_kg) : "");
    setMaxDepthM(editing.max_depth_m != null ? String(editing.max_depth_m) : "");
    // Split the stored ISO timestamp back into the date + time inputs.
    setCaughtDate(format(new Date(editing.caught_at), "yyyy-MM-dd"));
    setCaughtTime(format(new Date(editing.caught_at), "HH:mm"));
    setNotes(editing.notes ?? "");
    // Photo: show the existing photo in the same preview control (its public URL
    // doubles as the preview src) and hold the URL so it persists unless the user
    // replaces or removes it.
    setPhotoPreview(editing.photo_url ?? null);
    setPhotoUrl(editing.photo_url ?? null);
    setPhotoUploading(false);
    // Spot: reuse the existing spot control, pre-filled from the private coords.
    if (editing.spot) {
      setSpot({ lat: editing.spot.lat, lng: editing.spot.lng });
      setSpotName(editing.spot.name ?? "");
    } else {
      setSpot(null);
      setSpotName("");
    }
    setSpotError(null);
  }, [editing]);

  const resetForm = () => {
    setSpecies("");
    setSpeciesCustom("");
    setSizeCm("");
    setWeightKg("");
    setMaxDepthM("");
    setCaughtDate(today());
    setCaughtTime(nowTime());
    setNotes("");
    clearPhoto();
    clearSpot();
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

  // Leave edit mode and restore the empty create form.
  const exitEdit = () => {
    setEditingId(null);
    resetForm();
  };

  // Enter edit mode for a catch (the effect above pre-fills the form) and bring
  // the form into view since the tapped card may be far down the list.
  const startEdit = (c: SpearoCatch) => {
    setEditingId(c.id);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Update path — separate from the untouched create `mutation`. Sends explicit
  // nulls for emptied optional fields so an edit that clears a field actually
  // clears the column (omitting would leave the old value in place).
  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; patch: Partial<NewSpearoCatchInput> }) =>
      updateCatch(vars.id, vars.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spearo-catches", user?.id] });
      toast.success(t("spearo.updated"));
      exitEdit();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t("spearo.couldNotSave")),
  });

  // Single delete — confirmed via the shared AlertDialog on each card.
  const deleteMutation = useMutation({
    mutationFn: async (c: SpearoCatch) => {
      await deleteCatch(c.id);
      // Best-effort hygiene: also remove the catch's PUBLIC photo from Storage so
      // a deleted catch's image URL doesn't linger. This must never block or fail
      // the delete — the row removal is what matters — so any cleanup error is
      // swallowed (logged only).
      if (c.photo_url) {
        try {
          await deleteCatchPhoto(c.photo_url);
        } catch (err) {
          console.error("catch photo cleanup failed (ignored):", err);
        }
      }
    },
    onSuccess: (_data, c) => {
      queryClient.invalidateQueries({ queryKey: ["spearo-catches", user?.id] });
      toast.success(t("spearo.deleted"));
      // If the user was editing the catch they just deleted, exit edit cleanly.
      if (editingId === c.id) exitEdit();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t("spearo.deleteError")),
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

    // ── EDIT: update the existing catch ───────────────────────────────────────
    if (editingId) {
      // Unlike create (which omits empties), an update must send explicit `null`
      // for cleared fields so the column is actually cleared. The data-layer type
      // models these as optional strings rather than nullable, so we cast once at
      // this boundary — we do NOT modify the data layer.
      const patch = {
        caught_at: caughtAt,
        species_code: species === OTHER ? null : species,
        species_custom: species === OTHER ? speciesCustom.trim() : null,
        size_cm: sizeCm ? Number(sizeCm) : null,
        weight_kg: weightKg ? Number(weightKg) : null,
        max_depth_m: maxDepthM ? Number(maxDepthM) : null,
        notes: notes.trim() ? notes.trim() : null,
        // null clears a removed photo; the URL persists an existing/replaced one.
        photo_url: photoUrl ?? null,
        // null clears a removed spot; owner-only coords are never exposed anywhere.
        spot: spot
          ? { lat: spot.lat, lng: spot.lng, ...(spotName.trim() ? { name: spotName.trim() } : {}) }
          : null,
      } as unknown as Partial<NewSpearoCatchInput>;
      updateMutation.mutate({ id: editingId, patch });
      return;
    }

    // ── CREATE (unchanged) ────────────────────────────────────────────────────
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
      // Optional: only sent when a photo finished uploading. A catch with no
      // photo saves fine (the field is simply omitted).
      ...(photoUrl ? { photo_url: photoUrl } : {}),
      // Optional + PRIVATE: only sent when the owner captured a spot. Omitted
      // entirely otherwise, so a catch with no spot saves exactly as before.
      // The name is only attached when non-empty.
      ...(spot
        ? {
            spot: {
              lat: spot.lat,
              lng: spot.lng,
              ...(spotName.trim() ? { name: spotName.trim() } : {}),
            },
          }
        : {}),
    };

    mutation.mutate(input);
  };

  return (
    // pb-24 mirrors history.tsx: keeps the save button + last catch card clear
    // of the fixed bottom navigation bar (AppLayout renders it `fixed bottom-0`).
    <div className="space-y-6 pb-24">
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

      {/* ── log/edit-a-catch form ── */}
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
        <div className="glass-card space-y-4 rounded-2xl p-5">
          <h2
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: GREEN_LIGHT }}
          >
            <Anchor className="size-4" /> {editingId ? t("spearo.editTitle") : t("spearo.logTitle")}
          </h2>
          <p className="-mt-2 text-xs text-muted-foreground">
            {editingId ? t("spearo.editSub") : t("spearo.logSub")}
          </p>

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

          {/* date + time, stacked full-width — same native inputs as log.tsx,
              default to now. Stacked (not a 2-col split) so the browser's
              calendar/clock picker glyph always has room: in a narrow ~390px
              column the split squeezed the date value against the indicator and
              clipped the calendar icon off the right edge. */}
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

          {/* photo — OPTIONAL, one per catch. This is the shareable "my catch"
              object, so the picker is styled to match the app's premium glass
              language. The <input> is hidden; the tile below triggers it. */}
          <div className="space-y-1.5">
            <Label>{t("spearo.photo")}</Label>
            {/* accept only images; deliberately NO `capture` attribute so the OS
                shows its normal picker sheet (Camera + Gallery/Files). Spearos
                usually shoot the fish on the boat and log later, so choosing an
                existing photo from the gallery must be possible — forcing the
                camera would block that. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            {photoPreview ? (
              // chosen state: preview thumbnail with an uploading overlay + a
              // remove control (allowed any time before submit).
              <div
                className="relative overflow-hidden rounded-xl"
                style={{ border: "1px solid rgba(93,202,165,0.25)" }}
              >
                <img
                  src={photoPreview}
                  alt={t("spearo.photo")}
                  className="h-44 w-full object-cover"
                />

                {/* subtle uploading state while the re-encode + upload runs */}
                {photoUploading && (
                  <div
                    className="absolute inset-0 flex items-center justify-center gap-2 text-xs font-semibold text-white"
                    style={{ background: "rgba(4,26,46,0.55)", backdropFilter: "blur(2px)" }}
                  >
                    <Loader2 className="size-4 animate-spin" />
                    {t("spearo.photoUploading")}
                  </div>
                )}

                {/* remove chosen photo */}
                <button
                  type="button"
                  onClick={clearPhoto}
                  aria-label={t("spearo.photoRemove")}
                  className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80"
                  style={{ background: "rgba(4,26,46,0.6)", backdropFilter: "blur(2px)" }}
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              // empty state: on-brand dashed tile inviting a photo.
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-xl px-4 py-6 text-center transition-colors"
                style={{
                  border: "1px dashed rgba(93,202,165,0.35)",
                  background: "rgba(29,158,117,0.06)",
                }}
              >
                <span
                  className="flex size-11 items-center justify-center rounded-full"
                  style={{ background: "rgba(29,158,117,0.14)" }}
                >
                  <Camera className="size-5" style={{ color: GREEN_LIGHT }} />
                </span>
                <span className="text-sm font-semibold" style={{ color: GREEN_LIGHT }}>
                  {t("spearo.addPhoto")}
                </span>
                <span className="max-w-[16rem] text-[0.7rem] leading-snug text-foreground/40">
                  {t("spearo.photoHint")}
                </span>
              </button>
            )}
          </div>

          {/* spot — OPTIONAL and PRIVATE (owner-only). Captures the device GPS
              for the owner's eyes only. See the privacy note at the display
              site (CatchCard): a spot must NEVER leak into any shared, public,
              or exported surface. There is deliberately NO "share spot"
              affordance anywhere. */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              {t("spearo.spotLabel")}
              <Lock className="size-3 text-foreground/30" />
            </Label>

            {spot ? (
              // captured state: confirmation + optional free-text name + clear.
              <div
                className="space-y-3 rounded-xl p-3"
                style={{
                  border: "1px solid rgba(93,202,165,0.25)",
                  background: "rgba(29,158,117,0.06)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 text-sm font-semibold"
                    style={{ color: GREEN_LIGHT }}
                  >
                    <MapPin className="size-4" />
                    {t("spearo.spotCaptured")}
                  </span>
                  {/* clear the captured spot */}
                  <button
                    type="button"
                    onClick={clearSpot}
                    aria-label={t("spearo.spotClear")}
                    className="ml-auto flex size-7 items-center justify-center rounded-full text-foreground/50 transition-colors hover:text-foreground"
                    style={{ background: "rgba(var(--ink),0.05)" }}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>

                {/* optional human-readable name → spot.name (e.g. "Κάβος, ρηχά") */}
                <Input
                  type="text"
                  value={spotName}
                  onChange={(e) => setSpotName(e.target.value)}
                  placeholder={t("spearo.spotNamePlaceholder")}
                  aria-label={t("spearo.spotName")}
                />

                <p className="flex items-center gap-1.5 text-[0.7rem] leading-snug text-foreground/40">
                  <Lock className="size-3 shrink-0" />
                  {t("spearo.spotPrivateHint")}
                </p>
              </div>
            ) : (
              // empty state: on-brand capture control + inline error/hint. The
              // form stays fully usable whether or not a spot is captured.
              <>
                <button
                  type="button"
                  onClick={handleCaptureSpot}
                  disabled={spotCapturing}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
                  style={{
                    border: "1px dashed rgba(93,202,165,0.35)",
                    background: "rgba(29,158,117,0.06)",
                    color: GREEN_LIGHT,
                  }}
                >
                  {spotCapturing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t("spearo.spotCapturing")}
                    </>
                  ) : (
                    <>📍 {t("spearo.useLocation")}</>
                  )}
                </button>

                {spotError ? (
                  <p className="text-[0.7rem] leading-snug text-amber-400/80">{spotError}</p>
                ) : (
                  <p className="flex items-center gap-1.5 text-[0.7rem] leading-snug text-foreground/40">
                    <Lock className="size-3 shrink-0" />
                    {t("spearo.spotPrivateHint")}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <Button
            type="submit"
            variant="hero"
            size="lg"
            className="w-full"
            disabled={mutation.isPending || updateMutation.isPending || photoUploading}
            onClick={() => nativeVibrate(10)}
          >
            {mutation.isPending || updateMutation.isPending
              ? t("common.saving")
              : editingId
                ? t("spearo.update")
                : t("spearo.save")}
          </Button>
          {/* Cancel exits edit mode and restores the empty create form. */}
          {editingId && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={exitEdit}
              disabled={updateMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
          )}
        </div>
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
              <CatchCard
                key={c.id}
                catch={c}
                isPB={pbIds.has(c.id)}
                isEditing={editingId === c.id}
                lang={lang}
                t={t}
                onEdit={startEdit}
                onDelete={(x) => deleteMutation.mutate(x)}
              />
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
  isEditing,
  lang,
  t,
  onEdit,
  onDelete,
}: {
  catch: SpearoCatch;
  isPB: boolean;
  isEditing: boolean;
  lang: "el" | "en";
  t: (k: string, v?: Record<string, string | number>) => string;
  onEdit: (c: SpearoCatch) => void;
  onDelete: (c: SpearoCatch) => void;
}) {
  const border = isPB ? AMBER : GREEN;
  // Resolve the display name: known species get their localized label, otherwise
  // fall back to the free-text `species_custom`.
  const name = c.species_code ? speciesLabel(c.species_code, lang) : (c.species_custom ?? "—");

  const dateStr = format(new Date(c.caught_at), "d MMM yyyy · HH:mm");

  // ── share ("my catch" card) ─────────────────────────────────────────────────
  // Generates a branded, Instagram-ready image for THIS catch and hands it to
  // the native share sheet (mobile) or a download (desktop) via the reused
  // SVG→PNG pipeline. The card is a PUBLIC artifact and carries NO location data
  // (see catch-share-card.ts). `sharing` drives the subtle generating state.
  const [sharing, setSharing] = useState(false);
  const handleShare = async () => {
    setSharing(true);
    try {
      const res = await shareCatchCard(c, lang);
      // Only the download path needs a confirmation; the native share sheet is
      // its own feedback.
      if (res === "downloaded") toast.success(t("spearo.shareSaved"));
    } catch (err) {
      console.error(err);
      toast.error(t("spearo.shareError"));
    } finally {
      setSharing(false);
    }
  };

  // Measurement chips — only rendered when the value is present.
  const chips: { icon: typeof Ruler; value: string }[] = [];
  if (c.size_cm != null) chips.push({ icon: Ruler, value: formatCatchSize(c.size_cm) });
  if (c.weight_kg != null) chips.push({ icon: Weight, value: formatCatchWeight(c.weight_kg) });
  if (c.max_depth_m != null)
    chips.push({ icon: ArrowDownToLine, value: formatDepth(c.max_depth_m) });

  return (
    <li
      className="glass-card overflow-hidden rounded-2xl transition-shadow"
      style={{
        borderLeft: `3px solid ${border}`,
        // subtle ring while this catch is the one being edited in the form above
        boxShadow: isEditing ? "0 0 0 2px rgba(93,202,165,0.55)" : undefined,
      }}
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
          {/* right group is shrink-0 so the share button is ALWAYS rendered and
              tappable — it can never be pushed off-edge or overlapped by a long
              date (the date truncates instead). */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="truncate text-[0.65rem] text-foreground/35">{dateStr}</span>
            {/* discreet, on-brand share affordance — builds the "my catch" card */}
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              aria-label={t("spearo.share")}
              title={t("spearo.share")}
              className="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:brightness-110 disabled:opacity-60"
              style={{
                background: "rgba(29,158,117,0.12)",
                border: "1px solid rgba(93,202,165,0.25)",
                color: GREEN_LIGHT,
              }}
            >
              {sharing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Share2 className="size-4" />
              )}
            </button>
          </div>
        </div>

        {/* species name — display font, capitalized */}
        <p
          className="text-xl font-bold capitalize text-foreground"
          style={{ fontFamily: "'Outfit', sans-serif", lineHeight: 1.1 }}
        >
          {name}
        </p>

        {/* photo thumbnail — only when the catch has one; the card stays clean
            without it. Never renders the spot; the stored image is metadata-free
            (see spearo-photos.ts). */}
        {c.photo_url && (
          <img
            src={c.photo_url}
            alt={name}
            loading="lazy"
            className="h-40 w-full rounded-xl object-cover"
            style={{ border: "1px solid rgba(var(--ink),0.06)" }}
          />
        )}

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

        {/* PRIVATE spot chip — OWNER-ONLY.
            ⚠️ PRIVACY (the whole point of this feature): these coordinates are
            for the owner's eyes ONLY. This chip is the ONLY place a spot is ever
            surfaced, and tapping it hands off to the device's own maps app — no
            raw coordinates are shown and nothing is transmitted. The spot
            (lat/lng/name) must NEVER be included in any future share card,
            public feed, CSV export, or any cross-user payload. Coordinates are
            private, full stop. Do NOT add a "share spot" / "make public"
            affordance here or anywhere. */}
        {c.spot && (
          <div>
            <a
              href={mapsLink(c.spot.lat, c.spot.lng)}
              target="_blank"
              rel="noreferrer"
              aria-label={t("spearo.spotOpenMaps")}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-[filter] hover:brightness-110"
              style={{
                background: "rgba(29,158,117,0.1)",
                border: "1px solid rgba(93,202,165,0.25)",
                color: GREEN_LIGHT,
              }}
            >
              <MapPin className="size-3.5" />
              <span className="max-w-[10rem] truncate">{c.spot.name || t("spearo.spot")}</span>
              {/* lock hint makes it visually clear this is private */}
              <Lock className="size-3 opacity-60" />
            </a>
          </div>
        )}

        {/* notes */}
        {c.notes && <p className="text-xs leading-relaxed text-foreground/45">{c.notes}</p>}

        {/* edit + delete actions — bottom-right, mirroring history.tsx's dive-card
            controls exactly (ghost buttons, Pencil/Trash2). Kept at the bottom so
            they never crowd or clip the share button in the top-right. */}
        <div className="flex items-center justify-end gap-1 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-foreground/40"
            onClick={() => onEdit(c)}
          >
            <Pencil className="size-3" /> {t("common.edit")}
          </Button>

          {/* delete → reuse the shared AlertDialog for a destructive confirm */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-red-400/60 hover:text-red-400"
              >
                <Trash2 className="size-3" /> {t("common.delete")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("spearo.deleteTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("spearo.deleteDesc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(c)}
                  className="bg-red-600 text-white hover:bg-red-600/90"
                >
                  {t("common.delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
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
