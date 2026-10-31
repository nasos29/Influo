import { parseMoney } from "@/lib/channelScore";
import { formatEuro, type EuroLang } from "@/lib/formatEuro";
import { parseFollowerString } from "@/lib/parseFollowers";
import { listedPriceAmount, packagesForViewer } from "@/lib/servicePackages";

/**
 * CPM (€ per 1,000 views): price / avg_views × 1000.
 * Returns null when the price is missing or avg_views < 100.
 */
export function estimateCpm(
  price: string | number | null | undefined,
  avgViews: string | number | null | undefined
): number | null {
  let rate: number | null = null;
  if (typeof price === "number") {
    rate = Number.isFinite(price) && price > 0 ? price : null;
  } else {
    rate = parseMoney(price ?? null);
  }
  const views = parseFollowerString(avgViews);
  if (rate == null || views < 100) return null;
  return Math.round((rate / views) * 1000 * 100) / 100;
}

/** Format CPM with exactly 2 decimal places and the euro sign on the right. */
export function formatCpmEuro(cpm: number, lang: EuroLang = "el"): string {
  return formatEuro(cpm, lang, 2);
}

export const CPM_PLATFORMS = ["instagram", "tiktok", "youtube"] as const;
export type CpmPlatform = (typeof CPM_PLATFORMS)[number];

export type PlatformVideoCpm = {
  platform: CpmPlatform;
  /** Listed video price used as the numerator. */
  price: number;
  /** Average views of that platform only. */
  views: number;
  cpm: number;
};

function accountPlatform(raw: unknown): CpmPlatform | null {
  const platform = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (platform === "instagram" || platform === "ig") return "instagram";
  if (platform === "tiktok" || platform === "tt") return "tiktok";
  if (platform === "youtube" || platform === "yt") return "youtube";
  return null;
}

/** Mean avg_views of one platform. 0 when that platform has no positive views. */
export function platformAvgViews(
  accounts: Array<{ platform?: string | null; avg_views?: string | number | null } | null | undefined> | null | undefined,
  platform: CpmPlatform
): number {
  if (!Array.isArray(accounts)) return 0;
  let sum = 0;
  let count = 0;
  for (const acc of accounts) {
    if (accountPlatform(acc?.platform) !== platform) continue;
    const views = parseFollowerString(acc?.avg_views);
    if (views > 0) {
      sum += views;
      count += 1;
    }
  }
  if (count === 0) return 0;
  return sum / count;
}

function cheapestVideoPrice(
  packages: ReturnType<typeof packagesForViewer>,
  platform: CpmPlatform
): number | null {
  const type = platform === "instagram" ? "reel" : "video";
  let best: number | null = null;
  for (const pkg of packages) {
    if (pkg.platform !== platform || pkg.type !== type) continue;
    const amount = listedPriceAmount(pkg.price);
    if (amount == null || amount <= 0) continue;
    if (best == null || amount < best) best = amount;
  }
  return best;
}

/**
 * One CPM per platform that has both a video price and avg_views ≥ 100.
 * Instagram uses Reel. TikTok uses TikTok Video (a TikTok-only creator's old
 * reel is that video). YouTube uses YouTube Video. Stories, UGC, other
 * services, add-ons, and a bare min_rate are ignored. Views are never averaged
 * across platforms.
 */
export function platformVideoCpms(input: {
  service_packages?: unknown;
  rate_card?: unknown;
  accounts?: unknown;
}): PlatformVideoCpm[] {
  const packages = packagesForViewer(input.service_packages, input.rate_card, input.accounts);
  const accounts = Array.isArray(input.accounts) ? input.accounts : [];
  const out: PlatformVideoCpm[] = [];
  for (const platform of CPM_PLATFORMS) {
    const price = cheapestVideoPrice(packages, platform);
    const views = platformAvgViews(accounts, platform);
    if (price == null) continue;
    const cpm = estimateCpm(price, views);
    if (cpm == null) continue;
    out.push({ platform, price, views, cpm });
  }
  return out;
}

/**
 * Mean avg_views across social accounts that have avg_views > 0.
 */
export function averageAvgViews(
  accounts: Array<{ avg_views?: string | number | null } | null | undefined> | null | undefined
): number {
  if (!Array.isArray(accounts)) return 0;
  let sum = 0;
  let count = 0;
  for (const acc of accounts) {
    const v = parseFollowerString(acc?.avg_views);
    if (v > 0) {
      sum += v;
      count += 1;
    }
  }
  if (count === 0) return 0;
  return sum / count;
}
