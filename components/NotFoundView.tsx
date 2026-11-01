"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getStoredLanguage } from "@/lib/language";

const COPY = {
  el: {
    title: "Η σελίδα δεν βρέθηκε",
    body: "Η διεύθυνση δεν υπάρχει ή το προφίλ δεν είναι διαθέσιμο. Δοκίμασε τον κατάλογο influencers ή γύρνα στην αρχική.",
    home: "Αρχική",
    directory: "Κατάλογος influencers",
    homeHref: "/",
    directoryHref: "/directory",
  },
  en: {
    title: "Page not found",
    body: "This address does not exist, or the profile is not available. Try the influencer directory or go back home.",
    home: "Home",
    directory: "Influencer directory",
    homeHref: "/en",
    directoryHref: "/en/directory",
  },
} as const;

export default function NotFoundView() {
  const pathname = usePathname() || "/";
  const [lang, setLang] = useState<"el" | "en">(pathname === "/en" || pathname.startsWith("/en/") ? "en" : "el");

  useEffect(() => {
    const path = window.location.pathname || "/";
    const fromPath = path === "/en" || path.startsWith("/en/");
    setLang(fromPath || getStoredLanguage() === "en" ? "en" : "el");
  }, [pathname]);

  const copy = COPY[lang];

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-16">
      <div className="max-w-lg text-center">
        <p className="text-sm font-semibold tracking-wide text-blue-600 mb-3">404</p>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{copy.title}</h1>
        <p className="text-slate-600 mb-8">{copy.body}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href={copy.homeHref} className="px-6 py-3 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800">
            {copy.home}
          </Link>
          <Link href={copy.directoryHref} className="px-6 py-3 rounded-xl bg-white text-slate-900 font-semibold border border-slate-200 hover:bg-slate-50">
            {copy.directory}
          </Link>
        </div>
      </div>
    </main>
  );
}
