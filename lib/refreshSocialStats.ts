/**
 * Shared logic for refreshing social stats (followers, engagement_rate, avg_likes).
 * Used by GET /api/cron/refresh-social-stats and POST /api/admin/refresh-social-stats.
 * Gemini audit runs only when we actually refresh at least one IG/TikTok account (not on every page load).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  fetchInstagramFromAuditpr,
  fetchTiktokFromAuditpr,
  fetchYouTubeFromAuditpr,
  isPrivateProfileError,
  isUsableSocialMetrics,
  type SocialMetrics,
} from '@/lib/socialRefresh';
import { applyErFlags, type ErFlagReason, type PenaltyPercentField } from '@/lib/engagementFlags';
import {
  AUDIT_FALLBACK_MESSAGE,
  computeAuditFingerprint,
  isAuditFallbackResult,
  runAuditGemini,
} from '@/lib/auditGemini';
import { totalFollowersFromAccounts, totalPostsFromAccounts } from '@/lib/parseFollowers';

type AccountRow = {
  platform: string;
  username: string;
  followers?: string;
  engagement_rate?: string;
  avg_likes?: string;
  posts_count?: number;
  avg_views?: number | null;
  er_suspicious?: boolean;
  er_flag_reason?: ErFlagReason | string | null;
  is_private?: boolean;
  engagement_hidden?: boolean;
  suspected_fake_penalty?: boolean;
  engagement_rate_raw?: string | null;
  fake_follower_percent?: number | null;
  suspected_fake_percent?: number | null;
  fake_followers_percent?: number | null;
  quality_penalty_percent?: number | null;
  er_penalty_percent?: number | null;
  penalty_percent?: number | null;
};

function isSocialMetrics(x: SocialMetrics | { error: string }): x is SocialMetrics {
  return isUsableSocialMetrics(x);
}

function withErFlags(metrics: SocialMetrics, platform?: string | null): SocialMetrics {
  return applyErFlags(metrics, platform ?? undefined);
}

const PENALTY_FIELDS: PenaltyPercentField[] = [
  'fake_follower_percent',
  'suspected_fake_percent',
  'fake_followers_percent',
  'quality_penalty_percent',
  'er_penalty_percent',
  'penalty_percent',
];

export type RefreshResult = {
  message: string;
  refreshed: number;
  results: { id: string; name: string; accounts: number; errors: string[] }[];
};

/** Metrics supplied by Auditpro. Extra ER fields are optional so older payloads still apply. */
export type SocialMetricOverride = {
  followers: string;
  engagement_rate: string;
  avg_likes: string;
  posts_count?: number;
  avg_views?: number | null;
  suspected_fake_penalty?: boolean;
  engagement_hidden?: boolean;
  engagement_rate_raw?: string;
  fake_follower_percent?: number;
  suspected_fake_percent?: number;
  fake_followers_percent?: number;
  quality_penalty_percent?: number;
  er_penalty_percent?: number;
  penalty_percent?: number;
};
/** Instagram metrics keyed by username (without @). Used when frontend fetches from local Auditpr. */
export type InstagramOverrides = Record<string, SocialMetricOverride>;
/** TikTok metrics keyed by username (without @). Used when frontend fetches from local Auditpr. */
export type TikTokOverrides = Record<string, SocialMetricOverride>;
/** YouTube metrics keyed by username (without @). Used when frontend fetches from local Auditpr. */
export type YouTubeOverrides = Record<string, SocialMetricOverride>;

export async function doRefreshSocialStats(
  supabaseAdmin: SupabaseClient,
  options: {
    influencerId?: string | null;
    auditprBaseUrl: string;
    /** When set, use these for Instagram instead of calling Auditpr from server (browser fetched from local). */
    instagramOverrides?: InstagramOverrides;
    /** When set, use these for TikTok instead of calling Auditpr from server (browser fetched from local Auditpr). */
    tiktokOverrides?: TikTokOverrides;
    /** When set, use these for YouTube instead of calling Auditpr from server (browser fetched from local). */
    youtubeOverrides?: YouTubeOverrides;
    /** Only apply provided overrides; do not call Auditpr for missing platforms. */
    overridesOnly?: boolean;
  }
): Promise<RefreshResult> {
  const { influencerId, auditprBaseUrl, instagramOverrides, tiktokOverrides, youtubeOverrides, overridesOnly } = options;

  let query = supabaseAdmin
    .from('influencers')
    .select('id, display_name, gender, accounts, bio, category, location, audience_male_percent, audience_female_percent, auditpr_audit');

  if (influencerId) {
    query = query.eq('id', influencerId);
  } else {
    const dueDaysAgo = new Date();
    dueDaysAgo.setDate(dueDaysAgo.getDate() - 15);
    query = query.or(
      `last_social_refresh_at.is.null,last_social_refresh_at.lt.${dueDaysAgo.toISOString()}`
    );
  }

  const { data: influencers, error: fetchError } = await query;

  if (fetchError) {
    throw new Error(`Failed to fetch influencers: ${fetchError.message}`);
  }
  if (!influencers?.length) {
    return {
      message: influencerId ? 'Influencer not found' : 'No influencers due for refresh',
      refreshed: 0,
      results: [],
    };
  }

  const results: { id: string; name: string; accounts: number; errors: string[] }[] = [];

  /** Audit result: only updated when we refresh followers/engagement/avg_likes (not on every page load). */
  type AuditprAudit = {
    scoreBreakdown: string[];
    scoreBreakdown_en?: string[];
    whyWorkWithThem?: string;
    whyWorkWithThem_en?: string;
    positives?: string[];
    positives_en?: string[];
    negatives?: string[];
    negatives_en?: string[];
    brandSafe: boolean;
    niche?: string;
    niche_en?: string;
    input_fingerprint?: string;
  };

  for (const inf of influencers) {
    const accounts = (inf.accounts as AccountRow[] | null) || [];
    const errors: string[] = [];
    let updatedAccounts = [...accounts];
    let anySuccess = false;
    /** First IG/TT account we successfully refreshed via Auditpr (server-side). Used to call /audit once per influencer. */
    let firstRefreshedForAudit: { platform: string; username: string } | null = null;

    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      const platform = (acc?.platform || '').trim();
      const username = (acc?.username || '').trim();
      if (!platform || !username) continue;

      const platformLower = platform.toLowerCase();
      let metrics: SocialMetrics | { error: string };
      let fetchedViaAuditpr = false;

      // Instagram: μόνο Auditpr ή overrides. Ποτέ Apify (αποφυγή ασκόπων εξόδων).
      if (platformLower === 'instagram') {
        const uKey = username.replace(/^@+/, '').trim();
        if (instagramOverrides?.[uKey]) {
          metrics = instagramOverrides[uKey];
          fetchedViaAuditpr = true;
        } else if (overridesOnly) {
          continue;
        } else if (!auditprBaseUrl) {
          errors.push(`Instagram @${uKey}: AUDITPR_BASE_URL not set (ή εισάγετε Auditpr URL στο dashboard)`);
          continue;
        } else {
          metrics = await fetchInstagramFromAuditpr(auditprBaseUrl, username);
          fetchedViaAuditpr = true;
        }
      } else if (platformLower === 'tiktok') {
        const uKey = username.replace(/^@+/, '').trim();
        if (tiktokOverrides?.[uKey]) {
          metrics = tiktokOverrides[uKey];
          fetchedViaAuditpr = true;
        } else if (overridesOnly) {
          continue;
        } else if (!auditprBaseUrl) {
          errors.push(`TikTok @${uKey}: AUDITPR_BASE_URL not set (ή εισάγετε Auditpr URL στο dashboard)`);
          continue;
        } else {
          metrics = await fetchTiktokFromAuditpr(auditprBaseUrl, username);
          fetchedViaAuditpr = true;
        }
      } else if (platformLower === 'youtube') {
        // YouTube: μόνο Auditpr (YOUTUBE_API_KEY στο Auditpr .env)
        const uKey = username.replace(/^@+/, '').trim();
        if (youtubeOverrides?.[uKey]) {
          metrics = youtubeOverrides[uKey];
          fetchedViaAuditpr = true;
        } else if (overridesOnly) {
          continue;
        } else if (!auditprBaseUrl) {
          errors.push(`YouTube @${uKey}: AUDITPR_BASE_URL required (ή εισάγετε Auditpr URL στο dashboard)`);
          continue;
        } else {
          metrics = await fetchYouTubeFromAuditpr(auditprBaseUrl, username);
          fetchedViaAuditpr = true;
        }
      } else {
        // Άλλες πλατφόρμες (Facebook, κλπ): skip αν δεν υπάρχει fetch
        continue;
      }

      if (isSocialMetrics(metrics)) {
        anySuccess = true;
        const flagged = withErFlags(metrics, platformLower);
        const penaltyStored: Partial<Record<PenaltyPercentField, number | null>> = {};
        for (const key of PENALTY_FIELDS) {
          penaltyStored[key] = flagged[key] ?? null;
        }
        updatedAccounts[i] = {
          ...acc,
          followers: flagged.followers,
          engagement_rate: flagged.engagement_rate,
          avg_likes: flagged.avg_likes,
          ...(flagged.posts_count != null ? { posts_count: flagged.posts_count } : {}),
          ...(flagged.avg_views != null && flagged.avg_views > 0
            ? { avg_views: flagged.avg_views }
            : { avg_views: null }),
          er_suspicious: flagged.er_suspicious === true,
          er_flag_reason: flagged.er_flag_reason ?? null,
          engagement_hidden: flagged.engagement_hidden === true,
          suspected_fake_penalty: flagged.suspected_fake_penalty === true,
          engagement_rate_raw: flagged.engagement_rate_raw ?? null,
          ...penaltyStored,
          // Keep true when Auditpr reports private even if session can still read posts.
          is_private: flagged.is_private === true,
        };
        if (fetchedViaAuditpr && !firstRefreshedForAudit) {
          firstRefreshedForAudit = { platform: platformLower, username: username.replace(/^@+/, '').trim() };
        }
      } else {
        const uDisplay = username.replace(/^@+/, '').trim();
        const errText = 'error' in metrics ? metrics.error : `Λάθος username: το προφίλ @${uDisplay} δεν υπάρχει.`;
        errors.push(`${platform} @${uDisplay}: ${errText}`);
        if (isPrivateProfileError(errText)) {
          updatedAccounts[i] = {
            ...acc,
            is_private: true,
          };
        }
      }
    }

    if (!anySuccess) {
      const markedPrivate = updatedAccounts.some((a) => a?.is_private === true);
      if (markedPrivate) {
        await supabaseAdmin.from('influencers').update({ accounts: updatedAccounts }).eq('id', inf.id);
      }
      results.push({
        id: String(inf.id),
        name: inf.display_name || String(inf.id),
        accounts: updatedAccounts.filter((a) => a?.username && a?.platform).length,
        errors: errors.length ? errors : ['Λάθος username: δεν βρέθηκαν metrics.'],
      });
      continue;
    }

    let updatePayload: {
      accounts: AccountRow[];
      last_social_refresh_at?: string;
      auditpr_audit?: AuditprAudit;
    } = {
      accounts: updatedAccounts,
      last_social_refresh_at: new Date().toISOString(),
    };

    // Gemini audit: only when we actually refreshed at least one IG/TikTok/YouTube. Multi-platform: pass all IG, TikTok, and YouTube accounts.
    if (firstRefreshedForAudit) {
      try {
        const igTtAccounts = updatedAccounts
          .filter(
            (a) =>
              (a?.platform || '').trim() &&
              (a?.username || '').trim() &&
              ['instagram', 'tiktok', 'youtube'].includes((a.platform || '').toLowerCase())
          )
          .map((a) => ({
            platform: (a.platform || '').trim().toLowerCase(),
            username: (a.username || '').trim().replace(/^@+/, ''),
            followers: a.followers ?? undefined,
            engagement_rate: a.engagement_rate ?? undefined,
            avg_likes: a.avg_likes ?? undefined,
            avg_views: a.avg_views ?? undefined,
            posts_count: a.posts_count ?? undefined,
            engagement_rate_raw: a.engagement_rate_raw ?? undefined,
            engagement_hidden: a.engagement_hidden === true,
            suspected_fake_penalty: a.suspected_fake_penalty === true,
            fake_follower_percent: a.fake_follower_percent ?? undefined,
            suspected_fake_percent: a.suspected_fake_percent ?? undefined,
            fake_followers_percent: a.fake_followers_percent ?? undefined,
            quality_penalty_percent: a.quality_penalty_percent ?? undefined,
            er_penalty_percent: a.er_penalty_percent ?? undefined,
            penalty_percent: a.penalty_percent ?? undefined,
            er_flag_reason: a.er_flag_reason ?? undefined,
          }));
        if (igTtAccounts.length > 0) {
          const shared = {
            biography: (inf as { bio?: string }).bio ?? undefined,
            category_name: (inf as { category?: string }).category ?? undefined,
            display_name: (inf as { display_name?: string }).display_name ?? undefined,
            gender: (inf as { gender?: string }).gender ?? undefined,
            location: (inf as { location?: string }).location ?? undefined,
            audience_male_percent: (inf as { audience_male_percent?: number | null }).audience_male_percent ?? undefined,
            audience_female_percent: (inf as { audience_female_percent?: number | null }).audience_female_percent ?? undefined,
          };
          const fp = computeAuditFingerprint(igTtAccounts, shared);
          const existingAudit = (inf as { auditpr_audit?: AuditprAudit | null }).auditpr_audit;
          const existingBreakdown = existingAudit?.scoreBreakdown;
          const hasUsableAudit =
            Array.isArray(existingBreakdown) &&
            existingBreakdown.length > 0 &&
            !existingBreakdown.some((line) => String(line).includes(AUDIT_FALLBACK_MESSAGE));
          if (hasUsableAudit && existingAudit?.input_fingerprint === fp) {
            console.log('[refreshSocialStats] audit skipped, inputs unchanged', inf.id);
          } else {
            const auditResult = await runAuditGemini(igTtAccounts, shared);
            if (auditResult && Array.isArray(auditResult.scoreBreakdown)) {
              // Fallback must not overwrite a usable existing audit; omit fingerprint only when writing fallback for retry.
              if (isAuditFallbackResult(auditResult) && hasUsableAudit) {
                errors.push('Audit: Gemini fallback, kept existing audit');
              } else {
                const nextAudit: AuditprAudit = {
                  scoreBreakdown: auditResult.scoreBreakdown,
                  scoreBreakdown_en: auditResult.scoreBreakdown_en,
                  whyWorkWithThem: auditResult.whyWorkWithThem,
                  whyWorkWithThem_en: auditResult.whyWorkWithThem_en,
                  positives: auditResult.positives,
                  positives_en: auditResult.positives_en,
                  negatives: auditResult.negatives,
                  negatives_en: auditResult.negatives_en,
                  brandSafe: auditResult.brandSafe,
                  niche: auditResult.niche,
                  niche_en: auditResult.niche_en,
                };
                if (!isAuditFallbackResult(auditResult)) {
                  nextAudit.input_fingerprint = fp;
                }
                updatePayload.auditpr_audit = nextAudit;
              }
            }
          }
        }
      } catch (auditErr) {
        errors.push(`Audit: ${auditErr instanceof Error ? auditErr.message : 'Failed'}`);
      }
    }

    let updateError = (await supabaseAdmin.from('influencers').update(updatePayload).eq('id', inf.id)).error;
    if (updateError && /column|last_social_refresh_at/i.test(updateError.message)) {
      delete updatePayload.last_social_refresh_at;
      updateError = (await supabaseAdmin.from('influencers').update(updatePayload).eq('id', inf.id)).error;
    }
    if (updateError && /column|auditpr_audit/i.test(updateError.message)) {
      delete updatePayload.auditpr_audit;
      updateError = (await supabaseAdmin.from('influencers').update(updatePayload).eq('id', inf.id)).error;
    }
    if (updateError) {
      errors.push(`DB update: ${updateError.message}`);
    } else {
      const total = totalFollowersFromAccounts(updatePayload.accounts);
      const totalPosts = totalPostsFromAccounts(updatePayload.accounts);
      if (total > 0) {
        const snapshotAt = new Date().toISOString();
        const snapFull = {
          influencer_id: inf.id,
          snapshot_at: snapshotAt,
          total_followers: total,
          total_posts: totalPosts > 0 ? totalPosts : null,
        };
        const { error: snapErr } = await supabaseAdmin.from('influencer_follower_snapshots').insert(snapFull);
        if (snapErr && /column|total_posts/i.test(snapErr.message)) {
          const { error: snapRetry } = await supabaseAdmin.from('influencer_follower_snapshots').insert({
            influencer_id: inf.id,
            snapshot_at: snapshotAt,
            total_followers: total,
          });
          if (snapRetry && !/relation|table|does not exist/i.test(snapRetry.message)) {
            errors.push(`Snapshot: ${snapRetry.message}`);
          }
        } else if (snapErr && !/relation|table|does not exist/i.test(snapErr.message)) {
          errors.push(`Snapshot: ${snapErr.message}`);
        }
      }
    }

    results.push({
      id: String(inf.id),
      name: inf.display_name || String(inf.id),
      accounts: updatedAccounts.filter((a) => a?.username && a?.platform).length,
      errors,
    });
  }

  return {
    message: 'Refresh completed',
    refreshed: results.length,
    results,
  };
}
