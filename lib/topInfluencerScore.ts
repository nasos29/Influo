/**
 * Top-10 composite score:
 *   45% brand activity
 *   27% channel analysis (influoScore from buildChannelScore)
 *   13% reach (followers + avg views)
 *   10% reviews (avg_rating × review volume)
 *   5% badges (same badge system as profiles)
 * Catalog comparison is intentionally excluded.
 */

import { buildChannelScore } from '@/lib/channelScore';
import { detectErFlag, parseErPercent } from '@/lib/engagementFlags';
import { parseFollowerString, totalFollowersFromAccounts } from '@/lib/parseFollowers';
import { getBadges, type BadgeType } from '@/lib/badges';

export type TopScoreAccount = {
  platform?: string | null;
  username?: string | null;
  followers?: string | number | null;
  engagement_rate?: string | null;
  avg_likes?: string | number | null;
  avg_views?: string | number | null;
  posts_count?: string | number | null;
  er_suspicious?: boolean | null;
  er_flag_reason?: string | null;
  suspected_fake_penalty?: boolean | null;
  engagement_hidden?: boolean | null;
};

export type TopScoreInfluencer = {
  id: string;
  accounts?: TopScoreAccount[] | null;
  videos?: string[] | null;
  analytics_verified?: boolean | null;
  verified?: boolean | null;
  auditpr_audit?: { brandSafe?: boolean | null } | null;
  min_rate?: string | null;
  rate_card?: {
    story?: string;
    post?: string;
    reel?: string;
    facebook?: string;
    youtube?: string;
  } | null;
  total_reviews?: number | null;
  avg_rating?: number | string | null;
  past_brands?: unknown[] | number | null;
  created_at?: string | null;
  audience_top_age?: string | null;
  audience_male_percent?: number | null;
  audience_female_percent?: number | null;
};

/** Relative weights for the final blend (sum = 1). */
export const TOP_ACTIVITY_WEIGHT = 0.45;
export const TOP_CHANNEL_WEIGHT = 0.27;
export const TOP_REACH_WEIGHT = 0.13;
export const TOP_REVIEW_WEIGHT = 0.1;
export const TOP_BADGE_WEIGHT = 0.05;

/** Points per badge type (aligned with badge priority). */
const BADGE_POINTS: Record<BadgeType, number> = {
  new: 22,
  rising: 38,
  verified: 48,
  top_performer: 62,
  pro: 74,
  elite: 88,
  vip: 100,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function logNorm(value: number, softMax: number): number {
  if (!(value > 0) || !(softMax > 0)) return 0;
  return clamp01(Math.log10(1 + value) / Math.log10(1 + softMax));
}

function socialAccounts(accounts: TopScoreAccount[] | null | undefined): TopScoreAccount[] {
  if (!Array.isArray(accounts)) return [];
  return accounts.filter((a) => {
    const p = String(a.platform || '').toLowerCase();
    const u = String(a.username || '').replace(/^@+/, '').trim();
    return !!u && ['instagram', 'tiktok', 'youtube'].includes(p);
  });
}

/** Cap / dampen inflated ER so channel score matches trusted ranking. */
export function trustedErPercent(acc: TopScoreAccount): number | null {
  const raw = parseErPercent(acc.engagement_rate);
  if (raw == null) return null;
  const flagged =
    acc.er_suspicious === true ||
    !!detectErFlag({
      engagement_rate: acc.engagement_rate,
      posts_count: acc.posts_count,
      avg_likes: acc.avg_likes,
      suspected_fake_penalty: acc.suspected_fake_penalty,
      engagement_hidden: acc.engagement_hidden,
    });
  if (flagged) {
    if (raw >= 25) return Math.min(raw, 4);
    if (raw >= 15) return Math.min(raw, 6);
    return Math.min(raw, 8) * 0.65;
  }
  return Math.min(raw, 12);
}

function platformKey(platform: string | null | undefined): string {
  return String(platform || '').trim().toLowerCase() || 'other';
}

/**
 * influoScore (0–5) → 0–100, using the same channel analysis as the profile panel.
 */
export function computeChannelScore100(
  inf: TopScoreInfluencer,
  growthPct: number | null = null
): number {
  const accounts = socialAccounts(inf.accounts);
  const followersTotal = totalFollowersFromAccounts(accounts);
  const platforms = new Set(accounts.map((a) => platformKey(a.platform)));
  const platformCount = [...platforms].filter((p) => p !== 'other').length;

  const engagementRate: Record<string, string> = {};
  const avgLikes: Record<string, string> = {};
  for (const acc of accounts) {
    const key = platformKey(acc.platform);
    const er = trustedErPercent(acc);
    if (er != null) engagementRate[key] = `${er}%`;
    const likes = parseFollowerString(acc.avg_likes);
    if (likes > 0) avgLikes[key] = String(likes);
  }

  const contentCount = Array.isArray(inf.videos) ? inf.videos.filter(Boolean).length : 0;
  const hasAudience =
    !!(inf.audience_top_age && inf.audience_top_age !== '?') ||
    (inf.audience_male_percent != null && inf.audience_female_percent != null);

  const { influoScore } = buildChannelScore({
    followersTotal,
    engagementRate: Object.keys(engagementRate).length ? engagementRate : null,
    avgLikes: Object.keys(avgLikes).length ? avgLikes : null,
    contentCount,
    platformCount: Math.max(platformCount, accounts.length ? 1 : 0),
    verified: !!(inf.analytics_verified || inf.verified),
    brandSafe: inf.auditpr_audit?.brandSafe === true,
    hasAudience,
    reviewCount: Number(inf.total_reviews) || 0,
    completionRate: null,
    growthPct,
    minRate: inf.min_rate ?? null,
    rateCard: inf.rate_card ?? null,
  });

  // influoScore is 0–5 on the profile radar.
  return Math.round(clamp01(influoScore / 5) * 1000) / 10;
}

/**
 * Reach-only 0–100: audience size + avg views (not in influoScore axes directly).
 */
export function computeReachScore(inf: TopScoreInfluencer): number {
  const accounts = socialAccounts(inf.accounts);
  if (!accounts.length) return 5;

  let followers = 0;
  let viewsSum = 0;
  let viewsN = 0;
  let suspicious = 0;

  for (const acc of accounts) {
    followers += parseFollowerString(acc.followers);
    const views = parseFollowerString(acc.avg_views);
    if (views > 0) {
      viewsSum += views;
      viewsN += 1;
    }
    if (
      acc.er_suspicious ||
      detectErFlag({
        engagement_rate: acc.engagement_rate,
        posts_count: acc.posts_count,
        avg_likes: acc.avg_likes,
        suspected_fake_penalty: acc.suspected_fake_penalty,
        engagement_hidden: acc.engagement_hidden,
      })
    ) {
      suspicious += 1;
    }
  }

  const avgViews = viewsN ? viewsSum / viewsN : 0;
  const followersPart = logNorm(followers, 150_000) * 55;
  const viewsPart = logNorm(avgViews, 80_000) * 45;
  const penalty = suspicious > 0 ? Math.min(15, suspicious * 7) : 0;
  return Math.round(clamp01((followersPart + viewsPart - penalty) / 100) * 1000) / 10;
}

/**
 * Reviews 0–100: star rating quality × how many reviews (volume soft-cap ~12).
 * No reviews → low baseline so brands with ratings can pull ahead a bit.
 */
export function computeReviewScore(inf: TopScoreInfluencer): number {
  const count = Math.max(0, Number(inf.total_reviews) || 0);
  const ratingRaw = Number(inf.avg_rating);
  const rating =
    Number.isFinite(ratingRaw) && ratingRaw > 0 ? Math.min(5, Math.max(0, ratingRaw)) : 0;

  if (count <= 0 || rating <= 0) return 12;

  const quality = clamp01(rating / 5); // 0–1
  const volume = logNorm(count, 12); // 1 review ~ modest, 12+ ~ full
  // Prefer good ratings; few mediocre reviews shouldn't outrank many strong ones.
  const raw = quality * 70 + volume * 30;
  // Soft floor for anyone rated at all.
  return Math.round(Math.max(28, raw) * 10) / 10;
}

/**
 * Badges 0–100 using the same getBadges() rules as the profile UI.
 * Small ranking signal — verified / pro / elite / vip help a bit.
 */
export function computeBadgeScore(inf: TopScoreInfluencer): number {
  const accounts = socialAccounts(inf.accounts);
  const followers: Record<string, number> = {};
  const engagementRate: Record<string, string> = {};
  for (const acc of accounts) {
    const key = platformKey(acc.platform);
    const f = parseFollowerString(acc.followers);
    if (f > 0) followers[key] = f;
    const er = trustedErPercent(acc);
    if (er != null) engagementRate[key] = `${er}%`;
  }

  let accountCreatedDays = 999;
  if (inf.created_at) {
    const created = new Date(inf.created_at).getTime();
    if (Number.isFinite(created)) {
      accountCreatedDays = Math.max(
        0,
        Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24))
      );
    }
  }

  const badges = getBadges({
    verified: !!(inf.analytics_verified || inf.verified),
    followers,
    engagement_rate: Object.keys(engagementRate).length ? engagementRate : undefined,
    total_reviews: Number(inf.total_reviews) || 0,
    avg_rating: Number(inf.avg_rating) || 0,
    past_brands: inf.past_brands ?? [],
    account_created_days: accountCreatedDays,
    min_rate: inf.min_rate ?? undefined,
  });

  if (!badges.length) return 14;

  const points = badges.reduce((sum, b) => sum + (BADGE_POINTS[b.type] || 0), 0);
  // verified + elite/vip can stack; soft-cap so badges stay a nudge not a takeover
  const scaled = badges.length > 1 ? points * 0.82 : points;
  return Math.round(Math.min(100, Math.max(18, scaled)) * 10) / 10;
}

/** @deprecated kept for tests / callers — prefer computeChannelScore100 + computeReachScore */
export function computeStatsScore(inf: TopScoreInfluencer, growthPct: number | null = null): number {
  const channel = computeChannelScore100(inf, growthPct);
  const reach = computeReachScore(inf);
  const reviews = computeReviewScore(inf);
  const badges = computeBadgeScore(inf);
  return Math.round((channel * 0.5 + reach * 0.28 + reviews * 0.14 + badges * 0.08) * 10) / 10;
}

export function normalizeScores(raw: Record<string, number>): Record<string, number> {
  const vals = Object.values(raw);
  if (!vals.length) return {};
  const max = Math.max(...vals);
  if (!(max > 0)) {
    return Object.fromEntries(Object.keys(raw).map((id) => [id, 0]));
  }
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(raw)) {
    out[id] = Math.round((v / max) * 1000) / 10;
  }
  return out;
}

export function blendTopScore(
  activityNorm: number,
  channelScore: number,
  reachScore: number,
  reviewScore: number = 12,
  badgeScore: number = 14
): number {
  return (
    Math.round(
      (clamp01(activityNorm / 100) * TOP_ACTIVITY_WEIGHT +
        clamp01(channelScore / 100) * TOP_CHANNEL_WEIGHT +
        clamp01(reachScore / 100) * TOP_REACH_WEIGHT +
        clamp01(reviewScore / 100) * TOP_REVIEW_WEIGHT +
        clamp01(badgeScore / 100) * TOP_BADGE_WEIGHT) *
        1000
    ) / 10
  );
}

/**
 * 30-day growth % from snapshot rows (same idea as /api/influencer/[id]/growth).
 */
export function growthPctFromSnapshots(
  currentTotal: number,
  snapshots: Array<{ total: number; at: number }>,
  now = Date.now()
): number | null {
  if (!(currentTotal > 0) || !snapshots.length) return null;
  const thirtyMs = 30 * 24 * 60 * 60 * 1000;
  const minFallbackAgeMs = 7 * 24 * 60 * 60 * 1000;
  const baseline30 = snapshots.find((s) => now - s.at >= thirtyMs);
  const fallback = [...snapshots].reverse().find((s) => now - s.at >= minFallbackAgeMs);
  const baseline = baseline30 || fallback;
  if (!baseline || !(baseline.total > 0)) return null;
  const growth = currentTotal - baseline.total;
  return Math.round((growth / baseline.total) * 1000) / 10;
}
