/**
 * Flag unreliable / suspicious engagement for profiles, the directory, and ranking.
 *
 * Hard flags (Ύποπτο ER) are only a clearly inflated rate or a large measured
 * quality cut. They are the only ER signals that block Brand Safe or apply the
 * heavy Top 10 penalty, and only when they sit on the creator's main account
 * (the Instagram, TikTok, or YouTube account with the most followers).
 *
 * Soft flags stay visible but are not Ύποπτο and stay eligible for Brand Safe
 * and Top 10:
 * - estimated → Εκτίμηση (hidden likes or an ER that starts with ~)
 * - low_sample → Λίγα δεδομένα (1–4 posts)
 * - quality_note → Σημείωση ER (Auditpr penalty with no measured size)
 *
 * Instagram ceilings scale with audience size. 10–20% on an account under
 * about 5,000 followers is not suspicious. A hard ceiling remains for extreme rates.
 *
 * | Followers              | Hard ceiling | 5–11 posts |
 * |------------------------|--------------|------------|
 * | under 5,000 or unknown | 50%          | 40%        |
 * | 5,000–19,999           | 35%          | 25%        |
 * | 20,000–99,999          | 25%          | 18%        |
 * | 100,000+               | 15%          | 10%        |
 *
 * TikTok and YouTube keep their own view-based and follower-based ceilings.
 * Those apply only when platform (and views, when present) are passed in.
 * Stored er_suspicious is never an input: a fresh computation wins.
 */

import { parseFollowerString } from './parseFollowers';

export type ErFlagReason =
  | 'quality_adjusted' // large measured quality cut
  | 'estimated' // likes hidden / approximate ER
  | 'low_sample' // too few posts to trust the %
  | 'inflated' // unrealistically high ER
  | 'quality_note'; // penalty noted, size not measured

export type ErFlag = {
  /** True only for inflated and large measured quality cuts. */
  suspicious: boolean;
  reason: ErFlagReason;
  labelEl: string;
  labelEn: string;
  hintEl: string;
  hintEn: string;
};

const LABELS: Record<ErFlagReason, Omit<ErFlag, 'suspicious' | 'reason'>> = {
  quality_adjusted: {
    labelEl: 'Ύποπτο ER',
    labelEn: 'Suspicious ER',
    hintEl: 'Το engagement έπεσε αισθητά μετά από μέτρηση ποιότητας κοινού — πιθανόν ανενεργοί ή fake followers.',
    hintEn: 'Engagement dropped sharply after an audience-quality adjustment — possible inactive or fake followers.',
  },
  estimated: {
    labelEl: 'Εκτίμηση',
    labelEn: 'Estimate',
    hintEl: 'Τα likes είναι κρυφά· το ER είναι εκτίμηση, όχι ακριβής μέτρηση.',
    hintEn: 'Likes are hidden; this ER is an estimate, not an exact measurement.',
  },
  low_sample: {
    labelEl: 'Λίγα δεδομένα',
    labelEn: 'Few posts',
    hintEl: 'Λιγότερα από 5 posts στο δείγμα — το ποσοστό μπορεί να μην είναι αντιπροσωπευτικό. Δεν σημαίνει ψεύτικο engagement.',
    hintEn: 'Fewer than 5 posts in the sample — the rate may not be representative. This is not treated as fake engagement.',
  },
  inflated: {
    labelEl: 'Ύποπτο ER',
    labelEn: 'Suspicious ER',
    hintEl: 'Το ποσοστό αλληλεπίδρασης είναι πάνω από το όριο για αυτό το μέγεθος κοινού.',
    hintEn: 'Engagement is above the ceiling for this audience size.',
  },
  quality_note: {
    labelEl: 'Σημείωση ER',
    labelEn: 'ER note',
    hintEl: 'Υπάρχει σημείωση ποιότητας κοινού χωρίς μετρήσιμο μέγεθος. Δεν θεωρείται ύποπτο.',
    hintEn: 'An audience-quality note is present without a measured size. This is not treated as suspicious.',
  },
};

/** Absolute drop (percentage points) that is always a large quality cut. */
export const LARGE_ER_DROP_POINTS = 8;
/** Smaller drop that still counts when it is also a large share of the raw rate. */
export const LARGE_ER_DROP_MIN_POINTS = 3;
export const LARGE_ER_DROP_RELATIVE = 0.4;
/** Auditpr percent fields at or above this are a measured quality cut. */
export const LARGE_PENALTY_PERCENT = 25;

export const PENALTY_PERCENT_FIELDS = [
  'fake_follower_percent',
  'suspected_fake_percent',
  'fake_followers_percent',
  'quality_penalty_percent',
  'er_penalty_percent',
  'penalty_percent',
] as const;

export type PenaltyPercentField = (typeof PENALTY_PERCENT_FIELDS)[number];

export type ErCheckInput = {
  platform?: string | null;
  username?: string | null;
  followers?: string | number | null;
  engagement_rate?: string | number | null;
  engagement_rate_raw?: string | number | null;
  posts_count?: number | string | null;
  avg_likes?: string | number | null;
  avg_views?: string | number | null;
  suspected_fake_penalty?: boolean | null;
  engagement_hidden?: boolean | null;
  er_flag_reason?: string | null;
  /** Ignored. A stored true must not override a fresh computation. */
  er_suspicious?: boolean | null;
  is_private?: boolean | null;
  fake_follower_percent?: number | string | null;
  suspected_fake_percent?: number | string | null;
  fake_followers_percent?: number | string | null;
  quality_penalty_percent?: number | string | null;
  er_penalty_percent?: number | string | null;
  penalty_percent?: number | string | null;
};

const HARD_REASONS = new Set<ErFlagReason>(['inflated', 'quality_adjusted']);

const CHIP_SEVERITY: Record<ErFlagReason, number> = {
  inflated: 40,
  quality_adjusted: 40,
  low_sample: 30,
  quality_note: 20,
  estimated: 10,
};

export function parseErPercent(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).replace(/~/g, '').replace(/%/g, '').replace(',', '.').trim();
  if (!s || s.toUpperCase() === 'N/A' || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function readPenaltyPercents(
  source: object | null | undefined
): Partial<Record<PenaltyPercentField, number>> {
  const src = (source || {}) as Record<string, unknown>;
  const out: Partial<Record<PenaltyPercentField, number>> = {};
  for (const key of PENALTY_PERCENT_FIELDS) {
    const n = parseErPercent(src[key] as string | number | null | undefined);
    if (n != null) out[key] = n;
  }
  return out;
}

/** Optional Auditpr fields. Missing fields are omitted so older cron payloads stay valid. */
export function copyAuditprErExtras(source: object | null | undefined): {
  suspected_fake_penalty?: true;
  engagement_hidden?: true;
  engagement_rate_raw?: string;
} & Partial<Record<PenaltyPercentField, number>> {
  const src = (source || {}) as Record<string, unknown>;
  const out: {
    suspected_fake_penalty?: true;
    engagement_hidden?: true;
    engagement_rate_raw?: string;
  } & Partial<Record<PenaltyPercentField, number>> = {
    ...readPenaltyPercents(src),
  };
  if (src.suspected_fake_penalty === true) out.suspected_fake_penalty = true;
  if (src.engagement_hidden === true) out.engagement_hidden = true;
  if (typeof src.engagement_rate_raw === 'string' && src.engagement_rate_raw.trim()) {
    out.engagement_rate_raw = src.engagement_rate_raw.trim();
  } else if (typeof src.engagement_rate_raw === 'number' && Number.isFinite(src.engagement_rate_raw)) {
    out.engagement_rate_raw = String(src.engagement_rate_raw);
  }
  return out;
}

/**
 * Instagram ceilings by follower count.
 * Unknown or zero followers use the small-account tier so a missing size is not suspicious.
 */
export function instagramErCeilings(followers: number): { hard: number; shortSample: number } {
  const n = Number.isFinite(followers) && followers > 0 ? followers : 0;
  if (n < 5_000) return { hard: 50, shortSample: 40 };
  if (n < 20_000) return { hard: 35, shortSample: 25 };
  if (n < 100_000) return { hard: 25, shortSample: 18 };
  return { hard: 15, shortSample: 10 };
}

export function isLargeQualityCut(input: ErCheckInput): boolean {
  const raw = parseErPercent(input.engagement_rate_raw);
  const adjusted = parseErPercent(input.engagement_rate);
  if (raw != null && adjusted != null && raw > adjusted) {
    const drop = raw - adjusted;
    if (drop >= LARGE_ER_DROP_POINTS) return true;
    if (drop >= LARGE_ER_DROP_MIN_POINTS && raw > 0 && drop / raw >= LARGE_ER_DROP_RELATIVE) return true;
  }
  for (const key of PENALTY_PERCENT_FIELDS) {
    const n = parseErPercent(input[key]);
    if (n != null && n >= LARGE_PENALTY_PERCENT) return true;
  }
  return false;
}

function flag(reason: ErFlagReason): ErFlag {
  return {
    suspicious: HARD_REASONS.has(reason),
    reason,
    ...LABELS[reason],
  };
}

/**
 * Fresh ER classification. Does not read er_suspicious.
 * Pass platform, followers, and avg_views or TikTok/YouTube fall through to Instagram ceilings.
 */
export function detectErFlag(input: ErCheckInput): ErFlag | null {
  const erStr = String(input.engagement_rate ?? '').trim();
  if (!erStr || erStr.toUpperCase() === 'N/A' || erStr === '-') return null;

  const posts = parseFollowerString(input.posts_count);
  const er = parseErPercent(erStr);

  if (isLargeQualityCut(input)) return flag('quality_adjusted');

  if (input.engagement_hidden || erStr.startsWith('~')) return flag('estimated');

  if (posts > 0 && posts < 5) return flag('low_sample');

  if (er == null) {
    if (input.suspected_fake_penalty) return flag('quality_note');
    return null;
  }

  const platform = String(input.platform || '').toLowerCase();
  const views = parseFollowerString(input.avg_views);
  const likes = parseFollowerString(input.avg_likes);
  const followers = parseFollowerString(input.followers);
  const shortBand = posts >= 5 && posts < 12;

  if (platform === 'tiktok' || platform === 'youtube') {
    const looksViewsBased = views > 0 && likes > 0 && likes <= views * 1.25 && er < 40;
    if (looksViewsBased) {
      if (er >= 18) return flag('inflated');
      if (er >= 12 && shortBand) return flag('inflated');
      if (input.suspected_fake_penalty) return flag('quality_note');
      return null;
    }
    if (er >= 80) return flag('inflated');
    if (er >= 40 && shortBand) return flag('inflated');
    if (input.suspected_fake_penalty) return flag('quality_note');
    return null;
  }

  const ceilings = instagramErCeilings(followers);
  if (er >= ceilings.hard) return flag('inflated');
  if (shortBand && er >= ceilings.shortSample) return flag('inflated');
  if (input.suspected_fake_penalty) return flag('quality_note');
  return null;
}

/**
 * What the UI should show. Stored er_suspicious is ignored.
 * A stored quality reason without a measured drop becomes a soft note.
 * A stored "estimated" reason keeps the Εκτίμηση label when the tilde was not saved.
 */
export function displayErFlag(account: ErCheckInput | null | undefined): ErFlag | null {
  if (!account) return null;
  const rate = String(account.engagement_rate ?? '');
  const reason = String(account.er_flag_reason || '');
  return detectErFlag({
    engagement_rate: account.engagement_rate,
    engagement_rate_raw: account.engagement_rate_raw,
    posts_count: account.posts_count,
    avg_likes: account.avg_likes,
    avg_views: account.avg_views,
    followers: account.followers,
    platform: account.platform,
    engagement_hidden:
      account.engagement_hidden === true || reason === 'estimated' || rate.trim().startsWith('~'),
    suspected_fake_penalty:
      account.suspected_fake_penalty === true ||
      reason === 'quality_adjusted' ||
      reason === 'quality_note',
    ...readPenaltyPercents(account),
  });
}

export function isHardErFlag(flag: ErFlag | null | undefined): boolean {
  return !!flag && flag.suspicious === true && HARD_REASONS.has(flag.reason);
}

const SOCIAL_PLATFORMS = new Set(['instagram', 'tiktok', 'youtube']);

/** IG/TikTok/YouTube account with a username and the most followers. */
export function mainSocialAccount<T extends ErCheckInput>(accounts: T[] | null | undefined): T | null {
  if (!Array.isArray(accounts)) return null;
  let best: T | null = null;
  let bestFollowers = -1;
  for (const acc of accounts) {
    if (!acc) continue;
    const platform = String(acc.platform || '').toLowerCase();
    const username = String(acc.username || '').replace(/^@+/, '').trim();
    if (!username || !SOCIAL_PLATFORMS.has(platform)) continue;
    const followers = parseFollowerString(acc.followers);
    if (!best || followers > bestFollowers) {
      best = acc;
      bestFollowers = followers;
    }
  }
  return best;
}

export function creatorHasHardErOnMainAccount(accounts: ErCheckInput[] | null | undefined): boolean {
  const main = mainSocialAccount(accounts);
  if (!main) return false;
  return isHardErFlag(displayErFlag(main));
}

/** Highest-severity fresh flag across accounts. Hard flags outrank soft notes. */
export function pickDisplayErFlag(accounts: ErCheckInput[] | null | undefined): ErFlag | null {
  if (!Array.isArray(accounts)) return null;
  let best: ErFlag | null = null;
  let bestScore = -1;
  for (const acc of accounts) {
    const next = displayErFlag(acc);
    if (!next) continue;
    const score = CHIP_SEVERITY[next.reason] ?? 0;
    if (score > bestScore) {
      best = next;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Attach a fresh flag onto metrics about to be saved.
 * Soft flags set er_flag_reason and leave er_suspicious false.
 * Does not read a previous er_flag_reason, so a stale label cannot stick.
 */
export function applyErFlags<T extends ErCheckInput>(
  metrics: T,
  platform?: string | null
): T & { er_suspicious: boolean; er_flag_reason?: ErFlagReason } {
  const flag = detectErFlag({
    engagement_rate: metrics.engagement_rate,
    engagement_rate_raw: metrics.engagement_rate_raw,
    posts_count: metrics.posts_count,
    avg_likes: metrics.avg_likes,
    avg_views: metrics.avg_views,
    followers: metrics.followers,
    platform: platform ?? metrics.platform,
    suspected_fake_penalty: metrics.suspected_fake_penalty === true,
    engagement_hidden:
      metrics.engagement_hidden === true || String(metrics.engagement_rate ?? '').trim().startsWith('~'),
    ...readPenaltyPercents(metrics),
  });
  return {
    ...metrics,
    er_suspicious: flag?.suspicious === true,
    er_flag_reason: flag?.reason,
  };
}

/** Rewrite stored flag fields from a fresh computation. Other account keys are kept. */
export function recomputeStoredAccount<T extends ErCheckInput>(
  account: T
): T & { er_suspicious: boolean; er_flag_reason: ErFlagReason | null } {
  const flag = displayErFlag(account);
  return {
    ...account,
    er_suspicious: flag?.suspicious === true,
    er_flag_reason: flag?.reason ?? null,
  };
}

export function erFlagFromReason(reason: ErFlagReason): ErFlag {
  return flag(reason);
}

export function erFlagLabel(flag: ErFlag, lang: 'el' | 'en'): string {
  return lang === 'el' ? flag.labelEl : flag.labelEn;
}

export function erFlagHint(flag: ErFlag, lang: 'el' | 'en'): string {
  return lang === 'el' ? flag.hintEl : flag.hintEn;
}
