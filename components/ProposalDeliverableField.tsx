"use client";

import { useEffect, useRef, useState } from "react";
import { sessionFetch } from "@/lib/sessionFetch";
import { showcaseHelperText } from "@/lib/showcaseCopy";
import { parseSocialPostUrl, socialPostUrlErrorMessage } from "@/lib/socialPostUrl";

type Lang = "el" | "en";

const COPY = {
  el: {
    label: "Παραδοτέο",
    hint: "Επικόλλησε το δημοσιευμένο reel / TikTok / post (https). Εκεί εγκρίνει το brand — όχι μόνο στο chat.",
    placeholder: "https://instagram.com/reel/… ή TikTok",
    save: "Αποθήκευση",
    saving: "Αποθήκευση…",
    saved: "Αποθηκεύτηκε.",
    approve: "Έγκριση link",
    approving: "Έγκριση…",
    approved: "Εγκρίθηκε.",
    pending: "Αναμονή έγκρισης από το brand.",
  },
  en: {
    label: "Deliverable",
    hint: "Paste the published reel / TikTok / post (https). That’s where the brand approves — not only in chat.",
    placeholder: "https://instagram.com/reel/… or TikTok",
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    approve: "Approve link",
    approving: "Approving…",
    approved: "Approved.",
    pending: "Waiting for brand approval.",
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
}) {
  const txt = COPY[lang];
  const [url, setUrl] = useState(prefill || initialUrl || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, setPending] = useState(!!pendingApproval);
  const [approving, setApproving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPending(!!pendingApproval);
  }, [pendingApproval]);

  useEffect(() => {
    if (prefill) setUrl(prefill);
  }, [prefill]);

  useEffect(() => {
    if (!autoFocus) return;
    requestAnimationFrame(() => {
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      inputRef.current?.focus();
    });
  }, [autoFocus]);

  const save = async () => {
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
          publishedPostUrl: parsed.url,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || (lang === "el" ? "Δεν αποθηκεύτηκε." : "Could not save."));
        return;
      }
      setUrl(parsed.url);
      setPending(true);
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
          approvePublishedPost: true,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || (lang === "el" ? "Δεν εγκρίθηκε." : "Could not approve."));
        return;
      }
      setPending(false);
      setOk(true);
    } catch {
      setError(lang === "el" ? "Δεν εγκρίθηκε." : "Could not approve.");
    } finally {
      setApproving(false);
    }
  };

  return (
    <div
      id={`deliverable-proposal-${proposalId}`}
      className={`rounded-lg border border-slate-200 bg-white p-3 space-y-2 scroll-mt-24 ${className}`}
    >
      <p className="text-xs font-semibold text-slate-700">{txt.label}</p>
      <p className="text-[11px] text-slate-500">{txt.hint}</p>
      <p className="text-[11px] leading-relaxed text-slate-400">
        {showcaseHelperText(readOnly || canApprove ? "brand" : "influencer", lang)}
      </p>
      {readOnly ? (
        url ? (
          <>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 underline break-all">
              {url}
            </a>
            {pending ? <p className="text-[11px] text-amber-700">{txt.pending}</p> : null}
            {canApprove && pending ? (
              <button
                type="button"
                disabled={approving}
                onClick={() => void approve()}
                className="inline-flex min-h-10 items-center text-sm px-4 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {approving ? txt.approving : txt.approve}
              </button>
            ) : null}
            {ok && !pending ? <p className="text-xs text-emerald-700">{txt.approved}</p> : null}
          </>
        ) : (
          <p className="text-xs text-slate-500">{lang === "el" ? "Δεν έχει υποβληθεί ακόμα." : "Not submitted yet."}</p>
        )
      ) : (
        <>
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
            onClick={() => void save()}
            className="inline-flex min-h-10 items-center text-sm px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? txt.saving : txt.save}
          </button>
          {pending ? <p className="text-[11px] text-amber-700">{txt.pending}</p> : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          {ok ? <p className="text-xs text-emerald-700">{txt.saved}</p> : null}
        </>
      )}
      {error && readOnly ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
