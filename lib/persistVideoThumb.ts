/**
 * Download a TikTok/Instagram cover and store it in public Supabase Storage
 * (`video-thumbs`) so clients don't depend on short-lived signed CDN URLs.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const VIDEO_THUMBS_BUCKET = "video-thumbs";
const MAX_BYTES = 500 * 1024;
const YEAR_CACHE = "31536000";

let bucketReady: Promise<boolean> | null = null;

async function ensureVideoThumbsBucket(admin: SupabaseClient): Promise<boolean> {
  if (!bucketReady) {
    bucketReady = (async () => {
      try {
        const { data: buckets } = await admin.storage.listBuckets();
        const exists = (buckets || []).some((b) => b.name === VIDEO_THUMBS_BUCKET);
        if (exists) return true;
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

/**
 * Fetch remote cover (≤500KB, image/*), upload to video-thumbs, return public URL.
 * Path: `<platform>/<sha1(clean url)>.jpg`. Returns null on failure (signed-CDN fallback).
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
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
        ...(platform === "instagram" ? { Referer: "https://www.instagram.com/" } : {}),
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("image/")) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 32 || buf.byteLength > MAX_BYTES) return null;

    const path = `${platform}/${sha1Hex(originalUrl)}.jpg`;
    const { error: uploadError } = await admin.storage.from(VIDEO_THUMBS_BUCKET).upload(path, buf, {
      contentType: contentType.split(";")[0].trim() || "image/jpeg",
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
