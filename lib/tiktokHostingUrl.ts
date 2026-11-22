/** TikTok account row shape we read from `influencers.accounts`. */
export type TikTokAccountUsernameSource = {
  platform?: string | null;
  username?: string | null;
};

/**
 * First TikTok handle on the creator profile (no leading @).
 */
export function tiktokUsernameFromAccounts(
  accounts: TikTokAccountUsernameSource[] | null | undefined
): string | null {
  if (!Array.isArray(accounts)) return null;
  for (const acc of accounts) {
    const platform = String(acc?.platform || "").toLowerCase();
    if (!platform.includes("tiktok")) continue;
    const un = String(acc?.username || "").trim().replace(/^@+/, "");
    if (un) return un;
  }
  return null;
}

/**
 * vm / redirect URLs often land on `https://www.tiktok.com/@/photo/{id}` with an empty handle.
 * yt-dlp needs `https://www.tiktok.com/@{handle}/photo/{id}` (same for video).
 */
export function rewriteTikTokEmptyHandleUrl(
  rawUrl: string,
  accounts?: TikTokAccountUsernameSource[] | null
): string {
  const url = String(rawUrl || "").trim();
  if (!url) return url;
  const handle = tiktokUsernameFromAccounts(accounts);
  if (!handle) return url;

  const photo = url.match(/tiktok\.com\/@\/photo\/(\d+)/i);
  if (photo?.[1]) {
    return `https://www.tiktok.com/@${handle}/photo/${photo[1]}`;
  }
  const video = url.match(/tiktok\.com\/@\/video\/(\d+)/i);
  if (video?.[1]) {
    return `https://www.tiktok.com/@${handle}/video/${video[1]}`;
  }
  return url;
}