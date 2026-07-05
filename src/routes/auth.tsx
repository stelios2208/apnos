import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { Bubbles } from "@/components/Bubbles";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Sign in — Apnos" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t("auth.welcomeBack"));
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;
        toast.success(t("auth.accountCreated"));
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "#070a10" }}>
      <Bubbles />

      {/* subtle top glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(29,158,117,0.15), transparent 60%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-sm flex-col px-5 py-8">
        {/* HEADER */}
        <header className="mb-12">
          <Logo />
        </header>

        <main className="flex flex-1 flex-col justify-center gap-6">
          {/* TITLE */}
          <div className="mb-2">
            <h1 className="text-xl font-semibold text-white">
              {mode === "login"
                ? lang === "el"
                  ? "Καλώς ήρθες πίσω"
                  : "Welcome back"
                : lang === "el"
                  ? "Δημιούργησε λογαριασμό"
                  : "Create account"}
            </h1>
            <p className="text-xs text-white/40 mt-1">
              {mode === "login"
                ? lang === "el"
                  ? "Βούτα ξανά."
                  : "Dive back in."
                : lang === "el"
                  ? "Ξεκίνα να καταγράφεις τις βουτιές σου."
                  : "Start tracking your dives."}
            </p>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-white/60 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@ocean.com"
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all"
                style={{
                  background: "#0d1320",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(93,202,165,0.6)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-white/60 uppercase tracking-wider">
                {lang === "el" ? "Κωδικός" : "Password"}
              </label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all"
                style={{
                  background: "#0d1320",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(93,202,165,0.6)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: "#1D9E75",
              }}
            >
              {submitting
                ? lang === "el"
                  ? "Παρακαλώ περιμένετε..."
                  : "Please wait..."
                : mode === "login"
                  ? lang === "el"
                    ? "Σύνδεση"
                    : "Sign in"
                  : lang === "el"
                    ? "Δημιουργία λογαριασμού"
                    : "Create account"}
            </button>
          </form>

          {/* SWITCH MODE */}
          <p className="text-center text-xs text-white/30">
            {mode === "login"
              ? lang === "el"
                ? "Νέος στο Apnos;"
                : "New to Apnos?"
              : lang === "el"
                ? "Έχεις ήδη λογαριασμό;"
                : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-semibold transition-colors hover:text-[#5DCAA5]"
              style={{ color: "#5DCAA5" }}
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login"
                ? lang === "el"
                  ? "Δημιούργησε έναν"
                  : "Create one"
                : lang === "el"
                  ? "Σύνδεση"
                  : "Sign in"}
            </button>
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
