import { useMemo, useState } from "react";
import { X, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  type ShareCardData,
  type ProgramCardData,
  buildShareSvg,
  buildProgramSvg,
  svgDataUrl,
  svgToPngBlob,
  shareOrDownload,
} from "@/lib/share-card";

export function ShareCardModal({ data, onClose }: { data: ShareCardData; onClose: () => void }) {
  const svg = useMemo(() => buildShareSvg(data), [data]);
  const preview = useMemo(() => svgDataUrl(svg), [svg]);
  const [busy, setBusy] = useState(false);

  const handleShare = async () => {
    setBusy(true);
    try {
      const png = await svgToPngBlob(svg);
      const res = await shareOrDownload(
        png,
        "apnos-result.png",
        data.lang === "el" ? "Η επίδοσή μου στο Apnos 🌊" : "My Apnos result 🌊",
      );
      if (res === "downloaded")
        toast.success(data.lang === "el" ? "Η εικόνα αποθηκεύτηκε" : "Image saved");
    } catch (e) {
      console.error(e);
      toast.error(data.lang === "el" ? "Σφάλμα δημιουργίας εικόνας" : "Could not create image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="rounded-t-3xl p-5"
        style={{ background: "var(--popover)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">
            {data.lang === "el" ? "Κοινοποίηση επίδοσης" : "Share result"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-foreground/40">
            <X className="size-5" />
          </button>
        </div>

        <div
          className="mx-auto mb-4 w-full max-w-[260px] overflow-hidden rounded-2xl"
          style={{ border: "1px solid rgba(var(--ink),0.08)" }}
        >
          <img
            src={preview}
            alt=""
            className="block w-full"
            style={{ aspectRatio: "1080 / 1350" }}
          />
        </div>

        <button
          onClick={handleShare}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold"
          style={{ background: busy ? "rgba(29,158,117,0.5)" : "#1D9E75", color: "#fff" }}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
          {data.lang === "el" ? "Κοινοποίηση / Αποθήκευση" : "Share / Save"}
        </button>
        <p className="mt-2 text-center text-[0.65rem] text-foreground/30">
          {data.lang === "el"
            ? "Ιδανικό για Instagram & Facebook stories"
            : "Perfect for Instagram & Facebook stories"}
        </p>
      </div>
    </div>
  );
}

export function ProgramShareModal({
  data,
  onClose,
}: {
  data: ProgramCardData;
  onClose: () => void;
}) {
  const svg = useMemo(() => buildProgramSvg(data), [data]);
  const preview = useMemo(() => svgDataUrl(svg), [svg]);
  const [busy, setBusy] = useState(false);

  const handleShare = async () => {
    setBusy(true);
    try {
      const png = await svgToPngBlob(svg);
      const res = await shareOrDownload(
        png,
        "apnos-programme.png",
        data.lang === "el" ? "Το πρόγραμμά σου 🌊 — Apnos" : "Your training programme 🌊 — Apnos",
      );
      if (res === "downloaded")
        toast.success(data.lang === "el" ? "Η εικόνα αποθηκεύτηκε" : "Image saved");
    } catch (e) {
      console.error(e);
      toast.error(data.lang === "el" ? "Σφάλμα δημιουργίας εικόνας" : "Could not create image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="rounded-t-3xl p-5"
        style={{ background: "var(--popover)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">
            {data.lang === "el" ? "Κάρτα προγράμματος" : "Programme card"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-foreground/40">
            <X className="size-5" />
          </button>
        </div>

        <div
          className="mx-auto mb-4 w-full max-w-[260px] overflow-hidden rounded-2xl"
          style={{ border: "1px solid rgba(var(--ink),0.08)" }}
        >
          <img
            src={preview}
            alt=""
            className="block w-full"
            style={{ aspectRatio: "1080 / 1350" }}
          />
        </div>

        <button
          onClick={handleShare}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold"
          style={{ background: busy ? "rgba(29,158,117,0.5)" : "#1D9E75", color: "#fff" }}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
          {data.lang === "el" ? "Στείλε στον αθλητή" : "Send to athlete"}
        </button>
        <p className="mt-2 text-center text-[0.65rem] text-foreground/30">
          {data.lang === "el"
            ? "Μοιράσου το μέσω WhatsApp, Instagram, email…"
            : "Share via WhatsApp, Instagram, email…"}
        </p>
      </div>
    </div>
  );
}
