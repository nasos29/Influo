"use client";

import Image from "next/image";
import Link from "next/link";
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
    el: "Το προφίλ σας. Οι συνεργασίες σας.",
    en: "Your profile. Your collaborations.",
  },
  hero_desc: {
    el: "Δημιουργήστε επαγγελματικό προφίλ, δεχτείτε προσφορές από brands και ολοκληρώστε καμπάνιες μέσα από μία πλατφόρμα.",
    en: "Build a professional profile, receive brand offers, and complete campaigns in one place.",
  },
  cta_primary: { el: "Ξεκινήστε δωρεάν", en: "Start for free" },
  cta_secondary: { el: "Κατάλογος", en: "Directory" },
  hero_alt: {
    el: "Νέοι creators βγάζουν selfie χαμογελώντας",
    en: "Young creators taking a smiling selfie",
  },
  stat_influencers: { el: "εγκεκριμένοι influencers", en: "approved influencers" },
  stat_brands: { el: "verified brands", en: "verified brands" },
  stat_campaigns: { el: "ανοιχτές καμπάνιες", en: "open campaigns" },
  stats_title: {
    el: "Τα στατιστικά σου, επαγγελματικά",
    en: "Your stats, professionally",
  },
  stats_desc: {
    el: "Ό,τι χρειάζονται τα brands για να σε εμπιστευτούν — στο προφίλ σου.",
    en: "What brands need to trust you — on your profile.",
  },
  st_1_title: {
    el: "Αυτόματη ενημέρωση από Instagram/TikTok/YouTube",
    en: "Auto-refresh from Instagram/TikTok/YouTube",
  },
  st_1_desc: {
    el: "Followers και metrics ανανεώνονται αυτόματα από τα social σου.",
    en: "Followers and metrics update automatically from your socials.",
  },
  st_2_title: { el: "Engagement & ανάπτυξη", en: "Engagement & growth" },
  st_2_desc: {
    el: "Engagement rate και ανάπτυξη followers σε ξεκάθαρη μορφή.",
    en: "Engagement rate and follower growth in a clear format.",
  },
  st_3_title: { el: "Κορυφαία posts", en: "Top posts" },
  st_3_desc: {
    el: "Προβολή των κορυφαίων posts σου στο δημόσιο προφίλ.",
    en: "Show your top posts on your public profile.",
  },
  st_4_title: {
    el: "Στρατηγική αξιολόγηση & Brand Safe",
    en: "Strategic review & Brand Safe",
  },
  st_4_desc: {
    el: "Αξιολόγηση και brand-safe σήματα που βοηθούν τα brands να σε επιλέξουν.",
    en: "Review and brand-safe signals that help brands choose you.",
  },
  st_5_title: { el: "Badges", en: "Badges" },
  st_5_desc: {
    el: "Top Performer, Pro, Elite, VIP — αναγνώριση που χτίζει εμπιστοσύνη.",
    en: "Top Performer, Pro, Elite, VIP — recognition that builds trust.",
  },
  tools_title: { el: "Εργαλεία για τη δουλειά σου", en: "Tools for your work" },
  tools_desc: {
    el: "Μοιράσου το προφίλ σου εύκολα και επαγγελματικά.",
    en: "Share your profile easily and professionally.",
  },
  tool_1_title: {
    el: "Προσωπικό link influo.gr/in/…",
    en: "Personal link influo.gr/in/…",
  },
  tool_1_desc: {
    el: "Βάλε το στο bio των social για άμεσες προτάσεις από brands.",
    en: "Add it to your social bio for direct brand proposals.",
  },
  tool_2_title: { el: "Έτοιμο κείμενο για bio", en: "Ready bio text" },
  tool_2_desc: {
    el: "Αντιγράψιμο κείμενο μαζί με το Influo link.",
    en: "Copy-ready text together with your Influo link.",
  },
  tool_3_title: { el: "QR code (PNG)", en: "QR code (PNG)" },
  tool_3_desc: {
    el: "Για story, media kit ή εκδηλώσεις.",
    en: "For stories, media kits, or events.",
  },
  tool_4_title: {
    el: "Media kit μίας σελίδας (PDF)",
    en: "One-page media kit (PDF)",
  },
  tool_4_desc: {
    el: "Μία σελίδα με φωτο, bio, socials και link — έτοιμη για αποθήκευση ως PDF.",
    en: "One page with photo, bio, socials, and link — ready to save as PDF.",
  },
  features_title: { el: "Ό,τι χρειάζεστε ως creator", en: "Built for creators" },
  features_desc: {
    el: "Προφίλ, καμπάνιες, μηνύματα και αξιοπιστία — σε ένα μέρος.",
    en: "Profile, campaigns, messaging, and trust signals — together.",
  },
  feat_1_title: { el: "Rate card", en: "Rate card" },
  feat_1_desc: {
    el: "Ορίστε τιμές για story, post, reel και άλλα formats στο προφίλ σας.",
    en: "Set prices for stories, posts, reels, and more on your profile.",
  },
  feat_2_title: { el: "Διαθεσιμότητα", en: "Availability" },
  feat_2_desc: {
    el: "Δείξτε αν είστε διαθέσιμοι για νέες συνεργασίες — τα brands φιλτράρουν ανάλογα.",
    en: "Show whether you are open for new work — brands can filter by status.",
  },
  feat_3_title: { el: "Μηνύματα & αρχεία", en: "Messages & files" },
  feat_3_desc: {
    el: "Συνομιλία με brands και αποστολή attachments (briefs, media, συμβόλαια).",
    en: "Chat with brands and send attachments (briefs, media, contracts).",
  },
  feat_4_title: { el: "Deliverables", en: "Deliverables" },
  feat_4_desc: {
    el: "Υποβάλετε URL παράδοσης· το brand εγκρίνει ή ζητά αλλαγές στη ροή της καμπάνιας.",
    en: "Submit a delivery URL; the brand approves or requests changes in-campaign.",
  },
  campaign_title: { el: "Αιτήσεις σε καμπάνιες", en: "Apply to campaigns" },
  campaign_desc: {
    el: "Επαληθευμένα brands δημοσιεύουν καμπάνιες με budget και brief. Όλοι βλέπουν τις ανοιχτές καμπάνιες στη δημόσια σελίδα Καμπάνιες (/campaigns)· αίτηση κάνουν μόνο οι εγκεκριμένοι influencers, με προτεινόμενη τιμή, links προηγούμενης δουλειάς (μόνο social) και προαιρετικό μήνυμα.",
    en: "Verified brands post campaigns with budget and brief. Everyone can browse open campaigns on the public Campaigns page (/en/campaigns); only approved influencers can apply, with a proposed rate, links to past work (social only) and an optional message.",
  },
  campaign_notify: {
    el: "Παίρνεις ειδοποίηση για κάθε νέα καμπάνια που ταιριάζει στο προφίλ σου.",
    en: "You get notified about every new campaign that fits your profile.",
  },
  campaign_cta: { el: "Άνοιγμα καμπανιών", en: "Open campaigns" },
  campaign_cta_public: {
    el: "Δες τις ανοιχτές καμπάνιες",
    en: "See open campaigns",
  },
  campaign_cta_guest: { el: "Εγγραφή για αιτήσεις", en: "Sign up to apply" },
  how_title: { el: "Πώς λειτουργεί", en: "How it works" },
  how_desc: {
    el: "Από την εγγραφή στην παράδοση σε τρία βήματα.",
    en: "From signup to delivery in three steps.",
  },
  step_1_title: { el: "Δημιουργήστε προφίλ", en: "Create your profile" },
  step_1_desc: {
    el: "Εγγραφή, portfolio, rate card και διαθεσιμότητα.",
    en: "Sign up, add portfolio, rate card, and availability.",
  },
  step_2_title: { el: "Προσφορές & αιτήσεις", en: "Offers & applications" },
  step_2_desc: {
    el: "Λάβετε προσφορές ή κάντε αίτηση σε ανοιχτές καμπάνιες.",
    en: "Receive offers or apply to open campaigns.",
  },
  step_3_title: { el: "Παράδοση & ολοκλήρωση", en: "Deliver & close" },
  step_3_desc: {
    el: "Υποβάλετε deliverable, λάβετε έγκριση και κλείστε τη συνεργασία.",
    en: "Submit deliverables, get approval, and finish the collaboration.",
  },
  trust_title: { el: "Γιατί Influo", en: "Why Influo" },
  trust_1: { el: "Δωρεάν εγγραφή", en: "Free signup" },
  trust_2: { el: "Χωρίς προμήθεια", en: "No commission" },
  trust_3: { el: "Εσύ ορίζεις τις τιμές σου", en: "You set your own prices" },
  cta_section_title: { el: "Ξεκινήστε σήμερα", en: "Start today" },
  cta_section_desc: {
    el: "Το προφίλ σας είναι έτοιμο σε λίγα λεπτά.",
    en: "Your profile can be ready in a few minutes.",
  },
  cta_button: { el: "Εγγραφή", en: "Sign up" },
} as const satisfies Record<string, Bilingual>;

type Props = Readonly<{ stats: PlatformMarketingStats }>;

export default function ForInfluencersPage({ stats }: Props) {
  const [lang, setLang] = useMarketingLang();
  const txt = resolveCopy(lang, COPY);
  const isLoggedIn = useAuthLoggedIn();

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

      <section className="relative border-b border-slate-100">
        <div className="absolute inset-0 bg-slate-950">
          <Image
            src="https://images.unsplash.com/photo-1758873268911-86716215d7ff?w=1600&q=80"
            alt={txt.hero_alt}
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
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <p className="mb-3 text-sm font-semibold tracking-wide text-blue-300">{txt.title}</p>
          <h1 className="mb-4 max-w-2xl text-4xl font-bold tracking-tight text-white md:text-5xl">
            {txt.headline}
          </h1>
          <p className="mb-8 max-w-xl text-lg leading-relaxed text-slate-200">{txt.hero_desc}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={signupHref}
              className="inline-flex justify-center rounded-lg bg-blue-600 px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-blue-700"
            >
              {txt.cta_primary}
            </Link>
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
