/**
 * Image URL helpers for public media.
 *
 * By default, Supabase Storage URLs are rewritten through `/api/image-proxy`
 * so Vercel can cache them (30d Cache-Control) and cut Storage Cached Egress.
 * First fetch still hits Supabase; repeats are served from the app CDN.
 *
 * Opt out with NEXT_PUBLIC_USE_IMAGE_PROXY=false (or "0") if you put a CDN
 * in front of Storage and prefer direct URLs.
 */

function wantsImageProxy(): boolean {
  if (typeof process === "undefined") return true;
  const flag = process.env.NEXT_PUBLIC_USE_IMAGE_PROXY;
  if (flag === "0" || flag === "false") return false;
  return true;
}

export function getCachedImageUrl(url: string | null | undefined): string | null | undefined {
  if (!url || typeof url !== "string" || url.trim() === "") return url;
  const trimmed = url.trim();

  // Already proxied (avoid double-encoding when callers + FastImage both wrap).
  if (trimmed.startsWith("/api/image-proxy")) return trimmed;

  if (!wantsImageProxy()) return trimmed;

  const isSupabaseStorage =
    (trimmed.includes("supabase.co") || trimmed.includes("supabase.in")) &&
    trimmed.includes("/storage/");
  if (isSupabaseStorage) {
    return `/api/image-proxy?url=${encodeURIComponent(trimmed)}`;
  }
  return trimmed;
}

/**
 * Resize public Supabase Storage images at the CDN (Image Transformation).
 * Cuts bytes per view when originals are large; pair with getCachedImageUrl
 * so the transformed result is cached on Vercel instead of re-hit every page.
 */
export function getStorageCardUrl(
  url: string | null | undefined,
  width = 400,
  height?: number
): string | null | undefined {
  if (!url || typeof url !== "string" || url.trim() === "") return url;
  const trimmed = url.trim();

  const marker = "/storage/v1/object/public/";
  const idx = trimmed.indexOf(marker);
  if (idx === -1) return trimmed;
  if (!trimmed.includes("supabase.co") && !trimmed.includes("supabase.in")) {
    return trimmed;
  }

  const originAndPath = trimmed.slice(0, idx);
  const objectPath = trimmed.slice(idx + marker.length).split("?")[0];
  if (!objectPath) return trimmed;

  const params = new URLSearchParams({
    width: String(Math.max(32, Math.round(width))),
    resize: "cover",
    quality: "50",
  });
  if (height && height > 0) {
    params.set("height", String(Math.max(32, Math.round(height))));
  }

  return `${originAndPath}/storage/v1/render/image/public/${objectPath}?${params.toString()}`;
}
