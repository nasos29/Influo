"use client";

import Link from "next/link";
import Footer from "@/components/Footer";
import SiteHeader from "@/components/SiteHeader";
import RecentCollaborationsSection from "@/components/RecentCollaborationsSection";
import type { RecentCollaborationCard } from "@/lib/loadRecentCollaborations";

type Lang = "el" | "en";

const COPY = {
  el: {
    title: "Συνεργασίες",
    lead: "Ολοκληρωμένες συνεργασίες που brands και creators επέλεξαν να προβάλουν δημόσια.",
    empty: "Δεν υπάρχουν ακόμα δημόσιες συνεργασίες προς προβολή.",
    cta: "Ξεκινήστε την καμπάνια σας",
  },
  en: {
    title: "Collaborations",
    lead: "Completed partnerships that brands and creators chose to show publicly.",
    empty: "No public collaborations to show yet.",
    cta: "Start your campaign",
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
  const ctaHref = lang === "en" ? "/brand/signup" : "/brand/signup";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader lang={lang} />
      <main>
        <div className="mx-auto max-w-page px-6 pb-4 pt-10 md:pt-14">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {txt.title}
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">{txt.lead}</p>
          <div className="mt-6">
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              {txt.cta}
            </Link>
          </div>
        </div>

        {items.length ? (
          <RecentCollaborationsSection
            items={items}
            lang={lang}
            pageSize={3}
            showSeeAll={false}
            showStartCta
          />
        ) : (
          <p className="mx-auto max-w-page px-6 py-16 text-slate-500">{txt.empty}</p>
        )}
      </main>
      <Footer lang={lang} />
    </div>
  );
}
