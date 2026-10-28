"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getStoredLanguage } from "@/lib/language";
import type { Lang } from "@/lib/bilingual";

/** Sync marketing-page language from `/en` path or stored preference. */
export function useMarketingLang(): [Lang, (lang: Lang) => void] {
  const pathname = usePathname();
  const [lang, setLang] = useState<Lang>(
    pathname?.startsWith("/en") ? "en" : getStoredLanguage()
  );

  useEffect(() => {
    setLang(pathname?.startsWith("/en") ? "en" : getStoredLanguage());
  }, [pathname]);

  return [lang, setLang];
}
