"use client";

import Link from "next/link";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/SiteHeader";
import CollaborationShowcaseCard from "@/components/CollaborationShowcaseCard";
import type { RecentCollaborationCard } from "@/lib/loadRecentCollaborations";

type Lang = "el" | "en";

const COPY = {
  el: {
    title: "Συνεργασίες",
    lead: "Ολοκληρωμένες συνεργασίες που brands και creators επέλεξαν να προβάλουν δημόσια — με βίντεο που φιλοξενεί το Influo.",
    empty: "Δεν υπάρχουν ακόμα δημόσιες συνεργασίες προς προβολή.",
    emptyHint:
      "Όταν μια ολοκληρωμένη συνεργασία εγκριθεί για δημόσια προβολή, θα εμφανιστεί εδώ αυτόματα.",
    cta: "Ξεκινήστε την καμπάνια σας",
    count: (n: number) =>
      n === 1 ? "1 δημόσια συνεργασία" : `${n} δημόσιες συνεργασίες`,
  },
  en: {
    title: "Collaborations",
    lead: "Completed partnerships that brands and creators chose to show publicly — with video hosted on Influo.",
    empty: "No public collaborations to show yet.",
    emptyHint:
      "When a completed collaboration is approved for public showcase, it will appear here automatically.",
    cta: "Start your campaign",
    count: (n: number) => (n === 1 ? "1 public collaboration" : `${n} public collaborations`),
  },
} as const;

export default function CollaborationsListingPage({
  items,
  lang,
}: {
  items: RecentCollaborationCard[];
  lang: Lang;
}) {
  const txt = COPY[lang];
  const ctaHref = lang === "en" ? "/en/for-brands" : "/for-brands";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader lang={lang} />
      <main>
        <div className="mx-auto max-w-page px-6 pb-2 pt-10 md:pt-14">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            {txt.title}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
            {txt.lead}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              {txt.cta}
            </Link>
            {items.length > 0 ? (
              <p className="text-sm text-slate-500">{txt.count(items.length)}</p>
            ) : null}
          </div>
        </div>

        {items.length > 0 ? (
          <section
            className="mx-auto max-w-page px-6 pb-16 pt-8 md:pb-20 md:pt-10"
            aria-label={txt.title}
          >
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 xl:grid-cols-3">
              {items.map((item) => (
                <li key={item.id} className="flex w-full min-w-0 justify-center">
                  <CollaborationShowcaseCard item={item} lang={lang} variant="listing" />
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="mx-auto max-w-page px-6 py-16 md:py-24">
            <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-200 bg-slate-50/90 px-8 py-12 text-center">
              <p className="text-base font-medium text-slate-700">{txt.empty}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">{txt.emptyHint}</p>
            </div>
          </section>
        )}
      </main>
      <Footer lang={lang} />
    </div>
  );
}