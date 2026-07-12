// Country flag as a real image (flagcdn.com) — emoji flags don't render on
// Windows Chrome and several Android WebViews, so images are the reliable way.
// Renders nothing for an invalid/empty ISO alpha-2 code, and hides itself if
// the image fails to load (offline etc.).
export function Flag({ code, className }: { code: string; className?: string }) {
  const c = code.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(c)) return null;
  return (
    <img
      src={`https://flagcdn.com/w40/${c}.png`}
      srcSet={`https://flagcdn.com/w80/${c}.png 2x`}
      alt={c.toUpperCase()}
      className={className ?? "inline-block h-3.5 w-auto rounded-[2px]"}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}
