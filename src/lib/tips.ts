// Freediving knowledge cards — equalization, mental prep, relaxation, technique
// and safety. Kept accurate and conservative (safety cards especially). All free
// for now; the `premium` flag lets a paid tier be layered in later without
// restructuring.

export type TipCategory = "eq" | "mental" | "relax" | "technique" | "safety";

export interface Tip {
  id: string;
  category: TipCategory;
  title_el: string;
  title_en: string;
  body_el: string;
  body_en: string;
  premium?: boolean;
}

export const TIP_CATEGORIES: { id: TipCategory; el: string; en: string; color: string }[] = [
  { id: "safety", el: "Ασφάλεια", en: "Safety", color: "#EF6B5E" },
  { id: "eq", el: "Εξίσωση", en: "Equalization", color: "#4FA8E0" },
  { id: "mental", el: "Νους", en: "Mental", color: "#B58BE8" },
  { id: "relax", el: "Χαλάρωση", en: "Relaxation", color: "#5DCAA5" },
  { id: "technique", el: "Τεχνική", en: "Technique", color: "#1D9E75" },
];

export function categoryColor(cat: TipCategory): string {
  return TIP_CATEGORIES.find((c) => c.id === cat)?.color ?? "#5DCAA5";
}

export function categoryLabel(cat: TipCategory, lang: string): string {
  const c = TIP_CATEGORIES.find((x) => x.id === cat);
  return c ? (lang === "el" ? c.el : c.en) : cat;
}

export const TIPS: Tip[] = [
  // ── Safety ────────────────────────────────────────────────────────────────
  {
    id: "buddy",
    category: "safety",
    title_el: "Ποτέ μόνος — πάντα με buddy",
    title_en: "Never alone — always with a buddy",
    body_el:
      "Μην κάνεις ποτέ άπνοια μόνος, ούτε στην πισίνα ούτε στη θάλασσα ούτε στο ξηρό μέσα σε νερό. Δουλέψτε «ένας κάτω, ένας πάνω»: ο buddy σε παρακολουθεί ενεργά και είναι έτοιμος να επέμβει. Η πλειοψηφία των θανάτων στην ελεύθερη κατάδυση συμβαίνει σε άτομα που κατέδυαν μόνα τους.",
    body_en:
      "Never do apnea alone — not in the pool, not in open water, not dry-static near water. Work one-up-one-down: your buddy actively watches you and is ready to act. The majority of freediving fatalities happen to people diving alone.",
  },
  {
    id: "supervision",
    category: "safety",
    title_el: "Άμεση επιτήρηση & επιφάνεια 30''",
    title_en: "Direct supervision & 30s at the surface",
    body_el:
      "Ο buddy επιτηρεί ενεργά το τελευταίο και πιο επικίνδυνο κομμάτι: την ανάδυση και τα πρώτα 30 δευτερόλεπτα στην επιφάνεια, όπου συμβαίνουν τα περισσότερα blackout. Μείνε δίπλα, με βλεμματική επαφή, μέχρι ο διαχειριστής να δώσει καθαρό σήμα OK.",
    body_en:
      "Your buddy actively supervises the most dangerous phase: the ascent and the first 30 seconds at the surface, where most blackouts occur. Stay close, keep eye contact, until the diver gives a clear OK signal.",
  },
  {
    id: "surface-protocol",
    category: "safety",
    title_el: "Πρωτόκολλο επιφάνειας",
    title_en: "Surface protocol",
    body_el:
      "Μόλις βγεις: κράτα το σημείο, βγάλε κλιπ/μάσκα, κάνε hook breaths, δώσε το σήμα «OK» και πες φωναχτά «I'm OK». Αυτή η σειρά κρατά ανοιχτό τον αεραγωγό και επιβεβαιώνει στον buddy ότι έχεις συνείδηση.",
    body_en:
      "On surfacing: hold the float, remove noseclip/mask, do hook breaths, give the OK sign and say out loud \"I'm OK\". This sequence keeps the airway open and confirms to your buddy that you're conscious.",
  },
  {
    id: "no-hyperventilation",
    category: "safety",
    title_el: "Όχι υπεραερισμός",
    title_en: "No hyperventilation",
    body_el:
      "Ο υπεραερισμός (γρήγορες βαθιές αναπνοές) ΔΕΝ προσθέτει οξυγόνο — απλώς μειώνει το CO2 και καθυστερεί την ανάγκη για αναπνοή. Έτσι μπορεί να λιποθυμήσεις από έλλειψη οξυγόνου χωρίς προειδοποίηση. Ανάπνευσε ήρεμα και φυσιολογικά.",
    body_en:
      "Hyperventilation (fast deep breaths) does NOT add oxygen — it only lowers CO2 and delays the urge to breathe. That lets you black out from low oxygen with no warning. Breathe calmly and normally instead.",
  },
  {
    id: "samba-bo",
    category: "safety",
    title_el: "Αναγνώρισε samba & blackout",
    title_en: "Recognise samba & blackout",
    body_el:
      "Το LMC («samba») είναι απώλεια κινητικού ελέγχου· το blackout είναι απώλεια συνείδησης. Και τα δύο θέλουν άμεση αντίδραση: κράτα τον αεραγωγό έξω από το νερό, αφαίρεσε εξοπλισμό προσώπου, μίλα του, φύσα στο πρόσωπο. Μην ξανακαταδυθείς αν συνέβη — τελείωσε η προπόνηση.",
    body_en:
      'LMC ("samba") is loss of motor control; blackout is loss of consciousness. Both need immediate action: keep the airway out of the water, remove face gear, talk to them, blow on the face. If it happened, don\'t dive again — the session is over.',
  },

  // ── Equalization ────────────────────────────────────────────────────────────
  {
    id: "frenzel",
    category: "eq",
    title_el: "Frenzel, όχι Valsalva",
    title_en: "Frenzel, not Valsalva",
    body_el:
      "Η Valsalva (σπρώξιμο με τους πνεύμονες/διάφραγμα) γίνεται αδύνατη στο βάθος και σπαταλά ενέργεια. Μάθε Frenzel: χρησιμοποιείς τη γλώσσα σαν έμβολο για να στείλεις αέρα στα αυτιά, με κλειστή γλωττίδα. Είναι η βάση για κάθε κατάδυση βάθους.",
    body_en:
      "Valsalva (pushing from the lungs/diaphragm) becomes impossible at depth and wastes energy. Learn Frenzel: use the tongue as a piston to push air to the ears with a closed glottis. It's the foundation of every depth dive.",
  },
  {
    id: "eq-early",
    category: "eq",
    title_el: "Εξίσωσε νωρίς & συχνά",
    title_en: "Equalize early & often",
    body_el:
      "Μην περιμένεις να νιώσεις πίεση. Εξίσωσε πριν την κατάδυση, στην επιφάνεια, και μετά συνεχώς — κάθε μέτρο περίπου στα πρώτα μέτρα. Αν καθυστερήσεις και πονέσει το αυτί, σταμάτα και ανέβα λίγο· ποτέ μη σπρώχνεις με ζόρι.",
    body_en:
      "Don't wait to feel pressure. Equalize before the dive at the surface, then continuously — roughly every metre in the first few metres. If you fall behind and the ear hurts, stop and ascend slightly; never force it.",
  },
  {
    id: "mouthfill",
    category: "eq",
    title_el: "Mouthfill (προχωρημένο)",
    title_en: "Mouthfill (advanced)",
    body_el:
      "Για μεγαλύτερα βάθη, γεμίζεις το στόμα με αέρα πριν φτάσεις κοντά στον υπολειπόμενο όγκο και εξισώνεις από αυτό το «απόθεμα» καθώς κατεβαίνεις. Απαιτεί καλή τεχνική και χαλαρότητα — μάθε το σταδιακά με εκπαιδευτή.",
    body_en:
      "For deeper dives, you fill the mouth with air before approaching residual volume and equalize from that reserve as you descend. It needs solid technique and relaxation — build it gradually with an instructor.",
    premium: true,
  },

  // ── Mental ──────────────────────────────────────────────────────────────────
  {
    id: "visualization",
    category: "mental",
    title_el: "Οπτικοποίηση της βουτιάς",
    title_en: "Visualize the dive",
    body_el:
      "Πριν βουτήξεις, «τρέξε» νοερά ολόκληρη τη βουτιά: την τελευταία αναπνοή, την κάθοδο, το γύρισμα, την άνοδο, την επιφάνεια. Η επανάληψη στο μυαλό μειώνει το άγχος και αυτοματοποιεί την τεχνική.",
    body_en:
      "Before you dive, mentally rehearse the whole thing: the final breath, the descent, the turn, the ascent, the surface. Rehearsing it in your mind lowers anxiety and makes the technique automatic.",
  },
  {
    id: "long-exhale",
    category: "mental",
    title_el: "Μεγαλύτερη εκπνοή = ηρεμία",
    title_en: "Longer exhale = calm",
    body_el:
      "Η εκπνοή ενεργοποιεί το παρασυμπαθητικό νευρικό σύστημα. Κάνε την εκπνοή σου διπλάσια από την εισπνοή (π.χ. 4 μέσα / 8 έξω) για να πέσει ο καρδιακός ρυθμός και να χαλαρώσεις πριν την προσπάθεια.",
    body_en:
      "Exhaling activates the parasympathetic nervous system. Make your exhale about twice your inhale (e.g. 4 in / 8 out) to lower your heart rate and relax before an attempt.",
  },
  {
    id: "contractions-ok",
    category: "mental",
    title_el: "Οι συσπάσεις είναι φυσιολογικές",
    title_en: "Contractions are normal",
    body_el:
      "Οι συσπάσεις του διαφράγματος σημαίνουν άνοδο του CO2 — ΔΕΝ σημαίνουν ότι τελείωσε το οξυγόνο. Είναι φυσιολογικές και συχνά έρχονται πολύ πριν το πραγματικό όριο. Μείνε χαλαρός, μη σφίγγεσαι, άσε το σώμα βαρύ.",
    body_en:
      "Diaphragm contractions signal rising CO2 — they do NOT mean you're out of oxygen. They're normal and often come well before your real limit. Stay relaxed, don't tense up, let your body go heavy.",
  },

  // ── Relaxation ──────────────────────────────────────────────────────────────
  {
    id: "breathe-up",
    category: "relax",
    title_el: "Ήρεμο breathe-up",
    title_en: "Calm breathe-up",
    body_el:
      "Ανάπνευσε αργά και διαφραγματικά για 1–2 λεπτά πριν την προσπάθεια: χαλαρές εισπνοές, μεγάλες εκπνοές, χωρίς ζόρι. Η τελευταία αναπνοή είναι γεμάτη αλλά όχι υπερβολικά — άνετη, όχι packing στην αρχή.",
    body_en:
      "Breathe slowly and diaphragmatically for 1–2 minutes before the attempt: relaxed inhales, long exhales, no strain. The final breath is full but not maximal — comfortable, no packing as a beginner.",
  },
  {
    id: "body-scan",
    category: "relax",
    title_el: "Σάρωση σώματος",
    title_en: "Body scan",
    body_el:
      "Κατά το breathe-up, πέρνα νοερά από κάθε μέρος του σώματος — ώμοι, σαγόνι, χέρια, πόδια — και άφησέ το να χαλαρώσει. Η μυϊκή ένταση καίει οξυγόνο· η χαλάρωση σε κάνει πιο οικονομικό.",
    body_en:
      "During the breathe-up, mentally pass through each body part — shoulders, jaw, hands, legs — and let it soften. Muscle tension burns oxygen; relaxation makes you more economical.",
  },

  // ── Technique ───────────────────────────────────────────────────────────────
  {
    id: "glide-dyn",
    category: "technique",
    title_el: "Streamline & glide στη Δυναμική",
    title_en: "Streamline & glide in Dynamic",
    body_el:
      "Στη δυναμική, η ταχύτητα σπαταλά οξυγόνο. Στόχευσε σε καθαρή θέση streamline (χέρια τεντωμένα, κεφάλι ουδέτερο) και μεγάλο glide μετά από κάθε κίνηση. Λιγότερες, πιο αποδοτικές κινήσεις κερδίζουν απόσταση.",
    body_en:
      "In dynamic, speed wastes oxygen. Aim for a clean streamline (arms extended, head neutral) and a long glide after each stroke/kick. Fewer, more efficient movements win distance.",
  },
  {
    id: "duck-dive",
    category: "technique",
    title_el: "Καθαρό duck dive",
    title_en: "Clean duck dive",
    body_el:
      "Στο βάθος, ένα καθαρό duck dive σε βάζει κατακόρυφα με ελάχιστη ενέργεια. Λύγισε από τη μέση, σήκωσε τα πόδια κατακόρυφα πάνω από το νερό ώστε το βάρος τους να σε σπρώξει κάτω, και ξεκίνα τα χτυπήματα μόνο όταν βυθιστούν τα πτερύγια.",
    body_en:
      "At depth, a clean duck dive gets you vertical with minimal energy. Bend at the waist, lift your legs vertically out of the water so their weight drives you down, and start kicking only once the fins are submerged.",
  },
];
