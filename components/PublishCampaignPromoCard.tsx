"use client";

import {
  BadgeCheck,
  MessagesSquare,
  Sparkles,
  Wallet,
} from "lucide-react";
import { floorToTens } from "@/lib/loadHomeTrustStats";
import { formatEuro } from "@/lib/formatEuro";

type Lang = "el" | "en";

const copy = {
  el: {
    eyebrow: "Για επιχειρήσεις",
    title: "Βρες creators για την επόμενη καμπάνια σου",
    value:
      "Περιέγραψε τι χρειάζεσαι και το budget σου. Οι creators κάνουν αίτηση με την τιμή τους — εσύ επιλέγεις.",
    example: "Παράδειγμα",
    demoBrand: "Το Brand σου",
    demoTitle: "Story + Reel για νέο προϊόν",
    demoChip1: "Instagram",
    demoChip2: "1 Reel",
    benefits: [
      {
        icon: Wallet,
        text: "Δωρεάν δημοσίευση, χωρίς συνδρομή",
      },
      {
        icon: Sparkles,
        text: "Φτιάξε την καμπάνια με AI σε 1 λεπτό",
      },
      {
        icon: BadgeCheck,
        text: "Αιτήσεις από verified creators",
      },
      {
        icon: MessagesSquare,
        text: "Συζήτηση και συμφωνία μέσα στο Influo",
      },
    ],
    social: (n: number) =>
      `${n}+ verified creators έτοιμοι για αιτήσεις`,
    cta: "Δημοσίευσε καμπάνια",
  },
  en: {
    eyebrow: "For brands",
    title: "Find creators for your next campaign",
    value:
      "Describe what you need and your budget. Creators apply with their price — you choose who to work with.",
    example: "Example",
    demoBrand: "Your Brand",
    demoTitle: "Story + Reel for a new product",
    demoChip1: "Instagram",
    demoChip2: "1 Reel",
    benefits: [
      {
        icon: Wallet,
        text: "Free to publish, no subscription",
      },
      {
        icon: Sparkles,
        text: "Create your campaign with AI in 1 minute",
      },
      {
        icon: BadgeCheck,
        text: "Applications from verified creators",
      },
      {
        icon: MessagesSquare,
        text: "Chat and agree inside Influo",
      },
    ],
    social: (n: number) => `${n}+ verified creators ready to apply`,
    cta: "Post a campaign",
  },
} as const;

/**
 * Homepage filler card when fewer than 3 open campaigns are shown.
 * Decorative example preview only — CTA href must stay identical to the previous card.
 */
export default function PublishCampaignPromoCard({
  lang,
  href,
  approvedInfluencers = null,
}: {
  lang: Lang;
  href: string;
  /** Real approved-creator count from DB; never invent. Hide social proof when null/0. */
  approvedInfluencers?: number | null;
}) {
  const txt = copy[lang];
  const creatorFloor =
    typeof approvedInfluencers === "number"
      ? floorToTens(approvedInfluencers)
      : null;
  const showSocial = creatorFloor != null && creatorFloor > 0;

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-blue-200/70 bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/50 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-400/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-indigo-400/10 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-1 flex-col">
        <span className="mx-auto inline-flex w-fit items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          {txt.eyebrow}
        </span>

        <h3 className="mt-3 text-center text-xl font-bold tracking-tight text-slate-950 sm:text-[1.35rem] sm:leading-snug">
          {txt.title}
        </h3>
        <p className="mt-2 text-center text-sm leading-relaxed text-slate-600 sm:text-[0.95rem]">
          {txt.value}
        </p>

        {/* Mini example campaign preview — not a real campaign link */}
        <div
          className="relative mt-5 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm"
          aria-hidden="true"
        >
          <span className="absolute right-2 top-2 z-10 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
            {txt.example}
          </span>
          <div className="h-16 bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 sm:h-[4.5rem]" />
          <div className="space-y-2 px-3.5 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-semibold tracking-wide text-slate-600 ring-1 ring-slate-200/80">
                {lang === "el" ? "Β" : "YB"}
              </span>
              <p className="truncate text-xs font-semibold text-slate-800">
                {txt.demoBrand}
              </p>
            </div>
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-950">
              {txt.demoTitle}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold tabular-nums text-slate-950">
                {formatEuro(150, lang)}
              </p>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {txt.demoChip1}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {txt.demoChip2}
              </span>
            </div>
          </div>
        </div>

        <ul className="mt-5 space-y-2.5">
          {txt.benefits.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5 text-sm text-slate-700">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm ring-1 ring-blue-100">
                <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </span>
              <span className="min-w-0 leading-snug pt-1">{text}</span>
            </li>
          ))}
        </ul>

        {showSocial && creatorFloor != null ? (
          <p className="mt-4 text-center text-xs font-medium text-slate-500 sm:text-sm">
            {txt.social(creatorFloor)}
          </p>
        ) : null}

        <div className="mt-auto pt-5">
          <a
            href={href}
            className="group inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-[transform,box-shadow,filter] duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-600/30 hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {txt.cta}
            <span
              className="transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            >
              →
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
