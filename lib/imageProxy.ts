/**
 * Image URL helper for public media.
 *
 * Historically we rewrote Supabase Storage URLs through `/api/image-proxy` to
 * cut egress. That adds a Vercel serverless hop and feels slow on cache MISS
 * (often 1–2s for a single avatar). Public bucket + Next.js Image optimization
 * is faster for users; enable the proxy only if needed via env.
 *
 * Set NEXT_PUBLIC_USE_IMAGE_PROXY=true to restore the proxy rewrite.
 */

export function getCachedImageUrl(url: string | null | undefined): string | null | undefined {
  if (!url || typeof url !== 'string' || url.trim() === '') return url;
  const trimmed = url.trim();

  const useProxy =
    typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_USE_IMAGE_PROXY === '1' ||
      process.env.NEXT_PUBLIC_USE_IMAGE_PROXY === 'true');

  if (!useProxy) return trimmed;

  const isSupabaseStorage =
    (trimmed.includes('supabase.co') || trimmed.includes('supabase.in')) &&
    trimmed.includes('/storage/');
  if (isSupabaseStorage) {
    return `/api/image-proxy?url=${encodeURIComponent(trimmed)}`;
  }
  return trimmed;
}
