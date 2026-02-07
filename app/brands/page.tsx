"use client";

import { useState, useEffect } from "react";
import BrandsDirectory from "../../components/BrandsDirectory";
import Footer from "../../components/Footer";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getStoredLanguage, setStoredLanguage } from "@/lib/language";

type Lang = "el" | "en";

const t = {
  el: {
    title: "Κατάλογος Επιχειρήσεων",
    subtitle: "Ανακαλύψτε επαληθευμένες επιχειρήσεις",
    back: "Επιστροφή",
  },
  en: {
    title: "Brands Directory",
    subtitle: "Discover verified companies",
    back: "Back",
  }
};

export default function BrandsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(pathname?.startsWith("/en") ? "en" : getStoredLanguage());

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
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
              {lang === "el" ? "Αρχική" : "Home"}
            </Link>
            <button 
              onClick={() => {
                const newLang = lang === "el" ? "en" : "el";
                setLang(newLang);
                setStoredLanguage(newLang);
                if (newLang === "en") router.push("/en/brands");
                else router.push("/brands");
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
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-8">
            <Link href={lang === "en" ? "/en" : "/"} className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t[lang].back}
            </Link>
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

