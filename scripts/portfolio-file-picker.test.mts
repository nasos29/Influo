import assert from "node:assert/strict";
import test from "node:test";
import { isPortfolioPickableFile, PORTFOLIO_FILE_ACCEPT } from "../lib/portfolioFilePicker.ts";

test("accept includes application/octet-stream for Android Files chooser", () => {
  assert.match(PORTFOLIO_FILE_ACCEPT, /application\/octet-stream/);
  assert.doesNotMatch(PORTFOLIO_FILE_ACCEPT, /video\/\*/);
  assert.doesNotMatch(PORTFOLIO_FILE_ACCEPT, /image\/\*/);
});

test("isPortfolioPickableFile: MIME and extension fallback", () => {
  assert.equal(isPortfolioPickableFile("video/mp4", "x.bin"), true);
  assert.equal(isPortfolioPickableFile("", "clip.mov"), true);
  assert.equal(isPortfolioPickableFile("application/octet-stream", "clip.mov"), true);
  assert.equal(isPortfolioPickableFile("application/pdf", "doc.pdf"), false);
  assert.equal(isPortfolioPickableFile("application/pdf", "fake.mp4"), false);
});