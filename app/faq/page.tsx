"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Footer from "../../components/Footer";
import SiteHeader from "@/components/SiteHeader";
import { usePathname } from 'next/navigation';
import { getStoredLanguage } from '@/lib/language';
import { faqs } from "@/lib/faqItems";

type Lang = "el" | "en";

export default function FAQPage() {
  const pathname = usePathname();
  const [lang, setLang] = useState<Lang>(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  }, [pathname]);

  const categories = Array.from(new Set(faqs.map(faq => faq.category[lang])));
  const filteredFAQs = selectedCategory === "all" 
    ? faqs 
    : faqs.filter(faq => faq.category[lang] === selectedCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <SiteHeader lang={lang} onLangChange={setLang} />

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
              href={lang === "en" ? "/en/contact" : "/contact"}
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

