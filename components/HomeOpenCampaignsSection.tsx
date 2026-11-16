"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import CampaignCard, { type CampaignCardData } from "@/components/CampaignCard";
import PublishCampaignPromoCard from "@/components/PublishCampaignPromoCard";
import { SECTION_TITLE_CLASS } from "@/lib/sectionTitle";

type Lang = "el" | "en";

const COPY = {
  el: {
    eyebrow: "Νέες ευκαιρίες",
    title: "Ανοιχτές καμπάνιες από brands",
    subtitle: "Κάνε αίτηση και συνεργάσου με brands που ψάχνουν influencers σαν εσένα.",
    see_all: "Δες όλες τις καμπάνιες →",
    post: "Δημοσίευσε καμπάνια",
    prev: "Προηγούμενες καμπάνιες",
    next: "Επόμενες καμπάνιες",
  },
  en: {
    eyebrow: "New opportunities",
    title: "Open campaigns from brands",
    subtitle: "Apply and work with brands looking for influencers like you.",
    see_all: "See all campaigns →",
    post: "Post a campaign",
    prev: "Previous campaigns",
    next: "Next campaigns",
  },
} as const;

function NavButtons({
  lang,
  onPrev,
  onNext,
  canPrev,
  canNext,
  className = "",
}: {
  lang: Lang;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  className?: string;
}) {
  const txt = COPY[lang];
  const btnClass =
    "inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:cursor-default disabled:opacity-35 disabled:hover:border-slate-200 disabled:hover:bg-white";
  return (
    <div className={`hidden shrink-0 items-center gap-2 md:flex ${className}`}>
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label={txt.prev}
        className={btnClass}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        aria-label={txt.next}
        className={btnClass}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

function CampaignList({
  items,
  lang,
  cols,
  promo,
}: {
  items: CampaignCardData[];
  lang: Lang;
  cols: number;
  promo: ReactNode;
}) {
  const style = {
    ["--home-open-campaign-cols"]: cols,
  } as CSSProperties;
  return (
    <ul className="grid-home-open-campaigns auto-rows-fr" style={style}>
      {items.map((campaign) => (
        <li
          key={campaign.id}
          className="h-full min-w-0 rounded-2xl transition-shadow duration-200 hover:shadow-lg [&>*]:h-full"
        >
          <CampaignCard campaign={campaign} lang={lang} viewCta />
        </li>
      ))}
      {promo}
    </ul>
  );
}

/**
 * Homepage open-campaigns: one equal-width row of N = homepage_campaigns_count
 * cards (edge to edge). ‹ › page through the rest (no autoplay). Cards keep a
 * fixed N-column track so paging never resizes them.
 *
 * Mobile/desktop lists live in separate visibility wrappers so Tailwind
 * `hidden` / `md:hidden` is not overridden by `.grid-home-open-campaigns { display: grid }`.
 */
export default function HomeOpenCampaignsSection({
  campaigns,
  pageSize,
  lang,
  userType,
  approvedInfluencers,
}: {
  campaigns: CampaignCardData[];
  /** Visible desktop/tablet page size from homepage_campaigns_count. */
  pageSize: number;
  lang: Lang;
  userType: "influencer" | "brand" | null;
  approvedInfluencers: number | null;
}) {
  const txt = COPY[lang];
  const safePageSize = Math.max(1, pageSize);
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(campaigns.length / safePageSize));
  const showPublishPromo = campaigns.length > 0 && campaigns.length < 3;
  const showArrows = campaigns.length > safePageSize;

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages - 1));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const start = page * safePageSize;
    return campaigns.slice(start, start + safePageSize);
  }, [campaigns, page, safePageSize]);

  if (campaigns.length === 0) return null;

  const promoHref =
    userType === "brand" ? "/brand/dashboard?tab=campaigns" : "/brand/signup";

  const renderPromo = () =>
    showPublishPromo ? (
      <li className="h-full min-w-0 rounded-2xl transition-shadow duration-200 hover:shadow-lg">
        <PublishCampaignPromoCard
          lang={lang}
          href={promoHref}
          approvedInfluencers={approvedInfluencers}
        />
      </li>
    ) : null;

  // Mobile scroll strip: columns = visible card count (CSS uses auto-columns).
  const mobileCols = Math.max(1, campaigns.length + (showPublishPromo ? 1 : 0));
  // Desktop: always N tracks when paging so cards never resize; otherwise fill with actual count.
  const desktopCols = showArrows
    ? safePageSize
    : Math.max(1, pageItems.length + (showPublishPromo ? 1 : 0));
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  return (
    <section
      data-homepage-section="open_campaigns"
      className="home-section-cv relative py-20 px-6 bg-gradient-to-br from-slate-50 via-white to-blue-50 border-y border-slate-100/80"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(191,219,254,0.45)_0%,transparent_70%)]" />
        <div className="absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(226,232,240,0.55)_0%,transparent_70%)]" />
      </div>
      <div className="relative max-w-page mx-auto">
        <div className={`relative mb-12 ${showArrows ? "md:px-24" : ""}`}>
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-blue-50 text-blue-700 border border-blue-100">
                {txt.eyebrow}
              </span>
            </div>
            <h2 className={`${SECTION_TITLE_CLASS} mb-3`}>{txt.title}</h2>
            <p className="text-base md:text-lg text-slate-600">{txt.subtitle}</p>
          </div>
          {showArrows ? (
            <NavButtons
              lang={lang}
              canPrev={canPrev}
              canNext={canNext}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="absolute right-0 bottom-0"
            />
          ) : null}
        </div>

        {/* Visibility wrappers — never put hide utilities on the grid itself. */}
        <div className="md:hidden">
          <CampaignList items={campaigns} lang={lang} cols={mobileCols} promo={renderPromo()} />
        </div>
        <div className="hidden md:block">
          <CampaignList
            items={pageItems}
            lang={lang}
            cols={desktopCols}
            promo={page === 0 ? renderPromo() : null}
          />
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={lang === "en" ? "/en/campaigns" : "/campaigns"}
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            {txt.see_all}
          </a>
          <a
            href={promoHref}
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-900 text-sm font-semibold border border-slate-200 transition-colors"
          >
            {txt.post}
          </a>
        </div>
      </div>
    </section>
  );
}
