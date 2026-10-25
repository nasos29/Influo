"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import FastImage from "@/components/FastImage";
import { categoryLabel } from "@/lib/categories";
import { campaignClosesAt } from "@/lib/campaignLifecycle";
import { formatFollowerCount } from "@/lib/platformStats";
import { getCachedImageUrl } from "@/lib/imageProxy";

export type CampaignCardBrand = {
  brand_name?: string | null;
  logo_url?: string | null;
  verified?: boolean | null;
} | null;

export type CampaignCardData = {
  id: string;
  title: string;
  description: string;
  budget: number;
  category?: string | null;
  deliverables?: string | null;
  deadline?: string | null;
  created_at?: string | null;
  opened_at?: string | null;
  platforms?: string[] | null;
  compensation_type?: string | null;
  min_followers?: number | null;
  location?: string | null;
  status?: string | null;
  brands?: CampaignCardBrand | CampaignCardBrand[] | null;
};

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
  campaign: CampaignCardData,
  lang: "el" | "en"
): { text: string; urgent: boolean } | null {
  const created = campaign.created_at || campaign.opened_at;
  if (!campaign.deadline && !created) return null;
  const closes = campaignClosesAt({
    deadline: campaign.deadline ?? null,
    opened_at: campaign.opened_at ?? null,
    created_at: created || new Date().toISOString(),
  });
  const days = daysBetween(new Date(), closes);
  if (days < 0) {
    return {
      text: lang === "el" ? "Έληξε" : "Ended",
      urgent: true,
    };
  }
  if (lang === "el") {
    if (days === 0) return { text: "Λήγει σήμερα", urgent: true };
    if (days === 1) return { text: "Λήγει σε 1 μέρα", urgent: true };
    return { text: `Λήγει σε ${days} μέρες`, urgent: days <= 3 };
  }
  if (days === 0) return { text: "Ends today", urgent: true };
  if (days === 1) return { text: "Ends in 1 day", urgent: true };
  return { text: `Ends in ${days} days`, urgent: days <= 3 };
}

function compensationLabel(type: string | null | undefined, lang: "el" | "en"): string | null {
  if (type === "money") return lang === "el" ? "Χρήματα" : "Money";
  if (type === "product") return lang === "el" ? "Προϊόν" : "Product";
  if (type === "both") return lang === "el" ? "Χρήματα και προϊόν" : "Money & product";
  return null;
}

function statusLabel(status: string | null | undefined, lang: "el" | "en"): string | null {
  if (status === "open") return lang === "el" ? "Ανοιχτή" : "Open";
  if (status === "closed") return lang === "el" ? "Κλειστή" : "Closed";
  if (status === "draft") return lang === "el" ? "Πρόχειρο" : "Draft";
  return null;
}

function statusClass(status: string | null | undefined): string {
  if (status === "open") return "bg-emerald-100 text-emerald-800";
  if (status === "closed") return "bg-slate-200 text-slate-700";
  if (status === "draft") return "bg-amber-100 text-amber-900";
  return "bg-slate-100 text-slate-700";
}

function PlatformIcon({ platform }: { platform: string }) {
  const common = "w-3.5 h-3.5 shrink-0";
  if (platform === "instagram") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} text-pink-600`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
      </svg>
    );
  }
  if (platform === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} text-slate-900`} fill="currentColor" aria-hidden>
        <path d="M14 3h2.2a5.2 5.2 0 0 0 3.6 2.1v2.3a7.4 7.4 0 0 1-3.6-1v6.7a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.4a3.2 3.2 0 1 0 2.5 3.1V3z" />
      </svg>
    );
  }
  if (platform === "youtube") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} text-red-600`} fill="currentColor" aria-hidden>
        <path d="M23 12.2s0-3.2-.4-4.6a3 3 0 0 0-2.1-2.1C18.9 5 12 5 12 5s-6.9 0-8.5.5a3 3 0 0 0-2.1 2.1C1 9 1 12.2 1 12.2s0 3.2.4 4.6a3 3 0 0 0 2.1 2.1C5.1 19.4 12 19.4 12 19.4s6.9 0 8.5-.5a3 3 0 0 0 2.1-2.1c.4-1.4.4-4.6.4-4.6zM9.8 15.5v-6.6l6.2 3.3-6.2 3.3z" />
      </svg>
    );
  }
  if (platform === "facebook") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} text-blue-600`} fill="currentColor" aria-hidden>
        <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1z" />
      </svg>
    );
  }
  return null;
}

const PLATFORM_LABEL: Record<string, { el: string; en: string }> = {
  instagram: { el: "Instagram", en: "Instagram" },
  tiktok: { el: "TikTok", en: "TikTok" },
  youtube: { el: "YouTube", en: "YouTube" },
  facebook: { el: "Facebook", en: "Facebook" },
};

function splitDeliverables(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\n,;+]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function VerifiedTick() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4 text-blue-600 shrink-0" aria-label="Verified" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
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
}: {
  campaign: CampaignCardData;
  lang: "el" | "en";
  href?: string;
  hideBrand?: boolean;
  footer?: ReactNode;
  className?: string;
}) {
  const brand = brandOf(campaign.brands);
  const link = href ?? `/campaigns/${campaign.id}`;
  const published = publishedAgoLabel(campaign.created_at, lang);
  const closes = closesInLabel(campaign, lang);
  const comp = compensationLabel(campaign.compensation_type, lang);
  const statusText = statusLabel(campaign.status, lang);
  const cat = campaign.category ? categoryLabel(campaign.category, lang) || campaign.category : "";
  const deliverableChips = splitDeliverables(campaign.deliverables);
  const platforms = Array.isArray(campaign.platforms) ? campaign.platforms : [];
  const logoSrc = brand?.logo_url ? getCachedImageUrl(brand.logo_url) ?? brand.logo_url : null;
  const locale = lang === "el" ? "el-GR" : "en-GB";
  const showBudget = Number(campaign.budget) > 0;

  return (
    <article
      className={`group relative bg-white border border-slate-200 rounded-2xl p-5 shadow-sm cursor-pointer transition-[box-shadow,border-color] hover:shadow-md hover:border-slate-300 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 has-[:focus-visible]:ring-offset-2 ${className}`}
    >
      {!hideBrand && (
        <div className="flex items-start gap-3">
          {logoSrc ? (
            <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 shrink-0">
              <FastImage src={logoSrc} alt={brand?.brand_name || "Brand"} fill className="object-cover" sizes="48px" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-100 flex items-center justify-center text-slate-500 text-lg font-semibold shrink-0">
              {(brand?.brand_name || "B").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-medium text-slate-800 truncate">{brand?.brand_name || "Brand"}</p>
              {brand?.verified ? <VerifiedTick /> : null}
            </div>
            {published && <p className="text-xs text-slate-500 mt-0.5">{published}</p>}
          </div>
          {statusText && (
            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0 ${statusClass(campaign.status)}`}>
              {statusText}
            </span>
          )}
        </div>
      )}

      {hideBrand && (
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            {published && <p className="text-xs text-slate-500">{published}</p>}
          </div>
          {statusText && (
            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0 ${statusClass(campaign.status)}`}>
              {statusText}
            </span>
          )}
        </div>
      )}

      <h3 className="mt-3 text-xl font-bold text-slate-900 leading-snug">
        <Link
          href={link}
          className="text-inherit after:absolute after:inset-0 after:z-0 after:rounded-2xl after:content-[''] focus-visible:outline-none group-hover:text-blue-700"
        >
          {campaign.title}
        </Link>
      </h3>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {showBudget && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-900 text-white font-semibold">
            €{Number(campaign.budget).toLocaleString(locale)}
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
        {closes && (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full font-medium ${
              closes.urgent ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"
            }`}
          >
            {closes.text}
          </span>
        )}
        {campaign.location ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            {campaign.location}
          </span>
        ) : null}
        {campaign.min_followers ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            {lang === "el" ? "Από" : "From"} {formatFollowerCount(campaign.min_followers)}{" "}
            {lang === "el" ? "ακόλουθοι" : "followers"}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap">{campaign.description}</p>

      {(platforms.length > 0 || cat || deliverableChips.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {platforms.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-800"
            >
              <PlatformIcon platform={p} />
              {PLATFORM_LABEL[p]?.[lang] || p}
            </span>
          ))}
          {cat ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-800">
              {cat}
            </span>
          ) : null}
          {deliverableChips.map((d) => (
            <span
              key={d}
              className="inline-flex items-center px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-xs text-slate-700"
            >
              {d}
            </span>
          ))}
        </div>
      )}

      {footer ? <div className="relative z-10 mt-4 pt-3 border-t border-slate-100">{footer}</div> : null}
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
  lang: "el" | "en"
): { text: string; urgent: boolean; dateLabel: string | null } | null {
  if (campaign.deadline) {
    const closes = new Date(campaign.deadline);
    const days = daysBetween(new Date(), closes);
    const dateLabel = closes.toLocaleDateString(lang === "el" ? "el-GR" : "en-GB");
    if (days < 0) return { text: lang === "el" ? "Έληξε" : "Ended", urgent: true, dateLabel };
    if (lang === "el") {
      if (days === 0) return { text: "Λήγει σήμερα", urgent: true, dateLabel };
      if (days === 1) return { text: "Λήγει σε 1 μέρα", urgent: true, dateLabel };
      return { text: `Λήγει σε ${days} μέρες`, urgent: days <= 3, dateLabel };
    }
    if (days === 0) return { text: "Ends today", urgent: true, dateLabel };
    if (days === 1) return { text: "Ends in 1 day", urgent: true, dateLabel };
    return { text: `Ends in ${days} days`, urgent: days <= 3, dateLabel };
  }
  if (campaign.created_at || campaign.opened_at) {
    const meta = closesInLabel(
      {
        id: "",
        title: "",
        description: "",
        budget: 0,
        deadline: null,
        created_at: campaign.created_at,
        opened_at: campaign.opened_at,
      },
      lang
    );
    if (!meta) return null;
    return { ...meta, dateLabel: null };
  }
  return {
    text: lang === "el" ? "Κλείνει αυτόματα σε έως 30 μέρες" : "Auto-closes within 30 days",
    urgent: false,
    dateLabel: null,
  };
}
