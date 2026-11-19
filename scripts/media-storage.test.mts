// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/media-storage.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  mediaPublicBaseUrl,
  mediaStorageBackend,
  publicMediaUrl,
} from "../lib/mediaStorage.ts";

function withEnv(values: Record<string, string | undefined>, fn: () => void) {
  const keys = [
    "MEDIA_STORAGE_BACKEND",
    "NEXT_PUBLIC_MEDIA_STORAGE_BACKEND",
    "MEDIA_PUBLIC_BASE_URL",
    "NEXT_PUBLIC_MEDIA_PUBLIC_BASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "R2_BUCKET",
    "MEDIA_BUCKET",
  ];
  const prev: Record<string, string | undefined> = {};
  for (const key of keys) prev[key] = process.env[key];
  for (const key of keys) delete process.env[key];
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const key of keys) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }
}

test("defaults to current Supabase public URLs", () => {
  withEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://api.influo.gr" }, () => {
    assert.equal(mediaStorageBackend(), "supabase");
    assert.equal(
      mediaPublicBaseUrl(),
      "https://api.influo.gr/storage/v1/object/public/creator-videos"
    );
    assert.equal(
      publicMediaUrl("creators/abc/portfolio/instagram-x/video.mp4"),
      "https://api.influo.gr/storage/v1/object/public/creator-videos/creators/abc/portfolio/instagram-x/video.mp4"
    );
  });
});

test("R2 uses MEDIA_PUBLIC_BASE_URL only, with config and no extra path prefix", () => {
  withEnv(
    {
      MEDIA_STORAGE_BACKEND: "r2",
      MEDIA_PUBLIC_BASE_URL: "https://media.example.com",
      NEXT_PUBLIC_SUPABASE_URL: "https://api.influo.gr",
    },
    () => {
      assert.equal(mediaStorageBackend(), "r2");
      assert.equal(
        publicMediaUrl("/creators/abc/top-posts/tiktok-1/video.mp4"),
        "https://media.example.com/creators/abc/top-posts/tiktok-1/video.mp4"
      );
    }
  );
});
