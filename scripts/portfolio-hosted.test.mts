import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_MEDIA_PUBLIC_BASE_URL = "https://media.influo.gr";
import {
  isDownloadablePortfolioLinkUrl,
  isSelfHostedPortfolioUrl,
  isUploadedPortfolioUrl,
  portfolioLinkSourceKey,
  portfolioLinkUiPhase,
} from "../lib/portfolioHosted.ts";

test("portfolio path on foreign host is not treated as self-hosted", () => {
  assert.equal(
    isSelfHostedPortfolioUrl(
      "https://evil.example/creators/11111111-2222-3333-4444-555555555555/portfolio/tiktok-1/video.mp4"
    ),
    false
  );
});

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