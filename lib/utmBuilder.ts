/** Shared UTM builder (Brand Tools + collaboration stored link). */

export function slugifyUtmSegment(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildInfluoUtmUrl(input: {
  baseUrl: string;
  campaign?: string;
  creator?: string;
  brandName?: string;
}): string {
  const base = String(input.baseUrl || "").trim();
  if (!base) return "";
  try {
    const u = new URL(base.includes("://") ? base : `https://${base}`);
    u.searchParams.set("utm_source", "influo");
    u.searchParams.set("utm_medium", "influencer");
    const campaign =
      slugifyUtmSegment(input.campaign || "") ||
      slugifyUtmSegment(input.brandName || "") ||
      "campaign";
    u.searchParams.set("utm_campaign", campaign);
    const creator = slugifyUtmSegment(input.creator || "");
    if (creator) u.searchParams.set("utm_content", creator);
    return u.toString();
  } catch {
    return "";
  }
}