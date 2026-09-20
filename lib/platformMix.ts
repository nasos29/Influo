import { parseEngagementPercent } from "@/lib/channelScore";
import { parseFollowerString } from "@/lib/parseFollowers";

export type PlatformMixRow = {
  key: string;
  label: { el: string; en: string };
  color: string;
  followers: number;
  pct: number;
  er: number | null;
  likes: number | null;
};

const PLATFORMS: Array<{ key: string; label: { el: string; en: string }; color: string }> = [
  { key: "instagram", label: { el: "Instagram", en: "Instagram" }, color: "#db2777" },
  { key: "tiktok", label: { el: "TikTok", en: "TikTok" }, color: "#0f172a" },
  { key: "youtube", label: { el: "YouTube", en: "YouTube" }, color: "#dc2626" },
  { key: "twitter", label: { el: "X / Twitter", en: "X / Twitter" }, color: "#334155" },
  { key: "facebook", label: { el: "Facebook", en: "Facebook" }, color: "#2563eb" },
];

function metricForPlatform(
  raw: string | { [key: string]: string } | number | null | undefined,
  key: string
): string | number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return raw;
  if (typeof raw === "object") {
    const v = raw[key] ?? raw[key.charAt(0).toUpperCase() + key.slice(1)];
    return v ?? null;
  }
  return raw;
}

export function buildPlatformMix(
  followers: { [key: string]: number | undefined } | null | undefined,
  engagementRate?: string | { [key: string]: string } | null,
  avgLikes?: string | { [key: string]: string } | number | null
): PlatformMixRow[] {
  const total = Object.values(followers || {}).reduce(
    (sum: number, n) => sum + (typeof n === "number" && n > 0 ? n : 0),
    0
  );
  if (total <= 0) return [];

  return PLATFORMS.map((p) => {
    const count = followers?.[p.key] || 0;
    if (!(count > 0)) return null;
    const erRaw = metricForPlatform(engagementRate, p.key);
    const likesRaw = metricForPlatform(avgLikes, p.key);
    const er = erRaw != null ? parseEngagementPercent(typeof erRaw === "number" ? String(erRaw) : erRaw) : 0;
    const likes = likesRaw != null ? parseFollowerString(likesRaw) : 0;
    return {
      ...p,
      followers: count,
      pct: Math.round((count / total) * 1000) / 10,
      er: er > 0 ? er : null,
      likes: likes > 0 ? likes : null,
    };
  }).filter((row): row is PlatformMixRow => row != null);
}
