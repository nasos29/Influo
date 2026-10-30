import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getCachedImageUrl, getStorageCardUrl } from "../lib/imageProxy.ts";

const SAMPLE =
  "https://abcd.supabase.co/storage/v1/object/public/avatars/user.webp";

describe("getCachedImageUrl", () => {
  const prev = process.env.NEXT_PUBLIC_USE_IMAGE_PROXY;

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_USE_IMAGE_PROXY;
    else process.env.NEXT_PUBLIC_USE_IMAGE_PROXY = prev;
  });

  it("rewrites Supabase storage URLs by default", () => {
    delete process.env.NEXT_PUBLIC_USE_IMAGE_PROXY;
    const out = getCachedImageUrl(SAMPLE);
    assert.equal(out, `/api/image-proxy?url=${encodeURIComponent(SAMPLE)}`);
  });

  it("skips rewrite when explicitly disabled", () => {
    process.env.NEXT_PUBLIC_USE_IMAGE_PROXY = "false";
    assert.equal(getCachedImageUrl(SAMPLE), SAMPLE);
  });

  it("does not double-wrap proxy URLs", () => {
    delete process.env.NEXT_PUBLIC_USE_IMAGE_PROXY;
    const once = getCachedImageUrl(SAMPLE)!;
    assert.equal(getCachedImageUrl(once), once);
  });

  it("leaves non-storage URLs alone", () => {
    delete process.env.NEXT_PUBLIC_USE_IMAGE_PROXY;
    assert.equal(getCachedImageUrl("https://img.youtube.com/vi/x/hqdefault.jpg"), "https://img.youtube.com/vi/x/hqdefault.jpg");
  });
});

describe("getStorageCardUrl", () => {
  it("rewrites object/public to render/image", () => {
    const out = getStorageCardUrl(SAMPLE, 200, 200);
    assert.ok(out?.includes("/storage/v1/render/image/public/avatars/user.webp"));
    assert.ok(out?.includes("width=200"));
    assert.ok(out?.includes("height=200"));
  });
});
