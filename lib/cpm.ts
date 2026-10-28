import { parseMoney } from "@/lib/channelScore";
import { parseFollowerString } from "@/lib/parseFollowers";

/**
 * Estimated CPM (€ per 1,000 views): min_rate / avg_views * 1000.
 * Returns null when rate is missing/invalid or avg_views < 100.
 */
export function estimateCpm(
  minRate: string | number | null | undefined,
  avgViews: string | number | null | undefined
): number | null {
  let rate: number | null = null;
  if (typeof minRate === "number") {
    rate = Number.isFinite(minRate) && minRate > 0 ? minRate : null;
  } else {
    rate = parseMoney(minRate ?? null);
  }
  const views = parseFollowerString(avgViews);
  if (rate == null || views < 100) return null;
  return Math.round((rate / views) * 1000 * 100) / 100;
}

/** Format CPM with exactly 2 decimal places and a euro sign. */
export function formatCpmEuro(cpm: number): string {
  return `${cpm.toFixed(2)}€`;
}

/**
 * Mean avg_views across social accounts that have avg_views > 0.
 * Used for profile CPM; callers hide the card when the result is < 100.
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
