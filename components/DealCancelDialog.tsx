"use client";

import { useEffect, useState } from "react";
import { CANCEL_REASON_MIN } from "@/lib/dealCancelEligibility";

type Lang = "el" | "en";

type Props = {
  open: boolean;
  lang: Lang;
  saving?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

const COPY = {
  el: {
    title: "Ακύρωση συμφωνίας",
    body: "Η συμφωνία θα ακυρωθεί. Ο λόγος είναι υποχρεωτικός και θα κοινοποιηθεί στην άλλη πλευρά.",
    reasonLabel: "Λόγος ακύρωσης",
    reasonPlaceholder: "Περιγράψτε γιατί ακυρώνετε τη συμφωνία (τουλάχιστον 10 χαρακτήρες)…",
    hint: (n: number) => `${n}/${CANCEL_REASON_MIN} ελάχιστοι χαρακτήρες`,
    confirm: "Ακύρωση συμφωνίας",
    confirming: "Ακύρωση…",
    back: "Πίσω",
  },
  en: {
    title: "Cancel agreement",
    body: "The agreement will be cancelled. A reason is required and will be shared with the other party.",
    reasonLabel: "Reason for cancellation",
    reasonPlaceholder: "Describe why you are cancelling (at least 10 characters)…",
    hint: (n: number) => `${n}/${CANCEL_REASON_MIN} minimum characters`,
    confirm: "Cancel agreement",
    confirming: "Cancelling…",
    back: "Back",
  },
} as const;

export default function DealCancelDialog({ open, lang, saving, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState("");
  const txt = COPY[lang];
  const trimmedLen = reason.trim().length;
  const canConfirm = trimmedLen >= CANCEL_REASON_MIN && !saving;

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="deal-cancel-title"
        aria-describedby="deal-cancel-body"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200"
      >
        <h2 id="deal-cancel-title" className="text-lg font-semibold text-slate-900">
          {txt.title}
        </h2>
        <p id="deal-cancel-body" className="mt-2 text-sm leading-relaxed text-slate-600">
          {txt.body}
        </p>
        <label className="mt-4 block text-sm font-medium text-slate-800" htmlFor="deal-cancel-reason">
          {txt.reasonLabel}
        </label>
        <textarea
          id="deal-cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder={txt.reasonPlaceholder}
          className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
        />
        <p className="mt-1 text-xs text-slate-500">{txt.hint(trimmedLen)}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={!!saving}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {txt.back}
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(reason.trim())}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? txt.confirming : txt.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}