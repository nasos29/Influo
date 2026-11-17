"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { sessionFetch } from "@/lib/sessionFetch";
import { showcasePostFields } from "@/lib/showcasePostUrl";

type Lang = "el" | "en";
type Source = "proposal" | "campaign";
type Filter = "all" | "event_pending";

type Item = {
  id: string;
  source: Source;
  brandName: string;
  influencerId: string;
  influencerName: string;
  postUrl: string | null;
  completedAt: string | null;
  hidden: boolean;
  pinned: boolean;
  brandConsent?: boolean;
  influencerConsent?: boolean;
  pendingApproval?: boolean;
  postUrlUpdatedBy?: string | null;
  postUrlUpdatedAt?: string | null;
  pinnedBy?: string | null;
  deliveryState?: string | null;
  deliveryMode?: string | null;
  eventAdminAllowed?: boolean;
  eventConfirmPending?: boolean;
  deliveryConfirmedAt?: string | null;
  autoCompletedAt?: string | null;
};

function hasPublicVideo(url: string | null | undefined): boolean {
  return !!showcasePostFields(url).postUrl;
}

const COPY = {
  el: {
    title: "Πρόσφατες συνεργασίες (admin)",
    empty: "Δεν υπάρχουν ολοκληρωμένες συνεργασίες ακόμα.",
    emptyFilter: "Καμία συνεργασία με εκκρεμή επιβεβαίωση event.",
    pin: "Εμφάνιση στην αρχική",
    unpin: "Αφαίρεση από αρχική",
    hide: "Απόκρυψη",
    show: "Εμφάνιση",
    loadError: "Αποτυχία φόρτωσης.",
    publicNote:
      "Δημόσια εμφανίζονται μόνο συνεργασίες με έγκυρο video/post link, διπλή συναίνεση και χωρίς απόκρυψη. Η αρχική δείχνει όσες έχουν «Εμφάνιση στην αρχική»· αν καμία δεν είναι επιλεγμένη, εμφανίζονται οι πιο πρόσφατες με βίντεο. Το /collaborations δείχνει όλες τις επιλέξιμες με βίντεο. Auto-complete 7 ημερών ισχύει μόνο για link· τα event μένουν εκκρεμή μέχρι brand ή «Ολοκλήρωση από admin».",
    saveUrl: "Αποθήκευση URL",
    urlPlaceholder: "https://instagram.com/reel/… ή TikTok / YouTube",
    audit: "Τελευταία αλλαγή URL",
    pinnedBy: "Επιλογή αρχικής από",
    noVideoBadge: "Χωρίς βίντεο — δεν εμφανίζεται",
    consentMissingBoth: "Λείπει συγκατάθεση brand & influencer",
    consentMissingBrand: "Λείπει συγκατάθεση brand",
    consentMissingInfluencer: "Λείπει συγκατάθεση influencer",
    consentMissingTitle: "Χωρίς συγκατάθεση δεν εμφανίζεται στην αρχική",
    filterAll: "Όλες",
    filterEventPending: "Εκκρεμεί επιβεβαίωση",
    eventPendingBadge: "Εκκρεμεί επιβεβαίωση",
    adminComplete: "Ολοκλήρωση από admin",
    adminCompleteConfirm:
      "Να ολοκληρωθεί η συνεργασία από admin; Θα σταλεί το κανονικό email «Η συνεργασία ολοκληρώθηκε» (με αξιολόγηση, όπου επιτρέπεται).",
  },
  en: {
    title: "Recent collaborations (admin)",
    empty: "No completed collaborations yet.",
    emptyFilter: "No event collaborations pending confirmation.",
    pin: "Show on homepage",
    unpin: "Remove from homepage",
    hide: "Hide",
    show: "Show",
    loadError: "Failed to load.",
    publicNote:
      "Public listing requires a valid video/post link, both consents, and not being hidden. Homepage shows items marked «Show on homepage»; if none are marked, it falls back to the latest with video. /collaborations lists all eligible with video. 7-day auto-complete is link-only; events stay pending until brand or «Complete as admin».",
    saveUrl: "Save URL",
    urlPlaceholder: "https://instagram.com/reel/… or TikTok / YouTube",
    audit: "Last URL change",
    pinnedBy: "Homepage pick by",
    noVideoBadge: "No video — not shown publicly",
    consentMissingBoth: "Missing brand & influencer consent",
    consentMissingBrand: "Missing brand consent",
    consentMissingInfluencer: "Missing influencer consent",
    consentMissingTitle: "Without consent it does not appear on the homepage",
    filterAll: "All",
    filterEventPending: "Pending confirmation",
    eventPendingBadge: "Pending confirmation",
    adminComplete: "Complete as admin",
    adminCompleteConfirm:
      "Complete this collaboration as admin? This sends the normal «collaboration completed» email (with review where allowed).",
  },
} as const;

export default function AdminRecentCollaborationsPanel({ lang }: { lang: Lang }) {
  const txt = COPY[lang];
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftUrls, setDraftUrls] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await sessionFetch("/api/admin/collaborations/showcase?includeHidden=1");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : txt.loadError);
        setItems([]);
        return;
      }
      const next = Array.isArray(body.items)
        ? (body.items as Item[]).map((row) => ({
            ...row,
            influencerName:
              typeof row.influencerName === "string" && row.influencerName.trim()
                ? row.influencerName.trim()
                : "",
          }))
        : [];
      setItems(next);
      const drafts: Record<string, string> = {};
      for (const row of next) {
        drafts[`${row.source}:${row.id}`] = row.postUrl || "";
      }
      setDraftUrls(drafts);
    } catch {
      setError(txt.loadError);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [txt.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(
    () => items.filter((row) => row.eventConfirmPending).length,
    [items]
  );

  const visible = useMemo(() => {
    if (filter === "event_pending") {
      return items.filter((row) => row.eventConfirmPending);
    }
    return items;
  }, [filter, items]);

  const patch = async (
    item: Item,
    patchBody: {
      hidden?: boolean;
      pinned?: boolean;
      postUrl?: string | null;
      adminComplete?: boolean;
    }
  ) => {
    const key = `${item.source}:${item.id}`;
    setBusyId(key);
    try {
      const res = await sessionFetch("/api/admin/collaborations/showcase", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: item.source, id: item.id, ...patchBody }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : txt.loadError);
        return;
      }
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id && row.source === item.source
            ? {
                ...row,
                hidden: typeof patchBody.hidden === "boolean" ? patchBody.hidden : row.hidden,
                pinned: typeof patchBody.pinned === "boolean" ? patchBody.pinned : row.pinned,
                postUrl: "postUrl" in patchBody ? (patchBody.postUrl ?? null) : row.postUrl,
                pendingApproval: "postUrl" in patchBody ? false : row.pendingApproval,
                postUrlUpdatedBy:
                  typeof body.postUrlUpdatedBy === "string"
                    ? body.postUrlUpdatedBy
                    : row.postUrlUpdatedBy,
                postUrlUpdatedAt:
                  typeof body.postUrlUpdatedAt === "string"
                    ? body.postUrlUpdatedAt
                    : row.postUrlUpdatedAt,
                pinnedBy:
                  typeof body.pinnedBy === "string"
                    ? body.pinnedBy
                    : typeof patchBody.pinned === "boolean"
                      ? body.pinnedBy || row.pinnedBy
                      : row.pinnedBy,
                eventConfirmPending:
                  patchBody.adminComplete === true ? false : row.eventConfirmPending,
                deliveryConfirmedAt:
                  patchBody.adminComplete === true
                    ? typeof body.deliveryConfirmedAt === "string"
                      ? body.deliveryConfirmedAt
                      : row.deliveryConfirmedAt
                    : row.deliveryConfirmedAt,
                deliveryState:
                  patchBody.adminComplete === true && typeof body.deliveryState === "string"
                    ? body.deliveryState
                    : row.deliveryState,
              }
            : row
        )
      );
      if ("postUrl" in patchBody) {
        setDraftUrls((prev) => ({ ...prev, [key]: patchBody.postUrl || "" }));
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{txt.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{txt.publicNote}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`inline-flex min-h-9 items-center rounded-lg border px-3 text-xs font-medium ${
            filter === "all"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
        >
          {txt.filterAll}
        </button>
        <button
          type="button"
          onClick={() => setFilter("event_pending")}
          className={`inline-flex min-h-9 items-center rounded-lg border px-3 text-xs font-medium ${
            filter === "event_pending"
              ? "border-amber-700 bg-amber-700 text-white"
              : "border-amber-200 text-amber-900 hover:bg-amber-50"
          }`}
        >
          {txt.filterEventPending}
          {pendingCount > 0 ? ` (${pendingCount})` : ""}
        </button>
      </div>
      {loading ? <p className="text-sm text-slate-500">…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && visible.length === 0 ? (
        <p className="text-sm text-slate-500">
          {filter === "event_pending" ? txt.emptyFilter : txt.empty}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {visible.map((item) => {
            const key = `${item.source}:${item.id}`;
            const busy = busyId === key;
            const draft = draftUrls[key] ?? item.postUrl ?? "";
            const videoOk = hasPublicVideo(item.postUrl);
            const eventPending = !!item.eventConfirmPending;
            const brandConsentMissing = !item.brandConsent;
            const influencerConsentMissing = !item.influencerConsent;
            const consentMissing = brandConsentMissing || influencerConsentMissing;
            const consentBadgeLabel =
              brandConsentMissing && influencerConsentMissing
                ? txt.consentMissingBoth
                : brandConsentMissing
                  ? txt.consentMissingBrand
                  : txt.consentMissingInfluencer;
            return (
              <li key={key} className="flex flex-col gap-3 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {item.brandName}
                      {item.influencerName ? ` × ${item.influencerName}` : ""}{" "}
                      <span className="text-xs font-normal text-slate-500">
                        · {item.source}
                        {item.pinned ? " · homepage" : ""}
                        {item.hidden ? " · hidden" : ""}
                        {item.pendingApproval ? " · pending approval" : ""}
                      </span>
                    </p>
                    {item.deliveryState ? (
                      <p className="mt-0.5 text-[11px] font-medium text-slate-600">
                        {lang === "el" ? "Παράδοση:" : "Delivery:"} {item.deliveryState}
                        {item.deliveryMode === "event" ? " · event" : ""}
                      </p>
                    ) : null}
                    {eventPending ? (
                      <span className="mt-1 mr-1 inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200/80">
                        {txt.eventPendingBadge}
                      </span>
                    ) : null}
                    {consentMissing ? (
                      <span
                        title={txt.consentMissingTitle}
                        className="mt-1 mr-1 inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200/80"
                      >
                        {consentBadgeLabel}
                      </span>
                    ) : null}
                    {!videoOk ? (
                      <span className="mt-1 inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200/80">
                        {txt.noVideoBadge}
                      </span>
                    ) : null}
                    {item.postUrlUpdatedAt || item.postUrlUpdatedBy ? (
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {txt.audit}: {item.postUrlUpdatedBy || "—"}
                        {item.postUrlUpdatedAt ? ` · ${item.postUrlUpdatedAt}` : ""}
                      </p>
                    ) : null}
                    {item.pinned && item.pinnedBy ? (
                      <p className="text-[11px] text-slate-400">
                        {txt.pinnedBy}: {item.pinnedBy}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {eventPending ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(txt.adminCompleteConfirm)) return;
                          void patch(item, { adminComplete: true });
                        }}
                        className="inline-flex min-h-10 items-center rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                      >
                        {txt.adminComplete}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patch(item, { pinned: !item.pinned })}
                      className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {item.pinned ? txt.unpin : txt.pin}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void patch(item, { hidden: !item.hidden })}
                      className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {item.hidden ? txt.show : txt.hide}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="url"
                    value={draft}
                    onChange={(e) =>
                      setDraftUrls((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={txt.urlPlaceholder}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800"
                  />
                  <button
                    type="button"
                    disabled={busy || draft.trim() === (item.postUrl || "")}
                    onClick={() =>
                      void patch(item, { postUrl: draft.trim() ? draft.trim() : null })
                    }
                    className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {txt.saveUrl}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
