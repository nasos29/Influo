"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  deriveProposalDisplayStatusKey,
  proposalDisplayStatusFilterOptions,
  type ProposalDisplayStatusKey,
} from "@/lib/proposalDisplayStatus";
import { sessionFetch } from "@/lib/sessionFetch";
import { showcasePostFields } from "@/lib/showcasePostUrl";

type Lang = "el" | "en";
type Source = "proposal" | "campaign";

type Item = {
  id: string;
  source: Source;
  brandName: string;
  influencerId: string;
  influencerName: string;
  postUrl: string | null;
  completedAt: string | null;
  createdAt?: string | null;
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
  deliverySubmittedAt?: string | null;
  deliverableStatus?: string | null;
  eventAdminAllowed?: boolean;
  eventConfirmPending?: boolean;
  deliveryConfirmedAt?: string | null;
  autoCompletedAt?: string | null;
  dealStatus?: string | null;
};

function showcaseItemStatusRow(item: Item) {
  return {
    status: "completed" as const,
    delivery_mode: item.deliveryMode,
    delivery_submitted_at: item.deliverySubmittedAt,
    delivery_confirmed_at: item.deliveryConfirmedAt,
    auto_completed_at: item.autoCompletedAt,
    published_post_url: item.source === "proposal" ? item.postUrl : null,
    published_post_pending_approval: item.pendingApproval,
    deliverable_url: item.source === "campaign" ? item.postUrl : null,
    deliverable_status: item.deliverableStatus ?? null,
  };
}

function itemDisplayStatusKey(item: Item): ProposalDisplayStatusKey | "unknown" {
  return deriveProposalDisplayStatusKey(showcaseItemStatusRow(item));
}

function parseYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function itemCreatedDay(item: Item): Date | null {
  const raw = item.createdAt ?? item.completedAt;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function matchesDateRange(item: Item, from: string, to: string): boolean {
  const day = itemCreatedDay(item);
  if (!day) return !from && !to;
  const fromD = from ? parseYmdLocal(from) : null;
  const toD = to ? parseYmdLocal(to) : null;
  if (fromD && day < fromD) return false;
  if (toD && day > toD) return false;
  return true;
}

type CollabFilters = {
  brand: string;
  status: "all" | ProposalDisplayStatusKey;
  creator: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_FILTERS: CollabFilters = {
  brand: "",
  status: "all",
  creator: "",
  dateFrom: "",
  dateTo: "",
};

function filtersActive(f: CollabFilters): boolean {
  return !!(f.brand || f.status !== "all" || f.creator.trim() || f.dateFrom || f.dateTo);
}

function hasPublicVideo(url: string | null | undefined): boolean {
  return !!showcasePostFields(url).postUrl;
}

const COLLAB_FILTER_COPY = {
  filterBrand: { el: "Επιχείρηση", en: "Brand" },
  filterBrandAll: { el: "Όλες οι επιχειρήσεις", en: "All brands" },
  filterBrandPlaceholder: { el: "Αναζήτηση επιχείρησης…", en: "Search brand…" },
  filterStatus: { el: "Κατάσταση", en: "Status" },
  filterCreator: { el: "Creator", en: "Creator" },
  filterCreatorPlaceholder: { el: "Όνομα creator…", en: "Creator name…" },
  filterDateFrom: { el: "Από", en: "From" },
  filterDateTo: { el: "Έως", en: "To" },
  filterReset: { el: "Καθαρισμός", en: "Reset" },
  filterResultCount: {
    el: (shown: number, total: number) => `${shown} από ${total}`,
    en: (shown: number, total: number) => `${shown} of ${total}`,
  },
  emptyWithFilters: {
    el: "Καμία συνεργασία ταιριάζει με τα φίλτρα.",
    en: "No collaborations match the filters.",
  },
} as const;

function collabFilterCopy<L extends Lang>(lang: L) {
  return Object.fromEntries(
    (Object.keys(COLLAB_FILTER_COPY) as (keyof typeof COLLAB_FILTER_COPY)[]).map((key) => [
      key,
      COLLAB_FILTER_COPY[key][lang],
    ])
  ) as {
    [K in keyof typeof COLLAB_FILTER_COPY]: (typeof COLLAB_FILTER_COPY)[K][L];
  };
}

const COPY = {
  el: {
    title: "Πρόσφατες συνεργασίες (admin)",
    empty: "Δεν υπάρχουν ολοκληρωμένες συνεργασίες ακόμα.",
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
    ...collabFilterCopy("el"),
    filterEventPending: "Εκκρεμεί επιβεβαίωση",
    eventPendingBadge: "Εκκρεμεί επιβεβαίωση",
    adminComplete: "Ολοκλήρωση από admin",
    adminCompleteConfirm:
      "Να ολοκληρωθεί η συνεργασία από admin; Θα σταλεί το κανονικό email «Η συνεργασία ολοκληρώθηκε» (με αξιολόγηση, όπου επιτρέπεται).",
    sendDeliverableWarning: "Στείλε προειδοποίηση παραδοτέου",
    restoreDeal: "Επαναφορά (σε εξέλιξη)",
  },
  en: {
    title: "Recent collaborations (admin)",
    empty: "No completed collaborations yet.",
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
    ...collabFilterCopy("en"),
    filterEventPending: "Pending confirmation",
    eventPendingBadge: "Pending confirmation",
    adminComplete: "Complete as admin",
    adminCompleteConfirm:
      "Complete this collaboration as admin? This sends the normal «collaboration completed» email (with review where allowed).",
    sendDeliverableWarning: "Send deliverable warning",
    restoreDeal: "Restore (in progress)",
  },
} as const;

export default function AdminRecentCollaborationsPanel({ lang }: { lang: Lang }) {
  const txt = COPY[lang];
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftUrls, setDraftUrls] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<CollabFilters>(EMPTY_FILTERS);
  const [brandQuery, setBrandQuery] = useState("");
  const [brandOpen, setBrandOpen] = useState(false);
  const brandListId = useId();
  const brandRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!brandRootRef.current?.contains(event.target as Node)) setBrandOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await sessionFetch("/api/admin/collaborations/showcase?includeHidden=1&includeCancelled=1");
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

  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of items) {
      const name = row.brandName?.trim();
      if (name) set.add(name);
    }
    return [...set].sort((a, b) => a.localeCompare(b, lang === "el" ? "el" : "en"));
  }, [items, lang]);

  const filteredBrandOptions = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return brandOptions;
    return brandOptions.filter((b) => b.toLowerCase().includes(q));
  }, [brandOptions, brandQuery]);

  const pendingCount = useMemo(
    () => items.filter((row) => itemDisplayStatusKey(row) === "needs_admin").length,
    [items]
  );

  const visible = useMemo(() => {
    const creatorNeedle = filters.creator.trim().toLowerCase();
    return items.filter((row) => {
      if (filters.brand && row.brandName !== filters.brand) return false;
      if (filters.status !== "all" && itemDisplayStatusKey(row) !== filters.status) return false;
      if (creatorNeedle && !row.influencerName.toLowerCase().includes(creatorNeedle)) return false;
      if (!matchesDateRange(row, filters.dateFrom, filters.dateTo)) return false;
      return true;
    });
  }, [filters, items]);

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setBrandQuery("");
    setBrandOpen(false);
  };

  const autocancelAction = async (item: Item, action: "warn" | "restore") => {
    const key = `${item.source}:${item.id}`;
    setBusyId(key);
    try {
      const res = await sessionFetch("/api/admin/collaborations/autocancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, source: item.source, id: item.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : txt.loadError);
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

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
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-end">
          <div
            ref={brandRootRef}
            className="relative min-w-0 flex-1 sm:min-w-[10rem] sm:max-w-xs"
          >
            <label className="mb-1 block text-xs font-medium text-slate-600">{txt.filterBrand}</label>
            <input
              type="text"
              role="combobox"
              aria-expanded={brandOpen}
              aria-controls={brandListId}
              aria-autocomplete="list"
              placeholder={txt.filterBrandPlaceholder}
              value={brandQuery}
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800"
              onChange={(e) => {
                const v = e.target.value;
                setBrandQuery(v);
                setBrandOpen(true);
                if (!v.trim()) {
                  setFilters((prev) => ({ ...prev, brand: "" }));
                } else if (brandOptions.includes(v)) {
                  setFilters((prev) => ({ ...prev, brand: v }));
                }
              }}
              onFocus={() => setBrandOpen(true)}
            />
            {brandOpen && (filteredBrandOptions.length > 0 || !brandQuery.trim()) ? (
              <ul
                id={brandListId}
                role="listbox"
                className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
              >
                <li role="option">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setFilters((prev) => ({ ...prev, brand: "" }));
                      setBrandQuery("");
                      setBrandOpen(false);
                    }}
                  >
                    {txt.filterBrandAll}
                  </button>
                </li>
                {filteredBrandOptions.map((name) => (
                  <li key={name} role="option">
                    <button
                      type="button"
                      className={`w-full px-3 py-2 text-left hover:bg-slate-50 ${
                        filters.brand === name ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700"
                      }`}
                      onClick={() => {
                        setFilters((prev) => ({ ...prev, brand: name }));
                        setBrandQuery(name);
                        setBrandOpen(false);
                      }}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="min-w-0 flex-1 sm:min-w-[9rem] sm:max-w-[11rem]">
            <label className="mb-1 block text-xs font-medium text-slate-600">{txt.filterStatus}</label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  status: e.target.value as CollabFilters["status"],
                }))
              }
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800"
            >
              {proposalDisplayStatusFilterOptions(lang).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1 sm:min-w-[9rem]">
            <label className="mb-1 block text-xs font-medium text-slate-600">{txt.filterCreator}</label>
            <input
              type="search"
              value={filters.creator}
              onChange={(e) => setFilters((prev) => ({ ...prev, creator: e.target.value }))}
              placeholder={txt.filterCreatorPlaceholder}
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap gap-3 sm:flex-none">
            <div className="min-w-[8.5rem] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">{txt.filterDateFrom}</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800"
              />
            </div>
            <div className="min-w-[8.5rem] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">{txt.filterDateTo}</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pendingCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                setFilters((prev) => ({ ...prev, status: "needs_admin" }));
              }}
              className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-xs font-medium ${
                filters.status === "needs_admin"
                  ? "border-amber-700 bg-amber-700 text-white"
                  : "border-amber-200 text-amber-900 hover:bg-amber-50"
              }`}
            >
              {txt.filterEventPending}
              {` (${pendingCount})`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={resetFilters}
            disabled={!filtersActive(filters) && !brandQuery.trim()}
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {txt.filterReset}
          </button>
          {items.length > 0 ? (
            <span className="text-xs text-slate-500">{txt.filterResultCount(visible.length, items.length)}</span>
          ) : null}
        </div>
      </div>
      {loading ? <p className="text-sm text-slate-500">…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && visible.length === 0 ? (
        <p className="text-sm text-slate-500">
          {items.length > 0 && filtersActive(filters) ? txt.emptyWithFilters : txt.empty}
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
                    {item.postUrl ? (
                      <a
                        href={item.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 block text-xs text-blue-700 underline break-all"
                      >
                        {item.postUrl}
                      </a>
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
                    {item.deliveryState === "cancelled" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void autocancelAction(item, "restore")}
                        className="inline-flex min-h-10 items-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {txt.restoreDeal}
                      </button>
                    ) : !item.deliverySubmittedAt && !videoOk ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void autocancelAction(item, "warn")}
                        className="inline-flex min-h-10 items-center rounded-lg border border-violet-300 bg-violet-50 px-3 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                      >
                        {txt.sendDeliverableWarning}
                      </button>
                    ) : null}
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
