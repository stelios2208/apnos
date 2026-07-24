import { Waves, Fish, Newspaper, Camera, MessageCircle, Check } from "lucide-react";
import { useMode, type Mode } from "@/hooks/use-mode";
import { useI18n } from "@/lib/i18n";
import { nativeVibrate } from "@/lib/native";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ── Mode switch + mini guide ─────────────────────────────────────────────────
// A single focused dialog that (1) switches the app between its two worlds —
// Apnos (freediving) and Spearo (spearfishing) — with two big clear cards, and
// (2) briefly explains how the app works, so new members understand it. Opened
// from the header mode chip and once automatically on first run.
export function ModeGuideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { mode, setMode } = useMode();
  const { lang } = useI18n();
  const el = lang === "el";

  const pick = (m: Mode) => {
    nativeVibrate(10);
    setMode(m);
  };

  const modes: {
    key: Mode;
    title: string;
    sub: string;
    icon: typeof Waves;
  }[] = [
    { key: "apnos", title: "Apnos", sub: el ? "Ελεύθερη κατάδυση" : "Freediving", icon: Waves },
    { key: "spearo", title: "Spearo", sub: el ? "Ψαροντούφεκο" : "Spearfishing", icon: Fish },
  ];

  const steps: { icon: typeof Waves; text: string }[] = [
    {
      icon: Newspaper,
      text: el
        ? "Feed: δες τι μοιράζεται η κοινότητα, κάνε like & μοιράσου."
        : "Feed: see what the crew shares, like & share.",
    },
    {
      icon: Camera,
      text: el
        ? "Ιστορίες & ποστ: ανέβασε φωτο από βουτιές ή ψαριές."
        : "Stories & posts: upload photos from dives or catches.",
    },
    {
      icon: MessageCircle,
      text: el
        ? "Μήνυμα: μίλα απευθείας με τον προπονητή, χωρίς email."
        : "Message: talk to the coach directly, no email.",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{el ? "Πώς δουλεύει το Apnos" : "How Apnos works"}</DialogTitle>
          <DialogDescription>
            {el
              ? "Διάλεξε τον κόσμο σου — αλλάζει μόνο το κάτω μενού, όλα τα δεδομένα σου μένουν."
              : "Pick your world — it only changes the bottom menu; all your data stays."}
          </DialogDescription>
        </DialogHeader>

        {/* the two modes */}
        <div className="grid grid-cols-2 gap-3">
          {modes.map((m) => {
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => pick(m.key)}
                className="pressable relative flex flex-col items-center gap-2 rounded-2xl p-4 text-center transition-colors"
                style={{
                  background: active ? "rgba(29,158,117,0.12)" : "rgba(var(--ink),0.04)",
                  border: active
                    ? "1.5px solid rgba(29,158,117,0.55)"
                    : "1.5px solid rgba(var(--ink),0.08)",
                }}
              >
                {active && (
                  <span
                    className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full text-white"
                    style={{ background: "#1D9E75" }}
                  >
                    <Check className="size-3" />
                  </span>
                )}
                <span
                  className="flex size-11 items-center justify-center rounded-full"
                  style={{ background: "rgba(29,158,117,0.15)" }}
                >
                  <m.icon className="size-5" style={{ color: "#5DCAA5" }} />
                </span>
                <span className="text-sm font-bold text-foreground">{m.title}</span>
                <span className="text-[0.7rem] text-foreground/50">{m.sub}</span>
              </button>
            );
          })}
        </div>

        {/* mini guide */}
        <ul className="mt-1 space-y-2.5">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(29,158,117,0.12)" }}
              >
                <s.icon className="size-4" style={{ color: "#5DCAA5" }} />
              </span>
              <span className="text-sm leading-snug text-foreground/75">{s.text}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-1 w-full rounded-xl py-3 text-sm font-bold text-white"
          style={{ background: "#1D9E75" }}
        >
          {el ? "Έγινε" : "Got it"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
