/** Official TikTok embed player origin (postMessage target). */
export const TIKTOK_PLAYER_ORIGIN = "https://www.tiktok.com";

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
   * Always start muted so autoplay is allowed; unmute via postMessage after
   * onPlayerReady (or the Tap-for-sound control). Default true.
   */
  muted?: boolean;
};

/** Official TikTok iframe player (autoplay muted; unmute via postMessage). */
export function buildTikTokPlayerUrl(videoId: string, opts?: TikTokPlayerOpts): string {
  const id = String(videoId || "").trim();
  if (!/^\d+$/.test(id)) {
    throw new Error("Invalid TikTok video id");
  }
  // Browsers force mute on cross-origin iframe autoplay — start muted=1.
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

export type TikTokPlayerMessage = {
  "x-tiktok-player": true;
  type: string;
  value?: unknown;
};

/** True when `data` is a TikTok embed-player postMessage payload. */
export function isTikTokPlayerMessage(data: unknown): data is TikTokPlayerMessage {
  if (!data || typeof data !== "object") return false;
  const rec = data as Record<string, unknown>;
  return rec["x-tiktok-player"] === true && typeof rec.type === "string";
}

/**
 * Send a host→player command to the TikTok embed iframe.
 * @see https://developers.tiktok.com/doc/embed-player
 */
export function postTikTokPlayer(
  iframe: HTMLIFrameElement | null | undefined,
  type: string,
  value?: unknown
): void {
  const win = iframe?.contentWindow;
  if (!win) return;
  const msg: TikTokPlayerMessage = { "x-tiktok-player": true, type };
  if (arguments.length >= 3) msg.value = value;
  win.postMessage(msg, TIKTOK_PLAYER_ORIGIN);
}
