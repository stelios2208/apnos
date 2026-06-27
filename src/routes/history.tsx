import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Trash2, Moon, Brain, Waves, Plus, Pencil, Download, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { deleteDive, divesToCsv, downloadCsv, fetchDives } from "@/lib/dives";
import { disciplineName, formatResult } from "@/lib/diving";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import type { Dive } from "@/lib/diving";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Ιστορικό — Apnos" }] }),
  component: () => (
    <AppLayout>
      <History />
    </AppLayout>
  ),
});

// ─── discipline groups ────────────────────────────────────────────────────────
const POOL = ["STA", "DYN", "DYNB", "DNF"] as const;
const DEPTH = ["CWT", "CWTB", "CNF", "FIM"] as const;

type FilterValue = "all" | "pool" | "depth" | typeof POOL[number] | typeof DEPTH[number];

interface Chip { label: string; value: FilterValue; sep?: boolean }

const CHIPS: Chip[] = [
  { label: "Όλα",     value: "all" },
  { label: "Πισίνα",  value: "pool" },
  { label: "Θάλασσα", value: "depth" },
  { label: "STA",  value: "STA",  sep: true },
  { label: "DYN",  value: "DYN" },
  { label: "DYNB", value: "DYNB" },
  { label: "DNF",  value: "DNF" },
  { label: "CWT",  value: "CWT",  sep: true },
  { label: "CWTB", value: "CWTB" },
  { label: "CNF",  value: "CNF" },
  { label: "FIM",  value: "FIM" },
];

function matchFilter(discipline: string, f: FilterValue): boolean {
  if (f === "all")   return true;
  if (f === "pool")  return (POOL  as readonly string[]).includes(discipline);
  if (f === "depth") return (DEPTH as readonly string[]).includes(discipline);
  return discipline === f;
}

function isPool(discipline: string)  { return (POOL  as readonly string[]).includes(discipline); }
function isDepth(discipline: string) { return (DEPTH as readonly string[]).includes(discipline); }

// ─── main component ───────────────────────────────────────────────────────────
function History() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterValue>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: dives = [], isLoading } = useQuery({
    queryKey: ["dives", user?.id],
    queryFn: () => fetchDives(user!.id),
    enabled: !!user,
  });

  const remove = useMutation({
    mutationFn: (d: { id: string; discipline: Dive["discipline"] }) =>
      deleteDive(d.id, user?.id, d.discipline),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dives", user?.id] });
      toast.success(t("hist.deleted"));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error"),
  });

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleExport = () =>
    downloadCsv(`apnos-dives-${new Date().toISOString().slice(0, 10)}.csv`, divesToCsv(dives));

  const filtered = dives.filter((d) => matchFilter(d.discipline, filter));

  // split into pool / depth buckets for section grouping
  const showPool  = filter === "all" || filter === "pool"  || (POOL  as readonly string[]).includes(filter);
  const showDepth = filter === "all" || filter === "depth" || (DEPTH as readonly string[]).includes(filter);
  const poolDives  = filtered.filter((d) => isPool(d.discipline));
  const depthDives = filtered.filter((d) => isDepth(d.discipline));

  return (
    <div className="space-y-5">

      {/* ── header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("hist.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("hist.sub")}</p>
        </div>
        {dives.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0 gap-1.5">
            <Download className="size-4" /> {t("common.export")}
          </Button>
        )}
      </div>

      {/* ── filter chips ── */}
      {dives.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CHIPS.map((chip) => (
            <div key={chip.value} className="flex shrink-0 items-center gap-1.5">
              {chip.sep && (
                <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", borderRadius: 1 }} />
              )}
              <button
                onClick={() => setFilter(chip.value)}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all"
                style={
                  filter === chip.value
                    ? { background: "#1D9E75", color: "#fff" }
                    : { background: "#0d1320", color: "#5DCAA5", border: "1px solid rgba(93,202,165,0.25)" }
                }
              >
                {chip.label}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── states ── */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : dives.length === 0 ? (
        <EmptyState t={t} />
      ) : filtered.length === 0 ? (
        <FilterEmpty />
      ) : (
        <div className="space-y-8">
          {showPool && poolDives.length > 0 && (
            <Section
              emoji="🏊"
              label="ΠΙΣΙΝΑ"
              dives={poolDives}
              expanded={expanded}
              onToggle={toggleExpand}
              onDelete={(d) => remove.mutate(d)}
              lang={lang}
              t={t}
            />
          )}
          {showDepth && depthDives.length > 0 && (
            <Section
              emoji="🌊"
              label="ΘΑΛΑΣΣΑ"
              dives={depthDives}
              expanded={expanded}
              onToggle={toggleExpand}
              onDelete={(d) => remove.mutate(d)}
              lang={lang}
              t={t}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────
function Section({
  emoji, label, dives, expanded, onToggle, onDelete, lang, t,
}: {
  emoji: string;
  label: string;
  dives: Dive[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onDelete: (d: { id: string; discipline: Dive["discipline"] }) => void;
  lang: string;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const competition = dives.filter((d) => d.session_type === "competition");
  const training    = dives.filter((d) => d.session_type !== "competition");

  return (
    <div className="space-y-4">
      {/* section header */}
      <div className="flex items-center gap-3">
        <span className="text-base">{emoji}</span>
        <span className="text-xs font-bold tracking-[0.2em] text-white/70">{label}</span>
        <div className="h-px flex-1" style={{ background: "linear-gradient(to right, rgba(93,202,165,0.3), transparent)" }} />
      </div>

      {competition.length > 0 && (
        <SubSection
          label="ΑΓΩΝΕΣ"
          count={competition.length}
          dives={competition}
          expanded={expanded}
          onToggle={onToggle}
          onDelete={onDelete}
          lang={lang}
          t={t}
        />
      )}
      {training.length > 0 && (
        <SubSection
          label="ΠΡΟΠΟΝΗΣΗ"
          count={training.length}
          dives={training}
          expanded={expanded}
          onToggle={onToggle}
          onDelete={onDelete}
          lang={lang}
          t={t}
        />
      )}
    </div>
  );
}

// ─── SubSection ───────────────────────────────────────────────────────────────
function SubSection({
  label, count, dives, expanded, onToggle, onDelete, lang, t,
}: {
  label: string;
  count: number;
  dives: Dive[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onDelete: (d: { id: string; discipline: Dive["discipline"] }) => void;
  lang: string;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pl-1">
        <span className="text-[0.6rem] font-semibold tracking-[0.2em] text-white/40">{label}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[0.6rem] font-bold tabular-nums"
          style={{ background: "rgba(93,202,165,0.12)", color: "#5DCAA5" }}
        >
          {count}
        </span>
      </div>

      <ul className="space-y-2">
        {dives.map((dive) => (
          <DiveCard
            key={dive.id}
            dive={dive}
            isExpanded={expanded.has(dive.id)}
            onToggle={() => onToggle(dive.id)}
            onDelete={() => onDelete({ id: dive.id, discipline: dive.discipline })}
            lang={lang}
            t={t}
          />
        ))}
      </ul>
    </div>
  );
}

// ─── DiveCard ─────────────────────────────────────────────────────────────────
function DiveCard({
  dive, isExpanded, onToggle, onDelete, lang, t,
}: {
  dive: Dive;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  lang: string;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  return (
    <li
      className="overflow-hidden rounded-xl"
      style={{ background: "#0d1320", borderLeft: "3px solid rgba(93,202,165,0.4)", border: "1px solid rgba(255,255,255,0.06)", borderLeftWidth: 3, borderLeftColor: "rgba(93,202,165,0.4)" }}
    >
      {/* ── collapsed row ── */}
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        {/* discipline chip */}
        <span
          className="shrink-0 rounded-md px-2 py-1 text-[0.65rem] font-bold tracking-wide"
          style={{ background: "rgba(29,158,117,0.15)", color: "#5DCAA5" }}
        >
          {dive.discipline}
        </span>

        {/* result */}
        <span className="flex-1 text-xl font-bold tabular-nums text-white">
          {formatResult(dive.discipline, dive.result)}
        </span>

        {/* PB badge */}
        {dive.is_personal_best && (
          <span
            className="shrink-0 rounded-md px-2 py-1 text-[0.6rem] font-bold"
            style={{ background: "rgba(239,159,39,0.15)", color: "#EF9F27" }}
          >
            🏆 PB
          </span>
        )}

        {/* expand toggle */}
        {isExpanded
          ? <ChevronUp className="size-4 shrink-0 text-white/30" />
          : <ChevronDown className="size-4 shrink-0 text-white/30" />
        }
      </button>

      {/* ── meta row (always visible) ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 text-[0.65rem] text-white/40">
        <span>{format(new Date(`${dive.dive_date}T${dive.dive_time ?? "00:00"}`), "d MMM yyyy")}</span>
        {dive.dive_time && <><span>·</span><span>{dive.dive_time}</span></>}
        <span>·</span>
        <span style={{ color: dive.session_type === "competition" ? "#5DCAA5" : undefined }}>
          {dive.session_type === "competition" ? t("common.competition") : t("common.training")}
        </span>
        {dive.federation && (
          <>
            <span>·</span>
            <span
              className="rounded px-1.5 py-0.5 font-semibold"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
            >
              {dive.federation}
            </span>
          </>
        )}
      </div>

      {/* ── expanded details ── */}
      {isExpanded && (
        <div
          className="space-y-3 border-t px-4 py-3"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex flex-wrap gap-4 text-xs text-white/50">
            {dive.sleep_hours != null && (
              <span className="inline-flex items-center gap-1.5">
                <Moon className="size-3.5 text-[#5DCAA5]" />
                {t("hist.sleepShort", { h: dive.sleep_hours })}
              </span>
            )}
            {dive.mental_state != null && (
              <span className="inline-flex items-center gap-1.5">
                <Brain className="size-3.5 text-[#5DCAA5]" />
                {t("hist.mind", { n: dive.mental_state })}
              </span>
            )}
          </div>

          {dive.food_notes && (
            <p className="text-xs text-white/40">
              <span className="font-medium text-white/70">{t("hist.foodLabel")}</span>{" "}
              {dive.food_notes}
            </p>
          )}
          {dive.notes && (
            <p className="text-xs text-white/40">
              <span className="font-medium text-white/70">{t("hist.notesLabel")}</span>{" "}
              {dive.notes}
            </p>
          )}

          {/* action row */}
          <div className="flex items-center justify-end gap-1 pt-1">
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-white/50">
              <Link to="/log" search={{ edit: dive.id }}>
                <Pencil className="size-3.5" /> {t("common.edit")}
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-red-400/70 hover:text-red-400"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="size-3.5" /> {t("common.delete")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

// ─── empty states ─────────────────────────────────────────────────────────────
function EmptyState({ t }: { t: (k: string) => string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/10 p-10 text-center" style={{ background: "#0d1320" }}>
      <Waves className="size-10 text-[#5DCAA5] opacity-40" />
      <p className="mt-4 font-semibold text-white">{t("hist.empty")}</p>
      <p className="mt-1 text-sm text-white/40">{t("hist.emptySub")}</p>
      <Button asChild className="mt-6" style={{ background: "#1D9E75" }}>
        <Link to="/log">
          <Plus className="size-4 mr-1.5" /> {t("hist.newDive")}
        </Link>
      </Button>
    </div>
  );
}

function FilterEmpty() {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/10 p-10 text-center" style={{ background: "#0d1320" }}>
      <span className="text-4xl opacity-30">🤿</span>
      <p className="mt-4 text-sm font-semibold text-white/60">Δεν βρέθηκαν βουτιές</p>
      <p className="mt-1 text-xs text-white/30">Δοκίμασε διαφορετικό φίλτρο</p>
    </div>
  );
}
