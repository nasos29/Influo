import { resolveCompletionRate } from "@/lib/completionRate";
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
  /** When the exact amount is withheld, still count "has a price" toward readiness. */
  hasPricedMinRate?: boolean;
  /** Hard ER flag on main account — engagement axis stays neutral, no ER bonuses. */
  erFlagged?: boolean;
  avgResponseHours?: number | null;
  avgRating?: number | null;
  hasAvatar?: boolean;
  hasBio?: boolean;
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

/**
 * Size-scaled “excellent” ER % thresholds:
 * <10k → 8, 10k–100k → 5, 100k–500k → 3, >500k → 2.
 */
export function excellentErThreshold(followersTotal: number): number {
  const f = Math.max(0, Number(followersTotal) || 0);
  if (f < 10_000) return 8;
  if (f < 100_000) return 5;
  if (f <= 500_000) return 3;
  return 2;
}

/** Excellent / good / average ER cutoffs for a follower band. */
export function erBandThresholds(followersTotal: number): { excellent: number; good: number; average: number } {
  const excellent = excellentErThreshold(followersTotal);
  return {
    excellent,
    good: round1(excellent * 0.6),
    average: round1(excellent * 0.3),
  };
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

function scoreEngagement(er: number, followersTotal: number, erFlagged?: boolean): number {
  if (erFlagged) return 2.5;
  if (er <= 0) return 1.8;
  const { excellent, good, average } = erBandThresholds(followersTotal);
  if (er >= excellent) return 4.8;
  if (er >= good) return 4.0;
  if (er >= average) return 3.0;
  return 2.2;
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

/** Like/followers ratio bands mirror ER % / 100 for the same follower size. */
function likeRatioThresholds(followersTotal: number): { excellent: number; good: number; average: number } {
  const er = erBandThresholds(followersTotal);
  return {
    excellent: er.excellent / 100,
    good: er.good / 100,
    average: er.average / 100,
  };
}

function scoreChannelQuality(input: ChannelScoreInput, likes: number): number {
  let s = 2.2;
  if (input.brandSafe) s += 0.7;
  if (input.platformCount >= 2) s += 0.5;
  if (input.platformCount >= 3) s += 0.3;

  const followers = input.followersTotal || 0;
  if (followers > 0 && likes > 0) {
    const ratio = likes / followers;
    const bands = likeRatioThresholds(followers);
    if (ratio >= bands.excellent) s += 1.2;
    else if (ratio >= bands.good) s += 0.8;
    else if (ratio >= bands.average) s += 0.4;
  }

  if (input.erFlagged) s -= 1;
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

function scoreCollaborationReadiness(input: ChannelScoreInput): number {
  // Response (max 2)
  const hours = input.avgResponseHours;
  let responsePart = 0.4;
  if (hours != null && Number.isFinite(hours) && hours > 0) {
    if (hours <= 6) responsePart = 2;
    else if (hours <= 24) responsePart = 1.5;
    else if (hours <= 72) responsePart = 0.8;
    else responsePart = 0.4;
  }

  // Completion (max 1.5)
  const usableCompletion = resolveCompletionRate(input.completionRate);
  const completionPart =
    usableCompletion == null ? 0.75 : round1(1.5 * (usableCompletion / 100));

  // Reviews (max 1.5)
  const reviews = Math.max(0, Number(input.reviewCount) || 0);
  const rating = Number(input.avgRating);
  let reviewPart = 0;
  if (reviews > 0 && Number.isFinite(rating) && rating > 0) {
    if (rating >= 4.5) reviewPart = 1.5;
    else if (rating >= 4) reviewPart = 1.1;
    else if (rating >= 3) reviewPart = 0.6;
    else reviewPart = 0.3;
  }

  // Prices (max 1.5)
  const cardRates = [
    parseMoney(input.rateCard?.story),
    parseMoney(input.rateCard?.post),
    parseMoney(input.rateCard?.reel),
    parseMoney(input.rateCard?.facebook),
    parseMoney(input.rateCard?.youtube),
  ].filter((n): n is number => n != null);
  let pricePart = 0;
  if (parseMoney(input.minRate) != null || input.hasPricedMinRate) pricePart += 1;
  if (cardRates.length >= 2) pricePart += 0.5;

  // Profile completeness (max 2)
  let profilePart = 0;
  if (input.hasAvatar) profilePart += 0.5;
  if (input.hasBio) profilePart += 0.5;
  if ((input.contentCount || 0) >= 3) profilePart += 0.5;
  if (input.hasAudience) profilePart += 0.5;

  // Verification (max 1.5)
  let verifyPart = 0;
  if (input.verified) verifyPart += 1;
  if (input.brandSafe) verifyPart += 0.5;

  const total =
    responsePart + completionPart + reviewPart + pricePart + profilePart + verifyPart;
  return round1(Math.min(10, Math.max(0, total)));
}

export function buildChannelScore(input: ChannelScoreInput) {
  const er = parseEngagementPercent(input.engagementRate);
  const likes = parseLikes(input.avgLikes);
  const axes: ChannelAxis[] = [
    { id: "followersGrowth", score: round1(scoreFollowersGrowth(input.growthPct)) },
    { id: "creationPublish", score: round1(scoreCreation(input.contentCount, input.platformCount)) },
    { id: "audienceCredibility", score: round1(scoreAudience(input)) },
    {
      id: "engagementRate",
      score: round1(scoreEngagement(er, input.followersTotal, input.erFlagged)),
    },
    { id: "channelQuality", score: round1(scoreChannelQuality(input, likes)) },
  ];
  const influoScore = round1(axes.reduce((a, x) => a + x.score, 0) / axes.length);

  const coopPotential = scoreCollaborationReadiness(input);

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
  // Only show a range when a rate card provides an upper bound — never invent ×2.2 from min_rate alone.
  const integrationTo = cardRates.length ? Math.max(...allRates) : null;
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
  };
}

export const AXIS_LABELS: Record<ChannelAxisId, { el: string; en: string }> = {
  followersGrowth: { el: "Αύξηση followers", en: "Followers growth" },
  creationPublish: { el: "Δείγματα δουλειάς", en: "Portfolio" },
  channelQuality: { el: "Ποιότητα καναλιού", en: "Channel quality" },
  engagementRate: { el: "Engagement rate", en: "Engagement rate" },
  audienceCredibility: { el: "Πληρότητα & επαλήθευση", en: "Verification & completeness" },
};

export const COOP_LABELS = {
  el: "Ετοιμότητα για συνεργασία",
  en: "Collaboration readiness",
} as const;

export const COOP_HINT = {
  el: "Πόσο έτοιμο είναι το προφίλ για συνεργασία: απόκριση, ολοκληρώσεις, αξιολογήσεις, τιμές, πληρότητα.",
  en: "How ready the profile is to collaborate: response, completions, reviews, pricing, completeness.",
} as const;
