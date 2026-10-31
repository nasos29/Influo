/**
 * Nightly portfolio playability pass (checkVideoPlayable).
 * Hides links only after 2 consecutive unplayable results. Never deletes from videos.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkVideoPlayable,
  normalizeVideoUrlKey,
} from "@/lib/checkVideoPlayable";
import {
  parseHiddenVideos,
  removeHiddenVideo,
  upsertHiddenVideo,
  type HiddenVideoEntry,
} from "@/lib/hiddenVideos";

export const PORTFOLIO_VIDEO_BATCH_SIZE = 20;
export const PORTFOLIO_VIDEO_DELAY_MS = 350;
export const PORTFOLIO_VIDEO_TIME_BUDGET_MS = 45_000;

type Item = {
  influencerId: string;
  url: string;
};

export type PortfolioVideoCheckSummary = {
  checked: number;
  playable: number;
  unplayable: number;
  unchecked: number;
  hidden: number;
  restored: number;
  remaining: number;
  cursor: { influencerId: string; url: string } | null;
  stoppedEarly: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function missingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return (
    /portfolio_video_strikes|portfolio_video_check_state|hidden_videos/i.test(error.message || "") &&
    /does not exist|schema cache|could not find/i.test(error.message || "")
  );
}

export async function runCheckPortfolioVideos(
  admin: SupabaseClient,
  now = new Date(),
  options?: {
    batchSize?: number;
    delayMs?: number;
    timeBudgetMs?: number;
    check?: typeof checkVideoPlayable;
  }
): Promise<PortfolioVideoCheckSummary> {
  const batchSize = options?.batchSize ?? PORTFOLIO_VIDEO_BATCH_SIZE;
  const delayMs = options?.delayMs ?? PORTFOLIO_VIDEO_DELAY_MS;
  const timeBudgetMs = options?.timeBudgetMs ?? PORTFOLIO_VIDEO_TIME_BUDGET_MS;
  const check = options?.check ?? checkVideoPlayable;

  const ready = await admin.from("portfolio_video_check_state").select("id").limit(1);
  if (ready.error && missingTable(ready.error)) {
    throw new Error("Run docs/PORTFOLIO_VIDEO_CHECKS.sql in the Supabase SQL editor before this cron.");
  }
  if (ready.error) throw new Error(ready.error.message);

  const items = await loadCheckableLinks(admin);
  const cursor = await loadCursor(admin);
  const batch = sliceBatch(items, cursor, batchSize);

  const summary: PortfolioVideoCheckSummary = {
    checked: 0,
    playable: 0,
    unplayable: 0,
    unchecked: 0,
    hidden: 0,
    restored: 0,
    remaining: 0,
    cursor: batch.nextCursor,
    stoppedEarly: false,
  };

  const started = Date.now();
  for (let index = 0; index < batch.items.length; index++) {
    if (Date.now() - started > timeBudgetMs) {
      summary.stoppedEarly = true;
      summary.cursor =
        index > 0
          ? {
              influencerId: batch.items[index - 1]!.influencerId,
              url: batch.items[index - 1]!.url,
            }
          : cursor;
      break;
    }
    if (index > 0 && delayMs > 0) await sleep(delayMs);

    const item = batch.items[index]!;
    summary.cursor = { influencerId: item.influencerId, url: item.url };

    let result: Awaited<ReturnType<typeof checkVideoPlayable>>;
    try {
      result = await check(item.url);
    } catch {
      result = { playable: true, reason: "unchecked" };
    }

    const reason = result.reason || "";
    const isUnchecked = reason === "unchecked" || reason === "empty" || reason === "unsupported_host";
    const isPlayable = result.playable === true;
    const isUnplayable = !isPlayable && !isUnchecked;

    summary.checked += 1;
    if (isUnchecked) summary.unchecked += 1;
    else if (isPlayable) summary.playable += 1;
    else summary.unplayable += 1;

    if (isUnchecked) {
      // Technical / inconclusive — leave strikes and visibility alone.
      continue;
    }

    if (isPlayable) {
      await clearStrike(admin, item.influencerId, item.url);
      const restored = await unhideIfPresent(admin, item.influencerId, item.url);
      if (restored) summary.restored += 1;
      continue;
    }

    // Unplayable
    const strikes = await bumpStrike(admin, item.influencerId, item.url, reason, now);
    if (strikes >= 2) {
      const hid = await hideVideo(admin, item.influencerId, item.url, reason, now);
      if (hid) summary.hidden += 1;
    }
  }

  if (!summary.stoppedEarly) summary.cursor = batch.nextCursor;
  summary.remaining = countAfter(items, summary.cursor);
  await saveCursor(admin, summary.cursor, now);
  return summary;
}

function countAfter(items: Item[], cursor: { influencerId: string; url: string } | null): number {
  if (!cursor) return 0;
  const exact = items.findIndex(
    (item) => item.influencerId === cursor.influencerId && item.url === cursor.url
  );
  if (exact >= 0) return items.length - exact - 1;
  const next = items.findIndex(
    (item) =>
      item.influencerId > cursor.influencerId ||
      (item.influencerId === cursor.influencerId && item.url > cursor.url)
  );
  return next >= 0 ? items.length - next : 0;
}

/** Approved influencers only; select id, videos, hidden_videos (egress-safe). */
async function loadCheckableLinks(admin: SupabaseClient): Promise<Item[]> {
  const pageSize = 1000;
  const items: Item[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("influencers")
      .select("id, videos, hidden_videos")
      .eq("approved", true)
      .not("videos", "is", null)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const row of rows) {
      const seen = new Set<string>();
      for (const url of asUrlList(row.videos)) {
        const key = normalizeVideoUrlKey(url);
        if (!key || seen.has(key)) continue;
        // Only IG / TikTok / YouTube portfolio hosts (same as checkVideoPlayable).
        if (!/instagram\.com|tiktok\.com|(vm|vt)\.tiktok\.com|youtube\.com|youtu\.be/i.test(url)) {
          continue;
        }
        seen.add(key);
        items.push({ influencerId: String(row.id), url });
      }
    }
    if (rows.length < pageSize) break;
  }
  return items;
}

function sliceBatch(
  items: Item[],
  cursor: { influencerId: string; url: string } | null,
  limit: number
): { items: Item[]; nextCursor: { influencerId: string; url: string } | null } {
  if (!items.length) return { items: [], nextCursor: null };
  let start = 0;
  if (cursor) {
    const exact = items.findIndex(
      (item) => item.influencerId === cursor.influencerId && item.url === cursor.url
    );
    if (exact >= 0) start = exact + 1;
    else {
      const next = items.findIndex(
        (item) =>
          item.influencerId > cursor.influencerId ||
          (item.influencerId === cursor.influencerId && item.url > cursor.url)
      );
      start = next >= 0 ? next : 0;
    }
    if (start >= items.length) start = 0;
  }
  const batch = items.slice(start, start + limit);
  const reachedEnd = start + batch.length >= items.length;
  const last = batch[batch.length - 1];
  return {
    items: batch,
    nextCursor: reachedEnd || !last ? null : { influencerId: last.influencerId, url: last.url },
  };
}

async function loadCursor(
  admin: SupabaseClient
): Promise<{ influencerId: string; url: string } | null> {
  const { data, error } = await admin
    .from("portfolio_video_check_state")
    .select("cursor_influencer_id, cursor_url")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.cursor_influencer_id || !data?.cursor_url) return null;
  return {
    influencerId: String(data.cursor_influencer_id),
    url: String(data.cursor_url),
  };
}

async function saveCursor(
  admin: SupabaseClient,
  cursor: { influencerId: string; url: string } | null,
  now: Date
): Promise<void> {
  await admin.from("portfolio_video_check_state").upsert(
    {
      id: 1,
      cursor_influencer_id: cursor?.influencerId ?? null,
      cursor_url: cursor?.url ?? null,
      updated_at: now.toISOString(),
    },
    { onConflict: "id" }
  );
}

async function bumpStrike(
  admin: SupabaseClient,
  influencerId: string,
  url: string,
  reason: string,
  now: Date
): Promise<number> {
  const { data } = await admin
    .from("portfolio_video_strikes")
    .select("consecutive_unplayable")
    .eq("influencer_id", influencerId)
    .eq("url", url)
    .maybeSingle();
  const next = (data?.consecutive_unplayable ?? 0) + 1;
  await admin.from("portfolio_video_strikes").upsert(
    {
      influencer_id: influencerId,
      url,
      consecutive_unplayable: next,
      last_reason: reason,
      last_checked_at: now.toISOString(),
    },
    { onConflict: "influencer_id,url" }
  );
  return next;
}

async function clearStrike(
  admin: SupabaseClient,
  influencerId: string,
  url: string
): Promise<void> {
  await admin
    .from("portfolio_video_strikes")
    .delete()
    .eq("influencer_id", influencerId)
    .eq("url", url);
}

async function hideVideo(
  admin: SupabaseClient,
  influencerId: string,
  url: string,
  reason: string,
  now: Date
): Promise<boolean> {
  const { data, error } = await admin
    .from("influencers")
    .select("hidden_videos")
    .eq("id", influencerId)
    .maybeSingle();
  if (error || !data) return false;
  const existing = parseHiddenVideos(data.hidden_videos);
  if (existing.some((h) => normalizeVideoUrlKey(h.url) === normalizeVideoUrlKey(url))) {
    return false;
  }
  const entry: HiddenVideoEntry = {
    url,
    reason,
    hidden_at: now.toISOString(),
  };
  const next = upsertHiddenVideo(data.hidden_videos, entry);
  const { error: upErr } = await admin
    .from("influencers")
    .update({ hidden_videos: next })
    .eq("id", influencerId);
  return !upErr;
}

async function unhideIfPresent(
  admin: SupabaseClient,
  influencerId: string,
  url: string
): Promise<boolean> {
  const { data, error } = await admin
    .from("influencers")
    .select("hidden_videos")
    .eq("id", influencerId)
    .maybeSingle();
  if (error || !data) return false;
  const before = parseHiddenVideos(data.hidden_videos);
  if (!before.some((h) => normalizeVideoUrlKey(h.url) === normalizeVideoUrlKey(url))) {
    return false;
  }
  const next = removeHiddenVideo(data.hidden_videos, url);
  const { error: upErr } = await admin
    .from("influencers")
    .update({ hidden_videos: next })
    .eq("id", influencerId);
  return !upErr;
}
