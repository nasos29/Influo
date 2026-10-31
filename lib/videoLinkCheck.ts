/**
 * Decide whether a stored profile video URL still exists.
 * Unknown (rate limit, timeout, 5xx, login wall, malformed) is never "missing".
 */

export type VideoPlatform = "instagram" | "tiktok" | "youtube";

export type LinkOutcome = "live" | "missing" | "unknown";

export type LinkCheck = {
  outcome: LinkOutcome;
  platform: VideoPlatform;
  httpStatus: number | null;
  detail: string;
};

const UA = "InfluoLinkCheck/1.0 (+https://www.influo.gr)";
const REQUEST_TIMEOUT_MS = 8000;

/** Second "missing" only counts after this gap, so one bad night cannot delete a link. */
export const MISSING_CONFIRM_GAP_MS = 72 * 60 * 60 * 1000;

export type MissingState = {
  missingCount: number;
  firstMissingAt: string | null;
};

export function decideRemoval(
  previous: MissingState | null,
  outcome: LinkOutcome,
  now: Date
): MissingState & { remove: boolean } {
  if (outcome === "unknown") {
    return {
      missingCount: previous?.missingCount ?? 0,
      firstMissingAt: previous?.firstMissingAt ?? null,
      remove: false,
    };
  }
  if (outcome === "live") {
    return { missingCount: 0, firstMissingAt: null, remove: false };
  }

  const count = previous?.missingCount ?? 0;
  const first = previous?.firstMissingAt ?? null;
  if (count < 1 || !first) {
    return { missingCount: 1, firstMissingAt: now.toISOString(), remove: false };
  }
  const elapsed = now.getTime() - new Date(first).getTime();
  if (!Number.isFinite(elapsed) || elapsed < MISSING_CONFIRM_GAP_MS) {
    return { missingCount: 1, firstMissingAt: first, remove: false };
  }
  return { missingCount: count + 1, firstMissingAt: first, remove: true };
}

/** Post/video URLs we know how to check. Profile and channel links are left alone. */
export function classifyVideoUrl(raw: string): { platform: VideoPlatform; kind: "post" | "short" } | null {
  const url = (raw || "").trim();
  if (!url) return null;

  if (/instagram\.com\/(?:p|reel|tv)\/[A-Za-z0-9_-]+/i.test(url)) {
    return { platform: "instagram", kind: "post" };
  }
  if (/tiktok\.com\/@[^/?#\s]+\/(?:video|photo)\/\d+/i.test(url)) {
    return { platform: "tiktok", kind: "post" };
  }
  if (/(?:vm|vt)\.tiktok\.com\/[A-Za-z0-9]+/i.test(url) || /tiktok\.com\/t\/[A-Za-z0-9]+/i.test(url)) {
    return { platform: "tiktok", kind: "short" };
  }
  if (youtubeId(url)) return { platform: "youtube", kind: "post" };
  return null;
}

function youtubeId(raw: string): string | null {
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})(?:[?#/]|$)/i,
    /youtube\.com\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})(?:[?#/]|$)/i,
    /[?&]v=([A-Za-z0-9_-]{11})(?:&|$)/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function instagramCanonical(raw: string): string | null {
  const match = raw.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/i);
  if (!match) return null;
  return `https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/`;
}

function tiktokVideoCanonical(raw: string): string | null {
  const match = raw.match(/tiktok\.com\/@([^/?#\s]+)\/(video|photo)\/(\d+)/i);
  if (!match) return null;
  return `https://www.tiktok.com/@${match[1]}/${match[2].toLowerCase()}/${match[3]}`;
}

type HttpResult =
  | { ok: true; status: number; body: string; contentType: string; finalUrl: string }
  | { ok: false; detail: string };

async function request(
  url: string,
  redirect: RequestRedirect
): Promise<HttpResult> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*" },
    });
    // oEmbed JSON is often longer than a short preview. Keep enough to parse,
    // and only shorten it later when storing a detail string.
    const body = (await response.text()).slice(0, 100_000);
    return {
      ok: true,
      status: response.status,
      body,
      contentType: response.headers.get("content-type") || "",
      finalUrl: response.url || url,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "request failed";
    return { ok: false, detail };
  }
}

function looksLikeWall(status: number, body: string, contentType: string): boolean {
  if (status === 401 || status === 403 || status === 429 || status >= 500) return true;
  if (contentType.includes("text/html") && status !== 404) return true;
  // A real oEmbed document can mention "login" in a caption. Only scan error bodies.
  if (status !== 200 && /rate.?limit|too many|captcha|checkpoint|login|log in|please wait/i.test(body)) {
    return true;
  }
  return false;
}

function interpretOembed(platform: VideoPlatform, result: HttpResult): LinkCheck {
  if (!result.ok) {
    return { outcome: "unknown", platform, httpStatus: null, detail: result.detail };
  }
  const { status, body, contentType } = result;
  if (looksLikeWall(status, body, contentType)) {
    return { outcome: "unknown", platform, httpStatus: status, detail: body.slice(0, 120) || `http ${status}` };
  }
  if (status === 200) {
    try {
      const json = JSON.parse(body) as { title?: string; author_name?: string; media_id?: string; type?: string };
      if (json.title || json.author_name || json.media_id || json.type) {
        return { outcome: "live", platform, httpStatus: status, detail: "oembed" };
      }
    } catch {
      return { outcome: "unknown", platform, httpStatus: status, detail: "oembed was not json" };
    }
    return { outcome: "unknown", platform, httpStatus: status, detail: "oembed json had no media" };
  }

  if (platform === "instagram" && status === 404 && /no media match/i.test(body)) {
    return { outcome: "missing", platform, httpStatus: status, detail: "No Media Match" };
  }
  if (platform === "youtube" && status === 404) {
    return { outcome: "missing", platform, httpStatus: status, detail: "Not Found" };
  }
  if (platform === "tiktok" && (status === 400 || status === 404)) {
    try {
      const json = JSON.parse(body) as { message?: string; code?: number };
      if (json.code === 400 && /something went wrong/i.test(json.message || "")) {
        return { outcome: "missing", platform, httpStatus: status, detail: json.message || "missing" };
      }
    } catch {
      if (status === 404) {
        return { outcome: "missing", platform, httpStatus: status, detail: "Not Found" };
      }
    }
    return { outcome: "unknown", platform, httpStatus: status, detail: body.slice(0, 120) };
  }

  return { outcome: "unknown", platform, httpStatus: status, detail: body.slice(0, 120) || `http ${status}` };
}

async function oembed(platform: VideoPlatform, target: string): Promise<LinkCheck> {
  const endpoint =
    platform === "instagram"
      ? `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(target)}`
      : platform === "youtube"
        ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(target)}`
        : `https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`;
  return interpretOembed(platform, await request(endpoint, "follow"));
}

/**
 * Follow a vm/vt link. Homepage landings are unknown (TikTok does this for crawlers)
 * — never treat as missing. Login, captcha, and transport errors stay unknown.
 */
async function resolveTikTokShort(raw: string): Promise<
  | { kind: "video"; url: string }
  | { kind: "unknown"; detail: string }
> {
  let current = raw.trim();
  for (let hop = 0; hop < 5; hop++) {
    let response: Response;
    try {
      response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { "User-Agent": UA },
      });
      await response.body?.cancel();
    } catch (error) {
      return { kind: "unknown", detail: error instanceof Error ? error.message : "timeout" };
    }
    if (response.status === 429 || response.status === 401 || response.status === 403 || response.status >= 500) {
      return { kind: "unknown", detail: `http ${response.status}` };
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { kind: "unknown", detail: "redirect without location" };
      current = new URL(location, current).href;
      continue;
    }
    break;
  }

  const withUser = current.match(
    /https?:\/\/(?:www\.)?tiktok\.com\/@([^/?#]+)\/(?:video|photo)\/(\d+)/i
  );
  if (withUser?.[1]) {
    return { kind: "video", url: `https://www.tiktok.com/@${withUser[1]}/video/${withUser[2]}` };
  }
  // Short fallback often lands on /@/photo/{id} (empty username) — still a live item.
  const idOnly = current.match(/\/(?:video|photo)\/(\d+)/);
  if (idOnly) return { kind: "video", url: `https://www.tiktok.com/video/${idOnly[1]}` };
  try {
    const path = new URL(current).pathname;
    if (path === "/" || path === "") {
      return { kind: "unknown", detail: "short link redirected to homepage" };
    }
  } catch {
    return { kind: "unknown", detail: "bad redirect url" };
  }
  return { kind: "unknown", detail: `landed on ${current.slice(0, 120)}` };
}

export async function checkVideoLink(raw: string): Promise<LinkCheck | null> {
  const classified = classifyVideoUrl(raw);
  if (!classified) return null;

  if (classified.platform === "instagram") {
    const canonical = instagramCanonical(raw);
    if (!canonical) return null;
    return oembed("instagram", canonical);
  }

  if (classified.platform === "youtube") {
    const id = youtubeId(raw);
    if (!id) return null;
    return oembed("youtube", `https://www.youtube.com/watch?v=${id}`);
  }

  if (classified.kind === "short") {
    const resolved = await resolveTikTokShort(raw);
    if (resolved.kind === "unknown") {
      return { outcome: "unknown", platform: "tiktok", httpStatus: null, detail: resolved.detail };
    }
    return oembed("tiktok", resolved.url);
  }

  const canonical = tiktokVideoCanonical(raw);
  if (!canonical) return null;
  return oembed("tiktok", canonical);
}
