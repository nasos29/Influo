import { normalizeSourceUrl } from "@/lib/creatorMedia";

export type FeaturedCollaborationPlatform = "instagram" | "tiktok";

/** Derive IG/TikTok from deliverable URL, then optional hosted source URL. */
export function featuredCollaborationPlatform(
  deliverableUrl: string,
  sourceUrl?: string | null
): FeaturedCollaborationPlatform | null {
  for (const raw of [deliverableUrl, sourceUrl]) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const n = normalizeSourceUrl(raw.trim());
    if (/tiktok\.com|vm\.tiktok|vt\.tiktok/.test(n)) return "tiktok";
    if (/instagram\.com|instagr\.am/.test(n)) return "instagram";
  }
  return null;
}