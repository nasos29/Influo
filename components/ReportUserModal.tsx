"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import ResponsiveDialog, { DialogClose } from "@/components/ResponsiveDialog";
import { sessionFetch } from "@/lib/sessionFetch";
import {
  allUserReportReasons,
  type UserReportContext,
  type UserReportReason,
  type UserReportTargetType,
} from "@/lib/userReports";

const COPY = {
  el: {
    report: "Αναφορά",
    title: "Αναφορά χρήστη",
    body: "Η αναφορά εξετάζεται από την ομάδα μας. Ο χρήστης δεν ενημερώνεται.",
    reason: "Λόγος",
    comment: "Σχόλιο (προαιρετικό)",
    commentRequired: "Σχόλιο (υποχρεωτικό για «Άλλο»)",
    commentPlaceholder: "Περιγράψτε σύντομα τι συνέβη…",
    submit: "Υποβολή αναφοράς",
    cancel: "Άκυρο",
    success: "Η αναφορά υποβλήθηκε. Ευχαριστούμε.",
    errorGeneric: "Δεν ήταν δυνατή η υποβολή. Δοκιμάστε ξανά.",
    errorAuth: "Συνδεθείτε για να υποβάλετε αναφορά.",
    errorOpen: "Έχετε ήδη ανοιχτή αναφορά για αυτό το προφίλ.",
    menuLabel: "Αναφορά",
  },
  en: {
    report: "Report",
    title: "Report user",
    body: "Our team will review this. The reported user is not notified.",
    reason: "Reason",
    comment: "Comment (optional)",
    commentRequired: "Comment (required for Other)",
    commentPlaceholder: "Briefly describe what happened…",
    submit: "Submit report",
    cancel: "Cancel",
    success: "Report submitted. Thank you.",
    errorGeneric: "Could not submit. Please try again.",
    errorAuth: "Sign in to submit a report.",
    errorOpen: "You already have an open report for this profile.",
    menuLabel: "Report",
  },
} as const;

export type ReportUserButtonProps = {
  lang: "el" | "en";
  variant?: "quiet" | "menu";
  targetType: UserReportTargetType;
  targetId?: string;
  brandEmail?: string;
  context: UserReportContext;
  conversationId?: string;
  onNeedAuth?: () => void;
};

export function ReportUserButton({
  lang,
  variant = "quiet",
  targetType,
  targetId,
  brandEmail,
  context,
  conversationId,
  onNeedAuth,
}: ReportUserButtonProps) {
  const txt = COPY[lang];
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<UserReportReason>("inappropriate");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openModal = async () => {
    const { data: { session } } = await import("@/lib/supabaseClient").then((m) => m.supabase.auth.getSession());
    if (!session?.access_token) {
      onNeedAuth?.();
      return;
    }
    setReason("inappropriate");
    setComment("");
    setDone(false);
    setError(null);
    setOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, string> = {
        target_type: targetType,
        reason,
        context,
      };
      if (targetId) payload.target_id = targetId;
      if (brandEmail && !targetId) payload.brand_email = brandEmail;
      if (conversationId) payload.conversation_id = conversationId;
      if (comment.trim()) payload.comment = comment.trim();

      const res = await sessionFetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError(txt.errorAuth);
        return;
      }
      if (res.status === 409) {
        setError(txt.errorOpen);
        return;
      }
      if (!res.ok) {
        setError(typeof body.message === "string" ? body.message : txt.errorGeneric);
        return;
      }
      setDone(true);
    } catch {
      setError(txt.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const triggerClass =
    variant === "menu"
      ? "w-full text-left px-3 min-h-11 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
      : "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-red-600 hover:bg-red-50 hover:text-red-700";

  return (
    <>
      {variant === "menu" ? (
        <button type="button" role="menuitem" className={triggerClass} onClick={() => void openModal()}>
          {txt.menuLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void openModal()}
          className={triggerClass}
          aria-label={txt.report}
          title={txt.report}
        >
          <Flag className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
      )}

      <ResponsiveDialog
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="report-user-title"
        size="lg"
        frame
      >
        <div className="flex min-h-0 flex-1 flex-col sm:min-h-[32rem]">
          <div className="relative shrink-0 px-5 pt-5 sm:px-6 sm:pt-6">
            <h2 id="report-user-title" className="pr-12 text-lg font-semibold text-slate-900">
              {txt.title}
            </h2>
            <DialogClose onClose={() => setOpen(false)} />
            <p className="mt-1 text-sm text-slate-600">{txt.body}</p>
          </div>

          {done ? (
            <p className="mx-5 mt-4 mb-5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 sm:mx-6">
              {txt.success}
            </p>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-slate-800">{txt.reason}</legend>
                  {allUserReportReasons(lang).map((row) => (
                    <label
                      key={row.key}
                      className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        className="mt-0.5"
                        checked={reason === row.key}
                        onChange={() => setReason(row.key)}
                      />
                      <span>{row.label}</span>
                    </label>
                  ))}
                </fieldset>

                <label className="mt-4 block text-sm font-medium text-slate-800">
                  {reason === "other" ? txt.commentRequired : txt.comment}
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder={txt.commentPlaceholder}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>

                {error ? (
                  <p className="mt-3 text-sm text-red-700" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="min-h-11 rounded-lg px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    {txt.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={busy || (reason === "other" && !comment.trim())}
                    onClick={() => void submit()}
                    className="min-h-11 rounded-lg bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                  >
                    {busy ? "…" : txt.submit}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </ResponsiveDialog>
    </>
  );
}