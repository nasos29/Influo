export type PlatformStat = {
  platform: string;
  followers?: string | null;
  engagement?: string | null;
};

export function parseFollowerNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  const clean = String(value).toLowerCase().replace(/,/g, "").replace(/\s/g, "").trim();
  if (!clean || clean === "-" || clean === "n/a") return 0;
  if (clean.includes("m")) return parseFloat(clean) * 1_000_000 || 0;
  if (clean.includes("k") || clean.includes("κ")) return parseFloat(clean) * 1000 || 0;
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : 0;
}

export function formatFollowerCount(n: number): string {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
}

export function statsFromAccounts(accounts: unknown): PlatformStat[] {
  if (!Array.isArray(accounts)) return [];
  const out: PlatformStat[] = [];
  for (const raw of accounts) {
    if (!raw || typeof raw !== "object") continue;
    const acc = raw as { platform?: string; followers?: string; engagement_rate?: string };
    const platform = String(acc.platform || "").toLowerCase();
    if (!platform) continue;
    const followers = acc.followers != null ? String(acc.followers).trim() : "";
    if (!followers || parseFollowerNumber(followers) <= 0) continue;
    out.push({
      platform,
      followers,
      engagement: acc.engagement_rate ? String(acc.engagement_rate) : null,
    });
  }
  return out;
}
