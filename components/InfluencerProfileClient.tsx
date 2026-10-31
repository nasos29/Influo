"use client";

import { useEffect, useState, use, Suspense, useRef, useCallback, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { heroGradientForCategory } from "@/lib/heroTheme";
import SimilarInfluencers from "@/components/SimilarInfluencers";

const TopPosts = dynamic(() => import("@/components/TopPosts"), {
  ssr: false,
  loading: () => null,
});
import { Influencer } from "@/components/Directory"; 
import { supabase } from "@/lib/supabaseClient";
import { sessionFetch } from "@/lib/sessionFetch";
import { presenceOnline } from "@/lib/presenceStatus";
import { counterpartyInfluencerPresence } from "@/lib/presenceIdentity";
import { getVideoThumbnail, isDefinitelyVideo, isDefinitelyImage, detectProvider, getVideoEmbedApiUrl, isEmbeddableVideoUrl } from "@/lib/videoThumbnail";
import { isFacebookVideoUrl } from "@/lib/videoLinks";
import { youtubeChannelUrl } from "@/lib/youtubeHandle";
import VideoThumbnail from "@/components/VideoThumbnail";
import SocialEmbedCard from "@/components/SocialEmbedCard";
import { getBadges, getBadgeStyles } from "@/lib/badges";
import Avatar from "@/components/Avatar";
import SiteHeader from "@/components/SiteHeader";
import { getStoredLanguage } from "@/lib/language";
import { displayNameForLang } from "@/lib/greeklish";
import { getVisitorId } from "@/lib/visitorId";
import { trackOutboundSocialClick } from "@/lib/trackOutboundSocial";
import { categoryTranslations } from "@/components/categoryTranslations";
import { parseStoredCategories } from "@/lib/categories";
import { displayLocation } from "@/lib/displayLocation";
import { localizeCategoryText } from "@/lib/localizeCategoryText";
import { genderLabel, normalizeGender } from "@/lib/gender";
import BrandSaveInfluencerButton from "@/components/BrandSaveInfluencerButton";
import { addBrandShortlist, fetchBrandShortlist, removeBrandShortlist } from "@/lib/brandShortlist";
import ChannelScorePanel from "@/components/ChannelScorePanel";
import FollowerGrowthChart from "@/components/FollowerGrowthChart";
import InfoTooltip from "@/components/InfoTooltip";
import StatsInsightsPanel from "@/components/StatsInsightsPanel";
import { isValidAgeRange } from "@/lib/audience";
import { buildChannelScore } from "@/lib/channelScore";
import { averageAvgViews, estimateCpm, formatCpmEuro } from "@/lib/cpm";
import { resolveCompletionRate } from "@/lib/completionRate";
import { loadOwnBrand, loadOwnProfiles } from "@/lib/ownProfile";
import { creatorHasHardErOnMainAccount, displayErFlag, erFlagHint, erFlagLabel } from "@/lib/engagementFlags";
import type { FollowerGrowthPoint } from "@/lib/followerGrowth";
import { displayLanguageLabel } from "@/lib/languages";
import { formatEuro, formatEuroAmount } from "@/lib/formatEuro";
import { lowestListedPrice } from "@/lib/publicInfluencer";
import ProfileOffersPanel from "@/components/ProfileOffersPanel";
import ProfileHireCard from "@/components/ProfileHireCard";
import CampaignInviteButton from "@/components/CampaignInviteButton";
import ProfileShareButton from "@/components/ProfileShareButton";
import { showCampaignInviteButton } from "@/lib/gateAvatars";
import BrandGateModal from "@/components/BrandGateModal";
import {
  EXTRA_LABEL,
  packageTitle,
  rateCardFromPackages,
  type PublicExtraView,
  type PublicPackageView,
} from "@/lib/servicePackages";
import { badgeMinRateFromTier } from "@/lib/publicInfluencer";
import { publicProfilePath } from "@/lib/profileSlug";
import type { ProfileViewModel } from "@/lib/profileViewModel";

type Params = Promise<{ id: string }>;

type ProfileAccount = {
  platform?: string;
  username?: string;
  followers?: string | number;
  engagement_rate?: string;
  engagement_rate_raw?: string | number | null;
  avg_likes?: string | number;
  avg_views?: string | number | null;
  posts_count?: number | string;
  er_suspicious?: boolean;
  er_flag_reason?: string;
  engagement_hidden?: boolean;
  suspected_fake_penalty?: boolean;
  fake_follower_percent?: number | string | null;
  suspected_fake_percent?: number | string | null;
  fake_followers_percent?: number | string | null;
  quality_penalty_percent?: number | string | null;
  er_penalty_percent?: number | string | null;
  penalty_percent?: number | string | null;
  top_posts?: unknown;
};

interface ProInfluencer extends Influencer {
  video_thumbnails?: Record<string, string> | null;
  has_min_rate?: boolean;
  has_priced_min_rate?: boolean;
  from_price?: number | null;
  price_tier?: string | null;
  rate_card_flags?: { story?: boolean; post?: boolean; reel?: boolean; facebook?: boolean; youtube?: boolean; ugc_video?: boolean; ugc_photo?: boolean; carousel?: boolean };
  min_rate?: string;
  engagement_rate?: string | { [key: string]: string }; // Can be per-platform object or legacy string
  avg_likes?: string | { [key: string]: string }; // Can be per-platform object or legacy string
  accounts?: ProfileAccount[];
  audience_data?: { male: number | null; female: number | null; top_age: string };
  rate_card?: Record<string, string>;
  service_extras?: PublicExtraView[];
  past_brands?: string[];
  avg_rating?: number;
  total_reviews?: number;
  avg_response_time?: number;
  completion_rate?: number;
  availability_status?: string;
  skills?: string[];
  certifications?: string[];
  service_packages?: PublicPackageView[];
  calculatedCompletionRate?: number;
  created_at?: string;
  /** Gemini audit (updated only when followers/engagement/avg_likes are refreshed). */
  auditpr_audit?: {
    scoreBreakdown: string[];
    scoreBreakdown_en?: string[];
    whyWorkWithThem?: string;
    whyWorkWithThem_en?: string;
    positives?: string[];
    positives_en?: string[];
    negatives?: string[];
    negatives_en?: string[];
    brandSafe: boolean;
    niche?: string;
    niche_en?: string;
  };
}

// --- SOCIAL MEDIA ICONS ---
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
);
const TiktokIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"></path></svg>
);
const YoutubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
);
const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c1 1 2.45 1.53 4 1.53a10.66 10.66 0 0 0 10-5.83v-.57a4.48 4.48 0 0 0 2-1.39z"></path></svg>
);

const MetricIcon = ({
  children,
  className = "text-slate-600",
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100/90 ring-1 ring-slate-200/70 ${className}`}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      {children}
    </svg>
  </span>
);

function formatStatsUpdatedAt(iso: string, lang: "el" | "en"): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "el" ? "el-GR" : "en-GB", {
    timeZone: "Europe/Athens",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function ProfileStatCard({
  label,
  tip,
  tipAria,
  icon,
  children,
  accent = false,
  className = "",
  valueCentered = false,
}: {
  label: string;
  tip?: string;
  tipAria?: string;
  icon: ReactNode;
  children: ReactNode;
  accent?: boolean;
  className?: string;
  /** Center single metrics so sparse cards don't look empty */
  valueCentered?: boolean;
}) {
  const shell = [
    "group relative flex h-full min-h-[116px] min-w-0 flex-col overflow-hidden rounded-2xl border p-3 sm:p-4 transition-all duration-200",
    accent
      ? "border-blue-200/80 bg-gradient-to-br from-blue-50/90 via-white to-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-blue-300 hover:shadow-[0_8px_24px_rgba(37,99,235,0.08)]"
      : "border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]",
    className,
  ].join(" ");

  const tipNode = tip ? (
    <span className="shrink-0">
      <InfoTooltip text={tip} ariaLabel={tipAria || label} />
    </span>
  ) : null;

  return (
    <div className={shell}>
      {/* Mobile (<sm): icon → value → label */}
      <div className="flex h-full min-w-0 flex-1 flex-col items-center gap-2 text-center sm:hidden">
        <div className="relative flex items-center justify-center pt-0.5">
          <span className="shrink-0">{icon}</span>
          {tip ? <span className="absolute -right-5 -top-1">{tipNode}</span> : null}
        </div>
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col items-center justify-center text-base font-semibold [&_p]:text-base [&_span.text-xl]:text-base [&_span.text-2xl]:text-base">
          {children}
        </div>
        <span className="w-full px-0.5 text-center text-[10px] font-semibold uppercase tracking-wide leading-tight text-slate-500 break-words hyphens-auto line-clamp-2">
          {label}
        </span>
      </div>

      {/* Desktop (sm+): unchanged label-row layout */}
      <div className="hidden h-full min-w-0 flex-1 flex-col sm:flex">
        <div className="mb-3 flex items-start gap-2.5">
          <span className="shrink-0">{icon}</span>
          <span className="flex min-w-0 items-start gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <span className="leading-tight break-words">{label}</span>
            {tipNode}
          </span>
        </div>
        <div
          className={[
            "mt-auto flex min-h-[2.25rem] flex-1 flex-col",
            valueCentered ? "items-center justify-center text-center" : "justify-end",
          ].join(" ")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// Helper για μορφοποίηση αριθμών (15000 -> 15k)
const formatNum = (num?: number) => {
  if (num === undefined || num === null) return "";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
};

/** Service prices already on the public profile, or the commercial rate card when loaded. */
function listedRateCard(profile: ProInfluencer): Record<string, string> | undefined {
  if (profile.rate_card && Object.keys(profile.rate_card).length) return profile.rate_card;
  const card = rateCardFromPackages(
    (profile.service_packages || []).map((pkg) => ({
      id: pkg.id,
      platform: pkg.platform,
      type: pkg.type,
      quantity: pkg.quantity || 1,
      price: pkg.price || (pkg.from_price != null ? String(pkg.from_price) : ""),
    }))
  );
  return Object.keys(card).length ? card : undefined;
}

function scoreChannelFromProfile(profile: ProInfluencer, growthPct: number | null) {
  const followerVals = Object.values(profile.followers || {});
  const followersTotal = followerVals.reduce(
    (sum: number, n) => sum + (typeof n === "number" ? n : 0),
    0
  );
  const platformCount = followerVals.filter((n): n is number => typeof n === "number" && n > 0).length;
  const contentCount = Array.isArray(profile.videos) ? profile.videos.filter(Boolean).length : 0;
  return buildChannelScore({
    followersTotal,
    followersByPlatform: profile.followers || {},
    engagementRate: profile.engagement_rate,
    avgLikes: profile.avg_likes,
    contentCount,
    platformCount,
    verified: !!profile.verified,
    brandSafe: !!profile.auditpr_audit?.brandSafe,
    hasAudience: isValidAgeRange(profile.audience_data?.top_age),
    reviewCount: profile.total_reviews || 0,
    completionRate: profile.calculatedCompletionRate,
    growthPct,
    minRate:
      profile.min_rate || (profile.from_price != null ? String(profile.from_price) : undefined),
    rateCard: listedRateCard(profile),
    hasPricedMinRate: !!profile.has_priced_min_rate || profile.from_price != null,
    erFlagged: creatorHasHardErOnMainAccount(profile.accounts),
    avgResponseHours:
      profile.avg_response_time != null && Number.isFinite(profile.avg_response_time)
        ? profile.avg_response_time
        : null,
    avgRating:
      profile.avg_rating != null && Number.isFinite(profile.avg_rating) ? profile.avg_rating : null,
    hasAvatar: !!(profile.avatar && String(profile.avatar).trim()),
    hasBio: !!(profile.bio && String(profile.bio).trim()),
  });
}

const BACK_TO_DIRECTORY = {
  el: "Πίσω στον κατάλογο",
  en: "Back to directory",
} as const;

const t = {
  el: {
    contact: "Συνεργασία",
    contact_btn: "Ζήτησε Προσφορά",
    verified: "Επαληθευμένος",
    male: "Άνδρας",
    female: "Γυναίκα",
    ai: "AI",
    lang: "Γλώσσες",
    foll: "Followers",
    about: "Σχετικά",
    portfolio: "Portfolio / Highlights",
    connect: "Σύνδεση",
    collabs: "Συνεργασίες",
    platforms: "Πλατφόρμες",
    no_bio: "Δεν υπάρχει βιογραφικό.",
    no_vid: "Δεν έχουν ανέβει βίντεο.",
    tab_over: "Επισκοπηση",
    tab_aud: "Στατιστικά",
    tab_price: "Υπηρεσίες & τιμές",
    tab_reviews: "Αξιολογήσεις",
    stat_eng: "Αλληλεπίδραση",
    stat_likes: "Μ.Ο. Likes",
    stat_growth_30d: "Αλλαγή 15 Ημερών",
    stat_rating: "Αξιολόγηση",
    stat_reviews: "Αξιολογήσεις",
    stat_response: "Χρόνος Απάντησης",
    stat_completion: "Ποσοστό Ολοκλήρωσης",
    aud_gen: "Φύλο Κοινού",
    aud_age: "Ηλικιακό Group",
    reviews_title: "Αξιολογήσεις",
    reviews_empty: "Δεν υπάρχουν αξιολογήσεις ακόμα.",
    reviews_add: "Προσθήκη Αξιολόγησης",
    reviews_rating: "Βαθμολογία",
    reviews_comment: "Σχόλια",
    reviews_project: "Τύπος Project",
    reviews_submit: "Υποβολή",
    reviews_login_brand: "Συνδεθείτε ως brand για να αξιολογήσετε",
    reviews_login_link: "Σύνδεση",
    reviews_subtitle: "Μόνο brands που συνεργάστηκαν μέσω Influo (συμφωνία ή εγκεκριμένη παράδοση καμπάνιας) μπορούν να αξιολογήσουν",
    review_error_no_collab: "Μπορείτε να αξιολογήσετε μόνο influencers με τους οποίους έχετε συνεργαστεί. Παρακαλώ ολοκληρώστε πρώτα μια συνεργασία. Μετράει και η εγκεκριμένη παράδοση σε καμπάνια μέσω Influo.",
    review_error_already: "Έχετε ήδη αξιολογήσει αυτόν τον influencer. Μπορείτε να υποβάλετε μόνο μια αξιολόγηση ανά συνεργασία.",
    badges_verified: "Επαληθευμένος",
    badges_top: "Top Performer",
    badges_premium: "Premium Creator",
    badges_multi: "Multi-Platform",
    badges_expert: "Niche Expert",
    availability_available: "Διαθέσιμος",
    availability_busy: "Μη διαθέσιμος προσωρινά",
    availability_away: "Μη διαθέσιμος προσωρινά",
    availability_unavailable: "Μη διαθέσιμος προσωρινά",
    price_story: "Instagram Story (24h)",
    price_post: "Instagram Post",
    price_reel: "Reel / TikTok",
    price_facebook: "Facebook Post",
    price_youtube: "YouTube Video",
    price_note: "* Οι τιμές ενδέχεται να αλλάξουν ανάλογα το project.",
    min_rate: "Ελάχιστη Χρέωση",
    min_rate_desc: "Η ελάχιστη χρέωση για κάθε συνεργασία",
    modal_title: "Συνεργασία με",
    modal_sub: "Στείλε την πρότασή σου. Θα ειδοποιηθούν άμεσα.",
    modal_srv: "Επιλογή Υπηρεσίας",
    modal_brand: "Όνομα Επιχείρησης",
    modal_email: "Email Επιχείρησης",
    modal_as: "Η πρόταση στέλνεται ως",
    modal_bud: "Budget (€)",
    modal_desc: "Περιγραφή Project",
    modal_btn: "Αποστολή Πρότασης",
    modal_success: "Η πρόταση στάλθηκε!",
    modal_success_desc: "Η αίτησή σου καταχωρήθηκε. Θα λάβεις απάντηση στο email σου.",
    modal_close: "Κλείσιμο",
    modal_sending: "Αποστολή...",
    message_btn: "Μήνυμα",
    message_prompt_email: "Εισάγετε το email της επιχείρησής σας για να ξεκινήσετε τη συνομιλία:",
    message_prompt_name: "Εισάγετε το όνομα της επιχείρησής σας:",
    message_title: "Στείλτε Μήνυμα",
    message_desc: "Ξεκινήστε μια συνομιλία με αυτόν/αυτήν τον influencer",
    audit_title: "Στρατηγική Αξιολόγηση",
    audit_brand_safe: "Brand Safe",
    audit_er_caution: "Έλεγχος ER",
    audit_er_caution_hint: "Το engagement φαίνεται ύποπτο ή μη αξιόπιστο — μην βασίζεστε μόνο στο Brand Safe.",
    audit_niche: "Niche",
    why_work_with_them: "Γιατί να συνεργαστώ μαζί του: ",
    why_work_with_them_male: "Γιατί να συνεργαστώ μαζί του: ",
    why_work_with_them_female: "Γιατί να συνεργαστώ μαζί της: ",
    why_work_with_them_ai: "Γιατί να συνεργαστείτε: ",
    positives: "Θετικά",
    negatives: "Σημεία προσοχής",
    negatives_none: "Δεν υπάρχουν σημεία προσοχής.",
    positives_none: "Δεν υπάρχουν ξεχωριστά σημεία σε αυτή την ενότητα."
  },
  en: {
    contact: "Contact for Work",
    contact_btn: "Request Custom Quote",
    verified: "Verified",
    male: "Male",
    female: "Female",
    ai: "AI",
    lang: "Languages",
    foll: "Followers",
    about: "About",
    portfolio: "Portfolio / Highlights",
    connect: "Connect",
    collabs: "Collaborations",
    platforms: "Platforms",
    no_bio: "No bio available.",
    no_vid: "No videos uploaded.",
    tab_over: "Overview",
    tab_aud: "Stats",
    tab_price: "Services & pricing",
    tab_reviews: "Reviews",
    stat_eng: "Engagement",
    stat_likes: "Avg Likes",
    stat_growth_30d: "15 Days Change",
    stat_rating: "Rating",
    stat_reviews: "Reviews",
    stat_response: "Response Time",
    stat_completion: "Completion Rate",
    aud_gen: "Audience Gender",
    aud_age: "Top Age Group",
    reviews_title: "Reviews",
    reviews_empty: "No reviews yet.",
    reviews_add: "Add Review",
    reviews_rating: "Rating",
    reviews_comment: "Comment",
    reviews_project: "Project Type",
    reviews_submit: "Submit",
    reviews_login_brand: "Sign in as a brand to leave a review",
    reviews_login_link: "Sign in",
    reviews_subtitle: "Only brands that collaborated through Influo (agreement or approved campaign deliverable) can leave a review",
    review_error_no_collab: "You can only review influencers you have worked with. Please complete a collaboration first. An approved campaign deliverable through Influo also counts.",
    review_error_already: "You have already reviewed this influencer. You can only submit one review per collaboration.",
    badges_verified: "Verified",
    badges_top: "Top Performer",
    badges_premium: "Premium Creator",
    badges_multi: "Multi-Platform",
    badges_expert: "Niche Expert",
    availability_available: "Available",
    availability_busy: "Temporarily unavailable",
    availability_away: "Temporarily unavailable",
    availability_unavailable: "Temporarily unavailable",
    price_story: "Instagram Story (24h)",
    price_post: "Instagram Post",
    price_reel: "Reel / TikTok",
    price_facebook: "Facebook Post",
    price_youtube: "YouTube Video",
    price_note: "* Prices may vary depending on project scope.",
    min_rate: "Minimum Rate",
    min_rate_desc: "The minimum charge for each collaboration",
    modal_title: "Work with",
    modal_sub: "Send a proposal. We'll notify them instantly.",
    modal_srv: "Select Service",
    modal_brand: "Company Name",
    modal_email: "Company Email",
    modal_as: "This offer is sent as",
    modal_bud: "Budget (€)",
    modal_desc: "Project Details",
    modal_btn: "Send Proposal",
    modal_success: "Proposal Sent!",
    modal_success_desc: "This request has been logged. You will receive an update via email.",
    modal_close: "Close Window",
    modal_sending: "Sending...",
    message_btn: "Message",
    message_prompt_email: "Enter your company email to start messaging:",
    message_prompt_name: "Enter your company name:",
    message_title: "Send Message",
    message_desc: "Start a conversation with this influencer",
    audit_title: "Strategic Audit",
    audit_brand_safe: "Brand Safe",
    audit_er_caution: "ER caution",
    audit_er_caution_hint: "Engagement looks suspicious or unreliable — do not rely on Brand Safe alone.",
    audit_niche: "Niche",
    why_work_with_them: "Why work with them: ",
    why_work_with_them_male: "Why work with them: ",
    why_work_with_them_female: "Why work with them: ",
    why_work_with_them_ai: "Why work with them: ",
    positives: "Positives",
    negatives: "Points to consider",
    negatives_none: "No points to note.",
    positives_none: "No separate bullet points in this section."
  }
};

/** Stats-tab extras kept as per-key {el,en} to avoid Sonar new-code duplication in t.el/t.en. */
const STATS_UI_COPY = {
  cpm: { el: "Εκτιμώμενο CPM", en: "Est. CPM" },
  cpm_desc: {
    el: "Κόστος ανά 1.000 προβολές, με βάση την ελάχιστη χρέωση",
    en: "Cost per 1,000 views, based on minimum rate",
  },
  stats_updated: { el: "Τελευταία ενημέρωση στατιστικών", en: "Last stats update" },
  tip_engagement: {
    el: "Μέσο ποσοστό αλληλεπίδρασης ανά ανάρτηση σε σχέση με τους ακόλουθους.",
    en: "Average interaction rate per post relative to followers.",
  },
  tip_followers: {
    el: "Συνολικοί ακόλουθοι ανά πλατφόρμα.",
    en: "Total followers per platform.",
  },
  tip_likes: { el: "Μέσος αριθμός likes ανά ανάρτηση.", en: "Average likes per post." },
  tip_growth: {
    el: "Μεταβολή ακολούθων τις τελευταίες 15 ημέρες.",
    en: "Follower change over the last 15 days.",
  },
  tip_collabs: {
    el: "Αριθμός ολοκληρωμένων συνεργασιών με brands.",
    en: "Number of completed brand collaborations.",
  },
  tip_platforms: {
    el: "Πόσες πλατφόρμες έχει δηλώσει ο δημιουργός.",
    en: "How many platforms the creator has linked.",
  },
  tip_status: {
    el: "Αν ο δημιουργός είναι διαθέσιμος για νέες συνεργασίες.",
    en: "Whether the creator is available for new collaborations.",
  },
  tip_response: {
    el: "Μέσος χρόνος πρώτης απάντησης σε μηνύματα brands (ώρες).",
    en: "Average time to first reply to brand messages (hours).",
  },
  tip_completion: {
    el: "Ποσοστό προτάσεων που ολοκληρώθηκαν επιτυχώς.",
    en: "Share of proposals completed successfully.",
  },
  tip_min_rate: {
    el: "Η χαμηλότερη δηλωμένη χρέωση για συνεργασία.",
    en: "The lowest listed rate for a collaboration.",
  },
  tip_cpm: {
    el: "Εκτιμώμενο κόστος ανά 1.000 προβολές με βάση την ελάχιστη χρέωση.",
    en: "Estimated cost per 1,000 views based on the minimum rate.",
  },
  tip_rating: {
    el: "Μέση βαθμολογία από αξιολογήσεις brands.",
    en: "Average rating from brand reviews.",
  },
  tip_aria: { el: "Τι σημαίνει", en: "What this means" },
} as const;

function statsUiFor(lang: "el" | "en") {
  return {
    cpm: STATS_UI_COPY.cpm[lang],
    cpm_desc: STATS_UI_COPY.cpm_desc[lang],
    stats_updated: STATS_UI_COPY.stats_updated[lang],
    tip_engagement: STATS_UI_COPY.tip_engagement[lang],
    tip_followers: STATS_UI_COPY.tip_followers[lang],
    tip_likes: STATS_UI_COPY.tip_likes[lang],
    tip_growth: STATS_UI_COPY.tip_growth[lang],
    tip_collabs: STATS_UI_COPY.tip_collabs[lang],
    tip_platforms: STATS_UI_COPY.tip_platforms[lang],
    tip_status: STATS_UI_COPY.tip_status[lang],
    tip_response: STATS_UI_COPY.tip_response[lang],
    tip_completion: STATS_UI_COPY.tip_completion[lang],
    tip_min_rate: STATS_UI_COPY.tip_min_rate[lang],
    tip_cpm: STATS_UI_COPY.tip_cpm[lang],
    tip_rating: STATS_UI_COPY.tip_rating[lang],
    tip_aria: STATS_UI_COPY.tip_aria[lang],
  };
}

export default function InfluencerProfile(props: {
  params: Params;
  initialProfile?: ProfileViewModel | null;
  publicPath?: string;
}) {
  const params = use(props.params);
  const id = params.id;
  const publicPath = props.publicPath || publicProfilePath(props.initialProfile?.profile_slug, id);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [lang, setLang] = useState<"el" | "en">("el"); // Default to Greek, will be updated in useEffect
  const txt = { ...t[lang], ...statsUiFor(lang) };

  const [activeTab, setActiveTab] = useState("overview");
  const [profile, setProfile] = useState<ProInfluencer | null>((props.initialProfile as ProInfluencer | null) ?? null);
  const [loading, setLoading] = useState(!props.initialProfile);
  const profileTabsNavRef = useRef<HTMLElement | null>(null);

  // Load language from localStorage on client-side
  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);

  // Mobile tabs: keep the active tab visible in the horizontal scroller.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 640px)").matches) return;
    const nav = profileTabsNavRef.current;
    if (!nav) return;
    const btn = nav.querySelector<HTMLElement>(`[data-profile-tab="${activeTab}"]`);
    btn?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [activeTab]);
  
  // Counter proposal state
  const [counterProposalId, setCounterProposalId] = useState<string | null>(null);
  const [counterProposalAction, setCounterProposalAction] = useState<string | null>(null);
  const [counterProposal, setCounterProposal] = useState<any>(null);
  const [showCounterProposalModal, setShowCounterProposalModal] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  // MODAL STATE
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showRegistrationRequiredModal, setShowRegistrationRequiredModal] = useState(false);
  const [proposalType, setProposalType] = useState("Instagram Story");
  const [brandName, setBrandName] = useState("");
  const [brandEmail, setBrandEmail] = useState("");
  const [budget, setBudget] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageBrandName, setMessageBrandName] = useState("");
  const [messageBrandEmail, setMessageBrandEmail] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewProjectType, setReviewProjectType] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [isBrand, setIsBrand] = useState(false);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brandGateOpen, setBrandGateOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  /** Commercial row (raw min_rate) still loads only for brand, admin, or the owner. */
  const revealPrices = isBrand || isAdmin || isOwnProfile;
  const commercialRef = useRef<{
    min_rate?: string;
    rate_card?: ProInfluencer["rate_card"];
    service_packages?: ProInfluencer["service_packages"];
    service_extras?: ProInfluencer["service_extras"];
  } | null>(null);
  const [shortlistSaved, setShortlistSaved] = useState(false);
  const [shortlistBusy, setShortlistBusy] = useState(false);
  const [growth30d, setGrowth30d] = useState<{ growth: number; growthPct: number | null } | null>(null);
  const [growthSeries, setGrowthSeries] = useState<FollowerGrowthPoint[]>([]);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState<string | null>(null);

  // Same admin email gate as /admin; brand via /api/me/profile; own profile by influencer id.
  const ADMIN_EMAIL_FALLBACK = "nd.6@hotmail.com";
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        setHasSession(!!session?.access_token);
        if (!session?.access_token) {
          setIsBrand(false);
          setBrandId(null);
          setIsAdmin(false);
          setIsOwnProfile(false);
          sessionStorage.removeItem("isBrand");
          return;
        }
        const sessionEmail = (session.user.email || "").toLowerCase().trim();
        const admin = sessionEmail === ADMIN_EMAIL_FALLBACK.toLowerCase();
        setIsAdmin(admin);

        const profiles = await loadOwnProfiles(supabase);
        if (cancelled) return;
        const brand = profiles.ok ? profiles.brand : null;
        setIsBrand(!!brand);
        setBrandId(brand && brand.id != null ? String(brand.id) : null);
        if (brand) {
          sessionStorage.setItem("isBrand", "true");
          const name = typeof brand.brand_name === "string" ? brand.brand_name.trim() : "";
          const contact = typeof brand.contact_email === "string" ? brand.contact_email.trim() : "";
          const email = contact.includes("@") ? contact : (session.user.email || "").trim();
          if (name) setBrandName(name);
          if (email) setBrandEmail(email);
        } else {
          sessionStorage.removeItem("isBrand");
          setBrandId(null);
        }

        const ownInf = profiles.ok ? profiles.influencer : null;
        const ownId =
          ownInf && (typeof ownInf.id === "string" || typeof ownInf.id === "number")
            ? String(ownInf.id)
            : null;
        const profileId = id != null ? String(id) : "";
        const owns =
          !!profileId &&
          (ownId === profileId || session.user.id === profileId);
        setIsOwnProfile(owns);
      } catch (error) {
        console.error("Error checking user type:", error);
        if (!cancelled) {
          setIsBrand(false);
          setBrandId(null);
          setIsAdmin(false);
          setIsOwnProfile(false);
        }
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!isBrand || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const items = await fetchBrandShortlist();
        if (!cancelled) setShortlistSaved(items.some((s) => s.influencerId === String(id)));
      } catch {
        /* shortlist table may be missing */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isBrand, id]);

  // Online badge — only when the visitor has a session (avoids 401 on public RLS).
  useEffect(() => {
    if (!id || !hasSession) {
      setIsOnline(false);
      return;
    }

    const checkOnlineStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('influencer_presence')
          .select('influencer_id, is_online, last_seen')
          .eq('influencer_id', id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking online status:', error);
          setIsOnline(false);
          return;
        }

        const row = counterpartyInfluencerPresence(String(id), data);
        setIsOnline(presenceOnline(row));
      } catch (error) {
        console.error('Error checking online status:', error);
        setIsOnline(false);
      }
    };

    checkOnlineStatus();
    const interval = setInterval(() => {
      if (document.hidden) return;
      void checkOnlineStatus();
    }, 60_000);
    const onVisibility = () => {
      if (!document.hidden) void checkOnlineStatus();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [id, hasSession]);

  // Load counter proposal data if query params exist
  useEffect(() => {
    const propId = searchParams?.get('counterProposal') || null;
    const action = searchParams?.get('action') || null;
    
    if (propId) {
      setCounterProposalId(propId);
      setCounterProposalAction(action);
      setShowCounterProposalModal(true);
      loadCounterProposal(propId);
    }
  }, [searchParams]);

      // Auto-open message modal after registration (if redirect param exists)
  useEffect(() => {
    const openMessage = searchParams?.get('openMessage');
    if (openMessage === 'true') {
      // Check if user is logged in and is a brand
      const checkAndOpenMessage = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user && user.email) {
            const brandResult = await loadOwnBrand(supabase);
            if (brandResult.ok) {
              setMessageBrandEmail(user.email);
              setMessageBrandName(typeof brandResult.profile.brand_name === "string" ? brandResult.profile.brand_name : "");
              setShowMessageModal(true);
              
              // Clean up URL
              router.replace(publicPath);
            }
          }
        } catch (error) {
          console.error('Error checking brand status for auto-open:', error);
        }
      };
      
      checkAndOpenMessage();
    }
  }, [searchParams, id, router]);

  const loadCounterProposal = async (proposalId: string) => {
    try {
      const response = await sessionFetch(`/api/proposals?id=${encodeURIComponent(proposalId)}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.proposal) {
        setShowCounterProposalModal(false);
        if (response.status === 401) {
          alert(lang === 'el' ? 'Συνδεθείτε με τον λογαριασμό της επιχείρησης για να δείτε την αντιπρόταση.' : 'Log in with the brand account to see the counter offer.');
        }
        return;
      }
      setCounterProposal(result.proposal);
      if (searchParams?.get('action') === 'message') {
        setMessageBrandEmail(result.proposal.brand_email);
        setMessageBrandName(result.proposal.brand_name);
        setShowMessageModal(true);
        setShowCounterProposalModal(false);
      }
    } catch (error) {
      console.error('Error loading counter proposal:', error);
      setShowCounterProposalModal(false);
    }
  };

  const handleAcceptCounterProposal = async (proposalId: string) => {
    setProcessingAction(true);
    try {
      const response = await sessionFetch('/api/proposals/counter/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId })
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Η αντιπρόταση αποδεχτήθηκε! Η πρόταση ενημερώθηκε με την νέα τιμή.');
        setShowCounterProposalModal(false);
        // Remove query params
        router.push(publicPath);
      } else {
        alert('Σφάλμα: ' + (result.error || 'Αποτυχία αποδοχής αντιπρότασης'));
      }
    } catch (error: any) {
      console.error('Error accepting counter proposal:', error);
      alert('Σφάλμα: ' + error.message);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleRejectCounterProposal = async (proposalId: string) => {
    setProcessingAction(true);
    try {
      const response = await sessionFetch('/api/proposals/counter/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId })
      });
      
      const result = await response.json();
      if (result.success) {
        alert('Η αντιπρόταση απορρίφθηκε. Η αρχική πρόταση παραμένει ενεργή.');
        setShowCounterProposalModal(false);
        // Remove query params
        router.push(publicPath);
      } else {
        alert('Σφάλμα: ' + (result.error || 'Αποτυχία απόρριψης αντιπρότασης'));
      }
    } catch (error: any) {
      console.error('Error rejecting counter proposal:', error);
      alert('Σφάλμα: ' + error.message);
    } finally {
      setProcessingAction(false);
    }
  };

  // Function to fetch and parse profile data (extracted for reuse)
  const fetchProfile = async () => {
    if (!id) return;

    const response = await fetch(`/api/influencers/public/${encodeURIComponent(String(id))}`);
    const result = await response.json().catch(() => ({}));
    const data = response.ok ? result.data : null;
    const error = data ? null : { message: result.error || "Not found" };
    
    // Calculate completion + response metrics from real activity
    let calculatedCompletionRate: number | undefined;
    let computedResponseHours: number | null = null;
    if (data && !error) {
      {
        const usable = resolveCompletionRate(data.completion_rate);
        if (usable != null) calculatedCompletionRate = usable;
      }
      // Conversations/messages metrics require a session (RLS → 401 when logged out).
      const { data: { session: metricSession } } = await supabase.auth.getSession();
      if (metricSession?.access_token) {
        const { computeAvgResponseHours } = await import('@/lib/influencerMetrics');
        const responseH = await computeAvgResponseHours(supabase, String(id));
        computedResponseHours = responseH;
        // The public completion percentage is stored on the profile.
        // A visitor only sees their own proposals, so the browser must not rewrite it.
        const patch: Record<string, number | null> = {};
        if (responseH != null) {
          patch.avg_response_time = responseH;
        } else if (data.avg_response_time === 24 || data.avg_response_time === '24') {
          patch.avg_response_time = null;
        }
        if (Object.keys(patch).length > 0) {
          void supabase.from('influencers').update(patch).eq('id', id);
        }
      }
    }
    
    if (data && !error) {
      const socialsObj: { [key: string]: string } = {};
      if (Array.isArray(data.accounts)) {
         data.accounts.forEach((acc: any) => { if(acc.platform) socialsObj[acc.platform.toLowerCase()] = acc.username; });
      }
      
      // Build followers object from accounts, engagement rates and avg likes per platform
      const followersObj: { [key: string]: number } = {};
      const engagementRatesObj: { [key: string]: string } = {};
      const avgLikesObj: { [key: string]: string } = {};
      if (Array.isArray(data.accounts)) {
        data.accounts.forEach((acc: any) => {
          if (acc.platform && acc.followers) {
            const platform = acc.platform.toLowerCase();
            // Parse followers string (e.g., "15k" -> 15000, "1.5M" -> 1500000, "14.600" -> 14600)
            // Support both "k" and "κ" (Greek kappa), and handle dots as thousands separator
            let followersNum = 0;
            // Remove spaces and commas, then convert to lowercase
            let followersStr = acc.followers.toString().toLowerCase().replace(/\s/g, '').replace(/,/g, '');
            
            // Check if it has 'm' or 'M' (millions)
            if (followersStr.includes('m')) {
              followersNum = parseFloat(followersStr) * 1000000;
            } 
            // Check if it has 'k' or 'κ' (thousands) - Greek kappa support
            else if (followersStr.includes('k') || followersStr.includes('κ')) {
              followersNum = parseFloat(followersStr) * 1000;
            } 
            // No suffix - could be plain number or number with dot as thousands separator
            else {
              // If it has a dot, check if it's thousands separator (e.g., "14.600" -> 14600)
              // or decimal (e.g., "14.6" -> 14.6)
              if (followersStr.includes('.')) {
                const parts = followersStr.split('.');
                // If the part after dot has 3 digits, it's likely thousands separator (e.g., "14.600")
                if (parts.length === 2 && parts[1].length === 3 && /^\d+$/.test(parts[1])) {
                  // Thousands separator: remove dot and parse as integer
                  followersNum = parseInt(parts[0] + parts[1], 10) || 0;
                } else {
                  // Decimal number: parse normally
                  followersNum = parseFloat(followersStr) || 0;
                }
              } else {
                // No dot, parse as integer
                followersNum = parseFloat(followersStr) || 0;
              }
            }
            followersObj[platform] = Math.round(followersNum);
            
            // Store engagement rate per platform if available
            if (acc.engagement_rate) {
              engagementRatesObj[platform] = acc.engagement_rate;
            }
            
            // Store avg likes per platform if available
            if (acc.avg_likes) {
              avgLikesObj[platform] = acc.avg_likes;
            }
          }
        });
      }
      
      setProfile({
        id: data.id,
        name: data.display_name,
        bio: data.bio || "",
        bio_en: data.bio_en || null,
        avatar: data.avatar_url || null,
        verified: data.analytics_verified || false, // Use analytics_verified for verified badge
        socials: socialsObj,
        followers: followersObj,
        categories: data.category
          ? (parseStoredCategories(data.category).length ? parseStoredCategories(data.category) : ["Creator"])
          : ["Creator"],
        platform: "Instagram",
        gender: data.gender,
        location: data.location,
        languages: data.languages 
          ? (typeof data.languages === 'string' 
            ? (data.languages.includes(',') ? data.languages.split(',').map((l: string) => l.trim()) : [data.languages.trim()])
            : (Array.isArray(data.languages) ? data.languages : []))
          : [],
        has_min_rate: !!data.has_min_rate,
        has_priced_min_rate: !!data.has_priced_min_rate,
        from_price: typeof data.from_price === "number" && data.from_price > 0 ? data.from_price : null,
        price_tier: data.price_tier || "0",
        videos: Array.isArray(data.videos) ? data.videos : [],
        video_thumbnails: data.video_thumbnails || null,
        engagement_rate: Object.keys(engagementRatesObj).length > 0 ? engagementRatesObj : (data.engagement_rate || undefined), // Store as object per platform, fallback to legacy string
        avg_likes: Object.keys(avgLikesObj).length > 0 ? avgLikesObj : (data.avg_likes || undefined), // Store as object per platform, fallback to legacy string
        accounts: Array.isArray(data.accounts) ? data.accounts : [],
        audience_data: (() => {
          const parseGenderPct = (raw: unknown): number | null => {
            if (raw == null || raw === "") return null;
            const n = Number(raw);
            return Number.isFinite(n) ? n : null;
          };
          const male = parseGenderPct(data.audience_male_percent);
          const female = parseGenderPct(data.audience_female_percent);
          const bothMissing = male == null && female == null;
          return {
            male: bothMissing ? null : male,
            female: bothMissing ? null : female,
            top_age: data.audience_top_age || "?",
          };
        })(),
        rate_card_flags: data.rate_card_flags || {},
        past_brands: data.past_brands || [],
        avg_rating: data.avg_rating || 0,
        total_reviews: data.total_reviews || 0,
        avg_response_time:
          computedResponseHours != null
            ? computedResponseHours
            : undefined,
        completion_rate: calculatedCompletionRate ?? data.completion_rate ?? undefined,
        availability_status: data.availability_status || 'available',
        skills: data.skills || [],
        certifications: data.certifications || [],
        service_packages: commercialRef.current?.service_packages
          ?? (Array.isArray(data.service_packages) ? data.service_packages : []),
        service_extras: commercialRef.current?.service_extras
          ?? (Array.isArray(data.service_extras) ? data.service_extras : []),
        min_rate: commercialRef.current?.min_rate,
        rate_card: commercialRef.current?.rate_card,
        calculatedCompletionRate: calculatedCompletionRate,
        created_at: data.created_at,
        auditpr_audit: data.auditpr_audit ?? undefined,
      });
    }
    setLoading(false);
  };

  // Refresh after the server render. Keep the server HTML if the request fails.
  useEffect(() => {
    if (!id) return;
    fetchProfile().catch(() => setLoading(false));
  }, [id]);

  // Exact prices only after client auth (brand / admin / own). Never from ISR HTML.
  useEffect(() => {
    if (!revealPrices || !id) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || cancelled) return;
      const res = await fetch(`/api/influencers/commercial?id=${encodeURIComponent(String(id))}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok || cancelled) return;
      const body = await res.json().catch(() => ({}));
      const row = body.data;
      if (!row || cancelled) return;
      const commercial = {
        min_rate: row.min_rate || undefined,
        rate_card: row.rate_card || undefined,
        service_packages: Array.isArray(row.service_packages) ? row.service_packages : undefined,
        service_extras: Array.isArray(row.service_extras) ? row.service_extras : undefined,
      };
      commercialRef.current = commercial;
      setProfile((prev) => prev ? { ...prev, ...commercial } : prev);
    })();
    return () => { cancelled = true; };
  }, [revealPrices, id]);

  // Track profile view once per page load (not on every profile refresh).
  const trackedViewRef = useRef<string | null>(null);
  useEffect(() => {
    if (!id || !profile) return;
    if (trackedViewRef.current === id) return;
    trackedViewRef.current = id;

    const trackProfileView = async () => {
      try {
        let brandEmail = null;
        let brandName = null;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              const response = await fetch('/api/user/profile', {
                headers: {
                  'Authorization': `Bearer ${session.access_token}`
                }
              });
              if (response.ok) {
                const result = await response.json();
                if (result.profile?.type === 'brand') {
                  brandEmail = user.email || null;
                  brandName = result.profile.brand_name || null;
                }
              }
            }
          }
        } catch {
          // Ignore errors
        }

        await fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            influencerId: id,
            eventType: 'profile_view',
            brandEmail: brandEmail,
            brandName: brandName,
            visitorId: getVisitorId(),
            metadata: { source: 'profile_page' }
          })
        }).catch(() => {});
      } catch {
        // Fail silently - analytics tracking should not break the page
      }
    };

    void trackProfileView();
  }, [id, profile]);

  // Fetch 15-day growth when profile is loaded (for stats card)
  useEffect(() => {
    if (!id || !profile) {
      setGrowth30d(null);
      setGrowthSeries([]);
      setStatsUpdatedAt(null);
      return;
    }
    fetch(`/api/influencer/${id}/growth`)
      .then((r) => r.json())
      .then(
        (data: {
          growth?: number;
          growthPct?: number;
          series?: FollowerGrowthPoint[];
          statsUpdatedAt?: string;
        }) => {
          setGrowthSeries(Array.isArray(data.series) ? data.series : []);
          if (data.growth != null) {
            setGrowth30d({ growth: data.growth, growthPct: data.growthPct ?? null });
          } else {
            setGrowth30d(null);
          }
          setStatsUpdatedAt(
            typeof data.statsUpdatedAt === "string" && data.statsUpdatedAt.trim()
              ? data.statsUpdatedAt
              : null
          );
        }
      )
      .catch(() => {
        setGrowth30d(null);
        setGrowthSeries([]);
        setStatsUpdatedAt(null);
      });
  }, [id, profile?.id]);

  // Refresh when window gets focus (user might have edited in another tab)
  useEffect(() => {
    const handleFocus = () => {
      // Refresh data when user comes back to the tab (in case admin edited data)
      fetchProfile();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [id]);

  // Soft refresh while the tab is visible (Realtime is not used on public profiles).
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;
      void fetchProfile();
    }, 120_000);
    return () => clearInterval(interval);
  }, [id]);

  // Load reviews
  useEffect(() => {
    const loadReviews = async () => {
      if (!id) return;
      try {
        const response = await fetch(`/api/reviews?influencerId=${id}`);
        const data = await response.json();
        if (data.reviews) {
          setReviews(data.reviews);
        }
      } catch (error) {
        console.error('Error loading reviews:', error);
      }
    };
    loadReviews();
  }, [id]);

  // --- HANDLER: SEND PROPOSAL (UPDATED) ---
  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
        const response = await sessionFetch('/api/proposals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                influencerId: id,
                brandName,
                brandEmail,
                serviceType: proposalType,
                budget,
                message,
            }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
            const fallback = lang === 'el' ? "Κάτι πήγε στραβά. Παρακαλώ δοκιμάστε ξανά." : "Something went wrong. Please try again.";
            alert(result.error || fallback);
            setSending(false);
            return;
        }

        // 5. Update brand dashboard stats (proposalsSent) - only after successful submission
        try {
            if (typeof window !== 'undefined') {
                const saved = localStorage.getItem('brandDashboardStats');
                if (saved) {
                    try {
                        const stats = JSON.parse(saved);
                        const updated = {
                            ...stats,
                            proposalsSent: (stats.proposalsSent || 0) + 1
                        };
                        localStorage.setItem('brandDashboardStats', JSON.stringify(updated));
                    } catch (e) {
                        console.error('Error updating proposal stats:', e);
                    }
                }
            }
        } catch (statsError) {
            console.error("Failed to update proposal stats:", statsError);
        }

        setSent(true);
    } catch (err) {
        console.error("Error sending proposal:", err);
        alert("Something went wrong. Please try again.");
    } finally {
        setSending(false);
    }
  };

  // --- HANDLER: SUBMIT REVIEW ---
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBrand) {
      alert(txt.reviews_login_brand);
      return;
    }
    if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
      alert(lang === "el" ? "Παρακαλώ επιλέξτε βαθμολογία (1-5)" : "Please choose a rating (1-5)");
      return;
    }
    if (reviewText.trim().length > 1000) {
      alert(
        lang === "el"
          ? "Το κείμενο αξιολόγησης δεν μπορεί να υπερβαίνει τους 1000 χαρακτήρες."
          : "Review text cannot exceed 1000 characters."
      );
      return;
    }

    setReviewSubmitting(true);
    try {
      const response = await sessionFetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          influencerId: id,
          rating: reviewRating,
          reviewText: reviewText,
          projectType: reviewProjectType,
          lang: lang,
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert(lang === "el" ? "Η αξιολόγηση υποβλήθηκε!" : "Review submitted!");
        setShowReviewModal(false);
        setReviewRating(5);
        setReviewText("");
        setReviewProjectType("");
        const reloadResponse = await fetch(`/api/reviews?influencerId=${id}`);
        const reloadData = await reloadResponse.json();
        if (reloadData.reviews) setReviews(reloadData.reviews);
        window.location.reload();
      } else {
        const errorMsg = result.error || txt.review_error_no_collab;
        throw new Error(errorMsg);
      }
    } catch (err: unknown) {
      console.error("Error submitting review:", err);
      const message = err instanceof Error ? err.message : "Error";
      alert(lang === "el" ? "Σφάλμα: " + message : "Error: " + message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  // --- HANDLER: SEND MESSAGE ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBrandEmail || !messageContent.trim()) {
      alert(lang === 'el' ? 'Παρακαλώ συμπληρώστε email και μήνυμα' : 'Please fill in email and message');
      return;
    }

    setMessageSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert(lang === 'el' ? 'Συνδεθείτε για να στείλετε μήνυμα.' : 'Sign in to send a message.');
        return;
      }
      const profiles = await loadOwnProfiles(supabase);
      const asBrand = profiles.ok && profiles.brand;
      const asOwner = profiles.ok && profiles.influencer && String(profiles.influencer.id) === String(id);
      if (!asBrand && !asOwner) {
        alert(lang === 'el' ? 'Μόνο η επιχείρηση ή ο κάτοχος του προφίλ μπορεί να στείλει μήνυμα.' : 'Only the brand or the profile owner can send a message.');
        return;
      }
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(
          asBrand
            ? {
                influencerId: id,
                brandName: typeof profiles.brand?.brand_name === 'string' ? profiles.brand.brand_name : messageBrandName,
                senderType: 'brand',
                content: messageContent,
              }
            : {
                influencerId: id,
                brandEmail: messageBrandEmail,
                brandName: messageBrandName || messageBrandEmail,
                senderType: 'influencer',
                content: messageContent,
              }
        )
      });

      const result = await response.json();
      if (result.success) {
        alert(lang === 'el' ? 'Το μήνυμα στάλθηκε! Θα μεταφερθείτε στη σελίδα συνομιλιών.' : 'Message sent! Redirecting to conversation...');
        const conversation = result.conversationId ? `&conversation=${encodeURIComponent(result.conversationId)}` : '';
        window.location.href = asBrand
          ? `/brand/dashboard?tab=messages${conversation}`
          : `/dashboard?tab=messages${conversation}`;
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      alert(lang === 'el' ? 'Σφάλμα: ' + err.message : 'Error: ' + err.message);
    } finally {
      setMessageSending(false);
    }
  };

  const goBackToDirectory = useCallback(() => {
    try {
      const ref = typeof document !== "undefined" ? document.referrer : "";
      if (ref) {
        const u = new URL(ref);
        if (
          u.origin === window.location.origin &&
          u.pathname.includes("/directory")
        ) {
          router.back();
          return;
        }
      }
    } catch {
      /* ignore bad referrer */
    }
    router.push(lang === "en" ? "/en/directory" : "/directory");
  }, [lang, router]);

  const openCreatorMessage = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        setShowRegistrationRequiredModal(true);
        return;
      }
      const brandResult = await loadOwnBrand(supabase);
      if (!brandResult.ok && brandResult.reason === "error") {
        alert(lang === "el" ? "Δεν ελέγχθηκε ο λογαριασμός. Δοκιμάστε ξανά." : "Could not check the account. Try again.");
        return;
      }
      if (!brandResult.ok) {
        setShowRegistrationRequiredModal(true);
        return;
      }
      router.push(`/messages?influencer=${encodeURIComponent(String(id))}`);
    } catch (error) {
      console.error("Error checking brand status:", error);
      setShowRegistrationRequiredModal(true);
    }
  }, [id, lang, router]);

  const startCollaboration = useCallback((choice?: { label: string; budget?: string }) => {
    if (choice?.label) setProposalType(choice.label);
    if (choice?.budget) setBudget(choice.budget);
    setShowProposalModal(true);
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading Profile...</div>;
  if (!profile) return <div className="min-h-screen flex items-center justify-center text-slate-500">Influencer not found.</div>;

  const packageOffers = (Array.isArray(profile.service_packages) ? profile.service_packages : [])
    .map((pkg) =>
      pkg.platform && pkg.type
        ? packageTitle(pkg.platform, pkg.type, pkg.quantity || 1, lang)
        : pkg.title
    )
    .filter((label): label is string => !!label);
  const extraOffers = (Array.isArray(profile.service_extras) ? profile.service_extras : [])
    .filter((extra) => extra.has_price)
    .map((extra) => EXTRA_LABEL[extra.key]?.[lang])
    .filter((label): label is string => !!label);
  const offerChoices = [...new Set([...packageOffers, ...extraOffers])].slice(0, 12);
  const proposalServices = offerChoices.length ? offerChoices : ["Story", "Post", "Reel"];
  const showHireBar = sessionChecked && !isOwnProfile;
  const hirePackages = Array.isArray(profile.service_packages) ? profile.service_packages : [];
  const hireExtras = Array.isArray(profile.service_extras) ? profile.service_extras : [];
  const hireFloor = lowestListedPrice({
    service_packages: profile.service_packages,
    rate_card: profile.rate_card,
    min_rate: profile.min_rate,
  });
  const hireSource = hireFloor ?? (typeof profile.from_price === "number" ? profile.from_price : null);
  const hireAmount = hireSource != null && hireSource > 0 ? formatEuro(hireSource, lang) : null;
  const hireCardProps = {
    lang,
    packages: hirePackages,
    extras: hireExtras,
    amountLabel: hireAmount,
    creatorName: displayNameForLang(profile.name, lang),
    gender: profile.gender,
    isBrand,
    influencerId: String(id),
    collaborateLabel: txt.contact,
    messageLabel: txt.message_btn,
    onCollaborate: startCollaboration,
    onMessage: () => {
      void openCreatorMessage();
    },
    onNeedBrand: () => setBrandGateOpen(true),
  };

  return (
    <div className={`bg-white min-h-screen font-sans relative text-slate-900 ${showHireBar ? "pb-32 lg:pb-20" : "pb-20"}`}>
      <SiteHeader lang={lang} onLangChange={setLang} />
      <BrandGateModal
        open={brandGateOpen}
        onClose={() => setBrandGateOpen(false)}
        lang={lang}
        returnPath={publicPath}
      />

      {/* PROPOSAL MODAL */}
      {showProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative">
                <button 
                    onClick={() => { setShowProposalModal(false); setSent(false); }}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xl z-10"
                >✕</button>

                {!sent ? (
                    <div className="p-8">
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">{txt.modal_title} {displayNameForLang(profile.name, lang)}</h3>
                        <p className="text-slate-500 text-sm mb-6">{txt.modal_sub}</p>
                        
                        <form onSubmit={handleSendProposal} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_srv}</label>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {proposalServices.map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setProposalType(type)}
                                            className={`inline-flex min-h-11 items-center justify-center px-2 py-2 text-xs font-bold leading-tight rounded-lg border transition-all ${proposalType === type ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200 hover:border-blue-300'}`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {isBrand ? (
                                <p className="text-sm text-slate-600">
                                    {txt.modal_as}{brandName || brandEmail ? <> <strong>{brandName || brandEmail}</strong></> : null}
                                </p>
                            ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_brand}</label>
                                    <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="Brand" value={brandName} onChange={e => setBrandName(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_email}</label>
                                    <input required type="email" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="Email" value={brandEmail} onChange={e => setBrandEmail(e.target.value)} />
                                </div>
                            </div>
                            )}
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_bud}</label>
                                <input required type="number" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder={isBrand && profile?.min_rate ? profile.min_rate : "200"} value={budget} onChange={e => setBudget(e.target.value)} />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.modal_desc}</label>
                                <textarea required rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="..." value={message} onChange={e => setMessage(e.target.value)}></textarea>
                            </div>

                            <button type="submit" disabled={sending} className="w-full bg-slate-900 hover:bg-black text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50">
                                {sending ? txt.modal_sending : txt.modal_btn}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">🚀</div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">{txt.modal_success}</h3>
                        <p className="text-slate-500 mb-6">{txt.modal_success_desc}</p>
                        <button onClick={() => { setShowProposalModal(false); setSent(false); }} className="text-blue-600 font-bold hover:underline">
                            {txt.modal_close}
                        </button>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* REVIEW MODAL */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-full sm:max-w-lg overflow-hidden relative">
            <button 
              onClick={() => { 
                setShowReviewModal(false); 
                setReviewRating(5);
                setReviewText("");
                setReviewProjectType("");
              }}
              className="absolute top-3 right-3 inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-slate-400 hover:text-slate-600 font-bold text-xl z-10 sm:top-4 sm:right-4 sm:min-h-0 sm:min-w-0"
            >✕</button>

            <div className="p-5 sm:p-8 max-w-full">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 pr-10 break-words">{txt.reviews_add}</h2>
              <p className="text-slate-500 mb-6 text-sm sm:text-base break-words">{lang === 'el' ? 'Αξιολόγησε αυτόν τον influencer' : 'Rate this influencer'}</p>

              {!isBrand ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <p className="font-medium break-words">{txt.reviews_login_brand}</p>
                  <Link
                    href={`/brand/login?redirect=${encodeURIComponent(publicPath)}`}
                    className="mt-3 inline-flex min-h-[44px] items-center text-blue-700 font-semibold hover:underline sm:min-h-0"
                  >
                    {txt.reviews_login_link}
                  </Link>
                </div>
              ) : (
              <form onSubmit={handleSubmitReview} className="space-y-4 w-full max-w-full">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{txt.reviews_rating}</label>
                  <div className="flex flex-wrap gap-1 sm:gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-3xl sm:text-4xl transition-transform hover:scale-110 sm:min-h-0 sm:min-w-0 ${
                          star <= reviewRating ? 'text-amber-400' : 'text-slate-300'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.reviews_project}</label>
                  <select 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    value={reviewProjectType}
                    onChange={e => setReviewProjectType(e.target.value)}
                  >
                    <option value="">{lang === 'el' ? 'Επιλέξτε...' : 'Select...'}</option>
                    <option value="Instagram Story">Instagram Story</option>
                    <option value="Instagram Post">Instagram Post</option>
                    <option value="Reel / TikTok">Reel / TikTok</option>
                    <option value="Campaign">{lang === 'el' ? 'Καμπάνια' : 'Campaign'}</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{txt.reviews_comment}</label>
                  <textarea 
                    rows={4} 
                    maxLength={1000}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 resize-none" 
                    placeholder={lang === 'el' ? 'Γράψτε την άποψή σας...' : 'Write your review...'}
                    value={reviewText}
                    onChange={e => setReviewText(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-400">{reviewText.trim().length}/1000</p>
                </div>

                <button 
                  type="submit"
                  disabled={reviewSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50"
                >
                  {reviewSubmitting ? "…" : txt.reviews_submit}
                </button>
              </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MESSAGE MODAL */}
      {/* Registration Required Modal - Modern & Professional */}
      {showRegistrationRequiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative transform transition-all">
            {/* Close Button */}
            <button 
              onClick={() => setShowRegistrationRequiredModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xl z-10 transition-colors"
            >
              ✕
            </button>

            {/* Content */}
            <div className="p-8">
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-4xl">🔒</span>
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-slate-900 text-center mb-3">
                {lang === 'el' ? 'Εγγραφή Απαιτείται' : 'Registration Required'}
              </h2>

              {/* Description */}
              <p className="text-slate-600 text-center mb-6 leading-relaxed">
                {lang === 'el' 
                  ? 'Για να στείλετε μήνυμα σε αυτόν τον influencer, χρειάζεται να έχετε εγγραφεί ως επιχείρηση. Η εγγραφή είναι δωρεάν και γρήγορη!'
                  : 'To send a message to this influencer, you need to register as a business. Registration is free and quick!'}
              </p>

              {/* Benefits List */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-5 mb-6 border border-blue-100">
                <p className="text-sm font-semibold text-slate-900 mb-3">
                  {lang === 'el' ? 'Με την εγγραφή θα έχετε:' : 'By registering you will have:'}
                </p>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{lang === 'el' ? 'Άμεση επικοινωνία με influencers' : 'Direct messaging with influencers'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{lang === 'el' ? 'Dashboard για διαχείριση προτάσεων' : 'Dashboard to manage proposals'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{lang === 'el' ? 'Έξυπνη υπηρεσία προτάσεων AI (ΔΩΡΕΑΝ)' : 'AI-powered influencer suggestions (FREE)'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{lang === 'el' ? 'Αναλυτικά στατιστικά και reports' : 'Detailed analytics and reports'}</span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      const email = user?.email || '';
                      const redirectUrl = `${publicPath}?openMessage=true`;
                      router.push(`/brand/signup?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirectUrl)}`);
                    } catch (error) {
                      console.error('Error getting user email:', error);
                      const redirectUrl = `${publicPath}?openMessage=true`;
                      router.push(`/brand/signup?redirect=${encodeURIComponent(redirectUrl)}`);
                    }
                  }}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                  <span className="text-lg">✨</span>
                  <span>{lang === 'el' ? 'Εγγραφή Επιχείρησης' : 'Register Business'}</span>
                </button>
                
                <button
                  onClick={() => setShowRegistrationRequiredModal(false)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-6 rounded-xl transition-colors"
                >
                  {lang === 'el' ? 'Ακύρωση' : 'Cancel'}
                </button>
              </div>

              {/* Footer Note */}
              <p className="text-xs text-slate-500 text-center mt-4">
                {lang === 'el' 
                  ? 'Η εγγραφή είναι 100% δωρεάν και διαρκεί λιγότερο από 2 λεπτά'
                  : 'Registration is 100% free and takes less than 2 minutes'}
              </p>
            </div>
          </div>
        </div>
      )}

      {showMessageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative">
                <button 
                    onClick={() => { 
                      setShowMessageModal(false); 
                      setMessageBrandEmail("");
                      setMessageBrandName("");
                      setMessageContent("");
                    }}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xl z-10"
                >✕</button>

                <div className="p-8">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">{txt.message_title}</h2>
                    <p className="text-slate-500 mb-6">{txt.message_desc}</p>
                    
                    <form onSubmit={handleSendMessage} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                {txt.modal_brand}
                            </label>
                            <input 
                                required 
                                type="text" 
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900" 
                                placeholder={txt.modal_brand}
                                value={messageBrandName}
                                onChange={e => setMessageBrandName(e.target.value)}
                            />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                {txt.modal_email}
                            </label>
                            <input 
                                required 
                                type="email" 
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900" 
                                placeholder={txt.modal_email}
                                value={messageBrandEmail}
                                onChange={e => setMessageBrandEmail(e.target.value)}
                            />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                {txt.modal_desc}
                            </label>
                            <textarea 
                                required 
                                rows={4} 
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900 resize-none" 
                                placeholder="..."
                                value={messageContent}
                                onChange={e => setMessageContent(e.target.value)}
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={messageSending} 
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg disabled:opacity-50"
                        >
                            {messageSending ? txt.modal_sending : txt.message_btn}
                        </button>
                    </form>
                </div>
            </div>
        </div>
      )}

      {/* PROFESSIONAL HERO HEADER — category-tinted CSS gradient (no stock photo) */}
      <div
        className={`relative w-full h-64 md:h-80 overflow-hidden ${heroGradientForCategory(profile.categories)}`}
      >
        {/* Soft dot pattern (CSS only) */}
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
          aria-hidden
        />

        {/* Back to directory — bottom-left on desktop; top-left on mobile to clear overlapping avatar */}
        <button
          type="button"
          onClick={goBackToDirectory}
          className="absolute z-20 left-4 sm:left-6 top-4 md:top-auto md:bottom-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-white/20 transition"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          <span>{BACK_TO_DIRECTORY[lang]}</span>
        </button>

        {/* Network circles visualization overlay */}
        <div className="pointer-events-none absolute inset-0 z-10 opacity-30">
          <svg width="100%" height="100%" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0">
            <defs>
              <linearGradient id="circleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.3" />
              </linearGradient>
            </defs>
            
            {/* Network nodes - circles */}
            <circle cx="150" cy="100" r="8" fill="url(#circleGradient)" stroke="white" strokeWidth="1.5" />
            <circle cx="350" cy="120" r="6" fill="url(#circleGradient)" stroke="white" strokeWidth="1.5" />
            <circle cx="600" cy="80" r="10" fill="url(#circleGradient)" stroke="white" strokeWidth="2" />
            <circle cx="850" cy="100" r="6" fill="url(#circleGradient)" stroke="white" strokeWidth="1.5" />
            <circle cx="1050" cy="120" r="8" fill="url(#circleGradient)" stroke="white" strokeWidth="1.5" />
            <circle cx="250" cy="250" r="6" fill="url(#circleGradient)" stroke="white" strokeWidth="1.5" />
            <circle cx="750" cy="280" r="7" fill="url(#circleGradient)" stroke="white" strokeWidth="1.5" />
            <circle cx="450" cy="300" r="6" fill="url(#circleGradient)" stroke="white" strokeWidth="1.5" />
            <circle cx="950" cy="300" r="6" fill="url(#circleGradient)" stroke="white" strokeWidth="1.5" />
            
            {/* Connection lines between circles */}
            <line x1="150" y1="100" x2="350" y2="120" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="350" y1="120" x2="600" y2="80" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="600" y1="80" x2="850" y2="100" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="850" y1="100" x2="1050" y2="120" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="150" y1="100" x2="250" y2="250" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="600" y1="80" x2="450" y2="300" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="850" y1="100" x2="750" y2="280" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="1050" y1="120" x2="950" y2="300" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="250" y1="250" x2="450" y2="300" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="450" y1="300" x2="750" y2="280" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="750" y1="280" x2="950" y2="300" stroke="white" strokeWidth="2" strokeOpacity="0.4" />
            <line x1="350" y1="120" x2="450" y2="300" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
            <line x1="600" y1="80" x2="750" y2="280" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
          </svg>
        </div>
        
      </div>

      {/* overflow-x-clip keeps the cover overlap in bounds without a scroll container, so the hire card can stick */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative -mt-24 z-10 min-w-0 overflow-x-clip">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden min-w-0">
          {/* Top Section: Avatar, Name, Info */}
          <div className="p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 border-b border-slate-100">
            <div className="relative w-40 h-40 -mt-6 md:mb-0 flex-shrink-0">
                <div className="relative w-40 h-40 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-100">
                  <Avatar src={profile.avatar} alt={displayNameForLang(profile.name, lang)} size={160} className="w-full h-full" priority />
                </div>
                {profile.verified && (
                  <div
                    className="absolute bottom-1 right-1 bg-blue-600 text-white p-1.5 rounded-full border-2 border-white shadow-sm"
                    title={lang === "en" ? "Stats checked by Influo" : "Στατιστικά ελεγμένα από το Influo"}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
            </div>
            <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-slate-900 flex items-center justify-center md:justify-start gap-2">
                    {displayNameForLang(profile.name, lang)}
                </h1>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-1">
                    <p className="text-slate-500">
                      {displayLocation(profile.location, lang) || profile.location} •{" "}
                      {genderLabel(profile.gender, lang)}
                    </p>
                    {isOnline && (
                        <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 px-3 py-1 rounded-full text-xs font-semibold animate-pulse">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            {lang === 'el' ? 'Online Τώρα !' : 'Online Now !'}
                        </span>
                    )}
                </div>
                {/* Categories — link to directory filtered by category */}
                {profile.categories && profile.categories.length > 0 && (
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                    {profile.categories.map((cat) => {
                      const translatedCat = categoryTranslations[cat]?.[lang] || cat;
                      const directoryBase = lang === "en" ? "/en/directory" : "/directory";
                      const href = `${directoryBase}?category=${encodeURIComponent(cat)}`;
                      return (
                        <Link
                          key={cat}
                          href={href}
                          className="text-xs uppercase font-semibold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition"
                        >
                          {translatedCat}
                        </Link>
                      );
                    })}
                  </div>
                )}
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                    {profile.languages && Array.isArray(profile.languages) && profile.languages.map((l, i) => (
                      <span key={i} className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                        {displayLanguageLabel(typeof l === 'string' ? l : String(l), lang)}
                      </span>
                    ))}
                    {profile.skills && profile.skills.length > 0 && profile.skills.map((skill, i) => (
                      <span key={`skill-${i}`} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">{skill}</span>
                    ))}
                </div>
                {profile.certifications && profile.certifications.length > 0 && (
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                    {profile.certifications.map((cert, i) => (
                      <span key={`cert-${i}`} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium">
                        🎓 {cert}
                      </span>
                    ))}
                  </div>
                )}
            </div>
            <div className="relative flex w-full flex-col items-center gap-2 md:w-auto md:shrink-0 md:items-end">
              {/* Badges - centered on mobile, right-aligned on desktop */}
              {(() => {
                // Calculate account age in days
                let accountAgeDays = 999;
                if (profile.created_at) {
                  try {
                    const createdDate = new Date(profile.created_at);
                    // Check if date is valid
                    if (!isNaN(createdDate.getTime())) {
                      const now = new Date();
                      const diffTime = now.getTime() - createdDate.getTime();
                      accountAgeDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                      // Ensure non-negative
                      if (accountAgeDays < 0) accountAgeDays = 0;
                    }
                  } catch (e) {
                    console.error('Error calculating account age:', e);
                  }
                }
                const badges = getBadges({
                  verified: profile.verified,
                  followers: profile.followers,
                  engagement_rate: profile.engagement_rate,
                  total_reviews: profile.total_reviews || 0,
                  avg_rating: profile.avg_rating || 0,
                  past_brands: profile.past_brands || [],
                  account_created_days: accountAgeDays,
                  min_rate: profile.min_rate || badgeMinRateFromTier(profile.price_tier),
                }, lang);
                
                // Debug: log badge calculation (always log for debugging)
                console.log('Badge calculation:', {
                  verified: profile.verified,
                  accountAgeDays,
                  created_at: profile.created_at,
                  badgesCount: badges.length,
                  badges: badges.map(b => b.type),
                  profileData: {
                    created_at: profile.created_at,
                    verified: profile.verified,
                    followers: profile.followers,
                    engagement_rate: profile.engagement_rate
                  }
                });
                
                return badges.length > 0 ? (
                  <div className="mb-2 flex flex-wrap justify-center gap-2 md:justify-end">
                    {badges.map((badge, idx) => (
                      <span
                        key={idx}
                        className={getBadgeStyles(badge) + " text-xs px-3 py-1.5"}
                        title={badge.label}
                      >
                        <span>{badge.icon}</span>
                        <span>{badge.label}</span>
                      </span>
                    ))}
                  </div>
                ) : null;
              })()}
              <div className="flex items-center justify-center gap-1 md:justify-end">
                <ProfileShareButton
                  lang={lang}
                  title={displayNameForLang(profile.name, lang)}
                  path={publicPath}
                />
                <BrandSaveInfluencerButton
                  variant="quiet"
                  lang={lang}
                  saved={isBrand && shortlistSaved}
                  busy={shortlistBusy}
                  onToggle={async () => {
                    if (!isBrand) {
                      setShowRegistrationRequiredModal(true);
                      return;
                    }
                    setShortlistBusy(true);
                    try {
                      if (shortlistSaved) {
                        await removeBrandShortlist(String(id));
                        setShortlistSaved(false);
                      } else {
                        await addBrandShortlist(String(id));
                        setShortlistSaved(true);
                      }
                    } catch {
                      alert(lang === "el" ? "Δεν αποθηκεύτηκε. Δοκιμάστε ξανά." : "Could not save. Try again.");
                    } finally {
                      setShortlistBusy(false);
                    }
                  }}
                />
              </div>
              {showCampaignInviteButton({
                sessionChecked,
                hasSession,
                isBrand,
                isAdmin,
              }) ? (
                <CampaignInviteButton
                  lang={lang}
                  isBrand={isBrand}
                  isAdmin={isAdmin}
                  brandId={brandId}
                  influencerId={String(id)}
                  creatorName={displayNameForLang(profile.name, lang)}
                  gender={profile.gender}
                  onNeedBrand={() => setBrandGateOpen(true)}
                />
              ) : null}
            </div>
          </div>
          
          {/* Statistics Section */}
          <div className="border-t border-slate-100 bg-[#f7f8fa] px-5 py-6 md:px-8">
            <h2 className="mb-4 text-lg font-bold text-slate-900">{txt.tab_aud}</h2>
            {(() => {
              const followers = profile.followers || {};
              const engagementRates =
                typeof profile.engagement_rate === "object" &&
                profile.engagement_rate !== null &&
                !Array.isArray(profile.engagement_rate)
                  ? (profile.engagement_rate as { [key: string]: string })
                  : {};
              const avgLikesMap =
                typeof profile.avg_likes === "object" &&
                profile.avg_likes !== null &&
                !Array.isArray(profile.avg_likes)
                  ? (profile.avg_likes as { [key: string]: string })
                  : {};
              const platforms = [
                { key: "instagram", icon: InstagramIcon, color: "text-pink-600", name: "Instagram" },
                { key: "tiktok", icon: TiktokIcon, color: "text-slate-900", name: "TikTok" },
                { key: "youtube", icon: YoutubeIcon, color: "text-red-600", name: "YouTube" },
                { key: "twitter", icon: TwitterIcon, color: "text-slate-700", name: "X" },
              ];
              const availablePlatforms = platforms.filter(
                (platform) => followers[platform.key as keyof typeof followers]
              );
              const platformLabel = (platform: (typeof platforms)[number]) => {
                const Icon = platform.icon;
                return (
                  <>
                    <span className={platform.color}>
                      <Icon />
                    </span>
                    <span className="truncate text-xs font-medium text-slate-600">{platform.name}</span>
                  </>
                );
              };
              const hasReviews =
                !!profile.total_reviews &&
                profile.total_reviews > 0 &&
                !!profile.avg_rating &&
                profile.avg_rating > 0;
              const availability =
                !profile.availability_status || profile.availability_status === "available"
                  ? "available"
                  : "unavailable";
              const availabilityLabel =
                availability === "available"
                  ? txt.availability_available
                  : txt.availability_unavailable;
              const availabilityTone =
                availability === "available"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-amber-50 text-amber-700 ring-amber-200";
              const availabilityDot =
                availability === "available" ? "bg-emerald-500" : "bg-amber-500";

              const platformRow = (
                key: string,
                left: ReactNode,
                right: ReactNode
              ) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 last:border-0 last:pb-0 first:pt-0"
                >
                  <span className="flex min-w-0 items-center gap-1.5">{left}</span>
                  <span className="shrink-0">{right}</span>
                </div>
              );

              const avgViewsForCpm = averageAvgViews(profile.accounts);
              const pricedFloor = lowestListedPrice({
                service_packages: profile.service_packages,
                rate_card: profile.rate_card,
                min_rate: profile.min_rate,
                accounts: profile.accounts,
              });
              const cpmValue = estimateCpm(
                pricedFloor ?? profile.min_rate ?? profile.from_price,
                avgViewsForCpm
              );
              const minChargeLabel = pricedFloor
                ? formatEuro(pricedFloor, lang)
                : formatEuroAmount(profile.from_price, lang);
              const statsUpdatedLabel = statsUpdatedAt
                ? formatStatsUpdatedAt(statsUpdatedAt, lang)
                : "";

              return (
                <>
                <div className="grid grid-cols-2 gap-3 items-stretch sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {availablePlatforms.some((p) => {
                    const er = engagementRates[p.key];
                    return er && er !== "-";
                  }) ? (
                  <ProfileStatCard
                    label={lang === "el" ? "Αλληλεπίδραση" : "Engagement"}
                    tip={txt.tip_engagement}
                    tipAria={txt.tip_aria}
                    icon={
                      <MetricIcon className="bg-blue-50 text-blue-600 ring-blue-100">
                        <path d="M3 3v18h18" />
                        <path d="M7 14l4-4 3 3 5-6" />
                      </MetricIcon>
                    }
                  >
                      <div className="w-full">
                        {availablePlatforms.map((platform) => {
                          let engagementRate = engagementRates[platform.key] || "-";
                          if (engagementRate === "-") return null;
                          if (!engagementRate.includes("%")) {
                            engagementRate = engagementRate + "%";
                          }
                          const acc = (profile.accounts || []).find(
                            (a) => String(a.platform || "").toLowerCase() === platform.key
                          );
                          const erFlag = displayErFlag({
                            ...acc,
                            platform: acc?.platform || platform.key,
                            engagement_rate: engagementRate,
                          });
                          return platformRow(
                            platform.key,
                            <>
                              {platformLabel(platform)}
                              {erFlag && (
                                <span
                                  title={erFlagHint(erFlag, lang === "el" ? "el" : "en")}
                                  className="truncate rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200/80"
                                >
                                  {erFlagLabel(erFlag, lang === "el" ? "el" : "en")}
                                </span>
                              )}
                            </>,
                            <span
                              className={`text-[15px] font-semibold tabular-nums tracking-tight ${
                                erFlag ? "text-amber-700" : "text-slate-900"
                              }`}
                            >
                              {engagementRate}
                            </span>
                          );
                        })}
                      </div>
                  </ProfileStatCard>
                  ) : null}

                  {availablePlatforms.length > 0 ? (
                  <ProfileStatCard
                    label={lang === "el" ? "Ακόλουθοι" : "Followers"}
                    tip={txt.tip_followers}
                    tipAria={txt.tip_aria}
                    icon={
                      <MetricIcon className="bg-sky-50 text-sky-700 ring-sky-100">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </MetricIcon>
                    }
                  >
                      <div className="w-full">
                        {availablePlatforms.map((platform) => {
                          const count =
                            followers[platform.key as keyof typeof followers] || 0;
                          return platformRow(
                            platform.key,
                            platformLabel(platform),
                            <span className="text-[15px] font-semibold tabular-nums tracking-tight text-slate-900">
                              {formatNum(count)}
                            </span>
                          );
                        })}
                      </div>
                  </ProfileStatCard>
                  ) : null}

                  {availablePlatforms.some((p) => {
                    const v = avgLikesMap[p.key];
                    return v && v !== "-";
                  }) ? (
                  <ProfileStatCard
                    label={lang === "el" ? "Μ.Ο. Likes" : "Avg Likes"}
                    tip={txt.tip_likes}
                    tipAria={txt.tip_aria}
                    icon={
                      <MetricIcon className="bg-rose-50 text-rose-500 ring-rose-100">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </MetricIcon>
                    }
                  >
                      <div className="w-full">
                        {availablePlatforms.map((platform) => {
                          const avgLikesValue = avgLikesMap[platform.key] || "-";
                          if (avgLikesValue === "-") return null;
                          return platformRow(
                            platform.key,
                            platformLabel(platform),
                            <span className="text-[15px] font-semibold tabular-nums tracking-tight text-slate-900">
                              {avgLikesValue}
                            </span>
                          );
                        })}
                      </div>
                  </ProfileStatCard>
                  ) : null}

                  {growth30d != null ? (
                  <ProfileStatCard
                    label={txt.stat_growth_30d}
                    tip={txt.tip_growth}
                    tipAria={txt.tip_aria}
                    valueCentered
                    icon={
                      <MetricIcon
                        className={
                          growth30d.growth < 0
                            ? "bg-rose-50 text-rose-600 ring-rose-100"
                            : "bg-emerald-50 text-emerald-600 ring-emerald-100"
                        }
                      >
                        <path d="M16 7h5v5" />
                        <path d="M21 7l-8.5 8.5-4-4L3 17" />
                      </MetricIcon>
                    }
                  >
                      <div>
                        <p
                          className={`text-xl font-semibold tracking-tight tabular-nums ${
                            growth30d.growth >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {growth30d.growth >= 0 ? "+" : ""}
                          {formatNum(growth30d.growth)}
                        </p>
                        {growth30d.growthPct != null && (
                          <p
                            className={`mt-0.5 text-xs font-medium tabular-nums ${
                              growth30d.growthPct >= 0 ? "text-emerald-600/80" : "text-rose-600/80"
                            }`}
                          >
                            {growth30d.growthPct >= 0 ? "+" : ""}
                            {growth30d.growthPct}%
                          </p>
                        )}
                      </div>
                  </ProfileStatCard>
                  ) : null}

                  {(profile.past_brands?.length || 0) > 0 ? (
                    <ProfileStatCard
                      label={txt.collabs}
                      tip={txt.tip_collabs}
                      tipAria={txt.tip_aria}
                      valueCentered
                      icon={
                        <MetricIcon className="bg-indigo-50 text-indigo-600 ring-indigo-100">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </MetricIcon>
                      }
                    >
                      <p className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                        {profile.past_brands?.length || 0}
                      </p>
                    </ProfileStatCard>
                  ) : (
                    <ProfileStatCard
                      label={txt.platforms}
                      tip={txt.tip_platforms}
                      tipAria={txt.tip_aria}
                      valueCentered
                      icon={
                        <MetricIcon className="bg-slate-100 text-slate-600 ring-slate-200/80">
                          <rect x="5" y="2" width="14" height="20" rx="2" />
                          <path d="M12 18h.01" />
                        </MetricIcon>
                      }
                    >
                      <p className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                        {Object.keys(profile.socials || {}).length || 0}
                      </p>
                    </ProfileStatCard>
                  )}

                  <ProfileStatCard
                    label={lang === "el" ? "Κατάσταση" : "Status"}
                    tip={txt.tip_status}
                    tipAria={txt.tip_aria}
                    valueCentered
                    icon={
                      <MetricIcon className="bg-slate-100 text-slate-600 ring-slate-200/80">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4" />
                        <path d="M8 2v4" />
                        <path d="M3 10h18" />
                      </MetricIcon>
                    }
                  >
                    <span
                      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${availabilityTone}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${availabilityDot}`} />
                      {availabilityLabel}
                    </span>
                  </ProfileStatCard>

                  {profile.avg_response_time != null && profile.avg_response_time > 0 ? (
                  <ProfileStatCard
                    label={txt.stat_response}
                    tip={txt.tip_response}
                    tipAria={txt.tip_aria}
                    valueCentered
                    icon={
                      <MetricIcon className="bg-teal-50 text-teal-600 ring-teal-100">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </MetricIcon>
                    }
                  >
                      <p className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                        {profile.avg_response_time}
                        <span className="ml-0.5 text-base font-medium text-slate-500">h</span>
                      </p>
                  </ProfileStatCard>
                  ) : null}

                  {profile.calculatedCompletionRate !== undefined ? (
                  <ProfileStatCard
                    label={txt.stat_completion}
                    tip={txt.tip_completion}
                    tipAria={txt.tip_aria}
                    valueCentered
                    icon={
                      <MetricIcon className="bg-emerald-50 text-emerald-600 ring-emerald-100">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <path d="M22 4L12 14.01l-3-3" />
                      </MetricIcon>
                    }
                  >
                      <p className="text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
                        {profile.calculatedCompletionRate}%
                      </p>
                  </ProfileStatCard>
                  ) : null}

                  {(minChargeLabel || profile.has_min_rate || profile.min_rate) && (
                    <ProfileStatCard
                      label={txt.min_rate}
                      tip={txt.tip_min_rate}
                      tipAria={txt.tip_aria}
                      accent
                      icon={
                        <MetricIcon className="bg-blue-100 text-blue-700 ring-blue-200/70">
                          <path d="M12 1v22" />
                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </MetricIcon>
                      }
                    >
                      <div>
                        <p className="text-2xl font-semibold tracking-tight text-blue-700 tabular-nums">
                          {minChargeLabel || "—"}
                        </p>
                        <p className="mt-0.5 text-xs text-blue-600/80">{txt.min_rate_desc}</p>
                      </div>
                    </ProfileStatCard>
                  )}

                  {cpmValue != null && (
                    <ProfileStatCard
                      label={txt.cpm}
                      tip={txt.tip_cpm}
                      tipAria={txt.tip_aria}
                      accent
                      icon={
                        <MetricIcon className="bg-violet-100 text-violet-700 ring-violet-200/70">
                          <path d="M12 1v22" />
                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                          <path d="M3 12h3" />
                          <path d="M18 12h3" />
                        </MetricIcon>
                      }
                    >
                      <div>
                        <p className="text-2xl font-semibold tracking-tight text-violet-700 tabular-nums">
                          {formatCpmEuro(cpmValue, lang)}
                        </p>
                        <p className="mt-0.5 text-xs text-violet-700/80">{txt.cpm_desc}</p>
                      </div>
                    </ProfileStatCard>
                  )}

                  {hasReviews ? (
                  <ProfileStatCard
                    label={txt.stat_rating}
                    tip={txt.tip_rating}
                    tipAria={txt.tip_aria}
                    valueCentered
                    icon={
                      <MetricIcon className="bg-amber-50 text-amber-600 ring-amber-100">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </MetricIcon>
                    }
                  >
                      <div>
                        <p className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                          {profile.avg_rating!.toFixed(1)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {profile.total_reviews} {txt.stat_reviews}
                        </p>
                      </div>
                  </ProfileStatCard>
                  ) : null}
                </div>
                {statsUpdatedLabel ? (
                  <p className="mt-3 text-xs text-slate-500">
                    {txt.stats_updated}: {statsUpdatedLabel}
                  </p>
                ) : null}
                </>
              );
            })()}
          </div>
        </div>

        {/* TABS — mobile: horizontal scroll + snap + right fade */}
        <div className="relative mt-8 border-b border-slate-200 min-w-0">
            <nav
              ref={profileTabsNavRef}
              className="flex gap-6 overflow-x-auto snap-x snap-mandatory sm:gap-8 sm:overflow-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {(
                  [
                    { id: "overview", label: txt.tab_over },
                    { id: "audience", label: txt.tab_aud },
                    { id: "pricing", label: txt.tab_price },
                    {
                      id: "reviews",
                      label: `${txt.tab_reviews}${profile.total_reviews ? ` (${profile.total_reviews})` : ""}`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    data-profile-tab={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex min-h-[44px] shrink-0 snap-start items-center pb-1 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap sm:min-h-0 sm:pb-4 ${
                      activeTab === tab.id
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-700 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
            </nav>
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent sm:hidden"
              aria-hidden
            />
        </div>

        {/* CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8 min-w-0">
            {activeTab === "audience" && (
              <div className="lg:col-span-3 space-y-8 min-w-0">
                <ChannelScorePanel
                  lang={lang}
                  {...scoreChannelFromProfile(profile, growth30d?.growthPct ?? null)}
                />
                <FollowerGrowthChart lang={lang} points={growthSeries} />
                <StatsInsightsPanel
                  lang={lang}
                  influencerId={String(id)}
                  followers={profile.followers || {}}
                  engagementRate={profile.engagement_rate}
                  avgLikes={profile.avg_likes}
                  accounts={profile.accounts}
                />
                <TopPosts accounts={profile.accounts} lang={lang} />
              </div>
            )}
            <div className="lg:col-span-2 space-y-8 min-w-0">
                {activeTab === "overview" && (
                    <>
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                            <h2 className="text-xl font-bold text-slate-900 mb-4">{txt.about}</h2>
                            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                                {lang === 'en' && profile.bio_en ? profile.bio_en : (profile.bio || txt.no_bio)}
                            </p>
                        </div>
                        {profile.auditpr_audit && Array.isArray(profile.auditpr_audit.scoreBreakdown) && profile.auditpr_audit.scoreBreakdown.length > 0 && (
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex flex-wrap items-center gap-3 mb-4">
                                    <h2 className="text-xl font-bold text-slate-900">{txt.audit_title}</h2>
                                    {(() => {
                                      const hasSuspiciousEr = creatorHasHardErOnMainAccount(profile.accounts);
                                      if (hasSuspiciousEr) {
                                        return (
                                          <span
                                            title={txt.audit_er_caution_hint}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200"
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
                                            {txt.audit_er_caution}
                                          </span>
                                        );
                                      }
                                      if (profile.auditpr_audit.brandSafe) {
                                        return (
                                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
                                            {txt.audit_brand_safe}
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                    {localizeCategoryText(
                                      lang === "en"
                                        ? (profile.auditpr_audit.niche_en ?? profile.auditpr_audit.niche)
                                        : profile.auditpr_audit.niche,
                                      lang
                                    ) && (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                            {localizeCategoryText(
                                              lang === "en"
                                                ? (profile.auditpr_audit.niche_en ?? profile.auditpr_audit.niche)
                                                : profile.auditpr_audit.niche,
                                              lang
                                            )}
                                        </span>
                                    )}
                                </div>
                                {lang === 'en' && (() => {
                                  const audit = profile.auditpr_audit;
                                  const hasEnBreakdown = Array.isArray(audit.scoreBreakdown_en) && audit.scoreBreakdown_en.length > 0;
                                  const hasEnWhy = !!(audit.whyWorkWithThem_en && String(audit.whyWorkWithThem_en).trim());
                                  const hasEnPos = Array.isArray(audit.positives_en) && audit.positives_en.filter(Boolean).length > 0;
                                  const hasEnNeg = Array.isArray(audit.negatives_en) && audit.negatives_en.filter(Boolean).length > 0;
                                  const hasElOnly =
                                    !hasEnBreakdown &&
                                    !hasEnWhy &&
                                    !hasEnPos &&
                                    !hasEnNeg &&
                                    ((Array.isArray(audit.scoreBreakdown) && audit.scoreBreakdown.length > 0) ||
                                      !!(audit.whyWorkWithThem && String(audit.whyWorkWithThem).trim()) ||
                                      (Array.isArray(audit.positives) && audit.positives.filter(Boolean).length > 0) ||
                                      (Array.isArray(audit.negatives) && audit.negatives.filter(Boolean).length > 0));
                                  return hasElOnly ? (
                                    <p className="mb-3 text-xs text-slate-500 italic">Available in Greek</p>
                                  ) : null;
                                })()}
                                <ul className="space-y-2 text-slate-600 text-sm leading-relaxed list-none">
                                    {(lang === 'en' && profile.auditpr_audit.scoreBreakdown_en?.length ? profile.auditpr_audit.scoreBreakdown_en : profile.auditpr_audit.scoreBreakdown).map((item, idx) => (
                                        <li key={idx} className="flex gap-2">
                                            <span className="text-indigo-500 mt-0.5 shrink-0">•</span>
                                            <span>{localizeCategoryText(item, lang)}</span>
                                        </li>
                                    ))}
                                    {(lang === 'en' ? profile.auditpr_audit.whyWorkWithThem_en : profile.auditpr_audit.whyWorkWithThem) && (
                                        <li className="flex gap-2">
                                            <span className="text-indigo-500 mt-0.5 shrink-0">•</span>
                                            <span>
                                                <strong>{lang === 'el'
                                                  ? (normalizeGender(profile.gender) === 'Female'
                                                    ? txt.why_work_with_them_female
                                                    : normalizeGender(profile.gender) === 'Male'
                                                      ? txt.why_work_with_them_male
                                                      : txt.why_work_with_them_ai)
                                                  : txt.why_work_with_them}</strong>
                                                {localizeCategoryText(
                                                  lang === 'en'
                                                    ? (profile.auditpr_audit.whyWorkWithThem_en ?? profile.auditpr_audit.whyWorkWithThem)
                                                    : profile.auditpr_audit.whyWorkWithThem,
                                                  lang
                                                )}
                                            </span>
                                        </li>
                                    )}
                                </ul>
                                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-800 mb-2">{txt.positives}</h3>
                                            {((lang === 'en' ? profile.auditpr_audit.positives_en : profile.auditpr_audit.positives) ?? []).filter(Boolean).length ? (
                                            <ul className="space-y-1.5 text-slate-600 text-sm leading-relaxed list-none">
                                                {(lang === 'en' ? profile.auditpr_audit.positives_en : profile.auditpr_audit.positives)?.map((item, idx) => (
                                                    <li key={idx} className="flex gap-2">
                                                        <span className="text-emerald-500 shrink-0">+</span>
                                                        <span>{localizeCategoryText(item, lang)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            ) : (
                                              <p className="text-sm text-slate-500">{txt.positives_none}</p>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-800 mb-2">{txt.negatives}</h3>
                                            {((lang === 'en' ? profile.auditpr_audit.negatives_en : profile.auditpr_audit.negatives) ?? []).filter(Boolean).length ? (
                                            <ul className="space-y-1.5 text-slate-600 text-sm leading-relaxed list-none">
                                                {(lang === 'en' ? profile.auditpr_audit.negatives_en : profile.auditpr_audit.negatives)?.map((item, idx) => (
                                                    <li key={idx} className="flex gap-2">
                                                        <span className="text-amber-500 shrink-0">−</span>
                                                        <span>{localizeCategoryText(item, lang)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            ) : (
                                              <p className="text-sm text-slate-500">{txt.negatives_none}</p>
                                            )}
                                        </div>
                                    </div>
                            </div>
                        )}
                         {(() => {
                              const portfolioItems = (profile.videos || [])
                                .map((vid) => String(vid || "").trim())
                                .filter((vid) => {
                                  if (!vid) return false;
                                  // Legacy Facebook links are not embeddable — hide without DB change.
                                  if (isFacebookVideoUrl(vid)) return false;
                                  if (isDefinitelyImage(vid)) return true;
                                  if (isEmbeddableVideoUrl(vid)) return true;
                                  // Skip profile/channel/stories links that are not embeddable videos.
                                  return !detectProvider(vid);
                                });
                              if (!portfolioItems.length) return null;
                              return (
                                <div>
                                  <h3 className="text-lg font-bold text-slate-900 mb-4">{txt.portfolio}</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {portfolioItems.map((vid, i) => {
                                        const isVideo = isDefinitelyVideo(vid);
                                        const isImage = isDefinitelyImage(vid);
                                        // For Instagram posts (p/), we can't be sure if it's video or photo, so don't show play button
                                        const isInstagramPost = /instagram\.com\/(?:[A-Za-z0-9._]+\/)?p\//i.test(vid);
                                        const isTikTokPhoto = /tiktok\.com\/[^?\s]*\/photo\/\d+/i.test(vid);

                                        // Component to load image and adapt container to natural dimensions
                                        const AdaptiveImage = ({ imageUrl, alt }: { imageUrl: string; alt: string }) => {
                                            const [imgSrc, setImgSrc] = useState<string | null>(null);
                                            const [error, setError] = useState(false);
                                            const refreshUsedRef = useRef(false);

                                            useEffect(() => {
                                                refreshUsedRef.current = false;
                                                if (isDefinitelyImage(imageUrl)) {
                                                    setImgSrc(imageUrl);
                                                    return;
                                                }

                                                const fetchThumbnail = async () => {
                                                    try {
                                                        const thumbnail = getVideoThumbnail(imageUrl);
                                                        if (thumbnail && !thumbnail.startsWith('/api/')) {
                                                            setImgSrc(thumbnail);
                                                        } else {
                                                            const apiUrl = `/api/video-thumbnail?url=${encodeURIComponent(imageUrl)}`;
                                                            const response = await fetch(apiUrl);
                                                            const data = await response.json();
                                                            if (data.thumbnail) {
                                                                setImgSrc(data.thumbnail);
                                                            } else {
                                                                setError(true);
                                                            }
                                                        }
                                                    } catch (err) {
                                                        console.error('Error fetching thumbnail:', err);
                                                        setError(true);
                                                    }
                                                };

                                                fetchThumbnail();
                                            }, [imageUrl]);

                                            const onImgError = () => {
                                                if (!refreshUsedRef.current && imageUrl) {
                                                    refreshUsedRef.current = true;
                                                    void (async () => {
                                                        try {
                                                            const res = await fetch(
                                                                `/api/video-thumbnail?url=${encodeURIComponent(imageUrl)}&refresh=1`
                                                            );
                                                            const data = await res.json();
                                                            if (data.thumbnail) {
                                                                setImgSrc(String(data.thumbnail));
                                                                return;
                                                            }
                                                        } catch {
                                                            /* gradient via VideoThumbnail */
                                                        }
                                                        setError(true);
                                                    })();
                                                    return;
                                                }
                                                setError(true);
                                            };

                                            if (error || !imgSrc) {
                                                return (
                                                    <div className="relative w-full flex items-center justify-center p-4 min-h-[200px]">
                                                        <VideoThumbnail
                                                            url={imageUrl}
                                                            alt={alt}
                                                            fill={false}
                                                            width={800}
                                                            height={600}
                                                            className="!relative !w-auto !h-auto max-w-full max-h-[500px] object-contain"
                                                        />
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="w-full flex items-center justify-center p-4">
                                                    <img
                                                        src={imgSrc}
                                                        alt={alt}
                                                        className="max-w-full max-h-[600px] w-auto h-auto object-contain rounded"
                                                        loading="lazy"
                                                        referrerPolicy="no-referrer"
                                                        style={{ display: 'block' }}
                                                        onError={onImgError}
                                                    />
                                                </div>
                                            );
                                        };

                                        const provider = detectProvider(vid);
                                        const embedUrl = provider ? getVideoEmbedApiUrl(vid) : null;

                                        if (provider && embedUrl && !isImage) {
                                            return (
                                                <div key={vid} className="w-full">
                                                    <SocialEmbedCard
                                                        provider={provider}
                                                        originalUrl={vid}
                                                        embedUrl={embedUrl}
                                                        lang={lang}
                                                    />
                                                </div>
                                            );
                                        }

                                        return (
                                            <a
                                                key={vid}
                                                href={vid}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`group relative rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow bg-slate-100 ${
                                                    isImage
                                                        ? 'flex flex-col items-center justify-center w-full'
                                                        : 'w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.67rem)] aspect-square'
                                                }`}
                                            >
                                                {isImage ? (
                                                    <AdaptiveImage imageUrl={vid} alt={`Portfolio item ${i + 1}`} />
                                                ) : (
                                                    <VideoThumbnail
                                                        url={vid}
                                                        alt={`Portfolio item ${i + 1}`}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                )}
                                                {isVideo && !isInstagramPost && !isTikTokPhoto && (
                                                    <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors pointer-events-none z-10">
                                                        <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                                            <span className="text-sm text-slate-900 ml-0.5">▶</span>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="absolute bottom-0 left-0 right-0 w-full p-3 bg-gradient-to-t from-black/80 to-transparent text-white text-sm font-medium pointer-events-none z-10">
                                                    {isTikTokPhoto || (isImage && !isVideo)
                                                      ? `Photo ${i + 1}`
                                                      : isVideo
                                                        ? `Video ${i + 1}`
                                                        : isInstagramPost
                                                          ? `Instagram Post ${i + 1}`
                                                          : `Highlight ${i + 1}`}
                                                </div>
                                            </a>
                                        );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                    </>
                )}
                {activeTab === "audience" && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                        <h2 className="text-xl font-bold text-slate-900 mb-6">{txt.aud_gen}</h2>
                        
                        {/* Gender Chart using CSS */}
                        {profile.audience_data?.female != null || profile.audience_data?.male != null ? (
                        <div className="mb-8">
                            <div className="flex justify-between mb-2 font-medium text-slate-700">
                                <span>{txt.female} ({profile.audience_data?.female ?? "—"}%)</span>
                                <span>{txt.male} ({profile.audience_data?.male ?? "—"}%)</span>
                            </div>
                            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                <div style={{ width: `${profile.audience_data?.female ?? 0}%` }} className="bg-pink-400 h-full"></div>
                                <div style={{ width: `${profile.audience_data?.male ?? 0}%` }} className="bg-blue-400 h-full"></div>
                            </div>
                        </div>
                        ) : null}

                        {/* Age Group */}
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="bg-white p-3 rounded-full shadow-sm text-2xl">🎯</div>
                            <div>
                                <p className="text-slate-500 text-sm">{txt.aud_age}</p>
                                <p className="text-xl font-bold text-slate-900">{profile.audience_data?.top_age}</p>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === "pricing" && (
                     <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-slate-100">
                        <h2 className="text-xl font-bold text-slate-900 mb-1">
                          {lang === "el" ? "Πακέτα" : "Packages"}
                        </h2>
                        <p className="text-sm text-slate-500 mb-4">
                          {lang === "el"
                            ? "Διάλεξε πακέτο ή πρότεινε το δικό σου"
                            : "Choose a package or propose your own"}
                        </p>

                        <ProfileOffersPanel
                          packages={Array.isArray(profile.service_packages) ? profile.service_packages : []}
                          extras={Array.isArray(profile.service_extras) ? profile.service_extras : []}
                          lang={lang}
                          creatorName={displayNameForLang(profile.name, lang)}
                          gender={profile.gender}
                          isBrand={isBrand}
                          influencerId={String(id)}
                          onNeedBrand={() => setBrandGateOpen(true)}
                          onContinue={startCollaboration}
                        />

                        <p className="mt-6 text-xs text-slate-400 text-center">{txt.price_note}</p>
                     </div>
                )}
                
                {activeTab === "reviews" && (
                  <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-slate-100 min-w-0 overflow-hidden">
                    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <h2 className="text-xl font-bold text-slate-900 break-words">{txt.reviews_title}</h2>
                        <p className="text-sm text-slate-500 mt-1 break-words">{txt.reviews_subtitle}</p>
                      </div>
                      <button 
                        onClick={() => setShowReviewModal(true)}
                        className="inline-flex w-full min-h-[44px] items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm sm:w-auto sm:shrink-0"
                      >
                        + {txt.reviews_add}
                      </button>
                    </div>
                    
                    {reviews.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <p className="text-lg">{txt.reviews_empty}</p>
                      </div>
                    ) : (
                      <div className="space-y-4 sm:space-y-6 min-w-0">
                        {reviews.map((review: any) => (
                          <div key={review.id} className="min-w-0 border border-slate-200 rounded-xl p-4 sm:p-6 hover:shadow-md transition-shadow overflow-hidden">
                            <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-slate-900 truncate">
                                  {review.brand_name || (lang === "el" ? "Επιχείρηση" : "Brand")}
                                </h4>
                                <p className="text-xs text-slate-500 truncate">
                                  {new Date(review.created_at).toLocaleDateString(lang === "el" ? "el-GR" : "en-GB")}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-0.5 whitespace-nowrap" aria-label={`${review.rating}/5`}>
                                {[...Array(5)].map((_, i) => (
                                  <span key={i} className={`text-lg sm:text-xl ${i < review.rating ? 'text-amber-400' : 'text-slate-300'}`}>★</span>
                                ))}
                              </div>
                            </div>
                            {review.project_type && (
                              <span className="inline-block max-w-full truncate bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded mb-3">
                                {review.project_type}
                              </span>
                            )}
                            {review.review_text && (
                              <p className="text-slate-700 leading-relaxed break-words">{review.review_text}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
            </div>
            <div className="flex flex-col gap-6">
                 {showHireBar ? (
                   <div className="sticky top-24 z-30 hidden lg:block">
                     <ProfileHireCard variant="desktop" {...hireCardProps} />
                   </div>
                 ) : null}
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase">{txt.connect}</h3>
                    <div className="space-y-3">
                         {Object.entries(profile.socials)
                            .filter(([plat]) => plat.toLowerCase() !== 'facebook')
                            .map(([plat, user]) => {
                            const u = (user || '').trim();
                            const platKey = plat.toLowerCase();
                            let href: string;
                            if (platKey === 'youtube') {
                              const ytAcc = (profile.accounts || []).find(
                                (a: { platform?: string }) =>
                                  String(a?.platform || '').toLowerCase() === 'youtube'
                              );
                              href =
                                youtubeChannelUrl(ytAcc || { username: u }) ||
                                `https://www.youtube.com/@${u.replace(/^@+/, '')}`;
                            } else if (platKey === 'tiktok') {
                              href = `https://tiktok.com/${u.startsWith('@') ? u : `@${u}`}`;
                            } else {
                              href = `https://${plat}.com/${u}`;
                            }
                            return (
                            <a
                              key={plat}
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition border border-transparent hover:border-slate-200 group"
                              onClick={() => {
                                trackOutboundSocialClick(id, String(plat));
                              }}
                            >
                                <span className="capitalize font-medium text-slate-700">{plat}</span>
                                <span className="text-slate-400 group-hover:text-blue-600">↗</span>
                            </a>
                        ); })}
                    </div>
                 </div>
                 {/* Συνεργασίες - μόνο αν υπάρχει τουλάχιστον μία */}
                 {profile.past_brands && profile.past_brands.length > 0 && (
                   <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                     <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase">{txt.collabs}</h3>
                     <div className="flex flex-wrap gap-2">
                       {profile.past_brands.map((b, i) => <span key={i} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">{b}</span>)}
                     </div>
                   </div>
                 )}
            </div>
        </div>
      </div>
      
      {/* Counter Proposal Modal */}
      {showCounterProposalModal && counterProposal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">💰 Αντιπρόταση</h2>
              <p className="text-slate-600">
                Ο/Η <strong>{displayNameForLang(profile?.name, lang)}</strong> σας έστειλε μια αντιπρόταση για τη συνεργασία:
              </p>
            </div>
            
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 mb-6">
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-semibold text-slate-600">Υπηρεσία:</span>
                  <p className="text-lg font-bold text-slate-900">{counterProposal.service_type}</p>
                </div>
                <div className="flex items-center justify-between border-t border-amber-300 pt-3">
                  <div>
                    <span className="text-sm text-slate-600">Προσφερόμενη Τιμή:</span>
                    <p className="text-lg text-slate-500 line-through">{formatEuroAmount(counterProposal.budget, lang)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-amber-700">Αντιπρόταση:</span>
                    <p className="text-2xl font-extrabold text-amber-600">{formatEuroAmount(counterProposal.counter_proposal_budget, lang)}</p>
                  </div>
                </div>
                {counterProposal.counter_proposal_message && (
                  <div className="border-t border-amber-300 pt-3">
                    <span className="text-sm font-semibold text-slate-600">Σχόλιο:</span>
                    <p className="text-slate-700 mt-1 whitespace-pre-wrap">{counterProposal.counter_proposal_message}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleAcceptCounterProposal(counterProposal.id)}
                disabled={processingAction}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                {processingAction ? 'Επεξεργασία...' : '✅ Αποδοχή Αντιπρότασης'}
              </button>
              <button
                onClick={() => handleRejectCounterProposal(counterProposal.id)}
                disabled={processingAction}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                {processingAction ? 'Επεξεργασία...' : '❌ Απόρριψη Αντιπρότασης'}
              </button>
              <button
                onClick={() => {
                  setMessageBrandEmail(counterProposal.brand_email);
                  setMessageBrandName(counterProposal.brand_name);
                  setShowCounterProposalModal(false);
                  setShowMessageModal(true);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                💬 Στείλε Μήνυμα
              </button>
            </div>
            
            <button
              onClick={() => {
                setShowCounterProposalModal(false);
                router.push(publicPath);
              }}
              className="mt-4 w-full text-slate-900 font-bold hover:text-slate-700 py-2"
            >
              Κλείσιμο
            </button>
          </div>
        </div>
      )}

      <SimilarInfluencers
        influencerId={String(id)}
        displayName={profile.name || ""}
        categories={profile.categories || []}
        platforms={Object.keys(profile.socials || {})}
        lang={lang}
      />
      {showHireBar ? <ProfileHireCard variant="bar" {...hireCardProps} /> : null}
    </div>
  );
}