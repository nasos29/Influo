import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO,
  parseHomepageBrandCtaDecorativePhotoSetting,
  serializeHomepageBrandCtaDecorativePhotoSetting,
} from "../lib/homepageBrandCtaDecorativePhoto.ts";

test("parse falls back to default when missing or invalid", () => {
  assert.equal(parseHomepageBrandCtaDecorativePhotoSetting(undefined), DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO);
  assert.equal(parseHomepageBrandCtaDecorativePhotoSetting(null), DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO);
  assert.equal(parseHomepageBrandCtaDecorativePhotoSetting(""), DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO);
  assert.equal(parseHomepageBrandCtaDecorativePhotoSetting("ftp://x"), DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO);
});

test("parse accepts local and https URLs", () => {
  assert.equal(
    parseHomepageBrandCtaDecorativePhotoSetting("/images/custom.webp"),
    "/images/custom.webp"
  );
  assert.equal(
    parseHomepageBrandCtaDecorativePhotoSetting("https://api.influo.gr/storage/v1/object/public/campaign-covers/a.webp"),
    "https://api.influo.gr/storage/v1/object/public/campaign-covers/a.webp"
  );
});

test("serialize returns null for default path (clear setting)", () => {
  assert.equal(serializeHomepageBrandCtaDecorativePhotoSetting(DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO), null);
  assert.equal(
    serializeHomepageBrandCtaDecorativePhotoSetting("https://example.com/x.webp"),
    "https://example.com/x.webp"
  );
});