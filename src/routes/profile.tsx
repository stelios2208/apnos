import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Lock, Globe2, Ruler, Weight, Camera } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import {
  type AthleteProfile,
  type Gender,
  fetchProfile,
  saveProfile,
  emptyProfile,
  ageFromBirthdate,
  uploadAvatar,
} from "@/lib/profile";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { Flag } from "@/components/Flag";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Apnos" }] }),
  component: () => (
    <AppLayout>
      <ProfilePage />
    </AppLayout>
  ),
});

interface FormState {
  displayName: string;
  birthdate: string;
  gender: Gender;
  heightStr: string;
  weightStr: string;
  country: string;
  countryCode: string;
  city: string;
  bio: string;
  isPublic: boolean;
  avatarUrl: string;
}

function toForm(p: AthleteProfile): FormState {
  return {
    displayName: p.displayName,
    birthdate: p.birthdate,
    gender: p.gender,
    heightStr: p.heightCm != null ? String(p.heightCm) : "",
    weightStr: p.weightKg != null ? String(p.weightKg) : "",
    country: p.country,
    countryCode: p.countryCode,
    city: p.city,
    bio: p.bio,
    isPublic: p.isPublic,
    avatarUrl: p.avatarUrl,
  };
}

function toProfile(f: FormState): AthleteProfile {
  const h = parseInt(f.heightStr, 10);
  const w = parseInt(f.weightStr, 10);
  return {
    displayName: f.displayName.trim(),
    birthdate: f.birthdate,
    gender: f.gender,
    heightCm: Number.isFinite(h) && h > 0 ? h : null,
    weightKg: Number.isFinite(w) && w > 0 ? w : null,
    country: f.country.trim(),
    countryCode: f.countryCode.trim().toUpperCase(),
    city: f.city.trim(),
    bio: f.bio.trim(),
    isPublic: f.isPublic,
    avatarUrl: f.avatarUrl,
  };
}

const inputCls =
  "w-full rounded-xl bg-foreground/5 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-[#1D9E75] placeholder-white/25";
const labelCls = "text-[0.6rem] font-bold tracking-widest text-foreground/35";

function ProfilePage() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: fetchProfile,
    enabled: !!user,
  });

  const [form, setForm] = useState<FormState>(() => toForm(emptyProfile()));
  useEffect(() => {
    if (profile) setForm(toForm(profile));
  }, [profile]);

  const save = useMutation({
    mutationFn: () => saveProfile(toProfile(form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success(lang === "el" ? "Το προφίλ αποθηκεύτηκε" : "Profile saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const age = ageFromBirthdate(form.birthdate);
  const nameForAvatar = form.displayName || (lang === "el" ? "Αθλητής" : "Athlete");
  const avatar = athleteColor(user?.id || nameForAvatar);

  const genders: { value: Gender; el: string; en: string }[] = [
    { value: "male", el: "Άνδρας", en: "Male" },
    { value: "female", el: "Γυναίκα", en: "Female" },
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-foreground/25" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      {/* header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/you" })}
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: "rgba(var(--ink),0.05)", color: "rgba(var(--ink),0.5)" }}
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-2xl font-bold text-foreground">
          {lang === "el" ? "Προφίλ Αθλητή" : "Athlete Profile"}
        </h1>
      </div>

      {/* preview card */}
      <div
        className="flex items-center gap-4 rounded-2xl px-5 py-4"
        style={{ background: "var(--card)", border: "1px solid rgba(var(--ink),0.06)" }}
      >
        <label className="relative shrink-0 cursor-pointer" title="Upload photo">
          {form.avatarUrl ? (
            <img
              src={form.avatarUrl}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
              style={{ border: `1px solid ${avatar}45` }}
            />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold"
              style={{ background: `${avatar}22`, color: avatar, border: `1px solid ${avatar}45` }}
            >
              {athleteInitials(nameForAvatar)}
            </div>
          )}
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full"
            style={{ background: "#1D9E75", border: "2px solid var(--card)" }}
          >
            <Camera className="size-3 text-white" />
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !user) return;
              try {
                const url = await uploadAvatar(user.id, file);
                set("avatarUrl", url);
                toast.success(lang === "el" ? "Η φωτογραφία ανέβηκε" : "Photo uploaded");
              } catch (err) {
                console.error(err);
                toast.error(lang === "el" ? "Σφάλμα στο ανέβασμα" : "Upload failed");
              }
            }}
          />
        </label>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-lg font-bold text-foreground">
            <Flag code={form.countryCode} className="inline-block h-4 w-auto rounded-[2px]" />
            <span className="truncate">{nameForAvatar}</span>
          </p>
          <p className="mt-0.5 text-xs text-foreground/40">
            {[
              age != null ? `${age} ${lang === "el" ? "ετών" : "yo"}` : null,
              form.gender
                ? genders.find((g) => g.value === form.gender)?.[lang === "el" ? "el" : "en"]
                : null,
              form.city || form.country
                ? [form.city, form.country].filter(Boolean).join(", ")
                : null,
            ]
              .filter(Boolean)
              .join(" · ") ||
              (lang === "el" ? "Συμπλήρωσε τα στοιχεία σου" : "Fill in your details")}
          </p>
        </div>
        <div
          className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1"
          style={{ background: form.isPublic ? "rgba(29,158,117,0.15)" : "rgba(var(--ink),0.05)" }}
        >
          {form.isPublic ? (
            <Globe2 className="size-3" style={{ color: "#5DCAA5" }} />
          ) : (
            <Lock className="size-3 text-foreground/40" />
          )}
          <span
            className="text-[0.55rem] font-bold tracking-wider"
            style={{ color: form.isPublic ? "#5DCAA5" : "rgba(var(--ink),0.4)" }}
          >
            {form.isPublic
              ? lang === "el"
                ? "ΔΗΜΟΣΙΟ"
                : "PUBLIC"
              : lang === "el"
                ? "ΙΔΙΩΤΙΚΟ"
                : "PRIVATE"}
          </span>
        </div>
      </div>

      {/* form */}
      <div
        className="space-y-4 rounded-2xl p-5"
        style={{ background: "var(--card)", border: "1px solid rgba(var(--ink),0.06)" }}
      >
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>{lang === "el" ? "ΟΝΟΜΑ" : "DISPLAY NAME"}</label>
          <input
            className={inputCls}
            value={form.displayName}
            onChange={(e) => set("displayName", e.target.value)}
            placeholder={lang === "el" ? "Όνομα Επώνυμο" : "First Last"}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>{lang === "el" ? "ΗΜ. ΓΕΝΝΗΣΗΣ" : "DATE OF BIRTH"}</label>
          <input
            type="date"
            className={inputCls}
            style={{ colorScheme: "dark" }}
            value={form.birthdate}
            onChange={(e) => set("birthdate", e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>{lang === "el" ? "ΦΥΛΟ" : "GENDER"}</label>
          <div className="flex gap-2">
            {genders.map((g) => {
              const on = form.gender === g.value;
              return (
                <button
                  key={g.value}
                  onClick={() => set("gender", on ? "" : g.value)}
                  className="flex-1 rounded-xl py-2.5 text-xs font-semibold transition-all"
                  style={
                    on
                      ? {
                          background: "rgba(29,158,117,0.18)",
                          color: "#5DCAA5",
                          border: "1px solid rgba(29,158,117,0.4)",
                        }
                      : {
                          background: "rgba(var(--ink),0.03)",
                          color: "rgba(var(--ink),0.4)",
                          border: "1px solid rgba(var(--ink),0.08)",
                        }
                  }
                >
                  {lang === "el" ? g.el : g.en}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className={labelCls}>
              <Ruler className="mb-0.5 mr-1 inline size-3" />
              {lang === "el" ? "ΥΨΟΣ (cm)" : "HEIGHT (cm)"}
            </label>
            <input
              inputMode="numeric"
              className={inputCls}
              value={form.heightStr}
              onChange={(e) => set("heightStr", e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="180"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className={labelCls}>
              <Weight className="mb-0.5 mr-1 inline size-3" />
              {lang === "el" ? "ΒΑΡΟΣ (kg)" : "WEIGHT (kg)"}
            </label>
            <input
              inputMode="numeric"
              className={inputCls}
              value={form.weightStr}
              onChange={(e) => set("weightStr", e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="75"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className={labelCls}>{lang === "el" ? "ΧΩΡΑ" : "COUNTRY"}</label>
            <input
              className={inputCls}
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              placeholder={lang === "el" ? "Ελλάδα" : "Greece"}
            />
          </div>
          <div className="flex w-24 shrink-0 flex-col gap-1.5">
            <label className={`${labelCls} flex items-center gap-1`}>
              <Flag code={form.countryCode} className="inline-block h-2.5 w-auto rounded-[2px]" />
              {lang === "el" ? "ΚΩΔ." : "CODE"}
            </label>
            <input
              className={`${inputCls} text-center uppercase`}
              value={form.countryCode}
              maxLength={2}
              onChange={(e) =>
                set("countryCode", e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())
              }
              placeholder="GR"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className={labelCls}>{lang === "el" ? "ΠΟΛΗ" : "CITY"}</label>
            <input
              className={inputCls}
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder={lang === "el" ? "Αθήνα" : "Athens"}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Bio</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            placeholder={
              lang === "el"
                ? "Λίγα λόγια για σένα, οι στόχοι σου…"
                : "A little about you, your goals…"
            }
          />
        </div>
      </div>

      {/* visibility */}
      <button
        onClick={() => set("isPublic", !form.isPublic)}
        className="flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left"
        style={{ background: "var(--card)", border: "1px solid rgba(var(--ink),0.06)" }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: form.isPublic ? "rgba(29,158,117,0.15)" : "rgba(var(--ink),0.05)" }}
        >
          {form.isPublic ? (
            <Globe2 className="size-4" style={{ color: "#5DCAA5" }} />
          ) : (
            <Lock className="size-4 text-foreground/40" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {lang === "el" ? "Δημόσιο προφίλ" : "Public profile"}
          </p>
          <p className="mt-0.5 text-[0.72rem] text-foreground/40">
            {form.isPublic
              ? lang === "el"
                ? "Ορατό σε άλλους αθλητές & κατατάξεις"
                : "Visible to other athletes & rankings"
              : lang === "el"
                ? "Μόνο εσύ βλέπεις το προφίλ σου"
                : "Only you can see your profile"}
          </p>
        </div>
        <div
          className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
          style={{ background: form.isPublic ? "#1D9E75" : "rgba(var(--ink),0.12)" }}
        >
          <div
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
            style={{ left: form.isPublic ? 22 : 2 }}
          />
        </div>
      </button>

      {/* save */}
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="w-full rounded-xl py-4 text-sm font-bold transition-all"
        style={{ background: "#1D9E75", color: "#fff", opacity: save.isPending ? 0.7 : 1 }}
      >
        {save.isPending
          ? lang === "el"
            ? "Αποθήκευση…"
            : "Saving…"
          : lang === "el"
            ? "Αποθήκευση Προφίλ"
            : "Save Profile"}
      </button>
    </div>
  );
}
