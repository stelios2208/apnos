import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { Bubbles } from "@/components/Bubbles";

// Landing page for the Supabase password-recovery email link. The link carries
// a recovery token; the client (detectSessionInUrl) exchanges it for a session,
// after which updateUser({ password }) sets the new password.
export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Νέος κωδικός — Apnos" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null); // null = checking
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // The recovery token in the URL becomes a session slightly after mount —
  // listen for it instead of checking only once.
  useEffect(() => {
    let cancelled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setReady(true);
      // give detectSessionInUrl a moment before declaring the link dead
      else setTimeout(() => setReady((r) => (r === null ? false : r)), 2500);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(lang === "el" ? "Τουλάχιστον 6 χαρακτήρες" : "At least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error(lang === "el" ? "Οι κωδικοί δεν ταιριάζουν" : "Passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(lang === "el" ? "Ο κωδικός άλλαξε ✓" : "Password updated ✓");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "#0d1320",
    border: "1px solid rgba(255,255,255,0.08)",
  };

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "#070a10" }}>
      <Bubbles />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(29,158,117,0.15), transparent 60%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-sm flex-col px-5 py-8">
        <header className="mb-12">
          <Logo />
        </header>

        <main className="flex flex-1 flex-col justify-center gap-6">
          {ready === null ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-white/30" />
            </div>
          ) : !ready ? (
            <div className="text-center">
              <h1 className="text-xl font-semibold text-white">
                {lang === "el" ? "Το link δεν ισχύει" : "Link not valid"}
              </h1>
              <p className="mt-2 text-xs text-white/40">
                {lang === "el"
                  ? "Το link επαναφοράς έληξε ή χρησιμοποιήθηκε ήδη. Ζήτησε καινούριο από τη σελίδα σύνδεσης."
                  : "The reset link expired or was already used. Request a new one from the sign-in page."}
              </p>
              <button
                onClick={() => navigate({ to: "/auth" })}
                className="mt-6 w-full rounded-xl py-3.5 text-sm font-semibold text-white"
                style={{ background: "#1D9E75" }}
              >
                {lang === "el" ? "Πίσω στη σύνδεση" : "Back to sign in"}
              </button>
            </div>
          ) : (
            <>
              <div className="mb-2">
                <h1 className="text-xl font-semibold text-white">
                  {lang === "el" ? "Όρισε νέο κωδικό" : "Set a new password"}
                </h1>
                <p className="mt-1 text-xs text-white/40">
                  {lang === "el"
                    ? "Διάλεξε έναν κωδικό που θα θυμάσαι."
                    : "Pick a password you'll remember."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-white/60">
                    {lang === "el" ? "Νέος κωδικός" : "New password"}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none"
                    style={inputStyle}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-white/60">
                    {lang === "el" ? "Επιβεβαίωση κωδικού" : "Confirm password"}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none"
                    style={inputStyle}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#1D9E75" }}
                >
                  {submitting
                    ? lang === "el"
                      ? "Παρακαλώ περιμένετε..."
                      : "Please wait..."
                    : lang === "el"
                      ? "Αποθήκευση κωδικού"
                      : "Save password"}
                </button>
              </form>
            </>
          )}
        </main>

        <footer className="mt-8 text-center">
          <p className="text-[0.6rem] uppercase tracking-widest text-white/20">
            breathe · dive · repeat
          </p>
        </footer>
      </div>
    </div>
  );
}
