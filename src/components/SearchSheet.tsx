import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, X, ChevronRight } from "lucide-react";
import { listPublicProfiles } from "@/lib/profiles";
import { useI18n } from "@/lib/i18n";
import { athleteInitials, athleteColor } from "@/lib/athletes";

// ── SearchSheet ──────────────────────────────────────────────────────────────
// Full-screen search overlay opened from the bottom-nav "Αναζήτηση" button. It
// searches the public athlete directory (listPublicProfiles) by name/country —
// the same cross-user read surface the /athlete pages already use — so there is
// no new route or backend. Tapping a result opens that athlete's public page.
export function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useI18n();
  const el = lang === "el";
  const [q, setQ] = useState("");

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["search-public-profiles"],
    queryFn: () => listPublicProfiles(100),
    enabled: open,
  });

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return profiles;
    return profiles.filter(
      (p) =>
        (p.display_name ?? "").toLowerCase().includes(term) ||
        (p.country ?? "").toLowerCase().includes(term),
    );
  }, [q, profiles]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ background: "rgba(2,10,20,0.88)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 pt-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* search field */}
        <div className="flex items-center gap-2">
          <div
            className="flex flex-1 items-center gap-2 rounded-2xl px-3 py-3"
            style={{ background: "var(--card)", border: "1px solid rgba(var(--ink),0.12)" }}
          >
            <Search className="size-5 shrink-0 text-foreground/40" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={el ? "Αναζήτηση αθλητών…" : "Search athletes…"}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/35"
            />
          </div>
          <button
            onClick={onClose}
            aria-label={el ? "Κλείσιμο" : "Close"}
            className="pressable flex size-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "rgba(var(--ink),0.06)", color: "rgba(var(--ink),0.6)" }}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* results */}
        <div className="no-scrollbar mt-4 flex-1 overflow-y-auto pb-8">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-foreground/30">
              {el ? "Φόρτωση…" : "Loading…"}
            </p>
          ) : results.length === 0 ? (
            <p className="py-10 text-center text-sm text-foreground/30">
              {el ? "Κανένας αθλητής δεν βρέθηκε." : "No athletes found."}
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map((p) => {
                const name = p.display_name || (el ? "Αθλητής" : "Athlete");
                const color = athleteColor(p.user_id);
                return (
                  <li key={p.user_id}>
                    <Link
                      to="/athlete/$id"
                      params={{ id: p.user_id }}
                      onClick={onClose}
                      className="pressable flex items-center gap-3 rounded-2xl px-3 py-3"
                      style={{
                        background: "var(--card)",
                        border: "1px solid rgba(var(--ink),0.06)",
                      }}
                    >
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt=""
                          className="size-11 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          className="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                          style={{ background: `${color}22`, color }}
                        >
                          {athleteInitials(name)}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                        {p.country && (
                          <p className="truncate text-xs text-foreground/40">{p.country}</p>
                        )}
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-foreground/20" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
