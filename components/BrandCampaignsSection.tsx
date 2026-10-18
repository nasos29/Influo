"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { sessionFetch } from "@/lib/sessionFetch";
import InfluencerPresenceDot from "@/components/InfluencerPresenceDot";
import CreatorPhoto from "@/components/CreatorPhoto";
import PlatformFollowers from "@/components/PlatformFollowers";
import DmyDateField from "@/components/DmyDateField";
import { askConfirm, toastError, toastSuccess } from "@/components/Feedback";
import { CATEGORIES, categoryLabel, normalizeCategoryToken } from "@/lib/categories";
import { publicProfilePath } from "@/lib/profileSlug";

const PLATFORMS = [
  { id: "instagram", el: "Instagram", en: "Instagram" },
  { id: "tiktok", el: "TikTok", en: "TikTok" },
  { id: "youtube", el: "YouTube", en: "YouTube" },
  { id: "facebook", el: "Facebook", en: "Facebook" },
] as const;

export type BrandCampaignRow = {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  budget: number;
  category: string | null;
  deliverables: string | null;
  status: "draft" | "open" | "closed";
  deadline: string | null;
  created_at: string;
  updated_at: string;
  platforms?: string[] | null;
  min_followers?: number | null;
  location?: string | null;
  starts_on?: string | null;
  compensation_type?: "money" | "product" | "both" | null;
};

type InfluencerBits = {
  display_name: string;
  avatar_url: string | null;
  profile_slug?: string | null;
  category?: string | null;
  accounts?: unknown;
  engagement_rate?: unknown;
  min_rate?: string | null;
} | null;

type ApplicationRow = {
  id: string;
  campaign_id: string;
  influencer_id: string;
  message: string | null;
  status: string;
  created_at: string;
  proposed_price?: number | null;
  work_links?: string | null;
  deliverable_url?: string | null;
  deliverable_note?: string | null;
  deliverable_status?: string | null;
  deliverable_review_note?: string | null;
  influencers: InfluencerBits;
};

type InviteMatch = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  profile_slug: string | null;
  categories: string[];
  accounts: unknown;
  score: number;
  reasons: string[];
};

const extra = {
  el: {
    required: "υποχρεωτικό",
    form_platforms: "Πλατφόρμες",
    form_min_followers: "Ελάχιστοι ακόλουθοι",
    form_location: "Περιοχή",
    form_start: "Ημερομηνία έναρξης",
    form_compensation: "Αμοιβή",
    comp_money: "Χρήματα",
    comp_product: "Προϊόν",
    comp_both: "Χρήματα και προϊόν",
    date_order: "Ημερομηνία με σειρά ημέρα / μήνας / έτος.",
    deadline_after_start: "Η προθεσμία πρέπει να είναι μετά την ημερομηνία έναρξης.",
    draft_saved: "Αποθηκεύτηκε ως πρόχειρο. Το βλέπει μόνο η επιχείρησή σας.",
    saved: "Η καμπάνια αποθηκεύτηκε.",
    publish_title: "Δημοσίευση",
    publish_body:
      "Η καμπάνια θα είναι ορατή σε εγκεκριμένους influencers και στη δημόσια σελίδα καμπανιών. Συνέχεια;",
    publish_ok: "Δημοσίευση",
    published: "Η καμπάνια είναι πλέον ανοιχτή.",
    delete_title: "Διαγραφή καμπάνιας",
    delete_plain: "Να διαγραφεί αυτή η καμπάνια;",
    delete_with_apps:
      "Υπάρχουν αιτήσεις. Οι creators θα ενημερωθούν ότι η καμπάνια αφαιρέθηκε και οι αιτήσεις τους δεν θα είναι πλέον ενεργές.",
    deleted: "Η καμπάνια διαγράφηκε.",
    status_updated: "Η κατάσταση της αίτησης ενημερώθηκε.",
    accepted: "Η αίτηση έγινε αποδεκτή. Άνοιξε η συνομιλία και δημιουργήθηκε συμφωνία.",
    unverified_card_title: "Επαλήθευση σε αναμονή",
    unverified_card_body:
      "Μπορείτε να ετοιμάσετε καμπάνιες ως Πρόχειρο. Η δημοσίευση (Ανοιχτή) ξεκλειδώνει μετά την έγκριση, συνήθως εντός 1–2 εργάσιμων ημερών.",
    verified_card_title: "Η επιχείρηση είναι επαληθευμένη",
    verified_card_body: "Μπορείτε να δημοσιεύετε καμπάνιες δημόσια.",
    open_locked: "Η κατάσταση «Ανοιχτή» είναι διαθέσιμη μετά την επαλήθευση.",
    migration: "Χρειάζεται το docs/CAMPAIGN_WORKFLOW_2026.sql στο Supabase για τα νέα πεδία.",
    public_page: "Δημόσια σελίδα",
    accept: "Αποδοχή",
    profile: "Προφίλ",
    rate: "Ελάχιστη τιμή",
    proposed: "Προτεινόμενη τιμή",
    work: "Δείγματα",
    invites_title: "Προτάσεις για πρόσκληση",
    invites_body: "Εγκεκριμένοι creators που ταιριάζουν με την καμπάνια. Η πρόσκληση στέλνει πρόταση συνεργασίας.",
    invite: "Πρόσκληση",
    invited: "Η πρόσκληση στάλθηκε.",
    followers: "Ακόλουθοι",
    engagement: "Engagement",
    cancel: "Ακύρωση",
  },
  en: {
    required: "required",
    form_platforms: "Platforms",
    form_min_followers: "Minimum followers",
    form_location: "Area",
    form_start: "Start date",
    form_compensation: "Compensation",
    comp_money: "Money",
    comp_product: "Product",
    comp_both: "Money and product",
    date_order: "Enter the date as day / month / year.",
    deadline_after_start: "The deadline must be after the start date.",
    draft_saved: "Saved as a draft. Only your company can see it.",
    saved: "Campaign saved.",
    publish_title: "Publish",
    publish_body:
      "Approved influencers and anyone with the public link will be able to see this campaign. Continue?",
    publish_ok: "Publish",
    published: "The campaign is now open.",
    delete_title: "Delete campaign",
    delete_plain: "Delete this campaign?",
    delete_with_apps:
      "This campaign has applications. Creators will be told it was removed and their applications will no longer be active.",
    deleted: "Campaign deleted.",
    status_updated: "Application status updated.",
    accepted: "Application accepted. A message thread and an agreement were opened.",
    unverified_card_title: "Verification pending",
    unverified_card_body:
      "You can prepare campaigns as drafts. Publishing (Open) unlocks after approval, usually within 1–2 business days.",
    verified_card_title: "Your company is verified",
    verified_card_body: "You can publish campaigns publicly.",
    open_locked: "Open status is available after verification.",
    migration: "Run docs/CAMPAIGN_WORKFLOW_2026.sql in Supabase for the new fields.",
    public_page: "Public page",
    accept: "Accept",
    profile: "Profile",
    rate: "Min rate",
    proposed: "Proposed price",
    work: "Past work",
    invites_title: "Creators to invite",
    invites_body: "Approved creators who fit this campaign. Invite sends a collaboration proposal.",
    invite: "Invite",
    invited: "Invite sent.",
    followers: "Followers",
    engagement: "Engagement",
    cancel: "Cancel",
  },
};

const txt = {
  el: {
    title: "Καμπάνιες",
    subtitle: "Δημοσιεύστε καμπάνια με τίτλο, περιγραφή και budget — οι influencers κάνουν αίτηση ενδιαφέροντος.",
    new: "Νέα καμπάνια",
    edit: "Επεξεργασία",
    save: "Αποθήκευση",
    cancel: "Ακύρωση",
    delete: "Διαγραφή",
    list_title: "Οι καμπάνιες σας",
    empty: "Δεν έχετε καμπάνια ακόμα. Δημιουργήστε μία για να λάβετε αιτήσεις από influencers.",
    form_title: "Τίτλος",
    form_desc: "Περιγραφή",
    form_budget: "Budget (€)",
    form_category: "Κατηγορία",
    form_deliverables: "Παράδοση / deliverables (προαιρετικό)",
    form_deadline: "Προθεσμία (προαιρετικό)",
    form_status: "Κατάσταση",
    status_draft: "Πρόχειρο",
    status_open: "Ανοιχτή (δημόσια)",
    status_closed: "Κλειστή",
    applications: "Αιτήσεις",
    no_apps: "Καμία αίτηση ακόμα.",
    app_status: "Κατάσταση αίτησης",
    app_pending: "Εκκρεμεί",
    app_shortlisted: "Σε λίστα",
    app_rejected: "Απόρριψη",
    app_withdrawn: "Αποσύρθηκε",
    app_accepted: "Αποδεκτή",
    applications_heading: "Αιτήσεις",
    influencer: "Influencer",
    message: "Μήνυμα",
    btn_chat: "Μήνυμα",
    deliverable: "Παράδοση",
    deliverable_none: "—",
    deliverable_submitted: "Υποβλήθηκε",
    deliverable_approved: "Εγκρίθηκε",
    deliverable_changes: "Αλλαγές",
    approve_deliverable: "Έγκριση",
    request_changes: "Ζήτα αλλαγές",
    review_note_ph: "Σχόλιο για αλλαγές…",
    table_missing:
      "Η λειτουργία καμπανιών δεν είναι ενεργή στη βάση. Εκτελέστε το αρχείο docs/BRAND_CAMPAIGNS_SCHEMA.sql στο Supabase.",
  },
  en: {
    title: "Campaigns",
    subtitle: "Publish a campaign with title, description and budget — influencers can apply.",
    new: "New campaign",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    list_title: "Your campaigns",
    empty: "No campaigns yet. Create one to receive applications from influencers.",
    form_title: "Title",
    form_desc: "Description",
    form_budget: "Budget (€)",
    form_category: "Category",
    form_deliverables: "Deliverables (optional)",
    form_deadline: "Deadline (optional)",
    form_status: "Status",
    status_draft: "Draft",
    status_open: "Open (public)",
    status_closed: "Closed",
    applications: "Applications",
    no_apps: "No applications yet.",
    app_status: "Application status",
    app_pending: "Pending",
    app_shortlisted: "Shortlisted",
    app_rejected: "Rejected",
    app_withdrawn: "Withdrawn",
    app_accepted: "Accepted",
    applications_heading: "Applications",
    influencer: "Influencer",
    message: "Message",
    btn_chat: "Message",
    deliverable: "Deliverable",
    deliverable_none: "—",
    deliverable_submitted: "Submitted",
    deliverable_approved: "Approved",
    deliverable_changes: "Changes requested",
    approve_deliverable: "Approve",
    request_changes: "Request changes",
    review_note_ph: "Note for changes…",
    table_missing:
      "Campaigns are not enabled in the database. Run docs/BRAND_CAMPAIGNS_SCHEMA.sql in Supabase.",
  },
};

const emptyForm = () => ({
  title: "",
  description: "",
  budget: "",
  category: "",
  deliverables: "",
  deadline: "",
  starts_on: "",
  location: "",
  min_followers: "",
  platforms: [] as string[],
  compensation_type: "" as "" | "money" | "product" | "both",
  status: "draft" as "draft" | "open" | "closed",
});

function ymd(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function BrandCampaignsSection({
  brandId,
  lang,
  brandVerified,
  pendingApplicationsCount = 0,
  focusApplications = 0,
  onApplicationsUpdated,
  onOpenInfluencerMessage,
}: {
  brandId: string;
  lang: "el" | "en";
  brandVerified: boolean;
  pendingApplicationsCount?: number;
  focusApplications?: number;
  onApplicationsUpdated?: () => void;
  onOpenInfluencerMessage?: (p: { influencerId: string; displayName: string; conversationId?: string | null }) => void;
}) {
  const t = txt[lang];
  const x = extra[lang];
  const [rows, setRows] = useState<BrandCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaError, setSchemaError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [appsByCampaign, setAppsByCampaign] = useState<Record<string, ApplicationRow[]>>({});
  const [loadingApps, setLoadingApps] = useState<string | null>(null);
  const [editing, setEditing] = useState<BrandCampaignRow | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [invites, setInvites] = useState<InviteMatch[]>([]);
  const [inviteCampaignId, setInviteCampaignId] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setSchemaError(false);
    const { data, error } = await supabase
      .from("brand_campaigns")
      .select("*")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });
    if (error) {
      if (error.code === "42P01" || error.message?.includes("brand_campaigns")) setSchemaError(true);
      console.error(error);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data as BrandCampaignRow[]) || []);
    setLoading(false);
  }, [brandId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadApplications = useCallback(async (campaignId: string) => {
    setLoadingApps(campaignId);
    const full = await supabase
      .from("campaign_applications")
      .select(
        `id, campaign_id, influencer_id, message, status, created_at, proposed_price, work_links,
         deliverable_url, deliverable_note, deliverable_status, deliverable_review_note,
         influencers ( display_name, avatar_url, profile_slug, category, accounts, engagement_rate )`
      )
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });
    let data = full.data;
    let error = full.error;
    if (error && /column|schema cache/i.test(error.message)) {
      const basic = await supabase
        .from("campaign_applications")
        .select(
          `id, campaign_id, influencer_id, message, status, created_at,
           deliverable_url, deliverable_note, deliverable_status, deliverable_review_note,
           influencers ( display_name, avatar_url, profile_slug, category, accounts, engagement_rate )`
        )
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      data = basic.data as typeof data;
      error = basic.error;
    }
    if (!error && data) {
      const apps = data as unknown as ApplicationRow[];
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const ids = apps.map((app) => app.influencer_id).filter(Boolean);
        if (token && ids.length) {
          const priceRes = await fetch(`/api/influencers/commercial?ids=${encodeURIComponent(ids.join(","))}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (priceRes.ok) {
            const body = await priceRes.json();
            const payload = body?.data ?? body;
            const list = Array.isArray(payload) ? payload : payload ? [payload] : [];
            const rates = new Map<string, string>();
            for (const row of list) {
              if (row?.id && row.min_rate != null) rates.set(String(row.id), String(row.min_rate));
            }
            for (const app of apps) {
              if (app.influencers && rates.has(app.influencer_id)) {
                app.influencers.min_rate = rates.get(app.influencer_id) || null;
              }
            }
          }
        }
      } catch {
        /* prices are optional */
      }
      setAppsByCampaign((prev) => ({ ...prev, [campaignId]: apps }));
    }
    setLoadingApps(null);
  }, []);

  useEffect(() => {
    if (!focusApplications || !rows.length) return;
    const withApps = rows.find((row) => row.status !== "draft") || rows[0];
    if (!withApps) return;
    setExpandedId(withApps.id);
    void loadApplications(withApps.id);
  }, [focusApplications, rows, loadApplications]);

  const openNew = () => {
    setForm(emptyForm());
    setEditing("new");
  };

  const openEdit = (row: BrandCampaignRow) => {
    setForm({
      title: row.title,
      description: row.description,
      budget: String(row.budget ?? ""),
      category: normalizeCategoryToken(row.category) || row.category || "",
      deliverables: row.deliverables || "",
      deadline: ymd(row.deadline),
      starts_on: ymd(row.starts_on),
      location: row.location || "",
      min_followers: row.min_followers != null ? String(row.min_followers) : "",
      platforms: Array.isArray(row.platforms) ? row.platforms : [],
      compensation_type: row.compensation_type || "",
      status: row.status,
    });
    setEditing(row);
  };

  const togglePlatform = (id: string) => {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(id) ? prev.platforms.filter((p) => p !== id) : [...prev.platforms, id],
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    if (!form.category) {
      toastError(lang === "el" ? "Η κατηγορία είναι υποχρεωτική." : "Category is required.");
      return;
    }
    if (!form.platforms.length) {
      toastError(lang === "el" ? "Επιλέξτε τουλάχιστον μία πλατφόρμα." : "Pick at least one platform.");
      return;
    }
    if (!form.compensation_type) {
      toastError(lang === "el" ? "Επιλέξτε τύπο αμοιβής." : "Pick a compensation type.");
      return;
    }
    if (!form.starts_on || !/^\d{4}-\d{2}-\d{2}$/.test(form.starts_on)) {
      toastError(lang === "el" ? "Συμπληρώστε ημερομηνία έναρξης (ηη/μμ/εεεε)." : "Enter a start date (dd/mm/yyyy).");
      return;
    }
    const needsMoney = form.compensation_type === "money" || form.compensation_type === "both";
    if (needsMoney && !(parseFloat(form.budget) > 0)) {
      toastError(lang === "el" ? "Το budget είναι υποχρεωτικό για χρηματική αμοιβή." : "Budget is required for paid work.");
      return;
    }
    if (form.deadline) {
      if (form.deadline <= form.starts_on) {
        toastError(x.deadline_after_start);
        return;
      }
    }
    if (form.status === "open" && !brandVerified) {
      toastError(x.open_locked);
      return;
    }
    const wasOpen = editing !== "new" && editing && "status" in editing && editing.status === "open";
    if (form.status === "open" && !wasOpen) {
      const ok = await askConfirm({
        title: x.publish_title,
        body: x.publish_body,
        confirmLabel: x.publish_ok,
        cancelLabel: x.cancel,
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim(),
        budget: Math.max(0, parseFloat(form.budget) || 0),
        category: normalizeCategoryToken(form.category) || form.category,
        deliverables: form.deliverables.trim() || null,
        status: form.status,
        deadline: form.deadline ? new Date(`${form.deadline}T12:00:00`).toISOString() : null,
        starts_on: form.starts_on,
        location: form.location.trim() || null,
        min_followers: form.min_followers ? Math.max(0, parseInt(form.min_followers, 10) || 0) : null,
        platforms: form.platforms,
        compensation_type: form.compensation_type,
        updated_at: new Date().toISOString(),
      };
      const shouldNotify = brandVerified && payload.status === "open" && !wasOpen;
      let campaignId: string | null = null;
      const write = async (body: Record<string, unknown>) => {
        if (editing === "new") {
          return supabase.from("brand_campaigns").insert({ brand_id: brandId, ...body }).select("id").single();
        }
        if (editing && "id" in editing) {
          return supabase.from("brand_campaigns").update(body).eq("id", editing.id).eq("brand_id", brandId).select("id").single();
        }
        return { data: null, error: { message: "Nothing to save" } };
      };
      let result = await write(payload);
      if (result.error && /column|schema cache|compensation|platforms|starts_on|min_followers/i.test(result.error.message)) {
        toastError(x.migration);
        const { starts_on, location, min_followers, platforms, compensation_type, ...legacy } = payload;
        void starts_on;
        void location;
        void min_followers;
        void platforms;
        void compensation_type;
        result = await write(legacy);
      }
      if (result.error) {
        const message = /only_verified|policy|row-level/i.test(result.error.message) ? x.open_locked : result.error.message;
        throw new Error(message);
      }
      campaignId = result.data?.id || (editing && typeof editing !== "string" ? editing.id : null);
      if (shouldNotify && campaignId) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.access_token) {
          await fetch("/api/push/campaign-published", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({ campaignId }),
          }).catch(() => undefined);
          const matchRes = await sessionFetch(`/api/campaigns/matches?campaignId=${campaignId}`);
          if (matchRes.ok) {
            const body = await matchRes.json();
            setInvites(Array.isArray(body.matches) ? body.matches : []);
            setInviteCampaignId(campaignId);
          }
        }
        toastSuccess(x.published);
      } else if (form.status === "draft") {
        toastSuccess(x.draft_saved);
      } else {
        toastSuccess(x.saved);
      }
      setEditing(null);
      await load();
      onApplicationsUpdated?.();
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: BrandCampaignRow) => {
    const { count } = await supabase
      .from("campaign_applications")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", row.id)
      .neq("status", "withdrawn");
    const ok = await askConfirm({
      title: x.delete_title,
      body: (count ?? 0) > 0 ? `${x.delete_with_apps} (${count})` : x.delete_plain,
      confirmLabel: t.delete,
      cancelLabel: x.cancel,
      danger: true,
    });
    if (!ok) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      toastError("Unauthorized");
      return;
    }
    const res = await fetch("/api/campaigns/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ campaignId: row.id }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toastError(body.error || "Error");
      return;
    }
    toastSuccess(x.deleted);
    if (expandedId === row.id) setExpandedId(null);
    await load();
    onApplicationsUpdated?.();
  };

  const updateAppStatus = async (app: ApplicationRow, status: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    const res = await fetch("/api/campaigns/application", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ applicationId: app.id, status }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toastError(body.error || "Error");
      return;
    }
    toastSuccess(status === "accepted" ? x.accepted : x.status_updated);
    if (expandedId) await loadApplications(expandedId);
    onApplicationsUpdated?.();
    if (status === "accepted") {
      onOpenInfluencerMessage?.({
        influencerId: app.influencer_id,
        displayName: app.influencers?.display_name || "Influencer",
        conversationId: body.conversationId || null,
      });
    }
  };

  const reviewDeliverable = async (appId: string, next: "approved" | "changes_requested", note?: string) => {
    const { error } = await supabase
      .from("campaign_applications")
      .update({
        deliverable_status: next,
        deliverable_review_note: note?.trim() || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", appId);
    if (error) {
      toastError(error.message);
      return;
    }
    toastSuccess(x.status_updated);
    if (expandedId) await loadApplications(expandedId);
  };

  const invite = async (match: InviteMatch) => {
    if (!inviteCampaignId) return;
    const campaign = rows.find((row) => row.id === inviteCampaignId);
    setInvitingId(String(match.id));
    try {
      const budget = Math.max(1, Number(campaign?.budget) || 0);
      const res = await sessionFetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          influencerId: match.id,
          serviceType: `Καμπάνια: ${campaign?.title || ""}`.slice(0, 120),
          budget,
          message:
            lang === "el"
              ? `Θα θέλαμε να σας προσκαλέσουμε στην καμπάνια «${campaign?.title || ""}».`
              : `We would like to invite you to the campaign “${campaign?.title || ""}”.`,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Error");
      toastSuccess(x.invited);
      setInvites((prev) => prev.filter((row) => row.id !== match.id));
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "Error");
    } finally {
      setInvitingId(null);
    }
  };

  const deliverableLabel = (status?: string | null) => {
    if (status === "submitted") return t.deliverable_submitted;
    if (status === "approved") return t.deliverable_approved;
    if (status === "changes_requested") return t.deliverable_changes;
    return t.deliverable_none;
  };

  if (schemaError) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 text-sm">{t.table_missing}</div>;
  }

  const req = <span className="text-red-600"> *</span>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900">{t.title}</h2>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <span className="text-slate-500">·</span>
              {t.applications_heading}
              {pendingApplicationsCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold">
                  {pendingApplicationsCount > 99 ? "99+" : pendingApplicationsCount}
                </span>
              )}
            </span>
          </div>
          <p className="text-slate-600 text-sm mt-1 max-w-2xl">{t.subtitle}</p>
          <Link href={lang === "en" ? "/en/campaigns" : "/campaigns"} className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
            {lang === "el" ? "→ Δημόσια προβολή καμπανιών" : "→ Public campaigns page"}
          </Link>
        </div>
        <button type="button" onClick={openNew} className="shrink-0 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
          {t.new}
        </button>
      </div>

      {editing && (
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
          <h3 className="font-semibold text-slate-900">{editing === "new" ? t.new : t.edit}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.form_title}{req}</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.form_desc}{req}</label>
              <textarea required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
            </div>
            <div className="sm:col-span-2">
              <p className="block text-sm font-medium text-slate-700 mb-2">{x.form_platforms}{req}</p>
              <div className="flex flex-wrap gap-3">
                {PLATFORMS.map((platform) => (
                  <label key={platform.id} className="inline-flex items-center gap-2 text-sm text-slate-800">
                    <input type="checkbox" checked={form.platforms.includes(platform.id)} onChange={() => togglePlatform(platform.id)} />
                    {lang === "el" ? platform.el : platform.en}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{x.form_compensation}{req}</label>
              <select required value={form.compensation_type} onChange={(e) => setForm({ ...form, compensation_type: e.target.value as typeof form.compensation_type })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white">
                <option value="">—</option>
                <option value="money">{x.comp_money}</option>
                <option value="product">{x.comp_product}</option>
                <option value="both">{x.comp_both}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.form_budget}
                {(form.compensation_type === "money" || form.compensation_type === "both") && req}
              </label>
              <input type="number" min={0} step={0.01} required={form.compensation_type === "money" || form.compensation_type === "both"} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.form_category}{req}</label>
              <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white">
                <option value="">—</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{categoryLabel(c, lang)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{x.form_min_followers}</label>
              <input type="number" min={0} value={form.min_followers} onChange={(e) => setForm({ ...form, min_followers: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{x.form_location}</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" placeholder={lang === "el" ? "π.χ. Αθήνα" : "e.g. Athens"} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{x.form_start}{req}</label>
              <DmyDateField required value={form.starts_on} onChange={(starts_on) => setForm({ ...form, starts_on })} />
              <p className="text-xs text-slate-500 mt-1">{x.date_order}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.form_deadline}</label>
              <DmyDateField value={form.deadline} onChange={(deadline) => setForm({ ...form, deadline })} />
              <p className="text-xs text-slate-500 mt-1">{x.deadline_after_start}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.form_status}</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
              >
                <option value="draft">{t.status_draft}</option>
                <option value="open" disabled={!brandVerified}>{t.status_open}</option>
                <option value="closed">{t.status_closed}</option>
              </select>
              {!brandVerified && <p className="text-xs text-amber-800 mt-1">{x.open_locked}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.form_deliverables}</label>
              <textarea rows={2} value={form.deliverables} onChange={(e) => setForm({ ...form, deliverables: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" placeholder={lang === "el" ? "π.χ. 2 Reels + 1 Story" : "e.g. 2 Reels + 1 Story"} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "…" : t.save}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700">{t.cancel}</button>
          </div>
        </form>
      )}

      {invites.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="font-semibold text-slate-900">{x.invites_title}</h3>
          <p className="text-sm text-slate-600 mt-1">{x.invites_body}</p>
          <ul className="mt-3 space-y-2">
            {invites.map((match) => (
              <li key={match.id} className="bg-white rounded-lg border border-blue-100 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <CreatorPhoto src={match.avatar_url} name={match.display_name} className="w-12 h-12" rounded="rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{match.display_name}</p>
                  <PlatformFollowers accounts={match.accounts} lang={lang} />
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{match.reasons[0]}</p>
                </div>
                <button type="button" disabled={invitingId === String(match.id)} onClick={() => invite(match)} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-50">
                  {x.invite}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium text-slate-900 mb-3">{t.list_title}</h3>
        {loading ? (
          <div className="space-y-3">
            <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl p-8 text-center">{t.empty}</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.id} className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                <div className="p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-slate-900">{row.title}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${row.status === "open" ? "bg-green-100 text-green-800" : row.status === "closed" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-900"}`}>
                        {row.status === "open" ? t.status_open : row.status === "closed" ? t.status_closed : t.status_draft}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">{row.description}</p>
                    <p className="text-sm text-slate-800 mt-2">
                      <strong>€{Number(row.budget).toLocaleString(lang === "el" ? "el-GR" : "en-GB")}</strong>
                      {row.category ? ` · ${categoryLabel(row.category, lang)}` : ""}
                      {row.compensation_type ? ` · ${row.compensation_type === "money" ? x.comp_money : row.compensation_type === "product" ? x.comp_product : x.comp_both}` : ""}
                    </p>
                    {row.status === "open" && (
                      <Link href={`/campaigns/${row.id}`} className="inline-block mt-2 text-sm text-blue-600 hover:underline">
                        {x.public_page}
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setExpandedId(expandedId === row.id ? null : row.id); if (expandedId !== row.id) void loadApplications(row.id); }} className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
                      {t.applications}
                    </button>
                    <button type="button" onClick={() => openEdit(row)} className="text-sm px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50">{t.edit}</button>
                    <button type="button" onClick={() => remove(row)} className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50">{t.delete}</button>
                  </div>
                </div>
                {expandedId === row.id && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4">
                    {loadingApps === row.id ? (
                      <div className="h-16 rounded-lg bg-slate-200 animate-pulse" />
                    ) : (appsByCampaign[row.id]?.length ?? 0) === 0 ? (
                      <p className="text-sm text-slate-500">{t.no_apps}</p>
                    ) : (
                      <div className="space-y-3">
                        {(appsByCampaign[row.id] || []).map((app) => {
                          const inf = app.influencers;
                          const engagement =
                            inf?.engagement_rate && typeof inf.engagement_rate === "object"
                              ? Object.entries(inf.engagement_rate as Record<string, string>).map(([k, v]) => `${k.slice(0, 2).toUpperCase()} ${v}`).join(" · ")
                              : inf?.engagement_rate ? String(inf.engagement_rate) : "";
                          return (
                            <article key={app.id} className="bg-white border border-slate-200 rounded-lg p-3">
                              <div className="flex gap-3">
                                <CreatorPhoto src={inf?.avatar_url} name={inf?.display_name || "Creator"} className="w-14 h-14" rounded="rounded-full" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <InfluencerPresenceDot influencerId={app.influencer_id} lang={lang} />
                                    <p className="font-medium text-slate-900">{inf?.display_name || app.influencer_id}</p>
                                    <Link href={publicProfilePath(inf?.profile_slug, app.influencer_id)} className="text-xs text-blue-600 hover:underline">{x.profile}</Link>
                                  </div>
                                  <PlatformFollowers accounts={inf?.accounts} lang={lang} className="mt-1" />
                                  <p className="text-xs text-slate-600 mt-1">
                                    {engagement ? `${x.engagement}: ${engagement}` : ""}
                                    {inf?.min_rate ? ` · ${x.rate}: ${inf.min_rate}` : ""}
                                    {inf?.category ? ` · ${categoryLabel(inf.category, lang) || inf.category}` : ""}
                                  </p>
                                  {app.proposed_price != null && <p className="text-xs text-slate-700 mt-1">{x.proposed}: €{app.proposed_price}</p>}
                                  {app.work_links && <p className="text-xs text-blue-700 mt-1 break-all">{x.work}: {app.work_links}</p>}
                                  <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{app.message || "—"}</p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {app.status === "withdrawn" ? (
                                  <span className="text-xs text-slate-500">{t.app_withdrawn}</span>
                                ) : app.status === "accepted" ? (
                                  <span className="text-xs font-medium text-emerald-700">{t.app_accepted}</span>
                                ) : (
                                  <>
                                    <select value={app.status === "accepted" ? "pending" : app.status} onChange={(e) => updateAppStatus(app, e.target.value)} className="text-xs border border-slate-300 rounded px-2 py-1 bg-white" aria-label={t.app_status}>
                                      <option value="pending">{t.app_pending}</option>
                                      <option value="shortlisted">{t.app_shortlisted}</option>
                                      <option value="rejected">{t.app_rejected}</option>
                                    </select>
                                    <button type="button" onClick={() => updateAppStatus(app, "accepted")} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium">{x.accept}</button>
                                  </>
                                )}
                                <button type="button" onClick={() => onOpenInfluencerMessage?.({ influencerId: app.influencer_id, displayName: inf?.display_name || "Influencer" })} className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium">
                                  {t.btn_chat}
                                </button>
                                <span className="text-xs text-slate-500">{deliverableLabel(app.deliverable_status)}</span>
                                {app.deliverable_status === "submitted" && (
                                  <>
                                    <button type="button" onClick={() => reviewDeliverable(app.id, "approved")} className="text-[11px] px-2 py-1 rounded bg-emerald-600 text-white">{t.approve_deliverable}</button>
                                    <button type="button" onClick={() => { const note = window.prompt(t.review_note_ph) || ""; void reviewDeliverable(app.id, "changes_requested", note); }} className="text-[11px] px-2 py-1 rounded border border-amber-300 text-amber-800 bg-amber-50">{t.request_changes}</button>
                                  </>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
