"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { sessionFetch } from "@/lib/sessionFetch";
import { formatEuroAmount } from "@/lib/formatEuro";
import InfluencerPresenceDot from "@/components/InfluencerPresenceDot";
import CreatorPhoto from "@/components/CreatorPhoto";
import PlatformFollowers from "@/components/PlatformFollowers";
import DmyDateField from "@/components/DmyDateField";
import { askConfirm, toastError, toastSuccess } from "@/components/Feedback";
import { CATEGORIES, categoryLabel, normalizeCategoryToken } from "@/lib/categories";
import { publicProfilePath } from "@/lib/profileSlug";
import { mergeApplicantProfile } from "@/lib/applicantProfile";
import { findContactInfo, filterWorkLinks } from "@/lib/contactFilter";
import CampaignCard from "@/components/CampaignCard";
import CampaignCover from "@/components/CampaignCover";
import { prepareCampaignCover } from "@/lib/prepareCampaignCover";
import { displayNameForLang } from "@/lib/greeklish";
import { SECTION_TITLE_CLASS } from "@/lib/sectionTitle";
import { formatDate } from "@/lib/formatDateTime";
import { isTimeoutError, withTimeout } from "@/lib/withTimeout";

const CONTACT_BLOCKED: { el: string; en: string } = {
  el: "Για την ασφάλειά σας δεν επιτρέπονται links, email ή τηλέφωνα. Η επικοινωνία γίνεται μέσα από το Influo.",
  en: "For your safety, links, emails and phone numbers aren't allowed. Communication happens inside Influo.",
};

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
  opened_at?: string | null;
  updated_at: string;
  platforms?: string[] | null;
  min_followers?: number | null;
  location?: string | null;
  starts_on?: string | null;
  compensation_type?: "money" | "product" | "both" | null;
  cover_url?: string | null;
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

type LangPair = { el: string; en: string };

function publishFollowUp(campaignId: string, token: string, onMatches: (matches: InviteMatch[]) => void): Promise<void> {
  const notify = fetch("/api/push/campaign-published", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ campaignId }),
    signal: AbortSignal.timeout(12000),
  })
    .then(() => undefined)
    .catch((err) => {
      console.error("[campaign publish] notify", err);
    });
  const matches = sessionFetch(`/api/campaigns/matches?campaignId=${encodeURIComponent(campaignId)}`, {
    signal: AbortSignal.timeout(12000),
  })
    .then(async (matchRes) => {
      if (!matchRes.ok) return;
      const body = await matchRes.json();
      onMatches(Array.isArray(body.matches) ? body.matches : []);
    })
    .catch((err) => {
      console.error("[campaign publish] matches", err);
    });
  return Promise.all([notify, matches]).then(() => undefined);
}

function langPack<K extends string>(rows: Record<K, LangPair>) {
  const pack = { el: {} as Record<K, string>, en: {} as Record<K, string> };
  for (const key of Object.keys(rows) as K[]) {
    pack.el[key] = rows[key].el;
    pack.en[key] = rows[key].en;
  }
  return pack;
}

const extra = langPack({
  required: { el: "υποχρεωτικό", en: "required" },
  form_platforms: { el: "Πλατφόρμες", en: "Platforms" },
  form_min_followers: { el: "Ελάχιστοι ακόλουθοι", en: "Minimum followers" },
  form_location: { el: "Περιοχή", en: "Area" },
  form_start: { el: "Ημερομηνία έναρξης", en: "Start date" },
  form_compensation: { el: "Αμοιβή", en: "Compensation" },
  comp_money: { el: "Χρήματα", en: "Money" },
  comp_product: { el: "Προϊόν", en: "Product" },
  comp_both: { el: "Χρήματα και προϊόν", en: "Money and product" },
  date_order: { el: "Ημερομηνία με σειρά ημέρα / μήνας / έτος.", en: "Enter the date as day / month / year." },
  deadline_after_start: { el: "Η προθεσμία πρέπει να είναι μετά την ημερομηνία έναρξης.", en: "The deadline must be after the start date." },
  deadline_auto_close: {
    el: "Αν δεν ορίσετε προθεσμία, η καμπάνια κλείνει αυτόματα σε 30 μέρες.",
    en: "If you do not set a deadline, the campaign closes automatically after 30 days.",
  },
  deadline_cleared_on_open: {
    el: "Η παλιά προθεσμία είχε περάσει, οπότε η καμπάνια άνοιξε για 30 μέρες. Μπορείτε να ορίσετε νέα προθεσμία από την επεξεργασία.",
    en: "The old deadline had passed, so the campaign reopened for 30 days. You can set a new deadline by editing it.",
  },
  contact_hint: {
    el: "Για την ασφάλειά σας δεν επιτρέπονται links, email ή τηλέφωνα. Η επικοινωνία γίνεται μέσα από το Influo.",
    en: "For your safety, links, emails and phone numbers aren't allowed. Communication happens inside Influo.",
  },
  draft_saved: { el: "Αποθηκεύτηκε ως πρόχειρο. Το βλέπει μόνο η επιχείρησή σας.", en: "Saved as a draft. Only your company can see it." },
  saved: { el: "Η καμπάνια αποθηκεύτηκε.", en: "Campaign saved." },
  publish_title: { el: "Δημοσίευση", en: "Publish" },
  publish_body: {
    el: "Η καμπάνια θα είναι ορατή σε εγκεκριμένους influencers και στη δημόσια σελίδα καμπανιών. Συνέχεια;",
    en: "Approved influencers and anyone with the public link will be able to see this campaign. Continue?",
  },
  publish_ok: { el: "Δημοσίευση", en: "Publish" },
  published: { el: "Η καμπάνια είναι πλέον ανοιχτή.", en: "The campaign is now open." },
  delete_title: { el: "Διαγραφή καμπάνιας", en: "Delete campaign" },
  delete_plain: { el: "Να διαγραφεί αυτή η καμπάνια;", en: "Delete this campaign?" },
  delete_with_apps: {
    el: "Υπάρχουν αιτήσεις. Οι creators θα ενημερωθούν ότι η καμπάνια αφαιρέθηκε και οι αιτήσεις τους δεν θα είναι πλέον ενεργές.",
    en: "This campaign has applications. Creators will be told it was removed and their applications will no longer be active.",
  },
  deleted: { el: "Η καμπάνια διαγράφηκε.", en: "Campaign deleted." },
  status_updated: { el: "Η κατάσταση της αίτησης ενημερώθηκε.", en: "Application status updated." },
  accepted: { el: "Η αίτηση έγινε αποδεκτή. Άνοιξε η συνομιλία και δημιουργήθηκε συμφωνία.", en: "Application accepted. A message thread and an agreement were opened." },
  unverified_card_title: { el: "Επαλήθευση σε αναμονή", en: "Verification pending" },
  unverified_card_body: {
    el: "Μπορείτε να ετοιμάσετε καμπάνιες ως Πρόχειρο. Η δημοσίευση (Ανοιχτή) ξεκλειδώνει μετά την έγκριση, συνήθως εντός 1–2 εργάσιμων ημερών.",
    en: "You can prepare campaigns as drafts. Publishing (Open) unlocks after approval, usually within 1–2 business days.",
  },
  verified_card_title: { el: "Η επιχείρηση είναι επαληθευμένη", en: "Your company is verified" },
  verified_card_body: { el: "Μπορείτε να δημοσιεύετε καμπάνιες δημόσια.", en: "You can publish campaigns publicly." },
  open_locked: { el: "Η κατάσταση «Ανοιχτή» είναι διαθέσιμη μετά την επαλήθευση.", en: "Open status is available after verification." },
  migration: { el: "Χρειάζεται το docs/CAMPAIGN_WORKFLOW_2026.sql στο Supabase για τα νέα πεδία.", en: "Run docs/CAMPAIGN_WORKFLOW_2026.sql in Supabase for the new fields." },
  public_page: { el: "Δημόσια σελίδα", en: "Public page" },
  card_start: { el: "Έναρξη", en: "Starts" },
  accept: { el: "Αποδοχή", en: "Accept" },
  profile: { el: "Προφίλ", en: "Profile" },
  rate: { el: "Ελάχιστη τιμή", en: "Min rate" },
  proposed: { el: "Προτεινόμενη τιμή", en: "Proposed price" },
  work: { el: "Δείγματα", en: "Past work" },
  invites_title: { el: "Προτάσεις για πρόσκληση", en: "Creators to invite" },
  invites_body: { el: "Εγκεκριμένοι creators που ταιριάζουν με την καμπάνια. Η πρόσκληση στέλνει πρόταση συνεργασίας.", en: "Approved creators who fit this campaign. Invite sends a collaboration proposal." },
  invite: { el: "Πρόσκληση", en: "Invite" },
  invited: { el: "Η πρόσκληση στάλθηκε.", en: "Invite sent." },
  followers: { el: "Ακόλουθοι", en: "Followers" },
  engagement: { el: "Engagement", en: "Engagement" },
  cancel: { el: "Ακύρωση", en: "Cancel" },
});

const txt = langPack({
  title: { el: "Καμπάνιες", en: "Campaigns" },
  subtitle: { el: "Δημοσιεύστε καμπάνια με τίτλο, περιγραφή και budget — οι influencers κάνουν αίτηση ενδιαφέροντος.", en: "Publish a campaign with title, description and budget — influencers can apply." },
  new: { el: "Νέα καμπάνια", en: "New campaign" },
  edit: { el: "Επεξεργασία", en: "Edit" },
  save: { el: "Αποθήκευση", en: "Save" },
  cancel: { el: "Ακύρωση", en: "Cancel" },
  delete: { el: "Διαγραφή", en: "Delete" },
  list_title: { el: "Οι καμπάνιες σας", en: "Your campaigns" },
  empty: { el: "Δεν έχετε καμπάνια ακόμα. Δημιουργήστε μία για να λάβετε αιτήσεις από influencers.", en: "No campaigns yet. Create one to receive applications from influencers." },
  empty_cta: { el: "Δημιούργησε την πρώτη σου καμπάνια", en: "Create your first campaign" },
  form_title: { el: "Τίτλος", en: "Title" },
  form_desc: { el: "Περιγραφή", en: "Description" },
  form_budget: { el: "Budget (€)", en: "Budget (€)" },
  form_category: { el: "Κατηγορία", en: "Category" },
  form_deliverables: { el: "Παράδοση / deliverables (προαιρετικό)", en: "Deliverables (optional)" },
  form_deadline: { el: "Προθεσμία (προαιρετικό)", en: "Deadline (optional)" },
  form_status: { el: "Κατάσταση", en: "Status" },
  status_draft: { el: "Πρόχειρο", en: "Draft" },
  status_open: { el: "Ανοιχτή (δημόσια)", en: "Open (public)" },
  status_closed: { el: "Κλειστή", en: "Closed" },
  applications: { el: "Αιτήσεις", en: "Applications" },
  no_apps: { el: "Καμία αίτηση ακόμα.", en: "No applications yet." },
  app_status: { el: "Κατάσταση αίτησης", en: "Application status" },
  app_pending: { el: "Εκκρεμεί", en: "Pending" },
  app_shortlisted: { el: "Σε λίστα", en: "Shortlisted" },
  app_rejected: { el: "Απόρριψη", en: "Rejected" },
  app_withdrawn: { el: "Αποσύρθηκε", en: "Withdrawn" },
  app_accepted: { el: "Αποδεκτή", en: "Accepted" },
  applications_heading: { el: "Αιτήσεις", en: "Applications" },
  influencer: { el: "Influencer", en: "Influencer" },
  message: { el: "Μήνυμα", en: "Message" },
  btn_chat: { el: "Μήνυμα", en: "Message" },
  deliverable: { el: "Παράδοση", en: "Deliverable" },
  deliverable_none: { el: "—", en: "—" },
  deliverable_submitted: { el: "Υποβλήθηκε", en: "Submitted" },
  deliverable_approved: { el: "Εγκρίθηκε", en: "Approved" },
  deliverable_changes: { el: "Αλλαγές", en: "Changes requested" },
  approve_deliverable: { el: "Έγκριση", en: "Approve" },
  request_changes: { el: "Ζήτα αλλαγές", en: "Request changes" },
  review_note_ph: { el: "Σχόλιο για αλλαγές…", en: "Note for changes…" },
  table_missing: {
    el: "Η λειτουργία καμπανιών δεν είναι ενεργή στη βάση. Εκτελέστε το αρχείο docs/BRAND_CAMPAIGNS_SCHEMA.sql στο Supabase.",
    en: "Campaigns are not enabled in the database. Run docs/BRAND_CAMPAIGNS_SCHEMA.sql in Supabase.",
  },
});

const wiz = langPack({
  step_of: { el: "Βήμα", en: "Step" },
  step1: { el: "Βασικά", en: "Basics" },
  step2: { el: "Παραδοτέα", en: "Deliverables" },
  step3: { el: "Στόχευση", en: "Targeting" },
  step4: { el: "Αμοιβή & έλεγχος", en: "Budget & review" },
  next: { el: "Επόμενο", en: "Next" },
  back: { el: "Πίσω", en: "Back" },
  cover_label: { el: "Εικόνα καμπάνιας (προαιρετικό)", en: "Campaign image (optional)" },
  cover_hint: {
    el: "Οι καμπάνιες με εικόνα παίρνουν περισσότερες αιτήσεις",
    en: "Campaigns with an image get more applications",
  },
  cover_choose: { el: "Επιλογή εικόνας", en: "Choose image" },
  cover_change: { el: "Αλλαγή", en: "Change" },
  cover_remove: { el: "Αφαίρεση", en: "Remove" },
  cover_uploading: { el: "Ανέβασμα…", en: "Uploading…" },
  cover_error: { el: "Δεν ήταν δυνατό το ανέβασμα της εικόνας. Δοκιμάστε άλλη εικόνα.", en: "Could not upload the image. Try a different one." },
  cover_not_image: { el: "Επιλέξτε αρχείο εικόνας (JPG, PNG ή WebP).", en: "Choose an image file (JPG, PNG or WebP)." },
  chips_label: { el: "Τι πρέπει να παραδώσει ο creator", en: "What the creator should deliver" },
  chips_hint: { el: "Πατήστε σε ένα είδος και ορίστε πόσα χρειάζεστε.", en: "Tap a type and set how many you need." },
  other_deliverables: { el: "Άλλα παραδοτέα / σημειώσεις (προαιρετικό)", en: "Other deliverables / notes (optional)" },
  review: { el: "Έλεγχος πριν την αποθήκευση", en: "Review before saving" },
  review_none: { el: "—", en: "—" },
  deliverables_short: { el: "Παραδοτέα", en: "Deliverables" },
});

const DELIVERABLE_CHIPS = [
  { id: "reel", platform: "instagram", el: "Reel", en: "Reel", one: "Reel", many: "Reels" },
  { id: "story", platform: "instagram", el: "Story", en: "Story", one: "Story", many: "Stories" },
  { id: "post", platform: "instagram", el: "Post", en: "Post", one: "Post", many: "Posts" },
  { id: "tiktok", platform: "tiktok", el: "TikTok", en: "TikTok", one: "TikTok", many: "TikToks" },
  { id: "youtube", platform: "youtube", el: "YouTube", en: "YouTube", one: "YouTube", many: "YouTube" },
] as const;

const CHIP_PARSE = /^(\d{1,2})\s*[x×]?\s*(reels?|stor(?:y|ies)|posts?|tiktoks?|youtubes?)$/i;

function chipIdFromWord(word: string): string | null {
  const w = word.toLowerCase();
  if (w.startsWith("reel")) return "reel";
  if (w.startsWith("stor")) return "story";
  if (w.startsWith("post")) return "post";
  if (w.startsWith("tiktok")) return "tiktok";
  if (w.startsWith("youtube")) return "youtube";
  return null;
}

/** Split a stored deliverables string into chip counts + leftover free text (round-trips with buildDeliverables). */
function parseDeliverables(raw: string | null | undefined): { chips: Record<string, number>; rest: string } {
  const chips: Record<string, number> = {};
  const rest: string[] = [];
  const parts = (raw || "").split(/[\n,;+]+/).map((s) => s.trim()).filter(Boolean);
  let parsedAny = false;
  for (const part of parts) {
    const m = CHIP_PARSE.exec(part);
    const id = m ? chipIdFromWord(m[2]) : null;
    if (m && id) {
      chips[id] = (chips[id] || 0) + parseInt(m[1], 10);
      parsedAny = true;
    } else {
      rest.push(part);
    }
  }
  if (!parsedAny) return { chips: {}, rest: raw || "" };
  return { chips, rest: rest.join(", ") };
}

function buildDeliverables(chips: Record<string, number>, rest: string): string {
  const parts: string[] = [];
  for (const chip of DELIVERABLE_CHIPS) {
    const n = chips[chip.id] || 0;
    if (n > 0) parts.push(`${n} ${n === 1 ? chip.one : chip.many}`);
  }
  const free = rest.trim();
  if (free) parts.push(free);
  return parts.join(", ");
}

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
  cover_url: "",
  chips: {} as Record<string, number>,
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
  const wz = wiz[lang];
  const [rows, setRows] = useState<BrandCampaignRow[]>([]);
  const [appCounts, setAppCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"campaigns" | "applications">("campaigns");
  const [appsPanelLoading, setAppsPanelLoading] = useState(false);
  const [appsPanelError, setAppsPanelError] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [appsByCampaign, setAppsByCampaign] = useState<Record<string, ApplicationRow[]>>({});
  const [loadingApps, setLoadingApps] = useState<string | null>(null);
  const [editing, setEditing] = useState<BrandCampaignRow | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [form, setForm] = useState(emptyForm);
  const [contactFieldErrors, setContactFieldErrors] = useState<Partial<Record<"title" | "description" | "deliverables" | "location", string>>>({});
  const [invites, setInvites] = useState<InviteMatch[]>([]);
  const [inviteCampaignId, setInviteCampaignId] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [deadlineClearedNotice, setDeadlineClearedNotice] = useState(false);
  const [step, setStep] = useState(1);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setSchemaError(false);
    setLoadError(null);
    const baseColumns =
      "id, brand_id, title, description, budget, category, deliverables, status, deadline, created_at, opened_at, updated_at, platforms, min_followers, location, starts_on, compensation_type";
    const fetchRows = (columns: string) =>
      supabase
        .from("brand_campaigns")
        .select(columns)
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false });
    let data: unknown;
    let error: { code?: string; message?: string } | null = null;
    try {
      const first = await withTimeout(
        Promise.resolve(fetchRows(`${baseColumns}, cover_url`)) as Promise<{
          data: unknown;
          error: { code?: string; message?: string } | null;
        }>,
        20000
      );
      data = first.data;
      error = first.error;
    } catch (err) {
      setLoadError(
        isTimeoutError(err)
          ? (lang === "el" ? "Η φόρτωση άργησε." : "Loading took too long.")
          : (lang === "el" ? "Οι καμπάνιες δεν φορτώθηκαν." : "Campaigns could not be loaded.")
      );
      setRows([]);
      setLoading(false);
      return;
    }
    // cover_url column not migrated yet (docs/ADD_CAMPAIGN_COVER_URL.sql): retry without it.
    if (error && /cover_url/i.test(error.message || "")) {
      ({ data, error } = await fetchRows(baseColumns));
    }
    if (error) {
      if (error.code === "42P01" || error.message?.includes("brand_campaigns")) setSchemaError(true);
      else {
        setLoadError(lang === "el" ? "Οι καμπάνιες δεν φορτώθηκαν." : "Campaigns could not be loaded.");
      }
      console.error(error);
      setRows([]);
      setLoading(false);
      return;
    }
    const list = (data as unknown as BrandCampaignRow[]) || [];
    const counts: Record<string, number> = {};
    for (const row of list) counts[row.id] = 0;
    if (list.length) {
      const apps = await supabase
        .from("campaign_applications")
        .select("campaign_id, status")
        .in("campaign_id", list.map((row) => row.id));
      if (!apps.error && apps.data) {
        for (const app of apps.data) {
          if (app.status === "withdrawn") continue;
          const campaignId = String(app.campaign_id);
          counts[campaignId] = (counts[campaignId] || 0) + 1;
        }
      }
    }
    setRows(list);
    setAppCounts(counts);
    setLoading(false);
  }, [brandId, lang]);

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
      const ids = [...new Set(apps.map((app) => app.influencer_id).filter(Boolean))];
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("influencers")
          .select("id, display_name, avatar_url, profile_slug, category, accounts, engagement_rate")
          .in("id", ids);
        const byId = new Map((profiles || []).map((row) => [String(row.id), row]));
        for (const app of apps) {
          const merged = mergeApplicantProfile(app.influencers, byId.get(app.influencer_id));
          if (merged) app.influencers = { ...merged, min_rate: app.influencers?.min_rate ?? null };
        }
      }
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const priceIds = apps.map((app) => app.influencer_id).filter(Boolean);
        if (token && priceIds.length) {
          const priceRes = await fetch(`/api/influencers/commercial?ids=${encodeURIComponent(priceIds.join(","))}`, {
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
    if (!focusApplications) return;
    setPanel("applications");
  }, [focusApplications]);

  const campaignKey = rows.map((row) => row.id).join(",");
  const loadApplicationPanel = useCallback(async () => {
    if (!rows.length) {
      setAppsPanelError(null);
      return;
    }
    setAppsPanelLoading(true);
    setAppsPanelError(null);
    try {
      await withTimeout(Promise.all(rows.map((row) => loadApplications(row.id))), 20000);
    } catch (err) {
      setAppsPanelError(
        isTimeoutError(err)
          ? (lang === "el" ? "Η φόρτωση άργησε." : "Loading took too long.")
          : (lang === "el" ? "Οι αιτήσεις δεν φορτώθηκαν." : "Applications could not be loaded.")
      );
    } finally {
      setAppsPanelLoading(false);
    }
  }, [rows, loadApplications, lang]);

  useEffect(() => {
    if (panel !== "applications") return;
    void loadApplicationPanel();
  }, [panel, campaignKey, loadApplicationPanel]);

  const openNew = () => {
    setForm(emptyForm());
    setStep(1);
    setContactFieldErrors({});
    setEditing("new");
  };

  const openEdit = (row: BrandCampaignRow) => {
    const parsed = parseDeliverables(row.deliverables);
    const rowPlatforms = Array.isArray(row.platforms) ? row.platforms : [];
    const chipPlatforms = DELIVERABLE_CHIPS.filter((chip) => (parsed.chips[chip.id] || 0) > 0).map((chip) => chip.platform as string);
    setStep(1);
    setForm({
      title: row.title,
      description: row.description,
      budget: String(row.budget ?? ""),
      category: normalizeCategoryToken(row.category) || row.category || "",
      deliverables: parsed.rest,
      cover_url: row.cover_url || "",
      chips: parsed.chips,
      deadline: ymd(row.deadline),
      starts_on: ymd(row.starts_on),
      location: row.location || "",
      min_followers: row.min_followers != null ? String(row.min_followers) : "",
      platforms: [...new Set([...rowPlatforms, ...chipPlatforms])],
      compensation_type: row.compensation_type || "",
      status: row.status,
    });
    setContactFieldErrors({});
    setEditing(row);
  };

  const togglePlatform = (id: string) => {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(id) ? prev.platforms.filter((p) => p !== id) : [...prev.platforms, id],
    }));
  };

  const setChipCount = (chipId: string, count: number) => {
    const next = Math.max(0, Math.min(20, count));
    setForm((prev) => {
      const chips = { ...prev.chips };
      if (next > 0) chips[chipId] = next;
      else delete chips[chipId];
      const chip = DELIVERABLE_CHIPS.find((c) => c.id === chipId);
      let platforms = prev.platforms;
      if (chip) {
        const stillUsed = DELIVERABLE_CHIPS.some((c) => c.platform === chip.platform && (chips[c.id] || 0) > 0);
        if (stillUsed && !platforms.includes(chip.platform)) platforms = [...platforms, chip.platform];
        else if (!stillUsed && next === 0 && platforms.includes(chip.platform)) {
          platforms = platforms.filter((p) => p !== chip.platform);
        }
      }
      return { ...prev, chips, platforms };
    });
  };

  const handleCoverFile = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      toastError(wz.cover_not_image);
      return;
    }
    setCoverUploading(true);
    try {
      const prepared = await prepareCampaignCover(file);
      const rand = Math.random().toString(36).slice(2, 8);
      const path = `${brandId}/${Date.now()}-${rand}.${prepared.type === "image/webp" ? "webp" : "jpg"}`;
      const { error: uploadError } = await supabase.storage
        .from("campaign-covers")
        .upload(path, prepared, { cacheControl: "31536000", upsert: false, contentType: prepared.type });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from("campaign-covers").getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error("no-public-url");
      setForm((prev) => ({ ...prev, cover_url: pub.publicUrl }));
    } catch (err) {
      console.error("[campaign cover]", err);
      toastError(wz.cover_error);
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const goToStep = (next: number) => {
    setStep(Math.max(1, Math.min(4, next)));
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  /** Returns an error message for the given step, or null if it can proceed. */
  const validateStep = (n: number): string | null => {
    if (n === 1) {
      if (!form.title.trim() || !form.description.trim()) {
        return lang === "el" ? "Συμπληρώστε τίτλο και περιγραφή." : "Fill in the title and description.";
      }
      const blockedFields: Array<"title" | "description"> = ["title", "description"];
      for (const field of blockedFields) {
        if (form[field].trim() && findContactInfo(form[field])) {
          setContactFieldErrors((prev) => ({ ...prev, [field]: CONTACT_BLOCKED[lang] }));
          return CONTACT_BLOCKED[lang];
        }
      }
    }
    if (n === 2) {
      if (!form.platforms.length) return lang === "el" ? "Επιλέξτε τουλάχιστον μία πλατφόρμα." : "Pick at least one platform.";
      if (form.deliverables.trim() && findContactInfo(form.deliverables)) {
        setContactFieldErrors((prev) => ({ ...prev, deliverables: CONTACT_BLOCKED[lang] }));
        return CONTACT_BLOCKED[lang];
      }
    }
    if (n === 3) {
      if (!form.category) return lang === "el" ? "Η κατηγορία είναι υποχρεωτική." : "Category is required.";
      if (form.location.trim() && findContactInfo(form.location)) {
        setContactFieldErrors((prev) => ({ ...prev, location: CONTACT_BLOCKED[lang] }));
        return CONTACT_BLOCKED[lang];
      }
    }
    return null;
  };

  const goNext = () => {
    const problem = validateStep(step);
    if (problem) {
      toastError(problem);
      return;
    }
    goToStep(step + 1);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 4) {
      goNext();
      return;
    }
    if (saveLock.current) return;
    saveLock.current = true;
    try {
    await saveCampaign();
    } finally {
      saveLock.current = false;
    }
  };

  const saveCampaign = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      setStep(1);
      return;
    }
    const blockedMsg = CONTACT_BLOCKED[lang];
    const nextErrors: typeof contactFieldErrors = {};
    const textFields: Array<keyof typeof nextErrors> = ["title", "description", "deliverables", "location"];
    for (const field of textFields) {
      const value = form[field] || "";
      if (value.trim() && findContactInfo(value)) nextErrors[field] = blockedMsg;
    }
    setContactFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStep(nextErrors.title || nextErrors.description ? 1 : nextErrors.deliverables ? 2 : 3);
      toastError(blockedMsg);
      return;
    }
    if (!form.category) {
      setStep(3);
      toastError(lang === "el" ? "Η κατηγορία είναι υποχρεωτική." : "Category is required.");
      return;
    }
    if (!form.platforms.length) {
      setStep(2);
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
      const shouldNotify = brandVerified && form.status === "open" && !wasOpen;
      const saveBody: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim(),
        budget: form.budget,
        category: normalizeCategoryToken(form.category) || form.category,
        deliverables: buildDeliverables(form.chips, form.deliverables),
        status: form.status,
        deadline: form.deadline || null,
        starts_on: form.starts_on,
        location: form.location.trim(),
        min_followers: form.min_followers || null,
        platforms: form.platforms,
        compensation_type: form.compensation_type,
      };
      if (editing !== "new" && editing && "id" in editing) {
        saveBody.id = editing.id;
      }
      // Only send cover_url when it changed, so saving never touches a missing column unnecessarily.
      const originalCover = editing !== "new" && editing && "id" in editing ? editing.cover_url || "" : "";
      if (form.cover_url !== originalCover) saveBody.cover_url = form.cover_url || null;

      const res = await sessionFetch("/api/campaigns/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saveBody),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        deadlineCleared?: boolean;
        error?: string;
        message?: { el?: string; en?: string } | string;
        field?: string;
      };

      if (!res.ok) {
        if (data.error === "contact_info_not_allowed") {
          const blockedMsg =
            (typeof data.message === "object" && data.message?.[lang]) || CONTACT_BLOCKED[lang];
          if (data.field === "title" || data.field === "description" || data.field === "deliverables" || data.field === "location") {
            setContactFieldErrors({ [data.field]: blockedMsg });
            setStep(data.field === "title" || data.field === "description" ? 1 : data.field === "deliverables" ? 2 : 3);
          }
          throw new Error(blockedMsg);
        }
        if (data.error === "open_locked" || /only_verified|policy|row-level/i.test(String(data.error || ""))) {
          const msg =
            (typeof data.message === "object" && data.message?.[lang]) || x.open_locked;
          throw new Error(msg);
        }
        if (typeof data.message === "object" && data.message?.[lang]) {
          throw new Error(data.message[lang]!);
        }
        throw new Error(typeof data.message === "string" ? data.message : data.error || "Error");
      }

      const campaignId = data.id || (editing && typeof editing !== "string" ? editing.id : null);
      if (shouldNotify && campaignId) {
        toastSuccess(x.published);
        const publishedId = campaignId;
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          publishFollowUp(publishedId, token, (matches) => {
            setInvites(matches);
            setInviteCampaignId(publishedId);
          }).catch((err) => {
            console.error("[campaign publish] follow-up", err);
          });
        }
      } else if (form.status === "draft") {
        toastSuccess(x.draft_saved);
      } else {
        toastSuccess(x.saved);
      }
      setDeadlineClearedNotice(!!data.deadlineCleared);
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
        displayName: displayNameForLang(app.influencers?.display_name || "Influencer", lang),
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
          <div role="tablist" aria-label={t.title} className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              role="tab"
              aria-selected={panel === "campaigns"}
              onClick={() => setPanel("campaigns")}
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${
                panel === "campaigns" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {t.title}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={panel === "applications"}
              onClick={() => setPanel("applications")}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ${
                panel === "applications" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {t.applications_heading}
              {pendingApplicationsCount > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-bold ${panel === "applications" ? "bg-white text-slate-900" : "bg-amber-500 text-white"}`}>
                  {pendingApplicationsCount > 99 ? "99+" : pendingApplicationsCount}
                </span>
              )}
            </button>
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
        <form ref={formRef} onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-5 shadow-sm">
          <h3 className="font-semibold text-slate-900">{editing === "new" ? t.new : t.edit}</h3>

          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-2">
              <span>{wz.step_of} {step}/4 · {[wz.step1, wz.step2, wz.step3, wz.step4][step - 1]}</span>
            </div>
            <div
              className="h-2 rounded-full bg-slate-100 overflow-hidden"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={4}
              aria-valuenow={step}
              aria-label={`${wz.step_of} ${step}/4`}
            >
              <div className="h-full rounded-full bg-blue-600 transition-[width] duration-300" style={{ width: `${(step / 4) * 100}%` }} />
            </div>
            <ol className="mt-2 grid grid-cols-4 gap-1 text-[11px] sm:text-xs">
              {[wz.step1, wz.step2, wz.step3, wz.step4].map((label, index) => {
                const n = index + 1;
                const done = n < step;
                return (
                  <li key={n} className="min-w-0">
                    <button
                      type="button"
                      disabled={n >= step}
                      onClick={() => goToStep(n)}
                      className={`w-full truncate text-left ${n === step ? "font-semibold text-blue-700" : done ? "text-slate-700 hover:text-blue-700" : "text-slate-400"}`}
                    >
                      {n}. {label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          {step === 1 && (
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.form_title}{req}</label>
                <input required value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setContactFieldErrors((prev) => ({ ...prev, title: undefined })); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                <p className="text-xs text-slate-500 mt-1">{x.contact_hint}</p>
                {contactFieldErrors.title && <p className="text-xs text-red-600 mt-1">{contactFieldErrors.title}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{wz.cover_label}</label>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleCoverFile(e.target.files?.[0])}
                />
                {form.cover_url ? (
                  <div className="space-y-2">
                    <div className="max-w-md rounded-xl overflow-hidden border border-slate-200">
                      <CampaignCover coverUrl={form.cover_url} title={form.title || "Campaign"} category={form.category} platforms={form.platforms} aspect="16/9" sizes="448px" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" disabled={coverUploading} onClick={() => coverInputRef.current?.click()} className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                        {coverUploading ? wz.cover_uploading : wz.cover_change}
                      </button>
                      <button type="button" disabled={coverUploading} onClick={() => setForm({ ...form, cover_url: "" })} className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50">
                        {wz.cover_remove}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={coverUploading}
                    onClick={() => coverInputRef.current?.click()}
                    className="w-full max-w-md aspect-video rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-medium flex items-center justify-center disabled:opacity-60"
                  >
                    {coverUploading ? wz.cover_uploading : `+ ${wz.cover_choose}`}
                  </button>
                )}
                <p className="text-xs text-slate-500 mt-1">{wz.cover_hint}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t.form_desc}{req}</label>
                <textarea required rows={5} value={form.description} onChange={(e) => { setForm({ ...form, description: e.target.value }); setContactFieldErrors((prev) => ({ ...prev, description: undefined })); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" />
                <p className="text-xs text-slate-500 mt-1">{x.contact_hint}</p>
                {contactFieldErrors.description && <p className="text-xs text-red-600 mt-1">{contactFieldErrors.description}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4">
              <div>
                <p className="block text-sm font-medium text-slate-700">{wz.chips_label}</p>
                <p className="text-xs text-slate-500 mb-2">{wz.chips_hint}</p>
                <div className="flex flex-wrap gap-2">
                  {DELIVERABLE_CHIPS.map((chip) => {
                    const count = form.chips[chip.id] || 0;
                    const label = lang === "el" ? chip.el : chip.en;
                    return count > 0 ? (
                      <div key={chip.id} className="inline-flex items-center gap-1 rounded-full border border-blue-600 bg-blue-50 pl-3 pr-1 py-1 text-sm font-medium text-blue-800">
                        <span>{label}</span>
                        <button type="button" onClick={() => setChipCount(chip.id, count - 1)} className="w-6 h-6 rounded-full hover:bg-blue-100 leading-none" aria-label={`${label} −`}>−</button>
                        <span className="min-w-[1.25rem] text-center tabular-nums">{count}</span>
                        <button type="button" onClick={() => setChipCount(chip.id, count + 1)} className="w-6 h-6 rounded-full hover:bg-blue-100 leading-none" aria-label={`${label} +`}>+</button>
                      </div>
                    ) : (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setChipCount(chip.id, 1)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-blue-400 hover:bg-blue-50"
                      >
                        <span aria-hidden>+</span> {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">{wz.other_deliverables}</label>
                <textarea rows={2} value={form.deliverables} onChange={(e) => { setForm({ ...form, deliverables: e.target.value }); setContactFieldErrors((prev) => ({ ...prev, deliverables: undefined })); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" placeholder={lang === "el" ? "π.χ. unboxing βίντεο" : "e.g. unboxing video"} />
                <p className="text-xs text-slate-500 mt-1">{x.contact_hint}</p>
                {contactFieldErrors.deliverables && <p className="text-xs text-red-600 mt-1">{contactFieldErrors.deliverables}</p>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid sm:grid-cols-2 gap-4">
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
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">{x.form_location}</label>
                <input value={form.location} onChange={(e) => { setForm({ ...form, location: e.target.value }); setContactFieldErrors((prev) => ({ ...prev, location: undefined })); }} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" placeholder={lang === "el" ? "π.χ. Αθήνα" : "e.g. Athens"} />
                {contactFieldErrors.location && <p className="text-xs text-red-600 mt-1">{contactFieldErrors.location}</p>}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">{x.form_start}{req}</label>
                  <DmyDateField required value={form.starts_on} onChange={(starts_on) => setForm({ ...form, starts_on })} />
                  <p className="text-xs text-slate-500 mt-1">{x.date_order}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t.form_deadline}</label>
                  <DmyDateField value={form.deadline} onChange={(deadline) => setForm({ ...form, deadline })} />
                  <p className="text-xs text-slate-500 mt-1">{x.deadline_auto_close}</p>
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
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900 mb-2">{wz.review}</p>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-slate-500">{t.form_title}</dt>
                  <dd className="text-slate-900 truncate">{form.title || wz.review_none}</dd>
                  <dt className="text-slate-500">{t.form_category}</dt>
                  <dd className="text-slate-900">{form.category ? categoryLabel(form.category, lang) || form.category : wz.review_none}</dd>
                  <dt className="text-slate-500">{x.form_platforms}</dt>
                  <dd className="text-slate-900">{form.platforms.length ? form.platforms.map((id) => PLATFORMS.find((p) => p.id === id)?.[lang] || id).join(", ") : wz.review_none}</dd>
                  <dt className="text-slate-500">{wz.deliverables_short}</dt>
                  <dd className="text-slate-900">{buildDeliverables(form.chips, form.deliverables) || wz.review_none}</dd>
                  <dt className="text-slate-500">{x.form_min_followers}</dt>
                  <dd className="text-slate-900">{form.min_followers || wz.review_none}</dd>
                  <dt className="text-slate-500">{x.form_location}</dt>
                  <dd className="text-slate-900">{form.location || wz.review_none}</dd>
                </dl>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {step > 1 && (
              <button type="button" onClick={() => goToStep(step - 1)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50">
                {wz.back}
              </button>
            )}
            {step < 4 ? (
              <button key="next" type="button" onClick={goNext} disabled={coverUploading} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
                {wz.next}
              </button>
            ) : (
              <button key="save" type="submit" disabled={saving || coverUploading} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? "…" : t.save}
              </button>
            )}
            <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 sm:ml-auto">{t.cancel}</button>
          </div>
        </form>
      )}

      {deadlineClearedNotice && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3 items-start"
        >
          <p className="text-sm text-amber-950 flex-1 min-w-0 leading-relaxed">
            {x.deadline_cleared_on_open}
          </p>
          <button
            type="button"
            onClick={() => setDeadlineClearedNotice(false)}
            className="shrink-0 text-amber-800/80 hover:text-amber-950 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 rounded"
            aria-label={lang === "el" ? "Κλείσιμο" : "Dismiss"}
          >
            ✕
          </button>
        </div>
      )}

      {invites.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="font-semibold text-slate-900">{x.invites_title}</h3>
          <p className="text-sm text-slate-600 mt-1">{x.invites_body}</p>
          <ul className="mt-3 space-y-2">
            {invites.map((match) => (
              <li key={match.id} className="bg-white rounded-lg border border-blue-100 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <CreatorPhoto src={match.avatar_url} name={displayNameForLang(match.display_name, lang)} className="w-12 h-12" rounded="rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{displayNameForLang(match.display_name, lang)}</p>
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
        {loadError && !loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">{loadError}</p>
            <button type="button" onClick={() => void load()} className="mt-4 inline-flex min-h-11 items-center px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold">
              {lang === "el" ? "Δοκίμασε ξανά" : "Try again"}
            </button>
          </div>
        ) : panel === "applications" ? (
          <div>
            <h3 className="text-lg font-medium text-slate-900 mb-3">{t.applications_heading}</h3>
            {loading || appsPanelLoading ? (
              <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
            ) : appsPanelError ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="text-sm text-slate-600">{appsPanelError}</p>
                <button type="button" onClick={() => void loadApplicationPanel()} className="mt-4 inline-flex min-h-11 items-center px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold">
                  {lang === "el" ? "Δοκίμασε ξανά" : "Try again"}
                </button>
              </div>
            ) : rows.length === 0 ? (
              <div className="text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl p-8 text-center space-y-4">
                <p>{t.empty}</p>
                <button type="button" onClick={() => { setPanel("campaigns"); openNew(); }} className="inline-flex min-h-11 items-center px-5 rounded-lg bg-slate-900 text-white text-sm font-semibold">
                  {t.empty_cta}
                </button>
              </div>
            ) : rows.every((row) => (appsByCampaign[row.id]?.length ?? 0) === 0) ? (
              <div className="text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl p-8 text-center space-y-4">
                <p>{t.no_apps}</p>
                <button type="button" onClick={() => setPanel("campaigns")} className="inline-flex min-h-11 items-center px-5 rounded-lg bg-slate-900 text-white text-sm font-semibold">
                  {t.title}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {rows.map((row) => {
                  const apps = appsByCampaign[row.id] || [];
                  if (!apps.length) return null;
                  return (
                    <section key={row.id} className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-900">{row.title}</h4>
                      <ul className="space-y-2">
                        {apps.map((app) => (
                          <li key={app.id} className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-900">{displayNameForLang(app.influencers?.display_name || "Creator", lang)}</p>
                              <p className="text-xs text-slate-500 mt-1">{app.message || "—"}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => onOpenInfluencerMessage?.({ influencerId: app.influencer_id, displayName: displayNameForLang(app.influencers?.display_name || "Influencer", lang) })}
                              className="inline-flex min-h-11 items-center px-3 rounded-lg bg-blue-600 text-white text-sm font-medium"
                            >
                              {t.btn_chat}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
        <>
        <h3 className="text-lg font-medium text-slate-900 mb-3">{t.list_title}</h3>
        {loading ? (
          <div className="space-y-3">
            <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl p-8 text-center space-y-4">
            <p>{t.empty}</p>
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
            >
              {t.empty_cta}
            </button>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {rows.map((row) => (
              <li key={row.id} className="space-y-3">
                <CampaignCard
                  campaign={row}
                  lang={lang}
                  hideBrand
                  footer={
                    <div className="flex flex-col gap-3">
                      <p className="text-xs text-slate-600">
                        {[
                          row.starts_on ? `${x.card_start} ${formatDate(row.starts_on, lang)}` : "",
                          `${appCounts[row.id] ?? 0} ${t.applications}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {row.status === "open" && (
                        <Link href={`/campaigns/${row.id}`} className="inline-block text-sm text-blue-600 hover:underline">
                          {x.public_page}
                        </Link>
                      )}
                      <div className="relative z-10 flex flex-wrap gap-2">
                        <button type="button" onClick={() => { setExpandedId(expandedId === row.id ? null : row.id); if (expandedId !== row.id) void loadApplications(row.id); }} className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
                          {t.applications}
                        </button>
                        <button type="button" onClick={() => openEdit(row)} className="text-sm px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50">{t.edit}</button>
                        <button type="button" onClick={() => remove(row)} className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50">{t.delete}</button>
                      </div>
                    </div>
                  }
                />
                {expandedId === row.id && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                          const appStatusChip =
                            app.status === "accepted"
                              ? "bg-emerald-100 text-emerald-800"
                              : app.status === "rejected"
                                ? "bg-slate-200 text-slate-700"
                                : app.status === "shortlisted"
                                  ? "bg-blue-100 text-blue-800"
                                  : app.status === "withdrawn"
                                    ? "bg-slate-100 text-slate-500"
                                    : "bg-amber-100 text-amber-900";
                          const appStatusText =
                            app.status === "accepted"
                              ? t.app_accepted
                              : app.status === "rejected"
                                ? t.app_rejected
                                : app.status === "shortlisted"
                                  ? t.app_shortlisted
                                  : app.status === "withdrawn"
                                    ? t.app_withdrawn
                                    : t.app_pending;
                          return (
                            <article key={app.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex gap-3">
                                <CreatorPhoto src={inf?.avatar_url} name={displayNameForLang(inf?.display_name || "Creator", lang)} className="w-14 h-14" rounded="rounded-full" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <InfluencerPresenceDot influencerId={app.influencer_id} lang={lang} />
                                    <p className="font-medium text-slate-900">{inf?.display_name ? displayNameForLang(inf.display_name, lang) : app.influencer_id}</p>
                                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${appStatusChip}`}>{appStatusText}</span>
                                    <Link href={publicProfilePath(inf?.profile_slug, app.influencer_id)} className="text-xs text-blue-600 hover:underline">{x.profile}</Link>
                                  </div>
                                  <PlatformFollowers accounts={inf?.accounts} lang={lang} className="mt-1" showDeclared />
                                  <p className="text-xs text-slate-600 mt-1">
                                    {engagement ? `${x.engagement}: ${engagement}` : ""}
                                    {inf?.min_rate ? ` · ${x.rate}: ${inf.min_rate}` : ""}
                                    {inf?.category ? ` · ${categoryLabel(inf.category, lang) || inf.category}` : ""}
                                  </p>
                                  {app.proposed_price != null && <p className="text-xs text-slate-700 mt-1">{x.proposed}: {formatEuroAmount(app.proposed_price, lang)}</p>}
                                  {(() => {
                                    const allowed = filterWorkLinks(app.work_links || "").ok;
                                    if (!allowed.length) return null;
                                    return (
                                      <div className="mt-1 space-y-0.5">
                                        <p className="text-xs text-slate-600">{x.work}:</p>
                                        {allowed.map((url) => (
                                          <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-700 hover:underline break-all">
                                            {url}
                                          </a>
                                        ))}
                                      </div>
                                    );
                                  })()}
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
                                <button type="button" onClick={() => onOpenInfluencerMessage?.({ influencerId: app.influencer_id, displayName: displayNameForLang(inf?.display_name || "Influencer", lang) })} className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium">
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
        </>
        )}
      </div>
    </div>
  );
}
