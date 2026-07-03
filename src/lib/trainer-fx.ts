// ── Trainer FX ───────────────────────────────────────────────────────────────
// "Alive" guided-session effects for the STA trainer: voice guidance,
// synthesized relaxing soundscape, and haptics. All client-side, offline,
// zero asset files — synth built with the Web Audio API.

export type FxSettings = { voice: boolean; sound: boolean; haptics: boolean };

const STORE_KEY = "apnos.trainer.fx";

export function loadFxSettings(): FxSettings {
  if (typeof localStorage === "undefined") return { voice: true, sound: true, haptics: true };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { voice: true, sound: true, haptics: true };
    const p = JSON.parse(raw) as Partial<FxSettings>;
    return {
      voice:   p.voice   ?? true,
      sound:   p.sound   ?? true,
      haptics: p.haptics ?? true,
    };
  } catch {
    return { voice: true, sound: true, haptics: true };
  }
}

export function saveFxSettings(s: FxSettings): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ── Haptics ──────────────────────────────────────────────────────────────────

export function hapticsSupported(): boolean {
  // iOS Safari (incl. PWA) does not expose the Vibration API at all.
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

export function vibrate(pattern: number | number[]): void {
  if (hapticsSupported()) {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}

// ── Custom voice cues ────────────────────────────────────────────────────────
// Plays pre-recorded audio clips (the owner's own recordings / voiceover) so the
// guidance sounds human, not robotic. Drop files at:
//   public/audio/cues/<lang>/<key>.mp3   e.g. public/audio/cues/el/hold.mp3
// Missing files simply don't play — no synthetic fallback.

export type CueKey =
  | "breathe" | "hold" | "recovery"
  | "m30" | "m60" | "m90" | "m120" | "m150" | "m180" | "m210" | "m240" | "m300";

// Hold-time thresholds (seconds) → which cue clip to play when crossed.
export const HOLD_MILESTONES: { at: number; key: CueKey }[] = [
  { at: 30,  key: "m30"  },
  { at: 60,  key: "m60"  },
  { at: 90,  key: "m90"  },
  { at: 120, key: "m120" },
  { at: 150, key: "m150" },
  { at: 180, key: "m180" },
  { at: 210, key: "m210" },
  { at: 240, key: "m240" },
  { at: 300, key: "m300" },
];

export function cueSrc(key: CueKey, lang: string): string {
  return `/audio/cues/${lang === "el" ? "el" : "en"}/${key}.mp3`;
}

export class CuePlayer {
  private cache = new Map<string, HTMLAudioElement>();
  private current: HTMLAudioElement | null = null;

  play(key: CueKey, lang: string): void {
    if (typeof Audio === "undefined") return;
    const src = cueSrc(key, lang);
    let el = this.cache.get(src);
    if (!el) {
      el = new Audio(src);
      el.preload = "auto";
      this.cache.set(src, el);
    }
    // cut off any currently-playing cue so they don't overlap
    if (this.current && this.current !== el) {
      try { this.current.pause(); this.current.currentTime = 0; } catch { /* ignore */ }
    }
    this.current = el;
    try {
      el.currentTime = 0;
      void el.play().catch(() => { /* missing file or blocked → silent */ });
    } catch { /* ignore */ }
  }

  stop(): void {
    if (this.current) {
      try { this.current.pause(); } catch { /* ignore */ }
    }
    this.current = null;
  }
}

// ── Soundscape engine ────────────────────────────────────────────────────────
// A warm synthesized pad (calming fifth) with a slow gain LFO that "breathes".
// The LFO speed + base level shift per phase to pace the athlete.

type EnginePhase = "breathe" | "hold" | "recovery";

export class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private oscs: OscillatorNode[] = [];
  private running = false;

  get isRunning(): boolean { return this.running; }

  async start(): Promise<void> {
    if (this.running) return;
    const Ctx = (typeof window !== "undefined"
      ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined);
    if (!Ctx) return;

    const ctx = new Ctx();
    try { await ctx.resume(); } catch { /* ignore */ }
    // iOS unlock: play one silent buffer inside the gesture chain
    try {
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch { /* ignore */ }
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // keep it soft but let it breathe through phone speakers
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1600;
    filter.Q.value = 0.6;
    filter.connect(master);

    // pad — a warm calming chord in a register phone speakers can reproduce
    const partials: { freq: number; gain: number }[] = [
      { freq: 196, gain: 0.34 }, // G3
      { freq: 294, gain: 0.30 }, // D4 (fifth)
      { freq: 392, gain: 0.22 }, // G4 (octave)
      { freq: 588, gain: 0.10 }, // D5 shimmer
    ];
    partials.forEach((p, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = p.freq;
      o.detune.value = (i - 1) * 4; // gentle chorus
      const g = ctx.createGain();
      g.gain.value = p.gain;
      o.connect(g);
      g.connect(filter);
      o.start(now);
      this.oscs.push(o);
    });

    // breathing swell — LFO modulates the master gain around its base level
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.07;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.1; // ~10s breathe cycle
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);
    lfo.start(now);

    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.2, now + 2);

    this.ctx = ctx;
    this.master = master;
    this.lfo = lfo;
    this.running = true;
  }

  setPhase(phase: EnginePhase): void {
    if (!this.ctx || !this.lfo || !this.master) return;
    const now = this.ctx.currentTime;
    const rampLfo = (hz: number, secs: number) => {
      this.lfo!.frequency.cancelScheduledValues(now);
      this.lfo!.frequency.setValueAtTime(this.lfo!.frequency.value, now);
      this.lfo!.frequency.linearRampToValueAtTime(hz, now + secs);
    };
    const rampBase = (v: number, secs: number) => {
      this.master!.gain.cancelScheduledValues(now);
      this.master!.gain.setValueAtTime(this.master!.gain.value, now);
      this.master!.gain.linearRampToValueAtTime(v, now + secs);
    };
    if (phase === "breathe") {
      rampLfo(0.1, 1);   // paced ~10s inhale/exhale
      rampBase(0.22, 1.5);
    } else if (phase === "hold") {
      rampLfo(0.04, 2);  // very slow, still
      rampBase(0.14, 3);
    } else if (phase === "recovery") {
      rampLfo(0.18, 1);  // quicker recovery breaths
      rampBase(0.2, 1);
    }
  }

  stop(): void {
    if (!this.ctx || !this.master) { this.running = false; return; }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    try {
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0, now + 1.2);
    } catch { /* ignore */ }
    setTimeout(() => { try { ctx.close(); } catch { /* ignore */ } }, 1400);
    this.ctx = null;
    this.master = null;
    this.lfo = null;
    this.oscs = [];
    this.running = false;
  }
}
