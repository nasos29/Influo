/**
 * Public HTML body for Zoho weekly “new influencers” brand digest (content_url).
 * Generic greeting (not per-brand) — Zoho sends one body to the whole list.
 */

import {
  buildDigestHtml,
  digestSubject,
  type InfluencerRow,
  type WeeklyDigestWindow,
} from "@/lib/brandWeeklyInfluencerDigest";

export { digestSubject as BRAND_WEEKLY_DIGEST_SUBJECT };

export function brandWeeklyDigestContentUrl(
  window: Pick<WeeklyDigestWindow, "start" | "end">,
  baseSiteUrl?: string
): string {
  const base = (baseSiteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(
    /\/$/,
    ""
  );
  const q = new URLSearchParams({
    start: window.start,
    end: window.end,
  });
  return `${base}/api/public/zoho-brand-weekly-digest-content?${q.toString()}`;
}

/** Same content as Resend digest, without personalized brand name. */
export function brandWeeklyDigestEmailHtml(
  influencers: InfluencerRow[],
  window: WeeklyDigestWindow
): string {
  return buildDigestHtml("", influencers, window, { zohoBulk: true });
}
