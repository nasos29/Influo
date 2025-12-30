// app/privacy/page.tsx
"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function PrivacyPage() {
  const [lang, setLang] = useState<"el" | "en">("el");

  const content = {
    el: {
      title: "Πολιτική Απορρήτου",
      lastUpdated: "Τελευταία ενημέρωση:",
      intro: "Η παρούσα Πολιτική Απορρήτου περιγράφει πώς συλλέγονται, χρησιμοποιούνται, αποθηκεύονται και προστατεύονται τα προσωπικά δεδομένα σας όταν χρησιμοποιείτε την πλατφόρμα Influo.gr.",
      
      section1_title: "1. ΣΥΛΛΟΓΗ ΔΕΔΟΜΕΝΩΝ",
      section1_text: "Συλλέγουμε τα παρακάτω δεδομένα:",
      section1_list1: "Δεδομένα λογαριασμού: Όνομα, email, τοποθεσία, φύλο, βιογραφικό",
      section1_list2: "Δεδομένα προφίλ: Φωτογραφίες, βίντεο, links κοινωνικών δικτύων, στατιστικά followers",
      section1_list3: "Δεδομένα επικοινωνίας: Μηνύματα μεταξύ influencers και brands",
      section1_list4: "Τεχνικά δεδομένα: IP address, browser type, cookies",
      
      section2_title: "2. ΧΡΗΣΗ ΔΕΔΟΜΕΝΩΝ",
      section2_text: "Χρησιμοποιούμε τα δεδομένα σας για:",
      section2_list1: "Παροχή της υπηρεσίας σύνδεσης influencers με brands",
      section2_list2: "Επεξεργασία προτάσεων συνεργασίας",
      section2_list3: "Ενεργοποίηση επικοινωνίας μεταξύ χρηστών",
      section2_list4: "Βελτίωση της πλατφόρμας και ανάλυση χρήσης",
      
      section3_title: "3. ΚΟΙΝΟΠΟΙΗΣΗ ΔΕΔΟΜΕΝΩΝ",
      section3_text: "Τα δεδομένα του προφίλ σας (όνομα, φωτογραφία, βιογραφικό, στατιστικά) είναι ορατά σε όλους τους επισκέπτες της πλατφόρμας. Τα μηνύματα και προσωπικά στοιχεία επικοινωνίας μοιράζονται μόνο μεταξύ των συμμετεχόντων σε συνομιλία.",
      
      section4_title: "4. ΑΣΦΑΛΕΙΑ ΔΕΔΟΜΕΝΩΝ",
      section4_text: "Χρησιμοποιούμε σύγχρονες τεχνικές ασφαλείας για προστασία των δεδομένων σας. Ωστόσο, κανείς δεν μπορεί να εγγυηθεί 100% ασφάλεια στο διαδίκτυο. Χρησιμοποιείτε την πλατφόρμα με δική σας ευθύνη.",
      
      section5_title: "5. COOKIES",
      section5_text: "Χρησιμοποιούμε cookies για λειτουργικότητα, analytics και προσωποποίηση εμπειρίας. Μπορείτε να τα απενεργοποιήσετε από τις ρυθμίσεις του browser σας.",
      
      section6_title: "6. ΔΙΚΑΙΩΜΑΤΑ ΧΡΗΣΤΩΝ",
      section6_text: "Έχετε το δικαίωμα να:",
      section6_list1: "Ζητήσετε πρόσβαση στα προσωπικά σας δεδομένα",
      section6_list2: "Ζητήσετε διόρθωση ή διαγραφή δεδομένων",
      section6_list3: "Εναντιωθείτε στην επεξεργασία",
      section6_list4: "Ανακαλέσετε τη συναίνεσή σας",
      
      section7_title: "7. ΑΠΟΠΟΙΗΣΗ ΕΥΘΥΝΩΝ",
      section7_text: "Η πλατφόρμα Influo.gr παρέχεται 'ΩΣ ΕΧΕΙ' (AS IS) χωρίς καμία εγγύηση. Δεν φέρουμε καμία ευθύνη για:",
      section7_list1: "Αποτελέσματα συνεργασιών μεταξύ influencers και brands",
      section7_list2: "Πληρωμές, συμβάσεις ή διαπραγματεύσεις μεταξύ χρηστών",
      section7_list3: "Ακρίβεια, ολοκληρότητα ή αξιοπιστία των πληροφοριών που αναρτούν οι χρήστες",
      section7_list4: "Απώλεια δεδομένων, ζημίες ή βλάβες λόγω χρήσης της πλατφόρμας",
      section7_list5: "Πράξεις, παραλείψεις ή συμπεριφορά τρίτων (influencers, brands)",
      section7_list6: "Παραβιάσεις ασφαλείας, hacking, ή μη εξουσιοδοτημένη πρόσβαση",
      section7_text2: "Η πλατφόρμα λειτουργεί ως απλός χώρος σύνδεσης. Δεν είμαστε μέρος σε καμία συμβατική σχέση μεταξύ influencers και brands. Όλες οι συμβάσεις, πληρωμές και υποχρεώσεις είναι αποκλειστική ευθύνη των χρηστών.",
      
      section8_title: "8. ΔΩΡΕΑΝ ΠΛΑΤΦΟΡΜΑ",
      section8_text: "Η πλατφόρμα Influo.gr παρέχεται εντελώς ΔΩΡΕΑΝ. Δεν επιβάλλουμε καμία χρέωση στους χρήστες. Δεν επιδιώκουμε κανένα οικονομικό όφελος από την πλατφόρμα αυτή τη στιγμή.",
      
      section9_title: "9. ΑΛΛΑΓΕΣ ΣΤΗΝ ΠΟΛΙΤΙΚΗ",
      section9_text: "Διατηρούμε το δικαίωμα να τροποποιούμε αυτήν την πολιτική οποιαδήποτε στιγμή. Οι χρήστες είναι υπεύθυνοι να ελέγχουν περιοδικά αυτήν τη σελίδα.",
      
      section10_title: "10. ΕΠΙΚΟΙΝΩΝΙΑ",
      section10_text: "Για ερωτήσεις σχετικά με την απορρήτου, επικοινωνήστε μαζί μας μέσω της σελίδας Επικοινωνία.",
      
      back: "← Επιστροφή στην Αρχική",
    },
    en: {
      title: "Privacy Policy",
      lastUpdated: "Last updated:",
      intro: "This Privacy Policy describes how we collect, use, store, and protect your personal data when you use the Influo.gr platform.",
      
      section1_title: "1. DATA COLLECTION",
      section1_text: "We collect the following data:",
      section1_list1: "Account data: Name, email, location, gender, bio",
      section1_list2: "Profile data: Photos, videos, social media links, follower statistics",
      section1_list3: "Communication data: Messages between influencers and brands",
      section1_list4: "Technical data: IP address, browser type, cookies",
      
      section2_title: "2. USE OF DATA",
      section2_text: "We use your data for:",
      section2_list1: "Providing the service of connecting influencers with brands",
      section2_list2: "Processing collaboration proposals",
      section2_list3: "Enabling communication between users",
      section2_list4: "Improving the platform and analyzing usage",
      
      section3_title: "3. DATA SHARING",
      section3_text: "Your profile data (name, photo, bio, statistics) is visible to all platform visitors. Messages and personal contact details are shared only between participants in a conversation.",
      
      section4_title: "4. DATA SECURITY",
      section4_text: "We use modern security techniques to protect your data. However, no one can guarantee 100% security on the internet. You use the platform at your own risk.",
      
      section5_title: "5. COOKIES",
      section5_text: "We use cookies for functionality, analytics, and personalization. You can disable them from your browser settings.",
      
      section6_title: "6. USER RIGHTS",
      section6_text: "You have the right to:",
      section6_list1: "Request access to your personal data",
      section6_list2: "Request correction or deletion of data",
      section6_list3: "Object to processing",
      section6_list4: "Withdraw your consent",
      
      section7_title: "7. LIABILITY DISCLAIMER",
      section7_text: "The Influo.gr platform is provided 'AS IS' without any warranty. We bear no responsibility for:",
      section7_list1: "Outcomes of collaborations between influencers and brands",
      section7_list2: "Payments, contracts, or negotiations between users",
      section7_list3: "Accuracy, completeness, or reliability of information posted by users",
      section7_list4: "Data loss, damages, or harm due to platform use",
      section7_list5: "Actions, omissions, or behavior of third parties (influencers, brands)",
      section7_list6: "Security breaches, hacking, or unauthorized access",
      section7_text2: "The platform operates as a simple connection space. We are not part of any contractual relationship between influencers and brands. All contracts, payments, and obligations are the sole responsibility of users.",
      
      section8_title: "8. FREE PLATFORM",
      section8_text: "The Influo.gr platform is provided completely FREE. We do not charge any fees to users. We do not seek any financial benefit from this platform at this time.",
      
      section9_title: "9. POLICY CHANGES",
      section9_text: "We reserve the right to modify this policy at any time. Users are responsible for periodically checking this page.",
      
      section10_title: "10. CONTACT",
      section10_text: "For questions regarding privacy, contact us through the Contact page.",
      
      back: "← Back to Home",
    }
  };

  const txt = content[lang];
  const currentDate = new Date().toLocaleDateString(lang === "el" ? "el-GR" : "en-US");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-2">
            {txt.back}
          </Link>
          <button 
            onClick={() => setLang(lang === "el" ? "en" : "el")} 
            className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors"
            aria-label="Toggle language"
          >
            {lang === "el" ? "EN" : "EL"}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">{txt.title}</h1>
        <p className="text-slate-600 mb-8">{txt.lastUpdated} {currentDate}</p>

        <div className="prose prose-slate max-w-none space-y-8">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-slate-700 leading-relaxed">{txt.intro}</p>
          </div>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section1_title}</h2>
            <p className="text-slate-700 mb-3">{txt.section1_text}</p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li>{txt.section1_list1}</li>
              <li>{txt.section1_list2}</li>
              <li>{txt.section1_list3}</li>
              <li>{txt.section1_list4}</li>
            </ul>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section2_title}</h2>
            <p className="text-slate-700 mb-3">{txt.section2_text}</p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li>{txt.section2_list1}</li>
              <li>{txt.section2_list2}</li>
              <li>{txt.section2_list3}</li>
              <li>{txt.section2_list4}</li>
            </ul>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section3_title}</h2>
            <p className="text-slate-700 leading-relaxed">{txt.section3_text}</p>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section4_title}</h2>
            <p className="text-slate-700 leading-relaxed">{txt.section4_text}</p>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section5_title}</h2>
            <p className="text-slate-700 leading-relaxed">{txt.section5_text}</p>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section6_title}</h2>
            <p className="text-slate-700 mb-3">{txt.section6_text}</p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li>{txt.section6_list1}</li>
              <li>{txt.section6_list2}</li>
              <li>{txt.section6_list3}</li>
              <li>{txt.section6_list4}</li>
            </ul>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section7_title}</h2>
            <p className="text-slate-700 font-semibold mb-3">{txt.section7_text}</p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li>{txt.section7_list1}</li>
              <li>{txt.section7_list2}</li>
              <li>{txt.section7_list3}</li>
              <li>{txt.section7_list4}</li>
              <li>{txt.section7_list5}</li>
              <li>{txt.section7_list6}</li>
            </ul>
            <p className="text-slate-700 mt-4 font-semibold leading-relaxed">{txt.section7_text2}</p>
          </section>

          <section className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200 shadow-sm">
            <h2 className="text-2xl font-bold text-blue-900 mb-4">{txt.section8_title}</h2>
            <p className="text-blue-800 font-semibold leading-relaxed">{txt.section8_text}</p>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section9_title}</h2>
            <p className="text-slate-700 leading-relaxed">{txt.section9_text}</p>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section10_title}</h2>
            <p className="text-slate-700 leading-relaxed">{txt.section10_text}</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200">
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">
            {txt.back}
          </Link>
        </div>
      </main>
    </div>
  );
}

