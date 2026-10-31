"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  Briefcase,
  Calculator,
  FileText,
  FolderKanban,
  LineChart,
  Link2,
  MessageSquare,
  MessagesSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/SiteHeader";
import InfluencerSignupForm from "@/components/InfluencerSignupForm";
import BrandSignupForm from "@/components/BrandSignupForm";
import FeatureGrid from "@/components/marketing/FeatureGrid";
import HowSteps from "@/components/marketing/HowSteps";
import MarketingClosing from "@/components/marketing/MarketingClosing";
import MarketingSection from "@/components/marketing/MarketingSection";
import StatsStrip from "@/components/marketing/StatsStrip";
import { bi, resolveCopy, type Bilingual } from "@/lib/bilingual";
import {
  localizeFeatures,
  localizeSteps,
  type BiFeature,
  type BiStep,
} from "@/lib/localizeMarketingItems";
import {
  marketingStatItems,
  type PlatformMarketingStats,
} from "@/lib/loadPlatformMarketingStats";
import {
  MARKETING_SHARED,
  PLATFORM_STAT_LABELS,
} from "@/lib/marketingSharedCopy";
import { openCampaignsLabel } from "@/lib/pluralize";
import { useAuthLoggedIn } from "@/lib/useAuthLoggedIn";
import { useMarketingLang } from "@/lib/useMarketingLang";

const UI = {
  cta_primary: { el: "Εγγραφή ως Brand", en: "Sign up as Brand" },
  headline: {
    el: "Βρείτε τους σωστούς influencers για το brand σας.",
    en: "Find the right influencers for your brand.",
  },
  hero_desc: {
    el: "Αναζήτηση, AI προτάσεις, καμπάνιες με αιτήσεις και έγκριση deliverables — όλα σε μία πλατφόρμα.",
    en: "Search, AI recommendations, campaign applications, and deliverable approval — in one platform.",
  },
  analytics_title: { el: "Analytics που εμπιστεύεστε", en: "Analytics you can trust" },
  analytics_desc: {
    el: "Τα στατιστικά ενημερώνονται αυτόματα από τα social.",
    en: "Stats refresh automatically from social platforms.",
  },
  tools_title: { el: "Εργαλεία για την ομάδα σας", en: "Tools for your team" },
  tools_desc: {
    el: "Όλα όσα χρειάζεστε για shortlist, brief και μέτρηση αποτελεσμάτων.",
    en: "Everything you need for shortlists, briefs, and results tracking.",
  },
  features_title: {
    el: "Ό,τι χρειάζεται το brand σας",
    en: "Everything your brand needs",
  },
  features_desc: {
    el: "Από την εύρεση μέχρι την παράδοση, χωρίς να αλλάζετε εργαλεία.",
    en: "From discovery to delivery without switching tools.",
  },
  campaign_title: { el: "Καμπάνιες με αιτήσεις", en: "Campaigns with applications" },
  campaign_desc: {
    el: "Ανεβάστε τίτλο, περιγραφή και budget — δωρεάν, χωρίς προμήθεια. Οι εγκεκριμένοι influencers κάνουν αίτηση ενδιαφέροντος· εσείς διαχειρίζεστε τις αιτήσεις.",
    en: "Publish title, description, and budget — free, no commission. Approved influencers apply; you manage applications.",
  },
  campaign_cta: { el: "Δημιουργία καμπάνιας", en: "Create a campaign" },
  campaign_cta_guest: { el: "Εγγραφή για καμπάνιες", en: "Sign up for campaigns" },
  ai_badge: { el: "Περιλαμβάνεται", en: "Included" },
  ai_title: { el: "AI προτάσεις", en: "AI recommendations" },
  ai_desc: {
    el: "Το σύστημα προτείνει influencers με match scores βάσει κατηγορίας, engagement και προφίλ brand — χωρίς επιπλέον κόστος.",
    en: "Get influencer suggestions with match scores based on category, engagement, and your brand profile — at no extra cost.",
  },
  ai_cta: { el: "Ξεκινήστε", en: "Get started" },
  how_desc: {
    el: "Από την εγγραφή στην παράδοση σε τέσσερα βήματα.",
    en: "From signup to delivery in four steps.",
  },
  trust_1: { el: "Δωρεάν, χωρίς προμήθεια", en: "Free, no commission" },
  trust_2: { el: "Επαληθευμένα προφίλ", en: "Verified profiles" },
  trust_3: { el: "Πραγματικά δεδομένα από τα social", en: "Real data from social" },
  cta_desc: {
    el: "Δημιουργήστε λογαριασμό brand και ανοίξτε τον κατάλογο.",
    en: "Create a brand account and open the directory.",
  },
  signup_influencer: { el: "Είμαι Influencer", en: "I'm an Influencer" },
  signup_brand: { el: "Έχω Επιχείρηση", en: "I have a Business" },
  close: { el: "Κλείσιμο", en: "Close" },
} as const satisfies Record<string, Bilingual>;

const ANALYTICS: BiFeature[] = [
  {
    icon: ShieldCheck,
    title: { el: "Ποιότητα κοινού & ύποπτοι followers", en: "Audience quality & suspicious followers" },
    desc: {
      el: "Δείτε ενδείξεις ποιότητας κοινού και ύποπτων followers πριν συνεργαστείτε.",
      en: "See audience-quality signals and suspicious-follower flags before you collaborate.",
    },
  },
  {
    icon: BarChart3,
    title: { el: "Πραγματικό engagement ανά πλατφόρμα", en: "Real engagement by platform" },
    desc: {
      el: "Engagement rate και μέσοι likes ανά Instagram, TikTok και YouTube.",
      en: "Engagement rate and average likes across Instagram, TikTok, and YouTube.",
    },
  },
  {
    icon: TrendingUp,
    title: { el: "Ανάπτυξη 15 ημερών", en: "15-day growth" },
    desc: {
      el: "Παρακολουθήστε την πρόσφατη ανάπτυξη followers στο προφίλ.",
      en: "Track recent follower growth on the profile.",
    },
  },
  {
    icon: Calculator,
    title: { el: "Εκτιμώμενο CPM", en: "Estimated CPM" },
    desc: {
      el: "Εκτίμηση κόστους ανά χίλιες εμφανίσεις για καλύτερο budgeting.",
      en: "Estimate cost per thousand impressions for clearer budgeting.",
    },
  },
  {
    icon: Target,
    title: { el: "Κορυφαία posts", en: "Top posts" },
    desc: {
      el: "Δείτε τα top posts του creator απευθείας στο προφίλ.",
      en: "Browse a creator’s top posts directly on the profile.",
    },
  },
  {
    icon: Sparkles,
    title: { el: "Στρατηγική αξιολόγηση & Brand Safe", en: "Strategic review & Brand Safe" },
    desc: {
      el: "Αξιολόγηση συνεργασίας και brand-safe σήματα πριν την πρόταση.",
      en: "Collaboration review and brand-safe signals before you send an offer.",
    },
  },
  {
    icon: Users,
    title: { el: "Δημογραφικά κοινού", en: "Audience demographics" },
    desc: {
      el: "Φύλο και ηλικιακές ομάδες κοινού όπου είναι διαθέσιμα.",
      en: "Gender and age groups when available.",
    },
  },
];

const TOOLS: BiFeature[] = [
  {
    icon: LineChart,
    title: { el: "Σύγκριση creators", en: "Compare creators" },
    desc: {
      el: "Συγκρίνετε influencers δίπλα-δίπλα πριν αποφασίσετε.",
      en: "Compare influencers side by side before you decide.",
    },
  },
  {
    icon: Wallet,
    title: { el: "Budget estimator", en: "Budget estimator" },
    desc: {
      el: "Υπολογίστε εύρος budget για τη συνεργασία σας.",
      en: "Estimate a budget range for your collaboration.",
    },
  },
  {
    icon: FileText,
    title: { el: "Export shortlist", en: "Export shortlist" },
    desc: {
      el: "Εξαγωγή shortlist σε CSV ή PDF για την ομάδα σας.",
      en: "Export your shortlist as CSV or PDF for the team.",
    },
  },
  {
    icon: Briefcase,
    title: { el: "Campaign brief", en: "Campaign brief" },
    desc: {
      el: "Οργανώστε brief καμπάνιας με ξεκάθαρα deliverables.",
      en: "Organize a campaign brief with clear deliverables.",
    },
  },
  {
    icon: Link2,
    title: { el: "UTM builder", en: "UTM builder" },
    desc: {
      el: "Φτιάξτε UTM links για σωστό tracking.",
      en: "Build UTM links for proper tracking.",
    },
  },
  {
    icon: BarChart3,
    title: { el: "ROI / αποτελέσματα", en: "ROI / results" },
    desc: {
      el: "Καταγράψτε αποτελέσματα και ROI ανά συνεργασία.",
      en: "Log results and ROI per collaboration.",
    },
  },
  {
    icon: FolderKanban,
    title: { el: "Brand kit", en: "Brand kit" },
    desc: {
      el: "Μοιραστείτε στοιχεία brand με creators εύκολα.",
      en: "Share brand assets with creators easily.",
    },
  },
  {
    icon: MessagesSquare,
    title: { el: "Έτοιμα μηνύματα", en: "Message snippets" },
    desc: {
      el: "Snippets για γρήγορη επικοινωνία με influencers.",
      en: "Ready-made snippets for faster outreach.",
    },
  },
];

const FEATURES: BiFeature[] = [
  {
    icon: Search,
    title: { el: "Αναζήτηση & φίλτρα", en: "Search & filters" },
    desc: {
      el: "Κατηγορία, engagement, budget και διαθεσιμότητα — βρείτε creators που ταιριάζουν.",
      en: "Category, engagement, budget, and availability — find matching creators.",
    },
  },
  {
    icon: FolderKanban,
    title: { el: "Διαχείριση συνεργασιών", en: "Collaboration hub" },
    desc: {
      el: "Προσφορές, συνομιλίες και καμπάνιες από ένα dashboard.",
      en: "Offers, conversations, and campaigns from one dashboard.",
    },
  },
  {
    icon: MessageSquare,
    title: { el: "Μηνύματα & αρχεία", en: "Messages & files" },
    desc: {
      el: "Άμεση συνομιλία με creators και αποστολή attachments.",
      en: "Chat with creators and send attachments.",
    },
  },
  {
    icon: Wallet,
    title: { el: "Rate cards", en: "Rate cards" },
    desc: {
      el: "Δείτε τιμές ανά format πριν στείλετε πρόταση.",
      en: "See pricing by format before you send a proposal.",
    },
  },
  {
    icon: FileText,
    title: { el: "Deliverables", en: "Deliverables" },
    desc: {
      el: "Οι creators υποβάλλουν URL· εσείς εγκρίνετε ή ζητάτε αλλαγές.",
      en: "Creators submit a URL; you approve or request changes.",
    },
  },
];

const STEPS: BiStep[] = [
  {
    title: { el: "Εγγραφή brand", en: "Brand signup" },
    desc: {
      el: "Λογαριασμός επιχείρησης και πρόσβαση στον κατάλογο.",
      en: "Company account and directory access.",
    },
  },
  {
    title: { el: "Αναζήτηση ή AI", en: "Search or AI" },
    desc: {
      el: "Φίλτρα καταλόγου ή αυτόματες προτάσεις με match score.",
      en: "Directory filters or automatic suggestions with match scores.",
    },
  },
  {
    title: { el: "Πρόταση ή καμπάνια", en: "Proposal or campaign" },
    desc: {
      el: "Στείλτε προσφορά ή δημοσιεύστε καμπάνια για αιτήσεις.",
      en: "Send an offer or publish a campaign for applications.",
    },
  },
  {
    title: { el: "Έγκριση & κλείσιμο", en: "Approve & close" },
    desc: {
      el: "Μηνύματα, deliverables και ολοκλήρωση συνεργασίας.",
      en: "Messages, deliverables, and completed collaboration.",
    },
  },
];

type Props = Readonly<{ stats: PlatformMarketingStats }>;

export default function ForBrandsPage({ stats }: Props) {
  const [lang, setLang] = useMarketingLang();
  const txt = resolveCopy(lang, UI);
  const [showModal, setShowModal] = useState(false);
  const [signupType, setSignupType] = useState<"influencer" | "brand">("brand");
  const isLoggedIn = useAuthLoggedIn();

  const openBrandModal = () => {
    setSignupType("brand");
    setShowModal(true);
  };

  const directoryHref = lang === "en" ? "/en/directory" : "/directory";
  const statItems = marketingStatItems(stats, {
    influencers: bi(lang, PLATFORM_STAT_LABELS.influencers),
    brands: bi(lang, PLATFORM_STAT_LABELS.brands),
    campaigns: openCampaignsLabel(stats.openCampaigns ?? 0, lang),
  });

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader lang={lang} onLangChange={setLang} />

      <section className="relative border-b border-slate-100">
        <div className="absolute inset-0 bg-slate-950">
          <Image
            src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1600&q=80"
            alt=""
            fill
            className="object-cover opacity-40"
            priority
            sizes="100vw"
          />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <p className="mb-3 text-sm font-semibold tracking-wide text-blue-300">
            {MARKETING_SHARED.brand}
          </p>
          <h1 className="mb-4 max-w-2xl text-4xl font-bold tracking-tight text-white md:text-5xl">
            {txt.headline}
          </h1>
          <p className="mb-8 max-w-xl text-lg leading-relaxed text-slate-200">{txt.hero_desc}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={openBrandModal}
              className="inline-flex justify-center rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
            >
              {txt.cta_primary}
            </button>
            <Link
              href={directoryHref}
              className="inline-flex justify-center rounded-lg border border-white/20 bg-white/10 px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-white/15"
            >
              {bi(lang, MARKETING_SHARED.directory)}
            </Link>
          </div>
        </div>
      </section>

      <StatsStrip items={statItems} />

      <MarketingSection tone="slate">
        <FeatureGrid
          title={txt.analytics_title}
          description={txt.analytics_desc}
          columns={3}
          items={localizeFeatures(lang, ANALYTICS)}
        />
      </MarketingSection>

      <MarketingSection tone="white">
        <FeatureGrid
          title={txt.tools_title}
          description={txt.tools_desc}
          columns={4}
          items={localizeFeatures(lang, TOOLS)}
        />
      </MarketingSection>

      <MarketingSection tone="slate">
        <FeatureGrid
          title={txt.features_title}
          description={txt.features_desc}
          columns={3}
          items={localizeFeatures(lang, FEATURES)}
        />
      </MarketingSection>

      <MarketingSection tone="white">
        <div className="grid gap-6 lg:grid-cols-2">
          <CampaignCard
            title={txt.campaign_title}
            desc={txt.campaign_desc}
            action={
              isLoggedIn ? (
                <Link
                  href="/dashboard?tab=campaigns"
                  className="inline-flex rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  {txt.campaign_cta}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={openBrandModal}
                  className="inline-flex rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  {txt.campaign_cta_guest}
                </button>
              )
            }
          />
          <article className="rounded-xl border border-slate-200/90 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Sparkles className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </div>
              <span className="rounded border border-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {txt.ai_badge}
              </span>
            </div>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-slate-900">{txt.ai_title}</h2>
            <p className="mb-6 leading-relaxed text-slate-600">{txt.ai_desc}</p>
            <button
              type="button"
              onClick={openBrandModal}
              className="inline-flex rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
            >
              {txt.ai_cta}
            </button>
          </article>
        </div>
      </MarketingSection>

      <MarketingSection tone="slate">
        <HowSteps
          title={bi(lang, MARKETING_SHARED.howTitle)}
          description={txt.how_desc}
          steps={localizeSteps(lang, STEPS)}
        />
      </MarketingSection>

      <MarketingClosing
        trustTitle={bi(lang, MARKETING_SHARED.trustTitle)}
        trustItems={[txt.trust_1, txt.trust_2, txt.trust_3]}
        ctaTitle={bi(lang, MARKETING_SHARED.ctaTitle)}
        ctaDesc={txt.cta_desc}
        ctaAction={
          <button
            type="button"
            onClick={openBrandModal}
            className="inline-flex rounded-lg bg-blue-600 px-8 py-3.5 font-semibold text-white transition-colors hover:bg-blue-700"
          >
            {txt.cta_primary}
          </button>
        }
      />

      <Footer lang={lang} />

      {showModal ? (
        <dialog
          open
          className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center bg-transparent p-4"
          aria-label={txt.cta_primary}
          onCancel={(e) => {
            e.preventDefault();
            setShowModal(false);
          }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            aria-label={txt.close}
            onClick={() => setShowModal(false)}
          />
          <div className="relative z-10 w-full max-w-5xl">
            <div className="mb-4 flex gap-2 rounded-lg bg-slate-800 p-1.5">
              <button
                type="button"
                onClick={() => setSignupType("influencer")}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  signupType === "influencer"
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {txt.signup_influencer}
              </button>
              <button
                type="button"
                onClick={() => setSignupType("brand")}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  signupType === "brand"
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {txt.signup_brand}
              </button>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label={txt.close}
                className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              >
                <span aria-hidden>×</span>
              </button>
              {signupType === "influencer" ? <InfluencerSignupForm /> : <BrandSignupForm embedded />}
            </div>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}

function CampaignCard({
  title,
  desc,
  action,
}: Readonly<{ title: string; desc: string; action: ReactNode }>) {
  return (
    <article className="rounded-xl border border-slate-200/90 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        <Briefcase className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </div>
      <h2 className="mb-3 text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
      <p className="mb-6 max-w-lg leading-relaxed text-slate-600">{desc}</p>
      {action}
    </article>
  );
}
