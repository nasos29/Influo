"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BadgeCheck,
  BarChart3,
  Briefcase,
  CalendarCheck,
  FileText,
  Link2,
  MessageSquare,
  QrCode,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/SiteHeader";
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
    headline: "Το προφίλ σας. Οι συνεργασίες σας.",
    hero_desc:
      "Δημιουργήστε επαγγελματικό προφίλ, δεχτείτε προσφορές από brands και ολοκληρώστε καμπάνιες μέσα από μία πλατφόρμα.",
    cta_primary: "Ξεκινήστε δωρεάν",
    cta_secondary: "Κατάλογος",
    stat_influencers: "εγκεκριμένοι influencers",
    stat_brands: "verified brands",
    stat_campaigns: "ανοιχτές καμπάνιες",
    stats_title: "Τα στατιστικά σου, επαγγελματικά",
    stats_desc: "Ό,τι χρειάζονται τα brands για να σε εμπιστευτούν — στο προφίλ σου.",
    st_1_title: "Αυτόματη ενημέρωση από Instagram/TikTok/YouTube",
    st_1_desc: "Followers και metrics ανανεώνονται αυτόματα από τα social σου.",
    st_2_title: "Engagement & ανάπτυξη",
    st_2_desc: "Engagement rate και ανάπτυξη followers σε ξεκάθαρη μορφή.",
    st_3_title: "Κορυφαία posts",
    st_3_desc: "Προβολή των κορυφαίων posts σου στο δημόσιο προφίλ.",
    st_4_title: "Στρατηγική αξιολόγηση & Brand Safe",
    st_4_desc: "Αξιολόγηση και brand-safe σήματα που βοηθούν τα brands να σε επιλέξουν.",
    st_5_title: "Badges",
    st_5_desc: "Top Performer, Pro, Elite, VIP — αναγνώριση που χτίζει εμπιστοσύνη.",
    tools_title: "Εργαλεία για τη δουλειά σου",
    tools_desc: "Μοιράσου το προφίλ σου εύκολα και επαγγελματικά.",
    tool_1_title: "Προσωπικό link influo.gr/in/…",
    tool_1_desc: "Βάλε το στο bio των social για άμεσες προτάσεις από brands.",
    tool_2_title: "Έτοιμο κείμενο για bio",
    tool_2_desc: "Αντιγράψιμο κείμενο μαζί με το Influo link.",
    tool_3_title: "QR code (PNG)",
    tool_3_desc: "Για story, media kit ή εκδηλώσεις.",
    tool_4_title: "Media kit μίας σελίδας (PDF)",
    tool_4_desc: "Μία σελίδα με φωτο, bio, socials και link — έτοιμη για αποθήκευση ως PDF.",
    features_title: "Ό,τι χρειάζεστε ως creator",
    features_desc: "Προφίλ, καμπάνιες, μηνύματα και αξιοπιστία — σε ένα μέρος.",
    feat_1_title: "Rate card",
    feat_1_desc: "Ορίστε τιμές για story, post, reel και άλλα formats στο προφίλ σας.",
    feat_2_title: "Διαθεσιμότητα",
    feat_2_desc: "Δείξτε αν είστε διαθέσιμοι για νέες συνεργασίες — τα brands φιλτράρουν ανάλογα.",
    feat_3_title: "Μηνύματα & αρχεία",
    feat_3_desc: "Συνομιλία με brands και αποστολή attachments (briefs, media, συμβόλαια).",
    feat_4_title: "Deliverables",
    feat_4_desc: "Υποβάλετε URL παράδοσης· το brand εγκρίνει ή ζητά αλλαγές στη ροή της καμπάνιας.",
    campaign_title: "Αιτήσεις σε καμπάνιες",
    campaign_desc:
      "Επαληθευμένα brands δημοσιεύουν καμπάνιες με budget και brief. Όλοι βλέπουν τις ανοιχτές καμπάνιες στη δημόσια σελίδα Καμπάνιες (/campaigns)· αίτηση κάνουν μόνο οι εγκεκριμένοι influencers, με προτεινόμενη τιμή, links προηγούμενης δουλειάς (μόνο social) και προαιρετικό μήνυμα.",
    campaign_notify:
      "Παίρνεις ειδοποίηση για κάθε νέα καμπάνια που ταιριάζει στο προφίλ σου.",
    campaign_cta: "Άνοιγμα καμπανιών",
    campaign_cta_public: "Δες τις ανοιχτές καμπάνιες",
    campaign_cta_guest: "Εγγραφή για αιτήσεις",
    how_title: "Πώς λειτουργεί",
    how_desc: "Από την εγγραφή στην παράδοση σε τρία βήματα.",
    step_1_title: "Δημιουργήστε προφίλ",
    step_1_desc: "Εγγραφή, portfolio, rate card και διαθεσιμότητα.",
    step_2_title: "Προσφορές & αιτήσεις",
    step_2_desc: "Λάβετε προσφορές ή κάντε αίτηση σε ανοιχτές καμπάνιες.",
    step_3_title: "Παράδοση & ολοκλήρωση",
    step_3_desc: "Υποβάλετε deliverable, λάβετε έγκριση και κλείστε τη συνεργασία.",
    trust_title: "Γιατί Influo",
    trust_1: "Δωρεάν εγγραφή",
    trust_2: "Χωρίς προμήθεια",
    trust_3: "Εσύ ορίζεις τις τιμές σου",
    cta_section_title: "Ξεκινήστε σήμερα",
    cta_section_desc: "Το προφίλ σας είναι έτοιμο σε λίγα λεπτά.",
    cta_button: "Εγγραφή",
  },
  en: {
    title: "Influo",
    headline: "Your profile. Your collaborations.",
    hero_desc:
      "Build a professional profile, receive brand offers, and complete campaigns in one place.",
    cta_primary: "Start for free",
    cta_secondary: "Directory",
    stat_influencers: "approved influencers",
    stat_brands: "verified brands",
    stat_campaigns: "open campaigns",
    stats_title: "Your stats, professionally",
    stats_desc: "What brands need to trust you — on your profile.",
    st_1_title: "Auto-refresh from Instagram/TikTok/YouTube",
    st_1_desc: "Followers and metrics update automatically from your socials.",
    st_2_title: "Engagement & growth",
    st_2_desc: "Engagement rate and follower growth in a clear format.",
    st_3_title: "Top posts",
    st_3_desc: "Show your top posts on your public profile.",
    st_4_title: "Strategic review & Brand Safe",
    st_4_desc: "Review and brand-safe signals that help brands choose you.",
    st_5_title: "Badges",
    st_5_desc: "Top Performer, Pro, Elite, VIP — recognition that builds trust.",
    tools_title: "Tools for your work",
    tools_desc: "Share your profile easily and professionally.",
    tool_1_title: "Personal link influo.gr/in/…",
    tool_1_desc: "Add it to your social bio for direct brand proposals.",
    tool_2_title: "Ready bio text",
    tool_2_desc: "Copy-ready text together with your Influo link.",
    tool_3_title: "QR code (PNG)",
    tool_3_desc: "For stories, media kits, or events.",
    tool_4_title: "One-page media kit (PDF)",
    tool_4_desc: "One page with photo, bio, socials, and link — ready to save as PDF.",
    features_title: "Built for creators",
    features_desc: "Profile, campaigns, messaging, and trust signals — together.",
    feat_1_title: "Rate card",
    feat_1_desc: "Set prices for stories, posts, reels, and more on your profile.",
    feat_2_title: "Availability",
    feat_2_desc: "Show whether you are open for new work — brands can filter by status.",
    feat_3_title: "Messages & files",
    feat_3_desc: "Chat with brands and send attachments (briefs, media, contracts).",
    feat_4_title: "Deliverables",
    feat_4_desc: "Submit a delivery URL; the brand approves or requests changes in-campaign.",
    campaign_title: "Apply to campaigns",
    campaign_desc:
      "Verified brands post campaigns with budget and brief. Everyone can browse open campaigns on the public Campaigns page (/en/campaigns); only approved influencers can apply, with a proposed rate, links to past work (social only) and an optional message.",
    campaign_notify: "You get notified about every new campaign that fits your profile.",
    campaign_cta: "Open campaigns",
    campaign_cta_public: "See open campaigns",
    campaign_cta_guest: "Sign up to apply",
    how_title: "How it works",
    how_desc: "From signup to delivery in three steps.",
    step_1_title: "Create your profile",
    step_1_desc: "Sign up, add portfolio, rate card, and availability.",
    step_2_title: "Offers & applications",
    step_2_desc: "Receive offers or apply to open campaigns.",
    step_3_title: "Deliver & close",
    step_3_desc: "Submit deliverables, get approval, and finish the collaboration.",
    trust_title: "Why Influo",
    trust_1: "Free signup",
    trust_2: "No commission",
    trust_3: "You set your own prices",
    cta_section_title: "Start today",
    cta_section_desc: "Your profile can be ready in a few minutes.",
    cta_button: "Sign up",
  },
};

export default function ForInfluencersPage({
  stats,
}: {
  stats: PlatformMarketingStats;
}) {
  const pathname = usePathname();
  const [lang, setLang] = useState<Lang>(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  const txt = t[lang];
  const isLoggedIn = useAuthLoggedIn();

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  }, [pathname]);

  const signupHref = lang === "en" ? "/en?signup=influencer" : "/?signup=influencer";
  const directoryHref = lang === "en" ? "/en/directory" : "/directory";
  const campaignsHref = lang === "en" ? "/en/campaigns" : "/campaigns";
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
            src="https://images.unsplash.com/photo-1758873268911-86716215d7ff?w=1600&q=80"
            alt={
              lang === "en"
                ? "Young creators taking a smiling selfie"
                : "Νέοι creators βγάζουν selfie χαμογελώντας"
            }
            fill
            className="object-cover object-[70%_center] opacity-70"
            priority
            sizes="100vw"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/70 to-transparent md:from-slate-950/90 md:via-slate-950/60 md:to-transparent"
            aria-hidden
          />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <p className="text-sm font-semibold tracking-wide text-blue-300 mb-3">{txt.title}</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight max-w-2xl mb-4">
            {txt.headline}
          </h1>
          <p className="text-lg text-slate-200 max-w-xl mb-8 leading-relaxed">{txt.hero_desc}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={signupHref}
              className="inline-flex justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-center"
            >
              {txt.cta_primary}
            </Link>
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
          title={txt.stats_title}
          description={txt.stats_desc}
          columns={3}
          items={[
            { title: txt.st_1_title, desc: txt.st_1_desc, icon: RefreshCw },
            { title: txt.st_2_title, desc: txt.st_2_desc, icon: TrendingUp },
            { title: txt.st_3_title, desc: txt.st_3_desc, icon: BarChart3 },
            { title: txt.st_4_title, desc: txt.st_4_desc, icon: Sparkles },
            { title: txt.st_5_title, desc: txt.st_5_desc, icon: Award },
          ]}
        />
      </MarketingSection>

      <MarketingSection tone="white">
        <FeatureGrid
          title={txt.tools_title}
          description={txt.tools_desc}
          columns={4}
          items={[
            { title: txt.tool_1_title, desc: txt.tool_1_desc, icon: Link2 },
            { title: txt.tool_2_title, desc: txt.tool_2_desc, icon: FileText },
            { title: txt.tool_3_title, desc: txt.tool_3_desc, icon: QrCode },
            { title: txt.tool_4_title, desc: txt.tool_4_desc, icon: BadgeCheck },
          ]}
        />
      </MarketingSection>

      <MarketingSection tone="slate">
        <FeatureGrid
          title={txt.features_title}
          description={txt.features_desc}
          columns={2}
          items={[
            { title: txt.feat_1_title, desc: txt.feat_1_desc, icon: Wallet },
            { title: txt.feat_2_title, desc: txt.feat_2_desc, icon: CalendarCheck },
            { title: txt.feat_3_title, desc: txt.feat_3_desc, icon: MessageSquare },
            { title: txt.feat_4_title, desc: txt.feat_4_desc, icon: FileText },
          ]}
        />
      </MarketingSection>

      <MarketingSection tone="white">
        <article className="mx-auto max-w-3xl rounded-xl border border-slate-200/90 bg-white p-6 shadow-sm md:p-10">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Briefcase className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </div>
          <h2 className="mb-3 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            {txt.campaign_title}
          </h2>
          <p className="mb-4 leading-relaxed text-slate-600">{txt.campaign_desc}</p>
          <p className="mb-6 text-sm font-medium text-blue-700 md:text-base">{txt.campaign_notify}</p>
          <div className="flex flex-col flex-wrap gap-3 sm:flex-row">
            {isLoggedIn ? (
              <Link
                href="/dashboard?tab=campaigns"
                className="inline-flex justify-center rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-800"
              >
                {txt.campaign_cta}
              </Link>
            ) : (
              <Link
                href={signupHref}
                className="inline-flex justify-center rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-800"
              >
                {txt.campaign_cta_guest}
              </Link>
            )}
            <Link
              href={campaignsHref}
              className="inline-flex justify-center rounded-lg border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-900 transition-colors hover:bg-slate-50"
            >
              {txt.campaign_cta_public}
            </Link>
          </div>
        </article>
      </MarketingSection>

      <MarketingSection tone="slate">
        <HowSteps
          title={txt.how_title}
          description={txt.how_desc}
          steps={[
            { title: txt.step_1_title, desc: txt.step_1_desc },
            { title: txt.step_2_title, desc: txt.step_2_desc },
            { title: txt.step_3_title, desc: txt.step_3_desc },
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
          <Link
            href={signupHref}
            className="inline-flex rounded-lg bg-blue-600 px-8 py-3.5 font-semibold text-white transition-colors hover:bg-blue-700"
          >
            {txt.cta_button}
          </Link>
        </div>
      </section>

      <Footer lang={lang} />
    </div>
  );
}
