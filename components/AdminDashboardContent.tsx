"use client";

import { Fragment, useEffect, useState, useRef } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  FileText,
  Home,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Newspaper,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient"; 
import Image from "next/image";
import { isDefinitelyVideo, isDefinitelyImage, detectProvider, getVideoEmbedApiUrl, isEmbeddableVideoUrl } from "@/lib/videoThumbnail";
import {
  FACEBOOK_VIDEO_LINK_ERROR,
  prepareVideosForSave,
} from "@/lib/videoLinks";
import {
  newVideoRowId,
  toVideoRows,
  useVideoPlayableChecks,
  videoRowsToUrls,
  type VideoRow,
} from "@/lib/useVideoPlayableChecks";
import VideoThumbnail from "./VideoThumbnail";
import SocialEmbedCard from "./SocialEmbedCard";
import { getStoredLanguage, setStoredLanguage } from "@/lib/language";
import { formatEuro, formatEuroAmount } from "@/lib/formatEuro";
import { categoryLabel, formatCategoryLabels, formatStoredCategories, parseStoredCategories } from "@/lib/categories";
import CategoryCheckboxList from "@/components/CategoryCheckboxList";
import { checkAuditprHealth, fetchAuditprOverridesForAccounts, type AccountFetchResult } from "@/lib/socialRefresh";
import { downloadSocialRefreshReportExcel } from "@/lib/socialRefreshReport";
import { getCachedImageUrl } from "@/lib/imageProxy";
import { prepareImageForStorage } from "@/lib/prepareImageForStorage";
import { normalizeGender } from "@/lib/gender";
import PushNotificationPrompt from "./PushNotificationPrompt";
import AdminInfluencerStatsTab from "./AdminInfluencerStatsTab";
import SocialRefreshLogsPanel from "./SocialRefreshLogsPanel";
import Avatar from "./Avatar";
import ToastViewport, { useToasts, type ToastTone } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { formatDate, formatTime } from "@/lib/formatDateTime";
import { isTimeoutError, withTimeout } from "@/lib/withTimeout";
import { isProtectedTestAccount } from "@/lib/protectedAccount";
import { AdminListSkeleton, AdminLoadError, AdminPager } from "@/components/admin/AdminListChrome";
import { formatChatDayLabel, sameChatDay } from "@/lib/chatTime";
import { logoutEverywhere } from "@/lib/authSession";
import {
  adminCampaignSeenKey,
  companySeenKey,
  conversationSeenKey,
  countUnseenIds,
  readIdList,
  readStamp,
  writeIdList,
  writeStamp,
} from "@/lib/dashboardBadges";
import { filterWorkLinks } from "@/lib/contactFilter";
import { BRAND_BIO_MAX, toPublicHttpsHref } from "@/lib/brandProfile";
import {
  BIRTH_DATE_MIN,
  athensTodayYmd,
  birthDateErrorText,
  validateBirthDate,
} from "@/lib/validateBirthDate";
import { MAX_ANNOUNCEMENT_SPECIFIC_RECIPIENTS } from "@/lib/announcementTargets";
import { normalizeYouTubeUsernameForSave } from "@/lib/youtubeHandle";
import AnnouncementRecipientMultiSelect from "@/components/AnnouncementRecipientMultiSelect";

const ADMIN_PAGE_SIZE = 20;
const LOAD_TIMEOUT_MS = 20000;

type LoadError = null | "error" | "timeout";

type PendingConfirm = {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
};

let adminNotify: (message: string, tone: ToastTone) => void = () => {};

function notify(message: string, tone?: ToastTone) {
  const resolved =
    tone ??
    (/σφάλμα|error|failed|απέτυχ|cannot|δεν συνδέ|δεν ανανεώ/i.test(message)
      ? "error"
      : /επιτυχ|saved|deleted|ολοκληρ|απεστάλ|διαγράφη|αποθηκεύ|εγκρίθ|verified|completed|done/i.test(message)
        ? "success"
        : "info");
  adminNotify(message, resolved);
}

function protectedDeleteMessage(lang: "el" | "en") {
  return { el: "Ο λογαριασμός test δεν διαγράφεται.", en: "The test account cannot be deleted." }[lang];
}

async function adminAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/** Pending deals badge: dismiss on tab open; only new pending ids show again after refresh. */
const ADMIN_SEEN_PENDING_PROPOSALS_KEY = "admin_seen_pending_proposal_ids";

function readSeenPendingProposalIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(ADMIN_SEEN_PENDING_PROPOSALS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

function writeSeenPendingProposalIds(ids: number[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_SEEN_PENDING_PROPOSALS_KEY, JSON.stringify([...new Set(ids)]));
}

function pendingProposalIds(list: { id: number; status: string }[]): number[] {
  return list.filter((p) => p.status === "pending").map((p) => p.id);
}

function countUnseenPendingProposals(list: { id: number; status: string }[]): number {
  const pending = pendingProposalIds(list);
  const seen = new Set(readSeenPendingProposalIds().filter((id) => pending.includes(id)));
  return pending.filter((id) => !seen.has(id)).length;
}

function markPendingProposalsSeen(list: { id: number; status: string }[]) {
  writeSeenPendingProposalIds(pendingProposalIds(list));
}

// --- LANGUAGES LIST ---
const LANGUAGES = [
  { code: "el", el: "Ελληνικά", en: "Greek" },
  { code: "en", el: "Αγγλικά", en: "English" },
  { code: "de", el: "Γερμανικά", en: "German" },
  { code: "fr", el: "Γαλλικά", en: "French" },
  { code: "es", el: "Ισπανικά", en: "Spanish" },
  { code: "it", el: "Ιταλικά", en: "Italian" },
  { code: "pt", el: "Πορτογαλικά", en: "Portuguese" },
  { code: "ru", el: "Ρωσικά", en: "Russian" },
  { code: "zh", el: "Κινεζικά", en: "Chinese" },
  { code: "ja", el: "Ιαπωνικά", en: "Japanese" },
  { code: "sq", el: "Αλβανικά", en: "Albanian" },
  { code: "bg", el: "Βουλγαρικά", en: "Bulgarian" },
  { code: "tr", el: "Τουρκικά", en: "Turkish" }
];

interface DbInfluencer {
  id: number;
  auth_user_id?: string | null; // UUID from auth.users(id) for announcements targeting
  profile_slug?: string | null;
  created_at: string;
  display_name: string;
  gender: string;
  contact_email: string;
  verified: boolean;
  approved?: boolean;
  analytics_verified?: boolean;
  accounts: { platform: string; username: string; followers: string }[] | null; 
  avatar_url: string | null;
  avg_likes: string | null; 
  location: string | null;
  followers_count: string | null; 
  insights_urls: string[] | null; 
  videos: string[] | null;
  video_thumbnails?: Record<string, string> | null; // JSONB mapping video URL -> thumbnail URL
  min_rate: string | null;
  languages: string | null;
  bio: string | null;
  bio_en: string | null; // English bio translation
  engagement_rate: string | null;
  audience_male_percent: number | null;
  audience_female_percent: number | null;
  audience_top_age: string | null;
  category?: string;
  birth_date?: string | null;
  /** Server-computed: approved row shares IG/TikTok username with another approved profile. */
  possible_duplicate?: boolean;
}

interface Proposal {
  id: number;
  created_at: string;
  brand_name: string;
  budget: string;
  service_type: string;
  status: string;
  influencer_id: number;
  influencer_name?: string;
  influencers?: { display_name: string } | Array<{ display_name: string }> | null;
}

interface Conversation {
  id: string;
  influencer_id: string;
  influencer_name: string;
  influencer_email: string;
  brand_email: string;
  brand_name: string | null;
  proposal_id: number | null;
  created_at: string;
  last_message_at: string;
  closed_at?: string | null;
}

interface MessageAttachment {
  url?: string;
  filename?: string;
  content_type?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: 'influencer' | 'brand';
  sender_name?: string;
  sender_role?: "creator" | "brand";
  content: string;
  attachments?: MessageAttachment[] | null;
  read: boolean;
  sent_via_email: boolean;
  created_at: string;
}

interface Brand {
  id: string;
  brand_name: string;
  contact_email: string;
  contact_person: string | null;
  website: string | null;
  industry: string | null;
  afm: string;
  logo_url: string | null;
  verified: boolean;
  created_at: string;
  bio?: string | null;
  instagram?: string | null;
  city?: string | null;
}

interface AdminCampaignApplication {
  id: string;
  campaign_id: string;
  influencer_id: string;
  status: string;
  message: string | null;
  proposed_price: number | null;
  work_links: string | null;
  created_at: string;
  influencers:
    | { display_name: string | null; avatar_url: string | null }
    | Array<{ display_name: string | null; avatar_url: string | null }>
    | null;
}

interface AdminBrandCampaignRow {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  budget: number;
  category: string | null;
  status: string;
  deadline: string | null;
  platforms?: string[] | string | null;
  compensation_type?: string | null;
  deliverables?: string | null;
  created_at: string;
  updated_at: string;
  applications?: AdminCampaignApplication[];
  applications_count?: number;
  brands:
    | { brand_name: string | null; contact_email: string | null; verified: boolean | null }
    | Array<{ brand_name: string | null; contact_email: string | null; verified: boolean | null }>
    | null;
}

function getApplicationInfluencerMeta(app: AdminCampaignApplication): {
  name: string;
  avatar: string | null;
} {
  const raw = app.influencers;
  const o = Array.isArray(raw) ? raw[0] : raw;
  return {
    name: o?.display_name?.trim() || app.influencer_id,
    avatar: o?.avatar_url || null,
  };
}

function getCampaignBrandMeta(row: AdminBrandCampaignRow): {
  name: string;
  email: string | null;
  verified: boolean;
} {
  const b = row.brands;
  if (!b) return { name: "—", email: null, verified: false };
  const o = Array.isArray(b) ? b[0] : b;
  return {
    name: o?.brand_name ?? "—",
    email: o?.contact_email ?? null,
    verified: !!o?.verified,
  };
}

interface BlogPost {
  slug: string;
  title: { el: string; en: string };
  excerpt: { el: string; en: string };
  date: string;
  category: { el: string; en: string };
  readTime: { el: string; en: string };
  image: string;
  content?: { el: string; en: string };
}

const t = {
  el: {
    title: "Πίνακας Διαχείρισης",
    sub: "Επισκόπηση & Διαχείριση",
    back: "Πίσω στο Site",
    logout: "Αποσύνδεση",
    users: "Συνολικοί Χρήστες",
    pending: "Εκκρεμούν",
    pending_brands: "Εκκρεμείς επιχειρήσεις",
    verified: "Εγκεκριμένοι",
    reach: "Απήχηση",
    pipeline: "Pipeline",
    tab_inf: "Δημιουργοί",
    tab_inf_analytics: "Στατιστικά",
    tab_deals: "Προτάσεις",
    tab_brands: "Επιχειρήσεις",
    tab_campaigns: "Καμπάνιες brands",
    tab_blog: "Blog",
    col_inf: "Δημιουργός",
    col_loc: "Τοποθεσία",
    col_status: "Status",
    col_act: "Ενέργειες",
    btn_approve: "Έγκριση",
    btn_unapprove: "Ακύρωση Έγκρισης",
    btn_verify_analytics: "Επαλήθευση Analytics",
    btn_unverify_analytics: "Ακύρωση Επαλήθευσης Analytics",
    btn_unverify: "Ανάκληση",
    approved: "Εγκεκριμένος",
    analytics_verified: "Επαληθευμένα Analytics",
    btn_delete: "Διαγραφή",
    sql_helper: "SQL Helper",
    export: "Export",
    search: "Αναζήτηση...",
    filter: "Φίλτρο",
    select_all: "Επιλογή όλων",
    bulk_approve: "Έγκριση επιλεγμένων",
    bulk_delete: "Διαγραφή επιλεγμένων",
    no_data: "Δεν υπάρχουν δεδομένα",
    modal_basic: "Βασικές Πληροφορίες",
    modal_insights: "Insights",
    modal_view: "Προβολή",
    modal_followers: "Followers",
    modal_minrate: "Ελάχιστη Χρέωση",
    modal_gender: "Φύλο",
    modal_bio: "Bio",
    modal_socials: "Socials",
    modal_screenshots: "Screenshots",
    edit: "Επεξεργασία",
    view: "Προβολή",
    email: "Email",
    created: "Ημερομηνία",
    category: "Κατηγορία",
    engagement: "Engagement",
    min_rate_label: "Min Rate",
    col_brand: "Επιχείρηση",
    col_bud: "Budget",
    col_srv: "Υπηρεσία",
    col_date: "Ημερομηνία",
    blog_add: "Νέο Άρθρο",
    blog_edit: "Επεξεργασία",
    blog_delete: "Διαγραφή",
    blog_title: "Τίτλος",
    blog_slug: "Slug",
    blog_category: "Κατηγορία",
    blog_date: "Ημερομηνία",
    blog_actions: "Ενέργειες",
    tab_announcements: "Ανακοινώσεις",
    tab_social_cron: "Social cron",
    ann_title: "Τίτλος",
    ann_body: "Κείμενο",
    ann_to_all: "Όλοι οι influencers",
    ann_to_one: "Συγκεκριμένος influencer",
    ann_to_all_brands: "Όλες οι επιχειρήσεις",
    ann_to_one_brand: "Συγκεκριμένη επιχείρηση",
    ann_send: "Αποστολή ανακοινώσεως",
    ann_sent: "Απεστάλη",
    refresh_social: "Ανανέωση Social",
    refresh_social_all: "Ανανέωση social stats για όλους",
    refresh_audit: "Ανανέωση AI",
    backfill_audit: "Backfill Gemini audit (μία φορά για όλους)",
    col_campaign_title: "Τίτλος καμπάνιας",
    col_campaign_status: "Κατάσταση",
    campaigns_schema_missing:
      "Ο πίνακας brand_campaigns δεν υπάρχει στη βάση. Εκτελέστε docs/BRAND_CAMPAIGNS_SCHEMA.sql στο Supabase.",
    campaigns_refresh: "Ανανέωση λίστας",
    campaign_delete_confirm:
      "Να διαγραφεί αυτή η καμπάνια και όλες οι σχετικές αιτήσεις influencers; Η ενέργεια δεν αναιρείται.",
    col_applications: "Αιτήσεις",
    apps_expand: "Εμφάνιση",
    apps_collapse: "Απόκρυψη",
    apps_none: "Καμία αίτηση ακόμα.",
    apps_proposed: "Προτεινόμενη τιμή",
    apps_message: "Μήνυμα",
    apps_links: "Work links",
    apps_status_pending: "Εκκρεμεί",
    apps_status_accepted: "Αποδεκτή",
    apps_status_rejected: "Απορρίφθηκε",
    apps_status_shortlisted: "Shortlist",
    apps_status_withdrawn: "Αποσύρθηκε",
  },
  en: {
    title: "Admin Dashboard",
    sub: "Overview & Management",
    back: "Back to Site",
    logout: "Logout",
    users: "Total Users",
    pending: "Pending",
    pending_brands: "Pending companies",
    verified: "Verified",
    reach: "Total Reach",
    pipeline: "Pipeline",
    tab_inf: "Influencers",
    tab_inf_analytics: "Analytics",
    tab_deals: "Proposals",
    tab_brands: "Companies",
    tab_blog: "Blog",
    col_inf: "Influencer",
    col_loc: "Location",
    col_status: "Status",
    col_act: "Actions",
    btn_approve: "Approve",
    btn_unapprove: "Unapprove",
    btn_verify_analytics: "Verify Analytics",
    btn_unverify_analytics: "Unverify Analytics",
    btn_unverify: "Unverify",
    approved: "Approved",
    analytics_verified: "Analytics Verified",
    btn_delete: "Delete",
    sql_helper: "SQL Helper",
    export: "Export",
    search: "Search...",
    filter: "Filter",
    select_all: "Select All",
    bulk_approve: "Approve Selected",
    bulk_delete: "Delete Selected",
    no_data: "No data available",
    modal_basic: "Basic Info",
    modal_insights: "Insights",
    modal_view: "View",
    modal_followers: "Followers",
    modal_minrate: "Min Rate",
    modal_gender: "Gender",
    modal_bio: "Bio",
    modal_socials: "Socials",
    modal_screenshots: "Screenshots",
    edit: "Edit",
    view: "View",
    email: "Email",
    created: "Created",
    category: "Category",
    engagement: "Engagement",
    min_rate_label: "Min Rate",
    col_brand: "Brand",
    col_bud: "Budget",
    col_srv: "Service",
    col_date: "Date",
    blog_add: "New Article",
    blog_edit: "Edit",
    blog_delete: "Delete",
    blog_title: "Title",
    blog_slug: "Slug",
    blog_category: "Category",
    blog_date: "Date",
    blog_actions: "Actions",
    tab_announcements: "Announcements",
    tab_social_cron: "Social cron",
    ann_title: "Title",
    ann_body: "Content",
    ann_to_all: "All influencers",
    ann_to_one: "Specific influencer",
    ann_to_all_brands: "All businesses",
    ann_to_one_brand: "Specific business",
    ann_send: "Send announcement",
    ann_sent: "Sent",
    refresh_social: "Refresh Social",
    refresh_social_all: "Refresh social stats for all",
    refresh_audit: "Refresh AI",
    backfill_audit: "Backfill Gemini audit (once for all)",
    tab_campaigns: "Brand campaigns",
    col_campaign_title: "Campaign title",
    col_campaign_status: "Status",
    campaigns_schema_missing:
      "The brand_campaigns table is missing. Run docs/BRAND_CAMPAIGNS_SCHEMA.sql in Supabase.",
    campaigns_refresh: "Refresh list",
    campaign_delete_confirm:
      "Delete this campaign and all related influencer applications? This cannot be undone.",
    col_applications: "Applications",
    apps_expand: "Show",
    apps_collapse: "Hide",
    apps_none: "No applications yet.",
    apps_proposed: "Proposed price",
    apps_message: "Message",
    apps_links: "Work links",
    apps_status_pending: "Pending",
    apps_status_accepted: "Accepted",
    apps_status_rejected: "Rejected",
    apps_status_shortlisted: "Shortlisted",
    apps_status_withdrawn: "Withdrawn",
  },
};

// Edit Brand Modal Component
const EditBrandModal = ({ brand, onClose, onSave, lang }: { brand: Brand, onClose: () => void, onSave: (updatedBrand: Partial<Brand> & { clearFields?: string[] }) => Promise<void>, lang: "el" | "en" }) => {
  const [brandName, setBrandName] = useState(brand.brand_name || '');
  const [contactPerson, setContactPerson] = useState(brand.contact_person || '');
  const [website, setWebsite] = useState(brand.website || '');
  const [instagram, setInstagram] = useState(brand.instagram || '');
  const [city, setCity] = useState(brand.city || '');
  const [bio, setBio] = useState(brand.bio || '');
  const [categories, setCategories] = useState<string[]>(parseStoredCategories(brand.industry || ''));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(brand.logo_url || null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    let logoUrl = brand.logo_url || null;
    
    // Upload new logo if selected
    if (logoFile) {
      setUploadingLogo(true);
      try {
        const preparedLogo = await prepareImageForStorage(logoFile, { maxSide: 640 });
        const safeTail = preparedLogo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `brand-${brand.id}-${Date.now()}-${safeTail}`;
        const filePath = fileName;

        // Delete old logo if exists
        if (brand.logo_url) {
          try {
            const urlParts = brand.logo_url.split('/');
            const oldFileName = urlParts[urlParts.length - 1];
            if (oldFileName.startsWith('brand-')) {
              await supabase.storage.from('avatars').remove([oldFileName]);
            }
          } catch (deleteErr) {
            console.warn('Could not delete old logo:', deleteErr);
          }
        }

        // Upload new logo to avatars bucket
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, preparedLogo, { 
            cacheControl: '31536000',
            upsert: false 
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        logoUrl = publicUrl;
      } catch (err: any) {
        console.error('Error uploading logo:', err);
        notify(lang === 'el' ? `Σφάλμα κατά το ανέβασμα λογοτύπου: ${err.message}` : `Error uploading logo: ${err.message}`);
        setUploadingLogo(false);
        setSaving(false);
        return;
      } finally {
        setUploadingLogo(false);
      }
    } else if (!logoPreview && brand.logo_url) {
      // Remove logo if preview was cleared
      try {
        const urlParts = brand.logo_url.split('/');
        const oldFileName = urlParts[urlParts.length - 1];
        if (oldFileName.startsWith('brand-')) {
          await supabase.storage.from('avatars').remove([oldFileName]);
        }
        logoUrl = null;
      } catch (err) {
        console.error('Error removing logo:', err);
      }
    }

    const strEq = (a: unknown, b: unknown) => String(a ?? "") === String(b ?? "");
    const nextName = brandName.trim();
    const nextContact = contactPerson.trim() || null;
    const nextWebsite = website.trim() || null;
    const nextInstagram = instagram.trim() || null;
    const nextCity = city.trim() || null;
    const nextBio = bio.trim() || null;
    const nextIndustry = formatStoredCategories(categories) || null;
    const hasCity = Object.prototype.hasOwnProperty.call(brand, "city");
    const hasInstagram = Object.prototype.hasOwnProperty.call(brand, "instagram");

    const patch: Partial<Brand> & { clearFields?: string[] } = {};
    const clearFields: string[] = [];

    if (!strEq(nextName, brand.brand_name || "")) patch.brand_name = nextName;
    if (!strEq(nextContact, brand.contact_person || null)) patch.contact_person = nextContact;
    if (!strEq(nextIndustry, brand.industry || null)) patch.industry = nextIndustry;
    if (!strEq(logoUrl, brand.logo_url || null)) patch.logo_url = logoUrl;

    if (!strEq(nextBio, brand.bio || null)) {
      patch.bio = nextBio;
      if (!nextBio && (brand.bio || "").trim()) clearFields.push("bio");
    }
    if (!strEq(nextWebsite, brand.website || null)) {
      patch.website = nextWebsite;
      if (!nextWebsite && (brand.website || "").trim()) clearFields.push("website");
    }
    if (hasInstagram && !strEq(nextInstagram, brand.instagram || null)) {
      patch.instagram = nextInstagram;
      if (!nextInstagram && (brand.instagram || "").trim()) clearFields.push("instagram");
    }
    if (hasCity && !strEq(nextCity, brand.city || null)) {
      patch.city = nextCity;
      if (!nextCity && (brand.city || "").trim()) clearFields.push("city");
    }
    if (clearFields.length) patch.clearFields = clearFields;

    if (Object.keys(patch).filter((k) => k !== "clearFields").length === 0) {
      setSaving(false);
      onClose();
      return;
    }

    await onSave(patch);
    
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{lang === 'el' ? 'Επεξεργασία Επιχείρησης' : 'Edit Company'}</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Brand Name */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {lang === 'el' ? 'Όνομα Επιχείρησης' : 'Company Name'} *
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* Contact Person */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {lang === 'el' ? 'Υπεύθυνος Επικοινωνίας' : 'Contact Person'}
            </label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {lang === 'el' ? 'Email' : 'Email'}
            </label>
            <input
              type="email"
              value={brand.contact_email || ''}
              disabled
              className="w-full px-4 py-3 bg-slate-100 text-slate-600 border-2 border-slate-200 rounded-xl cursor-not-allowed"
            />
          </div>

          <CategoryCheckboxList
            lang={lang}
            selected={categories}
            onChange={setCategories}
            label={lang === 'el' ? 'Κατηγορίες' : 'Categories'}
            description={lang === 'el' ? 'Επιλέξτε μία ή περισσότερες κατηγορίες' : 'Select one or more categories'}
            compact
          />

          {/* Bio */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {lang === 'el' ? 'Λίγα λόγια για την επιχείρηση / το brand' : 'A few words about the business / brand'}
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, BRAND_BIO_MAX))}
              rows={4}
              maxLength={BRAND_BIO_MAX}
              placeholder={lang === 'el' ? 'Προαιρετική περιγραφή…' : 'Optional description…'}
              className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y"
            />
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'el'
                ? `Έως ${BRAND_BIO_MAX} χαρακτήρες. Χωρίς τηλέφωνα, email ή links. (${bio.length}/${BRAND_BIO_MAX})`
                : `Up to ${BRAND_BIO_MAX} characters. No phones, emails, or links. (${bio.length}/${BRAND_BIO_MAX})`}
            </p>
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {lang === 'el' ? 'Πόλη' : 'City'}
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={lang === 'el' ? 'π.χ. Αθήνα' : 'e.g. Athens'}
              className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {lang === 'el' ? 'Ιστοσελίδα' : 'Website'}
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'el' ? 'Μόνο έγκυρα https URLs.' : 'Valid https URLs only.'}
            </p>
          </div>

          {/* Instagram */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              Instagram
            </label>
            <input
              type="url"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="https://www.instagram.com/yourbrand"
              className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'el' ? 'Μόνο https URLs του instagram.com.' : 'https instagram.com URLs only.'}
            </p>
          </div>

          {/* Logo */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {lang === 'el' ? 'Λογότυπο' : 'Logo'}
            </label>
            {logoPreview && (
              <div className="mb-4 relative inline-block">
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="w-32 h-32 object-contain border-2 border-slate-200 rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
            >
              {lang === 'el' ? 'Ακύρωση' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving || uploadingLogo}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving || uploadingLogo 
                ? (lang === 'el' ? 'Αποθήκευση...' : 'Saving...')
                : (lang === 'el' ? 'Αποθήκευση' : 'Save')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditProfileModal = ({
    user,
    onClose,
    onSave,
    lang = "el",
}: {
    user: DbInfluencer;
    onClose: () => void;
    onSave: (updatedUser: DbInfluencer) => void;
    lang?: "el" | "en";
}) => {
    const L = (el: string, en: string) => (lang === "en" ? en : el);
    const [name, setName] = useState(user.display_name);
    const [contactEmail, setContactEmail] = useState(user.contact_email || "");
    const [bio, setBio] = useState(user.bio || "");
    const [bioEn, setBioEn] = useState(user.bio_en || "");
    const [location, setLocation] = useState(user.location || "");
    const [birthDate, setBirthDate] = useState(user.birth_date || "");
    const initialGender = normalizeGender(user.gender);
    const [gender, setGender] = useState(initialGender);
    const [profileChanges, setProfileChanges] = useState<any[]>([]);
    const [loadingChanges, setLoadingChanges] = useState(false);
    /** Fields that must not be overwritten unless the admin actually edited them. */
    const [touchedSensitive, setTouchedSensitive] = useState({
        bio: false,
        bio_en: false,
        videos: false,
        languages: false,
    });
    const markSensitiveTouched = (field: keyof typeof touchedSensitive) => {
        setTouchedSensitive((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
    };
    // Support multiple categories - parse comma-separated string or use single category
    const initialCategories = parseStoredCategories(user.category).length
        ? parseStoredCategories(user.category)
        : ["Lifestyle"];
    const [categories, setCategories] = useState<string[]>(initialCategories);
    // Parse languages from comma-separated string to array of language codes
    const parseLanguages = (langString: string | null): string[] => {
        if (!langString) return [];
        const langArray = langString.split(',').map(l => l.trim().toLowerCase());
        const codes: string[] = [];
        langArray.forEach(lang => {
            const foundLang = LANGUAGES.find(l => l.code === lang || l.el.toLowerCase() === lang || l.en.toLowerCase() === lang);
            if (foundLang) {
                codes.push(foundLang.code);
            } else {
                const partialMatch = LANGUAGES.find(l => 
                    l.el.toLowerCase().includes(lang) || 
                    l.en.toLowerCase().includes(lang) ||
                    lang.includes(l.el.toLowerCase()) ||
                    lang.includes(l.en.toLowerCase())
                );
                if (partialMatch) {
                    codes.push(partialMatch.code);
                }
            }
        });
        return codes;
    };
    const initialLanguages = parseLanguages(user.languages);
    const [selectedLanguages, setSelectedLanguages] = useState<string[]>(initialLanguages);
    const [accounts, setAccounts] = useState<{ platform: string; username: string; followers: string; engagement_rate?: string; avg_likes?: string }[]>(
        user.accounts && Array.isArray(user.accounts) && user.accounts.length > 0
            ? user.accounts.map((acc: any) => ({ ...acc, engagement_rate: acc.engagement_rate || "", avg_likes: acc.avg_likes || "" }))
            : [{ platform: "Instagram", username: "", followers: "", engagement_rate: "", avg_likes: "" }]
    );
    const [videoRows, setVideoRows] = useState<VideoRow[]>(() =>
      toVideoRows(Array.isArray(user.videos) && user.videos.length ? user.videos : [""])
    );
    const [videoThumbnails, setVideoThumbnails] = useState<Record<string, string | { url: string; width?: number; height?: number; type?: string }>>(user.video_thumbnails || {});
    const [thumbnailFiles, setThumbnailFiles] = useState<Record<string, File | null>>({}); // Store files to upload
    const [thumbnailPreviews, setThumbnailPreviews] = useState<Record<string, string>>({}); // Preview URLs
    const [fetchingThumbnails, setFetchingThumbnails] = useState<Record<string, boolean>>({}); // Track fetching state
    const [malePercent, setMalePercent] = useState(user.audience_male_percent?.toString() || "");
    const [femalePercent, setFemalePercent] = useState(user.audience_female_percent?.toString() || "");
    const [topAge, setTopAge] = useState(user.audience_top_age || "");
    const [loading, setLoading] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar_url || null);
    const handleAccountChange = (i: number, field: keyof typeof accounts[0], value: string) => {
        const copy = [...accounts]; 
        copy[i][field] = value; 
        setAccounts(copy);
    };
    const addAccount = () => setAccounts([...accounts, { platform: "Instagram", username: "", followers: "", engagement_rate: "", avg_likes: "" }]);
    const removeAccount = (i: number) => { 
        const copy = [...accounts]; 
        copy.splice(i, 1); 
        setAccounts(copy); 
    };

    const [videoLinkError, setVideoLinkError] = useState<string | null>(null);
    const existingVideos = Array.isArray(user.videos) ? user.videos : [];
    const {
        checkingById,
        errorById,
        isChecking: videosChecking,
        hasBlockingError: videosNotPlayable,
        checkingLabel,
        notPlayableMessage,
        runCheck,
        scheduleCheck,
        clearId,
        assertAllNewPlayable,
    } = useVideoPlayableChecks("el", existingVideos);

    useEffect(() => {
        if (!videosNotPlayable && !videosChecking && videoLinkError === notPlayableMessage) {
            setVideoLinkError(null);
        }
    }, [videosNotPlayable, videosChecking, videoLinkError, notPlayableMessage]);

    const handleVideoChange = (id: string, value: string) => {
        markSensitiveTouched("videos");
        setVideoLinkError(null);
        setVideoRows((rows) => {
            const prev = rows.find((r) => r.id === id);
            const oldUrl = prev?.url || "";
            if (oldUrl && oldUrl !== value && videoThumbnails[oldUrl]) {
                const newThumbnails = { ...videoThumbnails };
                delete newThumbnails[oldUrl];
                if (videoThumbnails[value]) {
                    setVideoThumbnails({ ...newThumbnails, [value]: videoThumbnails[value] });
                } else {
                    setVideoThumbnails(newThumbnails);
                }
            }
            return rows.map((r) => (r.id === id ? { ...r, url: value } : r));
        });
        if (!value.trim()) {
            clearId(id);
            return;
        }
        if (isEmbeddableVideoUrl(value) || isDefinitelyImage(value)) {
            scheduleCheck(id, value);
        } else {
            clearId(id);
        }
    };
    const handleVideoBlur = (id: string) => {
        void (async () => {
            const raw = videoRows.find((r) => r.id === id)?.url || "";
            if (!raw.trim()) {
                clearId(id);
                return;
            }
            const cleaned = await runCheck(id, raw);
            if (!cleaned.ok) {
                if (cleaned.reason === "facebook") {
                    setVideoLinkError(FACEBOOK_VIDEO_LINK_ERROR.el);
                    markSensitiveTouched("videos");
                    setVideoRows((rows) => {
                        const oldUrl = rows.find((r) => r.id === id)?.url || "";
                        if (oldUrl && videoThumbnails[oldUrl]) {
                            const newThumbnails = { ...videoThumbnails };
                            delete newThumbnails[oldUrl];
                            setVideoThumbnails(newThumbnails);
                        }
                        return rows.map((r) => (r.id === id ? { ...r, url: "" } : r));
                    });
                    clearId(id);
                }
                return;
            }
            setVideoLinkError(null);
            if (cleaned.url !== raw) {
                markSensitiveTouched("videos");
                setVideoRows((rows) => {
                    const oldUrl = rows.find((r) => r.id === id)?.url || "";
                    if (oldUrl && oldUrl !== cleaned.url && videoThumbnails[oldUrl]) {
                        const newThumbnails = { ...videoThumbnails };
                        const prevThumb = newThumbnails[oldUrl];
                        delete newThumbnails[oldUrl];
                        setVideoThumbnails({ ...newThumbnails, [cleaned.url]: prevThumb });
                    }
                    return rows.map((r) => (r.id === id ? { ...r, url: cleaned.url } : r));
                });
            }
        })();
    };
    
    const handleThumbnailChange = (videoUrl: string, thumbnailUrl: string) => {
        setVideoThumbnails({ ...videoThumbnails, [videoUrl]: thumbnailUrl });
        // Clear file if URL is set
        if (thumbnailUrl) {
            setThumbnailFiles({ ...thumbnailFiles, [videoUrl]: null });
            setThumbnailPreviews({ ...thumbnailPreviews, [videoUrl]: thumbnailUrl });
        }
    };
    
    const handleFetchFromIframely = async (videoUrl: string) => {
        if (!videoUrl) return;
        
        setFetchingThumbnails({ ...fetchingThumbnails, [videoUrl]: true });
        
        try {
            const response = await fetch('/api/video-thumbnail/cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    videoUrl, 
                    influencerId: user.id 
                })
            });
            
            const data = await response.json();
            
            if (data.success && data.thumbnail) {
                // Store the metadata object (with url, width, height, type)
                setVideoThumbnails({ ...videoThumbnails, [videoUrl]: data.thumbnail });
                setThumbnailPreviews({ ...thumbnailPreviews, [videoUrl]: data.thumbnail.url });
                
                // Clear file upload if we got data from Iframely
                setThumbnailFiles({ ...thumbnailFiles, [videoUrl]: null });
            } else {
                notify(data.error || 'Failed to fetch thumbnail from Iframely');
            }
        } catch (error: any) {
            console.error('Error fetching from Iframely:', error);
            notify('Error: ' + (error.message || 'Failed to fetch thumbnail'));
        } finally {
            setFetchingThumbnails({ ...fetchingThumbnails, [videoUrl]: false });
        }
    };
    
    const handleThumbnailFileChange = (videoUrl: string, file: File | null) => {
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                notify('Μόνο αρχεία εικόνας επιτρέπονται (JPG, PNG, etc.)');
                return;
            }
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                notify('Το αρχείο είναι πολύ μεγάλο. Μέγιστο μέγεθος: 5MB');
                return;
            }
            
            setThumbnailFiles({ ...thumbnailFiles, [videoUrl]: file });
            
            // Create preview
            const previewUrl = URL.createObjectURL(file);
            setThumbnailPreviews({ ...thumbnailPreviews, [videoUrl]: previewUrl });
            
            // Clear URL input if file is selected
            setVideoThumbnails({ ...videoThumbnails, [videoUrl]: '' });
        } else {
            setThumbnailFiles({ ...thumbnailFiles, [videoUrl]: null });
            const newPreviews = { ...thumbnailPreviews };
            delete newPreviews[videoUrl];
            setThumbnailPreviews(newPreviews);
        }
    };
    
    const removeThumbnail = (videoUrl: string) => {
        const newThumbnails = { ...videoThumbnails };
        delete newThumbnails[videoUrl];
        setVideoThumbnails(newThumbnails);
        
        const newFiles = { ...thumbnailFiles };
        delete newFiles[videoUrl];
        setThumbnailFiles(newFiles);
        
        const newPreviews = { ...thumbnailPreviews };
        if (newPreviews[videoUrl] && newPreviews[videoUrl].startsWith('blob:')) {
            URL.revokeObjectURL(newPreviews[videoUrl]);
        }
        delete newPreviews[videoUrl];
        setThumbnailPreviews(newPreviews);
    };

    // Fetch profile changes when modal opens
    useEffect(() => {
        const fetchChanges = async () => {
            setLoadingChanges(true);
            try {
                // Convert user.id to string (Supabase returns UUID as string, but TypeScript might think it's number)
                const influencerId = String(user.id);
                console.log('[Profile Changes] Fetching changes for influencer ID:', influencerId, '(type:', typeof user.id, ')');
                
                const response = await fetch(`/api/profile-changes?influencerId=${encodeURIComponent(influencerId)}&unreviewedOnly=true`, {
                    headers: await adminAuthHeaders(),
                });
                
                if (!response.ok) {
                    console.error('[Profile Changes] HTTP error:', response.status, response.statusText);
                    const errorText = await response.text();
                    console.error('[Profile Changes] Error response:', errorText);
                    setLoadingChanges(false);
                    return;
                }
                
                const data = await response.json();
                console.log('[Profile Changes] API Response:', data);
                
                if (data.success) {
                    const changes = data.data || [];
                    setProfileChanges(changes);
                    console.log('[Profile Changes] ✅ Found', changes.length, 'unreviewed changes');
                    if (changes.length === 0) {
                        console.log('[Profile Changes] ℹ️ No unreviewed changes found for this influencer');
                    }
                } else {
                    console.error('[Profile Changes] ❌ API error:', data.error);
                }
            } catch (error) {
                console.error('[Profile Changes] ❌ Exception:', error);
            } finally {
                setLoadingChanges(false);
            }
        };
        fetchChanges();
    }, [user.id]);

    // Mark changes as reviewed
    const markChangesAsReviewed = async (changeIds: string[]) => {
        try {
            const response = await fetch('/api/profile-changes', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
                body: JSON.stringify({ changeIds })
            });
            const data = await response.json();
            if (data.success) {
                // Remove reviewed changes from state
                setProfileChanges(prev => prev.filter(c => !changeIds.includes(c.id)));
            }
        } catch (error) {
            console.error('Error marking changes as reviewed:', error);
        }
    };

    // Helper function to format field values for display
    const formatFieldValue = (field: string, value: any): string => {
        if (value === null || value === undefined) return '(κενό)';
        if (field === 'accounts' || field === 'videos') {
            return Array.isArray(value) ? JSON.stringify(value, null, 2) : String(value);
        }
        return String(value);
    };

    // Helper function to get field label
    const getFieldLabel = (field: string): string => {
        const labels: Record<string, string> = {
            display_name: 'Όνομα',
            bio: 'Βιογραφικό',
            min_rate: 'Ελάχιστη Χρέωση',
            location: 'Τοποθεσία',
            engagement_rate: 'Engagement Rate',
            avg_likes: 'Μέσος Όρος Likes',
            category: 'Κατηγορία',
            languages: 'Γλώσσες',
            gender: 'Φύλο',
            accounts: 'Social Media Accounts',
            videos: 'Videos',
            avatar_url: 'Avatar',
            audience_male_percent: 'Άνδρες %',
            audience_female_percent: 'Γυναίκες %',
            audience_top_age: 'Κύρια Ηλικιακή Ομάδα',
            birth_date: 'Ημερομηνία Γέννησης'
        };
        return labels[field] || field;
    };
    
    const addVideo = () => {
        markSensitiveTouched("videos");
        setVideoRows((rows) => [...rows, { id: newVideoRowId(), url: "" }]);
    };
    const removeVideo = (id: string) => {
        markSensitiveTouched("videos");
        setVideoRows((rows) => {
            const videoUrl = rows.find((r) => r.id === id)?.url || "";
            if (videoUrl && videoThumbnails[videoUrl]) {
                const newThumbnails = { ...videoThumbnails };
                delete newThumbnails[videoUrl];
                setVideoThumbnails(newThumbnails);
            }
            if (rows.length <= 1) return [{ id: rows[0]?.id || newVideoRowId(), url: "" }];
            return rows.filter((r) => r.id !== id);
        });
        clearId(id);
        setVideoLinkError(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let avatarUrl = user.avatar_url || null;

            // Upload avatar if new file selected
            if (avatarFile) {
                const preparedAvatar = await prepareImageForStorage(avatarFile, {
                  maxSide: 640,
                  webpQuality: 0.72,
                  jpegQuality: 0.78,
                });
                const fileName = `avatar-${Date.now()}-${preparedAvatar.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, preparedAvatar, { cacheControl: '31536000', upsert: false });
                
                if (uploadError) {
                    throw uploadError;
                }
                
                const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
                avatarUrl = data.publicUrl;
            }

            // Upload thumbnail files and get their URLs
            const uploadedThumbnails = { ...videoThumbnails };
            for (const [videoUrl, file] of Object.entries(thumbnailFiles)) {
                if (file && videoUrl) {
                    try {
                        const preparedThumb = await prepareImageForStorage(file, { maxSide: 1280 });
                        const fileName = `thumbnails/${user.id}/${Date.now()}-${preparedThumb.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                        const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, preparedThumb, {
                            cacheControl: '31536000',
                            upsert: false
                        });
                        
                        if (uploadError) {
                            console.error(`Error uploading thumbnail for ${videoUrl}:`, uploadError);
                            // Continue with other uploads
                        } else {
                            const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
                            uploadedThumbnails[videoUrl] = data.publicUrl;
                        }
                    } catch (err) {
                        console.error(`Error uploading thumbnail for ${videoUrl}:`, err);
                    }
                }
            }
            
            // Clean up preview URLs
            Object.values(thumbnailPreviews).forEach(preview => {
                if (preview.startsWith('blob:')) {
                    URL.revokeObjectURL(preview);
                }
            });

            // Store categories as comma-separated string for backward compatibility
            const categoryString = formatStoredCategories(categories) || "Lifestyle";
            const nextLanguages = selectedLanguages.map(code => {
                const langItem = LANGUAGES.find(l => l.code === code);
                return langItem ? langItem.el : code;
            }).join(", ");
            const nextAccounts = (accounts || [])
                .filter(
                    (acc: { platform?: string }) => (acc.platform || '').toLowerCase() !== 'facebook'
                )
                .map((acc: { platform?: string; username?: string; [key: string]: unknown }) => {
                    if (String(acc.platform || '').toLowerCase() !== 'youtube') return acc;
                    const username = String(acc.username || '');
                    return {
                        ...acc,
                        username: normalizeYouTubeUsernameForSave(username),
                    };
                });
            const preparedVideos = prepareVideosForSave(videoRowsToUrls(videoRows));
            if (!preparedVideos.ok) {
                setVideoLinkError(FACEBOOK_VIDEO_LINK_ERROR.el);
                notify(FACEBOOK_VIDEO_LINK_ERROR.el);
                setLoading(false);
                return;
            }
            if (videosChecking || videosNotPlayable) {
                setVideoLinkError(notPlayableMessage);
                notify(notPlayableMessage);
                setLoading(false);
                return;
            }
            const playableOk = await assertAllNewPlayable(videoRows);
            if (!playableOk) {
                setVideoLinkError(notPlayableMessage);
                notify(notPlayableMessage);
                setLoading(false);
                return;
            }
            const nextVideos = preparedVideos.videos;
            const nextGender = normalizeGender(gender);
            const nextMale = parseInt(malePercent) || 0;
            const nextFemale = parseInt(femalePercent) || 0;
            const nextBirth = birthDate || null;
            const nextBioEn = bioEn || null;
            const nextContactEmail = contactEmail.trim();

            const jsonEq = (a: unknown, b: unknown) =>
                JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
            const strEq = (a: unknown, b: unknown) => String(a ?? '') === String(b ?? '');

            const updateData: Record<string, unknown> = {};
            let clearBio = false;

            const setIfChanged = (key: string, next: unknown, prev: unknown, asJson = false) => {
                const changed = asJson ? !jsonEq(next, prev) : !strEq(next, prev);
                if (changed) updateData[key] = next;
            };

            setIfChanged('display_name', name, user.display_name);
            setIfChanged('contact_email', nextContactEmail, user.contact_email || '');
            setIfChanged('location', location, user.location || '');
            setIfChanged('birth_date', nextBirth, user.birth_date || null);
            if ('birth_date' in updateData && updateData.birth_date != null && String(updateData.birth_date).trim() !== '') {
                const birthCheck = validateBirthDate(updateData.birth_date);
                if (!birthCheck.ok) {
                    const uiLang = getStoredLanguage() === 'en' ? 'en' : 'el';
                    notify(birthDateErrorText(birthCheck, uiLang));
                    setLoading(false);
                    return;
                }
                updateData.birth_date = birthCheck.normalized;
            }
            setIfChanged('gender', nextGender, normalizeGender(user.gender));
            setIfChanged('category', categoryString, user.category || '');
            setIfChanged('accounts', nextAccounts, user.accounts || [], true);
            setIfChanged('video_thumbnails', uploadedThumbnails, user.video_thumbnails || {}, true);
            setIfChanged('audience_male_percent', nextMale, user.audience_male_percent ?? 0);
            setIfChanged('audience_female_percent', nextFemale, user.audience_female_percent ?? 0);
            setIfChanged('audience_top_age', topAge, user.audience_top_age || '');

            // Never send bio / bio_en / videos / languages unless the admin touched them.
            if (touchedSensitive.bio && !strEq(bio, user.bio || '')) {
                updateData.bio = bio;
                if (!(bio || '').trim() && (user.bio || '').trim()) {
                    clearBio = true;
                }
            }
            if (touchedSensitive.bio_en && !strEq(nextBioEn, user.bio_en || null)) {
                updateData.bio_en = nextBioEn;
            }
            if (touchedSensitive.languages && !strEq(nextLanguages, user.languages || '')) {
                updateData.languages = nextLanguages;
            }
            if (touchedSensitive.videos && !jsonEq(nextVideos, user.videos || [])) {
                updateData.videos = nextVideos;
            }

            // Only update avatar_url if we have a new URL from upload
            if (avatarFile && avatarUrl) {
                updateData.avatar_url = avatarUrl;
            }

            if (Object.keys(updateData).length === 0) {
                setLoading(false);
                onClose();
                return;
            }

            const saveRes = await fetch('/api/admin/influencers/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
                body: JSON.stringify({
                    influencerId: String(user.id),
                    updates: updateData,
                    ...(clearBio ? { clearBio: true } : {}),
                }),
            });
            const saveJson = await saveRes.json().catch(() => ({}));

        setLoading(false);

        if (!saveRes.ok) {
            notify("Error saving: " + ((saveJson as { error?: string }).error || saveRes.statusText));
        } else {
            const payload = saveJson as { warning?: string; influencer?: DbInfluencer };
            if (payload.warning) {
                notify(payload.warning);
            }
            const data = payload.influencer;
            if (!data) {
                notify("Error saving: empty response");
            } else {
            // Refresh Gemini audit only when metrics or audit-relevant fields changed (followers, engagement_rate, avg_likes, bio, category)
            const prevAccounts = (user.accounts ?? []) as { followers?: string; engagement_rate?: string; avg_likes?: string }[];
            const metricsChanged =
              prevAccounts.length !== (accounts?.length ?? 0) ||
              (accounts ?? []).some(
                (b: { followers?: string; engagement_rate?: string; avg_likes?: string }, i: number) => {
                  const a = prevAccounts[i];
                  if (!a) return true;
                  return (a.followers ?? '') !== (b.followers ?? '') || (a.engagement_rate ?? '') !== (b.engagement_rate ?? '') || (a.avg_likes ?? '') !== (b.avg_likes ?? '');
                }
              );
            const bioOrCategoryChanged =
              (touchedSensitive.bio && (user.bio ?? '') !== (bio ?? '')) ||
              ('category' in updateData);
            if (metricsChanged || bioOrCategoryChanged) {
              try {
                const auditRes = await fetch('/api/admin/refresh-audit', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
                  body: JSON.stringify({ influencerId: user.id }),
                });
                const ct = auditRes.headers.get('content-type') ?? '';
                if (auditRes.ok && ct.includes('application/json')) {
                  const auditData = await auditRes.json();
                  if (auditData.auditpr_audit) {
                    (data as unknown as Record<string, unknown>).auditpr_audit = auditData.auditpr_audit;
                  }
                }
              } catch (_) {
                // Gemini unreachable – profile save still succeeded
              }
            }
            onSave(data as DbInfluencer);
            onClose();
            }
        }
        } catch (err: any) {
            setLoading(false);
            notify("Error saving: " + err.message);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">Edit Profile - {user.display_name}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                
                {/* Debug Info - Remove in production */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="px-6 py-2 bg-blue-50 border-b border-blue-200 text-xs">
                        <p><strong>Debug:</strong> User ID: {user.id} (type: {typeof user.id})</p>
                        <p>Loading: {loadingChanges ? 'Yes' : 'No'}, Changes: {profileChanges.length}</p>
                    </div>
                )}
                
                {/* Profile Changes Section */}
                {loadingChanges ? (
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                        <p className="text-sm text-slate-600">Φόρτωση αλλαγών...</p>
                    </div>
                ) : profileChanges.length > 0 ? (
                    <div className="px-6 py-4 bg-yellow-50 border-b border-yellow-200">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-yellow-900 flex items-center gap-2">
                                ⚠️ Αλλαγές που Αναμένουν Επανεξέταση ({profileChanges.length})
                            </h3>
                            <button
                                type="button"
                                onClick={() => markChangesAsReviewed(profileChanges.map(c => c.id))}
                                className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                            >
                                Σημάνω ως Εξετασμένα
                            </button>
                        </div>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                            {profileChanges.map((change, idx) => (
                                <div key={change.id} className="bg-white border border-yellow-300 rounded-lg p-3">
                                    <div className="text-xs text-yellow-700 mb-2">
                                        <strong>Ημερομηνία:</strong> {new Date(change.created_at).toLocaleString('el-GR')}
                                    </div>
                                    <div className="space-y-2">
                                        {change.changed_fields && change.changed_fields.map((field: string) => (
                                            <div key={field} className="border-l-4 border-yellow-500 pl-3 py-1">
                                                <div className="text-xs font-semibold text-slate-900 mb-1">
                                                    {getFieldLabel(field)}
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div>
                                                        <div className="text-slate-600 font-medium mb-1">Παλιά Τιμή:</div>
                                                        <div className="bg-red-50 border border-red-200 rounded p-2 text-slate-900 break-words max-h-32 overflow-y-auto">
                                                            {formatFieldValue(field, change.old_values?.[field])}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-slate-600 font-medium mb-1">Νέα Τιμή:</div>
                                                        <div className="bg-green-50 border border-green-200 rounded p-2 text-slate-900 break-words max-h-32 overflow-y-auto">
                                                            {formatFieldValue(field, change.new_values?.[field])}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
                
                <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                        {/* Avatar Upload */}
                        <div className="pb-4 border-b border-slate-200">
                            <label className="block text-sm font-semibold text-slate-900 mb-2">Φωτογραφία Προφίλ</label>
                            <div className="flex items-center gap-4">
                                <div className="relative w-20 h-20 rounded-full border-2 border-slate-300 overflow-hidden bg-slate-100">
                                    {avatarPreview ? (
                                        <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                            <span className="text-gray-500 text-xs font-medium">NO PHOTO</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                setAvatarFile(file);
                                                setAvatarPreview(URL.createObjectURL(file));
                                            }
                                        }}
                                        className="w-full text-sm text-slate-900"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF up to 5MB</p>
                                </div>
                            </div>
                        </div>

                        {/* Basic Info */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">{L("Βασικά Στοιχεία", "Basic Information")}</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">{L("Ονοματεπώνυμο", "Full Name")}</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">{L("Email", "Email")}</label>
                                    <input
                                        type="email"
                                        value={contactEmail}
                                        onChange={(e) => setContactEmail(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                                        placeholder="contact@example.com"
                                        autoComplete="email"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">{L("Τοποθεσία", "Location")}</label>
                                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">{L("Ημερομηνία Γέννησης", "Date of Birth")}</label>
                                    <input
                                        type="date"
                                        value={birthDate}
                                        onChange={e => setBirthDate(e.target.value)}
                                        min={BIRTH_DATE_MIN}
                                        max={athensTodayYmd()}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">{L("Η ηλικία υπολογίζεται από αυτή την ημερομηνία", "Age is calculated from this date")}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">{L("Φύλο", "Gender")}</label>
                                    <select value={gender} onChange={e => setGender(normalizeGender(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900">
                                        <option value="Female">{L("Γυναίκα", "Female")}</option>
                                        <option value="Male">{L("Άνδρας", "Male")}</option>
                                        <option value="AI">AI (Artificial Intelligence)</option>
                                    </select>
                                </div>
                                <CategoryCheckboxList
                                    lang={lang}
                                    selected={categories}
                                    onChange={setCategories}
                                    label={L("Κατηγορίες *", "Categories *")}
                                    description={L("Επιλέξτε μία ή περισσότερες κατηγορίες", "Select one or more categories")}
                                    emptyFallback="Lifestyle"
                                    compact
                                />
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">{L("Γλώσσες", "Languages")}</label>
                                    <div className="border-2 border-slate-200 rounded-lg p-3 bg-slate-50">
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                            {LANGUAGES.map(langItem => {
                                                const isSelected = selectedLanguages.includes(langItem.code);
                                                return (
                                                    <label 
                                                        key={langItem.code} 
                                                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
                                                            isSelected 
                                                                ? 'bg-blue-100 border-2 border-blue-500' 
                                                                : 'bg-white border-2 border-slate-200 hover:border-blue-300'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                markSensitiveTouched("languages");
                                                                if (e.target.checked) {
                                                                    setSelectedLanguages([...selectedLanguages, langItem.code]);
                                                                } else {
                                                                    setSelectedLanguages(selectedLanguages.filter(l => l !== langItem.code));
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-blue-600 border-2 border-slate-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                        <span className={`text-xs font-medium ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                                                            {lang === "en" ? langItem.en : langItem.el}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bio - Greek */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1">Bio (Ελληνικά)</label>
                            <textarea
                                value={bio}
                                onChange={e => {
                                    markSensitiveTouched("bio");
                                    setBio(e.target.value);
                                }}
                                rows={4}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900"
                                placeholder="Βιογραφία στα Ελληνικά..."
                            />
                        </div>

                        {/* Bio - English */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1">Bio (English / Αγγλικά)</label>
                            <textarea
                                value={bioEn}
                                onChange={e => {
                                    markSensitiveTouched("bio_en");
                                    setBioEn(e.target.value);
                                }}
                                rows={4}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-slate-900"
                                placeholder={L("Βιογραφία στα Αγγλικά...", "Biography in English...")}
                            />
                            <p className="text-xs text-slate-500 mt-1">{L("Αυτή η βιογραφία θα εμφανίζεται όταν ο χρήστης επιλέξει Αγγλικά ως γλώσσα", "This bio is shown when the visitor selects English")}</p>
                        </div>

                        {/* Social Accounts */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">{L("Κοινωνικοί Λογαριασμοί", "Social Accounts")}</h3>
                            {accounts.map((account, i) => (
                                <div key={i} className="flex gap-2 mb-3 items-end">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">{L("Πλατφόρμα", "Platform")}</label>
                                        <select value={account.platform} onChange={e => handleAccountChange(i, 'platform', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900">
                                            <option value="Instagram">Instagram</option>
                                            <option value="TikTok">TikTok</option>
                                            <option value="YouTube">YouTube</option>
                                            <option value="Twitter">Twitter/X</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">{L("Username", "Username")}</label>
                                        <input type="text" value={account.username} onChange={e => handleAccountChange(i, 'username', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" placeholder="username" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">{L("Followers", "Followers")}</label>
                                        <input type="text" value={account.followers} onChange={e => handleAccountChange(i, 'followers', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" placeholder="e.g. 15k" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">{L("Engagement Rate (%)", "Engagement Rate (%)")}</label>
                                        <input type="text" value={account.engagement_rate || ""} onChange={e => handleAccountChange(i, 'engagement_rate', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" placeholder="e.g. 5.5%" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">{L("Μέσα Likes", "Avg Likes")}</label>
                                        <input type="text" value={account.avg_likes || ""} onChange={e => handleAccountChange(i, 'avg_likes', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" placeholder="e.g. 3.2k" />
                                    </div>
                                    <button type="button" onClick={() => removeAccount(i)} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">✕</button>
                                </div>
                            ))}
                            <button type="button" onClick={addAccount} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm">{L("+ Προσθήκη λογαριασμού", "+ Add Account")}</button>
                        </div>

                        {/* Audience Data */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">{L("Δημογραφικά Κοινού", "Audience Demographics")}</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">{L("Άνδρες (%)", "Male (%)")}</label>
                                    <input type="number" value={malePercent} onChange={e => setMalePercent(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" min="0" max="100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">{L("Γυναίκες (%)", "Female (%)")}</label>
                                    <input type="number" value={femalePercent} onChange={e => setFemalePercent(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" min="0" max="100" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1">{L("Κύρια Ηλικιακή Ομάδα", "Top Age Group")}</label>
                                    <input 
                                        type="text" 
                                        value={topAge} 
                                        onChange={(e) => {
                                            let value = e.target.value;
                                            // Allow only numbers and dashes
                                            value = value.replace(/[^0-9-]/g, '');
                                            // Auto-add dash after 2 digits if not already present
                                            if (value.length === 2 && !value.includes('-')) {
                                                value = value + '-';
                                            }
                                            setTopAge(value);
                                        }}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900" 
                                        placeholder="e.g. 18-24" 
                                        maxLength={6}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Videos */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">Video Links / Φωτογραφίες</h3>
                            {videoRows.map((row) => {
                                const video = row.url;
                                const rejected = !!errorById[row.id];
                                const isVideo = isDefinitelyVideo(video);
                                const isImage = isDefinitelyImage(video);
                                const isInstagramPost = video && /instagram\.com\/(?:[A-Za-z0-9._]+\/)?p\//i.test(video);
                                const isTikTokPhoto = video && /tiktok\.com\/[^?\s]*\/photo\/\d+/i.test(video);
                                
                                // Helper to get thumbnail URL string from string or object
                                const getThumbnailUrl = (thumb: string | { url: string; width?: number; height?: number; type?: string } | undefined): string => {
                                    if (!thumb) return '';
                                    if (typeof thumb === 'string') return thumb;
                                    return thumb.url || '';
                                };
                                
                                const currentThumbnail = videoThumbnails[video];
                                const thumbnailUrlString = getThumbnailUrl(currentThumbnail);
                                
                                return (
                                    <div key={row.id} className="mb-3">
                                        <div className="flex gap-2 items-end">
                                            <div className="flex-1">
                                                <label className="block text-xs font-semibold text-slate-700 mb-1">Video/Photo URL</label>
                                                <input
                                                  type="url"
                                                  value={video}
                                                  onChange={e => handleVideoChange(row.id, e.target.value)}
                                                  onBlur={() => handleVideoBlur(row.id)}
                                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                                                  placeholder="https://..."
                                                  autoComplete="off"
                                                />
                                            </div>
                                            <button type="button" onClick={() => removeVideo(row.id)} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">✕</button>
                                        </div>
                                        {checkingById[row.id] ? (
                                          <p className="mt-2 text-sm text-slate-500">{checkingLabel}</p>
                                        ) : null}
                                        {errorById[row.id] ? (
                                          <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                            {errorById[row.id]}
                                          </p>
                                        ) : null}
                                        {!rejected && video && detectProvider(video) && !isDefinitelyImage(video) && !isEmbeddableVideoUrl(video) && (
                                          <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                            {{ el: "Αυτό είναι link προφίλ, όχι video. Βάλε link από συγκεκριμένο reel/video/post.", en: "This is a profile link, not a video. Paste a link to a specific reel/video/post." }.el}
                                          </p>
                                        )}
                                        {!rejected && video && (
                                            <>
                                                {/* Thumbnail Input Section */}
                                                <div className="mt-3 p-3 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
                                                    <label className="block text-xs font-semibold text-slate-700">
                                                        Thumbnail <span className="text-slate-400 font-normal">(Optional)</span>
                                                    </label>
                                                    
                                                    {/* Option 1: Fetch from Iframely */}
                                                    <div>
                                                        <label className="block text-xs text-slate-600 mb-1">Option 1: Fetch from Iframely (Auto)</label>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleFetchFromIframely(video)}
                                                            disabled={fetchingThumbnails[video] || !!thumbnailFiles[video] || !!thumbnailUrlString}
                                                            className="w-full px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
                                                        >
                                                            {fetchingThumbnails[video] ? 'Fetching...' : '🔍 Fetch Thumbnail from Iframely'}
                                                        </button>
                                                    </div>
                                                    
                                                    {/* Option 2: URL Input */}
                                                    <div>
                                                        <label className="block text-xs text-slate-600 mb-1">Option 2: Thumbnail URL (Manual)</label>
                                                        <input 
                                                            type="url" 
                                                            value={thumbnailUrlString} 
                                                            onChange={e => handleThumbnailChange(video, e.target.value)} 
                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-sm" 
                                                            placeholder="https://example.com/thumbnail.jpg" 
                                                            disabled={!!thumbnailFiles[video] || fetchingThumbnails[video]}
                                                        />
                                                    </div>
                                                    
                                                    {/* Option 3: File Upload */}
                                                    <div>
                                                        <label className="block text-xs text-slate-600 mb-1">Option 3: Upload Image (JPG, PNG, max 5MB)</label>
                                                        <input 
                                                            type="file" 
                                                            accept="image/jpeg,image/jpg,image/png,image/webp"
                                                            onChange={e => handleThumbnailFileChange(video, e.target.files?.[0] || null)}
                                                            className="w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer"
                                                            disabled={!!videoThumbnails[video]}
                                                        />
                                                    </div>
                                                    
                                                    {/* Preview */}
                                                    {(currentThumbnail || thumbnailPreviews[video]) && (
                                                        <div className="mt-2">
                                                            <img 
                                                                src={thumbnailPreviews[video] || thumbnailUrlString || ""} 
                                                                alt="Thumbnail preview"
                                                                className="max-w-full h-20 object-contain border border-slate-200 rounded"
                                                            />
                                                            {typeof currentThumbnail === 'object' && currentThumbnail && currentThumbnail.width && (
                                                                <p className="text-xs text-slate-500 mt-1">
                                                                    Size: {currentThumbnail.width}×{currentThumbnail.height}px
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Clear Button */}
                                                    {(videoThumbnails[video] || thumbnailFiles[video]) && (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => removeThumbnail(video)}
                                                            className="w-full px-3 py-1.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors text-sm"
                                                        >
                                                            Clear Thumbnail
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                {/* Video/Photo Preview */}
                                                {(() => {
                                                    const provider = detectProvider(video);
                                                    const embedUrl = provider ? getVideoEmbedApiUrl(video) : null;
                                                    const thumbnailUrl = thumbnailPreviews[video] || thumbnailUrlString || undefined;
                                                    
                                                    // Use SocialEmbedCard for social media videos
                                                    if (provider && embedUrl && !isImage && isEmbeddableVideoUrl(video)) {
                                                        return (
                                                            <div className="mt-2 w-full max-w-lg">
                                                                <SocialEmbedCard
                                                                    provider={provider}
                                                                    originalUrl={video}
                                                                    embedUrl={embedUrl}
                                                                    lang={lang}
                                                                />
                                                            </div>
                                                        );
                                                    }

                                                    // Profile/channel/stories links: warning only, no broken preview card
                                                    if (provider && !isImage && !isEmbeddableVideoUrl(video)) {
                                                      return null;
                                                    }
                                                    
                                                    // Use VideoThumbnail for images or non-social media URLs
                                                    return (
                                                <div className="mt-2 relative w-full h-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                                                    <VideoThumbnail 
                                                        url={video}
                                                                manualThumbnail={thumbnailUrl}
                                                        alt="Video/Photo thumbnail"
                                                        fill
                                                        className={isImage ? "object-contain" : "object-cover"}
                                                    />
                                                    {isVideo && !isInstagramPost && !isTikTokPhoto && (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                                            <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                                                                <span className="text-xl text-slate-900 ml-1">▶</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                    );
                                                })()}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                            {videoLinkError ? (
                              <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                {videoLinkError}
                              </p>
                            ) : null}
                            <button type="button" onClick={addVideo} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm">+ Προσθήκη Video Link / Φωτογραφίας</button>
                        </div>

                        {/* Insights Screenshots */}
                        {user.insights_urls && user.insights_urls.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 uppercase mb-3">{L("Στιγμιότυπα Insights", "Insights Screenshots")}</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    {user.insights_urls.map((url, i) => (
                                        <div key={i} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-slate-300">
                                            <Image 
                                                src={url} 
                                                alt={`Insight ${i + 1}`} 
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
                        <button type="button" onClick={onClose} className="px-6 py-2 text-slate-900 hover:bg-slate-100 rounded-lg font-semibold transition-colors border border-slate-300">{L("Ακύρωση", "Cancel")}</button>
                        <button type="submit" disabled={loading || videosChecking || videosNotPlayable} className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold disabled:opacity-50 transition-colors">
                            {loading ? L("Αποθήκευση...", "Saving...") : L("Αποθήκευση", "Save Changes")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function AdminDashboardContent({ adminEmail }: { adminEmail: string }) {
  const [lang, setLang] = useState<"el" | "en">("el"); // Default to Greek, will be updated in useEffect
  const txt = t[lang];
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeTabRef = useRef("overview");
  const confirmAction = (opts: Omit<PendingConfirm, "resolve">) =>
    new Promise<boolean>((resolve) => {
      setPendingConfirm({ ...opts, resolve });
    });
  const closeConfirm = (ok: boolean) => {
    setPendingConfirm((current) => {
      current?.resolve(ok);
      return null;
    });
  };

  useEffect(() => {
    adminNotify = (message, tone) => pushToast(message, tone);
    return () => {
      adminNotify = () => {};
    };
  }, [pushToast]);

  // Load language from localStorage on client-side
  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);

  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState<DbInfluencer[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoaded, setBrandsLoaded] = useState(false);
  const [unseenBrandCount, setUnseenBrandCount] = useState(0);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [brandSearchQuery, setBrandSearchQuery] = useState("");
  const [brandStatusFilter, setBrandStatusFilter] = useState<"all" | "verified" | "pending">("pending");
  const [updatingBrand, setUpdatingBrand] = useState<string | null>(null);
  const [deletingBrand, setDeletingBrand] = useState<string | null>(null);
  const [deletingConversation, setDeletingConversation] = useState<string | null>(null);
  const [deletingProposal, setDeletingProposal] = useState<number | null>(null);
  const [adminCampaigns, setAdminCampaigns] = useState<AdminBrandCampaignRow[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsLoaded, setCampaignsLoaded] = useState(false);
  const [campaignsSchemaMissing, setCampaignsSchemaMissing] = useState(false);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [campaignSearchQuery, setCampaignSearchQuery] = useState("");
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [unseenCampaignCount, setUnseenCampaignCount] = useState(0);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
  const [showConversationsDrawer, setShowConversationsDrawer] = useState(false); // Mobile: toggle conversations drawer
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [blogSearchQuery, setBlogSearchQuery] = useState("");
  const [selectedBlogPost, setSelectedBlogPost] = useState<BlogPost | null>(null);
  const [showBlogEditModal, setShowBlogEditModal] = useState(false);
  const [isNewBlogPost, setIsNewBlogPost] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "pending">("all");
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [influencersPage, setInfluencersPage] = useState(1);
  const [influencersTotal, setInfluencersTotal] = useState(0);
  const [influencersHasMore, setInfluencersHasMore] = useState(false);
  const [influencersLoading, setInfluencersLoading] = useState(true);
  const [influencersLoadingMore, setInfluencersLoadingMore] = useState(false);
  const [influencersError, setInfluencersError] = useState<LoadError>(null);
  const [influencerRecent, setInfluencerRecent] = useState(0);
  const [influencerAttention, setInfluencerAttention] = useState<
    Array<{ id: number; display_name: string; contact_email: string | null; created_at: string }>
  >([]);
  const [brandSearchDebounced, setBrandSearchDebounced] = useState("");
  const [brandsPage, setBrandsPage] = useState(1);
  const [brandsTotal, setBrandsTotal] = useState(0);
  const [brandsError, setBrandsError] = useState<LoadError>(null);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [brandCounts, setBrandCounts] = useState({ total: 0, pending: 0, verified: 0, recent: 0 });
  const [brandPendingIds, setBrandPendingIds] = useState<string[]>([]);
  const [brandAttention, setBrandAttention] = useState<
    Array<{ id: string; brand_name: string; contact_email: string | null; created_at: string }>
  >([]);
  const [proposalSearch, setProposalSearch] = useState("");
  const [proposalSearchDebounced, setProposalSearchDebounced] = useState("");
  const [proposalStatus, setProposalStatus] = useState<"all" | "pending" | "accepted" | "completed" | "rejected">("all");
  const [proposalsPage, setProposalsPage] = useState(1);
  const [proposalsTotal, setProposalsTotal] = useState(0);
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [proposalsError, setProposalsError] = useState<LoadError>(null);
  const [proposalCounts, setProposalCounts] = useState({
    total: 0,
    pending: 0,
    accepted: 0,
    completed: 0,
    active: 0,
    recent: 0,
    pipeline: null as number | null,
  });
  const [proposalAttention, setProposalAttention] = useState<
    Array<{ id: number; brand_name: string; budget: string; created_at: string; influencer_name: string }>
  >([]);
  const [pendingProposalIdList, setPendingProposalIdList] = useState<number[]>([]);
  const [conversationSearch, setConversationSearch] = useState("");
  const [conversationSearchDebounced, setConversationSearchDebounced] = useState("");
  const [conversationStatus, setConversationStatus] = useState<"all" | "open" | "closed">("all");
  const [conversationsPage, setConversationsPage] = useState(1);
  const [conversationsTotal, setConversationsTotal] = useState(0);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState<LoadError>(null);
  const [conversationCounts, setConversationCounts] = useState({ total: 0, open: 0, closed: 0 });
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<LoadError>(null);
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [campaignsError, setCampaignsError] = useState<LoadError>(null);
  const [pickerUsers, setPickerUsers] = useState<DbInfluencer[]>([]);
  const [editDetailLoading, setEditDetailLoading] = useState(false);
  const [editDetailError, setEditDetailError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<DbInfluencer | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [showBrandEditModal, setShowBrandEditModal] = useState(false);

  const [stats, setStats] = useState<{
    total: number;
    pending: number;
    verified: number;
    approved?: number;
    analyticsVerified?: number;
    /** Set only when API computed it; omit/null hides the card. */
    hiddenVideos?: number | null;
    /** Formatted reach; omit/null hides the card. */
    reach?: string | null;
    pipeline: string;
  }>({ 
    total: 0, 
    pending: 0, 
    verified: 0,
    approved: 0,
    analyticsVerified: 0,
    hiddenVideos: null,
    reach: null,
    pipeline: formatEuro(0)
  });
  const [hiddenByProfile, setHiddenByProfile] = useState<
    Array<{ id: string; display_name: string; count: number; urls: string[] }>
  >([]);
  const [showHiddenVideosPanel, setShowHiddenVideosPanel] = useState(false);
  const [pendingProposalsCount, setPendingProposalsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [brokenThumbnails, setBrokenThumbnails] = useState<Array<{ influencerId: number; influencerName: string; videoUrl: string; thumbnailUrl: string; reason: string }>>([]);
  const [checkingThumbnails, setCheckingThumbnails] = useState(false);
  const [refreshingSocialFor, setRefreshingSocialFor] = useState<string | null>(null);
  const [refreshingSocialAll, setRefreshingSocialAll] = useState(false);
  const [refreshingAuditFor, setRefreshingAuditFor] = useState<string | null>(null);
  const [backfillingAudit, setBackfillingAudit] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<string | null>(null);

  // Announcements (admin)
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementTargetType, setAnnouncementTargetType] = useState<
    "all" | "specific" | "all_brands" | "specific_brand"
  >("all");
  const [announcementTargetInfluencerIds, setAnnouncementTargetInfluencerIds] = useState<string[]>([]);
  const [announcementTargetBrandIds, setAnnouncementTargetBrandIds] = useState<string[]>([]);
  const [announcementsList, setAnnouncementsList] = useState<
    Array<{
      id: string;
      title: string;
      body: string;
      created_at: string;
      target_type: string;
      target_influencer_id: string | null;
      target_brand_id?: string | null;
      read_count?: number;
      recipient_count?: number;
      read_at?: string | null;
    }>
  >([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState<LoadError>(null);
  const [announcementSending, setAnnouncementSending] = useState(false);
  const [announcementReadersOpenId, setAnnouncementReadersOpenId] = useState<string | null>(null);
  const [announcementReadersById, setAnnouncementReadersById] = useState<
    Record<string, Array<{ id: string; name: string; read_at: string }>>
  >({});
  const [announcementReadersLoadingId, setAnnouncementReadersLoadingId] = useState<string | null>(null);
  const [announcementSearch, setAnnouncementSearch] = useState("");
  const [announcementSearchDebounced, setAnnouncementSearchDebounced] = useState("");
  const [announcementFilterTarget, setAnnouncementFilterTarget] = useState<
    "" | "all" | "specific" | "all_brands" | "specific_brand"
  >("");
  const [announcementDateFrom, setAnnouncementDateFrom] = useState("");
  const [announcementDateTo, setAnnouncementDateTo] = useState("");
  const [announcementsPage, setAnnouncementsPage] = useState(1);
  const [announcementsTotal, setAnnouncementsTotal] = useState(0);
  const [announcementsTotalPages, setAnnouncementsTotalPages] = useState(1);
  const [announcementSelectedIds, setAnnouncementSelectedIds] = useState<string[]>([]);
  const [announcementBulkDeleting, setAnnouncementBulkDeleting] = useState(false);
  const ANNOUNCEMENTS_PAGE_SIZE = 20;

  const fetchConversations = async (opts?: {
    page?: number;
    q?: string;
    status?: "all" | "open" | "closed";
    silent?: boolean;
  }) => {
    const page = opts?.page ?? conversationsPage;
    const q = opts?.q ?? conversationSearchDebounced;
    const status = opts?.status ?? conversationStatus;
    if (!opts?.silent) setConversationsLoading(true);
    setConversationsError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(ADMIN_PAGE_SIZE),
        status,
      });
      if (q.trim()) params.set("q", q.trim());
      if (viewerId && typeof window !== "undefined") {
        const stamp = readStamp(window.localStorage, conversationSeenKey(viewerId));
        if (stamp) params.set("newerThan", stamp);
      }
      const response = await withTimeout(
        fetch(`/api/admin/conversations?${params}`, { headers: await adminAuthHeaders() }),
        LOAD_TIMEOUT_MS
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load conversations");
      }
      setConversations(result.conversations || []);
      setConversationsPage(page);
      setConversationsTotal(typeof result.total === "number" ? result.total : 0);
      if (result.counts) setConversationCounts(result.counts);
      if (activeTabRef.current !== "conversations" && typeof result.newerCount === "number") {
        setUnreadMessagesCount(result.newerCount);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
      setConversationsError(isTimeoutError(error) ? "timeout" : "error");
    } finally {
      setConversationsLoading(false);
    }
  };

  const fetchConversationMessages = async (convId: string, opts?: { before?: string }) => {
    if (!opts?.before) {
      setMessagesLoading(true);
      setMessagesError(null);
    }
    try {
      const params = new URLSearchParams({
        conversationId: convId,
        limit: "80",
      });
      if (opts?.before) params.set("before", opts.before);
      const response = await withTimeout(
        fetch(`/api/admin/conversations?${params}`, { headers: await adminAuthHeaders() }),
        LOAD_TIMEOUT_MS
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load messages");
      }
      const rows = (result.messages || []) as Message[];
      setConversationMessages((prev) => (opts?.before ? [...rows, ...prev] : rows));
      setMessagesHasMore(!!result.hasMore);
      setMessagesError(null);
    } catch (error) {
      console.error("Error fetching messages:", error);
      setMessagesError(isTimeoutError(error) ? "timeout" : "error");
    } finally {
      setMessagesLoading(false);
    }
  };

  const fetchBrands = async (opts?: {
    page?: number;
    q?: string;
    status?: "all" | "verified" | "pending";
    silent?: boolean;
  }) => {
    const page = opts?.page ?? brandsPage;
    const q = opts?.q ?? brandSearchDebounced;
    const status = opts?.status ?? brandStatusFilter;
    if (!opts?.silent) setBrandsLoading(true);
    setBrandsError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(ADMIN_PAGE_SIZE),
        status,
      });
      if (q.trim()) params.set("q", q.trim());
      const response = await withTimeout(
        fetch(`/api/admin/brands?${params}`, { headers: await adminAuthHeaders() }),
        LOAD_TIMEOUT_MS
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || result.details || "Failed to load brands");
      }
      setBrands(result.brands || []);
      setBrandsPage(page);
      setBrandsTotal(typeof result.total === "number" ? result.total : 0);
      if (result.counts) setBrandCounts(result.counts);
      if (Array.isArray(result.attention)) setBrandAttention(result.attention);
      if (Array.isArray(result.pendingIds)) setBrandPendingIds(result.pendingIds.map(String));
      setBrandsLoaded(true);
    } catch (error) {
      console.error("Error fetching brands:", error);
      setBrandsError(isTimeoutError(error) ? "timeout" : "error");
    } finally {
      setBrandsLoading(false);
    }
  };

  const fetchProposals = async (opts?: {
    page?: number;
    q?: string;
    status?: "all" | "pending" | "accepted" | "completed" | "rejected";
    silent?: boolean;
  }) => {
    const page = opts?.page ?? proposalsPage;
    const q = opts?.q ?? proposalSearchDebounced;
    const status = opts?.status ?? proposalStatus;
    if (!opts?.silent) setProposalsLoading(true);
    setProposalsError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(ADMIN_PAGE_SIZE),
        status,
      });
      if (q.trim()) params.set("q", q.trim());
      const response = await withTimeout(
        fetch(`/api/admin/proposals?${params}`, { headers: await adminAuthHeaders() }),
        LOAD_TIMEOUT_MS
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load proposals");
      }
      setProposals(Array.isArray(result.proposals) ? result.proposals : []);
      setProposalsPage(page);
      setProposalsTotal(typeof result.total === "number" ? result.total : 0);
      if (result.counts) {
        setProposalCounts((prev) => ({
          ...prev,
          ...result.counts,
          pipeline: typeof result.counts.pipeline === "number" ? result.counts.pipeline : prev.pipeline,
        }));
        if (typeof result.counts.pipeline === "number") {
          setStats((prev) => ({
            ...prev,
            pipeline: formatEuro(Math.round(result.counts.pipeline), lang),
          }));
        }
      }
      if (Array.isArray(result.attention)) setProposalAttention(result.attention);
      if (Array.isArray(result.pendingIds)) {
        const ids = result.pendingIds.map(Number).filter((id: number) => Number.isFinite(id));
        setPendingProposalIdList(ids);
        setPendingProposalsCount(
          countUnseenPendingProposals(ids.map((id: number) => ({ id, status: "pending" })))
        );
      }
    } catch (error) {
      console.error("Error fetching proposals:", error);
      setProposalsError(isTimeoutError(error) ? "timeout" : "error");
    } finally {
      setProposalsLoading(false);
    }
  };

  const fetchAdminCampaigns = async () => {
    setCampaignsLoading(true);
    setCampaignsError(null);
    setCampaignsSchemaMissing(false);
    try {
      const response = await withTimeout(
        fetch("/api/admin/campaigns", { headers: await adminAuthHeaders() }),
        LOAD_TIMEOUT_MS
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load campaigns");
      }
      setCampaignsSchemaMissing(!!result.schemaMissing);
      setAdminCampaigns(result.campaigns || []);
    } catch (e) {
      console.error("[Admin] campaigns fetch", e);
      setCampaignsError(isTimeoutError(e) ? "timeout" : "error");
      setAdminCampaigns([]);
    } finally {
      setCampaignsLoading(false);
      setCampaignsLoaded(true);
    }
  };

  const deleteAdminCampaign = async (row: AdminBrandCampaignRow) => {
    const ok = await confirmAction({
      title: lang === "el" ? "Διαγραφή καμπάνιας" : "Delete campaign",
      body: txt.campaign_delete_confirm,
      confirmLabel: lang === "el" ? "Διαγραφή" : "Delete",
      cancelLabel: lang === "el" ? "Άκυρο" : "Cancel",
      danger: true,
    });
    if (!ok) return;
    setDeletingCampaignId(row.id);
    try {
      const response = await fetch("/api/admin/campaigns", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(await adminAuthHeaders()) },
        body: JSON.stringify({ campaignId: row.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Delete failed");
      }
      setAdminCampaigns((prev) => prev.filter((c) => c.id !== row.id));
      notify(lang === "el" ? "Η καμπάνια διαγράφηκε." : "Campaign deleted.");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      notify(lang === "el" ? `Σφάλμα: ${message}` : `Error: ${message}`);
    } finally {
      setDeletingCampaignId(null);
    }
  };

  const fetchBlogPosts = async () => {
    try {
      // Initialize with initial posts if localStorage is empty
      const { initializeBlogPosts, getBlogPosts } = await import('@/lib/blogPosts');
      initializeBlogPosts();
      const posts = getBlogPosts();
      setBlogPosts(posts);
    } catch (error) {
      console.error('Error fetching blog posts:', error);
      // Fallback to localStorage
      const stored = localStorage.getItem('blogPosts');
      if (stored) {
        try {
          setBlogPosts(JSON.parse(stored));
        } catch {
          setBlogPosts([]);
        }
      } else {
        setBlogPosts([]);
      }
    }
  };

  const fetchAnnouncements = async (opts?: {
    page?: number;
    q?: string;
    targetType?: "" | "all" | "specific" | "all_brands" | "specific_brand";
    from?: string;
    to?: string;
  }) => {
    const page = opts?.page ?? announcementsPage;
    const q = opts?.q ?? announcementSearchDebounced;
    const targetType = opts?.targetType ?? announcementFilterTarget;
    const from = opts?.from ?? announcementDateFrom;
    const to = opts?.to ?? announcementDateTo;
    setAnnouncementsLoading(true);
    setAnnouncementsError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(ANNOUNCEMENTS_PAGE_SIZE));
      if (q.trim()) params.set('q', q.trim());
      if (targetType) params.set('target_type', targetType);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await withTimeout(
        fetch(`/api/admin/announcements?${params.toString()}`, {
          headers: await adminAuthHeaders(),
        }),
        LOAD_TIMEOUT_MS
      );
      const data = await res.json();
      if (res.ok && Array.isArray(data.data)) {
        setAnnouncementsList(data.data);
        setAnnouncementsTotal(typeof data.total === 'number' ? data.total : data.data.length);
        setAnnouncementsTotalPages(
          typeof data.totalPages === 'number' ? Math.max(1, data.totalPages) : 1
        );
        setAnnouncementsPage(typeof data.page === 'number' ? data.page : page);
        setAnnouncementSelectedIds([]);
        setAnnouncementReadersOpenId(null);
      } else {
        setAnnouncementsList([]);
        setAnnouncementsTotal(0);
        setAnnouncementsTotalPages(1);
      }
    } catch (e) {
      console.error('Error fetching announcements:', e);
      setAnnouncementsError(isTimeoutError(e) ? "timeout" : "error");
      setAnnouncementsList([]);
      setAnnouncementsTotal(0);
      setAnnouncementsTotalPages(1);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const loadAnnouncementReaders = async (announcementId: string) => {
    if (announcementReadersById[announcementId]) return;
    setAnnouncementReadersLoadingId(announcementId);
    try {
      const res = await fetch(`/api/admin/announcements/${announcementId}/readers`, {
        headers: await adminAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.readers)) {
        setAnnouncementReadersById((prev) => ({ ...prev, [announcementId]: data.readers }));
      } else {
        setAnnouncementReadersById((prev) => ({ ...prev, [announcementId]: [] }));
      }
    } catch (e) {
      console.error('Error loading announcement readers:', e);
      setAnnouncementReadersById((prev) => ({ ...prev, [announcementId]: [] }));
    } finally {
      setAnnouncementReadersLoadingId(null);
    }
  };

  const toggleAnnouncementReaders = async (announcementId: string) => {
    if (announcementReadersOpenId === announcementId) {
      setAnnouncementReadersOpenId(null);
      return;
    }
    setAnnouncementReadersOpenId(announcementId);
    await loadAnnouncementReaders(announcementId);
  };

  const toggleAnnouncementSelected = (id: string) => {
    setAnnouncementSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllAnnouncementsOnPage = () => {
    const pageIds = announcementsList.map((a) => a.id);
    const allSelected =
      pageIds.length > 0 && pageIds.every((id) => announcementSelectedIds.includes(id));
    setAnnouncementSelectedIds(allSelected ? [] : pageIds);
  };

  const bulkDeleteAnnouncements = async () => {
    const ids = announcementSelectedIds;
    if (ids.length === 0) return;
    const ok = await confirmAction({
      title: lang === "el" ? "Διαγραφή ανακοινώσεων" : "Delete announcements",
      body:
        lang === "el"
          ? `Διαγραφή ${ids.length} ανακοινώσεων; Δεν μπορεί να αναιρεθεί.`
          : `Delete ${ids.length} announcements? This cannot be undone.`,
      confirmLabel: lang === "el" ? "Διαγραφή" : "Delete",
      cancelLabel: lang === "el" ? "Άκυρο" : "Cancel",
      danger: true,
    });
    if (!ok) return;
    setAnnouncementBulkDeleting(true);
    try {
      const res = await fetch('/api/admin/announcements/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
        body: JSON.stringify({ ids }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(result.error || (lang === 'el' ? 'Σφάλμα διαγραφής' : 'Delete failed'));
        return;
      }
      setAnnouncementSelectedIds([]);
      setAnnouncementReadersById({});
      const nextTotal = Math.max(0, announcementsTotal - ids.length);
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / ANNOUNCEMENTS_PAGE_SIZE) || 1);
      const nextPage = Math.min(announcementsPage, nextTotalPages);
      setAnnouncementsPage(nextPage);
      await fetchAnnouncements({ page: nextPage });
    } catch (e) {
      console.error('Bulk delete announcements error:', e);
      notify(lang === 'el' ? 'Σφάλμα διαγραφής' : 'Delete failed');
    } finally {
      setAnnouncementBulkDeleting(false);
    }
  };

  const sendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementBody.trim()) return;
    if (announcementTargetType === 'specific' && announcementTargetInfluencerIds.length === 0) {
      notify(lang === 'el' ? 'Επιλέξτε τουλάχιστον έναν influencer.' : 'Select at least one influencer.');
      return;
    }
    if (announcementTargetType === 'specific_brand' && announcementTargetBrandIds.length === 0) {
      notify(lang === 'el' ? 'Επιλέξτε τουλάχιστον μία επιχείρηση.' : 'Select at least one business.');
      return;
    }
    if (
      (announcementTargetType === 'specific' &&
        announcementTargetInfluencerIds.length > MAX_ANNOUNCEMENT_SPECIFIC_RECIPIENTS) ||
      (announcementTargetType === 'specific_brand' &&
        announcementTargetBrandIds.length > MAX_ANNOUNCEMENT_SPECIFIC_RECIPIENTS)
    ) {
      notify(
        lang === 'el'
          ? `Μέχρι ${MAX_ANNOUNCEMENT_SPECIFIC_RECIPIENTS} παραλήπτες ανά αποστολή.`
          : `At most ${MAX_ANNOUNCEMENT_SPECIFIC_RECIPIENTS} recipients per send.`
      );
      return;
    }
    setAnnouncementSending(true);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
        body: JSON.stringify({
          title: announcementTitle.trim(),
          content: announcementBody.trim(),
          target_type: announcementTargetType,
          target_influencer_ids:
            announcementTargetType === 'specific' ? announcementTargetInfluencerIds : undefined,
          target_brand_ids:
            announcementTargetType === 'specific_brand' ? announcementTargetBrandIds : undefined,
        }),
      });
      const result = await res.json();
      if (res.ok && result.data) {
        setAnnouncementTitle('');
        setAnnouncementBody('');
        setAnnouncementTargetInfluencerIds([]);
        setAnnouncementTargetBrandIds([]);
        setAnnouncementsPage(1);
        setAnnouncementReadersById({});
        await fetchAnnouncements({ page: 1 });
        const n = typeof result.count === 'number' ? result.count : Array.isArray(result.data) ? result.data.length : 1;
        notify(
          n > 1
            ? (lang === 'el' ? `Απεστάλη σε ${n} παραλήπτες.` : `Sent to ${n} recipients.`)
            : txt.ann_sent
        );
      } else {
        notify(result.error || (lang === 'el' ? 'Σφάλμα αποστολής' : 'Send failed'));
      }
    } catch (err: unknown) {
      console.error('Send announcement error:', err);
      const message = err instanceof Error ? err.message : '';
      notify(message || (lang === 'el' ? 'Σφάλμα αποστολής' : 'Send failed'));
    } finally {
      setAnnouncementSending(false);
    }
  };

  const announcementInfluencerOptions = (pickerUsers.length ? pickerUsers : users).map((u) => {
    const uuid = u.auth_user_id || (typeof u.id === 'string' ? u.id : '');
    const slug = u.profile_slug || '';
    const email = u.contact_email || '';
    const name = u.display_name || '';
    return {
      id: uuid || '',
      label: `${name}${email ? ` (${email})` : ''}`,
      searchText: `${name} ${slug} ${email}`.toLowerCase(),
      disabled: !uuid,
      disabledReason: !uuid ? (lang === 'el' ? '(χωρίς auth)' : '(no auth)') : undefined,
    };
  });

  const announcementBrandMultiOptions = brands.map((b) => {
    const name = b.brand_name || '';
    const email = b.contact_email || '';
    return {
      id: String(b.id),
      label: `${name}${email ? ` (${email})` : ''}`,
      searchText: `${name} ${email}`.toLowerCase(),
    };
  });

  const announcementSendCount =
    announcementTargetType === 'specific'
      ? announcementTargetInfluencerIds.length
      : announcementTargetType === 'specific_brand'
        ? announcementTargetBrandIds.length
        : null;

  const saveBlogPost = async (post: BlogPost) => {
    try {
      const updated = isNewBlogPost 
        ? [...blogPosts, post]
        : blogPosts.map(p => p.slug === post.slug ? post : p);
      
      setBlogPosts(updated);
      localStorage.setItem('blogPosts', JSON.stringify(updated));
      // Dispatch event to notify blog pages
      window.dispatchEvent(new Event('blogPostsUpdated'));
      setShowBlogEditModal(false);
      setSelectedBlogPost(null);
      setIsNewBlogPost(false);
      notify(lang === 'el' ? 'Το άρθρο αποθηκεύτηκε!' : 'Article saved!');
    } catch (error) {
      console.error('Error saving blog post:', error);
      notify(lang === 'el' ? 'Σφάλμα κατά την αποθήκευση' : 'Error saving');
    }
  };

  const deleteBlogPost = async (slug: string) => {
    const ok = await confirmAction({
      title: lang === "el" ? "Διαγραφή άρθρου" : "Delete article",
      body: lang === "el"
        ? "Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το άρθρο;"
        : "Are you sure you want to delete this article?",
      confirmLabel: lang === "el" ? "Διαγραφή" : "Delete",
      cancelLabel: lang === "el" ? "Άκυρο" : "Cancel",
      danger: true,
    });
    if (!ok) return;
    try {
      const updated = blogPosts.filter(p => p.slug !== slug);
      setBlogPosts(updated);
      localStorage.setItem('blogPosts', JSON.stringify(updated));
      // Dispatch event to notify blog pages
      window.dispatchEvent(new Event('blogPostsUpdated'));
      notify(lang === 'el' ? 'Το άρθρο διαγράφηκε!' : 'Article deleted!');
    } catch (error) {
      console.error('Error deleting blog post:', error);
      notify(lang === 'el' ? 'Σφάλμα κατά τη διαγραφή' : 'Error deleting');
    }
  };

  const loadBlogPostContent = async (post: BlogPost): Promise<BlogPost> => {
    // If post already has content, return as is
    if (post.content?.el && post.content?.en) {
      return post;
    }

    // First, try to get the post from localStorage which should have content if it was saved before
    try {
      const stored = localStorage.getItem('blogPosts');
      if (stored) {
        const allPosts: BlogPost[] = JSON.parse(stored);
        const storedPost = allPosts.find(p => p.slug === post.slug);
        
        // If stored post has content, use it
        if (storedPost && storedPost.content && (storedPost.content.el || storedPost.content.en)) {
          return {
            ...post,
            content: {
              el: storedPost.content.el || '',
              en: storedPost.content.en || ''
            }
          };
        }
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }

    // Try to load from getBlogPosts as well
    try {
      const { getBlogPosts } = await import('@/lib/blogPosts');
      const allPosts = getBlogPosts();
      const storedPost = allPosts.find(p => p.slug === post.slug);
      
      if (storedPost && storedPost.content && (storedPost.content.el || storedPost.content.en)) {
        return {
          ...post,
          content: {
            el: storedPost.content.el || '',
            en: storedPost.content.en || ''
          }
        };
      }
    } catch (error) {
      console.error('Error loading from getBlogPosts:', error);
    }

    // Try to load from hardcoded posts using the helper function
    try {
      const { getBlogPostContent } = await import('@/lib/blogPosts');
      
      // Wait a bit in case blog page hasn't loaded yet and set window.__blogPostsContent
      let content = getBlogPostContent(post.slug);
      if (!content || (!content.el && !content.en)) {
        await new Promise(resolve => setTimeout(resolve, 200));
        content = getBlogPostContent(post.slug);
      }
      
      // If still no content, wait a bit more and check window directly
      if (!content || (!content.el && !content.en)) {
        await new Promise(resolve => setTimeout(resolve, 300));
        const hardcodedPosts = (window as any).__blogPostsContent;
        if (hardcodedPosts && hardcodedPosts[post.slug] && hardcodedPosts[post.slug].content) {
          content = hardcodedPosts[post.slug].content;
        }
      }

      // Fallback: load blog post page in hidden iframe to get content (page sets window.__blogPostsContent)
      if (!content || (!content.el && !content.en)) {
        try {
          content = await new Promise<{ el: string; en: string } | null>((resolve) => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = `/blog/${post.slug}`;
            const timeout = setTimeout(() => {
              try { iframe.remove(); } catch { /* noop */ }
              resolve(null);
            }, 8000);
            iframe.onload = () => {
              try {
                const win = (iframe.contentWindow as any);
                if (win?.__blogPostsContent?.[post.slug]?.content) {
                  clearTimeout(timeout);
                  resolve(win.__blogPostsContent[post.slug].content);
                } else {
                  resolve(null);
                }
              } catch {
                resolve(null);
              } finally {
                try { iframe.remove(); } catch { /* noop */ }
              }
            };
            document.body.appendChild(iframe);
          });
        } catch (e) {
          console.error('Iframe fallback for blog content failed:', e);
        }
      }
      
      if (content && (content.el || content.en)) {
        // Also update localStorage with this content for future use
        try {
          const stored = localStorage.getItem('blogPosts');
          if (stored) {
            const allPosts: BlogPost[] = JSON.parse(stored);
            const updatedPosts = allPosts.map(p => {
              if (p.slug === post.slug && (!p.content || (!p.content.el && !p.content.en))) {
                return {
                  ...p,
                  content: content
                };
              }
              return p;
            });
            localStorage.setItem('blogPosts', JSON.stringify(updatedPosts));
          }
        } catch (error) {
          console.error('Error updating localStorage with content:', error);
        }
        
        return {
          ...post,
          content: {
            el: content.el || '',
            en: content.en || ''
          }
        };
      }
    } catch (error) {
      console.error('Error loading from hardcoded posts:', error);
    }
    
    // If we still don't have content, return with empty content
    return {
      ...post,
      content: post.content || { el: '', en: '' }
    };
  };

  const PAGE_SIZE = 50;

  const applyInfluencerCounts = (
    counts: {
      total?: number;
      approved?: number;
      pending?: number;
      analyticsVerified?: number;
      hiddenVideos?: number;
      reach?: number;
    } | undefined,
    pipeline: string,
    hiddenList?: Array<{ id: string; display_name: string; count: number; urls: string[] }>
  ) => {
    if (!counts) return;
    const total = counts.total ?? 0;
    const approved = counts.approved ?? 0;
    const pending = counts.pending ?? Math.max(0, total - approved);
    const analyticsVerified = counts.analyticsVerified ?? 0;
    const locale = lang === "el" ? "el-GR" : "en-US";
    setStats((prev) => ({
      ...prev,
      total,
      verified: approved,
      approved,
      analyticsVerified,
      pending,
      // Only set when API computed it; missing → hide card (do not show 0).
      hiddenVideos: typeof counts.hiddenVideos === "number" ? counts.hiddenVideos : null,
      reach:
        typeof counts.reach === "number"
          ? Math.round(counts.reach).toLocaleString(locale)
          : null,
      pipeline: pipeline || prev.pipeline,
    }));
    if (hiddenList) setHiddenByProfile(hiddenList);
  };

  const fetchInfluencersPage = async (opts: {
    page: number;
    append?: boolean;
    silent?: boolean;
    q?: string;
    status?: "all" | "verified" | "pending";
  }) => {
    const page = opts.page;
    const append = !!opts.append;
    const q = opts.q ?? debouncedSearch;
    const status = opts.status ?? statusFilter;
    if (append) setInfluencersLoadingMore(true);
    else if (!opts.silent) setInfluencersLoading(true);
    if (!opts.silent) setInfluencersError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(ADMIN_PAGE_SIZE),
        status,
        sort: "created_at",
        order: "desc",
      });
      if (q.trim()) params.set("q", q.trim());
      const res = await withTimeout(
        fetch(`/api/admin/influencers?${params}`, {
          headers: await adminAuthHeaders(),
        }),
        LOAD_TIMEOUT_MS
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || res.statusText || "Failed to load influencers");
      }
      const rows = (Array.isArray(body.influencers) ? body.influencers : []) as DbInfluencer[];
      setUsers((prev) => (append ? [...prev, ...rows] : rows));
      setInfluencersPage(page);
      setInfluencersTotal(typeof body.total === "number" ? body.total : rows.length);
      setInfluencersHasMore(!!body.hasMore);
      if (typeof body.counts?.recent === "number") setInfluencerRecent(body.counts.recent);
      if (Array.isArray(body.attention)) setInfluencerAttention(body.attention);
      applyInfluencerCounts(
        body.counts,
        "",
        Array.isArray(body.hiddenByProfile) ? body.hiddenByProfile : undefined
      );
      setInfluencersError(null);
    } catch (error) {
      console.error("Error fetching influencers:", error);
      setInfluencersError(isTimeoutError(error) ? "timeout" : "error");
      if (!append && !opts.silent) setUsers([]);
    } finally {
      setInfluencersLoading(false);
      setInfluencersLoadingMore(false);
    }
  };

  const fetchPickerUsers = async () => {
    try {
      const res = await fetch("/api/admin/influencers?picker=1", {
        headers: await adminAuthHeaders(),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(body.influencers)) {
        setPickerUsers(body.influencers as DbInfluencer[]);
      }
    } catch (error) {
      console.error("Error fetching influencer picker list:", error);
    }
  };

  const openEditUser = async (row: DbInfluencer) => {
    setShowEditModal(false);
    setSelectedUser(null);
    setEditDetailError(null);
    setEditDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/influencers/${row.id}`, {
        headers: await adminAuthHeaders(),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.influencer) {
        setSelectedUser(body.influencer as DbInfluencer);
        setShowEditModal(true);
      } else {
        setEditDetailError(
          lang === "el"
            ? "Αποτυχία φόρτωσης πλήρους προφίλ. Δοκιμάστε ξανά."
            : "Failed to load full profile. Please try again."
        );
      }
    } catch (error) {
      console.error("Error loading influencer detail:", error);
      setEditDetailError(
        lang === "el"
          ? "Αποτυχία φόρτωσης πλήρους προφίλ. Δοκιμάστε ξανά."
          : "Failed to load full profile. Please try again."
      );
    } finally {
      setEditDetailLoading(false);
    }
  };

  const fetchData = async (opts?: { silent?: boolean }) => {
    await Promise.all([
      fetchInfluencersPage({ page: 1, silent: !!opts?.silent, q: debouncedSearch, status: statusFilter }),
      fetchPickerUsers(),
    ]);
  };

  const editModalOpenRef = useRef(false);
  useEffect(() => {
    editModalOpenRef.current = showEditModal || showBlogEditModal || showBrandEditModal;
  }, [showEditModal, showBlogEditModal, showBrandEditModal]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setViewerId(data.session?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Συνομιλίες: threads newer than this admin's last open. Companies: unverified brands not yet opened.
  useEffect(() => {
    if (!viewerId || typeof window === "undefined") return;
    const store = window.localStorage;
    if (activeTab === "conversations") {
      setUnreadMessagesCount(0);
      writeStamp(store, conversationSeenKey(viewerId), new Date().toISOString());
    }
    if (activeTab === "brands") {
      setUnseenBrandCount(0);
      if (brandsLoaded) writeIdList(store, companySeenKey(viewerId), brandPendingIds);
    } else if (brandsLoaded) {
      setUnseenBrandCount(countUnseenIds(brandPendingIds, readIdList(store, companySeenKey(viewerId))));
    }
  }, [viewerId, activeTab, brandsLoaded, brandPendingIds]);

  useEffect(() => {
    if (!viewerId || typeof window === "undefined") return;
    const store = window.localStorage;
    const campaignIds = adminCampaigns.map((c) => c.id);
    if (activeTab === "campaigns") {
      setUnseenCampaignCount(0);
      if (campaignsLoaded) writeIdList(store, adminCampaignSeenKey(viewerId), campaignIds);
    } else if (campaignsLoaded) {
      setUnseenCampaignCount(countUnseenIds(campaignIds, readIdList(store, adminCampaignSeenKey(viewerId))));
    }
  }, [viewerId, activeTab, adminCampaigns, campaignsLoaded]);

  // Initial load once
  useEffect(() => {
    void fetchData();
    void fetchProposals();
    void fetchConversations();
    void fetchBrands();
    void fetchAdminCampaigns();
    void fetchBlogPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setAnnouncementSearchDebounced(announcementSearch), 300);
    return () => window.clearTimeout(t);
  }, [announcementSearch]);

  useEffect(() => {
    setAnnouncementsPage(1);
  }, [announcementSearchDebounced, announcementFilterTarget, announcementDateFrom, announcementDateTo]);

  useEffect(() => {
    void fetchAnnouncements({
      page: announcementsPage,
      q: announcementSearchDebounced,
      targetType: announcementFilterTarget,
      from: announcementDateFrom,
      to: announcementDateTo,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    announcementsPage,
    announcementSearchDebounced,
    announcementFilterTarget,
    announcementDateFrom,
    announcementDateTo,
  ]);

  const adminSoftRefreshAtRef = useRef(0);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const softRefresh = () => {
      if (document.hidden || editModalOpenRef.current) return;
      const now = Date.now();
      if (now - adminSoftRefreshAtRef.current < 60_000) return;
      adminSoftRefreshAtRef.current = now;
      void fetchAdminCampaigns();
      void fetchBrands({ page: 1, silent: true });
      void fetchProposals({ page: 1, silent: true });
      void fetchConversations({ page: 1, silent: true });
      // Influencers: only current filter page 1 (cheap list columns), and only when tab visible/active.
      if (activeTabRef.current === "influencers") {
        void fetchInfluencersPage({
          page: 1,
          silent: true,
          q: debouncedSearch,
          status: statusFilter,
        });
      }
    };
    const onVisibility = () => {
      if (document.hidden) return;
      softRefresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(() => {
      if (document.hidden || editModalOpenRef.current) return;
      void fetchAdminCampaigns();
      if (activeTabRef.current === "influencers") {
        // Always page 1 so soft reload stays small and consistent with filters.
        void fetchInfluencersPage({
          page: 1,
          silent: true,
          q: debouncedSearch,
          status: statusFilter,
        });
      }
    }, 600000);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, influencersPage]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  const influencersFilterBootRef = useRef(true);
  useEffect(() => {
    if (influencersFilterBootRef.current) {
      influencersFilterBootRef.current = false;
      return;
    }
    setSelectedUsers([]);
    void fetchInfluencersPage({ page: 1, q: debouncedSearch, status: statusFilter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    const t = window.setTimeout(() => setBrandSearchDebounced(brandSearchQuery), 300);
    return () => window.clearTimeout(t);
  }, [brandSearchQuery]);

  useEffect(() => {
    const t = window.setTimeout(() => setProposalSearchDebounced(proposalSearch), 300);
    return () => window.clearTimeout(t);
  }, [proposalSearch]);

  useEffect(() => {
    const t = window.setTimeout(() => setConversationSearchDebounced(conversationSearch), 300);
    return () => window.clearTimeout(t);
  }, [conversationSearch]);

  const brandsFilterBootRef = useRef(true);
  useEffect(() => {
    if (brandsFilterBootRef.current) {
      brandsFilterBootRef.current = false;
      return;
    }
    void fetchBrands({ page: 1, q: brandSearchDebounced, status: brandStatusFilter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandSearchDebounced, brandStatusFilter]);

  const proposalsFilterBootRef = useRef(true);
  useEffect(() => {
    if (proposalsFilterBootRef.current) {
      proposalsFilterBootRef.current = false;
      return;
    }
    void fetchProposals({ page: 1, q: proposalSearchDebounced, status: proposalStatus });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalSearchDebounced, proposalStatus]);

  const conversationsFilterBootRef = useRef(true);
  useEffect(() => {
    if (conversationsFilterBootRef.current) {
      conversationsFilterBootRef.current = false;
      return;
    }
    void fetchConversations({ page: 1, q: conversationSearchDebounced, status: conversationStatus });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationSearchDebounced, conversationStatus]);

  useEffect(() => {
    if (!viewerId) return;
    void fetchConversations({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerId]);

  const linkedConversationId = useRef<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("conversation");
    if (!id) return;
    linkedConversationId.current = id;
    setActiveTab("conversations");
  }, []);
  useEffect(() => {
    const id = linkedConversationId.current;
    if (!id) return;
    const match = conversations.find((c) => c.id === id);
    if (match) {
      setSelectedConversation((current) => (current && current.id !== id ? current : match));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/admin/conversations?id=${encodeURIComponent(id)}`, {
          headers: await adminAuthHeaders(),
        });
        const body = await response.json().catch(() => ({}));
        if (!cancelled && response.ok && body.conversation) {
          setSelectedConversation(body.conversation as Conversation);
        }
      } catch (error) {
        console.error("Error opening linked conversation:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversations]);

  useEffect(() => {
    if (selectedConversation) {
      fetchConversationMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  // Broken thumbnails check disabled – δεν τρέχει αυτόματα ούτε εμφανίζεται banner
  const checkBrokenThumbnails = async () => {
    setCheckingThumbnails(true);
    const broken: Array<{ influencerId: number; influencerName: string; videoUrl: string; thumbnailUrl: string; reason: string }> = [];

    try {
      // Filter influencers that have thumbnails
      const influencersToCheck = users.filter(user => 
        user.video_thumbnails && Object.keys(user.video_thumbnails).length > 0
      );
      
      // Process in batches of 20 to avoid overwhelming the server
      const batchSize = 20;
      for (let i = 0; i < influencersToCheck.length; i += batchSize) {
        const batch = influencersToCheck.slice(i, i + batchSize);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (user) => {
          try {
            const response = await fetch('/api/video-thumbnail/check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ influencerId: user.id })
            });

            const data = await response.json();
            
            if (data.broken && data.brokenThumbnails && data.brokenThumbnails.length > 0) {
              return data.brokenThumbnails.map((brokenThumb: any) => ({
                influencerId: user.id,
                influencerName: user.display_name || user.contact_email || 'Unknown',
                videoUrl: brokenThumb.videoUrl,
                thumbnailUrl: brokenThumb.thumbnailUrl,
                reason: brokenThumb.reason
              }));
            }
            return [];
          } catch (error) {
            console.error(`Error checking thumbnails for influencer ${user.id}:`, error);
            return [];
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        const flatResults = batchResults.flat();
        broken.push(...flatResults);
        
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < influencersToCheck.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setBrokenThumbnails(broken);
    } catch (error) {
      console.error('Error checking broken thumbnails:', error);
    } finally {
      setCheckingThumbnails(false);
    }
  };

  const toggleApproval = async (id: number, currentStatus: boolean, userEmail: string, userName: string) => {
    if (currentStatus) {
      const ok = await confirmAction({
        title: lang === "el" ? "Ακύρωση έγκρισης" : "Remove approval",
        body: lang === "el"
          ? `Ο/Η «${userName || userEmail}» δεν θα βλέπει πλέον ανοιχτές καμπάνιες.`
          : `${userName || userEmail} will no longer see open campaigns.`,
        confirmLabel: lang === "el" ? "Ακύρωση έγκρισης" : "Unapprove",
        cancelLabel: lang === "el" ? "Άκυρο" : "Cancel",
        danger: true,
      });
      if (!ok) return;
    }
    const response = await fetch('/api/admin/influencers/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
      body: JSON.stringify({
        influencerId: id,
        updates: {
          approved: !currentStatus,
          approved_at: !currentStatus ? new Date().toISOString() : null
        }
      })
    });
    const data = await response.json();
    
    if (data.success) {
        if(selectedUser?.id === id) {
            setSelectedUser(prev => prev ? {...prev, approved: !currentStatus} : null);
        }
        // If approving, mark all unreviewed changes as reviewed
        if (!currentStatus) {
            try {
                const changesResponse = await fetch(`/api/profile-changes?influencerId=${id}&unreviewedOnly=true`, {
                    headers: await adminAuthHeaders(),
                });
                const changesData = await changesResponse.json();
                if (changesData.success && changesData.data && changesData.data.length > 0) {
                    const changeIds = changesData.data.map((c: any) => c.id);
                    await fetch('/api/profile-changes', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
                        body: JSON.stringify({ changeIds })
                    });
                }
            } catch (e) {
                console.error('Error marking changes as reviewed:', e);
            }
        }
        
        void fetchInfluencersPage({ page: 1, silent: true });
        void fetchPickerUsers();
        if (!currentStatus) {
                // Approval email is sent by /api/admin/influencers/update.
                fetch('/api/push/trigger-influencer-approved', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ influencerId: String(id), displayName: userName }),
                }).catch(() => {});
        }
    }
    
    if(selectedUser?.id === id) {
        setSelectedUser(prev => prev ? {...prev, approved: !currentStatus} : null);
    }
  };

  const toggleAnalyticsVerification = async (id: number, currentStatus: boolean) => {
    if (currentStatus) {
      const user = users.find((u) => u.id === id);
      const ok = await confirmAction({
        title: { el: "Αφαίρεση επαλήθευσης", en: "Remove verification" }[lang],
        body: {
          el: `Τα analytics του «${user?.display_name || id}» δεν θα εμφανίζονται πλέον ως επαληθευμένα.`,
          en: `Analytics for “${user?.display_name || id}” will no longer show as verified.`,
        }[lang],
        confirmLabel: { el: "Αφαίρεση", en: "Remove" }[lang],
        cancelLabel: { el: "Άκυρο", en: "Cancel" }[lang],
        danger: true,
      });
      if (!ok) return;
    }
    const response = await fetch('/api/admin/influencers/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
      body: JSON.stringify({
        influencerId: id,
        updates: {
          analytics_verified: !currentStatus,
          analytics_verified_at: !currentStatus ? new Date().toISOString() : null
        }
      })
    });
    const data = await response.json();
    
    if (data.success) {
        void fetchInfluencersPage({ page: 1, silent: true });
        void fetchPickerUsers();
    }
    
    if(selectedUser?.id === id) {
        setSelectedUser(prev => prev ? {...prev, analytics_verified: !currentStatus} : null);
    }
  };

  const LOCAL_AUDITPR_DEFAULT = 'http://127.0.0.1:8000';

  const isLegacyOracleAuditprUrl = (url: string): boolean =>
    url.includes('130.162.39.149') || url.includes('sslip.io');

  const normalizeAuditprUrl = (url: string): string => {
    const u = (url || '').trim().replace(/\/$/, '');
    if (!u || isLegacyOracleAuditprUrl(u)) return LOCAL_AUDITPR_DEFAULT;
    return u;
  };

  const isLocalAuditprUrl = (url: string): boolean => {
    try {
      const host = new URL(url).hostname;
      return host === 'localhost' || host === '127.0.0.1';
    } catch {
      return false;
    }
  };

  /** HTTPS pages cannot fetch remote HTTP (mixed content). Localhost is allowed. */
  const canBrowserFetchAuditpr = (url: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      const parsed = new URL(url);
      if (window.location.protocol === 'https:' && parsed.protocol === 'http:' && !isLocalAuditprUrl(url)) {
        return false;
      }
    } catch {
      return false;
    }
    return true;
  };

  const getStoredAuditprUrl = (): string => {
    if (typeof window === 'undefined') return LOCAL_AUDITPR_DEFAULT;
    const stored = localStorage.getItem('influo_auditpr_url') || '';
    const normalized = normalizeAuditprUrl(stored);
    if (stored !== normalized) {
      localStorage.setItem('influo_auditpr_url', normalized);
    }
    return normalized;
  };

  const promptAuditprUrl = (current?: string): string | null => {
    if (typeof window === 'undefined') return null;
    const stored = normalizeAuditprUrl(current || getStoredAuditprUrl());
    const promptMsg = lang === 'el'
      ? `Auditpr URL (τοπικά στο PC σας).\nΤρέξτε start-auditpr.bat — προεπιλογή: ${stored}`
      : `Auditpr URL (local on your PC).\nRun start-auditpr.bat — default: ${stored}`;
    const auditprUrl = prompt(promptMsg, stored);
    if (auditprUrl === null) return null;
    const url = normalizeAuditprUrl(auditprUrl);
    if (!url) {
      notify(lang === 'el'
        ? `Απαιτείται Auditpr URL (π.χ. ${LOCAL_AUDITPR_DEFAULT}). Βεβαιωθείτε ότι τρέχει το start-auditpr.bat.`
        : `Auditpr URL is required (e.g. ${LOCAL_AUDITPR_DEFAULT}). Make sure start-auditpr.bat is running.`);
      return null;
    }
    localStorage.setItem('influo_auditpr_url', url);
    return url;
  };

  const refreshSocialStats = async (user?: DbInfluencer) => {
    const okRefresh = await confirmAction({
      title: { el: "Ανανέωση στατιστικών", en: "Refresh stats" }[lang],
      body: user
        ? { el: `Θα ανανεωθούν τα social στατιστικά για «${user.display_name}».`, en: `Social stats for “${user.display_name}” will be refreshed.` }[lang]
        : { el: "Θα ελεγχθεί ποιοι creators χρειάζονται ανανέωση.", en: "Creators that need a refresh will be checked." }[lang],
      confirmLabel: { el: "Συνέχεια", en: "Continue" }[lang],
      cancelLabel: { el: "Άκυρο", en: "Cancel" }[lang],
    });
    if (!okRefresh) return;
    const idStr = user != null ? String(user.id) : null;
    if (idStr) setRefreshingSocialFor(idStr); else setRefreshingSocialAll(true);
    try {
      let instagramOverrides: Record<string, { followers: string; engagement_rate: string; avg_likes: string }> | undefined;
      let tiktokOverrides: Record<string, { followers: string; engagement_rate: string; avg_likes: string }> | undefined;
      let youtubeOverrides: Record<string, { followers: string; engagement_rate: string; avg_likes: string }> | undefined;
      let fetchErrors: string[] = [];
      let accountFetchResults: AccountFetchResult[] = [];
      let dueListForReport: { id: number; display_name: string; accounts: { platform?: string; username?: string }[] }[] = [];

      let accountsToFetch: { platform?: string; username?: string }[] = [];

      if (idStr && user?.accounts?.length) {
        accountsToFetch = user.accounts;
      } else if (!idStr) {
        const listRes = await fetch('/api/admin/refresh-social-stats', { method: 'GET', headers: await adminAuthHeaders() });
        const listData = await listRes.json();
        const dueList = (listData.influencers ?? []) as { id: number; display_name: string; accounts: { platform?: string; username?: string }[] }[];
        if (!dueList.length) {
          notify(lang === 'el' ? 'Δεν υπάρχουν influencers για ανανέωση (τελευταίες 15 ημέρες).' : 'No influencers due for refresh (last 15 days).');
          return;
        }
        const proceedAll = await confirmAction({
          title: { el: "Μαζική ανανέωση", en: "Refresh all due" }[lang],
          body:
            lang === "el"
              ? `Θα ανανεωθούν ${dueList.length} influencers (όσοι δεν έχουν ανανεωθεί τις τελευταίες 15 ημέρες). Τα metrics θα φορτωθούν από Auditpr και στο τέλος κατεβαίνει Excel. Μπορεί να πάρει αρκετά λεπτά.`
              : `This will refresh ${dueList.length} influencers (not refreshed in the last 15 days). Metrics come from Auditpr and an Excel report downloads at the end. This may take several minutes.`,
          confirmLabel: { el: "Συνέχεια", en: "Continue" }[lang],
          cancelLabel: { el: "Άκυρο", en: "Cancel" }[lang],
        });
        if (!proceedAll) return;
        dueListForReport = dueList;
        accountsToFetch = dueList.flatMap((inf) => inf.accounts ?? []);
      }

      const needsAuditpr = accountsToFetch.some((acc) => {
        const platform = (acc.platform || '').toLowerCase();
        return platform === 'instagram' || platform === 'tiktok' || platform === 'youtube';
      });

      if (needsAuditpr) {
        let auditprUrl = getStoredAuditprUrl();

        if (!canBrowserFetchAuditpr(auditprUrl)) {
          notify(lang === 'el'
            ? `Το Auditpr πρέπει να τρέχει τοπικά στο PC σας (${LOCAL_AUDITPR_DEFAULT}).\nΤρέξτε start-auditpr.bat και ξαναδοκιμάστε.\n\nΤρέχον URL: ${auditprUrl}`
            : `Auditpr must run locally on your PC (${LOCAL_AUDITPR_DEFAULT}).\nRun start-auditpr.bat and try again.\n\nCurrent URL: ${auditprUrl}`);
          return;
        }

        let health = await checkAuditprHealth(auditprUrl);
        if (!health.ok) {
          const prompted = promptAuditprUrl(auditprUrl);
          if (!prompted) return;
          auditprUrl = prompted;
          if (!canBrowserFetchAuditpr(auditprUrl)) return;
          health = await checkAuditprHealth(auditprUrl);
          if (!health.ok) {
            notify(lang === 'el'
              ? `Δεν συνδέεται το Auditpr στο ${auditprUrl}.\n${health.error || ''}\n\nΒεβαιωθείτε ότι τρέχει το start-auditpr.bat στο PC σας.`
              : `Cannot reach Auditpr at ${auditprUrl}.\n${health.error || ''}\n\nMake sure start-auditpr.bat is running on your PC.`);
            return;
          }
        }

        localStorage.setItem('influo_auditpr_url', auditprUrl);

        const bundle = await fetchAuditprOverridesForAccounts(auditprUrl, accountsToFetch, { delayMs: 1500 });
        fetchErrors = bundle.errors;
        accountFetchResults = bundle.accountResults;
        if (Object.keys(bundle.instagramOverrides).length > 0) instagramOverrides = bundle.instagramOverrides;
        if (Object.keys(bundle.tiktokOverrides).length > 0) tiktokOverrides = bundle.tiktokOverrides;
        if (Object.keys(bundle.youtubeOverrides).length > 0) youtubeOverrides = bundle.youtubeOverrides;

        const fetchedCount =
          Object.keys(bundle.instagramOverrides).length +
          Object.keys(bundle.tiktokOverrides).length +
          Object.keys(bundle.youtubeOverrides).length;
        if (fetchedCount === 0) {
          notify(lang === 'el'
            ? `Δεν ανανεώθηκε κανένα account από το Auditpr.\n\n${fetchErrors.join('\n') || 'Άγνωστο σφάλμα.'}`
            : `No accounts were refreshed from Auditpr.\n\n${fetchErrors.join('\n') || 'Unknown error.'}`);
          return;
        }
      }

      const body: {
        influencerId?: string;
        instagramOverrides?: Record<string, { followers: string; engagement_rate: string; avg_likes: string }>;
        tiktokOverrides?: Record<string, { followers: string; engagement_rate: string; avg_likes: string }>;
        youtubeOverrides?: Record<string, { followers: string; engagement_rate: string; avg_likes: string }>;
      } = idStr ? { influencerId: idStr } : {};
      if (instagramOverrides && Object.keys(instagramOverrides).length > 0) body.instagramOverrides = instagramOverrides;
      if (tiktokOverrides && Object.keys(tiktokOverrides).length > 0) body.tiktokOverrides = tiktokOverrides;
      if (youtubeOverrides && Object.keys(youtubeOverrides).length > 0) body.youtubeOverrides = youtubeOverrides;
      const res = await fetch('/api/admin/refresh-social-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let data: { error?: string; message?: string; refreshed?: number; results?: { name: string; errors?: string[] }[] };
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(raw.slice(0, 280) || `HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(data.error || 'Failed');
      const summary = data.results?.length
        ? data.results.map((r: { name: string; errors?: string[] }) => {
            const errs = [...(r.errors || [])];
            if (idStr) {
              for (const fe of fetchErrors) {
                if (!errs.includes(fe)) errs.push(fe);
              }
            }
            if (errs.length) {
              return lang === 'el'
                ? `${r.name}: ΛΑΘΟΣ — ${errs.join('; ')}`
                : `${r.name}: ERROR — ${errs.join('; ')}`;
            }
            return `${r.name}: OK`;
          }).join('\n')
        : '';
      const fetchNote = !idStr && fetchErrors.length
        ? (lang === 'el' ? '\n\nAuditpr (μερικά απέτυχαν):\n' : '\n\nAuditpr (some failed):\n') + fetchErrors.join('\n')
        : '';
      const hasAnyError =
        fetchErrors.length > 0 ||
        (Array.isArray(data.results) && data.results.some((r: { errors?: string[] }) => !!r.errors?.length));
      const doneLabel = hasAnyError
        ? (lang === 'el' ? 'Η ανανέωση βρήκε σφάλματα' : 'Refresh finished with errors')
        : (data.message || 'Done');

      if (!idStr && dueListForReport.length > 0) {
        try {
          await downloadSocialRefreshReportExcel({
            lang,
            dueList: dueListForReport,
            accountResults: accountFetchResults,
            refreshResults: (data.results ?? []) as { id: string; name: string; accounts: number; errors?: string[] }[],
          });
        } catch (exportErr) {
          console.error('[Admin] Excel export failed:', exportErr);
          notify(lang === 'el'
            ? 'Η ανανέωση ολοκληρώθηκε αλλά η εξαγωγή Excel απέτυχε. Δείτε την κονσόλα.'
            : 'Refresh completed but Excel export failed. Check the console.');
        }
      }

      const excelNote = !idStr && dueListForReport.length > 0
        ? (lang === 'el' ? '\n\n📊 Κατέβηκε αρχείο Excel με αναλυτικά αποτελέσματα.' : '\n\n📊 Excel report downloaded with detailed results.')
        : '';
      notify(doneLabel + ': ' + data.refreshed + (summary ? '\n\n' + summary : '') + fetchNote + excelNote);
      void fetchInfluencersPage({ page: 1, silent: true });
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Error');
    } finally {
      setRefreshingSocialFor(null);
      setRefreshingSocialAll(false);
    }
  };

  const refreshAudit = async (user: DbInfluencer) => {
    const idStr = String(user.id);
    setRefreshingAuditFor(idStr);
    try {
      const res = await fetch('/api/admin/refresh-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
        body: JSON.stringify({ influencerId: idStr }),
      });
      const ct = res.headers.get('content-type') || '';
      let data: { error?: string; auditpr_audit?: unknown } = {};
      if (ct.includes('application/json')) {
        data = await res.json();
      } else {
        const raw = await res.text();
        const snippet = raw.replace(/\s+/g, ' ').slice(0, 180);
        throw new Error(
          lang === 'el'
            ? `Το API επέστρεψε μη έγκυρη απάντηση (όχι JSON). HTTP ${res.status}. ${snippet}`
            : `API returned non-JSON response. HTTP ${res.status}. ${snippet}`
        );
      }
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      if (data.auditpr_audit && selectedUser?.id === user.id) {
        setSelectedUser(prev => prev ? { ...prev, auditpr_audit: data.auditpr_audit } : null);
      }
      void fetchInfluencersPage({ page: 1, silent: true });
      notify(lang === 'el' ? 'Η αξιολόγηση AI ανανεώθηκε.' : 'AI audit refreshed.');
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Error');
    } finally {
      setRefreshingAuditFor(null);
    }
  };
  
  const deleteUser = async (id: number) => {
    // Find user details for confirmation
    const user = users.find(u => u.id === id);
    const userEmail = user?.contact_email || 'unknown';
    const userName = user?.display_name || 'unknown';
    if (user && isProtectedTestAccount(user)) {
      notify(protectedDeleteMessage(lang), "error");
      return;
    }
    
    const ok = await confirmAction({
      title: lang === "el" ? "Διαγραφή influencer" : "Delete influencer",
      body: lang === "el"
        ? `Διαγραφή του «${userName}» (${userEmail}); Θα αφαιρεθούν το προφίλ, ο λογαριασμός σύνδεσης, οι συνομιλίες και οι προτάσεις. Δεν αναιρείται.`
        : `Delete “${userName}” (${userEmail})? This removes the profile, login, conversations and proposals. It cannot be undone.`,
      confirmLabel: lang === "el" ? "Διαγραφή" : "Delete",
      cancelLabel: lang === "el" ? "Άκυρο" : "Cancel",
      danger: true,
    });
    if (!ok) return;

    try {
        const response = await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
            body: JSON.stringify({ 
              userId: id,
              adminEmail: adminEmail // Pass admin email for audit log
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            if (result.error === "protected_test_account") {
              notify(protectedDeleteMessage(lang), "error");
              return;
            }
            throw new Error(result.error || 'Failed to delete user');
        }

        void fetchInfluencersPage({ page: 1, silent: true });
        void fetchPickerUsers();
        setSelectedUser(null);
        setSelectedUsers(selectedUsers.filter(uId => uId !== id));
        
        notify(lang === 'el' 
          ? `Ο χρήστης "${userName}" διαγράφηκε επιτυχώς.`
          : `User "${userName}" deleted successfully.`
        );
    } catch (error: any) {
        console.error('Error deleting user:', error);
        notify(`Σφάλμα: ${error.message}`);
    }
  };

  const handleUserUpdate = (updatedUser: DbInfluencer) => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === updatedUser.id
            ? {
                ...u,
                display_name: updatedUser.display_name,
                contact_email: updatedUser.contact_email,
                avatar_url: updatedUser.avatar_url,
                location: updatedUser.location,
                category: updatedUser.category,
                approved: updatedUser.approved,
                analytics_verified: updatedUser.analytics_verified,
                verified: updatedUser.verified,
                accounts: updatedUser.accounts,
                min_rate: updatedUser.min_rate,
                auth_user_id: updatedUser.auth_user_id,
              }
            : u
        )
      );
      void fetchPickerUsers();
      setShowEditModal(false);
      setSelectedUser(updatedUser);
  };

  const handleToggleBrandVerification = async (brandId: string, currentStatus: boolean) => {
    if (currentStatus) {
      const brand = brands.find((b) => b.id === brandId);
      const ok = await confirmAction({
        title: lang === "el" ? "Απόρριψη επιχείρησης" : "Reject company",
        body: lang === "el"
          ? `Η «${brand?.brand_name || ""}» θα χάσει την επαλήθευση και δεν θα μπορεί να δημοσιεύει ανοιχτές καμπάνιες.`
          : `“${brand?.brand_name || ""}” will lose verification and cannot publish open campaigns.`,
        confirmLabel: lang === "el" ? "Απόρριψη" : "Reject",
        cancelLabel: lang === "el" ? "Άκυρο" : "Cancel",
        danger: true,
      });
      if (!ok) return;
    }
    setUpdatingBrand(brandId);
    try {
      const response = await fetch('/api/admin/brands/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
        body: JSON.stringify({
          brandId,
          verified: !currentStatus
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update brand verification');
      }

      // Update local state
      setBrands(prev => prev.map(b => 
        b.id === brandId ? { ...b, verified: !currentStatus } : b
      ));

      notify(lang === 'el' 
        ? `Η επιχείρηση ${!currentStatus ? 'εγκρίθηκε' : 'απορρίφθηκε'} επιτυχώς.`
        : `Brand ${!currentStatus ? 'verified' : 'unverified'} successfully.`
      );
    } catch (error: any) {
      console.error('Error toggling brand verification:', error);
      notify(lang === 'el' 
        ? `Σφάλμα: ${error.message}`
        : `Error: ${error.message}`
      );
    } finally {
      setUpdatingBrand(null);
    }
  };

  const handleUpdateBrand = async (updatedBrand: Partial<Brand> & { clearFields?: string[] }) => {
    if (!selectedBrand) return;
    
    setUpdatingBrand(selectedBrand.id);
    try {
      const { clearFields, ...fields } = updatedBrand;
      const response = await fetch('/api/admin/brands/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
        body: JSON.stringify({
          brandId: selectedBrand.id,
          lang,
          ...fields,
          ...(clearFields?.length ? { clearFields } : {}),
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update brand');
      }

      // Update local state from server response (normalized URLs / bio)
      const saved = (result.brand || fields) as Partial<Brand>;
      setBrands(prev => prev.map(b => 
        b.id === selectedBrand.id ? { ...b, ...saved } : b
      ));

      notify(lang === 'el' 
        ? 'Η επιχείρηση ενημερώθηκε επιτυχώς.'
        : 'Brand updated successfully.'
      );
      
      setShowBrandEditModal(false);
      setSelectedBrand(null);
    } catch (error: any) {
      console.error('Error updating brand:', error);
      notify(lang === 'el' 
        ? `Σφάλμα: ${error.message}`
        : `Error: ${error.message}`
      );
    } finally {
      setUpdatingBrand(null);
    }
  };

  const deleteBrand = async (brandId: string, brandName: string) => {
    const brand = brands.find((b) => b.id === brandId);
    if (isProtectedTestAccount({ brand_name: brandName, contact_email: brand?.contact_email })) {
      notify(protectedDeleteMessage(lang), "error");
      return;
    }
    const ok = await confirmAction({
      title: lang === "el" ? "Διαγραφή επιχείρησης" : "Delete company",
      body: lang === "el"
        ? `Διαγραφή της «${brandName}»; Η ενέργεια δεν αναιρείται.`
        : `Delete “${brandName}”? This cannot be undone.`,
      confirmLabel: lang === "el" ? "Διαγραφή" : "Delete",
      cancelLabel: lang === "el" ? "Άκυρο" : "Cancel",
      danger: true,
    });
    if (!ok) return;

    setDeletingBrand(brandId);
    try {
      const response = await fetch('/api/admin/delete-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
        body: JSON.stringify({ brandId }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.error === "protected_test_account") {
          notify(protectedDeleteMessage(lang), "error");
          return;
        }
        throw new Error(result.error || 'Failed to delete brand');
      }

      // Remove from local state
      setBrands(prev => prev.filter(b => b.id !== brandId));

      notify(lang === 'el' 
        ? `Η επιχείρηση "${brandName}" διαγράφηκε επιτυχώς.`
        : `Brand "${brandName}" deleted successfully.`
      );
    } catch (error: any) {
      console.error('Error deleting brand:', error);
      notify(lang === 'el' 
        ? `Σφάλμα: ${error.message}`
        : `Error: ${error.message}`
      );
    } finally {
      setDeletingBrand(null);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    const ok = await confirmAction({
      title: lang === "el" ? "Διαγραφή συνομιλίας" : "Delete conversation",
      body:
        lang === "el"
          ? "Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή τη συνομιλία; Αυτή η ενέργεια θα διαγράψει και όλα τα μηνύματα και τα σχετικά στατιστικά."
          : "Are you sure you want to delete this conversation? This will also delete all messages and related statistics.",
      confirmLabel: lang === "el" ? "Διαγραφή" : "Delete",
      cancelLabel: lang === "el" ? "Άκυρο" : "Cancel",
      danger: true,
    });
    if (!ok) return;

    setDeletingConversation(conversationId);
    try {
      const response = await fetch('/api/admin/delete-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
        body: JSON.stringify({ conversationId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete conversation');
      }

      // Remove from local state
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
      // Clear selected conversation if it was deleted
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
        setConversationMessages([]);
      }

      notify(lang === 'el' 
        ? 'Η συνομιλία διαγράφηκε επιτυχώς.'
        : 'Conversation deleted successfully.'
      );
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      notify(lang === 'el' 
        ? `Σφάλμα: ${error.message}`
        : `Error: ${error.message}`
      );
    } finally {
      setDeletingConversation(null);
    }
  };

  const handleDeleteProposal = async (proposalId: number) => {
    const ok = await confirmAction({
      title: lang === "el" ? "Διαγραφή πρότασης" : "Delete proposal",
      body:
        lang === "el"
          ? "Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την πρόταση; Αυτή η ενέργεια θα διαγράψει και τα σχετικά στατιστικά."
          : "Are you sure you want to delete this proposal? This will also delete related statistics.",
      confirmLabel: lang === "el" ? "Διαγραφή" : "Delete",
      cancelLabel: lang === "el" ? "Άκυρο" : "Cancel",
      danger: true,
    });
    if (!ok) return;

    setDeletingProposal(proposalId);
    try {
      const response = await fetch('/api/admin/delete-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
        body: JSON.stringify({ proposalId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete proposal');
      }

      // Remove from local state and recalc unseen pending badge
      setProposals(prev => {
        const next = prev.filter(p => p.id !== proposalId);
        setPendingProposalsCount(countUnseenPendingProposals(next));
        return next;
      });

      notify(lang === 'el' 
        ? 'Η πρόταση διαγράφηκε επιτυχώς.'
        : 'Proposal deleted successfully.'
      );
    } catch (error: any) {
      console.error('Error deleting proposal:', error);
      notify(lang === 'el' 
        ? `Σφάλμα: ${error.message}`
        : `Error: ${error.message}`
      );
    } finally {
      setDeletingProposal(null);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'delete') => {
    if (selectedUsers.length === 0) {
      notify(lang === "el" ? "Επιλέξτε τουλάχιστον έναν χρήστη" : "Select at least one user");
      return;
    }

    const deletableIds =
      action === "delete"
        ? selectedUsers.filter((id) => {
            const row = users.find((u) => u.id === id);
            return !row || !isProtectedTestAccount(row);
          })
        : selectedUsers;
    if (action === "delete" && deletableIds.length === 0) {
      notify(protectedDeleteMessage(lang), "error");
      return;
    }
    if (action === 'delete') {
      const skipped = selectedUsers.length - deletableIds.length;
      const ok = await confirmAction({
        title: lang === "el" ? "Μαζική διαγραφή" : "Bulk delete",
        body:
          lang === "el"
            ? `Διαγραφή ${deletableIds.length} χρηστών; Δεν αναιρείται.${skipped ? ` Ο λογαριασμός test (${skipped}) θα μείνει.` : ""}`
            : `Delete ${deletableIds.length} users? This cannot be undone.${skipped ? ` The test account (${skipped}) will be kept.` : ""}`,
        confirmLabel: lang === "el" ? "Διαγραφή" : "Delete",
        cancelLabel: lang === "el" ? "Άκυρο" : "Cancel",
        danger: true,
      });
      if (!ok) return;
    }

    try {
      for (const userId of action === "delete" ? deletableIds : selectedUsers) {
        if (action === 'approve') {
          const response = await fetch('/api/admin/influencers/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
            body: JSON.stringify({
              influencerId: userId,
              updates: {
                approved: true,
                approved_at: new Date().toISOString()
              }
            })
          });
          const data = await response.json();
          if (data.success) {
            try {
              const approvedUser = users.find((u) => u.id === userId);
              await fetch('/api/push/trigger-influencer-approved', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  influencerId: String(userId),
                  displayName: approvedUser?.display_name || 'Influencer',
                }),
              });
              await new Promise((r) => setTimeout(r, 500));
            } catch (e) {
              console.error('[Admin] Influencer approved push error for', userId, e);
            }
          }
        } else {
          await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) },
            body: JSON.stringify({ 
              userId,
              adminEmail: adminEmail // Pass admin email for audit log
            }),
          });
        }
      }
      setSelectedUsers([]);
      void fetchInfluencersPage({ page: 1, silent: true });
      void fetchPickerUsers();
      notify(lang === "el" ? "Ολοκληρώθηκε" : "Completed");
    } catch (error: any) {
      notify(`Error: ${error.message}`);
    }
  };

  const exportData = async () => {
    try {
      const rows: DbInfluencer[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          status: statusFilter,
          sort: "created_at",
          order: "desc",
        });
        if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
        const res = await fetch(`/api/admin/influencers?${params}`, {
          headers: await adminAuthHeaders(),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Export failed");
        const batch = (Array.isArray(body.influencers) ? body.influencers : []) as DbInfluencer[];
        rows.push(...batch);
        hasMore = !!body.hasMore;
        page += 1;
        if (page > 500) break;
      }
      const csv = [
        ['Name', 'Email', 'Location', 'Status', 'Min Rate', 'Created'].join(','),
        ...rows.map(u => [
          u.display_name,
          u.contact_email || '',
          u.location || '',
          (u.approved ? 'Approved' : 'Not Approved') + ' / ' + (u.analytics_verified ? 'Analytics Verified' : 'Not Verified'),
          u.min_rate || '',
          u.created_at
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `influencers-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (error: any) {
      notify(error?.message || 'Export failed');
    }
  };

  const pendingBrandCount = brandCounts.pending;
  const visibleBrands = brands;

  /** Server already applied search + status filters; `users` is the current loaded page(s). */
  const filteredUsers = users;

  const toggleUserSelection = (id: number) => {
    setSelectedUsers(prev => 
      prev.includes(id) ? prev.filter(uId => uId !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const influencerActions = (u: DbInfluencer) => {
    const locked = isProtectedTestAccount(u);
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { void openEditUser(u); }} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
            {txt.edit}
          </button>
          {!u.approved && (
            <button type="button" onClick={() => toggleApproval(u.id, false, u.contact_email || "", u.display_name)} className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white">
              {txt.btn_approve}
            </button>
          )}
          {!u.analytics_verified && (
            <button type="button" onClick={() => toggleAnalyticsVerification(u.id, false)} className="inline-flex min-h-11 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-800">
              {txt.btn_verify_analytics}
            </button>
          )}
          <button type="button" onClick={() => refreshSocialStats(u)} disabled={refreshingSocialFor === String(u.id)} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:opacity-50">
            {refreshingSocialFor === String(u.id) ? "..." : txt.refresh_social}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-red-100 pt-2">
          {u.approved && (
            <button type="button" onClick={() => toggleApproval(u.id, true, u.contact_email || "", u.display_name)} className="inline-flex min-h-11 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700">
              {txt.btn_unapprove}
            </button>
          )}
          {u.analytics_verified && (
            <button type="button" onClick={() => toggleAnalyticsVerification(u.id, true)} className="inline-flex min-h-11 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700">
              {txt.btn_unverify_analytics}
            </button>
          )}
          <button
            type="button"
            onClick={() => deleteUser(u.id)}
            disabled={locked}
            title={locked ? protectedDeleteMessage(lang) : undefined}
            className="inline-flex min-h-11 items-center rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {locked ? protectedDeleteMessage(lang) : txt.btn_delete}
          </button>
        </div>
      </div>
    );
  };

  const needsAction = [
    ...influencerAttention.map((row) => ({
      key: `creator-${row.id}`,
      title: row.display_name || row.contact_email || String(row.id),
      detail: { el: "Δημιουργός σε αναμονή έγκρισης", en: "Creator waiting for approval" }[lang],
      when: row.created_at,
      onOpen: () => {
        setStatusFilter("pending");
        setActiveTab("influencers");
      },
    })),
    ...brandAttention.map((row) => ({
      key: `brand-${row.id}`,
      title: row.brand_name,
      detail: { el: "Επιχείρηση σε αναμονή έγκρισης", en: "Company waiting for approval" }[lang],
      when: row.created_at,
      onOpen: () => {
        setBrandStatusFilter("pending");
        setActiveTab("brands");
      },
    })),
    ...proposalAttention.map((row) => ({
      key: `proposal-${row.id}`,
      title: `${row.brand_name} → ${row.influencer_name || "—"}`,
      detail: {
        el: `Πρόταση ${formatEuroAmount(row.budget, "el")} σε αναμονή`,
        en: `Proposal of ${formatEuroAmount(row.budget, "en")} is waiting`,
      }[lang],
      when: row.created_at,
      onOpen: () => {
        setProposalStatus("pending");
        setActiveTab("proposals");
        markPendingProposalsSeen(pendingProposalIdList.map((id) => ({ id, status: "pending" })));
        setPendingProposalsCount(0);
      },
    })),
  ];
  const overviewBusy = influencersLoading || brandsLoading || proposalsLoading;
  const overviewFailed = influencersError || brandsError || proposalsError;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{txt.title}</h1>
              <p className="text-sm text-slate-500 truncate">{txt.sub}</p>
            </div>
            <div className="hidden md:flex flex-wrap items-center gap-2">
              <a href="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Home className="w-4 h-4" aria-hidden="true" />
                {{ el: "Αρχική", en: "Home" }[lang]}
              </a>
              <a href="/admin/support" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-purple-200 px-3 text-sm font-medium text-purple-700 hover:bg-purple-50">
                <LifeBuoy className="w-4 h-4" aria-hidden="true" />
                Help Desk
              </a>
              <button
                type="button"
                onClick={() => {
                  const newLang = lang === "el" ? "en" : "el";
                  setLang(newLang);
                  setStoredLanguage(newLang);
                }}
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                {lang === "el" ? "EN" : "ΕΛ"}
              </button>
              <button type="button" onClick={() => void logoutEverywhere("/login")} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <LogOut className="w-4 h-4" aria-hidden="true" />
                {txt.logout}
              </button>
            </div>
            <button
              type="button"
              className="md:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700"
              aria-label={{ el: "Μενού", en: "Menu" }[lang]}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
            </button>
          </div>
          {menuOpen ? (
            <div className="md:hidden mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
              <a href="/" className="min-h-11 inline-flex items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Home className="w-4 h-4" aria-hidden="true" />
                {{ el: "Αρχική", en: "Home" }[lang]}
              </a>
              <a href="/admin/support" className="min-h-11 inline-flex items-center gap-2 rounded-lg px-3 text-sm font-medium text-purple-700 hover:bg-purple-50">
                <LifeBuoy className="w-4 h-4" aria-hidden="true" />
                Help Desk
              </a>
              <button
                type="button"
                onClick={() => {
                  const newLang = lang === "el" ? "en" : "el";
                  setLang(newLang);
                  setStoredLanguage(newLang);
                  setMenuOpen(false);
                }}
                className="min-h-11 text-left rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                {lang === "el" ? "English" : "Ελληνικά"}
              </button>
              <button type="button" onClick={() => void logoutEverywhere("/login")} className="min-h-11 inline-flex items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <LogOut className="w-4 h-4" aria-hidden="true" />
                {txt.logout}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative bg-white rounded-xl border border-slate-200 mb-6 overflow-hidden">
          <nav
            role="tablist"
            aria-label={{ el: "Ενότητες πίνακα", en: "Dashboard sections" }[lang]}
            className="flex gap-2 overflow-x-auto snap-x snap-mandatory px-3 py-2 md:gap-0 md:overflow-visible md:snap-none md:px-0 md:py-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {(
              [
                { id: "overview", label: { el: "Επισκόπηση", en: "Overview" }[lang], icon: LayoutDashboard, count: 0 },
                { id: "influencers", label: txt.tab_inf, icon: Users, count: 0 },
                { id: "influencer_stats", label: txt.tab_inf_analytics, icon: BarChart3, count: 0 },
                { id: "proposals", label: txt.tab_deals, icon: FileText, count: pendingProposalsCount },
                { id: "conversations", label: { el: "Συνομιλίες", en: "Conversations" }[lang], icon: MessageSquare, count: unreadMessagesCount },
                { id: "brands", label: txt.tab_brands, icon: Building2, count: unseenBrandCount },
                { id: "campaigns", label: txt.tab_campaigns, icon: Megaphone, count: unseenCampaignCount },
                { id: "blog", label: txt.tab_blog, icon: Newspaper, count: 0 },
                { id: "announcements", label: txt.tab_announcements, icon: Bell, count: 0 },
                { id: "social_cron", label: txt.tab_social_cron, icon: Activity, count: 0 },
              ] as const
            ).map((tab) => {
              const selected = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    if (tab.id === "proposals") {
                      markPendingProposalsSeen(pendingProposalIdList.map((id) => ({ id, status: "pending" })));
                      setPendingProposalsCount(0);
                    }
                    if (tab.id === "campaigns") void fetchAdminCampaigns();
                    setActiveTab(tab.id);
                    setMenuOpen(false);
                  }}
                  className={`inline-flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors md:min-h-0 md:rounded-none md:px-4 md:py-4 md:text-base md:border-b-2 ${
                    selected
                      ? "bg-blue-600 text-white md:bg-transparent md:text-blue-600 md:border-blue-600"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 md:bg-transparent md:text-slate-500 md:hover:text-slate-700 md:border-transparent"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {tab.label}
                  {tab.count > 0 ? (
                    <span className={`text-xs font-bold rounded-full min-w-[18px] h-[18px] inline-flex items-center justify-center px-1 ${selected ? "bg-white text-blue-700 md:bg-red-500 md:text-white" : "bg-red-500 text-white"}`}>
                      {tab.count > 99 ? "99+" : tab.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent md:hidden" aria-hidden="true" />
        </div>

        {activeTab === "overview" && (
          <div className="space-y-6">
            {overviewFailed && !overviewBusy ? (
              <AdminLoadError
                lang={lang}
                timedOut={overviewFailed === "timeout"}
                onRetry={() => {
                  void fetchInfluencersPage({ page: 1, q: debouncedSearch, status: statusFilter });
                  void fetchBrands({ page: 1 });
                  void fetchProposals({ page: 1 });
                }}
              />
            ) : null}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(
                [
                  {
                    label: { el: "Εκκρεμείς εγκρίσεις", en: "Pending approvals" }[lang],
                    value: stats.pending + brandCounts.pending,
                    hint: { el: "Creators και επιχειρήσεις", en: "Creators and companies" }[lang],
                    onClick: () => {
                      setStatusFilter("pending");
                      setActiveTab("influencers");
                    },
                  },
                  {
                    label: { el: "Νέοι creators / brands", en: "New creators / brands" }[lang],
                    value: `${influencerRecent} / ${brandCounts.recent}`,
                    hint: { el: "Τελευταίες 7 ημέρες", en: "Last 7 days" }[lang],
                    onClick: () => setActiveTab("influencers"),
                  },
                  {
                    label: { el: "Ενεργές συνεργασίες", en: "Active collaborations" }[lang],
                    value: proposalCounts.active,
                    hint: { el: "Αποδεκτές και ολοκληρωμένες", en: "Accepted and completed" }[lang],
                    onClick: () => {
                      setProposalStatus("accepted");
                      setActiveTab("proposals");
                    },
                  },
                  {
                    label: { el: "Προτάσεις", en: "Proposals" }[lang],
                    value: proposalCounts.total,
                    hint:
                      proposalCounts.pending > 0
                        ? { el: `${proposalCounts.pending} σε αναμονή`, en: `${proposalCounts.pending} waiting` }[lang]
                        : { el: "Σύνολο", en: "Total" }[lang],
                    onClick: () => setActiveTab("proposals"),
                  },
                ]
              ).map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={card.onClick}
                  className="min-h-[88px] rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300 hover:shadow-sm transition-shadow"
                >
                  <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                    {overviewBusy && card.value === 0 ? <span className="inline-block h-7 w-12 rounded bg-slate-100 animate-pulse" /> : card.value}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{card.label}</p>
                  <p className="mt-1 text-xs text-slate-400">{card.hint}</p>
                </button>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-slate-900">
                  {{ el: "Χρειάζονται ενέργεια", en: "Needs action" }[lang]}
                </h2>
                {overviewBusy && needsAction.length === 0 ? (
                  <div className="mt-4 h-24 rounded-lg bg-slate-100 animate-pulse" />
                ) : needsAction.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">
                    {{ el: "Είσαι ενήμερος. Δεν εκκρεμεί κάποια ενέργεια.", en: "You are up to date. Nothing needs action." }[lang]}
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {needsAction.slice(0, 8).map((item) => (
                      <li key={item.key} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{item.title}</p>
                          <p className="text-sm text-slate-600">{item.detail}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{formatDate(item.when, lang)} {formatTime(item.when, lang)}</p>
                        </div>
                        <button type="button" onClick={item.onOpen} className="shrink-0 min-h-11 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 rounded-lg">
                          {{ el: "Άνοιγμα", en: "Open" }[lang]}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-slate-900">
                  {{ el: "Πλατφόρμα", en: "Platform" }[lang]}
                </h2>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">{txt.users}</dt>
                    <dd className="text-xl font-semibold text-slate-900 tabular-nums">{stats.total}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">{txt.verified}</dt>
                    <dd className="text-xl font-semibold text-slate-900 tabular-nums">{stats.verified}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">{txt.pipeline}</dt>
                    <dd className="text-xl font-semibold text-slate-900 tabular-nums">{stats.pipeline}</dd>
                  </div>
                  {stats.reach != null && stats.reach !== "" ? (
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">{txt.reach}</dt>
                      <dd className="text-xl font-semibold text-slate-900 tabular-nums">{stats.reach}</dd>
                    </div>
                  ) : null}
                </dl>
                {typeof stats.hiddenVideos === "number" ? (
                  <button
                    type="button"
                    onClick={() => setShowHiddenVideosPanel((v) => !v)}
                    className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-orange-200 bg-orange-50 px-3 text-sm font-medium text-orange-900"
                  >
                    {{ el: "Κρυφά βίντεο", en: "Hidden videos" }[lang]}: {stats.hiddenVideos}
                  </button>
                ) : null}
              </section>
            </div>
            {showHiddenVideosPanel ? (
          <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50/60 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold text-orange-950">
                {lang === "en"
                  ? "Hidden portfolio videos by profile"
                  : "Κρυφά βίντεο portfolio ανά προφίλ"}
              </h3>
              <button
                type="button"
                className="text-xs font-medium text-orange-800 hover:underline"
                onClick={() => setShowHiddenVideosPanel(false)}
              >
                {lang === "en" ? "Close" : "Κλείσιμο"}
              </button>
            </div>
            {hiddenByProfile.length === 0 ? (
              <p className="text-sm text-orange-900/80">
                {lang === "en" ? "No hidden videos." : "Δεν υπάρχουν κρυφά βίντεο."}
              </p>
            ) : (
              <ul className="space-y-3 max-h-80 overflow-y-auto">
                {hiddenByProfile.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold text-slate-900">
                        {row.display_name || row.id}
                      </span>
                      <span className="text-xs font-medium text-orange-800">
                        {row.count}{" "}
                        {lang === "en" ? "hidden" : "κρυφά"}
                      </span>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {row.urls.map((url) => (
                        <li key={url} className="break-all text-xs text-slate-600">
                          {url}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
            ) : null}
          </div>
        )}

        {activeTab !== "overview" && (
        <div className="bg-white rounded-xl border border-slate-200 mb-4 overflow-hidden">
          {activeTab === "influencers" && (
            <>
              {/* Search & Filters (server-side) */}
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={lang === "el" ? "Αναζήτηση ονόματος, email ή username…" : "Search name, email, or username…"}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "verified" | "pending")}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">{txt.filter}: {lang === "el" ? "Όλοι" : "All"}</option>
                  <option value="verified">{lang === "el" ? "Εγκεκριμένοι" : "Approved"}</option>
                  <option value="pending">{lang === "el" ? "Εκκρεμείς" : "Pending"}</option>
                </select>
                <button
                  onClick={exportData}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                >
                  {txt.export}
                </button>
                <button
                  onClick={() => refreshSocialStats()}
                  disabled={refreshingSocialAll}
                  className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {refreshingSocialAll ? '...' : txt.refresh_social_all}
                </button>
                <button
                  onClick={async () => {
                    const okAudit = await confirmAction({
                      title: { el: "Gemini audit", en: "Gemini audit" }[lang],
                      body: { el: "Θα τρέξει Gemini audit για όλους σε batch (15-15). Θα δεις την πρόοδο και θα τελειώσει μόνο του.", en: "This runs a Gemini audit for everyone in batches of 15. You will see progress until it finishes." }[lang],
                      confirmLabel: { el: "Συνέχεια", en: "Continue" }[lang],
                      cancelLabel: { el: "Άκυρο", en: "Cancel" }[lang],
                    });
                    if (!okAudit) return;
                    setBackfillingAudit(true);
                    setBackfillProgress(lang === 'el' ? 'Ξεκίνημα...' : 'Starting...');
                    let totalUpdated = 0;
                    const limit = 15;
                    let skip = 0;
                    try {
                      while (true) {
                        setBackfillProgress(lang === 'el' ? `${totalUpdated} ενημερώθηκαν μέχρι τώρα...` : `${totalUpdated} updated so far...`);
                        const res = await fetch('/api/admin/backfill-audit', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await adminAuthHeaders()) }, body: JSON.stringify({ limit, skip }) });
                        const contentType = res.headers.get('content-type') ?? '';
                        let data: { updated?: number; hasMore?: boolean; errors?: string[]; error?: string } = {};
                        if (contentType.includes('application/json')) {
                          data = await res.json();
                        } else {
                          const text = await res.text();
                          const is524 = res.status === 524;
                          const msg = text.startsWith('<')
                            ? (is524
                              ? (lang === 'el' ? 'Timeout (524): το batch διήρκησε πολύ.' : 'Timeout (524): batch took too long.')
                              : (lang === 'el' ? `Ο server απάντησε με HTML. Status: ${res.status}` : `Server returned HTML. Status: ${res.status}`))
                            : `HTTP ${res.status}: ${text.slice(0, 200)}`;
                          throw new Error(msg);
                        }
                        if (!res.ok) {
                          notify((data.error || res.statusText) as string);
                          break;
                        }
                        const batchUpdated = data.updated ?? 0;
                        totalUpdated += batchUpdated;
                        if (!data.hasMore || batchUpdated === 0) {
                          setBackfillProgress(null);
                          notify(lang === 'el' ? `Ολοκλήρωση: ${totalUpdated} influencers ενημερώθηκαν συνολικά.` : `Done: ${totalUpdated} influencers updated in total.`);
                          break;
                        }
                        skip += limit;
                        await new Promise((r) => setTimeout(r, 300));
                      }
                    } catch (e) {
                      setBackfillProgress(null);
                      notify(e instanceof Error ? e.message : 'Failed');
                    } finally {
                      setBackfillingAudit(false);
                      setBackfillProgress(null);
                    }
                  }}
                  disabled={backfillingAudit}
                  className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {backfillingAudit ? '...' : txt.backfill_audit}
                </button>
                {backfillProgress && (
                  <span className="text-sm text-amber-700 ml-1">
                    {backfillProgress}
                  </span>
                )}
              </div>

              {/* Bulk Actions */}
              {selectedUsers.length > 0 && (
                <div className="px-4 py-3 bg-blue-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-sm text-slate-700">
                    {selectedUsers.length} {lang === "el" ? "επιλεγμένοι" : "selected"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBulkAction('approve')}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      {txt.bulk_approve}
                    </button>
                    <button
                      onClick={() => handleBulkAction('delete')}
                      className="inline-flex min-h-11 items-center px-3 text-sm font-medium border border-red-200 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      {txt.bulk_delete}
                    </button>
                  </div>
                </div>
              )}

              {influencersLoading && filteredUsers.length === 0 ? (
                <AdminListSkeleton />
              ) : influencersError && filteredUsers.length === 0 ? (
                <AdminLoadError
                  lang={lang}
                  timedOut={influencersError === "timeout"}
                  onRetry={() => void fetchInfluencersPage({ page: influencersPage, q: debouncedSearch, status: statusFilter })}
                />
              ) : (
              <div>
                <div className="md:hidden divide-y divide-slate-200">
                  {filteredUsers.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-slate-500">{txt.no_data}</p>
                  ) : filteredUsers.map((u) => (
                    <article key={u.id} className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={selectedUsers.includes(u.id)} onChange={() => toggleUserSelection(u.id)} className="mt-3 h-5 w-5 rounded border-slate-300" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900">{u.display_name}</p>
                          <p className="text-sm text-slate-600 break-all">{u.contact_email || "—"}</p>
                          <p className="text-xs text-slate-400 mt-1">{formatDate(u.created_at, lang)} {formatTime(u.created_at, lang)}</p>
                          <p className="mt-2 text-xs text-slate-600">{u.approved ? txt.approved : { el: "Μη εγκεκριμένος", en: "Not approved" }[lang]}</p>
                        </div>
                      </div>
                      {influencerActions(u)}
                    </article>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.col_inf}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.email}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.col_loc}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.modal_followers}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.col_status}</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">{txt.col_act}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">{txt.no_data}</td>
                      </tr>
                    ) : (
                      filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(u.id)}
                              onChange={() => toggleUserSelection(u.id)}
                              className="rounded border-slate-300"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {u.avatar_url ? (
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200">
                                  <Image 
                                    src={getCachedImageUrl(u.avatar_url) ?? u.avatar_url} 
                                    alt={u.display_name} 
                                    width={40} 
                                    height={40} 
                                    className="object-cover w-full h-full"
                                    unoptimized
                                  />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center text-slate-400 text-xs">{lang === "el" ? "Χωρίς φωτό" : "No Photo"}</div>
                              )}
                              <div>
                                <div className="font-medium text-slate-900">{u.display_name}</div>
                                {u.created_at && (
                                  <div
                                    className="text-[10px] text-slate-400 mt-0.5 tabular-nums"
                                    title={new Date(u.created_at).toLocaleString(lang === "el" ? "el-GR" : "en-GB")}
                                  >
                                    {lang === "el" ? "Εγγραφή" : "Joined"}{" "}
                                    {formatDate(u.created_at, lang)} {formatTime(u.created_at, lang)}
                                  </div>
                                )}
                                {u.category && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {parseStoredCategories(u.category).map((cat: string, idx: number) => (
                                      <span
                                        key={idx}
                                        className="text-[10px] uppercase font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
                                      >
                                        {categoryLabel(cat, lang)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-900">{u.contact_email || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-900">{u.location || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-900">
                            {u.accounts && u.accounts.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {u.accounts.map((acc, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-slate-600">{acc.platform}:</span>
                                    <span className="text-xs text-slate-900">{acc.followers || '-'}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {u.approved ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{txt.approved}</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{{ el: "Μη εγκεκριμένος", en: "Not approved" }[lang]}</span>
                              )}
                              {u.analytics_verified ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">{txt.analytics_verified}</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">{{ el: "Μη επαληθευμένα", en: "Not verified" }[lang]}</span>
                              )}
                              {u.possible_duplicate ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                  {lang === "el" ? "Πιθανό διπλό" : "Possible duplicate"}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">{influencerActions(u)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
                <AdminPager
                  lang={lang}
                  page={influencersPage}
                  total={influencersTotal}
                  pageSize={ADMIN_PAGE_SIZE}
                  disabled={influencersLoading}
                  onPage={(page) => void fetchInfluencersPage({ page, q: debouncedSearch, status: statusFilter })}
                />
              </div>
              )}
            </>
          )}

          {activeTab === "influencer_stats" && (
            <div className="p-4 sm:p-6 border-t border-slate-100">
              <AdminInfluencerStatsTab
                influencers={(() => {
                  const list = (pickerUsers.length ? pickerUsers : users).map((u) => ({
                    id: u.id,
                    display_name: u.display_name,
                    contact_email: u.contact_email,
                  }));
                  const seen = new Set<string>();
                  return list.filter((u) => {
                    const id = String(u.id);
                    if (seen.has(id)) return false;
                    seen.add(id);
                    return true;
                  });
                })()}
                lang={lang}
              />
            </div>
          )}

          {activeTab === "proposals" && (
            <>
              <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row">
                <input
                  type="search"
                  value={proposalSearch}
                  onChange={(e) => setProposalSearch(e.target.value)}
                  placeholder={{ el: "Αναζήτηση επιχείρησης, creator ή υπηρεσίας…", en: "Search company, creator, or service…" }[lang]}
                  className="min-h-11 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
                />
                <select
                  value={proposalStatus}
                  onChange={(e) => setProposalStatus(e.target.value as typeof proposalStatus)}
                  className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
                >
                  <option value="all">{{ el: "Όλες οι καταστάσεις", en: "All statuses" }[lang]}</option>
                  <option value="pending">{{ el: "Εκκρεμείς", en: "Pending" }[lang]}</option>
                  <option value="accepted">{{ el: "Αποδεκτές", en: "Accepted" }[lang]}</option>
                  <option value="completed">{{ el: "Ολοκληρωμένες", en: "Completed" }[lang]}</option>
                  <option value="rejected">{{ el: "Απορριφθείσες", en: "Rejected" }[lang]}</option>
                </select>
              </div>
              {proposalsLoading && proposals.length === 0 ? (
                <AdminListSkeleton />
              ) : proposalsError && proposals.length === 0 ? (
                <AdminLoadError lang={lang} timedOut={proposalsError === "timeout"} onRetry={() => void fetchProposals({ page: proposalsPage })} />
              ) : (
                <>
                  <div className="md:hidden divide-y divide-slate-200">
                    {proposals.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-slate-500">{txt.no_data}</p>
                    ) : proposals.map((p) => {
                      const name = p.influencer_name || (Array.isArray(p.influencers) ? p.influencers[0]?.display_name : p.influencers?.display_name) || "—";
                      return (
                        <article key={p.id} className="space-y-3 p-4">
                          <div>
                            <p className="font-semibold text-slate-900">{p.brand_name}</p>
                            <p className="text-sm text-slate-600">{name}</p>
                            <p className="mt-1 text-sm font-medium text-emerald-700">{formatEuroAmount(p.budget, lang)} · {p.status}</p>
                            <p className="text-xs text-slate-400">{formatDate(p.created_at, lang)} {formatTime(p.created_at, lang)}</p>
                          </div>
                          <button type="button" onClick={() => handleDeleteProposal(p.id)} disabled={deletingProposal === p.id} className="inline-flex min-h-11 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 disabled:opacity-50">
                            {deletingProposal === p.id ? { el: "Διαγραφή…", en: "Deleting…" }[lang] : { el: "Διαγραφή πρότασης", en: "Delete proposal" }[lang]}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.col_brand}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.col_inf}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.col_bud}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.col_status}</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">{txt.col_act}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {proposals.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">{txt.no_data}</td></tr>
                        ) : proposals.map((p) => {
                          const name = p.influencer_name || (Array.isArray(p.influencers) ? p.influencers[0]?.display_name : p.influencers?.display_name) || "—";
                          const statusKey = String(p.status || "").toLowerCase();
                          const statusLabel =
                            statusKey === "pending" ? { el: "Εκκρεμεί", en: "Pending" }[lang]
                            : statusKey === "accepted" ? { el: "Αποδεκτή", en: "Accepted" }[lang]
                            : statusKey === "completed" ? { el: "Ολοκληρώθηκε", en: "Completed" }[lang]
                            : statusKey === "rejected" ? { el: "Απορρίφθηκε", en: "Rejected" }[lang]
                            : statusKey === "cancelled" || statusKey === "canceled" ? { el: "Ακυρώθηκε", en: "Cancelled" }[lang]
                            : { el: "Άγνωστο", en: "Unknown" }[lang];
                          return (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-900">{p.brand_name}</td>
                              <td className="px-4 py-3 text-slate-600">{name}</td>
                              <td className="px-4 py-3 font-medium text-emerald-700">{formatEuroAmount(p.budget, lang)}</td>
                              <td className="px-4 py-3"><span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{statusLabel}</span></td>
                              <td className="px-4 py-3 text-right">
                                <button type="button" onClick={() => handleDeleteProposal(p.id)} disabled={deletingProposal === p.id} className="inline-flex min-h-11 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 disabled:opacity-50">
                                  {deletingProposal === p.id ? { el: "Διαγραφή…", en: "Deleting…" }[lang] : txt.btn_delete}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <AdminPager
                    lang={lang}
                    page={proposalsPage}
                    total={proposalsTotal}
                    pageSize={ADMIN_PAGE_SIZE}
                    disabled={proposalsLoading}
                    onPage={(page) => void fetchProposals({ page, q: proposalSearchDebounced, status: proposalStatus })}
                  />
                </>
              )}
            </>
          )}

          {activeTab === "brands" && (
            <>
              {/* Search */}
              <div className="p-4 border-b border-slate-200 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {([
                    ["pending", lang === "el" ? `Εκκρεμείς (${pendingBrandCount})` : `Pending (${pendingBrandCount})`],
                    ["verified", lang === "el" ? "Επαληθευμένες" : "Verified"],
                    ["all", lang === "el" ? "Όλες" : "All"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBrandStatusFilter(value)}
                      className={`inline-flex min-h-11 items-center px-4 text-sm font-medium rounded-full border ${
                        brandStatusFilter === value
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-4">
                  <input
                    type="text"
                    placeholder={lang === 'el' ? 'Αναζήτηση επιχείρησης...' : 'Search company...'}
                    value={brandSearchQuery}
                    onChange={(e) => setBrandSearchQuery(e.target.value)}
                    className="min-h-11 flex-1 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={() => void fetchBrands({ page: brandsPage })}
                    className="inline-flex min-h-11 items-center px-4 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    {lang === 'el' ? 'Ανανέωση' : 'Refresh'}
                  </button>
                </div>
              </div>

              {brandsLoading && visibleBrands.length === 0 ? (
                <AdminListSkeleton />
              ) : brandsError && visibleBrands.length === 0 ? (
                <AdminLoadError lang={lang} timedOut={brandsError === "timeout"} onRetry={() => void fetchBrands({ page: brandsPage })} />
              ) : (
              <>
              <div className="md:hidden divide-y divide-slate-200">
                {visibleBrands.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-500">{txt.no_data}</p>
                ) : visibleBrands.map((b) => {
                  const locked = isProtectedTestAccount({ brand_name: b.brand_name, contact_email: b.contact_email });
                  return (
                    <article key={b.id} className="space-y-3 p-4">
                      <div>
                        <p className="font-semibold text-slate-900">{b.brand_name}</p>
                        <p className="text-sm text-slate-600 break-all">{b.contact_email}</p>
                        <p className="text-xs text-slate-400 mt-1">{formatDate(b.created_at, lang)} {formatTime(b.created_at, lang)}</p>
                        <p className="mt-2 text-xs font-medium text-slate-700">{b.verified ? { el: "Επαληθευμένη", en: "Verified" }[lang] : { el: "Αναμονή για έγκριση", en: "Pending approval" }[lang]}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => { setSelectedBrand(b); setShowBrandEditModal(true); }} className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white">
                          {{ el: "Επεξεργασία", en: "Edit" }[lang]}
                        </button>
                        {!b.verified && (
                          <button type="button" onClick={() => handleToggleBrandVerification(b.id, false)} className="inline-flex min-h-11 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-800">
                            {{ el: "Έγκριση", en: "Approve" }[lang]}
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 border-t border-red-100 pt-2">
                        {b.verified && (
                          <button type="button" onClick={() => handleToggleBrandVerification(b.id, true)} className="inline-flex min-h-11 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700">
                            {{ el: "Απόρριψη", en: "Reject" }[lang]}
                          </button>
                        )}
                        <button type="button" disabled={locked} onClick={() => deleteBrand(b.id, b.brand_name)} className="inline-flex min-h-11 items-center rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 disabled:opacity-40">
                          {locked ? protectedDeleteMessage(lang) : { el: "Διαγραφή", en: "Delete" }[lang]}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Εταιρεία' : 'Company'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Email' : 'Email'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'ΑΦΜ' : 'Tax ID'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Επικοινωνία' : 'Contact'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Κλάδος' : 'Industry'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Ημερομηνία' : 'Date'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Κατάσταση' : 'Status'}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{lang === 'el' ? 'Ενέργειες' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {visibleBrands.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          {brands.length === 0 
                            ? (lang === 'el' ? 'Δεν υπάρχουν εγγεγραμμένες επιχειρήσεις' : 'No registered companies')
                            : txt.no_data}
                        </td>
                      </tr>
                    ) : (
                      visibleBrands.map(b => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-3">
                              {b.logo_url ? (
                                <img src={getCachedImageUrl(b.logo_url) ?? b.logo_url} alt={b.brand_name} className="w-8 h-8 rounded object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold">
                                  {b.brand_name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="font-medium text-slate-900">{b.brand_name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-slate-600 text-xs sm:text-sm break-all max-w-[160px]">{b.contact_email}</td>
                          <td className="px-3 py-2 text-slate-600 font-mono text-xs sm:text-sm whitespace-nowrap">{b.afm}</td>
                          <td className="px-3 py-2 text-slate-600">
                            <div className="flex flex-col gap-1">
                              {b.contact_person && (
                                <span className="text-sm">{b.contact_person}</span>
                              )}
                              {b.website && toPublicHttpsHref(b.website) && (
                                <a 
                                  href={toPublicHttpsHref(b.website)!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  {b.website}
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-slate-600 text-xs sm:text-sm">{formatCategoryLabels(b.industry, lang) || '-'}</td>
                          <td className="px-3 py-2 text-slate-600 text-xs sm:text-sm whitespace-nowrap">
                            {formatDate(b.created_at, lang)} {formatTime(b.created_at, lang)}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              b.verified 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {b.verified ? (lang === 'el' ? 'Επαληθευμένη' : 'Verified') : (lang === 'el' ? 'Αναμονή για έγκριση' : 'Pending Approval')}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col items-start gap-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  onClick={() => { setSelectedBrand(b); setShowBrandEditModal(true); }}
                                  disabled={updatingBrand === b.id || deletingBrand === b.id}
                                  className="inline-flex min-h-11 items-center px-3 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  {lang === 'el' ? 'Επεξεργασία' : 'Edit'}
                                </button>
                                {!b.verified && (
                                  <button
                                    onClick={() => handleToggleBrandVerification(b.id, false)}
                                    disabled={updatingBrand === b.id || deletingBrand === b.id}
                                    className="inline-flex min-h-11 items-center px-3 text-sm rounded-lg transition-colors bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {updatingBrand === b.id
                                      ? (lang === 'el' ? 'Επεξεργασία...' : 'Processing...')
                                      : (lang === 'el' ? 'Έγκριση' : 'Approve')}
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 border-t border-red-100 pt-1.5">
                                {b.verified && (
                                  <button
                                    onClick={() => handleToggleBrandVerification(b.id, true)}
                                    disabled={updatingBrand === b.id || deletingBrand === b.id}
                                    className="inline-flex min-h-11 items-center px-3 text-sm rounded-lg transition-colors bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {updatingBrand === b.id
                                      ? (lang === 'el' ? 'Επεξεργασία...' : 'Processing...')
                                      : (lang === 'el' ? 'Απόρριψη' : 'Reject')}
                                  </button>
                                )}
                                <button
                                  onClick={() => deleteBrand(b.id, b.brand_name)}
                                  disabled={updatingBrand === b.id || deletingBrand === b.id || isProtectedTestAccount({ brand_name: b.brand_name, contact_email: b.contact_email })}
                                  title={isProtectedTestAccount({ brand_name: b.brand_name, contact_email: b.contact_email }) ? protectedDeleteMessage(lang) : undefined}
                                  className="inline-flex min-h-11 items-center px-3 text-sm rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                  {deletingBrand === b.id 
                                    ? (lang === 'el' ? 'Διαγραφή...' : 'Deleting...')
                                    : (lang === 'el' ? 'Διαγραφή' : 'Delete')
                                  }
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <AdminPager
                lang={lang}
                page={brandsPage}
                total={brandsTotal}
                pageSize={ADMIN_PAGE_SIZE}
                disabled={brandsLoading}
                onPage={(page) => void fetchBrands({ page, q: brandSearchDebounced, status: brandStatusFilter })}
              />
              </>
              )}
            </>
          )}

          {activeTab === "campaigns" && (
            <>
              {campaignsSchemaMissing && (
                <div className="p-4 bg-amber-50 border-b border-amber-200 text-amber-900 text-sm">
                  {txt.campaigns_schema_missing}
                </div>
              )}
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <input
                  type="text"
                  placeholder={txt.search}
                  value={campaignSearchQuery}
                  onChange={(e) => setCampaignSearchQuery(e.target.value)}
                  className="flex-1 min-w-[12rem] px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={fetchAdminCampaigns}
                  disabled={campaignsLoading}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors shrink-0"
                >
                  {campaignsLoading
                    ? lang === "el"
                      ? "Φόρτωση…"
                      : "Loading…"
                    : txt.campaigns_refresh}
                </button>
              </div>
              {(() => {
                const q = campaignSearchQuery.trim().toLowerCase();
                const filtered = q
                  ? adminCampaigns.filter((c) => {
                      const meta = getCampaignBrandMeta(c);
                      return (
                        c.title.toLowerCase().includes(q) ||
                        meta.name.toLowerCase().includes(q) ||
                        (meta.email && meta.email.toLowerCase().includes(q))
                      );
                    })
                  : adminCampaigns;
                const emptyLabel =
                  adminCampaigns.length === 0
                    ? lang === "el"
                      ? "Δεν υπάρχουν καμπάνιες."
                      : "No campaigns yet."
                    : txt.no_data;
                const appStatusLabel = (status: string) => {
                  if (status === "accepted") return txt.apps_status_accepted;
                  if (status === "rejected") return txt.apps_status_rejected;
                  if (status === "shortlisted") return txt.apps_status_shortlisted;
                  if (status === "withdrawn") return txt.apps_status_withdrawn;
                  return txt.apps_status_pending;
                };
                const appStatusCls = (status: string) => {
                  if (status === "accepted") return "bg-emerald-100 text-emerald-800";
                  if (status === "rejected") return "bg-slate-200 text-slate-700";
                  if (status === "shortlisted") return "bg-blue-100 text-blue-800";
                  if (status === "withdrawn") return "bg-slate-100 text-slate-500";
                  return "bg-amber-100 text-amber-800";
                };
                const renderApplicants = (c: AdminBrandCampaignRow) => {
                  const apps = c.applications || [];
                  if (apps.length === 0) {
                    return <p className="text-sm text-slate-500">{txt.apps_none}</p>;
                  }
                  return (
                    <div className="space-y-3">
                      {apps.map((app) => {
                        const inf = getApplicationInfluencerMeta(app);
                        const links = filterWorkLinks(app.work_links || "").ok;
                        return (
                          <article
                            key={app.id}
                            className="bg-white border border-slate-200 rounded-lg p-3 flex gap-3"
                          >
                            <Avatar src={inf.avatar} alt={inf.name} size={48} className="shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <a
                                  href={`/influencer/${app.influencer_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-slate-900 hover:text-blue-700 hover:underline"
                                >
                                  {inf.name}
                                </a>
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${appStatusCls(app.status)}`}
                                >
                                  {appStatusLabel(app.status)}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                                {app.proposed_price != null && (
                                  <span>
                                    {txt.apps_proposed}:{" "}
                                    {formatEuro(Number(app.proposed_price), lang === "en" ? "en" : "el")}
                                  </span>
                                )}
                                <span>
                                  {new Date(app.created_at).toLocaleDateString(
                                    lang === "el" ? "el-GR" : "en-GB"
                                  )}
                                </span>
                              </div>
                              {app.message?.trim() ? (
                                <p className="mt-2 text-sm text-slate-700 line-clamp-3 whitespace-pre-wrap">
                                  {app.message}
                                </p>
                              ) : null}
                              {links.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {links.map((url) => (
                                    <a
                                      key={url}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-700 hover:underline break-all"
                                    >
                                      {url}
                                    </a>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  );
                };

                if (campaignsError && adminCampaigns.length === 0) {
                  return (
                    <AdminLoadError
                      lang={lang}
                      timedOut={campaignsError === "timeout"}
                      onRetry={() => void fetchAdminCampaigns()}
                    />
                  );
                }
                if (campaignsLoading && adminCampaigns.length === 0) {
                  return <AdminListSkeleton />;
                }
                if (filtered.length === 0) {
                  return (
                    <div className="px-4 py-8 text-center text-slate-500">{emptyLabel}</div>
                  );
                }

                return (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                              {txt.col_brand}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                              {txt.col_campaign_title}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                              {txt.col_campaign_status}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                              {txt.col_bud}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                              {txt.col_applications}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                              {lang === "el" ? "Προθεσμία" : "Deadline"}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                              {txt.col_date}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                              {txt.col_act}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filtered.map((c) => {
                            const meta = getCampaignBrandMeta(c);
                            const statusEn =
                              c.status === "open" ? "Open" : c.status === "closed" ? "Closed" : "Draft";
                            const statusEl =
                              c.status === "open"
                                ? "Ανοιχτή"
                                : c.status === "closed"
                                  ? "Κλειστή"
                                  : "Πρόχειρο";
                            const statusCls =
                              c.status === "open"
                                ? "bg-emerald-100 text-emerald-800"
                                : c.status === "closed"
                                  ? "bg-slate-200 text-slate-700"
                                  : "bg-amber-100 text-amber-800";
                            const appCount = c.applications_count ?? c.applications?.length ?? 0;
                            const expanded = expandedCampaignId === c.id;
                            return (
                              <Fragment key={c.id}>
                                <tr className="hover:bg-slate-50">
                                  <td className="px-3 py-2 align-top">
                                    <div className="font-medium text-slate-900">{meta.name}</div>
                                    {meta.email && (
                                      <div className="text-xs text-slate-500 break-all max-w-[180px]">
                                        {meta.email}
                                      </div>
                                    )}
                                    {meta.verified ? (
                                      <span className="mt-1 inline-flex text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-800">
                                        verified
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-2 align-top max-w-[220px]">
                                    <div className="font-medium text-slate-800 line-clamp-2">{c.title}</div>
                                    {c.category ? (
                                      <div className="text-xs text-slate-500 mt-0.5">{c.category}</div>
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-2 align-top whitespace-nowrap">
                                    <span
                                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusCls}`}
                                    >
                                      {lang === "el" ? statusEl : statusEn}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 align-top text-sm whitespace-nowrap">
                                    {formatEuro(Number(c.budget || 0), lang === "en" ? "en" : "el")}
                                  </td>
                                  <td className="px-3 py-2 align-top whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedCampaignId(expanded ? null : c.id)
                                      }
                                      className="inline-flex items-center gap-1.5 text-sm text-slate-800 hover:text-blue-700"
                                    >
                                      <span className="font-medium">
                                        {txt.col_applications} ({appCount})
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        {expanded ? txt.apps_collapse : txt.apps_expand}
                                      </span>
                                    </button>
                                  </td>
                                  <td className="px-3 py-2 align-top text-sm text-slate-600 whitespace-nowrap">
                                    {c.deadline ? formatDate(c.deadline, lang) : "—"}
                                  </td>
                                  <td className="px-3 py-2 align-top text-sm text-slate-600 whitespace-nowrap">
                                    {formatDate(c.created_at, lang)}
                                  </td>
                                  <td className="px-3 py-2 align-top">
                                    <button
                                      type="button"
                                      onClick={() => deleteAdminCampaign(c)}
                                      disabled={deletingCampaignId === c.id}
                                      className="inline-flex min-h-11 items-center px-3 text-sm font-medium border border-red-200 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50"
                                    >
                                      {deletingCampaignId === c.id
                                        ? lang === "el"
                                          ? "Διαγραφή…"
                                          : "Deleting…"
                                        : txt.btn_delete}
                                    </button>
                                  </td>
                                </tr>
                                {expanded ? (
                                  <tr className="bg-slate-50">
                                    <td colSpan={8} className="px-4 py-3">
                                      {renderApplicants(c)}
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="md:hidden divide-y divide-slate-200">
                      {filtered.map((c) => {
                        const meta = getCampaignBrandMeta(c);
                        const statusEn =
                          c.status === "open" ? "Open" : c.status === "closed" ? "Closed" : "Draft";
                        const statusEl =
                          c.status === "open"
                            ? "Ανοιχτή"
                            : c.status === "closed"
                              ? "Κλειστή"
                              : "Πρόχειρο";
                        const statusCls =
                          c.status === "open"
                            ? "bg-emerald-100 text-emerald-800"
                            : c.status === "closed"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-amber-100 text-amber-800";
                        const appCount = c.applications_count ?? c.applications?.length ?? 0;
                        const expanded = expandedCampaignId === c.id;
                        return (
                          <article key={c.id} className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 line-clamp-2">{c.title}</p>
                                <p className="text-sm text-slate-600 mt-0.5">{meta.name}</p>
                                {meta.email ? (
                                  <p className="text-xs text-slate-500 break-all">{meta.email}</p>
                                ) : null}
                              </div>
                              <span
                                className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusCls}`}
                              >
                                {lang === "el" ? statusEl : statusEn}
                              </span>
                            </div>
                            <div className="text-sm text-slate-700 flex flex-wrap gap-x-3 gap-y-1">
                              <span>
                                {formatEuro(Number(c.budget || 0), lang === "en" ? "en" : "el")}
                              </span>
                              <span>
                                {new Date(c.created_at).toLocaleDateString(
                                  lang === "el" ? "el-GR" : "en-GB"
                                )}
                              </span>
                              {c.deadline ? (
                                <span>
                                  {lang === "el" ? "Προθεσμία" : "Deadline"}:{" "}
                                  {new Date(c.deadline).toLocaleDateString(
                                    lang === "el" ? "el-GR" : "en-GB"
                                  )}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedCampaignId(expanded ? null : c.id)}
                                className="px-3 py-1.5 text-xs rounded-md border border-slate-300 text-slate-800"
                              >
                                {txt.col_applications} ({appCount}) ·{" "}
                                {expanded ? txt.apps_collapse : txt.apps_expand}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteAdminCampaign(c)}
                                disabled={deletingCampaignId === c.id}
                                className="inline-flex min-h-11 items-center px-3 text-sm font-medium rounded-lg border border-red-200 bg-red-50 text-red-700 disabled:opacity-50"
                              >
                                {deletingCampaignId === c.id
                                  ? lang === "el"
                                    ? "Διαγραφή…"
                                    : "Deleting…"
                                  : txt.btn_delete}
                              </button>
                            </div>
                            {expanded ? (
                              <div className="pt-2 border-t border-slate-100">{renderApplicants(c)}</div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </>
          )}

          {activeTab === "blog" && (
            <>
              {/* Search & Add */}
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={lang === 'el' ? "Αναζήτηση άρθρων..." : "Search articles..."}
                    value={blogSearchQuery}
                    onChange={(e) => setBlogSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={() => {
                    setIsNewBlogPost(true);
                    setSelectedBlogPost({
                      slug: '',
                      title: { el: '', en: '' },
                      excerpt: { el: '', en: '' },
                      date: new Date().toISOString().split('T')[0],
                      category: { el: '', en: '' },
                      readTime: { el: '', en: '' },
                      image: '',
                      content: { el: '', en: '' }
                    });
                    setShowBlogEditModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  + {txt.blog_add}
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.blog_title}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.blog_slug}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.blog_category}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.blog_date}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{txt.blog_actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {blogPosts.filter(p => 
                      blogSearchQuery === "" ||
                      p.title.el.toLowerCase().includes(blogSearchQuery.toLowerCase()) ||
                      p.title.en.toLowerCase().includes(blogSearchQuery.toLowerCase()) ||
                      p.slug.toLowerCase().includes(blogSearchQuery.toLowerCase())
                    ).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">{txt.no_data}</td>
                      </tr>
                    ) : (
                      blogPosts.filter(p => 
                        blogSearchQuery === "" ||
                        p.title.el.toLowerCase().includes(blogSearchQuery.toLowerCase()) ||
                        p.title.en.toLowerCase().includes(blogSearchQuery.toLowerCase()) ||
                        p.slug.toLowerCase().includes(blogSearchQuery.toLowerCase())
                      ).map(post => (
                        <tr key={post.slug} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{post.title[lang]}</div>
                            <div className="text-sm text-slate-500 line-clamp-1">{post.excerpt[lang]}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-sm font-mono">{post.slug}</td>
                          <td className="px-4 py-3 text-slate-600">{post.category[lang]}</td>
                          <td className="px-4 py-3 text-slate-600 text-sm">{post.date}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  // Load content if missing
                                  let postWithContent = await loadBlogPostContent(post);
                                  
                                  // If still no content, try to fetch from the blog page's hardcoded posts
                                  // by making a request to load the blog page and extract content
                                  if ((!postWithContent.content?.el && !postWithContent.content?.en)) {
                                    try {
                                      // Try to get content from window object if blog page has exposed it
                                      // Or load directly from localStorage which might have been updated
                                      const stored = localStorage.getItem('blogPosts');
                                      if (stored) {
                                        const allPosts: BlogPost[] = JSON.parse(stored);
                                        const foundPost = allPosts.find(p => p.slug === post.slug);
                                        if (foundPost && foundPost.content) {
                                          postWithContent = {
                                            ...post,
                                            content: {
                                              el: foundPost.content.el || '',
                                              en: foundPost.content.en || ''
                                            }
                                          };
                                        }
                                      }
                                    } catch (error) {
                                      console.error('Error loading content fallback:', error);
                                    }
                                  }
                                  
                                  setSelectedBlogPost(postWithContent);
                                  setIsNewBlogPost(false);
                                  setShowBlogEditModal(true);
                                }}
                                className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              >
                                {txt.blog_edit}
                              </button>
                              <button
                                onClick={() => deleteBlogPost(post.slug)}
                                className="ml-2 inline-flex min-h-11 items-center px-3 text-sm font-medium border border-red-200 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                              >
                                {txt.blog_delete}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === "announcements" && (
            <>
              <div className="p-4 border-b border-slate-200 space-y-4 text-slate-900">
                <form onSubmit={sendAnnouncement} className="space-y-4 max-w-2xl">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">{txt.ann_title}</label>
                    <input
                      type="text"
                      value={announcementTitle}
                      onChange={(e) => setAnnouncementTitle(e.target.value)}
                      placeholder={lang === 'el' ? 'Τίτλος ανακοίνωσης' : 'Announcement title'}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">{txt.ann_body}</label>
                    <textarea
                      value={announcementBody}
                      onChange={(e) => setAnnouncementBody(e.target.value)}
                      placeholder={lang === 'el' ? 'Κείμενο ανακοίνωσης' : 'Announcement content'}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-slate-900 mb-2">
                      {lang === 'el' ? 'Στοχευμένοι παραλήπτες' : 'Recipients'}
                    </span>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap gap-4">
                        <label className="inline-flex items-center gap-2 cursor-pointer text-slate-900">
                          <input
                            type="radio"
                            name="target"
                            checked={announcementTargetType === 'all'}
                            onChange={() => {
                              setAnnouncementTargetType('all');
                              setAnnouncementTargetInfluencerIds([]);
                              setAnnouncementTargetBrandIds([]);
                            }}
                            className="rounded border-slate-300"
                          />
                          <span>{txt.ann_to_all}</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer text-slate-900">
                          <input
                            type="radio"
                            name="target"
                            checked={announcementTargetType === 'specific'}
                            onChange={() => {
                              setAnnouncementTargetType('specific');
                              setAnnouncementTargetBrandIds([]);
                            }}
                            className="rounded border-slate-300"
                          />
                          <span>{txt.ann_to_one}</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer text-slate-900">
                          <input
                            type="radio"
                            name="target"
                            checked={announcementTargetType === 'all_brands'}
                            onChange={() => {
                              setAnnouncementTargetType('all_brands');
                              setAnnouncementTargetInfluencerIds([]);
                              setAnnouncementTargetBrandIds([]);
                            }}
                            className="rounded border-slate-300"
                          />
                          <span>{txt.ann_to_all_brands}</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer text-slate-900">
                          <input
                            type="radio"
                            name="target"
                            checked={announcementTargetType === 'specific_brand'}
                            onChange={() => {
                              setAnnouncementTargetType('specific_brand');
                              setAnnouncementTargetInfluencerIds([]);
                            }}
                            className="rounded border-slate-300"
                          />
                          <span>{txt.ann_to_one_brand}</span>
                        </label>
                      </div>
                      {announcementTargetType === 'specific' && (
                        <AnnouncementRecipientMultiSelect
                          lang={lang}
                          options={announcementInfluencerOptions}
                          selectedIds={announcementTargetInfluencerIds}
                          onChange={setAnnouncementTargetInfluencerIds}
                          searchPlaceholder={
                            lang === 'el'
                              ? 'Αναζήτηση ονόματος, slug ή email…'
                              : 'Search name, slug or email…'
                          }
                        />
                      )}
                      {announcementTargetType === 'specific_brand' && (
                        <AnnouncementRecipientMultiSelect
                          lang={lang}
                          options={announcementBrandMultiOptions}
                          selectedIds={announcementTargetBrandIds}
                          onChange={setAnnouncementTargetBrandIds}
                          searchPlaceholder={
                            lang === 'el'
                              ? 'Αναζήτηση επωνυμίας ή email…'
                              : 'Search by name or email…'
                          }
                        />
                      )}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={
                      announcementSending ||
                      (announcementSendCount != null && announcementSendCount === 0)
                    }
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {announcementSending
                      ? '...'
                      : announcementSendCount != null
                        ? lang === 'el'
                          ? `Αποστολή σε ${announcementSendCount}`
                          : `Send to ${announcementSendCount}`
                        : txt.ann_send}
                  </button>
                </form>
              </div>
              <div className="p-4 text-slate-900 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {lang === 'el' ? 'Απεσταλμένες ανακοινώσεις' : 'Sent announcements'}
                  </h3>
                  <div className="text-xs text-slate-600">
                    {lang === 'el'
                      ? `${announcementsTotal} συνολικά`
                      : `${announcementsTotal} total`}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  <input
                    type="search"
                    value={announcementSearch}
                    onChange={(e) => setAnnouncementSearch(e.target.value)}
                    placeholder={
                      lang === 'el' ? 'Αναζήτηση τίτλου ή κειμένου…' : 'Search title or body…'
                    }
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white text-sm"
                  />
                  <select
                    value={announcementFilterTarget}
                    onChange={(e) =>
                      setAnnouncementFilterTarget(
                        e.target.value as "" | "all" | "specific" | "all_brands" | "specific_brand"
                      )
                    }
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white text-sm"
                  >
                    <option value="">
                      {lang === 'el' ? 'Όλοι οι παραλήπτες' : 'All recipient types'}
                    </option>
                    <option value="all">{txt.ann_to_all}</option>
                    <option value="specific">{txt.ann_to_one}</option>
                    <option value="all_brands">{txt.ann_to_all_brands}</option>
                    <option value="specific_brand">{txt.ann_to_one_brand}</option>
                  </select>
                  <input
                    type="date"
                    value={announcementDateFrom}
                    onChange={(e) => setAnnouncementDateFrom(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white text-sm"
                    aria-label={lang === 'el' ? 'Από ημερομηνία' : 'From date'}
                    title={lang === 'el' ? 'Από' : 'From'}
                  />
                  <input
                    type="date"
                    value={announcementDateTo}
                    onChange={(e) => setAnnouncementDateTo(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 bg-white text-sm"
                    aria-label={lang === 'el' ? 'Έως ημερομηνία' : 'To date'}
                    title={lang === 'el' ? 'Έως' : 'To'}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        announcementsList.length > 0 &&
                        announcementsList.every((a) => announcementSelectedIds.includes(a.id))
                      }
                      onChange={toggleSelectAllAnnouncementsOnPage}
                      disabled={announcementsList.length === 0}
                      className="rounded border-slate-300"
                    />
                    <span>
                      {lang === 'el' ? 'Επιλογή όλων της σελίδας' : 'Select all on page'}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => void bulkDeleteAnnouncements()}
                    disabled={announcementSelectedIds.length === 0 || announcementBulkDeleting}
                    className="ml-auto inline-flex min-h-11 items-center px-3 text-sm font-medium border border-red-200 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {announcementBulkDeleting
                      ? '...'
                      : lang === 'el'
                        ? `Διαγραφή επιλεγμένων (${announcementSelectedIds.length})`
                        : `Delete selected (${announcementSelectedIds.length})`}
                  </button>
                </div>

                {announcementsLoading && announcementsList.length === 0 ? (
                  <AdminListSkeleton rows={2} />
                ) : announcementsError && announcementsList.length === 0 ? (
                  <AdminLoadError
                    lang={lang}
                    timedOut={announcementsError === "timeout"}
                    onRetry={() => void fetchAnnouncements()}
                  />
                ) : announcementsList.length === 0 ? (
                  <p className="text-slate-600">{txt.no_data}</p>
                ) : (
                  <ul className="space-y-3">
                    {announcementsList.map((a) => {
                      const readCount = typeof a.read_count === 'number' ? a.read_count : 0;
                      const recipientCount = typeof a.recipient_count === 'number' ? a.recipient_count : 0;
                      const isSpecific =
                        a.target_type === 'specific' || a.target_type === 'specific_brand';
                      const isBroadcast =
                        a.target_type === 'all' || a.target_type === 'all_brands';
                      const readersOpen = announcementReadersOpenId === a.id;
                      const readers = announcementReadersById[a.id] || [];
                      const readersLoading = announcementReadersLoadingId === a.id;
                      const selected = announcementSelectedIds.includes(a.id);
                      return (
                      <li key={a.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 flex items-start justify-between gap-3">
                        <div className="shrink-0 pt-1">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleAnnouncementSelected(a.id)}
                            className="rounded border-slate-300"
                            aria-label={lang === 'el' ? 'Επιλογή ανακοίνωσης' : 'Select announcement'}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-900">{a.title}</div>
                          <div className="text-sm text-slate-800 mt-1 line-clamp-2">{a.body}</div>
                          <div className="text-xs text-slate-700 mt-2">
                            {new Date(a.created_at).toLocaleString(lang === 'el' ? 'el-GR' : 'en-GB')}
                            {a.target_type === 'specific' && a.target_influencer_id && (
                              <span className="ml-2">
                                → {lang === 'el' ? 'Σε συγκεκριμένο' : 'To specific'}
                                {((pickerUsers.length ? pickerUsers : users).find(u => u.auth_user_id === a.target_influencer_id) || (pickerUsers.length ? pickerUsers : users).find(u => String(u.id) === a.target_influencer_id)) && (
                                  <>: {((pickerUsers.length ? pickerUsers : users).find(u => u.auth_user_id === a.target_influencer_id) || (pickerUsers.length ? pickerUsers : users).find(u => String(u.id) === a.target_influencer_id))!.display_name}</>
                                )}
                              </span>
                            )}
                            {a.target_type === 'all' && (
                              <span className="ml-2">→ {txt.ann_to_all}</span>
                            )}
                            {a.target_type === 'all_brands' && (
                              <span className="ml-2">→ {txt.ann_to_all_brands}</span>
                            )}
                            {a.target_type === 'specific_brand' && a.target_brand_id && (
                              <span className="ml-2">
                                → {txt.ann_to_one_brand}
                                {brands.find((b) => b.id === a.target_brand_id) && (
                                  <>: {brands.find((b) => b.id === a.target_brand_id)!.brand_name}</>
                                )}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-xs text-slate-800 space-y-1">
                            {isBroadcast ? (
                              <button
                                type="button"
                                onClick={() => void toggleAnnouncementReaders(a.id)}
                                className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-900 hover:underline"
                              >
                                {lang === 'el'
                                  ? `Διαβάστηκε ${readCount} / ${recipientCount}`
                                  : `Read ${readCount} / ${recipientCount}`}
                                <span aria-hidden>{readersOpen ? '▴' : '▾'}</span>
                              </button>
                            ) : (
                              <div className="font-medium">
                                {lang === 'el'
                                  ? `Διαβάστηκε ${readCount} / ${recipientCount}`
                                  : `Read ${readCount} / ${recipientCount}`}
                              </div>
                            )}
                            {isSpecific && (
                              <div className={a.read_at ? 'text-emerald-700' : 'text-slate-600'}>
                                {a.read_at ? (
                                  <>
                                    ✓{' '}
                                    {lang === 'el' ? 'Διαβάστηκε στις' : 'Read on'}{' '}
                                    {new Date(a.read_at).toLocaleString(
                                      lang === 'el' ? 'el-GR' : 'en-GB',
                                      { dateStyle: 'short', timeStyle: 'short' }
                                    )}
                                  </>
                                ) : (
                                  lang === 'el' ? 'Δεν διαβάστηκε ακόμα' : 'Not read yet'
                                )}
                              </div>
                            )}
                            {isBroadcast && readersOpen && (
                              <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 max-h-56 overflow-y-auto">
                                {readersLoading ? (
                                  <p className="text-slate-500">
                                    {lang === 'el' ? 'Φόρτωση…' : 'Loading…'}
                                  </p>
                                ) : readers.length === 0 ? (
                                  <p className="text-slate-500">
                                    {lang === 'el' ? 'Κανείς δεν το διάβασε ακόμα.' : 'No one has read it yet.'}
                                  </p>
                                ) : (
                                  <ul className="space-y-1.5">
                                    {readers.map((r) => (
                                      <li key={r.id} className="flex items-baseline justify-between gap-3">
                                        <span className="font-medium text-slate-900 truncate">{r.name}</span>
                                        <span className="shrink-0 text-slate-500">
                                          {new Date(r.read_at).toLocaleString(
                                            lang === 'el' ? 'el-GR' : 'en-GB',
                                            { dateStyle: 'short', timeStyle: 'short' }
                                          )}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await confirmAction({
                              title: lang === "el" ? "Διαγραφή ανακοίνωσης" : "Delete announcement",
                              body:
                                lang === "el"
                                  ? "Διαγραφή ανακοίνωσης; Δεν μπορεί να αναιρεθεί."
                                  : "Delete this announcement? This cannot be undone.",
                              confirmLabel: lang === "el" ? "Διαγραφή" : "Delete",
                              cancelLabel: lang === "el" ? "Άκυρο" : "Cancel",
                              danger: true,
                            });
                            if (!ok) return;
                            try {
                              const res = await fetch(`/api/admin/announcements/${a.id}`, { method: 'DELETE', headers: await adminAuthHeaders() });
                              if (res.ok) {
                                setAnnouncementSelectedIds((prev) => prev.filter((id) => id !== a.id));
                                setAnnouncementReadersOpenId((prev) => (prev === a.id ? null : prev));
                                const nextTotal = Math.max(0, announcementsTotal - 1);
                                const nextTotalPages = Math.max(1, Math.ceil(nextTotal / ANNOUNCEMENTS_PAGE_SIZE) || 1);
                                const nextPage = Math.min(announcementsPage, nextTotalPages);
                                setAnnouncementsPage(nextPage);
                                await fetchAnnouncements({ page: nextPage });
                              } else {
                                const j = await res.json().catch(() => ({}));
                                notify(j.error || 'Error');
                              }
                            } catch (e) {
                              console.error('Error deleting announcement:', e);
                              notify(lang === 'el' ? 'Σφάλμα διαγραφής' : 'Delete failed');
                            }
                          }}
                          className="shrink-0 ml-auto inline-flex min-h-11 items-center px-3 text-sm font-medium border border-red-200 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                          title={lang === 'el' ? 'Διαγραφή ανακοίνωσης' : 'Delete announcement'}
                        >
                          {lang === 'el' ? 'Διαγραφή' : 'Delete'}
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="text-sm text-slate-700">
                    {lang === 'el'
                      ? `Σελίδα ${announcementsPage} από ${announcementsTotalPages}`
                      : `Page ${announcementsPage} of ${announcementsTotalPages}`}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAnnouncementsPage((p) => Math.max(1, p - 1))}
                      disabled={announcementsPage <= 1 || announcementsLoading}
                      className="px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg text-slate-800 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {lang === 'el' ? 'Προηγούμενη' : 'Previous'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAnnouncementsPage((p) => Math.min(announcementsTotalPages, p + 1))
                      }
                      disabled={
                        announcementsPage >= announcementsTotalPages || announcementsLoading
                      }
                      className="px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg text-slate-800 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {lang === 'el' ? 'Επόμενη' : 'Next'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "social_cron" && <SocialRefreshLogsPanel lang={lang} />}

          {activeTab === "conversations" && (
            <div>
              <div className="p-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row">
                <input
                  type="search"
                  value={conversationSearch}
                  onChange={(e) => setConversationSearch(e.target.value)}
                  placeholder={{ el: "Αναζήτηση ονόματος ή email…", en: "Search name or email…" }[lang]}
                  className="min-h-11 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
                />
                <select
                  value={conversationStatus}
                  onChange={(e) => setConversationStatus(e.target.value as typeof conversationStatus)}
                  className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
                >
                  <option value="all">{{ el: "Όλες", en: "All" }[lang]}</option>
                  <option value="open">{{ el: "Ανοιχτές", en: "Open" }[lang]}</option>
                  <option value="closed">{{ el: "Κλειστές", en: "Closed" }[lang]}</option>
                </select>
              </div>
              {conversationsLoading && conversations.length === 0 ? (
                <AdminListSkeleton />
              ) : conversationsError && conversations.length === 0 ? (
                <AdminLoadError lang={lang} timedOut={conversationsError === "timeout"} onRetry={() => void fetchConversations({ page: conversationsPage })} />
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-slate-500">{{ el: "Δεν υπάρχουν συνομιλίες ακόμα", en: "No conversations yet" }[lang]}</div>
              ) : (
                <div className="flex flex-col sm:flex-row h-[500px] sm:h-[600px] relative min-h-[400px]">
                  {/* Mobile: Backdrop overlay when conversations drawer is open */}
                  {showConversationsDrawer && (
                    <div
                      onClick={() => setShowConversationsDrawer(false)}
                      className="sm:hidden fixed inset-0 bg-black/50 z-40"
                    />
                  )}

                  {/* Mobile: Toggle button for conversations drawer */}
                  {!selectedConversation && (
                    <button
                      onClick={() => setShowConversationsDrawer(true)}
                      className="sm:hidden absolute top-2 right-2 z-50 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium shadow-lg hover:bg-blue-700 transition-colors"
                    >
                      {lang === 'el' ? '📋 Συνομιλίες' : '📋 Conversations'}
                    </button>
                  )}

                  {/* Conversations List */}
                  <div className={`w-full sm:w-80 border-r border-slate-200 overflow-y-auto bg-white ${
                    showConversationsDrawer ? 'block' : 'hidden sm:block'
                  } absolute sm:relative top-0 left-0 right-0 sm:right-auto bottom-0 sm:bottom-auto z-50 sm:z-auto shadow-xl sm:shadow-none max-h-full`}>
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`relative border-b border-slate-200 hover:bg-slate-50 transition-colors ${
                          selectedConversation?.id === conv.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                        }`}
                      >
                        <button
                          onClick={() => {
                            setSelectedConversation(conv);
                            setShowConversationsDrawer(false);
                          }}
                          className="w-full min-h-11 text-left p-4"
                        >
                          <div className="font-semibold text-slate-900">{conv.influencer_name}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {{ el: "Δημιουργός", en: "Creator" }[lang]} ↔ {{ el: "Επιχείρηση", en: "Brand" }[lang]}: {conv.brand_name || conv.brand_email}
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                            <span>{formatDate(conv.last_message_at || conv.created_at, lang)} {formatTime(conv.last_message_at || conv.created_at, lang)}</span>
                            {conv.closed_at && (
                              <span className="uppercase tracking-wide">{{ el: "Κλειστή", en: "Closed" }[lang]}</span>
                            )}
                          </div>
                        </button>
                        <div className="px-4 pb-3">
                          <button
                            type="button"
                            onClick={() => handleDeleteConversation(conv.id)}
                            disabled={deletingConversation === conv.id}
                            className="inline-flex min-h-11 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 disabled:opacity-50"
                          >
                            {deletingConversation === conv.id ? "…" : { el: "Διαγραφή συνομιλίας", en: "Delete conversation" }[lang]}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-10">
                    {/* Mobile: Back button to show conversations list */}
                    {selectedConversation && (
                      <button
                        onClick={() => {
                          setSelectedConversation(null);
                          setShowConversationsDrawer(true);
                        }}
                        className="sm:hidden mb-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center gap-2"
                      >
                        ← {lang === 'el' ? 'Πίσω' : 'Back'}
                      </button>
                    )}
                    {selectedConversation ? (
                      <>
                        <div className="mb-4 pb-4 border-b border-slate-200">
                          <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                            {selectedConversation.influencer_name} ↔ {selectedConversation.brand_name || selectedConversation.brand_email}
                          </h3>
                          <div className="text-sm text-slate-500 mt-1">
                            {{ el: "Δημιουργός", en: "Creator" }[lang]}: {selectedConversation.influencer_email} · {{ el: "Επιχείρηση", en: "Brand" }[lang]}: {selectedConversation.brand_email}
                            {selectedConversation.closed_at ? { el: " · Κλειστή", en: " · Closed" }[lang] : ""}
                          </div>
                        </div>
                        <div className="space-y-3 rounded-xl bg-slate-50 p-3">
                          {messagesLoading && conversationMessages.length === 0 ? (
                            <AdminListSkeleton rows={2} />
                          ) : messagesError && conversationMessages.length === 0 ? (
                            <AdminLoadError lang={lang} timedOut={messagesError === "timeout"} onRetry={() => void fetchConversationMessages(selectedConversation.id)} />
                          ) : conversationMessages.length === 0 ? (
                            <div className="text-center text-slate-500 py-8">{{ el: "Δεν υπάρχουν μηνύματα", en: "No messages" }[lang]}</div>
                          ) : (
                            conversationMessages.map((msg, index) => {
                              const isInfluencer = msg.sender_type === "influencer";
                              const prev = conversationMessages[index - 1];
                              const showDay = !prev || !sameChatDay(prev.created_at, msg.created_at);
                              const senderName = msg.sender_name || (isInfluencer ? selectedConversation.influencer_name : selectedConversation.brand_name || selectedConversation.brand_email);
                              const role = isInfluencer
                                ? { el: "Δημιουργός", en: "Creator" }[lang]
                                : { el: "Επιχείρηση", en: "Brand" }[lang];
                              return (
                                <div key={msg.id}>
                                  {showDay ? (
                                    <div className="my-3 flex justify-center">
                                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-medium text-slate-500">
                                        {formatChatDayLabel(msg.created_at, lang)}
                                      </span>
                                    </div>
                                  ) : null}
                                  <div className={`flex ${isInfluencer ? "justify-start" : "justify-end"}`}>
                                    <div className={`max-w-[85%] sm:max-w-md ${isInfluencer ? "items-start" : "items-end"} flex flex-col`}>
                                      <p className={`mb-1 text-xs font-medium ${isInfluencer ? "text-slate-600" : "text-blue-800"}`}>
                                        {senderName} · {role}
                                      </p>
                                      <div className={`px-3.5 py-2 rounded-2xl ${isInfluencer ? "bg-white text-slate-900 border border-slate-200 rounded-bl-md" : "bg-blue-600 text-white rounded-br-md"}`}>
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        {msg.attachments.map((att, index) => {
                                          const url = att?.url && /^https:\/\//i.test(att.url) ? att.url : '';
                                          if (!url) return null;
                                          const image = (att.content_type || '').startsWith('image/');
                                          return (
                                            <a
                                              key={`${msg.id}-${index}`}
                                              href={url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className={`block text-xs underline ${isInfluencer ? 'text-blue-700' : 'text-blue-100'}`}
                                            >
                                              {image && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={url} alt={att.filename || ''} className="mt-1 max-h-48 max-w-full rounded" />
                                              )}
                                              {att.filename || url}
                                            </a>
                                          );
                                        })}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className={`text-xs tabular-nums ${isInfluencer ? "text-slate-500" : "text-blue-100"}`}>
                                        {formatDate(msg.created_at, lang)} {formatTime(msg.created_at, lang)}
                                      </p>
                                      {msg.sent_via_email && (
                                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                          Email
                                        </span>
                                      )}
                                    </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                          {messagesHasMore && selectedConversation ? (
                            <button
                              type="button"
                              onClick={() => void fetchConversationMessages(selectedConversation.id, { before: conversationMessages[0]?.created_at })}
                              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"
                            >
                              {{ el: "Παλαιότερα μηνύματα", en: "Older messages" }[lang]}
                            </button>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-500 p-4">
                        <p className="text-center mb-4">{lang === 'el' ? 'Επέλεξε μια συνομιλία για να δεις τα μηνύματα' : 'Select a conversation to view messages'}</p>
                        <button
                          onClick={() => setShowConversationsDrawer(true)}
                          className="sm:hidden px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          {lang === 'el' ? '📋 Προβολή Συνομιλιών' : '📋 View Conversations'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {conversationsTotal > 0 ? (
                <AdminPager
                  lang={lang}
                  page={conversationsPage}
                  total={conversationsTotal}
                  pageSize={ADMIN_PAGE_SIZE}
                  disabled={conversationsLoading}
                  onPage={(page) => void fetchConversations({ page, q: conversationSearchDebounced, status: conversationStatus })}
                />
              ) : null}
            </div>
          )}
        </div>
        )}
      </div>

      <ToastViewport
        toasts={toasts}
        onDismiss={dismissToast}
        dismissLabel={{ el: "Κλείσιμο", en: "Dismiss" }[lang]}
      />
      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title || ""}
        body={pendingConfirm?.body}
        confirmLabel={pendingConfirm?.confirmLabel || ""}
        cancelLabel={pendingConfirm?.cancelLabel || ""}
        onConfirm={() => closeConfirm(true)}
        onCancel={() => closeConfirm(false)}
      />

      {showBrandEditModal && selectedBrand && (
        <EditBrandModal
          brand={selectedBrand}
          onClose={() => { setShowBrandEditModal(false); setSelectedBrand(null); }}
          onSave={handleUpdateBrand}
          lang={lang}
        />
      )}

      {editDetailLoading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <span className="rounded-lg bg-slate-900 text-white text-sm px-4 py-2.5 shadow-lg">
            {lang === "el" ? "Φόρτωση προφίλ…" : "Loading profile…"}
          </span>
        </div>
      )}

      {editDetailError && !editDetailLoading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5 space-y-4">
            <p className="text-sm text-slate-800">{editDetailError}</p>
            <button
              type="button"
              onClick={() => setEditDetailError(null)}
              className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
            >
              {lang === "el" ? "Κλείσιμο" : "Close"}
            </button>
          </div>
        </div>
      )}

      {showEditModal && selectedUser && !editDetailLoading && (
          <EditProfileModal
            key={String(selectedUser.id) + (editDetailLoading ? "-l" : "-f")}
            user={selectedUser}
            lang={lang}
            onClose={() => {
              setShowEditModal(false);
              setSelectedUser(null);
            }}
            onSave={handleUserUpdate}
          />
      )}

      {/* Blog Post Edit Modal */}
      {showBlogEditModal && selectedBlogPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[95vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {isNewBlogPost ? (lang === 'el' ? 'Νέο Άρθρο' : 'New Article') : (lang === 'el' ? 'Επεξεργασία Άρθρου' : 'Edit Article')}
              </h2>
              <button
                onClick={() => {
                  setShowBlogEditModal(false);
                  setSelectedBlogPost(null);
                  setIsNewBlogPost(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedBlogPost) {
                  saveBlogPost(selectedBlogPost);
                }
              }}
              className="p-6 space-y-6"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Slug' : 'Slug'}</label>
                  <input
                    type="text"
                    value={selectedBlogPost.slug}
                    onChange={(e) => setSelectedBlogPost({...selectedBlogPost, slug: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Ημερομηνία' : 'Date'}</label>
                  <input
                    type="date"
                    value={selectedBlogPost.date}
                    onChange={(e) => setSelectedBlogPost({...selectedBlogPost, date: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Τίτλος (Ελληνικά)' : 'Title (Greek)'}</label>
                <input
                  type="text"
                  value={selectedBlogPost.title.el}
                  onChange={(e) => setSelectedBlogPost({...selectedBlogPost, title: {...selectedBlogPost.title, el: e.target.value}})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Τίτλος (Αγγλικά)' : 'Title (English)'}</label>
                <input
                  type="text"
                  value={selectedBlogPost.title.en}
                  onChange={(e) => setSelectedBlogPost({...selectedBlogPost, title: {...selectedBlogPost.title, en: e.target.value}})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Περίληψη (Ελληνικά)' : 'Excerpt (Greek)'}</label>
                <textarea
                  value={selectedBlogPost.excerpt.el}
                  onChange={(e) => setSelectedBlogPost({...selectedBlogPost, excerpt: {...selectedBlogPost.excerpt, el: e.target.value}})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Περίληψη (Αγγλικά)' : 'Excerpt (English)'}</label>
                <textarea
                  value={selectedBlogPost.excerpt.en}
                  onChange={(e) => setSelectedBlogPost({...selectedBlogPost, excerpt: {...selectedBlogPost.excerpt, en: e.target.value}})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  rows={3}
                  required
                />
              </div>

              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">{lang === 'el' ? 'Περιεχόμενο Άρθρου' : 'Article Content'}</h3>
                <p className="text-sm text-slate-600 mb-4">{lang === 'el' ? 'Χρησιμοποιήστε Markdown format. Π.χ. # για headers, ** για bold, - για lists κτλ.' : 'Use Markdown format. E.g. # for headers, ** for bold, - for lists etc.'}</p>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Περιεχόμενο (Ελληνικά)' : 'Content (Greek)'}</label>
                  <textarea
                    value={selectedBlogPost.content?.el || ''}
                    onChange={(e) => setSelectedBlogPost({
                      ...selectedBlogPost, 
                      content: {
                        el: e.target.value,
                        en: selectedBlogPost.content?.en || ''
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm text-slate-900 font-medium"
                    rows={20}
                    placeholder={lang === 'el' ? '# Τίτλος\n\nΠεριεχόμενο άρθρου σε Markdown format...' : '# Title\n\nArticle content in Markdown format...'}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedBlogPost.content?.el?.split('\n').length || 0} {lang === 'el' ? 'γραμμές' : 'lines'}
                  </p>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Περιεχόμενο (Αγγλικά)' : 'Content (English)'}</label>
                  <textarea
                    value={selectedBlogPost.content?.en || ''}
                    onChange={(e) => setSelectedBlogPost({
                      ...selectedBlogPost, 
                      content: {
                        el: selectedBlogPost.content?.el || '',
                        en: e.target.value
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm text-slate-900 font-medium"
                    rows={20}
                    placeholder={lang === 'el' ? '# Title\n\nArticle content in Markdown format...' : '# Title\n\nArticle content in Markdown format...'}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedBlogPost.content?.en?.split('\n').length || 0} {lang === 'el' ? 'γραμμές' : 'lines'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Κατηγορία (Ελληνικά)' : 'Category (Greek)'}</label>
                  <input
                    type="text"
                    value={selectedBlogPost.category.el}
                    onChange={(e) => setSelectedBlogPost({...selectedBlogPost, category: {...selectedBlogPost.category, el: e.target.value}})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Κατηγορία (Αγγλικά)' : 'Category (English)'}</label>
                  <input
                    type="text"
                    value={selectedBlogPost.category.en}
                    onChange={(e) => setSelectedBlogPost({...selectedBlogPost, category: {...selectedBlogPost.category, en: e.target.value}})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Χρόνος Ανάγνωσης (Ελληνικά)' : 'Read Time (Greek)'}</label>
                  <input
                    type="text"
                    value={selectedBlogPost.readTime.el}
                    onChange={(e) => setSelectedBlogPost({...selectedBlogPost, readTime: {...selectedBlogPost.readTime, el: e.target.value}})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                    placeholder="8 λεπτά"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'Χρόνος Ανάγνωσης (Αγγλικά)' : 'Read Time (English)'}</label>
                  <input
                    type="text"
                    value={selectedBlogPost.readTime.en}
                    onChange={(e) => setSelectedBlogPost({...selectedBlogPost, readTime: {...selectedBlogPost.readTime, en: e.target.value}})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                    placeholder="8 min"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{lang === 'el' ? 'URL Εικόνας' : 'Image URL'}</label>
                <input
                  type="url"
                  value={selectedBlogPost.image}
                  onChange={(e) => setSelectedBlogPost({...selectedBlogPost, image: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
                />
              </div>

              {selectedBlogPost.image && (
                <div>
                  <img src={selectedBlogPost.image} alt={`Blog post preview: ${selectedBlogPost.title?.el || selectedBlogPost.title?.en || 'Preview'}`} className="w-full h-48 object-cover rounded-lg" />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowBlogEditModal(false);
                    setSelectedBlogPost(null);
                    setIsNewBlogPost(false);
                  }}
                  className="px-6 py-2 text-slate-900 hover:bg-slate-100 rounded-lg font-semibold transition-colors border border-slate-300"
                >
                  {lang === 'el' ? 'Ακύρωση' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  {lang === 'el' ? 'Αποθήκευση' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <PushNotificationPrompt userType="brand" userIdentifier={adminEmail} lang={lang} />
    </div>
  );
}
