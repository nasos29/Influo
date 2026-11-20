import assert from "node:assert/strict";
import test from "node:test";
import {
  isDownloadablePortfolioLinkUrl,
  isSelfHostedPortfolioUrl,
  isUploadedPortfolioUrl,
  portfolioLinkSourceKey,
  portfolioLinkUiPhase,
} from "../lib/portfolioHosted.ts";

test("self-hosted portfolio URLs are not re-queued as link jobs", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  const upload = `https://api.influo.gr/storage/v1/object/public/creator-videos/creators/${id}/portfolio/upload-${id}/photo.webp`;
  assert.equal(isSelfHostedPortfolioUrl(upload), true);
  assert.equal(isUploadedPortfolioUrl(upload), true);
  assert.equal(isDownloadablePortfolioLinkUrl(upload), false);

  const hosted = `https://media.influo.gr/creators/${id}/portfolio/tiktok-123/video.mp4`;
  assert.equal(isSelfHostedPortfolioUrl(hosted), true);
  assert.equal(isDownloadablePortfolioLinkUrl(hosted), false);
});

test("TikTok/Instagram links remain downloadable unless already hosted", () => {
  assert.equal(isDownloadablePortfolioLinkUrl("https://www.tiktok.com/@a/video/123"), true);
  assert.equal(isDownloadablePortfolioLinkUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), false);
});

test("portfolio link source key matches DB trigger shape", () => {
  assert.equal(
    portfolioLinkSourceKey("https://www.tiktok.com/@x/video/1/?lang=en#tag"),
    "tiktok.com/@x/video/1"
  );
});

test("link UI phases", () => {
  const tiktok = "https://www.tiktok.com/@a/video/99";
  const key = portfolioLinkSourceKey(tiktok);
  assert.equal(portfolioLinkUiPhase(tiktok, undefined, new Map()), "pending");
  assert.equal(
    portfolioLinkUiPhase(tiktok, { sourceUrl: tiktok, sourceKey: key, jobStatus: "done", attempts: 1, error: null, mediaReady: true }, new Map()),
    "ready"
  );
  assert.equal(
    portfolioLinkUiPhase(tiktok, { sourceUrl: tiktok, sourceKey: key, jobStatus: "failed", attempts: 4, error: "x", mediaReady: false }, new Map()),
    "failed"
  );
  assert.equal(
    portfolioLinkUiPhase(tiktok, { sourceUrl: tiktok, sourceKey: key, jobStatus: "failed", attempts: 2, error: "x", mediaReady: false }, new Map()),
    "pending"
  );
});