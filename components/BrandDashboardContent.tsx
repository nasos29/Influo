"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { sessionFetch } from '@/lib/sessionFetch';
import { formatEuroAmount } from '@/lib/formatEuro';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import InfluoLogo from '@/components/InfluoLogo';
import { recommendInfluencers, sharedCategoryKeys, type InfluencerProfile, type BrandProfile, type BrandCampaignHint } from '@/lib/recommendations';
import {
  EMPTY_RECOMMENDATION_FILTERS,
  RECOMMENDATION_MIN_SCORE,
  activeRecommendationFilterCount,
  filterRecommendationProfiles,
} from '@/lib/recommendationFilters';
import SkillMultiSelect from '@/components/SkillMultiSelect';
import LocationTypeahead from '@/components/LocationTypeahead';
import { sanitizeSkills } from '@/lib/skills';
import { lookupAuthUser, logoutEverywhere } from '@/lib/authSession';
import CreatorPhoto from '@/components/CreatorPhoto';
import PlatformFollowers from '@/components/PlatformFollowers';
import Messaging from '@/components/Messaging';
import { useOwnPresenceHeartbeat } from '@/lib/useOwnPresenceHeartbeat';
import PushNotificationPrompt from '@/components/PushNotificationPrompt';
import { getStoredLanguage, setStoredLanguage } from '@/lib/language';
import { displayNameForLang } from '@/lib/greeklish';
import { displayServiceType } from '@/lib/campaignServiceLabel';
import { formatProposalExtrasLine } from '@/lib/proposalFloor';
import AgreementTerms from '@/components/AgreementTerms';
import { prepareImageForStorage } from '@/lib/prepareImageForStorage';
import BrandCampaignsSection from '@/components/BrandCampaignsSection';
import BrandActionInbox from '@/components/BrandActionInbox';
import BrandSaveInfluencerButton from '@/components/BrandSaveInfluencerButton';
import BrandShortlistPanel from '@/components/BrandShortlistPanel';
import BrandToolsPanel from '@/components/BrandToolsPanel';
import BrandStatisticsPanel from '@/components/BrandStatisticsPanel';
import InfluencerPresenceDot from '@/components/InfluencerPresenceDot';
import { loadOwnProfiles } from '@/lib/ownProfile';
import { getApprovedInfluencersForRecommendations } from '@/lib/approvedInfluencersListCache';
import { readSessionAvatar, writeSessionAvatar } from '@/lib/sessionAvatarCache';
import { publicProfilePath } from '@/lib/profileSlug';
import { CATEGORIES, categoryLabel, formatStoredCategories, parseStoredCategories } from "@/lib/categories";
import { formatFromPriceLabel, lowestListedPrice } from "@/lib/publicInfluencer";
import CategoryCheckboxList from "@/components/CategoryCheckboxList";
import { parseHttpsUrl } from "@/lib/brandProfile";
import {
  addBrandShortlist,
  fetchBrandShortlist,
  removeBrandShortlist,
  updateBrandShortlistNote,
  type BrandShortlistItem,
} from '@/lib/brandShortlist';
import { openAgreementCount, openBrandAgreements } from '@/lib/brandAgreements';
import { BRAND_BIO_MAX } from '@/lib/brandProfile';
import {
  badgeAfterOpen,
  brandApplicationSeenKey,
  brandProposalAlertIds,
  brandProposalSeenKey,
  readIdList,
  writeIdList,
} from '@/lib/dashboardBadges';
import { formatDate, formatTime } from '@/lib/formatDateTime';
import AnnouncementReadModal, { type AnnouncementReadItem } from '@/components/AnnouncementReadModal';
import { isTimeoutError, withTimeout } from '@/lib/withTimeout';
import ToastViewport, { useToasts } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  Bell,
  Bookmark,
  FileText,
  Home,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  BarChart3,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';

interface Proposal {
  id: string;
  influencer_id: string;
  brand_name: string;
  brand_email: string;
  brand_id?: string;
  service_type: string;
  budget: number;
  counter_proposal_budget?: number;
  counter_proposal_message?: string;
  status: string;
  description?: string;
  created_at: string;
  influencer_agreement_accepted: boolean;
  brand_agreement_accepted: boolean;
  counter_proposal_status?: string;
  selected_extras?: unknown;
  publish_deadline?: string | null;
}

interface Influencer {
  id: string;
  display_name: string;
  avatar_url?: string;
}

function AgreementOpenButton({
  lang,
  onClick,
}: {
  lang: "el" | "en";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white transition-all hover:bg-amber-700"
    >
      ⚠️ {lang === "el" ? "Συμφωνία" : "Agreement"}
    </button>
  );
}

function asAuditText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const text = value.filter((item) => typeof item === "string").join(" ");
    return text || null;
  }
  return null;
}

function asAuditList(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const list = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return list.length ? list : null;
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return null;
}

// Edit Brand Modal Component Props
type EditBrandModalProps = {
  brand: any;
  onClose: () => void;
  onSave: (updatedData: any) => void;
  updating: boolean;
  lang: 'el' | 'en';
  txt: any;
  onToast: (message: string, tone: 'success' | 'error') => void;
  focusBio?: boolean;
};

const t = {
  el: {
    title: "Dashboard Επιχείρησης",
    logout: "Αποσύνδεση",
    edit_profile: "Επεξεργασία Προφίλ",
    save_changes: "Αποθήκευση Αλλαγών",
    cancel: "Ακύρωση",
    edit_brand_name: "Όνομα Επιχείρησης",
    edit_contact_email: "Email",
    edit_contact_person: "Επικοινωνία",
    edit_afm: "ΑΦΜ",
    edit_website: "Ιστοσελίδα",
    edit_instagram: "Instagram",
    edit_city: "Πόλη",
    edit_bio: "Bio / Περιγραφή",
    edit_bio_hint: "Έως 600 χαρακτήρες. Χωρίς τηλέφωνα, email ή links.",
    edit_category: "Κατηγορία",
    edit_logo: "Λογότυπο",
    upload_logo: "Ανέβασμα Λογοτύπου",
    remove_logo: "Αφαίρεση",
    profile_updated: "Το προφίλ ενημερώθηκε επιτυχώς!",
    error_updating: "Σφάλμα κατά την ενημέρωση",
    pending_agreements: "Συμφωνίες που αναμένουν αποδοχή",
    awaiting_agreements: "Συμφωνίες που περιμένουν τον influencer",
    awaiting_note: "Η αίτηση έγινε αποδεκτή. Ο influencer δεν έχει αποδεχτεί ακόμα τους όρους.",
    no_pending: "Δεν υπάρχουν συμφωνίες που αναμένουν αποδοχή",
    proposal_details: "Λεπτομέρειες Πρότασης",
    influencer: "Influencer",
    service: "Υπηρεσία",
    budget: "Budget",
    description: "Περιγραφή",
    accept_agreement: "Αποδοχή Συμφωνίας",
    accepted: "Αποδεκτή",
    pending: "Εκκρεμής",
    loading: "Φόρτωση...",
    error: "Σφάλμα",
    recommendations_title: "Προτεινόμενοι Influencers για εσάς",
    recommendations_subtitle: "Με βάση την κατηγορία, την περιοχή, το budget των καμπανιών και τα στοιχεία του προφίλ",
    recommendations_loading: "Φόρτωση προτάσεων...",
    recommendations_empty: "Δεν βρέθηκαν προτάσεις αυτή τη στιγμή",
    match_score: "Βαθμός ταιριάσματος",
    match_label: "Ταίριασμα",
    why_match: "Γιατί ταιριάζει",
    view_profile: "Προφίλ",
    send_proposal: "Πρόταση",
    engagement_rate: "Ποσοστό αλληλεπίδρασης",
    rating: "Αξιολόγηση",
    reviews: "Reviews",
    followers: "Ακόλουθοι",
    filters: "Φίλτρα",
    refresh: "Ανανέωση",
    category_filter: "Κατηγορία",
    platform_filter: "Πλατφόρμα",
    location_filter: "Περιοχή",
    location_placeholder: "π.χ. Αθήνα",
    max_price: "Μέγιστη τιμή",
    max_price_placeholder: "Χωρίς όριο",
    skills_filter: "Δεξιότητες",
    skills_all: "Όλες",
    audience_filter: "Μέγεθος κοινού",
    audience_all: "Όλα",
    audience_nano: "Nano (1k-10k)",
    audience_micro: "Micro (10k-100k)",
    audience_macro: "Macro (100k+)",
    platform_all: "Όλες",
    category_all: "Όλες",
    clear_filters: "Καθαρισμός φίλτρων",
    stats_title: "Στατιστικά Προτάσεων",
    total_viewed: "Σύνολο Προτάσεων",
    profiles_clicked: "Προφίλ που Επισκέφτηκες",
    proposals_sent: "Προσφορές που Στείλατε",
    smart_service_title: "🤖 Έξυπνη Υπηρεσία Προτάσεων",
    smart_service_desc: "Το AI μας αναλύει το brand σας και προτείνει τους καλύτερους influencers. Δωρεάν για όλες τις εγγεγραμμένες επιχειρήσεις!"
  },
  en: {
    title: "Company Dashboard",
    logout: "Logout",
    edit_profile: "Edit Profile",
    save_changes: "Save Changes",
    cancel: "Cancel",
    edit_brand_name: "Company Name",
    edit_contact_email: "Email",
    edit_contact_person: "Contact Person",
    edit_afm: "Tax ID",
    edit_website: "Website",
    edit_instagram: "Instagram",
    edit_city: "City",
    edit_bio: "Bio / About",
    edit_bio_hint: "Up to 600 characters. No phones, emails, or links.",
    edit_category: "Category",
    edit_logo: "Logo",
    upload_logo: "Upload Logo",
    remove_logo: "Remove",
    profile_updated: "Profile updated successfully!",
    error_updating: "Error updating profile",
    pending_agreements: "Agreements Pending Acceptance",
    awaiting_agreements: "Agreements waiting on the influencer",
    awaiting_note: "The application was accepted. The influencer has not accepted the terms yet.",
    no_pending: "No agreements pending acceptance",
    recommendations_title: "Recommended Influencers for You",
    recommendations_subtitle: "Based on category, area, campaign budget, and profile details",
    recommendations_loading: "Loading recommendations...",
    recommendations_empty: "No recommendations found at this time",
    match_score: "Match Score",
    match_label: "Match",
    why_match: "Why it matches",
    view_profile: "Profile",
    send_proposal: "Proposal",
    engagement_rate: "Engagement Rate",
    rating: "Rating",
    reviews: "Reviews",
    followers: "Followers",
    filters: "Filters",
    refresh: "Refresh",
    category_filter: "Category",
    platform_filter: "Platform",
    location_filter: "Area",
    location_placeholder: "e.g. Athens",
    max_price: "Max price",
    max_price_placeholder: "No limit",
    skills_filter: "Skills",
    skills_all: "All",
    audience_filter: "Audience size",
    audience_all: "All",
    audience_nano: "Nano (1k-10k)",
    audience_micro: "Micro (10k-100k)",
    audience_macro: "Macro (100k+)",
    platform_all: "All",
    category_all: "All",
    clear_filters: "Clear filters",
    stats_title: "Recommendation Stats",
    total_viewed: "Total Recommendations",
    profiles_clicked: "Profiles Viewed",
    proposals_sent: "Proposals Sent",
    smart_service_title: "🤖 Smart Recommendation Service",
    smart_service_desc: "Our AI analyzes your brand and suggests the best influencers. Free for all registered businesses!",
    proposal_details: "Proposal Details",
    influencer: "Influencer",
    service: "Service",
    budget: "Budget",
    description: "Description",
    accept_agreement: "Accept Agreement",
    accepted: "Accepted",
    pending: "Pending",
    loading: "Loading...",
    error: "Error"
  }
};

// Edit Brand Modal Component
function EditBrandModal({ brand, onClose, onSave, updating, lang, txt, onToast, focusBio = false }: EditBrandModalProps) {
  const [brandName, setBrandName] = useState(brand.brand_name || '');
  const [contactPerson, setContactPerson] = useState(brand.contact_person || '');
  const [website, setWebsite] = useState(brand.website || '');
  const [instagram, setInstagram] = useState(brand.instagram || '');
  const [city, setCity] = useState(brand.city || '');
  const [bio, setBio] = useState(brand.bio || '');
  useEffect(() => {
    if (!focusBio) return;
    const field = document.getElementById("brand-bio");
    field?.scrollIntoView({ block: "nearest" });
    if (field instanceof HTMLTextAreaElement) field.focus();
  }, [focusBio]);
  const [categories, setCategories] = useState<string[]>(parseStoredCategories(brand.industry || brand.category || ''));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(brand.logo_url || null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Legacy /api/me/profile omits city/instagram until ADD_BRAND_BIO_PROFILE.sql is applied.
  const hasCity =
    brand?._profileSchema !== "legacy" && Object.prototype.hasOwnProperty.call(brand || {}, "city");
  const hasInstagram =
    brand?._profileSchema !== "legacy" &&
    Object.prototype.hasOwnProperty.call(brand || {}, "instagram");

  // Keep fields in sync with the latest brand row (incl. bio from signup / profile API).
  useEffect(() => {
    setBrandName(brand.brand_name || '');
    setContactPerson(brand.contact_person || '');
    setWebsite(brand.website || '');
    setInstagram(brand.instagram || '');
    setCity(brand.city || '');
    setBio(brand.bio || '');
    setCategories(parseStoredCategories(brand.industry || brand.category || ''));
    setLogoFile(null);
    setLogoPreview(brand.logo_url || null);
  }, [brand]);

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
    if (parseStoredCategories(categories).length === 0) {
      onToast(lang === 'el' ? 'Επιλέξτε τουλάχιστον μία κατηγορία.' : 'Select at least one category.', 'error');
      return;
    }
    
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
            // Extract filename from full URL
            const urlParts = brand.logo_url.split('/');
            const oldFileName = urlParts[urlParts.length - 1];
            if (oldFileName.startsWith('brand-')) {
              await supabase.storage.from('avatars').remove([oldFileName]);
            }
          } catch (deleteErr) {
            console.warn('Could not delete old logo:', deleteErr);
            // Continue anyway
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
        onToast(lang === 'el' ? `Σφάλμα κατά το ανέβασμα λογοτύπου: ${err.message}` : `Error uploading logo: ${err.message}`, 'error');
        setUploadingLogo(false);
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
    let nextWebsite: string | null = null;
    let nextInstagram: string | null = null;
    try {
      nextWebsite = parseHttpsUrl(website, "website");
    } catch {
      onToast(lang === "el" ? "Μη έγκυρη ιστοσελίδα." : "Invalid website URL.", "error");
      return;
    }
    if (hasInstagram) {
      try {
        nextInstagram = parseHttpsUrl(instagram, "instagram");
      } catch {
        onToast(lang === "el" ? "Μη έγκυρο Instagram (handle ή URL)." : "Invalid Instagram handle or URL.", "error");
        return;
      }
    }
    const nextCity = city.trim() || null;
    const nextBio = bio.trim() || null;
    const nextIndustry = formatStoredCategories(categories) || null;
    const prevIndustry = formatStoredCategories(brand.industry || brand.category || "") || null;

    const patch: Record<string, unknown> = {};
    const clearFields: string[] = [];

    if (!strEq(nextName, brand.brand_name || "")) patch.brand_name = nextName;
    if (!strEq(nextContact, brand.contact_person || null)) patch.contact_person = nextContact;
    if (!strEq(nextIndustry, prevIndustry)) patch.category = nextIndustry;
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
      onClose();
      return;
    }

    onSave(patch);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{txt.edit_profile}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={lang === 'el' ? 'Κλείσιμο' : 'Close'}
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-white hover:text-gray-200"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Brand Name */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {txt.edit_brand_name} *
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
              {txt.edit_contact_person}
            </label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder={lang === 'el' ? 'π.χ. Μαρία Παπαδοπούλου' : 'e.g. Maria Papadopoulou'}
              className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {txt.edit_contact_email}
            </label>
            <input
              type="email"
              value={brand.contact_email || ''}
              disabled
              className="w-full px-4 py-3 bg-slate-100 text-slate-600 border-2 border-slate-200 rounded-xl cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'el' ? 'Το email δεν μπορεί να αλλάξει' : 'Email cannot be changed'}
            </p>
          </div>

          {/* AFM (Read-only) */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {txt.edit_afm}
            </label>
            <input
              type="text"
              value={brand.afm || ''}
              disabled
              className="w-full px-4 py-3 bg-slate-100 text-slate-600 border-2 border-slate-200 rounded-xl cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'el' ? 'Το ΑΦΜ δεν μπορεί να αλλάξει' : 'Tax ID cannot be changed'}
            </p>
          </div>

          <CategoryCheckboxList
            lang={lang}
            selected={categories}
            onChange={setCategories}
            label={`${txt.edit_category} *`}
            description={lang === 'el' ? 'Επιλέξτε μία ή περισσότερες κατηγορίες' : 'Select one or more categories'}
            compact
          />

          {/* Bio */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {txt.edit_bio}
            </label>
            <textarea
              id="brand-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, BRAND_BIO_MAX))}
              rows={4}
              maxLength={BRAND_BIO_MAX}
              placeholder={lang === 'el' ? 'Πείτε ποιοι είστε και τι ψάχνετε…' : 'Tell creators who you are and what you look for…'}
              className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y"
            />
            <p className="text-xs text-slate-500 mt-1">
              {txt.edit_bio_hint} ({bio.length}/{BRAND_BIO_MAX})
            </p>
          </div>

          {/* City */}
          {hasCity && (
            <div>
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
                {txt.edit_city}
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={lang === 'el' ? 'π.χ. Αθήνα' : 'e.g. Athens'}
                className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          )}

          {/* Website */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {txt.edit_website}
            </label>
            <input
              type="text"
              inputMode="url"
              autoComplete="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="example.com"
              className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            <p className="text-xs text-slate-500 mt-1">
              {lang === "el"
                ? "Χωρίς https:// είναι εντάξει — θα προστεθεί αυτόματα."
                : "https:// is optional — we’ll add it automatically."}
            </p>
          </div>

          {hasInstagram && (
            <div>
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
                {txt.edit_instagram}
              </label>
              <input
                type="text"
                inputMode="url"
                autoComplete="off"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@yourbrand"
                className="w-full px-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
              <p className="text-xs text-slate-500 mt-1">
                {lang === "el"
                  ? "Handle ή URL — χωρίς @ / https:// είναι εντάξει."
                  : "Handle or URL — @ and https:// are optional."}
              </p>
            </div>
          )}

          {/* Logo */}
          <div>
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              {txt.edit_logo}
            </label>
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24 rounded-lg border-2 border-slate-300 overflow-hidden bg-slate-100 flex items-center justify-center">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-200">
                    <span className="text-slate-500 text-xs font-medium">
                      {lang === 'el' ? 'ΧΩΡΙΣ ΛΟΓΟ' : 'NO LOGO'}
                    </span>
                  </div>
                )}
                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="flex-1">
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <span className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
                    {txt.upload_logo}
                  </span>
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  {lang === 'el' ? 'PNG, JPG, GIF έως 5MB' : 'PNG, JPG, GIF up to 5MB'}
                </p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
            >
              {txt.cancel}
            </button>
            <button
              type="submit"
              disabled={updating || uploadingLogo}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating || uploadingLogo ? (lang === 'el' ? 'Αποθήκευση...' : 'Saving...') : txt.save_changes}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

async function fetchPendingApplicationIds(brandId: string): Promise<string[] | null> {
  const { data: camps, error: campError } = await supabase
    .from("brand_campaigns")
    .select("id")
    .eq("brand_id", brandId);
  if (campError) {
    console.error("[Brand Dashboard] pending campaign applications", campError);
    return null;
  }
  if (!camps?.length) return [];
  const ids = camps.map((c) => c.id);
  const { data, error } = await supabase
    .from("campaign_applications")
    .select("id")
    .in("campaign_id", ids)
    .eq("status", "pending");
  if (error) {
    console.error("[Brand Dashboard] pending campaign applications", error);
    return null;
  }
  return (data || []).map((row) => String(row.id));
}

type BrandTab =
  | 'overview'
  | 'recommendations'
  | 'campaigns'
  | 'proposals'
  | 'messages'
  | 'shortlist'
  | 'tools'
  | 'announcements'
  | 'statistics';

const RETRY_LABEL = { el: 'Δοκίμασε ξανά', en: 'Try again' } as const;

/** English copy only when the announcement row actually has one. No invented translation. */
function announcementText(primary: string, english: string | null | undefined, lang: "el" | "en"): string {
  if (lang === "en" && typeof english === "string" && english.trim()) return english.trim();
  return primary;
}

const recommendationFieldClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors hover:border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20";

export default function BrandDashboardContent() {
  const [lang, setLang] = useState<'el' | 'en'>('el'); // Default to Greek, will be updated in useEffect
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();
  const notify = (message: string, tone: 'success' | 'error' | 'info' = 'info') => pushToast(message, tone);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [influencers, setInfluencers] = useState<Record<string, Influencer>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  // Load language from localStorage on client-side
  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);

  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [savingAgreement, setSavingAgreement] = useState(false);
  const [processingCounterProposal, setProcessingCounterProposal] = useState<string | null>(null);
  const [recommendationSource, setRecommendationSource] = useState<{
    brand: BrandProfile;
    profiles: InfluencerProfile[];
  } | null>(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsReady, setRecommendationsReady] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [brandData, setBrandData] = useState<any>(null);

  useOwnPresenceHeartbeat(
    brandData?.contact_email ? { kind: 'brand', brandEmail: brandData.contact_email } : null
  );
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFocusBio, setEditFocusBio] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [recommendationFilters, setRecommendationFilters] = useState(EMPTY_RECOMMENDATION_FILTERS);
  const [recommendationFiltersOpen, setRecommendationFiltersOpen] = useState(false);
  const activeRecommendationFilters = activeRecommendationFilterCount(recommendationFilters);
  const recommendationBasePool = useMemo(() => {
    if (!recommendationSource) return [];
    return recommendInfluencers(recommendationSource.brand, recommendationSource.profiles, {
      limit: 30,
      minScore: RECOMMENDATION_MIN_SCORE,
      preferVerified: true,
      preferHighRating: true,
      lang,
    });
  }, [recommendationSource, lang]);
  const recommendationFallback = useMemo(() => {
    if (!recommendationSource) return [];
    const filtered = filterRecommendationProfiles(recommendationSource.profiles, recommendationFilters);
    return recommendInfluencers(recommendationSource.brand, filtered, {
      limit: 12,
      minScore: RECOMMENDATION_MIN_SCORE,
      preferVerified: true,
      preferHighRating: true,
      lang,
    });
  }, [recommendationSource, recommendationFilters, lang]);
  const recommendationPoolKey = recommendationBasePool.map((match) => String(match.influencer.id)).join(",");
  const [geminiRanking, setGeminiRanking] = useState<{
    key: string;
    rows: Array<{ id?: string; reasons_el?: unknown; reasons_en?: unknown }> | null;
  } | null>(null);
  const recommendations = useMemo(() => {
    const allowed = new Set(
      filterRecommendationProfiles(
        recommendationSource?.profiles || [],
        recommendationFilters
      ).map((profile) => String(profile.id))
    );
    const byId = new Map(recommendationBasePool.map((match) => [String(match.influencer.id), match]));
    if (geminiRanking && geminiRanking.key === recommendationPoolKey && geminiRanking.rows?.length) {
      const ranked = [];
      for (const row of geminiRanking.rows) {
        const id = String(row?.id || "");
        if (!allowed.has(id)) continue;
        const match = byId.get(id);
        const lines = lang === "en" ? row?.reasons_en : row?.reasons_el;
        if (!match || !Array.isArray(lines) || lines.length !== 3) continue;
        if (lines.some((line) => typeof line !== "string" || !line.trim())) continue;
        ranked.push({ ...match, reasons: lines.map((line: string) => line.trim()) });
      }
      if (ranked.length) return ranked.slice(0, 8);
    }
    return recommendationFallback;
  }, [
    recommendationSource,
    recommendationFilters,
    recommendationBasePool,
    recommendationFallback,
    geminiRanking,
    recommendationPoolKey,
    lang,
  ]);

  useEffect(() => {
    if (!recommendationPoolKey) {
      setGeminiRanking(null);
      return;
    }
    const key = recommendationPoolKey;
    const ids = recommendationBasePool.map((match) => String(match.influencer.id));
    let cancelled = false;
    void (async () => {
      try {
        const response = await sessionFetch("/api/brand/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        const body = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.ok && body?.source === "gemini" && Array.isArray(body.ranking)) {
          setGeminiRanking({ key, rows: body.ranking });
        } else {
          setGeminiRanking({ key, rows: null });
        }
      } catch {
        if (!cancelled) setGeminiRanking({ key, rows: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recommendationPoolKey, recommendationBasePool]);

  // Load stats from localStorage on mount
  type RecommendationStats = {
    totalViewed: number;
    profilesClicked: number;
    proposalsSent: number;
  };
  
  const [recommendationStats, setRecommendationStats] = useState<RecommendationStats>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('brandDashboardStats');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Error parsing saved stats:', e);
        }
      }
    }
    return {
      totalViewed: 0,
      profilesClicked: 0,
      proposalsSent: 0,
    };
  });

  // Save stats to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('brandDashboardStats', JSON.stringify(recommendationStats));
    }
  }, [recommendationStats]);

  useEffect(() => {
    if (!recommendationsReady || recommendationsLoading) return;
    setRecommendationStats((prev) =>
      prev.totalViewed === recommendations.length ? prev : { ...prev, totalViewed: recommendations.length }
    );
  }, [recommendations.length, recommendationsReady, recommendationsLoading]);
  const [activeTab, setActiveTab] = useState<BrandTab>('overview');
  const tabsNavRef = useRef<HTMLElement | null>(null);
  const loadSeq = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shortlist, setShortlist] = useState<BrandShortlistItem[]>([]);
  const [shortlistLoading, setShortlistLoading] = useState(false);
  const [shortlistError, setShortlistError] = useState<string | null>(null);
  const [shortlistMissingTable, setShortlistMissingTable] = useState(false);
  const [shortlistBusyId, setShortlistBusyId] = useState<string | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [announcementsList, setAnnouncementsList] = useState<
    Array<{
      id: string;
      title: string;
      title_en?: string | null;
      body: string;
      body_en?: string | null;
      created_at: string;
      read: boolean;
      read_at: string | null;
    }>
  >([]);
  const [unreadAnnouncementsCount, setUnreadAnnouncementsCount] = useState(0);
  const [openAnnouncement, setOpenAnnouncement] = useState<AnnouncementReadItem | null>(null);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [activeCampaignCount, setActiveCampaignCount] = useState(0);
  const [pendingCampaignApplicationsCount, setPendingCampaignApplicationsCount] = useState(0);
  const [pendingApplicationIds, setPendingApplicationIds] = useState<string[]>([]);
  const [applicationsLoaded, setApplicationsLoaded] = useState(false);
  const [proposalsLoaded, setProposalsLoaded] = useState(false);
  const [unseenApplicationCount, setUnseenApplicationCount] = useState(0);
  const [unseenProposalCount, setUnseenProposalCount] = useState(0);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [appsFocus, setAppsFocus] = useState(0);
  /** Ανοίγει το tab Μηνύματα με συγκεκριμένο influencer (από αίτηση καμπάνιας ή πρόταση). */
  const [messageTargetInfluencer, setMessageTargetInfluencer] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [threadConversationId, setThreadConversationId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const txt = t[lang];

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (
      tab === 'overview' ||
      tab === 'campaigns' ||
      tab === 'messages' ||
      tab === 'proposals' ||
      tab === 'recommendations' ||
      tab === 'shortlist' ||
      tab === 'tools' ||
      tab === 'announcements' ||
      tab === 'statistics'
    ) {
      setActiveTab(tab);
    } else if (!tab) {
      setActiveTab('overview');
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab !== "recommendations") return;
    if (typeof window === "undefined" || window.location.hash !== "#recommended") return;
    document.getElementById("recommended")?.scrollIntoView({ block: "start" });
  }, [activeTab]);

  useEffect(() => {
    const nav = tabsNavRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth + 1) return;
    const btn = nav.querySelector<HTMLElement>(`[data-brand-tab="${activeTab}"]`);
    btn?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [activeTab, lang]);

  useEffect(() => {
    const titlesEl: Record<string, string> = {
      overview: "Επισκόπηση | Influo",
      recommendations: "Προτάσεις | Influo",
      campaigns: "Καμπάνιες | Influo",
      proposals: "Προσφορές | Influo",
      messages: "Μηνύματα | Influo",
      shortlist: "Shortlist | Influo",
      tools: "Εργαλεία | Influo",
      announcements: "Ανακοινώσεις | Influo",
      statistics: "Στατιστικά | Influo",
    };
    const titlesEn: Record<string, string> = {
      overview: "Overview | Influo",
      recommendations: "Recommendations | Influo",
      campaigns: "Campaigns | Influo",
      proposals: "Proposals | Influo",
      messages: "Messages | Influo",
      shortlist: "Shortlist | Influo",
      tools: "Tools | Influo",
      announcements: "Announcements | Influo",
      statistics: "Statistics | Influo",
    };
    const map = lang === "en" ? titlesEn : titlesEl;
    document.title = map[activeTab] || (lang === "en" ? "Brand Dashboard | Influo" : "Πίνακας επιχείρησης | Influo");
  }, [lang, activeTab]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (brandData?.contact_email) {
      const refresh = () => {
        void loadUnreadMessageCount();
      };
      refresh();
      const interval = setInterval(() => {
        if (document.hidden) return;
        refresh();
      }, 120000);
      const onVisibility = () => {
        if (!document.hidden) refresh();
      };
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("messagesRead", refresh);
      window.addEventListener("focus", refresh);
      return () => {
        clearInterval(interval);
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("messagesRead", refresh);
        window.removeEventListener("focus", refresh);
      };
    }
  }, [brandData?.contact_email]);

  const loadUnreadAnnouncementsCount = async () => {
    try {
      const res = await sessionFetch("/api/brand/announcements/unread-count", { cache: "no-store" });
      const data = await res.json().catch(() => ({ count: 0 }));
      if (res.ok && typeof data.count === "number") {
        setUnreadAnnouncementsCount(Math.max(0, data.count));
      }
    } catch (e) {
      console.error("Error loading unread announcements count:", e);
    }
  };

  useEffect(() => {
    if (!brandData?.id) return;
    const refresh = () => {
      if (activeTab === "announcements") return;
      void loadUnreadAnnouncementsCount();
    };
    refresh();
    const interval = setInterval(() => {
      if (document.hidden) return;
      refresh();
    }, 120000);
    const onVisibility = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, [brandData?.id, activeTab]);

  const loadAnnouncements = async (markRead: boolean) => {
    setAnnouncementsLoading(true);
    setAnnouncementsError(null);
    try {
      const res = await withTimeout(
        sessionFetch("/api/brand/announcements", { cache: "no-store" }),
        20000
      );
      const data = await res.json().catch(() => ({ data: [] }));
      if (!res.ok) throw new Error("announcements");
      const rows = (Array.isArray(data.data) ? data.data : []) as typeof announcementsList;
      const unread = rows.filter((row) => !row.read);
      setAnnouncementsList(rows);
      setUnreadAnnouncementsCount(unread.length);
      if (!markRead) return;
      await withTimeout(
        Promise.all(
          unread.map((row) =>
            sessionFetch(`/api/brand/announcements/${row.id}/read`, { method: "POST" })
          )
        ),
        20000
      );
      if (unread.length > 0) {
        setAnnouncementsList((prev) =>
          prev.map((x) =>
            unread.some((u) => u.id === x.id)
              ? { ...x, read: true, read_at: x.read_at || new Date().toISOString() }
              : x
          )
        );
        setUnreadAnnouncementsCount(0);
      }
    } catch (e) {
      console.error("Error loading announcements:", e);
      setAnnouncementsError(
        isTimeoutError(e)
          ? (lang === "el" ? "Η φόρτωση άργησε." : "Loading took too long.")
          : (lang === "el" ? "Οι ανακοινώσεις δεν φορτώθηκαν." : "Announcements could not be loaded.")
      );
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const openAnnouncementItem = async (item: (typeof announcementsList)[number]) => {
    setOpenAnnouncement({
      id: item.id,
      title: announcementText(item.title, item.title_en, lang),
      body: announcementText(item.body, item.body_en, lang),
      createdAt: item.created_at,
    });
    if (item.read) return;
    try {
      const res = await sessionFetch(`/api/brand/announcements/${item.id}/read`, { method: "POST" });
      if (!res.ok) return;
      setAnnouncementsList((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, read: true, read_at: new Date().toISOString() } : row))
      );
      setUnreadAnnouncementsCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error("Error marking announcement as read:", e);
    }
  };

  useEffect(() => {
    if (!brandData?.id) return;
    if (activeTab !== "announcements" && activeTab !== "overview") return;
    void loadAnnouncements(activeTab === "announcements");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, brandData?.id]);

  const loadShortlist = async () => {
    setShortlistLoading(true);
    setShortlistError(null);
    try {
      const items = await withTimeout(fetchBrandShortlist(), 20000);
      setShortlist(items);
      setShortlistMissingTable(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "missing_table") setShortlistMissingTable(true);
      else {
        setShortlistError(
          isTimeoutError(e)
            ? (lang === 'el' ? 'Η φόρτωση άργησε.' : 'Loading took too long.')
            : (lang === 'el' ? 'Η λίστα δεν φορτώθηκε.' : 'The list could not be loaded.')
        );
      }
    } finally {
      setShortlistLoading(false);
    }
  };

  useEffect(() => {
    if (brandData?.id) loadShortlist();
  }, [brandData?.id]);

  const toggleShortlist = async (influencerId: string) => {
    const id = String(influencerId);
    setShortlistBusyId(id);
    try {
      if (shortlist.some((s) => s.influencerId === id)) {
        await removeBrandShortlist(id);
        setShortlist((rows) => rows.filter((s) => s.influencerId !== id));
      } else {
        await addBrandShortlist(id);
        await loadShortlist();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "missing_table") setShortlistMissingTable(true);
      else notify(lang === "el" ? "Δεν αποθηκεύτηκε. Δοκιμάστε ξανά." : "Could not save. Try again.", "error");
    } finally {
      setShortlistBusyId(null);
    }
  };

  /** Pending applications across this brand's campaigns. The red tab badge is only the ones not opened yet. */
  useEffect(() => {
    if (!brandData?.id) {
      setPendingApplicationIds([]);
      setPendingCampaignApplicationsCount(0);
      setApplicationsLoaded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ids = await withTimeout(fetchPendingApplicationIds(String(brandData.id)), 20000);
        if (cancelled) return;
        if (ids !== null) {
          setPendingApplicationIds(ids);
          setPendingCampaignApplicationsCount(ids.length);
        }
        const { count } = await supabase
          .from("brand_campaigns")
          .select("id", { count: "exact", head: true })
          .eq("brand_id", brandData.id)
          .eq("status", "open");
        if (!cancelled && typeof count === "number") setActiveCampaignCount(count);
      } catch (error) {
        console.error("[Brand Dashboard] campaign snapshot", error);
      } finally {
        if (!cancelled) setApplicationsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandData?.id, activeTab]);

  useEffect(() => {
    if (!viewerId || typeof window === "undefined") return;
    const store = window.localStorage;
    setUnseenApplicationCount(
      badgeAfterOpen(
        activeTab === "campaigns",
        applicationsLoaded,
        pendingApplicationIds,
        readIdList(store, brandApplicationSeenKey(viewerId))
      )
    );
    if (activeTab === "campaigns" && applicationsLoaded) {
      writeIdList(store, brandApplicationSeenKey(viewerId), pendingApplicationIds);
    }
    const proposalIds = brandProposalAlertIds(proposals);
    setUnseenProposalCount(
      badgeAfterOpen(
        activeTab === "proposals",
        proposalsLoaded,
        proposalIds,
        readIdList(store, brandProposalSeenKey(viewerId))
      )
    );
    if (activeTab === "proposals" && proposalsLoaded) {
      writeIdList(store, brandProposalSeenKey(viewerId), proposalIds);
    }
  }, [viewerId, activeTab, applicationsLoaded, pendingApplicationIds, proposals, proposalsLoaded]);

  useEffect(() => {
    if (activeTab !== "messages") {
      setMessageTargetInfluencer(null);
      setThreadConversationId(null);
    }
  }, [activeTab]);

  const loadUnreadMessageCount = async () => {
    if (!brandData?.contact_email) {
      setUnreadMessageCount(0);
      return;
    }
    
    try {
      // Get all conversations for this brand
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .ilike('brand_email', brandData.contact_email.toLowerCase().trim());

      if (convError) {
        console.error('Error loading conversations:', convError);
        setUnreadMessageCount(0);
        return;
      }

      if (!conversations || conversations.length === 0) {
        setUnreadMessageCount(0);
        return;
      }

      // Count unread messages (messages from influencer that are not read)
      const conversationIds = conversations.map(c => c.id);
      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .eq('sender_type', 'influencer')
        .or('read.eq.false,read.is.null');

      if (error) {
        console.error('Error loading unread messages:', error);
        setUnreadMessageCount(0);
        return;
      }

      setUnreadMessageCount(count || 0);
    } catch (error) {
      console.error('Error loading unread message count:', error);
      setUnreadMessageCount(0);
    }
  };

  const loadData = async () => {
    const seq = ++loadSeq.current;
    setLeaving(false);
    setLoadError(null);
    setLoading(true);
    try {
      const auth = await withTimeout(lookupAuthUser(8000), 12000);
      if (seq !== loadSeq.current) return;
      if (!auth?.user) {
        if (!auth || auth.timedOut) {
          setLoadError(lang === 'el' ? 'Η σύνδεση άργησε να απαντήσει. Δοκιμάστε ξανά.' : 'Sign-in took too long. Try again.');
          return;
        }
        router.replace('/login');
        return;
      }
      setViewerId(auth.user.id);

      const profiles = await withTimeout(loadOwnProfiles(supabase), 12000);
      if (seq !== loadSeq.current) return;
      if (!profiles) {
        setLoadError(lang === 'el' ? 'Η φόρτωση άργησε.' : 'Loading took too long.');
        return;
      }
      if (!profiles.ok) {
        setLoadError(profiles.message);
        return;
      }
      if (!profiles.brand) {
        setLeaving(true);
        router.replace('/dashboard');
        return;
      }
      const brandData = profiles.brand as any;

      console.log(`[Brand Dashboard] Loaded brandData:`, brandData);
      console.log(`[Brand Dashboard] Brand email: ${brandData.contact_email}`);
      setBrandData(brandData);
      setLoadError(null);
      setLoading(false);

      // Proposals and recommendations must not fail the whole dashboard.
      void loadRecommendations(brandData);
      try {
      if (seq !== loadSeq.current) return;
      await sessionFetch('/api/proposals/claim', { method: 'POST' }).catch(() => {});

      const proposalsResponse = await sessionFetch('/api/proposals?role=brand', { cache: 'no-store' });
      const proposalsBody = await proposalsResponse.json().catch(() => ({}));
      if (!proposalsResponse.ok) throw new Error(proposalsBody.error || 'Could not load proposals');
      const proposalsData = Array.isArray(proposalsBody.proposals) ? proposalsBody.proposals as Proposal[] : [];
        setProposals(proposalsData as Proposal[]);
        setProposalsLoaded(true);

        // Get unique influencer IDs
        const influencerIds = [...new Set(proposalsData.map((p: Proposal) => p.influencer_id))];

        // Fetch influencer avatars (session-cached per id)
        if (influencerIds.length > 0) {
          const influencersMap: Record<string, Influencer> = {};
          const missing: string[] = [];
          for (const id of influencerIds) {
            const cached = readSessionAvatar("influencer", String(id));
            if (cached) {
              influencersMap[id] = {
                id,
                display_name: cached.name || "Unknown",
                avatar_url: cached.url || undefined,
              } as Influencer;
            } else {
              missing.push(id);
            }
          }
          if (missing.length > 0) {
            const { data: influencersData } = await supabase
              .from("influencers")
              .select("id, display_name, avatar_url")
              .in("id", missing);
            for (const inf of (influencersData || []) as Influencer[]) {
              influencersMap[inf.id] = inf;
              writeSessionAvatar("influencer", String(inf.id), {
                url: inf.avatar_url || null,
                name: inf.display_name || null,
              });
            }
          }
          setInfluencers(influencersMap);
        }
      } catch (proposalErr) {
        console.error('Error loading proposals:', proposalErr);
      }
    } catch (err) {
      if (seq !== loadSeq.current) return;
      console.error('Error loading data:', err);
      setLoadError(
        isTimeoutError(err)
          ? (lang === 'el' ? 'Η φόρτωση άργησε.' : 'Loading took too long.')
          : (err instanceof Error && err.message
              ? err.message
              : (lang === 'el' ? 'Κάτι πήγε στραβά.' : 'Something went wrong.'))
      );
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  };

  const reloadProposals = async () => {
    try {
      const proposalsResponse = await sessionFetch('/api/proposals?role=brand', { cache: 'no-store' });
      const proposalsBody = await proposalsResponse.json().catch(() => ({}));
      if (!proposalsResponse.ok || !Array.isArray(proposalsBody.proposals)) return;
      const proposalsData = proposalsBody.proposals as Proposal[];
      setProposals(proposalsData);
      setProposalsLoaded(true);
      const influencerIds = [...new Set(proposalsData.map((p) => p.influencer_id).filter(Boolean))];
      if (!influencerIds.length) return;
      const missing: string[] = [];
      const found: Record<string, Influencer> = {};
      for (const id of influencerIds) {
        const cached = readSessionAvatar("influencer", String(id));
        if (cached) {
          found[id] = {
            id,
            display_name: cached.name || "Unknown",
            avatar_url: cached.url || undefined,
          } as Influencer;
        } else {
          missing.push(id);
        }
      }
      if (missing.length > 0) {
        const { data: influencersData } = await supabase
          .from("influencers")
          .select("id, display_name, avatar_url")
          .in("id", missing);
        for (const inf of (influencersData || []) as Influencer[]) {
          found[inf.id] = inf;
          writeSessionAvatar("influencer", String(inf.id), {
            url: inf.avatar_url || null,
            name: inf.display_name || null,
          });
        }
      }
      setInfluencers((prev) => ({ ...prev, ...found }));
    } catch (err) {
      console.error('Error reloading proposals:', err);
    }
  };

  const handleAcceptAgreement = async () => {
    if (!selectedProposal || !agreementAccepted) {
      notify(lang === 'el'
        ? 'Διάβασε και αποδέξου τους όρους της συμφωνίας.'
        : 'Read and accept the agreement terms.', 'error');
      return;
    }

    setSavingAgreement(true);
    try {
      const response = await sessionFetch('/api/proposals/agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: selectedProposal.id,
          userType: 'brand',
          accepted: true
        })
      });

      const result = await response.json();
      if (result.success) {
        const acceptedId = selectedProposal.id;
        setProposals((prev) =>
          prev.map((row) => (row.id === acceptedId ? { ...row, brand_agreement_accepted: true } : row))
        );
        const proposalsResponse = await sessionFetch('/api/proposals?role=brand', { cache: 'no-store' });
        const proposalsBody = await proposalsResponse.json().catch(() => ({}));
        if (proposalsResponse.ok && Array.isArray(proposalsBody.proposals)) {
          setProposals(
            (proposalsBody.proposals as Proposal[]).map((row) =>
              row.id === acceptedId ? { ...row, brand_agreement_accepted: true } : row
            )
          );
        }
        setShowAgreementModal(false);
        setSelectedProposal(null);
        setAgreementAccepted(false);
        notify(lang === 'el'
          ? 'Η συμφωνία έγινε αποδεκτή.'
          : 'Agreement accepted.', 'success');
      } else {
        throw new Error(result.error || 'Error accepting agreement');
      }
    } catch (err: any) {
      console.error('Error accepting agreement:', err);
      notify(err.message || txt.error, 'error');
    } finally {
      setSavingAgreement(false);
    }
  };

  const loadRecommendations = async (brand: any) => {
    setRecommendationsLoading(true);
    setRecommendationsError(null);
    try {
      // Cached approved list — no bio / full auditpr_audit (JSON paths only).
      const influencersData = await withTimeout(getApprovedInfluencersForRecommendations(), 20000);

      const ids = (influencersData || [])
        .map((inf) => String(inf.id || ""))
        .filter(Boolean);
      const priceById: Record<string, string | null> = {};
      const fromPriceById: Record<string, number | null> = {};
      const pastById: Record<string, string[]> = {};
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token && ids.length) {
          const priceRes = await withTimeout(fetch(
            `/api/influencers/commercial?ids=${encodeURIComponent(ids.join(","))}`,
            { headers: { Authorization: `Bearer ${token}` } }
          ));
          if (priceRes.ok) {
            const priceBody = await priceRes.json();
            const payload = priceBody?.data ?? priceBody;
            const rows = Array.isArray(payload)
              ? payload
              : payload && typeof payload === "object"
                ? [payload]
                : [];
            for (const row of rows) {
              if (row?.id) {
                const rate = row.min_rate;
                const id = String(row.id);
                priceById[id] =
                  typeof rate === "string" || typeof rate === "number" ? String(rate) : null;
                fromPriceById[id] = lowestListedPrice({
                  service_packages: row.service_packages,
                  rate_card: row.rate_card,
                  min_rate: row.min_rate,
                  accounts: row.accounts,
                });
              }
            }
          }
        }
      } catch (priceErr) {
        console.error("[Brand Dashboard] price lookup failed", priceErr);
      }

      try {
        if (ids.length) {
          const pastRes = await withTimeout(fetch(
            `/api/influencers/past-brands?ids=${encodeURIComponent(ids.join(","))}`
          ));
          if (pastRes.ok) {
            const pastBody = await pastRes.json();
            const payload = pastBody?.data;
            if (payload && typeof payload === "object") {
              for (const [id, brands] of Object.entries(payload)) {
                pastById[id] = Array.isArray(brands)
                  ? brands.filter((b): b is string => typeof b === "string")
                  : [];
              }
            }
          }
        }
      } catch (pastErr) {
        console.error("[Brand Dashboard] past brands lookup failed", pastErr);
      }
      
      // Debug: Log fetched influencers
      console.log('[Brand Dashboard] Fetched approved influencers from DB:', influencersData?.length || 0);
      console.log('[Brand Dashboard] All fetched influencers:', influencersData?.map(inf => ({ name: inf.display_name, approved: inf.approved, verified: inf.verified, id: inf.id })));
      console.log('[Brand Dashboard] Sample influencer:', influencersData?.[0]);
      
      // Helper function to parse follower string
      const parseFollowerString = (value: unknown) => {
        if (value == null || value === "") return 0;
        const clean = String(value).toLowerCase().replace(/,/g, '').trim();
        if (clean.includes('k')) return parseFloat(clean) * 1000;
        if (clean.includes('m')) return parseFloat(clean) * 1000000;
        return parseFloat(clean) || 0;
      };
      
      // Build engagement_rate, followers, avg_likes from accounts (same source as influencer profile page) so metrics match
      const buildMetricsFromAccounts = (accounts: any[] | null) => {
        const engagementRates: { [key: string]: string } = {};
        const avgLikes: { [key: string]: string } = {};
        let maxFollowers = 0;
        let followersStr = '0';
        if (!Array.isArray(accounts)) return { engagement_rate: undefined as string | { [key: string]: string } | undefined, followers_count: '0', avg_likes: undefined as string | { [key: string]: string } | undefined };
        accounts.forEach((acc: any) => {
          if (!acc?.platform) return;
          const platform = acc.platform.toLowerCase();
          if (acc.followers) {
            const n = parseFollowerString(acc.followers);
            if (n > maxFollowers) {
              maxFollowers = n;
              followersStr = acc.followers;
            }
          }
          if (acc.engagement_rate) engagementRates[platform] = acc.engagement_rate;
          if (acc.avg_likes) avgLikes[platform] = acc.avg_likes;
        });
        const engagement_rate = Object.keys(engagementRates).length > 0 ? engagementRates : undefined;
        const avg_likes = Object.keys(avgLikes).length > 0 ? avgLikes : undefined;
        return { engagement_rate, followers_count: followersStr, avg_likes };
      };

      // Convert database influencers to InfluencerProfile format (metrics from accounts = same as profile page)
      const dbInfluencerProfiles: InfluencerProfile[] = (influencersData || []).map((inf: any) => {
        const fromAccounts = buildMetricsFromAccounts(inf.accounts);
        const engagement_rate = fromAccounts.engagement_rate ?? inf.engagement_rate;
        const followers_count = fromAccounts.followers_count;
        const avg_likes = fromAccounts.avg_likes ?? inf.avg_likes;

        const parsedCategories = parseStoredCategories(inf.category);
        return {
          id: inf.id,
          display_name: inf.display_name || 'Unknown',
          category: parsedCategories[0] || inf.category,
          categories: parsedCategories,
          engagement_rate,
          followers_count,
          avg_likes,
          min_rate: priceById[inf.id] ?? null,
          from_price: fromPriceById[String(inf.id)] ?? null,
          languages: inf.languages,
          location: inf.location,
          gender: inf.gender,
          avg_rating: inf.avg_rating,
          total_reviews: inf.total_reviews || 0,
          past_brands: pastById[inf.id] || [],
          verified: inf.analytics_verified || inf.verified || false,
          accounts: inf.accounts,
          avatar_url: inf.avatar_url,
          audience_male_percent: inf.audience_male_percent,
          audience_female_percent: inf.audience_female_percent,
          audience_top_age: inf.audience_top_age,
          bio: null,
          rate_card: undefined,
          auditpr_audit: {
            brandSafe: (inf as { brandSafe?: boolean }).brandSafe ?? (inf.auditpr_audit as { brandSafe?: boolean } | null)?.brandSafe,
            niche: (inf as { niche?: string }).niche ?? (inf.auditpr_audit as { niche?: string } | null)?.niche,
            niche_en: (inf as { niche_en?: string }).niche_en ?? (inf.auditpr_audit as { niche_en?: string } | null)?.niche_en,
            positives: asAuditList((inf as { positives?: unknown }).positives ?? (inf.auditpr_audit as { positives?: unknown } | null)?.positives),
            positives_en: asAuditList((inf as { positives_en?: unknown }).positives_en ?? (inf.auditpr_audit as { positives_en?: unknown } | null)?.positives_en),
            whyWorkWithThem: asAuditText((inf as { whyWorkWithThem?: unknown }).whyWorkWithThem ?? (inf.auditpr_audit as { whyWorkWithThem?: unknown } | null)?.whyWorkWithThem),
            whyWorkWithThem_en: asAuditText((inf as { whyWorkWithThem_en?: unknown }).whyWorkWithThem_en ?? (inf.auditpr_audit as { whyWorkWithThem_en?: unknown } | null)?.whyWorkWithThem_en),
          },
          profile_slug: inf.profile_slug ?? null,
          skills: sanitizeSkills(inf.skills),
        };
      });
      
      // Category mapping from dummy data to standard categories
      // Use only database influencers
      const influencerProfiles: InfluencerProfile[] = dbInfluencerProfiles;
      
      // Debug: Log influencers
      console.log('[Brand Dashboard] Total influencers:', influencerProfiles.length);
      console.log('[Brand Dashboard] Verified influencers:', influencerProfiles.filter(inf => inf.verified).length);
      
      // Process recommendations
      // Get brand profile
      let campaigns: BrandCampaignHint[] = [];
      try {
        const { data: campaignRows, error: campaignError } = await supabase
          .from("brand_campaigns")
          .select("title, budget, platforms, location, category, description, status")
          .eq("brand_id", brand.id)
          .in("status", ["open", "draft"]);
        if (!campaignError && Array.isArray(campaignRows)) {
          campaigns = campaignRows.map((row) => {
            const budget = Number(row.budget);
            return {
              title: typeof row.title === "string" ? row.title : null,
              budget: Number.isFinite(budget) && budget > 0 ? budget : null,
              platforms: Array.isArray(row.platforms) ? row.platforms.filter((item): item is string => typeof item === "string") : [],
              location: typeof row.location === "string" ? row.location : null,
              category: typeof row.category === "string" ? row.category : null,
              description: typeof row.description === "string" ? row.description : null,
            };
          });
        }
      } catch (campaignErr) {
        console.error("[Brand Dashboard] campaign hints failed", campaignErr);
      }

      const brandProfile: BrandProfile = {
        id: brand.id,
        brand_name: brand.brand_name,
        industry: brand.industry, // This is actually the category
        category: brand.industry, // For clarity
        contact_email: brand.contact_email,
        location: typeof brand.city === "string" ? brand.city : null,
        campaigns,
        brief: [
          brand.bio,
          brand.industry,
          ...campaigns.flatMap((campaign) => [campaign.title, campaign.description, campaign.category]),
        ].filter(Boolean).join("\n"),
      };
      
      setRecommendationSource({ brand: brandProfile, profiles: influencerProfiles });
    } catch (err) {
      console.error('Error loading recommendations:', err);
      setRecommendationsError(
        isTimeoutError(err)
          ? (lang === 'el' ? 'Η φόρτωση άργησε.' : 'Loading took too long.')
          : (lang === 'el' ? 'Οι προτάσεις δεν φορτώθηκαν.' : 'Recommendations could not be loaded.')
      );
    } finally {
      setRecommendationsLoading(false);
      setRecommendationsReady(true);
    }
  };

  useEffect(() => {
    if (brandData) void loadRecommendations(brandData);
    // Re-run match reasons when UI language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const handleLogout = async () => {
    const email = brandData?.contact_email;
    if (email) {
      void supabase
        .from('brand_presence')
        .update({
          is_online: false,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('brand_email', String(email).toLowerCase().trim());
    }
    await logoutEverywhere('/login');
  };

  const handleUpdateProfile = async (updatedData: any) => {
    if (!brandData) return;
    
    setUpdating(true);
    try {
      const payload: Record<string, unknown> = { lang };
      if (updatedData.brand_name !== undefined) payload.brand_name = updatedData.brand_name;
      if (updatedData.contact_person !== undefined) {
        payload.contact_person = updatedData.contact_person || null;
      }
      if (updatedData.website !== undefined) payload.website = updatedData.website || null;
      if (updatedData.instagram !== undefined) payload.instagram = updatedData.instagram || null;
      if (updatedData.city !== undefined) payload.city = updatedData.city || null;
      if (updatedData.bio !== undefined) payload.bio = updatedData.bio || null;
      if (updatedData.category !== undefined) payload.industry = updatedData.category || null;
      if (updatedData.logo_url !== undefined) payload.logo_url = updatedData.logo_url ?? null;
      if (Array.isArray(updatedData.clearFields) && updatedData.clearFields.length > 0) {
        payload.clearFields = updatedData.clearFields;
      }

      const response = await sessionFetch('/api/brand/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || txt.error_updating);
      }

      await loadData();
      setShowEditModal(false);
      
      notify(txt.profile_updated, 'success');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      notify(txt.error_updating + ': ' + (err?.message || ''), 'error');
    } finally {
      setUpdating(false);
    }
  };

  const agreementQueue = openBrandAgreements(proposals);
  const pendingAgreements = agreementQueue.needsBrand;
  const awaitingInfluencerAgreements = agreementQueue.awaitingInfluencer;
  const openAgreements = openAgreementCount(proposals);
  const brandSignedAgreements = proposals.filter(
    (proposal) =>
      (proposal.status === "accepted" || proposal.status === "completed") &&
      proposal.brand_agreement_accepted
  );

  const openProposalAgreement = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setAgreementAccepted(false);
    setShowAgreementModal(true);
  };

  // Get pending counter proposals (where influencer sent counter proposal and brand hasn't responded)
  const pendingCounterProposals = proposals.filter(
    p => p.counter_proposal_status === 'pending' && p.counter_proposal_budget
  );

  const openBrandTab = (tab: BrandTab) => {
    setMenuOpen(false);
    // Update URL immediately so ?tab= matches this click (not one behind).
    setActiveTab(tab);
    const url = tab === 'overview' ? '/brand/dashboard' : `/brand/dashboard?tab=${tab}`;
    if (typeof window !== 'undefined') {
      window.history.replaceState(
        { ...(window.history.state || {}), as: url, url },
        '',
        url
      );
    }
    router.replace(url, { scroll: false });
  };

  const handleAcceptCounterProposal = async (proposalId: string) => {
    setProcessingCounterProposal(proposalId);
    try {
      const response = await sessionFetch('/api/proposals/counter/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId })
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
        notify(lang === 'el' 
          ? 'Η αντιπρόταση αποδεχθηκε επιτυχώς!' 
          : 'Counter proposal accepted successfully!', 'success');
      } else {
        throw new Error(result.error || 'Error accepting counter proposal');
      }
    } catch (err: any) {
      console.error('Error accepting counter proposal:', err);
      notify(err.message || (lang === 'el' ? 'Σφάλμα αποδοχής αντιπρότασης' : 'Error accepting counter proposal'), 'error');
    } finally {
      setProcessingCounterProposal(null);
    }
  };

  const handleRejectCounterProposal = async (proposalId: string) => {
    setConfirmRejectId(null);
    setProcessingCounterProposal(proposalId);
    try {
      const response = await sessionFetch('/api/proposals/counter/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId })
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
        notify(lang === 'el' 
          ? 'Η αντιπρόταση απορρίφθηκε.' 
          : 'Counter proposal rejected.', 'success');
      } else {
        throw new Error(result.error || 'Error rejecting counter proposal');
      }
    } catch (err: any) {
      console.error('Error rejecting counter proposal:', err);
      notify(err.message || (lang === 'el' ? 'Σφάλμα απόρριψης αντιπρότασης' : 'Error rejecting counter proposal'), 'error');
    } finally {
      setProcessingCounterProposal(null);
    }
  };

  const overviewSteps = (
    [
      !brandData?.verified
        ? {
            id: "verify",
            text: lang === "el" ? "Ο λογαριασμός περιμένει έγκριση. Μπορείς να ετοιμάσεις πρόχειρες καμπάνιες." : "Your account is waiting for approval. You can prepare draft campaigns.",
            tab: "campaigns" as const,
            cta: lang === "el" ? "Καμπάνιες" : "Campaigns",
          }
        : null,
      !(brandData?.bio || "").trim()
        ? {
            id: "bio",
            text: lang === "el" ? "Συμπλήρωσε το bio της επιχείρησής σου ώστε οι creators να ξέρουν ποιοι είστε" : "Add your company bio so creators know who you are.",
            tab: "overview" as const,
            cta: lang === "el" ? "Bio" : "Bio",
            focusBio: true,
          }
        : null,
      activeCampaignCount === 0
        ? {
            id: "campaign",
            text: lang === "el" ? "Δημοσίευσε μια καμπάνια για να λάβεις αιτήσεις." : "Publish a campaign to start receiving applications.",
            tab: "campaigns" as const,
            cta: lang === "el" ? "Νέα καμπάνια" : "New campaign",
          }
        : null,
      proposals.filter((p) => p.status === "pending" || p.status === "accepted").length === 0
        ? {
            id: "proposal",
            text: lang === "el" ? "Στείλε την πρώτη προσφορά σε creator που ταιριάζει." : "Send your first proposal to a matching creator.",
            tab: "recommendations" as const,
            cta: lang === "el" ? "Προτάσεις" : "Matches",
          }
        : null,
      unreadMessageCount > 0
        ? {
            id: "messages",
            text: lang === "el" ? `Έχεις ${unreadMessageCount} αδιάβαστα μηνύματα.` : `You have ${unreadMessageCount} unread messages.`,
            tab: "messages" as const,
            cta: lang === "el" ? "Άνοιγμα" : "Open",
          }
        : null,
      openAgreements > 0
        ? {
            id: "agreements",
            text: lang === "el" ? "Υπάρχουν συμφωνίες που δεν έχουν κλείσει και από τις δύο πλευρές." : "Some agreements are not signed by both sides yet.",
            tab: "proposals" as const,
            cta: lang === "el" ? "Συμφωνίες" : "Agreements",
          }
        : null,
      shortlist.length === 0
        ? {
            id: "saved",
            text: lang === "el" ? "Αποθήκευσε creators για να τους συγκρίνεις αργότερα." : "Save creators so you can compare them later.",
            tab: "recommendations" as const,
            cta: lang === "el" ? "Αποθήκευση" : "Save",
          }
        : null,
    ] as Array<{ id: string; text: string; tab: BrandTab; cta: string; focusBio?: boolean } | null>
  )
    .filter((step): step is { id: string; text: string; tab: BrandTab; cta: string; focusBio?: boolean } => step !== null)
    .slice(0, 5);

  if (loading || leaving) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-4">
          <div className="h-10 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
            <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
            <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
            <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          </div>
          <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
          <p className="text-slate-600 text-sm">{txt.loading}</p>
        </div>
      </div>
    );
  }

  if (loadError || !brandData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white border border-slate-200 rounded-2xl p-8">
          <h1 className="text-xl font-semibold text-slate-900">
            {lang === "el" ? "Δεν φορτώθηκε το προφίλ" : "Profile could not be loaded"}
          </h1>
          <p className="text-slate-600 mt-3">{loadError || (lang === "el" ? "Δοκιμάστε ξανά." : "Try again.")}</p>
          <button
            type="button"
            onClick={() => {
              void loadData();
            }}
            className="mt-6 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
          >
            {RETRY_LABEL[lang]}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PushNotificationPrompt userType="brand" userIdentifier={brandData?.contact_email || ''} lang={lang} />
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 sm:gap-6 min-w-0">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
                <InfluoLogo className="h-6 sm:h-8 w-auto" title="Influo" />
              </Link>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{txt.title}</h1>
                {brandData?.brand_name ? (
                  <p className="truncate text-sm font-medium text-slate-500">{brandData.brand_name}</p>
                ) : null}
              </div>
            </div>
            <div className="hidden md:flex flex-wrap items-center gap-2 sm:gap-4">
              <Link
                href="/"
                className="text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200 inline-flex items-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5" aria-hidden="true" />
                {lang === "el" ? "Αρχική" : "Home"}
              </Link>
              <Link
                href="/help-desk"
                className="text-xs sm:text-sm font-medium text-purple-600 hover:text-purple-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-purple-50 transition-colors border border-purple-200 inline-flex items-center gap-1.5"
              >
                <LifeBuoy className="w-3.5 h-3.5" aria-hidden="true" />
                Help Desk
              </Link>
              <button
                type="button"
                onClick={() => { setEditFocusBio(false); setShowEditModal(true); }}
                className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-blue-50 transition-colors border border-blue-200"
              >
                {txt.edit_profile}
              </button>
              <button
                type="button"
                onClick={() => {
                  const newLang = lang === 'el' ? 'en' : 'el';
                  setLang(newLang);
                  setStoredLanguage(newLang);
                }}
                className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 px-2 sm:px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
              >
                {lang === 'el' ? 'EN' : 'ΕΛ'}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                {txt.logout}
              </button>
            </div>
            <button
              type="button"
              className="md:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700"
              aria-label={lang === 'el' ? 'Μενού' : 'Menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
            </button>
          </div>
          {menuOpen ? (
            <div className="md:hidden mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
              <Link href="/" className="min-h-11 inline-flex items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Home className="w-4 h-4" aria-hidden="true" />
                {lang === 'el' ? 'Αρχική' : 'Home'}
              </Link>
              <Link href="/help-desk" className="min-h-11 inline-flex items-center gap-2 rounded-lg px-3 text-sm font-medium text-purple-700 hover:bg-purple-50">
                <LifeBuoy className="w-4 h-4" aria-hidden="true" />
                Help Desk
              </Link>
              <button type="button" onClick={() => { setMenuOpen(false); setEditFocusBio(false); setShowEditModal(true); }} className="min-h-11 text-left rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-blue-50">
                {txt.edit_profile}
              </button>
              <button
                type="button"
                onClick={() => {
                  const newLang = lang === 'el' ? 'en' : 'el';
                  setLang(newLang);
                  setStoredLanguage(newLang);
                }}
                className="min-h-11 text-left rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                {lang === 'el' ? 'English' : 'Ελληνικά'}
              </button>
              <button type="button" onClick={handleLogout} className="min-h-11 inline-flex items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <LogOut className="w-4 h-4" aria-hidden="true" />
                {txt.logout}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            brandData?.verified ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          <p className="font-semibold">
            {brandData?.verified
              ? lang === "el"
                ? "Η επιχείρηση είναι επαληθευμένη"
                : "Your company is verified"
              : lang === "el"
                ? "Επαλήθευση σε αναμονή"
                : "Verification pending"}
          </p>
          <p className="mt-1 leading-relaxed">
            {brandData?.verified
              ? lang === "el"
                ? "Μπορείτε να δημοσιεύετε καμπάνιες δημόσια. Οι ανοιχτές εμφανίζονται σε εγκεκριμένους influencers."
                : "You can publish campaigns. Open ones are visible to approved influencers."
              : lang === "el"
                ? "Μπορείτε να ετοιμάσετε καμπάνιες ως Πρόχειρο. Η δημοσίευση (Ανοιχτή) ξεκλειδώνει μετά την έγκριση, συνήθως εντός 1–2 εργάσιμων ημερών. Μέχρι τότε η καμπάνια φαίνεται μόνο σε εσάς."
                : "You can prepare campaigns as drafts. Publishing (Open) unlocks after approval, usually within 1–2 business days. Until then only you can see them."}
          </p>
        </div>
        <BrandActionInbox
          lang={lang}
          pendingApplications={pendingCampaignApplicationsCount}
          pendingCounters={pendingCounterProposals.length}
          pendingAgreements={openAgreements}
          unreadMessages={unreadMessageCount}
          onOpenTab={openBrandTab}
          onOpenApplications={() => {
            setAppsFocus((n) => n + 1);
            openBrandTab("campaigns");
          }}
        />

        {/* One row. The wide content column fits every tab. Narrow screens scroll, with a fade on the right. */}
        <div className="@container relative bg-white rounded-xl border border-slate-200 mb-6 overflow-hidden">
          <div className="relative border-b border-slate-200">
            <nav
              ref={tabsNavRef}
              role="tablist"
              aria-label={lang === 'el' ? 'Ενότητες πίνακα' : 'Dashboard sections'}
              className="flex flex-nowrap gap-2 overflow-x-auto snap-x snap-mandatory px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden @min-[1180px]:gap-0 @min-[1180px]:overflow-visible @min-[1180px]:snap-none @min-[1180px]:px-1 @min-[1180px]:py-0"
            >
              {(
                [
                  { id: 'overview' as const, label: lang === 'el' ? 'Επισκόπηση' : 'Overview', icon: LayoutDashboard, count: 0 },
                  { id: 'recommendations' as const, label: lang === 'el' ? 'Προτάσεις' : 'Recommendations', icon: Sparkles, count: 0 },
                  { id: 'shortlist' as const, label: lang === 'el' ? 'Οι influencers μου' : 'My influencers', icon: Bookmark, count: shortlist.length },
                  { id: 'campaigns' as const, label: lang === 'el' ? 'Καμπάνιες' : 'Campaigns', icon: Megaphone, count: unseenApplicationCount },
                  { id: 'proposals' as const, label: lang === 'el' ? 'Προσφορές' : 'Proposals', icon: FileText, count: unseenProposalCount },
                  { id: 'statistics' as const, label: lang === 'el' ? 'Στατιστικά' : 'Statistics', icon: BarChart3, count: 0 },
                  { id: 'tools' as const, label: lang === 'el' ? 'Εργαλεία' : 'Tools', icon: Wrench, count: 0 },
                  { id: 'announcements' as const, label: lang === 'el' ? 'Ανακοινώσεις' : 'Announcements', icon: Bell, count: unreadAnnouncementsCount },
                  { id: 'messages' as const, label: lang === 'el' ? 'Μηνύματα' : 'Messages', icon: MessageSquare, count: unreadMessageCount },
                ]
              ).map((tab) => {
                const selected = activeTab === tab.id;
                const Icon = tab.icon;
                const badge = tab.count > 99 ? '99+' : tab.count > 9 && tab.id === 'announcements' ? '9+' : String(tab.count);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    data-brand-tab={tab.id}
                    aria-selected={selected}
                    onClick={() => openBrandTab(tab.id)}
                    className={`inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors @min-[1180px]:min-h-0 @min-[1180px]:min-w-max @min-[1180px]:flex-1 @min-[1180px]:justify-center @min-[1180px]:gap-1 @min-[1180px]:rounded-none @min-[1180px]:px-2 @min-[1180px]:py-3 @min-[1180px]:text-[13px] @min-[1180px]:border-b-2 ${
                      selected
                        ? 'bg-blue-600 text-white @min-[1180px]:bg-transparent @min-[1180px]:text-blue-600 @min-[1180px]:border-blue-600'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 @min-[1180px]:bg-transparent @min-[1180px]:text-slate-500 @min-[1180px]:hover:text-slate-700 @min-[1180px]:border-transparent'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 @min-[1180px]:h-3.5 @min-[1180px]:w-3.5" aria-hidden="true" />
                    {tab.label}
                    {tab.count > 0 ? (
                      <span className={`text-xs font-bold rounded-full min-w-[18px] h-[18px] inline-flex items-center justify-center px-1 ${selected ? 'bg-white text-blue-700 @min-[1180px]:bg-red-500 @min-[1180px]:text-white' : 'bg-red-500 text-white'}`}>
                        {badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent @min-[1180px]:hidden"
              aria-hidden="true"
            />
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="mb-12 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(
                [
                  { label: lang === 'el' ? 'Ενεργές προσφορές' : 'Active proposals', value: proposals.filter((p) => p.status === 'pending' || p.status === 'accepted').length, tab: 'proposals' as const },
                  { label: lang === 'el' ? 'Αδιάβαστα μηνύματα' : 'Unread messages', value: unreadMessageCount, tab: 'messages' as const },
                  { label: lang === 'el' ? 'Ενεργές καμπάνιες' : 'Active campaigns', value: activeCampaignCount, tab: 'campaigns' as const },
                  { label: lang === 'el' ? 'Αποθηκευμένοι creators' : 'Saved creators', value: shortlist.length, tab: 'shortlist' as const },
                ]
              ).map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => openBrandTab(card.tab)}
                  className="min-h-[88px] rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300 hover:shadow-sm transition-shadow"
                >
                  <p className="text-2xl font-semibold text-slate-900 tabular-nums">{card.value}</p>
                  <p className="mt-1 text-sm text-slate-600">{card.label}</p>
                </button>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-slate-900">
                  {lang === 'el' ? 'Επόμενα βήματα' : 'Next steps'}
                </h2>
                <ul className="mt-4 space-y-3">
                  {overviewSteps.length === 0 ? (
                    <li className="text-sm text-slate-600">
                      {lang === 'el' ? 'Είσαι ενήμερος. Δεν εκκρεμεί κάποιο βήμα.' : 'You are up to date. Nothing is waiting.'}
                    </li>
                  ) : (
                    overviewSteps.map((step) => (
                      <li key={step.id} className="flex items-start justify-between gap-3">
                        <p className="text-sm text-slate-700 leading-relaxed">{step.text}</p>
                        <button
                          type="button"
                          onClick={() => {
                            if (step.focusBio) {
                              setEditFocusBio(true);
                              setShowEditModal(true);
                              return;
                            }
                            openBrandTab(step.tab);
                          }}
                          className="shrink-0 min-h-11 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 rounded-lg"
                        >
                          {step.cta}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {lang === 'el' ? 'Ανακοινώσεις' : 'Announcements'}
                  </h2>
                  <button type="button" onClick={() => openBrandTab('announcements')} className="min-h-11 text-sm font-medium text-blue-700">
                    {lang === 'el' ? 'Όλες' : 'All'}
                  </button>
                </div>
                {announcementsLoading && announcementsList.length === 0 ? (
                  <div className="mt-4 h-24 rounded-lg bg-slate-100 animate-pulse" />
                ) : announcementsError ? (
                  <div className="mt-4 text-sm text-slate-600">
                    <p>{announcementsError}</p>
                    <button type="button" onClick={() => void loadAnnouncements(false)} className="mt-3 min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium">
                      {RETRY_LABEL[lang]}
                    </button>
                  </div>
                ) : announcementsList.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">
                    {lang === 'el' ? 'Δεν υπάρχουν ανακοινώσεις.' : 'No announcements yet.'}
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {announcementsList.slice(0, 3).map((item) => (
                      <li key={item.id} className="border-b border-slate-100 pb-3 last:border-0">
                        <button
                          type="button"
                          onClick={() => void openAnnouncementItem(item)}
                          className="w-full rounded-lg px-1 py-1 text-left hover:bg-slate-50"
                        >
                          <p className="text-sm font-medium text-slate-900">{announcementText(item.title, item.title_en, lang)}</p>
                          <p className="text-xs text-slate-500 mt-1">{formatDate(item.created_at, lang)} {formatTime(item.created_at, lang)}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}

        {activeTab === 'shortlist' && (
          <div className="mb-12">
            <BrandShortlistPanel
              lang={lang}
              items={shortlist}
              loading={shortlistLoading}
              error={shortlistError}
              onRetry={() => void loadShortlist()}
              missingTable={shortlistMissingTable}
              onBrowse={() => openBrandTab('recommendations')}
              onNoteSave={async (influencerId, note) => {
                await updateBrandShortlistNote(influencerId, note);
                setShortlist((rows) =>
                  rows.map((s) => (s.influencerId === influencerId ? { ...s, note } : s))
                );
              }}
              onRemove={async (influencerId) => {
                await removeBrandShortlist(influencerId);
                setShortlist((rows) => rows.filter((s) => s.influencerId !== influencerId));
              }}
              onMessage={(influencerId, displayName) => {
                setThreadConversationId(null);
                setMessageTargetInfluencer({ id: influencerId, name: displayName });
                openBrandTab('messages');
              }}
            />
          </div>
        )}

        {activeTab === 'statistics' && (
          <div className="mb-12">
            <BrandStatisticsPanel lang={lang} onBrowse={() => openBrandTab('recommendations')} />
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="mb-12">
            <BrandToolsPanel
              lang={lang}
              brandId={brandData?.id ? String(brandData.id) : ""}
              brandName={brandData?.brand_name || ""}
              industry={brandData?.industry || null}
              website={brandData?.website || null}
              logoUrl={brandData?.logo_url || null}
              contactPerson={brandData?.contact_person || null}
              shortlist={shortlist}
              onOpenCampaigns={() => openBrandTab("campaigns")}
              onOpenShortlist={() => openBrandTab("shortlist")}
            />
          </div>
        )}

        {activeTab === 'announcements' && (
          <div className="mb-12 space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">
              {lang === 'el' ? 'Ανακοινώσεις' : 'Announcements'}
            </h2>
            {announcementsLoading ? (
              <div className="text-center py-8 text-slate-500">
                {lang === 'el' ? 'Φόρτωση...' : 'Loading...'}
              </div>
            ) : announcementsError ? (
              <div className="text-center py-12">
                <p className="text-slate-600">{announcementsError}</p>
                <button type="button" onClick={() => void loadAnnouncements(true)} className="mt-4 min-h-11 px-5 rounded-xl bg-slate-900 text-white text-sm font-medium">
                  {RETRY_LABEL[lang]}
                </button>
              </div>
            ) : announcementsList.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                {lang === 'el' ? 'Δεν υπάρχουν ανακοινώσεις.' : 'No announcements yet.'}
              </div>
            ) : (
              <ul className="space-y-3">
                {announcementsList.map((a) => (
                  <li
                    key={a.id}
                    className={`border rounded-lg p-4 transition-colors ${
                      a.read
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-white border-blue-200 ring-1 ring-blue-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                          {announcementText(a.title, a.title_en, lang)}
                          {!a.read && (
                            <span
                              className="shrink-0 inline-flex items-center justify-center w-2.5 h-2.5 rounded-full bg-red-500"
                              title={lang === 'el' ? 'Μη διαβασμένο' : 'Unread'}
                            />
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{announcementText(a.body, a.body_en, lang)}</p>
                        <p className="text-xs text-slate-500 mt-2">
                          {formatDate(a.created_at, lang)} {formatTime(a.created_at, lang)}
                          {a.read && a.read_at && (
                            <span className="ml-2">
                              ·{' '}
                              {lang === 'el' ? 'Διαβάστηκε' : 'Read'}{' '}
                              {formatDate(a.read_at, lang)} {formatTime(a.read_at, lang)}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col sm:flex-row gap-2">
                        {!a.read && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await sessionFetch(`/api/brand/announcements/${a.id}/read`, {
                                  method: 'POST',
                                });
                                if (res.ok) {
                                  setAnnouncementsList((prev) =>
                                    prev.map((x) =>
                                      x.id === a.id
                                        ? { ...x, read: true, read_at: new Date().toISOString() }
                                        : x
                                    )
                                  );
                                  setUnreadAnnouncementsCount((prev) => Math.max(0, prev - 1));
                                }
                              } catch (e) {
                                console.error('Error marking announcement as read:', e);
                              }
                            }}
                            className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            {lang === 'el' ? 'Σήμανση ως διαβασμένο' : 'Mark as read'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await sessionFetch(`/api/brand/announcements/${a.id}/dismiss`, {
                                method: 'POST',
                              });
                              if (res.ok) {
                                setAnnouncementsList((prev) => prev.filter((x) => x.id !== a.id));
                                if (!a.read) {
                                  setUnreadAnnouncementsCount((prev) => Math.max(0, prev - 1));
                                }
                              }
                            } catch (e) {
                              console.error('Error dismissing announcement:', e);
                            }
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          title={lang === 'el' ? 'Απόκρυψη από τη λίστα' : 'Hide from list'}
                        >
                          {lang === 'el' ? 'Διαγραφή' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'campaigns' && brandData && (
          <div className="mb-12">
            <BrandCampaignsSection
              brandId={brandData.id}
              lang={lang}
              brandVerified={!!brandData.verified}
              pendingApplicationsCount={pendingCampaignApplicationsCount}
              focusApplications={appsFocus}
              startNew={searchParams?.get("new") === "1"}
              onApplicationsUpdated={() => {
                void reloadProposals();
                if (!brandData?.id) return;
                void (async () => {
                  const ids = await fetchPendingApplicationIds(String(brandData.id));
                  if (!ids) return;
                  setPendingApplicationIds(ids);
                  setPendingCampaignApplicationsCount(ids.length);
                  setApplicationsLoaded(true);
                })();
              }}
              onOpenInfluencerMessage={(p) => {
                setMessageTargetInfluencer({
                  id: p.influencerId,
                  name: p.displayName,
                });
                setThreadConversationId(p.conversationId || null);
                openBrandTab("messages");
                if (p.conversationId && typeof window !== "undefined") {
                  const url = `/brand/dashboard?tab=messages&conversation=${encodeURIComponent(p.conversationId)}`;
                  window.history.replaceState(
                    { ...(window.history.state || {}), as: url, url },
                    "",
                    url
                  );
                  router.replace(url, { scroll: false });
                }
              }}
            />
          </div>
        )}

        {/* Recommendations Section */}
        {activeTab === 'recommendations' && (
        <div id="recommended" className="mb-12 scroll-mt-24">
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">{txt.recommendations_title}</h2>
              <p className="text-slate-500 text-sm mt-1">{txt.recommendations_subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-expanded={recommendationFiltersOpen}
                onClick={() => setRecommendationFiltersOpen((open) => !open)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                {txt.filters}
                {activeRecommendationFilters > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 text-xs font-semibold text-white">
                    {activeRecommendationFilters}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => brandData && loadRecommendations(brandData)}
                disabled={recommendationsLoading}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                <span className={recommendationsLoading ? 'animate-spin' : ''} aria-hidden>↻</span>
                {txt.refresh}
              </button>
            </div>
          </div>

          {recommendationFiltersOpen ? (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="rec-category">{txt.category_filter}</label>
                <select
                  id="rec-category"
                  value={recommendationFilters.category}
                  onChange={(e) => setRecommendationFilters({ ...recommendationFilters, category: e.target.value })}
                  className={recommendationFieldClass}
                >
                  <option value="">{txt.category_all}</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{categoryLabel(cat, lang)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="rec-platform">{txt.platform_filter}</label>
                <select
                  id="rec-platform"
                  value={recommendationFilters.platform}
                  onChange={(e) => setRecommendationFilters({ ...recommendationFilters, platform: e.target.value })}
                  className={recommendationFieldClass}
                >
                  <option value="">{txt.platform_all}</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="rec-location">{txt.location_filter}</label>
                <LocationTypeahead
                  id="rec-location"
                  lang={lang}
                  value={recommendationFilters.location}
                  onChange={(location) => setRecommendationFilters({ ...recommendationFilters, location })}
                  placeholder={txt.location_placeholder}
                  ariaLabel={txt.location_filter}
                  className={recommendationFieldClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="rec-price">{txt.max_price}</label>
                <div className="relative">
                  <input
                    id="rec-price"
                    inputMode="numeric"
                    value={recommendationFilters.maxPrice ?? ""}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, "");
                      setRecommendationFilters({
                        ...recommendationFilters,
                        maxPrice: digits ? Number(digits) : null,
                      });
                    }}
                    placeholder={txt.max_price_placeholder}
                    className={`${recommendationFieldClass} pr-10 placeholder:text-slate-400`}
                  />
                  {recommendationFilters.maxPrice != null ? (
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">€</span>
                  ) : null}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">{txt.skills_filter}</label>
                <SkillMultiSelect
                  lang={lang}
                  selected={recommendationFilters.skills}
                  onChange={(skills) => setRecommendationFilters({ ...recommendationFilters, skills })}
                  placeholder={txt.skills_all}
                  ariaLabel={txt.skills_filter}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="rec-audience">{txt.audience_filter}</label>
                <select
                  id="rec-audience"
                  value={recommendationFilters.audience}
                  onChange={(e) => setRecommendationFilters({
                    ...recommendationFilters,
                    audience: e.target.value as typeof recommendationFilters.audience,
                  })}
                  className={recommendationFieldClass}
                >
                  <option value="">{txt.audience_all}</option>
                  <option value="nano">{txt.audience_nano}</option>
                  <option value="micro">{txt.audience_micro}</option>
                  <option value="macro">{txt.audience_macro}</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-stretch sm:justify-end">
              <button
                type="button"
                onClick={() => setRecommendationFilters(EMPTY_RECOMMENDATION_FILTERS)}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto"
              >
                {txt.clear_filters}
              </button>
            </div>
          </div>
          ) : null}

          {/* Stats – compact */}
          {recommendationStats.totalViewed > 0 && (
            <div className="flex flex-wrap gap-6 mb-6 text-sm text-slate-600">
              <span><strong className="text-slate-900">{recommendationStats.totalViewed}</strong> {txt.total_viewed}</span>
              <span><strong className="text-slate-900">{recommendationStats.profilesClicked}</strong> {txt.profiles_clicked}</span>
              <span><strong className="text-slate-900">{recommendationStats.proposalsSent}</strong> {txt.proposals_sent}</span>
            </div>
          )}
          
          {recommendationsError && !recommendationsLoading ? (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
              <p className="text-slate-600">{recommendationsError}</p>
              <button
                type="button"
                onClick={() => brandData && void loadRecommendations(brandData)}
                className="mt-4 min-h-11 px-5 rounded-xl bg-slate-900 text-white text-sm font-medium"
              >
                {RETRY_LABEL[lang]}
              </button>
            </div>
          ) : recommendationsLoading || !recommendationsReady ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse">
                  <div className="aspect-[4/5] bg-slate-200" />
                  <div className="p-4 space-y-3">
                    <div className="h-3 bg-slate-200 rounded w-2/3" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                    <div className="h-3 bg-slate-100 rounded w-5/6" />
                  </div>
                </div>
              ))}
              <p className="sr-only">{txt.recommendations_loading}</p>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
              <p className="text-slate-600">{txt.recommendations_empty}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {recommendations.map((match) => {
                const inf = match.influencer;
                const creatorCats = Array.isArray(inf.categories) && inf.categories.length ? inf.categories : inf.category;
                const shared = new Set(sharedCategoryKeys(brandData?.industry, creatorCats));
                const cats = (Array.isArray(inf.categories) ? inf.categories : inf.category ? [inf.category] : [])
                  .filter((cat: unknown): cat is string => typeof cat === "string" && cat.length > 0);
                const orderedCats = [...cats.filter((cat: string) => shared.has(cat)), ...cats.filter((cat: string) => !shared.has(cat))].slice(0, 3);
                const reasons = (Array.isArray(match.reasons) ? match.reasons : []).slice(0, 3);
                const fromPrice = typeof inf.from_price === "number" && inf.from_price > 0 ? inf.from_price : null;
                const priceLabel = fromPrice != null ? formatFromPriceLabel(fromPrice, lang) : null;
                const shownName = displayNameForLang(inf.display_name, lang);
                return (
                  <div
                    key={inf.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="relative aspect-[4/5] bg-slate-100">
                      <CreatorPhoto
                        src={inf.avatar_url}
                        name={shownName}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <span className={`absolute left-3 top-3 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${
                        match.score >= 80 ? "bg-emerald-600 text-white" :
                        match.score >= 65 ? "bg-blue-600 text-white" :
                        "bg-white/95 text-slate-900"
                      }`}>
                        {match.score}% {txt.match_label}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="text-lg font-bold leading-tight text-slate-900">{shownName}</h3>
                      {orderedCats.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {orderedCats.map((cat: string) => (
                            <span
                              key={cat}
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                shared.has(cat) ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {categoryLabel(cat, lang)}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <PlatformFollowers accounts={inf.accounts} lang={lang} className="mt-3" />

                      {priceLabel ? (
                        <div className="mt-3 text-xl font-bold tabular-nums text-slate-900">{priceLabel}</div>
                      ) : null}

                      {reasons.length ? (
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{txt.why_match}</p>
                          <ul className="mt-1.5 space-y-1">
                            {reasons.map((reason: string) => (
                              <li key={reason} className="flex items-start gap-2 text-sm leading-snug text-slate-700">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden />
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      
                      <div className="mt-auto flex gap-2 pt-4">
                        <Link
                          href={`${publicProfilePath(inf.profile_slug, inf.id)}?from=brand-recs`}
                          onClick={async () => {
                            // Set session flag to indicate user is brand
                            if (typeof window !== 'undefined') {
                              sessionStorage.setItem('isBrand', 'true');
                            }
                            setRecommendationStats((prev: RecommendationStats) => {
                              const updated = {...prev, profilesClicked: prev.profilesClicked + 1};
                              // Save to localStorage immediately
                              if (typeof window !== 'undefined') {
                                localStorage.setItem('brandDashboardStats', JSON.stringify(updated));
                              }
                              return updated;
                            });
                            
                            // Track profile_click analytics
                            try {
                              const { data: { user } } = await supabase.auth.getUser();
                              const brandEmail = user?.email || null;
                              let brandName = null;
                              if (brandEmail && user) {
                                const { data: brandData } = await supabase
                                  .from('brands')
                                  .select('brand_name')
                                  .eq('id', user.id)
                                  .maybeSingle();
                                brandName = brandData?.brand_name || null;
                              }
                              
                              fetch('/api/analytics/track', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  influencerId: inf.id,
                                  eventType: 'profile_click',
                                  brandEmail: brandEmail,
                                  brandName: brandName,
                                  metadata: { source: 'brand_dashboard' }
                                }),
                                keepalive: true
                              }).catch(() => {});
                            } catch (err) {
                              // Fail silently
                            }
                          }}
                          className="flex-1 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-center transition-colors"
                        >
                          {txt.view_profile}
                        </Link>
                        {brandData?.verified ? (
                        <Link
                          href={`${publicProfilePath(inf.profile_slug, inf.id)}?from=brand-recs#proposal`}
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              sessionStorage.setItem('isBrand', 'true');
                            }
                          }}
                          className="flex-1 min-h-11 md:min-h-0 px-3 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg text-center transition-colors inline-flex items-center justify-center"
                        >
                          {txt.send_proposal}
                        </Link>
                        ) : (
                        <span
                          className="flex-1 relative group"
                          title={lang === 'el' ? 'Διαθέσιμο μετά την έγκριση του λογαριασμού' : 'Available once your account is approved'}
                        >
                          <button
                            type="button"
                            disabled
                            className="w-full min-h-11 md:min-h-0 px-3 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg opacity-50 cursor-not-allowed"
                          >
                            {txt.send_proposal}
                          </button>
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-2 w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                          >
                            {lang === 'el' ? 'Διαθέσιμο μετά την έγκριση του λογαριασμού' : 'Available once your account is approved'}
                          </span>
                        </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <InfluencerPresenceDot influencerId={String(inf.id)} lang={lang} />
                        <button
                          type="button"
                          onClick={() => {
                            setThreadConversationId(null);
                            setMessageTargetInfluencer({
                              id: String(inf.id),
                              name: inf.display_name,
                            });
                            openBrandTab("messages");
                          }}
                          className="flex-1 min-h-11 md:min-h-0 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                        >
                          {lang === "el" ? "Μήνυμα" : "Message"}
                        </button>
                        <BrandSaveInfluencerButton
                          lang={lang}
                          saved={shortlist.some((s) => s.influencerId === String(inf.id))}
                          busy={shortlistBusyId === String(inf.id)}
                          onToggle={() => toggleShortlist(String(inf.id))}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        )}

        {/* Messages Section */}
        {activeTab === 'messages' && brandData && (
          <div className="mb-12">
            <Messaging
              key={messageTargetInfluencer?.id ?? "inbox"}
              influencerId={messageTargetInfluencer?.id}
              influencerName={messageTargetInfluencer?.name}
              brandEmail={brandData.contact_email}
              brandName={brandData.brand_name}
              proposalId={undefined}
              initialConversationId={threadConversationId || searchParams?.get('conversation')}
              mode="brand"
              lang={lang}
              onUnreadCountChange={setUnreadMessageCount}
              onLeaveThread={() => {
                setMessageTargetInfluencer(null);
                setThreadConversationId(null);
              }}
              emptyCta={{
                label: lang === 'el' ? 'Δες προτάσεις creators' : 'Browse creator matches',
                onClick: () => openBrandTab('recommendations'),
              }}
            />
          </div>
        )}

        {/* Proposals Section */}
        {activeTab === 'proposals' && (
        <div className="mb-6 space-y-8">
          {!proposalsLoaded ? (
            <div className="h-28 rounded-xl bg-slate-100 animate-pulse" aria-hidden />
          ) : proposals.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-dashed border-slate-200">
              <p className="text-slate-600">
                {lang === 'el' ? 'Δεν έχεις στείλει προσφορά ακόμα.' : 'You have not sent a proposal yet.'}
              </p>
              <button
                type="button"
                onClick={() => openBrandTab('recommendations')}
                className="mt-4 inline-flex min-h-11 items-center justify-center px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold"
              >
                {lang === 'el' ? 'Στείλε προσφορά' : 'Send a proposal'}
              </button>
            </div>
          ) : (
          <>
          {/* Pending Counter Proposals */}
          {pendingCounterProposals.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                {lang === 'el' ? '💰 Αντιπροτάσεις που Αναμένουν Απόκριση' : '💰 Counter Proposals Pending Response'}
              </h2>
              <div className="space-y-4">
                {pendingCounterProposals.map((proposal) => {
                  const influencer = influencers[proposal.influencer_id];
                  const isProcessing = processingCounterProposal === proposal.id;
                  return (
                    <div
                      key={proposal.id}
                      className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-6 border-2 border-amber-200 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">ΝΕΑ</span>
                            <h3 className="text-lg font-bold text-slate-900">
                              {displayNameForLang(influencer?.display_name, lang) || 'Unknown Influencer'}
                            </h3>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                            <div>
                              <span className="text-slate-500">{txt.service}:</span>{' '}
                              <span className="font-medium text-slate-900">{displayServiceType(proposal.service_type, lang)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">{lang === 'el' ? 'Προσφερόμενη Τιμή:' : 'Original Price:'}</span>{' '}
                              <span className="font-medium text-slate-600 line-through">{formatEuroAmount(proposal.budget, lang)}</span>
                            </div>
                          </div>
                          {formatProposalExtrasLine(proposal.selected_extras, lang) ? (
                            <p className="text-sm text-slate-700 mb-3">{formatProposalExtrasLine(proposal.selected_extras, lang)}</p>
                          ) : null}
                          <div className="bg-white rounded-lg p-4 mb-3 border border-amber-300">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600 text-sm font-medium">{lang === 'el' ? 'Αντιπρόταση:' : 'Counter Proposal:'}</span>
                              <span className="text-amber-700 text-xl font-bold">{formatEuroAmount(proposal.counter_proposal_budget, lang)}</span>
                            </div>
                            {proposal.counter_proposal_message && (
                              <div className="mt-3 pt-3 border-t border-amber-200">
                                <p className="text-xs text-slate-500 mb-1">{lang === 'el' ? 'Σχόλιο:' : 'Comment:'}</p>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{proposal.counter_proposal_message}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleAcceptCounterProposal(proposal.id)}
                          disabled={isProcessing}
                          className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          {isProcessing ? (lang === 'el' ? 'Επεξεργασία...' : 'Processing...') : (lang === 'el' ? '✅ Αποδοχή Αντιπρότασης' : '✅ Accept Counter Proposal')}
                        </button>
                        <button
                          onClick={() => setConfirmRejectId(proposal.id)}
                          disabled={isProcessing}
                          className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          {lang === 'el' ? '❌ Απόρριψη' : '❌ Reject'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending Agreements */}
          {pendingAgreements.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4">{txt.pending_agreements}</h2>
              <div className="space-y-4">
                {pendingAgreements.map((proposal) => {
                  const influencer = influencers[proposal.influencer_id];
                  return (
                    <div
                      key={proposal.id}
                      className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-shadow"
                    >
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 mb-2">
                            {displayNameForLang(influencer?.display_name, lang) || 'Unknown Influencer'}
                          </h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-slate-500">{txt.service}:</span>{' '}
                              <span className="font-medium text-slate-900">{displayServiceType(proposal.service_type, lang)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">{txt.budget}:</span>{' '}
                              <span className="font-medium text-slate-900">
                                {formatEuroAmount(proposal.counter_proposal_budget || proposal.budget, lang)}
                              </span>
                            </div>
                          </div>
                          {formatProposalExtrasLine(proposal.selected_extras, lang) ? (
                            <p className="mt-2 text-sm text-slate-700">{formatProposalExtrasLine(proposal.selected_extras, lang)}</p>
                          ) : null}
                          {proposal.description && (
                            <div className="mt-2 text-sm text-slate-600">
                              <span className="text-slate-500">{txt.description}:</span>{' '}
                              {proposal.description}
                            </div>
                          )}
                        </div>
                        <AgreementOpenButton lang={lang} onClick={() => openProposalAgreement(proposal)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {awaitingInfluencerAgreements.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4">{txt.awaiting_agreements}</h2>
              <div className="space-y-4">
                {awaitingInfluencerAgreements.map((proposal) => {
                  const influencer = influencers[proposal.influencer_id];
                  return (
                    <div
                      key={proposal.id}
                      className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">
                          {displayNameForLang(influencer?.display_name, lang) || 'Unknown Influencer'}
                        </h3>
                        <AgreementOpenButton lang={lang} onClick={() => openProposalAgreement(proposal)} />
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">{txt.service}:</span>{' '}
                          <span className="font-medium text-slate-900">{displayServiceType(proposal.service_type, lang)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">{txt.budget}:</span>{' '}
                          <span className="font-medium text-slate-900">
                            {formatEuroAmount(proposal.counter_proposal_budget || proposal.budget, lang)}
                          </span>
                        </div>
                      </div>
                      {formatProposalExtrasLine(proposal.selected_extras, lang) ? (
                        <p className="mt-2 text-sm text-slate-700">{formatProposalExtrasLine(proposal.selected_extras, lang)}</p>
                      ) : null}
                      <p className="mt-3 text-sm text-slate-600">{txt.awaiting_note}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {brandSignedAgreements.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                {lang === "el" ? "Συμφωνίες που αποδεχτήκατε" : "Agreements you have accepted"}
              </h2>
              <div className="space-y-4">
                {brandSignedAgreements.map((proposal) => {
                  const influencer = influencers[proposal.influencer_id];
                  const completed = proposal.status === "completed" || !!proposal.influencer_agreement_accepted;
                  return (
                    <div
                      key={proposal.id}
                      className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 mb-2">
                            {displayNameForLang(influencer?.display_name, lang) || "Unknown Influencer"}
                          </h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-slate-500">{txt.service}:</span>{" "}
                              <span className="font-medium text-slate-900">{displayServiceType(proposal.service_type, lang)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">{txt.budget}:</span>{" "}
                              <span className="font-medium text-slate-900">
                                {formatEuroAmount(proposal.counter_proposal_budget || proposal.budget, lang)}
                              </span>
                            </div>
                          </div>
                          {formatProposalExtrasLine(proposal.selected_extras, lang) ? (
                            <p className="mt-2 text-sm text-slate-700">{formatProposalExtrasLine(proposal.selected_extras, lang)}</p>
                          ) : null}
                          <p className={`mt-3 text-sm font-medium ${completed ? "text-green-700" : "text-amber-800"}`}>
                            {completed
                              ? lang === "el"
                                ? "Ολοκληρώθηκε"
                                : "Completed"
                              : lang === "el"
                                ? "Αναμονή του δημιουργού"
                                : "Waiting for the creator"}
                          </p>
                        </div>
                        <AgreementOpenButton lang={lang} onClick={() => openProposalAgreement(proposal)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No Pending Items */}
          {openAgreements === 0 && pendingCounterProposals.length === 0 && brandSignedAgreements.length === 0 && (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
              <p className="text-slate-600">{txt.no_pending}</p>
            </div>
          )}
          </>
          )}
        </div>
        )}

        <AnnouncementReadModal
          item={openAnnouncement}
          lang={lang}
          onClose={() => setOpenAnnouncement(null)}
        />

        {/* Edit Profile Modal */}
        {showEditModal && brandData && (
          <EditBrandModal
            brand={brandData}
            onClose={() => { setShowEditModal(false); setEditFocusBio(false); }}
            focusBio={editFocusBio}
            onSave={handleUpdateProfile}
            updating={updating}
            lang={lang}
            txt={txt}
            onToast={notify}
          />
        )}

      {/* Agreement Modal */}
      {showAgreementModal && selectedProposal && (
        <AgreementTerms
          lang={lang}
          proposalId={selectedProposal.id}
          brandName={selectedProposal.brand_name}
          creatorName={displayNameForLang(influencers[selectedProposal.influencer_id]?.display_name, lang)}
          serviceType={selectedProposal.service_type}
          budget={selectedProposal.budget}
          counterProposalBudget={selectedProposal.counter_proposal_budget}
          counterProposalStatus={selectedProposal.counter_proposal_status}
          selectedExtras={selectedProposal.selected_extras}
          publishDeadline={selectedProposal.publish_deadline}
          accepted={agreementAccepted}
          onAcceptedChange={setAgreementAccepted}
          saving={savingAgreement}
          readOnly={!!selectedProposal.brand_agreement_accepted}
          status={
            selectedProposal.status === "completed" || selectedProposal.influencer_agreement_accepted
              ? "completed"
              : "waiting"
          }
          onCancel={() => {
            setShowAgreementModal(false);
            setSelectedProposal(null);
            setAgreementAccepted(false);
          }}
          onAccept={handleAcceptAgreement}
        />
      )}

      <ToastViewport
        toasts={toasts}
        onDismiss={dismissToast}
        dismissLabel={lang === 'el' ? 'Κλείσιμο' : 'Close'}
      />
      <ConfirmDialog
        open={!!confirmRejectId}
        title={lang === 'el' ? 'Απόρριψη αντιπρότασης' : 'Reject counter proposal'}
        body={lang === 'el'
          ? 'Είστε σίγουρος ότι θέλετε να απορρίψετε την αντιπρόταση;'
          : 'Are you sure you want to reject the counter proposal?'}
        confirmLabel={lang === 'el' ? 'Απόρριψη' : 'Reject'}
        cancelLabel={lang === 'el' ? 'Ακύρωση' : 'Cancel'}
        onCancel={() => setConfirmRejectId(null)}
        onConfirm={() => {
          if (confirmRejectId) void handleRejectCounterProposal(confirmRejectId);
        }}
      />
      </div>
    </div>
  );
}

