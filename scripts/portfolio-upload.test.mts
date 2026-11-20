import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  MAX_UPLOAD_PHOTO_BYTES,
  MAX_UPLOAD_VIDEO_BYTES,
  UPLOAD_CHUNK_BYTES,
  UPLOAD_PARALLEL_CHUNKS,
  chunkCount,
  chunkObjectPath,
  isUploadedPortfolioUrl,
  portfolioSlotsLeft,
  sniffMediaType,
  uploadMediaType,
  validateChunk,
  validateUploadRequest,
  PORTFOLIO_FILE_ACCEPT,
} from "../lib/portfolioUpload.ts";

test("parallel upload window is 2–4", () => {
  assert.ok(UPLOAD_PARALLEL_CHUNKS >= 2 && UPLOAD_PARALLEL_CHUNKS <= 4);
});

test("file input accept lists explicit MIME and extensions (no wildcards)", () => {
  assert.match(PORTFOLIO_FILE_ACCEPT, /video\/mp4/);
  assert.doesNotMatch(PORTFOLIO_FILE_ACCEPT, /video\/\*/);
  assert.doesNotMatch(PORTFOLIO_FILE_ACCEPT, /image\/\*/);
  assert.match(PORTFOLIO_FILE_ACCEPT, /\.heic/);
  assert.match(PORTFOLIO_FILE_ACCEPT, /application\/octet-stream/);
});

test("type detection: MIME first, extension fallback for empty/octet-stream (iOS HEIC)", () => {
  assert.equal(uploadMediaType("video/quicktime", "a.mov"), "video");
  assert.equal(uploadMediaType("image/heic", "a.heic"), "photo");
  assert.equal(uploadMediaType("", "IMG_1.HEIC"), "photo");
  assert.equal(uploadMediaType("application/octet-stream", "clip.mp4"), "video");
  assert.equal(uploadMediaType("image/gif", "a.gif"), null);
  assert.equal(uploadMediaType("application/pdf", "a.mp4"), null);
});

test("limits: video 500 MB / 3 min, photo 20 MB", () => {
  assert.equal(validateUploadRequest({ mimeType: "video/mp4", size: MAX_UPLOAD_VIDEO_BYTES }).ok, true);
  const big = validateUploadRequest({ mimeType: "video/mp4", size: MAX_UPLOAD_VIDEO_BYTES + 1 });
  assert.equal(big.ok, false);
  assert.equal(!big.ok && big.code, "size");
  const long = validateUploadRequest({ mimeType: "video/mp4", size: 1000, durationSec: 181 });
  assert.equal(!long.ok && long.code, "duration");
  assert.equal(validateUploadRequest({ mimeType: "video/mp4", size: 1000, durationSec: 180 }).ok, true);
  const photo = validateUploadRequest({ mimeType: "image/png", size: MAX_UPLOAD_PHOTO_BYTES + 1 });
  assert.equal(!photo.ok && photo.code, "size");
  assert.equal(validateUploadRequest({ mimeType: "image/webp", size: 0 }).ok, false);
});

test("magic bytes", () => {
  const pad = (bytes: number[]) => new Uint8Array([...bytes, ...new Array(16).fill(0)]);
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
  assert.equal(sniffMediaType(pad([0xff, 0xd8, 0xff, 0xe0])), "photo");
  assert.equal(sniffMediaType(pad([0x89, ...ascii("PNG")])), "photo");
  assert.equal(sniffMediaType(pad([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")])), "photo");
  assert.equal(sniffMediaType(pad([0, 0, 0, 0x18, ...ascii("ftypheic")])), "photo");
  assert.equal(sniffMediaType(pad([0, 0, 0, 0x18, ...ascii("ftypisom")])), "video");
  assert.equal(sniffMediaType(pad([0, 0, 0, 0x14, ...ascii("ftypqt  ")])), "video");
  assert.equal(sniffMediaType(pad([0x1a, 0x45, 0xdf, 0xa3])), "video");
  assert.equal(sniffMediaType(pad(ascii("%PDF-1.7"))), null);
});

test("chunks: boundaries, last chunk, no overrun", () => {
  const total = UPLOAD_CHUNK_BYTES * 2 + 10;
  assert.equal(chunkCount(total), 3);
  assert.deepEqual(validateChunk({ offset: 0, length: UPLOAD_CHUNK_BYTES, totalBytes: total, chunkBytes: UPLOAD_CHUNK_BYTES }), { ok: true, index: 0 });
  assert.deepEqual(validateChunk({ offset: UPLOAD_CHUNK_BYTES * 2, length: 10, totalBytes: total, chunkBytes: UPLOAD_CHUNK_BYTES }), { ok: true, index: 2 });
  assert.equal(validateChunk({ offset: 5, length: 10, totalBytes: total, chunkBytes: UPLOAD_CHUNK_BYTES }).ok, false);
  assert.equal(validateChunk({ offset: 0, length: 10, totalBytes: total, chunkBytes: UPLOAD_CHUNK_BYTES }).ok, false);
  assert.equal(validateChunk({ offset: UPLOAD_CHUNK_BYTES * 2, length: 11, totalBytes: total, chunkBytes: UPLOAD_CHUNK_BYTES }).ok, false);
  assert.equal(
    chunkObjectPath("ABC", "DEF", 7),
    "uploads/abc/def/00007"
  );
});

test("6-item portfolio: saved + in-flight uploads", () => {
  assert.equal(portfolioSlotsLeft(4, 1), 1);
  assert.equal(portfolioSlotsLeft(6, 0), 0);
  assert.equal(portfolioSlotsLeft(8, 0), 0);
});

test("staging: contiguous received bytes from chunk parts", async () => {
  const {
    chunkPartPath,
    contiguousReceivedBytes,
    ensureUploadDir,
    expectedChunkLength,
  } = await import("../lib/portfolioUploadStaging.ts");
  const root = await mkdtemp(path.join(os.tmpdir(), "influo-staging-"));
  const prev = process.env.PORTFOLIO_UPLOAD_STAGING_DIR;
  process.env.PORTFOLIO_UPLOAD_STAGING_DIR = root;
  try {
    const inf = "11111111-2222-3333-4444-555555555555";
    const up = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const dir = await ensureUploadDir(inf, up);
    const total = UPLOAD_CHUNK_BYTES * 2 + 11;
    const len0 = expectedChunkLength(0, total, UPLOAD_CHUNK_BYTES);
    const len1 = expectedChunkLength(1, total, UPLOAD_CHUNK_BYTES);
    assert.equal(await contiguousReceivedBytes(dir, total, UPLOAD_CHUNK_BYTES), 0);
    await writeFile(chunkPartPath(dir, 0), Buffer.alloc(len0, 1));
    assert.equal(await contiguousReceivedBytes(dir, total, UPLOAD_CHUNK_BYTES), len0);
    await writeFile(chunkPartPath(dir, 1), Buffer.alloc(len1, 2));
    assert.equal(await contiguousReceivedBytes(dir, total, UPLOAD_CHUNK_BYTES), len0 + len1);
    await writeFile(chunkPartPath(dir, 2), Buffer.alloc(11, 3));
    assert.equal(await contiguousReceivedBytes(dir, total, UPLOAD_CHUNK_BYTES), total);
  } finally {
    if (prev === undefined) delete process.env.PORTFOLIO_UPLOAD_STAGING_DIR;
    else process.env.PORTFOLIO_UPLOAD_STAGING_DIR = prev;
    await rm(root, { recursive: true, force: true });
  }
});

test("uploaded portfolio URL detection", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  assert.equal(isUploadedPortfolioUrl(`https://db.influo.gr/storage/v1/object/public/creator-videos/creators/${id}/portfolio/upload-${id}/video.mp4`), true);
  assert.equal(isUploadedPortfolioUrl(`https://media.influo.gr/creators/${id}/portfolio/upload-${id}/photo.webp`), true);
  assert.equal(isUploadedPortfolioUrl("https://www.tiktok.com/@a/video/1"), false);
});

test("re-exported isUploadedPortfolioUrl matches portfolioHosted", async () => {
  process.env.NEXT_PUBLIC_MEDIA_PUBLIC_BASE_URL = "https://api.influo.gr";
  const { isSelfHostedPortfolioUrl } = await import("../lib/portfolioHosted.ts");
  const id = "11111111-2222-3333-4444-555555555555";
  const url = `https://api.influo.gr/creators/${id}/portfolio/upload-${id}/photo.webp`;
  assert.equal(isSelfHostedPortfolioUrl(url), true);
});
