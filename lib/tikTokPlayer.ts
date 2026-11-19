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
    embed_from: "oembed",
  });
  return `https://www.tiktok.com/player/v1/${id}?${params.toString()}`;
}

/**
 * Permissions policy for every TikTok iframe (player/v1 and embed/v2).
 * Official oEmbed lists encrypted-media, but that token lets a cross-origin
 * iframe use EME / Widevine. On Android Chrome (Widevine L1) this:
 *   - sets a secure output path, so the OS blocks screenshots of the page
 *   - consumes limited MediaDrm hardware sessions; leaked sessions make later
 *     players fail with "Unable to load player"
 * Public embeds play without it (the Embed Player docs only list fullscreen).
 * Omitted on every form factor so SSR/client allow attributes stay in sync.
 * @see https://developers.tiktok.com/docs/en/embed-player
 * @see https://developer.android.com/reference/android/media/MediaDrm#openSession()
 */
export const TIKTOK_IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; fullscreen; gyroscope; picture-in-picture; web-share; storage-access";

/**
 * Sandbox for every embed/v2 iframe: scripts/origin/presentation so the
 * player can run, but no allow-popups or allow-top-navigation so author/logo
 * / "Open in TikTok" clicks cannot take the user off-site. Chrome is also
 * covered by click-catcher overlays in the card.
 */
export const TIKTOK_EMBED_IFRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-presentation";

/** Classic TikTok embed iframe (no official player API). Used as a Chrome fallback. */

export function buildTikTokEmbedUrl(videoId: string): string {
  const id = String(videoId || "").trim();
  if (!/^\d+$/.test(id)) {
    throw new Error("Invalid TikTok video id");
  }
  return `https://www.tiktok.com/embed/v2/${id}`;
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

/** True when the iframe is pointed at TikTok's player or embed document (not about:blank). */
export function isTikTokPlayerIframeSrc(src: string | null | undefined): boolean {
  if (!src || src === "about:blank") return false;
  try {
    const u = new URL(src, TIKTOK_PLAYER_ORIGIN);
    if (!u.hostname.endsWith("tiktok.com")) return false;
    return /\/player\/v1\/\d+/i.test(u.pathname) || /\/embed\/v2\/\d+/i.test(u.pathname);
  } catch {
    return /tiktok\.com\/player\/v1\//i.test(src) || /tiktok\.com\/embed\/v2\//i.test(src);
  }
}

/**
 * Navigate a TikTok iframe off tiktok.com so MediaDrm / EME sessions can be
 * released before React unmounts the element. Call this, then unmount (or
 * set a new src) on the next frame.
 */
export function disposeTikTokIframe(iframe: HTMLIFrameElement | null | undefined): void {
  if (!iframe) return;
  try {
    const current = iframe.getAttribute("src") || iframe.src || "";
    if (!current || current === "about:blank") return;
    iframe.src = "about:blank";
  } catch {
    /* ignore */
  }
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
  if (!win || !iframe) return;
  const src = iframe.getAttribute("src") || iframe.src || "";
  if (!isTikTokPlayerIframeSrc(src)) return;
  const msg: TikTokPlayerMessage = { "x-tiktok-player": true, type };
  if (arguments.length >= 3) msg.value = value;
  try {
    win.postMessage(msg, TIKTOK_PLAYER_ORIGIN);
  } catch {
    /* cross-origin recipient mismatch */
  }
}

/**
 * Mobile browser (phone / Android / iPhone). These start on classic embed/v2.
 * Desktop stays on official player/v1; embed/v2 is an immediate fallback
 * after a player/v1 playback error (3001/1004/2005 or ready-timeout).
 */
export function isTikTokMobileUa(ua: string): boolean {
  return /Mobile|Android|iPhone|iPod/i.test(String(ua || ""));
}

/** True when the first path should be embed/v2 (all mobile UAs). */
export function preferTikTokEmbedPlayerFromUA(ua: string): boolean {
  return isTikTokMobileUa(ua);
}

export function preferTikTokEmbedPlayer(): boolean {
  if (typeof navigator === "undefined") return false;
  return preferTikTokEmbedPlayerFromUA(navigator.userAgent);
}

/**
 * Silent embed/v2 fallback after a player/v1 error is allowed on every UA,
 * including Android Chrome. The first path is still always player/v1.
 */
export function allowTikTokEmbedFallbackFromUA(_ua: string): boolean {
  return true;
}

export function allowTikTokEmbedFallback(): boolean {
  if (typeof navigator === "undefined") return true;
  return allowTikTokEmbedFallbackFromUA(navigator.userAgent);
}

/**
 * Sandbox attr for an embed/v2 iframe. Applied on every UA, including
 * mobile, so author/logo navigation cannot leave the site. Undefined
 * only during SSR, when the iframe is not mounted.
 */
export function tikTokEmbedIframeSandboxFromUA(_ua: string): string | undefined {
  return TIKTOK_EMBED_IFRAME_SANDBOX;
}

export function tikTokEmbedIframeSandbox(): string | undefined {
  if (typeof navigator === "undefined") return undefined;
  return tikTokEmbedIframeSandboxFromUA(navigator.userAgent);
}

const tikTokVideoIdCache = new Map<string, string>();

/** Cached id from the watch URL, or a previous /api/video-embed resolution. */
export function cachedTikTokVideoId(originalUrl: string): string | null {
  return extractTikTokVideoId(originalUrl) || tikTokVideoIdCache.get(originalUrl) || null;
}

export function rememberTikTokVideoId(originalUrl: string, id: string): void {
  const trimmed = String(id || "").trim();
  if (/^\d+$/.test(trimmed)) tikTokVideoIdCache.set(originalUrl, trimmed);
}
