"use client";

import { useEffect, useRef, useState } from "react";
import BrandSignupForm from "@/components/BrandSignupForm";
import InfluencerSignupForm from "@/components/InfluencerSignupForm";

type Role = "influencer" | "brand";

const COPY = {
  el: {
    title: "Εγγραφή",
    lead: "Διάλεξε πώς θα χρησιμοποιήσεις το Influo.",
    creatorTitle: "Δημιουργός",
    creatorKicker: "Creator",
    creatorPoints: [
      "Δημόσιο προφίλ στον κατάλογο.",
      "Προτάσεις συνεργασίας και αιτήσεις σε καμπάνιες.",
      "Ορίζεις τις τιμές σου. Η πληρωμή γίνεται απευθείας με την επιχείρηση.",
    ],
    brandTitle: "Επιχείρηση",
    brandKicker: "Brand",
    brandPoints: [
      "Δωρεάν λογαριασμός.",
      "Αναζήτηση creators και αποστολή προτάσεων.",
      "Δημοσίευση καμπανιών. Το Influo δεν παίρνει προμήθεια.",
    ],
    continue: "Συνέχεια",
    back: "Πίσω",
    close: "Κλείσιμο",
    haveAccount: "Έχεις ήδη λογαριασμό;",
    signIn: "Σύνδεση",
  },
  en: {
    title: "Sign up",
    lead: "Choose how you will use Influo.",
    creatorTitle: "Creator",
    creatorKicker: "Δημιουργός",
    creatorPoints: [
      "A public profile in the directory.",
      "Collaboration proposals and applications to campaigns.",
      "You set your prices. Payment is made directly with the brand.",
    ],
    brandTitle: "Brand",
    brandKicker: "Επιχείρηση",
    brandPoints: [
      "A free account.",
      "Search creators and send proposals.",
      "Publish campaigns. Influo does not take a commission.",
    ],
    continue: "Continue",
    back: "Back",
    close: "Close",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
  },
} as const;

function RoleCard({
  kicker,
  title,
  points,
  continueLabel,
  onChoose,
}: {
  kicker: string;
  title: string;
  points: readonly string[];
  continueLabel: string;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChoose}
      className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 sm:p-6"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{kicker}</p>
      <h3 className="mt-1 text-xl font-semibold text-slate-900">{title}</h3>
      <ul className="mt-4 flex-1 space-y-2 text-sm leading-relaxed text-slate-600">
        {points.map((point) => (
          <li key={point} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <span className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-slate-900">
        {continueLabel}
        <span aria-hidden className="ml-1">→</span>
      </span>
    </button>
  );
}

/**
 * Signup from the header and the login page: choose a role, then the existing form.
 */
export default function SignupChoiceModal({
  open,
  onClose,
  lang,
  initialType = null,
}: {
  open: boolean;
  onClose: () => void;
  lang: "el" | "en";
  initialType?: Role | null;
}) {
  const txt = COPY[lang];
  const [picked, setPicked] = useState<Role | null>(initialType);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) setPicked(initialType ?? null);
    wasOpen.current = open;
  }, [open, initialType]);

  if (!open) return null;

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-3 sm:p-6 ${picked ? "max-sm:overflow-hidden max-sm:p-0" : ""}`}>
      <div
        className={`relative mx-auto my-2 w-full max-w-4xl sm:my-6 ${picked ? "max-sm:my-0 max-sm:h-dvh" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-choice-title"
      >
        <div className={`rounded-2xl border border-slate-200 bg-slate-50 shadow-xl ${picked ? "max-sm:flex max-sm:h-full max-sm:flex-col max-sm:rounded-none max-sm:border-0" : ""}`}>
          <div className={`flex items-start justify-between gap-4 border-b border-slate-200 px-5 sm:px-6 sm:py-4 ${picked ? "py-1.5 max-sm:shrink-0 max-sm:items-center" : "py-4"}`}>
            <div>
              {picked ? (
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  className="mb-2 inline-flex min-h-11 items-center max-sm:mb-0 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  ← {txt.back}
                </button>
              ) : null}
              <h2 id="signup-choice-title" className={`text-lg font-semibold sm:text-2xl max-sm:!text-lg max-sm:!leading-tight ${picked ? "sr-only" : ""} tracking-tight text-slate-900`}>
                {txt.title}
              </h2>
              {picked ? null : <p className="mt-1 text-xs text-slate-600 sm:text-sm max-sm:!text-xs">{txt.lead}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={txt.close}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-900"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {picked ? (
            <div className="p-3 sm:p-5 max-sm:min-h-0 max-sm:flex-1 max-sm:p-0">
              {picked === "influencer" ? <InfluencerSignupForm /> : <BrandSignupForm embedded />}
            </div>
          ) : (
            <div className="px-5 py-5 sm:px-6 sm:py-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <RoleCard
                  kicker={txt.creatorKicker}
                  title={txt.creatorTitle}
                  points={txt.creatorPoints}
                  continueLabel={txt.continue}
                  onChoose={() => setPicked("influencer")}
                />
                <RoleCard
                  kicker={txt.brandKicker}
                  title={txt.brandTitle}
                  points={txt.brandPoints}
                  continueLabel={txt.continue}
                  onChoose={() => setPicked("brand")}
                />
              </div>
              <p className="mt-5 text-center text-sm text-slate-600">
                {txt.haveAccount}{" "}
                <a href="/login" className="font-semibold text-slate-900 underline-offset-2 hover:underline">
                  {txt.signIn}
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
