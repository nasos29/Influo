"use client";

import { Suspense, useState, useEffect } from "react";
import Directory, { type Influencer } from "@/components/Directory";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/SiteHeader";
import { usePathname } from "next/navigation";
import { getStoredLanguage } from "@/lib/language";

type Lang = "el" | "en";

const t = {
  el: {
    title: "Κατάλογος Influencers",
    subtitle: "Ανακαλύψτε τους καλύτερους content creators",
    stats_note: "Όλα τα προφίλ έχουν στατιστικά ελεγμένα από το Influo",
  },
  en: {
    title: "Influencer Directory",
    subtitle: "Discover the best content creators",
    stats_note: "All profiles have stats checked by Influo",
  }
};

export default function DirectoryPageView({
  initialInfluencers = [],
}: {
  initialInfluencers?: Influencer[];
}) {
  const pathname = usePathname();
  const [lang, setLang] = useState<Lang>(pathname?.startsWith("/en") ? "en" : getStoredLanguage());

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <SiteHeader lang={lang} onLangChange={setLang} />

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-2">{t[lang].title}</h1>
            <p className="text-lg text-slate-600">{t[lang].subtitle}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-500">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white" aria-hidden>
                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              {t[lang].stats_note}
            </p>
          </div>

          <Suspense fallback={<div className="h-40 rounded-2xl bg-white/60 animate-pulse" aria-hidden />}>
            <Directory lang={lang} initialInfluencers={initialInfluencers} />
          </Suspense>
        </div>
      </main>

      {/* Footer */}
      <Footer lang={lang} />
    </div>
  );
}
