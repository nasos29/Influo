"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import MarketingSection from "@/components/marketing/MarketingSection";
import SectionHeading from "@/components/marketing/SectionHeading";
import StatsStrip from "@/components/marketing/StatsStrip";
import TrustStrip from "@/components/marketing/TrustStrip";
import { getStoredLanguage } from "@/lib/language";
import {
  marketingStatItems,
  type PlatformMarketingStats,
} from "@/lib/loadPlatformMarketingStats";
import { useAuthLoggedIn } from "@/lib/useAuthLoggedIn";

type Lang = "el" | "en";

const t = {
  el: {
    title: "Influo",
    headline: "Βρείτε τους σωστούς influencers για το brand σας.",
    hero_desc:
      "Αναζήτηση, AI προτάσεις, καμπάνιες με αιτήσεις και έγκριση deliverables — όλα σε μία πλατφόρμα.",
    cta_primary: "Εγγραφή ως Brand",
    cta_secondary: "Κατάλογος",
    stat_influencers: "εγκεκριμένοι influencers",
    stat_brands: "verified brands",
    stat_campaigns: "ανοιχτές καμπάνιες",
    analytics_title: "Analytics που εμπιστεύεστε",
    analytics_desc: "Τα στατιστικά ενημερώνονται αυτόματα από τα social.",
    an_1_title: "Ποιότητα κοινού & ύποπτοι followers",
    an_1_desc: "Δείτε ενδείξεις ποιότητας κοινού και ύποπτων followers πριν συνεργαστείτε.",
    an_2_title: "Πραγματικό engagement ανά πλατφόρμα",
    an_2_desc: "Engagement rate και μέσοι likes ανά Instagram, TikTok και YouTube.",
    an_3_title: "Ανάπτυξη 15 ημερών",
    an_3_desc: "Παρακολουθήστε την πρόσφατη ανάπτυξη followers στο προφίλ.",
    an_4_title: "Εκτιμώμενο CPM",
    an_4_desc: "Εκτίμηση κόστους ανά χίλιες εμφανίσεις για καλύτερο budgeting.",
    an_5_title: "Κορυφαία posts",
    an_5_desc: "Δείτε τα top posts του creator απευθείας στο προφίλ.",
    an_6_title: "Στρατηγική αξιολόγηση & Brand Safe",
    an_6_desc: "Αξιολόγηση συνεργασίας και brand-safe σήματα πριν την πρόταση.",
    an_7_title: "Δημογραφικά κοινού",
    an_7_desc: "Φύλο και ηλικιακές ομάδες κοινού όπου είναι διαθέσιμα.",
    tools_title: "Εργαλεία για την ομάδα σας",
    tools_desc: "Όλα όσα χρειάζεστε για shortlist, brief και μέτρηση αποτελεσμάτων.",
    tool_1_title: "Σύγκριση creators",
    tool_1_desc: "Συγκρίνετε influencers δίπλα-δίπλα πριν αποφασίσετε.",
    tool_2_title: "Budget estimator",
    tool_2_desc: "Υπολογίστε εύρος budget για τη συνεργασία σας.",
    tool_3_title: "Export shortlist",
    tool_3_desc: "Εξαγωγή shortlist σε CSV ή PDF για την ομάδα σας.",
    tool_4_title: "Campaign brief",
    tool_4_desc: "Οργανώστε brief καμπάνιας με ξεκάθαρα deliverables.",
    tool_5_title: "UTM builder",
    tool_5_desc: "Φτιάξτε UTM links για σωστό tracking.",
    tool_6_title: "ROI / αποτελέσματα",
    tool_6_desc: "Καταγράψτε αποτελέσματα και ROI ανά συνεργασία.",
    tool_7_title: "Brand kit",
    tool_7_desc: "Μοιραστείτε στοιχεία brand με creators εύκολα.",
    tool_8_title: "Έτοιμα μηνύματα",
    tool_8_desc: "Snippets για γρήγορη επικοινωνία με influencers.",
    features_title: "Ό,τι χρειάζεται το brand σας",
    features_desc: "Από την εύρεση μέχρι την παράδοση, χωρίς να αλλάζετε εργαλεία.",
    feat_1_title: "Αναζήτηση & φίλτρα",
    feat_1_desc: "Κατηγορία, engagement, budget και διαθεσιμότητα — βρείτε creators που ταιριάζουν.",
    feat_2_title: "Διαχείριση συνεργασιών",
    feat_2_desc: "Προσφορές, συνομιλίες και καμπάνιες από ένα dashboard.",
    feat_3_title: "Μηνύματα & αρχεία",
    feat_3_desc: "Άμεση συνομιλία με creators και αποστολή attachments.",
    feat_4_title: "Rate cards",
    feat_4_desc: "Δείτε τιμές ανά format πριν στείλετε πρόταση.",
    feat_5_title: "Deliverables",
    feat_5_desc: "Οι creators υποβάλλουν URL· εσείς εγκρίνετε ή ζητάτε αλλαγές.",
    campaign_title: "Καμπάνιες με αιτήσεις",
    campaign_desc:
      "Ανεβάστε τίτλο, περιγραφή και budget — δωρεάν, χωρίς προμήθεια. Οι εγκεκριμένοι influencers κάνουν αίτηση ενδιαφέροντος· εσείς διαχειρίζεστε τις αιτήσεις.",
    campaign_cta: "Δημιουργία καμπάνιας",
    campaign_cta_guest: "Εγγραφή για καμπάνιες",
    ai_badge: "Περιλαμβάνεται",
    ai_title: "AI προτάσεις",
    ai_desc:
      "Το σύστημα προτείνει influencers με match scores βάσει κατηγορίας, engagement και προφίλ brand — χωρίς επιπλέον κόστος.",
    ai_cta: "Ξεκινήστε",
    how_title: "Πώς λειτουργεί",
    how_desc: "Από την εγγραφή στην παράδοση σε τέσσερα βήματα.",
    step_1_title: "Εγγραφή brand",
    step_1_desc: "Λογαριασμός επιχείρησης και πρόσβαση στον κατάλογο.",
    step_2_title: "Αναζήτηση ή AI",
    step_2_desc: "Φίλτρα καταλόγου ή αυτόματες προτάσεις με match score.",
    step_3_title: "Πρόταση ή καμπάνια",
    step_3_desc: "Στείλτε προσφορά ή δημοσιεύστε καμπάνια για αιτήσεις.",
    step_4_title: "Έγκριση & κλείσιμο",
    step_4_desc: "Μηνύματα, deliverables και ολοκλήρωση συνεργασίας.",
    trust_title: "Γιατί Influo",
    trust_1: "Δωρεάν, χωρίς προμήθεια",
    trust_2: "Επαληθευμένα προφίλ",
    trust_3: "Πραγματικά δεδομένα από τα social",
    cta_section_title: "Ξεκινήστε σήμερα",
    cta_section_desc: "Δημιουργήστε λογαριασμό brand και ανοίξτε τον κατάλογο.",
    cta_button: "Εγγραφή ως Brand",
    signup_influencer: "Είμαι Influencer",
    signup_brand: "Έχω Επιχείρηση",
    close: "Κλείσιμο",
  },
  en: {
    title: "Influo",
    headline: "Find the right influencers for your brand.",
    hero_desc:
      "Search, AI recommendations, campaign applications, and deliverable approval — in one platform.",
    cta_primary: "Sign up as Brand",
    cta_secondary: "Directory",
    stat_influencers: "approved influencers",
    stat_brands: "verified brands",
    stat_campaigns: "open campaigns",
    analytics_title: "Analytics you can trust",
    analytics_desc: "Stats refresh automatically from social platforms.",
    an_1_title: "Audience quality & suspicious followers",
    an_1_desc: "See audience-quality signals and suspicious-follower flags before you collaborate.",
    an_2_title: "Real engagement by platform",
    an_2_desc: "Engagement rate and average likes across Instagram, TikTok, and YouTube.",
    an_3_title: "15-day growth",
    an_3_desc: "Track recent follower growth on the profile.",
    an_4_title: "Estimated CPM",
    an_4_desc: "Estimate cost per thousand impressions for clearer budgeting.",
    an_5_title: "Top posts",
    an_5_desc: "Browse a creator’s top posts directly on the profile.",
    an_6_title: "Strategic review & Brand Safe",
    an_6_desc: "Collaboration review and brand-safe signals before you send an offer.",
    an_7_title: "Audience demographics",
    an_7_desc: "Gender and age groups when available.",
    tools_title: "Tools for your team",
    tools_desc: "Everything you need for shortlists, briefs, and results tracking.",
    tool_1_title: "Compare creators",
    tool_1_desc: "Compare influencers side by side before you decide.",
    tool_2_title: "Budget estimator",
    tool_2_desc: "Estimate a budget range for your collaboration.",
    tool_3_title: "Export shortlist",
    tool_3_desc: "Export your shortlist as CSV or PDF for the team.",
    tool_4_title: "Campaign brief",
    tool_4_desc: "Organize a campaign brief with clear deliverables.",
    tool_5_title: "UTM builder",
    tool_5_desc: "Build UTM links for proper tracking.",
    tool_6_title: "ROI / results",
    tool_6_desc: "Log results and ROI per collaboration.",
    tool_7_title: "Brand kit",
    tool_7_desc: "Share brand assets with creators easily.",
    tool_8_title: "Message snippets",
    tool_8_desc: "Ready-made snippets for faster outreach.",
    features_title: "Everything your brand needs",
    features_desc: "From discovery to delivery without switching tools.",
    feat_1_title: "Search & filters",
    feat_1_desc: "Category, engagement, budget, and availability — find matching creators.",
    feat_2_title: "Collaboration hub",
    feat_2_desc: "Offers, conversations, and campaigns from one dashboard.",
    feat_3_title: "Messages & files",
    feat_3_desc: "Chat with creators and send attachments.",
    feat_4_title: "Rate cards",
    feat_4_desc: "See pricing by format before you send a proposal.",
    feat_5_title: "Deliverables",
    feat_5_desc: "Creators submit a URL; you approve or request changes.",
    campaign_title: "Campaigns with applications",
    campaign_desc:
      "Publish title, description, and budget — free, no commission. Approved influencers apply; you manage applications.",
    campaign_cta: "Create a campaign",
    campaign_cta_guest: "Sign up for campaigns",
    ai_badge: "Included",
    ai_title: "AI recommendations",
    ai_desc:
      "Get influencer suggestions with match scores based on category, engagement, and your brand profile — at no extra cost.",
    ai_cta: "Get started",
    how_title: "How it works",
    how_desc: "From signup to delivery in four steps.",
    step_1_title: "Brand signup",
    step_1_desc: "Company account and directory access.",
    step_2_title: "Search or AI",
    step_2_desc: "Directory filters or automatic suggestions with match scores.",
    step_3_title: "Proposal or campaign",
    step_3_desc: "Send an offer or publish a campaign for applications.",
    step_4_title: "Approve & close",
    step_4_desc: "Messages, deliverables, and completed collaboration.",
    trust_title: "Why Influo",
    trust_1: "Free, no commission",
    trust_2: "Verified profiles",
    trust_3: "Real data from social",
    cta_section_title: "Start today",
    cta_section_desc: "Create a brand account and open the directory.",
    cta_button: "Sign up as Brand",
    signup_influencer: "I'm an Influencer",
    signup_brand: "I have a Business",
    close: "Close",
  },
};

export default function ForBrandsPage({
  stats,
}: {
  stats: PlatformMarketingStats;
}) {
  const pathname = usePathname();
  const [lang, setLang] = useState<Lang>(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  const txt = t[lang];
  const [showModal, setShowModal] = useState(false);
  const [signupType, setSignupType] = useState<"influencer" | "brand">("brand");
  const isLoggedIn = useAuthLoggedIn();

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  }, [pathname]);

  const openBrandModal = () => {
    setSignupType("brand");
    setShowModal(true);
  };

  const directoryHref = lang === "en" ? "/en/directory" : "/directory";
  const statItems = marketingStatItems(stats, {
    influencers: txt.stat_influencers,
    brands: txt.stat_brands,
    campaigns: txt.stat_campaigns,
  });

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader lang={lang} onLangChange={setLang} />

      {/* Hero — keep as-is */}
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
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <p className="text-sm font-semibold tracking-wide text-blue-300 mb-3">{txt.title}</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight max-w-2xl mb-4">
            {txt.headline}
          </h1>
          <p className="text-lg text-slate-200 max-w-xl mb-8 leading-relaxed">{txt.hero_desc}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={openBrandModal}
              className="inline-flex justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              {txt.cta_primary}
            </button>
            <Link
              href={directoryHref}
              className="inline-flex justify-center px-6 py-3 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-lg border border-white/20 transition-colors text-center"
            >
              {txt.cta_secondary}
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
          items={[
            { title: txt.an_1_title, desc: txt.an_1_desc, icon: ShieldCheck },
            { title: txt.an_2_title, desc: txt.an_2_desc, icon: BarChart3 },
            { title: txt.an_3_title, desc: txt.an_3_desc, icon: TrendingUp },
            { title: txt.an_4_title, desc: txt.an_4_desc, icon: Calculator },
            { title: txt.an_5_title, desc: txt.an_5_desc, icon: Target },
            { title: txt.an_6_title, desc: txt.an_6_desc, icon: Sparkles },
            { title: txt.an_7_title, desc: txt.an_7_desc, icon: Users },
          ]}
        />
      </MarketingSection>

      <MarketingSection tone="white">
        <FeatureGrid
          title={txt.tools_title}
          description={txt.tools_desc}
          columns={4}
          items={[
            { title: txt.tool_1_title, desc: txt.tool_1_desc, icon: LineChart },
            { title: txt.tool_2_title, desc: txt.tool_2_desc, icon: Wallet },
            { title: txt.tool_3_title, desc: txt.tool_3_desc, icon: FileText },
            { title: txt.tool_4_title, desc: txt.tool_4_desc, icon: Briefcase },
            { title: txt.tool_5_title, desc: txt.tool_5_desc, icon: Link2 },
            { title: txt.tool_6_title, desc: txt.tool_6_desc, icon: BarChart3 },
            { title: txt.tool_7_title, desc: txt.tool_7_desc, icon: FolderKanban },
            { title: txt.tool_8_title, desc: txt.tool_8_desc, icon: MessagesSquare },
          ]}
        />
      </MarketingSection>

      <MarketingSection tone="slate">
        <FeatureGrid
          title={txt.features_title}
          description={txt.features_desc}
          columns={3}
          items={[
            { title: txt.feat_1_title, desc: txt.feat_1_desc, icon: Search },
            { title: txt.feat_2_title, desc: txt.feat_2_desc, icon: FolderKanban },
            { title: txt.feat_3_title, desc: txt.feat_3_desc, icon: MessageSquare },
            { title: txt.feat_4_title, desc: txt.feat_4_desc, icon: Wallet },
            { title: txt.feat_5_title, desc: txt.feat_5_desc, icon: FileText },
          ]}
        />
      </MarketingSection>

      <MarketingSection tone="white">
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-xl border border-slate-200/90 bg-white p-6 shadow-sm md:p-8">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Briefcase className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-slate-900">
              {txt.campaign_title}
            </h2>
            <p className="mb-6 max-w-lg leading-relaxed text-slate-600">{txt.campaign_desc}</p>
            {isLoggedIn ? (
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
            )}
          </article>
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
          title={txt.how_title}
          description={txt.how_desc}
          steps={[
            { title: txt.step_1_title, desc: txt.step_1_desc },
            { title: txt.step_2_title, desc: txt.step_2_desc },
            { title: txt.step_3_title, desc: txt.step_3_desc },
            { title: txt.step_4_title, desc: txt.step_4_desc },
          ]}
        />
      </MarketingSection>

      <MarketingSection tone="white">
        <SectionHeading title={txt.trust_title} />
        <TrustStrip items={[txt.trust_1, txt.trust_2, txt.trust_3]} />
      </MarketingSection>

      <section className="bg-slate-900 px-4 py-16 text-white sm:px-6 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">{txt.cta_section_title}</h2>
          <p className="mb-8 text-slate-300">{txt.cta_section_desc}</p>
          <button
            type="button"
            onClick={openBrandModal}
            className="inline-flex rounded-lg bg-blue-600 px-8 py-3.5 font-semibold text-white transition-colors hover:bg-blue-700"
          >
            {txt.cta_button}
          </button>
        </div>
      </section>

      <Footer lang={lang} />

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
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
        </div>
      )}
    </div>
  );
}
