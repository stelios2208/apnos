import { createFileRoute } from "@tanstack/react-router";
import { Flag, CheckCircle2, Square, XCircle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/lib/i18n";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/rules")({
  head: () => ({ meta: [{ title: "Rules — Apnos" }] }),
  component: () => (
    <AppLayout>
      <Rules />
    </AppLayout>
  ),
});

interface Section {
  id: string;
  icon: typeof Flag;
  title: { el: string; en: string };
  points: { el: string; en: string }[];
}

const SECTIONS: Section[] = [
  {
    id: "start",
    icon: Flag,
    title: { el: "Πρωτόκολλο εκκίνησης", en: "Start protocol" },
    points: [
      { el: "Επίσημη ώρα εκκίνησης (Official Top, OT) ανακοινώνεται από τον κριτή.", en: "Official Top (OT) is announced by the judge." },
      { el: "Αντίστροφη μέτρηση: συνήθως 3 λεπτά πριν το OT (−3:00, −2:00, −1:00, −30, −20, −10, και 5 4 3 2 1).", en: "Countdown: typically 3 minutes before OT (−3:00, −2:00, −1:00, −30, −20, −10, then 5 4 3 2 1)." },
      { el: "Εκκίνηση επιτρέπεται από −0:00 έως +0:30 (παράθυρο εκκίνησης 30 δευτ).", en: "Start is allowed from −0:00 to +0:30 (30s start window)." },
      { el: "Εκκίνηση πριν το OT ή μετά τα +30 δευτ = ακυρωτική.", en: "Starting before OT or after +30s = disqualification." },
    ],
  },
  {
    id: "surface",
    icon: CheckCircle2,
    title: { el: "Πρωτόκολλο επιφάνειας (SP)", en: "Surface protocol (SP)" },
    points: [
      { el: "Εντός 15 δευτ από την ανάδυση πρέπει να ολοκληρωθεί το πρωτόκολλο.", en: "The protocol must be completed within 15s of surfacing." },
      { el: "1) Αφαίρεση εξοπλισμού προσώπου (μάσκα/κλιπ). 2) Σήμα OK με το χέρι. 3) Λεκτικό σήμα «I'm OK».", en: "1) Remove facial equipment (mask/clip). 2) Hand OK sign. 3) Verbal signal \u201cI'm OK\u201d." },
      { el: "Σωστή σειρά εντός του χρονικού ορίου = λευκή κάρτα.", en: "Correct order within the time limit = white card." },
      { el: "Ο αθλητής πρέπει να διατηρεί τους αεραγωγούς πάνω από το νερό για ≥ 20 δευτ μετά την ανάδυση.", en: "The athlete must keep airways above water for \u2265 20s after surfacing." },
    ],
  },
  {
    id: "cards",
    icon: Square,
    title: { el: "Κάρτες (λευκή / κίτρινη / κόκκινη)", en: "Cards (white / yellow / red)" },
    points: [
      { el: "🟢 Λευκή: έγκυρη προσπάθεια — μετράει η επίδοση.", en: "🟢 White: valid performance — result counts." },
      { el: "🟡 Κίτρινη: ποινή (penalty) αλλά η επίδοση μετράει με αφαίρεση πόντων.", en: "🟡 Yellow: penalty applied but performance still counts with point deduction." },
      { el: "🔴 Κόκκινη: ακύρωση (DQ) — η επίδοση δεν μετράει.", en: "🔴 Red: disqualification (DQ) — performance does not count." },
    ],
  },
  {
    id: "dq",
    icon: XCircle,
    title: { el: "Λόγοι ακύρωσης (DQ)", en: "DQ reasons" },
    points: [
      { el: "Samba / blackout (απώλεια κινητικού ελέγχου ή αισθήσεων).", en: "Samba / blackout (loss of motor control or consciousness)." },
      { el: "Λανθασμένο ή εκπρόθεσμο πρωτόκολλο επιφάνειας.", en: "Incorrect or late surface protocol." },
      { el: "Άγγιγμα από τον αθλητή σε τρίτους για υποστήριξη πριν το SP.", en: "Athlete touching others for support before the SP." },
      { el: "Βύθιση αεραγωγών πριν ολοκληρωθεί το SP / εντός 20 δευτ.", en: "Airways submerging before SP completion / within 20s." },
      { el: "Εκκίνηση εκτός του παραθύρου (early/late start).", en: "Start outside the window (early/late start)." },
    ],
  },
];

function Rules() {
  const { t, lang } = useI18n();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("rules.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("rules.sub")}</p>
      </div>

      <Accordion type="multiple" defaultValue={["start"]} className="space-y-3">
        {SECTIONS.map((s) => (
          <AccordionItem key={s.id} value={s.id} className="glass-card rounded-2xl border-none px-4">
            <AccordionTrigger className="hover:no-underline">
              <span className="flex items-center gap-2.5 text-left text-sm font-semibold">
                <s.icon className="size-4 shrink-0 text-primary" />
                {s.title[lang]}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 pb-2">
                {s.points.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70" />
                    <span>{p[lang]}</span>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
