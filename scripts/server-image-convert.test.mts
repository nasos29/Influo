import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import {
  convertImageBufferToWebp,
  isConvertibleRasterInput,
  looksLikeHeicOrHeif,
} from "../lib/serverImageConvert.ts";

describe("looksLikeHeicOrHeif", () => {
  it("detects mime and extension", () => {
    assert.equal(looksLikeHeicOrHeif({ mime: "image/heic" }), true);
    assert.equal(looksLikeHeicOrHeif({ mime: "image/heif" }), true);
    assert.equal(looksLikeHeicOrHeif({ fileName: "IMG_7897.HEIC" }), true);
    assert.equal(looksLikeHeicOrHeif({ fileName: "photo.heif" }), true);
    assert.equal(looksLikeHeicOrHeif({ mime: "image/jpeg", fileName: "a.jpg" }), false);
  });

  it("detects ftyp brands in bytes", () => {
    // Minimal ISO BMFF: size(4) + 'ftyp' + brand 'heic'
    const buf = Buffer.alloc(12);
    buf.writeUInt32BE(12, 0);
    buf.write("ftyp", 4, "ascii");
    buf.write("heic", 8, "ascii");
    assert.equal(looksLikeHeicOrHeif({ bytes: buf }), true);

    const mif1 = Buffer.alloc(12);
    mif1.writeUInt32BE(12, 0);
    mif1.write("ftyp", 4, "ascii");
    mif1.write("mif1", 8, "ascii");
    assert.equal(looksLikeHeicOrHeif({ bytes: mif1 }), true);
  });
});

describe("isConvertibleRasterInput", () => {
  it("allows empty mime with heic extension", () => {
    assert.equal(
      isConvertibleRasterInput({ mime: "", fileName: "avatar.heic" }),
      true
    );
  });

  it("rejects svg/gif", () => {
    assert.equal(isConvertibleRasterInput({ mime: "image/svg+xml" }), false);
    assert.equal(isConvertibleRasterInput({ mime: "image/gif" }), false);
  });
});

describe("convertImageBufferToWebp", () => {
  it("converts a jpeg buffer to webp", async () => {
    const jpeg = await sharp({
      create: { width: 32, height: 24, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .jpeg()
      .toBuffer();
    const out = await convertImageBufferToWebp(jpeg, { maxSide: 16, webpQuality: 0.7 });
    assert.equal(out.contentType, "image/webp");
    assert.equal(out.extension, "webp");
    assert.ok(out.buffer.byteLength > 20);
    const meta = await sharp(out.buffer).metadata();
    assert.equal(meta.format, "webp");
    assert.ok((meta.width ?? 0) <= 16);
    assert.ok((meta.height ?? 0) <= 16);
  });

  it("converts a real HEIC sample to webp when present", async () => {
    const fs = await import("node:fs");
    const path = "tmp-heic/constantina.heic";
    if (!fs.existsSync(path)) {
      // Sample is downloaded during the fix task; skip in CI without fixtures.
      return;
    }
    const heic = fs.readFileSync(path);
    assert.equal(looksLikeHeicOrHeif({ bytes: heic, fileName: "x.heic" }), true);
    const out = await convertImageBufferToWebp(heic, { maxSide: 640, webpQuality: 0.72 });
    assert.equal(out.contentType, "image/webp");
    const meta = await sharp(out.buffer).metadata();
    assert.equal(meta.format, "webp");
    assert.ok((meta.width ?? 0) <= 640);
    assert.ok((meta.height ?? 0) <= 640);
    assert.ok(out.buffer.byteLength > 500);
  });
});
