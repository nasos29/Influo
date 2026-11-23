/**
 * Creators approved on or after the cutoff show Instagram/TikTok portfolio and
 * top posts only when self-hosted; legacy profiles keep official embed fallback.
 */
export const IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE_ISO = "2026-11-23T00:00:00.000Z";

export function igTikTokHostedOnlyApprovedSinceMs(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw =
    String(env.IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE ?? "").trim() ||
    IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE_ISO;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function creatorIgTikTokHostedOnly(
  approvedAt: string | null | undefined,
  env?: NodeJS.ProcessEnv
): boolean {
  const since = igTikTokHostedOnlyApprovedSinceMs(env);
  if (since == null) return false;
  const at = String(approvedAt ?? "").trim();
  if (!at) return false;
  const ms = Date.parse(at);
  return Number.isFinite(ms) && ms >= since;
}