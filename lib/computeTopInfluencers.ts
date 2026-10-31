/**
 * Shared Top 10 ranking used by /api/top-influencers and Top 10 congrats cron.
 */

import { unstable_cache } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPastBrandsByInfluencerIds } from '@/lib/pastBrands';
import {
  alignFollowerSnapshotToCurrent,
  totalFollowersFromAccounts,
} from '@/lib/parseFollowers';
import {
  applyIncumbentPenalty,
  applyTopTrustPenalty,
  blendTopScore,
  computeChannelScore100,
  computeCollabScore,
  computeProfileCompletenessScore,
  computeReachScore,
  computeResponseScore,
  growthPctFromSnapshots,
  isEligibleForTop10,
  normalizeScoresLog1p,
  type TopScoreInfluencer,
} from '@/lib/topInfluencerScore';
import { lowestListedPrice, priceTierFromMinRate } from '@/lib/publicInfluencer';

const DEFAULT_DAYS = 30;
export const TOP_INFLUENCERS_N = 10;
const ACTIVITY_POOL = 40;
const ANALYTICS_PAGE_SIZE = 1000;

/** Demand event weights (profile_view is brand=1 / anon=0.2). */
export const DEMAND_EVENT_WEIGHTS: Record<string, number> = {
  profile_click: 3,
  message_sent: 6,
  proposal_sent: 10,
  profile_view: 1, // brand; anon uses 0.2 in accumulateDemandScores
};

export const ACCEPTED_APPLICATION_WEIGHT = 8;

export type AnalyticsRow = {
  id?: string;
  influencer_id?: string | null;
  event_type?: string | null;
  brand_email?: string | null;
  visitor_id?: string | null;
  ip_hash?: string | null;
  created_at?: string | null;
  metadata?: unknown;
};

export type TopInfluencerRow = {
  id: string;
  display_name: string;
  display_name_en: null;
  avatar_url: string | null;
  accounts: TopScoreInfluencer['accounts'];
  category: string | null;
  profile_slug: string | null;
  location: string | null;
  price_tier: string;
  from_price: number | null;
  verified: boolean;
  analytics_verified: boolean;
  availability_status: string | null;
  clicks: number;
  views: number;
};

function isSocialOutboundProfileClick(e: {
  event_type?: string | null;
  metadata?: unknown;
}): boolean {
  if (e.event_type !== 'profile_click') return false;
  const m = e.metadata as Record<string, unknown> | null | undefined;
  return !!m && typeof m === 'object' && m.source === 'social_outbound';
}

function isTop10SectionClick(e: { metadata?: unknown }): boolean {
  const m = e.metadata as Record<string, unknown> | null | undefined;
  return !!m && typeof m === 'object' && m.source === 'top10';
}

function idKey(id: string): string {
  return String(id).trim().toLowerCase();
}

function eventDayUtc(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return String(iso).slice(0, 10) || 'unknown';
  return d.toISOString().slice(0, 10);
}

function getAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type AnalyticsSelectMode = 'ip' | 'visitor' | 'basic';

function analyticsSelect(mode: AnalyticsSelectMode): string {
  if (mode === 'ip') {
    return 'id, influencer_id, event_type, brand_email, visitor_id, ip_hash, created_at, metadata';
  }
  if (mode === 'visitor') {
    return 'id, influencer_id, event_type, brand_email, visitor_id, created_at, metadata';
  }
  return 'id, influencer_id, event_type, brand_email, created_at, metadata';
}

/**
 * Load all influencer_analytics rows in the window, paging past PostgREST's
 * default 1000-row cap via .range.
 */
export async function fetchAllAnalyticsEvents(
  sb: SupabaseClient,
  sinceIso: string,
  eventTypes: string[],
  pageSize: number = ANALYTICS_PAGE_SIZE
): Promise<AnalyticsRow[]> {
  let mode: AnalyticsSelectMode = 'ip';
  const all: AnalyticsRow[] = [];
  let from = 0;

  for (;;) {
    const res = await sb
      .from('influencer_analytics')
      .select(analyticsSelect(mode))
      .gte('created_at', sinceIso)
      .in('event_type', eventTypes)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (res.error && mode === 'ip' && /ip_hash|column/i.test(res.error.message)) {
      mode = 'visitor';
      from = 0;
      all.length = 0;
      continue;
    }
    if (res.error && mode === 'visitor' && /visitor_id|column/i.test(res.error.message)) {
      mode = 'basic';
      from = 0;
      all.length = 0;
      continue;
    }
    if (res.error && /metadata|column/i.test(res.error.message) && mode !== 'basic') {
      // Extremely old schema without metadata — retry basic without metadata once.
      const bare = await sb
        .from('influencer_analytics')
        .select('id, influencer_id, event_type, brand_email, created_at')
        .gte('created_at', sinceIso)
        .in('event_type', eventTypes)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);
      if (bare.error) throw new Error(bare.error.message);
      const batchBare = (bare.data || []) as AnalyticsRow[];
      all.push(
        ...batchBare.map((r) => ({
          ...r,
          visitor_id: null,
          ip_hash: null,
          metadata: {},
        }))
      );
      if (batchBare.length < pageSize) break;
      from += pageSize;
      continue;
    }
    if (res.error) throw new Error(res.error.message);

    const batch = ((res.data || []) as AnalyticsRow[]).map((r) => ({
      ...r,
      visitor_id: r.visitor_id ?? null,
      ip_hash: r.ip_hash ?? null,
    }));
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

/**
 * Unique demand scoring:
 * - skip social_outbound + metadata.source === 'top10'
 * - no brand_email/visitor_id/ip_hash → ignore
 * - visitor_id: ≤1 per influencer+event_type in the whole window
 * - ip_hash: ≤1 per influencer+event_type per calendar day
 * - brand_email: ≤1 per influencer+event_type (unique brands)
 * - profile_view: brand weight 1, anon 0.2
 */
export function accumulateDemandScores(events: AnalyticsRow[]): {
  scores: Record<string, number>;
  countedEvents: number;
} {
  const seen = new Set<string>();
  const scores: Record<string, number> = {};
  let countedEvents = 0;

  for (const e of events) {
    if (isSocialOutboundProfileClick(e)) continue;
    if (isTop10SectionClick(e)) continue;

    const id = e.influencer_id != null ? idKey(String(e.influencer_id)) : null;
    if (!id) continue;

    const type = String(e.event_type || '');
    if (!(type in DEMAND_EVENT_WEIGHTS)) continue;

    const brand = (e.brand_email || '').trim().toLowerCase();
    const visitor = (e.visitor_id || '').trim();
    const ip = (e.ip_hash || '').trim();
    if (!brand && !visitor && !ip) continue;

    let uniqKey: string;
    if (brand) {
      uniqKey = `b\t${id}\t${type}\t${brand}`;
    } else if (visitor) {
      uniqKey = `v\t${id}\t${type}\t${visitor}`;
    } else {
      uniqKey = `i\t${id}\t${type}\t${ip}\t${eventDayUtc(e.created_at)}`;
    }
    if (seen.has(uniqKey)) continue;
    seen.add(uniqKey);

    let w: number;
    if (type === 'profile_view') {
      w = brand ? 1 : 0.2;
    } else {
      w = DEMAND_EVENT_WEIGHTS[type] ?? 0;
    }
    if (!(w > 0)) continue;

    scores[id] = (scores[id] ?? 0) + w;
    countedEvents += 1;
  }

  return { scores, countedEvents };
}

/** Merge accepted campaign applications (unique brand per influencer) at weight 8. */
export function mergeAcceptedApplicationDemand(
  scores: Record<string, number>,
  rows: Array<{ influencer_id?: string | null; brand_id?: string | null }>
): Record<string, number> {
  const seen = new Set<string>();
  const out = { ...scores };
  for (const row of rows) {
    const id = row.influencer_id != null ? idKey(String(row.influencer_id)) : null;
    const brand = row.brand_id != null ? idKey(String(row.brand_id)) : null;
    if (!id || !brand) continue;
    const key = `${id}\t${brand}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out[id] = (out[id] ?? 0) + ACCEPTED_APPLICATION_WEIGHT;
  }
  return out;
}

async function loadAcceptedApplicationDemand(
  sb: SupabaseClient,
  sinceIso: string
): Promise<Array<{ influencer_id?: string | null; brand_id?: string | null }>> {
  const { data, error } = await sb
    .from('campaign_applications')
    .select('influencer_id, created_at, brand_campaigns(brand_id)')
    .eq('status', 'accepted')
    .gte('created_at', sinceIso);

  if (error) {
    if (!/relation|table|does not exist|column|schema cache/i.test(error.message)) {
      console.warn('[computeTopInfluencers] accepted apps:', error.message);
    }
    return [];
  }

  const out: Array<{ influencer_id?: string | null; brand_id?: string | null }> = [];
  for (const row of data || []) {
    const nested = (row as { brand_campaigns?: { brand_id?: string } | { brand_id?: string }[] | null })
      .brand_campaigns;
    const brandId = Array.isArray(nested)
      ? nested[0]?.brand_id
      : nested && typeof nested === 'object'
        ? nested.brand_id
        : null;
    out.push({
      influencer_id: (row as { influencer_id?: string }).influencer_id,
      brand_id: brandId ?? null,
    });
  }
  return out;
}

async function loadCompletedCampaignCounts(
  sb: SupabaseClient,
  ids: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (!ids.length) return counts;

  const { data, error } = await sb
    .from('campaign_applications')
    .select('influencer_id, status')
    .in('influencer_id', ids)
    .in('status', ['accepted', 'completed']);

  if (error) {
    if (!/relation|table|does not exist|column|schema cache/i.test(error.message)) {
      console.warn('[computeTopInfluencers] completed apps:', error.message);
    }
    return counts;
  }

  for (const row of data || []) {
    const id = idKey(String(row.influencer_id));
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

async function loadIncumbentIds(sb: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await sb
    .from('top_influencers_snapshot')
    .select('influencer_ids')
    .eq('id', 'global')
    .maybeSingle();

  if (error) {
    // Table missing → no mild rotation (would need a new history table for full 4-week).
    if (!/relation|table|does not exist|schema cache/i.test(error.message)) {
      console.warn('[computeTopInfluencers] snapshot:', error.message);
    }
    return new Set();
  }
  if (!data) return new Set();
  const ids = Array.isArray(data.influencer_ids) ? data.influencer_ids : [];
  return new Set(ids.map((id: unknown) => idKey(String(id))));
}

async function loadSnapshotsByInfluencer(
  sb: SupabaseClient,
  ids: string[]
): Promise<Record<string, Array<{ total: number; at: number }>>> {
  const byId: Record<string, Array<{ total: number; at: number }>> = {};
  if (!ids.length) return byId;

  const { data, error } = await sb
    .from('influencer_follower_snapshots')
    .select('influencer_id, total_followers, snapshot_at')
    .in('influencer_id', ids)
    .order('snapshot_at', { ascending: false })
    .limit(Math.max(90, ids.length * 20));

  if (error) {
    if (!/relation|table|does not exist/i.test(error.message)) {
      console.warn('[computeTopInfluencers] snapshots:', error.message);
    }
    return byId;
  }

  for (const row of data || []) {
    const id = idKey(String(row.influencer_id));
    const at = new Date(row.snapshot_at as string).getTime();
    const raw = Number(row.total_followers);
    if (!Number.isFinite(at) || !(raw > 0)) continue;
    if (!byId[id]) byId[id] = [];
    byId[id].push({ total: raw, at });
  }
  return byId;
}

type ComputeTopOptions = { limit?: number; days?: number; supabase?: SupabaseClient };

function withBrandSafeOnly(rows: Record<string, unknown>[] | null): TopScoreInfluencer[] {
  return (rows || []).map((row) => {
    const brandSafe =
      row.brandSafe === true ||
      row.brandSafe === false
        ? row.brandSafe
        : (row.auditpr_audit as { brandSafe?: boolean } | null | undefined)?.brandSafe ?? null;
    const rest = { ...row };
    delete rest.brandSafe;
    return {
      ...rest,
      auditpr_audit: { brandSafe },
    } as TopScoreInfluencer;
  });
}

/** Rank approved influencers and return the top N for homepage / notifications. */
async function computeTopInfluencersUncached(
  options?: ComputeTopOptions
): Promise<TopInfluencerRow[]> {
  const sb = options?.supabase ?? getAdmin();
  const topN = options?.limit ?? TOP_INFLUENCERS_N;
  const days = Math.max(
    1,
    options?.days ??
      (parseInt(process.env.TOP_INFLUENCERS_DAYS || String(DEFAULT_DAYS), 10) ||
        DEFAULT_DAYS)
  );
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  const eventTypes = Object.keys(DEMAND_EVENT_WEIGHTS);
  const events = await fetchAllAnalyticsEvents(sb, sinceIso, eventTypes);
  const { scores: demandFromEvents } = accumulateDemandScores(events);
  const acceptedRows = await loadAcceptedApplicationDemand(sb, sinceIso);
  const activityRaw = mergeAcceptedApplicationDemand(demandFromEvents, acceptedRows);

  const activityPoolIds = Object.entries(activityRaw)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, ACTIVITY_POOL)
    .map(([id]) => id);

  const candidateIds = activityPoolIds;
  if (candidateIds.length < Math.max(topN, ACTIVITY_POOL)) {
    const { data: fill } = await sb
      .from('influencers')
      .select('id')
      .eq('approved', true)
      .not('avatar_url', 'is', null)
      .not('accounts', 'is', null)
      .order('approved_at', { ascending: false })
      .limit(ACTIVITY_POOL * 2);
    const seen = new Set(candidateIds);
    for (const row of fill || []) {
      const id = idKey(String(row.id));
      if (seen.has(id)) continue;
      seen.add(id);
      candidateIds.push(id);
      if (candidateIds.length >= ACTIVITY_POOL * 2) break;
    }
  }

  if (candidateIds.length === 0) return [];

  // Only brandSafe from audit JSON — not the full auditpr_audit blob.
  // Raw prices stay server-side. The client gets from_price, never min_rate.
  const selectFull =
    'id, display_name, avatar_url, bio, videos, accounts, category, location, analytics_verified, verified, availability_status, auditpr_audit->brandSafe, min_rate, rate_card, service_packages, total_reviews, avg_rating, created_at, audience_top_age, audience_male_percent, audience_female_percent, profile_slug, avg_response_time, completion_rate, last_social_refresh_at, approved_at, approved';
  let influencers: TopScoreInfluencer[] | null = null;
  let infErr: { message: string } | null = null;
  {
    const full = await sb
      .from('influencers')
      .select(selectFull)
      .eq('approved', true)
      .in('id', candidateIds);
    infErr = full.error;
    influencers = withBrandSafeOnly((full.data as Record<string, unknown>[] | null) ?? null);
  }

  if (infErr && /column|brandSafe|auditpr_audit|availability_status/i.test(infErr.message)) {
    const fallback = await sb
      .from('influencers')
      .select(
        'id, display_name, avatar_url, bio, videos, accounts, category, location, analytics_verified, verified, approved, min_rate'
      )
      .eq('approved', true)
      .in('id', candidateIds);
    influencers = withBrandSafeOnly((fallback.data as Record<string, unknown>[] | null) ?? null);
    infErr = fallback.error;
  }

  if (infErr) throw new Error(infErr.message);

  const rows = (influencers || []).filter((inf) => isEligibleForTop10({ ...inf, approved: true }));
  if (rows.length === 0) return [];

  const realIds = rows.map((r) => String(r.id));
  const pastById = await getPastBrandsByInfluencerIds(realIds, sb);
  for (const inf of rows) {
    inf.past_brands = pastById.get(String(inf.id)) || [];
  }
  const snapshotsById = await loadSnapshotsByInfluencer(sb, realIds);
  const completedById = await loadCompletedCampaignCounts(sb, realIds);
  const incumbents = await loadIncumbentIds(sb);
  const demandNorm = normalizeScoresLog1p(activityRaw);
  const now = Date.now();

  const ranked = rows
    .map((inf) => {
      const id = idKey(String(inf.id));
      const currentTotal = totalFollowersFromAccounts(inf.accounts || []);
      const rawSnaps = snapshotsById[id] || [];
      const aligned = rawSnaps
        .map((s) => {
          const total = alignFollowerSnapshotToCurrent(s.total, currentTotal);
          return total != null ? { total, at: s.at } : null;
        })
        .filter((s): s is { total: number; at: number } => s != null);
      const growthPct = growthPctFromSnapshots(currentTotal, aligned, now);
      const demand = demandNorm[id] ?? 0;
      const channelScore = computeChannelScore100(inf, growthPct);
      const reachScore = computeReachScore(inf);
      const collabScore = computeCollabScore(inf, completedById[id] ?? 0);
      const responseScore = computeResponseScore(inf, now);
      const profileScore = computeProfileCompletenessScore(inf);
      let composite = blendTopScore({
        demand,
        channel: channelScore,
        collab: collabScore,
        reach: reachScore,
        response: responseScore,
        profile: profileScore,
      });
      composite = applyTopTrustPenalty(composite, inf);
      composite = applyIncumbentPenalty(composite, incumbents.has(id));
      return {
        inf,
        id,
        activityRaw: activityRaw[id] ?? 0,
        composite,
      };
    })
    .sort((a, b) => b.composite - a.composite || b.activityRaw - a.activityRaw)
    .slice(0, topN);

  return ranked.map((r) => {
    const inf = r.inf as TopScoreInfluencer & {
      display_name?: string | null;
      avatar_url?: string | null;
      category?: string | null;
      profile_slug?: string | null;
      location?: string | null;
      min_rate?: unknown;
      rate_card?: unknown;
      service_packages?: unknown;
      verified?: boolean | null;
      analytics_verified?: boolean | null;
      availability_status?: string | null;
    };
    const fromPrice = lowestListedPrice(inf);
    return {
      id: String(inf.id),
      display_name: inf.display_name ?? '',
      display_name_en: null,
      avatar_url: inf.avatar_url ?? null,
      accounts: inf.accounts ?? null,
      category: (inf.category as string | null) ?? null,
      profile_slug: inf.profile_slug ?? null,
      location: inf.location ?? null,
      from_price: fromPrice,
      price_tier: priceTierFromMinRate(fromPrice ?? inf.min_rate),
      verified: inf.verified === true,
      analytics_verified: inf.analytics_verified === true,
      availability_status: inf.availability_status ?? null,
      clicks: Math.round(r.activityRaw),
      views: 0,
    };
  });
}

/** Cached Top 10 (1h). Custom supabase clients bypass the cache (cron/tests). */
export async function computeTopInfluencers(
  options?: ComputeTopOptions
): Promise<TopInfluencerRow[]> {
  if (options?.supabase) {
    return computeTopInfluencersUncached(options);
  }
  const topN = options?.limit ?? TOP_INFLUENCERS_N;
  const days = Math.max(
    1,
    options?.days ??
      (parseInt(process.env.TOP_INFLUENCERS_DAYS || String(DEFAULT_DAYS), 10) ||
        DEFAULT_DAYS)
  );
  return unstable_cache(
    () => computeTopInfluencersUncached({ limit: topN, days }),
    ['top-influencers', String(topN), String(days)],
    { revalidate: 3600, tags: ['top-influencers'] }
  )();
}
