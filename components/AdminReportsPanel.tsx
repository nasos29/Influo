"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { sessionFetch } from "@/lib/sessionFetch";
import { formatDisplayDateTime } from "@/lib/formatDate";
import {
  USER_REPORT_STATUSES,
  userReportReasonLabel,
  userReportStatusLabel,
  type UserReportReason,
  type UserReportStatus,
} from "@/lib/userReports";

type Lang = "el" | "en";

type ReportItem = {
  id: string;
  reporter_user_id: string;
  reporter_role: string;
  target_type: string;
  target_id: string;
  target_name: string;
  profile_path: string | null;
  reason: string;
  comment: string | null;
  context: string;
  conversation_id: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

const COPY = {
  el: {
    title: "Αναφορές χρηστών",
    filterAll: "Όλες",
    empty: "Δεν υπάρχουν αναφορές.",
    loadError: "Αποτυχία φόρτωσης.",
    target: "Στόχος",
    reporter: "Αναφέρων",
    context: "Πλαίσιο",
    contextProfile: "Προφίλ",
    contextChat: "Συνομιλία",
    status: "Κατάσταση",
    note: "Σημείωση admin",
    save: "Αποθήκευση",
    message: "Μήνυμα",
    profile: "Προφίλ",
  },
  en: {
    title: "User reports",
    filterAll: "All",
    empty: "No reports yet.",
    loadError: "Failed to load.",
    target: "Target",
    reporter: "Reporter",
    context: "Context",
    contextProfile: "Profile",
    contextChat: "Chat",
    status: "Status",
    note: "Admin note",
    save: "Save",
    message: "Message",
    profile: "Profile",
  },
} as const;

type Filter = "all" | UserReportStatus;

export default function AdminReportsPanel({
  lang,
  onNewCount,
  onStartAdminChat,
}: {
  lang: Lang;
  onNewCount?: (n: number) => void;
  onStartAdminChat: (userType: "influencer" | "brand", userId: string) => void;
}) {
  const txt = COPY[lang];
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
      const res = await sessionFetch(`/api/admin/reports${qs}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : txt.loadError);
        setItems([]);
        return;
      }
      const next = Array.isArray(body.items) ? (body.items as ReportItem[]) : [];
      setItems(next);
      if (typeof body.newCount === "number") onNewCount?.(body.newCount);
    } catch {
      setError(txt.loadError);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter, lang, onNewCount, txt.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchRow = async (id: string, patch: { status?: UserReportStatus; admin_note?: string | null }) => {
    setBusyId(id);
    try {
      const res = await sessionFetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return;
      if (body.item) {
        setItems((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: body.item.status,
                  admin_note: body.item.admin_note,
                  updated_at: body.item.updated_at,
                }
              : r
          )
        );
      }
      void load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{txt.title}</h2>
        <div className="flex flex-wrap gap-1 ml-auto">
          {(["all", ...USER_REPORT_STATUSES] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`min-h-9 rounded-lg px-3 text-xs font-medium ${
                filter === key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {key === "all"
                ? txt.filterAll
                : userReportStatusLabel(key, lang)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">…</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">{txt.empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => {
            const reasonKey = row.reason as UserReportReason;
            const noteDraft = draftNotes[row.id] ?? row.admin_note ?? "";
            return (
              <li
                key={row.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {userReportReasonLabel(reasonKey, lang)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDisplayDateTime(row.created_at)}
                    </p>
                  </div>
                  <select
                    value={row.status}
                    disabled={busyId === row.id}
                    onChange={(e) =>
                      void patchRow(row.id, { status: e.target.value as UserReportStatus })
                    }
                    className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800"
                    aria-label={txt.status}
                  >
                    {USER_REPORT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {userReportStatusLabel(s, lang)}
                      </option>
                    ))}
                  </select>
                </div>

                {row.comment ? (
                  <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{row.comment}</p>
                ) : null}

                <dl className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-slate-500">{txt.target}</dt>
                    <dd className="text-slate-800">
                      {row.target_type === "creator" ? "Creator" : "Brand"}: {row.target_name}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">{txt.reporter}</dt>
                    <dd className="text-slate-800 font-mono text-[11px]">
                      {row.reporter_role} · {row.reporter_user_id.slice(0, 8)}…
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">{txt.context}</dt>
                    <dd>
                      {row.context === "chat" ? txt.contextChat : txt.contextProfile}
                      {row.conversation_id ? ` · ${row.conversation_id.slice(0, 8)}…` : ""}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap gap-2">
                  {row.profile_path ? (
                    <Link
                      href={row.profile_path}
                      className="min-h-9 inline-flex items-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {txt.profile}
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="min-h-9 inline-flex items-center rounded-lg border border-sky-300 px-3 text-xs font-medium text-sky-800 hover:bg-sky-50"
                    onClick={() =>
                      onStartAdminChat(
                        row.target_type === "creator" ? "influencer" : "brand",
                        row.target_id
                      )
                    }
                  >
                    {txt.message}
                  </button>
                </div>

                <label className="mt-3 block text-xs font-medium text-slate-600">
                  {txt.note}
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setDraftNotes((m) => ({ ...m, [row.id]: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void patchRow(row.id, { admin_note: noteDraft.trim() || null })}
                  className="mt-2 min-h-9 rounded-lg bg-slate-800 px-3 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  {txt.save}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}