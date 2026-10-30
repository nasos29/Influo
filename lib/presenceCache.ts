/**
 * Shared influencer_presence lookups so many PresenceDots don't each hit PostgREST.
 */

import { supabase } from "@/lib/supabaseClient";
import { counterpartyInfluencerPresence } from "@/lib/presenceIdentity";

export type PresenceCacheRow = {
  influencer_id: string;
  is_online: boolean | null;
  last_seen: string | null;
};

type CacheEntry = { at: number; row: PresenceCacheRow | null };

const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<PresenceCacheRow | null>>();

export function peekPresenceCache(influencerId: string): PresenceCacheRow | null | undefined {
  const id = String(influencerId || "").trim();
  if (!id) return undefined;
  const hit = cache.get(id);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(id);
    return undefined;
  }
  return hit.row;
}

export function putPresenceCache(influencerId: string, row: PresenceCacheRow | null): void {
  const id = String(influencerId || "").trim();
  if (!id) return;
  cache.set(id, { at: Date.now(), row });
}

export async function getInfluencerPresenceCached(
  influencerId: string,
  options?: { force?: boolean }
): Promise<PresenceCacheRow | null> {
  const id = String(influencerId || "").trim();
  if (!id) return null;

  if (!options?.force) {
    const cached = peekPresenceCache(id);
    if (cached !== undefined) return cached;
  }

  const pending = inflight.get(id);
  if (pending) return pending;

  const request = (async () => {
    const { data, error } = await supabase
      .from("influencer_presence")
      .select("influencer_id, is_online, last_seen")
      .eq("influencer_id", id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      putPresenceCache(id, null);
      return null;
    }
    const row = counterpartyInfluencerPresence(id, data);
    const normalized: PresenceCacheRow | null = row
      ? {
          influencer_id: id,
          is_online: row.is_online ?? null,
          last_seen: row.last_seen ?? null,
        }
      : null;
    putPresenceCache(id, normalized);
    return normalized;
  })().finally(() => {
    inflight.delete(id);
  });

  inflight.set(id, request);
  return request;
}
