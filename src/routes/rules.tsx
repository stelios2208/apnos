import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flag, CheckCircle2, Square, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/lib/i18n";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { fetchRuleSections, fetchRulePoints } from "@/lib/admin-content";

export const Route = createFileRoute("/rules")({
  head: () => ({ meta: [{ title: "Rules — Apnos" }] }),
  component: () => (
    <AppLayout>
      <Rules />
    </AppLayout>
  ),
});

// The admin panel stores a section's icon as a lucide icon name (free text).
// Map the ones we ship with to their components; anything unknown falls back
// to Flag so a mistyped name never crashes the page.
const SECTION_ICONS: Record<string, LucideIcon> = {
  Flag,
  CheckCircle2,
  Square,
  XCircle,
};

function iconFor(name: string): LucideIcon {
  return SECTION_ICONS[name] ?? Flag;
}

function Rules() {
  const { t, lang } = useI18n();

  const {
    data: sections = [],
    isLoading: sectionsLoading,
    isError: sectionsError,
  } = useQuery({
    queryKey: ["rule_sections"],
    queryFn: fetchRuleSections,
  });
  const {
    data: points = [],
    isLoading: pointsLoading,
    isError: pointsError,
  } = useQuery({
    queryKey: ["rule_points"],
    queryFn: () => fetchRulePoints(),
  });

  const isLoading = sectionsLoading || pointsLoading;
  const isError = sectionsError || pointsError;

  const activeSections = sections.filter((s) => s.is_active);
  const activePoints = points.filter((p) => p.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("rules.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("rules.sub")}</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">
          {lang === "el" ? "Σφάλμα φόρτωσης κανόνων." : "Failed to load rules."}
        </p>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={activeSections[0] ? [activeSections[0].id] : []}
          className="space-y-3"
        >
          {activeSections.map((s) => {
            const Icon = iconFor(s.icon);
            const sectionPoints = activePoints.filter((p) => p.section_id === s.id);
            return (
              <AccordionItem
                key={s.id}
                value={s.id}
                className="glass-card rounded-2xl border-none px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2.5 text-left text-sm font-semibold">
                    <Icon className="size-4 shrink-0 text-primary" />
                    {lang === "el" ? s.title_el : s.title_en}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 pb-2">
                    {sectionPoints.map((p) => (
                      <li key={p.id} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70" />
                        <span>{lang === "el" ? p.content_el : p.content_en}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
