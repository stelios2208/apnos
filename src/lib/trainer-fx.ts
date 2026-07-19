// ── Trainer FX ───────────────────────────────────────────────────────────────
// "Alive" guided-session effects for the STA trainer: voice guidance,
// synthesized relaxing soundscape, and haptics. All client-side, offline,
// zero asset files — synth built with the Web Audio API.

import { isNativeApp, nativeVibrate } from "./native";

export type FxSettings = { voice: boolean; sound: boolean; haptics: boolean; scene: boolean };

const STORE_KEY = "apnos.trainer.fx";

export const FX_DEFAULTS: FxSettings = { voice: true, sound: true, haptics: true, scene: true };

export function loadFxSettings(): FxSettings {
  if (typeof localStorage === "undefined") return { ...FX_DEFAULTS };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...FX_DEFAULTS };
    const p = JSON.parse(raw) as Partial<FxSettings>;
    return {
      voice: p.voice ?? true,
      sound: p.sound ?? true,
      haptics: p.haptics ?? true,
      scene: p.scene ?? true,
    };
  } catch {
    return { ...FX_DEFAULTS };
  }
}

export function saveFxSettings(s: FxSettings): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// ── Simple synth beep ────────────────────────────────────────────────────────
// Cross-platform audio ping for phase changes (vibration alone is silent on iOS).

export function beep(freq = 660): void {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.start();
    o.stop(ctx.currentTime + 0.4);
    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        /* ignore */
      }
    }, 500);
  } catch {
    /* audio not available */
  }
}

// ── Haptics ──────────────────────────────────────────────────────────────────

export function hapticsSupported(): boolean {
  // Native shell always has real haptics; in a browser, iOS Safari (incl. PWA)
  // exposes no Vibration API at all.
  return isNativeApp() || (typeof navigator !== "undefined" && "vibrate" in navigator);
}

export function vibrate(pattern: number | number[]): void {
  // Routes through the native Haptics plugin inside the Capacitor app, and
  // falls back to navigator.vibrate in a plain browser.
  nativeVibrate(pattern);
}

// Fired the moment a Haptics toggle switches on — a direct-gesture vibrate so
// the athlete gets real feedback on whether their device actually buzzes.
// MUST be called synchronously from the tap handler (not from a React state
// updater or a timer) so the browser's user-activation gate lets it through.
// A firm ~300ms pulse so it's unmistakable when it does work.
// (navigator.vibrate is a silent no-op on iOS entirely, and on some Android /
// Samsung Internet builds when system "touch vibration" or battery-saver is
// set — that's an OS limitation the web app can't override.)
export function testHapticPulse(): void {
  vibrate([120, 80, 120]);
}

// ── Custom voice cues ────────────────────────────────────────────────────────
// Plays pre-recorded audio clips (the owner's own recordings / voiceover) so the
// guidance sounds human, not robotic. Drop files at:
//   public/audio/cues/<lang>/<key>.mp3   e.g. public/audio/cues/el/hold.mp3
// Missing files simply don't play — no synthetic fallback.

export type CueKey =
  | "breathe"
  | "hold"
  | "recovery"
  | "m30"
  | "m60"
  | "m90"
  | "m120"
  | "m150"
  | "m180"
  | "m210"
  | "m240"
  | "m300";

// Hold-time thresholds (seconds) → which cue clip to play when crossed.
export const HOLD_MILESTONES: { at: number; key: CueKey }[] = [
  { at: 30, key: "m30" },
  { at: 60, key: "m60" },
  { at: 90, key: "m90" },
  { at: 120, key: "m120" },
  { at: 150, key: "m150" },
  { at: 180, key: "m180" },
  { at: 210, key: "m210" },
  { at: 240, key: "m240" },
  { at: 300, key: "m300" },
];

// Recorded voice cues are strictly scoped to the hold phase: the hold-start cue
// plus the in-hold milestone callouts. Breathe-up and recovery cues are
// intentionally excluded — voice guidance never speaks over those phases. This
// is an allowlist so any future non-hold cue stays silent by default.
export const HOLD_PHASE_CUES: ReadonlySet<CueKey> = new Set<CueKey>([
  "hold",
  ...HOLD_MILESTONES.map((m) => m.key),
]);

// Catalog of every cue, used by the management UI. Milestone rows reuse the
// timing from HOLD_MILESTONES; phases come first.
export const CUE_CATALOG: {
  key: CueKey;
  group: "phase" | "milestone";
  labelEl: string;
  labelEn: string;
}[] = [
  { key: "breathe", group: "phase", labelEl: "Έναρξη αναπνοών", labelEn: "Breathe-up start" },
  { key: "hold", group: "phase", labelEl: "Έναρξη κράτησης", labelEn: "Hold start" },
  { key: "recovery", group: "phase", labelEl: "Έναρξη ανάκαμψης", labelEn: "Recovery start" },
  ...HOLD_MILESTONES.map((m) => {
    const mm = Math.floor(m.at / 60);
    const ss = String(m.at % 60).padStart(2, "0");
    const label = `${mm}:${ss}`;
    return { key: m.key, group: "milestone" as const, labelEl: label, labelEn: label };
  }),
];

// Plays per-user recorded cues. Sources are resolved externally (from Supabase
// Storage) and handed in via setSources; a key with no source stays silent.
export class CuePlayer {
  private sources = new Map<CueKey, string>();
  private cache = new Map<string, HTMLAudioElement>();
  private current: HTMLAudioElement | null = null;

  setSources(map: Map<CueKey, string>): void {
    this.sources = map;
  }

  play(key: CueKey): void {
    if (typeof Audio === "undefined") return;
    const src = this.sources.get(key);
    if (!src) return; // no recording for this cue → silent
    let el = this.cache.get(src);
    if (!el) {
      el = new Audio(src);
      el.preload = "auto";
      this.cache.set(src, el);
    }
    // cut off any currently-playing cue so they don't overlap
    if (this.current && this.current !== el) {
      try {
        this.current.pause();
        this.current.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    this.current = el;
    // Resetting currentTime on an element that hasn't loaded metadata yet
    // (readyState 0) can throw in some engines — that must not abort play().
    try {
      el.currentTime = 0;
    } catch {
      /* not loaded yet — play() below still works from position 0 */
    }
    void el.play().catch((err) => {
      console.error("voice cue playback failed", key, err);
    });
  }

  stop(): void {
    if (this.current) {
      try {
        this.current.pause();
      } catch {
        /* ignore */
      }
    }
    this.current = null;
  }
}

// ── Soundscape engine ────────────────────────────────────────────────────────
// A gentle nature ambience — filtered-noise water/wind bed, soft pentatonic
// "kalimba" plucks, and light bird-like chirps during the breathe phase.
// Everything is synthesized (Web Audio only, zero asset files); phase changes
// shift the pluck rate/density and bed volume to pace the athlete.

type EnginePhase = "breathe" | "hold" | "recovery";

// C pentatonic-ish, low register so it sits gently under the noise bed.
const PLUCK_NOTES = [261.6, 293.7, 349.2, 392.0, 440.0, 523.3];

const PHASE_TUNING: Record<
  EnginePhase,
  { bed: number; pluckMs: [number, number]; chirps: boolean }
> = {
  breathe: { bed: 0.1, pluckMs: [2200, 4200], chirps: true },
  hold: { bed: 0.06, pluckMs: [4500, 8500], chirps: false },
  recovery: { bed: 0.11, pluckMs: [1800, 3200], chirps: false },
};

export class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bedGain: GainNode | null = null;
  private noiseSrc: AudioBufferSourceNode | null = null;
  private running = false;
  private stopped = true;
  private phase: EnginePhase = "breathe";
  private pluckTimer: ReturnType<typeof setTimeout> | null = null;
  private chirpTimer: ReturnType<typeof setTimeout> | null = null;

  get isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    if (this.running) return;
    const Ctx =
      typeof window !== "undefined"
        ? (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (!Ctx) return;

    const ctx = new Ctx();
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
    // iOS unlock: play one silent buffer inside the gesture chain
    try {
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // soft water/wind bed — filtered noise looped continuously
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = true;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 1100;
    bandpass.Q.value = 0.7;
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0;
    noiseSrc.connect(bandpass);
    bandpass.connect(bedGain);
    bedGain.connect(master);
    noiseSrc.start(now);

    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(1, now + 2);
    bedGain.gain.linearRampToValueAtTime(PHASE_TUNING[this.phase].bed, now + 2);

    this.ctx = ctx;
    this.master = master;
    this.bedGain = bedGain;
    this.noiseSrc = noiseSrc;
    this.running = true;
    this.stopped = false;

    this.schedulePlucks();
    this.scheduleChirps();
  }

  private randBetween([lo, hi]: [number, number]): number {
    return lo + Math.random() * (hi - lo);
  }

  // Soft "kalimba" pluck: fast attack, exponential decay, gentle low harmonic.
  private schedulePlucks(): void {
    if (this.stopped || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const freq = PLUCK_NOTES[Math.floor(Math.random() * PLUCK_NOTES.length)]!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    g.connect(this.master);

    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    o.connect(g);
    o.start(now);
    o.stop(now + 1.5);

    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = freq * 2; // soft harmonic overtone
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(0.035, now + 0.015);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    o2.connect(g2);
    g2.connect(this.master);
    o2.start(now);
    o2.stop(now + 0.9);

    const delay = this.randBetween(PHASE_TUNING[this.phase].pluckMs);
    this.pluckTimer = setTimeout(() => this.schedulePlucks(), delay);
  }

  // Quick pitch-swept chirp — only scheduled while phase === "breathe".
  private scheduleChirps(): void {
    if (this.stopped || !this.ctx || !this.master) return;
    if (!PHASE_TUNING[this.phase].chirps) {
      this.chirpTimer = setTimeout(() => this.scheduleChirps(), 1500);
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const start = 2600 + Math.random() * 900;
    const end = start + 700 + Math.random() * 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.05, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    g.connect(this.master);

    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(start, now);
    o.frequency.exponentialRampToValueAtTime(end, now + 0.12);
    o.connect(g);
    o.start(now);
    o.stop(now + 0.16);

    const delay = 3000 + Math.random() * 6000;
    this.chirpTimer = setTimeout(() => this.scheduleChirps(), delay);
  }

  setPhase(phase: EnginePhase): void {
    this.phase = phase;
    if (!this.ctx || !this.bedGain) return;
    const now = this.ctx.currentTime;
    const tuning = PHASE_TUNING[phase];
    this.bedGain.gain.cancelScheduledValues(now);
    this.bedGain.gain.setValueAtTime(this.bedGain.gain.value, now);
    this.bedGain.gain.linearRampToValueAtTime(tuning.bed, now + 2);
  }

  stop(): void {
    this.stopped = true;
    if (this.pluckTimer) clearTimeout(this.pluckTimer);
    if (this.chirpTimer) clearTimeout(this.chirpTimer);
    this.pluckTimer = null;
    this.chirpTimer = null;

    if (!this.ctx || !this.master) {
      this.running = false;
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    try {
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0, now + 1.2);
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      try {
        this.noiseSrc?.stop();
      } catch {
        /* ignore */
      }
      try {
        ctx.close();
      } catch {
        /* ignore */
      }
    }, 1400);
    this.ctx = null;
    this.master = null;
    this.bedGain = null;
    this.noiseSrc = null;
    this.running = false;
  }
}
