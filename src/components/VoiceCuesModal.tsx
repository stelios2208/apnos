import { useCallback, useEffect, useRef, useState } from "react";
import { X, Mic, Square, Upload, Play, Trash2, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { CUE_CATALOG, type CueKey } from "@/lib/trainer-fx";
import { type CueLang, listCueUrls, uploadCue, deleteCue } from "@/lib/voice-cues";

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const cands = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  for (const c of cands) if (MediaRecorder.isTypeSupported(c)) return c;
  return undefined;
}

export function VoiceCuesModal({
  uid,
  lang: appLang,
  onClose,
  onChanged,
}: {
  uid: string;
  lang: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const el = appLang === "el";
  const [lang, setLang] = useState<CueLang>(el ? "el" : "en");
  const [urls, setUrls] = useState<Map<CueKey, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [recordingKey, setRecKey] = useState<CueKey | null>(null);
  const [busyKey, setBusyKey] = useState<CueKey | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const m = await listCueUrls(uid, lang);
    setUrls(m);
    setLoading(false);
  }, [uid, lang]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      stopStream();
      previewRef.current?.pause();
    },
    [stopStream],
  );

  const saveBlob = useCallback(
    async (key: CueKey, blob: Blob) => {
      if (blob.size === 0) return;
      setBusyKey(key);
      try {
        await uploadCue(uid, lang, key, blob);
        await refresh();
        onChanged?.();
        toast.success(el ? "Αποθηκεύτηκε" : "Saved");
      } catch {
        toast.error(el ? "Αποτυχία αποθήκευσης" : "Save failed");
      } finally {
        setBusyKey(null);
      }
    },
    [uid, lang, refresh, onChanged, el],
  );

  const startRecording = useCallback(
    async (key: CueKey) => {
      if (recordingKey) return;
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        toast.error(el ? "Το μικρόφωνο δεν υποστηρίζεται" : "Microphone not supported");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const mime = pickMime();
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        chunksRef.current = [];
        rec.ondataavailable = (e) => {
          if (e.data.size) chunksRef.current.push(e.data);
        };
        rec.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
          stopStream();
          setRecKey(null);
          void saveBlob(key, blob);
        };
        recorderRef.current = rec;
        rec.start();
        setRecKey(key);
      } catch {
        toast.error(el ? "Άρνηση πρόσβασης μικροφώνου" : "Microphone access denied");
        stopStream();
      }
    },
    [recordingKey, saveBlob, stopStream, el],
  );

  const stopRecording = useCallback(() => {
    try {
      recorderRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const preview = useCallback(
    (key: CueKey) => {
      const url = urls.get(key);
      if (!url) return;
      try {
        previewRef.current?.pause();
        const a = new Audio(url);
        previewRef.current = a;
        void a.play().catch(() => {
          /* ignore */
        });
      } catch {
        /* ignore */
      }
    },
    [urls],
  );

  const remove = useCallback(
    async (key: CueKey) => {
      setBusyKey(key);
      try {
        await deleteCue(uid, lang, key);
        await refresh();
        onChanged?.();
      } catch {
        toast.error(el ? "Αποτυχία διαγραφής" : "Delete failed");
      } finally {
        setBusyKey(null);
      }
    },
    [uid, lang, refresh, onChanged, el],
  );

  const onFile = useCallback(
    (key: CueKey, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) void saveBlob(key, file);
    },
    [saveBlob],
  );

  const phases = CUE_CATALOG.filter((c) => c.group === "phase");
  const milestones = CUE_CATALOG.filter((c) => c.group === "milestone");
  const recordedCount = urls.size;

  const Row = ({ cue }: { cue: (typeof CUE_CATALOG)[number] }) => {
    const has = urls.has(cue.key);
    const busy = busyKey === cue.key;
    const recNow = recordingKey === cue.key;
    const label = el ? cue.labelEl : cue.labelEn;
    return (
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{
            background: has ? "#1D9E75" : "rgba(255,255,255,0.15)",
            boxShadow: has ? "0 0 6px #1D9E7580" : "none",
          }}
        />
        <span className="flex-1 truncate text-sm text-white/80">{label}</span>

        {busy ? (
          <Loader2 className="size-4 animate-spin text-white/40" />
        ) : (
          <>
            {has && (
              <IconBtn onClick={() => preview(cue.key)} label={el ? "Ακρόαση" : "Preview"}>
                <Play className="size-4" />
              </IconBtn>
            )}
            <IconBtn
              onClick={() => (recNow ? stopRecording() : startRecording(cue.key))}
              label={el ? "Ηχογράφηση" : "Record"}
              active={recNow}
              danger={recNow}
            >
              {recNow ? <Square className="size-4" /> : <Mic className="size-4" />}
            </IconBtn>
            <label className="cursor-pointer">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/40 transition-colors hover:text-white"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                title={el ? "Ανέβασμα αρχείου" : "Upload file"}
              >
                <Upload className="size-4" />
              </span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => onFile(cue.key, e)}
              />
            </label>
            {has && (
              <IconBtn onClick={() => remove(cue.key)} label={el ? "Διαγραφή" : "Delete"} danger>
                <Trash2 className="size-4" />
              </IconBtn>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "rgba(0,0,0,0.9)" }}>
      <div className="flex flex-1 flex-col overflow-hidden" style={{ background: "#0a0f1a" }}>
        {/* header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div>
            <h2 className="text-base font-bold text-white">
              {el ? "Η φωνή μου" : "My voice cues"}
            </h2>
            <p className="mt-0.5 text-xs text-white/30">
              {el ? "Ηχογράφησε ή ανέβασε τα δικά σου" : "Record or upload your own"} ·{" "}
              {recordedCount}/{CUE_CATALOG.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white/30 transition-colors hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* lang toggle */}
        <div className="flex gap-2 px-5 pt-4">
          {(["el", "en"] as CueLang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className="rounded-lg px-4 py-1.5 text-xs font-bold transition-all"
              style={
                lang === l
                  ? { background: "#1D9E75", color: "#fff" }
                  : {
                      background: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.4)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }
              }
            >
              {l === "el" ? "Ελληνικά" : "English"}
            </button>
          ))}
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-white/30" />
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[0.6rem] font-bold tracking-[0.2em] text-white/25">
                  {el ? "ΦΑΣΕΙΣ" : "PHASES"}
                </p>
                <div className="space-y-2">
                  {phases.map((c) => (
                    <Row key={c.key} cue={c} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[0.6rem] font-bold tracking-[0.2em] text-white/25">
                  {el ? "ΟΡΟΣΗΜΑ ΚΡΑΤΗΣΗΣ" : "HOLD MILESTONES"}
                </p>
                <div className="space-y-2">
                  {milestones.map((c) => (
                    <Row key={c.key} cue={c} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="border-t px-5 py-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <button
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold"
            style={{ background: "#1D9E75", color: "#fff" }}
          >
            <Check className="size-4" />
            {el ? "Έτοιμο" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  active = false,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
  danger?: boolean;
}) {
  const color = active ? "#ef5050" : danger ? "rgba(239,80,80,0.8)" : "rgba(255,255,255,0.5)";
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:brightness-125"
      style={{
        border: `1px solid ${active ? "rgba(239,80,80,0.5)" : "rgba(255,255,255,0.08)"}`,
        background: active ? "rgba(239,80,80,0.12)" : "transparent",
        color,
      }}
    >
      {children}
    </button>
  );
}
