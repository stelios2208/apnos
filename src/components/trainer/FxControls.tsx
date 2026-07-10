import { useState } from "react";
import { Mic, MicOff, SlidersHorizontal, Vibrate, Volume2, VolumeX, Waves } from "lucide-react";
import type { SessionFx } from "@/hooks/use-session-fx";
import { VoiceCuesModal } from "@/components/VoiceCuesModal";

// ── FX controls ──────────────────────────────────────────────────────────────
// Shared toggle UI for the guided-session effects. FxChipsRow is the wide
// chip strip used on setup/builder screens (sound / scene / haptics / voice
// cue manager); FxToggle is the round icon button used on full-screen players.

export function FxChip({
  active,
  onClick,
  on,
  off,
  label,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  on: React.ReactNode;
  off: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all"
      style={{
        background: active ? "rgba(29,158,117,0.15)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? "rgba(29,158,117,0.4)" : "rgba(255,255,255,0.08)"}`,
        color: active ? "#5DCAA5" : "rgba(255,255,255,0.35)",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {active ? on : off}
      {label}
    </button>
  );
}

export function FxToggle({
  active,
  onClick,
  on,
  off,
  label,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  on: React.ReactNode;
  off: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className="relative flex h-11 w-11 items-center justify-center rounded-full transition-all"
      style={{
        background: active ? "rgba(29,158,117,0.18)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? "rgba(29,158,117,0.45)" : "rgba(255,255,255,0.08)"}`,
        color: active ? "#5DCAA5" : "rgba(255,255,255,0.28)",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {active ? on : off}
      {disabled && (
        <span
          className="pointer-events-none absolute h-[1.5px] w-6 rotate-45 rounded-full"
          style={{ background: "rgba(255,255,255,0.4)" }}
        />
      )}
    </button>
  );
}

/** Chip strip: sound / scene / haptics / voice toggles + "my voice cues" manager. */
export function FxChipsRow({ sfx }: { sfx: SessionFx }) {
  const el = sfx.lang === "el";
  const [showVoice, setShowVoice] = useState(false);
  return (
    <>
      <div className="flex gap-2">
        <FxChip
          active={sfx.fx.sound}
          onClick={() => sfx.toggleFx("sound")}
          on={<Volume2 className="size-3.5" />}
          off={<VolumeX className="size-3.5" />}
          label={el ? "Ήχος" : "Sound"}
        />
        <FxChip
          active={sfx.fx.scene}
          onClick={() => sfx.toggleFx("scene")}
          on={<Waves className="size-3.5" />}
          off={<Waves className="size-3.5" />}
          label={el ? "Βυθός" : "Scene"}
        />
        <FxChip
          active={sfx.fx.haptics && sfx.canHaptics}
          onClick={() => sfx.toggleFx("haptics")}
          on={<Vibrate className="size-3.5" />}
          off={<Vibrate className="size-3.5" />}
          label={el ? "Δόνηση" : "Haptics"}
          disabled={!sfx.canHaptics}
        />
        <FxChip
          active={sfx.fx.voice}
          onClick={() => sfx.toggleFx("voice")}
          on={<Mic className="size-3.5" />}
          off={<MicOff className="size-3.5" />}
          label={el ? "Φωνή" : "Voice"}
        />
      </div>
      {sfx.user && (
        <button
          onClick={() => setShowVoice(true)}
          className="relative mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px dashed rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          <SlidersHorizontal className="size-3.5" />
          {el ? "Η φωνή μου — ηχογράφησε οδηγίες" : "My voice — record your cues"}
          {sfx.hasCues && (
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: "#1D9E75", boxShadow: "0 0 6px #1D9E7580" }}
            />
          )}
        </button>
      )}
      {showVoice && sfx.user && (
        <VoiceCuesModal
          uid={sfx.user.id}
          lang={sfx.lang}
          onClose={() => setShowVoice(false)}
          onChanged={() => {
            void sfx.reloadCues();
          }}
        />
      )}
    </>
  );
}
