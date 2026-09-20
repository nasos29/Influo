import { parseFollowerString } from "@/lib/parseFollowers";

export type ChannelAxisId =
  | "followersGrowth"
  | "creationPublish"
  | "channelQuality"
  | "engagementRate"
  | "audienceCredibility";

export type ChannelAxis = {
  id: ChannelAxisId;
  score: number;
};

export type ChannelScoreInput = {
  followersTotal: number;
  engagementRate?: string | { [key: string]: string } | null;
  avgLikes?: string | { [key: string]: string } | number | null;
  contentCount: number;
  platformCount: number;
  verified?: boolean;
  brandSafe?: boolean;
  hasAudience?: boolean;
  reviewCount?: number;
  completionRate?: number | null;
  growthPct?: number | null;
  minRate?: string | null;
  rateCard?: { story?: string; post?: string; reel?: string; facebook?: string; youtube?: string } | null;
};

function clamp(n: number, min = 0, max = 5): number {
  return Math.min(max, Math.max(min, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function parseEngagementPercent(rate?: string | { [key: string]: string } | null): number {
  if (!rate) return 0;
  if (typeof rate === "object" && !Array.isArray(rate)) {
    const vals = Object.values(rate)
      .map((v) => parseFloat(String(v).replace("%", "").replace(",", ".")))
      .filter((n) => Number.isFinite(n));
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return parseFloat(String(rate).replace("%", "").replace(",", ".")) || 0;
}

function parseLikes(avgLikes: ChannelScoreInput["avgLikes"]): number {
  if (avgLikes == null) return 0;
  if (typeof avgLikes === "number") return avgLikes;
  if (typeof avgLikes === "object") {
    const vals = Object.values(avgLikes).map((v) => parseFollowerString(v)).filter((n) => n > 0);
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return parseFollowerString(avgLikes);
}

export function qualityLabel(score: number, lang: "el" | "en"): string {
  if (score >= 4.2) return lang === "el" ? "Εξαιρετικό" : "Excellent";
  if (score >= 3.2) return lang === "el" ? "Καλό" : "Good";
  if (score >= 2.2) return lang === "el" ? "Μέτριο" : "Average";
  return lang === "el" ? "Χαμηλό" : "Low";
}

export function qualityColor(score: number): string {
  if (score >= 4.2) return "text-emerald-600";
  if (score >= 3.2) return "text-blue-600";
  if (score >= 2.2) return "text-amber-600";
  return "text-slate-500";
}

function scoreFollowersGrowth(growthPct: number | null | undefined): number {
  if (growthPct == null || !Number.isFinite(growthPct)) return 2.5;
  if (growthPct < -5) return 1.2;
  if (growthPct < 0) return 2.2;
  if (growthPct < 1.5) return 3.2;
  if (growthPct < 5) return 4.1;
  return 4.8;
}

function scoreEngagement(er: number): number {
  if (er <= 0) return 1.8;
  if (er < 1) return 2.4;
  if (er < 2.5) return 3.3;
  if (er < 5) return 4.2;
  return 4.8;
}

function scoreCreation(contentCount: number, platformCount: number): number {
  let s = 1.6;
  if (contentCount >= 1) s += 0.7;
  if (contentCount >= 3) s += 0.7;
  if (contentCount >= 6) s += 0.7;
  if (contentCount >= 10) s += 0.5;
  if (platformCount >= 2) s += 0.5;
  return clamp(s);
}

function scoreChannelQuality(input: ChannelScoreInput, er: number, likes: number): number {
  let s = 2;
  if (input.verified) s += 0.8;
  if (input.brandSafe) s += 0.6;
  if (input.platformCount >= 2) s += 0.4;
  if (er >= 2) s += 0.5;
  if (er >= 4) s += 0.3;
  const followers = input.followersTotal || 0;
  if (followers > 0 && likes > 0) {
    const ratio = likes / followers;
    if (ratio >= 0.02) s += 0.5;
    else if (ratio >= 0.008) s += 0.3;
  }
  return clamp(s);
}

function scoreAudience(input: ChannelScoreInput): number {
  let s = 2.1;
  if (input.verified) s += 1.1;
  if (input.brandSafe) s += 0.7;
  if (input.hasAudience) s += 0.6;
  if ((input.reviewCount || 0) > 0) s += 0.3;
  return clamp(s);
}

export function parseMoney(raw?: string | null): number | null {
  if (!raw) return null;
  const t = String(raw).trim();
  if (!t || /ρώτησε|ask/i.test(t)) return null;
  const n = parseFloat(t.replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function buildChannelScore(input: ChannelScoreInput) {
  const er = parseEngagementPercent(input.engagementRate);
  const likes = parseLikes(input.avgLikes);
  const axes: ChannelAxis[] = [
    { id: "followersGrowth", score: round1(scoreFollowersGrowth(input.growthPct)) },
    { id: "creationPublish", score: round1(scoreCreation(input.contentCount, input.platformCount)) },
    { id: "audienceCredibility", score: round1(scoreAudience(input)) },
    { id: "engagementRate", score: round1(scoreEngagement(er)) },
    { id: "channelQuality", score: round1(scoreChannelQuality(input, er, likes)) },
  ];
  const influoScore = round1(axes.reduce((a, x) => a + x.score, 0) / axes.length);

  let coop = 3.2;
  if (input.verified) coop += 1.4;
  if (input.brandSafe) coop += 0.9;
  if (parseMoney(input.minRate)) coop += 0.7;
  if (er >= 2) coop += 1;
  if (er >= 4) coop += 0.4;
  if (input.contentCount >= 3) coop += 0.6;
  if ((input.completionRate || 0) >= 80) coop += 0.6;
  if ((input.reviewCount || 0) > 0) coop += 0.4;
  const coopPotential = round1(clamp(coop, 0, 10));

  const minRate = parseMoney(input.minRate);
  const cardRates = [
    parseMoney(input.rateCard?.story),
    parseMoney(input.rateCard?.post),
    parseMoney(input.rateCard?.reel),
    parseMoney(input.rateCard?.facebook),
    parseMoney(input.rateCard?.youtube),
  ].filter((n): n is number => n != null);
  const allRates = [...cardRates, ...(minRate != null ? [minRate] : [])];
  const integrationFrom = allRates.length ? Math.min(...allRates) : null;
  const integrationTo = cardRates.length
    ? Math.max(...allRates)
    : minRate != null
      ? Math.round(minRate * 2.2)
      : null;
  const followersK = input.followersTotal > 0 ? input.followersTotal / 1000 : 0;
  const costPer1k = minRate != null && followersK >= 0.2 ? round1(minRate / followersK) : null;

  return {
    axes,
    influoScore,
    coopPotential,
    engagementPercent: round1(er),
    costPer1k,
    integrationFrom,
    integrationTo,
    integrationIsEstimate: cardRates.length === 0 && minRate != null,
  };
}

export const AXIS_LABELS: Record<ChannelAxisId, { el: string; en: string }> = {
  followersGrowth: { el: "Αύξηση followers", en: "Followers growth" },
  creationPublish: { el: "Δημιουργία & δημοσίευση", en: "Creation & publish" },
  channelQuality: { el: "Ποιότητα καναλιού", en: "Channel quality" },
  engagementRate: { el: "Engagement rate", en: "Engagement rate" },
  audienceCredibility: { el: "Αξιοπιστία κοινού", en: "Audience credibility" },
};
