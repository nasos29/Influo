"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import Footer from "../../components/Footer";
import { getStoredLanguage, setStoredLanguage } from '@/lib/language';

type Lang = "el" | "en";

interface FAQItem {
  question: { el: string; en: string };
  answer: { el: string; en: string };
  category: { el: string; en: string };
}

const faqs: FAQItem[] = [
  {
    category: { el: "Γενικά", en: "General" },
    question: {
      el: "Τι είναι η Influo;",
      en: "What is Influo?"
    },
    answer: {
      el: "Η Influo είναι η πιο σύγχρονη πλατφόρμα Influencer Marketing στην Ελλάδα. Συνδέει brands με verified influencers για επαγγελματικές συνεργασίες.",
      en: "Influo is the most modern Influencer Marketing platform in Greece. It connects brands with verified influencers for professional collaborations."
    }
  },
  {
    category: { el: "Γενικά", en: "General" },
    question: {
      el: "Πόσο κοστίζει η χρήση της πλατφόρμας;",
      en: "How much does it cost to use the platform?"
    },
    answer: {
      el: "Η εγγραφή και η βασική χρήση είναι δωρεάν για influencers και brands. Κερδίζετε μόνο όταν κλείνετε συνεργασίες!",
      en: "Registration and basic use is free for influencers and brands. You only earn when you close collaborations!"
    }
  },
  {
    category: { el: "Για Influencers", en: "For Influencers" },
    question: {
      el: "Πώς γίνομαι influencer στην Influo;",
      en: "How do I become an influencer on Influo?"
    },
    answer: {
      el: "Εγγραφείτε δωρεάν, συμπληρώστε το προφίλ σας με stats, pricing και portfolio. Μετά την verification, θα εμφανίζεστε στον κατάλογο και θα λαμβάνετε προσφορές από brands.",
      en: "Sign up for free, complete your profile with stats, pricing and portfolio. After verification, you'll appear in the directory and receive offers from brands."
    }
  },
  {
    category: { el: "Για Influencers", en: "For Influencers" },
    question: {
      el: "Πώς λειτουργεί η πληρωμή;",
      en: "How does payment work?"
    },
    answer: {
      el: "Οι πληρωμές γίνονται απευθείας μεταξύ εσάς και του brand, σύμφωνα με τους όρους που συμφωνήσατε. Η πλατφόρμα διευκολύνει την επικοινωνία και την οργάνωση.",
      en: "Payments are made directly between you and the brand, according to the terms you agreed on. The platform facilitates communication and organization."
    }
  },
  {
    category: { el: "Για Influencers", en: "For Influencers" },
    question: {
      el: "Τι είναι τα badges και πώς τα κερδίζω;",
      en: "What are badges and how do I earn them?"
    },
    answer: {
      el: "Τα badges αναγνωρίζουν την απόδοση σας (New, Rising, Top Performer, Pro, Elite, VIP). Ενημερώνονται αυτόματα βάσει των followers, engagement rate, συνεργασιών και reviews.",
      en: "Badges recognize your performance (New, Rising, Top Performer, Pro, Elite, VIP). They update automatically based on followers, engagement rate, collaborations and reviews."
    }
  },
  {
    category: { el: "Για Brands", en: "For Brands" },
    question: {
      el: "Πώς βρίσκω influencers για το brand μου;",
      en: "How do I find influencers for my brand?"
    },
    answer: {
      el: "Χρησιμοποιήστε τα προηγμένα φίλτρα στον κατάλογο: κατηγορία, engagement rate, followers, budget, location. Κάντε κλικ σε έναν influencer και στείλτε προσφορά.",
      en: "Use the advanced filters in the directory: category, engagement rate, followers, budget, location. Click on an influencer and send a proposal."
    }
  },
  {
    category: { el: "Για Brands", en: "For Brands" },
    question: {
      el: "Πώς ξέρω αν ένας influencer είναι αξιόπιστος;",
      en: "How do I know if an influencer is trustworthy?"
    },
    answer: {
      el: "Ελέγξτε: Verified badge, reviews από άλλα brands, completion rate, response time, και engagement rate. Όλοι οι influencers είναι verified με πραγματικά stats.",
      en: "Check: Verified badge, reviews from other brands, completion rate, response time, and engagement rate. All influencers are verified with real stats."
    }
  },
  {
    category: { el: "Για Brands", en: "For Brands" },
    question: {
      el: "Μπορώ να κάνω αντιπροσφορά;",
      en: "Can I make a counter-proposal?"
    },
    answer: {
      el: "Ναι! Αν ένας influencer κάνει αντιπροσφορά, μπορείτε να την αποδεχτείτε, να την απαρνηθείτε ή να συζητήσετε μέσω μηνυμάτων.",
      en: "Yes! If an influencer makes a counter-proposal, you can accept it, reject it, or discuss via messages."
    }
  },
  {
    category: { el: "Για Brands", en: "For Brands" },
    question: {
      el: "Τι είναι η Έξυπνη Υπηρεσία Προτάσεων (AI Recommendations);",
      en: "What is the Smart Recommendation Service (AI Recommendations)?"
    },
    answer: {
      el: "Το AI μας αναλύει το brand σας (industry, προτιμήσεις) και προτείνει αυτόματα τους καλύτερους influencers. Κάθε πρόταση έχει match score (0-100%), προσωποποιημένες αιτιολογίες (γιατί ταιριάζει), και μπορείτε να χρησιμοποιήσετε advanced filters (budget, engagement, rating, κατηγορία). Η υπηρεσία είναι 100% ΔΩΡΕΑΝ για όλες τις εγγεγραμμένες επιχειρήσεις!",
      en: "Our AI analyzes your brand (industry, preferences) and automatically suggests the best influencers. Each recommendation has a match score (0-100%), personalized reasons (why it matches), and you can use advanced filters (budget, engagement, rating, category). The service is 100% FREE for all registered businesses!"
    }
  },
  {
    category: { el: "Για Brands", en: "For Brands" },
    question: {
      el: "Πώς λειτουργεί το match score;",
      en: "How does the match score work?"
    },
    answer: {
      el: "Το match score (0-100%) υπολογίζεται από πολλαπλούς παράγοντες: Category Match (30%), Engagement Quality (25%), Rating Quality (20%), Value/Price Ratio (15%), και Verified Status (10%). Score >80% = Excellent Match (πράσινο), 65-80% = Very Good (μπλε), <65% = Good (κίτρινο).",
      en: "The match score (0-100%) is calculated from multiple factors: Category Match (30%), Engagement Quality (25%), Rating Quality (20%), Value/Price Ratio (15%), and Verified Status (10%). Score >80% = Excellent Match (green), 65-80% = Very Good (blue), <65% = Good (yellow)."
    }
  },
  {
    category: { el: "Για Brands", en: "For Brands" },
    question: {
      el: "Μπορώ να φιλτράρω τις προτάσεις;",
      en: "Can I filter the recommendations?"
    },
    answer: {
      el: "Ναι! Μπορείτε να φιλτράρετε με: Ελάχιστο Match Score, Μέγιστη Τιμή (€), Κατηγορία, Ελάχιστο Engagement Rate (%), και Ελάχιστο Rating. Υπάρχει επίσης κουμπί ανανέωσης για να λάβετε νέες προτάσεις και stats που δείχνουν πόσες προτάσεις είδατε, πόσα προφίλ επισκεφτήκατε, και πόσες προσφορές στείλατε.",
      en: "Yes! You can filter by: Minimum Match Score, Maximum Price (€), Category, Minimum Engagement Rate (%), and Minimum Rating. There's also a refresh button to get new recommendations and stats showing how many recommendations you viewed, profiles you visited, and proposals you sent."
    }
  },
  {
    category: { el: "Συνεργασίες", en: "Collaborations" },
    question: {
      el: "Τι συμβαίνει μετά την αποδοχή μιας προσφοράς;",
      en: "What happens after accepting a proposal?"
    },
    answer: {
      el: "Εμφανίζεται modal με τους όρους χρήσης. Και οι δύο πλευρές πρέπει να αποδεχτούν. Μετά, το brand προστίθεται στο Past Brands του influencer.",
      en: "A modal appears with terms of service. Both parties must accept. Then, the brand is added to the influencer's Past Brands."
    }
  },
  {
    category: { el: "Συνεργασίες", en: "Collaborations" },
    question: {
      el: "Μπορώ να ακυρώσω μια συνεργασία;",
      en: "Can I cancel a collaboration?"
    },
    answer: {
      el: "Ναι, αλλά συνιστούμε να συζητήσετε πρώτα με την άλλη πλευρά. Οι ακυρώσεις μπορεί να επηρεάσουν το completion rate.",
      en: "Yes, but we recommend discussing first with the other party. Cancellations may affect completion rate."
    }
  }
];

export default function FAQPage() {
  const [lang, setLang] = useState<Lang>("el"); // Default to Greek, will be updated in useEffect
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Load language from localStorage on client-side
  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);

  const categories = Array.from(new Set(faqs.map(faq => faq.category[lang])));
  const filteredFAQs = selectedCategory === "all" 
    ? faqs 
    : faqs.filter(faq => faq.category[lang] === selectedCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 sm:px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Influo.gr Logo" width={160} height={64} className="h-10 w-auto" priority />
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
              {lang === "el" ? "← Επιστροφή" : "← Back"}
            </Link>
            <button 
              onClick={() => {
                const newLang = lang === "el" ? "en" : "el";
                setLang(newLang);
                setStoredLanguage(newLang);
              }}
              className="text-xs font-medium border border-slate-200 px-3 py-1.5 rounded hover:bg-slate-50 text-slate-600 transition-colors"
            >
              {lang === "el" ? "EN" : "EL"}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {lang === "el" ? "Συχνές Ερωτήσεις (FAQ)" : "Frequently Asked Questions"}
          </h1>
          <p className="text-xl text-blue-100">
            {lang === "el" 
              ? "Βρείτε απαντήσεις στις πιο συχνές ερωτήσεις σας"
              : "Find answers to your most common questions"}
          </p>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Category Filters */}
          <div className="flex flex-wrap gap-3 mb-8 justify-center">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {lang === "el" ? "Όλα" : "All"}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* FAQ Items */}
          <div className="space-y-4">
            {filteredFAQs.map((faq, index) => (
              <div
                key={index}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full px-6 py-5 text-left flex justify-between items-center hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-slate-900 pr-4">
                    {faq.question[lang]}
                  </span>
                  <svg
                    className={`w-5 h-5 text-slate-500 flex-shrink-0 transition-transform ${
                      openIndex === index ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openIndex === index && (
                  <div className="px-6 pb-5 border-t border-slate-100">
                    <p className="pt-4 text-slate-700 leading-relaxed">
                      {faq.answer[lang]}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Contact Support */}
          <div className="mt-12 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8 text-center border border-blue-200">
            <h3 className="text-xl font-bold text-slate-900 mb-3">
              {lang === "el" ? "Δεν βρήκατε την απάντηση;" : "Didn't find your answer?"}
            </h3>
            <p className="text-slate-600 mb-4">
              {lang === "el" 
                ? "Επικοινωνήστε μαζί μας και θα σας βοηθήσουμε"
                : "Contact us and we'll help you"}
            </p>
            <Link
              href="/contact"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              {lang === "el" ? "Επικοινωνία" : "Contact Us"}
            </Link>
          </div>
        </div>
      </section>

      <Footer lang={lang} />
    </div>
  );
}

