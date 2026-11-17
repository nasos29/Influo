import { isAllowedTopPostUrl } from "@/lib/topPosts";
import { detectProvider } from "@/lib/videoThumbnail";

export type ShowcasePostProvider = "instagram" | "tiktok" | "youtube";

/** Valid IG/TT/YT HTTPS post link for public showcase embeds. */
export function showcasePostFields(urlRaw: unknown): {
  postUrl: string | null;
  postProvider: ShowcasePostProvider | null;
} {
  const url = typeof urlRaw === "string" ? urlRaw.trim() : "";
  if (!url || !isAllowedTopPostUrl(url)) return { postUrl: null, postProvider: null };
  return { postUrl: url, postProvider: detectProvider(url) };
}
