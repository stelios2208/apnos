import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Lock, Globe2, Ruler, Weight } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import {
  type AthleteProfile, type Gender,
  fetchProfile, saveProfile, emptyProfile, ageFromBirthdate,
} from "@/lib/profile";
import { athleteInitials, athleteColor } from "@/lib/athletes";

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
  city: string;
  bio: string;
  isPublic: boolean;
}

function toForm(p: AthleteProfile): FormState {
  return {
    displayName: p.displayName,
    birthdate: p.birthdate,
    gender: p.gender,
    heightStr: p.heightCm != null ? String(p.heightCm) : "",
    weightStr: p.weightKg != null ? String(p.weightKg) : "",
    country: p.country,
    city: p.city,
    bio: p.bio,
    isPublic: p.isPublic,
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
    city: f.city.trim(),
    bio: f.bio.trim(),
    isPublic: f.isPublic,
  };
}

const inputCls = "w-full rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-[#1D9E75] placeholder-white/25";
const labelCls = "text-[0.6rem] font-bold tracking-widest text-white/35";

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
  useEffect(() => { if (profile) setForm(toForm(profile)); }, [profile]);

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
    { value: "male",   el: "Άνδρας",  en: "Male" },
    { value: "female", el: "Γυναίκα", en: "Female" },
  ];

  if (isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-white/25" /></div>;
  }

  return (
    <div className="space-y-5 pb-4">
      {/* header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate({ to: "/you" })} className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-2xl font-bold text-white">{lang === "el" ? "Προφίλ Αθλητή" : "Athlete Profile"}</h1>
      </div>

      {/* preview card */}
      <div className="flex items-center gap-4 rounded-2xl px-5 py-4" style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold" style={{ background: `${avatar}22`, color: avatar, border: `1px solid ${avatar}45` }}>
          {athleteInitials(nameForAvatar)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-white">{nameForAvatar}</p>
          <p className="mt-0.5 text-xs text-white/40">
            {[
              age != null ? `${age} ${lang === "el" ? "ετών" : "yo"}` : null,
              form.gender ? (genders.find((g) => g.value === form.gender)?.[lang === "el" ? "el" : "en"]) : null,
              form.city || form.country ? [form.city, form.country].filter(Boolean).join(", ") : null,
            ].filter(Boolean).join(" · ") || (lang === "el" ? "Συμπλήρωσε τα στοιχεία σου" : "Fill in your details")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1" style={{ background: form.isPublic ? "rgba(29,158,117,0.15)" : "rgba(255,255,255,0.05)" }}>
          {form.isPublic ? <Globe2 className="size-3" style={{ color: "#5DCAA5" }} /> : <Lock className="size-3 text-white/40" />}
          <span className="text-[0.55rem] font-bold tracking-wider" style={{ color: form.isPublic ? "#5DCAA5" : "rgba(255,255,255,0.4)" }}>
            {form.isPublic ? (lang === "el" ? "ΔΗΜΟΣΙΟ" : "PUBLIC") : (lang === "el" ? "ΙΔΙΩΤΙΚΟ" : "PRIVATE")}
          </span>
        </div>
      </div>

      {/* form */}
      <div className="space-y-4 rounded-2xl p-5" style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>{lang === "el" ? "ΟΝΟΜΑ" : "DISPLAY NAME"}</label>
          <input className={inputCls} value={form.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder={lang === "el" ? "Όνομα Επώνυμο" : "First Last"} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>{lang === "el" ? "ΗΜ. ΓΕΝΝΗΣΗΣ" : "DATE OF BIRTH"}</label>
          <input type="date" className={inputCls} style={{ colorScheme: "dark" }} value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} />
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
                  style={on
                    ? { background: "rgba(29,158,117,0.18)", color: "#5DCAA5", border: "1px solid rgba(29,158,117,0.4)" }
                    : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {lang === "el" ? g.el : g.en}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className={labelCls}><Ruler className="mb-0.5 mr-1 inline size-3" />{lang === "el" ? "ΥΨΟΣ (cm)" : "HEIGHT (cm)"}</label>
            <input inputMode="numeric" className={inputCls} value={form.heightStr} onChange={(e) => set("heightStr", e.target.value.replace(/[^0-9]/g, ""))} placeholder="180" />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className={labelCls}><Weight className="mb-0.5 mr-1 inline size-3" />{lang === "el" ? "ΒΑΡΟΣ (kg)" : "WEIGHT (kg)"}</label>
            <input inputMode="numeric" className={inputCls} value={form.weightStr} onChange={(e) => set("weightStr", e.target.value.replace(/[^0-9]/g, ""))} placeholder="75" />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className={labelCls}>{lang === "el" ? "ΧΩΡΑ" : "COUNTRY"}</label>
            <input className={inputCls} value={form.country} onChange={(e) => set("country", e.target.value)} placeholder={lang === "el" ? "Ελλάδα" : "Greece"} />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className={labelCls}>{lang === "el" ? "ΠΟΛΗ" : "CITY"}</label>
            <input className={inputCls} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder={lang === "el" ? "Αθήνα" : "Athens"} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Bio</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={3}
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            placeholder={lang === "el" ? "Λίγα λόγια για σένα, οι στόχοι σου…" : "A little about you, your goals…"}
          />
        </div>
      </div>

      {/* visibility */}
      <button
        onClick={() => set("isPublic", !form.isPublic)}
        className="flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left"
        style={{ background: "#0d1320", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: form.isPublic ? "rgba(29,158,117,0.15)" : "rgba(255,255,255,0.05)" }}>
          {form.isPublic ? <Globe2 className="size-4" style={{ color: "#5DCAA5" }} /> : <Lock className="size-4 text-white/40" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{lang === "el" ? "Δημόσιο προφίλ" : "Public profile"}</p>
          <p className="mt-0.5 text-[0.72rem] text-white/40">
            {form.isPublic
              ? (lang === "el" ? "Ορατό σε άλλους αθλητές & κατατάξεις" : "Visible to other athletes & rankings")
              : (lang === "el" ? "Μόνο εσύ βλέπεις το προφίλ σου" : "Only you can see your profile")}
          </p>
        </div>
        <div className="relative h-6 w-11 shrink-0 rounded-full transition-colors" style={{ background: form.isPublic ? "#1D9E75" : "rgba(255,255,255,0.12)" }}>
          <div className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: form.isPublic ? 22 : 2 }} />
        </div>
      </button>

      {/* save */}
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="w-full rounded-xl py-4 text-sm font-bold transition-all"
        style={{ background: "#1D9E75", color: "#fff", opacity: save.isPending ? 0.7 : 1 }}
      >
        {save.isPending ? (lang === "el" ? "Αποθήκευση…" : "Saving…") : (lang === "el" ? "Αποθήκευση Προφίλ" : "Save Profile")}
      </button>
    </div>
  );
}
