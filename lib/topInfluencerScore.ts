/**
 * Top-10 composite score (weights sum to 1):
 *   35% demand (unique brand/device activity, log1p-normalized)
 *   25% channel quality (influoScore / computeChannelScore100)
 *   15% collaborations & reviews
 *   10% reach (log)
 *   10% response (avg reply time + recent activity; else neutral 50)
 *   5% profile completeness
 * Trust penalty ×0.35 applied after blend when hard ER issues on main account.
 */

import { buildChannelScore } from '@/lib/channelScore';
import { resolveCompletionRate } from '@/lib/completionRate';
import { creatorHasHardErOnMainAccount, displayErFlag, isHardErFlag, parseErPercent } from '@/lib/engagementFlags';
import { FOLLOWER_GROWTH_WINDOW_DAYS } from '@/lib/followerGrowth';
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
  engagement_rate_raw?: string | number | null;
  fake_follower_percent?: number | string | null;
  suspected_fake_percent?: number | string | null;
  fake_followers_percent?: number | string | null;
  quality_penalty_percent?: number | string | null;
  er_penalty_percent?: number | string | null;
  penalty_percent?: number | string | null;
  /** Locked / private social profile (from scrape). */
  is_private?: boolean | null;
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
  avatar_url?: string | null;
  bio?: string | null;
  category?: string | null;
  location?: string | null;
  avg_response_time?: number | string | null;
  completion_rate?: number | string | null;
  last_social_refresh_at?: string | null;
  approved_at?: string | null;
  approved?: boolean | null;
};

/** Relative weights for the final blend (sum = 1). */
export const TOP_DEMAND_WEIGHT = 0.35;
export const TOP_CHANNEL_WEIGHT = 0.25;
export const TOP_COLLAB_WEIGHT = 0.15;
export const TOP_REACH_WEIGHT = 0.1;
export const TOP_RESPONSE_WEIGHT = 0.1;
export const TOP_PROFILE_WEIGHT = 0.05;

/** @deprecated use TOP_DEMAND_WEIGHT */
export const TOP_ACTIVITY_WEIGHT = TOP_DEMAND_WEIGHT;
/** @deprecated badge axis replaced by profile completeness */
export const TOP_BADGE_WEIGHT = TOP_PROFILE_WEIGHT;
/** @deprecated use TOP_COLLAB_WEIGHT */
export const TOP_REVIEW_WEIGHT = TOP_COLLAB_WEIGHT;

/** Mild rotation: incumbents in top_influencers_snapshot lose 5%. */
export const TOP_INCUMBENT_PENALTY_MULT = 0.95;

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
  if (isHardErFlag(displayErFlag(acc))) {
    if (raw >= 25) return Math.min(raw, 4);
    if (raw >= 15) return Math.min(raw, 6);
    return Math.min(raw, 8) * 0.65;
  }
  return Math.min(raw, 12);
}

function platformKey(platform: string | null | undefined): string {
  return String(platform || '').trim().toLowerCase() || 'other';
}

function hasPricedOffer(inf: TopScoreInfluencer): boolean {
  if (inf.min_rate && String(inf.min_rate).replace(/[^0-9.]/g, '').length > 0) {
    const n = parseFloat(String(inf.min_rate).replace(/[^0-9.]/g, ''));
    if (Number.isFinite(n) && n > 0) return true;
  }
  const rc = inf.rate_card;
  if (!rc || typeof rc !== 'object') return false;
  return Object.values(rc).some((v) => {
    if (v == null || v === '') return false;
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && n > 0;
  });
}

/**
 * Entry gate for homepage Top 10: approved + avatar + non-empty bio +
 * at least one IG/TikTok/YouTube username.
 */
export function isEligibleForTop10(inf: TopScoreInfluencer): boolean {
  if (inf.approved === false) return false;
  if (!(inf.avatar_url || '').trim()) return false;
  if (!(inf.bio || '').trim()) return false;
  return socialAccounts(inf.accounts).length >= 1;
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
    if (isHardErFlag(displayErFlag(acc))) {
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
 * Collaborations & reviews (0–100): review score blended with completion_rate /
 * completed campaign count when available.
 * Ignores completion_rate when null, or when there are 0 reviews and 0 completed
 * campaigns (guards against a leftover DB default of 100).
 */
export function computeCollabScore(
  inf: TopScoreInfluencer,
  completedCampaigns: number = 0
): number {
  const review = computeReviewScore(inf);
  const camps = Math.max(0, Number(completedCampaigns) || 0);
  const completionRaw = resolveCompletionRate(inf.completion_rate, {
    totalReviews: inf.total_reviews,
    completedCampaigns: camps,
    requireCollabEvidence: true,
  });
  const hasCompletion = completionRaw != null;

  if (!hasCompletion && camps <= 0) return review;

  const campPart = hasCompletion
    ? clamp01(completionRaw / 100) * 100
    : logNorm(camps, 10) * 100;

  return Math.round((review * 0.65 + campPart * 0.35) * 10) / 10;
}

/**
 * Response axis 0–100: avg_response_time (hours) + recent activity.
 * Missing data → neutral 50 so the axis does not punish incomplete profiles.
 */
export function computeResponseScore(inf: TopScoreInfluencer, now = Date.now()): number {
  const hours = Number(inf.avg_response_time);
  const hasResponse = Number.isFinite(hours) && hours > 0;

  let responsePart: number | null = null;
  if (hasResponse) {
    // Faster is better: ~1h high, ~24h mid, ~72h+ low
    responsePart = clamp01(1 - Math.log1p(hours) / Math.log1p(72)) * 100;
  }

  let activityPart: number | null = null;
  const lastAt = inf.last_social_refresh_at || inf.approved_at || null;
  if (lastAt) {
    const t = new Date(lastAt).getTime();
    if (Number.isFinite(t)) {
      const days = Math.max(0, (now - t) / (1000 * 60 * 60 * 24));
      activityPart = clamp01(1 - Math.log1p(days) / Math.log1p(90)) * 100;
    }
  }

  if (responsePart == null && activityPart == null) return 50;
  if (responsePart == null) return Math.round(activityPart! * 10) / 10;
  if (activityPart == null) return Math.round(responsePart * 10) / 10;
  return Math.round((responsePart * 0.6 + activityPart * 0.4) * 10) / 10;
}

/**
 * Profile completeness 0–100: photo, bio, social, categories, city, prices.
 */
export function computeProfileCompletenessScore(inf: TopScoreInfluencer): number {
  let points = 0;
  if ((inf.avatar_url || '').trim()) points += 1;
  if ((inf.bio || '').trim()) points += 1;
  if (socialAccounts(inf.accounts).length > 0) points += 1;
  if ((inf.category || '').trim()) points += 1;
  if ((inf.location || '').trim()) points += 1;
  if (hasPricedOffer(inf)) points += 1;
  return Math.round((points / 6) * 1000) / 10;
}

/**
 * Badges 0–100 using the same getBadges() rules as the profile UI.
 * Kept for callers / tests; no longer a Top 10 blend axis.
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
  const collab = computeCollabScore(inf);
  const profile = computeProfileCompletenessScore(inf);
  return Math.round((channel * 0.5 + reach * 0.28 + collab * 0.14 + profile * 0.08) * 10) / 10;
}

/** Linear max-normalize to 0–100 (legacy). Prefer normalizeScoresLog1p for demand. */
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

/** log1p(x)/log1p(max) → 0–100 so leaders don't crush the mid pack linearly. */
export function normalizeScoresLog1p(raw: Record<string, number>): Record<string, number> {
  const vals = Object.values(raw);
  if (!vals.length) return {};
  const max = Math.max(...vals);
  if (!(max > 0)) {
    return Object.fromEntries(Object.keys(raw).map((id) => [id, 0]));
  }
  const denom = Math.log1p(max);
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(raw)) {
    const n = Math.max(0, Number(v) || 0);
    out[id] = Math.round((Math.log1p(n) / denom) * 1000) / 10;
  }
  return out;
}

export type TopBlendParts = {
  demand: number;
  channel: number;
  collab: number;
  reach: number;
  response: number;
  profile: number;
};

export function blendTopScore(
  demandOrParts: number | TopBlendParts,
  channelScore?: number,
  reachScore?: number,
  reviewScore: number = 12,
  badgeOrProfileScore: number = 50,
  responseScore: number = 50
): number {
  let parts: TopBlendParts;
  if (typeof demandOrParts === 'object' && demandOrParts != null) {
    parts = demandOrParts;
  } else {
    // Legacy positional: (activity, channel, reach, review, badge)
    // Map review→collab, badge→profile; response defaults to neutral 50.
    parts = {
      demand: Number(demandOrParts) || 0,
      channel: Number(channelScore) || 0,
      reach: Number(reachScore) || 0,
      collab: Number(reviewScore) || 0,
      profile: Number(badgeOrProfileScore) || 0,
      response: Number(responseScore) || 50,
    };
  }

  return (
    Math.round(
      (clamp01(parts.demand / 100) * TOP_DEMAND_WEIGHT +
        clamp01(parts.channel / 100) * TOP_CHANNEL_WEIGHT +
        clamp01(parts.collab / 100) * TOP_COLLAB_WEIGHT +
        clamp01(parts.reach / 100) * TOP_REACH_WEIGHT +
        clamp01(parts.response / 100) * TOP_RESPONSE_WEIGHT +
        clamp01(parts.profile / 100) * TOP_PROFILE_WEIGHT) *
        1000
    ) / 10
  );
}

/** Heavy demotion multiplier for Top 10 when trust signals fail (not a hard exclude). */
export const TOP_TRUST_PENALTY_MULT = 0.35;

/**
 * True when the creator's main IG/TikTok/YouTube account has a clearly inflated
 * rate or a large measured quality cut. Estimates, short samples, unmeasured
 * notes, secondary accounts, and private profiles do not take this penalty.
 */
export function hasTopTrustIssue(inf: TopScoreInfluencer): boolean {
  return creatorHasHardErOnMainAccount(socialAccounts(inf.accounts));
}

/** Apply Top 10 trust demotion to a composite score (0–100 scale). */
export function applyTopTrustPenalty(composite: number, inf: TopScoreInfluencer): number {
  if (!hasTopTrustIssue(inf)) return composite;
  return Math.round(Math.max(0, composite * TOP_TRUST_PENALTY_MULT) * 10) / 10;
}

/** Apply mild rotation demotion for recent Top 10 incumbents. */
export function applyIncumbentPenalty(composite: number, isIncumbent: boolean): number {
  if (!isIncumbent) return composite;
  return Math.round(Math.max(0, composite * TOP_INCUMBENT_PENALTY_MULT) * 10) / 10;
}

/**
 * 15-day growth % from snapshot rows (same idea as /api/influencer/[id]/growth).
 */
export function growthPctFromSnapshots(
  currentTotal: number,
  snapshots: Array<{ total: number; at: number }>,
  now = Date.now()
): number | null {
  if (!(currentTotal > 0) || !snapshots.length) return null;
  const windowMs = FOLLOWER_GROWTH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const minFallbackAgeMs = 7 * 24 * 60 * 60 * 1000;
  const baselineWindow = snapshots.find((s) => now - s.at >= windowMs);
  const fallback = [...snapshots].reverse().find((s) => now - s.at >= minFallbackAgeMs);
  const baseline = baselineWindow || fallback;
  if (!baseline || !(baseline.total > 0)) return null;
  const growth = currentTotal - baseline.total;
  return Math.round((growth / baseline.total) * 1000) / 10;
}
