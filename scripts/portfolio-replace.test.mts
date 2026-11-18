import assert from "node:assert/strict";
import test from "node:test";
import {
  pickReplacementPortfolioVideo,
  samePortfolioMediaUrl,
} from "../lib/portfolioReplace.ts";

test("samePortfolioMediaUrl matches TikTok ids even when the URL form differs", () => {
  assert.equal(
    samePortfolioMediaUrl(
      "https://www.tiktok.com/@avlwnith/video/7683552770456030486",
      "https://www.tiktok.com/@other/video/7683552770456030486?foo=1"
    ),
    true
  );
  assert.equal(
    samePortfolioMediaUrl(
      "https://www.tiktok.com/@avlwnith/video/7683552770456030486",
      "https://www.tiktok.com/@avlwnith/video/7692394369172688150"
    ),
    false
  );
});

test("pickReplacementPortfolioVideo skips the failed item and ones already shown", () => {
  const failed = "https://vm.tiktok.com/ZNRc3HWEw/";
  const shown = [
    failed,
    "https://www.tiktok.com/@avlwnith/video/7683552770456030486",
  ];
  const candidates = [
    "https://www.tiktok.com/@avlwnith/video/7683552770456030486",
    "https://www.tiktok.com/@avlwnith/video/7692394369172688150",
    "https://www.tiktok.com/@avlwnith/video/7677632147582110998",
  ];
  assert.equal(
    pickReplacementPortfolioVideo(failed, shown, candidates),
    "https://www.tiktok.com/@avlwnith/video/7692394369172688150"
  );
  assert.equal(pickReplacementPortfolioVideo(failed, [...shown, ...candidates], candidates), null);
});