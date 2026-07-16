import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, TriangleAlert, Wind, Timer } from "lucide-react";
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
const PAGE_TITLE = "Free CO₂ & O₂ Training Tables Generator for Freediving — Apnos";
const PAGE_DESCRIPTION =
  "Generate personalised CO₂ and O₂ static apnea training tables from your breath-hold PB. Free freediving tool by Apnos — dry training, easy to hard levels.";

const FAQ: { q: string; a: string }[] = [
  {
    q: "What is a CO₂ table in freediving?",
    a: "A CO₂ table is a series of breath-holds with progressively shorter rests. The hold stays fixed while recovery time shrinks, training your body to tolerate rising carbon dioxide — the main trigger of the urge to breathe.",
  },
  {
    q: "What is an O₂ table in freediving?",
    a: "An O₂ table keeps the rest fixed while each breath-hold gets progressively longer, adapting your body to work with lower oxygen levels and extending your comfortable hold time.",
  },
  {
    q: "How long should my breath-holds be in a training table?",
    a: "Tables are built from your static personal best (PB). A common starting point is holds around 20–30% of your PB for CO₂ tables. Enter your PB above and this generator scales every round for you across easy, medium and hard levels.",
  },
  {
    q: "Is it safe to train breath-hold tables alone?",
    a: "Only dry, never in water. Never practise breath-holds in water without a trained safety buddy — shallow water blackout can be fatal. Dry static tables on a couch or bed are the safe way to train alone.",
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
        { "@type": "ListItem", position: 2, name: "CO₂ & O₂ Tables", item: SITE_URL + PAGE_PATH },
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

function parseMMSS(s: string): number {
  const t = s.trim();
  if (t.includes(":")) {
    const [m, sec = "0"] = t.split(":");
    return (parseInt(m || "0", 10) || 0) * 60 + (parseInt(sec, 10) || 0);
  }
  const d = t.replace(/\D/g, "");
  if (!d) return 0;
  return (parseInt(d.slice(0, -2) || "0", 10) || 0) * 60 + (parseInt(d.slice(-2), 10) || 0);
}

const TEAL = "#1D9E75";
const TEAL_SOFT = "#5DCAA5";
const ORANGE = "#EF9F27";

function TablesToolPage() {
  const { lang } = useI18n();
  const el = lang === "el";
  // SSR defaults render a complete, realistic table (PB 4:00, CO₂ easy) so the
  // crawler-visible HTML contains the actual tool output, not an empty shell.
  const [pbStr, setPbStr] = useState("4:00");
  const [type, setType] = useState<StaTableType>("co2");
  const [level, setLevel] = useState<PresetLevel>("easy");

  const pbSecs = Math.max(30, parseMMSS(pbStr) || 240);
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
          <Link to="/" aria-label="Apnos home">
            <Logo onDark />
          </Link>
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
              <label
                htmlFor="pb"
                className="mb-1.5 block text-[0.6rem] font-bold tracking-wider text-white/35"
              >
                {el ? "ΤΟ PB ΣΟΥ ΣΤΗ ΣΤΑΤΙΚΗ (Λ:ΔΔ)" : "YOUR STATIC PB (M:SS)"}
              </label>
              <input
                id="pb"
                inputMode="numeric"
                value={pbStr}
                onChange={(e) => setPbStr(e.target.value.replace(/[^0-9:]/g, ""))}
                placeholder="4:00"
                className="w-full rounded-xl px-3 py-3 text-center text-lg font-bold text-white outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
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
              {el
                ? "Ασφάλεια: κάνε πίνακες ΜΟΝΟ σε ξηρή προπόνηση (καναπές/κρεβάτι). Ποτέ κρατήσεις αναπνοής στο νερό χωρίς εκπαιδευμένο συνασφαλιστή — το shallow water blackout σκοτώνει."
                : "Safety: practise tables DRY only (couch/bed). Never do breath-holds in water without a trained safety buddy — shallow water blackout kills."}
            </p>
          </div>

          {/* CTA */}
          <Link
            to="/auth"
            className="flex items-center justify-center gap-2 rounded-xl py-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #534AB7, #1D9E75)" }}
          >
            {el
              ? "Τρέξε τον πίνακα με φωνητικά cues & timer — δωρεάν"
              : "Run this table with voice cues & timer — free"}
            <ArrowRight className="size-4" />
          </Link>
          <p className="text-center text-[0.7rem] text-white/35">
            {el
              ? "Με λογαριασμό Apnos: ζωντανός χρονομετρητής, δόνηση, αποθήκευση πινάκων, ημερολόγιο βουτιών και verified κατατάξεις."
              : "With a free Apnos account: live runner, haptics, saved tables, a full dive log and verified rankings."}
          </p>

          {/* SEO copy — EN */}
          <section className="space-y-3 border-t border-white/10 pt-6 text-sm leading-relaxed text-white/55">
            <h2 className="text-base font-semibold text-white">
              How CO₂ and O₂ tables improve your breath-hold
            </h2>
            <p>
              CO₂ tables keep every hold the same length while the breathe-up between rounds gets
              shorter, teaching your body to stay relaxed as carbon dioxide builds up. O₂ tables do
              the opposite: the rest stays fixed while each hold gets longer, adapting you to lower
              oxygen levels. Together they are the foundation of static apnea (STA) training used by
              beginner and competitive freedivers alike.
            </p>
            <p>
              This generator scales every round from your personal best, the same engine used inside
              the Apnos freediving training log — where you can also run the table with a guided
              timer, log the session as a dive and watch your PBs grow.
            </p>
          </section>

          {/* SEO copy — EL */}
          <section className="space-y-3 text-sm leading-relaxed text-white/55">
            <h2 className="text-base font-semibold text-white">
              Πώς οι πίνακες CO₂ και O₂ βελτιώνουν την άπνοιά σου
            </h2>
            <p>
              Οι πίνακες CO₂ κρατούν σταθερή την κράτηση και μικραίνουν την ανάπαυση, μαθαίνοντας
              στο σώμα να μένει χαλαρό καθώς ανεβαίνει το διοξείδιο. Οι πίνακες O₂ κάνουν το
              αντίθετο: σταθερή ανάπαυση, ολοένα μεγαλύτερες κρατήσεις. Είναι η βάση της προπόνησης
              στατικής άπνοιας για αρχάριους και αγωνιστικούς ελεύθερους δύτες.
            </p>
          </section>

          {/* FAQ */}
          <section className="space-y-4 border-t border-white/10 pt-6">
            <h2 className="text-base font-semibold text-white">FAQ</h2>
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
