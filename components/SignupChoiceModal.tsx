"use client";

import { useEffect, useRef, useState } from "react";
import BrandSignupForm from "@/components/BrandSignupForm";
import InfluencerSignupForm from "@/components/InfluencerSignupForm";

const COPY = {
  el: {
    signup_as: "Εγγραφή ως:",
    influencer: "Είμαι Influencer",
    brand: "Έχω Επιχείρηση",
    close: "Κλείσιμο",
  },
  en: {
    signup_as: "Sign up as:",
    influencer: "I am an Influencer",
    brand: "I have a Company",
    close: "Close",
  },
} as const;

/**
 * The homepage header signup popup: brand or creator, then the existing form.
 */
export default function SignupChoiceModal({
  open,
  onClose,
  lang,
  initialType = "influencer",
}: {
  open: boolean;
  onClose: () => void;
  lang: "el" | "en";
  initialType?: "influencer" | "brand";
}) {
  const txt = COPY[lang];
  const [signupType, setSignupType] = useState<"influencer" | "brand">(initialType);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) setSignupType(initialType);
    wasOpen.current = open;
  }, [open, initialType]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative mx-auto my-4 w-full max-w-5xl animate-in zoom-in duration-300 sm:my-8"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={txt.signup_as}
      >
        <div className="mb-5 sm:mb-6">
          <p className="mb-2 text-sm font-bold tracking-wide text-white sm:text-base">{txt.signup_as}</p>
          <div
            role="group"
            aria-label={txt.signup_as}
            className="grid grid-cols-2 gap-2 rounded-2xl border-2 border-white bg-slate-950/55 p-2 shadow-xl"
          >
            <button
              type="button"
              aria-pressed={signupType === "influencer"}
              onClick={() => setSignupType("influencer")}
              className={`flex min-h-[56px] items-center justify-center gap-2 rounded-xl px-2 py-3 text-center text-sm font-bold leading-tight transition-all sm:min-h-[60px] sm:px-4 sm:text-base ${
                signupType === "influencer"
                  ? "bg-white text-slate-900 shadow-md ring-2 ring-blue-500"
                  : "border border-white/80 bg-transparent text-white hover:bg-white/10"
              }`}
            >
              {signupType === "influencer" ? (
                <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-blue-600" fill="currentColor" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.2 7.2a1 1 0 0 1-1.4 0L3.3 9.1a1 1 0 1 1 1.4-1.4l4.1 4.1 6.5-6.5a1 1 0 0 1 1.4 0Z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : null}
              {txt.influencer}
            </button>
            <button
              type="button"
              aria-pressed={signupType === "brand"}
              onClick={() => setSignupType("brand")}
              className={`flex min-h-[56px] items-center justify-center gap-2 rounded-xl px-2 py-3 text-center text-sm font-bold leading-tight transition-all sm:min-h-[60px] sm:px-4 sm:text-base ${
                signupType === "brand"
                  ? "bg-white text-slate-900 shadow-md ring-2 ring-blue-500"
                  : "border border-white/80 bg-transparent text-white hover:bg-white/10"
              }`}
            >
              {signupType === "brand" ? (
                <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-blue-600" fill="currentColor" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.2 7.2a1 1 0 0 1-1.4 0L3.3 9.1a1 1 0 1 1 1.4-1.4l4.1 4.1 6.5-6.5a1 1 0 0 1 1.4 0Z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : null}
              {txt.brand}
            </button>
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={onClose}
            aria-label={txt.close}
            className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 shadow-sm transition-colors hover:bg-red-100 hover:text-red-700"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          {signupType === "influencer" ? <InfluencerSignupForm /> : <BrandSignupForm embedded />}
        </div>
      </div>
    </div>
  );
}
