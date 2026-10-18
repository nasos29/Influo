export type PlatformStat = {
  platform: string;
  followers?: string | null;
  engagement?: string | null;
};

const PLATFORM_ALIASES: Record<string, string> = {
  ig: "instagram",
  insta: "instagram",
  instagram: "instagram",
  tt: "tiktok",
  tiktok: "tiktok",
  yt: "youtube",
  youtube: "youtube",
  fb: "facebook",
  facebook: "facebook",
  x: "twitter",
  twitter: "twitter",
};

/** One key per network so "IG" and "Instagram" cannot both render. */
export function canonicalPlatform(value: unknown): string {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "");
  if (!raw) return "";
  return PLATFORM_ALIASES[raw] || raw;
}

type AccountFields = {
  platform?: string;
  followers?: string | number | null;
  engagement_rate?: string | number | null;
  verified?: boolean;
  is_verified?: boolean;
  analytics_verified?: boolean;
  updated_at?: string | null;
  created_at?: string | null;
  synced_at?: string | null;
};

function accountVerified(acc: AccountFields): number {
  if (acc.verified === true || acc.is_verified === true || acc.analytics_verified === true) return 1;
  return 0;
}

/** Timestamp when present; otherwise array position (later row = more recently stored). */
function accountRecency(acc: AccountFields, index: number): number {
  const stamp = acc.updated_at || acc.synced_at || acc.created_at;
  const parsed = typeof stamp === "string" ? Date.parse(stamp) : Number.NaN;
  if (Number.isFinite(parsed)) return parsed;
  return index;
}

export function parseFollowerNumber(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") return 0;
  const clean = String(value).toLowerCase().replace(/,/g, "").replace(/\s/g, "").trim();
  if (!clean || clean === "-" || clean === "n/a") return 0;
  let scale = 1;
  if (clean.includes("m")) scale = 1_000_000;
  else if (clean.includes("k") || clean.includes("κ")) scale = 1000;
  const n = Number.parseFloat(clean) * scale;
  return Number.isFinite(n) ? n : 0;
}

export function formatFollowerCount(n: number): string {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
}

export function statsFromAccounts(accounts: unknown, options?: { keepEmpty?: boolean }): PlatformStat[] {
  if (!Array.isArray(accounts)) return [];
  const best = new Map<string, { stat: PlatformStat; verified: number; recent: number; hasCount: boolean }>();
  accounts.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return;
    const acc = raw as AccountFields;
    const platform = canonicalPlatform(acc.platform);
    if (!platform) return;
    const followers = acc.followers != null ? String(acc.followers).trim() : "";
    const hasCount = !!followers && parseFollowerNumber(followers) > 0;
    if (!hasCount && !options?.keepEmpty) return;
    const candidate = {
      stat: {
        platform,
        followers: hasCount ? followers : "",
        engagement: acc.engagement_rate != null ? String(acc.engagement_rate) : null,
      },
      verified: accountVerified(acc),
      recent: accountRecency(acc, index),
      hasCount,
    };
    const current = best.get(platform);
    const better =
      !current ||
      (candidate.hasCount && !current.hasCount) ||
      (candidate.hasCount === current.hasCount &&
        (candidate.verified > current.verified ||
          (candidate.verified === current.verified && candidate.recent >= current.recent)));
    if (better) best.set(platform, candidate);
  });
  return [...best.values()].map((row) => row.stat);
}
