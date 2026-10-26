"use client";

import { useState, useEffect } from "react";
import BrandsDirectory from "../../components/BrandsDirectory";
import Footer from "../../components/Footer";
import SiteHeader from "@/components/SiteHeader";
import { usePathname } from "next/navigation";
import { getStoredLanguage } from "@/lib/language";

type Lang = "el" | "en";

const t = {
  el: {
    title: "Κατάλογος Επιχειρήσεων",
    subtitle: "Ανακαλύψτε επαληθευμένες επιχειρήσεις",
  },
  en: {
    title: "Brands Directory",
    subtitle: "Discover verified companies",
  }
};

export default function BrandsPage() {
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
          </div>

          <BrandsDirectory lang={lang} />
        </div>
      </main>

      {/* Footer */}
      <Footer lang={lang} />
    </div>
  );
}

