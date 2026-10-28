import { weightedEngagementPercent } from "@/lib/channelScore";
import { creatorHasHardErOnMainAccount } from "@/lib/engagementFlags";
import { parseFollowerString, totalFollowersFromAccounts } from "@/lib/parseFollowers";

export type SizeBucket = "nano" | "micro" | "mid" | "macro" | "mega";

export type CatalogBenchmark = {
  thisEr: number | null;
  thisFollowers: number;
  thisErFlagged: boolean;
  bucket: SizeBucket;
  peerCount: number;
  /** Median ER of same-size peers (after outlier/self filters). */
  peerAvgEr: number | null;
  catalogCount: number;
  /** Median ER of whole catalog (after outlier/self filters). */
  catalogAvgEr: number | null;
  delta: number | null;
  /** Share of comparison set with ER strictly below this profile (0–100). */
  percentile: number | null;
};

export type BenchmarkPeer = {
  id: string;
  followers: number;
  er: number;
  erFlagged?: boolean;
};

export const BUCKET_LABELS: Record<SizeBucket, { el: string; en: string; range: string }> = {
  nano: { el: "Nano", en: "Nano", range: "<10k" },
  micro: { el: "Micro", en: "Micro", range: "10k–50k" },
  mid: { el: "Mid", en: "Mid", range: "50k–250k" },
  macro: { el: "Macro", en: "Macro", range: "250k–1M" },
  mega: { el: "Mega", en: "Mega", range: "1M+" },
};

/** ER above this is treated as an outlier and excluded from peer/catalog medians. */
export const ER_OUTLIER_MAX = 25;

export function sizeBucket(followers: number): SizeBucket {
  if (followers >= 1_000_000) return "mega";
  if (followers >= 250_000) return "macro";
  if (followers >= 50_000) return "mid";
  if (followers >= 10_000) return "micro";
  return "nano";
}

type Account = {
  platform?: string;
  followers?: string | number | null;
  engagement_rate?: string | number | null;
  er_flag_reason?: string | null;
  er_suspicious?: boolean | null;
  avg_likes?: string | number | null;
  avg_views?: string | number | null;
  posts_count?: number | string | null;
};

/** Same weighted ER definition as channel score / catalog peers. */
export function engagementFromAccounts(accounts: Account[] | null | undefined): number {
  if (!Array.isArray(accounts)) return 0;
  const followersByPlatform: { [key: string]: number } = {};
  const erByPlatform: { [key: string]: string | number } = {};
  for (const acc of accounts) {
    const key = String(acc?.platform || "")
      .toLowerCase()
      .trim();
    if (!key) continue;
    const followers = parseFollowerString(acc?.followers);
    if (followers > 0) followersByPlatform[key] = (followersByPlatform[key] || 0) + followers;
    if (acc?.engagement_rate != null && String(acc.engagement_rate).trim()) {
      erByPlatform[key] = acc.engagement_rate;
    }
  }
  return weightedEngagementPercent(followersByPlatform, erByPlatform);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const raw =
    sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return Math.round(raw * 10) / 10;
}

export function isUsablePeerEr(er: number, erFlagged?: boolean): boolean {
  if (er <= 0 || er > ER_OUTLIER_MAX) return false;
  if (erFlagged) return false;
  return true;
}

export function peerFromAccounts(
  id: string,
  accounts: Account[] | null | undefined
): BenchmarkPeer | null {
  const followers = totalFollowersFromAccounts(accounts);
  if (followers <= 0) return null;
  const er = engagementFromAccounts(accounts);
  if (er <= 0) return null;
  return {
    id: String(id),
    followers,
    er,
    erFlagged: creatorHasHardErOnMainAccount(accounts),
  };
}

/**
 * Percentile = % of comparison set with ER strictly below `thisEr` (0–100).
 */
export function erPercentile(thisEr: number, comparisonErs: number[]): number | null {
  if (thisEr <= 0 || !comparisonErs.length) return null;
  const below = comparisonErs.filter((er) => er < thisEr).length;
  return Math.round((below / comparisonErs.length) * 1000) / 10;
}

function normalizePeers(
  peers: BenchmarkPeer[] | Array<{ id: string; accounts: Account[] | null | undefined }>
): BenchmarkPeer[] {
  const normalized: BenchmarkPeer[] = [];
  for (const row of peers) {
    if ("er" in row && typeof (row as BenchmarkPeer).er === "number") {
      normalized.push(row as BenchmarkPeer);
      continue;
    }
    const built = peerFromAccounts(
      String((row as { id: string }).id),
      (row as { accounts: Account[] | null | undefined }).accounts
    );
    if (built) normalized.push(built);
  }
  return normalized;
}

function collectPeerErs(
  normalized: BenchmarkPeer[],
  selfId: string,
  bucket: SizeBucket
): { catalogErs: number[]; peerErs: number[] } {
  const catalogErs: number[] = [];
  const peerErs: number[] = [];
  for (const row of normalized) {
    if (row.id === selfId) continue;
    if (!isUsablePeerEr(row.er, row.erFlagged)) continue;
    catalogErs.push(row.er);
    if (sizeBucket(row.followers) === bucket) peerErs.push(row.er);
  }
  return { catalogErs, peerErs };
}

export function buildCatalogBenchmark(
  selfId: string,
  selfAccounts: Account[] | null | undefined,
  peers: BenchmarkPeer[] | Array<{ id: string; accounts: Account[] | null | undefined }>
): CatalogBenchmark {
  const selfPeer = peerFromAccounts(selfId, selfAccounts);
  const thisFollowers = selfPeer?.followers ?? totalFollowersFromAccounts(selfAccounts);
  const thisEr = selfPeer && selfPeer.er > 0 ? selfPeer.er : null;
  const thisErFlagged = selfPeer?.erFlagged === true;
  const bucket = sizeBucket(thisFollowers);

  const { catalogErs, peerErs } = collectPeerErs(normalizePeers(peers), selfId, bucket);
  const peerAvgEr = median(peerErs);
  const catalogAvgEr = median(catalogErs);
  const usePeers = peerErs.length >= 5;
  const compareSet = usePeers ? peerErs : catalogErs;
  const compare = usePeers ? peerAvgEr : catalogAvgEr;
  const delta =
    thisEr != null && compare != null ? Math.round((thisEr - compare) * 10) / 10 : null;
  const percentile =
    thisEr != null && !thisErFlagged ? erPercentile(thisEr, compareSet) : null;

  return {
    thisEr,
    thisFollowers,
    thisErFlagged,
    bucket,
    peerCount: peerErs.length,
    peerAvgEr,
    catalogCount: catalogErs.length,
    catalogAvgEr,
    delta,
    percentile,
  };
}
