/**
 * Confirm that a TikTok URL is actually gone before swapping or hiding it.
 * Playback errors (3001/2001/2005, timeouts) must never trigger this path.
 */

export type TikTokPlayableCheck = {
  playable?: unknown;
  reason?: unknown;
};

/**
 * True only when /api/check-video (TikTok oEmbed / resolve) positively says
 * the item is gone. Technical failures and "unchecked" must not replace.
 */
export function isConfirmedTikTokOembedReject(result: TikTokPlayableCheck): boolean {
  if (result.playable !== false) return false;
  const reason = String(result.reason || "");
  return reason.startsWith("tiktok_oembed_") || reason === "tiktok_gone";
}

export async function confirmTikTokInvalidVideo(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  const target = String(url || "").trim();
  if (!target) return false;
  try {
    const res = await fetchImpl(`/api/check-video?url=${encodeURIComponent(target)}`);
    if (!res.ok) return false;
    const data = (await res.json()) as TikTokPlayableCheck;
    return isConfirmedTikTokOembedReject(data);
  } catch {
    return false;
  }
}
