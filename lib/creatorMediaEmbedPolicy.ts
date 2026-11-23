/**
 * Creators created or approved on/after the cutoff show Instagram/TikTok portfolio and
 * top posts only when self-hosted; legacy profiles keep official embed fallback.
 */
export const IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE_ISO = "2026-11-22T22:00:00.000Z";

export function igTikTokHostedOnlyApprovedSinceMs(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw =
    String(env.IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE ?? "").trim() ||
    IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE_ISO;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export type CreatorHostedOnlyDates = {
  createdAt?: string | null | undefined;
  approvedAt?: string | null | undefined;
};

export function creatorIgTikTokHostedOnly(
  dates: CreatorHostedOnlyDates | string | null | undefined,
  env?: NodeJS.ProcessEnv
): boolean {
  const since = igTikTokHostedOnlyApprovedSinceMs(env);
  if (since == null) return false;

  const candidates: (string | null | undefined)[] =
    dates != null && typeof dates === "object"
      ? [dates.createdAt, dates.approvedAt]
      : [typeof dates === "string" ? dates : null];

  for (const at of candidates) {
    const s = String(at ?? "").trim();
    if (!s) continue;
    const ms = Date.parse(s);
    if (Number.isFinite(ms) && ms >= since) return true;
  }
  return false;
}