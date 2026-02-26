/**
 * Use cached image proxy for Supabase Storage URLs to reduce egress.
 * Returns proxy URL for Supabase storage, otherwise the original URL.
 */

export function getCachedImageUrl(url: string | null | undefined): string | null | undefined {
  if (!url || typeof url !== 'string' || url.trim() === '') return url;
  const trimmed = url.trim();
  if (trimmed.includes('supabase.co') && trimmed.includes('/storage/')) {
    return `/api/image-proxy?url=${encodeURIComponent(trimmed)}`;
  }
  return url;
}
