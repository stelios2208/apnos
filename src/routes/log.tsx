import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Flame, HeartPulse, Backpack, Waves, Users, Lock } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { TimeInput } from "@/components/TimeInput";
import { createDive, fetchDives, unitLabel, updateDive, type NewDiveInput } from "@/lib/dives";
import {
  DISCIPLINES,
  DISCIPLINE_MAP,
  FEDERATIONS,
  disciplineName,
  isTimeDiscipline,
  type DisciplineCode,
  type Federation,
  type StaPosture,
  type StaEnvironment,
  type StaFaceCover,
  type StaConditions,
} from "@/lib/diving";
import { WARMUP_PRESETS, loadCustomWarmups } from "@/lib/warmups";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const searchSchema = z.object({
  edit: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/log")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "New Dive — Apnos" }] }),
  component: () => (
    <AppLayout>
      <LogDive />
    </AppLayout>
  ),
});

const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

function LogDive() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { edit: editId } = Route.useSearch();

  const { data: dives = [] } = useQuery({
    queryKey: ["dives", user?.id],
    queryFn: () => fetchDives(user!.id),
    enabled: !!user,
  });
  const editing = editId ? dives.find((d) => d.id === editId) : undefined;

  const [discipline, setDiscipline] = useState<DisciplineCode>("STA");
  const [result, setResult] = useState(0);
  const [diveDate, setDiveDate] = useState(today());
  const [diveTime, setDiveTime] = useState(nowTime());
  const [sessionType, setSessionType] = useState<"training" | "competition">("training");
  const [federation, setFederation] = useState<Federation>("AIDA");
  const [sleepHours, setSleepHours] = useState("");
  const [foodNotes, setFoodNotes] = useState("");
  const [mentalState, setMentalState] = useState(3);
  const [notes, setNotes] = useState("");
  // Community opt-in — DEFAULT OFF, always. The feed only ever reads the
  // sanitized feed_dives view (result data only — never notes/wellness/gear).
  const [sharedToFeed, setSharedToFeed] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [neckWeight, setNeckWeight] = useState("");
  const [beltWeight, setBeltWeight] = useState("");
  const [wetsuitMm, setWetsuitMm] = useState<string>("");
  const [buoyancy, setBuoyancy] = useState<string>("");
  const [finsBrand, setFinsBrand] = useState("");
  const [finsModel, setFinsModel] = useState("");
  const [footPocket, setFootPocket] = useState("");
  const [waterTemp, setWaterTemp] = useState("");

  // STA-only session conditions
  const [posture, setPosture] = useState<StaPosture>("");
  const [environment, setEnvironment] = useState<StaEnvironment>("");
  const [faceCover, setFaceCover] = useState<StaFaceCover>("");
  const [noseclip, setNoseclip] = useState(false);
  const [roomTemp, setRoomTemp] = useState("");
  const [breatheIn, setBreatheIn] = useState("");
  const [breatheOut, setBreatheOut] = useState("");

  // warm-up used before the dive (any discipline)
  const [warmupId, setWarmupId] = useState("");
  const [warmupName, setWarmupName] = useState("");
  const allWarmups = useMemo(() => [...loadCustomWarmups(), ...WARMUP_PRESETS], []);

  // Derive fins category from discipline — no manual override needed
  const finsCategory = (d: DisciplineCode): "monofin" | "bifins" | "none" => {
    if (["DYN", "CWT"].includes(d)) return "monofin";
    if (["DYNB", "CWTB"].includes(d)) return "bifins";
    return "none";
  };
  const finsCat = finsCategory(discipline);

  useEffect(() => {
    if (!editing) return;
    setDiscipline(editing.discipline);
    setResult(editing.result);
    setDiveDate(editing.dive_date);
    setDiveTime(editing.dive_time ?? nowTime());
    setSessionType(editing.session_type);
    setFederation(editing.federation ?? "AIDA");
    setSleepHours(editing.sleep_hours != null ? String(editing.sleep_hours) : "");
    setFoodNotes(editing.food_notes ?? "");
    setMentalState(editing.mental_state ?? 3);
    setNotes(editing.notes ?? "");
    setSharedToFeed(editing.shared_to_feed ?? false);
    setNeckWeight(editing.neck_weight != null ? String(editing.neck_weight) : "");
    setBeltWeight(editing.belt_weight != null ? String(editing.belt_weight) : "");
    setWetsuitMm(editing.wetsuit_mm != null ? String(editing.wetsuit_mm) : "");
    setBuoyancy(editing.buoyancy ?? "");
    setFinsBrand(editing.fins_brand ?? "");
    setFinsModel(editing.fins_model ?? "");
    setFootPocket(editing.foot_pocket ?? "");
    setWaterTemp(editing.water_temp != null ? String(editing.water_temp) : "");
    const c = editing.conditions ?? {};
    setPosture(c.posture ?? "");
    setEnvironment(c.environment ?? "");
    // faceCover/noseclip supersede the old single-select "face"; read legacy
    // data (face: "mask"|"goggles"|"noseclip") into the new shape if present.
    setFaceCover(c.faceCover ?? (c.face === "mask" || c.face === "goggles" ? c.face : ""));
    setNoseclip(c.noseclip ?? c.face === "noseclip");
    setRoomTemp(c.roomTemp != null ? String(c.roomTemp) : "");
    setBreatheIn(c.breatheInSec != null ? String(c.breatheInSec) : "");
    setBreatheOut(c.breatheOutSec != null ? String(c.breatheOutSec) : "");
    setWarmupId(c.warmupId ?? "");
    setWarmupName(c.warmupName ?? "");
  }, [editing]);

  const mutation = useMutation({
    mutationFn: (input: NewDiveInput) =>
      editId ? updateDive(user!.id, editId, input) : createDive(user!.id, input),
    onSuccess: (dive) => {
      queryClient.invalidateQueries({ queryKey: ["dives", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["feed-dives"] });
      if (editId) {
        toast.success(t("log.updated"));
      } else if (dive.is_personal_best) {
        toast.success(t("log.newPB"), { description: disciplineName(dive.discipline, lang) });
      } else {
        toast.success(t("log.logged"));
      }
      navigate({ to: "/history" });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t("log.couldNotSave")),
  });

  const isTime = isTimeDiscipline(discipline);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!result || result <= 0) {
      toast.error(t("log.enterValid"));
      return;
    }
    const conditions: StaConditions = {
      ...(discipline === "STA"
        ? {
            posture,
            environment,
            faceCover,
            noseclip,
            roomTemp: roomTemp ? Number(roomTemp) : null,
            breatheInSec: breatheIn ? Number(breatheIn) : null,
            breatheOutSec: breatheOut ? Number(breatheOut) : null,
          }
        : {}),
      ...(warmupName ? { warmupName, warmupId } : {}),
    };
    const hasConditions =
      !!conditions.posture ||
      !!conditions.environment ||
      !!conditions.faceCover ||
      !!conditions.noseclip ||
      conditions.roomTemp != null ||
      conditions.breatheInSec != null ||
      conditions.breatheOutSec != null ||
      !!conditions.warmupName;

    mutation.mutate({
      discipline,
      result,
      dive_date: diveDate,
      dive_time: diveTime || null,
      session_type: sessionType,
      federation: sessionType === "competition" ? federation : null,
      sleep_hours: sleepHours ? Number(sleepHours) : null,
      food_notes: foodNotes || null,
      mental_state: mentalState,
      notes: notes || null,
      neck_weight: discipline === "STA" ? null : neckWeight ? Number(neckWeight) : null,
      belt_weight: discipline === "STA" ? null : beltWeight ? Number(beltWeight) : null,
      wetsuit_mm: wetsuitMm ? Number(wetsuitMm) : null,
      buoyancy: buoyancy || null,
      fins_type: finsCat !== "none" ? finsCat : null,
      fins_brand: finsBrand || null,
      fins_model: finsModel || null,
      water_temp: waterTemp ? Number(waterTemp) : null,
      foot_pocket: footPocket || null,
      conditions: hasConditions ? conditions : null,
      // written with the PGRST204 drop-and-retry in dives.ts, so a lagging DB
      // (migration not applied) degrades gracefully
      shared_to_feed: sharedToFeed,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{editId ? t("log.titleEdit") : t("log.titleNew")}</h1>
        <p className="text-sm text-muted-foreground">
          {editId ? t("log.subEdit") : t("log.subNew")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="glass-card space-y-4 rounded-2xl p-5">
          <div className="space-y-1.5">
            <Label>{t("log.discipline")}</Label>
            <Select value={discipline} onValueChange={(v) => setDiscipline(v as DisciplineCode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISCIPLINES.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.code} — {disciplineName(d.code, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="result">{isTime ? t("log.resultTime") : t("log.resultDistance")}</Label>
            {isTime ? (
              <TimeInput value={result} onChange={setResult} />
            ) : (
              <Input
                id="result"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={result || ""}
                onChange={(e) => setResult(Number(e.target.value))}
                placeholder="e.g. 75"
                required
              />
            )}
            {!isTime && (
              <p className="text-[0.7rem] text-muted-foreground">
                {t("common.meters")} — {unitLabel(discipline)}.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">{t("log.date")}</Label>
              <Input
                id="date"
                type="date"
                value={diveDate}
                onChange={(e) => setDiveDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time">{t("log.time")}</Label>
              <Input
                id="time"
                type="time"
                value={diveTime}
                onChange={(e) => setDiveTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("log.sessionType")}</Label>
            <Select
              value={sessionType}
              onValueChange={(v) => setSessionType(v as "training" | "competition")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="training">{t("common.training")}</SelectItem>
                <SelectItem value="competition">{t("common.competition")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sessionType === "competition" && (
            <div className="space-y-1.5 animate-fade-in">
              <Label>{t("log.federation")}</Label>
              <Select value={federation} onValueChange={(v) => setFederation(v as Federation)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEDERATIONS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="glass-card space-y-4 rounded-2xl p-5">
          <h2
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: "#B58BE8" }}
          >
            <HeartPulse className="size-4" /> {t("log.condition")}
          </h2>

          <div className="space-y-1.5">
            <Label htmlFor="sleep">{t("log.sleep")}</Label>
            <Input
              id="sleep"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              max="24"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              placeholder="e.g. 7.5"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="food">{t("log.food")}</Label>
            <Textarea
              id="food"
              value={foodNotes}
              onChange={(e) => setFoodNotes(e.target.value)}
              placeholder={t("log.foodPlaceholder")}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("log.mental")}</Label>
              <span className="text-sm font-semibold text-primary">
                {mentalState} · {t(`mental.${mentalState}`)}
              </span>
            </div>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[mentalState]}
              onValueChange={(v) => setMentalState(v[0])}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("log.notes")}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("log.notesPlaceholder")}
              rows={3}
            />
          </div>
        </div>

        {/* Equipment & Conditions — collapsible */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setGearOpen((o) => !o)}
            className="flex w-full items-center justify-between p-5 text-left"
          >
            <span
              className="flex items-center gap-2 text-sm font-semibold"
              style={{ color: "#EF9F27" }}
            >
              <Backpack className="size-4" /> {t("log.gear")}
            </span>
            <ChevronDown
              className="size-4 transition-transform duration-200"
              style={{ color: "#EF9F27", transform: gearOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>

          {gearOpen && (
            <div
              className="px-5 pb-5"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                alignItems: "start",
              }}
            >
              {/* row: neck weight | belt weight — not applicable to static apnea */}
              {discipline !== "STA" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="neck-weight">{t("log.neckWeight")}</Label>
                    <Input
                      id="neck-weight"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      value={neckWeight}
                      onChange={(e) => setNeckWeight(e.target.value)}
                      placeholder="0.0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="belt-weight">{t("log.beltWeight")}</Label>
                    <Input
                      id="belt-weight"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      value={beltWeight}
                      onChange={(e) => setBeltWeight(e.target.value)}
                      placeholder="0.0"
                    />
                  </div>
                </>
              )}

              {/* row: wetsuit | water temp */}
              <div className="space-y-1.5">
                <Label>{t("log.wetsuit")}</Label>
                <Select value={wetsuitMm} onValueChange={setWetsuitMm}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("log.wetsuitNone")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t("log.wetsuitNone")}</SelectItem>
                    <SelectItem value="1.5">1.5 mm</SelectItem>
                    <SelectItem value="3">3 mm</SelectItem>
                    <SelectItem value="5">5 mm</SelectItem>
                    <SelectItem value="7">7 mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="water-temp">{t("log.waterTemp")}</Label>
                <Input
                  id="water-temp"
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={waterTemp}
                  onChange={(e) => setWaterTemp(e.target.value)}
                  placeholder="e.g. 22"
                />
              </div>

              {/* row: buoyancy | (empty) */}
              <div className="space-y-1.5">
                <Label>{t("log.buoyancy")}</Label>
                <Select value={buoyancy} onValueChange={setBuoyancy}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{" — "}</SelectItem>
                    <SelectItem value="negative">{t("log.buoyancyNeg")}</SelectItem>
                    <SelectItem value="neutral">{t("log.buoyancyNeu")}</SelectItem>
                    <SelectItem value="positive">{t("log.buoyancyPos")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div />

              {/* fins fields — only when discipline has fins */}
              {finsCat !== "none" && (
                <>
                  {/* row: brand dropdown | model text */}
                  <div className="space-y-1.5">
                    <Label htmlFor="fins-brand">
                      {finsCat === "monofin"
                        ? lang === "el"
                          ? "Μονοπέδιλο — Μάρκα"
                          : "Monofin — Brand"
                        : lang === "el"
                          ? "Διπλά πέδιλα — Μάρκα"
                          : "Bifins — Brand"}
                    </Label>
                    <Select value={finsBrand} onValueChange={setFinsBrand}>
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">{" — "}</SelectItem>
                        <SelectItem value="Cetma">Cetma</SelectItem>
                        <SelectItem value="Sectus">Sectus</SelectItem>
                        <SelectItem value="other">
                          {lang === "el" ? "Άλλη μάρκα…" : "Other brand…"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {finsBrand === "other" && (
                      <Input
                        type="text"
                        value={finsModel.startsWith("__brand__") ? finsModel.slice(9) : ""}
                        onChange={(e) => setFinsModel("__brand__" + e.target.value)}
                        placeholder={lang === "el" ? "Γράψε μάρκα…" : "Type brand…"}
                        className="mt-1.5"
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fins-model">{t("log.finsModel")}</Label>
                    <Input
                      id="fins-model"
                      type="text"
                      value={finsModel.startsWith("__brand__") ? "" : finsModel}
                      onChange={(e) => setFinsModel(e.target.value)}
                      placeholder={lang === "el" ? "π.χ. Carbon 500" : "e.g. Carbon 500"}
                    />
                  </div>

                  {/* row: foot pocket (bifins only) | (empty) */}
                  {finsCat === "bifins" && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="foot-pocket">{t("log.footPocket")}</Label>
                        <Input
                          id="foot-pocket"
                          type="text"
                          value={footPocket}
                          onChange={(e) => setFootPocket(e.target.value)}
                          placeholder="e.g. Omer Stingray"
                        />
                      </div>
                      <div />
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* warm-up used before the dive — any discipline */}
        <div className="glass-card space-y-2 rounded-2xl p-5">
          <span
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: "#EF9F27" }}
          >
            <Flame className="size-4" /> {lang === "el" ? "Ζέσταμα που έκανες" : "Warm-up used"}
          </span>
          <Select
            value={warmupId || "none"}
            onValueChange={(v) => {
              if (v === "none") {
                setWarmupId("");
                setWarmupName("");
                return;
              }
              const w = allWarmups.find((x) => x.id === v);
              setWarmupId(v);
              setWarmupName(w ? (lang === "el" ? w.name_el : w.name_en) : "");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={lang === "el" ? "Κανένα" : "None"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{lang === "el" ? "— Κανένα" : "— None"}</SelectItem>
              {allWarmups.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {lang === "el" ? w.name_el : w.name_en}
                  {w.custom ? " · custom" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* STA session conditions — only for static apnea */}
        {discipline === "STA" && (
          <div className="glass-card space-y-4 rounded-2xl p-5">
            <span
              className="flex items-center gap-2 text-sm font-semibold"
              style={{ color: "#5DCAA5" }}
            >
              <Waves className="size-4" />{" "}
              {lang === "el" ? "Συνθήκες Στατικής" : "Static Conditions"}
            </span>

            <div className="space-y-1.5">
              <Label>{lang === "el" ? "Περιβάλλον" : "Environment"}</Label>
              <PillGroup
                value={environment}
                onChange={(v) => {
                  setEnvironment(v);
                  // wet static is always face-down (prone); dry is supine/seated
                  if (v === "wet") setPosture("prone");
                  else if (posture === "prone") setPosture("");
                }}
                options={[
                  { value: "dry", label: lang === "el" ? "Ξηρή" : "Dry" },
                  { value: "wet", label: lang === "el" ? "Υγρή" : "Wet" },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{lang === "el" ? "Στάση" : "Posture"}</Label>
              <PillGroup
                value={posture}
                onChange={setPosture}
                options={
                  environment === "wet"
                    ? [{ value: "prone", label: lang === "el" ? "Μπρούμυτα" : "Face down" }]
                    : [
                        { value: "supine", label: lang === "el" ? "Ανάσκελα" : "Supine" },
                        { value: "seated", label: lang === "el" ? "Καθιστή" : "Seated" },
                      ]
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>{lang === "el" ? "Κάλυμμα προσώπου" : "Face cover"}</Label>
              <PillGroup
                value={faceCover}
                onChange={setFaceCover}
                options={[
                  { value: "", label: lang === "el" ? "Κανένα" : "None" },
                  { value: "mask", label: lang === "el" ? "Μάσκα" : "Mask" },
                  { value: "goggles", label: lang === "el" ? "Γυαλάκια" : "Goggles" },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{lang === "el" ? "Κλιπ μύτης" : "Noseclip"}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNoseclip(true)}
                  className="rounded-lg py-2 text-xs font-semibold transition-all"
                  style={
                    noseclip
                      ? {
                          background: "rgba(29,158,117,0.2)",
                          color: "#5DCAA5",
                          border: "1px solid rgba(29,158,117,0.4)",
                        }
                      : {
                          background: "rgba(var(--ink),0.03)",
                          color: "rgba(var(--ink),0.5)",
                          border: "1px solid rgba(var(--ink),0.08)",
                        }
                  }
                >
                  {lang === "el" ? "Ναι" : "Yes"}
                </button>
                <button
                  type="button"
                  onClick={() => setNoseclip(false)}
                  className="rounded-lg py-2 text-xs font-semibold transition-all"
                  style={
                    !noseclip
                      ? {
                          background: "rgba(29,158,117,0.2)",
                          color: "#5DCAA5",
                          border: "1px solid rgba(29,158,117,0.4)",
                        }
                      : {
                          background: "rgba(var(--ink),0.03)",
                          color: "rgba(var(--ink),0.5)",
                          border: "1px solid rgba(var(--ink),0.08)",
                        }
                  }
                >
                  {lang === "el" ? "Όχι" : "No"}
                </button>
              </div>
            </div>

            {environment === "dry" && (
              <div className="space-y-1.5">
                <Label htmlFor="room-temp">
                  {lang === "el" ? "Θερμοκρασία χώρου (°C)" : "Room temperature (°C)"}
                </Label>
                <Input
                  id="room-temp"
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={roomTemp}
                  onChange={(e) => setRoomTemp(e.target.value)}
                  placeholder="e.g. 24"
                />
              </div>
            )}
            {environment === "wet" && (
              <p className="text-[0.7rem] text-muted-foreground">
                {lang === "el"
                  ? "Θερμοκρασία νερού: συμπλήρωσέ την στον Εξοπλισμό & Συνθήκες πιο πάνω."
                  : "Water temperature: set it in Equipment & Conditions above."}
              </p>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>
                  {lang === "el" ? "Ρυθμός breathe-up (δευτ.)" : "Breathe-up rhythm (sec)"}
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setBreatheIn("3");
                    setBreatheOut("3");
                  }}
                  className="rounded-md px-2 py-1 text-[0.6rem] font-bold"
                  style={{ background: "rgba(29,158,117,0.15)", color: "#5DCAA5" }}
                >
                  3 / 3
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={breatheIn}
                  onChange={(e) => setBreatheIn(e.target.value)}
                  placeholder={lang === "el" ? "Εισπνοή" : "Inhale"}
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={breatheOut}
                  onChange={(e) => setBreatheOut(e.target.value)}
                  placeholder={lang === "el" ? "Εκπνοή" : "Exhale"}
                />
              </div>
            </div>
          </div>
        )}

        {/* share-to-feed — per-dive community opt-in, DEFAULT OFF. The feed
            serves the sanitized feed_dives view only (result data, never
            notes/wellness/gear/conditions). Same control as the Spearo one. */}
        <button
          type="button"
          onClick={() => setSharedToFeed((v) => !v)}
          className="pressable flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left"
          style={{
            background: sharedToFeed ? "rgba(29,158,117,0.08)" : "rgba(var(--ink),0.03)",
            border: sharedToFeed
              ? "1px solid rgba(93,202,165,0.3)"
              : "1px solid rgba(var(--ink),0.08)",
          }}
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{
              background: sharedToFeed ? "rgba(29,158,117,0.16)" : "rgba(var(--ink),0.05)",
            }}
          >
            <Users
              className="size-4"
              style={{ color: sharedToFeed ? "#5DCAA5" : "rgba(var(--ink),0.4)" }}
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
            style={{ background: sharedToFeed ? "#1D9E75" : "rgba(var(--ink),0.12)" }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
              style={{ left: sharedToFeed ? 22 : 2 }}
            />
          </span>
        </button>

        <Button
          type="submit"
          variant="hero"
          size="lg"
          className="w-full"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? t("common.saving") : editId ? t("log.update") : t("log.save")}
        </Button>
      </form>
    </div>
  );
}

function PillGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(value === o.value ? ("" as T) : o.value)}
          className="rounded-lg px-2 py-2 text-xs font-semibold transition-all"
          style={
            value === o.value
              ? {
                  background: "rgba(29,158,117,0.2)",
                  color: "#5DCAA5",
                  border: "1px solid rgba(29,158,117,0.4)",
                }
              : {
                  background: "rgba(var(--ink),0.03)",
                  color: "rgba(var(--ink),0.5)",
                  border: "1px solid rgba(var(--ink),0.08)",
                }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
