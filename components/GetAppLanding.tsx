"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getSiteUrl } from "@/lib/pwaAppUrl";

type DeferredInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    !!(navigator as Navigator & { standalone?: boolean }).standalone
  );
}

const copy = {
  el: {
    title: "Εγκατάσταση Influo στο κινητό",
    subtitle: "Πρόσθεσέ το στην αρχική οθόνη για εμπειρία σαν εφαρμογή (PWA).",
    install: "Εγκατάσταση app",
    home: "Αρχική",
    androidWait: "Αν εμφανιστεί η επιλογή του Chrome, πάτησε «Εγκατάσταση».",
    androidMenu:
      "Ή άνοιξε το μενού του Chrome (⋮) και επίλεξε «Εγκατάσταση εφαρμογής» / «Install app».",
    iosTitle: "iPhone / iPad",
    iosSteps:
      "Πάτησε το κουμπί Κοινοποίηση και μετά «Προσθήκη στην Αρχική Οθόνη». Έπειτα «Προσθήκη».",
  },
  en: {
    title: "Install Influo on your phone",
    subtitle: "Add it to your home screen for an app-like experience (PWA).",
    install: "Install app",
    home: "Home",
    androidWait: "If Chrome offers an install banner, tap Install.",
    androidMenu: "Or open Chrome’s menu (⋮) and choose Install app / Add to Home screen.",
    iosTitle: "iPhone / iPad",
    iosSteps: 'Tap Share, then "Add to Home Screen", then "Add".',
  },
} as const;

export default function GetAppLanding({ lang }: { lang: "el" | "en" }) {
  const router = useRouter();
  const t = copy[lang];
  const homeHref = lang === "en" ? "/en" : "/";
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) {
      router.replace(homeHref);
      return;
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as DeferredInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      router.replace(homeHref);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [router, homeHref]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => null);
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : getSiteUrl();

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <Image src="/logo.svg" alt="Influo" width={180} height={72} className="h-12 w-auto mb-8" priority />
        <h1 className="text-2xl sm:text-3xl font-bold text-center max-w-lg mb-3">{t.title}</h1>
        <p className="text-slate-300 text-center max-w-md mb-10 text-sm sm:text-base">{t.subtitle}</p>

        {!isIOS() && deferredPrompt && (
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            className="rounded-2xl bg-white text-slate-900 px-8 py-4 text-base font-bold hover:bg-slate-100 transition-colors disabled:opacity-70 shadow-xl mb-8"
          >
            {installing ? "…" : t.install}
          </button>
        )}

        <div className="max-w-md w-full rounded-2xl border border-slate-600/80 bg-slate-800/50 p-6 backdrop-blur-sm">
          {isIOS() ? (
            <>
              <p className="font-semibold text-blue-200 mb-2">{t.iosTitle}</p>
              <p className="text-slate-300 text-sm leading-relaxed">{t.iosSteps}</p>
            </>
          ) : (
            <>
              <p className="text-slate-300 text-sm leading-relaxed mb-3">{t.androidWait}</p>
              <p className="text-slate-300 text-sm leading-relaxed">{t.androidMenu}</p>
            </>
          )}
        </div>

        <p className="mt-8 text-xs text-slate-500 break-all max-w-md text-center">
          {origin}
        </p>

        <Link
          href={homeHref}
          className="mt-10 text-sm font-medium text-blue-300 hover:text-blue-200 underline underline-offset-4"
        >
          ← {t.home}
        </Link>
      </div>
    </div>
  );
}
