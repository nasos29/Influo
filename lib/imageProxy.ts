/**
 * Image URL helpers for public media.
 *
 * Historically we rewrote Supabase Storage URLs through `/api/image-proxy` to
 * cut egress. That adds a Vercel serverless hop and feels slow on cache MISS
 * (often 1–2s for a single avatar). Public bucket + Next.js Image optimization
 * is faster for users; enable the proxy only if needed via env.
 *
 * Set NEXT_PUBLIC_USE_IMAGE_PROXY=true to restore the proxy rewrite.
 */

export function getCachedImageUrl(url: string | null | undefined): string | null | undefined {
  if (!url || typeof url !== "string" || url.trim() === "") return url;
  const trimmed = url.trim();

  const useProxy =
    typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_USE_IMAGE_PROXY === "1" ||
      process.env.NEXT_PUBLIC_USE_IMAGE_PROXY === "true");

  if (!useProxy) return trimmed;

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
 * Cuts cold next/image time when originals are 0.5–2MB mislabeled PNGs.
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
