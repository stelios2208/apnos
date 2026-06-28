import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "el" | "en";

const STORAGE_KEY = "apnos.lang";

type Dict = Record<string, string>;

const en: Dict = {
  // tagline / brand
  "tagline": "breathe · dive · repeat",
  // nav
  "nav.dashboard": "Dashboard",
  "nav.log": "New Dive",
  "nav.history": "History",
  "nav.planner": "Planner",
  "nav.trainer": "Trainer",
  "nav.more": "More",
  "nav.settings": "Settings",
  "nav.equipment": "Equipment",
  "nav.rules": "Rules",
  "common.signOut": "Sign out",
  "common.save": "Save",
  "common.saving": "Saving…",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.add": "Add",
  "common.back": "Back",
  "common.loading": "Loading…",
  "common.minutes": "min",
  "common.seconds": "sec",
  "common.meters": "m",
  "common.training": "Training",
  "common.competition": "Competition",
  "common.export": "Export CSV",
  // landing
  "landing.headline1": "Your freedive,",
  "landing.headline2": "measured",
  "landing.sub": "Track dives, recovery and personal bests across every discipline — from static apnea to constant weight. Quiet, focused, made for the deep.",
  "landing.cta": "Start logging",
  "landing.f1.title": "Every discipline",
  "landing.f1.text": "STA, DYN, DNF, CWT, CNF, FIM & more.",
  "landing.f2.title": "Personal bests",
  "landing.f2.text": "Auto-detected the moment you beat one.",
  "landing.f3.title": "Recovery aware",
  "landing.f3.text": "Log sleep, food & mental state.",
  // auth
  "auth.welcome": "Welcome back",
  "auth.create": "Create your log",
  "auth.diveBack": "Dive back in.",
  "auth.startTracking": "Start tracking your apnea.",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.signIn": "Sign in",
  "auth.createAccount": "Create account",
  "auth.pleaseWait": "Please wait…",
  "auth.newHere": "New to Apnos?",
  "auth.haveAccount": "Already have an account?",
  "auth.createOne": "Create one",
  "auth.welcomeBack": "Welcome back",
  "auth.accountCreated": "Account created — you're in",
  // dashboard
  "dash.title": "Personal bests",
  "dash.loadingDives": "Loading your dives…",
  "dash.summary": "{dives} dives logged · {disc} disciplines",
  "dash.logNew": "Log a new dive",
  "dash.viewProgress": "View progress",
  // log
  "log.titleNew": "New dive",
  "log.titleEdit": "Edit dive",
  "log.subNew": "Log a session and beat your best.",
  "log.subEdit": "Update this session.",
  "log.discipline": "Discipline",
  "log.result": "Result",
  "log.resultTime": "Result (mm:ss)",
  "log.resultDistance": "Result (meters)",
  "log.enterValid": "Enter a valid result",
  "log.date": "Date",
  "log.time": "Time",
  "log.sessionType": "Session type",
  "log.federation": "Federation",
  "log.condition": "Condition & recovery",
  "log.sleep": "Sleep (hours)",
  "log.food": "Food notes",
  "log.foodPlaceholder": "What & when you last ate…",
  "log.mental": "Mental state",
  "log.notes": "General notes",
  "log.notesPlaceholder": "Technique, contractions, conditions…",
  "log.save": "Save dive",
  "log.update": "Update dive",
  "log.newPB": "🏆 New personal best!",
  "log.logged": "Dive logged",
  "log.updated": "Dive updated",
  "log.couldNotSave": "Could not save dive",
  // mental labels
  "mental.1": "Drained",
  "mental.2": "Low",
  "mental.3": "Okay",
  "mental.4": "Good",
  "mental.5": "Peak",
  // history
  "hist.title": "Dive history",
  "hist.sub": "Every session you've logged.",
  "hist.empty": "No dives yet",
  "hist.emptySub": "Log your first session to get started.",
  "hist.newDive": "New dive",
  "hist.deleted": "Dive deleted",
  "hist.sleepShort": "{h}h sleep",
  "hist.mind": "Mind {n}/5",
  "hist.foodLabel": "Food:",
  "hist.notesLabel": "Notes:",
  // discipline detail
  "disc.allDives": "All dives",
  "disc.progress": "Personal best progress",
  "disc.noData": "Log at least two dives to see your progress.",
  "disc.noDives": "No dives logged for this discipline yet.",
  "disc.tabAll": "All",
  // settings
  "set.title": "Profile & Settings",
  "set.account": "Account",
  "set.language": "Language",
  "set.languageDesc": "Choose your interface language.",
  "set.greek": "Ελληνικά",
  "set.english": "English",
  "set.data": "Your data",
  "set.exportDesc": "Download all your dives as a CSV file.",
  "set.signedInAs": "Signed in as",
  // planner
  "plan.title": "Dive planner",
  "plan.sub": "Plan your warm-up and official top.",
  "plan.topTime": "Top Time (TT)",
  "plan.warmupOffset": "Warm-up starts before TT (minutes)",
  "plan.start": "Start plan",
  "plan.stop": "Stop",
  "plan.reset": "Reset",
  "plan.milestones": "Milestones",
  "plan.warmupStart": "Warm-up start",
  "plan.countdown": "Countdown (3 min)",
  "plan.officialTop": "Top Time",
  "plan.now": "Now",
  "plan.until": "in {t}",
  "plan.passed": "passed",
  "plan.running": "Plan running — alarms armed",
  "plan.enterTT": "Enter a top time",
  "plan.alarm": "{label} now!",
  "plan.soundOn": "Sound",
  // equipment
  "equip.title": "Equipment checklist",
  "equip.sub": "Check your gear before every session.",
  "equip.addPlaceholder": "Add custom item…",
  "equip.reset": "Reset checks",
  "equip.progress": "{done}/{total} packed",
  // rules
  "rules.title": "Rules quick reference",
  "rules.sub": "CMAS pool — offline reference.",
};

const el: Dict = {
  "tagline": "breathe · dive · repeat",
  "nav.dashboard": "Πίνακας",
  "nav.log": "Νέα Βουτιά",
  "nav.history": "Ιστορικό",
  "nav.planner": "Πρόγραμμα",
  "nav.trainer": "Trainer",
  "nav.more": "Περισσότερα",
  "nav.settings": "Ρυθμίσεις",
  "nav.equipment": "Εξοπλισμός",
  "nav.rules": "Κανόνες",
  "common.signOut": "Αποσύνδεση",
  "common.save": "Αποθήκευση",
  "common.saving": "Αποθήκευση…",
  "common.cancel": "Άκυρο",
  "common.delete": "Διαγραφή",
  "common.edit": "Επεξεργασία",
  "common.add": "Προσθήκη",
  "common.back": "Πίσω",
  "common.loading": "Φόρτωση…",
  "common.minutes": "λεπ",
  "common.seconds": "δευτ",
  "common.meters": "μ",
  "common.training": "Προπόνηση",
  "common.competition": "Αγώνας",
  "common.export": "Εξαγωγή CSV",
  "landing.headline1": "Η κατάδυσή σου,",
  "landing.headline2": " με απόλυτη ακρίβεια",
  "landing.sub": "Κατάγραψε επιδόσεις, χρόνους και PB σε κάθε αγώνισμα, από τη στατική μέχρι τα σταθερά βάρη. Σχεδιασμένο για απόλυτη εστίαση στην επόμενη βουτιά.",
  "landing.cta": "Ξεκίνα την καταγραφή",
  "landing.f1.title": "Κάθε αγώνισμα",
  "landing.f1.text": "STA, DYN, DNF, CWT, CNF, FIM & άλλα.",
  "landing.f2.title": "Προσωπικά ρεκόρ",
  "landing.f2.text": "Εντοπίζονται αυτόματα μόλις τα ξεπεράσεις.",
  "landing.f3.title": "Αποκατάσταση",
  "landing.f3.text": "Κατέγραψε ύπνο, διατροφή & ψυχολογία.",
  "auth.welcome": "Καλώς ήρθες πίσω",
  "auth.create": "Δημιούργησε το ημερολόγιό σου",
  "auth.diveBack": "Βούτα ξανά.",
  "auth.startTracking": "Ξεκίνα να καταγράφεις την άπνοιά σου.",
  "auth.email": "Email",
  "auth.password": "Κωδικός",
  "auth.signIn": "Σύνδεση",
  "auth.createAccount": "Δημιουργία λογαριασμού",
  "auth.pleaseWait": "Περίμενε…",
  "auth.newHere": "Νέος στο Apnos;",
  "auth.haveAccount": "Έχεις ήδη λογαριασμό;",
  "auth.createOne": "Δημιούργησε έναν",
  "auth.welcomeBack": "Καλώς ήρθες πίσω",
  "auth.accountCreated": "Ο λογαριασμός δημιουργήθηκε — είσαι μέσα",
  "dash.title": "Προσωπικά ρεκόρ",
  "dash.loadingDives": "Φόρτωση βουτιών…",
  "dash.summary": "{dives} βουτιές · {disc} αγωνίσματα",
  "dash.logNew": "Κατέγραψε νέα βουτιά",
  "dash.viewProgress": "Δες την πρόοδο",
  "log.titleNew": "Νέα βουτιά",
  "log.titleEdit": "Επεξεργασία βουτιάς",
  "log.subNew": "Κατέγραψε μια προπόνηση και σπάσε το ρεκόρ σου.",
  "log.subEdit": "Ενημέρωσε αυτή τη βουτιά.",
  "log.discipline": "Αγώνισμα",
  "log.result": "Επίδοση",
  "log.resultTime": "Επίδοση (λεπ:δευτ)",
  "log.resultDistance": "Επίδοση (μέτρα)",
  "log.enterValid": "Δώσε έγκυρη επίδοση",
  "log.date": "Ημερομηνία",
  "log.time": "Ώρα",
  "log.sessionType": "Τύπος",
  "log.federation": "Ομοσπονδία",
  "log.condition": "Κατάσταση & αποκατάσταση",
  "log.sleep": "Ύπνος (ώρες)",
  "log.food": "Διατροφή",
  "log.foodPlaceholder": "Τι & πότε έφαγες…",
  "log.mental": "Ψυχολογία",
  "log.notes": "Σημειώσεις",
  "log.notesPlaceholder": "Τεχνική, συσπάσεις, συνθήκες…",
  "log.save": "Αποθήκευση",
  "log.update": "Ενημέρωση",
  "log.newPB": "🏆 Νέο προσωπικό ρεκόρ!",
  "log.logged": "Η βουτιά καταγράφηκε",
  "log.updated": "Η βουτιά ενημερώθηκε",
  "log.couldNotSave": "Αδυναμία αποθήκευσης",
  "mental.1": "Εξαντλημένος",
  "mental.2": "Χαμηλά",
  "mental.3": "Εντάξει",
  "mental.4": "Καλά",
  "mental.5": "Κορυφή",
  "hist.title": "Ιστορικό βουτιών",
  "hist.sub": "Κάθε προπόνηση που κατέγραψες.",
  "hist.empty": "Καμία βουτιά ακόμα",
  "hist.emptySub": "Κατέγραψε την πρώτη σου προπόνηση.",
  "hist.newDive": "Νέα βουτιά",
  "hist.deleted": "Η βουτιά διαγράφηκε",
  "hist.sleepShort": "{h}ω ύπνος",
  "hist.mind": "Ψυχ. {n}/5",
  "hist.foodLabel": "Διατροφή:",
  "hist.notesLabel": "Σημειώσεις:",
  "disc.allDives": "Όλες οι βουτιές",
  "disc.progress": "Πρόοδος ρεκόρ",
  "disc.noData": "Κατέγραψε τουλάχιστον δύο βουτιές για να δεις πρόοδο.",
  "disc.noDives": "Καμία βουτιά σε αυτό το αγώνισμα ακόμα.",
  "disc.tabAll": "Όλες",
  "set.title": "Προφίλ & Ρυθμίσεις",
  "set.account": "Λογαριασμός",
  "set.language": "Γλώσσα",
  "set.languageDesc": "Επίλεξε τη γλώσσα της εφαρμογής.",
  "set.greek": "Ελληνικά",
  "set.english": "English",
  "set.data": "Τα δεδομένα σου",
  "set.exportDesc": "Κατέβασε όλες τις βουτιές σου ως αρχείο CSV.",
  "set.signedInAs": "Συνδεδεμένος ως",
  "plan.title": "Πρόγραμμα βουτιάς",
  "plan.sub": "Σχεδίασε το ζέσταμα και το επίσημο top.",
  "plan.topTime": "Top Time (TT)",
  "plan.warmupOffset": "Το ζέσταμα ξεκινά πριν το TT (λεπτά)",
  "plan.start": "Έναρξη",
  "plan.stop": "Διακοπή",
  "plan.reset": "Επαναφορά",
  "plan.milestones": "Ορόσημα",
  "plan.warmupStart": "Έναρξη ζεστάματος",
  "plan.countdown": "Αντίστροφη (3 λεπ)",
  "plan.officialTop": "Top Time",
  "plan.now": "Τώρα",
  "plan.until": "σε {t}",
  "plan.passed": "πέρασε",
  "plan.running": "Σε εξέλιξη — ξυπνητήρια ενεργά",
  "plan.enterTT": "Δώσε top time",
  "plan.alarm": "{label} τώρα!",
  "plan.soundOn": "Ήχος",
  "equip.title": "Λίστα εξοπλισμού",
  "equip.sub": "Έλεγξε τον εξοπλισμό σου πριν κάθε προπόνηση.",
  "equip.addPlaceholder": "Πρόσθεσε αντικείμενο…",
  "equip.reset": "Μηδενισμός",
  "equip.progress": "{done}/{total} έτοιμα",
  "rules.title": "Γρήγορη αναφορά κανόνων",
  "rules.sub": "CMAS πισίνα — αναφορά χωρίς σύνδεση.",
};

const DICTS: Record<Lang, Dict> = { el, en };

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function interpolate(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("el");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? (localStorage.getItem(STORAGE_KEY) as Lang | null) : null;
    if (stored === "el" || stored === "en") setLangState(stored);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, l);
  };

  const t = (key: string, vars?: Record<string, string | number>) => {
    const dict = DICTS[lang];
    const val = dict[key] ?? en[key] ?? key;
    return interpolate(val, vars);
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
