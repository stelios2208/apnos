import { Link } from "@tanstack/react-router";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={className}>
      <span className="block text-2xl font-extrabold lowercase tracking-tight text-gradient">
        apnos
      </span>
      <span className="block text-[0.6rem] font-medium uppercase tracking-[0.35em] text-muted-foreground">
        breathe · dive · repeat
      </span>
    </Link>
  );
}
