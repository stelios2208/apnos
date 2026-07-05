import type { CSSProperties } from "react";
import { Bubbles } from "./Bubbles";

/**
 * Full-screen deep-sea backdrop: depth gradient, sun glow, swaying god rays,
 * caustic shimmer, drifting marine snow and rising bubbles.
 * Purely decorative — always `pointer-events: none` and `aria-hidden`.
 */

const RAYS = [
  { x: 2, rot: -18, w: 60, dur: 14, delay: 0, o: 0.35 },
  { x: 16, rot: -10, w: 110, dur: 18, delay: -6, o: 0.55 },
  { x: 31, rot: -4, w: 80, dur: 12, delay: -3, o: 0.45 },
  { x: 46, rot: 1, w: 135, dur: 20, delay: -11, o: 0.6 },
  { x: 62, rot: 7, w: 75, dur: 13, delay: -8, o: 0.4 },
  { x: 76, rot: 13, w: 105, dur: 16, delay: -2, o: 0.5 },
  { x: 90, rot: 19, w: 65, dur: 15, delay: -5, o: 0.3 },
];

const MOTES = [
  { left: 8, size: 2.5, dur: 26, delay: 0, drift: 18 },
  { left: 17, size: 1.5, dur: 34, delay: -9, drift: -12 },
  { left: 28, size: 3, dur: 22, delay: -17, drift: 24 },
  { left: 39, size: 2, dur: 30, delay: -4, drift: -18 },
  { left: 52, size: 3.5, dur: 24, delay: -13, drift: 14 },
  { left: 61, size: 1.5, dur: 36, delay: -22, drift: -10 },
  { left: 72, size: 2.5, dur: 27, delay: -7, drift: 20 },
  { left: 83, size: 2, dur: 32, delay: -19, drift: -16 },
  { left: 93, size: 3, dur: 25, delay: -2, drift: 12 },
];

export function UnderwaterScene({ dim = false }: { dim?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{ opacity: dim ? 0.5 : 1 }}
      aria-hidden="true"
    >
      <div className="uw-depth" />
      <div className="uw-sun" />
      {RAYS.map((r, i) => (
        <span
          key={i}
          className="uw-ray"
          style={
            {
              left: `${r.x}%`,
              width: `${r.w}px`,
              "--ray-rot": `${r.rot}deg`,
              "--ray-dur": `${r.dur}s`,
              "--ray-o": r.o,
              animationDelay: `${r.delay}s`,
            } as CSSProperties
          }
        />
      ))}
      <div className="uw-caustic" />
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="uw-mote"
          style={
            {
              left: `${m.left}%`,
              width: `${m.size}px`,
              height: `${m.size}px`,
              "--mote-dur": `${m.dur}s`,
              "--mote-drift": `${m.drift}px`,
              animationDelay: `${m.delay}s`,
            } as CSSProperties
          }
        />
      ))}
      <Bubbles />
      <div className="uw-vignette" />
    </div>
  );
}
