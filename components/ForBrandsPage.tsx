"use client";

import { useState } from "react";
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
import MarketingSection from "@/components/marketing/MarketingSection";
import SectionHeading from "@/components/marketing/SectionHeading";
import StatsStrip from "@/components/marketing/StatsStrip";
import TrustStrip from "@/components/marketing/TrustStrip";
import { resolveCopy, type Bilingual } from "@/lib/bilingual";
import {
  marketingStatItems,
  type PlatformMarketingStats,
} from "@/lib/loadPlatformMarketingStats";
import { useAuthLoggedIn } from "@/lib/useAuthLoggedIn";
import { useMarketingLang } from "@/lib/useMarketingLang";

const COPY = {
  title: { el: "Influo", en: "Influo" },
  headline: {
    el: "Βρείτε τους σωστούς influencers για το brand σας.",
    en: "Find the right influencers for your brand.",
  },
  hero_desc: {
    el: "Αναζήτηση, AI προτάσεις, καμπάνιες με αιτήσεις και έγκριση deliverables — όλα σε μία πλατφόρμα.",
    en: "Search, AI recommendations, campaign applications, and deliverable approval — in one platform.",
  },
  cta_primary: { el: "Εγγραφή ως Brand", en: "Sign up as Brand" },
  cta_secondary: { el: "Κατάλογος", en: "Directory" },
  stat_influencers: { el: "εγκεκριμένοι influencers", en: "approved influencers" },
  stat_brands: { el: "verified brands", en: "verified brands" },
  stat_campaigns: { el: "ανοιχτές καμπάνιες", en: "open campaigns" },
  analytics_title: { el: "Analytics που εμπιστεύεστε", en: "Analytics you can trust" },
  analytics_desc: {
    el: "Τα στατιστικά ενημερώνονται αυτόματα από τα social.",
    en: "Stats refresh automatically from social platforms.",
  },
  an_1_title: {
    el: "Ποιότητα κοινού & ύποπτοι followers",
    en: "Audience quality & suspicious followers",
  },
  an_1_desc: {
    el: "Δείτε ενδείξεις ποιότητας κοινού και ύποπτων followers πριν συνεργαστείτε.",
    en: "See audience-quality signals and suspicious-follower flags before you collaborate.",
  },
  an_2_title: {
    el: "Πραγματικό engagement ανά πλατφόρμα",
    en: "Real engagement by platform",
  },
  an_2_desc: {
    el: "Engagement rate και μέσοι likes ανά Instagram, TikTok και YouTube.",
    en: "Engagement rate and average likes across Instagram, TikTok, and YouTube.",
  },
  an_3_title: { el: "Ανάπτυξη 15 ημερών", en: "15-day growth" },
  an_3_desc: {
    el: "Παρακολουθήστε την πρόσφατη ανάπτυξη followers στο προφίλ.",
    en: "Track recent follower growth on the profile.",
  },
  an_4_title: { el: "Εκτιμώμενο CPM", en: "Estimated CPM" },
  an_4_desc: {
    el: "Εκτίμηση κόστους ανά χίλιες εμφανίσεις για καλύτερο budgeting.",
    en: "Estimate cost per thousand impressions for clearer budgeting.",
  },
  an_5_title: { el: "Κορυφαία posts", en: "Top posts" },
  an_5_desc: {
    el: "Δείτε τα top posts του creator απευθείας στο προφίλ.",
    en: "Browse a creator’s top posts directly on the profile.",
  },
  an_6_title: {
    el: "Στρατηγική αξιολόγηση & Brand Safe",
    en: "Strategic review & Brand Safe",
  },
  an_6_desc: {
    el: "Αξιολόγηση συνεργασίας και brand-safe σήματα πριν την πρόταση.",
    en: "Collaboration review and brand-safe signals before you send an offer.",
  },
  an_7_title: { el: "Δημογραφικά κοινού", en: "Audience demographics" },
  an_7_desc: {
    el: "Φύλο και ηλικιακές ομάδες κοινού όπου είναι διαθέσιμα.",
    en: "Gender and age groups when available.",
  },
  tools_title: { el: "Εργαλεία για την ομάδα σας", en: "Tools for your team" },
  tools_desc: {
    el: "Όλα όσα χρειάζεστε για shortlist, brief και μέτρηση αποτελεσμάτων.",
    en: "Everything you need for shortlists, briefs, and results tracking.",
  },
  tool_1_title: { el: "Σύγκριση creators", en: "Compare creators" },
  tool_1_desc: {
    el: "Συγκρίνετε influencers δίπλα-δίπλα πριν αποφασίσετε.",
    en: "Compare influencers side by side before you decide.",
  },
  tool_2_title: { el: "Budget estimator", en: "Budget estimator" },
  tool_2_desc: {
    el: "Υπολογίστε εύρος budget για τη συνεργασία σας.",
    en: "Estimate a budget range for your collaboration.",
  },
  tool_3_title: { el: "Export shortlist", en: "Export shortlist" },
  tool_3_desc: {
    el: "Εξαγωγή shortlist σε CSV ή PDF για την ομάδα σας.",
    en: "Export your shortlist as CSV or PDF for the team.",
  },
  tool_4_title: { el: "Campaign brief", en: "Campaign brief" },
  tool_4_desc: {
    el: "Οργανώστε brief καμπάνιας με ξεκάθαρα deliverables.",
    en: "Organize a campaign brief with clear deliverables.",
  },
  tool_5_title: { el: "UTM builder", en: "UTM builder" },
  tool_5_desc: {
    el: "Φτιάξτε UTM links για σωστό tracking.",
    en: "Build UTM links for proper tracking.",
  },
  tool_6_title: { el: "ROI / αποτελέσματα", en: "ROI / results" },
  tool_6_desc: {
    el: "Καταγράψτε αποτελέσματα και ROI ανά συνεργασία.",
    en: "Log results and ROI per collaboration.",
  },
  tool_7_title: { el: "Brand kit", en: "Brand kit" },
  tool_7_desc: {
    el: "Μοιραστείτε στοιχεία brand με creators εύκολα.",
    en: "Share brand assets with creators easily.",
  },
  tool_8_title: { el: "Έτοιμα μηνύματα", en: "Message snippets" },
  tool_8_desc: {
    el: "Snippets για γρήγορη επικοινωνία με influencers.",
    en: "Ready-made snippets for faster outreach.",
  },
  features_title: {
    el: "Ό,τι χρειάζεται το brand σας",
    en: "Everything your brand needs",
  },
  features_desc: {
    el: "Από την εύρεση μέχρι την παράδοση, χωρίς να αλλάζετε εργαλεία.",
    en: "From discovery to delivery without switching tools.",
  },
  feat_1_title: { el: "Αναζήτηση & φίλτρα", en: "Search & filters" },
  feat_1_desc: {
    el: "Κατηγορία, engagement, budget και διαθεσιμότητα — βρείτε creators που ταιριάζουν.",
    en: "Category, engagement, budget, and availability — find matching creators.",
  },
  feat_2_title: { el: "Διαχείριση συνεργασιών", en: "Collaboration hub" },
  feat_2_desc: {
    el: "Προσφορές, συνομιλίες και καμπάνιες από ένα dashboard.",
    en: "Offers, conversations, and campaigns from one dashboard.",
  },
  feat_3_title: { el: "Μηνύματα & αρχεία", en: "Messages & files" },
  feat_3_desc: {
    el: "Άμεση συνομιλία με creators και αποστολή attachments.",
    en: "Chat with creators and send attachments.",
  },
  feat_4_title: { el: "Rate cards", en: "Rate cards" },
  feat_4_desc: {
    el: "Δείτε τιμές ανά format πριν στείλετε πρόταση.",
    en: "See pricing by format before you send a proposal.",
  },
  feat_5_title: { el: "Deliverables", en: "Deliverables" },
  feat_5_desc: {
    el: "Οι creators υποβάλλουν URL· εσείς εγκρίνετε ή ζητάτε αλλαγές.",
    en: "Creators submit a URL; you approve or request changes.",
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
  how_title: { el: "Πώς λειτουργεί", en: "How it works" },
  how_desc: {
    el: "Από την εγγραφή στην παράδοση σε τέσσερα βήματα.",
    en: "From signup to delivery in four steps.",
  },
  step_1_title: { el: "Εγγραφή brand", en: "Brand signup" },
  step_1_desc: {
    el: "Λογαριασμός επιχείρησης και πρόσβαση στον κατάλογο.",
    en: "Company account and directory access.",
  },
  step_2_title: { el: "Αναζήτηση ή AI", en: "Search or AI" },
  step_2_desc: {
    el: "Φίλτρα καταλόγου ή αυτόματες προτάσεις με match score.",
    en: "Directory filters or automatic suggestions with match scores.",
  },
  step_3_title: { el: "Πρόταση ή καμπάνια", en: "Proposal or campaign" },
  step_3_desc: {
    el: "Στείλτε προσφορά ή δημοσιεύστε καμπάνια για αιτήσεις.",
    en: "Send an offer or publish a campaign for applications.",
  },
  step_4_title: { el: "Έγκριση & κλείσιμο", en: "Approve & close" },
  step_4_desc: {
    el: "Μηνύματα, deliverables και ολοκλήρωση συνεργασίας.",
    en: "Messages, deliverables, and completed collaboration.",
  },
  trust_title: { el: "Γιατί Influo", en: "Why Influo" },
  trust_1: { el: "Δωρεάν, χωρίς προμήθεια", en: "Free, no commission" },
  trust_2: { el: "Επαληθευμένα προφίλ", en: "Verified profiles" },
  trust_3: { el: "Πραγματικά δεδομένα από τα social", en: "Real data from social" },
  cta_section_title: { el: "Ξεκινήστε σήμερα", en: "Start today" },
  cta_section_desc: {
    el: "Δημιουργήστε λογαριασμό brand και ανοίξτε τον κατάλογο.",
    en: "Create a brand account and open the directory.",
  },
  cta_button: { el: "Εγγραφή ως Brand", en: "Sign up as Brand" },
  signup_influencer: { el: "Είμαι Influencer", en: "I'm an Influencer" },
  signup_brand: { el: "Έχω Επιχείρηση", en: "I have a Business" },
  close: { el: "Κλείσιμο", en: "Close" },
} as const satisfies Record<string, Bilingual>;

type Props = Readonly<{ stats: PlatformMarketingStats }>;

export default function ForBrandsPage({ stats }: Props) {
  const [lang, setLang] = useMarketingLang();
  const txt = resolveCopy(lang, COPY);
  const [showModal, setShowModal] = useState(false);
  const [signupType, setSignupType] = useState<"influencer" | "brand">("brand");
  const isLoggedIn = useAuthLoggedIn();

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
          <p className="mb-3 text-sm font-semibold tracking-wide text-blue-300">{txt.title}</p>
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

      {showModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={txt.cta_primary}
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
        </div>
      ) : null}
    </div>
  );
}
