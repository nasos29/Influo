"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { sessionFetch } from "@/lib/sessionFetch";
import {
  REVIEW_DECLINE_HINT_EL,
  REVIEW_DECLINE_HINT_EN,
  REVIEW_DECLINE_LABEL_EL,
  REVIEW_DECLINE_LABEL_EN,
  REVIEW_HELPER_BRAND_EL,
  REVIEW_HELPER_BRAND_EN,
  REVIEW_HELPER_BRAND_SHOWCASE_NOTE_EL,
  REVIEW_HELPER_BRAND_SHOWCASE_NOTE_EN,
  REVIEW_HELPER_CREATOR_EL,
  REVIEW_HELPER_CREATOR_EN,
} from "@/lib/reviewCopy";

export type PendingCollabReview = {
  proposalId: string;
  source?: "proposal" | "campaign";
  applicationId?: string;
  brandName: string;
  creatorName?: string | null;
  profileUrl?: string | null;
  needsReview: boolean;
  needsPostLink: boolean;
  publishedPostUrl?: string | null;
};

type Party = "brand" | "influencer";

const DISMISS_MS = 3 * 24 * 60 * 60 * 1000;

function dismissKey(party: Party, proposalId: string): string {
  return `influo_review_prompt_dismiss_${party}_${proposalId}`;
}

function isSoftDismissed(party: Party, proposalId: string): boolean {
  try {
    const raw = localStorage.getItem(dismissKey(party, proposalId));
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_MS;
  } catch {
    return false;
  }
}

function softDismiss(party: Party, proposalId: string): void {
  try {
    localStorage.setItem(dismissKey(party, proposalId), String(Date.now()));
  } catch {
    /* ignore */
  }
}

type Props = {
  lang: "el" | "en";
  party: Party;
  items: PendingCollabReview[];
  onOpenReview: (item: PendingCollabReview) => void;
  onChanged?: () => void;
};

export default function CollabReviewPromptPanel({
  lang,
  party,
  items,
  onOpenReview,
  onChanged,
}: Props) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [postUrlDraft, setPostUrlDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = new Set<string>();
    for (const item of items) {
      if (isSoftDismissed(party, item.proposalId)) next.add(item.proposalId);
    }
    setHiddenIds(next);
  }, [items, party]);

  const visible = useMemo(
    () => items.filter((i) => !hiddenIds.has(i.proposalId) && (i.needsReview || i.needsPostLink)),
    [items, hiddenIds]
  );

  const T = useCallback(
    (el: string, en: string) => (lang === "en" ? en : el),
    [lang]
  );

  const decline = async (item: PendingCollabReview) => {
    setBusyId(item.proposalId);
    setError(null);
    try {
      const res = await sessionFetch("/api/reviews/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: item.proposalId,
          applicationId: item.applicationId || item.proposalId,
          source: item.source || "proposal",
          party,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "decline failed");
      }
      setHiddenIds((prev) => new Set([...prev, item.proposalId]));
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const savePostLink = async (item: PendingCollabReview) => {
    const url = (postUrlDraft[item.proposalId] || "").trim();
    if (!url) return;
    setSavingId(item.proposalId);
    setError(null);
    try {
      const res = await sessionFetch("/api/collaborations/showcase", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "proposal",
          id: item.proposalId,
          publishedPostUrl: url,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "save failed");
      }
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSavingId(null);
    }
  };

  if (visible.length === 0) return null;

  const helper =
    party === "brand"
      ? T(REVIEW_HELPER_BRAND_EL, REVIEW_HELPER_BRAND_EN)
      : T(REVIEW_HELPER_CREATOR_EL, REVIEW_HELPER_CREATOR_EN);

  return (
    <section
      className="mb-6 space-y-3"
      aria-label={T("Αξιολογήσεις συνεργασιών", "Collaboration reviews")}
      data-testid="collab-review-prompt-panel"
    >
      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 sm:px-5">
        <p className="text-sm font-semibold text-amber-950">
          {T(
            `Έχεις ${visible.length} συνεργασί${visible.length === 1 ? "α" : "ες"} να αξιολογήσεις`,
            `You have ${visible.length} collaboration${visible.length === 1 ? "" : "s"} to review`
          )}
        </p>
        <p className="mt-1 text-xs text-amber-900/80 leading-relaxed">{helper}</p>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {visible.map((item) => (
        <article
          key={item.proposalId}
          className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm"
          data-testid="collab-review-prompt-card"
        >
          <h3 className="text-base font-semibold text-slate-900">
            {T("Αξιολόγησε τη συνεργασία", "Rate this collaboration")}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {party === "brand"
              ? T(
                  `με ${item.creatorName || "τον δημιουργό"}`,
                  `with ${item.creatorName || "the creator"}`
                )
              : T(`με ${item.brandName}`, `with ${item.brandName}`)}
          </p>

          {party === "brand" ? (
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              {T(REVIEW_HELPER_BRAND_SHOWCASE_NOTE_EL, REVIEW_HELPER_BRAND_SHOWCASE_NOTE_EN)}
            </p>
          ) : null}

          {party === "influencer" && item.needsPostLink ? (
            <div className="mt-3 space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                {T(
                  "Πρόσθεσε το link του βίντεο της συνεργασίας",
                  "Add the collaboration video link"
                )}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="url"
                  className="min-h-[44px] flex-1 rounded-lg border border-slate-300 px-3 text-sm"
                  placeholder="https://…"
                  value={postUrlDraft[item.proposalId] ?? item.publishedPostUrl ?? ""}
                  onChange={(e) =>
                    setPostUrlDraft((prev) => ({ ...prev, [item.proposalId]: e.target.value }))
                  }
                />
                <button
                  type="button"
                  disabled={savingId === item.proposalId}
                  onClick={() => void savePostLink(item)}
                  className="min-h-[44px] rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingId === item.proposalId
                    ? T("Αποθήκευση…", "Saving…")
                    : T("Αποθήκευση", "Save")}
                </button>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {T(REVIEW_HELPER_CREATOR_EL, REVIEW_HELPER_CREATOR_EN)}
              </p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {item.needsReview ? (
              <button
                type="button"
                onClick={() => onOpenReview(item)}
                className="min-h-[44px] rounded-lg bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600"
              >
                {T("Αξιολόγηση", "Review")}
              </button>
            ) : null}
            <button
              type="button"
              disabled={busyId === item.proposalId}
              onClick={() => {
                softDismiss(party, item.proposalId);
                setHiddenIds((prev) => new Set([...prev, item.proposalId]));
              }}
              className="min-h-[44px] rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100"
            >
              {T("Αργότερα", "Later")}
            </button>
          </div>
          <button
            type="button"
            disabled={busyId === item.proposalId}
            onClick={() => void decline(item)}
            className="mt-2 text-xs text-gray-400 hover:underline disabled:opacity-60"
            title={T(REVIEW_DECLINE_HINT_EL, REVIEW_DECLINE_HINT_EN)}
          >
            {busyId === item.proposalId
              ? "…"
              : T(REVIEW_DECLINE_LABEL_EL, REVIEW_DECLINE_LABEL_EN)}
          </button>
        </article>
      ))}
    </section>
  );
}
