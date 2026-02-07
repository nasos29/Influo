// app/cookies/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredLanguage, setStoredLanguage } from '@/lib/language';

export default function CookiesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [lang, setLang] = useState<"el" | "en">(pathname?.startsWith("/en") ? "en" : getStoredLanguage());

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  }, [pathname]);

  const content = {
    el: {
      title: "Πολιτική Cookies",
      lastUpdated: "Τελευταία ενημέρωση:",
      intro: "Αυτή η Πολιτική Cookies εξηγεί τι είναι τα cookies, πώς τα χρησιμοποιούμε στην πλατφόρμα Influo.gr και ποια είναι τα δικαιώματά σας σχετικά με αυτά.",
      
      section1_title: "1. ΤΙ ΕΙΝΑΙ ΤΑ COOKIES",
      section1_text: "Τα cookies είναι μικρά αρχεία κειμένου που τοποθετούνται στον υπολογιστή ή τη συσκευή σας όταν επισκέπτεστε μια ιστοσελίδα. Αποθηκεύουν πληροφορίες σχετικά με την περιήγησή σας και βοηθούν την ιστοσελίδα να λειτουργεί πιο αποτελεσματικά.",
      
      section2_title: "2. ΠΩΣ ΧΡΗΣΙΜΟΠΟΙΟΥΜΕ ΤΑ COOKIES",
      section2_text: "Χρησιμοποιούμε cookies για διάφορους σκοπούς:",
      section2_list1: "Απαραίτητα Cookies: Αυτά είναι απαραίτητα για τη λειτουργία της πλατφόρμας, όπως η διατήρηση της σύνδεσής σας και η αποθήκευση των προτιμήσεών σας",
      section2_list2: "Αναλυτικά Cookies: Χρησιμοποιούμε cookies για να κατανοήσουμε πώς οι χρήστες χρησιμοποιούν την πλατφόρμα, ώστε να τη βελτιώσουμε",
      section2_list3: "Λειτουργικά Cookies: Αυτά επιτρέπουν στην πλατφόρμα να θυμάται τις επιλογές σας (όπως γλώσσα, θέμα) για να παρέχει βελτιωμένη εμπειρία",
      
      section3_title: "3. ΤΥΠΟΙ COOKIES",
      section3_text: "Χρησιμοποιούμε τα ακόλουθα τύπους cookies:",
      section3_list1: "Session Cookies: Αυτά διαγράφονται αυτόματα όταν κλείνετε τον browser σας",
      section3_list2: "Persistent Cookies: Αυτά παραμένουν στον υπολογιστή σας για ένα συγκεκριμένο χρονικό διάστημα ή μέχρι να τα διαγράψετε",
      section3_list3: "First-party Cookies: Τοποθετούνται απευθείας από τον ιστότοπό μας",
      section3_list4: "Third-party Cookies: Τοποθετούνται από υπηρεσίες τρίτων (όπως Google Analytics) που χρησιμοποιούμε",
      
      section4_title: "4. COOKIES ΤΡΙΤΩΝ ΜΕΡΩΝ",
      section4_text: "Μπορεί να χρησιμοποιούμε υπηρεσίες τρίτων (όπως Google Analytics) που τοποθετούν δικά τους cookies. Αυτά τα cookies υπόκεινται στις πολιτικές απορρήτου των αντίστοιχων τρίτων μερών.",
      
      section5_title: "5. ΔΙΚΑΙΩΜΑΤΑ ΧΡΗΣΤΩΝ",
      section5_text: "Έχετε το δικαίωμα να:",
      section5_list1: "Αποδεχτείτε ή απορρίψετε cookies μέσω των ρυθμίσεων του browser σας",
      section5_list2: "Διαγράψετε cookies που έχουν ήδη τοποθετηθεί",
      section5_list3: "Αλλάξετε τις προτιμήσεις cookies σας ανά πάσα στιγμή",
      section5_text2: "Σημείωση: Η αποκλειστική χρήση ή διαγραφή cookies μπορεί να επηρεάσει τη λειτουργικότητα της πλατφόρμας.",
      
      section6_title: "6. ΠΩΣ ΝΑ ΔΙΑΧΕΙΡΙΣΤΕΙΤΕ ΤΑ COOKIES",
      section6_text: "Μπορείτε να διαχειριστείτε τα cookies μέσω των ρυθμίσεων του browser σας:",
      section6_list1: "Google Chrome: Ρυθμίσεις > Απόρρητο και ασφάλεια > Cookies",
      section6_list2: "Mozilla Firefox: Επιλογές > Απόρρητο και ασφάλεια > Cookies",
      section6_list3: "Safari: Προτιμήσεις > Απόρρητο > Cookies",
      section6_list4: "Microsoft Edge: Ρυθμίσεις > Cookies και δικαιώματα ιστοτόπου",
      section6_text2: "Συμβουλευτείτε την επίσημη τεκμηρίωση του browser σας για λεπτομερείς οδηγίες.",
      
      section7_title: "7. ΑΠΟΠΟΙΗΣΗ ΕΥΘΥΝΩΝ",
      section7_text: "Η πλατφόρμα Influo.gr παρέχεται 'ΩΣ ΕΧΕΙ' (AS IS) χωρίς καμία εγγύηση. Δεν φέρουμε καμία ευθύνη για:",
      section7_list1: "Προβλήματα λειτουργικότητας που προκύπτουν από την αποκλειστική χρήση ή διαγραφή cookies",
      section7_list2: "Χρήση cookies από τρίτους (όπως Google Analytics)",
      section7_list3: "Απώλεια δεδομένων ή προσωποποιημένων ρυθμίσεων λόγω διαγραφής cookies",
      
      section8_title: "8. ΑΛΛΑΓΕΣ ΣΤΗΝ ΠΟΛΙΤΙΚΗ",
      section8_text: "Μπορούμε να ενημερώνουμε αυτήν την Πολιτική Cookies περιοδικά. Προτείνουμε να την ελέγχετε τακτικά για να είστε ενημερωμένοι σχετικά με τη χρήση cookies μας.",
      
      section9_title: "9. ΕΠΙΚΟΙΝΩΝΙΑ",
      section9_text: "Για ερωτήσεις σχετικά με τα cookies, επικοινωνήστε μαζί μας μέσω της σελίδας Επικοινωνία.",
      
      back: "← Επιστροφή στην Αρχική",
    },
    en: {
      title: "Cookie Policy",
      lastUpdated: "Last updated:",
      intro: "This Cookie Policy explains what cookies are, how we use them on the Influo.gr platform, and what your rights are regarding them.",
      
      section1_title: "1. WHAT ARE COOKIES",
      section1_text: "Cookies are small text files that are placed on your computer or device when you visit a website. They store information about your browsing and help the website function more efficiently.",
      
      section2_title: "2. HOW WE USE COOKIES",
      section2_text: "We use cookies for various purposes:",
      section2_list1: "Essential Cookies: These are necessary for the platform to function, such as maintaining your connection and storing your preferences",
      section2_list2: "Analytics Cookies: We use cookies to understand how users use the platform so we can improve it",
      section2_list3: "Functional Cookies: These allow the platform to remember your choices (such as language, theme) to provide an enhanced experience",
      
      section3_title: "3. TYPES OF COOKIES",
      section3_text: "We use the following types of cookies:",
      section3_list1: "Session Cookies: These are automatically deleted when you close your browser",
      section3_list2: "Persistent Cookies: These remain on your computer for a specific period or until you delete them",
      section3_list3: "First-party Cookies: Placed directly by our website",
      section3_list4: "Third-party Cookies: Placed by third-party services (such as Google Analytics) that we use",
      
      section4_title: "4. THIRD-PARTY COOKIES",
      section4_text: "We may use third-party services (such as Google Analytics) that place their own cookies. These cookies are subject to the privacy policies of the respective third parties.",
      
      section5_title: "5. USER RIGHTS",
      section5_text: "You have the right to:",
      section5_list1: "Accept or reject cookies through your browser settings",
      section5_list2: "Delete cookies that have already been placed",
      section5_list3: "Change your cookie preferences at any time",
      section5_text2: "Note: Completely blocking or deleting cookies may affect the platform's functionality.",
      
      section6_title: "6. HOW TO MANAGE COOKIES",
      section6_text: "You can manage cookies through your browser settings:",
      section6_list1: "Google Chrome: Settings > Privacy and security > Cookies",
      section6_list2: "Mozilla Firefox: Options > Privacy and Security > Cookies",
      section6_list3: "Safari: Preferences > Privacy > Cookies",
      section6_list4: "Microsoft Edge: Settings > Cookies and site permissions",
      section6_text2: "Consult your browser's official documentation for detailed instructions.",
      
      section7_title: "7. LIABILITY DISCLAIMER",
      section7_text: "The Influo.gr platform is provided 'AS IS' without any warranty. We bear no responsibility for:",
      section7_list1: "Functionality issues that arise from blocking or deleting cookies",
      section7_list2: "Use of cookies by third parties (such as Google Analytics)",
      section7_list3: "Loss of data or personalized settings due to cookie deletion",
      
      section8_title: "8. POLICY CHANGES",
      section8_text: "We may update this Cookie Policy periodically. We recommend checking it regularly to stay informed about our cookie usage.",
      
      section9_title: "9. CONTACT",
      section9_text: "For questions regarding cookies, contact us through the Contact page.",
      
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
          <Link href={lang === "en" ? "/en" : "/"} className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-2">
            {txt.back}
          </Link>
          <button 
            onClick={() => {
              const newLang = lang === "el" ? "en" : "el";
              setLang(newLang);
              setStoredLanguage(newLang);
              if (newLang === "en") router.push("/en/cookies");
              else router.push("/cookies");
            }} 
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
            <p className="text-slate-700 leading-relaxed">{txt.section1_text}</p>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section2_title}</h2>
            <p className="text-slate-700 mb-3">{txt.section2_text}</p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li>{txt.section2_list1}</li>
              <li>{txt.section2_list2}</li>
              <li>{txt.section2_list3}</li>
            </ul>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section3_title}</h2>
            <p className="text-slate-700 mb-3">{txt.section3_text}</p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li>{txt.section3_list1}</li>
              <li>{txt.section3_list2}</li>
              <li>{txt.section3_list3}</li>
              <li>{txt.section3_list4}</li>
            </ul>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section4_title}</h2>
            <p className="text-slate-700 leading-relaxed">{txt.section4_text}</p>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section5_title}</h2>
            <p className="text-slate-700 mb-3">{txt.section5_text}</p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li>{txt.section5_list1}</li>
              <li>{txt.section5_list2}</li>
              <li>{txt.section5_list3}</li>
            </ul>
            <p className="text-slate-700 mt-4 leading-relaxed">{txt.section5_text2}</p>
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
            <p className="text-slate-700 mt-4 leading-relaxed">{txt.section6_text2}</p>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section7_title}</h2>
            <p className="text-slate-700 font-semibold mb-3">{txt.section7_text}</p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li>{txt.section7_list1}</li>
              <li>{txt.section7_list2}</li>
              <li>{txt.section7_list3}</li>
            </ul>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section8_title}</h2>
            <p className="text-slate-700 leading-relaxed">{txt.section8_text}</p>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section9_title}</h2>
            <p className="text-slate-700 leading-relaxed">{txt.section9_text}</p>
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

