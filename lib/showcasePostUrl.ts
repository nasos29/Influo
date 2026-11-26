import { isAllowedTopPostUrl } from "@/lib/topPosts";
import { detectProvider, isEmbeddableVideoUrl } from "@/lib/videoThumbnail";
import {
  isInstagramShareUrl,
  resolveInstagramShareUrl,
  type ShareResolveFetch,
} from "@/lib/resolveInstagramShareUrl";
import { parseSocialPostUrl } from "@/lib/socialPostUrl";

export type ShowcasePostProvider = "instagram" | "tiktok" | "youtube";

/** Valid IG/TT/YT HTTPS post link for public showcase embeds. */
export function showcasePostFields(urlRaw: unknown): {
  postUrl: string | null;
  postProvider: ShowcasePostProvider | null;
} {
  const url = typeof urlRaw === "string" ? urlRaw.trim() : "";
  if (!url || !isAllowedTopPostUrl(url)) return { postUrl: null, postProvider: null };
  if (!isEmbeddableVideoUrl(url) && !isInstagramShareUrl(url)) {
    return { postUrl: null, postProvider: null };
  }
  const parsed = parseSocialPostUrl(url);
  if (!parsed.ok) return { postUrl: null, postProvider: null };
  return { postUrl: parsed.url, postProvider: parsed.provider as ShowcasePostProvider };
}

/** Resolve Instagram share links before showcase persistence. */
export async function showcasePostFieldsResolved(
  urlRaw: unknown,
  fetchImpl?: ShareResolveFetch
): Promise<{ postUrl: string | null; postProvider: ShowcasePostProvider | null }> {
  const url = typeof urlRaw === "string" ? urlRaw.trim() : "";
  if (!url) return { postUrl: null, postProvider: null };
  if (isInstagramShareUrl(url)) {
    const resolved = await resolveInstagramShareUrl(url, fetchImpl);
    if (!resolved.ok) return { postUrl: null, postProvider: null };
    return showcasePostFields(resolved.url);
  }
  return showcasePostFields(url);
}
