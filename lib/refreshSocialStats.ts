/**
 * Shared logic for refreshing social stats (followers, engagement_rate, avg_likes).
 * Used by GET /api/cron/refresh-social-stats and POST /api/admin/refresh-social-stats.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  fetchInstagramFromAuditpr,
  fetchTiktokFromAuditpr,
  fetchTiktokFromApify,
  type SocialMetrics,
} from '@/lib/socialRefresh';

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
  }
): Promise<RefreshResult> {
  const { influencerId, auditprBaseUrl, apifyToken, instagramOverrides, tiktokOverrides } = options;

  let query = supabaseAdmin
    .from('influencers')
    .select('id, display_name, accounts');

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

  for (const inf of influencers) {
    const accounts = (inf.accounts as AccountRow[] | null) || [];
    const errors: string[] = [];
    let updatedAccounts = [...accounts];

    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      const platform = (acc?.platform || '').trim();
      const username = (acc?.username || '').trim();
      if (!platform || !username) continue;

      const platformLower = platform.toLowerCase();
      let metrics: SocialMetrics | { error: string };

      // Instagram: Auditpr or browser overrides. No Apify.
      if (platformLower === 'instagram') {
        const uKey = username.replace(/^@/, '').trim();
        if (instagramOverrides?.[uKey]) {
          metrics = instagramOverrides[uKey];
        } else         if (!auditprBaseUrl) {
          errors.push(`Instagram @${uKey}: AUDITPR_BASE_URL not set (ή εισάγετε Auditpr URL στο dashboard)`);
          continue;
        } else {
          metrics = await fetchInstagramFromAuditpr(auditprBaseUrl, username);
        }
      } else if (platformLower === 'tiktok') {
        const uKey = username.replace(/^@+/, '').trim();
        if (tiktokOverrides?.[uKey]) {
          metrics = tiktokOverrides[uKey];
        } else if (auditprBaseUrl) {
          metrics = await fetchTiktokFromAuditpr(auditprBaseUrl, username);
        } else if (apifyToken) {
          metrics = await fetchTiktokFromApify(apifyToken, username);
        } else {
          errors.push(`TikTok @${uKey}: AUDITPR_BASE_URL or APIFY_API_TOKEN required (ή εισάγετε Auditpr URL στο dashboard)`);
          continue;
        }
      } else {
        // Άλλες πλατφόρμες (YouTube, κλπ): skip, χωρίς API κλήση
        continue;
      }

      if (isSocialMetrics(metrics)) {
        updatedAccounts[i] = {
          ...acc,
          followers: metrics.followers,
          engagement_rate: metrics.engagement_rate,
          avg_likes: metrics.avg_likes,
        };
      } else {
        const uDisplay = username.replace(/^@+/, '').trim();
        errors.push(`${platform} @${uDisplay}: ${metrics.error}`);
      }
    }

    let updatePayload: { accounts: AccountRow[]; last_social_refresh_at?: string } = {
      accounts: updatedAccounts,
      last_social_refresh_at: new Date().toISOString(),
    };

    let updateError = (await supabaseAdmin.from('influencers').update(updatePayload).eq('id', inf.id)).error;
    if (updateError && /column|last_social_refresh_at/i.test(updateError.message)) {
      delete updatePayload.last_social_refresh_at;
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
