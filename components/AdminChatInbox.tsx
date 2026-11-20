"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { ADMIN_CHAT_AVATAR_SRC, ADMIN_CHAT_DISPLAY_NAME } from "@/lib/adminChat";
import ChatAvatar from "@/components/ChatAvatar";
import ChatBubbleText from "@/components/ChatBubbleText";
import { formatChatDayLabel, sameChatDay } from "@/lib/chatTime";
import { formatDate, formatTime } from "@/lib/formatDateTime";
import { isTimeoutError, withTimeout } from "@/lib/withTimeout";
import { AdminListSkeleton, AdminLoadError } from "@/components/admin/AdminListChrome";

type Lang = "el" | "en";

type AdminConv = {
  id: string;
  influencer_id: string | null;
  influencer_name: string | null;
  influencer_email: string | null;
  brand_email: string | null;
  brand_name: string | null;
  last_message_at: string | null;
  created_at: string;
};

type AdminMsg = {
  id: string;
  sender_type: "admin" | "influencer" | "brand" | string;
  sender_name?: string;
  content: string;
  created_at: string;
};

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

function partyLabel(c: AdminConv, lang: Lang): string {
  if (c.influencer_id) {
    return (c.influencer_name || c.influencer_email || "Influencer").trim();
  }
  return (c.brand_name || c.brand_email || (lang === "el" ? "Επιχείρηση" : "Brand")).trim();
}

function partySub(c: AdminConv): string {
  if (c.influencer_id) return (c.influencer_email || "").trim();
  return (c.brand_email || "").trim();
}

export default function AdminChatInbox({
  lang,
  initialConversationId,
  onOpened,
}: {
  lang: Lang;
  initialConversationId?: string | null;
  onOpened?: (conversationId: string) => void;
}) {
  const [conversations, setConversations] = useState<AdminConv[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<"timeout" | "error" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId || null);
  const [selected, setSelected] = useState<AdminConv | null>(null);
  const [messages, setMessages] = useState<AdminMsg[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<"timeout" | "error" | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const linkedRef = useRef(initialConversationId || null);

  const loadList = useCallback(async (search = q) => {
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "50" });
      if (search.trim()) params.set("q", search.trim());
      const res = await withTimeout(
        fetch(`/api/admin/chat?${params}`, { headers: await authHeaders() }),
        20000
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "load failed");
      setConversations((json.conversations || []) as AdminConv[]);
    } catch (e) {
      setListError(isTimeoutError(e) ? "timeout" : "error");
    } finally {
      setListLoading(false);
    }
  }, [q]);

  const loadThread = useCallback(async (conversationId: string, opts?: { before?: string }) => {
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const params = new URLSearchParams({ conversationId });
      if (opts?.before) params.set("before", opts.before);
      const res = await withTimeout(
        fetch(`/api/admin/chat?${params}`, { headers: await authHeaders() }),
        20000
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "load failed");
      const rows = (json.messages || []) as AdminMsg[];
      setMessages((prev) => (opts?.before ? [...rows, ...prev] : rows));
      setHasMore(!!json.hasMore);
      if (json.conversation) setSelected(json.conversation as AdminConv);
      onOpened?.(conversationId);
    } catch (e) {
      setMessagesError(isTimeoutError(e) ? "timeout" : "error");
    } finally {
      setMessagesLoading(false);
    }
  }, [onOpened]);

  useEffect(() => {
    void loadList("");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = linkedRef.current || initialConversationId;
    if (!id) return;
    setSelectedId(id);
    void loadThread(id);
  }, [initialConversationId, loadThread]);

  useEffect(() => {
    if (!selectedId) return;
    bottomRef.current?.scrollIntoView();
  }, [messages, selectedId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !draft.trim() || sending) return;
    setSending(true);
    const content = draft.trim();
    setDraft("");
    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ conversationId: selectedId, content }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "send failed");
      const msg = json.message as AdminMsg;
      setMessages((prev) => [...prev, msg]);
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === selectedId);
        if (idx < 0) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], last_message_at: msg.created_at };
        next.sort(
          (a, b) =>
            new Date(b.last_message_at || b.created_at).getTime() -
            new Date(a.last_message_at || a.created_at).getTime()
        );
        return next;
      });
    } catch {
      setDraft(content);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row h-[500px] sm:h-[600px] relative min-h-[400px] overflow-x-hidden">
      {drawer ? (
        <div
          className="sm:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setDrawer(false)}
          aria-hidden
        />
      ) : null}

      <div
        className={`w-full sm:w-80 border-r border-slate-200 overflow-y-auto bg-white ${
          drawer ? "block" : "hidden sm:block"
        } absolute sm:relative inset-0 z-50 sm:z-auto shadow-xl sm:shadow-none max-h-full`}
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void loadList(q);
            }}
            placeholder={lang === "el" ? "Αναζήτηση…" : "Search…"}
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
          />
        </div>
        {listLoading && conversations.length === 0 ? (
          <AdminListSkeleton rows={4} />
        ) : listError && conversations.length === 0 ? (
          <AdminLoadError lang={lang} timedOut={listError === "timeout"} onRetry={() => void loadList()} />
        ) : conversations.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            {lang === "el"
              ? "Δεν υπάρχουν ακόμα συνομιλίες Influo. Πάτα «Μήνυμα» σε χρήστη."
              : "No Influo chats yet. Use Message on a user row."}
          </p>
        ) : (
          conversations.map((c) => {
            const active = selectedId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  linkedRef.current = c.id;
                  setSelectedId(c.id);
                  setSelected(c);
                  setDrawer(false);
                  void loadThread(c.id);
                }}
                className={`w-full border-b border-slate-200 px-4 py-3 text-left hover:bg-slate-50 ${
                  active ? "bg-blue-50 border-l-4 border-l-blue-600" : ""
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ChatAvatar name={partyLabel(c, lang)} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{partyLabel(c, lang)}</p>
                    <p className="truncate text-xs text-slate-500">{partySub(c)}</p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden relative z-10">
        {selectedId ? (
          <>
            <div className="border-b border-slate-200 px-4 py-3">
              <button
                type="button"
                className="sm:hidden mb-2 text-sm text-slate-600"
                onClick={() => setDrawer(true)}
              >
                ← {lang === "el" ? "Λίστα" : "List"}
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <ChatAvatar name={selected ? partyLabel(selected, lang) : "?"} size={36} />
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-900 text-sm sm:text-base">
                    {selected ? partyLabel(selected, lang) : "…"}
                  </h3>
                  <p className="truncate text-xs text-slate-500">{selected ? partySub(selected) : ""}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/80 px-3 py-3 space-y-2">
              {hasMore ? (
                <button
                  type="button"
                  onClick={() => void loadThread(selectedId, { before: messages[0]?.created_at })}
                  className="mx-auto block min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                >
                  {lang === "el" ? "Παλαιότερα" : "Older"}
                </button>
              ) : null}
              {messagesLoading && messages.length === 0 ? (
                <AdminListSkeleton rows={3} />
              ) : messagesError && messages.length === 0 ? (
                <AdminLoadError
                  lang={lang}
                  timedOut={messagesError === "timeout"}
                  onRetry={() => void loadThread(selectedId)}
                />
              ) : messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  {lang === "el" ? "Γράψε το πρώτο μήνυμα." : "Write the first message."}
                </p>
              ) : (
                messages.map((msg, index) => {
                  const isAdmin = msg.sender_type === "admin";
                  const prev = messages[index - 1];
                  const showDay = !prev || !sameChatDay(prev.created_at, msg.created_at);
                  return (
                    <div key={msg.id}>
                      {showDay ? (
                        <div className="my-3 flex justify-center">
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-medium text-slate-500">
                            {formatChatDayLabel(msg.created_at, lang)}
                          </span>
                        </div>
                      ) : null}
                      <div className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`flex max-w-[85%] min-w-0 flex-col ${
                            isAdmin ? "items-end" : "items-start"
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-1.5">
                            {isAdmin ? (
                              <>
                                <ChatAvatar
                                  src={ADMIN_CHAT_AVATAR_SRC}
                                  name={ADMIN_CHAT_DISPLAY_NAME}
                                  size={20}
                                />
                                <span className="text-[11px] font-medium text-sky-800">
                                  {ADMIN_CHAT_DISPLAY_NAME}
                                </span>
                                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
                                  Influo
                                </span>
                              </>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-600">
                                {msg.sender_name || (selected ? partyLabel(selected, lang) : "")}
                              </span>
                            )}
                          </div>
                          <div
                            className={`min-w-0 max-w-full px-3.5 py-2 rounded-2xl ${
                              isAdmin
                                ? "bg-sky-700 text-white rounded-br-md"
                                : "bg-white text-slate-900 border border-slate-200 rounded-bl-md"
                            }`}
                          >
                            <ChatBubbleText content={msg.content} own={isAdmin} showPreview={false} />
                            <p
                              className={`mt-1 text-[10px] tabular-nums ${
                                isAdmin ? "text-sky-100" : "text-slate-400"
                              }`}
                            >
                              {formatDate(msg.created_at, lang)} {formatTime(msg.created_at, lang)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="border-t border-slate-200 bg-white p-3 flex gap-2 items-end">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder={lang === "el" ? "Μήνυμα…" : "Message…"}
                className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label={lang === "el" ? "Αποστολή" : "Send"}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-700 text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </button>
            </form>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-6 text-slate-500">
            <p className="mb-4 text-center text-sm">
              {lang === "el"
                ? "Επέλεξε συνομιλία ή άνοιξε «Μήνυμα» από χρήστη."
                : "Pick a thread or open Message from a user."}
            </p>
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="sm:hidden min-h-11 rounded-lg bg-sky-700 px-4 text-sm font-medium text-white"
            >
              {lang === "el" ? "Λίστα συνομιλιών" : "Conversation list"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export async function openAdminChatWithUser(args: {
  userType: "influencer" | "brand";
  userId: string;
}): Promise<{ conversationId: string } | { error: string }> {
  try {
    const res = await fetch("/api/admin/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ action: "open", userType: args.userType, userId: args.userId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success || !json.conversation?.id) {
      return { error: String(json.error || "open failed") };
    }
    return { conversationId: String(json.conversation.id) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "open failed" };
  }
}
