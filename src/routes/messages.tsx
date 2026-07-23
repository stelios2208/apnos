import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Loader2, MessageSquare, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { amIAdmin, listAdminThreads, listThread, sendMessage, type Sender } from "@/lib/messages";
import { listPublicProfiles, getPublicProfile } from "@/lib/profiles";
import { athleteInitials, athleteColor } from "@/lib/athletes";
import { nativeVibrate } from "@/lib/native";

// ── Route ────────────────────────────────────────────────────────────────────
// The in-app chat with the admin (Messenger-style), so members reach the coach
// without email. A member sees a single thread ("Apnos"); an admin sees an
// inbox of every member thread and can open + answer each one. Inside
// <AppLayout> (auth-gated), matching the rest of the social layer.
export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages — Apnos" }] }),
  component: () => (
    <AppLayout>
      <Messages />
    </AppLayout>
  ),
});

const GREEN = "#1D9E75";
const GREEN_LIGHT = "#5DCAA5";

function Messages() {
  const { user } = useAuth();
  const { t, lang } = useI18n();

  const { data: isAdmin = false, isLoading: adminLoading } = useQuery({
    queryKey: ["am-i-admin", user?.id],
    queryFn: amIAdmin,
    enabled: !!user,
  });

  // Admin picks a member thread; members always view their own.
  const [selected, setSelected] = useState<string | null>(null);
  const threadUserId = isAdmin ? selected : (user?.id ?? null);

  if (adminLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-foreground/25" />
      </div>
    );
  }

  // Admin, no thread chosen → inbox.
  if (isAdmin && !threadUserId) {
    return <AdminInbox onOpen={setSelected} t={t} lang={lang} />;
  }

  return (
    <Thread
      threadUserId={threadUserId!}
      sender={isAdmin ? "admin" : "user"}
      isAdmin={isAdmin}
      onBack={isAdmin ? () => setSelected(null) : undefined}
      t={t}
      lang={lang}
    />
  );
}

// ── Admin inbox ──────────────────────────────────────────────────────────────
function AdminInbox({
  onOpen,
  t,
  lang,
}: {
  onOpen: (userId: string) => void;
  t: (k: string) => string;
  lang: "el" | "en";
}) {
  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["admin-threads"],
    queryFn: listAdminThreads,
    refetchInterval: 10000,
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["public-profiles"],
    queryFn: () => listPublicProfiles(200),
  });
  const nameByUser = useMemo(() => new Map(profiles.map((p) => [p.user_id, p])), [profiles]);

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-2xl font-bold text-foreground">{t("chat.inboxTitle")}</h1>
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-foreground/25" />
        </div>
      ) : threads.length === 0 ? (
        <p className="text-sm text-foreground/45">{t("chat.inboxEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {threads.map((th) => {
            const p = nameByUser.get(th.user_id);
            const name = p?.display_name || t("chat.member");
            const color = athleteColor(th.user_id);
            return (
              <li key={th.user_id}>
                <button
                  onClick={() => onOpen(th.user_id)}
                  className="pressable surface-1 flex w-full items-center gap-3 rounded-2xl p-3 text-left"
                >
                  {p?.avatar_url ? (
                    <img
                      src={p.avatar_url}
                      alt=""
                      className="size-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                      style={{ background: `${color}33`, color: "#fff" }}
                    >
                      {athleteInitials(name)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {name}
                    </span>
                    <span className="block truncate text-xs text-foreground/50">
                      {th.last_sender === "admin" ? "↩ " : ""}
                      {th.last_body}
                    </span>
                  </span>
                  <span className="shrink-0 text-[0.65rem] text-foreground/35">
                    {format(new Date(th.last_at), lang === "el" ? "d MMM" : "d MMM")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── One thread ───────────────────────────────────────────────────────────────
function Thread({
  threadUserId,
  sender,
  isAdmin,
  onBack,
  t,
  lang,
}: {
  threadUserId: string;
  sender: Sender;
  isAdmin: boolean;
  onBack?: () => void;
  t: (k: string) => string;
  lang: "el" | "en";
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["admin-thread", threadUserId],
    queryFn: () => listThread(threadUserId),
    enabled: !!threadUserId,
    refetchInterval: 8000,
  });

  // The other party's identity (admin sees the member; member sees "Apnos").
  const { data: memberProfile } = useQuery({
    queryKey: ["public-profile", threadUserId],
    queryFn: () => getPublicProfile(threadUserId),
    enabled: isAdmin,
  });
  const headerName = isAdmin ? memberProfile?.display_name || t("chat.member") : "Apnos";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const mutation = useMutation({
    mutationFn: (body: string) => sendMessage({ userId: threadUserId, sender, body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-thread", threadUserId] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : t("chat.sendError")),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    nativeVibrate(10);
    setText("");
    mutation.mutate(body);
  };

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col pb-24">
      {/* header */}
      <div className="flex items-center gap-3 pb-3">
        {onBack && (
          <button
            onClick={onBack}
            aria-label={t("common.back")}
            className="pressable flex size-9 items-center justify-center rounded-full"
            style={{ background: "rgba(var(--ink),0.05)", color: "rgba(var(--ink),0.5)" }}
          >
            <ArrowLeft className="size-4" />
          </button>
        )}
        <span
          className="flex size-10 items-center justify-center rounded-full"
          style={{ background: "rgba(29,158,117,0.16)" }}
        >
          <ShieldCheck className="size-5" style={{ color: GREEN_LIGHT }} />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-foreground">{headerName}</h1>
          <p className="text-xs text-foreground/45">
            {isAdmin ? t("chat.memberSub") : t("chat.adminSub")}
          </p>
        </div>
      </div>

      {/* messages */}
      <div className="flex-1 space-y-2 py-2">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-foreground/25" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span
              className="flex size-14 items-center justify-center rounded-full"
              style={{ background: "rgba(29,158,117,0.14)" }}
            >
              <MessageSquare className="size-6" style={{ color: GREEN_LIGHT }} />
            </span>
            <p className="max-w-xs text-sm text-foreground/50">{t("chat.empty")}</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender === sender;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[80%] rounded-2xl px-3.5 py-2 text-sm"
                  style={
                    mine
                      ? { background: GREEN, color: "#fff", borderBottomRightRadius: 6 }
                      : {
                          background: "rgba(var(--ink),0.06)",
                          color: "var(--foreground)",
                          borderBottomLeftRadius: 6,
                        }
                  }
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p
                    className="mt-0.5 text-right text-[0.6rem]"
                    style={{ color: mine ? "rgba(255,255,255,0.7)" : "rgba(var(--ink),0.4)" }}
                  >
                    {format(new Date(m.created_at), "HH:mm")}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* composer — sticks above the bottom nav */}
      <form
        onSubmit={submit}
        className="sticky bottom-20 z-30 flex items-end gap-2 rounded-2xl p-2"
        style={{
          background: "var(--card)",
          border: "1px solid rgba(var(--ink),0.08)",
          boxShadow: "0 8px 24px rgba(2,8,15,0.35)",
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("chat.placeholder")}
          rows={1}
          className="max-h-32 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-foreground/35"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
        />
        <button
          type="submit"
          disabled={mutation.isPending || !text.trim() || !user}
          aria-label={t("chat.send")}
          className="pressable flex size-10 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-50"
          style={{ background: GREEN }}
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </button>
      </form>
    </div>
  );
}
