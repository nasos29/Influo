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
  headline: {
    el: "Το προφίλ σας. Οι συνεργασίες σας.",
    en: "Your profile. Your collaborations.",
  },
  hero_desc: {
    el: "Δημιουργήστε επαγγελματικό προφίλ, δεχτείτε προσφορές από brands και ολοκληρώστε καμπάνιες μέσα από μία πλατφόρμα.",
    en: "Build a professional profile, receive brand offers, and complete campaigns in one place.",
  },
  cta_primary: { el: "Ξεκινήστε δωρεάν", en: "Start for free" },
  hero_alt: {
    el: "Νέοι creators βγάζουν selfie χαμογελώντας",
    en: "Young creators taking a smiling selfie",
  },
  stats_title: {
    el: "Τα στατιστικά σου, επαγγελματικά",
    en: "Your stats, professionally",
  },
  stats_desc: {
    el: "Ό,τι χρειάζονται τα brands για να σε εμπιστευτούν — στο προφίλ σου.",
    en: "What brands need to trust you — on your profile.",
  },
  tools_title: { el: "Εργαλεία για τη δουλειά σου", en: "Tools for your work" },
  tools_desc: {
    el: "Μοιράσου το προφίλ σου εύκολα και επαγγελματικά.",
    en: "Share your profile easily and professionally.",
  },
  features_title: { el: "Ό,τι χρειάζεστε ως creator", en: "Built for creators" },
  features_desc: {
    el: "Προφίλ, καμπάνιες, μηνύματα και αξιοπιστία — σε ένα μέρος.",
    en: "Profile, campaigns, messaging, and trust signals — together.",
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
  how_desc: {
    el: "Από την εγγραφή στην παράδοση σε τρία βήματα.",
    en: "From signup to delivery in three steps.",
  },
  trust_1: { el: "Δωρεάν εγγραφή", en: "Free signup" },
  trust_2: { el: "Χωρίς προμήθεια", en: "No commission" },
  trust_3: { el: "Εσύ ορίζεις τις τιμές σου", en: "You set your own prices" },
  cta_desc: {
    el: "Το προφίλ σας είναι έτοιμο σε λίγα λεπτά.",
    en: "Your profile can be ready in a few minutes.",
  },
  cta_button: { el: "Εγγραφή", en: "Sign up" },
} as const satisfies Record<string, Bilingual>;

const PROFILE_STATS: BiFeature[] = [
  {
    icon: RefreshCw,
    title: {
      el: "Αυτόματη ενημέρωση από Instagram/TikTok/YouTube",
      en: "Auto-refresh from Instagram/TikTok/YouTube",
    },
    desc: {
      el: "Followers και metrics ανανεώνονται αυτόματα από τα social σου.",
      en: "Followers and metrics update automatically from your socials.",
    },
  },
  {
    icon: TrendingUp,
    title: { el: "Engagement & ανάπτυξη", en: "Engagement & growth" },
    desc: {
      el: "Engagement rate και ανάπτυξη followers σε ξεκάθαρη μορφή.",
      en: "Engagement rate and follower growth in a clear format.",
    },
  },
  {
    icon: BarChart3,
    title: { el: "Κορυφαία posts", en: "Top posts" },
    desc: {
      el: "Προβολή των κορυφαίων posts σου στο δημόσιο προφίλ.",
      en: "Show your top posts on your public profile.",
    },
  },
  {
    icon: Sparkles,
    title: {
      el: "Στρατηγική αξιολόγηση & Brand Safe",
      en: "Strategic review & Brand Safe",
    },
    desc: {
      el: "Αξιολόγηση και brand-safe σήματα που βοηθούν τα brands να σε επιλέξουν.",
      en: "Review and brand-safe signals that help brands choose you.",
    },
  },
  {
    icon: Award,
    title: { el: "Badges", en: "Badges" },
    desc: {
      el: "Top Performer, Pro, Elite, VIP — αναγνώριση που χτίζει εμπιστοσύνη.",
      en: "Top Performer, Pro, Elite, VIP — recognition that builds trust.",
    },
  },
];

const CREATOR_TOOLS: BiFeature[] = [
  {
    icon: Link2,
    title: {
      el: "Προσωπικό link influo.gr/in/…",
      en: "Personal link influo.gr/in/…",
    },
    desc: {
      el: "Βάλε το στο bio των social για άμεσες προτάσεις από brands.",
      en: "Add it to your social bio for direct brand proposals.",
    },
  },
  {
    icon: FileText,
    title: { el: "Έτοιμο κείμενο για bio", en: "Ready bio text" },
    desc: {
      el: "Αντιγράψιμο κείμενο μαζί με το Influo link.",
      en: "Copy-ready text together with your Influo link.",
    },
  },
  {
    icon: QrCode,
    title: { el: "QR code (PNG)", en: "QR code (PNG)" },
    desc: {
      el: "Για story, media kit ή εκδηλώσεις.",
      en: "For stories, media kits, or events.",
    },
  },
  {
    icon: BadgeCheck,
    title: {
      el: "Media kit μίας σελίδας (PDF)",
      en: "One-page media kit (PDF)",
    },
    desc: {
      el: "Μία σελίδα με φωτο, bio, socials και link — έτοιμη για αποθήκευση ως PDF.",
      en: "One page with photo, bio, socials, and link — ready to save as PDF.",
    },
  },
];

const CREATOR_FEATURES: BiFeature[] = [
  {
    icon: Wallet,
    title: { el: "Rate card", en: "Rate card" },
    desc: {
      el: "Ορίστε τιμές για story, post, reel και άλλα formats στο προφίλ σας.",
      en: "Set prices for stories, posts, reels, and more on your profile.",
    },
  },
  {
    icon: CalendarCheck,
    title: { el: "Διαθεσιμότητα", en: "Availability" },
    desc: {
      el: "Δείξτε αν είστε διαθέσιμοι για νέες συνεργασίες — τα brands φιλτράρουν ανάλογα.",
      en: "Show whether you are open for new work — brands can filter by status.",
    },
  },
  {
    icon: MessageSquare,
    title: { el: "Μηνύματα & αρχεία", en: "Messages & files" },
    desc: {
      el: "Συνομιλία με brands και αποστολή attachments (briefs, media, συμβόλαια).",
      en: "Chat with brands and send attachments (briefs, media, contracts).",
    },
  },
  {
    icon: FileText,
    title: { el: "Deliverables", en: "Deliverables" },
    desc: {
      el: "Υποβάλετε URL παράδοσης· το brand εγκρίνει ή ζητά αλλαγές στη ροή της καμπάνιας.",
      en: "Submit a delivery URL; the brand approves or requests changes in-campaign.",
    },
  },
];

const CREATOR_STEPS: BiStep[] = [
  {
    title: { el: "Δημιουργήστε προφίλ", en: "Create your profile" },
    desc: {
      el: "Εγγραφή, portfolio, rate card και διαθεσιμότητα.",
      en: "Sign up, add portfolio, rate card, and availability.",
    },
  },
  {
    title: { el: "Προσφορές & αιτήσεις", en: "Offers & applications" },
    desc: {
      el: "Λάβετε προσφορές ή κάντε αίτηση σε ανοιχτές καμπάνιες.",
      en: "Receive offers or apply to open campaigns.",
    },
  },
  {
    title: { el: "Παράδοση & ολοκλήρωση", en: "Deliver & close" },
    desc: {
      el: "Υποβάλετε deliverable, λάβετε έγκριση και κλείστε τη συνεργασία.",
      en: "Submit deliverables, get approval, and finish the collaboration.",
    },
  },
];

type Props = Readonly<{ stats: PlatformMarketingStats }>;

export default function ForInfluencersPage({ stats }: Props) {
  const [lang, setLang] = useMarketingLang();
  const txt = resolveCopy(lang, UI);
  const isLoggedIn = useAuthLoggedIn();

  const signupHref = lang === "en" ? "/en?signup=influencer" : "/?signup=influencer";
  const directoryHref = lang === "en" ? "/en/directory" : "/directory";
  const campaignsHref = lang === "en" ? "/en/campaigns" : "/campaigns";
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
          <p className="mb-3 text-sm font-semibold tracking-wide text-blue-300">
            {MARKETING_SHARED.brand}
          </p>
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
              {bi(lang, MARKETING_SHARED.directory)}
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
          items={localizeFeatures(lang, PROFILE_STATS)}
        />
      </MarketingSection>

      <MarketingSection tone="white">
        <FeatureGrid
          title={txt.tools_title}
          description={txt.tools_desc}
          columns={4}
          items={localizeFeatures(lang, CREATOR_TOOLS)}
        />
      </MarketingSection>

      <MarketingSection tone="slate">
        <FeatureGrid
          title={txt.features_title}
          description={txt.features_desc}
          columns={2}
          items={localizeFeatures(lang, CREATOR_FEATURES)}
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
            <Link
              href={isLoggedIn ? "/dashboard?tab=campaigns" : signupHref}
              className="inline-flex justify-center rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-800"
            >
              {isLoggedIn ? txt.campaign_cta : txt.campaign_cta_guest}
            </Link>
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
          title={bi(lang, MARKETING_SHARED.howTitle)}
          description={txt.how_desc}
          steps={localizeSteps(lang, CREATOR_STEPS)}
        />
      </MarketingSection>

      <MarketingClosing
        trustTitle={bi(lang, MARKETING_SHARED.trustTitle)}
        trustItems={[txt.trust_1, txt.trust_2, txt.trust_3]}
        ctaTitle={bi(lang, MARKETING_SHARED.ctaTitle)}
        ctaDesc={txt.cta_desc}
        ctaAction={
          <Link
            href={signupHref}
            className="inline-flex rounded-lg bg-blue-600 px-8 py-3.5 font-semibold text-white transition-colors hover:bg-blue-700"
          >
            {txt.cta_button}
          </Link>
        }
      />

      <Footer lang={lang} />
    </div>
  );
}
