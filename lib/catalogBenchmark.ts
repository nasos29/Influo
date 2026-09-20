import { parseEngagementPercent } from "@/lib/channelScore";
import { totalFollowersFromAccounts } from "@/lib/parseFollowers";

export type SizeBucket = "nano" | "micro" | "mid" | "macro" | "mega";

export type CatalogBenchmark = {
  thisEr: number | null;
  thisFollowers: number;
  bucket: SizeBucket;
  peerCount: number;
  peerAvgEr: number | null;
  catalogCount: number;
  catalogAvgEr: number | null;
  delta: number | null;
};

export const BUCKET_LABELS: Record<SizeBucket, { el: string; en: string; range: string }> = {
  nano: { el: "Nano", en: "Nano", range: "<10k" },
  micro: { el: "Micro", en: "Micro", range: "10k–50k" },
  mid: { el: "Mid", en: "Mid", range: "50k–250k" },
  macro: { el: "Macro", en: "Macro", range: "250k–1M" },
  mega: { el: "Mega", en: "Mega", range: "1M+" },
};

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
};

export function engagementFromAccounts(accounts: Account[] | null | undefined): number {
  if (!Array.isArray(accounts)) return 0;
  const vals = accounts
    .map((a) => parseEngagementPercent(a?.engagement_rate != null ? String(a.engagement_rate) : null))
    .filter((n) => n > 0);
  if (!vals.length) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export function buildCatalogBenchmark(
  selfId: string,
  selfAccounts: Account[] | null | undefined,
  peers: Array<{ id: string; accounts: Account[] | null | undefined }>
): CatalogBenchmark {
  const thisFollowers = totalFollowersFromAccounts(selfAccounts);
  const thisErRaw = engagementFromAccounts(selfAccounts);
  const thisEr = thisErRaw > 0 ? thisErRaw : null;
  const bucket = sizeBucket(thisFollowers);

  const catalogErs: number[] = [];
  const peerErs: number[] = [];

  for (const row of peers) {
    const followers = totalFollowersFromAccounts(row.accounts);
    if (followers <= 0) continue;
    const er = engagementFromAccounts(row.accounts);
    if (!(er > 0)) continue;
    catalogErs.push(er);
    if (row.id !== selfId && sizeBucket(followers) === bucket) {
      peerErs.push(er);
    }
  }

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  const peerAvgEr = avg(peerErs);
  const catalogAvgEr = avg(catalogErs);
  const compare = peerErs.length >= 5 ? peerAvgEr : catalogAvgEr;
  const delta = thisEr != null && compare != null ? Math.round((thisEr - compare) * 10) / 10 : null;

  return {
    thisEr,
    thisFollowers,
    bucket,
    peerCount: peerErs.length,
    peerAvgEr,
    catalogCount: catalogErs.length,
    catalogAvgEr,
    delta,
  };
}
