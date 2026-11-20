"use client";

import { useEffect, useRef, useState } from "react";
import { sessionFetch } from "@/lib/sessionFetch";
import { showcaseHelperText } from "@/lib/showcaseCopy";
import { parseSocialPostUrl, socialPostUrlErrorMessage } from "@/lib/socialPostUrl";

type Lang = "el" | "en";
type Mode = "link" | "event";

const COPY = {
  el: {
    label: "Παραδοτέο",
    step: "Βήμα: ανέβασε το παραδοτέο",
    hint: "Επικόλλησε το δημοσιευμένο reel / TikTok / post (https). Εκεί εγκρίνει το brand — όχι μόνο στο chat.",
    placeholder: "https://instagram.com/reel/… ή TikTok",
    save: "Αποθήκευση",
    saving: "Αποθήκευση…",
    saved: "Αποθηκεύτηκε.",
    approve: "Έγκριση link",
    confirmEvent: "Επιβεβαίωση ότι έγινε",
    approving: "Έγκριση…",
    approved: "Εγκρίθηκε.",
    pending: "Αναμονή έγκρισης από το brand.",
    pendingEvent: "Αναμονή επιβεβαίωσης παρουσίας από το brand.",
    noLink: "Δεν υπάρχει link (event / παρουσία)",
    useLink: "Έχω link παραδοτέου",
    eventHint: "Για event / in-person: προαιρετική φωτο/story (https) + σύντομη σημείωση.",
    notePlaceholder: "Σύντομη σημείωση (π.χ. «ήμουν στο event 15/11»)",
    proofPlaceholder: "https://… (προαιρετικό proof)",
    submitEvent: "Υποβολή επιβεβαίωσης",
    brandApproveStep: "Βήμα: έγκρινε / επιβεβαίωσε",
    requestChanges: "Ζήτα αλλαγές",
    requestChangesPh: "Τι πρέπει να αλλάξει;",
    requestingChanges: "Αποστολή…",
    changesRequested: "Ζητήθηκαν αλλαγές",
    changesRequestedHint: "Διόρθωσε το παραδοτέο και υποβάλε ξανά.",
    reviewNoteRequired: "Γράψε σύντομο σχόλιο.",
  },
  en: {
    label: "Deliverable",
    step: "Step: upload the deliverable",
    hint: "Paste the published reel / TikTok / post (https). That’s where the brand approves — not only in chat.",
    placeholder: "https://instagram.com/reel/… or TikTok",
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    approve: "Approve link",
    confirmEvent: "Confirm it happened",
    approving: "Approving…",
    approved: "Approved.",
    pending: "Waiting for brand approval.",
    pendingEvent: "Waiting for brand to confirm attendance.",
    noLink: "No link (event / in-person)",
    useLink: "I have a deliverable link",
    eventHint: "For event / in-person: optional photo/story (https) + short note.",
    notePlaceholder: "Short note (e.g. “attended the event on 15/11”)",
    proofPlaceholder: "https://… (optional proof)",
    submitEvent: "Submit confirmation",
    brandApproveStep: "Step: approve / confirm",
    requestChanges: "Request changes",
    requestChangesPh: "What should change?",
    requestingChanges: "Sending…",
    changesRequested: "Changes requested",
    changesRequestedHint: "Fix the deliverable and submit again.",
    reviewNoteRequired: "Add a short comment.",
  },
} as const;

export default function ProposalDeliverableField({
  proposalId,
  initialUrl,
  lang,
  readOnly = false,
  autoFocus = false,
  prefill,
  className = "",
  pendingApproval = false,
  canApprove = false,
  initialMode = "link",
  initialNote = "",
  initialProofUrl = "",
  deliveryConfirmed = false,
  deliverableStatus = null,
  deliverableReviewNote = null,
  showStepLabel = false,
  initialShowcaseConsent,
}: {
  proposalId: string;
  initialUrl?: string | null;
  lang: Lang;
  readOnly?: boolean;
  autoFocus?: boolean;
  prefill?: string | null;
  className?: string;
  pendingApproval?: boolean;
  /** Brand can clear pending approval. */
  canApprove?: boolean;
  initialMode?: Mode | string | null;
  initialNote?: string | null;
  initialProofUrl?: string | null;
  deliveryConfirmed?: boolean;
  deliverableStatus?: string | null;
  deliverableReviewNote?: string | null;
  showStepLabel?: boolean;
  /** Showcase consent at link submit / brand approve (checked unless stored === false). */
  initialShowcaseConsent?: boolean | null;
}) {
  const txt = COPY[lang];
  const [mode, setMode] = useState<Mode>(initialMode === "event" ? "event" : "link");
  const [url, setUrl] = useState(prefill || initialUrl || "");
  const [note, setNote] = useState(initialNote || "");
  const [proofUrl, setProofUrl] = useState(initialProofUrl || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(!!pendingApproval);
  const [confirmed, setConfirmed] = useState(!!deliveryConfirmed);
  const [approving, setApproving] = useState(false);
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [brandReviewNote, setBrandReviewNote] = useState("");
  const [status, setStatus] = useState(String(deliverableStatus || ""));
  const [reviewNote, setReviewNote] = useState(deliverableReviewNote || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const [showcaseConsent, setShowcaseConsent] = useState(initialShowcaseConsent !== false);

  useEffect(() => {
    setPending(!!pendingApproval);
  }, [pendingApproval]);

  useEffect(() => {
    setConfirmed(!!deliveryConfirmed);
  }, [deliveryConfirmed]);

  useEffect(() => {
    setStatus(String(deliverableStatus || ""));
  }, [deliverableStatus]);

  useEffect(() => {
    setReviewNote(deliverableReviewNote || "");
  }, [deliverableReviewNote]);

  useEffect(() => {
    if (prefill) setUrl(prefill);
  }, [prefill]);

  useEffect(() => {
    setShowcaseConsent(initialShowcaseConsent !== false);
  }, [initialShowcaseConsent]);

  useEffect(() => {
    if (!autoFocus) return;
    requestAnimationFrame(() => {
      inputRef.current?.scrollIntoView({ block: "center" });
      inputRef.current?.focus();
    });
  }, [autoFocus]);

  const saveLink = async () => {
    const parsed = parseSocialPostUrl(url);
    if (!parsed.ok) {
      setError(socialPostUrlErrorMessage(parsed.error, lang));
      setOk(false);
      return;
    }
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      const res = await sessionFetch("/api/collaborations/showcase", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "proposal",
          id: proposalId,
          deliveryMode: "link",
          publishedPostUrl: parsed.url,
          showcaseConsent,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || (lang === "el" ? "Δεν αποθηκεύτηκε." : "Could not save."));
        return;
      }
      setUrl(parsed.url);
      setMode("link");
      setPending(true);
      setStatus("submitted");
      setOk(true);
    } catch {
      setError(lang === "el" ? "Δεν αποθηκεύτηκε." : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const saveEvent = async () => {
    const proof = proofUrl.trim();
    if (proof && !proof.startsWith("https://")) {
      setError(lang === "el" ? "Το proof πρέπει να είναι https://…" : "Proof must be an https:// URL.");
      return;
    }
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      const res = await sessionFetch("/api/collaborations/showcase", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "proposal",
          id: proposalId,
          deliveryMode: "event",
          eventDelivery: true,
          deliveryNote: note.trim() || null,
          deliveryProofUrl: proof || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || (lang === "el" ? "Δεν αποθηκεύτηκε." : "Could not save."));
        return;
      }
      setMode("event");
      setPending(true);
      setStatus("submitted");
      setOk(true);
    } catch {
      setError(lang === "el" ? "Δεν αποθηκεύτηκε." : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    setApproving(true);
    setError(null);
    try {
      const res = await sessionFetch("/api/collaborations/showcase", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "proposal",
          id: proposalId,
          approvePublishedPost: mode !== "event",
          confirmEventDelivery: mode === "event",
          showcaseConsent,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || (lang === "el" ? "Δεν εγκρίθηκε." : "Could not approve."));
        return;
      }
      setPending(false);
      setConfirmed(true);
      setStatus("approved");
      setOk(true);
    } catch {
      setError(lang === "el" ? "Δεν εγκρίθηκε." : "Could not approve.");
    } finally {
      setApproving(false);
    }
  };

  const requestChangesAction = async () => {
    const note = brandReviewNote.trim();
    if (!note) {
      setError(txt.reviewNoteRequired);
      return;
    }
    setRequestingChanges(true);
    setError(null);
    try {
      const res = await sessionFetch("/api/collaborations/showcase", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "proposal",
          id: proposalId,
          requestDeliverableChanges: true,
          reviewNote: note,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          body.error === "review_note_required"
            ? txt.reviewNoteRequired
            : body.error || (lang === "el" ? "Δεν αποστάλθηκε." : "Could not send.")
        );
        return;
      }
      setPending(false);
      setStatus("changes_requested");
      setReviewNote(note);
      setBrandReviewNote("");
      setOk(true);
    } catch {
      setError(lang === "el" ? "Δεν αποστάλθηκε." : "Could not send.");
    } finally {
      setRequestingChanges(false);
    }
  };

  const changesRequested = status === "changes_requested";
  const stepLabel = canApprove ? txt.brandApproveStep : txt.step;

  return (
    <div
      id={`deliverable-proposal-${proposalId}`}
      className={`rounded-lg border border-slate-200 bg-white p-3 space-y-2 scroll-mt-24 ${className}`}
    >
      {showStepLabel ? (
        <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
          {stepLabel}
        </p>
      ) : null}
      <p className="text-xs font-semibold text-slate-700">{txt.label}</p>
      {mode === "link" ? (
        <p className="text-[11px] text-slate-500">{txt.hint}</p>
      ) : (
        <p className="text-[11px] text-slate-500">{txt.eventHint}</p>
      )}
      <p className="text-[11px] leading-relaxed text-slate-400">
        {showcaseHelperText(readOnly || canApprove ? "brand" : "influencer", lang)}
      </p>
      {readOnly ? (
        <>
          {mode === "event" ? (
            <>
              <p className="text-xs text-slate-700">
                {lang === "el" ? "Event / παρουσία" : "Event / in-person"}
                {note ? ` — ${note}` : ""}
              </p>
              {proofUrl ? (
                <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 underline break-all">
                  {proofUrl}
                </a>
              ) : null}
            </>
          ) : url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 underline break-all">
              {url}
            </a>
          ) : (
            <p className="text-xs text-slate-500">{lang === "el" ? "Δεν έχει υποβληθεί ακόμα." : "Not submitted yet."}</p>
          )}
          {changesRequested && reviewNote ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5 whitespace-pre-wrap">
              {reviewNote}
            </p>
          ) : null}
          {pending && !confirmed && !changesRequested ? (
            <p className="text-[11px] text-amber-700">{mode === "event" ? txt.pendingEvent : txt.pending}</p>
          ) : null}
          {canApprove && pending && !confirmed ? (
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={showcaseConsent}
                  onChange={(e) => setShowcaseConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-slate-800">
                    {lang === "el"
                      ? "Να φαίνεται δημόσια στις «Πρόσφατες συνεργασίες»"
                      : "Show publicly in “Recent collaborations”"}
                  </span>
                </span>
              </label>
              <textarea
                value={brandReviewNote}
                onChange={(e) => {
                  setBrandReviewNote(e.target.value);
                  setError(null);
                }}
                placeholder={txt.requestChangesPh}
                rows={2}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={approving}
                  onClick={() => void approve()}
                  className="inline-flex min-h-10 items-center text-sm px-4 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {approving ? txt.approving : mode === "event" ? txt.confirmEvent : txt.approve}
                </button>
                <button
                  type="button"
                  disabled={requestingChanges || !brandReviewNote.trim()}
                  onClick={() => void requestChangesAction()}
                  className="inline-flex min-h-10 items-center text-sm px-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 font-medium hover:bg-amber-100 disabled:opacity-50"
                >
                  {requestingChanges ? txt.requestingChanges : txt.requestChanges}
                </button>
              </div>
            </div>
          ) : null}
          {(ok && !pending) || confirmed ? <p className="text-xs text-emerald-700">{txt.approved}</p> : null}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("link")}
              className={`text-xs px-3 py-1.5 rounded-md border ${
                mode === "link" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              {txt.useLink}
            </button>
            <button
              type="button"
              onClick={() => setMode("event")}
              className={`text-xs px-3 py-1.5 rounded-md border ${
                mode === "event" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              {txt.noLink}
            </button>
          </div>
          {mode === "link" ? (
            <>
              <label className="flex items-start gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={showcaseConsent}
                  onChange={(e) => setShowcaseConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-slate-800">
                    {lang === "el"
                      ? "Να φαίνεται δημόσια στις «Πρόσφατες συνεργασίες»"
                      : "Show publicly in “Recent collaborations”"}
                  </span>
                </span>
              </label>
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setOk(false);
                  setError(null);
                }}
                placeholder={txt.placeholder}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveLink()}
                className="inline-flex min-h-10 items-center text-sm px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? txt.saving : txt.save}
              </button>
            </>
          ) : (
            <>
              <textarea
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setOk(false);
                  setError(null);
                }}
                placeholder={txt.notePlaceholder}
                rows={2}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
              />
              <input
                type="url"
                value={proofUrl}
                onChange={(e) => {
                  setProofUrl(e.target.value);
                  setOk(false);
                  setError(null);
                }}
                placeholder={txt.proofPlaceholder}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveEvent()}
                className="inline-flex min-h-10 items-center text-sm px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? txt.saving : txt.submitEvent}
              </button>
            </>
          )}
          {changesRequested ? (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-amber-800">{txt.changesRequested}</p>
              {reviewNote ? (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5 whitespace-pre-wrap">
                  {reviewNote}
                </p>
              ) : null}
              <p className="text-[11px] text-slate-600">{txt.changesRequestedHint}</p>
            </div>
          ) : null}
          {pending && !changesRequested ? (
            <p className="text-[11px] text-amber-700">{mode === "event" ? txt.pendingEvent : txt.pending}</p>
          ) : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          {ok ? <p className="text-xs text-emerald-700">{txt.saved}</p> : null}
        </>
      )}
      {error && readOnly ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
