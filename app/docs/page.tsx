"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getStoredLanguage, setStoredLanguage } from "@/lib/language";
import Footer from "../../components/Footer";

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

export default function DocsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
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

          {/* FAQ Section */}
          <section className="mb-12 border-t border-slate-200 pt-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6 flex items-center gap-3">
              <span className="text-4xl">🆘</span>
              {lang === 'el' ? 'Συχνές Ερωτήσεις (FAQ)' : 'Frequently Asked Questions (FAQ)'}
            </h2>

            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                <h4 className="font-bold text-slate-900 mb-2">
                  {lang === 'el' ? 'Q: Πώς μπορώ να αυξήσω το engagement rate μου;' : 'Q: How can I increase my engagement rate?'}
                </h4>
                <p className="text-slate-700">
                  {lang === 'el' ? 'Α: Συνεπής δημοσίευση, ποιοτικό περιεχόμενο, αλληλεπίδραση με τους followers, hashtags.' : 'A: Consistent posting, quality content, interaction with followers, hashtags.'}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                <h4 className="font-bold text-slate-900 mb-2">
                  {lang === 'el' ? 'Q: Πώς ξέρω αν ένας influencer είναι αξιόπιστος;' : 'Q: How do I know if an influencer is trustworthy?'}
                </h4>
                <p className="text-slate-700">
                  {lang === 'el' ? 'A: Ελέγξτε: Verified badge, reviews, completion rate, response time.' : 'A: Check: Verified badge, reviews, completion rate, response time.'}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                <h4 className="font-bold text-slate-900 mb-2">
                  {lang === 'el' ? 'Q: Μπορώ να απορρίψω μια προσφορά;' : 'Q: Can I reject a proposal?'}
                </h4>
                <p className="text-slate-700">
                  {lang === 'el' ? 'A: Ναι, μπορείτε να απορρίψετε ή να κάνετε αντιπροσφορά.' : 'A: Yes, you can reject or make a counter-proposal.'}
                </p>
              </div>
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

