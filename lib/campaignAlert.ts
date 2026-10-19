import { toGreeklish } from "./greeklish.ts";
import { canonicalPlatform, parseFollowerNumber, statsFromAccounts } from "./platformStats.ts";
import { sharedCategoryKeys } from "./recommendations.ts";

export type AlertCandidate = {
  id: string;
  category?: string | null;
  approved?: boolean | null;
  availability_status?: string | null;
  auth_user_id?: string | null;
  location?: string | null;
  accounts?: unknown;
};

export type CampaignAlertBrief = {
  category?: string | null;
  location?: string | null;
  minFollowers?: number | null;
  platforms?: string[] | null;
};

export type RankedAlert = {
  id: string;
  authUserId: string;
  /** Same region (when the campaign names one) and at least the follower minimum on a campaign platform. */
  strong: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** Resend stays under a few requests per second. The publish function has 60s. */
export const OUTREACH_BATCH_SIZE = 2;
export const OUTREACH_GAP_MS = 500;
export const OUTREACH_BUDGET_MS = 45_000;

export function outreachBudgetLeft(startedAt: number, now: number, budgetMs = OUTREACH_BUDGET_MS): boolean {
  return now - startedAt < budgetMs;
}

function available(status: string | null | undefined): boolean {
  return !status || status === "available";
}

/** Approved, available creators in the campaign category. Unavailable profiles are skipped. */
export function campaignAlertTarget(
  row: AlertCandidate,
  category: string | null | undefined
): { id: string; authUserId: string } | null {
  if (!row.approved) return null;
  if (!available(row.availability_status)) return null;
  if (!category || sharedCategoryKeys(category, row.category).length === 0) return null;
  const authUserId = String(row.auth_user_id || row.id || "").trim();
  if (!UUID.test(authUserId) || !row.id) return null;
  return { id: String(row.id), authUserId };
}

const COUNTRY_TOKENS = new Set(["greece", "ellada", "hellas", "ellas", "gr"]);

/** Metro names that differ in Greek, Latin, and genitive, but are the same region. */
const REGION_GROUPS: string[][] = [
  ["athens", "athina", "athinas", "athinon", "attica", "attiki", "attikis", "attikon", "attike"],
  ["thessaloniki", "thessalonikis", "salonika", "salonica"],
  ["patra", "patras"],
  ["iraklio", "irakleio", "heraklion", "herakleion"],
  ["chania", "hania", "xania"],
  ["ioannina", "yannina"],
  ["larisa", "larissa"],
  ["rhodes", "rodos"],
  ["corfu", "kerkyra"],
  ["chalkida", "halkida", "chalcis"],
];

const regionByToken = new Map<string, number>();
REGION_GROUPS.forEach((group, index) => {
  for (const token of group) regionByToken.set(token, index);
});

/** Latin tokens with country words removed. Empty means the text did not name a city. */
export function placeTokens(value: string | null | undefined): string[] {
  const latin = toGreeklish(String(value || ""))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return latin.split(/[^a-z0-9]+/).filter((token) => token.length > 1 && !COUNTRY_TOKENS.has(token));
}

/** A blank location, or only a country name, is the whole country. */
export function campaignIsNationwide(location: string | null | undefined): boolean {
  return placeTokens(location).length === 0;
}

export function samePlace(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = placeTokens(a);
  const right = placeTokens(b);
  if (!left.length || !right.length) return false;
  const rightSet = new Set(right);
  for (const token of left) {
    if (rightSet.has(token)) return true;
    const region = regionByToken.get(token);
    if (region === undefined) continue;
    if (right.some((other) => regionByToken.get(other) === region)) return true;
  }
  return false;
}

function accountList(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return [];
  }
}

/** True when the campaign sets no minimum, or the best count on its platforms reaches it. */
export function meetsFollowerMinimum(
  accounts: unknown,
  platforms: string[] | null | undefined,
  minFollowers: number | null | undefined
): boolean {
  const minimum = Number(minFollowers) || 0;
  if (minimum <= 0) return true;
  const wanted = (platforms || []).map((platform) => canonicalPlatform(platform)).filter(Boolean);
  const stats = statsFromAccounts(accountList(accounts));
  const pool = wanted.length ? stats.filter((row) => wanted.includes(row.platform)) : stats;
  let best = 0;
  for (const row of pool) {
    const count = parseFollowerNumber(row.followers);
    if (count > best) best = count;
  }
  return best >= minimum;
}

function compareText(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Every approved, available creator who shares a category.
 * Order: same region, then follower minimum, then everyone else. No cap.
 * `strong` is the email/push tier (region when one is set, and the follower minimum when one is set).
 */
export function rankCampaignAlerts(rows: AlertCandidate[], campaign: CampaignAlertBrief): RankedAlert[] {
  const nationwide = campaignIsNationwide(campaign.location);
  const ranked: Array<RankedAlert & { locationMatch: boolean; followerMatch: boolean }> = [];
  for (const row of rows) {
    const target = campaignAlertTarget(row, campaign.category);
    if (!target) continue;
    const locationMatch = nationwide || samePlace(campaign.location, row.location);
    const followerMatch = meetsFollowerMinimum(row.accounts, campaign.platforms, campaign.minFollowers);
    ranked.push({
      ...target,
      strong: locationMatch && followerMatch,
      locationMatch,
      followerMatch,
    });
  }
  ranked.sort((a, b) => {
    if (a.locationMatch !== b.locationMatch) return a.locationMatch ? -1 : 1;
    if (a.followerMatch !== b.followerMatch) return a.followerMatch ? -1 : 1;
    return compareText(a.id, b.id);
  });
  const seen = new Set<string>();
  const unique: RankedAlert[] = [];
  for (const row of ranked) {
    if (seen.has(row.authUserId)) continue;
    seen.add(row.authUserId);
    unique.push({ id: row.id, authUserId: row.authUserId, strong: row.strong });
  }
  return unique;
}

/** Creators who do not already have an announcement for this campaign. */
export function unseenAlerts<T extends { authUserId: string }>(rows: T[], alreadyNotified: Iterable<string>): T[] {
  const seen = new Set(alreadyNotified);
  return rows.filter((row) => !seen.has(row.authUserId));
}
