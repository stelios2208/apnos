import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, TriangleAlert, Wind, Timer, Plus, Minus } from "lucide-react";
import { Logo } from "@/components/Logo";
import { TableCard } from "@/components/TableCard";
import { useI18n } from "@/lib/i18n";
import { SITE_URL, OG_IMAGE } from "@/lib/site";
import {
  presetRounds,
  tableTotalSecs,
  PRESET_LEVELS,
  LEVEL_LABEL,
  type StaTableType,
  type PresetLevel,
} from "@/lib/sta-tables";
import { fmtClock } from "@/lib/warmups";

// ── Public SEO tool page ─────────────────────────────────────────────────────
// No login required — this is the indexable, shareable "CO2/O2 table generator"
// competitors don't offer as a crawlable page. It reuses the exact preset math
// the in-app STA Tables use, renders a full default table server-side (PB 4:00)
// so crawlers see real content, and funnels visitors to sign-up.

const PAGE_PATH = "/tools/co2-o2-tables";
// Ελληνική έκδοση — the visible page is uniformly Greek, so the snippet and
// the FAQ structured data are Greek too (Google requires JSON-LD FAQ text to
// match the on-page text). A separate English page will follow later.
const PAGE_TITLE = "Πίνακες CO₂ & O₂ για Ελεύθερη Κατάδυση — Δωρεάν Generator | Apnos";
const PAGE_DESCRIPTION =
  "Δωρεάν generator πινάκων CO₂ & O₂ για στατική άπνοια από το PB σου — 3 επίπεδα, ξηρή προπόνηση, οδηγίες ασφαλείας. Από το Apnos, το ημερολόγιο ελεύθερης κατάδυσης.";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Τι είναι ο πίνακας CO₂ στην ελεύθερη κατάδυση;",
    a: "Ο πίνακας CO₂ είναι μια σειρά από κρατήσεις αναπνοής με προοδευτικά μικρότερη ανάπαυση. Η κράτηση μένει σταθερή ενώ ο χρόνος αποκατάστασης μικραίνει, μαθαίνοντας στο σώμα σου να ανέχεται το διοξείδιο που ανεβαίνει — τη βασική αιτία της ανάγκης για αναπνοή.",
  },
  {
    q: "Τι είναι ο πίνακας O₂ στην ελεύθερη κατάδυση;",
    a: "Ο πίνακας O₂ κρατά σταθερή την ανάπαυση ενώ κάθε κράτηση μεγαλώνει προοδευτικά, προσαρμόζοντας το σώμα σου να λειτουργεί με λιγότερο οξυγόνο και επεκτείνοντας τον άνετο χρόνο κράτησης.",
  },
  {
    q: "Πόσο μεγάλες πρέπει να είναι οι κρατήσεις σε έναν πίνακα προπόνησης;",
    a: "Οι πίνακες χτίζονται από το προσωπικό σου ρεκόρ (PB) στη στατική άπνοια. Συνηθισμένη αφετηρία είναι κρατήσεις γύρω στο 20–30% του PB για πίνακες CO₂. Βάλε το PB σου παραπάνω και ο generator κλιμακώνει κάθε γύρο σε εύκολο, μεσαίο και δύσκολο επίπεδο.",
  },
  {
    q: "Είναι ασφαλές να προπονούμαι μόνος με πίνακες άπνοιας;",
    a: "Μόνο σε ξηρή προπόνηση, ποτέ στο νερό. Ποτέ κρατήσεις αναπνοής στο νερό χωρίς εκπαιδευμένο άτομο ασφαλείας δίπλα σου — η απώλεια αισθήσεων σε ρηχό νερό (shallow water blackout) μπορεί να είναι μοιραία. Οι ξηροί πίνακες σε καναπέ ή κρεβάτι είναι ο ασφαλής τρόπος να προπονείσαι μόνος.",
  },
];

const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "Apnos CO₂ & O₂ Table Generator",
      url: SITE_URL + PAGE_PATH,
      image: OG_IMAGE,
      applicationCategory: "SportsApplication",
      operatingSystem: "Web",
      description: PAGE_DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Apnos", item: SITE_URL + "/" },
        { "@type": "ListItem", position: 2, name: "Πίνακες CO₂ & O₂", item: SITE_URL + PAGE_PATH },
      ],
    },
  ],
});

export const Route = createFileRoute("/tools/co2-o2-tables")({
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESCRIPTION },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESCRIPTION },
      { property: "og:url", content: SITE_URL + PAGE_PATH },
      { name: "twitter:title", content: PAGE_TITLE },
      { name: "twitter:description", content: PAGE_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: SITE_URL + PAGE_PATH }],
    scripts: [{ type: "application/ld+json", children: JSON_LD }],
  }),
  component: TablesToolPage,
});

const TEAL = "#1D9E75";
const TEAL_SOFT = "#5DCAA5";
const ORANGE = "#EF9F27";

function TablesToolPage() {
  const { lang } = useI18n();
  const el = lang === "el";
  // SSR defaults render a complete, realistic table (PB 3:00, CO₂ easy) so the
  // crawler-visible HTML contains the actual tool output, not an empty shell.
  // PB is entered as minutes + seconds with +/- steppers (wet hands, big
  // targets) — a free-text field invited invalid input like "100".
  const [pbMin, setPbMin] = useState(3);
  const [pbSec, setPbSec] = useState(0);
  const [type, setType] = useState<StaTableType>("co2");
  const [level, setLevel] = useState<PresetLevel>("easy");

  const stepMin = (d: number) => setPbMin((m) => Math.min(10, Math.max(0, m + d)));
  const stepSec = (d: number) => setPbSec((s) => Math.min(55, Math.max(0, s + d)));

  const pbSecs = Math.max(30, pbMin * 60 + pbSec);
  const rounds = useMemo(() => presetRounds(type, level, pbSecs), [type, level, pbSecs]);

  const seg = (on: boolean) =>
    on
      ? { background: "rgba(29,158,117,0.2)", color: TEAL_SOFT, border: `1px solid ${TEAL}66` }
      : {
          background: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.45)",
          border: "1px solid rgba(255,255,255,0.08)",
        };

  return (
    <div className="relative min-h-screen" style={{ background: "#020a13" }}>
      <div className="mx-auto w-full max-w-md px-5 py-8">
        <header className="mb-8 flex items-center justify-between">
          {/* Logo is itself a <Link to="/"> — wrapping it in another Link
              nested <a> inside <a>, which is invalid HTML and forced a full
              hydration re-render (dropping early taps on the CTA). */}
          <Logo onDark />
          <Link
            to="/auth"
            className="rounded-lg px-3 py-1.5 text-xs font-bold"
            style={{ background: "rgba(29,158,117,0.15)", color: TEAL_SOFT }}
          >
            {el ? "Σύνδεση" : "Sign in"}
          </Link>
        </header>

        <main className="space-y-6">
          {/* hero */}
          <div>
            <h1 className="text-2xl font-semibold leading-tight text-white">
              {el ? (
                <>
                  Πίνακες CO₂ & O₂ για ελεύθερη κατάδυση —{" "}
                  <span style={{ color: TEAL_SOFT }}>δωρεάν generator</span>
                </>
              ) : (
                <>
                  Free CO₂ & O₂ training tables <span style={{ color: TEAL_SOFT }}>generator</span>{" "}
                  for freediving
                </>
              )}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              {el
                ? "Βάλε το PB σου στη στατική άπνοια και πάρε εξατομικευμένο πίνακα προπόνησης — αναπνοές και κρατήσεις ανά γύρο, σε 3 επίπεδα."
                : "Enter your static apnea personal best and get a personalised training table — breathe-ups and holds per round, at three difficulty levels."}
            </p>
          </div>

          {/* controls */}
          <div
            className="space-y-3 rounded-2xl p-4"
            style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex gap-2">
              <button
                onClick={() => setType("co2")}
                className="flex-1 rounded-xl py-2.5 text-xs font-bold"
                style={seg(type === "co2")}
              >
                <Wind className="mr-1 inline size-3.5" /> CO₂
              </button>
              <button
                onClick={() => setType("o2")}
                className="flex-1 rounded-xl py-2.5 text-xs font-bold"
                style={seg(type === "o2")}
              >
                <Timer className="mr-1 inline size-3.5" /> O₂
              </button>
            </div>
            <div className="flex gap-2">
              {PRESET_LEVELS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className="flex-1 rounded-xl py-2.5 text-xs font-bold"
                  style={seg(level === l)}
                >
                  {el ? LEVEL_LABEL[l].el : LEVEL_LABEL[l].en}
                </button>
              ))}
            </div>
            <div>
              <p className="mb-1.5 text-[0.6rem] font-bold tracking-wider text-white/35">
                {el ? "ΤΟ PB ΣΟΥ ΣΤΗ ΣΤΑΤΙΚΗ" : "YOUR STATIC PB"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <PbStepper
                  label={el ? "ΛΕΠΤΑ" : "MINUTES"}
                  value={String(pbMin)}
                  onDec={() => stepMin(-1)}
                  onInc={() => stepMin(1)}
                />
                <PbStepper
                  label={el ? "ΔΕΥΤΕΡΟΛΕΠΤΑ" : "SECONDS"}
                  value={String(pbSec).padStart(2, "0")}
                  onDec={() => stepSec(-5)}
                  onInc={() => stepSec(5)}
                />
              </div>
              <p
                className="mt-1.5 text-center font-mono text-sm font-bold"
                style={{ color: TEAL_SOFT }}
              >
                PB: {fmtClock(pbSecs)}
              </p>
            </div>
          </div>

          {/* generated table */}
          <section aria-label={el ? "Ο πίνακας προπόνησης" : "Your training table"}>
            <TableCard rounds={rounds} lang={lang} />
            <p className="mt-2 text-center text-[0.7rem] text-white/35">
              {rounds.length} {el ? "γύροι" : "rounds"} · {el ? "συνολικός χρόνος" : "total time"}{" "}
              {fmtClock(tableTotalSecs(rounds))}
            </p>
          </section>

          {/* safety */}
          <div
            className="flex gap-3 rounded-2xl p-4 text-xs leading-relaxed"
            style={{
              background: "rgba(239,159,39,0.08)",
              border: "1px solid rgba(239,159,39,0.3)",
            }}
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" style={{ color: ORANGE }} />
            <p className="text-white/70">
              Οι πίνακες άπνοιας είναι ΜΟΝΟ για ξηρή προπόνηση (καναπές, κρεβάτι). Ποτέ κρατήσεις
              αναπνοής στο νερό χωρίς εκπαιδευμένο άτομο ασφαλείας δίπλα σου — ακόμα κι αν είσαι
              έμπειρος. Αν είσαι αρχάριος, ξεκίνα με πιστοποιημένο εκπαιδευτή.
            </p>
          </div>

          {/* CTA — two-line layout: bold action + smaller subtext, arrow pinned
              right, ≥56px tall so it reads as the page's primary button */}
          <Link
            to="/auth"
            className="flex min-h-14 items-center justify-between gap-3 rounded-xl px-5 py-3 text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #534AB7, #1D9E75)" }}
          >
            <span className="flex min-w-0 flex-col text-left">
              <span className="truncate text-sm font-bold">
                {el ? "Τρέξε τον πίνακα με timer" : "Run this table with a timer"}
              </span>
              <span className="text-[0.7rem] text-white/70">
                {el ? "Δωρεάν με λογαριασμό Apnos" : "Free with an Apnos account"}
              </span>
            </span>
            <ArrowRight className="size-5 shrink-0" />
          </Link>
          <p className="text-center text-[0.7rem] text-white/35">
            {el
              ? "Με λογαριασμό Apnos: ζωντανός χρονομετρητής, δόνηση, αποθήκευση πινάκων, ημερολόγιο βουτιών και verified κατατάξεις."
              : "With a free Apnos account: live runner, haptics, saved tables, a full dive log and verified rankings."}
          </p>

          {/* SEO copy — ενιαία ελληνικά (η αγγλική σελίδα θα γίνει ξεχωριστά) */}
          <section className="space-y-3 border-t border-white/10 pt-6 text-sm leading-relaxed text-white/55">
            <h2 className="text-base font-semibold text-white">
              Πώς οι πίνακες CO₂ και O₂ βελτιώνουν την άπνοιά σου
            </h2>
            <p>
              Οι πίνακες CO₂ κρατούν σταθερή την κράτηση και μικραίνουν την ανάπαυση, μαθαίνοντας
              στο σώμα να μένει χαλαρό καθώς ανεβαίνει το διοξείδιο. Οι πίνακες O₂ κάνουν το
              αντίθετο: σταθερή ανάπαυση, ολοένα μεγαλύτερες κρατήσεις — προσαρμογή σε χαμηλότερα
              επίπεδα οξυγόνου. Μαζί αποτελούν τη βάση της προπόνησης στατικής άπνοιας (STA) για
              αρχάριους και αγωνιστικούς ελεύθερους δύτες.
            </p>
            <p>
              Ο generator κλιμακώνει κάθε γύρο από το προσωπικό σου ρεκόρ — με την ίδια μηχανή που
              χρησιμοποιεί το Apnos, το ημερολόγιο προπόνησης ελεύθερης κατάδυσης, όπου μπορείς να
              τρέξεις τον πίνακα με καθοδηγούμενο timer, να καταγράψεις τη συνεδρία ως βουτιά και να
              βλέπεις τα PB σου να ανεβαίνουν.
            </p>
          </section>

          {/* FAQ */}
          <section className="space-y-4 border-t border-white/10 pt-6">
            <h2 className="text-base font-semibold text-white">Συχνές ερωτήσεις</h2>
            {FAQ.map(({ q, a }) => (
              <div key={q}>
                <h3 className="text-sm font-semibold text-white/85">{q}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/50">{a}</p>
              </div>
            ))}
          </section>
        </main>

        <footer className="mt-10 text-center">
          <Link to="/" className="text-xs text-white/30 hover:text-white/60">
            ← Apnos — {el ? "Ημερολόγιο προπόνησης ελεύθερης κατάδυσης" : "Freediving training log"}
          </Link>
        </footer>
      </div>
    </div>
  );
}

// Minutes/seconds stepper — big 48px tap targets instead of free text, so the
// value is always valid (seconds clamp to 0-55 in 5s steps, minutes 0-10).
function PbStepper({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
}) {
  const btn =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white/70 transition-colors hover:text-white";
  const btnStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
  };
  return (
    <div>
      <p className="mb-1 text-center text-[0.55rem] font-bold tracking-wider text-white/30">
        {label}
      </p>
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={onDec}
          className={btn}
          style={btnStyle}
          aria-label={`${label} -`}
        >
          <Minus className="size-4" />
        </button>
        <span className="min-w-10 text-center font-mono text-2xl font-bold tabular-nums text-white">
          {value}
        </span>
        <button
          type="button"
          onClick={onInc}
          className={btn}
          style={btnStyle}
          aria-label={`${label} +`}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
