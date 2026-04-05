"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getStoredLanguage, setStoredLanguage } from "@/lib/language";
import Footer from "../../components/Footer";
import { FaChevronDown } from "react-icons/fa";

type Lang = "el" | "en";

const t = {
  el: {
    title: "Οδηγός Χρήστη",
    subtitle: "Για Influencers & Brands",
    back: "Επιστροφή",
    nav_home: "Αρχική",
  },
  en: {
    title: "User Guide",
    subtitle: "For Influencers & Brands",
    back: "Back",
    nav_home: "Home",
  }
};

type FaqEntry = { q: Record<Lang, string>; a: Record<Lang, string> };

/** 3 αρχικές + 13 νέες — συνολικά 16 ερωτήσεις */
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
      el: "Ελέγξτε το επαληθευμένο προφίλ (verified), ιστορικό reviews και μέσο rating, συνέπεια στο περιεχόμενο, ρεαλιστικό engagement σε σχέση με τους followers και χρόνο απόκρισης σε μηνύματα.",
      en: "Look for verification, reviews and average rating, content consistency, engagement that fits the audience size, and how quickly they respond in messages.",
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
      el: "Υποβάλλετε πλήρες προφίλ με αληθινά στοιχεία και συνδέσμους κοινωνικών δικτύων. Η ομάδα ελέγχει το αίτημα· μετά την έγκριση λαμβάνετε το σήμα επαλήθευσης και πρόσβαση σε λειτουργίες όπως οι ανοιχτές καμπάνιες.",
      en: "Complete your profile with accurate info and social links. Our team reviews applications; once approved you get the verified badge and access to features such as open campaigns.",
    },
  },
  {
    q: {
      el: "Τι είναι οι καμπάνιες και πώς κάνω αίτηση ως influencer;",
      en: "What are campaigns and how do I apply as an influencer?",
    },
    a: {
      el: "Οι καμπάνιες είναι briefs που δημοσιεύουν verified brands. Στο dashboard βλέπετε τις ανοιχτές καμπάνιες· μπορείτε να υποβάλετε αίτηση ενδιαφέροντος με προαιρετικό μήνυμα. Το brand βλέπει την αίτηση και ενημερώνει την κατάσταση (π.χ. εκκρεμεί, shortlist, απόρριψη).",
      en: "Campaigns are briefs published by verified brands. In your dashboard you’ll see open campaigns; you can submit an interest application with an optional message. The brand reviews it and updates status (e.g. pending, shortlisted, rejected).",
    },
  },
  {
    q: {
      el: "Πώς δημοσιεύω καμπάνια ως brand;",
      en: "How do I publish campaigns as a brand?",
    },
    a: {
      el: "Από το Brand Dashboard, στο tab Καμπάνιες, δημιουργείτε καμπάνια με τίτλο, περιγραφή, budget και προαιρετικά προθεσμία και deliverables. Το brand σας πρέπει να είναι επαληθευμένο. Όταν η κατάσταση είναι «Ανοιχτή», οι εγκεκριμένοι influencers τη βλέπουν και μπορούν να κάνουν αίτηση.",
      en: "From Brand Dashboard → Campaigns, create a campaign with title, description, budget, and optional deadline and deliverables. Your brand must be verified. When status is Open, approved influencers can see it and apply.",
    },
  },
  {
    q: {
      el: "Είναι δωρεάν η εγγραφή και η χρήση του Influo;",
      en: "Is signing up and using Influo free?",
    },
    a: {
      el: "Η εγγραφή και η βασική χρήση της πλατφόρμας (προφίλ, μηνύματα, προσφορές, καμπάνιες σύμφωνα με τους όρους) είναι διαθέσιμες χωρίς χρέωση από το Influo για τη σύνδεση brands και influencers. Ελέγξτε τους όρους χρήσης για εμπορικές λεπτομέρειες.",
      en: "Signing up and core platform use (profile, messages, proposals, campaigns per our terms) is available without an Influo connection fee. See the Terms of Service for commercial details.",
    },
  },
  {
    q: {
      el: "Πώς λειτουργούν τα μηνύματα και οι ειδοποιήσεις;",
      en: "How do messages and notifications work?",
    },
    a: {
      el: "Στέλνετε μηνύματα από προφίλ ή από το κέντρο συνομιλιών· οι συνομιλίες συνδέονται με προσφορές όπου ισχύει. Λαμβάνετε ειδοποιήσεις email για νέα μηνύματα και μπορείτε να ενεργοποιήσετε ειδοποιήσεις push στον browser για γρηγορότερη ενημέρωση.",
      en: "Message from profiles or your inbox; conversations can link to proposals where relevant. You get email notifications for new messages and can enable browser push for faster updates.",
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
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const txt = t[lang];

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 sm:px-6 py-4">
          <Link href={lang === "en" ? "/en" : "/"} className="flex items-center gap-2" aria-label="Influo Home">
            <Image 
              src="/logo.svg" 
              alt="Influo.gr Logo" 
              width={160} 
              height={64} 
              className="h-10 w-auto"
              priority
            />
          </Link>
          
          <nav className="flex items-center gap-6">
            <Link href={lang === "en" ? "/en" : "/"} className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
              {txt.nav_home}
            </Link>
            <button 
              onClick={() => {
                const newLang = lang === "el" ? "en" : "el";
                setLang(newLang);
                setStoredLanguage(newLang);
                if (newLang === "en") router.push("/en/docs");
                else router.push("/docs");
              }}
              className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors"
              aria-label="Toggle language"
            >
              {lang === "el" ? "EN" : "EL"}
            </button>
          </nav>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Title */}
        <div className="mb-8">
          <Link href={lang === "en" ? "/en" : "/"} className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {txt.back}
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-2">{txt.title}</h1>
          <p className="text-lg text-slate-600">{txt.subtitle}</p>
        </div>

        {/* Documentation Content */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 md:p-12 prose prose-slate max-w-none">
          
          {/* Badges System */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              <span className="text-4xl">🏆</span>
              {lang === 'el' ? 'Badges System' : 'Badges System'}
            </h2>
            <p className="text-slate-600 mb-6">
              {lang === 'el' 
                ? 'Το σύστημα badges μας αναγνωρίζει την ποιότητα και την απόδοση των influencers.'
                : 'Our badge system recognizes the quality and performance of influencers.'}
            </p>

            <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">
              {lang === 'el' ? 'Τύποι Badges' : 'Badge Types'}
            </h3>

            {/* Badge Cards */}
            <div className="grid md:grid-cols-2 gap-4 my-6">
              {/* New Badge */}
              <div className="border border-blue-200 rounded-xl p-4 bg-blue-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">✨</span>
                  <h4 className="font-bold text-blue-900 m-0">
                    {lang === 'el' ? 'Νέος (New)' : 'New'}
                  </h4>
                </div>
                <p className="text-sm text-slate-700 mb-2">
                  <strong>{lang === 'el' ? 'Πότε αποκτάται:' : 'When earned:'}</strong> {lang === 'el' ? 'Όταν το account είναι μικρότερο από 30 ημέρες' : 'When account is less than 30 days old'}
                </p>
                <p className="text-sm text-slate-600">
                  {lang === 'el' ? 'Σημασία: Νέος influencer στην πλατφόρμα' : 'Meaning: New influencer on the platform'}
                </p>
              </div>

              {/* Rising Badge */}
              <div className="border border-green-200 rounded-xl p-4 bg-green-50">
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

              {/* Verified Badge */}
              <div className="border border-blue-300 rounded-xl p-4 bg-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">✓</span>
                  <h4 className="font-bold text-blue-900 m-0">
                    {lang === 'el' ? 'Επαληθευμένος (Verified)' : 'Verified'}
                  </h4>
                </div>
                <p className="text-sm text-slate-700 mb-2">
                  <strong>{lang === 'el' ? 'Πότε αποκτάται:' : 'When earned:'}</strong> {lang === 'el' ? 'Μετά από manual verification από το admin team' : 'After manual verification by admin team'}
                </p>
                <p className="text-sm text-slate-600">
                  {lang === 'el' ? 'Σημασία: Επαληθευμένη ταυτότητα και αξιοπιστία. Αυτό το badge μένει μόνιμα μαζί με το άλλο badge.' : 'Meaning: Verified identity and credibility. This badge stays permanently along with the other badge.'}
                </p>
              </div>

              {/* Top Performer Badge */}
              <div className="border border-purple-300 rounded-xl p-4 bg-purple-100">
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
              <div className="border border-amber-300 rounded-xl p-4 bg-amber-100">
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
              <div className="border border-indigo-300 rounded-xl p-4 bg-indigo-100">
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
              <div className="border border-yellow-400 rounded-xl p-4 bg-gradient-to-r from-yellow-50 to-amber-50">
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

          {/* Proposals Section */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              <span className="text-4xl">💼</span>
              {lang === 'el' ? 'Προσφορές (Proposals) - Για Brands' : 'Proposals - For Brands'}
            </h2>

            <h3 className="text-xl font-bold text-slate-900 mt-6 mb-4">
              {lang === 'el' ? 'Πώς Δημιουργείτε Προσφορά' : 'How to Create a Proposal'}
            </h3>

            <ol className="list-decimal list-inside space-y-4 text-slate-700 mb-6">
              <li>
                <strong>{lang === 'el' ? 'Αναζήτηση Influencer:' : 'Search Influencer:'}</strong> {lang === 'el' ? 'Μεταβείτε στο Κατάλογο Influencers, χρησιμοποιήστε τα φίλτρα, κάντε κλικ στον influencer' : 'Go to Influencer Directory, use filters, click on influencer'}
              </li>
              <li>
                <strong>{lang === 'el' ? 'Στο Profile Page:' : 'On Profile Page:'}</strong> {lang === 'el' ? 'Κάντε κλικ στο "Συνεργασία", συμπληρώστε τη φόρμα (Υπηρεσία, Budget, Περιγραφή, Deadline)' : 'Click on "Collaborate", fill the form (Service, Budget, Description, Deadline)'}
              </li>
              <li>
                <strong>{lang === 'el' ? 'Αποστολή:' : 'Send:'}</strong> {lang === 'el' ? 'Η προσφορά αποστέλλεται στον influencer, παίρνετε email notification' : 'Proposal is sent to influencer, you receive email notification'}
              </li>
            </ol>

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
            <h2 className="text-3xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              <span className="text-4xl">📣</span>
              {lang === 'el' ? 'Καμπάνιες με αιτήσεις (Brands)' : 'Campaign briefs & applications (Brands)'}
            </h2>
            <p className="text-slate-600 mb-6">
              {lang === 'el'
                ? 'Από το Brand Dashboard μπορείτε να δημοσιεύετε καμπάνιες (τίτλος, περιγραφή, budget, προθεσμία). Οι verified influencers βλέπουν τις ανοιχτές καμπάνιες στο δικό τους dashboard και υποβάλλουν αίτηση ενδιαφέροντος με προαιρετικό μήνυμα.'
                : 'From the Brand Dashboard you can publish campaigns (title, description, budget, deadline). Verified influencers see open campaigns in their dashboard and submit an application with an optional message.'}
            </p>
            <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">
              {lang === 'el' ? 'Τι λαμβάνετε εσείς ως brand' : 'What you get as a brand'}
            </h3>
            <p className="text-slate-700 mb-4">
              {lang === 'el'
                ? 'Για κάθε καμπάνια βλέπετε λίστα με τις αιτήσεις ενδιαφέροντος. Μπορείτε να αλλάξετε την κατάσταση κάθε αίτησης από το μενού κατάστασης (δίπλα στον influencer).'
                : 'For each campaign you see a list of interest applications. You can change each application’s status from the status menu (next to the influencer).'}
            </p>
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-6 mb-6">
              <h4 className="font-bold text-teal-900 mb-3">
                {lang === 'el' ? 'Τι σημαίνει κάθε κατάσταση αίτησης' : 'What each application status means'}
              </h4>
              <ul className="space-y-3 text-slate-700 text-sm list-none pl-0">
                <li>
                  <strong className="text-slate-900">{lang === 'el' ? 'Εκκρεμεί' : 'Pending'}:</strong>{' '}
                  {lang === 'el'
                    ? 'Η αίτηση μόλις υποβλήθηκε· δεν έχετε ακόμη αποφασίσει. Ο influencer περιμένει την απάντησή σας.'
                    : 'The application was just submitted; you have not decided yet. The influencer is waiting for your response.'}
                </li>
                <li>
                  <strong className="text-slate-900">{lang === 'el' ? 'Σε λίστα (shortlist)' : 'Shortlisted'}:</strong>{' '}
                  {lang === 'el'
                    ? 'Έχετε επιλέξει αυτόν τον influencer για περαιτέρω συζήτηση ή συνεργασία — δείχνει θετικό ενδιαφέρον από μέρους σας.'
                    : 'You have selected this influencer for further discussion or collaboration — it shows positive interest on your side.'}
                </li>
                <li>
                  <strong className="text-slate-900">{lang === 'el' ? 'Απόρριψη' : 'Rejected'}:</strong>{' '}
                  {lang === 'el'
                    ? 'Η αίτηση δεν ταιριάζει στην καμπάνια. Ο influencer βλέπει ότι δεν προχωράτε μαζί του για αυτή τη θέση.'
                    : 'The application does not fit this campaign. The influencer sees that you are not proceeding with them for this brief.'}
                </li>
                <li>
                  <strong className="text-slate-900">{lang === 'el' ? 'Αποσύρθηκε' : 'Withdrawn'}:</strong>{' '}
                  {lang === 'el'
                    ? 'Ο influencer απέσυρε ο ίδιος την αίτηση — δεν απαιτείται δική σας ενέργεια.'
                    : 'The influencer withdrew their application themselves — no action required from you.'}
                </li>
              </ul>
            </div>
            <ul className="list-disc list-inside space-y-2 text-slate-700 mb-6">
              <li>
                {lang === 'el'
                  ? 'Κουμπί για άμεσο μήνυμα στον influencer από την αίτηση.'
                  : 'A button to message the influencer directly from an application.'}
              </li>
              <li>
                {lang === 'el'
                  ? 'Ειδοποίηση push (αν την έχετε ενεργοποιήσει) και email όταν υπάρχει νέα αίτηση, ώστε να μη χάνετε leads.'
                  : 'Push notification (if enabled) and email when there is a new application, so you do not miss leads.'}
              </li>
            </ul>
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-6">
              <h4 className="font-bold text-teal-900 mb-2">
                {lang === 'el' ? 'Σύνδεση με τον οδηγό' : 'Link to this guide'}
              </h4>
              <p className="text-slate-700 text-sm mb-0">
                {lang === 'el'
                  ? 'Μπορείτε να ανοίξετε απευθείας το tab «Καμπάνιες» στο Brand Dashboard με το σύνδεσμο /brand/dashboard?tab=campaigns (π.χ. από email ειδοποίησης).'
                  : 'You can open the Campaigns tab directly with /brand/dashboard?tab=campaigns (e.g. from notification emails).'}
              </p>
            </div>
          </section>

          {/* Counter-Proposal Section */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              <span className="text-4xl">💰</span>
              {lang === 'el' ? 'Αντιπροσφορά (Counter-Proposal) - Για Influencers' : 'Counter-Proposal - For Influencers'}
            </h2>

            <h3 className="text-xl font-bold text-slate-900 mt-6 mb-4">
              {lang === 'el' ? 'Πώς Κάνετε Αντιπροσφορά' : 'How to Make Counter-Proposal'}
            </h3>

            <ol className="list-decimal list-inside space-y-4 text-slate-700 mb-6">
              <li>
                <strong>{lang === 'el' ? 'Ελέγξτε την Προσφορά:' : 'Check Proposal:'}</strong> {lang === 'el' ? 'Dashboard → Proposals, εμφανίζονται όλες οι προσφορές' : 'Dashboard → Proposals, all proposals are displayed'}
              </li>
              <li>
                <strong>{lang === 'el' ? 'Επιλογές:' : 'Options:'}</strong> {lang === 'el' ? 'Αποδοχή, Αντιπροσφορά, ή Μήνυμα' : 'Accept, Counter-propose, or Message'}
              </li>
              <li>
                <strong>{lang === 'el' ? 'Αντιπροσφορά:' : 'Counter-Proposal:'}</strong> {lang === 'el' ? 'Κάντε κλικ στο "Αντιπροσφορά", συμπληρώστε νέο budget και μήνυμα, αποστολή' : 'Click "Counter-propose", fill new budget and message, send'}
              </li>
              <li>
                <strong>{lang === 'el' ? 'Αποτέλεσμα:' : 'Result:'}</strong> {lang === 'el' ? 'Το brand θα δει την αντιπροσφορά, μπορεί να την αποδεχτεί ή απαρνηθεί' : 'Brand will see counter-proposal, can accept or reject'}
              </li>
            </ol>

            <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
              <h4 className="font-bold text-purple-900 mb-3">
                {lang === 'el' ? '💡 Συμβουλές για Αντιπροσφορές' : '💡 Tips for Counter-Proposals'}
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
            <h2 className="text-3xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              <span className="text-4xl">🤝</span>
              {lang === 'el' ? 'Συμφωνία Συνεργασίας (Agreement)' : 'Collaboration Agreement'}
            </h2>

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
              <h4 className="font-bold text-amber-900 mb-2">⚠️ {lang === 'el' ? 'Σημαντικό' : 'Important'}</h4>
              <p className="text-slate-700">
                {lang === 'el' 
                  ? 'Και οι δύο πλευρές πρέπει να αποδεχτούν τους όρους. Μόνο τότε η συνεργασία προστίθεται στο Past Brands. Οι όροι προστατεύουν και τις δύο πλευρές.'
                  : 'Both parties must accept terms. Only then collaboration is added to Past Brands. Terms protect both parties.'}
              </p>
            </div>
          </section>

          {/* Messaging Section */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              <span className="text-4xl">💬</span>
              {lang === 'el' ? 'Σύστημα Μηνυμάτων' : 'Messaging System'}
            </h2>

            <h3 className="text-xl font-bold text-slate-900 mt-6 mb-4">
              {lang === 'el' ? 'Πώς Στέλνετε Μήνυμα' : 'How to Send Message'}
            </h3>

            <ul className="list-disc list-inside space-y-3 text-slate-700 mb-6">
              <li>{lang === 'el' ? 'Από Profile Page: Κάντε κλικ στο "Μήνυμα" ή "Ρώτησε", γράψτε και στείλτε' : 'From Profile Page: Click "Message" or "Ask", write and send'}</li>
              <li>{lang === 'el' ? 'Από Dashboard: Influencers → Messages, Brands → Conversations' : 'From Dashboard: Influencers → Messages, Brands → Conversations'}</li>
            </ul>

            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
              <h4 className="font-bold text-indigo-900 mb-3">
                {lang === 'el' ? 'Χαρακτηριστικά' : 'Features'}
              </h4>
              <ul className="space-y-2 text-slate-700 list-disc list-inside">
                <li>{lang === 'el' ? 'Real-time messaging: Άμεση επικοινωνία' : 'Real-time messaging: Instant communication'}</li>
                <li>{lang === 'el' ? 'Notification system: Email notifications για νέα μηνύματα' : 'Notification system: Email notifications for new messages'}</li>
                <li>{lang === 'el' ? 'Proposal linking: Μηνύματα συνδέονται με προσφορές' : 'Proposal linking: Messages linked to proposals'}</li>
              </ul>
            </div>
          </section>

          {/* Reviews Section */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              <span className="text-4xl">⭐</span>
              {lang === 'el' ? 'Reviews & Ratings' : 'Reviews & Ratings'}
            </h2>

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
            <h2 className="text-3xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              <span className="text-4xl">💡</span>
              {lang === 'el' ? 'Συμβουλές για Επιτυχία' : 'Tips for Success'}
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                <h3 className="font-bold text-blue-900 mb-4">
                  {lang === 'el' ? 'Για Influencers' : 'For Influencers'}
                </h3>
                <ul className="space-y-3 text-slate-700 text-sm list-disc list-inside">
                  <li>{lang === 'el' ? 'Συμπληρώστε το Profile: Καλό bio, avatar, realistic pricing' : 'Complete Profile: Good bio, avatar, realistic pricing'}</li>
                  <li>{lang === 'el' ? 'Καλή Απόδοση: Υψηλό engagement, consistent posting' : 'Good Performance: High engagement, consistent posting'}</li>
                  <li>{lang === 'el' ? 'Επαγγελματική Συμπεριφορά: Γρήγορα responses, ολοκλήρωση projects' : 'Professional Behavior: Fast responses, complete projects'}</li>
                  <li>{lang === 'el' ? 'Αξιολόγηση: Ζητήστε reviews, καλά reviews = περισσότερες προσφορές' : 'Evaluation: Request reviews, good reviews = more proposals'}</li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                <h3 className="font-bold text-green-900 mb-4">
                  {lang === 'el' ? 'Για Brands' : 'For Brands'}
                </h3>
                <ul className="space-y-3 text-slate-700 text-sm list-disc list-inside">
                  <li>{lang === 'el' ? 'Καλή Αναζήτηση: Χρησιμοποιήστε filters, ελέγξτε engagement & reviews' : 'Good Search: Use filters, check engagement & reviews'}</li>
                  <li>{lang === 'el' ? 'Σαφείς Προσφορές: Περιγράψτε καθαρά, realistic budget, deadline' : 'Clear Proposals: Describe clearly, realistic budget, deadline'}</li>
                  <li>{lang === 'el' ? 'Επικοινωνία: Απαντήστε εγκαίρως, συζητήστε λεπτομέρειες' : 'Communication: Respond timely, discuss details'}</li>
                  <li>{lang === 'el' ? 'Αξιολόγηση: Αφήστε reviews, βοηθήστε άλλα brands' : 'Evaluation: Leave reviews, help other brands'}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* FAQ Section — accordion */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3 flex items-center gap-3">
              <span className="text-4xl" aria-hidden>
                🆘
              </span>
              {lang === "el" ? "Συχνές Ερωτήσεις (FAQ)" : "Frequently Asked Questions (FAQ)"}
            </h2>
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
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-8 text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">📞 {lang === 'el' ? 'Support' : 'Support'}</h2>
              <p className="text-slate-700 mb-4">
                {lang === 'el' 
                  ? 'Για ερωτήσεις ή βοήθεια:'
                  : 'For questions or help:'}
              </p>
              <p className="text-lg font-semibold text-blue-700 mb-2">support@influo.gr</p>
              <p className="text-sm text-slate-600">
                {lang === 'el' 
                  ? 'Support Hours: Δευτέρα-Παρασκευή, 10:00-18:00'
                  : 'Support Hours: Monday-Friday, 10:00-18:00'}
              </p>
            </div>
          </section>

        </div>
      </div>

      {/* Footer */}
      <Footer lang={lang} />
    </div>
  );
}

