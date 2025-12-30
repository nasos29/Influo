// app/terms/page.tsx
"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function TermsPage() {
  const [lang, setLang] = useState<"el" | "en">("el");

  const content = {
    el: {
      title: "Όροι Χρήσης",
      lastUpdated: "Τελευταία ενημέρωση:",
      intro: "Καλώς ήρθατε στην Influo.gr. Με τη χρήση αυτής της πλατφόρμας, αποδέχεστε τους παρακάτω όρους και προϋποθέσεις. Αν δεν συμφωνείτε, παρακαλώ μην χρησιμοποιείτε την πλατφόρμα.",
      
      section1_title: "1. ΑΠΟΔΟΧΗ ΟΡΩΝ",
      section1_text: "Η πρόσβαση και χρήση της πλατφόρμας Influo.gr υποδηλώνει την πλήρη αποδοχή αυτών των όρων. Αν δεν συμφωνείτε, πρέπει να διακόψετε αμέσως τη χρήση.",
      
      section2_title: "2. ΠΕΡΙΓΡΑΦΗ ΥΠΗΡΕΣΙΑΣ",
      section2_text: "Η Influo.gr είναι μια δωρεάν διαδικτυακή πλατφόρμα που συνδέει influencers με brands. Παρέχουμε μόνο την τεχνική υποδομή για επικοινωνία και εύρεση συνεργασιών. ΔΕΝ είμαστε μέρος σε καμία συμβατική σχέση μεταξύ των χρηστών.",
      
      section3_title: "3. ΕΓΓΡΑΦΗ ΚΑΙ ΛΟΓΑΡΙΑΣΜΟΣ",
      section3_text: "Για να χρησιμοποιήσετε την πλατφόρμα, πρέπει:",
      section3_list1: "Να είστε τουλάχιστον 18 ετών",
      section3_list2: "Να παρέχετε ακριβή και ενημερωμένη πληροφόρηση",
      section3_list3: "Να διατηρείτε ασφαλή τον κωδικό πρόσβασής σας",
      section3_list4: "Να είστε υπεύθυνοι για όλες τις δραστηριότητες στον λογαριασμό σας",
      section3_text2: "Διατηρούμε το δικαίωμα να αποκλείσουμε οποιονδήποτε χρήστη που παραβιάζει τους όρους.",
      
      section4_title: "4. ΣΥΜΠΕΡΙΦΟΡΑ ΧΡΗΣΤΩΝ",
      section4_text: "Οι χρήστες υποχρεούνται να:",
      section4_list1: "Συμμορφώνονται με όλους τους νόμους και κανονισμούς",
      section4_list2: "Σέβονται τους άλλους χρήστες",
      section4_list3: "Δεν αναρτούν παραπλανητικό, προσβλητικό ή παράνομο περιεχόμενο",
      section4_list4: "Δεν χρησιμοποιούν την πλατφόρμα για απάτη, spam ή κακόβουλες πρακτικές",
      section4_list5: "Δεν παραβιάζουν πνευματικά δικαιώματα τρίτων",
      
      section5_title: "5. ΠΛΗΡΗΣ ΑΠΟΠΟΙΗΣΗ ΕΥΘΥΝΩΝ",
      section5_text: "Η πλατφόρμα Influo.gr παρέχεται 'ΩΣ ΕΧΕΙ' και 'ΩΣ ΔΙΑΘΕΣΙΜΟ' χωρίς καμία εγγύηση, ρητή ή σιωπηρή. ΑΠΟΠΟΙΟΥΜΑΣΤΕ ΑΠΟΛΥΤΑ ΚΑΙ ΟΛΟΣΧΕΡΩΣ ΚΑΘΕ ΕΥΘΥΝΗ ΓΙΑ:",
      section5_list1: "Οποιαδήποτε ζημία, απώλεια ή βλάβη (άμεση, έμμεση, τυχαία, ειδική, συνεπειογενής) που προκύπτει από τη χρήση ή αδυναμία χρήσης της πλατφόρμας",
      section5_list2: "Αποτελέσματα, αποδοχή, εκτέλεση ή μη εκτέλεση συνεργασιών μεταξύ influencers και brands",
      section5_list3: "Πληρωμές, συμβάσεις, συμφωνίες ή οποιεσδήποτε οικονομικές συναλλαγές μεταξύ χρηστών",
      section5_list4: "Ακρίβεια, ολοκληρότητα, αξιοπιστία ή χρησιμότητα οποιασδήποτε πληροφορίας, περιεχομένου ή δεδομένων που αναρτούν οι χρήστες",
      section5_list5: "Παραβιάσεις ασφαλείας, hacking, απώλεια δεδομένων, διακοπές λειτουργίας ή τεχνικά προβλήματα",
      section5_list6: "Πράξεις, παραλείψεις, δηλώσεις, συμβάσεις, υποσχέσεις ή συμπεριφορά οποιουδήποτε χρήστη (influencer ή brand)",
      section5_list7: "Προβλήματα, διαφορές, διαμάχες ή νομικές υποθέσεις μεταξύ χρηστών",
      section5_list8: "Παραβιάσεις πνευματικών δικαιωμάτων, προσωπικών δεδομένων ή άλλων δικαιωμάτων τρίτων",
      section5_list9: "Οποιαδήποτε άλλη ζημία ή αξίωση που σχετίζεται με τη χρήση της πλατφόρμας",
      section5_text2: "ΔΕΝ ΕΙΜΑΣΤΕ ΕΥΘΥΝΟΙ για οτιδήποτε συμβαίνει μεταξύ των χρηστών. Η πλατφόρμα είναι απλά ένα εργαλείο σύνδεσης. Όλες οι συμβάσεις, πληρωμές, υποχρεώσεις και ευθύνες είναι αποκλειστική ευθύνη των χρηστών.",
      
      section6_title: "6. ΔΩΡΕΑΝ ΠΛΑΤΦΟΡΜΑ - ΧΩΡΙΣ ΟΙΚΟΝΟΜΙΚΟ ΟΦΕΛΟΣ",
      section6_text: "Η πλατφόρμα Influo.gr παρέχεται ΕΝΤΕΛΩΣ ΔΩΡΕΑΝ χωρίς καμία χρέωση για τους χρήστες. Η πλατφόρμα δεν λειτουργεί ως εμπορική επιχείρηση. ΔΕΝ ΕΠΙΔΙΩΚΟΥΜΕ ΚΑΝΕΝΑ ΟΙΚΟΝΟΜΙΚΟ ΟΦΕΛΟΣ από την πλατφόρμα αυτή τη στιγμή. Πρόκειται για προσωπικό project για εκπαιδευτικούς/τεχνικούς σκοπούς. Δεν φέρουμε καμία ευθύνη για φορολογικά, νομικά ή λογιστικά ζητήματα που μπορεί να προκύψουν από τη χρήση της πλατφόρμας από τους χρήστες.",
      
      section7_title: "7. ΠΝΕΥΜΑΤΙΚΑ ΔΙΚΑΙΩΜΑΤΑ",
      section7_text: "Όλο το περιεχόμενο που αναρτάτε παραμένει δικό σας. Ωστόσο, με την ανάρτηση, μας δίνετε άδεια να το εμφανίζουμε στη πλατφόρμα. Είστε υπεύθυνοι να διασφαλίζετε ότι έχετε τα απαραίτητα δικαιώματα για το περιεχόμενο που αναρτάτε.",
      
      section8_title: "8. ΑΚΥΡΩΣΗ ΚΑΙ ΔΙΑΚΟΠΗ",
      section8_text: "Μπορούμε να ακυρώσουμε ή να διακόψουμε οποιονδήποτε λογαριασμό που παραβιάζει τους όρους χρήσης, οποιαδήποτε στιγμή και χωρίς προειδοποίηση.",
      
      section9_title: "9. ΑΛΛΑΓΕΣ ΣΤΟΥΣ ΟΡΟΥΣ",
      section9_text: "Διατηρούμε το δικαίωμα να τροποποιούμε αυτούς τους όρους οποιαδήποτε στιγμή. Η συνεχής χρήση της πλατφόρμας μετά από αλλαγές σημαίνει αποδοχή των νέων όρων.",
      
      section10_title: "10. ΙΣΧΥΟΥΣΑ ΝΟΜΟΘΕΣΙΑ",
      section10_text: "Αυτοί οι όροι διέπονται από το Ελληνικό δίκαιο. Οποιαδήποτε διαφωνία θα επιλύεται στα Ελληνικά δικαστήρια. Οι χρήστες αποδέχονται την αποκλειστική δικαιοδοσία των Ελληνικών δικαστηρίων.",
      
      section11_title: "11. ΕΠΙΚΟΙΝΩΝΙΑ",
      section11_text: "Για ερωτήσεις σχετικά με τους όρους χρήσης, επικοινωνήστε μαζί μας μέσω της σελίδας Επικοινωνία.",
      
      disclaimer: "ΠΡΟΣΟΧΗ: Χρησιμοποιώντας αυτήν την πλατφόρμα, αναγνωρίζετε ότι διαβάσατε, κατανοήσατε και αποδέχτηκετε όλους τους παραπάνω όρους, συμπεριλαμβανομένης της πλήρους αποποίησης ευθυνών. Χρησιμοποιείτε την πλατφόρμα ΕΝΤΕΛΩΣ ΜΟΝΟΣ ΣΑΣ ΚΙΝΔΥΝΟΣ.",
      
      back: "← Επιστροφή στην Αρχική",
    },
    en: {
      title: "Terms of Service",
      lastUpdated: "Last updated:",
      intro: "Welcome to Influo.gr. By using this platform, you accept the following terms and conditions. If you do not agree, please do not use the platform.",
      
      section1_title: "1. ACCEPTANCE OF TERMS",
      section1_text: "Access to and use of the Influo.gr platform implies full acceptance of these terms. If you do not agree, you must immediately discontinue use.",
      
      section2_title: "2. SERVICE DESCRIPTION",
      section2_text: "Influo.gr is a free online platform that connects influencers with brands. We provide only the technical infrastructure for communication and finding collaborations. WE ARE NOT part of any contractual relationship between users.",
      
      section3_title: "3. REGISTRATION AND ACCOUNT",
      section3_text: "To use the platform, you must:",
      section3_list1: "Be at least 18 years old",
      section3_list2: "Provide accurate and up-to-date information",
      section3_list3: "Maintain the security of your password",
      section3_list4: "Be responsible for all activities on your account",
      section3_text2: "We reserve the right to exclude any user who violates the terms.",
      
      section4_title: "4. USER BEHAVIOR",
      section4_text: "Users must:",
      section4_list1: "Comply with all laws and regulations",
      section4_list2: "Respect other users",
      section4_list3: "Not post misleading, offensive, or illegal content",
      section4_list4: "Not use the platform for fraud, spam, or malicious practices",
      section4_list5: "Not violate third-party intellectual property rights",
      
      section5_title: "5. COMPLETE LIABILITY DISCLAIMER",
      section5_text: "The Influo.gr platform is provided 'AS IS' and 'AS AVAILABLE' without any warranty, express or implied. WE ABSOLUTELY AND COMPLETELY DISCLAIM ALL LIABILITY FOR:",
      section5_list1: "Any damage, loss, or harm (direct, indirect, incidental, special, consequential) arising from use or inability to use the platform",
      section5_list2: "Outcomes, acceptance, execution, or non-execution of collaborations between influencers and brands",
      section5_list3: "Payments, contracts, agreements, or any financial transactions between users",
      section5_list4: "Accuracy, completeness, reliability, or usefulness of any information, content, or data posted by users",
      section5_list5: "Security breaches, hacking, data loss, service interruptions, or technical problems",
      section5_list6: "Actions, omissions, statements, contracts, promises, or behavior of any user (influencer or brand)",
      section5_list7: "Problems, disputes, conflicts, or legal matters between users",
      section5_list8: "Violations of intellectual property, personal data, or other rights of third parties",
      section5_list9: "Any other damage or claim related to platform use",
      section5_text2: "WE ARE NOT RESPONSIBLE for anything that happens between users. The platform is simply a connection tool. All contracts, payments, obligations, and responsibilities are the sole responsibility of users.",
      
      section6_title: "6. FREE PLATFORM - NO FINANCIAL BENEFIT",
      section6_text: "The Influo.gr platform is provided COMPLETELY FREE with no charge to users. The platform does not operate as a commercial business. WE DO NOT SEEK ANY FINANCIAL BENEFIT from the platform at this time. This is a personal project for educational/technical purposes. We bear no responsibility for tax, legal, or accounting issues that may arise from users' use of the platform.",
      
      section7_title: "7. INTELLECTUAL PROPERTY",
      section7_text: "All content you post remains yours. However, by posting, you grant us permission to display it on the platform. You are responsible for ensuring you have the necessary rights to the content you post.",
      
      section8_title: "8. TERMINATION AND SUSPENSION",
      section8_text: "We may terminate or suspend any account that violates the terms of use, at any time and without notice.",
      
      section9_title: "9. CHANGES TO TERMS",
      section9_text: "We reserve the right to modify these terms at any time. Continued use of the platform after changes means acceptance of the new terms.",
      
      section10_title: "10. APPLICABLE LAW",
      section10_text: "These terms are governed by Greek law. Any dispute will be resolved in Greek courts. Users accept the exclusive jurisdiction of Greek courts.",
      
      section11_title: "11. CONTACT",
      section11_text: "For questions regarding the terms of use, contact us through the Contact page.",
      
      disclaimer: "WARNING: By using this platform, you acknowledge that you have read, understood, and accepted all the above terms, including the complete disclaimer of liability. You use the platform ENTIRELY AT YOUR OWN RISK.",
      
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
            <p className="text-slate-700 leading-relaxed">{txt.section1_text}</p>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section2_title}</h2>
            <p className="text-slate-700 leading-relaxed">{txt.section2_text}</p>
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
            <p className="text-slate-700 mt-4 leading-relaxed">{txt.section3_text2}</p>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section4_title}</h2>
            <p className="text-slate-700 mb-3">{txt.section4_text}</p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li>{txt.section4_list1}</li>
              <li>{txt.section4_list2}</li>
              <li>{txt.section4_list3}</li>
              <li>{txt.section4_list4}</li>
              <li>{txt.section4_list5}</li>
            </ul>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section5_title}</h2>
            <p className="text-slate-700 font-semibold mb-3">{txt.section5_text}</p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
              <li>{txt.section5_list1}</li>
              <li>{txt.section5_list2}</li>
              <li>{txt.section5_list3}</li>
              <li>{txt.section5_list4}</li>
              <li>{txt.section5_list5}</li>
              <li>{txt.section5_list6}</li>
              <li>{txt.section5_list7}</li>
              <li>{txt.section5_list8}</li>
              <li>{txt.section5_list9}</li>
            </ul>
            <p className="text-slate-700 mt-4 font-semibold leading-relaxed">{txt.section5_text2}</p>
          </section>

          <section className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200 shadow-sm">
            <h2 className="text-2xl font-bold text-blue-900 mb-4">{txt.section6_title}</h2>
            <p className="text-blue-800 font-semibold leading-relaxed">{txt.section6_text}</p>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section7_title}</h2>
            <p className="text-slate-700 leading-relaxed">{txt.section7_text}</p>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section8_title}</h2>
            <p className="text-slate-700 leading-relaxed">{txt.section8_text}</p>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section9_title}</h2>
            <p className="text-slate-700 leading-relaxed">{txt.section9_text}</p>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section10_title}</h2>
            <p className="text-slate-700 leading-relaxed">{txt.section10_text}</p>
          </section>

          <section className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{txt.section11_title}</h2>
            <p className="text-slate-700 leading-relaxed">{txt.section11_text}</p>
          </section>

          <div className="bg-yellow-50 p-6 rounded-lg border-2 border-yellow-300 shadow-sm">
            <p className="text-yellow-900 font-bold text-lg leading-relaxed">{txt.disclaimer}</p>
          </div>
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

