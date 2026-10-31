"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { setStoredLanguage } from "@/lib/language";
import { alternateLocalePath, usePublicAccountNav } from "@/lib/publicAccountNav";

type Lang = "el" | "en";

const NAV = {
  el: {
    home: "Αρχική",
    influencers: "Influencers",
    campaigns: "Καμπάνιες",
    forBrands: "Για brands",
    forInfluencers: "Για influencers",
    docs: "Οδηγός",
    menu: "Μενού",
    close: "Κλείσιμο",
  },
  en: {
    home: "Home",
    influencers: "Influencers",
    campaigns: "Campaigns",
    forBrands: "For brands",
    forInfluencers: "For influencers",
    docs: "Guide",
    menu: "Menu",
    close: "Close",
  },
} as const;

function navHref(lang: Lang, elPath: string, enPath: string): string {
  return lang === "en" ? enPath : elPath;
}

function pathMatches(pathname: string, candidates: string[]): boolean {
  const path = (pathname || "/").split("?")[0] || "/";
  return candidates.some((c) => {
    if (c === "/" || c === "/en") return path === c;
    return path === c || path.startsWith(`${c}/`);
  });
}

function linkClass(active: boolean): string {
  return active
    ? "text-slate-900 font-semibold"
    : "text-slate-700 hover:text-slate-900 transition-colors";
}

export default function SiteHeader({
  lang,
  onLangChange,
}: {
  lang: Lang;
  /** Called when language toggles (useful on pages without `/en` mirrors). */
  onLangChange?: (lang: Lang) => void;
}) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { identityReady, dashboardPath, dashboardLabel } = usePublicAccountNav(lang);
  const t = NAV[lang];

  const items = [
    {
      key: "home",
      label: t.home,
      href: navHref(lang, "/", "/en"),
      active: pathMatches(pathname, ["/", "/en"]),
    },
    {
      key: "influencers",
      label: t.influencers,
      href: navHref(lang, "/directory", "/en/directory"),
      active: pathMatches(pathname, ["/directory", "/en/directory", "/in", "/influencer"]),
    },
    {
      key: "campaigns",
      label: t.campaigns,
      href: navHref(lang, "/campaigns", "/en/campaigns"),
      active: pathMatches(pathname, ["/campaigns", "/en/campaigns"]),
    },
    {
      key: "for-brands",
      label: t.forBrands,
      href: navHref(lang, "/for-brands", "/en/for-brands"),
      active: pathMatches(pathname, ["/for-brands", "/en/for-brands"]),
    },
    {
      key: "for-influencers",
      label: t.forInfluencers,
      href: navHref(lang, "/for-influencers", "/en/for-influencers"),
      active: pathMatches(pathname, ["/for-influencers", "/en/for-influencers"]),
    },
    {
      key: "docs",
      label: t.docs,
      href: navHref(lang, "/docs", "/en/docs"),
      active: pathMatches(pathname, ["/docs", "/en/docs"]),
    },
  ];

  const switchLang = () => {
    const next: Lang = lang === "el" ? "en" : "el";
    setStoredLanguage(next);
    onLangChange?.(next);
    const href = alternateLocalePath(pathname, next);
    if (href !== pathname) router.push(href);
    setMobileOpen(false);
  };

  const accountLink = identityReady ? (
    <Link
      href={dashboardPath}
      className="inline-flex min-h-[44px] items-center text-sm font-medium text-blue-600 hover:underline whitespace-nowrap"
    >
      {dashboardLabel}
    </Link>
  ) : (
    <span className="inline-block h-4 w-24 rounded bg-slate-200 animate-pulse" aria-hidden />
  );

  const langButton = (
    <button
      type="button"
      onClick={switchLang}
      className="inline-flex min-h-[44px] items-center text-xs font-medium border border-slate-200 px-3 rounded hover:bg-slate-50 text-slate-600 transition-colors"
      aria-label="Toggle language"
    >
      {lang === "el" ? "EN" : "EL"}
    </button>
  );

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
      <div className="max-w-7xl mx-auto flex justify-between items-center px-4 sm:px-6 py-4 gap-3">
        <Link href={lang === "en" ? "/en" : "/"} className="flex items-center gap-2 shrink-0" aria-label="Influo Home">
          <Image src="/logo.svg" alt="Influo.gr Logo" width={160} height={64} className="h-10 w-auto" priority />
        </Link>

        <nav className="hidden md:flex items-center gap-6 min-w-0" aria-label="Main navigation">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium">
            {items.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className={linkClass(item.active)} aria-current={item.active ? "page" : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 shrink-0">
            {accountLink}
            {langButton}
          </div>
        </nav>

        <div className="flex items-center gap-2 md:hidden shrink-0">
          {accountLink}
          {langButton}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label={mobileOpen ? t.close : t.menu}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="md:hidden border-t border-slate-200 bg-white" aria-label="Mobile navigation">
          <ul className="px-4 py-3 space-y-1">
            {items.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-3 text-sm rounded-lg ${
                    item.active ? "bg-slate-100 text-slate-900 font-semibold" : "text-slate-700 hover:bg-slate-50"
                  }`}
                  aria-current={item.active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
