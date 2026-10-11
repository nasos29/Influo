import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkVideoLink,
  classifyVideoUrl,
  decideRemoval,
  type LinkCheck,
  type LinkOutcome,
  type VideoPlatform,
} from "@/lib/videoLinkCheck";

/** One nightly run stays inside a 60s Vercel function, with a pause between platform calls. */
export const VIDEO_LINK_BATCH_SIZE = 25;
export const VIDEO_LINK_DELAY_MS = 400;
export const VIDEO_LINK_TIME_BUDGET_MS = 45_000;

type Item = {
  influencerId: string;
  displayName: string;
  url: string;
};

type CheckRow = {
  missing_count: number | null;
  first_missing_at: string | null;
};

export type PruneSummary = {
  checked: number;
  live: number;
  missing: number;
  unknown: number;
  removed: number;
  remaining: number;
  cursor: { influencerId: string; url: string } | null;
  removals: { influencerId: string; displayName: string; url: string; platform: VideoPlatform }[];
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
  return /video_link_checks|video_link_removals|video_link_check_state/i.test(error.message || "")
    && /does not exist|schema cache|could not find/i.test(error.message || "");
}

export async function runPruneDeadVideoLinks(
  admin: SupabaseClient,
  now = new Date(),
  options?: {
    batchSize?: number;
    delayMs?: number;
    timeBudgetMs?: number;
    check?: (url: string) => Promise<LinkCheck | null>;
  }
): Promise<PruneSummary> {
  const batchSize = options?.batchSize ?? VIDEO_LINK_BATCH_SIZE;
  const delayMs = options?.delayMs ?? VIDEO_LINK_DELAY_MS;
  const timeBudgetMs = options?.timeBudgetMs ?? VIDEO_LINK_TIME_BUDGET_MS;
  const check = options?.check ?? checkVideoLink;
  const ready = await admin.from("video_link_checks").select("influencer_id").limit(1);
  if (ready.error && missingTable(ready.error)) {
    throw new Error("Run docs/VIDEO_LINK_CHECKS.sql in the Supabase SQL editor before this cron.");
  }
  if (ready.error) throw new Error(ready.error.message);

  const items = await loadCheckableLinks(admin);
  const cursor = await loadCursor(admin);
  const batch = sliceBatch(items, cursor, batchSize);

  const summary: PruneSummary = {
    checked: 0,
    live: 0,
    missing: 0,
    unknown: 0,
    removed: 0,
    remaining: 0,
    cursor: batch.nextCursor,
    removals: [],
    stoppedEarly: false,
  };

  const started = Date.now();
  for (let index = 0; index < batch.items.length; index++) {
    if (Date.now() - started > timeBudgetMs) {
      summary.stoppedEarly = true;
      summary.cursor = index > 0
        ? { influencerId: batch.items[index - 1].influencerId, url: batch.items[index - 1].url }
        : cursor;
      break;
    }
    if (index > 0 && delayMs > 0) await sleep(delayMs);

    const item = batch.items[index];
    const result = await check(item.url);
    summary.cursor = { influencerId: item.influencerId, url: item.url };
    if (!result) continue;
    summary.checked += 1;
    summary[result.outcome] += 1;

    const previous = await loadCheck(admin, item.influencerId, item.url);
    const decision = decideRemoval(
      previous
        ? { missingCount: previous.missing_count ?? 0, firstMissingAt: previous.first_missing_at }
        : null,
      result.outcome,
      now
    );

    if (decision.remove) {
      const removed = await removeLink(admin, item, result.platform, result.httpStatus, result.detail, now);
      if (removed) {
        summary.removed += 1;
        summary.removals.push({
          influencerId: item.influencerId,
          displayName: item.displayName,
          url: item.url,
          platform: result.platform,
        });
        await admin.from("video_link_checks").delete().eq("influencer_id", item.influencerId).eq("url", item.url);
      } else {
        await saveCheck(admin, item, result.platform, result.outcome, result.httpStatus, result.detail, decision, now);
      }
    } else {
      await saveCheck(admin, item, result.platform, result.outcome, result.httpStatus, result.detail, decision, now);
    }
  }

  if (!summary.stoppedEarly) summary.cursor = batch.nextCursor;
  summary.remaining = countAfter(items, summary.cursor);
  await saveCursor(admin, summary.cursor, now);
  return summary;
}

function countAfter(items: Item[], cursor: { influencerId: string; url: string } | null): number {
  if (!cursor) return 0;
  const exact = items.findIndex((item) => item.influencerId === cursor.influencerId && item.url === cursor.url);
  if (exact >= 0) return items.length - exact - 1;
  const next = items.findIndex(
    (item) =>
      item.influencerId > cursor.influencerId ||
      (item.influencerId === cursor.influencerId && item.url > cursor.url)
  );
  return next >= 0 ? items.length - next : 0;
}

async function loadCheckableLinks(admin: SupabaseClient): Promise<Item[]> {
  const pageSize = 1000;
  const items: Item[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("influencers")
      .select("id, display_name, videos")
      .not("videos", "is", null)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const row of rows) {
      const seen = new Set<string>();
      for (const url of asUrlList(row.videos)) {
        if (seen.has(url) || !classifyVideoUrl(url)) continue;
        seen.add(url);
        items.push({
          influencerId: String(row.id),
          displayName: typeof row.display_name === "string" ? row.display_name : "",
          url,
        });
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
    const exact = items.findIndex((item) => item.influencerId === cursor.influencerId && item.url === cursor.url);
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

async function loadCursor(admin: SupabaseClient): Promise<{ influencerId: string; url: string } | null> {
  const { data, error } = await admin
    .from("video_link_check_state")
    .select("cursor_influencer_id, cursor_url")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    if (missingTable(error)) throw new Error("Run docs/VIDEO_LINK_CHECKS.sql in the Supabase SQL editor before this cron.");
    throw new Error(error.message);
  }
  if (!data?.cursor_influencer_id || !data.cursor_url) return null;
  return { influencerId: String(data.cursor_influencer_id), url: String(data.cursor_url) };
}

async function saveCursor(
  admin: SupabaseClient,
  cursor: { influencerId: string; url: string } | null,
  now: Date
): Promise<void> {
  const { error } = await admin.from("video_link_check_state").upsert({
    id: 1,
    cursor_influencer_id: cursor?.influencerId ?? null,
    cursor_url: cursor?.url ?? null,
    updated_at: now.toISOString(),
  });
  if (error) throw new Error(error.message);
}

async function loadCheck(admin: SupabaseClient, influencerId: string, url: string): Promise<CheckRow | null> {
  const { data, error } = await admin
    .from("video_link_checks")
    .select("missing_count, first_missing_at")
    .eq("influencer_id", influencerId)
    .eq("url", url)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function saveCheck(
  admin: SupabaseClient,
  item: Item,
  platform: VideoPlatform,
  outcome: LinkOutcome,
  httpStatus: number | null,
  detail: string,
  decision: { missingCount: number; firstMissingAt: string | null },
  now: Date
): Promise<void> {
  const { error } = await admin.from("video_link_checks").upsert({
    influencer_id: item.influencerId,
    url: item.url,
    platform,
    missing_count: decision.missingCount,
    first_missing_at: decision.firstMissingAt,
    last_checked_at: now.toISOString(),
    last_status: outcome,
    last_http_status: httpStatus,
    last_detail: detail.slice(0, 300),
  });
  if (error) throw new Error(error.message);
}

async function removeLink(
  admin: SupabaseClient,
  item: Item,
  platform: VideoPlatform,
  httpStatus: number | null,
  detail: string,
  now: Date
): Promise<boolean> {
  const { data, error } = await admin
    .from("influencers")
    .select("videos, video_thumbnails")
    .eq("id", item.influencerId)
    .maybeSingle();
  if (error || !data) return false;

  const videos = Array.isArray(data.videos) ? data.videos : [];
  if (!videos.includes(item.url)) return false;
  const nextVideos = videos.filter((url) => url !== item.url);

  const patch: Record<string, unknown> = { videos: nextVideos };
  const thumbs = data.video_thumbnails;
  if (thumbs && typeof thumbs === "object" && !Array.isArray(thumbs) && item.url in thumbs) {
    const nextThumbs = { ...(thumbs as Record<string, unknown>) };
    delete nextThumbs[item.url];
    patch.video_thumbnails = nextThumbs;
  }

  const updated = await admin.from("influencers").update(patch).eq("id", item.influencerId);
  if (updated.error) throw new Error(updated.error.message);

  const logged = await admin.from("video_link_removals").insert({
    influencer_id: item.influencerId,
    display_name: item.displayName,
    url: item.url,
    platform,
    removed_at: now.toISOString(),
    http_status: httpStatus,
    detail: detail.slice(0, 300),
  });
  if (logged.error) {
    await admin
      .from("influencers")
      .update({ videos: data.videos, video_thumbnails: data.video_thumbnails })
      .eq("id", item.influencerId);
    throw new Error(logged.error.message);
  }
  return true;
}
