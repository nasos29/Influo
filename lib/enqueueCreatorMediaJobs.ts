import type { SupabaseClient } from "@supabase/supabase-js";
import { detectMediaPlatform, normalizeSourceUrl } from "@/lib/creatorMedia";
import { isSelfHostedPortfolioUrl, portfolioLinkSourceKey } from "@/lib/portfolioHosted";
import { triggerPortfolioMediaWorker } from "@/lib/triggerPortfolioMediaWorker";
import { collectTopPostsToHost, type AccountWithTopPosts } from "@/lib/topPosts";

/** TikTok / Instagram links we may download (not YouTube, not already on our storage). */
export function isHostableCreatorMediaUrl(url: string | null | undefined): boolean {
  const u = String(url || "").trim();
  if (!u || isSelfHostedPortfolioUrl(u)) return false;
  const platform = detectMediaPlatform(u);
  return platform === "instagram" || platform === "tiktok";
}

function urlsForEnqueue(urls: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const u = String(raw || "").trim();
    if (!u || !isHostableCreatorMediaUrl(u)) continue;
    const norm = normalizeSourceUrl(u);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(u);
  }
  return out;
}

/**
 * Idempotent queue insert (matches DB `enqueue_creator_media_job`).
 * Does not re-queue rows that are already queued, processing, or done.
 */
export async function enqueueCreatorMediaJobs(
  admin: SupabaseClient,
  influencerId: string,
  urls: Iterable<string>
): Promise<number> {
  const id = String(influencerId || "").trim();
  if (!id) return 0;
  const list = urlsForEnqueue(urls);
  if (!list.length) return 0;

  let queued = 0;
  for (const sourceUrl of list) {
    const sourceKey = portfolioLinkSourceKey(sourceUrl);
    const { data: existing } = await admin
      .from("creator_media_jobs")
      .select("id,status,updated_at")
      .eq("influencer_id", id)
      .eq("source_url_key", sourceKey)
      .maybeSingle();

    if (existing?.status === "done" || existing?.status === "queued" || existing?.status === "processing") {
      continue;
    }
    if (existing?.status === "failed") {
      const updatedAt = existing.updated_at ? Date.parse(String(existing.updated_at)) : 0;
      if (Number.isFinite(updatedAt) && Date.now() - updatedAt < 24 * 60 * 60 * 1000) {
        continue;
      }
    }

    const { normKey } = await normalizeReadyCreatorMedia(admin, id, sourceUrl);
    if (normKey) continue;

    if (existing?.status === "failed") {
      const { error } = await admin
        .from("creator_media_jobs")
        .update({
          source_url: sourceUrl,
          status: "queued",
          attempts: 0,
          error: null,
          next_retry_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (!error) queued += 1;
      continue;
    }

    const { error } = await admin.from("creator_media_jobs").insert({
      influencer_id: id,
      source_url: sourceUrl,
      source_url_key: sourceKey,
      status: "queued",
    });
    if (!error) queued += 1;
    else if (!/duplicate|unique|23505/i.test(error.message || "")) {
      console.warn("[enqueueCreatorMediaJobs]", error.message);
    }
  }
  return queued;
}

async function normalizeReadyCreatorMedia(
  admin: SupabaseClient,
  influencerId: string,
  sourceUrl: string
): Promise<{ normKey: boolean }> {
  const norm = normalizeSourceUrl(sourceUrl);
  if (!norm) return { normKey: false };
  const { data } = await admin
    .from("creator_media")
    .select("id,source_url,status")
    .eq("influencer_id", influencerId)
    .eq("status", "ready");
  for (const row of data || []) {
    if (normalizeSourceUrl(String(row.source_url || "")) === norm) {
      return { normKey: true };
    }
  }
  return { normKey: false };
}

/** Display top posts (3 slots, IG/TT only) that should be self-hosted. */
export function hostableUrlsFromAccounts(
  accounts: AccountWithTopPosts[] | null | undefined,
  hiddenRaw?: unknown
): string[] {
  return collectTopPostsToHost(accounts, undefined, hiddenRaw).map((p) => p.url);
}

export async function enqueueTopPostsFromAccounts(
  admin: SupabaseClient,
  influencerId: string,
  accounts: AccountWithTopPosts[] | null | undefined,
  hiddenRaw?: unknown
): Promise<number> {
  return enqueueCreatorMediaJobs(admin, influencerId, hostableUrlsFromAccounts(accounts, hiddenRaw));
}

/** Queue + kick the on-host worker (cron remains backstop). */
export async function enqueueCreatorMediaJobsAndRunWorker(
  admin: SupabaseClient,
  influencerId: string,
  urls: Iterable<string>
): Promise<number> {
  const n = await enqueueCreatorMediaJobs(admin, influencerId, urls);
  if (n > 0) triggerPortfolioMediaWorker("links-only");
  return n;
}

export async function enqueueTopPostsAndRunWorker(
  admin: SupabaseClient,
  influencerId: string,
  accounts: AccountWithTopPosts[] | null | undefined,
  hiddenRaw?: unknown
): Promise<number> {
  const n = await enqueueTopPostsFromAccounts(admin, influencerId, accounts, hiddenRaw);
  if (n > 0) triggerPortfolioMediaWorker("links-only");
  return n;
}