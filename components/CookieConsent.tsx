"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  COOKIE_CONSENT_EVENT,
  COOKIE_OPEN_EVENT,
  getCookieConsent,
  setCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookieConsent";

const GA_ID = "G-WPL9D1TX3N";
const ADS_ID = "AW-18064167249";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __influoGtagLoaded?: boolean;
  }
}

function loadGoogleTags() {
  if (typeof window === "undefined" || window.__influoGtagLoaded) return;
  window.__influoGtagLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
  window.gtag("config", ADS_ID);
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

function denyGoogleTags() {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("consent", "update", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

export default function CookieConsent() {
  const pathname = usePathname();
  const lang = pathname?.startsWith("/en") ? "en" : "el";
  const [choice, setChoice] = useState<CookieConsentValue | null | "pending">("pending");
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    setChoice(getCookieConsent());
    const onChange = (e: Event) => {
      const v = (e as CustomEvent<CookieConsentValue>).detail;
      if (v === "accepted" || v === "rejected") {
        setChoice(v);
        setForceShow(false);
      }
    };
    const onOpen = () => setForceShow(true);
    window.addEventListener(COOKIE_CONSENT_EVENT, onChange);
    window.addEventListener(COOKIE_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, onChange);
      window.removeEventListener(COOKIE_OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (choice === "accepted") loadGoogleTags();
    if (choice === "rejected") denyGoogleTags();
  }, [choice]);

  const decide = (value: CookieConsentValue) => {
    setCookieConsent(value);
    setChoice(value);
    setForceShow(false);
  };

  const showBanner = choice !== "pending" && (choice === null || forceShow);
  if (!showBanner) return null;

  const el = lang === "el";
  const cookiesHref = el ? "/cookies" : "/en/cookies";

  return (
    <div className="fixed bottom-0 inset-x-0 z-[70] p-3 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white/95 shadow-[0_8px_30px_rgba(15,23,42,0.12)] backdrop-blur px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-[13px] leading-snug text-slate-600 flex-1">
            {el
              ? "Χρησιμοποιούμε απαραίτητα cookies για τη λειτουργία του site και, μόνο με τη συγκατάθεσή σας, Google Analytics και Google Ads."
              : "We use essential cookies to run the site and, only with your consent, Google Analytics and Google Ads."}{" "}
            <Link href={cookiesHref} className="text-slate-900 underline underline-offset-2 hover:text-blue-700">
              {el ? "Περισσότερα" : "Learn more"}
            </Link>
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => decide("rejected")}
              className="flex-1 sm:flex-none min-w-[108px] px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-800 bg-white hover:bg-slate-50"
            >
              {el ? "Απόρριψη" : "Reject"}
            </button>
            <button
              type="button"
              onClick={() => decide("accepted")}
              className="flex-1 sm:flex-none min-w-[108px] px-3 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
            >
              {el ? "Αποδοχή" : "Accept"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
