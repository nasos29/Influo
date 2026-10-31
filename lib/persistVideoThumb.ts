/**
 * Download a TikTok/Instagram cover and store it in public Supabase Storage
 * (`video-thumbs`) so clients don't depend on short-lived signed CDN URLs.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const VIDEO_THUMBS_BUCKET = "video-thumbs";
/** Photo-mode TikTok frames are often larger than short video covers. */
const MAX_BYTES = 2 * 1024 * 1024;
const YEAR_CACHE = "31536000";

let bucketReady: Promise<boolean> | null = null;

async function ensureVideoThumbsBucket(admin: SupabaseClient): Promise<boolean> {
  if (!bucketReady) {
    bucketReady = (async () => {
      try {
        const { data: buckets } = await admin.storage.listBuckets();
        const exists = (buckets || []).some((b) => b.name === VIDEO_THUMBS_BUCKET);
        if (exists) {
          // Raise limit for photo-mode frames (best-effort; ignore update errors).
          try {
            await admin.storage.updateBucket(VIDEO_THUMBS_BUCKET, {
              public: true,
              fileSizeLimit: MAX_BYTES,
              allowedMimeTypes: [
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/webp",
                "image/gif",
              ],
            });
          } catch {
            /* ignore */
          }
          return true;
        }
        const { error } = await admin.storage.createBucket(VIDEO_THUMBS_BUCKET, {
          public: true,
          fileSizeLimit: MAX_BYTES,
          allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"],
        });
        if (error && !/already exists|duplicate/i.test(error.message)) {
          console.error("[persistVideoThumb] createBucket", error.message);
          return false;
        }
        return true;
      } catch (e) {
        console.error("[persistVideoThumb] ensureBucket", e);
        return false;
      }
    })();
  }
  return bucketReady;
}

function sha1Hex(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}

function looksLikeImageMagic(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  // WEBP (RIFF....WEBP)
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return true;
  }
  return false;
}

/**
 * Fetch remote cover, upload to video-thumbs, return public Supabase URL.
 * Path: `<platform>/<sha1(clean url)>.jpg`. Returns null on failure (never raw CDN).
 */
export async function persistVideoThumbToStorage(
  admin: SupabaseClient,
  platform: "tiktok" | "instagram",
  originalUrl: string,
  imageUrl: string
): Promise<string | null> {
  if (!imageUrl || !originalUrl) return null;
  const ok = await ensureVideoThumbsBucket(admin);
  if (!ok) return null;

  try {
    const referer =
      platform === "instagram"
        ? "https://www.instagram.com/"
        : "https://www.tiktok.com/";
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: referer,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;

    const headerType = (res.headers.get("content-type") || "").toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 32 || buf.byteLength > MAX_BYTES) return null;

    const isImageHeader = headerType.startsWith("image/");
    if (!isImageHeader && !looksLikeImageMagic(buf)) return null;

    let contentType = headerType.split(";")[0].trim();
    if (!contentType.startsWith("image/")) {
      if (buf[0] === 0xff && buf[1] === 0xd8) contentType = "image/jpeg";
      else if (buf[0] === 0x89 && buf[1] === 0x50) contentType = "image/png";
      else if (buf[0] === 0x47 && buf[1] === 0x49) contentType = "image/gif";
      else contentType = "image/webp";
    }

    const path = `${platform}/${sha1Hex(originalUrl)}.jpg`;
    const { error: uploadError } = await admin.storage.from(VIDEO_THUMBS_BUCKET).upload(path, buf, {
      contentType,
      cacheControl: YEAR_CACHE,
      upsert: true,
    });
    if (uploadError) {
      console.error("[persistVideoThumb] upload", uploadError.message);
      return null;
    }

    const { data } = admin.storage.from(VIDEO_THUMBS_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.error("[persistVideoThumb]", e);
    return null;
  }
}

export function isVideoThumbsStorageUrl(url: string): boolean {
  return (
    !!url &&
    url.includes("/storage/") &&
    url.includes(`/${VIDEO_THUMBS_BUCKET}/`)
  );
}
