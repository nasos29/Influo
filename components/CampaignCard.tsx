"use client";

import { campaignStatusBadge } from "@/lib/campaignStatusBadge";
import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { categoryLabel } from "@/lib/categories";
import { campaignClosesAt, daysUntilCampaignCloses } from "@/lib/campaignLifecycle";
import { formatFollowerCount } from "@/lib/platformStats";
import { campaignPublicBadgeLabel } from "@/lib/campaignPublicBadge";
import { CampaignDescriptionText } from "@/lib/campaignDescription";
import { displayLocation } from "@/lib/displayLocation";
import { localizeCampaignCopy } from "@/lib/campaignLocalized";
import CampaignCover from "@/components/CampaignCover";
import BrandBadges from "@/components/BrandBadges";
import { formatEuro } from "@/lib/formatEuro";
import { formatDisplayDate } from "@/lib/formatDate";
import { getCachedImageUrl } from "@/lib/imageProxy";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { campaignCardStyleFromSetting } from "@/lib/siteSettings";

export type CampaignCardBrand = {
  brand_name?: string | null;
  logo_url?: string | null;
  verified?: boolean | null;
} | null;

export type CampaignCardData = {
  id: string;
  title: string;
  title_en?: string | null;
  description: string;
  description_en?: string | null;
  budget: number;
  category?: string | null;
  deliverables?: string | null;
  deliverables_en?: string | null;
  deadline?: string | null;
  created_at?: string | null;
  opened_at?: string | null;
  platforms?: string[] | null;
  cover_url?: string | null;
  compensation_type?: string | null;
  min_followers?: number | null;
  location?: string | null;
  status?: string | null;
  /** Non-withdrawn application count only — never applicant details. */
  applications_count?: number | null;
  /** Number of creators wanted (null = no limit) and accepted so far. */
  slots?: number | null;
  slots_filled?: number | null;
  requires_presence?: boolean | null;
  brands?: CampaignCardBrand | CampaignCardBrand[] | null;
  brand_id?: string | null;
};

const closeCopy = {
  el: {
    ended: "Έληξε",
    deadlineToday: "Λήγει σήμερα",
    deadlineOne: "Λήγει σε 1 μέρα",
    deadlineN: (n: number) => `Λήγει σε ${n} μέρες`,
    autoToday: "Κλείνει αυτόματα σήμερα",
    autoOne: "Κλείνει αυτόματα σε 1 μέρα",
    autoN: (n: number) => `Κλείνει αυτόματα σε ${n} μέρες`,
  },
  en: {
    ended: "Ended",
    deadlineToday: "Ends today",
    deadlineOne: "Ends in 1 day",
    deadlineN: (n: number) => `Ends in ${n} days`,
    autoToday: "Closes automatically today",
    autoOne: "Closes automatically in 1 day",
    autoN: (n: number) => `Closes automatically in ${n} days`,
  },
} as const;

function brandOf(brands: CampaignCardData["brands"]): CampaignCardBrand {
  if (!brands) return null;
  return Array.isArray(brands) ? brands[0] || null : brands;
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function publishedAgoLabel(createdAt: string | null | undefined, lang: "el" | "en"): string | null {
  if (!createdAt) return null;
  const days = Math.max(0, daysBetween(new Date(createdAt), new Date()));
  if (lang === "el") {
    if (days === 0) return "Δημοσιεύτηκε σήμερα";
    if (days === 1) return "Δημοσιεύτηκε πριν από 1 μέρα";
    return `Δημοσιεύτηκε πριν από ${days} μέρες`;
  }
  if (days === 0) return "Posted today";
  if (days === 1) return "Posted 1 day ago";
  return `Posted ${days} days ago`;
}

function closesInLabel(
  campaign: {
    deadline?: string | null;
    opened_at?: string | null;
    created_at?: string | null;
  },
  lang: "el" | "en",
  defaultDays?: number
): { text: string; urgent: boolean } | null {
  const days = daysUntilCampaignCloses(campaign, { defaultDays });
  if (days === null) return null;
  const t = closeCopy[lang];
  if (days < 0) return { text: t.ended, urgent: true };
  const hasDeadline = Boolean(campaign.deadline);
  if (hasDeadline) {
    if (days === 0) return { text: t.deadlineToday, urgent: true };
    if (days === 1) return { text: t.deadlineOne, urgent: true };
    return { text: t.deadlineN(days), urgent: days <= 3 };
  }
  if (days === 0) return { text: t.autoToday, urgent: true };
  if (days === 1) return { text: t.autoOne, urgent: true };
  return { text: t.autoN(days), urgent: days <= 3 };
}

function compensationLabel(type: string | null | undefined, lang: "el" | "en"): string | null {
  if (type === "money") return lang === "el" ? "Χρήματα" : "Money";
  if (type === "product") return lang === "el" ? "Προϊόν" : "Product";
  if (type === "both") return lang === "el" ? "Χρήματα και προϊόν" : "Money & product";
  return null;
}

function splitDeliverables(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\n,;+]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Card chips: drop long brief-like lines (they belong in the description). */
function cardDeliverableChips(raw: string | null | undefined): string[] {
  return splitDeliverables(raw).filter((d) => d.length <= 42);
}

function truncateChip(label: string, max = 28): string {
  const t = label.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function VerifiedTick({ className = "w-4 h-4 text-blue-600 shrink-0" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-label="Verified" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function BrandAvatar({
  name,
  logoUrl,
  sizeClass = "h-9 w-9",
}: {
  name?: string | null;
  logoUrl?: string | null;
  sizeClass?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = logoUrl && !failed ? getCachedImageUrl(logoUrl) ?? logoUrl : null;
  const initials = (() => {
    const raw = (name || "").trim();
    if (!raw) return "B";
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length >= 2) return `${words[0]?.[0] || ""}${words[1]?.[0] || ""}`.toUpperCase() || "B";
    return words[0].slice(0, 2).toUpperCase() || "B";
  })();

  return (
    <span
      className={`relative inline-flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/80`}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-contain p-[12%]"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[11px] font-semibold tracking-wide text-slate-600">{initials}</span>
      )}
    </span>
  );
}

function PeopleIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function CampaignCard({
  campaign,
  lang,
  href,
  hideBrand = false,
  footer,
  className = "",
  viewCta = false,
  onOpen,
}: {
  campaign: CampaignCardData;
  lang: "el" | "en";
  href?: string;
  hideBrand?: boolean;
  footer?: ReactNode;
  className?: string;
  /** Show a "View campaign →" button at the bottom (public lists). Visual only: the card's stretched link handles the click. */
  viewCta?: boolean;
  /** Owner views: card click runs this (e.g. open management) instead of navigating to the public page. */
  onOpen?: () => void;
}) {
  const settings = useSiteSettings();
  const cardStyle = campaignCardStyleFromSetting(settings.campaign_card_style);
  const defaultDays = settings.campaign_default_days;
  const localized = localizeCampaignCopy(campaign, lang);
  const brand = brandOf(campaign.brands);
  const link = href ?? `/campaigns/${campaign.id}`;
  const published = publishedAgoLabel(campaign.created_at, lang);
  const closes = closesInLabel(campaign, lang, defaultDays);
  const comp = compensationLabel(campaign.compensation_type, lang);
  const statusBadge = campaignStatusBadge(campaign, lang, { defaultDays });
  const cat = campaign.category ? categoryLabel(campaign.category, lang) || campaign.category : "";
  const allDeliverableChips = splitDeliverables(localized.deliverables);
  const deliverableChips =
    cardStyle === "premium" ? cardDeliverableChips(localized.deliverables) : allDeliverableChips;
  const platforms = Array.isArray(campaign.platforms) ? campaign.platforms : [];
  const showBudget = Number(campaign.budget) > 0;
  const publicBadge = campaignPublicBadgeLabel(campaign.applications_count, campaign.opened_at, lang);
  const appsCount =
    typeof campaign.applications_count === "number" && campaign.applications_count > 0
      ? campaign.applications_count
      : 0;
  const isApplicationsBadge = appsCount >= 3;
  const titleNode = onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex min-h-[44px] items-center text-left text-inherit font-semibold after:absolute after:inset-0 after:z-[1] after:rounded-2xl after:content-[''] focus-visible:outline-none sm:min-h-0"
    >
      {localized.title}
    </button>
  ) : (
    <Link
      href={link}
      className="inline-flex min-h-[44px] items-center text-inherit after:absolute after:inset-0 after:z-[1] after:rounded-2xl after:content-[''] focus-visible:outline-none sm:min-h-0"
    >
      {localized.title}
    </Link>
  );

  const extras = (
    <>
      {campaign.requires_presence ? (
        <p className="mt-2 inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
          {lang === "el" ? "Φυσική παρουσία" : "In person"}
          {campaign.location ? ` · ${campaign.location}` : ""}
        </p>
      ) : null}
      {typeof campaign.slots === "number" && campaign.slots > 0 && (
        <p
          className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            (campaign.slots_filled ?? 0) >= campaign.slots ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-700"
          }`}
        >
          {(campaign.slots_filled ?? 0) >= campaign.slots
            ? lang === "el"
              ? "Οι θέσεις συμπληρώθηκαν"
              : "All spots are filled"
            : lang === "el"
              ? `${campaign.slots_filled ?? 0}/${campaign.slots} θέσεις`
              : `${campaign.slots_filled ?? 0}/${campaign.slots} spots`}
        </p>
      )}
    </>
  );

  if (cardStyle === "classic") {
    return (
      <article
        className={`group relative flex h-full flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm cursor-pointer transition-[box-shadow,border-color] hover:shadow-md hover:border-slate-300 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 has-[:focus-visible]:ring-offset-2 ${className}`}
      >
        <div className="pointer-events-none relative z-0 [&_*]:pointer-events-none">
          <CampaignCover
            coverUrl={campaign.cover_url}
            seed={campaign.id}
            title={localized.title}
            brandName={brand?.brand_name}
            logoUrl={brand?.logo_url}
            category={campaign.category}
            platforms={platforms}
            aspect="4/3"
          />
          {statusBadge && (
            <span
              className={`pointer-events-none absolute left-3 top-3 z-20 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm ${statusBadge.className}`}
            >
              {statusBadge.text}
            </span>
          )}
          {closes && (
            <span
              className={`pointer-events-none absolute right-3 top-3 z-20 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm ${
                closes.urgent
                  ? "bg-red-600/90 text-white ring-1 ring-white/30 backdrop-blur-md"
                  : "bg-white/80 text-slate-900 ring-1 ring-white/70 backdrop-blur-md"
              }`}
            >
              {closes.text}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-center gap-1.5 min-h-[1.25rem]">
            {!hideBrand && (
              <>
                <p className="text-sm font-medium text-slate-800 truncate">{brand?.brand_name || "Brand"}</p>
                {brand?.verified ? <VerifiedTick /> : null}
                {published && <span className="text-xs text-slate-500 shrink-0">· {published}</span>}
              </>
            )}
            {hideBrand && published && <p className="text-xs text-slate-500">{published}</p>}
          </div>
          {!hideBrand && campaign.brand_id ? <BrandBadges brandId={campaign.brand_id} lang={lang} className="mt-1" /> : null}

          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <h3 className="min-w-0 flex-1 text-lg font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-700">
              {titleNode}
            </h3>
            {publicBadge ? (
              <span
                className={`relative z-10 pointer-events-none inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
                  isApplicationsBadge
                    ? "bg-blue-600 text-white"
                    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                }`}
              >
                <PeopleIcon className="h-4 w-4 shrink-0" />
                {publicBadge}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {showBudget && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-900 text-white font-semibold">
                {formatEuro(Number(campaign.budget), lang === "en" ? "en" : "el")}
              </span>
            )}
            {!showBudget && comp && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 font-medium">
                {comp}
              </span>
            )}
            {showBudget && comp && campaign.compensation_type !== "money" && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 font-medium">
                {comp}
              </span>
            )}
            {campaign.location ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                {displayLocation(campaign.location, lang)}
              </span>
            ) : null}
            {campaign.min_followers ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                {lang === "el" ? "Από" : "From"} {formatFollowerCount(campaign.min_followers)}{" "}
                {lang === "el" ? "ακόλουθοι" : "followers"}
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-sm text-slate-600 line-clamp-2 whitespace-pre-wrap">
            <CampaignDescriptionText text={localized.description} />
          </p>

          {(cat || deliverableChips.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {cat ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-800">
                  {cat}
                </span>
              ) : null}
              {deliverableChips.slice(0, 4).map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-xs text-slate-700"
                >
                  {d}
                </span>
              ))}
              {deliverableChips.length > 4 ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-50 text-xs text-slate-500">
                  +{deliverableChips.length - 4}
                </span>
              ) : null}
            </div>
          )}

          {extras}

          {!publicBadge && appsCount > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              {appsCount}{" "}
              {lang === "el"
                ? appsCount === 1
                  ? "αίτηση"
                  : "αιτήσεις"
                : appsCount === 1
                  ? "application"
                  : "applications"}
            </p>
          )}

          {footer ? <div className="relative z-10 mt-4 pt-3 border-t border-slate-100">{footer}</div> : null}
          {viewCta ? (
            <div className="mt-auto pt-4">
              <span
                aria-hidden
                className="pointer-events-none flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors group-hover:bg-slate-800"
              >
                {lang === "el" ? "Δες την καμπάνια →" : "View campaign →"}
              </span>
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  const chipItems: string[] = [];
  if (cat) chipItems.push(cat);
  chipItems.push(...deliverableChips);
  const visibleChipLimit = 3;
  const visibleChips = chipItems.slice(0, visibleChipLimit);
  const hiddenChipCount = Math.max(0, chipItems.length - visibleChips.length);
  // Count long deliverables skipped from chips so "+N" still reflects extras.
  const skippedLong = Math.max(0, allDeliverableChips.length - deliverableChips.length);
  const plusCount = hiddenChipCount + skippedLong;

  const metaBits: { key: string; node: ReactNode; urgent?: boolean }[] = [];
  if (campaign.location) {
    metaBits.push({
      key: "loc",
      node: displayLocation(campaign.location, lang),
    });
  }
  if (closes) {
    metaBits.push({
      key: "closes",
      node: closes.text,
      urgent: closes.urgent,
    });
  }
  if (publicBadge || appsCount > 0) {
    metaBits.push({
      key: "apps",
      node: (
        <span className="inline-flex items-center gap-1">
          <PeopleIcon />
          {publicBadge ||
            `${appsCount} ${
              lang === "el"
                ? appsCount === 1
                  ? "αίτηση"
                  : "αιτήσεις"
                : appsCount === 1
                  ? "application"
                  : "applications"
            }`}
        </span>
      ),
    });
  }
  if (campaign.min_followers) {
    metaBits.push({
      key: "followers",
      node: `${lang === "el" ? "Από" : "From"} ${formatFollowerCount(campaign.min_followers)}`,
    });
  }

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white cursor-pointer shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 has-[:focus-visible]:ring-offset-2 ${className}`}
    >
      <div className="pointer-events-none relative z-0 [&_*]:pointer-events-none">
        <CampaignCover
          coverUrl={campaign.cover_url}
          seed={campaign.id}
          title={localized.title}
          brandName={brand?.brand_name}
          logoUrl={brand?.logo_url}
          category={campaign.category}
          platforms={platforms}
          aspect="16/9"
          showBrandMark={false}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/25 to-transparent" />
        {statusBadge && (
          <span
            className={`pointer-events-none absolute left-3 top-3 z-20 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm ${statusBadge.className}`}
          >
            {statusBadge.text}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        {!hideBrand ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandAvatar name={brand?.brand_name} logoUrl={brand?.logo_url} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{brand?.brand_name || "Brand"}</p>
                {brand?.verified ? <VerifiedTick className="h-3.5 w-3.5 text-blue-600 shrink-0" /> : null}
              </div>
              {published ? <p className="truncate text-[11px] text-slate-500">{published}</p> : null}
            </div>
          </div>
        ) : published ? (
          <p className="text-[11px] text-slate-500">{published}</p>
        ) : null}
        {!hideBrand && campaign.brand_id ? (
          <BrandBadges brandId={campaign.brand_id} lang={lang} className="mt-1.5" />
        ) : null}

        <h3 className="mt-3 min-w-0 text-[1.05rem] font-semibold leading-snug tracking-tight text-slate-950 line-clamp-2 group-hover:text-slate-700">
          {titleNode}
        </h3>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {showBudget ? (
              <p className="text-2xl font-semibold tracking-tight text-slate-950 tabular-nums">
                {formatEuro(Number(campaign.budget), lang === "en" ? "en" : "el")}
              </p>
            ) : comp ? (
              <p className="text-base font-semibold text-indigo-800">{comp}</p>
            ) : null}
            {showBudget && comp && campaign.compensation_type !== "money" ? (
              <p className="mt-0.5 text-xs font-medium text-indigo-700">{comp}</p>
            ) : null}
          </div>
        </div>

        {metaBits.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            {metaBits.map((bit, i) => (
              <span key={bit.key} className="inline-flex items-center gap-2 min-w-0">
                {i > 0 ? <span className="text-slate-300" aria-hidden>
                  ·
                </span> : null}
                <span className={`truncate ${bit.urgent ? "font-semibold text-red-600" : ""}`}>{bit.node}</span>
              </span>
            ))}
          </div>
        ) : null}

        <p className="mt-3 text-sm leading-relaxed text-slate-600 line-clamp-2 whitespace-pre-wrap">
          <CampaignDescriptionText text={localized.description} />
        </p>

        {(visibleChips.length > 0 || plusCount > 0) && (
          <div className="mt-3 flex flex-nowrap items-center gap-1.5 overflow-hidden">
            {visibleChips.map((d) => (
              <span
                key={d}
                title={d}
                className="inline-flex max-w-[9.5rem] shrink-0 items-center truncate rounded-full border border-slate-200/90 bg-slate-50/80 px-2.5 py-1 text-[11px] font-medium text-slate-700"
              >
                {truncateChip(d)}
              </span>
            ))}
            {plusCount > 0 ? (
              <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                +{plusCount}
              </span>
            ) : null}
          </div>
        )}

        {extras}

        {footer ? <div className="relative z-10 mt-4 pt-3 border-t border-slate-100">{footer}</div> : null}
        {viewCta ? (
          <div className="mt-auto pt-4">
            <span
              aria-hidden
              className="pointer-events-none flex w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors group-hover:border-slate-300 group-hover:bg-white group-hover:text-slate-950"
            >
              {lang === "el" ? "Δες την καμπάνια →" : "View campaign →"}
            </span>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** Shared countdown helper for detail pages. */
export function campaignClosesMeta(
  campaign: {
    deadline?: string | null;
    opened_at?: string | null;
    created_at?: string | null;
  },
  lang: "el" | "en",
  defaultDays?: number
): { text: string; urgent: boolean; dateLabel: string | null } | null {
  const meta = closesInLabel(campaign, lang, defaultDays);
  if (!meta) return null;
  const created = campaign.created_at || campaign.opened_at;
  if (!campaign.deadline && !created) return { ...meta, dateLabel: null };
  const closes = campaignClosesAt(
    {
      deadline: campaign.deadline ?? null,
      opened_at: campaign.opened_at ?? null,
      created_at: (created || campaign.deadline) as string,
    },
    { defaultDays }
  );
  return {
    ...meta,
    dateLabel: formatDisplayDate(campaign.deadline || closes),
  };
}
