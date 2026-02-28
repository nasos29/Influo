/**
 * Shared logic for refreshing social stats (followers, engagement_rate, avg_likes).
 * Used by GET /api/cron/refresh-social-stats and POST /api/admin/refresh-social-stats.
 * Gemini audit runs only when we actually refresh at least one IG/TikTok account (not on every page load).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  fetchInstagramFromAuditpr,
  fetchTiktokFromAuditpr,
  fetchTiktokFromApify,
  fetchYouTubeFromAuditpr,
  type SocialMetrics,
} from '@/lib/socialRefresh';
import { runAuditGemini } from '@/lib/auditGemini';

type AccountRow = {
  platform: string;
  username: string;
  followers?: string;
  engagement_rate?: string;
  avg_likes?: string;
};

function isSocialMetrics(x: SocialMetrics | { error: string }): x is SocialMetrics {
  return 'followers' in x && !('error' in x);
}

export type RefreshResult = {
  message: string;
  refreshed: number;
  results: { id: string; name: string; accounts: number; errors: string[] }[];
};

/** Instagram metrics keyed by username (without @). Used when frontend fetches from local Auditpr. */
export type InstagramOverrides = Record<string, { followers: string; engagement_rate: string; avg_likes: string }>;
/** TikTok metrics keyed by username (without @). Used when frontend fetches from local Auditpr. */
export type TikTokOverrides = Record<string, { followers: string; engagement_rate: string; avg_likes: string }>;
/** YouTube metrics keyed by username (without @). Used when frontend fetches from local Auditpr. */
export type YouTubeOverrides = Record<string, { followers: string; engagement_rate: string; avg_likes: string }>;

export async function doRefreshSocialStats(
  supabaseAdmin: SupabaseClient,
  options: {
    influencerId?: string | null;
    auditprBaseUrl: string;
    apifyToken: string;
    /** When set, use these for Instagram instead of calling Auditpr from server (browser fetched from local). */
    instagramOverrides?: InstagramOverrides;
    /** When set, use these for TikTok instead of calling Apify from server (browser fetched from local Auditpr). */
    tiktokOverrides?: TikTokOverrides;
    /** When set, use these for YouTube instead of calling Auditpr from server (browser fetched from local). */
    youtubeOverrides?: YouTubeOverrides;
  }
): Promise<RefreshResult> {
  const { influencerId, auditprBaseUrl, apifyToken, instagramOverrides, tiktokOverrides, youtubeOverrides } = options;

  let query = supabaseAdmin
    .from('influencers')
    .select('id, display_name, gender, accounts, bio, category, location');

  if (influencerId) {
    query = query.eq('id', influencerId);
  } else {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query = query.or(
      `last_social_refresh_at.is.null,last_social_refresh_at.lt.${thirtyDaysAgo.toISOString()}`
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
  };

  for (const inf of influencers) {
    const accounts = (inf.accounts as AccountRow[] | null) || [];
    const errors: string[] = [];
    let updatedAccounts = [...accounts];
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
        const uKey = username.replace(/^@/, '').trim();
        if (instagramOverrides?.[uKey]) {
          metrics = instagramOverrides[uKey];
        } else         if (!auditprBaseUrl) {
          errors.push(`Instagram @${uKey}: AUDITPR_BASE_URL not set (ή εισάγετε Auditpr URL στο dashboard)`);
          continue;
        } else {
          metrics = await fetchInstagramFromAuditpr(auditprBaseUrl, username);
          fetchedViaAuditpr = true;
        }
      } else if (platformLower === 'tiktok') {
        // TikTok: Apify μόνο για TikTok accounts (όχι για Instagram). Η κάρτα ΣΥΝΔΕΣΗ δείχνει ποιο username είναι TikTok/Instagram.
        const uKey = username.replace(/^@+/, '').trim();
        if (tiktokOverrides?.[uKey]) {
          metrics = tiktokOverrides[uKey];
        } else if (auditprBaseUrl) {
          metrics = await fetchTiktokFromAuditpr(auditprBaseUrl, username);
          fetchedViaAuditpr = true;
        } else if (apifyToken) {
          metrics = await fetchTiktokFromApify(apifyToken, username);
        } else {
          errors.push(`TikTok @${uKey}: AUDITPR_BASE_URL or APIFY_API_TOKEN required (ή εισάγετε Auditpr URL στο dashboard)`);
          continue;
        }
      } else if (platformLower === 'youtube') {
        // YouTube: μόνο Auditpr (YOUTUBE_API_KEY στο Auditpr .env)
        const uKey = username.replace(/^@+/, '').trim();
        if (youtubeOverrides?.[uKey]) {
          metrics = youtubeOverrides[uKey];
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
        updatedAccounts[i] = {
          ...acc,
          followers: metrics.followers,
          engagement_rate: metrics.engagement_rate,
          avg_likes: metrics.avg_likes,
        };
        if (fetchedViaAuditpr && !firstRefreshedForAudit) {
          firstRefreshedForAudit = { platform: platformLower, username: username.replace(/^@+/, '').trim() };
        }
      } else {
        const uDisplay = username.replace(/^@+/, '').trim();
        errors.push(`${platform} @${uDisplay}: ${metrics.error}`);
      }
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
          }));
        if (igTtAccounts.length > 0) {
          const shared = {
            biography: (inf as { bio?: string }).bio ?? undefined,
            category_name: (inf as { category?: string }).category ?? undefined,
            display_name: (inf as { display_name?: string }).display_name ?? undefined,
            gender: (inf as { gender?: string }).gender ?? undefined,
            location: (inf as { location?: string }).location ?? undefined,
          };
          const auditResult = await runAuditGemini(igTtAccounts, shared);
          if (auditResult && Array.isArray(auditResult.scoreBreakdown)) {
            updatePayload.auditpr_audit = {
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
