"use client";

import { useEffect, useState } from "react";

interface FooterProps {
  lang?: "el" | "en";
}

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
  return window.matchMedia("(display-mode: standalone)").matches || !!(navigator as Navigator & { standalone?: boolean }).standalone;
}

export default function InstallAppCard({ lang = "el" }: FooterProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as DeferredInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const txt = {
    el: {
      title: "Εγκατάσταση App",
      desc: "Το Influo λειτουργεί σαν app σε Android και iPhone για πιο γρήγορη πρόσβαση από την αρχική οθόνη.",
      install: "Εγκατάσταση",
      later: "Όχι τώρα",
      ios: "iPhone / iPad: πάτησε Κοινοποίηση και μετά «Προσθήκη στην Αρχική Οθόνη».",
      android: "Android: πάτησε «Εγκατάσταση» ή άνοιξε το menu του browser και επίλεξε Install app / Add to Home screen.",
    },
    en: {
      title: "Install App",
      desc: "Influo works like an app on Android and iPhone for faster access from your home screen.",
      install: "Install",
      later: "Not now",
      ios: "iPhone / iPad: tap Share and then “Add to Home Screen”.",
      android: "Android: tap “Install” or open the browser menu and choose Install app / Add to Home screen.",
    },
  }[lang];

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

  if (installed || dismissed) return null;

  return (
    <div className="mb-10 rounded-2xl border border-blue-400/20 bg-gradient-to-r from-blue-600/10 via-slate-800 to-indigo-600/10 p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <p className="text-white font-semibold text-base md:text-lg">{txt.title}</p>
          <p className="text-slate-300 text-sm mt-1">{txt.desc}</p>
          <p className="text-blue-200 text-xs mt-3">{isIOS() ? txt.ios : txt.android}</p>
        </div>
        <div className="flex items-center gap-3">
          {deferredPrompt && !isIOS() && (
            <button
              type="button"
              onClick={handleInstall}
              disabled={installing}
              className="rounded-xl bg-white text-slate-900 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 transition-colors disabled:opacity-70"
            >
              {installing ? "..." : txt.install}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-xl border border-slate-600 text-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            {txt.later}
          </button>
        </div>
      </div>
    </div>
  );
}
