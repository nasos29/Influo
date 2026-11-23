import type { HostedMedia } from "@/lib/creatorMedia";
import { lookupHostedMedia } from "@/lib/creatorMedia";
import { detectProvider } from "@/lib/videoThumbnail";
import type { TopPost } from "@/lib/topPosts";

/** Drop unhosted IG/TikTok for hosted-only creators; keep YouTube and ready self-hosted. */
export function filterTopPostsForHostedOnly(
  posts: TopPost[],
  hostedByUrl: Map<string, HostedMedia> | undefined,
  igTikTokHostedOnly: boolean
): TopPost[] {
  if (!igTikTokHostedOnly) return posts;
  return posts.filter((post) => {
    const provider = detectProvider(post.url);
    if (!provider) return false;
    if (provider === "youtube") return true;
    if (provider === "instagram" || provider === "tiktok") {
      return Boolean(lookupHostedMedia(hostedByUrl ?? new Map(), post.url)?.playUrl);
    }
    return true;
  });
}