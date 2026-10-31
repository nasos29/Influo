"use client";

import { useEffect, useId, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import CampaignCover from "@/components/CampaignCover";
import DmyDateField from "@/components/DmyDateField";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { filterWorkLinks } from "@/lib/contactFilter";
import { formatDate, formatTime } from "@/lib/formatDateTime";
import { formatEuro, formatEuroAmount } from "@/lib/formatEuro";
import {
  getApplicationInfluencerMeta,
  getCampaignBrandMeta,
  type AdminBrandCampaign,
  type AdminCampaignApplication,
} from "@/components/admin/adminCampaignTypes";

type Lang = "el" | "en";

const copy = {
  details: { el: "Λεπτομέρειες καμπάνιας", en: "Campaign details" },
  close: { el: "Κλείσιμο", en: "Close" },
  cancel: { el: "Άκυρο", en: "Cancel" },
  save: { el: "Αποθήκευση", en: "Save" },
  saving: { el: "Αποθήκευση…", en: "Saving…" },
  saved: { el: "Η καμπάνια αποθηκεύτηκε.", en: "Campaign saved." },
  brand: { el: "Επιχείρηση", en: "Brand" },
  verified: { el: "Επαληθευμένη", en: "Verified" },
  unverified: { el: "Μη επαληθευμένη", en: "Not verified" },
  title: { el: "Τίτλος", en: "Title" },
  description: { el: "Περιγραφή", en: "Description" },
  budget: { el: "Προϋπολογισμός", en: "Budget" },
  compensation: { el: "Αμοιβή", en: "Compensation" },
  compMoney: { el: "Χρήματα", en: "Money" },
  compProduct: { el: "Προϊόν", en: "Product" },
  compBoth: { el: "Χρήματα και προϊόν", en: "Money and product" },
  compUnset: { el: "Χωρίς επιλογή", en: "Not set" },
  category: { el: "Κατηγορία", en: "Category" },
  categoryUnset: { el: "Χωρίς κατηγορία", en: "No category" },
  platforms: { el: "Πλατφόρμες", en: "Platforms" },
  start: { el: "Ημερομηνία έναρξης", en: "Start date" },
  deadline: { el: "Προθεσμία", en: "Deadline" },
  dateHint: { el: "Ημέρα / μήνας / έτος.", en: "Day / month / year." },
  location: { el: "Περιοχή", en: "Area" },
  minFollowers: { el: "Ελάχιστοι ακόλουθοι", en: "Minimum followers" },
  deliverables: { el: "Παραδοτέα", en: "Deliverables" },
  cover: { el: "Εξώφυλλο (σύνδεσμος https)", en: "Cover (https link)" },
  status: { el: "Κατάσταση", en: "Status" },
  draft: { el: "Πρόχειρο", en: "Draft" },
  open: { el: "Ανοιχτή", en: "Open" },
  closed: { el: "Κλειστή", en: "Closed" },
  dates: { el: "Ημερομηνίες", en: "Dates" },
  created: { el: "Δημιουργία", en: "Created" },
  updated: { el: "Τελευταία ενημέρωση", en: "Last updated" },
  opened: { el: "Άνοιξε", en: "Opened" },
  closedAt: { el: "Έκλεισε", en: "Closed" },
  autoClosed: { el: "Έκλεισε αυτόματα", en: "Closed automatically" },
  applications: { el: "Συμμετέχοντες / αιτήσεις", en: "Creators / applications" },
  appsNone: { el: "Δεν υπάρχουν αιτήσεις.", en: "No applications." },
  proposed: { el: "Προτεινόμενη τιμή", en: "Proposed price" },
  work: { el: "Δείγματα δουλειάς", en: "Past work" },
  deliverable: { el: "Παραδοτέο", en: "Deliverable" },
  note: { el: "Σημείωση", en: "Note" },
  reviewNote: { el: "Σχόλιο επιχείρησης", en: "Brand note" },
  discardTitle: { el: "Απόρριψη αλλαγών;", en: "Discard changes?" },
  discardBody: { el: "Οι αλλαγές δεν έχουν αποθηκευτεί.", en: "Your edits are not saved." },
  discardOk: { el: "Απόρριψη", en: "Discard" },
  publishTitle: { el: "Άνοιγμα καμπάνιας", en: "Open campaign" },
  publishBody: {
    el: "Η καμπάνια θα είναι ορατή σε εγκεκριμένους creators και στη δημόσια σελίδα. Συνέχεια;",
    en: "Approved creators and the public campaigns page will be able to see it. Continue?",
  },
  publishOk: { el: "Άνοιγμα", en: "Open" },
  deadlineCleared: {
    el: "Η προθεσμία είχε περάσει, οπότε αφαιρέθηκε για να μην κλείσει αμέσως η ανοιχτή καμπάνια.",
    en: "The deadline had passed, so it was cleared and the open campaign will not close immediately.",
  },
  titleRequired: { el: "Συμπληρώστε τίτλο.", en: "Enter a title." },
  budgetRequired: { el: "Το budget είναι υποχρεωτικό για χρηματική αμοιβή.", en: "Budget is required for paid work." },
  deadlineOrder: {
    el: "Η προθεσμία πρέπει να είναι μετά την ημερομηνία έναρξης.",
    en: "The deadline must be after the start date.",
  },
  invalidCover: { el: "Το εξώφυλλο πρέπει να είναι σύνδεσμος https.", en: "The cover must be an https link." },
  saveFailed: { el: "Η αποθήκευση απέτυχε.", en: "Save failed." },
} as const;

const ERRORS: Record<string, { el: string; en: string }> = {
  invalid_request: { el: "Μη έγκυρο αίτημα.", en: "Invalid request." },
  missing_campaign_id: { el: "Δεν βρέθηκε η καμπάνια.", en: "Campaign not found." },
  not_found: { el: "Δεν βρέθηκε η καμπάνια.", en: "Campaign not found." },
  title_required: copy.titleRequired,
  title_too_long: { el: "Ο τίτλος είναι πολύ μεγάλος.", en: "The title is too long." },
  description_too_long: { el: "Η περιγραφή είναι πολύ μεγάλη.", en: "The description is too long." },
  deliverables_too_long: { el: "Τα παραδοτέα είναι πολύ μεγάλα.", en: "Deliverables are too long." },
  location_too_long: { el: "Η περιοχή είναι πολύ μεγάλη.", en: "The area is too long." },
  invalid_status: { el: "Μη έγκυρη κατάσταση.", en: "Invalid status." },
  invalid_compensation: { el: "Μη έγκυρος τύπος αμοιβής.", en: "Invalid compensation." },
  invalid_budget: { el: "Μη έγκυρο ποσό.", en: "Invalid amount." },
  budget_required: copy.budgetRequired,
  invalid_starts_on: { el: "Μη έγκυρη ημερομηνία έναρξης.", en: "Invalid start date." },
  invalid_deadline: { el: "Μη έγκυρη προθεσμία.", en: "Invalid deadline." },
  deadline_after_start: copy.deadlineOrder,
  invalid_min_followers: { el: "Μη έγκυρος αριθμός ακολούθων.", en: "Invalid follower count." },
  invalid_platforms: { el: "Μη έγκυρες πλατφόρμες.", en: "Invalid platforms." },
  invalid_category: { el: "Μη έγκυρη κατηγορία.", en: "Invalid category." },
  invalid_cover_url: copy.invalidCover,
  Unauthorized: { el: "Χρειάζεται σύνδεση διαχειριστή.", en: "Admin sign-in is required." },
  Forbidden: { el: "Δεν έχετε δικαιώματα διαχειριστή.", en: "You do not have admin access." },
  save_failed: copy.saveFailed,
  timeout: { el: "Η αποθήκευση διήρκησε πολύ. Δοκιμάστε ξανά.", en: "Saving took too long. Try again." },
};

const PLATFORMS = [
  { id: "instagram", el: "Instagram", en: "Instagram" },
  { id: "tiktok", el: "TikTok", en: "TikTok" },
  { id: "youtube", el: "YouTube", en: "YouTube" },
  { id: "facebook", el: "Facebook", en: "Facebook" },
] as const;

const APP_STATUS: Record<string, { el: string; en: string }> = {
  pending: { el: "Εκκρεμεί", en: "Pending" },
  accepted: { el: "Αποδεκτή", en: "Accepted" },
  rejected: { el: "Απορρίφθηκε", en: "Rejected" },
  shortlisted: { el: "Shortlist", en: "Shortlisted" },
  withdrawn: { el: "Αποσύρθηκε", en: "Withdrawn" },
};

const DELIVERABLE_STATUS: Record<string, { el: string; en: string }> = {
  submitted: { el: "Υποβλήθηκε", en: "Submitted" },
  approved: { el: "Εγκρίθηκε", en: "Approved" },
  changes_requested: { el: "Ζητήθηκαν αλλαγές", en: "Changes requested" },
};

type FormState = {
  title: string;
  description: string;
  budget: string;
  category: string;
  deliverables: string;
  status: "draft" | "open" | "closed";
  deadline: string;
  starts_on: string;
  location: string;
  min_followers: string;
  platforms: string[];
  compensation_type: "" | "money" | "product" | "both";
  cover_url: string;
};

type ConfirmAsk = (opts: {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
}) => Promise<boolean>;

type SaveResult =
  | { ok: true; campaign: Partial<AdminBrandCampaign>; deadlineCleared: boolean }
  | { ok: false; error: string };

function tx(pair: { el: string; en: string }, lang: Lang) {
  return pair[lang];
}

function ymd(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : "";
}

function asPlatforms(value: AdminBrandCampaign["platforms"]): string[] {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function budgetInput(value: number | string | null | undefined): string {
  if (value == null || value === "") return "";
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(n)) return "";
  const cents = Math.round(n * 100);
  if (cents % 100 === 0) return String(cents / 100);
  return (cents / 100).toFixed(2);
}

function asStatus(value: string): FormState["status"] {
  if (value === "open" || value === "closed") return value;
  return "draft";
}

function asCompensation(value: string | null | undefined): FormState["compensation_type"] {
  if (value === "money" || value === "product" || value === "both") return value;
  return "";
}

function toForm(campaign: AdminBrandCampaign): FormState {
  return {
    title: campaign.title || "",
    description: campaign.description || "",
    budget: budgetInput(campaign.budget),
    category: campaign.category || "",
    deliverables: campaign.deliverables || "",
    status: asStatus(campaign.status),
    deadline: ymd(campaign.deadline),
    starts_on: ymd(campaign.starts_on),
    location: campaign.location || "",
    min_followers: campaign.min_followers != null ? String(campaign.min_followers) : "",
    platforms: asPlatforms(campaign.platforms),
    compensation_type: asCompensation(campaign.compensation_type),
    cover_url: campaign.cover_url || "",
  };
}

function statusClass(status: string) {
  if (status === "open") return "bg-emerald-100 text-emerald-800";
  if (status === "closed") return "bg-slate-200 text-slate-700";
  if (status === "accepted") return "bg-emerald-100 text-emerald-800";
  if (status === "rejected" || status === "withdrawn") return "bg-slate-200 text-slate-600";
  if (status === "shortlisted") return "bg-blue-100 text-blue-800";
  return "bg-amber-100 text-amber-800";
}

function appStatusLabel(status: string, lang: Lang) {
  return tx(APP_STATUS[status] || APP_STATUS.pending, lang);
}

function stamp(value: string | null | undefined, lang: Lang) {
  if (!value) return "—";
  return `${formatDate(value, lang)} ${formatTime(value, lang)}`.trim();
}

const fieldClass =
  "mt-1 w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const labelClass = "block text-sm font-medium text-slate-700";

export default function AdminCampaignDetail({
  campaign,
  lang,
  confirm,
  confirmOpen,
  onClose,
  onSave,
  onNotify,
}: {
  campaign: AdminBrandCampaign;
  lang: Lang;
  confirm: ConfirmAsk;
  confirmOpen: boolean;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<SaveResult>;
  onNotify: (message: string, tone?: "success" | "error" | "info") => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState(() => toForm(campaign));
  const [baseline, setBaseline] = useState(() => JSON.stringify(toForm(campaign)));
  const [saving, setSaving] = useState(false);
  const closeRef = useRef<() => void>(() => {});
  const interactionRef = useRef(false);
  const brand = getCampaignBrandMeta(campaign);
  const dirty = JSON.stringify(form) !== baseline;
  const applications = campaign.applications || [];
  const platformOptions = [
    ...PLATFORMS.map((item) => item.id),
    ...form.platforms.filter((id) => !PLATFORMS.some((item) => item.id === id)),
  ];
  const categoryOptions = form.category && !CATEGORIES.includes(form.category as (typeof CATEGORIES)[number])
    ? [form.category, ...CATEGORIES]
    : [...CATEGORIES];

  const requestClose = async () => {
    if (saving || confirmOpen || interactionRef.current) return;
    if (!dirty) {
      onClose();
      return;
    }
    interactionRef.current = true;
    try {
      const ok = await confirm({
        title: tx(copy.discardTitle, lang),
        body: tx(copy.discardBody, lang),
        confirmLabel: tx(copy.discardOk, lang),
        cancelLabel: tx(copy.cancel, lang),
        danger: true,
      });
      if (!ok) return;
    } finally {
      interactionRef.current = false;
    }
    onClose();
  };

  closeRef.current = () => {
    void requestClose();
  };

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    if (saving || interactionRef.current) return;
    if (!form.title.trim()) {
      onNotify(tx(copy.titleRequired, lang), "error");
      return;
    }
    const needsMoney = form.compensation_type === "money" || form.compensation_type === "both";
    const budgetNumber = Number(form.budget.trim().replace(",", "."));
    if (needsMoney && !(budgetNumber > 0)) {
      onNotify(tx(copy.budgetRequired, lang), "error");
      return;
    }
    if (form.starts_on && form.deadline && form.deadline <= form.starts_on) {
      onNotify(tx(copy.deadlineOrder, lang), "error");
      return;
    }
    if (form.cover_url.trim()) {
      try {
        if (new URL(form.cover_url.trim()).protocol !== "https:") {
          onNotify(tx(copy.invalidCover, lang), "error");
          return;
        }
      } catch {
        onNotify(tx(copy.invalidCover, lang), "error");
        return;
      }
    }
    if (form.status === "open" && campaign.status !== "open") {
      interactionRef.current = true;
      let ok = false;
      try {
        ok = await confirm({
          title: tx(copy.publishTitle, lang),
          body: tx(copy.publishBody, lang),
          confirmLabel: tx(copy.publishOk, lang),
          cancelLabel: tx(copy.cancel, lang),
        });
      } finally {
        interactionRef.current = false;
      }
      if (!ok) return;
    }

    setSaving(true);
    interactionRef.current = true;
    try {
      const result = await onSave({
        campaignId: campaign.id,
        title: form.title,
        description: form.description,
        budget: form.budget,
        category: form.category,
        deliverables: form.deliverables,
        status: form.status,
        deadline: form.deadline,
        starts_on: form.starts_on,
        location: form.location,
        min_followers: form.min_followers,
        platforms: form.platforms,
        compensation_type: form.compensation_type,
        cover_url: form.cover_url,
      });
      if (!result.ok) {
        onNotify(tx(ERRORS[result.error] || copy.saveFailed, lang), "error");
        return;
      }
      const next = toForm({ ...campaign, ...result.campaign, budget: Number(result.campaign.budget ?? form.budget) });
      setForm(next);
      setBaseline(JSON.stringify(next));
      onNotify(tx(copy.saved, lang), "success");
      if (result.deadlineCleared) onNotify(tx(copy.deadlineCleared, lang), "info");
    } finally {
      interactionRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex bg-black/50 md:items-center md:justify-center md:p-4"
      onMouseDown={() => {
        void requestClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white outline-none md:h-auto md:max-h-[min(92dvh,880px)] md:max-w-3xl md:rounded-2xl md:shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{tx(copy.details, lang)}</p>
            <h2 id={titleId} className="truncate text-lg font-semibold text-slate-900">
              {form.title || campaign.title}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
              <span>{brand.name}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(form.status)}`}>
                {tx(form.status === "open" ? copy.open : form.status === "closed" ? copy.closed : copy.draft, lang)}
              </span>
              <span>{formatEuroAmount(form.budget, lang) || "—"}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void requestClose()}
            aria-label={tx(copy.close, lang)}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-xl text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </header>

        <form
          id="admin-campaign-form"
          className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <CampaignCover
            coverUrl={form.cover_url || null}
            title={form.title || campaign.title}
            brandName={brand.name}
            logoUrl={brand.logo}
            category={form.category}
            platforms={form.platforms}
            aspect="16/9"
            className="rounded-xl"
          />

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className={labelClass}>{tx(copy.brand, lang)}</p>
            <p className="mt-1 font-medium text-slate-900">{brand.name}</p>
            {brand.email ? <p className="text-sm text-slate-600 break-all">{brand.email}</p> : null}
            <p className="mt-1 text-xs text-slate-500">
              {brand.verified ? tx(copy.verified, lang) : tx(copy.unverified, lang)}
            </p>
          </section>

          <label className={labelClass}>
            {tx(copy.title, lang)}
            <input
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
              className={fieldClass}
            />
          </label>

          <label className={labelClass}>
            {tx(copy.description, lang)}
            <textarea
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              rows={5}
              className={`${fieldClass} min-h-28`}
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              {tx(copy.status, lang)}
              <select
                value={form.status}
                onChange={(event) => set("status", asStatus(event.target.value))}
                className={fieldClass}
              >
                <option value="draft">{tx(copy.draft, lang)}</option>
                <option value="open">{tx(copy.open, lang)}</option>
                <option value="closed">{tx(copy.closed, lang)}</option>
              </select>
            </label>
            <label className={labelClass}>
              {tx(copy.compensation, lang)}
              <select
                value={form.compensation_type}
                onChange={(event) => set("compensation_type", asCompensation(event.target.value))}
                className={fieldClass}
              >
                <option value="">{tx(copy.compUnset, lang)}</option>
                <option value="money">{tx(copy.compMoney, lang)}</option>
                <option value="product">{tx(copy.compProduct, lang)}</option>
                <option value="both">{tx(copy.compBoth, lang)}</option>
              </select>
            </label>
            <label className={labelClass}>
              {tx(copy.budget, lang)}
              <span className="mt-1 flex items-center gap-2">
                <input
                  inputMode="decimal"
                  value={form.budget}
                  onChange={(event) => set("budget", event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
                <span className="shrink-0 text-sm text-slate-600">€</span>
              </span>
              {formatEuroAmount(form.budget, lang) ? (
                <span className="mt-1 block text-sm text-slate-500">{formatEuroAmount(form.budget, lang)}</span>
              ) : null}
            </label>
            <label className={labelClass}>
              {tx(copy.category, lang)}
              <select
                value={form.category}
                onChange={(event) => set("category", event.target.value)}
                className={fieldClass}
              >
                <option value="">{tx(copy.categoryUnset, lang)}</option>
                {categoryOptions.map((key) => (
                  <option key={key} value={key}>
                    {categoryLabel(key, lang)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset>
            <legend className={labelClass}>{tx(copy.platforms, lang)}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {platformOptions.map((id) => {
                const known = PLATFORMS.find((item) => item.id === id);
                const checked = form.platforms.includes(id);
                return (
                  <label
                    key={id}
                    className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm ${
                      checked ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-800"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() =>
                        set(
                          "platforms",
                          checked ? form.platforms.filter((item) => item !== id) : [...form.platforms, id]
                        )
                      }
                    />
                    {known ? tx(known, lang) : id}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className={labelClass}>{tx(copy.start, lang)}</p>
              <p className="mt-0.5 text-xs text-slate-500">{tx(copy.dateHint, lang)}</p>
              <DmyDateField value={form.starts_on} onChange={(value) => set("starts_on", value)} />
            </div>
            <div>
              <p className={labelClass}>{tx(copy.deadline, lang)}</p>
              <p className="mt-0.5 text-xs text-slate-500">{tx(copy.dateHint, lang)}</p>
              <DmyDateField value={form.deadline} onChange={(value) => set("deadline", value)} />
            </div>
            <label className={labelClass}>
              {tx(copy.location, lang)}
              <input
                value={form.location}
                onChange={(event) => set("location", event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              {tx(copy.minFollowers, lang)}
              <input
                inputMode="numeric"
                value={form.min_followers}
                onChange={(event) => set("min_followers", event.target.value.replace(/[^\d]/g, ""))}
                className={fieldClass}
              />
            </label>
          </div>

          <label className={labelClass}>
            {tx(copy.deliverables, lang)}
            <textarea
              value={form.deliverables}
              onChange={(event) => set("deliverables", event.target.value)}
              rows={3}
              className={`${fieldClass} min-h-24`}
            />
          </label>

          <label className={labelClass}>
            {tx(copy.cover, lang)}
            <input
              value={form.cover_url}
              onChange={(event) => set("cover_url", event.target.value)}
              inputMode="url"
              className={fieldClass}
              placeholder="https://"
            />
          </label>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">{tx(copy.dates, lang)}</h3>
            <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">{tx(copy.created, lang)}</dt>
                <dd className="text-slate-900">{stamp(campaign.created_at, lang)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{tx(copy.updated, lang)}</dt>
                <dd className="text-slate-900">{stamp(campaign.updated_at, lang)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{tx(copy.opened, lang)}</dt>
                <dd className="text-slate-900">{stamp(campaign.opened_at, lang)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{tx(copy.closedAt, lang)}</dt>
                <dd className="text-slate-900">
                  {stamp(campaign.closed_at, lang)}
                  {campaign.auto_closed ? (
                    <span className="ml-2 text-xs text-slate-500">{tx(copy.autoClosed, lang)}</span>
                  ) : null}
                </dd>
              </div>
            </dl>
          </section>

          <section id="admin-campaign-applications">
            <h3 className="text-sm font-semibold text-slate-900">
              {tx(copy.applications, lang)} ({applications.length})
            </h3>
            {applications.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">{tx(copy.appsNone, lang)}</p>
            ) : (
              <div className="mt-3 space-y-3">
                {applications.map((app) => (
                  <ApplicationCard key={app.id} app={app} lang={lang} />
                ))}
              </div>
            )}
          </section>
        </form>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={() => void requestClose()}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {tx(copy.cancel, lang)}
          </button>
          <button
            type="submit"
            form="admin-campaign-form"
            disabled={saving || !dirty}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? tx(copy.saving, lang) : tx(copy.save, lang)}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ApplicationCard({ app, lang }: { app: AdminCampaignApplication; lang: Lang }) {
  const creator = getApplicationInfluencerMeta(app);
  const links = filterWorkLinks(app.work_links || "").ok;
  const deliverableStatus = app.deliverable_status && app.deliverable_status !== "none"
    ? DELIVERABLE_STATUS[app.deliverable_status]
    : null;
  return (
    <article className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <Avatar src={creator.avatar} alt={creator.name} size={48} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/influencer/${app.influencer_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-900 hover:text-blue-700 hover:underline"
          >
            {creator.name}
          </a>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(app.status)}`}>
            {appStatusLabel(app.status, lang)}
          </span>
        </div>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
          {app.proposed_price != null ? (
            <span>
              {tx(copy.proposed, lang)}: {formatEuro(Number(app.proposed_price), lang)}
            </span>
          ) : null}
          <span>{formatDate(app.created_at, lang)}</span>
        </p>
        {app.message?.trim() ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{app.message}</p>
        ) : null}
        {links.length > 0 ? (
          <div className="mt-2 flex flex-col gap-1">
            <p className="text-xs font-medium text-slate-500">{tx(copy.work, lang)}</p>
            {links.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-blue-700 hover:underline">
                {url}
              </a>
            ))}
          </div>
        ) : null}
        {app.deliverable_url || app.deliverable_note || deliverableStatus ? (
          <div className="mt-2 text-xs text-slate-600">
            <p className="font-medium text-slate-500">
              {tx(copy.deliverable, lang)}
              {deliverableStatus ? ` · ${tx(deliverableStatus, lang)}` : ""}
            </p>
            {app.deliverable_url ? (
              <a href={app.deliverable_url} target="_blank" rel="noopener noreferrer" className="break-all text-blue-700 hover:underline">
                {app.deliverable_url}
              </a>
            ) : null}
            {app.deliverable_note?.trim() ? <p className="mt-1 whitespace-pre-wrap">{app.deliverable_note}</p> : null}
            {app.deliverable_review_note?.trim() ? (
              <p className="mt-1 whitespace-pre-wrap">
                {tx(copy.reviewNote, lang)}: {app.deliverable_review_note}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
