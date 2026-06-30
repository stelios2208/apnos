import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Trophy, Trash2, Moon, Brain, Waves, Plus, Pencil, Download,
  ChevronRight, ChevronDown, SlidersHorizontal, X, ArrowLeftRight,
  Search, LayoutList, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { deleteDive, divesToCsv, downloadCsv, fetchDives } from "@/lib/dives";
import { DISCIPLINE_MAP, type DisciplineCode, type Federation, formatResult } from "@/lib/diving";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { Dive } from "@/lib/diving";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Ιστορικό — Apnos" }] }),
  validateSearch: (s: Record<string, unknown>): { disc?: DisciplineCode } => ({
    disc: typeof s.disc === "string" ? (s.disc as DisciplineCode) : undefined,
  }),
  component: () => (
    <AppLayout>
      <History />
    </AppLayout>
  ),
});

// ── types ─────────────────────────────────────────────────────────────────────
type Segment = "all" | "pool" | "depth";
type SessionFilter = "all" | "training" | "competition";
type FedFilter = "all" | Federation;
type ViewMode = "list" | "month";

// ── helpers ───────────────────────────────────────────────────────────────────
const POOL_DISC  = ["STA", "DYN", "DYNB", "DNF"]  as DisciplineCode[];
const DEPTH_DISC = ["CWT", "CWTB", "CNF", "FIM"] as DisciplineCode[];

function isPool(d: string)  { return POOL_DISC.includes(d as DisciplineCode); }
function isDepth(d: string) { return DEPTH_DISC.includes(d as DisciplineCode); }

// month key → "YYYY-MM"
function monthKey(dive: Dive): string { return dive.dive_date.slice(0, 7); }

const MONTHS_EL = ["Ιανουάριος","Φεβρουάριος","Μάρτιος","Απρίλιος","Μάιος","Ιούνιος","Ιούλιος","Αύγουστος","Σεπτέμβριος","Οκτώβριος","Νοέμβριος","Δεκέμβριος"];
const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function monthLabel(key: string, lang: string): string {
  const [y, m] = key.split("-");
  const names = lang === "el" ? MONTHS_EL : MONTHS_EN;
  return `${names[parseInt(m, 10) - 1]} ${y}`;
}

function cardBorder(dive: Dive): string {
  if (dive.is_personal_best) return "#EF9F27";
  return isPool(dive.discipline) ? "#1D9E75" : "#9FE1CB";
}

function formatDiff(a: Dive, b: Dive): string {
  const unit = DISCIPLINE_MAP[a.discipline]?.unit ?? DISCIPLINE_MAP[b.discipline]?.unit;
  const diff = Math.abs(a.result - b.result);
  if (unit === "time") {
    const m = Math.floor(diff / 60);
    const s = Math.round(diff % 60);
    return m > 0 ? `+${m}:${s.toString().padStart(2, "0")}` : `+${s}s`;
  }
  return `+${diff}m`;
}

// ── main component ────────────────────────────────────────────────────────────
function History() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const search = useSearch({ from: "/history" });

  const [viewMode,      setViewMode]     = useState<ViewMode>("month");
  const [segment,       setSegment]      = useState<Segment>("all");
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [fedFilter,     setFedFilter]    = useState<FedFilter>("all");
  const [discFilter,    setDiscFilter]   = useState<DisciplineCode | null>(
    search.disc ?? null
  );
  const [searchQuery,   setSearchQuery]  = useState("");
  const [filterOpen,    setFilterOpen]   = useState(false);
  const [expanded,      setExpanded]     = useState<Set<string>>(new Set());
  const [compareIds,    setCompareIds]   = useState<string[]>([]);
  // month grouping: latest month open by default, rest collapsed
  const [openMonths,    setOpenMonths]   = useState<Set<string>>(new Set());
  const didInitMonths = useRef(false);

  // sync disc URL param
  useEffect(() => {
    if (search.disc) setDiscFilter(search.disc);
  }, [search.disc]);

  const { data: dives = [], isLoading } = useQuery({
    queryKey: ["dives", user?.id],
    queryFn: () => fetchDives(user!.id),
    enabled: !!user,
  });

  const remove = useMutation({
    mutationFn: (d: { id: string; discipline: DisciplineCode }) =>
      deleteDive(d.id, user?.id, d.discipline),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dives", user?.id] });
      toast.success(t("hist.deleted"));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error"),
  });

  const toggleExpand = (id: string) =>
    setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleCompare = (id: string) =>
    setCompareIds((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id);
      if (p.length >= 2)  return [p[1], id];
      return [...p, id];
    });

  const handleExport = () =>
    downloadCsv(`apnos-dives-${new Date().toISOString().slice(0, 10)}.csv`, divesToCsv(dives));

  // apply filters
  const filtered = useMemo(() => dives.filter((d) => {
    if (segment === "pool"  && !isPool(d.discipline))  return false;
    if (segment === "depth" && !isDepth(d.discipline)) return false;
    if (sessionFilter !== "all" && d.session_type !== sessionFilter) return false;
    if (fedFilter !== "all" && d.federation !== fedFilter) return false;
    if (discFilter && d.discipline !== discFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!d.discipline.toLowerCase().includes(q) && !d.notes?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [dives, segment, sessionFilter, fedFilter, discFilter, searchQuery]);

  // month grouping — sorted newest first
  const byMonth = useMemo(() => {
    const map = new Map<string, Dive[]>();
    for (const d of filtered) {
      const k = monthKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(d);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  // open latest month by default once data loads
  useEffect(() => {
    if (byMonth.length > 0 && !didInitMonths.current) {
      didInitMonths.current = true;
      setOpenMonths(new Set([byMonth[0][0]]));
    }
  }, [byMonth]);

  const toggleMonth = (key: string) =>
    setOpenMonths((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const poolDives  = filtered.filter((d) => isPool(d.discipline));
  const depthDives = filtered.filter((d) => isDepth(d.discipline));

  const compareDives = compareIds.map((id) => dives.find((d) => d.id === id)).filter(Boolean) as Dive[];

  // labels
  const SEG_LABELS: Record<Segment, string> = {
    all:   lang === "el" ? "Όλα"      : "All",
    pool:  lang === "el" ? "Πισίνα"   : "Pool",
    depth: lang === "el" ? "Θάλασσα"  : "Depth",
  };

  const activeFilters = (sessionFilter !== "all" ? 1 : 0) + (fedFilter !== "all" ? 1 : 0) + (discFilter ? 1 : 0);

  return (
    <div className="space-y-4 pb-24">

      {/* ── header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("hist.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("hist.sub")}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {/* view mode toggle */}
          {dives.length > 0 && (
            <div
              className="flex rounded-xl p-0.5"
              style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <button
                onClick={() => setViewMode("month")}
                className="flex size-8 items-center justify-center rounded-lg transition-all"
                style={{ background: viewMode === "month" ? "#1D9E75" : "transparent" }}
                title={lang === "el" ? "Ανά μήνα" : "By month"}
              >
                <CalendarDays className="size-3.5 text-white/70" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className="flex size-8 items-center justify-center rounded-lg transition-all"
                style={{ background: viewMode === "list" ? "#1D9E75" : "transparent" }}
                title={lang === "el" ? "Λίστα" : "List"}
              >
                <LayoutList className="size-3.5 text-white/70" />
              </button>
            </div>
          )}
          {dives.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
              <Download className="size-4" />
            </Button>
          )}
          {dives.length > 0 && (
            <button
              onClick={() => setFilterOpen(true)}
              className="relative flex size-9 items-center justify-center rounded-xl transition-colors"
              style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <SlidersHorizontal className="size-4 text-white/60" />
              {activeFilters > 0 && (
                <span
                  className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full text-[0.55rem] font-bold text-white"
                  style={{ background: "#1D9E75" }}
                >
                  {activeFilters}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── search bar ── */}
      {dives.length > 0 && (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <Search className="size-4 shrink-0 text-white/25" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === "el" ? "Αναζήτηση (π.χ. STA, AIDA)…" : "Search (e.g. STA, notes)…"}
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder-white/20"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-white/30 hover:text-white/60">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {/* active disc filter pill */}
      {discFilter && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">{lang === "el" ? "Φίλτρο:" : "Filter:"}</span>
          <button
            onClick={() => setDiscFilter(null)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: "rgba(29,158,117,0.15)", color: "#5DCAA5" }}
          >
            {discFilter} <X className="size-3" />
          </button>
        </div>
      )}

      {/* ── segment control ── */}
      {dives.length > 0 && (
        <div
          className="flex rounded-full p-1"
          style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {(["all", "pool", "depth"] as Segment[]).map((s) => (
            <button
              key={s}
              onClick={() => { setSegment(s); setDiscFilter(null); }}
              className="flex-1 rounded-full py-2 text-xs font-semibold transition-all"
              style={
                segment === s
                  ? { background: "#1D9E75", color: "#fff" }
                  : { color: "rgba(255,255,255,0.45)" }
              }
            >
              {SEG_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* ── content ── */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : dives.length === 0 ? (
        <EmptyState t={t} />
      ) : filtered.length === 0 ? (
        <FilterEmpty lang={lang} onReset={() => { setSegment("all"); setSessionFilter("all"); setFedFilter("all"); setDiscFilter(null); setSearchQuery(""); }} />
      ) : viewMode === "month" ? (
        /* ── MONTH VIEW ── */
        <div className="space-y-3">
          {byMonth.map(([key, monthDives]) => {
            const isOpen = openMonths.has(key);
            return (
              <div key={key} className="overflow-hidden rounded-2xl" style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.05)" }}>
                <button
                  onClick={() => toggleMonth(key)}
                  className="flex w-full items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white">{monthLabel(key, lang)}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[0.6rem] font-bold"
                      style={{ background: "rgba(29,158,117,0.15)", color: "#5DCAA5" }}
                    >
                      {monthDives.length} {lang === "el" ? "βουτιές" : "dives"}
                    </span>
                  </div>
                  {isOpen
                    ? <ChevronDown className="size-4 text-white/30" />
                    : <ChevronRight className="size-4 text-white/30" />
                  }
                </button>
                {isOpen && (
                  <div className="space-y-2 border-t px-3 pb-3 pt-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    {monthDives.map((dive) => (
                      <DiveCard
                        key={dive.id}
                        dive={dive}
                        isExpanded={expanded.has(dive.id)}
                        isComparing={compareIds.includes(dive.id)}
                        onToggle={() => toggleExpand(dive.id)}
                        onCompare={() => toggleCompare(dive.id)}
                        onDelete={() => remove.mutate({ id: dive.id, discipline: dive.discipline })}
                        lang={lang}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── LIST VIEW (by environment) ── */
        <div className="space-y-6">
          {(segment === "all" || segment === "pool") && poolDives.length > 0 && (
            <EnvironmentSection
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <line x1="2" y1="5" x2="14" y2="5" stroke="#5DCAA5" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="2" y1="8" x2="14" y2="8" stroke="#5DCAA5" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="2" y1="11" x2="14" y2="11" stroke="#5DCAA5" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              }
              label={lang === "el" ? "ΠΙΣΙΝΑ" : "POOL"}
              accentColor="#1D9E75"
              disciplines={POOL_DISC}
              dives={poolDives}
              discFilter={discFilter}
              onDiscFilter={(c) => setDiscFilter(discFilter === c ? null : c)}
              expanded={expanded}
              onToggle={toggleExpand}
              compareIds={compareIds}
              onCompare={toggleCompare}
              onDelete={(d) => remove.mutate(d)}
              lang={lang}
              t={t}
            />
          )}
          {(segment === "all" || segment === "depth") && depthDives.length > 0 && (
            <EnvironmentSection
              icon={
                <svg width="16" height="16" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                  <path
                    d="M25.47 4.96 A16 16 0 1 1 14.53 4.96"
                    stroke="#5DCAA5"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <circle cx="20" cy="25" r="4.2" fill="#1D9E75" />
                  <circle cx="20" cy="15.5" r="1.05" fill="#5DCAA5" opacity="0.55" />
                  <circle cx="20" cy="19.2" r="1.5" fill="#5DCAA5" opacity="0.8" />
                </svg>
              }
              label={lang === "el" ? "ΘΑΛΑΣΣΑ" : "DEPTH"}
              accentColor="#9FE1CB"
              disciplines={DEPTH_DISC}
              dives={depthDives}
              discFilter={discFilter}
              onDiscFilter={(c) => setDiscFilter(discFilter === c ? null : c)}
              expanded={expanded}
              onToggle={toggleExpand}
              compareIds={compareIds}
              onCompare={toggleCompare}
              onDelete={(d) => remove.mutate(d)}
              lang={lang}
              t={t}
            />
          )}
        </div>
      /* end list view */
      )}

      {/* ── compare bar ── */}
      {compareDives.length > 0 && (
        <CompareBar
          dives={compareDives}
          onClear={() => setCompareIds([])}
          lang={lang}
        />
      )}

      {/* ── filter sheet ── */}
      <Drawer open={filterOpen} onOpenChange={setFilterOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{lang === "el" ? "Φίλτρα" : "Filters"}</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-6 px-4 pb-8 pt-2">

            {/* session type */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
                {lang === "el" ? "Τύπος" : "Session type"}
              </p>
              <div className="flex gap-2">
                {(["all", "training", "competition"] as SessionFilter[]).map((v) => {
                  const label = v === "all"
                    ? (lang === "el" ? "Όλα" : "All")
                    : v === "training"
                      ? t("common.training")
                      : t("common.competition");
                  return (
                    <button
                      key={v}
                      onClick={() => setSessionFilter(v)}
                      className="rounded-xl px-4 py-2 text-sm font-semibold transition-all"
                      style={
                        sessionFilter === v
                          ? { background: "#1D9E75", color: "#fff" }
                          : { background: "#0d1320", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* federation */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
                {lang === "el" ? "Ομοσπονδία" : "Federation"}
              </p>
              <div className="flex gap-2">
                {(["all", "AIDA", "CMAS"] as FedFilter[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setFedFilter(v)}
                    className="rounded-xl px-4 py-2 text-sm font-semibold transition-all"
                    style={
                      fedFilter === v
                        ? { background: "#1D9E75", color: "#fff" }
                        : { background: "#0d1320", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }
                    }
                  >
                    {v === "all" ? (lang === "el" ? "Όλες" : "All") : v}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              style={{ background: "#1D9E75", color: "#fff" }}
              onClick={() => setFilterOpen(false)}
            >
              {lang === "el" ? "Εφαρμογή" : "Apply"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

// ── EnvironmentSection ────────────────────────────────────────────────────────
function EnvironmentSection({
  icon, label, accentColor, disciplines, dives,
  discFilter, onDiscFilter, expanded, onToggle,
  compareIds, onCompare, onDelete, lang, t,
}: {
  icon: ReactNode; label: string; accentColor: string;
  disciplines: DisciplineCode[]; dives: Dive[];
  discFilter: DisciplineCode | null; onDiscFilter: (c: DisciplineCode) => void;
  expanded: Set<string>; onToggle: (id: string) => void;
  compareIds: string[]; onCompare: (id: string) => void;
  onDelete: (d: { id: string; discipline: DisciplineCode }) => void;
  lang: string; t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const filtered = discFilter ? dives.filter((d) => d.discipline === discFilter) : dives;
  const competition = filtered.filter((d) => d.session_type === "competition");
  const training    = filtered.filter((d) => d.session_type !== "competition");

  return (
    <div className="space-y-3">
      {/* section header */}
      <div className="flex items-center gap-2">
        <div className="w-1 rounded-full" style={{ height: 20, background: accentColor }} />
        <span className="text-xs font-bold tracking-[0.18em]" style={{ color: accentColor }}>
          {icon} {label}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[0.6rem] font-bold"
          style={{ background: `${accentColor}20`, color: accentColor }}
        >
          {filtered.length}
        </span>
        <div className="h-px flex-1" style={{ background: `linear-gradient(to right, ${accentColor}30, transparent)` }} />
      </div>

      {/* discipline chips */}
      <div className="flex gap-1.5">
        {disciplines.filter((c) => dives.some((d) => d.discipline === c)).map((c) => (
          <button
            key={c}
            onClick={() => onDiscFilter(c)}
            className="rounded-lg px-2.5 py-1 text-[0.65rem] font-bold transition-all"
            style={
              discFilter === c
                ? { background: accentColor, color: "#fff" }
                : { background: "#0d1320", color: accentColor, border: `1px solid ${accentColor}30` }
            }
          >
            {c}
          </button>
        ))}
      </div>

      {/* subsections */}
      {competition.length > 0 && (
        <SubSection
          label={t("common.competition")}
          labelEl={lang === "el" ? "ΑΓΩΝΕΣ" : "COMPETITION"}
          dives={competition}
          expanded={expanded} onToggle={onToggle}
          compareIds={compareIds} onCompare={onCompare}
          onDelete={onDelete} lang={lang} t={t}
        />
      )}
      {training.length > 0 && (
        <SubSection
          label={t("common.training")}
          labelEl={lang === "el" ? "ΠΡΟΠΟΝΗΣΗ" : "TRAINING"}
          dives={training}
          expanded={expanded} onToggle={onToggle}
          compareIds={compareIds} onCompare={onCompare}
          onDelete={onDelete} lang={lang} t={t}
        />
      )}
    </div>
  );
}

// ── SubSection ────────────────────────────────────────────────────────────────
function SubSection({
  labelEl, dives, expanded, onToggle, compareIds, onCompare, onDelete, lang, t,
}: {
  label: string; labelEl: string; dives: Dive[];
  expanded: Set<string>; onToggle: (id: string) => void;
  compareIds: string[]; onCompare: (id: string) => void;
  onDelete: (d: { id: string; discipline: DisciplineCode }) => void;
  lang: string; t: (k: string, v?: Record<string, string | number>) => string;
}) {
  return (
    <div className="space-y-2 pl-3">
      <div className="flex items-center gap-2">
        <span className="text-[0.6rem] font-semibold tracking-[0.18em] text-white/35">{labelEl}</span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[0.55rem] font-bold"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
        >
          {dives.length}
        </span>
      </div>
      <ul className="space-y-2">
        {dives.map((dive) => (
          <DiveCard
            key={dive.id}
            dive={dive}
            isExpanded={expanded.has(dive.id)}
            isComparing={compareIds.includes(dive.id)}
            onToggle={() => onToggle(dive.id)}
            onCompare={() => onCompare(dive.id)}
            onDelete={() => onDelete({ id: dive.id, discipline: dive.discipline })}
            lang={lang}
            t={t}
          />
        ))}
      </ul>
    </div>
  );
}

// ── DiveCard ──────────────────────────────────────────────────────────────────
function DiveCard({ dive, isExpanded, isComparing, onToggle, onCompare, onDelete, lang, t }: {
  dive: Dive; isExpanded: boolean; isComparing: boolean;
  onToggle: () => void; onCompare: () => void; onDelete: () => void;
  lang: string; t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const border = cardBorder(dive);

  return (
    <li
      className="overflow-hidden rounded-xl transition-all"
      style={{
        background: "#0d1320",
        border: isComparing ? `1px solid ${border}` : "1px solid rgba(255,255,255,0.06)",
        borderLeft: `3px solid ${border}`,
      }}
    >
      {/* top row: badges + compare */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <span
          className="shrink-0 rounded-md px-2 py-0.5 text-[0.6rem] font-bold tracking-wider"
          style={{ background: "rgba(29,158,117,0.15)", color: "#5DCAA5" }}
        >
          {dive.discipline}
        </span>

        {dive.is_personal_best && (
          <span
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[0.6rem] font-bold"
            style={{ background: "rgba(239,159,39,0.15)", color: "#EF9F27" }}
          >
            🏆 PB
          </span>
        )}

        {dive.federation && (
          <span
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[0.6rem] font-semibold"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
          >
            {dive.federation}
          </span>
        )}

        <div className="flex-1" />

        <button
          onClick={(e) => { e.stopPropagation(); onCompare(); }}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[0.6rem] font-semibold transition-all"
          style={isComparing ? { background: "#1D9E75", color: "#fff" } : { color: "rgba(255,255,255,0.3)" }}
        >
          <ArrowLeftRight className="size-3" />
          {lang === "el" ? "Σύγκριση" : "Compare"}
        </button>
      </div>

      {/* result — tapping navigates to detail page */}
      <Link to="/dive/$id" params={{ id: dive.id }} className="block px-3 pb-1 pt-1">
        <span
          className="font-bold tabular-nums text-white"
          style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.75rem", lineHeight: 1.1 }}
        >
          {formatResult(dive.discipline, dive.result)}
        </span>
      </Link>

      {/* meta + expand toggle */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 pb-3 text-left"
      >
        <span className="text-[0.65rem] text-white/35">
          {format(new Date(`${dive.dive_date}T${dive.dive_time ?? "00:00"}`), "d MMM yyyy")}
          {dive.dive_time ? ` · ${dive.dive_time}` : ""}
        </span>
        {isExpanded
          ? <ChevronDown className="size-3.5 text-white/25" />
          : <ChevronRight className="size-3.5 text-white/25" />
        }
      </button>

      {/* expanded details */}
      {isExpanded && (
        <div
          className="space-y-3 border-t px-3 py-3"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          {(dive.sleep_hours != null || dive.mental_state != null) && (
            <div className="flex flex-wrap gap-4 text-xs text-white/45">
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
          )}
          {dive.food_notes && (
            <p className="text-xs text-white/40">
              <span className="font-medium text-white/60">{t("hist.foodLabel")}</span> {dive.food_notes}
            </p>
          )}
          {dive.notes && (
            <p className="text-xs text-white/40">
              <span className="font-medium text-white/60">{t("hist.notesLabel")}</span> {dive.notes}
            </p>
          )}
          <div className="flex items-center justify-end gap-1 pt-1">
            <Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-white/40">
              <Link to="/log" search={{ edit: dive.id }}>
                <Pencil className="size-3" /> {t("common.edit")}
              </Link>
            </Button>
            <Button
              variant="ghost" size="sm"
              className="h-7 gap-1.5 text-xs text-red-400/60 hover:text-red-400"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="size-3" /> {t("common.delete")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

// ── CompareBar ────────────────────────────────────────────────────────────────
function CompareBar({ dives, onClear, lang }: {
  dives: Dive[]; onClear: () => void; lang: string;
}) {
  const [a, b] = dives;

  return (
    <div
      className="fixed inset-x-0 bottom-16 z-50 mx-auto max-w-2xl px-4"
    >
      <div
        className="rounded-2xl p-4 shadow-2xl"
        style={{ background: "#0d1320", border: "1px solid rgba(93,202,165,0.25)" }}
      >
        {dives.length === 1 ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="size-4 text-[#5DCAA5]" />
              <span className="text-sm text-white/70">
                {lang === "el"
                  ? `${a.discipline} · ${formatResult(a.discipline, a.result)} — επέλεξε 2η βουτιά`
                  : `${a.discipline} · ${formatResult(a.discipline, a.result)} — select 2nd dive`}
              </span>
            </div>
            <button onClick={onClear} className="text-white/30 hover:text-white/60">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-[0.15em] text-[#5DCAA5]">
                {lang === "el" ? "ΣΥΓΚΡΙΣΗ" : "COMPARE"}
              </span>
              <button onClick={onClear} className="text-white/30 hover:text-white/60">
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[a, b].map((dive) => (
                <div
                  key={dive.id}
                  className="rounded-xl p-3"
                  style={{ background: "rgba(255,255,255,0.04)", borderLeft: `3px solid ${cardBorder(dive)}` }}
                >
                  <p className="text-[0.6rem] font-bold tracking-wider text-[#5DCAA5]">{dive.discipline}</p>
                  <p className="mt-0.5 text-lg font-bold text-white tabular-nums">
                    {formatResult(dive.discipline, dive.result)}
                  </p>
                  <p className="text-[0.6rem] text-white/35">
                    {dive.session_type === "competition"
                      ? (lang === "el" ? "Αγώνας" : "Competition")
                      : (lang === "el" ? "Προπόνηση" : "Training")}
                  </p>
                </div>
              ))}
            </div>
            {a.discipline === b.discipline && (
              <div
                className="rounded-xl px-3 py-2 text-center text-xs font-semibold"
                style={{ background: "rgba(29,158,117,0.12)", color: "#5DCAA5" }}
              >
                {formatDiff(a, b)}{" "}
                {lang === "el" ? "διαφορά" : "difference"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── empty states ──────────────────────────────────────────────────────────────
function EmptyState({ t }: { t: (k: string) => string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/08 p-10 text-center" style={{ background: "#0d1320" }}>
      <Waves className="size-10 opacity-30" style={{ color: "#5DCAA5" }} />
      <p className="mt-4 font-semibold text-white">{t("hist.empty")}</p>
      <p className="mt-1 text-sm text-white/40">{t("hist.emptySub")}</p>
      <Button asChild className="mt-6" style={{ background: "#1D9E75" }}>
        <Link to="/log"><Plus className="mr-1.5 size-4" />{t("hist.newDive")}</Link>
      </Button>
    </div>
  );
}

function FilterEmpty({ lang, onReset }: { lang: string; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/06 p-10 text-center" style={{ background: "#0d1320" }}>
      <span className="text-4xl opacity-25">🤿</span>
      <p className="mt-4 text-sm font-semibold text-white/60">
        {lang === "el" ? "Δεν βρέθηκαν βουτιές" : "No dives found"}
      </p>
      <p className="mt-1 text-xs text-white/30">
        {lang === "el" ? "Δοκίμασε διαφορετικό φίλτρο" : "Try a different filter"}
      </p>
      <button
        onClick={onReset}
        className="mt-4 text-xs font-semibold"
        style={{ color: "#5DCAA5" }}
      >
        {lang === "el" ? "Καθαρισμός φίλτρων" : "Clear filters"}
      </button>
    </div>
  );
}
