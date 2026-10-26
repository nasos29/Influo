"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getStoredLanguage } from "@/lib/language";
import Footer from "../../components/Footer";
import SiteHeader from "@/components/SiteHeader";
import DocsToc, { type DocsTocGroup } from "@/components/DocsToc";
import { FaChevronDown } from "react-icons/fa";
import { NEW_BADGE_MAX_DAYS } from "@/lib/badges";

type Lang = "el" | "en";

const t = {
  el: {
    title: "Οδηγός Χρήστη",
    subtitle: "Για Influencers & Brands",
    back: "Επιστροφή",
    nav_home: "Αρχική",
    back_top: "Πίσω στην κορυφή",
    see_campaigns: "Δες τις ανοιχτές καμπάνιες",
    manage_campaigns: "Διαχείριση καμπανιών",
  },
  en: {
    title: "User Guide",
    subtitle: "For Influencers & Brands",
    back: "Back",
    nav_home: "Home",
    back_top: "Back to top",
    see_campaigns: "See open campaigns",
    manage_campaigns: "Manage campaigns",
  }
};

const TOC_GROUPS: DocsTocGroup[] = [
  {
    title: { el: "Για brands", en: "For brands" },
    items: [
      { id: "campaigns", label: { el: "Καμπάνιες", en: "Campaigns" } },
      { id: "proposals", label: { el: "Προσφορές", en: "Proposals" } },
      { id: "brand-tools", label: { el: "Εργαλεία brand", en: "Brand tools" } },
    ],
  },
  {
    title: { el: "Για influencers", en: "For influencers" },
    items: [
      { id: "badges", label: { el: "Badges", en: "Badges" } },
      { id: "influencer-tools", label: { el: "Εργαλεία influencer", en: "Influencer tools" } },
      { id: "counter", label: { el: "Αντιπροσφορά", en: "Counter-proposal" } },
    ],
  },
  {
    title: { el: "Γενικά", en: "General" },
    items: [
      { id: "profile", label: { el: "Προφίλ & εμπιστοσύνη", en: "Profile & trust" } },
      { id: "agreement", label: { el: "Συμφωνία", en: "Agreement" } },
      { id: "messages", label: { el: "Μηνύματα", en: "Messages" } },
      { id: "reviews", label: { el: "Reviews", en: "Reviews" } },
      { id: "tips", label: { el: "Συμβουλές", en: "Tips" } },
      { id: "faq", label: { el: "FAQ", en: "FAQ" } },
      { id: "support", label: { el: "Υποστήριξη", en: "Support" } },
    ],
  },
];

function IconBox({ children }: { children: ReactNode }) {
  return (
    <div className="w-10 h-10 shrink-0 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
      {children}
    </div>
  );
}

function SectionHeading({
  id,
  icon,
  children,
}: {
  id: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <h2
      id={id}
      className="scroll-mt-28 text-2xl md:text-3xl font-bold text-slate-900 mb-6 flex items-center gap-3 tracking-tight"
    >
      <IconBox>{icon}</IconBox>
      <span>{children}</span>
    </h2>
  );
}

function NumberedSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-3 my-6">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 items-start min-w-0 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <span className="shrink-0 w-8 h-8 rounded-full bg-slate-900 text-white text-sm font-semibold flex items-center justify-center" aria-hidden>
            {i + 1}
          </span>
          <span className="pt-1 text-slate-700 text-sm md:text-base leading-relaxed min-w-0">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function StatusPill({ label, tone, desc }: { label: string; tone: string; desc: string }) {
  return (
    <li className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 min-w-0">
      <span className={`inline-flex w-fit shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
        {label}
      </span>
      <span className="text-sm text-slate-700 leading-relaxed min-w-0">{desc}</span>
    </li>
  );
}

const icons = {
  badge: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  profile: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  proposals: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  campaigns: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.993 3.993 0 01-1.564-.317z" />
    </svg>
  ),
  tools: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  counter: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  agreement: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  messages: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  reviews: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118L2.98 9.72c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  tips: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  faq: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  support: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
};

type FaqEntry = { q: Record<Lang, string>; a: Record<Lang, string> };

/** FAQ — ενημερώνεται μαζί με νέες λειτουργίες πλατφόρμας */
const FAQ_ITEMS: FaqEntry[] = [
  {
    q: {
      el: "Πώς μπορώ να αυξήσω το engagement rate μου;",
      en: "How can I increase my engagement rate?",
    },
    a: {
      el: "Συνεπής δημοσίευση, ποιοτικό περιεχόμενο που «μιλάει» στο κοινό σας, αλληλεπίδραση με σχόλια και μηνύματα, σωστή χρήση hashtags και αναλύσεις για το τι αποδίδει καλύτερα στα δικά σας posts.",
      en: "Post consistently, create quality content your audience cares about, reply to comments and DMs, use hashtags thoughtfully, and review what performs best to double down on what works.",
    },
  },
  {
    q: {
      el: "Πώς ξέρω αν ένας influencer είναι αξιόπιστος;",
      en: "How do I know if an influencer is trustworthy?",
    },
    a: {
      el: "Ελέγξτε το επαληθευμένο προφίλ (verified), reviews και rating, συνέπεια περιεχομένου, ρεαλιστικό engagement, σήματα όπως «Ιδιωτικό», «Ύποπτο ER», «Εκτίμηση» ή «Λίγα δεδομένα» στον κατάλογο, και πραγματικό χρόνο απόκρισης στο προφίλ (όχι πάντα 24h).",
      en: "Check verification, reviews and rating, content consistency, realistic engagement, directory signals like Private, Suspicious ER, Estimate, or Few posts, and real response time on the profile (not always 24h).",
    },
  },
  {
    q: {
      el: "Μπορώ να απορρίψω μια προσφορά;",
      en: "Can I reject a proposal?",
    },
    a: {
      el: "Ναι. Μπορείτε να την απορρίψετε ή να προτείνετε διαφορετικούς όρους μέσω αντιπροσφοράς (counter-proposal), ανάλογα με το τι σας ταιριάζει.",
      en: "Yes. You can reject it or suggest different terms via a counter-proposal, depending on what works for you.",
    },
  },
  {
    q: {
      el: "Πώς γίνομαι επαληθευμένος (verified) influencer;",
      en: "How do I become a verified influencer?",
    },
    a: {
      el: "Υποβάλλετε πλήρες προφίλ με αληθινά στοιχεία και συνδέσμους κοινωνικών δικτύων. Η ομάδα ελέγχει το αίτημα· μετά την έγκριση είστε εγκεκριμένος influencer, εμφανίζεστε στον κατάλογο με ✓ «Στατιστικά ελεγμένα από το Influo» και μπορείτε να κάνετε αίτηση σε ανοιχτές καμπάνιες.",
      en: "Complete your profile with accurate info and social links. Our team reviews applications; once approved you are an approved influencer, appear in the directory with the ✓ “Stats checked by Influo” mark, and can apply to open campaigns.",
    },
  },
  {
    q: {
      el: "Τι είναι οι καμπάνιες και πώς κάνω αίτηση ως influencer;",
      en: "What are campaigns and how do I apply as an influencer?",
    },
    a: {
      el: "Οι καμπάνιες είναι briefs που δημοσιεύουν επαληθευμένα brands. Όλοι βλέπουν τις ανοιχτές καμπάνιες στη δημόσια σελίδα /campaigns· αίτηση κάνουν μόνο οι εγκεκριμένοι influencers, με προτεινόμενη τιμή, links προηγούμενης δουλειάς (μόνο από social δίκτυα, π.χ. Instagram/TikTok/YouTube) και προαιρετικό μήνυμα. Το brand ενημερώνει την κατάσταση (εκκρεμεί, shortlist, απόρριψη). Αν μπείτε σε shortlist, μπορείτε να υποβάλετε link παράδοσης (deliverable) και το brand να το εγκρίνει ή να ζητήσει αλλαγές.",
      en: "Campaigns are briefs published by verified brands. Everyone can browse open campaigns on /en/campaigns; only approved influencers can apply, with a proposed rate, links to past work (social networks only, e.g. Instagram/TikTok/YouTube) and an optional message. The brand updates status (pending, shortlisted, rejected). If shortlisted, you can submit a deliverable URL and the brand can approve it or request changes.",
    },
  },
  {
    q: {
      el: "Πώς δημοσιεύω καμπάνια ως brand;",
      en: "How do I publish campaigns as a brand?",
    },
    a: {
      el: "Από το Brand Dashboard, στο tab Καμπάνιες, δημιουργείτε καμπάνια με τίτλο, περιγραφή, budget και προαιρετικά προθεσμία και deliverables. Το brand σας πρέπει να είναι επαληθευμένο. Όταν η κατάσταση είναι «Ανοιχτή», οι εγκεκριμένοι influencers τη βλέπουν και μπορούν να κάνουν αίτηση. Στις αιτήσεις σε shortlist μπορείτε να ελέγξετε και να εγκρίνετε την παράδοση περιεχομένου.",
      en: "From Brand Dashboard → Campaigns, create a campaign with title, description, budget, and optional deadline and deliverables. Your brand must be verified. When status is Open, approved influencers can see it and apply. For shortlisted applications you can review and approve content deliverables.",
    },
  },
  {
    q: {
      el: "Είναι δωρεάν η εγγραφή και η χρήση του Influo;",
      en: "Is signing up and using Influo free?",
    },
    a: {
      el: "Η εγγραφή, η δημοσίευση καμπάνιας και η αίτηση είναι δωρεάν. Δεν παίρνουμε προμήθεια από τις συνεργασίες σας. Ελέγξτε τους όρους χρήσης για εμπορικές λεπτομέρειες.",
      en: "Signing up, publishing a campaign, and applying are free, no commission. See the Terms of Service for commercial details.",
    },
  },
  {
    q: {
      el: "Πώς λειτουργούν τα μηνύματα και οι ειδοποιήσεις;",
      en: "How do messages and notifications work?",
    },
    a: {
      el: "Τα brands ξεκινούν συνομιλία από προφίλ ή προσφορά· οι influencers απαντούν στην υπάρχουσα συνομιλία. Μπορείτε να επισυνάψετε εικόνες ή PDF (έως 10MB). Λαμβάνετε email και, αν ενεργοποιηθεί, push για νέα μηνύματα.",
      en: "Brands start chats from a profile or proposal; influencers reply in that thread. You can attach images or PDFs (up to 10MB). You get email and, if enabled, push for new messages.",
    },
  },
  {
    q: {
      el: "Πώς ορίζω αν είμαι διαθέσιμος για συνεργασίες;",
      en: "How do I set whether I’m available for collaborations?",
    },
    a: {
      el: "Στο Influencer Dashboard → Προφίλ επιλέγετε «Διαθέσιμος» ή «Μη διαθέσιμος προσωρινά». Η κατάσταση φαίνεται στο δημόσιο προφίλ και τα brands μπορούν να φιλτράρουν τον κατάλογο ώστε να βλέπουν κυρίως διαθέσιμους creators.",
      en: "In Influencer Dashboard → Profile choose Available or Temporarily unavailable. Status shows on your public profile and brands can filter the directory to focus on available creators.",
    },
  },
  {
    q: {
      el: "Τι σημαίνει ο χρόνος απάντησης στο προφίλ;",
      en: "What does response time on the profile mean?",
    },
    a: {
      el: "Υπολογίζεται από πραγματικές συνομιλίες (μήνυμα brand → απάντηση influencer). Αν δεν υπάρχουν αρκετά δεδομένα, εμφανίζεται παύλα (—) αντί για ψεύτικο «24h». Το ποσοστό ολοκλήρωσης βασίζεται στις προσφορές σας.",
      en: "It’s computed from real chats (brand message → influencer reply). If there isn’t enough data, you’ll see a dash (—) instead of a fake “24h”. Completion rate is based on your proposals.",
    },
  },
  {
    q: {
      el: "Πού βρίσκω τα εργαλεία ως influencer;",
      en: "Where do I find tools as an influencer?",
    },
    a: {
      el: "Dashboard → tab «Εργαλεία». Μετά την έγκριση: προσωπικό link (και σύντομο slug), κείμενο για bio, QR code και media kit PDF (Εκτύπωση → Αποθήκευση ως PDF).",
      en: "Dashboard → Tools tab. After approval: personal profile link (and short slug), bio text, QR code, and media kit PDF (Print → Save as PDF).",
    },
  },
  {
    q: {
      el: "Τι κάνουν τα εργαλεία brand στο dashboard;",
      en: "What do brand tools in the dashboard do?",
    },
    a: {
      el: "Brand Dashboard → «Εργαλεία»: budget estimator, export/σύγκριση shortlist, checklist, UTM, brief, ROI log, brand kit PDF και έτοιμα μηνύματα. Πολλά βασίζονται στη shortlist· checklist/ROI/snippets μένουν στον browser σας.",
      en: "Brand Dashboard → Tools: budget estimator, shortlist export/compare, checklist, UTM, brief, ROI log, brand kit PDF, and message snippets. Many use the shortlist; checklist/ROI/snippets stay in your browser.",
    },
  },
  {
    q: {
      el: "Μπορώ να «εγκαταστήσω» το Influo ως εφαρμογή στο κινητό;",
      en: "Can I install Influo as an app on my phone?",
    },
    a: {
      el: "Ναι. Ανοίξτε το influo.gr από Chrome (Android) ή Safari (iPhone) και χρησιμοποιήστε «Εγκατάσταση» / «Προσθήκη στην αρχική οθόνη» για εμπειρία παρόμοια με εφαρμογή (PWA), χωρίς Play Store ή App Store.",
      en: "Yes. Open influo.gr in Chrome (Android) or Safari (iOS) and use Install / Add to Home Screen for an app-like PWA experience without an app store download.",
    },
  },
  {
    q: {
      el: "Πώς αφήνω review μετά από συνεργασία;",
      en: "How do I leave a review after a collaboration?",
    },
    a: {
      el: "Μετά την ολοκλήρωση της συνεργασίας, ως brand μπορείτε να επισκεφθείτε το προφίλ του influencer, tab Reviews, και να υποβάλετε βαθμολογία και κείμενο. Τα reviews ενισχύουν την αξιοπιστία στην πλατφόρμα.",
      en: "After completion, as a brand visit the influencer’s profile → Reviews and submit a rating and text. Reviews build trust on the platform.",
    },
  },
  {
    q: {
      el: "Τι σημαίνει «επαληθευμένο» brand;",
      en: "What does a verified brand mean?",
    },
    a: {
      el: "Σημαίνει ότι η ομάδα έχει ελέγξει στοιχεία της επιχείρησης ώστε να εμφανίζονται δημόσια καμπάνιες και να υπάρχει εμπιστοσύνη για τους influencers. Μόνο verified brands δημοσιεύουν ανοιχτές καμπάνιες.",
      en: "It means our team has reviewed business details so public campaigns are shown and influencers can trust who they apply to. Only verified brands publish open campaigns.",
    },
  },
  {
    q: {
      el: "Πόσο μένει ανοιχτή μια καμπάνια;",
      en: "How long does a campaign stay open?",
    },
    a: {
      el: "Κλείνει αυτόματα στην προθεσμία· χωρίς προθεσμία, 30 μέρες μετά το άνοιγμα. Η κάρτα δείχνει «Κλείνει αυτόματα σε N μέρες» ή «Λήγει σε…». 3 μέρες πριν το brand παίρνει υπενθύμιση· στο κλείσιμο ενημερώνονται brand και αιτούντες σε εκκρεμότητα. Οι ληγμένες δεν εμφανίζονται δημόσια. Δεν διαγράφονται — για ξανάνοιγμα: κατάσταση «Ανοιχτή» (νέο 30ήμερο)· αν η προθεσμία είχε περάσει, ανοίγει αυτόματα για 30 μέρες.",
      en: "It closes on its deadline; with no deadline, 30 days after opening. The card shows “Closes automatically in N days” or “Ends in…”. Three days before, the brand gets a reminder; on close, brand and pending applicants are emailed. Expired campaigns leave the public list. They are not deleted — to reopen set status to Open (new 30-day window); if the deadline had passed, it opens automatically for 30 days.",
    },
  },
  {
    q: {
      el: "Πώς επικοινωνώ με την υποστήριξη;",
      en: "How do I contact support?",
    },
    a: {
      el: "Στείλτε email στο support@influo.gr ή χρησιμοποιήστε τη φόρμα επικοινωνίας / help desk της ιστοσελίδας. Ωράριο ενδεικτικά: Δευτέρα–Παρασκευή, 10:00–18:00 (ώρα Ελλάδας).",
      en: "Email support@influo.gr or use the site’s contact / help desk form. Indicative hours: Monday–Friday, 10:00–18:00 (Greece time).",
    },
  },
  {
    q: {
      el: "Τα προσωπικά μου δεδομένα είναι ασφαλή;",
      en: "Is my personal data secure?",
    },
    a: {
      el: "Η πλατφόρμα χρησιμοποιεί σύγχρονη υποδομή (HTTPS), ασφαλή authentication και πρακτικές σύμφωνα με την πολιτική απορρήτου. Διαβάστε την Πολιτική Απορρήτου για λεπτομέρειες επεξεργασίας και δικαιωμάτων σας.",
      en: "We use HTTPS, secure authentication, and practices described in our Privacy Policy. Read it for details on processing and your rights.",
    },
  },
  {
    q: {
      el: "Μπορώ να έχω ταυτόχρονα λογαριασμό influencer και brand;",
      en: "Can I have both an influencer and a brand account?",
    },
    a: {
      el: "Συνήθως πρόκειται για ξεχωριστούς ρόλους και λογαριασμούς (διαφορετικό email/εγγραφή ανά ρόλο). Ακολουθήστε τις οδηγίες εγγραφής για κάθε τύπο λογαριασμού ώστε το προφίλ και τα δικαιώματα να είναι σωστά.",
      en: "Usually these are separate roles and accounts (different signup per role). Follow the signup flow for each so your profile and permissions stay correct.",
    },
  },
  {
    q: {
      el: "Πώς λειτουργεί η αντιπροσφορά (counter-proposal);",
      en: "How does a counter-proposal work?",
    },
    a: {
      el: "Όταν λάβετε προσφορά από brand, μπορείτε να προτείνετε διαφορετικό budget ή όρους. Το brand βλέπει την αντιπροσφορά και μπορεί να την αποδεχτεί ή να την απορρίψει. Έτσι συμφωνείτε χωρίς να ξεκινάτε από την αρχή.",
      en: "When you receive a brand proposal, you can suggest different budget or terms. The brand accepts or rejects your counter. That way you align without restarting from scratch.",
    },
  },
  {
    q: {
      el: "Τι είναι η συμφωνία συνεργασίας (agreement) και γιατί χρειάζεται;",
      en: "What is the collaboration agreement and why does it matter?",
    },
    a: {
      el: "Μετά την αποδοχή προσφοράς, εμφανίζονται όροι που πρέπει να αποδεχτούν και οι δύο πλευρές. Μόνο όταν γίνει αμοιβαία αποδοχή η συνεργασία καταγράφεται επίσημα (π.χ. Past Brands). Προστατεύει brand και influencer με κοινούς κανόνες.",
      en: "After a proposal is accepted, terms appear that both sides must accept. Only after mutual acceptance is the collaboration recorded officially (e.g. Past Brands). It protects both parties with shared rules.",
    },
  },
];

export default function DocsPage() {
  const pathname = usePathname();
  const [lang, setLang] = useState<Lang>(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const txt = t[lang];

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <SiteHeader lang={lang} onLangChange={setLang} />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 overflow-x-hidden">
        {/* Title */}
        <div className="mb-8" id="top">
          <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-2 tracking-tight">{txt.title}</h1>
          <p className="text-lg text-slate-600">{txt.subtitle}</p>
        </div>

        <div className="lg:hidden">
          <DocsToc lang={lang} groups={TOC_GROUPS} variant="mobile" />
        </div>

        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 lg:items-start">
          <div className="hidden lg:block">
            <DocsToc lang={lang} groups={TOC_GROUPS} variant="desktop" />
          </div>
          {/* Documentation Content */}
          <div className="min-w-0 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-8 md:p-10">
          
          {/* Campaigns first (brands) — then badges etc. keep reading order via TOC */}
          {/* Badges System */}
          <section className="mb-12">
            <SectionHeading id="badges" icon={icons.badge}>
              {lang === 'el' ? 'Badges' : 'Badges'}
            </SectionHeading>
            <p className="text-slate-600 mb-4 max-w-prose">
              {lang === 'el' 
                ? 'Τα badges στις κάρτες αναγνωρίζουν την απόδοση των influencers (εμφανίζεται το υψηλότερης προτεραιότητας).'
                : 'Card badges recognize influencer performance (the highest-priority badge is shown).'}
            </p>
            <p className="text-sm text-slate-600 mb-6 max-w-prose rounded-lg border border-slate-200 bg-slate-50 p-4">
              {lang === 'el'
                ? 'Το ✓ δίπλα στο avatar σημαίνει «Στατιστικά ελεγμένα από το Influo» — δεν είναι badge κάρτας και δεν εμφανίζεται ως «Επαληθευμένος».'
                : 'The ✓ next to the avatar means “Stats checked by Influo” — it is not a card badge and is not labeled “Verified”.'}
            </p>

            <h3 className="text-lg font-semibold text-slate-900 mt-8 mb-4">
              {lang === 'el' ? 'Τύποι Badges' : 'Badge Types'}
            </h3>

            {/* Badge Cards */}
            <div className="grid md:grid-cols-2 gap-4 my-6">
              {/* New Badge */}
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">✨</span>
                  <h4 className="font-bold text-blue-900 m-0">
                    {lang === 'el' ? 'Νέος (New)' : 'New'}
                  </h4>
                </div>
                <p className="text-sm text-slate-700 mb-2">
                  <strong>{lang === 'el' ? 'Πότε αποκτάται:' : 'When earned:'}</strong> {lang === 'el' ? `Όταν το account είναι λιγότερο από ${NEW_BADGE_MAX_DAYS} ημέρες` : `When account is less than ${NEW_BADGE_MAX_DAYS} days old`}
                </p>
                <p className="text-sm text-slate-600">
                  {lang === 'el' ? 'Σημασία: Νέος influencer στην πλατφόρμα' : 'Meaning: New influencer on the platform'}
                </p>
              </div>

              {/* Rising Badge */}
              <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">📈</span>
                  <h4 className="font-bold text-green-900 m-0">
                    {lang === 'el' ? 'Ανερχόμενος (Rising)' : 'Rising'}
                  </h4>
                </div>
                <p className="text-sm text-slate-700 mb-2">
                  <strong>{lang === 'el' ? 'Πότε αποκτάται:' : 'When earned:'}</strong> {lang === 'el' ? 'Account 30-90 ημέρες, engagement rate >3%, followers <50k' : 'Account 30-90 days, engagement rate >3%, followers <50k'}
                </p>
                <p className="text-sm text-slate-600">
                  {lang === 'el' ? 'Σημασία: Σταθερή ανάπτυξη και καλή απόδοση' : 'Meaning: Steady growth and good performance'}
                </p>
              </div>

              {/* Top Performer Badge */}
              <div className="border border-purple-300 rounded-lg p-4 bg-purple-50 border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🏆</span>
                  <h4 className="font-bold text-purple-900 m-0">Top Performer</h4>
                </div>
                <p className="text-sm text-slate-700 mb-2">
                  <strong>{lang === 'el' ? 'Πότε αποκτάται:' : 'When earned:'}</strong> {lang === 'el' ? 'Engagement rate >5% + followers >10,000' : 'Engagement rate >5% + followers >10,000'}
                </p>
                <p className="text-sm text-slate-600">
                  {lang === 'el' ? 'Σημασία: Εξαιρετική απόδοση και engagement' : 'Meaning: Excellent performance and engagement'}
                </p>
              </div>

              {/* Pro Badge */}
              <div className="border border-amber-300 rounded-lg p-4 bg-amber-50 border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">⭐</span>
                  <h4 className="font-bold text-amber-900 m-0">Pro</h4>
                </div>
                <p className="text-sm text-slate-700 mb-2">
                  <strong>{lang === 'el' ? 'Πότε αποκτάται:' : 'When earned:'}</strong> {lang === 'el' ? '5+ συνεργασίες ή 10+ reviews με rating >4.0' : '5+ collaborations or 10+ reviews with rating >4.0'}
                </p>
                <p className="text-sm text-slate-600">
                  {lang === 'el' ? 'Σημασία: Επαγγελματική εμπειρία και αξιολόγηση' : 'Meaning: Professional experience and evaluation'}
                </p>
              </div>

              {/* Elite Badge */}
              <div className="border border-indigo-300 rounded-lg p-4 bg-indigo-50 border-indigo-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">💎</span>
                  <h4 className="font-bold text-indigo-900 m-0">Elite</h4>
                </div>
                <p className="text-sm text-slate-700 mb-2">
                  <strong>{lang === 'el' ? 'Πότε αποκτάται:' : 'When earned:'}</strong> {lang === 'el' ? '500k+ followers ή 20+ συνεργασίες με rating >4.5' : '500k+ followers or 20+ collaborations with rating >4.5'}
                </p>
                <p className="text-sm text-slate-600">
                  {lang === 'el' ? 'Σημασία: Κορυφαίος influencer με εξαιρετική φήμη' : 'Meaning: Top influencer with excellent reputation'}
                </p>
              </div>

              {/* VIP Badge */}
              <div className="border border-yellow-400 rounded-lg p-4 bg-yellow-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">👑</span>
                  <h4 className="font-bold text-yellow-900 m-0">VIP</h4>
                </div>
                <p className="text-sm text-slate-700 mb-2">
                  <strong>{lang === 'el' ? 'Πότε αποκτάται:' : 'When earned:'}</strong> {lang === 'el' ? '1M+ followers ή min_rate >5000€ ή 50+ συνεργασίες με rating >4.8' : '1M+ followers or min_rate >5000€ or 50+ collaborations with rating >4.8'}
                </p>
                <p className="text-sm text-slate-600">
                  {lang === 'el' ? 'Σημασία: Premium influencer, top tier' : 'Meaning: Premium influencer, top tier'}
                </p>
              </div>
            </div>
          </section>

          {/* Availability, trust, rate card, metrics */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <SectionHeading id="profile" icon={icons.profile}>
              {lang === 'el' ? 'Προφίλ, κατάλογος & εμπιστοσύνη' : 'Profile, directory & trust'}
            </SectionHeading>
            <p className="text-slate-600 mb-6">
              {lang === 'el'
                ? 'Νέες λειτουργίες που βοηθούν brands να βρίσκουν διαθέσιμους creators και να αξιολογούν προφίλ με διαφάνεια.'
                : 'New features that help brands find available creators and evaluate profiles with more transparency.'}
            </p>

            <div className="grid md:grid-cols-2 gap-4 my-6">
              <div className="border border-emerald-200 rounded-xl p-5 bg-emerald-50/80">
                <h3 className="font-bold text-emerald-900 mt-0 mb-2">
                  {lang === 'el' ? 'Διαθεσιμότητα' : 'Availability'}
                </h3>
                <ul className="text-sm text-slate-700 space-y-2 list-disc list-inside mb-0">
                  <li>
                    {lang === 'el'
                      ? 'Influencer: Dashboard → Προφίλ → «Διαθέσιμος» ή «Μη διαθέσιμος προσωρινά».'
                      : 'Influencer: Dashboard → Profile → Available or Temporarily unavailable.'}
                  </li>
                  <li>
                    {lang === 'el'
                      ? 'Η κατάσταση εμφανίζεται στο δημόσιο προφίλ και στις κάρτες καταλόγου.'
                      : 'Status appears on the public profile and directory cards.'}
                  </li>
                  <li>
                    {lang === 'el'
                      ? 'Brand: φίλτρο διαθεσιμότητας στον Κατάλογο (προεπιλογή: διαθέσιμοι).'
                      : 'Brand: availability filter in the Directory (default: available).'}
                  </li>
                </ul>
              </div>

              <div className="border border-amber-200 rounded-xl p-5 bg-amber-50/80">
                <h3 className="font-bold text-amber-900 mt-0 mb-2">
                  {lang === 'el' ? 'Σήματα εμπιστοσύνης' : 'Trust signals'}
                </h3>
                <ul className="text-sm text-slate-700 space-y-2 list-disc list-inside mb-0">
                  <li>
                    {lang === 'el'
                      ? 'Στις κάρτες καταλόγου μπορεί να εμφανιστεί «Ιδιωτικό» (ιδιωτικός λογαριασμός), «Ύποπτο ER» (υπερβολικό ή έντονα διορθωμένο ποσοστό), «Εκτίμηση» (κρυφά likes) ή «Λίγα δεδομένα» (πολύ λίγα posts).'
                      : 'Directory cards may show Private, Suspicious ER (an extreme or sharply reduced rate), Estimate (hidden likes), or Few posts.'}
                  </li>
                  <li>
                    {lang === 'el'
                      ? 'Σκοπός: καλύτερη αξιολόγηση πριν την επαφή — όχι τιμωρία του creator.'
                      : 'Goal: better evaluation before outreach — not to punish the creator.'}
                  </li>
                </ul>
              </div>

              <div className="border border-blue-200 rounded-xl p-5 bg-blue-50/80">
                <h3 className="font-bold text-blue-900 mt-0 mb-2">
                  {lang === 'el' ? 'Rate card (τιμές πακέτων)' : 'Rate card (package prices)'}
                </h3>
                <ul className="text-sm text-slate-700 space-y-2 list-disc list-inside mb-0">
                  <li>
                    {lang === 'el'
                      ? 'Κατά την εγγραφή ή από το Dashboard μπορείτε να ορίσετε τιμές (π.χ. Story, Post, Reel).'
                      : 'At signup or from the Dashboard you can set prices (e.g. Story, Post, Reel).'}
                  </li>
                  <li>
                    {lang === 'el'
                      ? 'Αποθηκεύονται στο προφίλ ώστε τα brands να συγκρίνουν πακέτα πέρα από το ελάχιστο rate.'
                      : 'Saved on the profile so brands can compare packages beyond a minimum rate.'}
                  </li>
                </ul>
              </div>

              <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
                <h3 className="font-bold text-slate-900 mt-0 mb-2">
                  {lang === 'el' ? 'Χρόνος απάντησης & ολοκλήρωση' : 'Response time & completion'}
                </h3>
                <ul className="text-sm text-slate-700 space-y-2 list-disc list-inside mb-0">
                  <li>
                    {lang === 'el'
                      ? 'Υπολογίζονται από πραγματική δραστηριότητα (μηνύματα / προσφορές), όχι από σταθερό «24h».'
                      : 'Computed from real activity (messages / proposals), not a fixed “24h”.'}
                  </li>
                  <li>
                    {lang === 'el'
                      ? 'Αν δεν υπάρχουν αρκετά δεδομένα, εμφανίζεται «—».'
                      : 'If there isn’t enough data, you’ll see “—”.'}
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <h4 className="font-bold text-slate-900 mb-2 mt-0">
                {lang === 'el' ? 'Shortlist brands («Οι influencers μου»)' : 'Brand shortlist (“My influencers”)'}
              </h4>
              <p className="text-sm text-slate-700 mb-0">
                {lang === 'el'
                  ? 'Από προτάσεις ή προφίλ, τα brands μπορούν να αποθηκεύσουν creators με σημείωση και να τους ανοίξουν αργότερα από το Brand Dashboard → tab shortlist / «Οι influencers μου».'
                  : 'From recommendations or a profile, brands can save creators with a note and open them later from Brand Dashboard → shortlist / “My influencers”.'}
              </p>
            </div>
          </section>

          {/* Proposals Section */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <SectionHeading id="proposals" icon={icons.proposals}>
              {lang === 'el' ? 'Προσφορές — Για Brands' : 'Proposals — For Brands'}
            </SectionHeading>

            <h3 className="text-xl font-bold text-slate-900 mt-6 mb-4">
              {lang === 'el' ? 'Πώς Δημιουργείτε Προσφορά' : 'How to Create a Proposal'}
            </h3>

            <NumberedSteps
              steps={
                lang === 'el'
                  ? [
                      'Αναζήτηση influencer: Κατάλογος → φίλτρα → κλικ στο προφίλ.',
                      'Στο προφίλ: «Συνεργασία» και φόρμα (υπηρεσία, budget, περιγραφή, deadline).',
                      'Αποστολή: η προσφορά πάει στον influencer· λαμβάνετε email ειδοποίησης.',
                    ]
                  : [
                      'Search influencer: Directory → filters → open profile.',
                      'On the profile: Collaborate and fill the form (service, budget, description, deadline).',
                      'Send: the proposal goes to the influencer; you get an email notification.',
                    ]
              }
            />

            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <h4 className="font-bold text-green-900 mb-3">
                {lang === 'el' ? 'Κατάσταση Προσφοράς' : 'Proposal Status'}
              </h4>
              <ul className="space-y-2 text-slate-700">
                <li><strong>Pending:</strong> {lang === 'el' ? 'Περιμένει απάντηση από τον influencer' : 'Waiting for influencer response'}</li>
                <li><strong>Accepted:</strong> {lang === 'el' ? 'Ο influencer αποδέχθηκε' : 'Influencer accepted'}</li>
                <li><strong>Counter-proposed:</strong> {lang === 'el' ? 'Ο influencer έκανε αντιπροσφορά' : 'Influencer made counter-proposal'}</li>
                <li><strong>Rejected:</strong> {lang === 'el' ? 'Ο influencer απέρριψε' : 'Influencer rejected'}</li>
                <li><strong>Completed:</strong> {lang === 'el' ? 'Η συνεργασία ολοκληρώθηκε' : 'Collaboration completed'}</li>
              </ul>
            </div>
          </section>

          {/* Brand campaigns & applications */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <SectionHeading id="campaigns" icon={icons.campaigns}>
              {lang === 'el' ? 'Καμπάνιες με αιτήσεις' : 'Campaigns with applications'}
            </SectionHeading>
            <p className="text-slate-600 mb-4 max-w-prose">
              {lang === 'el'
                ? 'Από το Brand Dashboard δημοσιεύετε καμπάνιες (τίτλος, περιγραφή, budget, προθεσμία) — δωρεάν, χωρίς προμήθεια. Όλοι βλέπουν τις ανοιχτές καμπάνιες στη δημόσια σελίδα Καμπάνιες (/campaigns)· αίτηση κάνουν μόνο οι εγκεκριμένοι influencers.'
                : 'From the Brand Dashboard you publish campaigns (title, description, budget, deadline) — free, no commission. Everyone can browse open campaigns on the public Campaigns page (/en/campaigns); only approved influencers can apply.'}
            </p>
            <p className="text-slate-700 mb-6 max-w-prose">
              {lang === 'el'
                ? 'Η αίτηση περιλαμβάνει προτεινόμενη τιμή, links προηγούμενης δουλειάς (μόνο από social δίκτυα, π.χ. Instagram/TikTok/YouTube) και προαιρετικό μήνυμα.'
                : 'An application includes a proposed rate, links to past work (social networks only, e.g. Instagram/TikTok/YouTube) and an optional message.'}
            </p>

            <h3 className="text-lg font-semibold text-slate-900 mt-8 mb-3">
              {lang === 'el' ? 'Ροή αίτησης' : 'Application flow'}
            </h3>
            <NumberedSteps
              steps={
                lang === 'el'
                  ? [
                      'Το brand δημοσιεύει καμπάνια με κατάσταση «Ανοιχτή».',
                      'Ο εγκεκριμένος influencer υποβάλλει αίτηση (τιμή, social links δουλειάς, προαιρετικό μήνυμα).',
                      'Το brand ενημερώνει την κατάσταση και μπορεί να μιλήσει μέσω μηνυμάτων Influo.',
                    ]
                  : [
                      'The brand publishes a campaign with status Open.',
                      'An approved influencer applies (rate, social work links, optional message).',
                      'The brand updates status and can message via Influo.',
                    ]
              }
            />

            <h3 className="text-lg font-semibold text-slate-900 mt-8 mb-3">
              {lang === 'el' ? 'Τι λαμβάνετε εσείς ως brand' : 'What you get as a brand'}
            </h3>
            <p className="text-slate-700 mb-4 max-w-prose">
              {lang === 'el'
                ? 'Για κάθε καμπάνια βλέπετε λίστα με τις αιτήσεις. Μπορείτε να αλλάξετε την κατάσταση κάθε αίτησης από το μενού κατάστασης (δίπλα στον influencer).'
                : 'For each campaign you see a list of applications. You can change each application’s status from the status menu (next to the influencer).'}
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 mb-6">
              <h4 className="font-semibold text-slate-900 mb-3">
                {lang === 'el' ? 'Καταστάσεις αίτησης' : 'Application statuses'}
              </h4>
              <ul className="space-y-3 list-none pl-0 mb-0">
                <StatusPill
                  label={lang === 'el' ? 'Εκκρεμεί' : 'Pending'}
                  tone="bg-amber-100 text-amber-900"
                  desc={lang === 'el' ? 'Η αίτηση μόλις υποβλήθηκε· ο influencer περιμένει απάντηση.' : 'Just submitted; the influencer is waiting for your response.'}
                />
                <StatusPill
                  label={lang === 'el' ? 'Σε λίστα' : 'Shortlisted'}
                  tone="bg-emerald-100 text-emerald-800"
                  desc={lang === 'el' ? 'Θετικό ενδιαφέρον για περαιτέρω συζήτηση ή συνεργασία.' : 'Positive interest for further discussion or collaboration.'}
                />
                <StatusPill
                  label={lang === 'el' ? 'Απόρριψη' : 'Rejected'}
                  tone="bg-rose-100 text-rose-800"
                  desc={lang === 'el' ? 'Η αίτηση δεν προχωρά για αυτή την καμπάνια.' : 'The application will not proceed for this campaign.'}
                />
                <StatusPill
                  label={lang === 'el' ? 'Αποσύρθηκε' : 'Withdrawn'}
                  tone="bg-slate-200 text-slate-700"
                  desc={lang === 'el' ? 'Ο influencer απέσυρε την αίτηση — χωρίς ενέργεια από εσάς.' : 'The influencer withdrew — no action needed from you.'}
                />
              </ul>
            </div>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mb-6 max-w-prose">
              <li>
                {lang === 'el'
                  ? 'Κουμπί για άμεσο μήνυμα στον influencer από την αίτηση.'
                  : 'A button to message the influencer directly from an application.'}
              </li>
              <li>
                {lang === 'el'
                  ? 'Ειδοποίηση push (αν ενεργοποιημένη) και email όταν υπάρχει νέα αίτηση.'
                  : 'Push (if enabled) and email when there is a new application.'}
              </li>
            </ul>

            <h3 className="text-lg font-semibold text-slate-900 mt-8 mb-3">
              {lang === 'el' ? 'Παράδοση περιεχομένου' : 'Content deliverables'}
            </h3>
            <NumberedSteps
              steps={
                lang === 'el'
                  ? [
                      'Brand: θέτει την αίτηση σε «Σε λίστα».',
                      'Influencer (Dashboard → Καμπάνιες → Οι αιτήσεις μου): υποβάλλει URL παράδοσης + προαιρετική σημείωση.',
                      'Brand: εγκρίνει ή ζητά αλλαγές· ο influencer μπορεί να επανυποβάλει.',
                    ]
                  : [
                      'Brand: sets the application to Shortlisted.',
                      'Influencer (Dashboard → Campaigns → My applications): submits a deliverable URL + optional note.',
                      'Brand: approves or requests changes; the influencer can resubmit.',
                    ]
              }
            />

            <h3 className="text-lg font-semibold text-slate-900 mt-8 mb-3">
              {lang === 'el' ? 'Διάρκεια & κλείσιμο καμπάνιας' : 'Duration & campaign close'}
            </h3>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mb-6 max-w-prose">
              <li>
                {lang === 'el'
                  ? 'Η καμπάνια κλείνει αυτόματα στην προθεσμία της. Αν δεν έχει προθεσμία, κλείνει 30 μέρες μετά το άνοιγμα. Η κάρτα δείχνει «Κλείνει αυτόματα σε N μέρες» ή «Λήγει σε…».'
                  : 'The campaign closes automatically on its deadline. With no deadline, it closes 30 days after opening. The card shows “Closes automatically in N days” or “Ends in…”.'}
              </li>
              <li>
                {lang === 'el'
                  ? '3 μέρες πριν το κλείσιμο, το brand λαμβάνει υπενθύμιση με email. Όταν κλείσει, ενημερώνονται με email το brand και οι influencers που έχουν αίτηση σε εκκρεμότητα.'
                  : 'Three days before close, the brand gets an email reminder. When it closes, the brand and influencers with a pending application are emailed.'}
              </li>
              <li>
                {lang === 'el'
                  ? 'Οι καμπάνιες που έχουν λήξει δεν εμφανίζονται στη δημόσια λίστα.'
                  : 'Expired campaigns do not appear on the public list.'}
              </li>
              <li>
                {lang === 'el'
                  ? 'Οι καμπάνιες δεν διαγράφονται, μόνο κλείνουν. Για να την ξανανοίξει, το brand την επεξεργάζεται και βάζει κατάσταση «Ανοιχτή», οπότε ξεκινά νέο 30ήμερο. Αν η προθεσμία είχε περάσει, ανοίγει αυτόματα για 30 μέρες.'
                  : 'Campaigns are not deleted — only closed. To reopen, the brand edits it and sets status to Open, starting a new 30-day window. If the deadline had passed, it opens automatically for 30 days.'}
              </li>
            </ul>

            <h3 className="text-lg font-semibold text-slate-900 mt-8 mb-3">
              {lang === 'el' ? 'Κανόνες περιεχομένου' : 'Content rules'}
            </h3>
            <p className="text-slate-700 mb-6 max-w-prose">
              {lang === 'el'
                ? 'Στα κείμενα της καμπάνιας και στα μηνύματα των αιτήσεων δεν επιτρέπονται links, email και τηλέφωνα. Η επικοινωνία γίνεται με τα μηνύματα του Influo. Μόνο τα links δουλειάς από social δίκτυα επιτρέπονται στην αίτηση.'
                : 'Campaign text and application messages may not include links, emails, or phone numbers. Communication happens through Influo messages. Only social-network work links are allowed on the application.'}
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-8">
              <Link
                href={lang === 'en' ? '/en/campaigns' : '/campaigns'}
                className="inline-flex justify-center px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                {txt.see_campaigns}
              </Link>
              <Link
                href="/brand/dashboard?tab=campaigns"
                className="inline-flex justify-center px-5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-900 text-sm font-semibold border border-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                {txt.manage_campaigns}
              </Link>
            </div>
          </section>

          {/* Influencer tools */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <SectionHeading id="influencer-tools" icon={icons.tools}>
              {lang === 'el' ? 'Εργαλεία Influencer' : 'Influencer tools'}
            </SectionHeading>
            <p className="text-slate-600 mb-6">
              {lang === 'el'
                ? 'Μετά την έγκριση του προφίλ σας, ανοίξτε Dashboard → tab «Εργαλεία» (ή /dashboard?tab=tools). Εκεί έχετε ό,τι χρειάζεστε για να μοιραστείτε το Influo προφίλ σας με brands.'
                : 'After your profile is approved, open Dashboard → “Tools” tab (or /dashboard?tab=tools). Everything you need to share your Influo profile with brands is there.'}
            </p>

            <div className="grid md:grid-cols-2 gap-4 my-6">
              <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
                <h3 className="font-bold text-slate-900 mt-0 mb-2">
                  {lang === 'el' ? 'Προσωπικό link' : 'Personal profile link'}
                </h3>
                <ul className="text-sm text-slate-700 space-y-2 list-disc list-inside mb-0">
                  <li>
                    {lang === 'el'
                      ? 'Αντιγράψτε το δημόσιο URL του προφίλ σας και βάλτε το στο bio Instagram / TikTok.'
                      : 'Copy your public profile URL and put it in your Instagram / TikTok bio.'}
                  </li>
                  <li>
                    {lang === 'el'
                      ? 'Μπορείτε να ορίσετε σύντομο όνομα (slug): influo.gr/in/το-ονόμα-σας (λατινικοί χαρακτήρες).'
                      : 'You can set a short slug: influo.gr/in/your-name (Latin characters).'}
                  </li>
                  <li>
                    {lang === 'el'
                      ? 'Έτοιμο κείμενο για bio: αντιγραφή με ένα κλικ μαζί με το link.'
                      : 'Ready-made bio text: one-click copy together with the link.'}
                  </li>
                </ul>
              </div>

              <div className="border border-indigo-200 rounded-xl p-5 bg-indigo-50/80">
                <h3 className="font-bold text-indigo-900 mt-0 mb-2">QR code</h3>
                <ul className="text-sm text-slate-700 space-y-2 list-disc list-inside mb-0">
                  <li>
                    {lang === 'el'
                      ? 'Σαρώσιμο QR που οδηγεί στο Influo προφίλ σας.'
                      : 'Scannable QR that opens your Influo profile.'}
                  </li>
                  <li>
                    {lang === 'el'
                      ? 'Κατεβάστε PNG για stories, media kit ή εκδηλώσεις.'
                      : 'Download a PNG for stories, media kits, or events.'}
                  </li>
                </ul>
              </div>

              <div className="border border-blue-200 rounded-xl p-5 bg-blue-50/80 md:col-span-2">
                <h3 className="font-bold text-blue-900 mt-0 mb-2">Media kit PDF</h3>
                <ul className="text-sm text-slate-700 space-y-2 list-disc list-inside mb-0">
                  <li>
                    {lang === 'el'
                      ? 'Από «Άνοιγμα media kit» ανοίγει μία σελίδα με φωτο, bio, socials, τιμές και το Influo link.'
                      : '“Open media kit” opens a one-pager with photo, bio, socials, rates, and your Influo link.'}
                  </li>
                  <li>
                    {lang === 'el'
                      ? 'Στον browser: Εκτύπωση → «Αποθήκευση ως PDF» για να το στείλετε σε brands.'
                      : 'In the browser: Print → “Save as PDF” to send to brands.'}
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <p className="text-sm text-slate-700 mb-0">
                {lang === 'el'
                  ? 'Σημείωση: πριν την έγκριση του προφίλ, το tab Εργαλεία εμφανίζει μήνυμα ότι το link θα ενεργοποιηθεί μόλις είστε live.'
                  : 'Note: before profile approval, the Tools tab explains that your link activates once you are live.'}
              </p>
            </div>
          </section>

          {/* Brand tools */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <SectionHeading id="brand-tools" icon={icons.tools}>
              {lang === 'el' ? 'Εργαλεία Brand' : 'Brand tools'}
            </SectionHeading>
            <p className="text-slate-600 mb-6">
              {lang === 'el'
                ? 'Στο Brand Dashboard → tab «Εργαλεία» (/brand/dashboard?tab=tools) έχετε βοηθήματα καμπάνιας. Πολλά δουλεύουν με τη shortlist («Οι influencers μου»). Με τα βέλη ↑ ↓ αλλάζετε τη σειρά των καρτών· «Επαναφορά σειράς» επαναφέρει την προεπιλογή. Checklist, ROI και snippets αποθηκεύονται στον browser σας για το συγκεκριμένο brand.'
                : 'In Brand Dashboard → “Tools” (/brand/dashboard?tab=tools) you get campaign helpers. Many use your shortlist (“My influencers”). Use ↑ ↓ to reorder cards; “Reset order” restores the default. Checklist, ROI, and snippets are saved in your browser for that brand.'}
            </p>

            <div className="space-y-4 my-6">
              {[
                {
                  title: { el: 'Budget estimator', en: 'Budget estimator' },
                  body: {
                    el: 'Ορίζει μονάδες ανά creator και υπολογίζει εκτίμηση «από» βάσει των ελάχιστων τιμών στη shortlist. Αντιγραφή σύνοψης με ένα κλικ.',
                    en: 'Set units per creator and get a “from” estimate using minimum rates on your shortlist. One-click copy of the summary.',
                  },
                },
                {
                  title: { el: 'Export shortlist', en: 'Export shortlist' },
                  body: {
                    el: 'Εξαγωγή CSV ή εκτύπωση / PDF της λίστας creators (όνομα, κατηγορία, followers, ER, τιμές, σημειώσεις).',
                    en: 'Export CSV or print / PDF your creator list (name, category, followers, ER, rates, notes).',
                  },
                },
                {
                  title: { el: 'Σύγκριση creators', en: 'Compare creators' },
                  body: {
                    el: 'Επιλέξτε έως 4 από τη shortlist και συγκρίνετε δίπλα-δίπλα κατηγορία, followers, ER, τιμή, χρόνο απάντησης και completion.',
                    en: 'Pick up to 4 from the shortlist and compare category, followers, ER, rate, response time, and completion side by side.',
                  },
                },
                {
                  title: { el: 'Campaign checklist', en: 'Campaign checklist' },
                  body: {
                    el: 'Τσεκάρετε βήματα (brief, budget, creators, deliverables, UTM, όροι) πριν το launch.',
                    en: 'Tick steps (brief, budget, creators, deliverables, UTM, terms) before launch.',
                  },
                },
                {
                  title: { el: 'UTM builder', en: 'UTM builder' },
                  body: {
                    el: 'Φτιάξτε tracking links με source / medium / campaign και αντιγράψτε τα για stories ή bio.',
                    en: 'Build tracking links with source / medium / campaign and copy them for stories or bio.',
                  },
                },
                {
                  title: { el: 'Campaign brief', en: 'Campaign brief' },
                  body: {
                    el: 'Συμπληρώστε στόχο, κοινό, deliverables και χρονοδιάγραμμα· αντιγράψτε έτοιμο κείμενο brief για μηνύματα ή καμπάνιες.',
                    en: 'Fill goal, audience, deliverables, and timeline; copy a ready brief for messages or campaigns.',
                  },
                },
                {
                  title: { el: 'ROI / αποτελέσματα', en: 'ROI / results log' },
                  body: {
                    el: 'Καταγράψτε spend και αποτελέσματα ανά καμπάνια τοπικά στον browser για γρήγορη υπενθύμιση απόδοσης.',
                    en: 'Log spend and results per campaign locally in the browser for a quick performance reminder.',
                  },
                },
                {
                  title: { el: 'Brand kit', en: 'Brand kit' },
                  body: {
                    el: 'Εκτύπωση / PDF με στοιχεία brand και shortlist — χρήσιμο για εσωτερική έγκριση ή παρουσίαση. Στο παράθυρο πατήστε Εκτύπωση / Αποθήκευση ως PDF.',
                    en: 'Print / PDF with brand details and shortlist — useful for internal approval or decks. In the window use Print / Save as PDF.',
                  },
                },
                {
                  title: { el: 'Έτοιμα μηνύματα', en: 'Message snippets' },
                  body: {
                    el: 'Πρότυπα για πρώτη επαφή, διαπραγμάτευση, υπενθύμιση deliverable και έγκριση. Αντιγράψτε και επεξεργαστείτε πριν την αποστολή.',
                    en: 'Templates for outreach, negotiation, deliverable reminder, and approval. Copy and edit before sending.',
                  },
                },
              ].map((item) => (
                <div key={item.title.en} className="border border-slate-200 rounded-xl p-5 bg-white">
                  <h3 className="font-bold text-slate-900 mt-0 mb-2">{item.title[lang]}</h3>
                  <p className="text-sm text-slate-700 mb-0">{item.body[lang]}</p>
                </div>
              ))}
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <h4 className="font-bold text-green-900 mb-2 mt-0">
                {lang === 'el' ? 'Συμβουλή ροής εργασίας' : 'Workflow tip'}
              </h4>
              <p className="text-sm text-slate-700 mb-0">
                {lang === 'el'
                  ? 'Προσθέστε creators στη shortlist → συγκρίνετε / budget → brief & checklist → UTM → επικοινωνία με snippets → brand kit για έγκριση → καταγραφή ROI.'
                  : 'Add creators to the shortlist → compare / budget → brief & checklist → UTM → outreach with snippets → brand kit for approval → log ROI.'}
              </p>
            </div>
          </section>

          {/* Counter-Proposal Section */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <SectionHeading id="counter" icon={icons.counter}>
              {lang === 'el' ? 'Αντιπροσφορά — Για Influencers' : 'Counter-proposal — For Influencers'}
            </SectionHeading>

            <h3 className="text-xl font-bold text-slate-900 mt-6 mb-4">
              {lang === 'el' ? 'Πώς Κάνετε Αντιπροσφορά' : 'How to Make Counter-Proposal'}
            </h3>

            <NumberedSteps
              steps={
                lang === 'el'
                  ? [
                      'Dashboard → Proposals: δείτε τις προσφορές.',
                      'Επιλέξτε Αποδοχή, Αντιπροσφορά ή Μήνυμα.',
                      'Στην αντιπροσφορά συμπληρώστε νέο budget και μήνυμα· το brand αποδέχεται ή απορρίπτει.',
                    ]
                  : [
                      'Dashboard → Proposals: review offers.',
                      'Choose Accept, Counter-propose, or Message.',
                      'For a counter, set a new budget and message; the brand accepts or rejects.',
                    ]
              }
            />

            <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
              <h4 className="font-semibold text-purple-900 mb-3">
                {lang === 'el' ? 'Συμβουλές για αντιπροσφορές' : 'Tips for counter-proposals'}
              </h4>
              <ul className="space-y-2 text-slate-700 list-disc list-inside">
                <li>{lang === 'el' ? 'Ζητήστε δίκαιες τιμές βάσει του engagement rate και των followers σας' : 'Request fair prices based on your engagement rate and followers'}</li>
                <li>{lang === 'el' ? 'Εξηγήστε γιατί ζητάτε περισσότερο (π.χ. περισσότερο content, exclusivity)' : 'Explain why you\'re asking for more (e.g., more content, exclusivity)'}</li>
                <li>{lang === 'el' ? 'Είστε ευγενικοί - η αντιπροσφορά είναι συνήθης πρακτική' : 'Be polite - counter-proposal is common practice'}</li>
              </ul>
            </div>
          </section>

          {/* Agreement Section */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <SectionHeading id="agreement" icon={icons.agreement}>
              {lang === 'el' ? 'Συμφωνία συνεργασίας' : 'Collaboration agreement'}
            </SectionHeading>

            <div className="grid md:grid-cols-2 gap-6 my-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h3 className="font-bold text-blue-900 mb-4">
                  {lang === 'el' ? 'Για Influencers' : 'For Influencers'}
                </h3>
                <ol className="list-decimal list-inside space-y-3 text-slate-700 text-sm">
                  <li>{lang === 'el' ? 'Όταν αποδέχεστε προσφορά, εμφανίζεται modal με όρους' : 'When accepting proposal, terms modal appears'}</li>
                  <li>{lang === 'el' ? 'Διαβάστε προσεκτικά, ελέγξτε checkbox, αποδεχτείτε' : 'Read carefully, check checkbox, accept'}</li>
                  <li>{lang === 'el' ? 'Το brand προστίθεται στο Past Brands (αν και οι δύο αποδεχτούν)' : 'Brand added to Past Brands (if both accept)'}</li>
                </ol>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <h3 className="font-bold text-green-900 mb-4">
                  {lang === 'el' ? 'Για Brands' : 'For Brands'}
                </h3>
                <ol className="list-decimal list-inside space-y-3 text-slate-700 text-sm">
                  <li>{lang === 'el' ? 'Παίρνετε email όταν ο influencer αποδέχεται' : 'You receive email when influencer accepts'}</li>
                  <li>{lang === 'el' ? 'Brand Dashboard → Proposals → Pending agreements' : 'Brand Dashboard → Proposals → Pending agreements'}</li>
                  <li>{lang === 'el' ? 'Αποδεχτείτε τους όρους, η συνεργασία είναι επίσημη' : 'Accept terms, collaboration is official'}</li>
                </ol>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h4 className="font-semibold text-amber-900 mb-2">{lang === 'el' ? 'Σημαντικό' : 'Important'}</h4>
              <p className="text-slate-700">
                {lang === 'el' 
                  ? 'Και οι δύο πλευρές πρέπει να αποδεχτούν τους όρους. Μόνο τότε η συνεργασία προστίθεται στο Past Brands. Οι όροι προστατεύουν και τις δύο πλευρές.'
                  : 'Both parties must accept terms. Only then collaboration is added to Past Brands. Terms protect both parties.'}
              </p>
            </div>
          </section>

          {/* Messaging Section */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <SectionHeading id="messages" icon={icons.messages}>
              {lang === 'el' ? 'Σύστημα μηνυμάτων' : 'Messaging system'}
            </SectionHeading>

            <h3 className="text-xl font-bold text-slate-900 mt-6 mb-4">
              {lang === 'el' ? 'Πώς Στέλνετε Μήνυμα' : 'How to Send Message'}
            </h3>

            <ul className="list-disc list-inside space-y-3 text-slate-700 mb-6">
              <li>{lang === 'el' ? 'Από Profile Page (brand): Κάντε κλικ στο "Μήνυμα" ή "Ρώτησε", γράψτε και στείλτε' : 'From Profile Page (brand): Click "Message" or "Ask", write and send'}</li>
              <li>{lang === 'el' ? 'Από Dashboard: Influencers → Messages, Brands → Conversations / Messages' : 'From Dashboard: Influencers → Messages, Brands → Conversations / Messages'}</li>
              <li>{lang === 'el' ? 'Οι influencers απαντούν σε υπάρχουσα συνομιλία (δεν ξεκινούν cold message σε τυχαίο brand).' : 'Influencers reply in an existing thread (they do not cold-message arbitrary brands).'}</li>
            </ul>

            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
              <h4 className="font-bold text-indigo-900 mb-3">
                {lang === 'el' ? 'Χαρακτηριστικά' : 'Features'}
              </h4>
              <ul className="space-y-2 text-slate-700 list-disc list-inside mb-0">
                <li>{lang === 'el' ? 'Real-time messaging: Άμεση επικοινωνία' : 'Real-time messaging: Instant communication'}</li>
                <li>{lang === 'el' ? 'Attachments: εικόνες ή PDF (έως 10MB) με το κουμπί 📎 στο chat — briefs και drafts' : 'Attachments: images or PDFs (up to 10MB) via the 📎 button — briefs and drafts'}</li>
                <li>{lang === 'el' ? 'Notifications: Email και προαιρετικά push για νέα μηνύματα' : 'Notifications: Email and optional push for new messages'}</li>
                <li>{lang === 'el' ? 'Proposal linking: Μηνύματα συνδέονται με προσφορές όπου ισχύει' : 'Proposal linking: Messages linked to proposals where relevant'}</li>
              </ul>
            </div>
          </section>

          {/* Reviews Section */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <SectionHeading id="reviews" icon={icons.reviews}>
              {lang === 'el' ? 'Reviews & Ratings' : 'Reviews & Ratings'}
            </SectionHeading>

            <div className="grid md:grid-cols-2 gap-6 my-6">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
                <h3 className="font-bold text-purple-900 mb-4">
                  {lang === 'el' ? 'Για Brands - Πώς Αφήνετε Review' : 'For Brands - How to Leave Review'}
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-slate-700 text-sm">
                  <li>{lang === 'el' ? 'Μετά την ολοκλήρωση, μεταβείτε στο profile του influencer' : 'After completion, go to influencer profile'}</li>
                  <li>{lang === 'el' ? 'Tab "Reviews" → "Αφήστε Review"' : 'Tab "Reviews" → "Leave Review"'}</li>
                  <li>{lang === 'el' ? 'Συμπληρώστε: Rating (1-5), Review Text, Project Type' : 'Fill: Rating (1-5), Review Text, Project Type'}</li>
                </ol>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h3 className="font-bold text-blue-900 mb-4">
                  {lang === 'el' ? 'Για Influencers' : 'For Influencers'}
                </h3>
                <ul className="space-y-2 text-slate-700 text-sm list-disc list-inside">
                  <li>{lang === 'el' ? 'Δείτε τα reviews σας στο profile page' : 'View your reviews on profile page'}</li>
                  <li>{lang === 'el' ? 'Average Rating εμφανίζεται στα statistics' : 'Average Rating shown in statistics'}</li>
                  <li>{lang === 'el' ? 'Καλά reviews = περισσότερες προσφορές' : 'Good reviews = more proposals'}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Tips Section */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <SectionHeading id="tips" icon={icons.tips}>
              {lang === 'el' ? 'Συμβουλές για επιτυχία' : 'Tips for success'}
            </SectionHeading>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                <h3 className="font-bold text-blue-900 mb-4">
                  {lang === 'el' ? 'Για Influencers' : 'For Influencers'}
                </h3>
                <ul className="space-y-3 text-slate-700 text-sm list-disc list-inside">
                  <li>{lang === 'el' ? 'Συμπληρώστε το Profile: bio, avatar, rate card, ρεαλιστικές τιμές' : 'Complete Profile: bio, avatar, rate card, realistic pricing'}</li>
                  <li>{lang === 'el' ? 'Ορίστε διαθεσιμότητα όταν είστε ανοιχτοί σε deals' : 'Set availability when you are open to deals'}</li>
                  <li>{lang === 'el' ? 'Βάλτε το Influo link στο bio (Dashboard → Εργαλεία) και μοιραστείτε QR / media kit' : 'Put your Influo link in your bio (Dashboard → Tools) and share QR / media kit'}</li>
                  <li>{lang === 'el' ? 'Καλή Απόδοση: Υψηλό engagement, consistent posting' : 'Good Performance: High engagement, consistent posting'}</li>
                  <li>{lang === 'el' ? 'Επαγγελματική Συμπεριφορά: γρήγορες απαντήσεις, παράδοση σε καμπάνιες όταν είστε shortlisted' : 'Professional Behavior: fast replies, deliver on campaigns when shortlisted'}</li>
                  <li>{lang === 'el' ? 'Αξιολόγηση: Ζητήστε reviews, καλά reviews = περισσότερες προσφορές' : 'Evaluation: Request reviews, good reviews = more proposals'}</li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                <h3 className="font-bold text-green-900 mb-4">
                  {lang === 'el' ? 'Για Brands' : 'For Brands'}
                </h3>
                <ul className="space-y-3 text-slate-700 text-sm list-disc list-inside">
                  <li>{lang === 'el' ? 'Καλή Αναζήτηση: φίλτρα (διαθεσιμότητα, engagement, reviews), trust signals' : 'Good Search: filters (availability, engagement, reviews), trust signals'}</li>
                  <li>{lang === 'el' ? 'Αποθηκεύστε υποψηφίους στη shortlist με σημειώσεις' : 'Save candidates to your shortlist with notes'}</li>
                  <li>{lang === 'el' ? 'Χρησιμοποιήστε Εργαλεία: σύγκριση, budget, brief, checklist, UTM, brand kit' : 'Use Tools: compare, budget, brief, checklist, UTM, brand kit'}</li>
                  <li>{lang === 'el' ? 'Σαφείς Προσφορές / καμπάνιες: brief, budget, deadline, deliverables' : 'Clear Proposals / campaigns: brief, budget, deadline, deliverables'}</li>
                  <li>{lang === 'el' ? 'Επικοινωνία: απαντήστε εγκαίρως, χρησιμοποιήστε attachments για briefs' : 'Communication: reply promptly, use attachments for briefs'}</li>
                  <li>{lang === 'el' ? 'Αξιολόγηση: αφήστε reviews μετά την ολοκλήρωση' : 'Evaluation: leave reviews after completion'}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* FAQ Section — accordion */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <SectionHeading id="faq" icon={icons.faq}>
              {lang === "el" ? "Συχνές ερωτήσεις (FAQ)" : "Frequently asked questions (FAQ)"}
            </SectionHeading>
            <p className="text-slate-600 text-sm mb-8 max-w-2xl">
              {lang === "el"
                ? "Πατήστε μια ερώτηση για να δείτε την απάντηση. Όλες οι απαντήσεις είναι ενδεικτικές· για λεπτομέρειες ισχύουν οι όροι χρήσης και η πολιτική απορρήτου."
                : "Tap a question to reveal the answer. Answers are indicative; the Terms of Service and Privacy Policy apply for details."}
            </p>

            <div className="max-w-3xl space-y-2">
              {FAQ_ITEMS.map((item, i) => {
                const open = openFaqIndex === i;
                return (
                  <div
                    key={i}
                    className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm transition-shadow hover:shadow-md"
                  >
                    <button
                      type="button"
                      id={`faq-trigger-${i}`}
                      aria-expanded={open}
                      aria-controls={`faq-panel-${i}`}
                      onClick={() => setOpenFaqIndex((prev) => (prev === i ? null : i))}
                      className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left font-semibold text-slate-900 transition-colors hover:bg-slate-50/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    >
                      <span className="min-w-0 flex-1 pt-0.5 leading-snug">{item.q[lang]}</span>
                      <FaChevronDown
                        className={`mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ease-out ${open ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </button>
                    <div
                      id={`faq-panel-${i}`}
                      role="region"
                      aria-labelledby={`faq-trigger-${i}`}
                      className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                          <p className="text-sm leading-relaxed text-slate-700">{item.a[lang]}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Support Section */}
          <section className="border-t border-slate-200 pt-12">
            <SectionHeading id="support" icon={icons.support}>
              {lang === 'el' ? 'Υποστήριξη' : 'Support'}
            </SectionHeading>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 md:p-8 text-center max-w-prose mx-auto">
              <p className="text-slate-700 mb-4">
                {lang === 'el' 
                  ? 'Για ερωτήσεις ή βοήθεια:'
                  : 'For questions or help:'}
              </p>
              <p className="text-lg font-semibold text-blue-700 mb-2">
                <a href="mailto:support@influo.gr" className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded">
                  support@influo.gr
                </a>
              </p>
              <p className="text-sm text-slate-600">
                {lang === 'el' 
                  ? 'Ώρες: Δευτέρα–Παρασκευή, 10:00–18:00 (ώρα Ελλάδας)'
                  : 'Hours: Monday–Friday, 10:00–18:00 (Greece time)'}
              </p>
            </div>
          </section>

            <div className="mt-10 pt-6 border-t border-slate-200 flex justify-center">
              <a
                href="#top"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
                {txt.back_top}
              </a>
            </div>

          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer lang={lang} />
    </div>
  );
}

