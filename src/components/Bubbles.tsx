/** Slowly rising bubbles for the underwater hero scene. */
export function Bubbles({ className }: { className?: string }) {
  const bubbles = [
    { left: 8, size: 10, delay: 0, dur: 13, drift: 14 },
    { left: 18, size: 6, delay: 4, dur: 16, drift: -10 },
    { left: 28, size: 14, delay: 1.5, dur: 11, drift: 18 },
    { left: 40, size: 5, delay: 6, dur: 18, drift: -8 },
    { left: 52, size: 9, delay: 2.5, dur: 14, drift: 12 },
    { left: 63, size: 16, delay: 0.5, dur: 10, drift: -16 },
    { left: 72, size: 7, delay: 5, dur: 15, drift: 10 },
    { left: 82, size: 11, delay: 3, dur: 12, drift: -12 },
    { left: 92, size: 6, delay: 7, dur: 17, drift: 8 },
  ];

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`} aria-hidden="true">
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="bubble"
          style={
            {
              left: `${b.left}%`,
              width: `${b.size}px`,
              height: `${b.size}px`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.dur}s`,
              "--drift": `${b.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
