"use client";

import { useEffect, useRef, useState } from "react";
import { sessionFetch } from "@/lib/sessionFetch";
import { COLLAB_UPLOAD_LIMIT_COPY } from "@/lib/collabDeliverableUpload";
import { PORTFOLIO_FILE_ACCEPT } from "@/lib/portfolioFilePicker";
import { usePortfolioMediaUpload } from "@/lib/usePortfolioMediaUpload";
import { canRequestDraftChanges } from "@/lib/deliverableRevisionLimits";

type Lang = "el" | "en";
type Source = "proposal" | "campaign";

const COPY = {
  el: {
    title: "Draft περιεχομένου (UGC)",
    hint: "Ανέβασε το draft βίντεο ή φωτο πριν τη δημόσια δημοσίευση. Το brand το εγκρίνει εδώ.",
    submit: "Υποβολή draft στο brand",
    submitting: "Υποβολή…",
    approve: "Έγκριση draft",
    requestChanges: "Ζήτα αλλαγές",
    download: "Λήψη MP4/φωτο",
    pending: "Αναμονή έγκρισης draft.",
    approved: "Το draft εγκρίθηκε — τώρα δημοσίευσε και επικόλλησε το live link παρακάτω.",
    changes: "Ζητήθηκαν αλλαγές στο draft:",
    revisionCap: "Έφτασες το όριο γύρων διόρθωσης· συνεχίστε στο chat.",
    pick: "Επίλεξε αρχείο",
    reviewPh: "Τι πρέπει να αλλάξει στο draft;",
  },
  en: {
    title: "Content draft (UGC)",
    hint: "Upload draft video or photo before going public. The brand approves it here.",
    submit: "Submit draft to brand",
    submitting: "Submitting…",
    approve: "Approve draft",
    requestChanges: "Request changes",
    download: "Download MP4/photo",
    pending: "Waiting for brand draft approval.",
    approved: "Draft approved — now publish and paste the live link below.",
    changes: "Draft changes requested:",
    revisionCap: "Revision limit reached; continue in chat.",
    pick: "Choose file",
    reviewPh: "What should change in the draft?",
  },
} as const;

export default function CollabDeliverableDraftPanel({
  source,
  id,
  lang,
  influencerId,
  needsDraft,
  initialStatus,
  initialReviewNote,
  revisionCount = 0,
  isUgc = true,
  canApprove = false,
  readOnlyUpload = false,
}: {
  source: Source;
  id: string;
  lang: Lang;
  influencerId: string;
  needsDraft: boolean;
  initialStatus?: string | null;
  initialReviewNote?: string | null;
  revisionCount?: number;
  isUgc?: boolean;
  canApprove?: boolean;
  readOnlyUpload?: boolean;
}) {
  const txt = COPY[lang];
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState(String(initialStatus || ""));
  const [reviewNote, setReviewNote] = useState(initialReviewNote || "");
  const [brandNote, setBrandNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [readyUploadId, setReadyUploadId] = useState<string | null>(null);

  const upload = usePortfolioMediaUpload({
    influencerId,
    lang,
    startUpload: {
      url: "/api/collaborations/deliverable-draft/uploads",
      extraBody: { source, id, lang },
      omitInfluencerId: true,
    },
  });

  useEffect(() => {
    setStatus(String(initialStatus || ""));
  }, [initialStatus]);
  useEffect(() => {
    setReviewNote(initialReviewNote || "");
  }, [initialReviewNote]);

  useEffect(() => {
    const off = upload.registerOnReady((url) => {
      void url;
      const last = upload.items.find((i) => i.upload?.status === "ready");
      if (last?.upload?.id) setReadyUploadId(last.upload.id);
    });
    return off;
  }, [upload]);

  if (!needsDraft) return null;

  const submitDraft = async () => {
    const uploadId = readyUploadId || upload.items.find((i) => i.upload?.status === "ready")?.upload?.id;
    if (!uploadId) {
      setError(lang === "el" ? "Περίμενε να ολοκληρωθεί το ανέβασμα." : "Wait for the upload to finish.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await sessionFetch("/api/collaborations/deliverable-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, id, action: "submit", uploadId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || "error");
        return;
      }
      setStatus("submitted");
    } finally {
      setBusy(false);
    }
  };

  const review = async (action: "approve" | "request_changes") => {
    if (action === "request_changes" && !brandNote.trim()) {
      setError(lang === "el" ? "Γράψε σχόλιο." : "Add a comment.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await sessionFetch("/api/collaborations/deliverable-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          id,
          action,
          reviewNote: brandNote.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error || "error");
        return;
      }
      setStatus(action === "approve" ? "approved" : "changes_requested");
      if (action === "request_changes") setReviewNote(brandNote.trim());
      setBrandNote("");
    } finally {
      setBusy(false);
    }
  };

  const downloadHref = `/api/collaborations/deliverable-draft/download?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`;

  const canRequest = canRequestDraftChanges(isUgc, revisionCount, status);

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 space-y-2">
      <p className="text-sm font-semibold text-violet-950">{txt.title}</p>
      <p className="text-xs text-violet-800">{txt.hint}</p>
      <p className="text-[10px] text-violet-700">{COLLAB_UPLOAD_LIMIT_COPY[lang]}</p>

      {status === "approved" ? (
        <p className="text-sm text-emerald-800 font-medium">{txt.approved}</p>
      ) : null}
      {status === "changes_requested" && reviewNote ? (
        <p className="text-sm text-amber-900">
          {txt.changes} {reviewNote}
        </p>
      ) : null}
      {status === "submitted" && !canApprove ? <p className="text-sm text-slate-700">{txt.pending}</p> : null}

      {!readOnlyUpload && status !== "submitted" && status !== "approved" ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={PORTFOLIO_FILE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const list = e.target.files;
              if (list?.length) upload.pick(list, 1);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white"
          >
            {txt.pick}
          </button>
          {upload.items[0]?.phase === "sending" ? (
            <span className="text-xs text-violet-900">{Math.round(upload.items[0].percent)}%</span>
          ) : null}
          <button
            type="button"
            disabled={busy || !readyUploadId}
            onClick={() => void submitDraft()}
            className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-900 disabled:opacity-50"
          >
            {busy ? txt.submitting : txt.submit}
          </button>
        </div>
      ) : null}

      {canApprove && status === "submitted" ? (
        <div className="space-y-2">
          <textarea
            value={brandNote}
            onChange={(e) => setBrandNote(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-violet-200 px-2 py-1 text-sm"
            placeholder={txt.reviewPh}
          />
          <div className="flex flex-wrap gap-2">
            <a
              href={downloadHref}
              className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-900"
            >
              {txt.download}
            </a>
            <button
              type="button"
              disabled={busy || !canRequest}
              onClick={() => void review("request_changes")}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-50"
            >
              {txt.requestChanges}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void review("approve")}
              className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white"
            >
              {txt.approve}
            </button>
          </div>
          {!canRequest ? <p className="text-xs text-amber-800">{txt.revisionCap}</p> : null}
        </div>
      ) : null}

      {(status === "submitted" || status === "approved" || status === "changes_requested") && !canApprove ? (
        <a href={downloadHref} className="inline-block text-xs font-semibold text-violet-800 underline">
          {txt.download}
        </a>
      ) : null}

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}