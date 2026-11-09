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

/** CDN width for public creator cards (~2× a 5-col card on 1920px). */
export const CREATOR_CARD_PHOTO_WIDTH = 640;

/**
 * CDN width for lightbox / full-size profile photos.
 * Large enough for ~2× a 900px modal on retina; Image Transformation also
 * re-encodes HEIC/HEIF (and similar) to browser-safe JPEG/WebP.
 */
export const CREATOR_FULLSIZE_PHOTO_WIDTH = 1600;

/**
 * Resize public Supabase Storage images at the CDN (Image Transformation).
 * Cuts bytes per view when originals are large; pair with getCachedImageUrl
 * so the transformed result is cached on Vercel instead of re-hit every page.
 *
 * Pass height for hard cover crops (square thumbs). Omit height for creator
 * cards so CSS `object-fit: cover` + `object-position` control framing —
 * but then you MUST set resize=contain. Supabase defaults to cover; with only
 * width that yields a vertical center strip (e.g. 640×2048 from 1536×2048),
 * which CSS then zooms into an eye/wall crop inside the 4:5 card.
 *
 * @param quality JPEG/WebP quality 1–100. Cards use 50; lightbox uses higher.
 */
export function getStorageCardUrl(
  url: string | null | undefined,
  width = 400,
  height?: number,
  quality = 50
): string | null | undefined {
  if (!url || typeof url !== "string" || url.trim() === "") return url;
  const trimmed = url.trim();

  // Already a render URL — leave alone (avoid double-transform / path mangling).
  if (trimmed.includes("/storage/v1/render/image/public/")) return trimmed;

  const marker = "/storage/v1/object/public/";
  const idx = trimmed.indexOf(marker);
  if (idx === -1) return trimmed;
  if (!trimmed.includes("supabase.co") && !trimmed.includes("supabase.in")) {
    return trimmed;
  }

  const originAndPath = trimmed.slice(0, idx);
  const objectPath = trimmed.slice(idx + marker.length).split("?")[0];
  if (!objectPath) return trimmed;

  const q = Math.min(100, Math.max(1, Math.round(quality)));
  const params = new URLSearchParams({
    width: String(Math.max(32, Math.round(width))),
    quality: String(q),
  });
  if (height && height > 0) {
    params.set("height", String(Math.max(32, Math.round(height))));
    params.set("resize", "cover");
  } else {
    // Width-only: keep full subject/aspect. Never omit resize (CDN default=cover).
    params.set("resize", "contain");
  }

  return `${originAndPath}/storage/v1/render/image/public/${objectPath}?${params.toString()}`;
}

/** Creator-card photo URL: width-scaled contain; CSS crops to 4:5 with face bias. */
export function getCreatorCardPhotoUrl(
  url: string | null | undefined
): string | null | undefined {
  return getStorageCardUrl(url, CREATOR_CARD_PHOTO_WIDTH);
}

/**
 * Full-size / lightbox photo URL.
 * Prefer CDN contain transform so HEIC originals (and huge JPEGs) become a
 * browser-displayable large image. Callers should fall back to the original
 * object URL if the transform fails to load.
 */
export function getCreatorFullSizePhotoUrl(
  url: string | null | undefined
): string | null | undefined {
  return getStorageCardUrl(url, CREATOR_FULLSIZE_PHOTO_WIDTH, undefined, 80);
}

/** Best URL to show in a lightbox: full-size CDN when possible, else original. */
export function getLightboxPhotoUrl(
  url: string | null | undefined
): string | null | undefined {
  if (!url || typeof url !== "string" || url.trim() === "") return url;
  const full = getCreatorFullSizePhotoUrl(url) ?? url;
  return getCachedImageUrl(full) ?? full;
}

/** Original Storage object URL (proxied when enabled) for lightbox fallback. */
export function getLightboxFallbackPhotoUrl(
  url: string | null | undefined
): string | null | undefined {
  if (!url || typeof url !== "string" || url.trim() === "") return url;
  const trimmed = url.trim();
  // If caller already passed a render URL, try to recover the object URL.
  const renderMarker = "/storage/v1/render/image/public/";
  const renderIdx = trimmed.indexOf(renderMarker);
  let objectUrl = trimmed;
  if (renderIdx !== -1) {
    const originAndPath = trimmed.slice(0, renderIdx);
    const objectPath = trimmed.slice(renderIdx + renderMarker.length).split("?")[0];
    if (objectPath) {
      objectUrl = `${originAndPath}/storage/v1/object/public/${objectPath}`;
    }
  }
  return getCachedImageUrl(objectUrl) ?? objectUrl;
}
