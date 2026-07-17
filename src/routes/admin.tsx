import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { TIP_CATEGORIES, categoryColor } from "@/lib/tips";
import {
  type Tip,
  type TipInput,
  type TipCategory,
  type RuleSection,
  type RuleSectionInput,
  type RulePoint,
  type RulePointInput,
  isAdmin,
  slugify,
  fetchTips,
  createTip,
  updateTip,
  deleteTip,
  fetchRuleSections,
  createRuleSection,
  updateRuleSection,
  deleteRuleSection,
  fetchRulePoints,
  createRulePoint,
  updateRulePoint,
  deleteRulePoint,
} from "@/lib/admin-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Apnos" }] }),
  component: () => (
    <AppLayout>
      <AdminPage />
    </AppLayout>
  ),
});

// ── Access gate ──────────────────────────────────────────────────────────────

function AdminPage() {
  const { lang } = useI18n();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-foreground/20" />
      </div>
    );
  }

  if (!user || !isAdmin(user)) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <Lock className="size-8 text-foreground/20" />
        <p className="text-sm text-foreground/50">
          {lang === "el"
            ? "Δεν έχεις πρόσβαση σε αυτή τη σελίδα."
            : "You are not authorized to view this page."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">
          {lang === "el" ? "Διαχείριση περιεχομένου" : "Content admin"}
        </h1>
      </div>

      <Tabs defaultValue="tips">
        <TabsList className="w-full">
          <TabsTrigger value="tips" className="flex-1">
            {lang === "el" ? "Συμβουλές" : "Tips"}
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex-1">
            {lang === "el" ? "Κανόνες" : "Rules"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tips" className="mt-5">
          <TipsTab lang={lang} />
        </TabsContent>
        <TabsContent value="rules" className="mt-5">
          <RulesTab lang={lang} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Shared form field ────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ── Tips tab ─────────────────────────────────────────────────────────────────

function emptyTipInput(): TipInput {
  return {
    id: "",
    category: "safety",
    title_el: "",
    title_en: "",
    body_el: "",
    body_en: "",
    premium: false,
    sort_order: 0,
    is_active: true,
  };
}

function tipToInput(tip: Tip): TipInput {
  return {
    id: tip.id,
    category: tip.category,
    title_el: tip.title_el,
    title_en: tip.title_en,
    body_el: tip.body_el,
    body_en: tip.body_en,
    premium: tip.premium,
    sort_order: tip.sort_order,
    is_active: tip.is_active,
  };
}

function TipsTab({ lang }: { lang: string }) {
  const qc = useQueryClient();
  const { data: tips = [], isLoading } = useQuery({
    queryKey: ["admin_tips"],
    queryFn: fetchTips,
  });

  // `editing` holds the tip being edited; `creating` opens an empty form.
  const [editing, setEditing] = useState<Tip | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tip | null>(null);

  const upsert = useMutation({
    mutationFn: ({ input, isNew }: { input: TipInput; isNew: boolean }) =>
      isNew ? createTip(input) : updateTip(input.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_tips"] });
      setEditing(null);
      setCreating(false);
      toast.success(lang === "el" ? "Αποθηκεύτηκε" : "Saved");
    },
    onError: () => toast.error(lang === "el" ? "Σφάλμα αποθήκευσης" : "Save failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTip(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_tips"] });
      setDeleteTarget(null);
      toast.success(lang === "el" ? "Διαγράφηκε" : "Deleted");
    },
    onError: () => toast.error(lang === "el" ? "Σφάλμα διαγραφής" : "Delete failed"),
  });

  return (
    <div className="space-y-5">
      <Button onClick={() => setCreating(true)} className="w-full sm:w-auto">
        <Plus className="size-4" />
        {lang === "el" ? "Νέα συμβουλή" : "New tip"}
      </Button>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-foreground/20" />
        </div>
      ) : tips.length === 0 ? (
        <p className="py-8 text-center text-sm text-foreground/30">
          {lang === "el" ? "Καμία συμβουλή ακόμα." : "No tips yet."}
        </p>
      ) : (
        <div className="space-y-6">
          {TIP_CATEGORIES.map((cat) => {
            const catTips = tips.filter((t) => t.category === cat.id);
            if (catTips.length === 0) return null;
            return (
              <div key={cat.id} className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground/40">
                  {lang === "el" ? cat.el : cat.en}
                </h2>
                {catTips.map((tip) => (
                  <TipRow
                    key={tip.id}
                    tip={tip}
                    lang={lang}
                    onEdit={() => setEditing(tip)}
                    onDelete={() => setDeleteTarget(tip)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      <TipFormDialog
        open={creating || editing !== null}
        tip={editing}
        lang={lang}
        saving={upsert.isPending}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSave={(input, isNew) => upsert.mutate({ input, isNew })}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lang === "el" ? "Διαγραφή συμβουλής;" : "Delete tip?"}
            </AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.title_en}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === "el" ? "Άκυρο" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {lang === "el" ? "Διαγραφή" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TipRow({
  tip,
  lang,
  onEdit,
  onDelete,
}: {
  tip: Tip;
  lang: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const color = categoryColor(tip.category);
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-input px-4 py-3",
        !tip.is_active && "opacity-40",
      )}
    >
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{tip.title_en}</span>
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider"
            style={{ background: `${color}22`, color }}
          >
            {tip.category}
          </span>
          {tip.premium && (
            <Badge variant="secondary" className="shrink-0 text-[0.55rem]">
              {lang === "el" ? "Premium" : "Premium"}
            </Badge>
          )}
          {!tip.is_active && (
            <span className="shrink-0 text-[0.55rem] font-semibold uppercase tracking-wider text-foreground/40">
              {lang === "el" ? "Ανενεργό" : "Inactive"}
            </span>
          )}
        </div>
      </button>
      <button
        onClick={onEdit}
        className="rounded-md p-1.5 text-foreground/30 transition-colors hover:text-foreground"
        aria-label={lang === "el" ? "Επεξεργασία" : "Edit"}
      >
        <Pencil className="size-4" />
      </button>
      <button
        onClick={onDelete}
        className="rounded-md p-1.5 text-foreground/30 transition-colors hover:text-destructive"
        aria-label={lang === "el" ? "Διαγραφή" : "Delete"}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function TipFormDialog({
  open,
  tip,
  lang,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  tip: Tip | null;
  lang: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: TipInput, isNew: boolean) => void;
}) {
  const isNew = tip === null;
  const [form, setForm] = useState<TipInput>(emptyTipInput);
  // Once the admin hand-edits the id we stop auto-suggesting from the title.
  const [idTouched, setIdTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(tip ? tipToInput(tip) : emptyTipInput());
    setIdTouched(false);
  }, [open, tip]);

  const set = <K extends keyof TipInput>(key: K, value: TipInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onTitleEn = (value: string) => {
    setForm((f) => ({
      ...f,
      title_en: value,
      id: isNew && !idTouched ? slugify(value) : f.id,
    }));
  };

  const valid = form.id.trim() !== "" && form.title_en.trim() !== "";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNew
              ? lang === "el"
                ? "Νέα συμβουλή"
                : "New tip"
              : lang === "el"
                ? "Επεξεργασία συμβουλής"
                : "Edit tip"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="ID (slug)">
            <Input
              value={form.id}
              disabled={!isNew}
              onChange={(e) => {
                setIdTouched(true);
                set("id", e.target.value);
              }}
              placeholder="buddy"
            />
          </Field>

          <Field label={lang === "el" ? "Κατηγορία" : "Category"}>
            <Select value={form.category} onValueChange={(v) => set("category", v as TipCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIP_CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {lang === "el" ? c.el : c.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={lang === "el" ? "Τίτλος (EN)" : "Title (EN)"}>
            <Input value={form.title_en} onChange={(e) => onTitleEn(e.target.value)} />
          </Field>
          <Field label={lang === "el" ? "Τίτλος (EL)" : "Title (EL)"}>
            <Input value={form.title_el} onChange={(e) => set("title_el", e.target.value)} />
          </Field>
          <Field label={lang === "el" ? "Κείμενο (EN)" : "Body (EN)"}>
            <Textarea
              rows={4}
              value={form.body_en}
              onChange={(e) => set("body_en", e.target.value)}
            />
          </Field>
          <Field label={lang === "el" ? "Κείμενο (EL)" : "Body (EL)"}>
            <Textarea
              rows={4}
              value={form.body_el}
              onChange={(e) => set("body_el", e.target.value)}
            />
          </Field>

          <Field label={lang === "el" ? "Σειρά" : "Sort order"}>
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) => set("sort_order", Number.parseInt(e.target.value, 10) || 0)}
            />
          </Field>

          <ToggleRow
            label={lang === "el" ? "Premium" : "Premium"}
            checked={form.premium}
            onChange={(v) => set("premium", v)}
          />
          <ToggleRow
            label={lang === "el" ? "Ενεργό" : "Active"}
            checked={form.is_active}
            onChange={(v) => set("is_active", v)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {lang === "el" ? "Άκυρο" : "Cancel"}
          </Button>
          <Button disabled={!valid || saving} onClick={() => onSave(form, isNew)}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {lang === "el" ? "Αποθήκευση" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Rules tab ────────────────────────────────────────────────────────────────

function emptySectionInput(): RuleSectionInput {
  return { id: "", icon: "Flag", title_el: "", title_en: "", sort_order: 0, is_active: true };
}

function sectionToInput(s: RuleSection): RuleSectionInput {
  return {
    id: s.id,
    icon: s.icon,
    title_el: s.title_el,
    title_en: s.title_en,
    sort_order: s.sort_order,
    is_active: s.is_active,
  };
}

function RulesTab({ lang }: { lang: string }) {
  const qc = useQueryClient();
  const { data: sections = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ["admin_rule_sections"],
    queryFn: fetchRuleSections,
  });
  const { data: points = [], isLoading: pointsLoading } = useQuery({
    queryKey: ["admin_rule_points"],
    queryFn: () => fetchRulePoints(),
  });

  const [editingSection, setEditingSection] = useState<RuleSection | null>(null);
  const [creatingSection, setCreatingSection] = useState(false);
  // For point editing: the point itself; for creating: the target section id.
  const [editingPoint, setEditingPoint] = useState<RulePoint | null>(null);
  const [creatingPointSection, setCreatingPointSection] = useState<string | null>(null);

  const sectionUpsert = useMutation({
    mutationFn: ({ input, isNew }: { input: RuleSectionInput; isNew: boolean }) =>
      isNew ? createRuleSection(input) : updateRuleSection(input.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_rule_sections"] });
      setEditingSection(null);
      setCreatingSection(false);
      toast.success(lang === "el" ? "Αποθηκεύτηκε" : "Saved");
    },
    onError: () => toast.error(lang === "el" ? "Σφάλμα αποθήκευσης" : "Save failed"),
  });

  const sectionRemove = useMutation({
    mutationFn: (id: string) => deleteRuleSection(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_rule_sections"] });
      qc.invalidateQueries({ queryKey: ["admin_rule_points"] });
      toast.success(lang === "el" ? "Διαγράφηκε" : "Deleted");
    },
    onError: () => toast.error(lang === "el" ? "Σφάλμα διαγραφής" : "Delete failed"),
  });

  const pointUpsert = useMutation({
    mutationFn: ({
      id,
      input,
      isNew,
    }: {
      id: string | null;
      input: RulePointInput;
      isNew: boolean;
    }) => (isNew || id === null ? createRulePoint(input) : updateRulePoint(id, input)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_rule_points"] });
      setEditingPoint(null);
      setCreatingPointSection(null);
      toast.success(lang === "el" ? "Αποθηκεύτηκε" : "Saved");
    },
    onError: () => toast.error(lang === "el" ? "Σφάλμα αποθήκευσης" : "Save failed"),
  });

  const pointRemove = useMutation({
    mutationFn: (id: string) => deleteRulePoint(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_rule_points"] });
      toast.success(lang === "el" ? "Διαγράφηκε" : "Deleted");
    },
    onError: () => toast.error(lang === "el" ? "Σφάλμα διαγραφής" : "Delete failed"),
  });

  const loading = sectionsLoading || pointsLoading;

  return (
    <div className="space-y-5">
      <Button onClick={() => setCreatingSection(true)} className="w-full sm:w-auto">
        <Plus className="size-4" />
        {lang === "el" ? "Νέα ενότητα" : "Add section"}
      </Button>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-foreground/20" />
        </div>
      ) : sections.length === 0 ? (
        <p className="py-8 text-center text-sm text-foreground/30">
          {lang === "el" ? "Καμία ενότητα ακόμα." : "No sections yet."}
        </p>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {sections.map((section) => {
            const sectionPoints = points.filter((p) => p.section_id === section.id);
            return (
              <AccordionItem
                key={section.id}
                value={section.id}
                className="rounded-xl border border-input px-3"
              >
                <div className="flex items-center gap-1">
                  <AccordionTrigger className="flex-1">
                    <span
                      className={cn(
                        "text-sm font-semibold text-foreground",
                        !section.is_active && "opacity-40",
                      )}
                    >
                      {section.title_en}
                    </span>
                  </AccordionTrigger>
                  <button
                    onClick={() => setEditingSection(section)}
                    className="rounded-md p-1.5 text-foreground/30 transition-colors hover:text-foreground"
                    aria-label={lang === "el" ? "Επεξεργασία ενότητας" : "Edit section"}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          lang === "el"
                            ? `Διαγραφή ενότητας «${section.title_en}»;`
                            : `Delete section "${section.title_en}"?`,
                        )
                      )
                        sectionRemove.mutate(section.id);
                    }}
                    className="rounded-md p-1.5 text-foreground/30 transition-colors hover:text-destructive"
                    aria-label={lang === "el" ? "Διαγραφή ενότητας" : "Delete section"}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <AccordionContent>
                  <ul className="space-y-2">
                    {sectionPoints.length === 0 ? (
                      <li className="text-xs text-foreground/30">
                        {lang === "el" ? "Κανένα σημείο." : "No points."}
                      </li>
                    ) : (
                      sectionPoints.map((point) => (
                        <li
                          key={point.id}
                          className="flex items-start gap-2 rounded-lg border border-input px-3 py-2"
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70" />
                          <span className="min-w-0 flex-1 text-sm text-foreground/80">
                            {point.text_en}
                          </span>
                          <button
                            onClick={() => setEditingPoint(point)}
                            className="rounded-md p-1 text-foreground/30 transition-colors hover:text-foreground"
                            aria-label={lang === "el" ? "Επεξεργασία" : "Edit"}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(lang === "el" ? "Διαγραφή σημείου;" : "Delete point?"))
                                pointRemove.mutate(point.id);
                            }}
                            className="rounded-md p-1 text-foreground/30 transition-colors hover:text-destructive"
                            aria-label={lang === "el" ? "Διαγραφή" : "Delete"}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setCreatingPointSection(section.id)}
                  >
                    <Plus className="size-4" />
                    {lang === "el" ? "Νέο σημείο" : "Add point"}
                  </Button>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <SectionFormDialog
        open={creatingSection || editingSection !== null}
        section={editingSection}
        lang={lang}
        saving={sectionUpsert.isPending}
        onClose={() => {
          setEditingSection(null);
          setCreatingSection(false);
        }}
        onSave={(input, isNew) => sectionUpsert.mutate({ input, isNew })}
      />

      <PointFormDialog
        open={editingPoint !== null || creatingPointSection !== null}
        point={editingPoint}
        sectionId={editingPoint?.section_id ?? creatingPointSection ?? ""}
        lang={lang}
        saving={pointUpsert.isPending}
        onClose={() => {
          setEditingPoint(null);
          setCreatingPointSection(null);
        }}
        onSave={(id, input, isNew) => pointUpsert.mutate({ id, input, isNew })}
      />
    </div>
  );
}

function SectionFormDialog({
  open,
  section,
  lang,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  section: RuleSection | null;
  lang: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: RuleSectionInput, isNew: boolean) => void;
}) {
  const isNew = section === null;
  const [form, setForm] = useState<RuleSectionInput>(emptySectionInput);
  const [idTouched, setIdTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(section ? sectionToInput(section) : emptySectionInput());
    setIdTouched(false);
  }, [open, section]);

  const set = <K extends keyof RuleSectionInput>(key: K, value: RuleSectionInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onTitleEn = (value: string) => {
    setForm((f) => ({
      ...f,
      title_en: value,
      id: isNew && !idTouched ? slugify(value) : f.id,
    }));
  };

  const valid = form.id.trim() !== "" && form.title_en.trim() !== "";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNew
              ? lang === "el"
                ? "Νέα ενότητα"
                : "New section"
              : lang === "el"
                ? "Επεξεργασία ενότητας"
                : "Edit section"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="ID (slug)">
            <Input
              value={form.id}
              disabled={!isNew}
              onChange={(e) => {
                setIdTouched(true);
                set("id", e.target.value);
              }}
              placeholder="start"
            />
          </Field>
          <Field label={lang === "el" ? "Εικονίδιο (lucide)" : "Icon (lucide name)"}>
            <Input
              value={form.icon}
              onChange={(e) => set("icon", e.target.value)}
              placeholder="Flag"
            />
          </Field>
          <Field label={lang === "el" ? "Τίτλος (EN)" : "Title (EN)"}>
            <Input value={form.title_en} onChange={(e) => onTitleEn(e.target.value)} />
          </Field>
          <Field label={lang === "el" ? "Τίτλος (EL)" : "Title (EL)"}>
            <Input value={form.title_el} onChange={(e) => set("title_el", e.target.value)} />
          </Field>
          <Field label={lang === "el" ? "Σειρά" : "Sort order"}>
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) => set("sort_order", Number.parseInt(e.target.value, 10) || 0)}
            />
          </Field>
          <ToggleRow
            label={lang === "el" ? "Ενεργό" : "Active"}
            checked={form.is_active}
            onChange={(v) => set("is_active", v)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {lang === "el" ? "Άκυρο" : "Cancel"}
          </Button>
          <Button disabled={!valid || saving} onClick={() => onSave(form, isNew)}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {lang === "el" ? "Αποθήκευση" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PointFormDialog({
  open,
  point,
  sectionId,
  lang,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  point: RulePoint | null;
  sectionId: string;
  lang: string;
  saving: boolean;
  onClose: () => void;
  onSave: (id: string | null, input: RulePointInput, isNew: boolean) => void;
}) {
  const isNew = point === null;
  const [textEl, setTextEl] = useState("");
  const [textEn, setTextEn] = useState("");
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => {
    if (!open) return;
    setTextEl(point?.text_el ?? "");
    setTextEn(point?.text_en ?? "");
    setSortOrder(point?.sort_order ?? 0);
  }, [open, point]);

  const valid = textEn.trim() !== "" && sectionId !== "";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNew
              ? lang === "el"
                ? "Νέο σημείο"
                : "New point"
              : lang === "el"
                ? "Επεξεργασία σημείου"
                : "Edit point"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label={lang === "el" ? "Κείμενο (EN)" : "Text (EN)"}>
            <Textarea rows={3} value={textEn} onChange={(e) => setTextEn(e.target.value)} />
          </Field>
          <Field label={lang === "el" ? "Κείμενο (EL)" : "Text (EL)"}>
            <Textarea rows={3} value={textEl} onChange={(e) => setTextEl(e.target.value)} />
          </Field>
          <Field label={lang === "el" ? "Σειρά" : "Sort order"}>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number.parseInt(e.target.value, 10) || 0)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {lang === "el" ? "Άκυρο" : "Cancel"}
          </Button>
          <Button
            disabled={!valid || saving}
            onClick={() =>
              onSave(
                point?.id ?? null,
                {
                  section_id: sectionId,
                  text_el: textEl,
                  text_en: textEn,
                  sort_order: sortOrder,
                },
                isNew,
              )
            }
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {lang === "el" ? "Αποθήκευση" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
