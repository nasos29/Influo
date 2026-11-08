"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Notice = { id: string; kind: string; title: string; body: string | null; url: string | null; created_at: string; read_at: string | null };

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/** Admin in-app notices (campaign applications, signups, support tickets, agreements). */
export default function AdminNoticesPanel({ lang }: { lang: "el" | "en" }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notices", { headers: await authHeaders(), cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { notices?: Notice[]; unread?: number };
      setNotices(json.notices || []);
      setUnread(json.unread || 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const markRead = async (body: { id?: string; all?: boolean }) => {
    await fetch("/api/admin/notices", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify(body) });
    void load();
  };

  const deleteNotice = async (id: string) => {
    setBusyId(id);
    try {
      await fetch("/api/admin/notices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ id }),
      });
      void load();
    } finally {
      setBusyId(null);
    }
  };

  const t = {
    title: { el: "Ειδοποιήσεις", en: "Notices" }[lang],
    all: { el: "Σήμανση όλων ως αναγνωσμένα", en: "Mark all read" }[lang],
    read: { el: "Αναγνώστηκε", en: "Mark read" }[lang],
    delete: { el: "Διαγραφή", en: "Delete" }[lang],
    empty: { el: "Καμία ειδοποίηση.", en: "No notices." }[lang],
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 mb-6">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <Bell className="w-4 h-4 text-slate-600" aria-hidden />
        <span className="font-semibold text-slate-900">{t.title}</span>
        {unread > 0 && (
          <span className="ml-1 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white" aria-label={`${unread}`}>
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="border-t border-slate-200 px-4 py-3">
          {unread > 0 && (
            <button type="button" onClick={() => markRead({ all: true })} className="mb-3 text-sm text-blue-700 hover:underline">
              {t.all}
            </button>
          )}
          {notices.length === 0 ? (
            <p className="text-sm text-slate-500">{t.empty}</p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {notices.map((n) => (
                <li key={n.id} className={`py-2 flex items-start gap-3 ${n.read_at ? "opacity-60" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${n.read_at ? "text-slate-700" : "font-semibold text-slate-900"}`}>{n.title}</p>
                    {n.body && <p className="text-xs text-slate-600 break-words">{n.body}</p>}
                    <p className="text-xs text-slate-400">{new Date(n.created_at).toLocaleString(lang === "el" ? "el-GR" : "en-GB", { timeZone: "Europe/Athens" })}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {!n.read_at && (
                      <button type="button" onClick={() => markRead({ id: n.id })} className="text-xs text-blue-700 hover:underline">
                        {t.read}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void deleteNotice(n.id)}
                      disabled={busyId === n.id}
                      className="text-xs text-red-700 hover:underline disabled:opacity-50"
                    >
                      {t.delete}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
