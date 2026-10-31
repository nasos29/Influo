/**
 * Unified nightly portfolio video pass.
 * One status per link: missing | unplayable | ok | unknown.
 * - missing → prune after 2 misses ≥72h apart (video_link_*)
 * - unplayable → hide after 2 consecutive (portfolio_video_strikes / hidden_videos)
 * - ok → clear strikes / restore hide; clear missing count
 * - unknown → no action (timeouts, login walls, 5xx, vm→homepage)
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
import {
  checkVideoLink,
  classifyVideoUrl,
  decideRemoval,
  type LinkOutcome,
  type VideoPlatform,
} from "@/lib/videoLinkCheck";
import { collectTopPosts, TOP_POSTS_DISPLAY_LIMIT } from "@/lib/topPosts";

export const PORTFOLIO_VIDEO_BATCH_SIZE = 20;
export const PORTFOLIO_VIDEO_DELAY_MS = 350;
export const PORTFOLIO_VIDEO_TIME_BUDGET_MS = 45_000;

export type PortfolioLinkStatus = "missing" | "unplayable" | "ok" | "unknown";

export type PortfolioLinkResult = {
  status: PortfolioLinkStatus;
  platform: VideoPlatform;
  httpStatus: number | null;
  detail: string;
};

type Item = {
  influencerId: string;
  displayName: string;
  url: string;
};

type CheckRow = {
  missing_count: number | null;
  first_missing_at: string | null;
};

export type PortfolioVideoCheckSummary = {
  checked: number;
  missing: number;
  unplayable: number;
  /** Links that exist and play. Named okCount so JSON `{ ok: true, ... }` stays unambiguous. */
  okCount: number;
  unknown: number;
  removed: number;
  hidden: number;
  restored: number;
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

/** Top-post URLs the public profile actually shows. Hidden posts are not checked. */
function displayedTopPostUrls(accounts: unknown, hiddenRaw: unknown): string[] {
  if (!Array.isArray(accounts)) return [];
  return collectTopPosts(accounts, TOP_POSTS_DISPLAY_LIMIT, hiddenRaw).map((post) => post.url);
}

function withoutTopPost(accounts: unknown, url: string): { accounts: unknown; changed: boolean } {
  if (!Array.isArray(accounts)) return { accounts, changed: false };
  const key = normalizeVideoUrlKey(url);
  let changed = false;
  const next = accounts.map((account) => {
    if (!account || typeof account !== "object") return account;
    const posts = (account as { top_posts?: unknown }).top_posts;
    if (!Array.isArray(posts)) return account;
    const top_posts = posts.filter((post) => {
      if (!post || typeof post !== "object") return true;
      const postUrl = (post as { url?: unknown }).url;
      if (typeof postUrl !== "string" || normalizeVideoUrlKey(postUrl) !== key) return true;
      changed = true;
      return false;
    });
    if (top_posts.length === posts.length) return account;
    return { ...(account as Record<string, unknown>), top_posts };
  });
  return { accounts: next, changed };
}

function missingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return (
    /video_link_checks|video_link_removals|video_link_check_state|portfolio_video_strikes|portfolio_video_check_state|hidden_videos/i.test(
      error.message || ""
    ) && /does not exist|schema cache|could not find/i.test(error.message || "")
  );
}

/**
 * Single logical check: existence first, then playability only when the post exists.
 * Timeouts / walls / 5xx / vm→homepage stay unknown.
 */
export async function checkPortfolioLinkStatus(url: string): Promise<PortfolioLinkResult | null> {
  const classified = classifyVideoUrl(url);
  if (!classified) return null;

  let existence: Awaited<ReturnType<typeof checkVideoLink>>;
  try {
    existence = await checkVideoLink(url);
  } catch (error) {
    return {
      status: "unknown",
      platform: classified.platform,
      httpStatus: null,
      detail: error instanceof Error ? error.message : "check failed",
    };
  }
  if (!existence) return null;

  if (existence.outcome === "missing") {
    return {
      status: "missing",
      platform: existence.platform,
      httpStatus: existence.httpStatus,
      detail: existence.detail,
    };
  }
  if (existence.outcome === "unknown") {
    return {
      status: "unknown",
      platform: existence.platform,
      httpStatus: existence.httpStatus,
      detail: existence.detail,
    };
  }

  // Post exists — check whether Influo can play it.
  let playable: Awaited<ReturnType<typeof checkVideoPlayable>>;
  try {
    playable = await checkVideoPlayable(url);
  } catch (error) {
    return {
      status: "unknown",
      platform: existence.platform,
      httpStatus: existence.httpStatus,
      detail: error instanceof Error ? error.message : "playable check failed",
    };
  }

  const reason = playable.reason || "";
  const isUnchecked =
    reason === "unchecked" || reason === "empty" || reason === "unsupported_host";
  if (isUnchecked) {
    return {
      status: "unknown",
      platform: existence.platform,
      httpStatus: existence.httpStatus,
      detail: reason || "unchecked",
    };
  }
  if (!playable.playable) {
    return {
      status: "unplayable",
      platform: existence.platform,
      httpStatus: existence.httpStatus,
      detail: reason || "unplayable",
    };
  }
  return {
    status: "ok",
    platform: existence.platform,
    httpStatus: existence.httpStatus,
    detail: reason || existence.detail || "ok",
  };
}

function outcomeForMissingState(status: PortfolioLinkStatus): LinkOutcome {
  if (status === "missing") return "missing";
  if (status === "ok" || status === "unplayable") return "live";
  return "unknown";
}

export async function runCheckPortfolioVideos(
  admin: SupabaseClient,
  now = new Date(),
  options?: {
    batchSize?: number;
    delayMs?: number;
    timeBudgetMs?: number;
    check?: (url: string) => Promise<PortfolioLinkResult | null>;
  }
): Promise<PortfolioVideoCheckSummary> {
  const batchSize = options?.batchSize ?? PORTFOLIO_VIDEO_BATCH_SIZE;
  const delayMs = options?.delayMs ?? PORTFOLIO_VIDEO_DELAY_MS;
  const timeBudgetMs = options?.timeBudgetMs ?? PORTFOLIO_VIDEO_TIME_BUDGET_MS;
  const check = options?.check ?? checkPortfolioLinkStatus;

  const linkReady = await admin.from("video_link_checks").select("influencer_id").limit(1);
  if (linkReady.error && missingTable(linkReady.error)) {
    throw new Error("Run docs/VIDEO_LINK_CHECKS.sql in the Supabase SQL editor before this cron.");
  }
  if (linkReady.error) throw new Error(linkReady.error.message);

  const portfolioReady = await admin.from("portfolio_video_check_state").select("id").limit(1);
  if (portfolioReady.error && missingTable(portfolioReady.error)) {
    throw new Error("Run docs/PORTFOLIO_VIDEO_CHECKS.sql in the Supabase SQL editor before this cron.");
  }
  if (portfolioReady.error) throw new Error(portfolioReady.error.message);

  const items = await loadCheckableLinks(admin);
  const cursor = await loadCursor(admin);
  const batch = sliceBatch(items, cursor, batchSize);

  const summary: PortfolioVideoCheckSummary = {
    checked: 0,
    missing: 0,
    unplayable: 0,
    okCount: 0,
    unknown: 0,
    removed: 0,
    hidden: 0,
    restored: 0,
    remaining: 0,
    cursor: batch.nextCursor,
    removals: [],
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

    let result: PortfolioLinkResult | null;
    try {
      result = await check(item.url);
    } catch {
      result = {
        status: "unknown",
        platform: classifyVideoUrl(item.url)?.platform ?? "instagram",
        httpStatus: null,
        detail: "check threw",
      };
    }
    if (!result) continue;

    summary.checked += 1;
    if (result.status === "ok") summary.okCount += 1;
    else summary[result.status] += 1;

    // --- missing path (prune) ---
    const previous = await loadMissingCheck(admin, item.influencerId, item.url);
    const decision = decideRemoval(
      previous
        ? { missingCount: previous.missing_count ?? 0, firstMissingAt: previous.first_missing_at }
        : null,
      outcomeForMissingState(result.status),
      now
    );

    if (result.status === "missing" && decision.remove) {
      const removed = await removeLink(
        admin,
        item,
        result.platform,
        result.httpStatus,
        result.detail,
        now
      );
      if (removed) {
        summary.removed += 1;
        summary.removals.push({
          influencerId: item.influencerId,
          displayName: item.displayName,
          url: item.url,
          platform: result.platform,
        });
        await admin
          .from("video_link_checks")
          .delete()
          .eq("influencer_id", item.influencerId)
          .eq("url", item.url);
        await clearStrike(admin, item.influencerId, item.url);
        continue;
      }
    }

    await saveMissingCheck(
      admin,
      item,
      result.platform,
      outcomeForMissingState(result.status),
      result.httpStatus,
      result.detail,
      decision,
      now
    );

    // --- unplayable / ok / unknown for hide path ---
    if (result.status === "unknown") {
      continue;
    }

    if (result.status === "ok") {
      await clearStrike(admin, item.influencerId, item.url);
      const restored = await unhideIfPresent(admin, item.influencerId, item.url);
      if (restored) summary.restored += 1;
      continue;
    }

    if (result.status === "unplayable") {
      const strikes = await bumpStrike(
        admin,
        item.influencerId,
        item.url,
        result.detail,
        now
      );
      if (strikes >= 2) {
        const hid = await hideVideo(admin, item.influencerId, item.url, result.detail, now);
        if (hid) summary.hidden += 1;
      }
      continue;
    }

    // missing but not yet removed — leave hide/strikes alone
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

/** All influencers with classified portfolio posts (same coverage as the old prune pass). */
async function loadCheckableLinks(admin: SupabaseClient): Promise<Item[]> {
  const pageSize = 1000;
  const items: Item[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("influencers")
      .select("id, display_name, videos, accounts, hidden_videos")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const row of rows) {
      const seen = new Set<string>();
      const urls = [...asUrlList(row.videos), ...displayedTopPostUrls(row.accounts, row.hidden_videos)];
      for (const url of urls) {
        const key = normalizeVideoUrlKey(url);
        if (!key || seen.has(key) || !classifyVideoUrl(url)) continue;
        seen.add(key);
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

/** Prefer portfolio cursor; fall back to prune cursor so one nightly pass continues cleanly. */
async function loadCursor(
  admin: SupabaseClient
): Promise<{ influencerId: string; url: string } | null> {
  const portfolio = await admin
    .from("portfolio_video_check_state")
    .select("cursor_influencer_id, cursor_url")
    .eq("id", 1)
    .maybeSingle();
  if (portfolio.error) throw new Error(portfolio.error.message);
  if (portfolio.data?.cursor_influencer_id && portfolio.data?.cursor_url) {
    return {
      influencerId: String(portfolio.data.cursor_influencer_id),
      url: String(portfolio.data.cursor_url),
    };
  }

  const prune = await admin
    .from("video_link_check_state")
    .select("cursor_influencer_id, cursor_url")
    .eq("id", 1)
    .maybeSingle();
  if (prune.error) {
    if (missingTable(prune.error)) return null;
    throw new Error(prune.error.message);
  }
  if (!prune.data?.cursor_influencer_id || !prune.data.cursor_url) return null;
  return {
    influencerId: String(prune.data.cursor_influencer_id),
    url: String(prune.data.cursor_url),
  };
}

async function saveCursor(
  admin: SupabaseClient,
  cursor: { influencerId: string; url: string } | null,
  now: Date
): Promise<void> {
  const row = {
    id: 1,
    cursor_influencer_id: cursor?.influencerId ?? null,
    cursor_url: cursor?.url ?? null,
    updated_at: now.toISOString(),
  };
  const a = await admin.from("portfolio_video_check_state").upsert(row, { onConflict: "id" });
  if (a.error) throw new Error(a.error.message);
  const b = await admin.from("video_link_check_state").upsert(row, { onConflict: "id" });
  if (b.error) throw new Error(b.error.message);
}

async function loadMissingCheck(
  admin: SupabaseClient,
  influencerId: string,
  url: string
): Promise<CheckRow | null> {
  const { data, error } = await admin
    .from("video_link_checks")
    .select("missing_count, first_missing_at")
    .eq("influencer_id", influencerId)
    .eq("url", url)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function saveMissingCheck(
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
    .select("videos, video_thumbnails, accounts")
    .eq("id", item.influencerId)
    .maybeSingle();
  if (error || !data) return false;

  const videos = Array.isArray(data.videos) ? data.videos : [];
  const inPortfolio = videos.includes(item.url);
  const stripped = withoutTopPost(data.accounts, item.url);
  if (!inPortfolio && !stripped.changed) return false;
  const nextVideos = videos.filter((url) => url !== item.url);

  const patch: Record<string, unknown> = {};
  if (inPortfolio) patch.videos = nextVideos;
  if (stripped.changed) patch.accounts = stripped.accounts;
  const thumbs = data.video_thumbnails;
  if (thumbs && typeof thumbs === "object" && !Array.isArray(thumbs) && item.url in thumbs) {
    const nextThumbs = { ...(thumbs as Record<string, unknown>) };
    delete nextThumbs[item.url];
    patch.video_thumbnails = nextThumbs;
  }

  // Also drop from hidden_videos if present
  const hiddenRow = await admin
    .from("influencers")
    .select("hidden_videos")
    .eq("id", item.influencerId)
    .maybeSingle();
  if (!hiddenRow.error && hiddenRow.data) {
    const before = parseHiddenVideos(hiddenRow.data.hidden_videos);
    if (before.some((h) => normalizeVideoUrlKey(h.url) === normalizeVideoUrlKey(item.url))) {
      patch.hidden_videos = removeHiddenVideo(hiddenRow.data.hidden_videos, item.url);
    }
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
      .update({
        ...(inPortfolio
          ? { videos: data.videos, video_thumbnails: data.video_thumbnails }
          : {}),
        ...(stripped.changed ? { accounts: data.accounts } : {}),
        ...(patch.hidden_videos !== undefined
          ? { hidden_videos: hiddenRow.data?.hidden_videos ?? null }
          : {}),
      })
      .eq("id", item.influencerId);
    throw new Error(logged.error.message);
  }
  return true;
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
