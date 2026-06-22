import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Timer, TrendingUp, Waves, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Bubbles } from "@/components/Bubbles";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Apnos — Freediving Training Log" },
      {
        name: "description",
        content: "Log every freediving session, track personal bests across STA, DYN, CWT and more. Breathe · dive · repeat.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "#070a10" }}>
      <Bubbles />

      {/* subtle background glow */}
      <div className="pointer-events-none absolute inset-0" style={{
        background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(29,158,117,0.18), transparent 65%)",
      }} />

      <div className="relative mx-auto flex min-h-screen w-full max-w-sm flex-col px-5 py-8">

        {/* HEADER */}
        <header className="mb-8">
          <Logo />
        </header>

        <main className="flex flex-1 flex-col justify-center gap-5">

          {/* HERO CARD */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10" style={{
            background: "linear-gradient(160deg, #1a3a5c 0%, #10293f 45%, #070a10 100%)",
            minHeight: 200,
          }}>
            {/* light rays */}
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <radialGradient id="hero-glow" cx="50%" cy="-10%" r="70%">
                  <stop offset="0%" stopColor="#5DCAA5" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#1D9E75" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#hero-glow)" />
              <line x1="20%" y1="0" x2="28%" y2="100%" stroke="#5DCAA5" strokeWidth="1" opacity="0.07" />
              <line x1="55%" y1="0" x2="50%" y2="100%" stroke="#5DCAA5" strokeWidth="1" opacity="0.07" />
              <line x1="80%" y1="0" x2="73%" y2="100%" stroke="#5DCAA5" strokeWidth="1" opacity="0.07" />
            </svg>

            {/* hero bubbles */}
            <HeroBubbles />

            {/* content */}
            <div className="relative z-10 p-6">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-[#5DCAA5] mb-4">
                {lang === "el" ? "Freediving Training Log" : "Freediving Training Log"}
              </p>
              <h1 className="text-2xl font-semibold leading-tight text-white mb-2">
                {lang === "el"
                  ? <>Η κατάδυσή σου,<br /><span style={{ color: "#5DCAA5" }}>με απόλυτη ακρίβεια.</span></>
                  : <>Your freedive,<br /><span style={{ color: "#5DCAA5" }}>measured.</span></>
                }
              </h1>
              <p className="text-xs text-white/50 leading-relaxed">
                {lang === "el"
                  ? "Κατέγραψε βουτιές, παρακολούθησε PBs και ανάλυσε την πρόοδό σου."
                  : "Log dives, track personal bests and analyse your progress."
                }
              </p>
            </div>
          </div>

          {/* STAT PREVIEW CARDS */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Timer, label: lang === "el" ? "STA · DYN · DNF" : "STA · DYN · DNF", val: "Pool" },
              { icon: TrendingUp, label: lang === "el" ? "Προσωπικά ρεκόρ" : "Personal bests", val: "PB" },
              { icon: Waves, label: lang === "el" ? "CWT · CNF · FIM" : "CWT · CNF · FIM", val: "Depth" },
            ].map(({ icon: Icon, label, val }) => (
              <div key={val} className="rounded-xl border border-white/10 p-3 flex flex-col gap-2" style={{ background: "#0d1320" }}>
                <Icon className="size-4 text-[#5DCAA5]" />
                <p className="text-[0.65rem] text-white/40 leading-tight">{label}</p>
                <p className="text-xs font-semibold text-white">{val}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Link
            to="/auth"
            className="flex items-center justify-center gap-2 rounded-xl py-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #534AB7, #1D9E75)" }}
          >
            {lang === "el" ? "Ξεκίνα δωρεάν" : "Get started free"}
            <ArrowRight className="size-4" />
          </Link>

          <p className="text-center text-xs text-white/30">
            {lang === "el" ? "Ήδη έχεις λογαριασμό;" : "Already have an account?"}{" "}
            <Link to="/auth" className="text-[#5DCAA5] hover:underline">
              {lang === "el" ? "Σύνδεση" : "Sign in"}
            </Link>
          </p>

        </main>

        {/* FOOTER */}
        <footer className="mt-8 text-center">
          <p className="text-[0.6rem] text-white/20 tracking-widest uppercase">
            breathe · dive · repeat
          </p>
        </footer>

      </div>
    </div>
  );
}

/* Mini bubbles inside hero card */
function HeroBubbles() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const ns = "http://www.w3.org/2000/svg";
    const els: SVGCircleElement[] = [];
    for (let i = 0; i < 14; i++) {
      const c = document.createElementNS(ns, "circle");
      const x = 5 + Math.random() * 90;
      const r = 0.4 + Math.random() * 1.8;
      const dur = (4 + Math.random() * 6).toFixed(1);
      const delay = -(Math.random() * 8).toFixed(1);
      c.setAttribute("cx", x + "%");
      c.setAttribute("cy", "105%");
      c.setAttribute("r", r + "%");
      c.setAttribute("fill", "#9FE1CB");
      c.style.opacity = (0.1 + Math.random() * 0.4).toFixed(2);
      c.style.animation = `bubble-rise ${dur}s ${delay}s linear infinite`;
      svg.appendChild(c);
      els.push(c);
    }
    return () => els.forEach((e) => e.remove());
  }, []);
  return <svg ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />;
}

function Feature({ icon: Icon, title, text }: { icon: typeof Waves; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/10 p-4 text-left" style={{ background: "#0d1320" }}>
      <Icon className="size-5 text-[#5DCAA5]" />
      <h3 className="mt-2 text-xs font-semibold text-white">{title}</h3>
      <p className="mt-1 text-[0.65rem] text-white/40 leading-relaxed">{text}</p>
    </div>
  );
}