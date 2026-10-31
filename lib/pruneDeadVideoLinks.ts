/**
 * Compatibility wrapper for /api/cron/prune-dead-video-links.
 * Nightly schedule lives on check-portfolio-videos; this route calls the same
 * unified pass (missing + unplayable + ok + unknown).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  runCheckPortfolioVideos,
  type PortfolioLinkResult,
  type PortfolioVideoCheckSummary,
} from "@/lib/checkPortfolioVideos";
import type { LinkCheck, VideoPlatform } from "@/lib/videoLinkCheck";

/** Re-exported so existing callers keep the same batch knobs. */
export const VIDEO_LINK_BATCH_SIZE = 20;
export const VIDEO_LINK_DELAY_MS = 350;
export const VIDEO_LINK_TIME_BUDGET_MS = 45_000;

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
  /** Extra fields from the unified runner (ignored by older clients). */
  unplayable?: number;
  hidden?: number;
  restored?: number;
  okCount?: number;
};

function linkCheckToPortfolio(result: LinkCheck): PortfolioLinkResult {
  const status =
    result.outcome === "live"
      ? "ok"
      : result.outcome === "missing"
        ? "missing"
        : "unknown";
  return {
    status,
    platform: result.platform,
    httpStatus: result.httpStatus,
    detail: result.detail,
  };
}

function toPruneSummary(summary: PortfolioVideoCheckSummary): PruneSummary {
  return {
    checked: summary.checked,
    live: summary.okCount,
    missing: summary.missing,
    unknown: summary.unknown,
    removed: summary.removed,
    remaining: summary.remaining,
    cursor: summary.cursor,
    removals: summary.removals,
    stoppedEarly: summary.stoppedEarly,
    unplayable: summary.unplayable,
    hidden: summary.hidden,
    restored: summary.restored,
    okCount: summary.okCount,
  };
}

export async function runPruneDeadVideoLinks(
  admin: SupabaseClient,
  now = new Date(),
  options?: {
    batchSize?: number;
    delayMs?: number;
    timeBudgetMs?: number;
    /** Legacy inject: LinkCheck outcomes map to missing / ok / unknown (no unplayable). */
    check?: (url: string) => Promise<LinkCheck | null>;
  }
): Promise<PruneSummary> {
  const summary = await runCheckPortfolioVideos(admin, now, {
    batchSize: options?.batchSize ?? VIDEO_LINK_BATCH_SIZE,
    delayMs: options?.delayMs ?? VIDEO_LINK_DELAY_MS,
    timeBudgetMs: options?.timeBudgetMs ?? VIDEO_LINK_TIME_BUDGET_MS,
    check: options?.check
      ? async (url) => {
          const result = await options.check!(url);
          if (!result) return null;
          return linkCheckToPortfolio(result);
        }
      : undefined,
  });
  return toPruneSummary(summary);
}
