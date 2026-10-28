/** Short links that need redirect resolve (vm/vt and /t/). */
export function isTikTokShortLink(url: string): boolean {
  if (!url) return false;
  return /(vm|vt)\.tiktok\.com\/[\w-]+/i.test(url) || /tiktok\.com\/t\/[\w-]+/i.test(url);
}

/** Extract numeric TikTok video id from watch / photo / embed / player URLs. */
export function extractTikTokVideoId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /\/(?:video|photo)\/(\d+)/i,
    /tiktok\.com\/embed\/v2\/(\d+)/i,
    /tiktok\.com\/player\/v1\/(\d+)/i,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export type TikTokPlayerOpts = {
  /**
   * Prefer muted=1 so autoplay starts immediately; user can unmute via controls.
   * Default true (browsers block unmuted autoplay).
   */
  muted?: boolean;
};

/** Official TikTok iframe player (one-click play). */
export function buildTikTokPlayerUrl(videoId: string, opts?: TikTokPlayerOpts): string {
  const id = String(videoId || "").trim();
  if (!/^\d+$/.test(id)) {
    throw new Error("Invalid TikTok video id");
  }
  const muted = opts?.muted === false ? "0" : "1";
  const params = new URLSearchParams({
    autoplay: "1",
    muted,
    controls: "1",
    description: "0",
    music_info: "0",
    rel: "0",
  });
  return `https://www.tiktok.com/player/v1/${id}?${params.toString()}`;
}
