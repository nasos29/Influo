"use client";

import { useState } from "react";
import BrandSignupForm from "@/components/BrandSignupForm";
import SiteHeader from "@/components/SiteHeader";
import { getStoredLanguage, setStoredLanguage, type Language } from "@/lib/language";

export default function BrandSignupPage() {
  const [lang, setLang] = useState<Language>(() =>
    typeof window === "undefined" ? "el" : getStoredLanguage()
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <SiteHeader
        lang={lang}
        onLangChange={(next) => {
          setStoredLanguage(next);
          setLang(next);
        }}
      />
      <div className="flex items-center justify-center p-4 py-10">
        <div className="w-full max-w-4xl">
          <BrandSignupForm />
        </div>
      </div>
    </div>
  );
}
